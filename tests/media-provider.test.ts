import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, test } from 'node:test';
import {
  checkVideoJob, decodeImageResult, generateImageMedia, generateSpeech, submitVideoJob,
  MAX_AUDIO_BYTES, transcribeAudio, validateAudioFile,
} from '../src/lib/media-provider';
import {
  clearMediaCatalogCache, discoverMediaModels, normalizeImageModel, validateMediaModel,
} from '../src/lib/media-catalog';
import { MediaError } from '../src/lib/media-errors';

const imageModel = {
  id: 'test/image', name: 'Test Image',
  architecture: { input_modalities: ['text'], output_modalities: ['image'] },
  supported_parameters: {
    aspect_ratio: { values: ['1:1', '9:16'] }, quality: { values: ['medium', 'high'] },
    output_format: { values: ['png', 'jpeg', 'webp'] }, resolution: { values: ['1K'] },
    input_references: { type: 'array' },
  },
};
const audioModel = { id: 'openai/test-tts', architecture: { output_modalities: ['speech'] } };
const googleAudio = { id: 'google/gemini-3.1-flash-tts-preview', architecture: { output_modalities: ['speech'] } };
const sttModel = { id: 'test/stt', architecture: { output_modalities: ['transcription'] } };
const videoModel = {
  id: 'test/video', name: 'Test Video',
  supported_durations: [4, 8], supported_resolutions: ['720p'], supported_aspect_ratios: ['16:9', '9:16'],
  pricing_skus: { 'per-video-second': '0.50' },
};

/** One second of silent, mono 16-bit PCM, made entirely in memory. */
function wav(seconds = 1): Buffer {
  const size = 8000 * 2 * seconds;
  const bytes = Buffer.alloc(44 + size);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + size, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(size, 40);
  return bytes;
}

/** MPEG-1 Layer III frame sequence, 128 kbps / 44.1 kHz with zero audio data. */
function mp3(): Buffer {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  return Buffer.concat(Array.from({ length: 40 }, () => frame));
}

function json(value: unknown, status = 200) { return Response.json(value, { status }); }
function binary(value: Buffer, contentType: string) {
  return new Response(new Uint8Array(value), { headers: { 'Content-Type': contentType } });
}
function errorCode(code: string, status?: number) {
  return (error: unknown) => error instanceof MediaError && error.code === code && (status === undefined || error.status === status);
}

describe('media providers with isolated environment and mocked fetch', { concurrency: false }, () => {
  let PNG: Buffer;
  let JPEG: Buffer;
  let WEBP: Buffer;
  before(async () => {
    // Real two-pixel raster fixtures, generated in memory without any filesystem or network I/O.
    const { default: sharp } = await import('sharp');
    const image = sharp({ create: { width: 2, height: 2, channels: 3, background: '#336699' } });
    [PNG, JPEG, WEBP] = await Promise.all([
      image.clone().png().toBuffer(), image.clone().jpeg().toBuffer(), image.clone().webp().toBuffer(),
    ]);
  });
  const envKeys = [
    'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_IMAGE_MODEL',
    'GEMINI_IMAGE_MODEL', 'GEMINI_TRANSCRIPTION_MODEL', 'OPENROUTER_TTS_MODEL', 'OPENROUTER_TTS_VOICE', 'OPENROUTER_STT_MODEL',
    'GROQ_STT_MODEL', 'MARKETING_MEDIA_IMAGE_ENABLED', 'MARKETING_MEDIA_TTS_ENABLED', 'MARKETING_MEDIA_STT_ENABLED',
    'OPENROUTER_VIDEO_MODEL', 'MARKETING_MEDIA_VIDEO_ENABLED',
    // B1 VIDEO ASYNC (7 Sep 2026): MEDIA_VIDEO_POLL_INTERVAL_MS/TIMEOUT_MS DIHAPUS dari
    // sini -- keduanya sudah tidak dibaca kode manapun sejak generateVideoMedia()/
    // pollVideoJob() internal (yang dulu membacanya) diganti submitVideoJob()/
    // checkVideoJob() (1x fetch, tanpa loop/deadline server-side; deadline sekarang
    // tanggung jawab client, lihat client.test.mts pollVideoJob).
  ];
  let previousEnv: Record<string, string | undefined>;
  let originalFetch: typeof globalThis.fetch;
  let calls: Array<{ url: string; init?: RequestInit }>;
  let unexpected: string[];
  let respond: (url: string, init?: RequestInit) => Response | Promise<Response>;

  beforeEach(() => {
    previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    for (const key of envKeys) delete process.env[key];
    Object.assign(process.env, {
      OPENROUTER_API_KEY: 'test-only-openrouter-key', OPENROUTER_IMAGE_MODEL: imageModel.id,
      OPENROUTER_TTS_MODEL: audioModel.id, OPENROUTER_STT_MODEL: sttModel.id, OPENROUTER_VIDEO_MODEL: videoModel.id,
    });
    clearMediaCatalogCache();
    calls = []; unexpected = [];
    respond = url => { unexpected.push(url); throw new Error('Unexpected mocked request'); };
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push({ url, init });
      return respond(url, init);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
    clearMediaCatalogCache();
    assert.deepEqual(unexpected, [], 'Every outbound call must match an explicit mock');
  });

  function catalogs(url: string): Response | undefined {
    if (url.endsWith('/images/models')) return json({ data: [imageModel] });
    if (url.endsWith('/videos/models')) return json({ data: [videoModel] });
    if (url.includes('output_modalities=speech')) return json({ data: [audioModel, googleAudio] });
    if (url.includes('output_modalities=transcription')) return json({ data: [sttModel] });
    if (url.endsWith('/images/models/test/image/endpoints')) return json({ endpoints: [{ provider_tag: 'test-provider', supported_parameters: imageModel.supported_parameters }] });
    return undefined;
  }

  test('image parser accepts PNG base64 and data URL, inferring actual bytes rather than declared MIME', async () => {
    for (const value of [PNG.toString('base64'), `data:image/png;base64,${PNG.toString('base64')}`, `data:image/jpeg;base64,${PNG.toString('base64')}`]) {
      const result = await decodeImageResult(value);
      assert.equal(result.mimeType, 'image/png');
      assert.deepEqual(Buffer.from(result.base64, 'base64'), PNG);
    }
    assert.equal(calls.length, 0);
  });

  test('image parser accepts real JPEG and WebP and preserves MIME and bytes', async () => {
    for (const [bytes, mimeType] of [[JPEG, 'image/jpeg'], [WEBP, 'image/webp']] as const) {
      const result = await decodeImageResult(`data:${mimeType};base64,${bytes.toString('base64')}`);
      assert.equal(result.mimeType, mimeType);
      assert.deepEqual(Buffer.from(result.base64, 'base64'), bytes);
    }
    assert.equal(calls.length, 0);
  });

  test('image parser rejects absent, malformed, non-image, unsupported MIME and short bytes', async () => {
    for (const value of [undefined, null, {}, 1, '', '%%%invalid', 'a===',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'),
      `data:text/html;base64,${PNG.toString('base64')}`, PNG.subarray(0, 8).toString('base64'),
      Buffer.alloc(40).toString('base64')]) {
      await assert.rejects(decodeImageResult(value), errorCode('PROVIDER_ERROR', 502));
    }
  });

  test('image parser must reject truncated PNG containing only signature and padding', async () => {
    const truncated = Buffer.alloc(40);
    PNG.copy(truncated, 0, 0, 8);
    await assert.rejects(decodeImageResult(truncated.toString('base64')), errorCode('PROVIDER_ERROR', 502));
  });

  test('catalog normalizes image capabilities and excludes text-only / SVG-only models', () => {
    const result = normalizeImageModel(imageModel)!;
    assert.equal(result.id, imageModel.id);
    assert.equal(result.verified, true);
    assert.deepEqual(result.capabilities.aspectRatios, ['1:1', '9:16']);
    assert.deepEqual(result.capabilities.qualities, ['medium', 'high']);
    assert.equal(result.capabilities.supportsReferenceImages, true);
    assert.equal(normalizeImageModel({ ...imageModel, id: '' }), null);
    assert.equal(normalizeImageModel({ id: 'text', architecture: { output_modalities: ['text'] } }), null);
    assert.equal(normalizeImageModel({ ...imageModel, supported_parameters: { output_format: { values: ['svg'] } } }), null);
  });

  test('catalog discovers, caches, validates configured model and rejects a stale selection', async () => {
    respond = url => catalogs(url)!;
    const models = await discoverMediaModels('image');
    assert.equal(models.length, 1);
    assert.equal((await validateMediaModel('image')).id, imageModel.id);
    await assert.rejects(validateMediaModel('image', 'stale/model'), errorCode('MODEL_UNAVAILABLE', 400));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init?.cache, 'no-store');
  });

  test('catalog rejects malformed JSON, malformed data and catalogs without image models', async () => {
    for (const body of ['not json', '[]', '{}', '{"data":{}}', '{"data":[]}']) {
      clearMediaCatalogCache();
      respond = () => new Response(body);
      await assert.rejects(discoverMediaModels('image'), (error: unknown) => error instanceof MediaError);
    }
  });

  test('image generation passes validated options and returns actual model, bytes and usage', async () => {
    respond = (url, init) => {
      const catalog = catalogs(url); if (catalog) return catalog;
      assert.ok(url.endsWith('/images'));
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, imageModel.id);
      assert.equal(body.aspect_ratio, '9:16');
      assert.equal(body.quality, 'high');
      assert.deepEqual(body.provider, { order: ['test-provider'], allow_fallbacks: false });
      return json({ data: [{ b64_json: PNG.toString('base64') }], usage: { cost: 0.01 } });
    };
    const result = await generateImageMedia('Poster kopi', { aspectRatio: '9:16', quality: 'hd', outputFormat: 'png' });
    assert.equal(result.provider, 'openrouter');
    assert.equal(result.modelUsed, imageModel.id);
    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.usage?.costUsd, 0.01);
    assert.equal(calls.length, 3);
  });

  test('invalid image options stop before generation and do not silently fallback', async () => {
    process.env.GEMINI_API_KEY = 'test-only-gemini-key';
    respond = url => catalogs(url)!;
    await assert.rejects(generateImageMedia('Poster kopi', { aspectRatio: '7:3' }), errorCode('INVALID_INPUT', 400));
    assert.equal(calls.length, 1);
  });

  test('image provider HTTP failure and missing image bytes fall back to Gemini with honest metadata', async () => {
    process.env.GEMINI_API_KEY = 'test-only-gemini-key';
    process.env.GEMINI_IMAGE_MODEL = 'test-gemini-image';
    for (const failure of [() => json({ error: 'upstream private data' }, 503), () => json({ data: [] })]) {
      clearMediaCatalogCache(); calls = [];
      respond = url => {
        const catalog = catalogs(url); if (catalog) return catalog;
        if (url.endsWith('/images')) return failure();
        assert.ok(url.includes('generativelanguage.googleapis.com'));
        return json({ candidates: [{ content: { parts: [{ inlineData: { data: PNG.toString('base64') } }] } }] });
      };
      const result = await generateImageMedia('Poster kopi');
      assert.equal(result.provider, 'gemini');
      assert.equal(result.modelUsed, 'test-gemini-image');
      assert.match(result.note!, /fallback Gemini/);
      assert.equal(calls.length, 4);
    }
  });

  // B1 VIDEO ASYNC (7 Sep 2026): generateVideoMedia() lama (submit+poll dalam SATU
  // panggilan sampai 150 detik -- akar bug "berhasil di provider tapi enggak muncul")
  // DIHAPUS TOTAL, diganti submitVideoJob() (submit SEKALI, balas pending+jobId tanpa
  // menunggu) + checkVideoJob() (cek status SEKALI, dipanggil berulang dari client).
  // 8 skenario di bawah menutupi keduanya secara terpisah.
  describe('submitVideoJob: submit sekali, tanpa polling', () => {
    test('stays planned with zero fetch when OpenRouter key is absent (capability off)', async () => {
      delete process.env.OPENROUTER_API_KEY;
      process.env.GEMINI_API_KEY = 'test-only-gemini-key';
      const result = await submitVideoJob('Cuplikan promosi kopi 8 detik');
      assert.equal(result.kind, 'video');
      assert.equal(result.status, 'planned');
      assert.equal(result.availableAlternative, 'video-plan');
      assert.equal(result.dataUrl, undefined);
      // video-005: capability off -> genuinely belum pernah dicoba, badge "Segera" tetap tepat.
      assert.equal(result.attempted, false);
      assert.equal(calls.length, 0);
    });

    test('submit sukses mengembalikan {status:pending, jobId} dengan HANYA satu POST /videos -- TANPA polling sama sekali', async () => {
      respond = url => {
        const catalog = catalogs(url); if (catalog) return catalog;
        if (url.endsWith('/videos')) return json({ id: 'job-abc123', status: 'pending', polling_url: 'https://openrouter.ai/api/v1/videos/job-abc123' }, 202);
        throw new Error('Unexpected mocked request (submitVideoJob tidak boleh poll): ' + url);
      };
      const result = await submitVideoJob('Cuplikan promosi kopi 8 detik', { aspectRatio: '16:9', durationSeconds: 8 });
      assert.equal(result.kind, 'video');
      assert.equal(result.status, 'pending');
      assert.equal(result.jobId, 'job-abc123');
      assert.equal(result.provider, 'openrouter');
      assert.equal(result.modelUsed, videoModel.id);
      // Bukti tidak ada polling: cuma 1 panggilan catalog (/videos/models) + 1 submit (/videos).
      const submitCalls = calls.filter(c => c.url.endsWith('/videos'));
      assert.equal(submitCalls.length, 1, 'harus persis 1 POST /videos, nol GET /videos/{id}');
      const body = JSON.parse(String(submitCalls[0].init?.body));
      assert.equal(body.model, videoModel.id);
      assert.equal(body.aspect_ratio, '16:9');
      assert.equal(body.duration, 8);
    });

    // FIX (7 Sep, gap LOW #4): sebelumnya pilihan video yang tidak didukung model (mis.
    // '1:1' saat videoModel hanya mendeklarasikan supported_aspect_ratios ['16:9','9:16'])
    // diam-diam diabaikan -- provider lalu memakai default sendiri tanpa pesan apapun ke
    // user. Sekarang jujur menolak sebelum submit job apapun, sama seperti pola yang
    // sudah ada untuk gambar ('invalid image options stop before generation...' di atas).
    test('invalid video options stop before submitting any render job and do not silently fallback', async () => {
      respond = url => catalogs(url)!;
      await assert.rejects(submitVideoJob('Cuplikan promosi kopi 8 detik', { aspectRatio: '1:1' }), errorCode('INVALID_INPUT', 400));
      assert.equal(calls.length, 1, 'harus berhenti setelah catalog lookup, sebelum POST /videos');
    });

    test('submit HTTP error falls back to planned instead of throwing to the caller', async () => {
      respond = url => {
        const catalog = catalogs(url); if (catalog) return catalog;
        if (url.endsWith('/videos')) return json({ error: 'quota exceeded' }, 503);
        throw new Error('Unexpected mocked request: ' + url);
      };
      const result = await submitVideoJob('Cuplikan promosi kopi 8 detik');
      assert.equal(result.status, 'planned');
      assert.equal(result.availableAlternative, 'video-plan');
      // gagal SEBELUM job pernah disubmit (POST /videos sendiri yang gagal) -- belum
      // pernah genuinely dicoba ke provider, jadi badge "Segera" (bukan "Gagal") tepat.
      assert.equal(result.attempted, false);
    });
  });

  describe('checkVideoJob: cek status sekali, tanpa loop', () => {
    test('in_progress -> pending, satu fetch saja', async () => {
      respond = url => {
        if (url.endsWith('/videos/job-abc123')) return json({ id: 'job-abc123', status: 'in_progress' });
        throw new Error('Unexpected mocked request: ' + url);
      };
      const result = await checkVideoJob('job-abc123');
      assert.deepEqual(result, { status: 'pending', attempted: true });
      assert.equal(calls.length, 1);
    });

    test('completed + unsigned_urls -> ready + url proxy KLIR (bukan URL provider yang butuh API key)', async () => {
      respond = url => {
        if (url.endsWith('/videos/job-abc123')) return json({ id: 'job-abc123', status: 'completed', unsigned_urls: ['https://openrouter.ai/videos/job-abc123.mp4'], usage: { cost: 0.5 } });
        throw new Error('Unexpected mocked request: ' + url);
      };
      const result = await checkVideoJob('job-abc123');
      assert.equal(result.status, 'ready');
      assert.equal(result.mimeType, 'video/mp4');
      // FIX 7 Sep: unsigned_urls provider WAJIB API key (browser 401) -> url yang dikirim
      // ke client = proxy same-origin KLIR yang menyertakan key di server.
      assert.equal(result.url, '/api/v1/media/video-content?job=job-abc123&index=0');
      assert.equal(result.usage?.costUsd, 0.5);
      assert.equal(result.attempted, true);
      assert.equal(calls.length, 1);
    });

    for (const status of ['failed', 'cancelled', 'expired'] as const) {
      test(`${status} -> failed + note sesuai, satu fetch saja`, async context => {
        const warnCalls: unknown[][] = [];
        context.mock.method(console, 'warn', (...args: unknown[]) => { warnCalls.push(args); });
        respond = url => {
          if (url.endsWith('/videos/job-xyz')) return json({ id: 'job-xyz', status, error: status === 'failed' ? 'provider overloaded' : undefined });
          throw new Error('Unexpected mocked request: ' + url);
        };
        const result = await checkVideoJob('job-xyz');
        assert.equal(result.status, 'failed');
        assert.equal(result.attempted, true);
        assert.match(result.note!, status === 'expired' ? /batas waktu/i : /gagal/i);
        assert.equal(calls.length, 1);
        // video-002 mitigasi: jobId WAJIB masuk log warn supaya bisa ditelusuri manual.
        assert.ok(warnCalls.some(args => JSON.stringify(args).includes('job-xyz')));
      });
    }

    test('capability off -> throw NO_PROVIDER tanpa fetch', async () => {
      delete process.env.OPENROUTER_API_KEY;
      await assert.rejects(checkVideoJob('job-abc123'), errorCode('NO_PROVIDER', 503));
      assert.equal(calls.length, 0);
    });
  });

  for (const [bytes, mime, extension] of [[mp3(), 'audio/mpeg', 'mp3'], [wav(), 'audio/wav', 'wav']] as const) {
    test(`TTS accepts ${extension.toUpperCase()} and preserves MIME, extension and original bytes`, async () => {
      respond = (url, init) => {
        const catalog = catalogs(url); if (catalog) return catalog;
        assert.ok(url.endsWith('/audio/speech'));
        const body = JSON.parse(String(init?.body));
        assert.equal(body.input, 'Promosi kopi hari ini.');
        assert.equal(body.voice, 'alloy'); assert.equal(body.speed, 1.25);
        return binary(bytes, mime);
      };
      const result = await generateSpeech('Promosi kopi hari ini.', { voice: 'alloy', speed: 1.25 });
      assert.equal(result.status, 'ready');
      assert.equal(result.mimeType, mime);
      assert.equal(result.fileName, `klir-voiceover.${extension}`);
      assert.equal(result.dataUrl, `data:${mime};base64,${bytes.toString('base64')}`);
      assert.equal(result.provider, 'openrouter');
      assert.equal(result.modelUsed, audioModel.id);
    });
  }

  test('TTS rejects JSON errors, invalid bytes and HTTP failure without treating them as audio', async () => {
    for (const failure of [() => json({ error: 'not audio' }), () => binary(Buffer.from('not audio'), 'audio/mpeg'), () => json({ error: 'private' }, 429)]) {
      respond = url => catalogs(url) || failure();
      await assert.rejects(generateSpeech('Promosi kopi.'), errorCode('PROVIDER_ERROR', 502));
    }
  });

  test('Google TTS requests PCM and converts one second of 24kHz mono16 audio to real MP3', async () => {
    respond = (url, init) => {
      const catalog = catalogs(url); if (catalog) return catalog;
      assert.ok(url.endsWith('/audio/speech'));
      assert.equal(JSON.parse(String(init?.body)).response_format, 'pcm');
      return binary(Buffer.alloc(24_000 * 2), 'audio/pcm');
    };
    const result = await generateSpeech('Promosi kopi.', { model: googleAudio.id, voice: 'Kore' });
    assert.equal(result.mimeType, 'audio/mpeg');
    assert.equal(result.fileName, 'klir-voiceover.mp3');
    assert.equal(result.modelUsed, googleAudio.id);
    assert.match(result.dataUrl!, /^data:audio\/mpeg;base64,/);
    const bytes = Buffer.from(result.dataUrl!.split(',')[1], 'base64');
    const { parseBuffer } = await import('music-metadata');
    const meta = await parseBuffer(bytes, { mimeType: 'audio/mpeg' }, { duration: true });
    assert.ok(meta.format.duration! >= 0.9 && meta.format.duration! <= 1.3);
    assert.equal(meta.format.numberOfChannels, 1);
  });

  test('Google TTS rejects malformed PCM and error content types rather than encoding them as speech', async () => {
    for (const [bytes, mime] of [
      [Buffer.alloc(0), 'audio/pcm'], [Buffer.alloc(48001), 'audio/pcm'],
      [Buffer.from('{"error":"denied"} '), 'application/json'],
      [Buffer.alloc(48000), 'text/html'], [Buffer.alloc(48000), 'image/png'],
    ] as const) {
      respond = url => catalogs(url) || binary(bytes, mime);
      await assert.rejects(generateSpeech('Promosi kopi.', { model: googleAudio.id, voice: 'Kore' }), errorCode('PROVIDER_ERROR', 502));
    }
  });

  test('TTS invalid voice, out-of-range speed, unsupported speed and blank scripts never reach speech endpoint', async () => {
    respond = url => catalogs(url)!;
    for (const options of [{ voice: 'nonexistent' }, { speed: 0.49 }, { speed: 2.01 }, { speed: Infinity }, { model: googleAudio.id, speed: 1.5 }]) {
      await assert.rejects(generateSpeech('Promosi kopi.', options), errorCode('INVALID_INPUT', 400));
    }
    for (const script of ['', '  ', 'a'.repeat(6001)]) {
      await assert.rejects(generateSpeech(script), errorCode('INVALID_INPUT', 400));
    }
    assert.ok(calls.every(call => call.url.includes('output_modalities=speech')));
  });

  test('TTS must reject NaN speed before an outbound speech request', async () => {
    respond = url => catalogs(url) || binary(wav(), 'audio/wav');
    await assert.rejects(generateSpeech('Promosi kopi.', { speed: Number.NaN }), errorCode('INVALID_INPUT', 400));
    assert.ok(calls.every(call => !call.url.endsWith('/audio/speech')));
  });

  test('STT validates one-second PCM without fetch', async () => {
    const { parseBuffer } = await import('music-metadata');
    const fixtureMetadata = await parseBuffer(wav(), { mimeType: 'audio/wav' }, { duration: true });
    assert.equal(fixtureMetadata.format.duration, 1, 'Fixture itself must have a readable duration');
    const result = await validateAudioFile(wav(), 'audio/wav', 'voice.wav');
    assert.equal(result.duration, 1);
    assert.equal(result.format, 'wav');
    assert.equal(calls.length, 0);
  });

  test('STT rejects empty, oversized, invalid, unsupported, and overlong audio before fetch', async () => {
    const cases: Array<[Buffer, string, string, string]> = [
      [Buffer.alloc(0), 'audio/wav', 'voice.wav', 'INVALID_INPUT'],
      [Buffer.alloc(MAX_AUDIO_BYTES + 1), 'audio/wav', 'voice.wav', 'FILE_TOO_LARGE'],
      [Buffer.from('not an audio file'), 'audio/wav', 'voice.wav', 'INVALID_INPUT'],
      [wav(), 'application/json', 'voice.wav', 'UNSUPPORTED_FORMAT'],
      [wav(), 'audio/wav', 'voice.exe', 'UNSUPPORTED_FORMAT'],
      [wav(121), 'audio/wav', 'voice.wav', 'INVALID_INPUT'],
    ];
    for (const [bytes, mime, name, code] of cases) {
      await assert.rejects(transcribeAudio(bytes, mime, name), errorCode(code));
    }
    await assert.rejects(transcribeAudio(wav(), 'audio/wav', 'voice.wav', 'indonesia'), errorCode('INVALID_INPUT'));
    assert.equal(calls.length, 0);
  });

  test('STT uses the actual audio format when an allowed filename extension is misleading', async () => {
    const result = await validateAudioFile(wav(), 'audio/wav', 'mislabeled.mp3');
    assert.equal(result.format, 'wav');
    respond = (url, init) => {
      const catalog = catalogs(url); if (catalog) return catalog;
      assert.equal(JSON.parse(String(init?.body)).input_audio.format, 'wav');
      return json({ text: 'Ucapan uji.' });
    };
    await transcribeAudio(wav(), 'audio/wav', 'mislabeled.mp3');
  });

  test('STT Groq succeeds with multipart audio and preserves transcript metadata', async () => {
    process.env.GROQ_API_KEY = 'test-only-groq-key';
    respond = (url, init) => {
      assert.ok(url.startsWith('https://api.groq.com/'));
      const form = init?.body as FormData;
      assert.equal(form.get('language'), 'id');
      assert.ok(form.get('file') instanceof Blob);
      return json({ text: '  Promosi kopi.  ' });
    };
    const result = await transcribeAudio(wav(), 'audio/wav', 'voice.wav');
    assert.equal(result.text, 'Promosi kopi.');
    assert.equal(result.provider, 'groq');
    assert.equal(result.durationSeconds, 1);
    assert.equal(calls.length, 1);
  });

  test('STT prefers direct Gemini for automatic transcription routing', async () => {
    process.env.GEMINI_API_KEY = 'test-only-gemini-key';
    process.env.GEMINI_TRANSCRIPTION_MODEL = 'test-gemini-transcribe';
    process.env.GROQ_API_KEY = 'test-only-groq-key';
    respond = (url, init) => {
      assert.ok(url.endsWith('/models/test-gemini-transcribe:generateContent'));
      const body = JSON.parse(String(init?.body));
      assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'audio/wav');
      assert.equal(body.contents[0].parts[1].inlineData.data, wav().toString('base64'));
      return json({ candidates: [{ content: { parts: [{ text: '  Transkrip Gemini.  ' }] } }] });
    };
    const result = await transcribeAudio(wav(), 'audio/wav', 'voice.wav');
    assert.equal(result.text, 'Transkrip Gemini.');
    assert.equal(result.provider, 'gemini');
    assert.equal(result.modelUsed, 'test-gemini-transcribe');
    assert.equal(calls.length, 1);
  });

  test('STT falls back from Groq failure to OpenRouter and rejects empty transcripts', async () => {
    process.env.GROQ_API_KEY = 'test-only-groq-key';
    for (const transcript of ['Kopi tersedia.', ' ']) {
      respond = (url, init) => {
        if (url.startsWith('https://api.groq.com/')) return json({ error: 'unavailable' }, 503);
        const catalog = catalogs(url); if (catalog) return catalog;
        assert.ok(url.endsWith('/audio/transcriptions'));
        const body = JSON.parse(String(init?.body));
        assert.equal(body.input_audio.format, 'wav');
        assert.equal(body.language, 'id');
        return json({ text: transcript });
      };
      if (transcript.trim()) {
        const result = await transcribeAudio(wav(), 'audio/wav', 'voice.wav');
        assert.equal(result.provider, 'openrouter'); assert.equal(result.modelUsed, sttModel.id);
      } else {
        await assert.rejects(transcribeAudio(wav(), 'audio/wav', 'voice.wav'), errorCode('INVALID_INPUT'));
      }
    }
  });
});

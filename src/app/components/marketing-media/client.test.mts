import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBuffer } from 'music-metadata';
import { apiRequest, defaultImageRatio, detectStudioIntent, MAX_AUDIO_BYTES, pollVideoJob, supportedImageRatios, validMediaResult, validateAudio } from './client';
import { encodeWav } from './wav';

test('explicit media commands are intercepted before ordinary chat', () => {
  for (const [prompt, kind] of [
    ['Buatkan poster promosi kopi', 'image'], ['Tolong buat gambar, jangan tambahkan watermark', 'image'],
    ['Generate audio dari script ini', 'audio'], ['Buatkan voiceover promosi', 'audio'],
    ['Buat video TikTok empat scene', 'video'], ['Buat storyboard 30 detik', 'video'],
    ['Buat kuis dari materi ini', 'quiz'], ['Bikin flashcard untuk pelatihan', 'flashcard'],
  ]) assert.equal(detectStudioIntent(prompt), kind, prompt);
});

test('text requests, discussion, and negation remain ordinary chat', () => {
  for (const prompt of ['Apa model gambar terbaik?', 'Jangan buat gambar dulu', 'Tolong jangan buat video',
    'Buatkan naskah video TikTok', 'Buat konsep visual banner', 'Buat 3 ide video', 'Buat script voiceover',
    'Buat prompt gambar produk', 'Laporan performa marketing', 'Tulis email klien']) {
    assert.equal(detectStudioIntent(prompt), null, prompt);
  }
});

test('image ratios are catalog/route intersection and prefer square, never assume a capability', () => {
  const model = (aspectRatios?: string[]) => ({ id: 'image-model', name: 'Image', capabilities: { aspectRatios } });
  assert.deepEqual(supportedImageRatios(model(['21:9', '16:9', '1:1', '4:3'])), ['1:1', '16:9']);
  assert.equal(defaultImageRatio(model(['16:9', '1:1'])), '1:1');
  assert.equal(defaultImageRatio(model(['9:16', '4:5'])), '4:5');
  assert.deepEqual(supportedImageRatios(model()), []);
  assert.deepEqual(supportedImageRatios(model(['21:9'])), []);
  assert.equal(defaultImageRatio(model()), '');
});

test('ready media requires actual media URL, MIME, and provider metadata', () => {
  const base = { kind: 'audio', status: 'ready', provider: 'openrouter', modelUsed: 'google/gemini-3.1-flash-tts-preview', mimeType: 'audio/wav', dataUrl: 'data:audio/wav;base64,UklGRg==' } as const;
  assert.equal(validMediaResult(base), true);
  assert.equal(validMediaResult({ ...base, dataUrl: 'Hasil voiceover Anda' }), false);
  assert.equal(validMediaResult({ ...base, dataUrl: 'data:audio/mpeg;base64,UklGRg==' }), false);
  assert.equal(validMediaResult({ ...base, dataUrl: 'data:audio/wav;base64,' }), false);
  assert.equal(validMediaResult({ ...base, provider: 'deterministic_fallback' }), false);
  assert.equal(validMediaResult({ ...base, provider: undefined }), false);
  assert.equal(validMediaResult({ kind: 'video', status: 'ready', dataUrl: 'fake' }), false);
  assert.equal(validMediaResult({ kind: 'video', status: 'planned' }), true);
  // Item 4.6 (7 Sep): video ready pakai `url` provider (bukan dataUrl base64 -- video
  // terlalu besar), validasi wajib https + metadata provider + mimeType video/*.
  const readyVideo = { kind: 'video', status: 'ready', provider: 'openrouter', modelUsed: 'bytedance/seedance-2.0', mimeType: 'video/mp4', url: 'https://openrouter.ai/videos/abc.mp4' } as const;
  assert.equal(validMediaResult(readyVideo), true);
  assert.equal(validMediaResult({ ...readyVideo, url: 'http://insecure.example/abc.mp4' }), false);
  assert.equal(validMediaResult({ ...readyVideo, url: undefined }), false);
  assert.equal(validMediaResult({ ...readyVideo, provider: 'deterministic_fallback' }), false);
  assert.equal(validMediaResult({ ...readyVideo, mimeType: 'image/png' }), false);
  // B1 VIDEO ASYNC (7 Sep 2026): status transit setelah submit -- valid HANYA kalau
  // server juga mengirim jobId (tanpa itu client tidak bisa poll sama sekali).
  assert.equal(validMediaResult({ kind: 'video', status: 'pending', jobId: 'job-abc123' }), true);
  assert.equal(validMediaResult({ kind: 'video', status: 'pending' }), false);
  assert.equal(validMediaResult({ kind: 'video', status: 'pending', jobId: '' }), false);
});

// B1 VIDEO ASYNC (7 Sep 2026): pollVideoJob adalah pengganti sisi-client dari poll
// yang dulu terjadi DI DALAM satu HTTP request server (generateVideoMedia lama,
// akar bug "berhasil di provider tapi enggak muncul") -- sekarang server balas cepat
// {status:'pending', jobId} dan fungsi ini yang polling lewat request GET terpisah.
test('pollVideoJob polls until ready, mapping the terminal GET response to a ready MediaResult', async context => {
  const calls: string[] = [];
  let tick = 0;
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    calls.push(url);
    tick += 1;
    if (tick < 3) return Response.json({ success: true, data: { status: 'pending' } });
    return Response.json({ success: true, data: { status: 'ready', url: '/api/v1/media/video-content?job=job-abc123&index=0', mimeType: 'video/mp4', usage: { costUsd: 0.5 } } });
  });
  const result = await pollVideoJob('job-abc123', { intervalMs: 0 });
  assert.equal(result.kind, 'video');
  assert.equal(result.status, 'ready');
  assert.equal(result.url, '/api/v1/media/video-content?job=job-abc123&index=0');
  assert.equal(result.mimeType, 'video/mp4');
  assert.equal(result.usage?.costUsd, 0.5);
  assert.equal(calls.length, 3, 'harus poll sampai status ready, bukan berhenti di poll pertama');
  assert.ok(calls.every(url => url === '/api/v1/media/video-status?job=job-abc123'));
});

test('pollVideoJob maps a failed job to planned + attempted, preserving the honest note', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, data: { status: 'failed', note: 'Render video gagal pada provider saat ini.' } }));
  const result = await pollVideoJob('job-fail', { intervalMs: 0 });
  assert.equal(result.kind, 'video');
  assert.equal(result.status, 'planned');
  assert.equal(result.attempted, true);
  assert.equal(result.availableAlternative, 'video-plan');
  assert.match(result.note!, /gagal/i);
});

test('pollVideoJob gives up honestly after maxMs, mapping to planned + attempted (bukan macet selamanya)', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, data: { status: 'pending' } }));
  const result = await pollVideoJob('job-slow', { intervalMs: 0, maxMs: 5 });
  assert.equal(result.kind, 'video');
  assert.equal(result.status, 'planned');
  assert.equal(result.attempted, true);
  assert.equal(result.availableAlternative, 'video-plan');
  assert.match(result.note!, /batas waktu/i);
});

test('recording validation rejects unknown duration, empty data, oversize and long audio', () => {
  const file = new Blob(['audio'], { type: 'audio/wav' });
  validateAudio(file, 120);
  for (const duration of [0, -1, NaN, Infinity, 120.1]) assert.throws(() => validateAudio(file, duration));
  assert.throws(() => validateAudio(new Blob(), 1), /kosong/);
  assert.throws(() => validateAudio({ size: MAX_AUDIO_BYTES + 1 } as Blob, 1), /25 MB/);
});

test('WAV normalization yields backend-readable actual duration and PCM header', async () => {
  const samples = new Float32Array(16000 * 2);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 2 * Math.PI * 440 / 16000) * 0.1;
  const wav = encodeWav(samples, 16000);
  const metadata = await parseBuffer(new Uint8Array(wav), { mimeType: 'audio/wav' });
  assert.equal(metadata.format.duration, 2);
  assert.equal(metadata.format.sampleRate, 16000);
  assert.equal(metadata.format.numberOfChannels, 1);
  assert.equal(metadata.format.bitsPerSample, 16);
  assert.equal(wav.byteLength, 44 + samples.length * 2);
});

test('WAV normalization respects 120 second cap well within 25 MB', async () => {
  const wav = encodeWav(new Float32Array(16000 * 120), 16000);
  const metadata = await parseBuffer(new Uint8Array(wav), { mimeType: 'audio/wav' });
  assert.equal(metadata.format.duration, 120);
  assert.ok(wav.byteLength < MAX_AUDIO_BYTES);
});

test('WAV encoder clips PCM and rejects invalid input', () => {
  const view = new DataView(encodeWav(new Float32Array([-2, 2, NaN]), 16000));
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(46, true), 32767);
  assert.equal(view.getInt16(48, true), 0);
  assert.throws(() => encodeWav(new Float32Array(), 16000));
  assert.throws(() => encodeWav(new Float32Array(2), 0));
});

test('JSON client sends current cookies and makes exactly one request', async context => {
  const calls: RequestInit[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    calls.push(init); return Response.json({ success: true, data: { kind: 'video', status: 'planned' } });
  });
  await apiRequest('/api/v1/media/generate', { method: 'POST', body: JSON.stringify({ kind: 'video' }) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentials, 'same-origin');
  const headers = new Headers(calls[0].headers);
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(headers.get('Accept'), 'application/json');
  assert.equal(headers.has('Authorization'), false); // JWT is HttpOnly; no fake bearer token.
});

test('multipart client leaves boundary generation to browser', async context => {
  context.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).has('Content-Type'), false);
    assert.equal(init.credentials, 'same-origin');
    return Response.json({ success: true, data: { text: 'Test transcript' } });
  });
  await apiRequest('/api/v1/media/transcribe', { method: 'POST', body: new FormData() });
});

// video-004 (7 Sep, gap-fix video UX): server punya guard idempotency lengkap
// (media-http.ts runIdempotent) tapi tidak ada caller yang pernah kirim Idempotency-Key
// -- kalau user retry setelah kegagalan-palsu (nginx timeout, video-001), request baru
// terkirim dan kredit provider terbakar dua kali. Fix: apiRequest men-derive key dari
// hash body itu sendiri, mandiri tanpa perlu ubah komponen pemanggil.
test('media/generate POST requests carry a deterministic Idempotency-Key derived from the body', async context => {
  const calls: RequestInit[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    calls.push(init); return Response.json({ success: true, data: { kind: 'video', status: 'planned' } });
  });
  const bodyA = JSON.stringify({ kind: 'video', prompt: 'Cuplikan promosi kopi' });
  const bodyB = JSON.stringify({ kind: 'video', prompt: 'Cuplikan promosi teh' });
  await apiRequest('/api/v1/media/generate', { method: 'POST', body: bodyA });
  await apiRequest('/api/v1/media/generate', { method: 'POST', body: bodyA }); // identical retry
  await apiRequest('/api/v1/media/generate', { method: 'POST', body: bodyB }); // genuinely different request
  const keys = calls.map(init => new Headers(init.headers).get('Idempotency-Key'));
  assert.ok(keys.every(key => typeof key === 'string' && /^[0-9a-f]{64}$/.test(key)), 'harus SHA-256 hex 64 karakter di ketiganya');
  assert.equal(keys[0], keys[1], 'body identik (retry) harus dapat key yang sama persis -- server men-coalesce/replay, tidak render dua kali');
  assert.notEqual(keys[0], keys[2], 'body berbeda harus dapat key berbeda -- tidak boleh salah di-dedup jadi request lain');
});

test('Idempotency-Key is scoped to media/generate POST only, never other endpoints or GET', async context => {
  const calls: RequestInit[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    calls.push(init); return Response.json({ success: true, data: {} });
  });
  await apiRequest('/api/v1/media/models');
  await apiRequest('/api/v1/media/transcribe', { method: 'POST', body: new FormData() });
  await apiRequest('/api/v1/media/generate', { method: 'GET' });
  for (const init of calls) assert.equal(new Headers(init.headers).has('Idempotency-Key'), false);
});

test('authentication, provider errors and malformed success are not converted to demo output', async context => {
  const mocked = context.mock.method(globalThis, 'fetch', async () => Response.json({ success: false }, { status: 401 }));
  await assert.rejects(apiRequest('/api/v1/media/models'), /Sesi login/);
  mocked.mock.mockImplementation(async () => Response.json({ success: false, error: { message: 'Provider tidak tersedia' } }, { status: 503 }));
  await assert.rejects(apiRequest('/api/v1/media/generate'), /Provider tidak tersedia/);
  mocked.mock.mockImplementation(async () => new Response('not json'));
  await assert.rejects(apiRequest('/api/v1/media/generate'), /Permintaan gagal/);
});

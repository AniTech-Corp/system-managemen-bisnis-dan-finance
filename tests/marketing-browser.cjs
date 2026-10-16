/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS runner uses configurable runtime modules. */
/* UI regression suite: isolated QA identity, synthetic API responses, real media bytes.
 * All /api/* requests are intercepted. This never authenticates against or writes to DB.
 * Run: node tests/marketing-browser.cjs
 * Env: KLIR_TEST_URL, PLAYWRIGHT_MODULE, KLIR_QA_FILTER (optional scenario substring).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build', 'media-smoke');
const baseUrl = process.env.KLIR_TEST_URL || 'http://127.0.0.1:3000';
const origin = new URL(baseUrl).origin;
const identity = { user: { email: 'fixture@example.test', fullName: 'QA' }, workspace: { id: 'qa-workspace', name: 'QA Business' } };
const capabilities = { image: true, audio: true, transcription: true, notebook: true, video: false };
const imageModels = [
  { id: 'mock/image-a', name: 'MOCK Image A', provider: 'mock', verified: true, capabilities: { aspectRatios: ['21:9', '16:9', '1:1', '9:16', '4:5'], qualities: ['auto', 'high'], outputFormats: ['jpeg'] } },
  { id: 'mock/image-b', name: 'MOCK Image B', provider: 'mock', verified: true, capabilities: { aspectRatios: ['9:16', '4:5'] } },
  { id: 'mock/image-default', name: 'MOCK Default', provider: 'mock', verified: false, capabilities: {} },
];
const audioModels = [{ id: 'google/gemini-3.1-flash-tts-preview', name: 'MOCK configured Google TTS', provider: 'mock', verified: true, capabilities: { voices: ['Kore', 'Puck', 'Charon'], supportsSpeed: false, outputFormats: ['mp3'] } }];
const fixture = name => {
  const file = path.join(output, name);
  assert.ok(fs.existsSync(file), `Required actual media fixture missing: ${file}`);
  return fs.readFileSync(file);
};
async function ensureFixtures() {
  fs.mkdirSync(output, { recursive: true });
  if (!fs.existsSync(path.join(output, 'image.jpeg')) && !fs.existsSync(path.join(output, 'image.png'))) {
    const sharp = require(path.join(root, 'node_modules/sharp'));
    await sharp({ create: { width: 320, height: 180, channels: 3, background: { r: 18, g: 65, b: 120 } } })
      .png().toFile(path.join(output, 'image.png'));
  }
  if (!fs.existsSync(path.join(output, 'klir-voiceover.mp3')) && !fs.existsSync(path.join(output, 'klir-voiceover.wav'))) {
    const rate = 16000, seconds = 1, samples = rate * seconds;
    const wav = Buffer.alloc(44 + samples * 2); wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * 440 / rate) * 1200), 44 + i * 2);
    fs.writeFileSync(path.join(output, 'klir-voiceover.wav'), wav);
  }
}
const actualImage = () => {
  const name = fs.existsSync(path.join(output, 'image.jpeg')) ? 'image.jpeg' : 'image.png';
  return { name, bytes: fixture(name), mime: name.endsWith('.jpeg') ? 'image/jpeg' : 'image/png' };
};
const actualAudio = () => {
  const name = fs.existsSync(path.join(output, 'klir-voiceover.mp3')) ? 'klir-voiceover.mp3' : 'klir-voiceover.wav';
  return { name, bytes: fixture(name), mime: name.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav' };
};
const wait = async (fn, message) => {
  const until = Date.now() + 12000;
  do { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 80)); } while (Date.now() < until);
  assert.fail(message);
};
const audioResult = body => { const media = actualAudio(); return { kind: 'audio', status: 'ready', dataUrl: `data:${media.mime};base64,` + media.bytes.toString('base64'), mimeType: media.mime, fileName: `mock-voiceover.${media.name.split('.').pop()}`, provider: 'MOCK OpenRouter', modelUsed: 'google/gemini-3.1-flash-tts-preview', script: body.script || 'MOCK script disusun dari brief.', note: 'MOCK response; actual local audio fixture bytes.' }; };
const imageResult = (body, provider = 'MOCK OpenRouter') => { const media = actualImage(); return { kind: 'image', status: 'ready', dataUrl: `data:${media.mime};base64,` + media.bytes.toString('base64'), mimeType: media.mime, fileName: `mock-image.${media.name.split('.').pop()}`, provider, modelUsed: provider.includes('Gemini') ? 'mock/gemini-fallback' : body.model, prompt: body.prompt, note: 'MOCK response; actual local image fixture bytes.' }; };
let browser;
const results = [];

async function scenario(name, run) {
  if (process.env.KLIR_QA_FILTER && !name.includes(process.env.KLIR_QA_FILTER)) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: true });
  const requests = [];
  const pageErrors = [];
  const state = { imageProvider: 'MOCK OpenRouter', audioError: false, delayImage: null };
  await context.addInitScript(identity => {
    localStorage.setItem('klir_persistent_auth', JSON.stringify(identity));
    localStorage.setItem('klir_active_portal', 'MARKETING');
    localStorage.setItem('klir_marketing_nav', 'ai-studio');
  }, identity);
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      let body;
      try { body = request.postDataJSON(); } catch { body = null; }
      requests.push({ path: url.pathname, method: request.method(), body, raw: request.postDataBuffer(), headers: request.headers() });
      const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
      if (url.pathname === '/api/v1/media/models') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: url.searchParams.get('kind') === 'audio' ? audioModels : imageModels, capabilities, note: 'MOCK catalog for browser QA only.' }) });
      if (url.pathname === '/api/v1/brain/chat') return json({ text: `MOCK jawaban chat: ${body.message}`, provider: 'MOCK text provider' });
      if (url.pathname === '/api/v1/media/generate') {
        if (body.kind === 'video') return json({ kind: 'video', status: 'planned', note: 'MOCK Render video live belum tersedia.', availableAlternative: 'video-plan', prompt: body.prompt });
        if (body.kind === 'audio') {
          if (state.audioError) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'PROVIDER_ERROR', message: 'MOCK provider temporarily unavailable', retryable: true }, ...(body.prompt ? { data: { kind: 'audio', status: 'script-ready', script: 'MOCK generated script retained for retry.', scriptDrafted: true } } : {}) }) });
          return json(audioResult(body));
        }
        if (state.delayImage) await state.delayImage;
        return json(imageResult(body, state.imageProvider));
      }
      if (url.pathname === '/api/v1/media/transcribe') return json({ text: 'MOCK transcript sebelum diedit', language: 'id', provider: 'MOCK transcription', modelUsed: 'mock/whisper', durationSeconds: 3 });
      if (url.pathname === '/api/v1/brain/generate') {
        assert.equal(body.type, 'video-plan');
        const { Document, Packer, Paragraph } = require(path.join(root, 'node_modules/docx'));
        const bytes = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('MOCK storyboard fixture — actual DOCX file')] }] }));
        return json({ fileName: 'mock-storyboard.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileBase64: bytes.toString('base64'), summary: 'MOCK storyboard, bukan video.', provider: 'MOCK text', modelUsed: 'mock/storyboard' });
      }
      if (url.pathname === '/api/v1/brain/notebook') {
        const payload = body.kind === 'quiz' ? { title: 'MOCK Kuis Produk', instructions: 'Pilih jawaban sesuai materi.', questions: Array.from({ length: body.count }, (_, i) => ({ id: `q${i}`, question: `MOCK soal ${i + 1}: warna brand?`, options: ['Biru', 'Merah', 'Hijau', 'Ungu'], correctIndex: 0, explanation: 'MOCK materi menyebut biru.' })) }
          : { title: 'MOCK Flashcard Produk', cards: Array.from({ length: body.count }, (_, i) => ({ id: `c${i}`, front: `MOCK pertanyaan ${i + 1}`, back: `MOCK jawaban ${i + 1}`, hint: 'Materi produk' })) };
        return json({ kind: body.kind, title: payload.title, payload, provider: 'MOCK notebook', modelUsed: 'mock/notebook', latencyMs: 2 });
      }
      // Fail closed: no unhandled API is allowed to reach the real server.
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'MOCK API not needed in UI fixture', data: {} }) });
    }
    if (url.origin !== origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push(error.message));
  const tools = {
    page, context, requests, state,
    count: path => requests.filter(request => request.path === path && request.method === 'POST').length,
    open: async kind => {
      const names = { image: 'Gambar', audio: 'Voiceover', video: 'Video · Segera', quiz: 'Kuis', flashcard: 'Flashcard' };
      if (kind === 'transcription') await page.getByTestId('composer-microphone').click();
      else await page.locator('[aria-label="Studio media Marketing"]').getByRole('button', { name: names[kind], exact: true }).click();
      await page.getByTestId(`studio-${kind}`).waitFor();
    },
    send: async text => { await page.getByPlaceholder('Tanya apa saja', { exact: false }).fill(text); await page.getByPlaceholder('Tanya apa saja', { exact: false }).press('Enter'); },
    screenshot: async suffix => page.screenshot({ path: path.join(output, `${name}-${suffix}.png`), fullPage: true }),
  };
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('composer-microphone').waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      const notice = document.createElement('div'); notice.id = 'qa-fixture-notice'; notice.textContent = 'BROWSER QA — MOCK API / FIXTURE IDENTITY';
      Object.assign(notice.style, { position: 'fixed', right: '8px', top: '8px', zIndex: '99999', background: '#673a00', color: 'white', padding: '6px 10px', fontSize: '11px', pointerEvents: 'none' }); document.body.appendChild(notice);
    });
    await run(tools);
    assert.deepEqual(pageErrors, [], 'No browser page errors');
    console.log(`PASS ${name}`); results.push({ name, status: 'PASS' });
  } catch (error) {
    await tools.screenshot('failure').catch(() => {});
    console.error(`FAIL ${name}: ${error.stack}`); results.push({ name, status: 'FAIL', error: error.message });
  } finally { await context.close(); }
}

async function assertDownload(page, locator, expected, expectedName) {
  const pending = page.waitForEvent('download'); await locator.click(); const download = await pending;
  assert.equal(download.suggestedFilename(), expectedName);
  const stream = await download.createReadStream(); const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), expected); await download.delete();
}

(async () => {
  await ensureFixtures();
  // Read-only connectivity check, no real API call.
  const health = await fetch(baseUrl, { method: 'HEAD' }); assert.equal(health.status, 200);
  try { browser = await chromium.launch({ headless: false }); }
  catch { browser = await chromium.launch({ headless: false, channel: 'chrome' }); }
  try {
    await scenario('normal-chat', async ({ page, send, count, screenshot }) => {
      await send('Halo QA normal chat'); await page.getByText('MOCK jawaban chat:', { exact: false }).waitFor();
      assert.equal(count('/api/v1/brain/chat'), 1); assert.equal(count('/api/v1/media/generate'), 0); await screenshot('desktop');
    });
    await scenario('image-intercept', async ({ page, send, requests, count, screenshot }) => {
      actualImage(); await send('Buat gambar QA kopi jangan watermark');
      await page.getByTestId('studio-image').waitFor(); assert.equal(count('/api/v1/brain/chat'), 0);
      const model = page.getByLabel('Model gambar'); await model.selectOption('mock/image-b');
      assert.equal(await page.getByLabel('Rasio gambar').inputValue(), '4:5');
      const quality = page.getByTestId('studio-image').getByRole('combobox').nth(2);
      await model.selectOption('mock/image-a'); await quality.waitFor(); assert.equal(await page.getByLabel('Rasio gambar').inputValue(), '1:1');
      assert.deepEqual(await page.getByLabel('Rasio gambar').locator('option').allTextContents(), ['1:1', '4:5', '9:16', '16:9']);
      await quality.selectOption('high');
      await page.getByTestId('studio-generate').click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => { const image = document.querySelector('[data-testid="studio-result"] img'); return image?.complete && image.naturalWidth > 0; });
      assert.equal(count('/api/v1/media/generate'), 1); assert.equal(count('/api/v1/brain/chat'), 0);
      assert.equal(await page.getByPlaceholder('Tanya apa saja', { exact: false }).inputValue(), '', 'Successful intercepted command is cleared to prevent accidental duplicate billing');
      assert.equal(requests.find(r => r.path === '/api/v1/media/generate').body.quality, 'high');
      { const media = actualImage(); await assertDownload(page, page.getByRole('link', { name: /Unduh gambar/ }), media.bytes, `mock-image.${media.name.split('.').pop()}`); } await screenshot('preview');
    });
    await scenario('image-fallback', async ({ page, open, state, screenshot }) => {
      actualImage(); state.imageProvider = 'MOCK Gemini fallback'; await open('image');
      await page.getByTestId('studio-prompt').fill('QA fallback image'); await page.getByTestId('studio-generate').click();
      await page.getByTestId('studio-result').getByText(/MOCK Gemini fallback/).waitFor(); await screenshot('badge');
    });
    await scenario('tts-errors-playback', async ({ page, open, state, requests, screenshot }) => {
      actualAudio(); await open('audio'); await page.getByLabel('Sumber voiceover').selectOption('brief'); await page.getByTestId('studio-prompt').fill('Brief QA untuk voiceover.');
      assert.equal(await page.getByTestId('studio-prompt').getAttribute('maxlength'), '12000');
      await page.getByLabel('Voice', { exact: true }).selectOption('Puck'); assert.equal(await page.getByLabel('Kecepatan', { exact: true }).count(), 0);
      state.audioError = true; await page.getByTestId('studio-generate').click();
      await page.getByRole('dialog').getByRole('alert').waitFor(); assert.equal(await page.getByTestId('studio-prompt').inputValue(), 'MOCK generated script retained for retry.');
      assert.equal(await page.getByLabel('Sumber voiceover').inputValue(), 'script');
      assert.equal(await page.getByTestId('studio-prompt').getAttribute('maxlength'), '6000');
      state.audioError = false; await page.getByTestId('studio-generate').click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const audio = page.getByLabel('Hasil voiceover');
      await audio.evaluate(async element => { await element.play(); }); await wait(() => audio.evaluate(element => element.currentTime > 0), 'Audio should play real fixture');
      await audio.evaluate(element => element.pause());
      const body = requests.filter(r => r.path === '/api/v1/media/generate').at(-1).body;
      assert.equal(body.voice, 'Puck'); assert.equal(body.speed, undefined); assert.equal(body.script, 'MOCK generated script retained for retry.'); assert.equal(body.prompt, undefined);
      { const media = actualAudio(); await assertDownload(page, page.getByRole('link', { name: /Unduh audio/ }), media.bytes, `mock-voiceover.${media.name.split('.').pop()}`); } await screenshot('player');
    });
    await scenario('recorder-denied-unsupported', async ({ page, open, screenshot }) => {
      await page.evaluate(() => { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => { throw new DOMException('QA denial', 'NotAllowedError'); } }); });
      await open('transcription'); await page.getByTestId('record-start').click(); await page.getByText('Izin mikrofon ditolak.', { exact: false }).waitFor(); await screenshot('denied');
      await page.getByRole('button', { name: 'Tutup studio media' }).click();
      await page.evaluate(() => { window.MediaRecorder = undefined; });
      await open('transcription'); await page.getByTestId('record-start').click(); await page.getByText('Browser tidak mendukung rekaman', { exact: false }).waitFor();
    });
    await scenario('recorder-synthetic-happy-path', async ({ page, open, requests, count, screenshot }) => {
      await page.evaluate(() => {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain(); gain.gain.value = 0.03;
        const destination = context.createMediaStreamDestination();
        oscillator.connect(gain).connect(destination); oscillator.start();
        window.__qaSyntheticAudio = { context, oscillator, track: destination.stream.getAudioTracks()[0] };
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => destination.stream });
      });
      await open('transcription'); await page.getByTestId('record-start').click();
      await page.getByText(/Merekam \d+ \/ 120 detik/).waitFor();
      assert.equal(count('/api/v1/media/transcribe'), 0); assert.equal(count('/api/v1/brain/chat'), 0);
      await page.waitForTimeout(900); await page.getByRole('button', { name: 'Hentikan rekaman' }).click();
      await page.getByLabel('Pratinjau rekaman').waitFor();
      assert.equal(await page.evaluate(() => window.__qaSyntheticAudio.track.readyState), 'ended');
      assert.equal(count('/api/v1/media/transcribe'), 0); await page.getByRole('button', { name: 'Transkripsikan', exact: true }).click();
      await wait(async () => (await page.getByTestId('transcript-draft').inputValue()).includes('MOCK transcript'), 'Synthetic recording should transcribe after deliberate click');
      const transcribe = requests.find(r => r.path === '/api/v1/media/transcribe');
      assert.ok(transcribe.raw.includes(Buffer.from('audio/wav')) && transcribe.raw.includes(Buffer.from('RIFF')) && transcribe.raw.includes(Buffer.from('WAVE')));
      await page.getByTestId('transcript-draft').fill('MOCK synthetic transcript diedit');
      assert.equal(count('/api/v1/brain/chat'), 0); await screenshot('editable');
      await page.getByRole('button', { name: 'Tutup studio media' }).click();
      assert.equal(await page.evaluate(() => window.__qaSyntheticAudio.track.readyState), 'ended');
      await page.evaluate(async () => { window.__qaSyntheticAudio.oscillator.stop(); await window.__qaSyntheticAudio.context.close(); });
    });
    await scenario('upload-transcript-deliberate-send', async ({ page, open, requests, count, screenshot }) => {
      const media = actualAudio(); await open('transcription');
      await page.getByLabel('Pilih file audio').setInputFiles(path.join(output, media.name));
      await page.getByRole('button', { name: 'Transkripsikan', exact: true }).click();
      await wait(async () => (await page.getByTestId('transcript-draft').inputValue()).includes('MOCK transcript'), 'Transcript should appear');
      const transcribe = requests.find(r => r.path === '/api/v1/media/transcribe');
      assert.ok(transcribe.raw.includes(Buffer.from('audio/wav'))); assert.ok(transcribe.raw.includes(Buffer.from('RIFF'))); assert.ok(transcribe.raw.includes(Buffer.from('WAVE')));
      assert.equal(count('/api/v1/brain/chat'), 0); await page.getByTestId('transcript-draft').fill('Transcript QA sudah dikoreksi'); await screenshot('editable');
      assert.equal(count('/api/v1/brain/chat'), 0); await page.getByTestId('transcript-send').click();
      await page.getByText('MOCK jawaban chat:', { exact: false }).waitFor(); assert.equal(count('/api/v1/brain/chat'), 1);
      assert.ok(requests.find(r => r.path === '/api/v1/brain/chat').body.message.includes('Transcript QA sudah dikoreksi'));
    });
    await scenario('video-storyboard', async ({ page, open, count, requests, screenshot }) => {
      await open('video'); await page.getByTestId('studio-prompt').fill('QA video kopi 30 detik'); await page.getByTestId('studio-generate').click();
      await page.getByTestId('studio-result').getByText('Render video · Segera').waitFor();
      assert.equal(count('/api/v1/media/generate'), 1); assert.equal(count('/api/v1/brain/generate'), 0);
      await page.getByRole('button', { name: 'Buat storyboard DOCX', exact: true }).click(); await page.getByText('mock-storyboard.docx', { exact: true }).waitFor();
      assert.equal(count('/api/v1/brain/generate'), 1); assert.ok(requests.every(r => !r.path.includes('/video/'))); await screenshot('planned-storyboard');
    });
    await scenario('quiz-score-reset', async ({ page, open, screenshot }) => {
      await open('quiz'); await page.getByTestId('studio-prompt').fill('Materi QA: warna brand biru dan produk kopi lokal.'); await page.getByRole('spinbutton').fill('2'); await page.getByTestId('studio-generate').click();
      const quiz = page.getByTestId('quiz-card'); await quiz.waitFor();
      await quiz.getByRole('button', { name: 'Biru', exact: true }).click(); await quiz.getByRole('button', { name: 'Pertanyaan berikutnya' }).click();
      await quiz.getByRole('button', { name: 'Merah', exact: true }).click(); await quiz.getByRole('button', { name: 'Lihat skor' }).click();
      assert.equal(await page.getByTestId('quiz-score').innerText(), 'Skor: 1 / 2'); await screenshot('score');
      await quiz.getByRole('button', { name: 'Ulangi kuis' }).click(); assert.equal(await quiz.getByRole('button', { name: 'Biru', exact: true }).isEnabled(), true);
    });
    await scenario('flashcard-flip-navigation', async ({ page, open, screenshot }) => {
      await open('flashcard'); await page.getByTestId('studio-prompt').fill('Materi QA: brand biru, kopi lokal, target UMKM.'); await page.getByRole('spinbutton').fill('2'); await page.getByTestId('studio-generate').click();
      const deck = page.getByTestId('flashcard-deck'); await deck.waitFor(); await page.getByTestId('flashcard-flip').click();
      assert.equal(await page.getByTestId('flashcard-flip').innerText(), 'MOCK jawaban 1'); await deck.getByRole('button', { name: 'Sudah paham', exact: true }).click();
      await deck.getByRole('button', { name: 'Berikutnya', exact: true }).click(); assert.equal(await page.getByTestId('flashcard-flip').innerText(), 'MOCK pertanyaan 2'); await screenshot('deck');
      await deck.getByRole('button', { name: 'Mulai ulang deck' }).click(); assert.equal(await page.getByTestId('flashcard-flip').innerText(), 'MOCK pertanyaan 1');
    });
    await scenario('chat-switch-inflight', async ({ page, open, state, send, count, screenshot }) => {
      actualImage(); await send('CHAT ASAL QA'); await page.getByText('MOCK jawaban chat:', { exact: false }).waitFor();
      let release; state.delayImage = new Promise(resolve => { release = resolve; });
      await open('image'); await page.getByTestId('studio-prompt').fill('QA gambar tertunda'); await page.getByTestId('studio-generate').click();
      await wait(() => count('/api/v1/media/generate') === 1, 'Image request started'); await page.getByRole('button', { name: 'Tutup studio media' }).click();
      await page.getByRole('button', { name: /Obrolan Baru/ }).click(); release();
      await wait(() => page.getByTestId('studio-result').count().then(n => n === 0), 'Result must not appear in new chat');
      await page.getByRole('button', { name: /CHAT ASAL QA/ }).click(); await page.getByTestId('studio-result').locator('img').waitFor(); await screenshot('retained');
    });
    await scenario('mobile-overflow', async ({ page, open, screenshot }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTitle('Tampilkan Menu Samping').waitFor(); await screenshot('initial');
      const initialComposer = await page.getByPlaceholder('Tanya apa saja', { exact: false }).boundingBox();
      assert.ok(initialComposer.width >= 180 && initialComposer.x >= 0 && initialComposer.x + initialComposer.width <= 391, `Mobile composer usable without manually hiding sidebar: ${JSON.stringify(initialComposer)}`);
      const workspace = page.getByTestId('marketing-chat-workspace');
      assert.ok(await workspace.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Marketing workspace has no horizontal overflow');
      await page.getByText('Marketing AI Assistant', { exact: true }).waitFor();
      await open('image'); await screenshot('image-panel');
      const dialog = page.getByRole('dialog'); const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, 'Dialog fits mobile viewport');
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'No horizontal overflow in media dialog');
      await page.getByRole('button', { name: 'Tutup studio media' }).click();
      const composer = page.getByPlaceholder('Tanya apa saja', { exact: false }); const box = await composer.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 391, 'Composer fits mobile viewport');
      await screenshot('composer');
    });
  } finally { await browser.close(); }
  const report = { generatedAt: new Date().toISOString(), baseUrl, scope: 'MOCK API browser QA only; no real authentication/provider calls', results };
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildRetrySubmission, createSendQueue, MAX_STUDIO_SOURCE_CHARS, MAX_TTS_SCRIPT_CHARS, resolveStudioSource,
  type StudioSubmission,
} from './client';

// ---------------------------------------------------------------------------
// P5: retry reuses the server-drafted script instead of drafting again
// ---------------------------------------------------------------------------

const audioBrief: StudioSubmission = { type: 'media', request: {
  kind: 'audio', role: 'marketing', prompt: 'Brief promosi kopi susu', model: 'tts-model', voice: 'alloy', speed: 1, outputFormat: 'mp3',
  brandContext: { workspaceName: 'Kopi Kita', hasLogo: false },
} };

test('audio retry with a draft script sends the script and drops the prompt', () => {
  const retry = buildRetrySubmission(audioBrief, '  Halo, ini script yang sudah dibuat server.  ');
  assert.equal(retry.type, 'media');
  if (retry.type !== 'media') return;
  assert.equal(retry.request.kind, 'audio');
  assert.equal(retry.request.script, 'Halo, ini script yang sudah dibuat server.');
  assert.equal('prompt' in retry.request, false, 'prompt must be removed so the route does not draft again');
  // Voice, model, speed, format and brand context survive the swap.
  assert.equal(retry.request.voice, 'alloy');
  assert.equal(retry.request.model, 'tts-model');
  assert.equal(retry.request.speed, 1);
  assert.equal(retry.request.outputFormat, 'mp3');
  assert.deepEqual(retry.request.brandContext, { workspaceName: 'Kopi Kita', hasLogo: false });
  // Original submission object is not mutated.
  assert.equal(audioBrief.request.prompt, 'Brief promosi kopi susu');
  assert.equal(audioBrief.request.script, undefined);
});

test('image submission is returned unchanged even when a draft script exists', () => {
  const image: StudioSubmission = { type: 'media', request: { kind: 'image', role: 'marketing', prompt: 'Poster kopi', aspectRatio: '1:1' } };
  assert.equal(buildRetrySubmission(image, 'script nyasar'), image);
  assert.equal(buildRetrySubmission(image), image);
});

test('audio without a draft, notebook and storyboard submissions are returned unchanged', () => {
  assert.equal(buildRetrySubmission(audioBrief), audioBrief);
  assert.equal(buildRetrySubmission(audioBrief, ''), audioBrief);
  assert.equal(buildRetrySubmission(audioBrief, '   '), audioBrief);
  const notebook: StudioSubmission = { type: 'notebook', request: { kind: 'quiz', sourceText: 'Materi produk', count: 5, difficulty: 'easy', role: 'marketing' } };
  assert.equal(buildRetrySubmission(notebook, 'draft'), notebook);
  const storyboard: StudioSubmission = { type: 'storyboard', request: { type: 'video-plan', brief: 'Iklan 30 detik', role: 'marketing' } };
  assert.equal(buildRetrySubmission(storyboard, 'draft'), storyboard);
});

test('a draft longer than the TTS cap falls back to the original brief', () => {
  const tooLong = 'a'.repeat(MAX_TTS_SCRIPT_CHARS + 1);
  assert.equal(buildRetrySubmission(audioBrief, tooLong), audioBrief);
  const atCap = buildRetrySubmission(audioBrief, 'b'.repeat(MAX_TTS_SCRIPT_CHARS));
  assert.notEqual(atCap, audioBrief);
});

// ---------------------------------------------------------------------------
// P7: quiz/flashcard source prefers what the user just typed
// ---------------------------------------------------------------------------

test('quiz with fresh composer text and old history uses the composer text', () => {
  const source = resolveStudioSource({ kind: 'quiz', composerText: '  Materi baru tentang harga pokok  ', attachmentText: '', historyText: 'Obrolan lama tentang promo' });
  assert.equal(source, 'Materi baru tentang harga pokok');
  const withAttachment = resolveStudioSource({ kind: 'flashcard', composerText: 'Materi baru', attachmentText: 'Isi lampiran', historyText: 'Riwayat' });
  assert.equal(withAttachment, 'Materi baru');
});

test('quiz with an empty composer falls back to attachment, then history', () => {
  assert.equal(resolveStudioSource({ kind: 'quiz', composerText: '   ', attachmentText: 'Isi lampiran', historyText: 'Riwayat' }), 'Isi lampiran');
  assert.equal(resolveStudioSource({ kind: 'quiz', composerText: '', attachmentText: '', historyText: 'Riwayat' }), 'Riwayat');
  assert.equal(resolveStudioSource({ kind: 'flashcard' }), '');
});

test('image, audio and video keep attachment > history > composer', () => {
  for (const kind of ['image', 'audio', 'video'] as const) {
    assert.equal(resolveStudioSource({ kind, composerText: 'Brief dari composer', attachmentText: 'Isi lampiran', historyText: 'Riwayat' }), 'Isi lampiran', kind);
    assert.equal(resolveStudioSource({ kind, composerText: 'Brief dari composer', attachmentText: '', historyText: 'Riwayat' }), 'Riwayat', kind);
    assert.equal(resolveStudioSource({ kind, composerText: 'Brief dari composer', attachmentText: '', historyText: '' }), 'Brief dari composer', kind);
  }
});

test('studio source keeps the 12000 character cap for every kind', () => {
  const long = 'x'.repeat(MAX_STUDIO_SOURCE_CHARS + 500);
  assert.equal(MAX_STUDIO_SOURCE_CHARS, 12000);
  assert.equal(resolveStudioSource({ kind: 'quiz', composerText: long }).length, 12000);
  assert.equal(resolveStudioSource({ kind: 'image', attachmentText: long }).length, 12000);
});

// ---------------------------------------------------------------------------
// P6: messages typed while a chat is busy are queued and drained exactly once
// ---------------------------------------------------------------------------

test('enqueue while busy then take once yields the item exactly once', () => {
  const queue = createSendQueue();
  assert.equal(queue.enqueue('chat-a', '  transcript hasil edit  '), true);
  assert.equal(queue.size('chat-a'), 1);
  assert.equal(queue.takeNext('chat-a'), 'transcript hasil edit');
  assert.equal(queue.takeNext('chat-a'), undefined, 'second take must not resend');
  assert.equal(queue.size('chat-a'), 0);
});

test('queue is FIFO per chat and isolated between chats', () => {
  const queue = createSendQueue();
  queue.enqueue('chat-a', 'pertama');
  queue.enqueue('chat-a', 'kedua');
  queue.enqueue('chat-b', 'lain');
  assert.equal(queue.size('chat-a'), 2);
  assert.equal(queue.takeNext('chat-a'), 'pertama'); // one item per finished request
  assert.equal(queue.size('chat-a'), 1);
  assert.equal(queue.takeNext('chat-b'), 'lain');
  assert.equal(queue.takeNext('chat-b'), undefined);
  assert.equal(queue.takeNext('chat-a'), 'kedua'); // next finally drains the rest
  assert.equal(queue.takeNext('chat-a'), undefined);
});

test('blank text is never queued and taking from an unknown chat is undefined', () => {
  const queue = createSendQueue();
  assert.equal(queue.enqueue('chat-a', '   '), false);
  assert.equal(queue.size('chat-a'), 0);
  assert.equal(queue.takeNext('chat-a'), undefined);
  assert.equal(queue.takeNext('never-seen'), undefined);
});

test('simulated drain loop: N queued items are sent exactly N times, one per settle', () => {
  const queue = createSendQueue();
  const sent: string[] = [];
  const inFlight = new Set<string>();
  // Mirrors the component: finally deletes the in-flight marker, then takes ONE item and sends it.
  const settle = (chatId: string) => {
    inFlight.delete(chatId);
    const next = queue.takeNext(chatId);
    if (next !== undefined) { inFlight.add(chatId); sent.push(next); settle(chatId); }
  };
  inFlight.add('chat-a');
  for (const text of ['satu', 'dua', 'tiga']) assert.equal(queue.enqueue('chat-a', text), true);
  settle('chat-a');
  assert.deepEqual(sent, ['satu', 'dua', 'tiga']);
  assert.equal(inFlight.has('chat-a'), false);
  assert.equal(queue.size('chat-a'), 0);
});

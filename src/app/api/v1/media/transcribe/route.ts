import { NextResponse } from 'next/server';
import { withMediaGuard, readLimitedBody } from '@/lib/media-http';
import { MediaError } from '@/lib/media-errors';
import { MAX_AUDIO_BYTES, transcribeAudio } from '@/lib/media-provider';
import { recordActivity } from '@/lib/activity-log';
export const runtime = 'nodejs';
export const maxDuration = 180;
export const POST = withMediaGuard(async (req, { auth }) => {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data;')) throw new MediaError('INVALID_INPUT', 'Unggah audio sebagai multipart/form-data.', 415);
  const bytes = await readLimitedBody(req, MAX_AUDIO_BYTES + 65536);
  let form: FormData;
  try { form = await new Response(bytes as BodyInit, { headers: { 'Content-Type': contentType } }).formData(); }
  catch { throw new MediaError('INVALID_INPUT', 'Upload audio tidak dapat dibaca.'); }
  const audio = form.get('audio');
  if (!audio || typeof audio === 'string' || !audio.size) throw new MediaError('INVALID_INPUT', 'File audio wajib diisi.');
  if (audio.size > MAX_AUDIO_BYTES) throw new MediaError('FILE_TOO_LARGE', 'Audio maksimal 25 MB.', 413);
  const language = form.get('language') || 'id'; const model = form.get('model');
  if (typeof language !== 'string' || (model !== null && (typeof model !== 'string' || model.length > 200))) throw new MediaError('INVALID_INPUT', 'Bahasa/model tidak valid.');
  const data = await transcribeAudio(Buffer.from(await audio.arrayBuffer()), audio.type, audio.name, language, typeof model === 'string' ? model : undefined);
  void recordActivity(auth.workspace.id, auth.user.id, 'media.transcribe', { language });
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
});

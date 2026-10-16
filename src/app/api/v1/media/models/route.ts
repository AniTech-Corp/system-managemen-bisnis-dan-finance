import { NextResponse } from 'next/server';
import { withMediaGuard } from '@/lib/media-http';
import { configuredModel, DEFAULT_GEMINI_STT_MODEL, discoverMediaModels, hasProviderKey, mediaCapabilities, PRO_IMAGE_MODEL, PRO_VIDEO_MODEL } from '@/lib/media-catalog';
import { MediaError } from '@/lib/media-errors';
import type { CatalogKind, MediaModelOption } from '@/lib/media-types';
export const runtime = 'nodejs';
export const GET = withMediaGuard(async req => {
  const kind = req.nextUrl.searchParams.get('kind') || 'image';
  if (!['image', 'audio', 'transcription', 'video'].includes(kind)) throw new MediaError('INVALID_INPUT', 'Jenis katalog tidak valid.');
  const catalogKind = kind as CatalogKind;
  const capabilities = mediaCapabilities();
  let data: MediaModelOption[] = []; let note: string | undefined;
  try {
    data = await discoverMediaModels(catalogKind);
    if (catalogKind === 'audio') data = data.filter(m => m.id === configuredModel('audio'));
  } catch {
    note = 'Katalog belum tersedia. Default akan diverifikasi kembali saat generate; ketersediaan belum terkonfirmasi.';
    if (catalogKind === 'image' && capabilities.image) {
      data = [
        { id: configuredModel('image'), name: 'Seedream 5.0 Lite (default)', provider: 'openrouter', verified: false, capabilities: { aspectRatios: ['1:1', '4:5', '9:16', '16:9'], outputFormats: ['png', 'jpeg', 'webp'] } },
        { id: process.env.OPENROUTER_IMAGE_PRO_MODEL || PRO_IMAGE_MODEL, name: 'Seedream 5.0 Pro', provider: 'openrouter', verified: false, capabilities: { aspectRatios: ['1:1', '4:5', '9:16', '16:9'], outputFormats: ['png', 'jpeg', 'webp'] } },
      ];
    }
    if (catalogKind === 'video' && capabilities.video) {
      data = [
        { id: configuredModel('video'), name: 'Seedance 1.5 Pro (default)', provider: 'openrouter', verified: false, capabilities: { aspectRatios: ['16:9', '9:16', '1:1'], durations: [5, 10] } },
        { id: process.env.OPENROUTER_VIDEO_PRO_MODEL || PRO_VIDEO_MODEL, name: 'Seedance 2.5', provider: 'openrouter', verified: false, capabilities: { aspectRatios: ['16:9', '9:16', '1:1'], durations: [5, 10] } },
      ];
    }
    if (catalogKind === 'audio' && capabilities.audio) {
      data = [
        { id: configuredModel('audio'), name: 'Google Lyria 3 Clip Preview (default)', provider: 'openrouter', verified: false, capabilities: { voices: ['Kore', 'Puck', 'Charon'], outputFormats: ['mp3'] } },
      ];
    }
    if (catalogKind === 'transcription' && capabilities.transcription && hasProviderKey('OPENROUTER_API_KEY')) {
      data = [
        { id: configuredModel('transcription'), name: 'Google Chirp 3 (default)', provider: 'openrouter', verified: false, capabilities: { inputModalities: ['audio'], outputModalities: ['text'] } },
      ];
    }
  }
  if (catalogKind === 'transcription' && hasProviderKey('GROQ_API_KEY')) {
    data.unshift({ id: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo', name: 'Groq Whisper (default)', provider: 'groq', verified: false, capabilities: { inputModalities: ['audio'], outputModalities: ['text'] } });
  }
  // Gemini direct is the product default for audio/video transcription. It is
  // intentionally represented as a non-OpenRouter option so the composer can
  // keep it on the automatic direct-provider path instead of passing the model
  // id to OpenRouter's catalog validator.
  if (catalogKind === 'transcription' && hasProviderKey('GEMINI_API_KEY')) {
    data.unshift({ id: process.env.GEMINI_TRANSCRIPTION_MODEL || DEFAULT_GEMINI_STT_MODEL, name: 'Gemini direct (default)', provider: 'gemini', verified: false, capabilities: { inputModalities: ['audio', 'video'], outputModalities: ['text'] } });
  }
  return NextResponse.json({ success: true, data, capabilities, ...(note ? { note } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
});

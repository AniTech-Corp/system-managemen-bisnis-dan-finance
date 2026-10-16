import { NextResponse } from 'next/server';
import { withMediaGuard } from '@/lib/media-http';
import { MediaError } from '@/lib/media-errors';
import { OPENROUTER_BASE, orHeaders } from '@/lib/media-catalog';
import { findOwnedVideoJob } from '@/lib/video-jobs';

export const runtime = 'nodejs';

/**
 * GET /api/v1/media/video-content?job=<providerJobId>&index=0
 *
 * FIX (7 Sep 2026, bug "video masih kurang" yang dilaporkan Mecca): render video di
 * OpenRouter SUKSES (status completed, kredit terpotong), tapi URL yang dibalikkan
 * provider (`unsigned_urls[0]` = https://openrouter.ai/api/v1/videos/{id}/content?index=0)
 * WAJIB membawa API key server -- dibuktikan curl tanpa auth: HTTP 401 "No cookie auth
 * credentials found". Browser user tidak punya key itu, jadi <video src> dan tombol unduh
 * SELALU gagal walau render berhasil. Endpoint ini jadi perantara: sesi KLIR yang sah
 * (withMediaGuard: JWT + keanggotaan workspace) -> server ambil bytes dari provider
 * pakai key -> stream ke browser. Job id dari provider tidak bisa ditebak (20+ karakter
 * acak) dan hanya diketahui pemanggil yang barusan render.
 *
 * UPDATE 7 Sep malam: pemetaan job->workspace SEKARANG ADA (tabel VideoJob, izin
 * eksplisit Mecca). Job yang tidak terdaftar di workspace pemanggil = 404 sebelum
 * menyentuh provider -- anggota workspace lain tidak bisa lagi memakai id yang bocor.
 */
const JOB_ID = /^[A-Za-z0-9_-]{6,80}$/;

export const GET = withMediaGuard(async (req, { auth }) => {
  const job = req.nextUrl.searchParams.get('job') || '';
  const index = Number(req.nextUrl.searchParams.get('index') || '0');
  if (!JOB_ID.test(job)) throw new MediaError('INVALID_INPUT', 'ID job video tidak valid.');
  if (!Number.isInteger(index) || index < 0 || index > 9) throw new MediaError('INVALID_INPUT', 'Indeks video tidak valid.');
  const owned = await findOwnedVideoJob(job, auth.workspace.id);
  if (!owned) throw new MediaError('NOT_FOUND', 'Video tidak ditemukan di workspace ini.', 404);

  const upstream = await fetch(`${OPENROUTER_BASE}/videos/${job}/content?index=${index}`, {
    headers: orHeaders(),
    redirect: 'follow',
  });
  if (upstream.status === 401 || upstream.status === 403) {
    throw new MediaError('PROVIDER_ERROR', 'Provider menolak akses ke video ini. Coba render ulang.', 502, true);
  }
  if (upstream.status === 404 || upstream.status === 410) {
    throw new MediaError('PROVIDER_ERROR', 'Video sudah kedaluwarsa di provider. Render ulang untuk mendapatkan tautan baru.', 410, false);
  }
  if (!upstream.ok || !upstream.body) {
    throw new MediaError('PROVIDER_ERROR', 'Provider gagal mengirim video. Coba lagi beberapa saat.', 502, true);
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  headers.set('Content-Disposition', `inline; filename="klir-video-${job}.mp4"`);
  headers.set('Cache-Control', 'private, no-store');
  return new NextResponse(upstream.body, { status: 200, headers });
});

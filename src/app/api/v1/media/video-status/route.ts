import { NextResponse } from 'next/server';
import { withMediaGuard } from '@/lib/media-http';
import { MediaError } from '@/lib/media-errors';
import { checkVideoJob } from '@/lib/media-provider';
import { recordActivity } from '@/lib/activity-log';
import { findOwnedVideoJob, recordVideoJobStatus } from '@/lib/video-jobs';

export const runtime = 'nodejs';

/**
 * GET /api/v1/media/video-status?job=<providerJobId>
 *
 * B1 VIDEO ASYNC (7 Sep 2026): endpoint BARU, bagian dari fix untuk root cause bug
 * "berhasil di OpenRouter tapi enggak muncul" -- media-provider.ts generateVideoMedia()
 * lama menahan SATU HTTP request sampai 150 detik (submit + poll internal). Sekarang
 * POST /api/v1/media/generate (kind=video) cuma submit job lalu balas cepat
 * {status:'pending', jobId}; endpoint ini yang dipanggil client BERULANG (tiap 4 detik,
 * maksimal ~6 menit -- lihat marketing-media/client.ts pollVideoJob) untuk cek status
 * job itu SATU KALI per panggilan, tanpa loop/deadline di server.
 *
 * KEPEMILIKAN (7 Sep malam, tabel VideoJob): job WAJIB terdaftar di workspace pemanggil
 * (findOwnedVideoJob) -- job milik workspace lain / tidak dikenal = 404, TANPA memanggil
 * provider. Menutup temuan verifikator "job id = kunci akses" yang sebelumnya diterima
 * sebagai trade-off karena tabelnya belum ada.
 *
 * GET lewat rate-limit ringan khusus baca di withMediaGuard (bukan guard idempotency/
 * rate-limit POST yang menjaga kredit provider) -- lihat media-http.ts enforceReadRateLimit.
 */
const JOB_ID = /^[A-Za-z0-9_-]{6,80}$/;

export const GET = withMediaGuard(async (req, { auth }) => {
  const job = req.nextUrl.searchParams.get('job') || '';
  if (!JOB_ID.test(job)) throw new MediaError('INVALID_INPUT', 'ID job video tidak valid.');
  const owned = await findOwnedVideoJob(job, auth.workspace.id);
  if (!owned) throw new MediaError('NOT_FOUND', 'Job video tidak ditemukan di workspace ini.', 404);

  // Job yang sudah terminal di DB tidak perlu tanya provider lagi (hemat 1 fetch keluar
  // per poll ulang, dan tetap bisa dijawab walau provider sedang down).
  if (owned.status === 'COMPLETED' && owned.contentUrl) {
    return NextResponse.json({
      success: true,
      data: { status: 'ready', url: owned.contentUrl, mimeType: 'video/mp4', attempted: true,
        usage: typeof owned.costUsd === 'number' ? { costUsd: owned.costUsd } : undefined,
        note: 'Video diambil lewat server KLIR dari provider dan bisa kedaluwarsa di sisi provider -- unduh sekarang kalau ingin menyimpannya permanen.' },
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const result = await checkVideoJob(job);
  // Log HANYA saat status terminal (ready/failed) -- supaya activity log tidak dibanjiri
  // entri "pending" tiap 4 detik selama polling berjalan.
  if (result.status === 'ready' || result.status === 'failed') {
    await recordVideoJobStatus(job, result, result.providerStatus);
    void recordActivity(auth.workspace.id, auth.user.id, 'media.generate', { kind: 'video', status: result.status });
  }
  const { providerStatus: _omit, ...data } = result;
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
});

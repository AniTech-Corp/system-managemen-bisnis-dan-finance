import { prisma } from '@/lib/prisma';
import type { VideoJobStatusResult } from '@/lib/media-provider';

/**
 * Pemetaan job render video provider -> workspace KLIR (tabel `video_jobs`, 7 Sep 2026
 * malam, ditambahkan atas izin eksplisit Mecca; lihat komentar model VideoJob di
 * prisma/schema.prisma dan dokumen Fatur Bagian 6).
 *
 * Kenapa perlu: sebelum tabel ini, /api/v1/media/video-status dan /video-content cuma
 * memverifikasi "pemanggil anggota SUATU workspace" -- job id provider tidak diikat ke
 * workspace mana pun, jadi anggota workspace lain yang tahu id (URL di-paste ke grup
 * chat, screenshot, HAR) bisa menonton/mengunduh video tenant lain. Tabel ini juga
 * membuat job yang sedang render tetap bisa ditelusuri walau tab ditutup.
 *
 * Semua fungsi di sini fail-soft KECUALI findOwnedVideoJob (yang justru dipakai sebagai
 * pagar): registrasi/pembaruan status gagal -> console.warn + lanjut, supaya kegagalan
 * DB tidak pernah menggagalkan render yang sudah dibayar ke provider.
 */

export async function registerVideoJob(input: {
  workspaceId: string;
  userId: string | null;
  providerJobId: string;
  model: string;
  prompt: string;
}): Promise<void> {
  try {
    await prisma.videoJob.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        providerJobId: input.providerJobId,
        model: input.model.slice(0, 200),
        prompt: input.prompt.slice(0, 16_000),
        status: 'PENDING',
      },
    });
  } catch (err) {
    // Job SUDAH disubmit ke provider (kredit kemungkinan terbakar). Kalau baris ini gagal
    // ditulis, job jadi tidak bisa diakses lewat video-status/video-content (pagar
    // kepemilikan menolak) -- jobId dicatat di log supaya bisa ditelusuri manual.
    console.warn('[VideoJobs] gagal mencatat job video ke DB (job tetap berjalan di provider):', { providerJobId: input.providerJobId, err });
  }
}

/** Baris job milik workspace pemanggil, atau null kalau tidak ada / milik workspace lain. */
export async function findOwnedVideoJob(providerJobId: string, workspaceId: string) {
  return prisma.videoJob.findFirst({
    where: { providerJobId, workspaceId },
    select: { id: true, status: true, contentUrl: true, costUsd: true, createdAt: true },
  });
}

/** Simpan hasil cek status terminal (ready/failed) ke baris job. Status pending diabaikan
 * (tidak menulis apa pun tiap poll 4 detik). */
export async function recordVideoJobStatus(providerJobId: string, result: VideoJobStatusResult, providerStatus?: string): Promise<void> {
  if (result.status === 'pending') return;
  try {
    const status =
      result.status === 'ready' ? 'COMPLETED'
      : providerStatus === 'expired' ? 'EXPIRED'
      : providerStatus === 'cancelled' ? 'CANCELLED'
      : 'FAILED';
    await prisma.videoJob.updateMany({
      where: { providerJobId },
      data: {
        status,
        contentUrl: result.status === 'ready' ? result.url ?? null : null,
        costUsd: typeof result.usage?.costUsd === 'number' ? result.usage.costUsd : undefined,
        error: result.status === 'failed' ? (result.note ?? 'gagal').slice(0, 500) : null,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn('[VideoJobs] gagal memperbarui status job video (non-fatal):', { providerJobId, err });
  }
}

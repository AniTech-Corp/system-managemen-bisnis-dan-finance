import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * KLIR Activity Log -- util pencatat aktivitas non-fatal.
 *
 * Backed oleh model `ActivityEvent` yang SUDAH ADA di prisma/schema.prisma
 * (milik Fatur, `@@map("activity_events")`) -- TIDAK ADA model atau kolom
 * baru ditambahkan di sini. Dipanggil dari titik penyelesaian aksi di
 * endpoint MILIK KITA (media/generate, media/transcribe, brain/notebook,
 * documents/from-template) dan dari titik penulisan data lain yang genuinely
 * ada di file milik kita (mis. company-memory.ts).
 *
 * Sifatnya non-fatal, mengikuti pola recordCompanyKnowledge di
 * src/lib/ai-brain/company-memory.ts: kalau gagal, cukup console.warn --
 * JANGAN PERNAH throw ke caller. Mencatat aktivitas tidak boleh pernah
 * menggagalkan request pengguna yang sedang berjalan.
 */

/** Payload bebas bentuk (disimpan sebagai JSONB); jaga tetap kecil dan tidak berisi rahasia/PII. */
export type ActivityPayload = Prisma.InputJsonObject;

export async function recordActivity(
  workspaceId: string,
  userId: string | null,
  type: string,
  payload: ActivityPayload = {}
): Promise<void> {
  const trimmedWorkspaceId = workspaceId?.trim();
  const trimmedType = type?.trim();
  if (!trimmedWorkspaceId || !trimmedType) {
    // Tidak ada workspace/tipe yang valid untuk dicatat -- ini bug pemanggil,
    // bukan kegagalan infra. Tetap non-fatal: log lalu kembali, jangan throw.
    console.warn('[ActivityLog] dilewati: workspaceId atau type kosong (non-fatal):', { workspaceId, type });
    return;
  }
  try {
    await prisma.activityEvent.create({
      data: {
        workspaceId: trimmedWorkspaceId,
        userId: userId ?? null,
        type: trimmedType,
        payload,
      },
    });
  } catch (err) {
    console.warn(`[ActivityLog] gagal mencatat activity event "${trimmedType}" (non-fatal):`, err);
  }
}

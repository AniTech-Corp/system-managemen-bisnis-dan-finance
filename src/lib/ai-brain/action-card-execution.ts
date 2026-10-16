/**
 * KLIR AI Brain -- ActionCard "Setujui & Terapkan ke Dashboard" execution bridge.
 *
 * KONTEKS (gap kemampuan-001, audit 7 Sep 2026): sebelum modul ini ada, tombol
 * "Setujui & Terapkan"/"Konfirmasi & Update" di SETIAP actionCard AI (Executive/
 * Finance/Marketing AI Assistant) tidak pernah memanggil backend apapun --
 * handleCardExecution di ketiga view menulis ANGKA HARDCODE TETAP langsung ke
 * localStorage (klir_live_company_state) lalu menampilkannya seolah "sudah
 * diterapkan". Backend nyata SUDAH ADA dan terbukti menulis DB asli lewat tes HTTP
 * live (POST /api/v1/brain/execute -> ExecutionEngine.executeAction, lihat
 * src/lib/ai-brain/execution-engine.ts: SCALE_MARKETING membuat promoCoupon nyata,
 * APPROVE_HIRING membuat workTask nyata) -- tapi endpoint itu 0% dipanggil dari UI
 * manapun (grep 'brain/execute|ExecutionEngine|executeAction' di seluruh
 * src/app/components menghasilkan 0 match sebelum fix ini).
 *
 * Modul ini adalah SATU sumber kebenaran dipakai ketiga view supaya tidak devirge
 * lagi (pola lama: 3 salinan handleCardExecution identik dengan patch hardcode
 * berbeda-beda di tiap file):
 * 1. mapActionCardTypeToExecutionActionType() -- pemetaan actionCard.type (yang
 *    dibuat buildActionCard() di brain/chat/route.ts, atau ditulis manual di
 *    masing-masing view) ke actionType yang dikenali ExecutionEngine.
 * 2. executeActionCardOnServer() -- fetch POST /api/v1/brain/execute + normalisasi
 *    hasil (pesan ASLI dari ExecutionEngine, termasuk bagian yang jujur bilang
 *    "belum tersambung ke platform iklan/dst" -- BUKAN dikarang ulang di sini).
 *
 * Tipe actionType yang TIDAK dikenali switch di bawah tetap diteruskan apa adanya
 * ke server -- ExecutionEngine.executeAction() punya default branch yang jujur
 * ("Rekomendasi berhasil disetujui dan dicatat ke dalam audit trail operasional"),
 * jadi tidak ada actionCard.type yang membuat request ini gagal karena tidak
 * dikenal.
 */

export function mapActionCardTypeToExecutionActionType(cardType: string): string {
  switch (cardType) {
    case 'SCALE_ADS':
    case 'SCALE_BUDGET':
    case 'LAUNCH_ADS':
      return 'SCALE_MARKETING';
    case 'HIRE_STAFF':
      return 'APPROVE_HIRING';
    case 'RESOLVE_INVOICE':
      return 'COLLECT_INVOICES';
    case 'OPTIMIZE_EXPENSES':
    case 'WEEKLY_REC':
      return 'AUDIT_OPEX';
    default:
      return cardType;
  }
}

export interface ExecuteActionCardResult {
  ok: boolean;
  /** Pesan ASLI dari ExecutionEngine (sukses) atau pesan error server/jaringan (gagal). */
  message: string;
  details?: Record<string, any>;
  actionId?: string;
  raw?: any;
}

export async function executeActionCardOnServer(params: {
  cardType: string;
  cardTitle: string;
  recommendationId: string;
  actionPayload?: Record<string, any>;
  /** Diteruskan hanya untuk workspace-switcher multi-tenant milik Fatur; opsional. */
  workspaceId?: string;
}): Promise<ExecuteActionCardResult> {
  if (!params.recommendationId) {
    return { ok: false, message: 'Rekomendasi server tidak tersedia. Muat ulang jawaban AI sebelum mengeksekusi.' };
  }
  const actionType = mapActionCardTypeToExecutionActionType(params.cardType);
  // Kunci deterministik membuat retry jaringan dari kartu yang sama menjadi
  // replay aman. User harus menerima recommendation baru dari server untuk
  // menjalankan rekomendasi yang sama lagi secara sengaja.
  const idempotencyKey = `ai-action-${params.workspaceId || 'current'}-${params.recommendationId}-${actionType}`.slice(0, 190);

  try {
    const res = await fetch('/api/v1/brain/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        recommendationId: params.recommendationId,
        actionType,
        actionPayload: params.actionPayload || {},
        userNotes: `Disetujui via tombol kartu AI Assistant: "${params.cardTitle}"`,
        ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success) {
      return {
        ok: false,
        message: json?.message || `Gagal mengeksekusi rekomendasi (status ${res.status}).`,
        raw: json,
      };
    }

    return {
      ok: true,
      message: json.data?.message || 'Rekomendasi berhasil dieksekusi.',
      details: json.data?.details,
      actionId: json.data?.actionId,
      raw: json.data,
    };
  } catch (e: any) {
    return {
      ok: false,
      message: `Koneksi ke server gagal: ${e?.message || 'kesalahan tidak diketahui'}.`,
    };
  }
}

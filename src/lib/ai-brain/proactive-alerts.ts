/**
 * KLIR AI Brain -- Peringatan proaktif untuk AI Assistant (F2 kontrak Tingkat B, 10 Sep 2026).
 *
 * Ini "wadah" yang diminta Mecca: satu registry sumber peringatan, satu panel di atas chat.
 * Menambah jenis peringatan baru ke depan = menambah SATU entry di PROACTIVE_SOURCES
 * (fungsi fetch + mapper), bukan bikin panel/komponen baru. Sumber pertama: stok di bawah
 * minimum + belum ada produk (dari GET /api/v1/inventory/products summary). Sumber kedua:
 * alerts yang sudah ada dari GET /api/v1/brain/alerts (AlertPriorityEngine) -- hanya
 * CRITICAL/WARNING supaya panel tidak berisik.
 *
 * File ini PURE untuk bagian ranking/dismiss (bisa dites tanpa DOM). Bagian fetch memakai
 * fetch() global dan dipisah supaya komponen bisa mengganti/mematikan sumber lewat props.
 * Angka tidak pernah dikarang: kalau sumber gagal atau kosong, sumber itu menyumbang 0 kartu.
 */

export type ProactiveSeverity = 'kritis' | 'waspada' | 'info';
export type ProactiveRole =
  | 'CEO'
  | 'FINANCE'
  | 'MARKETING'
  | 'SEKRETARIS'
  | 'MANAGER_UMUM'
  | 'MANAGER_OPERASIONAL';

export interface ProactiveAlertCta {
  label: string;
  action: 'open-inventory' | 'ask-ai' | 'open-dashboard';
  /** Prompt siap kirim untuk action 'ask-ai' (diisi ke composer, TIDAK auto-kirim). */
  prompt?: string;
}

export interface ProactiveAlert {
  /** Stabil antar refresh supaya dismiss bisa diingat (mis. "stok:low:<productId>"). */
  id: string;
  sourceKey: string;
  severity: ProactiveSeverity;
  title: string;
  body: string;
  cta?: ProactiveAlertCta;
}

export interface ProactiveSourceContext {
  role: ProactiveRole;
  workspaceId: string;
}

export interface ProactiveSource {
  key: string;
  label: string;
  /** Role yang boleh melihat sumber ini. Kosong = semua role. */
  roles?: ProactiveRole[];
  fetch: (ctx: ProactiveSourceContext) => Promise<ProactiveAlert[]>;
}

export const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_CARDS_PER_SOURCE = 5;

const SEVERITY_RANK: Record<ProactiveSeverity, number> = { kritis: 0, waspada: 1, info: 2 };

// ---------------------------------------------------------------------------
// Pure helpers (dites di tests/proactive-alerts.test.ts)
// ---------------------------------------------------------------------------

export interface DismissRecord {
  id: string;
  at: number;
}

/** Buang catatan dismiss yang sudah lewat TTL. */
export function pruneDismissed(records: DismissRecord[], now: number = Date.now()): DismissRecord[] {
  return records.filter((r) => Number.isFinite(r.at) && now - r.at < DISMISS_TTL_MS);
}

/**
 * Gabungkan hasil semua sumber, buang yang di-dismiss (< 24 jam), urutkan kritis >
 * waspada > info, lalu batasi per sumber (MAX_CARDS_PER_SOURCE). Kalau satu sumber punya
 * lebih dari batas, sisanya diringkas jadi 1 kartu "N lainnya" supaya angka tetap jujur.
 */
export function mergeAndRank(
  alerts: ProactiveAlert[],
  dismissed: DismissRecord[],
  now: number = Date.now()
): ProactiveAlert[] {
  const active = new Set(pruneDismissed(dismissed, now).map((d) => d.id));
  const visible = alerts.filter((a) => !active.has(a.id));

  const bySource = new Map<string, ProactiveAlert[]>();
  for (const a of visible) {
    const list = bySource.get(a.sourceKey) ?? [];
    list.push(a);
    bySource.set(a.sourceKey, list);
  }

  const capped: ProactiveAlert[] = [];
  for (const [sourceKey, list] of bySource) {
    const sorted = [...list].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    if (sorted.length <= MAX_CARDS_PER_SOURCE) {
      capped.push(...sorted);
      continue;
    }
    const head = sorted.slice(0, MAX_CARDS_PER_SOURCE - 1);
    const rest = sorted.slice(MAX_CARDS_PER_SOURCE - 1);
    capped.push(...head, {
      id: `${sourceKey}:lainnya:${rest.length}`,
      sourceKey,
      severity: rest[0].severity,
      title: `${rest.length} peringatan lain dari sumber yang sama`,
      body: rest.map((r) => r.title).slice(0, 3).join(' | ') + (rest.length > 3 ? ' | ...' : ''),
    });
  }

  return capped.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export interface InventorySummaryLike {
  productCount: number;
  lowStockCount: number;
  lowStock: Array<{ id: string; name: string; sku?: string | null; unit: string; currentStock: number; minStock: number }>;
}

/**
 * Mapper sumber "stok". Kartu "belum ada produk" HANYA untuk CEO (Finance/Marketing
 * jangan dibanjiri onboarding yang bukan tugasnya). Low-stock tampil untuk CEO dan Finance.
 */
export function alertsFromInventorySummary(summary: InventorySummaryLike | null | undefined, role: ProactiveRole): ProactiveAlert[] {
  if (!summary) return [];
  const out: ProactiveAlert[] = [];

  if (summary.productCount === 0) {
    if (role === 'CEO' || role === 'MANAGER_OPERASIONAL') {
      out.push({
        id: 'stok:belum-ada-produk',
        sourceKey: 'stok',
        severity: 'info',
        title: 'Belum ada produk tercatat',
        body: 'Tambahkan produk pertama (nama, satuan, harga beli, harga jual, stok minimum) supaya AI bisa mengingatkan stok menipis dan menghitung restock.',
        cta: { label: 'Kelola stok lewat AI', action: 'open-inventory' },
      });
    }
    return out;
  }

  if (role === 'MARKETING' || role === 'SEKRETARIS' || role === 'MANAGER_UMUM') return out;

  for (const p of summary.lowStock ?? []) {
    const sisa = Number(p.currentStock);
    const min = Number(p.minStock);
    out.push({
      id: `stok:low:${p.id}`,
      sourceKey: 'stok',
      severity: sisa <= 0 ? 'kritis' : 'waspada',
      title: sisa <= 0 ? `${p.name} habis` : `${p.name} di bawah minimum`,
      body: `Sisa ${formatQty(sisa)} ${p.unit}, minimum ${formatQty(min)} ${p.unit}${p.sku ? ` (SKU ${p.sku})` : ''}.`,
      cta: { label: 'Tanya AI rencana restock', action: 'ask-ai', prompt: `Rekomendasi restock untuk ${p.name} 30 hari ke depan` },
    });
  }
  return out;
}

export interface BrainAlertLike {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | string;
  category?: string;
  title: string;
  message: string;
}

/** Mapper sumber "brain" (AlertPriorityEngine). INFO sengaja dibuang dari panel proaktif. */
export function alertsFromBrainAlerts(alerts: BrainAlertLike[] | null | undefined): ProactiveAlert[] {
  if (!alerts) return [];
  return alerts
    .filter((a) => a.severity === 'CRITICAL' || a.severity === 'WARNING')
    .map((a) => ({
      id: `brain:${a.id}`,
      sourceKey: 'brain',
      severity: a.severity === 'CRITICAL' ? 'kritis' : 'waspada',
      title: stripLeadingEmoji(a.title),
      body: a.message,
      cta: { label: 'Bahas di AI', action: 'ask-ai', prompt: `Jelaskan dan beri langkah konkret untuk: ${stripLeadingEmoji(a.title)}` },
    }));
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Sumber "kadaluarsa" -- ditambahkan 10 Sep 2026 (agent inventory-engine, kontrak
// F3b/F4). Sengaja tidak mengimpor buildExpiryAlerts dari inventory-intelligence-
// engine.ts supaya file ini tetap konsisten dengan pola yang sudah ada di sini: setiap
// mapper sumber self-contained (murni fungsi kecil, tidak bergantung modul lain) --
// lihat alertsFromInventorySummary/alertsFromBrainAlerts di atas. Ambang kritis/waspada
// (< 7 hari / < 30 hari) SENGAJA disamakan dengan buildExpiryAlerts di engine supaya
// jawaban chat AI dan kartu panel proaktif tidak pernah beda angka untuk data yang sama.
// ---------------------------------------------------------------------------

const EXPIRY_KRITIS_DAYS = 7;

export interface ExpiringBatchLike {
  id: string;
  batchCode?: string | null;
  expiryDate: string;
  qty: number;
  product?: { id: string; name: string; unit: string } | null;
}

/** Mapper sumber "kadaluarsa". Batch yang sudah lewat tanggal (daysLeft negatif) tetap
 * masuk sebagai kritis -- itu justru paling mendesak, bukan disembunyikan. Batch dengan
 * expiryDate yang tidak bisa diparse dibuang diam-diam (data rusak, bukan angka jujur
 * yang bisa ditampilkan). */
export function alertsFromExpiringBatches(batches: ExpiringBatchLike[] | null | undefined, now: number = Date.now()): ProactiveAlert[] {
  if (!batches) return [];
  const DAY_MS = 24 * 60 * 60 * 1000;
  const out: ProactiveAlert[] = [];

  for (const b of batches) {
    const expiryMs = new Date(b.expiryDate).getTime();
    if (!Number.isFinite(expiryMs)) continue;
    const daysLeft = Math.ceil((expiryMs - now) / DAY_MS);
    const severity: ProactiveSeverity = daysLeft < EXPIRY_KRITIS_DAYS ? 'kritis' : 'waspada';
    const name = b.product?.name ?? 'Produk';
    const unit = b.product?.unit ?? '';

    out.push({
      id: `kadaluarsa:${b.id}`,
      sourceKey: 'kadaluarsa',
      severity,
      title: daysLeft < 0 ? `${name} sudah lewat kadaluarsa` : `${name} kadaluarsa ${daysLeft} hari lagi`,
      body: `Sisa ${formatQty(b.qty)} ${unit}${b.batchCode ? ` (batch ${b.batchCode})` : ''}.`,
      cta: { label: 'Tanya AI', action: 'ask-ai', prompt: 'Produk apa yang mau kadaluarsa dan harus diapakan?' },
    });
  }

  return out;
}

/** Judul dari AlertPriorityEngine masih membawa emoji + prefix "CRITICAL:"; bersihkan untuk UI. */
export function stripLeadingEmoji(title: string): string {
  return (title || '')
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/^(CRITICAL|WARNING|INFO)\s*:\s*/i, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Registry sumber (bagian yang menyentuh jaringan)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const PROACTIVE_SOURCES: ProactiveSource[] = [
  {
    key: 'stok',
    label: 'Stok & Pembelian',
    roles: ['CEO', 'FINANCE', 'MANAGER_OPERASIONAL'],
    fetch: async ({ role }) => {
      const json = await fetchJson<{ summary?: InventorySummaryLike }>('/api/v1/inventory/products?page=1&limit=1');
      return alertsFromInventorySummary(json?.summary ?? null, role);
    },
  },
  {
    key: 'brain',
    label: 'Kesehatan bisnis',
    fetch: async () => {
      const json = await fetchJson<{ data?: { alerts?: BrainAlertLike[] } }>('/api/v1/brain/alerts');
      return alertsFromBrainAlerts(json?.data?.alerts ?? null);
    },
  },
  {
    // Ditambahkan 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4). roles CEO+FINANCE+MANAGER_OPERASIONAL
    // sama seperti sumber "stok" -- Marketing/Sekretaris/ManagerUmum tidak butuh diingatkan soal kadaluarsa gudang.
    key: 'kadaluarsa',
    label: 'Kadaluarsa',
    roles: ['CEO', 'FINANCE', 'MANAGER_OPERASIONAL'],
    fetch: async () => {
      const json = await fetchJson<{ batches?: ExpiringBatchLike[] }>('/api/v1/inventory/product-batches?expiringWithinDays=30');
      return alertsFromExpiringBatches(json?.batches ?? null);
    },
  },
];

/** Jalankan semua sumber yang relevan untuk role; satu sumber gagal tidak merobohkan yang lain. */
export async function collectProactiveAlerts(
  ctx: ProactiveSourceContext,
  sources: ProactiveSource[] = PROACTIVE_SOURCES
): Promise<ProactiveAlert[]> {
  const relevant = sources.filter((s) => !s.roles || s.roles.includes(ctx.role));
  const settled = await Promise.allSettled(relevant.map((s) => s.fetch(ctx)));
  const out: ProactiveAlert[] = [];
  for (const r of settled) if (r.status === 'fulfilled') out.push(...r.value);
  return out;
}

export function dismissStorageKey(role: ProactiveRole, workspaceId: string): string {
  return `klir_proactive_dismissed_${role.toLowerCase()}_${workspaceId || 'default'}`;
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { checkUploadRateLimit, uploadRateLimitResponse } from '@/lib/upload-rate-limit';
import { analyzeImageWithGemini } from '@/lib/ai-gateway';
import { StockMovementType } from '@prisma/client';

// KLIR Inventory -- Foto Jadi Input Stok (9 Sep 2026, BUILD_PLAN gelombang 2,
// item foto-jadi-input). Temuan riset lapangan 3 September: banyak UMKM masih
// mencatat stok di buku tulis manual, bukan sistem digital -- fitur ini
// membiarkan mereka foto halaman buku itu dan AI membaca isinya jadi draft
// stok terstruktur.
//
// REUSE, BUKAN BANGUN BARU: pipeline vision yang dipakai di sini
// (analyzeImageWithGemini, src/lib/ai-gateway.ts) adalah PERSIS fungsi yang
// sama dipakai /api/v1/documents/extract-text/route.ts untuk OCR foto nota/
// dokumen (gemini-2.5-flash via Gemini Vision) -- tidak ada infrastruktur
// vision baru dibangun di sesi ini. Pola $transaction + isolasi tenant
// productId ditiru dari /api/v1/inventory/purchase-orders/route.ts.
//
// DUA LANGKAH SENGAJA DIPISAH (bukan auto-commit):
//   POST -- terima foto, kembalikan DRAFT kandidat item (nama+qty+satuan)
//           hasil baca AI + hasil pencocokan ke Product yang sudah ada di
//           workspace. TIDAK menulis apapun ke database.
//   PUT  -- terima daftar item yang SUDAH dikonfirmasI/diedit manual oleh
//           user (productId + qtyChange final), baru di titik ini
//           StockMovement asli dibuat + Product.currentStock diperbarui.
// Ini SENGAJA -- AI vision bisa salah baca tulisan tangan, dan
// mengizinkan foto langsung mengubah stok tanpa konfirmasi manusia berisiko
// mencatat angka stok yang salah tanpa disadari siapapun.
//
// TIDAK menyentuh CashTransaction sama sekali -- input stok dari foto catatan
// manual adalah KOREKSI/PENYESUAIAN jumlah stok (StockMovementType.ADJUSTMENT_IN/
// ADJUSTMENT_OUT), bukan transaksi pembelian dengan harga, jadi tidak ada
// dasar angka uang yang sah untuk dicatat ke Kas.

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB, konsisten dgn documents/extract-text
const MAX_CANDIDATES = 200; // pagar wajar -- 1 foto buku catatan tidak realistis berisi ribuan baris
const MAX_COMMIT_ITEMS = 200;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const EXTRACTION_SYSTEM_INSTRUCTION =
  'Anda adalah asisten OCR & ekstraksi data stok untuk KLIR OS, business-OS UMKM Indonesia. ' +
  'Tugas Anda MEMBACA foto buku catatan stok manual (tulisan tangan atau cetak) dan mengubahnya ' +
  'jadi daftar barang terstruktur. DILARANG KERAS mengarang nama barang atau angka yang tidak ' +
  'benar-benar terlihat di foto -- kalau satu baris tulisan tidak terbaca jelas, tetap masukkan ' +
  'barisnya dengan qty null dan isi field "note" menjelaskan bagian mana yang tidak terbaca, ' +
  'JANGAN dilewati diam-diam.';

const EXTRACTION_PROMPT =
  'Baca foto buku catatan stok manual ini baris per baris. Untuk SETIAP baris yang berisi nama ' +
  'barang (dengan atau tanpa angka jumlah), keluarkan SATU objek JSON dengan field:\n' +
  '- "name": nama barang persis seperti tertulis di foto (string, wajib diisi)\n' +
  '- "qty": jumlah/kuantitas sebagai angka (number), atau null kalau tidak ada angka atau tidak terbaca\n' +
  '- "unit": satuan seperti pcs/kg/lusin/dus/liter kalau tertulis di foto, atau null kalau tidak ada\n' +
  '- "note": catatan singkat kalau ada bagian tulisan yang ambigu/tidak terbaca jelas, atau null\n\n' +
  'Balas HANYA dengan JSON array valid berisi objek-objek itu, TANPA teks penjelasan apapun di luar ' +
  'JSON, TANPA markdown code block (jangan pakai ```). Kalau foto sama sekali tidak berisi catatan ' +
  'stok/daftar barang, balas dengan array kosong: []';

/** Bongkar teks balasan model jadi array JSON. Model kadang membungkus jawaban
 *  dengan ```json ... ``` walau sudah diminta tidak -- dibersihkan dulu sebelum
 *  parse langsung; kalau masih gagal, coba ambil substring '[' s.d. ']' terakhir
 *  sebagai upaya kedua sebelum benar-benar menyerah (throw). */
function extractJsonArrayFromModelText(text: string): unknown[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const direct = JSON.parse(cleaned);
    if (Array.isArray(direct)) return direct;
  } catch {
    // lanjut ke upaya kedua di bawah
  }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const sliced = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(sliced)) return sliced;
    } catch {
      // jatuh ke throw di bawah
    }
  }
  throw new Error('Respons AI tidak berupa JSON array yang valid.');
}

interface PhotoStockCandidate {
  name: string;
  qty: number | null;
  unit: string | null;
  note: string | null;
  matchStatus: 'exact' | 'fuzzy' | 'ambiguous' | 'unmatched';
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchedProductCurrentStock: number | null;
  /** Terisi HANYA kalau matchStatus === 'ambiguous' -- lebih dari 1 produk cocok,
   *  user wajib pilih manual, sistem TIDAK menebak yang mana. */
  ambiguousCandidates?: Array<{ id: string; name: string }>;
}

function normalizeCandidates(raw: unknown[]): PhotoStockCandidate[] {
  const out: PhotoStockCandidate[] = [];
  for (const entry of raw.slice(0, MAX_CANDIDATES)) {
    const name = typeof (entry as any)?.name === 'string' ? (entry as any).name.trim() : '';
    if (!name) continue; // baris tanpa nama barang tidak berguna sbg kandidat, dibuang
    const qtyRaw = (entry as any)?.qty;
    const qty = typeof qtyRaw === 'number' && Number.isFinite(qtyRaw) ? qtyRaw : null;
    const unitRaw = (entry as any)?.unit;
    const unit = typeof unitRaw === 'string' && unitRaw.trim() ? unitRaw.trim() : null;
    const noteRaw = (entry as any)?.note;
    const note = typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null;
    out.push({
      name,
      qty,
      unit,
      note,
      matchStatus: 'unmatched',
      matchedProductId: null,
      matchedProductName: null,
      matchedProductCurrentStock: null,
    });
  }
  return out;
}

function normalizeProductName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type ProductForMatch = { id: string; name: string; currentStock: number };

type MatchResult =
  | { status: 'exact' | 'fuzzy'; product: ProductForMatch }
  | { status: 'ambiguous'; candidates: ProductForMatch[] }
  | { status: 'unmatched' };

/** Cocokkan nama kandidat hasil OCR ke Product yang sudah ada di workspace.
 *  SENGAJA konservatif -- exact match dulu, baru fuzzy (substring dua arah),
 *  dan kalau lebih dari 1 produk cocok di level manapun -> 'ambiguous'
 *  (matchedProductId TETAP null). Auto-pick di kondisi ambigu berisiko
 *  nempel stok ke produk yang salah tanpa user sadar. */
function matchProduct(candidateName: string, products: ProductForMatch[]): MatchResult {
  const norm = normalizeProductName(candidateName);
  if (!norm) return { status: 'unmatched' };

  const exact = products.filter((p) => normalizeProductName(p.name) === norm);
  if (exact.length === 1) return { status: 'exact', product: exact[0] };
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact };

  const fuzzy = products.filter((p) => {
    const pn = normalizeProductName(p.name);
    return pn.length > 0 && (pn.includes(norm) || norm.includes(pn));
  });
  if (fuzzy.length === 1) return { status: 'fuzzy', product: fuzzy[0] };
  if (fuzzy.length > 1) return { status: 'ambiguous', candidates: fuzzy };

  return { status: 'unmatched' };
}

/**
 * POST /api/v1/inventory/photo-to-stock
 * Terima 1 foto (multipart/form-data, field "file"), baca isinya lewat
 * Gemini Vision (reuse analyzeImageWithGemini), kembalikan DRAFT kandidat
 * item + hasil pencocokan ke Product existing. TIDAK menulis apapun ke DB.
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  const rl = checkUploadRateLimit(req, { max: 40, windowMs: 60 * 1000, keyPrefix: 'photo-to-stock' });
  if (!rl.allowed) return uploadRateLimitResponse(rl.resetTime);

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, message: 'Kirim foto via multipart/form-data dengan field "file".' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, message: 'File foto tidak ditemukan dalam form data.' }, { status: 400 });
    }

    const fileName = file.name || 'foto-stok';
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) {
      return NextResponse.json(
        { success: false, message: 'Format file tidak didukung. Gunakan foto PNG, JPG, JPEG, atau WEBP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Ukuran foto melebihi batas 15 MB. Kecilkan foto lalu unggah ulang.' },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    let visionResult: { text: string; modelUsed: string };
    try {
      visionResult = await analyzeImageWithGemini(base64, mimeType, EXTRACTION_PROMPT, EXTRACTION_SYSTEM_INSTRUCTION);
    } catch (visionErr: any) {
      return NextResponse.json(
        { success: false, message: `Gagal membaca foto lewat AI vision: ${visionErr?.message || 'layanan vision tidak tersedia saat ini'}.` },
        { status: 502 }
      );
    }

    let rawArray: unknown[];
    try {
      rawArray = extractJsonArrayFromModelText(visionResult.text);
    } catch (parseErr: any) {
      return NextResponse.json(
        {
          success: false,
          message: `AI tidak bisa membaca foto ini dengan format yang bisa diproses (${parseErr?.message || 'JSON tidak valid'}). Coba foto ulang dengan pencahayaan lebih jelas.`,
        },
        { status: 422 }
      );
    }

    const candidates = normalizeCandidates(rawArray);
    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada barang yang terdeteksi di foto ini. Coba foto ulang atau pastikan halaman catatan stok terlihat jelas.',
        candidates: [],
        modelUsed: visionResult.modelUsed,
      });
    }

    const workspaceId = auth.workspace.id;
    const products = await prisma.product.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true, currentStock: true },
    });

    for (const candidate of candidates) {
      const match = matchProduct(candidate.name, products);
      candidate.matchStatus = match.status;
      if (match.status === 'exact' || match.status === 'fuzzy') {
        candidate.matchedProductId = match.product.id;
        candidate.matchedProductName = match.product.name;
        candidate.matchedProductCurrentStock = match.product.currentStock;
      } else if (match.status === 'ambiguous') {
        candidate.ambiguousCandidates = match.candidates.map((p) => ({ id: p.id, name: p.name }));
      }
    }

    return NextResponse.json({
      success: true,
      message: `${candidates.length} barang terdeteksi dari foto. Draft ini BELUM tersimpan -- konfirmasi/edit tiap baris dulu sebelum di-commit (PUT ke endpoint yang sama).`,
      candidates,
      modelUsed: visionResult.modelUsed,
    });
  } catch (err: any) {
    console.error('[photo-to-stock] Internal error (extract):', err);
    return NextResponse.json({ success: false, message: publicApiError('Gagal memproses foto stok.') }, { status: 500 });
  }
}, { minRole: 'MEMBER' });

interface CommitItemInput {
  productId: string;
  qtyChange: number;
  note?: string;
  unitCost?: number;
}

function validateCommitItems(raw: unknown): { items: CommitItemInput[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Minimal 1 item stok wajib dikonfirmasi.' };
  }
  if (raw.length > MAX_COMMIT_ITEMS) {
    return { error: `Maksimal ${MAX_COMMIT_ITEMS} item bisa di-commit sekaligus. Pecah jadi beberapa batch.` };
  }
  const items: CommitItemInput[] = [];
  for (const entry of raw) {
    const productId = (entry as any)?.productId;
    const qtyChange = Number((entry as any)?.qtyChange);
    if (typeof productId !== 'string' || !productId) {
      return { error: 'productId setiap item wajib diisi (pilih produk yang sudah ada, atau buat produk baru dulu di menu Produk).' };
    }
    if (!Number.isFinite(qtyChange) || qtyChange === 0) {
      return { error: `qtyChange untuk produk ${productId} wajib angka bukan 0 (positif = tambah stok, negatif = kurangi stok).` };
    }
    const noteRaw = (entry as any)?.note;
    const unitCostRaw = (entry as any)?.unitCost;
    items.push({
      productId,
      qtyChange,
      note: typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : undefined,
      unitCost: typeof unitCostRaw === 'number' && Number.isFinite(unitCostRaw) && unitCostRaw >= 0 ? unitCostRaw : undefined,
    });
  }
  return { items };
}

/**
 * PUT /api/v1/inventory/photo-to-stock
 * Terima daftar item yang SUDAH dikonfirmasi/diedit manual oleh user
 * (productId + qtyChange final per item, hasil dari draft POST di atas atau
 * input manual). Baru DI SINI StockMovement (ADJUSTMENT_IN/ADJUSTMENT_OUT)
 * dibuat + Product.currentStock diperbarui, dalam 1 $transaction (pola sama
 * dengan purchase-orders/route.ts) -- termasuk isolasi tenant productId.
 * TIDAK membuat CashTransaction apapun (lihat komentar besar di atas berkas).
 */
export const PUT = withTenantGuard(async (req: NextRequest, { auth }) => {
  try {
    const body = await req.json();
    const parsed = validateCommitItems(body?.items);
    if ('error' in parsed) {
      return NextResponse.json({ message: parsed.error }, { status: 400 });
    }
    const { items } = parsed;
    const workspaceId = auth.workspace.id;

    const result = await prisma.$transaction(async (tx) => {
      // Isolasi tenant: SEMUA productId yang dikirim wajib milik workspace ini
      // (pola identik purchase-orders/route.ts baris ~106-116).
      const productIds = [...new Set(items.map((i) => i.productId))];
      const ownedProducts = await tx.product.findMany({
        where: { id: { in: productIds }, workspaceId },
        select: { id: true, name: true, currentStock: true },
      });
      if (ownedProducts.length !== productIds.length) {
        throw new Error('Salah satu produk tidak ditemukan atau bukan milik workspace ini.');
      }

      const deltaByProduct = new Map<string, number>();
      for (const item of items) {
        deltaByProduct.set(item.productId, (deltaByProduct.get(item.productId) || 0) + item.qtyChange);
      }
      const productMap = new Map(ownedProducts.map((product) => [product.id, product]));
      for (const [productId, delta] of deltaByProduct) {
        const product = productMap.get(productId)!;
        if (product.currentStock + delta < 0) {
          throw new Error(`Stok "${product.name}" tidak cukup untuk penyesuaian ini (stok saat ini: ${product.currentStock}, perubahan: ${delta}).`);
        }
      }

      const movements: unknown[] = [];
      for (const item of items) {
        const type = item.qtyChange > 0 ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT;

        const movement = await tx.stockMovement.create({
          data: {
            workspaceId,
            productId: item.productId,
            userId: auth.user.id,
            type,
            qtyChange: item.qtyChange,
            unitCost: item.unitCost ?? null,
            sourceType: 'PHOTO_TO_STOCK',
            sourceId: null,
            note: item.note || 'Input stok dari foto buku catatan manual (dikonfirmasi user)',
          },
        });
        movements.push(movement);

      }

      // Apply one atomic delta per product. For decrements, the currentStock
      // predicate makes the check race-safe: concurrent commits cannot push a
      // product below zero even if both read the same old snapshot.
      for (const [productId, delta] of deltaByProduct) {
        const updated = await tx.product.updateMany({
          where: {
            id: productId,
            workspaceId,
            ...(delta < 0 ? { currentStock: { gte: Math.abs(delta) } } : {}),
          },
          data: { currentStock: { increment: delta } },
        });
        if (updated.count !== 1) {
          throw new Error('Stok berubah bersamaan atau tidak cukup. Muat ulang data lalu konfirmasi lagi.');
        }
      }

      return { movements };
    });

    return NextResponse.json({
      success: true,
      message: `${result.movements.length} penyesuaian stok berhasil dicatat dari foto.`,
      movements: result.movements,
    });
  } catch (err: any) {
    // Pesan validasi stok (Stok"X"tidak cukup / berubah bersamaan) MEMANG dirancang
    // buat ditunjukkan ke user -- regresi DEEP-010 sempat nutup ini jadi pesan generik,
    // padahal itu justru pesan yang baru saja ditulis sebagai bagian fix Claude#15.
    const knownBusinessError =
      err instanceof Error && /^Stok (\".+\" tidak cukup|berubah bersamaan)/.test(err.message)
        ? err.message
        : publicApiError('Penyesuaian stok dari foto gagal disimpan.');
    return NextResponse.json({ message: knownBusinessError }, { status: 400 });
  }
}, { minRole: 'MEMBER' });

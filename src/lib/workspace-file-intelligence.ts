/**
 * FASE 5 — 13 Sep 2026: File Intelligence Engine untuk KLIR Workspace Data Hub.
 *
 * Engine ini memperluas sistem file upload yang sudah ada (workspace-file-extraction.ts,
 * workspace-file-dataquality.ts) dengan lapisan kecerdasan BARU:
 *   1. Auto-kategorisasi file berdasarkan nama file + konten yang sudah diekstrak
 *   2. Tag extraction otomatis (tanggal, nominal, nama entitas)
 *   3. Content summary 2-3 kalimat (deterministik, zero LLM)
 *
 * DESAIN:
 *   - NOL Prisma call, NOL LLM, NOL kolom DB baru
 *   - Output disuntikkan ke extractedSummary sebagai blok header [KATEGORI FILE]
 *     (pola yang sama seperti [PEMERIKSAAN DATA] dari workspace-file-dataquality.ts)
 *   - Idempotent: dapat dipanggil dua kali dengan hasil yang sama
 *
 * INTEGRASI:
 *   Dipanggil dari workspace-files/route.ts POST setelah ekstraksi teks selesai,
 *   SEBELUM data disimpan ke DB.
 */

// ---------------------------------------------------------------------------
// Tipe data
// ---------------------------------------------------------------------------

export type FileCategory =
  | 'finance'      // keuangan, kas, pajak, invoice, hutang/piutang
  | 'marketing'    // kampanye, iklan, ROAS, leads, konversi
  | 'operations'   // stok, PO, supplier, gudang, reorder
  | 'hr'           // gaji, absensi, payroll, karyawan, shift
  | 'legal'        // kontrak, perizinan, perjanjian, SIUP, akta
  | 'report'       // laporan, rekap, summary, rangkuman bulanan
  | 'general';     // fallback

export interface FileTag {
  type: 'date' | 'nominal' | 'entity' | 'keyword';
  value: string;
}

export interface FileIntelligenceResult {
  category: FileCategory;
  categoryLabel: string;
  tags: FileTag[];
  contentSummary: string;
  confidence: 'high' | 'medium' | 'low';
  detectedLanguage: 'id' | 'en' | 'mixed';
  processedAt: string;
}

// ---------------------------------------------------------------------------
// Label mapping
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  finance:    'Keuangan & Pajak',
  marketing:  'Marketing & Iklan',
  operations: 'Operasional & Gudang',
  hr:         'SDM & Payroll',
  legal:      'Legalitas & Kontrak',
  report:     'Laporan & Rekap',
  general:    'Umum',
};

// ---------------------------------------------------------------------------
// Keyword patterns per kategori (strong = skor 3, weak = skor 1)
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<
  Exclude<FileCategory, 'general'>,
  { strong: RegExp[]; weak: RegExp[] }
> = {
  finance: {
    strong: [
      /\blaba\b/gi, /\brugi\b/gi, /\bneraca\b/gi, /\barus kas\b/gi, /\bcash ?flow\b/gi,
      /\bbuku kas\b/gi, /\bjurnal\b/gi, /\bfaktur\b/gi, /\binvoice\b/gi,
      /\bpiutang\b/gi, /\bhutang\b/gi, /\butang\b/gi, /\bpajak\b/gi,
      /\bppn\b/gi, /\bpph\b/gi, /\bsp2dk\b/gi, /\bsaldo\b/gi,
      /\brekening\b/gi, /\btransaksi\b/gi, /\bkeuangan\b/gi, /\bfinance\b/gi,
    ],
    weak: [
      /\bkas\b/gi, /\bbiaya\b/gi, /\bpengeluaran\b/gi, /\bpendapatan\b/gi,
      /\bomzet\b/gi, /\bomset\b/gi, /\bpenjualan\b/gi, /\bmodal\b/gi,
      /\banggaran\b/gi, /\bbudget\b/gi, /\btagihan\b/gi, /\bbank\b/gi, /\bhpp\b/gi,
    ],
  },
  marketing: {
    strong: [
      /\bkampanye\b/gi, /\bcampaign\b/gi, /\biklan\b/gi, /\bads\b/gi,
      /\bleads?\b/gi, /\broas\b/gi, /\bctr\b/gi, /\bcpc\b/gi, /\bcpm\b/gi,
      /\binstagram\b/gi, /\btiktok\b/gi, /\bfacebook\b/gi, /\bmeta ads\b/gi,
      /\bgoogle ads\b/gi, /\bfunnel\b/gi, /\bengagement\b/gi, /\bconversion\b/gi,
      /\bpemasaran\b/gi, /\bmarketing\b/gi, /\bcopywriting\b/gi,
    ],
    weak: [
      /\bkonten\b/gi, /\bcontent\b/gi, /\bbrand(ing)?\b/gi, /\bpromo(si)?\b/gi,
      /\baudiens\b/gi, /\bsegmen\b/gi, /\bkreatif\b/gi, /\bprospek\b/gi,
      /\bretargeting\b/gi, /\bimpresi\b/gi, /\bklik\b/gi,
    ],
  },
  operations: {
    strong: [
      /\bstok\b/gi, /\bstock\b/gi, /\bgudang\b/gi, /\bpurchase order\b/gi,
      /\b\bpo\b\b/gi, /\bsupplier\b/gi, /\bpemasok\b/gi, /\breorder\b/gi,
      /\brestock\b/gi, /\binventori\b/gi, /\binventory\b/gi, /\bkadaluarsa\b/gi,
      /\bexpiry\b/gi, /\brantai pasok\b/gi, /\bsupply chain\b/gi,
      /\bpenerimaan barang\b/gi, /\bdelivery\b/gi, /\bpengiriman\b/gi,
    ],
    weak: [
      /\bbarang\b/gi, /\bproduk\b/gi, /\bkuantitas\b/gi, /\bstok minimum\b/gi,
      /\baudit\b/gi, /\bsop gudang\b/gi, /\bwarehouse\b/gi,
    ],
  },
  hr: {
    strong: [
      /\bpayroll\b/gi, /\bgaji\b/gi, /\bupah\b/gi, /\btunjangan\b/gi,
      /\bbpjs\b/gi, /\bthr\b/gi, /\bslip gaji\b/gi, /\brekap gaji\b/gi,
      /\babsensi\b/gi, /\bkehadiran\b/gi, /\bpph 21\b/gi, /\bjamsostek\b/gi,
    ],
    weak: [
      /\bkaryawan\b/gi, /\bpegawai\b/gi, /\bcuti\b/gi, /\bhrd?\b/gi,
      /\brekrut/gi, /\bpotongan\b/gi, /\bshift\b/gi, /\bjadwal kerja\b/gi,
      /\bovertime\b/gi, /\blembur\b/gi,
    ],
  },
  legal: {
    strong: [
      /\bkontrak\b/gi, /\bperjanjian\b/gi, /\bperjanjian kerja\b/gi,
      /\bsiup\b/gi, /\bnib\b/gi, /\bnpwp\b/gi, /\bakta\b/gi,
      /\bperizinan\b/gi, /\blisensi\b/gi, /\bnotaris\b/gi,
      /\bsurat kuasa\b/gi, /\bberita acara\b/gi, /\bmou\b/gi,
      /\bperjanjian jual beli\b/gi, /\bsertifikat\b/gi,
    ],
    weak: [
      /\bketentuan\b/gi, /\bpasal\b/gi, /\bhukum\b/gi, /\bperaturan\b/gi,
      /\bwewenang\b/gi, /\bkewajiban\b/gi, /\bhak dan\b/gi,
    ],
  },
  report: {
    strong: [
      /\blaporan bulanan\b/gi, /\brekap bulanan\b/gi, /\bsummary report\b/gi,
      /\bmonthly report\b/gi, /\blaporan tahunan\b/gi, /\bannual report\b/gi,
      /\brangkuman\b/gi, /\beksekutif summary\b/gi, /\brekapitulasi\b/gi,
    ],
    weak: [
      /\blaporan\b/gi, /\brekap\b/gi, /\bringkasan\b/gi, /\bsummary\b/gi,
      /\banalisis\b/gi, /\banalisa\b/gi, /\bhasil\b/gi,
    ],
  },
};

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

function scoreCategory(
  text: string,
  fileName: string,
  cat: Exclude<FileCategory, 'general'>
): number {
  const kw = CATEGORY_KEYWORDS[cat];
  const nameLower = fileName.toLowerCase();

  // Skor nama file (absolut, berbobot tinggi)
  const nameStrong = countMatches(nameLower, kw.strong);
  const nameWeak = countMatches(nameLower, kw.weak);
  const nameScore = nameStrong * 4 + nameWeak * 2;

  // Skor isi (kepadatan per 1000 karakter)
  const scanText = text.slice(0, 6000).toLowerCase();
  const kchars = Math.max(0.3, scanText.length / 1000);
  const bodyStrong = countMatches(scanText, kw.strong);
  const bodyWeak = countMatches(scanText, kw.weak);
  const bodyScore = (bodyStrong + bodyWeak * 0.4) / kchars;

  return nameScore + bodyScore;
}

function classifyCategory(fileName: string, extractedText: string): { category: FileCategory; confidence: 'high' | 'medium' | 'low' } {
  const categories = (['finance', 'marketing', 'operations', 'hr', 'legal', 'report'] as const);
  const scores: Record<string, number> = {};

  for (const cat of categories) {
    scores[cat] = scoreCategory(extractedText, fileName, cat);
  }

  const sorted = categories.slice().sort((a, b) => scores[b] - scores[a]);
  const top = sorted[0];
  const topScore = scores[top];
  const runnerUpScore = scores[sorted[1]] ?? 0;

  if (topScore < 2) return { category: 'general', confidence: 'low' };

  const ratio = runnerUpScore > 0 ? topScore / runnerUpScore : Infinity;
  const confidence: 'high' | 'medium' | 'low' =
    ratio >= 2.5 ? 'high' : ratio >= 1.4 ? 'medium' : 'low';

  return { category: top, confidence };
}

// ---------------------------------------------------------------------------
// Tag extraction
// ---------------------------------------------------------------------------

function extractTags(text: string, fileName: string): FileTag[] {
  const tags: FileTag[] = [];
  const seen = new Set<string>();

  const addTag = (tag: FileTag) => {
    if (!seen.has(tag.value)) { seen.add(tag.value); tags.push(tag); }
  };

  // Tanggal (DD/MM/YYYY, YYYY-MM-DD, bulan Indonesia)
  const datePatterns = [
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g,
    /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})\b/gi,
    /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g,
  ];
  for (const re of datePatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && tags.filter(t => t.type === 'date').length < 3) {
      addTag({ type: 'date', value: m[0].trim() });
    }
  }

  // Nominal (Rp xxx.xxx atau xxx,xxx)
  const nominalRe = /Rp\.?\s*[\d.,]+(?:\s*(?:juta|ribu|rb|jt))?|\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b/g;
  let nm: RegExpExecArray | null;
  while ((nm = nominalRe.exec(text)) !== null && tags.filter(t => t.type === 'nominal').length < 3) {
    addTag({ type: 'nominal', value: nm[0].trim() });
  }

  // Keywords dari nama file sebagai tags
  const fileWords = fileName.replace(/[-_.]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  for (const word of fileWords.slice(0, 4)) {
    addTag({ type: 'keyword', value: word.toLowerCase() });
  }

  return tags.slice(0, 10); // maks 10 tag
}

// ---------------------------------------------------------------------------
// Content summary (deterministik)
// ---------------------------------------------------------------------------

function generateContentSummary(
  fileName: string,
  category: FileCategory,
  tags: FileTag[],
  extractedText: string
): string {
  const catLabel = CATEGORY_LABELS[category];
  const dateTag = tags.find(t => t.type === 'date');
  const nominalTag = tags.find(t => t.type === 'nominal');

  const firstSentence = extractedText
    .split(/[.!?\n]/)
    .map(s => s.trim())
    .find(s => s.length > 20 && s.length < 200) || '';

  let summary = `Berkas "${fileName}" terklasifikasi sebagai dokumen ${catLabel}.`;

  if (dateTag) summary += ` Dokumen mencakup data bertanggal ${dateTag.value}.`;
  if (nominalTag) summary += ` Ditemukan nilai nominal seperti ${nominalTag.value}.`;
  if (firstSentence) summary += ` Ringkasan awal: "${firstSentence.slice(0, 120)}${firstSentence.length > 120 ? '…' : ''}".`;

  return summary;
}

// ---------------------------------------------------------------------------
// Deteksi bahasa (heuristik sederhana)
// ---------------------------------------------------------------------------

function detectLanguage(text: string): 'id' | 'en' | 'mixed' {
  const idMarkers = (text.match(/\b(dan|yang|dengan|untuk|dalam|tidak|sudah|dari|ke|di|ini|itu|pada|oleh)\b/gi) || []).length;
  const enMarkers = (text.match(/\b(the|and|with|for|from|this|that|in|is|are|was|were|have|has|not)\b/gi) || []).length;
  if (idMarkers > enMarkers * 2) return 'id';
  if (enMarkers > idMarkers * 2) return 'en';
  return 'mixed';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Klasifikasi file workspace berdasarkan nama file dan teks hasil ekstraksi.
 * Dipanggil dari workspace-files/route.ts POST setelah extractTextForWorkspaceFile().
 *
 * @param fileName  Nama file asli (termasuk ekstensi)
 * @param extractedText  Teks hasil ekstraksi dari workspace-file-extraction.ts
 * @returns FileIntelligenceResult — selalu berhasil, tidak throw
 */
export function classifyWorkspaceFile(fileName: string, extractedText: string): FileIntelligenceResult {
  try {
    const { category, confidence } = classifyCategory(fileName, extractedText);
    const tags = extractTags(extractedText, fileName);
    const contentSummary = generateContentSummary(fileName, category, tags, extractedText);
    const detectedLanguage = detectLanguage(extractedText.slice(0, 2000));

    return {
      category,
      categoryLabel: CATEGORY_LABELS[category],
      tags,
      contentSummary,
      confidence,
      detectedLanguage,
      processedAt: new Date().toISOString(),
    };
  } catch {
    // Non-fatal — jangan pernah gagalkan upload karena klasifikasi error
    return {
      category: 'general',
      categoryLabel: CATEGORY_LABELS.general,
      tags: [],
      contentSummary: `Berkas "${fileName}" berhasil diunggah.`,
      confidence: 'low',
      detectedLanguage: 'id',
      processedAt: new Date().toISOString(),
    };
  }
}

/**
 * Format blok header [KATEGORI FILE] untuk disuntikkan ke awal extractedSummary.
 * Pola sama dengan [PEMERIKSAAN DATA] di workspace-file-dataquality.ts.
 */
export function buildFileIntelligenceBlock(result: FileIntelligenceResult): string {
  const tagLine = result.tags.map(t => t.value).join(', ') || '-';
  const hasDate = result.tags.some(t => t.type === 'date');
  const dateVerificationNotice = hasDate
    ? ''
    : `[VERIFIKASI TANGGAL]: Dokumen tidak memuat tanggal/periode eksplisit. AI menandai status konfirmasi: periksa apakah dokumen ini mewakili data operasional terkini atau arsip periode lalu.\n`;

  return (
    `[KATEGORI FILE]\n` +
    `Kategori: ${result.categoryLabel} (${result.category})\n` +
    `Confidence: ${result.confidence}\n` +
    `Bahasa: ${result.detectedLanguage}\n` +
    `Tags: ${tagLine}\n` +
    `Ringkasan: ${result.contentSummary}\n` +
    (dateVerificationNotice ? `Status Periode: Butuh konfirmasi tanggal/periode operasional\n` : '') +
    `[/KATEGORI FILE]\n` +
    (dateVerificationNotice ? `${dateVerificationNotice}\n` : '')
  );
}

/**
 * Parse header [KATEGORI FILE] dari extractedSummary yang sudah tersimpan di DB.
 * Dipakai GET workspace-files untuk expose kategori ke frontend tanpa kolom DB baru.
 */
export function parseFileCategoryHeader(extractedSummary: string | null): {
  category: FileCategory | null;
  categoryLabel: string | null;
} {
  if (!extractedSummary) return { category: null, categoryLabel: null };
  const match = extractedSummary.match(/\[KATEGORI FILE\][\s\S]*?Kategori:\s*([^\s(]+)\s*\(([^)]+)\)/);
  if (!match) return { category: null, categoryLabel: null };
  const cat = match[2]?.trim() as FileCategory;
  return {
    category: cat ?? null,
    categoryLabel: CATEGORY_LABELS[cat] ?? null,
  };
}

/**
 * KLIR AI Brain -- Data Visibility per Divisi (11 Sep 2026 sore, Fable 5.1,
 * keputusan produk Mecca setelah salat Jumat).
 *
 * Keputusan Mecca (verbatim inti): "kalau CEO ya bisa ngelihat semuanya untuk
 * role-nya, tapi kalau untuk finance dan marketing ini perlu difilter lagi...
 * misalnya data keuangan perusahaan: tim finance pasti bisa lihat, tapi kalau
 * tim marketing harus difilter dulu mana yang marketing ini bisa lihat."
 *
 * Modul ini SATU-SATUNYA sumber kebenaran "siapa boleh lihat data apa" untuk
 * lane AI/Pusat Data. Dipakai oleh:
 *   - workspace-files GET (daftar) + GET [id] (detail)      -> file yang tampil
 *   - workspace-knowledge.ts (konteks AI chat)             -> file yang dibaca AI
 *   - dashboard-insight.ts                                  -> bahan insight per role
 *   - quick-data-router.ts                                  -> saldo/tagihan/gaji tim
 *   - conversation-memory.ts                                -> inti jawaban divisi lain
 *
 * Authority: `WorkspaceMember.divisionRole` adalah sumber server-side untuk akun
 * baru. Legacy OWNER/ADMIN + email mapping tetap dipertahankan agar portal lama
 * tidak rusak, tetapi role yang diklaim client tidak boleh menaikkan role baru.
 *
 * NOL LLM, NOL Prisma: semua fungsi di sini murni (deterministik) supaya bisa
 * dites langsung tanpa mock.
 */

export type DivisionRole =
  | 'CEO'
  | 'FINANCE'
  | 'MARKETING'
  | 'SEKRETARIS'
  | 'MANAGER_UMUM'
  | 'MANAGER_OPERASIONAL'
  | 'LAIN';
export type FileDivision = 'KEUANGAN' | 'SDM' | 'MARKETING' | 'UMUM';

export const FILE_DIVISION_LABEL: Record<FileDivision, string> = {
  KEUANGAN: 'Keuangan',
  SDM: 'SDM / Payroll',
  MARKETING: 'Marketing',
  UMUM: 'Umum',
};

/** Matriks akses divisi -> kelompok file yang boleh dilihat. CEO = superset. */
const VISIBILITY_MATRIX: Record<DivisionRole, ReadonlySet<FileDivision>> = {
  CEO: new Set<FileDivision>(['KEUANGAN', 'SDM', 'MARKETING', 'UMUM']),
  FINANCE: new Set<FileDivision>(['KEUANGAN', 'SDM', 'UMUM']),
  MARKETING: new Set<FileDivision>(['MARKETING', 'UMUM']),
  SEKRETARIS: new Set<FileDivision>(['UMUM', 'SDM']),
  MANAGER_UMUM: new Set<FileDivision>(['UMUM', 'SDM', 'KEUANGAN', 'MARKETING']),
  MANAGER_OPERASIONAL: new Set<FileDivision>(['UMUM', 'KEUANGAN', 'SDM']),
  LAIN: new Set<FileDivision>(['UMUM']),
};

export interface ResolveDivisionInput {
  email?: string | null;
  membershipRole?: string | null;
  /** Functional division stored on the verified workspace membership. */
  membershipDivisionRole?: string | null;
  /** Role portal yang dideklarasikan client (body.userRole / ?role=). */
  declaredRole?: string | null;
}

/**
 * Turunkan divisi pembaca dari assignment membership authoritative, lalu
 * compatibility mapping legacy. `declaredRole` hanya dipakai untuk legacy
 * callers yang belum punya email/assignment; role baru tidak boleh muncul dari
 * klaim client saja.
 */
export function resolveDivisionRole(input: ResolveDivisionInput): DivisionRole {
  const assigned = normalizeDivisionRole(input.membershipDivisionRole);
  if (assigned) return assigned;

  const membership = (input.membershipRole || '').toUpperCase();
  const declared = (input.declaredRole || '').trim().toUpperCase().replace(/[- ]+/g, '_');
  const normalizedDeclared = normalizeDivisionRole(declared);

  // Jika user adalah OWNER atau ADMIN (misal Mecca/Owner), mereka berhak melihat
  // perspektif divisi manapun yang sedang mereka buka di antarmuka (portal switcher).
  if ((membership === 'OWNER' || membership === 'ADMIN') && normalizedDeclared) {
    return normalizedDeclared;
  }
  if (membership === 'OWNER' || membership === 'ADMIN') return 'CEO';

  const email = (input.email || '').trim().toLowerCase();
  const local = email.includes('@') ? email.slice(0, email.indexOf('@')) : '';
  if (local === 'ceo' || local === 'owner') return 'CEO';
  if (local === 'finance' || local === 'keuangan') return 'FINANCE';
  if (local === 'marketing') return 'MARKETING';
  if (local === 'sekretaris' || local === 'secretary') return 'SEKRETARIS';
  if (local === 'manager' || local === 'manajer') return 'MANAGER_UMUM';
  if (local === 'operasional' || local === 'manager-operasional' || local === 'manager_operasional') return 'MANAGER_OPERASIONAL';
  // Compatibility & Role switching: support all 6 valid roles when explicitly declared
  if (
    declared === 'CEO' ||
    declared === 'FINANCE' ||
    declared === 'MARKETING' ||
    declared === 'SEKRETARIS' ||
    declared === 'MANAGER_UMUM' ||
    declared === 'MANAGER_OPERASIONAL'
  ) {
    return declared;
  }
  return 'LAIN';
}

function normalizeDivisionRole(value?: string | null): Exclude<DivisionRole, 'LAIN'> | null {
  const normalized = (value || '').trim().toUpperCase().replace(/[- ]+/g, '_');
  if (normalized === 'CEO' || normalized === 'FINANCE' || normalized === 'MARKETING' || normalized === 'SEKRETARIS' || normalized === 'MANAGER_UMUM' || normalized === 'MANAGER_OPERASIONAL') {
    return normalized;
  }
  return null;
}

/**
 * Kata kunci per kelompok, dua tingkat:
 *   STRONG = kata yang hampir pasti menandai dokumen divisi itu (laba, neraca,
 *            payroll, gaji, kampanye, iklan, ...).
 *   WEAK   = kata yang sering muncul di dokumen umum juga (biaya, karyawan,
 *            konten, promo, ...) -- dihitung lebih ringan.
 *
 * KALIBRASI 11 Sep 2026 sore (read-only atas 24 file nyata di 2 workspace):
 * versi pertama menghitung mentah tanpa kepadatan -> notulen rapat, company
 * profile, daftar menu, kontrak sewa ikut jadi KEUANGAN/SDM cuma karena
 * beberapa kata "biaya/karyawan" di 4000 karakter; Marketing cuma lihat 1/12
 * file. Sekarang skor isi = KEPADATAN per 1000 karakter (bukan jumlah mentah),
 * dan nama file berbobot mutlak. Hasil kalibrasi: laporan laba rugi, laporan
 * penjualan, transaksi mentah, rekap kas, invoice -> KEUANGAN; payroll -> SDM;
 * brief kampanye -> MARKETING; notulen, profil, menu, kontrak, proposal,
 * presentasi review, inventori -> UMUM.
 */
const KEYWORDS: Record<Exclude<FileDivision, 'UMUM'>, { strong: RegExp[]; weak: RegExp[] }> = {
  SDM: {
    strong: [/\bpayroll\b/gi, /\bgaji\b/gi, /\bupah\b/gi, /\btunjangan\b/gi, /\bbpjs\b/gi, /\bthr\b/gi, /\bslip gaji\b/gi],
    weak: [/\bkaryawan\b/gi, /\bpegawai\b/gi, /\babsensi\b/gi, /\bcuti\b/gi, /\bhrd?\b/gi, /\brekrut/gi, /\bpotongan\b/gi],
  },
  KEUANGAN: {
    strong: [
      /\blaba\b/gi, /\brugi\b/gi, /\bneraca\b/gi, /\barus kas\b/gi, /\bcash ?flow\b/gi, /\bbuku kas\b/gi,
      /\bjurnal\b/gi, /\bledger\b/gi, /\binvoice\b/gi, /\bfaktur\b/gi, /\bpiutang\b/gi, /\bhutang\b/gi,
      /\butang\b/gi, /\bpajak\b/gi, /\bppn\b/gi, /\bpph\b/gi, /\btransaksi\b/gi, /\bsaldo\b/gi,
      /\brekening\b/gi, /\bkeuangan\b/gi, /\bfinansial\b/gi, /\bfinance\b/gi, /ANGKA TERVERIFIKASI/g,
    ],
    weak: [
      /\bkas\b/gi, /\bbiaya\b/gi, /\bpengeluaran\b/gi, /\bpendapatan\b/gi, /\bomset\b/gi, /\bomzet\b/gi,
      /\bpenjualan\b/gi, /\bmodal\b/gi, /\banggaran\b/gi, /\bbudget\b/gi, /\btagihan\b/gi, /\bbank\b/gi, /\bhpp\b/gi,
    ],
  },
  MARKETING: {
    strong: [
      /\bkampanye\b/gi, /\bcampaign\b/gi, /\biklan\b/gi, /\bads\b/gi, /\bleads?\b/gi, /\bsosmed\b/gi,
      /\bsocial media\b/gi, /\binstagram\b/gi, /\btiktok\b/gi, /\bfacebook\b/gi, /\broas\b/gi, /\bctr\b/gi,
      /\bcpc\b/gi, /\bfunnel\b/gi, /\bengagement\b/gi, /\bfollowers?\b/gi, /\bmarketing\b/gi,
      /\bpemasaran\b/gi, /\bcopywriting\b/gi,
    ],
    weak: [/\bkonten\b/gi, /\bcontent\b/gi, /\bbrand(ing)?\b/gi, /\bpromo(si)?\b/gi, /\baudiens\b/gi, /\bsegmen/gi, /\bkreatif\b/gi, /\bprospek\b/gi],
  },
};

/** Bobot kata kunci di NAMA FILE (mutlak, bukan kepadatan). */
const NAME_STRONG_WEIGHT = 4;
const NAME_WEAK_WEIGHT = 2;
/** Bobot kata WEAK di isi relatif terhadap STRONG. */
const BODY_WEAK_FACTOR = 0.4;
/** Isi < 300 karakter dihitung seolah 300 (file kecil tidak meledak kepadatannya). */
const MIN_BODY_KCHARS = 0.3;
/** Skor minimum supaya file TIDAK jatuh ke UMUM. */
const MIN_SCORE = 2;
/** Isi yang dipindai dibatasi supaya klasifikasi tetap murah untuk ratusan file. */
const SUMMARY_SCAN_CHARS = 6000;

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

/** Nama file: pemisah -_. jadi spasi supaya "buku-kas" cocok dengan "buku kas". */
function normalizeFileName(fileName: string): string {
  return (fileName || '').replace(/[-_.]+/g, ' ');
}

function groupScore(name: string, body: string, bodyKChars: number, group: Exclude<FileDivision, 'UMUM'>): number {
  const kw = KEYWORDS[group];
  const nameScore = countMatches(name, kw.strong) * NAME_STRONG_WEIGHT + countMatches(name, kw.weak) * NAME_WEAK_WEIGHT;
  const bodyDensity = (countMatches(body, kw.strong) + countMatches(body, kw.weak) * BODY_WEAK_FACTOR) / bodyKChars;
  return nameScore + bodyDensity;
}

/**
 * Klasifikasi deterministik 1 file ke kelompok divisi. `ingestKind` (kalau ada,
 * dari [INGEST_LOG]) menang mutlak karena itu bukti terkuat isi file: payroll ->
 * SDM, ledger-* -> KEUANGAN, produk -> UMUM. Tanpa itu: skor nama file (mutlak)
 * + kepadatan kata kunci isi (per 1000 karakter). Seri KEUANGAN vs SDM -> SDM
 * (finance tetap boleh lihat SDM jadi tidak ada kebocoran). Skor < MIN_SCORE -> UMUM.
 */
export function classifyFileDivision(
  fileName: string,
  extractedSummary: string | null | undefined,
  ingestKind?: string | null
): FileDivision {
  if (ingestKind === 'payroll') return 'SDM';
  if (ingestKind === 'ledger-klasik' || ingestKind === 'ledger-generik') return 'KEUANGAN';
  if (ingestKind === 'produk') return 'UMUM';

  const name = normalizeFileName(fileName);
  const body = (extractedSummary || '').slice(0, SUMMARY_SCAN_CHARS);

  // Pintu 9: Dokumen legal, administrasi, kontrak, perjanjian sewa, akta, dan notulen rapat
  // dikelompokkan ke UMUM agar bisa diakses oleh SEKRETARIS, CEO, Manager, dll.
  const isLegalOrAdmin = /\b(kontrak|perjanjian|sewa|notulen|agenda|akta|mou|surat keputusan|sk |berita acara)\b/i.test(name) ||
    (/\b(perjanjian sewa|surat perjanjian|pihak pertama|pihak kedua|akta pendirian|notulen rapat bulanan|berita acara)\b/i.test(body) && !/\b(laporan laba rugi|buku kas|rekapitulasi kas)\b/i.test(name));
  if (isLegalOrAdmin) return 'UMUM';

  const bodyKChars = Math.max(MIN_BODY_KCHARS, body.length / 1000);
  const scores: Record<Exclude<FileDivision, 'UMUM'>, number> = {
    SDM: groupScore(name, body, bodyKChars, 'SDM'),
    KEUANGAN: groupScore(name, body, bodyKChars, 'KEUANGAN'),
    MARKETING: groupScore(name, body, bodyKChars, 'MARKETING'),
  };

  const best = Math.max(scores.SDM, scores.KEUANGAN, scores.MARKETING);
  if (best < MIN_SCORE) return 'UMUM';
  if (scores.SDM === best) return 'SDM';
  if (scores.KEUANGAN === best) return 'KEUANGAN';
  return 'MARKETING';
}

export function canRoleSeeDivision(role: DivisionRole, division: FileDivision): boolean {
  return VISIBILITY_MATRIX[role].has(division);
}

export interface VisibilityFileLike {
  fileName: string;
  extractedSummary?: string | null;
  uploadedBy?: string | null;
  ingestKind?: string | null;
}

export interface FilterFilesOptions {
  /** Id user pembaca -- file yang dia upload sendiri SELALU terlihat. */
  viewerUserId?: string | null;
}

/**
 * Saring daftar file untuk 1 pembaca. Mengembalikan file yang lolos beserta
 * `divisi` hasil klasifikasi, plus jumlah yang disembunyikan (untuk catatan
 * jujur di manifest AI / UI, tanpa membocorkan nama filenya).
 */
export function filterFilesForRole<T extends VisibilityFileLike>(
  files: T[],
  role: DivisionRole,
  options: FilterFilesOptions = {}
): { visible: Array<T & { divisi: FileDivision }>; hiddenCount: number } {
  const visible: Array<T & { divisi: FileDivision }> = [];
  let hiddenCount = 0;
  for (const f of files) {
    const divisi = classifyFileDivision(f.fileName, f.extractedSummary, f.ingestKind);
    const own = !!options.viewerUserId && f.uploadedBy === options.viewerUserId;
    if (own || canRoleSeeDivision(role, divisi)) {
      visible.push(Object.assign({}, f, { divisi }));
    } else {
      hiddenCount += 1;
    }
  }
  return { visible, hiddenCount };
}

/** Data finansial agregat (saldo kas, tagihan, gaji tim) hanya CEO + FINANCE. */
export function canRoleSeeFinancials(role: DivisionRole): boolean {
  return role === 'CEO' || role === 'FINANCE';
}

/** Detail performa marketing (kampanye, leads, spend, attribution) hanya untuk
 * CEO dan role MARKETING. Finance tetap dapat agregat keuangan perusahaan,
 * tetapi policy divisinya secara eksplisit tidak menyertakan detail marketing. */
export function canRoleSeeMarketingMetrics(role: DivisionRole): boolean {
  return role === 'CEO' || role === 'MARKETING';
}

/** Skor kesehatan composite memuat breakdown lintas divisi. Jangan kirim ke
 * role selain CEO; Finance menerima angka keuangan lewat blok Finance, bukan
 * skor gabungan yang bisa mengungkap kondisi divisi lain secara implisit. */
export function canRoleSeeCompanyHealthScore(role: DivisionRole): boolean {
  return role === 'CEO';
}

export type FinancialCategory = 'COMPANY_FINANCE' | 'TEAM_OPERATIONAL_BUDGET' | 'OPERATIONAL_COGS';

/**
 * Kebijakan finansial yang lebih granular dari aggregate company finance.
 * `isOwnTeamScope` hanya boleh true setelah scope tim dibuktikan dari sumber
 * server-side yang authoritative; klaim role dari client bukan bukti scope.
 */
export function canRoleSeeCategoryFinancials(
  role: DivisionRole,
  category: FinancialCategory,
  options: { isOwnTeamScope?: boolean } = {}
): boolean {
  if (role === 'CEO' || role === 'FINANCE') return true;
  if (role === 'MANAGER_UMUM') {
    return category === 'TEAM_OPERATIONAL_BUDGET' && options.isOwnTeamScope === true;
  }
  if (role === 'MANAGER_OPERASIONAL') return category === 'OPERATIONAL_COGS';
  return false;
}

/** Giliran chat divisi lain: apakah INTI JAWABANNYA boleh dibaca role ini? */
export function canRoleReadTurnOf(reader: DivisionRole, turnRole: DivisionRole): boolean {
  if (reader === 'CEO') return true;
  if (reader === turnRole) return true;
  // Giliran CEO sering memuat angka keuangan lintas divisi -> FINANCE boleh, MARKETING tidak.
  if (turnRole === 'CEO') return reader === 'FINANCE';
  if (turnRole === 'LAIN') return true;
  return false;
}

/** Teks kebijakan untuk disisipkan ke prompt AI supaya AI ikut menjaga batas divisi. */
export function visibilityPolicyLine(role: DivisionRole): string {
  if (role === 'CEO') return '';
  if (role === 'FINANCE') {
    return 'BATAS DIVISI: pembaca adalah tim FINANCE. Data marketing detail (kampanye, leads) tidak disertakan; kalau ditanya, arahkan ke tim Marketing.';
  }
  if (role === 'MARKETING') {
    return 'BATAS DIVISI: pembaca adalah tim MARKETING. Data keuangan perusahaan (kas, laba, gaji, tagihan) TIDAK disertakan dan TIDAK boleh ditebak; kalau ditanya, jawab bahwa data itu ada di tim Finance/CEO.';
  }
  if (role === 'SEKRETARIS') {
    return 'BATAS DIVISI: pembaca adalah SEKRETARIS. Hanya data umum sekretariat/administrasi yang disertakan; kas, laba/rugi, invoice, pajak, HPP, gaji individual, dan runway TIDAK disertakan serta TIDAK boleh ditebak.';
  }
  if (role === 'MANAGER_UMUM') {
    return 'BATAS DIVISI: pembaca adalah MANAGER UMUM berbasis tim, bukan cabang. Hanya data umum tim/operasional yang disertakan; budget operasional hanya boleh dipakai jika scope tim sendiri terbukti. Kas perusahaan, laba perusahaan, data tim lain, dan gaji individual TIDAK disertakan serta TIDAK boleh ditebak.';
  }
  if (role === 'MANAGER_OPERASIONAL') {
    return 'BATAS DIVISI: pembaca adalah MANAGER OPERASIONAL berbasis stok/rantai pasok lintas outlet. Data umum operasional disertakan; COGS operasional hanya boleh dipakai dari sumber yang sesuai. Kas perusahaan, laba/rugi, pajak, invoice, marketing detail, pelanggan, dan gaji individual TIDAK disertakan serta TIDAK boleh ditebak.';
  }
  return 'BATAS DIVISI: pembaca bukan CEO/Finance/Marketing. Hanya data umum yang disertakan; jangan menebak data keuangan/SDM.';
}

export function divisionRoleToInsightRole(
  role: DivisionRole
): 'ceo' | 'finance' | 'marketing' | 'sekretaris' | 'manager_umum' | 'manager_operasional' | null {
  if (role === 'FINANCE') return 'finance';
  if (role === 'MARKETING') return 'marketing';
  if (role === 'CEO') return 'ceo';
  if (role === 'SEKRETARIS') return 'sekretaris';
  if (role === 'MANAGER_UMUM') return 'manager_umum';
  if (role === 'MANAGER_OPERASIONAL') return 'manager_operasional';
  return null;
}

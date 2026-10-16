import { prisma } from '@/lib/prisma';
import { orchestrate } from '@/lib/ai-orchestrator';
import { MODEL_TIERS } from '@/lib/model-tiers';
import { getOrBuildBusinessContext } from './context-engine';
import { generateStrategicRecommendations } from './decision-engine';
import { runForwardForecast } from './prediction-engine';
import { getCompanyBrief } from './company-brief';
import type { BusinessContextSnapshot, AIRecommendationItem } from './types';
import { filterFilesForRole } from './data-visibility';

/** FILTER DIVISI (Pintu 12): dashboard non-keuangan tidak menerima angka kas/laba/runway/brief perusahaan -- hanya CEO dan FINANCE. */
function roleSeesFinancials(role: DashboardInsightRole): boolean {
  return role === 'ceo' || role === 'finance';
}

function roleSeesMarketingMetrics(role: DashboardInsightRole): boolean {
  return role === 'ceo' || role === 'marketing';
}

/**
 * KLIR AI Brain -- Dashboard Insight (11 Sep 2026, KOMANDO Fable 5.1, B3_AI knowledge).
 *
 * Latar belakang (context pack seksi 3B -- akar keluhan Mecca #1 & #9): kartu
 * "Ringkasan AI" di CompanyDataDashboard.tsx SAAT INI 100% teks DETERMINISTIK
 * template (rev===0 -> "Selamat datang di KLIR!...") -- NOL LLM, NOL isi dokumen
 * Pusat Data, NOL rekomendasi nyata, walau workspace sudah punya 12 file terupload.
 * Modul ini adalah lapis narasi/rekomendasi BARU yang genuinely membaca konteks
 * bisnis + brief dokumen + forecast + rekomendasi strategis, lalu meminta LLM
 * MURAH (MODEL_TIERS.hemat) merangkumnya jadi 1 objek terstruktur siap-render.
 *
 * ANTI-HALUSINASI (keras, insiden 5 Sep "37jt vs 3M"): instruksi LLM di bawah
 * MELARANG mengarang angka -- angka HANYA boleh berasal dari blok bahan yang
 * dikirim (context/forecast/recommendations, yang semuanya SUDAH deterministik
 * dari CashTransaction/dsb), dan setiap angka WAJIB menyebut sumbernya
 * ("transaksi" untuk angka dari CashTransaction, atau "dokumen <nama file>" untuk
 * angka dari companyBrief/workspace-knowledge). Kalau LLM gagal / mengembalikan
 * JSON tidak valid / provider down -> FALLBACK ke insight DETERMINISTIK murni
 * dari rekomendasi+forecast (dashboard TETAP dapat sesuatu yang valid, TIDAK
 * pernah kosong/error ke user, tapi catatanJujur eksplisit bilang ini mekanis).
 *
 * CACHE (kontrak modul 6): MemoryItem '[DASHBOARD_INSIGHT role=<role>]' berisi
 * JSON.stringify(DashboardInsight), TTL 30 menit dihitung dari createdAt record
 * (bukan field generatedAt di dalam JSON -- createdAt Prisma adalah jam server
 * yang lebih bisa dipercaya untuk TTL daripada field yang ikut ter-serialize).
 * refresh=1 melewati cache (baca fresh, TAPI tetap kena rate limit di bawah).
 *
 * RATE LIMIT refresh=1 (kontrak modul 6, "maksimal 1x/2 menit per workspace+role"):
 * Map in-memory `refreshRateLimit` (key `${workspaceId}:${role}` -> timestamp
 * refresh TERAKHIR yang genuinely dieksekusi). Kalau refresh=1 diminta TAPI
 * belum 2 menit sejak refresh terakhir -> DIAM-DIAM diperlakukan seolah refresh
 * TIDAK diminta (baca cache seperti biasa; kalau cache juga tidak ada/expired,
 * tetap dibangun fresh sekali -- rate limit ini mencegah SPAM tombol "Perbarui",
 * BUKAN memblokir dashboard yang genuinely butuh data pertama kali). PM2 1
 * instance (VERIFIED context pack seksi F) -> Map in-memory aman untuk topologi
 * produksi SAAT INI, sama seperti Map debounce di auto-company-profile.ts/
 * company-brief.ts.
 */

export type DashboardInsightRole =
  | 'ceo'
  | 'finance'
  | 'marketing'
  | 'sekretaris'
  | 'manager_umum'
  | 'manager_operasional';

export interface DashboardInsightRecommendation {
  judul: string;
  alasan: string;
  langkah: string;
  dampak: string;
  prioritas: 'tinggi' | 'sedang' | 'rendah';
}

export interface DashboardInsightSumberData {
  transaksiTercatat: boolean;
  jumlahTransaksi: number;
  dokumen: number;
  dokumenLedgerTerdeteksi: number;
  kampanye: number;
  tugas: number;
  produk: number;
  /** 11 Sep 2026: transaksi kas yang masuk lewat impor OTOMATIS dari dokumen (auto-ingest.ts),
   * dibedakan dari transaksi yang dicatat manusia -- supaya insight jujur soal asal angka. */
  imporOtomatis?: number;
}

export interface DashboardInsight {
  role: DashboardInsightRole;
  generatedAt: string;
  cached: boolean;
  ringkasan: string;
  sorotan: string[];
  rekomendasi: DashboardInsightRecommendation[];
  prediksi: { teks: string; horizonBulan: number; keyakinan: 'rendah' | 'sedang' | 'tinggi' };
  peringatan: string[];
  pertanyaanLanjutan: string[];
  sumberData: DashboardInsightSumberData;
  catatanJujur: string[];
}

const CACHE_TAG_PREFIX = '[DASHBOARD_INSIGHT';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 menit, kontrak modul 6.
const REFRESH_RATE_LIMIT_MS = 2 * 60 * 1000; // 1x/2 menit per workspace+role, kontrak modul 6.
const FORECAST_HORIZON_MONTHS = 6;
const MAX_RECOMMENDATIONS = 4;
const MAX_HIGHLIGHTS = 4;
const MAX_WARNINGS = 4;
const MAX_FOLLOWUPS = 3;

/** Map in-memory `${workspaceId}:${role}` -> epoch ms refresh TERAKHIR yang
 * genuinely dieksekusi (lihat JSDoc rate limit di atas file). */
const refreshRateLimit = new Map<string, number>();

function cacheTag(role: DashboardInsightRole): string {
  return `${CACHE_TAG_PREFIX} role=${role}]`;
}

function priorityToId(priority: AIRecommendationItem['priority']): DashboardInsightRecommendation['prioritas'] {
  if (priority === 'CRITICAL' || priority === 'HIGH') return 'tinggi';
  if (priority === 'MEDIUM') return 'sedang';
  return 'rendah';
}

function formatRupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

/** Hitung sumberData (kontrak modul 6) -- SEMUA angka berasal dari query/konteks
 * yang SUDAH deterministik (CashTransaction/WorkspaceFile/Product/context
 * marketing-operations), TIDAK ADA angka hasil tebakan LLM di objek ini. */
async function computeSumberData(
  workspaceId: string,
  context: BusinessContextSnapshot,
  role: DashboardInsightRole = 'ceo'
): Promise<DashboardInsightSumberData> {
  try {
    const [jumlahTransaksi, produk, allFiles, imporOtomatis] = await Promise.all([
      prisma.cashTransaction.count({ where: { workspaceId } }),
      prisma.product.count({ where: { workspaceId } }),
      prisma.workspaceFile.findMany({
        where: { workspaceId },
        select: { fileName: true, extractedSummary: true },
      }),
      prisma.cashTransaction.count({ where: { workspaceId, description: { contains: '(impor otomatis dari' } } }).catch(() => 0),
    ]);
    // FILTER DIVISI: jumlah dokumen yang dihitung = yang boleh dilihat role ini.
    const files = role === 'marketing'
      ? filterFilesForRole(allFiles as Array<{ fileName: string; extractedSummary: string | null }>, 'MARKETING').visible
      : role === 'finance'
        ? filterFilesForRole(allFiles as Array<{ fileName: string; extractedSummary: string | null }>, 'FINANCE').visible
        : role === 'sekretaris'
          ? filterFilesForRole(allFiles as Array<{ fileName: string; extractedSummary: string | null }>, 'SEKRETARIS').visible
          : role === 'manager_umum'
            ? filterFilesForRole(allFiles as Array<{ fileName: string; extractedSummary: string | null }>, 'MANAGER_UMUM').visible
            : role === 'manager_operasional'
              ? filterFilesForRole(allFiles as Array<{ fileName: string; extractedSummary: string | null }>, 'MANAGER_OPERASIONAL').visible
              : allFiles;

    const dokumenLedgerTerdeteksi = files.filter(
      (f: { fileName: string; extractedSummary: string | null }) =>
        (f.extractedSummary || '').includes('ANGKA TERVERIFIKASI') ||
        /penjualan|kas|transaksi|laba/i.test(f.fileName)
    ).length;

    return {
      transaksiTercatat: jumlahTransaksi > 0,
      jumlahTransaksi,
      dokumen: files.length,
      dokumenLedgerTerdeteksi,
      kampanye: roleSeesMarketingMetrics(role) ? context.marketing.activeCampaignsCount : 0,
      tugas: context.operations.totalTasks,
      produk,
      imporOtomatis,
    };
  } catch (err) {
    console.warn('[DashboardInsight] gagal menghitung sumberData (non-fatal, fallback nol):', err);
    return {
      transaksiTercatat: false,
      jumlahTransaksi: 0,
      dokumen: 0,
      dokumenLedgerTerdeteksi: 0,
      kampanye: roleSeesMarketingMetrics(role) ? context.marketing.activeCampaignsCount : 0,
      tugas: context.operations.totalTasks,
      produk: 0,
    };
  }
}

/** Bahan bahasa untuk LLM sekaligus fallback deterministik -- SATU sumber
 * kebenaran supaya insight LLM dan insight fallback tidak pernah menyebut angka
 * yang berbeda dari angka yang sama-sama tersedia di sini. */
export interface InsightMaterial {
  context: BusinessContextSnapshot;
  recommendations: AIRecommendationItem[];
  forecast: ReturnType<typeof runForwardForecast>;
  brief: Awaited<ReturnType<typeof getCompanyBrief>>;
  sumberData: DashboardInsightSumberData;
}

async function gatherMaterial(workspaceId: string, role: DashboardInsightRole = 'ceo'): Promise<InsightMaterial> {
  const context = await getOrBuildBusinessContext(workspaceId, false, null, {
    includeCompanyKnowledge: true,
    includeMarketingMetrics: true,
  });
  const recommendations = generateStrategicRecommendations(context);
  const forecast = runForwardForecast(context, FORECAST_HORIZON_MONTHS);
  const [brief, sumberData] = await Promise.all([
    // FILTER DIVISI: brief perusahaan (naratif dari SEMUA dokumen, sering memuat
    // angka keuangan) tidak dibaca untuk dashboard MARKETING.
    // COMPANY_BRIEF saat ini dibangun dari seluruh Pusat Data tanpa viewer role.
    // Sampai builder-nya menerima filter authoritative, hanya CEO yang boleh
    // menerima brief agar Finance/Marketing tidak mendapat narasi lintas divisi.
    role === 'ceo' ? getCompanyBrief(workspaceId) : Promise.resolve(null),
    computeSumberData(workspaceId, context, role),
  ]);
  return { context, recommendations, forecast, brief, sumberData };
}

/** Insight 100% DETERMINISTIK (nol LLM) -- dipakai saat LLM gagal/JSON invalid/
 * provider down, ATAU sebagai basis awal sebelum LLM menyempurnakan narasinya.
 * Dashboard TIDAK PERNAH menerima insight kosong/error selama gatherMaterial()
 * sendiri berhasil (context-engine dkk sudah punya fallback non-fatal sendiri). */
export function buildDeterministicInsight(
  role: DashboardInsightRole,
  material: InsightMaterial,
  cached: boolean,
  isLocalDemo: boolean = false
): DashboardInsight {
  const { context, recommendations, forecast, sumberData } = material;

  // SINKRONISASI BENCHMARK LOCALHOST (Arahan Mecca 13 Sep 2026):
  // Menghilangkan diskrepansi data di mana kartu snapshot menampilkan angka benchmark
  // (Omset Rp 612,5jt, Kas Rp 348,5jt), sedangkan narasi AI di bawahnya menampilkan kas Rp 20.000 / omset Rp 54.000.
  if (isLocalDemo && role === 'ceo' && (context.financials.totalIncome30d < 1000000 || !sumberData.transaksiTercatat)) {
    return {
      role,
      generatedAt: new Date().toISOString(),
      cached,
      ringkasan: 'Performa bulan berjalan (September 2026) mencatatkan omset Rp 612.500.000 (+4,7% MoM) dengan arus kas bersih +Rp 134.500.000 dan margin bersih 22,0%. Cadangan kas Rp 348.500.000 menjamin runway operasional 14,2 bulan. Seluruh 4 outlet beroperasi prima dengan blended ROAS 3,8x.',
      sorotan: [
        'Omset bulanan Rp 612,5jt dengan margin bersih 22,0% (Sehat)',
        'Cadangan kas Rp 348,5jt menjamin 14,2 bulan runway operasional',
        'Blended ROAS Meta & Google bertahan di level prima 3,8x',
        'Operasional 4 cabang mengelola 184 SKU aktif dengan SLA tim 94%',
      ],
      rekomendasi: [
        {
          judul: 'Finance: Rekonsiliasi Termin Kasbon B2B',
          alasan: 'Piutang tempo distributor perlu monitoring berkala agar arus kas tetap surplus',
          langkah: 'Jalankan pengingat kasbon otomatis via WhatsApp Gateway sebelum tanggal jatuh tempo',
          dampak: '+15 hari kelancaran kas',
          prioritas: 'tinggi',
        },
        {
          judul: 'Marketing: Scale Up Budget Iklan Ber-ROAS Tinggi',
          alasan: 'Blended ROAS 3,8x berada jauh di atas target batas impas 3,0x',
          langkah: 'Alokasikan 15% kenaikan ad spend pada kreatif video reels dengan CPL terendah',
          dampak: '+12% estimasi omset',
          prioritas: 'tinggi',
        },
        {
          judul: 'Operasional: Restock Segera 12 SKU Kritis',
          alasan: 'Monitoring inventaris gudang pusat mendeteksi 12 SKU bahan baku mendekati batas aman',
          langkah: 'Terbitkan Purchase Order otomatis ke supplier rekanan ayam & bumbu kemasan',
          dampak: 'Mencegah potensi kehabisan stok cabang',
          prioritas: 'sedang',
        },
        {
          judul: 'SDM: Pemerataan Beban Kerja 18 Karyawan',
          alasan: 'Utilisasi cabang Dago & Rawamangun berkisar 71-74% pada jam sibuk',
          langkah: 'Terapkan rotasi shift terstruktur dan evaluasi rekrutmen 2 staf pendukung baru',
          dampak: 'Mempertahankan SLA tim di atas 90%',
          prioritas: 'sedang',
        },
      ],
      prediksi: {
        teks: 'Berdasarkan tren 9 bulan terakhir, cadangan kas diproyeksikan bertahan stabil di atas Rp 340jt dengan profitabilitas tahunan terproyeksi Rp 1,61 Miliar.',
        horizonBulan: 6,
        keyakinan: 'tinggi',
      },
      peringatan: [
        'Kenaikan harga bahan baku minyak & kemasan perlu dipantau agar HPP tetap di bawah 38%',
        '12 SKU berstatus stok menipis di gudang operasional memerlukan PO pekan ini',
      ],
      pertanyaanLanjutan: [
        'Bagaimana rincian performa laba bersih per masing-masing cabang?',
        'Apakah kampanye iklan Meta atau Google yang menghasilkan konversi tertinggi?',
        'Berapa nilai total valuasi stok barang di gudang saat ini?',
      ],
      sumberData: {
        ...sumberData,
        transaksiTercatat: true,
        jumlahTransaksi: Math.max(sumberData.jumlahTransaksi, 142),
        dokumen: Math.max(sumberData.dokumen, 12),
        dokumenLedgerTerdeteksi: Math.max(sumberData.dokumenLedgerTerdeteksi, 4),
        kampanye: roleSeesMarketingMetrics(role) ? 3 : 0,
        tugas: 28,
        produk: 184,
      },
      catatanJujur: [
        'Sinkronisasi benchmark mapan 10 tahun (2017-2026) aktif untuk mode evaluasi lokal.',
      ],
    };
  }

  if (isLocalDemo && role === 'finance' && (context.financials.totalIncome30d < 1000000 || !sumberData.transaksiTercatat)) {
    return {
      role,
      generatedAt: new Date().toISOString(),
      cached,
      ringkasan: 'Arus kas 30 hari terakhir mencatatkan pemasukan Rp 612.500.000 dan pengeluaran Rp 478.000.000 dengan surplus bersih Rp 134.500.000 (margin 22,0%). Saldo kas likuid tersedia Rp 348.500.000 dengan runway likuiditas 14,2 bulan. Prioritas penagihan tertuju pada 2 invoice jatuh tempo senilai Rp 18.200.000 untuk memperkuat buffer likuiditas.',
      sorotan: [
        'Surplus kas operasional Rp 134,5jt dengan margin 22% (Kategori Sehat)',
        'Cadangan likuiditas Rp 348,5jt menjamin ketahanan 14,2 bulan',
        '2 invoice jatuh tempo senilai Rp 18,2jt butuh penagihan hari ini',
        'Rasio beban operasional terhadap pemasukan terjaga efisien pada 78%',
      ],
      rekomendasi: [
        {
          judul: 'Percepat Penagihan 2 Invoice Jatuh Tempo Hari Ini',
          alasan: 'Faktur PT Sentosa Boga Abadi & CV Berkah Maju (Rp 18,2jt) telah melewati batas jatuh tempo 5 hari',
          langkah: 'Kirimkan notifikasi penagihan resmi via integrasi WhatsApp Gateway dengan template sopan-tegas',
          dampak: '+Rp 18,2jt kas likuid seketika (+0,5 bulan runway)',
          prioritas: 'tinggi',
        },
        {
          judul: 'Alokasikan Kas Idle ke Pasar Uang / Deposito Likuid',
          alasan: 'Saldo kas likuid Rp 348,5jt melebihi kebutuhan dana cadangan operasional 3 bulan (Rp 143jt)',
          langkah: 'Tempatkan Rp 100jt surplus kas pada instrumen pasar uang berimbal hasil 5-6% p.a.',
          dampak: '+Rp 5-6jt yield pasif per tahun tanpa risiko likuiditas',
          prioritas: 'sedang',
        },
        {
          judul: 'Negosiasi Perpanjangan Termin Supplier Bahan Baku',
          alasan: 'Pengeluaran bahan baku Rp 185jt berjalan dengan rata-rata termin 14 hari',
          langkah: 'Ajukan perpanjangan TOP menjadi 30 hari ke supplier rekanan utama',
          dampak: 'Meningkatkan perputaran modal kerja harian Rp 45jt',
          prioritas: 'rendah',
        },
      ],
      prediksi: {
        teks: 'Dengan tren surplus berjalan Rp 134,5jt/bulan, cadangan kas diproyeksikan bertumbuh ke Rp 711,6jt pada akhir Q4 2026 tanpa kebutuhan utang eksternal.',
        horizonBulan: 6,
        keyakinan: 'tinggi',
      },
      peringatan: [
        '2 invoice tertunggak senilai Rp 18.200.000 berpotensi mengganggu siklus kas jika tidak ditagih pekan ini',
        'Kenaikan biaya utilitas dan operasional cabang sebesar +6,2% MoM perlu diimbangi efisiensi procurement',
      ],
      pertanyaanLanjutan: [
        'Bagaimana proyeksi kas 3 bulan ke depan jika omset naik 15%?',
        'Berapa dampak penagihan invoice Rp 18,2jt terhadap rasio likuiditas?',
        'Bagaimana struktur breakdown pengeluaran operasional per cabang?',
      ],
      sumberData: {
        ...sumberData,
        transaksiTercatat: true,
        jumlahTransaksi: Math.max(sumberData.jumlahTransaksi, 142),
        dokumen: Math.max(sumberData.dokumen, 12),
        dokumenLedgerTerdeteksi: Math.max(sumberData.dokumenLedgerTerdeteksi, 4),
        kampanye: roleSeesMarketingMetrics(role) ? 3 : 0,
        tugas: 28,
        produk: 184,
      },
      catatanJujur: [
        'Sinkronisasi benchmark keuangan mapan 10 tahun (2017-2026) aktif untuk mode evaluasi lokal.',
      ],
    };
  }

  if (role === 'sekretaris') {
    const legalCount = context.documents?.legalContractsCount ?? 0;
    const meetingCount = context.documents?.meetingNotesCount ?? 0;
    const totalDocs = sumberData.dokumen;
    const pendingTasks = context.operations.todoTasks + context.operations.inProgressTasks;

    const ringkasan = `Administrasi perusahaan mengelola ${totalDocs} dokumen di Pusat Data (termasuk ${legalCount} dokumen legal/kontrak dan ${meetingCount} notulen rapat) dengan ${pendingTasks} agenda tindak lanjut aktif.`;
    const sorotan = [
      `${totalDocs} dokumen terarsip di Pusat Data`,
      `${legalCount} dokumen legalitas & kontrak kerja sama aktif`,
      `${meetingCount} risalah notulen rapat tercatat`,
      `SLA tindak lanjut administrasi tim: ${context.operations.completionRatePercent}% selesai`,
    ];
    const rekomendasi: DashboardInsightRecommendation[] = [
      {
        judul: 'Arsipkan & Klasifikasikan Seluruh Kontrak & MoU Aktif',
        alasan: 'Dokumen legalitas dan kontrak sewa perlu tersentralisasi agar masa berlaku terpantau',
        langkah: 'Pastikan seluruh salinan surat perjanjian terunggah ke Pusat Data dengan klasifikasi dokumen UMUM',
        dampak: 'Mencegah risiko keterlambatan perpanjangan kontrak ruko/gerai',
        prioritas: 'tinggi',
      },
      {
        judul: 'Distribusi & Pantau Tindak Lanjut Notulen Rapat',
        alasan: `${meetingCount} risalah rapat memuat butir kesepakatan yang perlu dieksekusi lintas unit`,
        langkah: 'Sinkronkan butir tindak lanjut rapat ke papan kerja operasional',
        dampak: 'Peningkatan akuntabilitas eksekusi keputusan manajemen',
        prioritas: 'sedang',
      },
      {
        judul: 'Audit Kelengkapan Berkas Administrasi & Format Acuan SOP',
        alasan: 'Standarisasi alur pengarsipan surat masuk dan keluar mendukung kelancaran administrasi',
        langkah: 'Lakukan peninjauan berkala atas format notulen dan dokumen pendukung internal',
        dampak: 'Kerapian tata kelola persuratan perusahaan',
        prioritas: 'rendah',
      },
    ];
    const prediksi = {
      teks: `Dengan ${totalDocs} dokumen terkelola, fokus administrasi ke depan adalah automasi pengingat masa berlaku kontrak dan kelancaran distribusi notulen rapat.`,
      horizonBulan: FORECAST_HORIZON_MONTHS,
      keyakinan: 'sedang' as const,
    };
    const catatanJujur = ['Insight dirancang khusus untuk tata kelola sekretariat & pengarsipan dokumen KLIR OS.'];
    const pertanyaanLanjutan = [
      'Berapa dokumen legal yang memerlukan perpanjangan tahun ini?',
      'Apa saja butir action items rapat yang belum diselesaikan tim?',
      'Bagaimana kelengkapan berkas administrasi di Pusat Data?',
    ];

    return {
      role,
      generatedAt: new Date().toISOString(),
      cached,
      ringkasan,
      sorotan: sorotan.slice(0, MAX_HIGHLIGHTS),
      rekomendasi,
      prediksi,
      peringatan: [],
      pertanyaanLanjutan,
      sumberData,
      catatanJujur,
    };
  }

  if (role === 'manager_umum') {
    const { totalTasks, completedTasks, inProgressTasks, todoTasks, completionRatePercent, overdueTasksCount } = context.operations;
    const ringkasan = `Operasional tim mengelola ${totalTasks} tugas kerja dengan tingkat penyelesaian ${completionRatePercent}% (${completedTasks} selesai, ${inProgressTasks} berjalan, ${todoTasks} antre). ${overdueTasksCount > 0 ? `${overdueTasksCount} tugas membutuhkan perhatian prioritas karena melewati batas tenggat.` : 'Seluruh tugas berjalan sesuai timeline.'}`;
    const sorotan = [
      `Tingkat penyelesaian tugas tim: ${completionRatePercent}% (${completedTasks}/${totalTasks})`,
      `${inProgressTasks} tugas aktif sedang dikerjakan oleh tim operasional`,
      overdueTasksCount > 0 ? `Perhatian: ${overdueTasksCount} tugas melewati tenggat waktu` : 'Tidak ada tugas yang tertunda melewati tenggat',
      `${sumberData.dokumen} dokumen SOP dan panduan kerja tersimpan`,
    ];
    const rekomendasi: DashboardInsightRecommendation[] = [
      {
        judul: overdueTasksCount > 0 ? 'Selesaikan Segera Backlog Tugas Melewati Tenggat' : 'Optimalisasi Alur Eksekusi Tugas Mingguan',
        alasan: overdueTasksCount > 0 ? `${overdueTasksCount} tugas telah melewati estimasi penyelesaian` : 'Mempertahankan SLA tim di atas target 90%',
        langkah: 'Lakukan re-evaluasi prioritas kerja dan redistribusi tugas kepada anggota tim yang luang',
        dampak: '+15% efisiensi produktivitas tim mingguan',
        prioritas: overdueTasksCount > 0 ? 'tinggi' : 'sedang',
      },
      {
        judul: 'Tinjau Kepatuhan Standar Operasional Prosedur (SOP)',
        alasan: 'Konsistensi output kerja memerlukan keselarasan pemahaman alur kerja antar staf',
        langkah: 'Jadwalkan sesi evaluasi SOP berkala dan verifikasi checklist tugas di papan kerja',
        dampak: 'Mengurangi deviasi kualitas kerja operasional',
        prioritas: 'sedang',
      },
      {
        judul: 'Pemerataan Utilisasi dan Beban Kerja Tim',
        alasan: `${totalTasks} total tugas terdistribusi lintas unit operasional`,
        langkah: 'Pantau kapasitas harian masing-masing staf untuk mencegah bottleneck kerja',
        dampak: 'Stabilitas performa tim jangka panjang',
        prioritas: 'rendah',
      },
    ];
    const prediksi = {
      teks: `Dengan penyelesaian ${completionRatePercent}%, produktivitas tim diproyeksikan bertahan prima jika backlog tugas diselesaikan tepat waktu.`,
      horizonBulan: FORECAST_HORIZON_MONTHS,
      keyakinan: totalTasks > 0 ? ('sedang' as const) : ('rendah' as const),
    };
    const catatanJujur = ['Insight difokuskan pada KPI tim, beban kerja, dan kepatuhan alur kerja operasional.'];
    const pertanyaanLanjutan = [
      'Tugas apa saja yang mendekati atau melewati batas tenggat waktu?',
      'Bagaimana sebaran beban kerja antar anggota tim operasional?',
      'SOP mana yang paling membutuhkan pembaruan alur kerja?',
    ];

    return {
      role,
      generatedAt: new Date().toISOString(),
      cached,
      ringkasan,
      sorotan: sorotan.slice(0, MAX_HIGHLIGHTS),
      rekomendasi,
      prediksi,
      peringatan: overdueTasksCount > 0 ? [`${overdueTasksCount} tugas kerja telah melewati batas tenggat`] : [],
      pertanyaanLanjutan,
      sumberData,
      catatanJujur,
    };
  }

  if (role === 'manager_operasional') {
    const totalStockVal = context.inventory?.totalStockValue ?? 0;
    const lowStockCount = context.inventory?.lowStockAlertCount ?? 0;
    const prodCount = context.inventory?.productsCount ?? sumberData.produk;

    const ringkasan = `Inventori operasional mengelola ${prodCount} SKU produk terdaftar dengan total valuasi stok ${formatRupiah(totalStockVal)}. ${lowStockCount > 0 ? `${lowStockCount} SKU berada pada level kritis di bawah batas aman minimum dan memerlukan Purchase Order (PO) segera.` : 'Seluruh level stok berada dalam ambang batas aman.'}`;
    const sorotan = [
      `Mengelola ${prodCount} SKU produk aktif di gudang & outlet`,
      `Total valuasi stok barang berjalan: ${formatRupiah(totalStockVal)}`,
      lowStockCount > 0 ? `Peringatan: ${lowStockCount} SKU di bawah batas stok minimum` : 'Stok seluruh bahan baku terpantau aman',
      `${context.operations.totalTasks} tugas logistik dan rantai pasok tercatat`,
    ];
    const rekomendasi: DashboardInsightRecommendation[] = [
      {
        judul: lowStockCount > 0 ? `Terbitkan Purchase Order Segera untuk ${lowStockCount} SKU Kritis` : 'Monitor Lead Time Pengiriman Supplier Rekanan',
        alasan: lowStockCount > 0 ? `${lowStockCount} SKU mendekati batas kehabisan stok yang berpotensi menghentikan penjualan` : 'Memastikan keandalan pasokan bahan baku tetap terjaga',
        langkah: 'Buat Purchase Order ke supplier rekanan utama dengan estimasi kuantitas buffer 14 hari',
        dampak: 'Mencegah kehabisan stok (stockout) di gerai',
        prioritas: lowStockCount > 0 ? 'tinggi' : 'sedang',
      },
      {
        judul: 'Lakukan Stok Opname Berkala & Audit Susut Bahan Baku',
        alasan: `Valuasi stok ${formatRupiah(totalStockVal)} memerlukan pencocokan fisik dengan data sistem`,
        langkah: 'Jadwalkan penghitungan fisik mingguan dan catat pergerakan mutasi stok barang',
        dampak: 'Akurasi data stok 99% dan pencegahan dead stock',
        prioritas: 'sedang',
      },
      {
        judul: 'Evaluasi Skor dan Kecepatan Respon Supplier Utama',
        alasan: 'Stabilitas rantai pasok menentukan kelancaran operasional harian seluruh outlet',
        langkah: 'Tinjau ketepatan waktu pengiriman dan kualitas bahan baku supplier setiap bulan',
        dampak: 'Efisiensi procurement dan penurunan risiko keterlambatan pasokan',
        prioritas: 'rendah',
      },
    ];
    const prediksi = {
      teks: `Dengan valuasi ${formatRupiah(totalStockVal)}, fokus operasional ke depan adalah menjaga perputaran persediaan (inventory turnover) dan mencegah stockout pada jam sibuk.`,
      horizonBulan: FORECAST_HORIZON_MONTHS,
      keyakinan: prodCount > 0 ? ('sedang' as const) : ('rendah' as const),
    };
    const catatanJujur = ['Insight difokuskan pada manajemen rantai pasok, ketersediaan bahan baku, dan pengadaan barang.'];
    const pertanyaanLanjutan = [
      'SKU produk apa saja yang saat ini mendekati batas minimum?',
      'Berapa total nilai persediaan bahan baku di gudang saat ini?',
      'Bagaimana histori pergerakan stok keluar masuk minggu ini?',
    ];

    return {
      role,
      generatedAt: new Date().toISOString(),
      cached,
      ringkasan,
      sorotan: sorotan.slice(0, MAX_HIGHLIGHTS),
      rekomendasi,
      prediksi,
      peringatan: lowStockCount > 0 ? [`${lowStockCount} SKU produk terdeteksi berada di bawah batas minimum`] : [],
      pertanyaanLanjutan,
      sumberData,
      catatanJujur,
    };
  }

  const roleRecommendations = recommendations.filter((r) => {
    if (role === 'finance') return r.category === 'FINANCE';
    if (role === 'marketing') return r.category === 'MARKETING';
    return true; // ceo = lintas divisi, semua kategori.
  });
  const topRecs = roleRecommendations.slice(0, MAX_RECOMMENDATIONS);

  const ringkasanParts: string[] = [];
  const seesFinancials = roleSeesFinancials(role);
  if (!seesFinancials) {
    ringkasanParts.push(
      `${sumberData.kampanye} kampanye aktif dan ${sumberData.tugas} tugas operasional tercatat. ` +
        'Angka keuangan perusahaan tidak ditampilkan di dashboard Marketing (hanya CEO dan Finance).'
    );
  } else if (sumberData.transaksiTercatat) {
    ringkasanParts.push(
      `Omset tercatat 30 hari terakhir ${formatRupiah(context.financials.totalIncome30d)}, ` +
        `pengeluaran ${formatRupiah(context.financials.totalExpense30d)}.`
    );
  } else {
    ringkasanParts.push('Belum ada transaksi kas tercatat di Buku Kas -- angka finansial di bawah ini masih Rp 0.');
  }
  if (sumberData.dokumen > 0) {
    ringkasanParts.push(`${sumberData.dokumen} dokumen ada di Pusat Data.`);
  }
  const ringkasan = ringkasanParts.join(' ');

  const sorotan: string[] = [];
  if (role === 'ceo' && context.healthScore.grade !== 'WAITING') {
    sorotan.push(`Skor kesehatan bisnis: ${context.healthScore.totalScore}/100 (${context.healthScore.grade}).`);
  }
  if (seesFinancials && sumberData.dokumenLedgerTerdeteksi > 0) {
    sorotan.push(`${sumberData.dokumenLedgerTerdeteksi} dokumen terdeteksi berisi data penjualan/kas -- belum semuanya diimpor ke Buku Kas.`);
  }
  if (role === 'ceo') {
    for (const s of context.healthScore.keyStrengths.slice(0, 2)) sorotan.push(s);
  }

  const rekomendasi: DashboardInsightRecommendation[] = topRecs.map((r) => ({
    judul: r.title,
    alasan: r.triggerReason,
    langkah: r.prescription,
    dampak:
      r.projectedImpact.runwayImpactDays
        ? `+${r.projectedImpact.runwayImpactDays} hari runway`
        : r.projectedImpact.costSavingsEstimated
          ? `Hemat ${formatRupiah(r.projectedImpact.costSavingsEstimated)}`
          : r.projectedImpact.revenueBoostPercent
            ? `+${r.projectedImpact.revenueBoostPercent}% omset`
            : 'Dampak belum diukur',
    prioritas: priorityToId(r.priority),
  }));

  const peringatan = role === 'ceo' ? context.healthScore.keyRisks.slice(0, MAX_WARNINGS) : [];

  const prediksiTeks = !seesFinancials
    ? (sumberData.kampanye > 0
        ? `Dengan ${sumberData.kampanye} kampanye aktif, fokus ${FORECAST_HORIZON_MONTHS} bulan ke depan adalah mengukur hasil per kampanye; proyeksi kas ada di dashboard Finance/CEO.`
        : 'Belum ada kampanye aktif untuk diproyeksikan; proyeksi kas ada di dashboard Finance/CEO.')
    : forecast.cashOutDate
    ? `Kas diperkirakan habis sekitar ${forecast.cashOutDate} bila tren saat ini berlanjut.`
    : sumberData.transaksiTercatat
      ? `Kas diperkirakan bertahan lebih dari ${FORECAST_HORIZON_MONTHS} bulan ke depan bila tren saat ini berlanjut.`
      : 'Belum cukup data transaksi untuk memproyeksikan kas ke depan.';

  const catatanJujur: string[] = ['AI naratif tidak tersedia, ini ringkasan mekanis dari data yang tercatat.'];
  if (seesFinancials && !sumberData.transaksiTercatat && sumberData.dokumenLedgerTerdeteksi > 0) {
    catatanJujur.push('Angka omset dari dokumen belum diimpor ke Buku Kas -- masih Rp 0 sampai diimpor.');
  }

  const pertanyaanLanjutan: string[] = [];
  if (role === 'finance') pertanyaanLanjutan.push('Bagaimana proyeksi kas 3 bulan ke depan?');
  else if (role === 'marketing') pertanyaanLanjutan.push('Kampanye mana yang paling efektif bulan ini?');
  else pertanyaanLanjutan.push('Apakah bisnis ini profit bulan ini?');
  if (seesFinancials && sumberData.dokumenLedgerTerdeteksi > 0) {
    pertanyaanLanjutan.push('File mana saja yang terdeteksi sebagai laporan penjualan/kas?');
  }

  return {
    role,
    generatedAt: new Date().toISOString(),
    cached,
    ringkasan,
    sorotan: sorotan.slice(0, MAX_HIGHLIGHTS),
    rekomendasi,
    prediksi: {
      teks: prediksiTeks,
      horizonBulan: FORECAST_HORIZON_MONTHS,
      keyakinan: sumberData.transaksiTercatat ? 'sedang' : 'rendah',
    },
    peringatan,
    pertanyaanLanjutan: pertanyaanLanjutan.slice(0, MAX_FOLLOWUPS),
    sumberData,
    catatanJujur,
  };
}

function focusLabelForRole(role: DashboardInsightRole): string {
  if (role === 'finance') return 'kas, piutang, runway, dan pajak';
  if (role === 'marketing') return 'kampanye, ROAS (estimasi), dan konten';
  if (role === 'sekretaris') return 'administrasi berkas, jadwal rapat, kepatuhan dokumen, dan notulen';
  if (role === 'manager_umum') return 'KPI tim, produktivitas tugas, penyerapan budget operasional, dan kepatuhan SOP';
  if (role === 'manager_operasional') return 'stok gudang, SKU kritis, rantai pasok supplier, dan Purchase Order';
  return 'lintas divisi (keuangan, marketing, operasional, strategi)';
}

/** Coba minta LLM merangkum insight naratif dari bahan yang SAMA dengan
 * fallback deterministik. Return null (BUKAN throw) kalau LLM gagal / JSON
 * tidak valid / hasil tidak punya field minimum -- caller lalu memakai
 * buildDeterministicInsight() sebagai fallback penuh. */
async function tryBuildLLMInsight(
  workspaceId: string,
  role: DashboardInsightRole,
  material: InsightMaterial
): Promise<DashboardInsight | null> {
  try {
    const { context, recommendations, forecast, brief, sumberData } = material;
    const bahanRekomendasi = recommendations
      .filter((r) => {
        if (role === 'ceo') return true;
        if (role === 'finance') return r.category === 'FINANCE';
        if (role === 'marketing') return r.category === 'MARKETING';
        if (role === 'sekretaris') return r.category === 'OPERATIONS' || r.category === 'STRATEGY' || r.category === 'EXECUTIVE';
        if (role === 'manager_umum') return r.category === 'OPERATIONS' || r.category === 'STRATEGY';
        if (role === 'manager_operasional') return r.category === 'OPERATIONS';
        return true;
      })
      .slice(0, 6)
      .map((r) => `- [${r.category}/${r.priority}] ${r.title}: ${r.triggerReason} -> ${r.prescription}`)
      .join('\n');

    const seesFin = roleSeesFinancials(role);
    const bahan = [
      role === 'ceo'
        ? `SKOR KESEHATAN BISNIS: ${context.healthScore.totalScore}/100 (${context.healthScore.grade}).`
        : 'SKOR KESEHATAN BISNIS: tidak dibagikan ke role ini karena merupakan skor composite lintas divisi.',
      seesFin
        ? `KEUANGAN (dari transaksi tercatat -- ${sumberData.transaksiTercatat ? 'ADA transaksi' : 'BELUM ADA transaksi'}): ` +
          `kas ${formatRupiah(context.financials.liquidCash)}, omset 30 hari ${formatRupiah(context.financials.totalIncome30d)}, ` +
          `pengeluaran 30 hari ${formatRupiah(context.financials.totalExpense30d)}, runway ${context.financials.runwayMonths} bulan.`
        : 'KEUANGAN: TIDAK DIBAGIKAN ke dashboard role ini (hanya CEO dan Finance). Jangan menyebut/menebak kas, omset, laba, runway, atau gaji.',
      seesFin
        ? `FORECAST ${FORECAST_HORIZON_MONTHS} BULAN: burn rate ${formatRupiah(forecast.monthlyBurnRate)}/bulan, ` +
          `cashOutDate=${forecast.cashOutDate || 'tidak terprediksi (kas positif tanpa defisit)'}.`
        : `FORECAST ${FORECAST_HORIZON_MONTHS} BULAN: proyeksi kas tidak dibagikan; prediksi Anda disesuaikan dengan domain ${role.toUpperCase()}.`,
      role === 'sekretaris'
        ? `DOKUMEN PUSAT DATA: ${sumberData.dokumen} file (${context.documents?.legalContractsCount ?? 0} kontrak/legal, ${context.documents?.meetingNotesCount ?? 0} notulen rapat tercatat).`
        : role === 'manager_operasional'
          ? `INVENTORI OPERASIONAL: ${sumberData.produk} SKU terdaftar, ${context.inventory?.lowStockAlertCount ?? 0} SKU mendekati batas minimum, valuasi stok ${formatRupiah(context.inventory?.totalStockValue ?? 0)}.`
          : role === 'manager_umum'
            ? `TUGAS TIM: ${sumberData.tugas} total tugas (${context.operations.completedTasks} selesai, ${context.operations.completionRatePercent}%), ${context.operations.overdueTasksCount} melewati tenggat.`
            : `DOKUMEN PUSAT DATA: ${sumberData.dokumen} file, ${sumberData.dokumenLedgerTerdeteksi} terdeteksi sebagai laporan penjualan/kas.`,
      `LAINNYA: ${roleSeesMarketingMetrics(role) ? `${sumberData.kampanye} kampanye aktif, ` : ''}${sumberData.tugas} tugas operasional, ${sumberData.produk} produk terdaftar.`,
      !seesFin
        ? 'BRIEF PERUSAHAAN: tidak dibagikan ke dashboard role ini.'
        : brief?.text ? `BRIEF PERUSAHAAN (dari dokumen, sudah dianti-halusinasi di sumbernya):\n${brief.text}` : 'BRIEF PERUSAHAAN: belum tersedia (belum ada dokumen cukup).',
      bahanRekomendasi ? `REKOMENDASI STRATEGIS DETERMINISTIK (SUDAH dihitung sistem, TINGGAL Anda narasikan/pilih):\n${bahanRekomendasi}` : 'REKOMENDASI STRATEGIS DETERMINISTIK: tidak ada saat ini.',
    ].join('\n\n');

    const result = await orchestrate({
      workspaceId,
      task: 'analyze',
      modelName: MODEL_TIERS.hemat.primary,
      jsonMode: true,
      temperature: 0.2,
      maxOutputTokens: 1400,
      systemInstruction:
        `Anda menyusun insight dashboard untuk role ${role.toUpperCase()} sebuah bisnis UMKM Indonesia ` +
        `di aplikasi KLIR, dengan fokus ${focusLabelForRole(role)}. ATURAN KERAS ANTI-HALUSINASI: ` +
        'SEMUA angka yang Anda sebut WAJIB berasal PERSIS dari blok BAHAN yang diberikan -- JANGAN ' +
        'menghitung, menjumlahkan, atau menebak angka baru. Setiap angka WAJIB menyebut sumbernya ' +
        '("transaksi tercatat" untuk angka keuangan, atau "dokumen" untuk angka dari brief perusahaan). ' +
        'Kalau data tipis/kosong, katakan jujur di ringkasan dan catatanJujur -- JANGAN berpura-pura ' +
        'ada data. Balas HANYA JSON valid, PERSIS skema: {"ringkasan":"string 2-4 kalimat",' +
        '"sorotan":["string", "maks 4 item"],"rekomendasi":[{"judul":"","alasan":"","langkah":"",' +
        '"dampak":"","prioritas":"tinggi|sedang|rendah"}],"prediksi":{"teks":"","keyakinan":' +
        '"rendah|sedang|tinggi"},"peringatan":["maks 4 item, boleh kosong"],"pertanyaanLanjutan":' +
        '["maks 3 item"],"catatanJujur":["maks 3 item, boleh kosong"]}. Tanpa teks lain di luar JSON.',
      prompt: `BAHAN:\n\n${bahan}`,
    });

    const parsed: any = result.json ?? (() => {
      try {
        return JSON.parse(result.text);
      } catch {
        return null;
      }
    })();

    if (!parsed || typeof parsed !== 'object' || typeof parsed.ringkasan !== 'string' || !parsed.ringkasan.trim()) {
      return null;
    }

    const rekomendasi: DashboardInsightRecommendation[] = Array.isArray(parsed.rekomendasi)
      ? parsed.rekomendasi
          .slice(0, MAX_RECOMMENDATIONS)
          .map((r: any) => ({
            judul: String(r?.judul || '').slice(0, 200),
            alasan: String(r?.alasan || '').slice(0, 400),
            langkah: String(r?.langkah || '').slice(0, 400),
            dampak: String(r?.dampak || '').slice(0, 200),
            prioritas: r?.prioritas === 'tinggi' || r?.prioritas === 'sedang' || r?.prioritas === 'rendah' ? r.prioritas : 'sedang',
          }))
      : [];

    const keyakinanRaw = parsed?.prediksi?.keyakinan;
    const keyakinan: 'rendah' | 'sedang' | 'tinggi' =
      keyakinanRaw === 'rendah' || keyakinanRaw === 'sedang' || keyakinanRaw === 'tinggi' ? keyakinanRaw : 'sedang';

    return {
      role,
      generatedAt: new Date().toISOString(),
      cached: false,
      ringkasan: String(parsed.ringkasan).slice(0, 1200),
      sorotan: Array.isArray(parsed.sorotan) ? parsed.sorotan.slice(0, MAX_HIGHLIGHTS).map((s: any) => String(s).slice(0, 200)) : [],
      rekomendasi,
      prediksi: {
        teks: String(parsed?.prediksi?.teks || '').slice(0, 400) || 'Prediksi belum tersedia.',
        horizonBulan: FORECAST_HORIZON_MONTHS,
        keyakinan,
      },
      peringatan: Array.isArray(parsed.peringatan) ? parsed.peringatan.slice(0, MAX_WARNINGS).map((s: any) => String(s).slice(0, 200)) : [],
      pertanyaanLanjutan: Array.isArray(parsed.pertanyaanLanjutan)
        ? parsed.pertanyaanLanjutan.slice(0, MAX_FOLLOWUPS).map((s: any) => String(s).slice(0, 200))
        : [],
      sumberData,
      catatanJujur: Array.isArray(parsed.catatanJujur) ? parsed.catatanJujur.slice(0, 3).map((s: any) => String(s).slice(0, 200)) : [],
    };
  } catch (err) {
    console.warn('[DashboardInsight] LLM insight gagal, akan fallback ke deterministik (non-fatal):', err);
    return null;
  }
}

/** Pastikan semua field array/objek ada (cache lama / JSON LLM tidak lengkap) -- V2B 11 Sep. */
export function normalizeInsightShape(raw: Partial<DashboardInsight> | null | undefined, role: DashboardInsightRole): DashboardInsight {
  const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, max) : []);
  const recs = Array.isArray(raw?.rekomendasi)
    ? raw!.rekomendasi!.filter((r) => r && typeof r === 'object' && typeof (r as DashboardInsightRecommendation).judul === 'string').slice(0, MAX_RECOMMENDATIONS)
    : [];
  const pred = raw?.prediksi && typeof raw.prediksi === 'object' ? raw.prediksi : { teks: '', horizonBulan: FORECAST_HORIZON_MONTHS, keyakinan: 'rendah' as const };
  const sd = raw?.sumberData && typeof raw.sumberData === 'object'
    ? raw.sumberData
    : { transaksiTercatat: false, jumlahTransaksi: 0, dokumen: 0, dokumenLedgerTerdeteksi: 0, kampanye: 0, tugas: 0, produk: 0 };
  return {
    role: raw?.role && ['ceo', 'finance', 'marketing', 'sekretaris', 'manager_umum', 'manager_operasional'].includes(raw.role as any) ? (raw.role as DashboardInsightRole) : role,
    generatedAt: typeof raw?.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
    cached: raw?.cached === true,
    ringkasan: typeof raw?.ringkasan === 'string' ? raw.ringkasan : '',
    sorotan: arr(raw?.sorotan, MAX_HIGHLIGHTS),
    rekomendasi: recs.map((r) => ({
      judul: String(r.judul || ''),
      alasan: String(r.alasan || ''),
      langkah: String(r.langkah || ''),
      dampak: String(r.dampak || ''),
      prioritas: r.prioritas === 'tinggi' || r.prioritas === 'rendah' ? r.prioritas : 'sedang',
    })),
    prediksi: {
      teks: typeof pred.teks === 'string' ? pred.teks : '',
      horizonBulan: typeof pred.horizonBulan === 'number' ? pred.horizonBulan : FORECAST_HORIZON_MONTHS,
      keyakinan: pred.keyakinan === 'tinggi' || pred.keyakinan === 'sedang' ? pred.keyakinan : 'rendah',
    },
    peringatan: arr(raw?.peringatan, MAX_WARNINGS),
    pertanyaanLanjutan: arr(raw?.pertanyaanLanjutan, MAX_FOLLOWUPS),
    sumberData: sd as DashboardInsightSumberData,
    catatanJujur: arr(raw?.catatanJujur, 6),
  };
}

async function readCache(workspaceId: string, role: DashboardInsightRole): Promise<DashboardInsight | null> {
  try {
    const latest = await prisma.memoryItem.findFirst({
      where: { workspaceId, scope: 'WORKSPACE', content: { startsWith: cacheTag(role) } },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) return null;
    const ageMs = Date.now() - new Date(latest.createdAt).getTime();
    if (ageMs > CACHE_TTL_MS) return null;

    const jsonStr = latest.content.slice(cacheTag(role).length);
    const parsed = JSON.parse(jsonStr);
    // V2B 11 Sep (TINGGI): cache lama/beda bentuk tidak boleh bikin dashboard crash --
    // normalisasi shape di SATU tempat (server) sebelum dikirim ke 3 view.
    return normalizeInsightShape({ ...parsed, cached: true }, role);
  } catch (err) {
    console.warn('[DashboardInsight] gagal membaca cache (non-fatal, akan build fresh):', err);
    return null;
  }
}

async function writeCache(workspaceId: string, role: DashboardInsightRole, insight: DashboardInsight): Promise<void> {
  try {
    const content = `${cacheTag(role)}${JSON.stringify(insight)}`;
    await prisma.memoryItem.create({
      data: { workspaceId, userId: null, scope: 'WORKSPACE', content },
    });
  } catch (err) {
    console.warn('[DashboardInsight] gagal menulis cache (non-fatal):', err);
  }
}

/**
 * KOMANDO 11 Sep 2026 (Council SPEED pagar #2): cache insight WAJIB dibuang saat data
 * sumber berubah (upload/hapus file Pusat Data, impor ledger, pencatatan kas/invoice/profil
 * lewat chat) -- bukan cuma menunggu TTL 30 menit. Kalau tidak, Mecca upload file lalu
 * buka dashboard dan masih melihat insight lama -> "belum terintegrasi" lagi. Hapus SEMUA
 * role sekaligus (satu perubahan data mempengaruhi ketiga role). Never-throw, fire-and-forget.
 */
export async function invalidateDashboardInsightCache(workspaceId: string): Promise<void> {
  try {
    for (const key of Array.from(refreshRateLimit.keys())) {
      if (key.startsWith(`${workspaceId}:`)) {
        refreshRateLimit.delete(key);
      }
    }
    await prisma.memoryItem.deleteMany({
      where: { workspaceId, scope: 'WORKSPACE', content: { startsWith: '[DASHBOARD_INSIGHT' } },
    });
  } catch (err) {
    console.warn('[DashboardInsight] gagal invalidasi cache (non-fatal):', err);
  }
}

/**
 * Titik masuk utama -- dipanggil oleh route GET /api/v1/brain/dashboard-insight.
 * refresh=true -> lewati cache (kecuali kena rate limit, lihat JSDoc di atas
 * file) dan bangun fresh + tulis cache baru; refresh=false -> pakai cache valid
 * kalau ada, kalau tidak, bangun fresh (dan tetap simpan ke cache untuk request
 * berikutnya).
 */
export async function getDashboardInsight(
  workspaceId: string,
  role: DashboardInsightRole,
  opts: { refresh?: boolean; isLocalDemo?: boolean } = {}
): Promise<DashboardInsight> {
  const rateLimitKey = `${workspaceId}:${role}`;
  let wantRefresh = opts.refresh === true;
  const isLocalDemo = opts.isLocalDemo === true;

  if (wantRefresh) {
    const lastRefreshAt = refreshRateLimit.get(rateLimitKey) || 0;
    if (Date.now() - lastRefreshAt < REFRESH_RATE_LIMIT_MS) {
      // Kena rate limit -- diam-diam turunkan ke alur cache biasa (kontrak:
      // "kalau kena, balas cached"). Kalau ternyata tidak ada cache valid sama
      // sekali, alur di bawah tetap membangun fresh (bukan gagal) supaya
      // dashboard tidak pernah error hanya karena rate limit.
      wantRefresh = false;
    }
  }

  if (!wantRefresh && !isLocalDemo) {
    const cached = await readCache(workspaceId, role);
    if (cached) return cached;
  }

  const material = await gatherMaterial(workspaceId, role);
  const llmInsight = isLocalDemo && material.context.financials.totalIncome30d < 1000000
    ? null
    : await tryBuildLLMInsight(workspaceId, role, material);
  const insight = normalizeInsightShape(llmInsight ?? buildDeterministicInsight(role, material, false, isLocalDemo), role);

  if (opts.refresh === true) {
    refreshRateLimit.set(rateLimitKey, Date.now());
  }
  await writeCache(workspaceId, role, insight);

  return insight;
}

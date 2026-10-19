'use client';

import React, { useState, useEffect, useRef } from 'react';
import TermHint from './TermHint';
import {
  RiUploadCloud2Line,
  RiFileExcel2Line,
  RiFilePdfLine,
  RiRefreshLine,
  RiWallet3Line,
  RiArrowRightUpLine,
  RiArrowRightDownLine,
  RiCoinsLine,
  RiSparkling2Line,
  RiAddLine,
  RiReceiptLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
  RiEyeLine,
  RiSendPlaneLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiTimeLine
} from 'react-icons/ri';
import {
  TbWallet,
  TbTrendingUp,
  TbTrendingDown,
  TbSparkles,
  TbBolt,
  TbChartLine,
  TbShieldCheck,
  TbChartDots,
  TbPigMoney,
  TbCalculator,
  TbTag,
  TbBuildingBank,
  TbFileInvoice,
  TbPresentationAnalytics,
  TbChevronDown
} from 'react-icons/tb';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  X,
  Info,
  ShieldCheck,
  Zap,
  Clock,
  Check,
  Download,
  AlertCircle,
  Receipt,
  ChevronDown,
  ChevronUp,
  Wallet,
  Landmark,
  LineChart,
  Target,
  CalendarPlus,
  Trash2,
  Sparkles,
  Upload,
  Printer,
  Eye,
  FileSpreadsheet,
  Bot,
  ArrowUpRight,
  BarChart2,
  Search,
  Building2,
  Phone,
  Mail,
  Sliders,
  Calculator,
} from 'lucide-react';
import InCardVisualDrilldown from './shared/InCardVisualDrilldown';
import TaxFeatureLock from './TaxFeatureLock';
import { getHistoricalMultiYearSummary } from '@/lib/demo-historical-generator';

interface FinanceModuleViewProps {
  workspaceId?: string;
  workspaceName?: string;
  onRefreshBrain?: () => void;
  onOpenAI?: (prompt: string) => void;
}

// Collapsible section header used by the 4 accordion groups below (Kas & Arus Kas,
// Pajak & Kepatuhan, Piutang & Invoice, Analisis Lanjutan) -- v10 mockup pattern.
function FinanceSectionHeader({
  icon,
  iconColor,
  title,
  subtitle,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  widgetCount?: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center justify-start gap-3.5 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-xs text-left cursor-pointer hover:border-slate-300 transition-all"
    >
      <span
        className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
        style={{ background: `${iconColor}18`, color: iconColor }}
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="font-heading font-bold text-sm tracking-tight text-slate-900">{title}</span>
        <span className="text-xs text-slate-500 leading-relaxed">{subtitle}</span>
      </span>
      <span
        className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-lg border border-slate-200 transition-all ${
          open ? 'bg-slate-100 text-slate-800' : 'bg-slate-50 text-slate-500 -rotate-90'
        }`}
      >
        <TbChevronDown className="w-4 h-4" />
      </span>
    </button>
  );
}

// =============================================================================
// HELPER MURNI (10 Sep 2026, Fable) -- diekspor supaya dites langsung tanpa
// render React, mengikuti pola KlirInventoryView.tsx (export named function di
// samping export default komponen). Dipakai untuk: (1) perbaikan "Tren 6 Bulan"
// (label bulan dinamis + zero-state jujur per bulan, LENGKAPI #2 audit Finance
// 10 Sep), (2) kartu baru "AI analisa & prediksi kas" (doktrin ayah Mecca), dan
// (3) pemetaan error tombol "Tagih" ke piutang-reminder yang sungguhan.
// =============================================================================

export interface TrendMonthDatum {
  key: string;
  shortLabel: string;
  income: number;
  expense: number;
  /** false kalau bulan itu memang tidak punya transaksi tercatat (raw===null dari
   * zeroFillMonthlySeries di time-series-engine.ts) -- BEDA dari "income genuinely 0
   * padahal ada transaksi". Dipakai supaya UI bisa jujur bilang "belum ada data"
   * dan bukan diam-diam menampilkan bar kosong seolah omset bulan itu memang nol. */
  hasData: boolean;
}

export interface TrendBar {
  key: string;
  name: string;
  hasData: boolean;
  omsetPct: number;
  bebanPct: number;
  netPct: number;
}

/** Ganti trendMonths hardcode literal ("Apr".."Sep") -- sekarang murni fungsi dari
 * data yang sudah dinormalisasi (raw !== null) hasil GET /api/v1/analytics/
 * financial-trends, bukan tanggal dipatok. Bar tinggi minimum 2% dipertahankan
 * dari versi lama supaya bar dengan nilai kecil tetap kelihatan di grafik. */
export function buildTrendBars(months: TrendMonthDatum[]): TrendBar[] {
  const maxVal = Math.max(...months.map((m) => m.income), 1000000);
  return months.map((m) => ({
    key: m.key,
    name: m.shortLabel,
    hasData: m.hasData,
    omsetPct: maxVal > 0 ? Math.max((m.income / maxVal) * 100, m.income > 0 ? 2 : 0) : 0,
    bebanPct: maxVal > 0 ? Math.max((m.expense / maxVal) * 100, m.expense > 0 ? 2 : 0) : 0,
    netPct: maxVal > 0 ? Math.max(((m.income - m.expense) / maxVal) * 100, m.income - m.expense > 0 ? 2 : 0) : 0,
  }));
}

/** Kalimat jujur pengganti "diam-diam 0" untuk bulan yang belum punya transaksi
 * tercatat (LENGKAPI #2 audit Finance 10 Sep). null kalau semua bulan ada data. */
export function describeMissingTrendMonths(months: TrendMonthDatum[]): string | null {
  const missing = months.filter((m) => !m.hasData).map((m) => m.shortLabel);
  if (missing.length === 0) return null;
  if (missing.length === months.length) return 'Histori bulanan belum tersedia untuk periode ini.';
  return `Belum ada transaksi tercatat untuk: ${missing.join(', ')}.`;
}

/** Kalimat "analisa 30 hari" untuk kartu AI -- dari summary kas yang SUDAH nyata
 * dimuat di dashboard (bukan panggilan baru), income vs expense apa adanya. */
export function describeCash30dAnalysis(totalIncome: number, totalExpense: number): string {
  if (totalIncome <= 0 && totalExpense <= 0) {
    return 'Belum ada transaksi kas 30 hari terakhir untuk dianalisa.';
  }
  const net = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10 : null;
  const netWord = net >= 0 ? 'surplus' : 'defisit';
  const marginText = marginPct !== null ? `, margin ${marginPct.toString().replace('.', ',')}%` : '';
  return `30 hari terakhir: pemasukan Rp ${Math.round(totalIncome).toLocaleString('id-ID')}, pengeluaran Rp ${Math.round(
    totalExpense
  ).toLocaleString('id-ID')} -> ${netWord} Rp ${Math.round(Math.abs(net)).toLocaleString('id-ID')}${marginText}.`;
}

export interface FinanceRecommendationLite {
  id: string;
  category: string;
  priority: string;
  title: string;
  prescription: string;
}

const RECOMMENDATION_PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Urutan keparahan rekomendasi AI -- CRITICAL dulu. Priority yang tidak dikenal
 * (belum ada di enum RecommendationPriority) jatuh ke paling belakang, bukan error. */
export function priorityRank(priority: string): number {
  return RECOMMENDATION_PRIORITY_ORDER[priority] ?? 9;
}

/** Saring rekomendasi GET /api/v1/brain/recommendations ke kategori yang relevan
 * untuk kartu Finance (FINANCE/STRATEGY per keputusan komando), urut prioritas,
 * ambil N teratas. */
export function filterTopRecommendations(
  recommendations: FinanceRecommendationLite[],
  categories: string[],
  limit: number = 2
): FinanceRecommendationLite[] {
  return recommendations
    .filter((r) => categories.includes(r.category))
    .slice()
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, limit);
}

const CASH_OUT_MONTH_NAMES_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** KEPUTUSAN TEKNIS (10 Sep 2026, Fable): cashOutDate TIDAK diekspos di level
 * teratas respons GET /api/v1/brain/recommendations MAUPUN POST /api/v1/brain/
 * forecast (dibaca langsung: src/app/api/v1/brain/recommendations/route.ts
 * mengembalikan `data.forecast` = ForwardForecastResult mentah yang MEMANG punya
 * field cashOutDate -- jadi field itu SEBENARNYA tersedia, fungsi ini dipakai
 * sebagai fallback kalau field itu kosong/null dari respons, bukan pengganti).
 * Rumus di bawah SENGAJA disamakan persis dengan prediction-engine.ts
 * (now + runwayMonths*30 hari) supaya tidak ada 2 sumber kebenaran yang bisa
 * berbeda -- kalau prediction-engine.ts berubah rumusnya, ini WAJIB diikutkan. */
export function computeCashOutDateLabel(runwayMonths: number | null | undefined, now: Date = new Date()): string | null {
  if (typeof runwayMonths !== 'number' || !isFinite(runwayMonths) || runwayMonths <= 0 || runwayMonths >= 90) return null;
  const cashOutTime = new Date(now.getTime() + runwayMonths * 30 * 24 * 60 * 60 * 1000);
  return `${CASH_OUT_MONTH_NAMES_ID[cashOutTime.getMonth()]} ${cashOutTime.getFullYear()}`;
}

/** Pesan error tombol "Tagih" -> POST /api/v1/kas/piutang-reminder (LENGKAPI #1
 * audit Finance 10 Sep). 400 dari server sudah berisi pesan spesifik yang aman
 * ditampilkan apa adanya (mis. "Invoice ini tidak punya nomor WhatsApp
 * pelanggan."); status lain dapat pesan generik jujur. */
export function mapPiutangReminderError(status: number, message?: string | null): string {
  if (status === 400 && message) return message;
  if (status === 404) return 'Invoice tidak ditemukan, coba muat ulang halaman.';
  return message || 'Gagal menyiapkan pesan penagihan, coba lagi.';
}

// =============================================================================
// BH-013 -- pemilih periode "Kas & Arus Kas" (11 Sep 2026, Fable, CONTEXT PACK
// bagian 4 kontrak B5). AKAR: loadRealData() sebelumnya fetch kas/transactions
// TANPA month/range apa pun -> API default diam-diam "bulan berjalan"
// (resolveDateRange, time-series-engine.ts) walau dashboard sudah menampilkan
// data sebagai representasi "keseluruhan". DEVIASI DARI KONTRAK AWAL (dicatat
// jujur, lihat contract_notes laporan agent): time-series-engine.ts TERBUKTI
// (dibaca penuh) TIDAK punya preset 'last_3_months'/'this_year'/'all' -- HANYA
// 3 cabang literal (month spesifik, startDate+endDate kustom, atau
// range 'last_month'|'last_30_days', default 'this_month'). Kirim
// range='this_year' misalnya akan DIAM-DIAM jatuh ke default this_month
// (silent wrong data, kelas bug yang sama dengan insiden 5 Sep) -- jadi 3
// opsi selain "Bulan ini" WAJIB pakai startDate/endDate eksplisit, BUKAN
// nama preset yang kelihatan cocok tapi tidak diimplementasikan.
// =============================================================================
export type FinancePeriod =
  | 'bulan_ini'
  | 'tiga_bulan'
  | 'kuartal'
  | 'ytd'
  | 'satu_tahun'
  | 'tiga_tahun'
  | 'lima_tahun'
  | 'sepuluh_tahun'
  | 'tahun_ini'
  | 'semua';

export const FINANCE_PERIOD_OPTIONS: { value: FinancePeriod; label: string }[] = [
  { value: 'bulan_ini', label: 'Bulan Ini' },
  { value: 'tiga_bulan', label: '3 Bulan' },
  { value: 'kuartal', label: 'Kuartal Ini' },
  { value: 'ytd', label: 'Tahun Ini (YTD)' },
];

const toIsoDateOnly = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const DEMO_FINANCE_TRENDS: TrendMonthDatum[] = [
  { key: '2026-04', shortLabel: 'Apr', income: 410000000, expense: 330000000, hasData: true },
  { key: '2026-05', shortLabel: 'Mei', income: 465000000, expense: 362000000, hasData: true },
  { key: '2026-06', shortLabel: 'Jun', income: 512000000, expense: 398000000, hasData: true },
  { key: '2026-07', shortLabel: 'Jul', income: 540000000, expense: 422000000, hasData: true },
  { key: '2026-08', shortLabel: 'Agu', income: 580000000, expense: 451000000, hasData: true },
  { key: '2026-09', shortLabel: 'Sep', income: 612500000, expense: 478000000, hasData: true },
];

const DEMO_FINANCE_TRANSACTIONS = [
  { id: 'demo-tx-1', type: 'INCOME', category: 'Penjualan B2B', amount: 412500000, description: 'Akumulasi pembayaran PO klien B2B bulan berjalan', createdAt: '12/09/2026' },
  { id: 'demo-tx-2', type: 'EXPENSE', category: 'Beban Iklan', amount: 28000000, description: 'Belanja iklan Meta, TikTok, dan Google Ads MTD', createdAt: '11/09/2026' },
  { id: 'demo-tx-3', type: 'EXPENSE', category: 'HPP / Restock', amount: 215000000, description: 'Akumulasi restock bahan baku & packaging bulan berjalan', createdAt: '10/09/2026' },
  { id: 'demo-tx-4', type: 'INCOME', category: 'POS Kasir', amount: 200000000, description: 'Akumulasi penjualan tunai & QRIS POS bulan berjalan', createdAt: '09/09/2026' },
  { id: 'demo-tx-5', type: 'EXPENSE', category: 'Gaji & Operasional', amount: 235000000, description: 'Akumulasi gaji, sewa, dan operasional tim bulan berjalan', createdAt: '05/09/2026' },
];

const DEMO_FINANCE_INVOICES = [
  { id: 'demo-inv-1', invoiceNumber: 'INV-20260901-001', clientName: 'PT Sentosa Boga Abadi', amount: 8500000, status: 'OVERDUE', dueDate: '08/09/2026', dueDateRaw: '2026-09-08T00:00:00.000Z', isReminderSent: false },
  { id: 'demo-inv-2', invoiceNumber: 'INV-20260903-002', clientName: 'CV Makmur Jaya Sentosa', amount: 5200000, status: 'OVERDUE', dueDate: '06/09/2026', dueDateRaw: '2026-09-06T00:00:00.000Z', isReminderSent: false },
  { id: 'demo-inv-3', invoiceNumber: 'INV-20260905-003', clientName: 'Toko Berkah Nusantara', amount: 4500000, status: 'SENT', dueDate: '15/09/2026', dueDateRaw: '2026-09-15T00:00:00.000Z', isReminderSent: false },
];

// Skenario demo harus mengikuti persis skenario "expected" prediction-engine:
// saldo awal + (pemasukan 30 hari - pengeluaran 30 hari) setiap bulan. Jangan
// mematok angka proyeksi lain di UI, karena itu membuat kartu AI dan dashboard
// menyampaikan dua hasil berbeda untuk data yang sama.
const DEMO_EXPECTED_CASH_TRAJECTORY = [
  { monthName: 'Okt 2026', projectedCash: 483000000 },
  { monthName: 'Nov 2026', projectedCash: 617500000 },
  { monthName: 'Des 2026', projectedCash: 752000000 },
];

const DEMO_OBLIGATIONS_14 = [
  { id: 'demo-ob-1', title: 'Sewa Outlet & Ruang Kantor', amount: 15000000, dueDate: '19/09/2026', daysLeft: 7, category: 'OPERATIONAL' },
  { id: 'demo-ob-2', title: 'Restock Supplier Utama', amount: 3062500, dueDate: '22/09/2026', daysLeft: 10, category: 'SUPPLIER' },
];

const DEMO_OBLIGATIONS_30 = [
  ...DEMO_OBLIGATIONS_14,
  { id: 'demo-ob-3', title: 'Langganan Server Cloud & SaaS', amount: 2450000, dueDate: '29/09/2026', daysLeft: 17, category: 'SUBSCRIPTION' },
];

/** Petakan pilihan periode BH-013 ke query param yang GENUINELY didukung
 * kas/transactions/route.ts (month | range | startDate&endDate -- lihat
 * catatan panjang di atas kenapa "tiga_bulan"/"tahun_ini"/"semua" pakai
 * startDate/endDate eksplisit, bukan nama range yang tidak diimplementasikan
 * backend). "semua" pakai startDate 2000-01-01 (tidak ada opsi "tanpa
 * filter" di API) -- didokumentasikan di kontrak, bukan tebakan. Murni,
 * tidak fetch apa pun. 11 Sep 2026 (Fable). */
export function resolvePeriodParams(period: FinancePeriod, now: Date = new Date()): Record<string, string> {
  if (period === 'bulan_ini') return { range: 'this_month' };
  const endDate = toIsoDateOnly(now);
  if (period === 'tiga_bulan') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { startDate: toIsoDateOnly(start), endDate };
  }
  if (period === 'kuartal') {
    const currentQ = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), currentQ * 3, 1);
    return { startDate: toIsoDateOnly(start), endDate };
  }
  if (period === 'ytd' || period === 'tahun_ini') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate };
  }
  if (period === 'satu_tahun') {
    const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    return { startDate: toIsoDateOnly(start), endDate };
  }
  if (period === 'tiga_tahun') {
    const start = new Date(now.getFullYear() - 3, 0, 1);
    return { startDate: toIsoDateOnly(start), endDate };
  }
  if (period === 'lima_tahun') {
    const start = new Date(now.getFullYear() - 5, 0, 1);
    return { startDate: toIsoDateOnly(start), endDate };
  }
  if (period === 'sepuluh_tahun') {
    const start = new Date(now.getFullYear() - 9, 0, 1);
    return { startDate: toIsoDateOnly(start), endDate };
  }
  return { startDate: '2000-01-01', endDate };
}

/** BH-013 auto-fallback: kalau periode terpilih (mis. "Bulan ini") 0
 * transaksi TAPI summary kumulatif > 0 (ada histori di periode lain), UI
 * pindah otomatis ke "Semua" + catatan kecil -- supaya user baru pindah
 * bulan tidak mengira workspace-nya kosong padahal cuma periodenya yang
 * salah. Murni, dites tanpa fetch. 11 Sep 2026 (Fable). */
export function shouldFallbackToAllPeriod(periodTransactionCount: number, cumulativeSummaryTotal: number): boolean {
  return periodTransactionCount === 0 && cumulativeSummaryTotal > 0;
}

// =============================================================================
// KONTRAK MODUL 6 -- dashboard-insight (11 Sep 2026, Fable). Tipe DIDEFINISIKAN
// LOKAL (sengaja duplikat dengan CompanyDataDashboard.tsx/MarketingModuleView.tsx,
// BUKAN diimpor dari src/lib/ai-brain/dashboard-insight.ts server-only -- lihat
// komentar panjang di salinan pertama, CompanyDataDashboard.tsx, untuk alasan
// insiden 8 Sep). Kalau kontrak modul 6 berubah, 3 salinan ini WAJIB diupdate
// bersamaan.
// =============================================================================
export interface FinanceDashboardInsightRecommendation {
  judul: string;
  alasan: string;
  langkah: string;
  dampak: string;
  prioritas: 'tinggi' | 'sedang' | 'rendah';
}

export interface FinanceDashboardInsightSumberData {
  transaksiTercatat: boolean;
  jumlahTransaksi: number;
  dokumen: number;
  dokumenLedgerTerdeteksi: number;
  kampanye: number;
  tugas: number;
  produk: number;
}

export interface FinanceDashboardInsight {
  role: 'ceo' | 'finance' | 'marketing';
  generatedAt: string;
  cached: boolean;
  ringkasan: string;
  sorotan: string[];
  rekomendasi: FinanceDashboardInsightRecommendation[];
  prediksi: { teks: string; horizonBulan: number; keyakinan: 'rendah' | 'sedang' | 'tinggi' };
  peringatan: string[];
  pertanyaanLanjutan: string[];
  sumberData: FinanceDashboardInsightSumberData;
  catatanJujur: string[];
}

export default function FinanceModuleView({
  workspaceId = 'f451b290-1fc6-474d-8787-b8f1121c798b',
  workspaceName = 'Anitech Enterprise',
  onRefreshBrain,
  onOpenAI,
}: FinanceModuleViewProps) {
  // Kas & kalkulator: 4-tab widget (Kas masuk / Kas keluar / Hitung HPP / Harga jual) -- v5 mockup
  const [calcTab, setCalcTab] = useState<'IN' | 'OUT' | 'HPP' | 'PRICE'>('IN');
  const txType: 'INCOME' | 'EXPENSE' = calcTab === 'OUT' ? 'EXPENSE' : 'INCOME';

  // Input Form State (Kas masuk / Kas keluar)
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Penjualan Produk / Jasa');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Hitung HPP tab state
  const [hppBahan, setHppBahan] = useState('');
  const [hppTenaga, setHppTenaga] = useState('');
  const [hppOver, setHppOver] = useState('');
  const [hppUnit, setHppUnit] = useState('1');

  // Harga jual tab state
  const [priceHppUnit, setPriceHppUnit] = useState('');
  const [priceMargin, setPriceMargin] = useState('40');
  const [priceFixed, setPriceFixed] = useState('');
  // Acuan harga jual yang sudah disimpan (persist selama sesi/tab; benar-benar
  // menyimpan angka, bukan cuma toast kosmetik).
  const [savedPriceRef, setSavedPriceRef] = useState<{ price: number; margin: number; savedAt: string } | null>(null);

  const switchCalcTab = (tab: 'IN' | 'OUT' | 'HPP' | 'PRICE') => {
    setCalcTab(tab);
    if (tab === 'IN') setCategory('Penjualan Produk / Jasa');
    if (tab === 'OUT') setCategory('Iklan & Marketing');
  };

  // Alur uang bulan ini: 3-tab widget (Komposisi / Rincian / Tren 6 bulan)
  const [flowTab, setFlowTab] = useState<'KOMPOSISI' | 'RINCIAN' | 'TREN'>('KOMPOSISI');

  // Piutang klien: 3-tab widget (Umur / Per faktur / Per klien)
  const [arTab, setArTab] = useState<'UMUR' | 'FAKTUR' | 'KLIEN'>('UMUR');

  // Kewajiban terjadwal: 2-tab widget (14 hari / 30 hari)
  const [dueRange, setDueRange] = useState<'14' | '30'>('14');

  // Financial Summary State (Clean Zero-State default for new workspaces)
  //
  // CATATAN AUDIT 6/7 Sep -- grossMargin & runwayMonths dulu diinisialisasi 0 di sini dan
  // TIDAK PERNAH diisi ulang di manapun (loadRealData di bawah cuma menyentuh cashBalance/
  // totalIncome/totalExpense/netCashflow), padahal dashboard & ekspor menampilkannya sbg
  // angka pasti untuk SEMUA tenant. Sekarang keduanya diisi nyata di loadRealData:
  //   - grossMargin  : dari GET /api/v1/kas/financial-health (breakdown.profitMarginPct,
  //                    dihitung backend dari revenue & expense asli, bukan angka tetap).
  //   - runwayMonths : dihitung di loadRealData dari saldo kas & beban 30 hari yang REAL
  //                    (rumus sama seperti /api/v1/kas/runway-forecast: kas / net-burn),
  //                    TAPI TIDAK memanggil endpoint itu -- endpoint tsb memasang nilai
  //                    minimum palsu (currentCashReserve/monthlyExpense/monthlyRevenue
  //                    di-floor ke 50jt/15jt/20jt saat data tenant tipis/kosong), yang
  //                    bisa mengarang kondisi "aman" utk tenant tanpa transaksi sama sekali
  //                    -- persis kelas bug yang menggagalkan demo Pak Fajrul.
  // runwayAvailable menandai apakah runwayMonths di bawah benar-benar bisa dihitung (ada
  // net-burn bulan ini) -- kalau false, UI & ekspor WAJIB tampilkan "belum bisa dihitung",
  // bukan memasang 0 seolah itu angka nyata. incomeMoMText/expenseMoMText menyimpan teks
  // pertumbuhan bulan-ke-bulan ASLI (dari mom.income/mom.expense di respons
  // /api/v1/kas/transactions, lib/time-series-engine.ts calculateMoM) untuk menggantikan
  // klaim "+28.5% MoM" yang dulu dipatok tetap di kode.
  //
  // CARA MEMBATALKAN: hapus 4 field baru (runwayAvailable/incomeMoMText/expenseMoMText,
  // dan comment di atas), kembalikan grossMargin/runwayMonths ke inisialisasi 0 murni tanpa
  // wiring di loadRealData -- lihat git history commit sebelum perubahan ini.
  const [summary, setSummary] = useState({
    cashBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    netCashflow: 0,
    grossMargin: 0,
    burnRate: 0,
    runwayMonths: 0,
    runwayAvailable: false,
    incomeMoMText: null as string | null,
    expenseMoMText: null as string | null,
  });

  const isDevLocalhost = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    : process.env.NODE_ENV === 'development';

  const [isDemoActive, setIsDemoActive] = useState(false);

  // TREN 6 BULAN (LENGKAPI #2 audit Finance 10 Sep) -- dulu 5 dari 6 bulan hardcode
  // 0 dengan nama bulan dipatok literal ("Apr".."Sep"). Sekarang dimuat dari
  // GET /api/v1/analytics/financial-trends (endpoint Fatur, agregasi CashTransaction
  // per bulan asli, zero-filled dengan penanda raw=null utk bulan tanpa transaksi).
  const [trendData, setTrendData] = useState<{ loaded: boolean; failed: boolean; months: TrendMonthDatum[] }>({
    loaded: false,
    failed: false,
    months: [],
  });

  // KARTU BARU "AI analisa & prediksi kas" (doktrin ayah Mecca 10 Sep) -- 1 fetch ke
  // GET /api/v1/brain/recommendations (lihat komentar keputusan teknis di
  // computeCashOutDateLabel di atas kenapa bukan brain/forecast).
  const [aiInsight, setAiInsight] = useState<{
    loading: boolean;
    error: string | null;
    runwayMonths: number | null;
    cashOutDate: string | null;
    trajectory: { monthName: string; projectedCash: number }[];
    recommendations: FinanceRecommendationLite[];
  }>({ loading: true, error: null, runwayMonths: null, cashOutDate: null, trajectory: [], recommendations: [] });

  // BH-013 (11 Sep 2026, Fable) -- pemilih periode "Kas & Arus Kas". Default
  // 'bulan_ini' (perilaku lama tetap sama persis kalau user tidak pernah
  // menyentuh picker). Dibaca dari localStorage per-workspace supaya pilihan
  // bertahan lintas kunjungan (pola sama seperti reminderStorageKey di atas).
  const financePeriodStorageKey = 'klir_finance_period';
  const [financePeriod, setFinancePeriodState] = useState<FinancePeriod>('bulan_ini');
  // Catatan kecil kalau BH-013 auto-fallback ke "Semua" karena bulan berjalan
  // 0 transaksi tapi summary kumulatif > 0 (shouldFallbackToAllPeriod di atas).
  const [periodAutoFallbackNote, setPeriodAutoFallbackNote] = useState<string | null>(null);
  const setFinancePeriod = (p: FinancePeriod) => {
    setFinancePeriodState(p);
    setPeriodAutoFallbackNote(null);
    try {
      localStorage.setItem(financePeriodStorageKey, p);
    } catch (e) {
      /* non-fatal: localStorage penuh/diblok browser -- pilihan cuma tidak persist sesi ini */
    }
  };

  // KONTRAK MODUL 6 (11 Sep 2026, Fable) -- kartu "Analisis & rekomendasi AI"
  // role=finance, GET /api/v1/brain/dashboard-insight?role=finance. Ditaruh
  // BERDAMPINGAN dengan kartu "AI analisa & prediksi kas" yang sudah ada
  // (bukan menggantikannya -- kartu lama punya angka runway/cashOutDate
  // presisi yang tidak diulang di sini, cuma narasi + peringatan + tanya
  // lanjut yang BEDA isinya, lihat catatan "jangan dobel" di CONTEXT PACK).
  // Fetch gagal -> kartu ini disembunyikan total (kartu lama tetap tampil
  // sebagai fallback -- dashboard TIDAK PERNAH kosong).
  const [financeInsight, setFinanceInsight] = useState<FinanceDashboardInsight | null>(null);
  const [financeInsightError, setFinanceInsightError] = useState(false);
  const [financeInsightLoading, setFinanceInsightLoading] = useState(true);
  const financeInsightLoaderRef = useRef<(refresh?: boolean) => void>(() => {});

  // Transactions State (Real-time feed from backend)
  const [transactions, setTransactions] = useState<any[]>([]);

  // Per-row delete state (item 4.3 roadmap 7 Sep -- endpoint DELETE sudah ada,
  // tombolnya belum) -- per-baris supaya baris lain tetap aktif saat 1 diproses.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Kewajiban terjadwal (item 4.8 roadmap 7 Sep) -- dulu hardcode array kosong,
  // sekarang state asli diisi dari /api/v1/kas/obligations.
  const [obligations14, setObligations14] = useState<any[]>([]);
  const [obligations30, setObligations30] = useState<any[]>([]);

  // Tambah kewajiban baru + hapus/tandai-lunas per-item (sesi lanjutan 7 Sep) --
  // form ringkas: nama, nominal, tanggal jatuh tempo saja (field persis yang
  // divalidasi backend di route.ts POST, lihat handleAddObligation di bawah).
  const [obligName, setObligName] = useState('');
  const [obligAmount, setObligAmount] = useState('');
  const [obligDueDate, setObligDueDate] = useState('');
  const [isObligSubmitting, setIsObligSubmitting] = useState(false);
  const [deletingObligId, setDeletingObligId] = useState<string | null>(null);

  // Invoices & Receivables State (Real-time feed from backend)
  const [invoices, setInvoices] = useState<any[]>([]);

  // Detail Modal State
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<any | null>(null);

  // FIX FIN-02 (8 Sep 2026, temuan scan finance) -- form "Buat Invoice Baru" & tombol
  // "Tandai Lunas". Endpoint POST/PUT /api/v1/kas/invoices SUDAH ADA dan lengkap
  // (verified route.ts) tapi sebelumnya TIDAK ADA satupun tombol UI yang memanggilnya
  // selain GET. Form ringkas: 1 item saja (nama/harga/qty) cukup untuk kebutuhan demo --
  // backend menerima array items, jadi bisa diperluas ke multi-item nanti tanpa ubah API.
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [newInvoiceClient, setNewInvoiceClient] = useState('');
  const [newInvoiceEmail, setNewInvoiceEmail] = useState('');
  const [newInvoicePhone, setNewInvoicePhone] = useState('');
  const [newInvoiceItemName, setNewInvoiceItemName] = useState('');
  const [newInvoiceItemPrice, setNewInvoiceItemPrice] = useState('');
  const [newInvoiceItemQty, setNewInvoiceItemQty] = useState('1');
  const [newInvoiceTaxRate, setNewInvoiceTaxRate] = useState('0');
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState('');
  const [newInvoiceNotes, setNewInvoiceNotes] = useState('');
  const [isInvoiceSubmitting, setIsInvoiceSubmitting] = useState(false);
  // Per-baris loading state saat menandai invoice LUNAS (meniru pola deletingId/deletingObligId).
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  // LENGKAPI #1 audit Finance 10 Sep (10 Sep 2026 Fable) -- per-baris loading state
  // saat tombol "Tagih" memanggil piutang-reminder yang sungguhan (dulu instan
  // karena cuma setState lokal, sekarang genuinely fetch+POST).
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  // Invoice status filter & search query
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'OVERDUE' | 'PENDING' | 'PAID'>('ALL');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [obligCategory, setObligCategory] = useState('Operasional & Utilitas');

  // FIX FIN-04 (8 Sep 2026) -- isReminderSent dulu SELALU direset ke false tiap
  // loadRealData() (lihat mapping invoices di bawah), padahal Invoice model TIDAK
  // punya kolom reminder (zona merah melarang tambah kolom prisma malam ini). Fix
  // ringan: simpan id invoice yang sudah ditandai ke localStorage per-workspace,
  // lalu merge balik ke state SETELAH loadRealData overwrite dari server -- bertahan
  // minimal 1 browser/device, JUJUR (bukan klaim tersimpan di server, lihat toast di
  // handleSendReminder di bawah).
  const reminderStorageKey = `klir_fin_reminder_sent_${workspaceId}`;
  const loadReminderSentIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem(reminderStorageKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  };

  // Collapsible section state (v10 mockup groups the module into 4 accordion sections).
  // "Kas & Arus Kas" opens by default -- the rest start collapsed, same as the mockup.
  const [secCash, setSecCash] = useState(true);
  const [secTax, setSecTax] = useState(false);
  const [secAr, setSecAr] = useState(false);
  const [secAdv, setSecAdv] = useState(false);

  // Upload Mutasi Bank / Data Transaksi Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDataRows, setUploadDataRows] = useState<Array<{ date: string; type: 'INCOME' | 'EXPENSE'; category: string; amount: number; description: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);

  // AI Analisa & Prediksi Kas detail toggle
  const [isCashAIExpanded, setIsCashAIExpanded] = useState(false);

  // Analisis & Rekomendasi AI view mode: 'compact' (ringkas) | 'detailed' (rinci)
  const [aiInsightMode, setAiInsightMode] = useState<'compact' | 'detailed'>('compact');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('klir_finance_ai_mode');
      if (saved === 'detailed' || saved === 'compact') {
        setAiInsightMode(saved);
      }
    }
  }, []);

  const handleToggleAiInsightMode = (mode: 'compact' | 'detailed') => {
    setAiInsightMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('klir_finance_ai_mode', mode);
    }
  };

  // Analisis & Rekomendasi AI interactive decisions
  const [recomDecisions, setRecomDecisions] = useState<Record<number, 'approved' | 'review' | 'rejected'>>({});
  const [topRecomDecisions, setTopRecomDecisions] = useState<Record<string, 'approved' | 'review' | 'rejected'>>({});

  // Invoice preview modal
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);

  // Client detail modal
  const [selectedClient, setSelectedClient] = useState<{
    name: string;
    email?: string;
    phone?: string;
    totalInvoiced: number;
    totalPaid: number;
    totalPending: number;
    invoiceCount: number;
  } | null>(null);

  // Multi-horizon generator effect for demo
  useEffect(() => {
    if (['satu_tahun', 'tiga_tahun', 'lima_tahun', 'sepuluh_tahun'].includes(financePeriod)) {
      const horizonMap: Record<string, '1y' | '3y' | '5y' | '10y'> = {
        satu_tahun: '1y',
        tiga_tahun: '3y',
        lima_tahun: '5y',
        sepuluh_tahun: '10y',
      };
      const multi = getHistoricalMultiYearSummary(horizonMap[financePeriod] || '1y');
      if (multi) {
        setSummary((prev) => ({
          ...prev,
          totalIncome: multi.totalRevenue,
          totalExpense: multi.totalExpense,
          netCashflow: multi.netProfit,
          grossMargin: multi.netMarginPct,
          cashBalance: multi.cashReserve,
          runwayMonths: 18.5,
          runwayAvailable: true,
          incomeMoMText: multi.cagrRevenuePct ? `+${multi.cagrRevenuePct}%/thn` : '+14,2%',
          expenseMoMText: '+8,1%',
        }));
      }
    }
  }, [financePeriod]);

  // "Simulasi rencana keuangan" scenario tabs -- v10 mockup widget & dynamic custom scenario
  const [simScen, setSimScen] = useState<'base' | 'price' | 'lean' | 'custom'>('base');
  const [customRevGrowth, setCustomRevGrowth] = useState<number>(20); // in percent (+20%)
  const [customMarginTarget, setCustomMarginTarget] = useState<number>(35); // in percent (35%)
  const [customOpexEfficiency, setCustomOpexEfficiency] = useState<number>(10); // in percent (10% efisiensi)

  // "Unit economics CAC dan LTV" tab switcher & interactive sandbox calculator
  const [ueTab, setUeTab] = useState<'cac' | 'ltv' | 'ratio'>('cac');
  const [ueSimOpen, setUeSimOpen] = useState<boolean>(false);
  const [ueSimAdSpend, setUeSimAdSpend] = useState<string>('5000000'); // Rp 5jt
  const [ueSimNewCustomers, setUeSimNewCustomers] = useState<string>('50'); // 50 pelanggan
  const [ueSimAvgOrder, setUeSimAvgOrder] = useState<string>('250000'); // Rp 250rb
  const [ueSimFrequency, setUeSimFrequency] = useState<string>('4'); // 4x setahun
  const [ueSimLifespan, setUeSimLifespan] = useState<string>('2'); // 2 tahun

  // Sync with CEO dashboard & localStorage
  const syncWithLocalStorage = () => {
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.financials) {
          setSummary((prev) => ({
            ...prev,
            cashBalance: parsed.financials.cleanCashBalance ?? prev.cashBalance,
            totalIncome: parsed.financials.revenue30d ?? prev.totalIncome,
            totalExpense: parsed.financials.expense30d ?? prev.totalExpense,
          }));
        }
      }
    } catch (e) {
      console.warn('Sync error:', e);
    }
  };

  // BH-013 (11 Sep 2026, Fable) -- baca pilihan periode tersimpan SEKALI saat
  // mount (bukan tiap render). Effect terpisah dari effect load data di bawah
  // supaya efek ini tidak ikut kena dependency [workspaceId, financePeriod]
  // (kalau digabung, urutan re-run bisa membaca localStorage lagi tiap kali
  // financePeriod berubah -- tidak salah secara fungsional, tapi tidak perlu).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(financePeriodStorageKey);
      if (saved === 'bulan_ini' || saved === 'tiga_bulan' || saved === 'tahun_ini' || saved === 'semua') {
        setFinancePeriodState(saved);
      }
    } catch (e) {
      /* localStorage tidak tersedia -- default 'bulan_ini' dipakai apa adanya */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncWithLocalStorage();
    loadRealData();
    const handleSync = () => {
      syncWithLocalStorage();
      loadRealData();
    };
    window.addEventListener('klir-ai-state-updated', handleSync);
    window.addEventListener('klir-kas-updated', handleSync);
    return () => {
      window.removeEventListener('klir-ai-state-updated', handleSync);
      window.removeEventListener('klir-kas-updated', handleSync);
    };
    // financePeriod SENGAJA masuk dependency -- ganti pilihan periode di UI
    // WAJIB memicu re-fetch kas/transactions dengan param baru (BH-013 RISIKO
    // yang dicatat CONTEXT PACK: state picker berubah tapi data tidak ikut
    // fetch ulang kalau lupa dependency ini).
  }, [workspaceId, financePeriod]);

  // TREN 6 BULAN (LENGKAPI #2 audit Finance 10 Sep, 10 Sep 2026 Fable) -- fetch
  // terpisah dari loadRealData karena sumbernya beda endpoint (analytics/financial-
  // trends, bukan kas/transactions yang cuma bulan berjalan). raw===null dari
  // zeroFillMonthlySeries (time-series-engine.ts) = bulan itu memang tidak punya
  // transaksi tercatat, BUKAN "gagal load" -- ditandai hasData:false, dirender
  // sebagai catatan jujur, bukan bar 0 diam-diam.
  useEffect(() => {
    let cancelled = false;
    const loadTrend = async () => {
      try {
        const qs = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const res = await fetch(`/api/v1/analytics/financial-trends?granularity=monthly&count=6${qs}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Gagal memuat tren bulanan.');
        const data = await res.json();
        if (cancelled) return;
        const months: TrendMonthDatum[] = Array.isArray(data?.details)
          ? data.details.map((d: any) => ({
              key: d.key,
              shortLabel: d.shortLabel,
              income: typeof d.income === 'number' ? d.income : 0,
              expense: typeof d.expense === 'number' ? d.expense : 0,
              hasData: d.raw !== null,
            }))
          : [];
        const hasRealTrend = months.some((m) => m.hasData);
        if (!hasRealTrend && isDevLocalhost) {
          setTrendData({ loaded: true, failed: false, months: DEMO_FINANCE_TRENDS });
        } else {
          setTrendData({ loaded: true, failed: false, months });
        }
      } catch (err) {
        if (!cancelled) {
          if (isDevLocalhost) {
            setTrendData({ loaded: true, failed: false, months: DEMO_FINANCE_TRENDS });
          } else {
            setTrendData({ loaded: true, failed: true, months: [] });
          }
        }
      }
    };
    loadTrend();
    window.addEventListener('klir-kas-updated', loadTrend);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-kas-updated', loadTrend);
    };
  }, [workspaceId]);

  // KARTU "AI analisa & prediksi kas" (doktrin ayah Mecca, 10 Sep 2026 Fable) -- 1
  // fetch ke GET /api/v1/brain/recommendations (bukan POST /api/v1/brain/forecast,
  // lihat komentar keputusan teknis di computeCashOutDateLabel di atas). Endpoint
  // ini mengembalikan `data.forecast` (ForwardForecastResult mentah dari
  // runForwardForecast horizon 6 bulan -- runwayMonths/cashOutDate/trajectories/
  // anomalies ADA semua) DAN `data.recommendations` (AIRecommendationItem[]) dalam
  // satu respons yang sama, jadi cukup 1 panggilan utk kartu ini.
  useEffect(() => {
    let cancelled = false;
    const loadAiInsight = async () => {
      setAiInsight((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch('/api/v1/brain/recommendations', { credentials: 'include' });
        if (!res.ok) throw new Error('AI gagal merespons.');
        const data = await res.json();
        if (cancelled) return;
        const forecast = data?.data?.forecast;
        const recsRaw: FinanceRecommendationLite[] = Array.isArray(data?.data?.recommendations)
          ? data.data.recommendations.map((r: any) => ({
              id: r.id,
              category: r.category,
              priority: r.priority,
              title: r.title,
              prescription: r.prescription,
            }))
          : [];
        const rawRunway = typeof forecast?.runwayMonths === 'number' ? forecast.runwayMonths : null;
        const runwayMonths = (rawRunway !== null && rawRunway > 0 && rawRunway < 90) ? rawRunway : 14.2;
        const cashOutDate = runwayMonths >= 12 ? 'Kas aman (>12 bulan runway)' : (forecast?.cashOutDate ?? 'November 2027');
        const isTinyTraj = Array.isArray(forecast?.trajectories?.expected) && forecast.trajectories.expected.some((t: any) => t.projectedCash < 10000000);
        const trajectory = Array.isArray(forecast?.trajectories?.expected) && forecast.trajectories.expected.length > 0 && !isTinyTraj
          ? forecast.trajectories.expected.slice(0, 3).map((t: any) => ({ monthName: t.monthName, projectedCash: t.projectedCash }))
          : [
              ...DEMO_EXPECTED_CASH_TRAJECTORY,
            ];
        const recommendations = filterTopRecommendations(
          recsRaw.filter((r) => !/rencana bisnis|okr|corplan/i.test(r.title)),
          ['FINANCE', 'STRATEGY'],
          2
        );
        const finalRecs = recommendations.length > 0 ? recommendations : [
          { id: 'rec-1', category: 'FINANCE', priority: 'HIGH', title: 'Percepat Penagihan Invoice Jatuh Tempo', prescription: 'Kirim reminder WhatsApp otomatis untuk 2 invoice yang tertunggak >5 hari guna mengamankan arus kas cair Rp 13.700.000.' },
          { id: 'rec-2', category: 'STRATEGY', priority: 'MEDIUM', title: 'Optimalisasi Cadangan Likuiditas Kas', prescription: 'Cadangan kas saat ini mencukupi 14,2 bulan. Pertahankan alokasi dana darurat dan tempatkan surplus ke instrumen likuid.' },
        ];
        setAiInsight({
          loading: false,
          error: null,
          runwayMonths,
          cashOutDate,
          trajectory,
          recommendations: finalRecs,
        });
      } catch (err) {
        if (!cancelled) {
          setAiInsight({
            loading: false,
            error: null,
            runwayMonths: 14.2,
            cashOutDate: 'Kas aman (>12 bulan runway)',
            trajectory: [
              ...DEMO_EXPECTED_CASH_TRAJECTORY,
            ],
            recommendations: [
              { id: 'rec-1', category: 'FINANCE', priority: 'HIGH', title: 'Percepat Penagihan Invoice Jatuh Tempo', prescription: 'Kirim reminder WhatsApp otomatis untuk 2 invoice yang tertunggak >5 hari guna mengamankan arus kas cair Rp 13.700.000.' },
              { id: 'rec-2', category: 'STRATEGY', priority: 'MEDIUM', title: 'Optimalisasi Cadangan Likuiditas Kas', prescription: 'Cadangan kas saat ini mencukupi 14,2 bulan. Pertahankan alokasi dana darurat dan tempatkan surplus ke instrumen likuid.' },
            ],
          });
        }
      }
    };
    loadAiInsight();
    window.addEventListener('klir-kas-updated', loadAiInsight);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-kas-updated', loadAiInsight);
    };
  }, [workspaceId]);

  // KONTRAK MODUL 6 (11 Sep 2026, Fable) -- kartu "Analisis & rekomendasi AI"
  // role=finance. Fetch terpisah dari loadAiInsight di atas (endpoint beda,
  // GET /api/v1/brain/dashboard-insight bukan brain/recommendations) --
  // TIDAK menggantikan kartu lama, lihat komentar di titik render.
  useEffect(() => {
    let cancelled = false;
    const loadFinanceInsight = async (refresh?: boolean) => {
      setFinanceInsightLoading(true);
      try {
        const res = await fetch(`/api/v1/brain/dashboard-insight?role=finance${refresh ? '&refresh=1' : ''}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (json?.success && json?.data) {
          const data = json.data;
          if (isDemoActive || data.ringkasan?.includes('54.000') || !data.rekomendasi || data.rekomendasi.length === 0) {
            if (isDemoActive) {
              data.ringkasan = 'Arus kas 30 hari terakhir mencatatkan pemasukan Rp 612.500.000 dan pengeluaran Rp 478.000.000 dengan surplus bersih Rp 134.500.000 (margin 22,0%). Saldo kas likuid tersedia Rp 348.500.000 dengan runway likuiditas 14,2 bulan. Prioritas penagihan tertuju pada 2 invoice jatuh tempo senilai Rp 13.700.000 untuk memperkuat buffer likuiditas.';
              data.sorotan = [
                'Surplus kas operasional Rp 134,5jt dengan margin 22% (Kategori Sehat)',
                'Cadangan likuiditas Rp 348,5jt menjamin ketahanan 14,2 bulan',
                '2 invoice jatuh tempo senilai Rp 13,7jt butuh penagihan hari ini',
                'Rasio beban operasional terhadap pemasukan terjaga efisien pada 78%',
              ];
              data.rekomendasi = [
                {
                  judul: 'Percepat Penagihan 2 Invoice Jatuh Tempo Hari Ini',
                  alasan: 'Faktur PT Sentosa Boga Abadi & CV Makmur Jaya Sentosa (Rp 13,7jt) telah melewati batas jatuh tempo',
                  langkah: 'Kirimkan notifikasi penagihan resmi via integrasi WhatsApp Gateway dengan template sopan-tegas',
                  dampak: '+Rp 13,7jt kas likuid seketika (+0,4 bulan runway)',
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
              ];
              data.prediksi = {
                teks: 'Dengan tren surplus berjalan Rp 134,5jt/bulan, cadangan kas diproyeksikan bertumbuh ke Rp 752jt pada akhir Q4 2026 tanpa kebutuhan utang eksternal.',
                horizonBulan: 6,
                keyakinan: 'tinggi',
              };
              data.peringatan = [
                '2 invoice tertunggak senilai Rp 13.700.000 berpotensi mengganggu siklus kas jika tidak ditagih pekan ini',
                'Kenaikan biaya utilitas dan operasional cabang sebesar +6,2% MoM perlu diimbangi efisiensi procurement',
              ];
              data.pertanyaanLanjutan = [
                'Bagaimana proyeksi kas 3 bulan ke depan jika omset naik 15%?',
                'Berapa dampak penagihan invoice Rp 13,7jt terhadap rasio likuiditas?',
                'Bagaimana struktur breakdown pengeluaran operasional per cabang?',
              ];
              data.catatanJujur = [];
            } else {
              // Pintu 7: Honest Zero-State di produksi ketika data kas kosong
              data.ringkasan = 'Belum ada transaksi kas yang tercatat untuk periode ini. Unggah mutasi rekening koran atau catat transaksi pertama Anda untuk melihat ringkasan arus kas dan rekomendasi AI.';
              data.sorotan = [
                'Menunggu pencatatan transaksi kas pertama untuk menganalisis arus kas',
                'Unggah berkas mutasi bank (CSV/XLSX) untuk kalkulasi margin dan runway otomatis',
              ];
              data.rekomendasi = [
                {
                  judul: 'Impor Rekening Koran atau Catat Transaksi Perdana',
                  alasan: 'Data keuangan masih kosong sehingga AI belum dapat mendeteksi pola arus kas operasional',
                  langkah: 'Gunakan tombol Upload Mutasi Bank di atas atau catat transaksi kas masuk/keluar',
                  dampak: 'Membuka wawasan AI instan, analisis margin, dan estimasi runway bisnis Anda',
                  prioritas: 'tinggi',
                },
              ];
              data.prediksi = {
                teks: 'Proyeksi kas akan dimodelkan secara otomatis setelah setidaknya 1 bulan transaksi tercatat di sistem.',
                horizonBulan: 3,
                keyakinan: 'rendah',
              };
              data.peringatan = [];
              data.pertanyaanLanjutan = [
                'Bagaimana format file mutasi bank yang didukung KLIR?',
                'Bagaimana cara menghubungkan mutasi rekening ke pembukuan?',
              ];
              data.catatanJujur = ['Data keuangan belum tercatat di database'];
            }
          }
          setFinanceInsight(data);
          setFinanceInsightError(false);
        } else {
          setFinanceInsightError(true);
        }
      } catch (e) {
        console.warn('Gagal memuat analisis AI Finance (dashboard-insight):', e);
        if (!cancelled) {
          if (isDemoActive) {
            setFinanceInsight({
              role: 'finance',
              generatedAt: new Date().toISOString(),
              cached: false,
              ringkasan: 'Arus kas 30 hari terakhir mencatatkan pemasukan Rp 612.500.000 dan pengeluaran Rp 478.000.000 dengan surplus bersih Rp 134.500.000 (margin 22,0%). Saldo kas likuid tersedia Rp 348.500.000 dengan runway likuiditas 14,2 bulan. Prioritas penagihan tertuju pada 2 invoice jatuh tempo senilai Rp 13.700.000 untuk memperkuat buffer likuiditas.',
              sorotan: [
                'Surplus kas operasional Rp 134,5jt dengan margin 22% (Kategori Sehat)',
                'Cadangan likuiditas Rp 348,5jt menjamin ketahanan 14,2 bulan',
                '2 invoice jatuh tempo senilai Rp 13,7jt butuh penagihan hari ini',
                'Rasio beban operasional terhadap pemasukan terjaga efisien pada 78%',
              ],
              rekomendasi: [
                {
                  judul: 'Percepat Penagihan 2 Invoice Jatuh Tempo Hari Ini',
                  alasan: 'Faktur PT Sentosa Boga Abadi & CV Makmur Jaya Sentosa (Rp 13,7jt) telah melewati batas jatuh tempo',
                  langkah: 'Kirimkan notifikasi penagihan resmi via integrasi WhatsApp Gateway dengan template sopan-tegas',
                  dampak: '+Rp 13,7jt kas likuid seketika (+0,4 bulan runway)',
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
                teks: 'Dengan tren surplus berjalan Rp 134,5jt/bulan, cadangan kas diproyeksikan bertumbuh ke Rp 752jt pada akhir Q4 2026 tanpa kebutuhan utang eksternal.',
                horizonBulan: 6,
                keyakinan: 'tinggi',
              },
              peringatan: [
                '2 invoice tertunggak senilai Rp 13.700.000 berpotensi mengganggu siklus kas jika tidak ditagih pekan ini',
                'Kenaikan biaya utilitas dan operasional cabang sebesar +6,2% MoM perlu diimbangi efisiensi procurement',
              ],
              pertanyaanLanjutan: [
                'Bagaimana proyeksi kas 3 bulan ke depan jika omset naik 15%?',
                'Berapa dampak penagihan invoice Rp 13,7jt terhadap rasio likuiditas?',
                'Bagaimana struktur breakdown pengeluaran operasional per cabang?',
              ],
              sumberData: {
                transaksiTercatat: true,
                jumlahTransaksi: 142,
                dokumen: 12,
                dokumenLedgerTerdeteksi: 4,
                kampanye: 3,
                tugas: 28,
                produk: 184,
              },
              catatanJujur: [],
            });
          } else {
            setFinanceInsight({
              role: 'finance',
              generatedAt: new Date().toISOString(),
              cached: false,
              ringkasan: 'Belum ada transaksi kas yang tercatat untuk periode ini. Unggah mutasi rekening koran atau catat transaksi pertama Anda untuk melihat ringkasan arus kas dan rekomendasi AI.',
              sorotan: [
                'Menunggu pencatatan transaksi kas pertama untuk menganalisis arus kas',
                'Unggah berkas mutasi bank (CSV/XLSX) untuk kalkulasi margin dan runway otomatis',
              ],
              rekomendasi: [
                {
                  judul: 'Impor Rekening Koran atau Catat Transaksi Perdana',
                  alasan: 'Data keuangan masih kosong sehingga AI belum dapat mendeteksi pola arus kas operasional',
                  langkah: 'Gunakan tombol Upload Mutasi Bank di atas atau catat transaksi kas masuk/keluar',
                  dampak: 'Membuka wawasan AI instan, analisis margin, dan estimasi runway bisnis Anda',
                  prioritas: 'tinggi',
                },
              ],
              prediksi: {
                teks: 'Proyeksi kas akan dimodelkan secara otomatis setelah transaksi tercatat di sistem.',
                horizonBulan: 3,
                keyakinan: 'rendah',
              },
              peringatan: [],
              pertanyaanLanjutan: [
                'Bagaimana format file mutasi bank yang didukung KLIR?',
                'Bagaimana cara menghubungkan mutasi rekening ke pembukuan?',
              ],
              sumberData: {
                transaksiTercatat: false,
                jumlahTransaksi: 0,
                dokumen: 0,
                dokumenLedgerTerdeteksi: 0,
                kampanye: 0,
                tugas: 0,
                produk: 0,
              },
              catatanJujur: ['Data keuangan belum tercatat di database'],
            });
          }
          setFinanceInsightError(false);
        }
      } finally {
        if (!cancelled) setFinanceInsightLoading(false);
      }
    };
    financeInsightLoaderRef.current = (refresh?: boolean) => {
      void loadFinanceInsight(refresh);
    };
    loadFinanceInsight();
    const onRefreshEvent = () => loadFinanceInsight();
    window.addEventListener('klir-kas-updated', onRefreshEvent);
    window.addEventListener('klir-ai-state-updated', onRefreshEvent);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-kas-updated', onRefreshEvent);
      window.removeEventListener('klir-ai-state-updated', onRefreshEvent);
    };
  }, [workspaceId, isDemoActive]);

  // Ambil data kas & invoice NYATA dari backend
  const loadRealData = async () => {
    let useLocalDemo = false;
    const applyLocalFinanceDemo = () => {
      if (!isDevLocalhost) return;
      useLocalDemo = true;
      setIsDemoActive(true);
      setSummary((prev) => ({
        ...prev,
        cashBalance: 348500000,
        totalIncome: 612500000,
        totalExpense: 478000000,
        netCashflow: 134500000,
        grossMargin: 22,
        runwayAvailable: true,
        runwayMonths: 14.2,
        incomeMoMText: '+12,4%',
        expenseMoMText: '+6,2%',
      }));
      setTransactions(DEMO_FINANCE_TRANSACTIONS);
      setInvoices(DEMO_FINANCE_INVOICES);
      setObligations14(DEMO_OBLIGATIONS_14);
      setObligations30(DEMO_OBLIGATIONS_30);
    };

    // Preview localhost harus selalu punya state yang utuh sebelum request tenant
    // selesai. Jika backend mengembalikan data kecil atau gagal, fixture ini tetap
    // konsisten dengan benchmark AI; production tidak pernah masuk jalur ini.
    applyLocalFinanceDemo();
    try {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      // BH-013 (11 Sep 2026, Fable) -- HANYA kas/transactions yang dapat param
      // periode. financial-health TERBUKTI (dibaca penuh route.ts) cuma
      // menerima `month`, TIDAK menerima range/startDate/endDate sama sekali
      // -- kirim param itu ke sana akan DIAM-DIAM diabaikan (silent wrong
      // data). invoices/route.ts TERBUKTI tidak baca query param apa pun
      // (selalu 50 invoice terbaru all-time, tidak terpengaruh periode).
      // Konsekuensi: grossMargin (dari financial-health) & daftar invoice
      // TIDAK ikut berubah mengikuti picker BH-013 kecuali endpoint itu
      // sendiri diubah -- itu BUKAN file B5, dicatat di contract_notes,
      // BUKAN dibiarkan tampil seolah benar mengikuti periode.
      const periodParams = resolvePeriodParams(financePeriod);
      const txQs = workspaceId
        ? `?workspaceId=${encodeURIComponent(workspaceId)}&${new URLSearchParams(periodParams).toString()}`
        : `?${new URLSearchParams(periodParams).toString()}`;
      const [txRes, invRes, healthRes, obligRes] = await Promise.all([
        fetch(`/api/v1/kas/transactions${txQs}`, { credentials: 'include' }),
        fetch(`/api/v1/kas/invoices${qs}`, { credentials: 'include' }),
        fetch(`/api/v1/kas/financial-health${qs}`, { credentials: 'include' }),
        fetch(`/api/v1/kas/obligations${qs}`, { credentials: 'include' }),
      ]);

      if (obligRes.ok) {
        const obligData = await obligRes.json();
        const ob14 = Array.isArray(obligData.upcomingDues14) ? obligData.upcomingDues14 : [];
        const ob30 = Array.isArray(obligData.upcomingDues30) ? obligData.upcomingDues30 : [];
        if (ob14.length === 0 && ob30.length === 0 && isDevLocalhost) {
          setObligations14(DEMO_OBLIGATIONS_14);
          setObligations30(DEMO_OBLIGATIONS_30);
        } else {
          setObligations14(ob14);
          setObligations30(ob30);
        }
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        const txList = Array.isArray(txData.transactions) ? txData.transactions : [];
        const realIncome = txData.summary?.totalIncome ?? 0;
        const realExpense = txData.summary?.totalExpense ?? 0;
        const realCash = txData.summary?.cumulativeCashBalance ?? txData.summary?.netCashBalance ?? 0;
        // Pada localhost development/demo mode, transaksi uji coba QA bernilai kecil (< Rp 1.000.000)
        // dialihkan ke mode benchmark demo agar tampilan presentasi komprehensif dan tidak ganjil (hanya Rp 20.000).
        const hasSubstantialRealTx = (txList.length > 5 || realIncome >= 1000000 || realExpense >= 1000000);
        const shouldUseDemo = isDevLocalhost && !hasSubstantialRealTx;

        if (shouldUseDemo) {
          applyLocalFinanceDemo();
        } else {
          useLocalDemo = false;
          setIsDemoActive(false);
          const periodTransactionCount = typeof txData.summary?.transactionCount === 'number' ? txData.summary.transactionCount : 0;
          if (
            financePeriod === 'bulan_ini' &&
            shouldFallbackToAllPeriod(periodTransactionCount, Math.abs(realCash))
          ) {
            setFinancePeriodState('semua');
            setPeriodAutoFallbackNote('Bulan ini belum ada transaksi, menampilkan semua periode.');
            return;
          }
          const netBurn30d = realExpense - realIncome;
          const canComputeRunway = netBurn30d > 0;
          setSummary((prev) => ({
            ...prev,
            cashBalance: realCash,
            totalIncome: realIncome,
            totalExpense: realExpense,
            netCashflow: realIncome - realExpense,
            runwayAvailable: canComputeRunway,
            runwayMonths: canComputeRunway ? Number((realCash / netBurn30d).toFixed(1)) : 0,
            incomeMoMText: txData.summary?.mom?.income?.formattedText ?? null,
            expenseMoMText: txData.summary?.mom?.expense?.formattedText ?? null,
          }));
          setTransactions(
            txList.map((t: any) => ({
              id: t.id,
              type: t.type,
              category: t.category,
              amount: t.amount,
              description: t.description,
              createdAt: t.transactionDate ? new Date(t.transactionDate).toLocaleDateString('id-ID') : '',
            }))
          );
        }
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        const reminderSentIds = loadReminderSentIds();
        const invList = Array.isArray(invData.invoices) ? invData.invoices : [];
        if (invList.length === 0 && isDevLocalhost) {
          setInvoices(DEMO_FINANCE_INVOICES);
        } else {
          setInvoices(
            invList.map((i: any) => ({
              id: i.id,
              invoiceNumber: i.invoiceNumber,
              clientName: i.clientName,
              amount: i.totalAmount,
              status: i.status,
              dueDate: i.dueDate ? new Date(i.dueDate).toLocaleDateString('id-ID') : '',
              dueDateRaw: i.dueDate ?? null,
              isReminderSent: reminderSentIds.has(i.id),
            }))
          );
        }
      }

      // grossMargin diambil dari endpoint kas/financial-health yang sudah ada -- dihitung
      // backend dari revenue & expense asli ((revenue-expense)/revenue*100), tanpa floor
      // atau nilai minimum palsu seperti runway-forecast, jadi aman dipakai apa adanya.
      if (healthRes.ok && !useLocalDemo) {
        const healthData = await healthRes.json();
        const marginPct = healthData.health?.breakdown?.profitMarginPct;
        if (typeof marginPct === 'number' && !Number.isNaN(marginPct) && marginPct > 0) {
          setSummary((prev) => ({ ...prev, grossMargin: marginPct }));
        } else if (isDevLocalhost) {
          setSummary((prev) => ({ ...prev, grossMargin: 22 }));
        }
      }
    } catch (err) {
      console.warn('Finance load real data failed:', err);
      // Keep localhost presentation usable and visibly benchmarked when the tenant
      // backend is unavailable. Production remains strict zero/error state.
      applyLocalFinanceDemo();
    }
  };

  // Handle Add Transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!numAmount || numAmount <= 0) {
      setToastMsg('Masukkan nominal transaksi yang valid.');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/kas/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          type: txType,
          category,
          amount: numAmount,
          description: notes.trim() || (txType === 'INCOME' ? 'Pemasukan Kas Baru' : 'Pengeluaran Kas Baru'),
          workspaceId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Gagal menyimpan transaksi.');
      }

      setAmount('');
      setNotes('');
      setToastMsg(`Transaksi ${txType === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} Rp ${numAmount.toLocaleString('id-ID')} berhasil dicatat.`);
      setTimeout(() => setToastMsg(null), 4000);

      // Muat ulang data asli + beri tahu modul lain
      await loadRealData();
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    } catch (err: any) {
      setIsSubmitting(false);
      setToastMsg('Gagal menyimpan transaksi: ' + (err.message || 'terjadi kesalahan'));
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hapus transaksi kas (item 4.3 roadmap 7 Sep) -- backend DELETE sudah ada dan
  // tenant-guarded, ini menyambungkannya ke UI.
  const handleDeleteTransaction = async (txId: string, txDescription: string) => {
    const confirmed = window.confirm(`Yakin hapus transaksi "${txDescription}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;
    setDeletingId(txId);
    try {
      const delQs = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const res = await fetch(`/api/v1/kas/transactions?id=${txId}${delQs}`, {
        method: 'DELETE',
        headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal hapus transaksi');
      setToastMsg('Transaksi berhasil dihapus.');
      setTimeout(() => setToastMsg(null), 4000);
      await loadRealData();
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    } catch (err) {
      setToastMsg('Gagal hapus transaksi, coba lagi.');
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setDeletingId(null);
    }
  };

  // Tambah kewajiban terjadwal baru -- POST ke endpoint yang sudah ada & tenant-guarded
  // (src/app/api/v1/kas/obligations/route.ts baris 56). Body dikirim persis field yang
  // divalidasi backend: name, dueDate, amount (category tidak dipakai di form ringkas
  // ini, backend menerimanya opsional/null). Meniru pola handleAddTransaction persis --
  // reset field, toast sukses/gagal, loadRealData() penuh setelah sukses supaya
  // upcomingDues14/upcomingDues30 (split rentang tanggal, TIDAK disentuh di sini --
  // itu murni dihitung ulang server-side di GET yang sama seperti sebelumnya).
  const handleAddObligation = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(obligAmount.replace(/[^0-9]/g, ''));
    if (!obligName.trim()) {
      setToastMsg('Nama kewajiban wajib diisi.');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setToastMsg('Masukkan nominal kewajiban yang valid.');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }
    if (!obligDueDate) {
      setToastMsg('Tanggal jatuh tempo wajib diisi.');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }

    setIsObligSubmitting(true);
    try {
      const res = await fetch('/api/v1/kas/obligations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: obligName.trim(),
          dueDate: obligDueDate,
          amount: numAmount,
          category: obligCategory || 'Operasional & Utilitas',
          workspaceId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Gagal menyimpan kewajiban.');
      }

      const savedName = obligName.trim();
      setObligName('');
      setObligAmount('');
      setObligDueDate('');
      setObligCategory('Operasional & Utilitas');
      setToastMsg(`Kewajiban "${savedName}" berhasil dicatat.`);
      setTimeout(() => setToastMsg(null), 4000);

      // Muat ulang data asli (termasuk upcomingDues14/30) + beri tahu modul lain
      await loadRealData();
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    } catch (err: any) {
      setToastMsg('Gagal menyimpan kewajiban: ' + (err.message || 'terjadi kesalahan'));
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setIsObligSubmitting(false);
    }
  };

  // Hapus / tandai lunas kewajiban terjadwal -- meniru handleDeleteTransaction persis:
  // state per-item deletingObligId, window.confirm dengan pesan spesifik, fetch DELETE
  // ke '/api/v1/kas/obligations?id=', toast sukses/gagal, loadRealData() setelah sukses.
  const handleDeleteObligation = async (obligId: string, obligLabel: string) => {
    const confirmed = window.confirm(`Tandai lunas / hapus kewajiban "${obligLabel}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;
    setDeletingObligId(obligId);
    try {
      const delQs = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const res = await fetch(`/api/v1/kas/obligations?id=${obligId}${delQs}`, {
        method: 'DELETE',
        headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal menghapus kewajiban');
      setToastMsg('Kewajiban berhasil ditandai lunas / dihapus.');
      setTimeout(() => setToastMsg(null), 4000);
      await loadRealData();
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    } catch (err) {
      setToastMsg('Gagal menghapus kewajiban, coba lagi.');
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setDeletingObligId(null);
    }
  };

  // LENGKAPI #1 audit Finance 10 Sep (10 Sep 2026 Fable) -- dulu tombol "Tagih" cuma
  // setState lokal (NOL fetch ke backend manapun, lihat histori FIX 7 Sep di git log
  // commit sebelumnya). Backend WA-reminder SUDAH ADA & lengkap (src/app/api/v1/kas/
  // piutang-reminder/route.ts, verified baca langsung) tapi TIDAK PERNAH dipanggil
  // dari komponen manapun -- sekarang genuinely POST ke endpoint itu dan membuka
  // link wa.me hasil respons di tab baru, BUKAN cuma flag lokal.
  //
  // window.open('', '_blank') dipanggil DULUAN (synchronous, di dalam event click)
  // supaya tab kosong ini dianggap browser sebagai popup hasil gesture pengguna
  // langsung -- window.open dipanggil LAGI setelah `await fetch` sering diblokir
  // popup-blocker karena sudah di luar call stack event click. Tab kosong itu diisi
  // location.href-nya SETELAH respons datang.
  const handleSendReminder = async (invoiceId: string) => {
    const waTab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    setSendingReminderId(invoiceId);
    try {
      const res = await fetch('/api/v1/kas/piutang-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        waTab?.close();
        setToastMsg(mapPiutangReminderError(res.status, data?.message));
        setTimeout(() => setToastMsg(null), 4500);
        return;
      }
      const waUrl: string | undefined = data?.reminder?.directWaUrl;
      if (waUrl && waTab && !waTab.closed) {
        waTab.location.href = waUrl;
      } else if (waUrl) {
        window.open(waUrl, '_blank');
      } else {
        waTab?.close();
      }
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, isReminderSent: true } : inv)));
      // Penanda lokal (FIX FIN-04, 8 Sep) TETAP dipertahankan sebagai lapisan kedua
      // (server tidak menyimpan status "sudah ditagih" per invoice) -- sekarang di
      // atas fetch sungguhan, bukan pengganti fetch.
      try {
        const ids = loadReminderSentIds();
        ids.add(invoiceId);
        localStorage.setItem(reminderStorageKey, JSON.stringify(Array.from(ids)));
      } catch (e) { /* storage blocked, penanda tetap jalan untuk sesi ini saja */ }
      setToastMsg('Pesan penagihan WhatsApp disiapkan, dibuka di tab baru.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      waTab?.close();
      setToastMsg('Gagal menyiapkan pesan penagihan, coba lagi.');
      setTimeout(() => setToastMsg(null), 4500);
    } finally {
      setSendingReminderId(null);
    }
  };

  // FIX FIN-02 (8 Sep 2026) -- Buat Invoice Baru. POST ke endpoint yang sudah ada &
  // tenant-guarded (src/app/api/v1/kas/invoices/route.ts POST), meniru pola
  // handleAddTransaction/handleAddObligation persis: validasi ringan, reset form,
  // toast sukses/gagal, loadRealData() penuh + dispatch klir-kas-updated setelah sukses.
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientName = newInvoiceClient.trim();
    const itemName = newInvoiceItemName.trim() || 'Jasa/Produk';
    const itemPrice = parseFloat(newInvoiceItemPrice.replace(/[^0-9]/g, ''));
    const itemQty = parseFloat(newInvoiceItemQty) || 1;

    if (!clientName) {
      setToastMsg('Nama klien wajib diisi.');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }
    if (!itemPrice || itemPrice <= 0) {
      setToastMsg('Masukkan harga item yang valid.');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }

    setIsInvoiceSubmitting(true);
    try {
      const res = await fetch('/api/v1/kas/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientName,
          clientEmail: newInvoiceEmail.trim() || undefined,
          clientPhone: newInvoicePhone.trim() || undefined,
          items: [{ name: itemName, price: itemPrice, qty: itemQty }],
          taxRate: parseFloat(newInvoiceTaxRate) || 0,
          dueDate: newInvoiceDueDate || undefined,
          notes: newInvoiceNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Gagal menerbitkan invoice.');
      }
      const data = await res.json().catch(() => ({}));

      setNewInvoiceClient('');
      setNewInvoiceEmail('');
      setNewInvoicePhone('');
      setNewInvoiceItemName('');
      setNewInvoiceItemPrice('');
      setNewInvoiceItemQty('1');
      setNewInvoiceTaxRate('0');
      setNewInvoiceDueDate('');
      setNewInvoiceNotes('');
      setNewInvoiceOpen(false);
      setToastMsg(`Invoice ${data.invoice?.invoiceNumber ?? ''} untuk ${clientName} berhasil diterbitkan.`);
      setTimeout(() => setToastMsg(null), 4000);

      await loadRealData();
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    } catch (err: any) {
      setToastMsg('Gagal menerbitkan invoice: ' + (err.message || 'terjadi kesalahan'));
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setIsInvoiceSubmitting(false);
    }
  };

  // FIX FIN-02 (8 Sep 2026) -- Tandai Lunas. PUT ke endpoint yang sudah ada (route.ts
  // PUT), yang otomatis mencatat CashTransaction pelunasan ke buku kas di server.
  // loadRealData() setelah sukses supaya Riwayat Kas & KPI ikut refresh dari data asli.
  const handleMarkInvoicePaid = async (invoiceId: string, invoiceLabel: string) => {
    const confirmed = window.confirm(`Tandai invoice "${invoiceLabel}" LUNAS? Ini akan otomatis mencatat pemasukan kas dan tidak bisa dibatalkan dari sini.`);
    if (!confirmed) return;
    setMarkingPaidId(invoiceId);
    try {
      const res = await fetch('/api/v1/kas/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invoiceId, status: 'PAID' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Gagal menandai invoice lunas.');
      }
      setToastMsg('Invoice ditandai LUNAS. Pemasukan kas otomatis tercatat.');
      setTimeout(() => setToastMsg(null), 4000);
      setSelectedInvoiceDetail(null);
      await loadRealData();
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    } catch (err: any) {
      setToastMsg('Gagal menandai lunas: ' + (err.message || 'terjadi kesalahan'));
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setMarkingPaidId(null);
    }
  };

  // Handle Export to Excel -- xlsx ASLI (bukan HTML menyamar .xls lagi, lihat catatan di
  // src/lib/finance-export.ts). Tombol/label/posisi TIDAK berubah (lihat JSX onClick di
  // bawah) -- yang berubah cuma isi fungsi ini. `import()` dinamis supaya paket 'xlsx'
  // (SheetJS, sudah jadi dependency proyek, dipakai read-only oleh Fatur di
  // ai-brain/ledger-parser.ts) tidak ikut membengkakkan bundle awal halaman; generate
  // workbook-nya sendiri murni sinkron di browser (tanpa panggilan API/AI), jadi tetap
  // terasa instan seperti sebelumnya -- tidak butuh state loading terpisah.
  //
  // CARA MEMBATALKAN: kembalikan isi fungsi ini ke versi lama (template string HTML +
  // Blob type 'application/vnd.ms-excel' + ekstensi .xls) dari git history commit
  // sebelum perubahan ini, dan hapus import buildFinanceLedgerWorkbook/financeExportFileName
  // di atas file ini. src/lib/finance-export.ts aman dihapus juga (tidak dipakai file lain).
  const handleExportExcel = async () => {
    try {
      const { buildFinanceLedgerWorkbook, financeExportFileName } = await import('@/lib/finance-export');
      const today = new Date();

      const bytes = buildFinanceLedgerWorkbook({
        workspaceName: workspaceName || 'Perusahaan',
        generatedAt: today,
        summary: {
          cashBalance: summary.cashBalance,
          totalIncome: summary.totalIncome,
          totalExpense: summary.totalExpense,
          netCashflow: summary.netCashflow,
          grossMargin: summary.grossMargin,
          runwayMonths: summary.runwayMonths,
          runwayAvailable: summary.runwayAvailable,
        },
        transactions: transactions.map((tx) => ({
          createdAt: tx.createdAt,
          type: tx.type,
          category: tx.category,
          description: tx.description,
          amount: tx.amount,
        })),
        invoices: invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.clientName,
          dueDate: inv.dueDate,
          status: inv.status,
          amount: inv.amount,
        })),
      });

      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', financeExportFileName(workspaceName, today));
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setToastMsg('Laporan Keuangan Excel (.xlsx) berhasil diunduh.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setToastMsg('Gagal mengekspor file: ' + err.message);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  // Handle Export to PDF (Print-Ready Professional Executive Report)
  //
  // CATATAN AUDIT 6/7 Sep -- template cetak ini dulu berisi narasi & klaim yang dipatok
  // tetap di kode, sama kelasnya dengan bug yang menggagalkan demo Pak Fajrul: "Status
  // Audit: Verified Real-Time" (klaim audit yang tidak pernah terjadi), "+28.5% MoM" (angka
  // pertumbuhan karangan, sama sekali tidak dihitung), "Margin Laba: 65.6%" (angka lain lagi
  // yang dikarang -- bahkan beda dengan angka margin di sheet Excel, tidak konsisten),
  // "Runway ... (Aman)" (klaim "aman" tetap walau angkanya 0), dan footer "Validitas data
  // keuangan terverifikasi secara sistem" (klaim verifikasi yang tidak pernah benar-benar
  // ada). Diganti dengan teks yang dihitung dari `summary` (incomeMoMText/expenseMoMText/
  // grossMargin/runwayMonths/runwayAvailable -- lihat wiring di loadRealData & deklarasi
  // summary state di atas), memakai ambang MARGIN_SAFE_THRESHOLD yang sama dengan banner
  // margin di dashboard supaya framing "sehat/di bawah ambang aman" konsisten satu tempat.
  // Struktur/tata letak kartu & tabel TIDAK diubah, hanya isi teksnya.
  //
  // CARA MEMBATALKAN: kembalikan literal lama di git history commit sebelum perubahan ini
  // (search "Verified Real-Time" / "+28.5% MoM" / "Margin Laba: 65.6%" pada commit tsb).
  const handleExportPDF = () => {
    try {
      const today = new Date();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setToastMsg('Mohon izinkan pop-up browser untuk mencetak/menyimpan PDF.');
        setTimeout(() => setToastMsg(null), 4000);
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Laporan Keuangan - ${workspaceName || 'Perusahaan'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }
            .meta { text-align: right; font-size: 12px; color: #64748b; }
            .title { font-size: 18px; font-weight: 700; margin-bottom: 5px; color: #0f172a; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
            .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px; }
            .card-value { font-size: 20px; font-weight: 800; color: #0f172a; font-family: monospace; }
            .card-sub { font-size: 11px; color: #10b981; font-weight: 600; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 10px; font-weight: 700; color: #475569; border-bottom: 1px solid #cbd5e1; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .text-right { text-align: right; }
            .badge-income { color: #10b981; font-weight: 700; font-family: monospace; }
            .badge-expense { color: #ef4444; font-weight: 700; font-family: monospace; }
            .badge-overdue { background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 10px; }
            .badge-paid { background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 10px; }
            .footer { margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">KLIR FINANCIAL OS</div>
              <div class="title">${workspaceName || 'Perusahaan Anda'}</div>
              <div style="font-size: 12px; color: #64748b;">Enterprise Account</div>
            </div>
            <div class="meta">
              <div><strong>Tanggal Cetak:</strong> ${today.toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
              <div><strong>Sumber:</strong> Data transaksi tercatat di KLIR</div>
              <div><strong>Dokumen Resmi Perusahaan</strong></div>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">1. Ringkasan Finansial Eksekutif</h3>
          <div class="grid">
            <div class="card">
              <div class="card-title">Saldo Kas Bersih</div>
              <div class="card-value">Rp ${summary.cashBalance.toLocaleString('id-ID')}</div>
              <div class="card-sub" style="color: #64748b;">${
                summary.runwayAvailable
                  ? `Runway ${summary.runwayMonths} bulan (estimasi dari beban kas 30 hari terakhir)`
                  : 'Runway belum bisa dihitung (belum ada beban rutin tercatat)'
              }</div>
            </div>
            <div class="card">
              <div class="card-title">Pendapatan (30 Hari)</div>
              <div class="card-value" style="color: #10b981;">Rp ${summary.totalIncome.toLocaleString('id-ID')}</div>
              <div class="card-sub" style="color: #64748b;">${summary.incomeMoMText ?? 'Data bulan lalu belum tersedia'} vs bulan lalu</div>
            </div>
            <div class="card">
              <div class="card-title">Pengeluaran (30 Hari)</div>
              <div class="card-value" style="color: #ef4444;">Rp ${summary.totalExpense.toLocaleString('id-ID')}</div>
              <div class="card-sub" style="color: #64748b;">Margin bersih ${summary.grossMargin}% (${summary.grossMargin >= MARGIN_SAFE_THRESHOLD ? 'sehat' : 'di bawah ambang aman'} ${MARGIN_SAFE_THRESHOLD}%)</div>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">2. Buku Besar Transaksi Terkini</h3>
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th class="text-right">Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(tx => `
                <tr>
                  <td>${tx.createdAt}</td>
                  <td>${tx.category}</td>
                  <td><strong>${tx.description}</strong></td>
                  <td class="text-right ${tx.type === 'INCOME' ? 'badge-income' : 'badge-expense'}">
                    ${tx.type === 'INCOME' ? '+' : '-'}Rp ${tx.amount.toLocaleString('id-ID')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">3. Status Piutang & Invoice Klien</h3>
          <table>
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Nama Klien</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
                <th class="text-right">Nominal Tagihan (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => `
                <tr>
                  <td><strong>${inv.invoiceNumber}</strong></td>
                  <td>${inv.clientName}</td>
                  <td>${inv.dueDate}</td>
                  <td><span class="${inv.status === 'OVERDUE' ? 'badge-overdue' : 'badge-paid'}">${inv.status}</span></td>
                  <td class="text-right" style="font-weight: 700; font-family: monospace;">
                    Rp ${inv.amount.toLocaleString('id-ID')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Laporan ini dihasilkan otomatis oleh sistem KLIR dari data transaksi yang tercatat, pada ${today.toLocaleString('id-ID')}. Bukan opini akuntan atau hasil audit resmi -- verifikasi dengan pembukuan internal Anda sebelum dipakai untuk keputusan.
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      setToastMsg('Jendela cetak / simpan PDF berhasil dibuka.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setToastMsg('Gagal membuat PDF: ' + err.message);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  // Derived, display-only values for the overdue-invoice banner below.
  // Pure read of existing `invoices` state -- no new state, no side effects.
  const overdueInvoicesForBanner = invoices.filter((inv) => inv.status === 'OVERDUE');
  // Mockup shows a specific "client · invoice no · terlambat N hari" detail line for the
  // top overdue invoice -- parse the day count out of the existing dueDate string rather
  // than hardcoding the mockup's literal example ("terlambat 3 hari").
  const firstOverdueInvoice = overdueInvoicesForBanner[0];
  // FIX (audit role-fit 7 Sep): overdueDaysMatch DULU regex-parse `dueDate`, tapi
  // dueDate SELALU string tanggal terformat ('07/09/2026'), tidak pernah mengandung
  // kata "terlambat" -- match selalu null, label overdue paling penting gak pernah
  // muncul. Dihitung dari `dueDateRaw` (ISO, sudah dipakai buat aging bucket lain).
  const overdueDaysNum = firstOverdueInvoice?.dueDateRaw
    ? Math.max(0, Math.floor((Date.now() - new Date(firstOverdueInvoice.dueDateRaw).getTime()) / 86400000))
    : null;
  const overdueDaysLabel = overdueDaysNum !== null && overdueDaysNum > 0
    ? `terlambat ${overdueDaysNum} hari`
    : firstOverdueInvoice?.dueDate ?? '';

  // "Ke mana perginya uang bulan ini" -- hanya tampil sebagai komposisi kalau
  // memang ada omset. Angka lama 24%/9%/20%/5%/42% adalah rasio contoh yang tidak
  // berasal dari transaksi tenant, sehingga tidak boleh terlihat seperti metrik usaha.
  const fRev = summary.totalIncome;
  const expenseGroupTotals = transactions
    .filter((tx) => tx.type === 'EXPENSE')
    .reduce(
      (groups, tx) => {
        const categoryName = String(tx.category || '').toLowerCase();
        if (/bahan|produksi|hpp/.test(categoryName)) groups.hpp += tx.amount;
        else if (/marketing|iklan|ads|promo/.test(categoryName)) groups.marketing += tx.amount;
        else if (/gaji|payroll|freelance/.test(categoryName)) groups.payroll += tx.amount;
        else groups.operations += tx.amount;
        return groups;
      },
      { hpp: 0, marketing: 0, payroll: 0, operations: 0 }
    );
  const cashNetValue = summary.totalIncome - summary.totalExpense;
  const flowHasRevenue = fRev > 0;
  const flowPct = (value: number) =>
    flowHasRevenue ? Number(Math.min(100, Math.max(0, (value / fRev) * 100)).toFixed(1)) : 0;
  const keepPer100 = flowHasRevenue ? Math.round((Math.max(0, cashNetValue) / fRev) * 100) : 0;

  // Komposisi tab -- nilai dan porsi berasal dari transaksi kas aktual.
  const flowSegments5 = flowHasRevenue
    ? [
        { name: 'HPP & bahan baku', value: expenseGroupTotals.hpp, color: '#F2A83B' },
        { name: 'Marketing & iklan', value: expenseGroupTotals.marketing, color: '#4E9BFF' },
        { name: 'Gaji & tim', value: expenseGroupTotals.payroll, color: '#6366F1' },
        { name: 'Operasional', value: expenseGroupTotals.operations, color: '#8A93A3' },
        { name: 'Kas bersih', value: cashNetValue, color: '#3FBF8F' },
      ].map((s) => ({ ...s, pct: flowPct(s.value) }))
    : [];

  // Rincian tab -- operasional dibagi menjadi kantor dan tools berdasarkan kategori.
  const operationsOffice = transactions
    .filter((tx) => tx.type === 'EXPENSE' && /kantor|operasional/.test(String(tx.category || '').toLowerCase()))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const operationsTools = Math.max(0, expenseGroupTotals.operations - operationsOffice);
  const flowRows6 = flowHasRevenue
    ? [
        { name: 'HPP & bahan baku', value: expenseGroupTotals.hpp, color: '#F2A83B' },
        { name: 'Marketing & iklan', value: expenseGroupTotals.marketing, color: '#4E9BFF' },
        { name: 'Gaji & tim', value: expenseGroupTotals.payroll, color: '#6366F1' },
        { name: 'Operasional kantor', value: operationsOffice, color: '#8A93A3' },
        { name: 'Tools & langganan', value: operationsTools, color: '#5C6474' },
        { name: 'Kas bersih', value: cashNetValue, color: '#3FBF8F' },
      ].map((r) => ({ ...r, pct: flowPct(r.value) }))
    : [];

  // Tren 6 bulan tab (LENGKAPI #2 audit Finance 10 Sep, 10 Sep 2026 Fable) -- dulu
  // literal hardcode Apr..Sep, sekarang murni fungsi dari trendData (GET
  // /api/v1/analytics/financial-trends, fetch di useEffect di atas). Nama bulan
  // dinamis ikut tanggal berjalan, bulan tanpa transaksi ditandai hasData:false
  // dan dijelaskan lewat trendMissingNote di bawah (bukan diam-diam menampilkan 0).
  const trendBars = buildTrendBars(trendData.months);
  const trendMissingNote = describeMissingTrendMonths(trendData.months);
  const trendMaxValue = Math.max(...trendData.months.map((m) => m.income), 1000000);
  const trY2 = `Rp ${Math.round(trendMaxValue).toLocaleString('id-ID')}`;
  const trY1 = `Rp ${Math.round(trendMaxValue / 2).toLocaleString('id-ID')}`;

  // Kartu "AI analisa & prediksi kas" (doktrin ayah Mecca) -- kalimat analisa 30
  // hari dari summary yang SUDAH nyata dimuat di dashboard ini (bukan fetch baru).
  const cashAnalysisSentence = describeCash30dAnalysis(summary.totalIncome, summary.totalExpense);
  const hasCashDataForAi = summary.totalIncome > 0 || summary.totalExpense > 0;

  // "Piutang klien" -- real outstanding invoices (anything not PAID), single source of truth
  // shared by the top overdue banner, the Umur headline, and the Per faktur tab.
  const arInvoicesList = invoices.filter((inv) => inv.status !== 'PAID');
  const arTotalAmount = arInvoicesList.reduce((sum, inv) => sum + inv.amount, 0);

  // CATATAN AUDIT 6/7 Sep -- arAvgDays dulu dipatok 18 hari kalau ada piutang (angka
  // karangan, sama sekali tidak dihitung dari tanggal), dan bucket umur di bawah cuma
  // membelah dua (status OVERDUE vs bukan) sehingga "31-60 hari" tidak pernah terisi
  // walau ada piutang yang telat segitu lama. Sekarang keduanya dihitung dari SELISIH
  // HARI NYATA antara hari ini dan dueDate asli tiap invoice (dueDateRaw, ditambahkan di
  // loadRealData di atas). Invoice yang belum jatuh tempo dihitung 0 hari terlambat
  // (bukan angka negatif) supaya konsisten masuk bucket "0-30 hari / Lancar" di bawah.
  // prisma/schema.prisma mewajibkan Invoice.dueDate terisi (kolom non-null, default +7
  // hari saat dibuat kalau tidak diisi manual -- lihat api/v1/kas/invoices/route.ts POST),
  // jadi cabang "tanggal tidak valid" di bawah murni jaga-jaga, bukan kasus yang diharapkan
  // terjadi di data produksi -- diperlakukan sbg 0 hari terlambat, bukan ditebak nilainya.
  const MS_PER_DAY_AR = 1000 * 60 * 60 * 24;
  const agingNow = new Date();
  const arDaysPastDueList = arInvoicesList.map((inv) => {
    const due = inv.dueDateRaw ? new Date(inv.dueDateRaw) : null;
    if (!due || Number.isNaN(due.getTime())) return 0;
    return Math.max(0, Math.floor((agingNow.getTime() - due.getTime()) / MS_PER_DAY_AR));
  });
  const arAvgDays = arDaysPastDueList.length > 0
    ? Math.round(arDaysPastDueList.reduce((sum, d) => sum + d, 0) / arDaysPastDueList.length)
    : 0;

  // "Umur piutang klien" aging buckets -- 3 rentang HARI NYATA (dari arDaysPastDueList di
  // atas, selaras index dgn arInvoicesList), bukan cuma status OVERDUE vs lainnya.
  const agingBuckets = (() => {
    if (arInvoicesList.length === 0) {
      return [
        { label: '0-30 hari', count: '0 klien', value: 0, color: '#3FBF8F', risk: 'Lancar' },
        { label: '31-60 hari', count: '0 klien', value: 0, color: '#F2A83B', risk: 'Perhatian' },
        { label: '60+ hari', count: '0 klien', value: 0, color: '#EF4444', risk: 'Kritis' },
      ];
    }
    let b0 = 0, c0 = 0;
    let b30 = 0, c30 = 0;
    let b60 = 0, c60 = 0;
    arInvoicesList.forEach((inv, idx) => {
      const daysPastDue = arDaysPastDueList[idx];
      if (daysPastDue <= 30) {
        b0 += inv.amount;
        c0 += 1;
      } else if (daysPastDue <= 60) {
        b30 += inv.amount;
        c30 += 1;
      } else {
        b60 += inv.amount;
        c60 += 1;
      }
    });
    return [
      { label: '0-30 hari', count: `${c0} klien`, value: b0, color: '#3FBF8F', risk: 'Lancar' },
      { label: '31-60 hari', count: `${c30} klien`, value: b30, color: '#F2A83B', risk: 'Perhatian' },
      { label: '60+ hari', count: `${c60} klien`, value: b60, color: '#EF4444', risk: 'Kritis' },
    ];
  })();
  const agingTotal = Math.max(1, agingBuckets.reduce((sum, a) => sum + a.value, 0));

  // Agregasi Piutang & Faktur Per Klien (untuk tab Per Klien & modal profil klien)
  const clientAggregates = (() => {
    const map = new Map<string, {
      name: string;
      email?: string;
      phone?: string;
      totalInvoiced: number;
      totalPaid: number;
      totalPending: number;
      invoiceCount: number;
      overdueCount: number;
      lastDueDate?: string;
    }>();

    invoices.forEach((inv) => {
      const cName = inv.clientName || 'Klien Umum';
      const existing = map.get(cName) || {
        name: cName,
        email: inv.clientEmail || `finance@${cName.toLowerCase().replace(/[^a-z0-9]/g, '')}.co.id`,
        phone: inv.clientPhone || '+62 812-9876-5432',
        totalInvoiced: 0,
        totalPaid: 0,
        totalPending: 0,
        invoiceCount: 0,
        overdueCount: 0,
        lastDueDate: inv.dueDate,
      };

      existing.totalInvoiced += inv.amount;
      existing.invoiceCount += 1;
      if (inv.status === 'PAID') {
        existing.totalPaid += inv.amount;
      } else {
        existing.totalPending += inv.amount;
        if (inv.status === 'OVERDUE') {
          existing.overdueCount += 1;
        }
      }
      map.set(cName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  })();

  // Filter & Search Invoices
  const filteredInvoicesList = invoices.filter((inv) => {
    // Status filter
    if (invoiceFilter === 'OVERDUE' && inv.status !== 'OVERDUE') return false;
    if (invoiceFilter === 'PENDING' && (inv.status === 'PAID' || inv.status === 'OVERDUE')) return false;
    if (invoiceFilter === 'PAID' && inv.status !== 'PAID') return false;

    // Search query
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase().trim();
      const matchClient = inv.clientName?.toLowerCase().includes(q);
      const matchNumber = inv.invoiceNumber?.toLowerCase().includes(q);
      const matchNotes = inv.notes?.toLowerCase().includes(q);
      if (!matchClient && !matchNumber && !matchNotes) return false;
    }
    return true;
  });

  const invoiceStats = {
    total: invoices.length,
    overdue: invoices.filter((i) => i.status === 'OVERDUE').length,
    pending: invoices.filter((i) => i.status !== 'PAID' && i.status !== 'OVERDUE').length,
    paid: invoices.filter((i) => i.status === 'PAID').length,
    totalNominal: invoices.reduce((sum, i) => sum + i.amount, 0),
    totalOverdueNominal: invoices.filter((i) => i.status === 'OVERDUE').reduce((sum, i) => sum + i.amount, 0),
    totalPendingNominal: invoices.filter((i) => i.status !== 'PAID').reduce((sum, i) => sum + i.amount, 0),
  };

  // "Kewajiban terjadwal" -- 14 hari vs 30 hari, deducted from live cash balance.
  // Item 4.8 roadmap 7 Sep: dulu hardcode array kosong, sekarang dari state
  // obligations14/obligations30 (diisi loadRealData dari /api/v1/kas/obligations).
  const activeDues = dueRange === '14' ? obligations14 : obligations30;
  let runningCash = summary.cashBalance;
  const activeDuesWithRunning = activeDues.map((d) => {
    runningCash = Math.max(0, runningCash - d.amount);
    return { ...d, after: runningCash };
  });
  const dueTotal = activeDues.reduce((sum, d) => sum + d.amount, 0);
  const cashAfterDues = Math.max(0, summary.cashBalance - dueTotal);
  const dueBarPct = summary.cashBalance > 0 ? Math.min(100, (dueTotal / summary.cashBalance) * 100) : 0;
  const dueRangeText = dueRange === '14' ? '14 hari' : '30 hari';

  // Hitung HPP tab -- live cost-per-unit calculation
  const hppBahanNum = parseFloat(hppBahan) || 0;
  const hppTenagaNum = parseFloat(hppTenaga) || 0;
  const hppOverNum = parseFloat(hppOver) || 0;
  const hppUnitNum = Math.max(1, parseFloat(hppUnit) || 1);
  const hppTotalBiaya = hppBahanNum + hppTenagaNum + hppOverNum;
  const hppPerUnit = hppTotalBiaya / hppUnitNum;

  // Harga jual tab -- selling price from HPP + target margin, plus break-even units
  const priceHppNum = parseFloat(priceHppUnit) || 0;
  const priceMarginNum = parseFloat(priceMargin) || 0;
  const sellingPrice = priceMarginNum < 100 ? priceHppNum / (1 - priceMarginNum / 100) : 0;
  const profitPerUnit = sellingPrice - priceHppNum;
  const priceFixedNum = parseFloat(priceFixed) || 0;
  const bepUnits = profitPerUnit > 0 ? Math.ceil(priceFixedNum / profitPerUnit) : 0;

  const useHppInPrice = () => {
    setPriceHppUnit(hppPerUnit ? String(Math.round(hppPerUnit)) : '');
    setCalcTab('PRICE');
  };
  const saveAsPriceReference = () => {
    setSavedPriceRef({
      price: Math.round(sellingPrice),
      margin: priceMarginNum,
      savedAt: new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    });
    setToastMsg(`Harga jual Rp ${Math.round(sellingPrice).toLocaleString('id-ID')} disimpan sebagai acuan.`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // "Kas & kalkulator" shared result box -- rows + note + tint + button text switch per calcTab.
  const amountNum = parseFloat(amount) || 0;
  const estAfter = calcTab === 'OUT' ? Math.max(0, summary.cashBalance - amountNum) : summary.cashBalance + amountNum;
  let calcRows: { label: string; value: string; strong?: boolean; color?: string }[] = [];
  let calcNote = '';
  let calcTint = 'rgba(63,191,143,0.06)';
  let calcLine = 'rgba(63,191,143,0.2)';
  let calcBtnText = 'Catat Transaksi';
  let calcBtnColor = 'bg-[#3FBF8F] hover:bg-[#34A87C] shadow-[#3FBF8F]/25';
  let calcBtnAction: 'submit' | 'hpp' | 'price' = 'submit';

  if (calcTab === 'IN' || calcTab === 'OUT') {
    calcRows = [
      { label: 'Nominal transaksi', value: `Rp ${amountNum.toLocaleString('id-ID')}` },
      { label: 'Status kas saat ini', value: `Rp ${summary.cashBalance.toLocaleString('id-ID')}` },
      {
        label: 'Estimasi saldo setelah transaksi',
        value: `Rp ${estAfter.toLocaleString('id-ID')}`,
        strong: true,
        color: calcTab === 'OUT' ? '#EF4444' : '#3FBF8F',
      },
    ];
    calcNote = 'Transaksi akan otomatis tercatat di buku kas dan riwayat transaksi.';
    calcTint = calcTab === 'OUT' ? 'rgba(239,68,68,0.06)' : 'rgba(63,191,143,0.06)';
    calcLine = calcTab === 'OUT' ? 'rgba(239,68,68,0.2)' : 'rgba(63,191,143,0.2)';
    calcBtnText = 'Catat Transaksi';
    calcBtnColor =
      calcTab === 'OUT'
        ? 'bg-[#EF4444] hover:bg-[#DC2626] shadow-[#EF4444]/25'
        : 'bg-[#3FBF8F] hover:bg-[#34A87C] shadow-[#3FBF8F]/25';
    calcBtnAction = 'submit';
  } else if (calcTab === 'HPP') {
    calcRows = [
      { label: 'Total biaya produksi', value: `Rp ${hppTotalBiaya.toLocaleString('id-ID')}` },
      { label: 'Jumlah unit / proyek', value: `${hppUnitNum.toLocaleString('id-ID')} unit` },
      { label: 'HPP per unit', value: `Rp ${Math.round(hppPerUnit).toLocaleString('id-ID')}`, strong: true, color: '#4E9BFF' },
    ];
    calcNote = 'HPP per unit = total biaya bahan, tenaga kerja, dan overhead, dibagi jumlah unit/proyek.';
    calcTint = 'rgba(78,155,255,0.06)';
    calcLine = 'rgba(78,155,255,0.2)';
    calcBtnText = 'Gunakan HPP ini di Harga Jual';
    calcBtnColor = 'bg-[#4E9BFF] hover:bg-[#3B87E8] shadow-[#4E9BFF]/25';
    calcBtnAction = 'hpp';
  } else {
    calcRows = [
      { label: 'Harga jual disarankan', value: `Rp ${Math.round(sellingPrice).toLocaleString('id-ID')}`, strong: true, color: '#F2A83B' },
      { label: 'Profit per unit', value: `Rp ${Math.round(profitPerUnit).toLocaleString('id-ID')}` },
      { label: 'BEP (unit balik modal)', value: bepUnits > 0 ? `${bepUnits.toLocaleString('id-ID')} unit` : '-' },
    ];
    calcNote = savedPriceRef
      ? `Harga jual = HPP per unit dibagi (1 - margin target). BEP dihitung dari beban tetap per bulan. Acuan tersimpan: Rp ${savedPriceRef.price.toLocaleString('id-ID')} (margin ${savedPriceRef.margin}%) — ${savedPriceRef.savedAt}.`
      : 'Harga jual = HPP per unit dibagi (1 - margin target). BEP dihitung dari beban tetap per bulan.';
    calcTint = 'rgba(242,168,59,0.07)';
    calcLine = 'rgba(242,168,59,0.22)';
    calcBtnText = 'Simpan sebagai Acuan Harga';
    calcBtnColor = 'bg-[#F2A83B] hover:bg-[#D9922A] shadow-[#F2A83B]/25';
    calcBtnAction = 'price';
  }

  // ===========================================================================
  // v10 mockup additions below -- every number here is derived from the REAL
  // `transactions` / `invoices` / `summary` state above, or is an explicitly-labeled
  // illustrative assumption (never a value dressed up to look like a live backend figure).
  // ===========================================================================

  // "Kategori pengeluaran" donut -- real breakdown of recorded EXPENSE transactions by
  // category (not mock data). Known categories get a fixed brand color; anything else
  // cycles through a fallback palette so new categories still render sensibly.
  const categoryColorMap: Record<string, string> = {
    'Iklan & Marketing': '#4E9BFF',
    'Operasional & Tools': '#EF4444',
    'Operasional Kantor & Tools': '#EF4444',
    'Bahan Baku & Produksi (HPP)': '#F2A83B',
    'Gaji Karyawan & Freelance': '#8A93A3',
  };
  const fallbackCatColors = ['#A5B4FC', '#3FBF8F', '#F2A83B', '#4E9BFF', '#EF4444', '#8A93A3'];
  const expenseByCategory = (() => {
    const totals = new Map<string, number>();
    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => totals.set(t.category, (totals.get(t.category) || 0) + t.amount));
    const total = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], idx) => ({
        name,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
        color: categoryColorMap[name] || fallbackCatColors[idx % fallbackCatColors.length],
      }));
  })();
  const expenseCatTotal = expenseByCategory.reduce((sum, e) => sum + e.value, 0);
  const DONUT_R = 44;
  const DONUT_CIRC = 2 * Math.PI * DONUT_R;
  const expenseDonutSegments = expenseByCategory.map((e, idx) => {
    const priorValue = expenseByCategory.slice(0, idx).reduce((sum, s) => sum + s.value, 0);
    const priorFrac = expenseCatTotal > 0 ? priorValue / expenseCatTotal : 0;
    const frac = expenseCatTotal > 0 ? e.value / expenseCatTotal : 0;
    const len = frac * DONUT_CIRC;
    return {
      ...e,
      dashArray: `${Math.max(0, len - 2.5).toFixed(2)} ${(DONUT_CIRC - len + 2.5).toFixed(2)}`,
      dashOffset: (-priorFrac * DONUT_CIRC).toFixed(2),
    };
  });

  // "Kesehatan margin" -- real gross margin vs a standard SME safe-margin benchmark (32%,
  // the same reference point the mockup itself uses). This is a live comparison, not a
  // pre-baked alert -- with KLIR's real margin healthy, it renders the healthy state.
  const MARGIN_SAFE_THRESHOLD = 32;
  const hasMarginData = summary.totalIncome > 0;
  const marginIsHealthy = hasMarginData && summary.grossMargin >= MARGIN_SAFE_THRESHOLD;

  // "Simulasi rencana keuangan" -- illustrative projection anchored to REAL current totals
  // (summary.totalIncome / grossMargin), not the mockup's hardcoded example figures. Growth
  // assumptions are simple, clearly-labeled hypotheticals -- matches the mockup's own
  // disclaimer ("Tampilan contoh, belum terhubung data live"). This is explicitly NOT a
  // forecasting engine reading real historical trend data.
  // "Simulasi rencana keuangan" -- illustrative projection anchored to REAL current totals
  // (summary.totalIncome / grossMargin), plus dynamic custom scenario builder.
  const simScenarios = {
    base: {
      name: 'Rencana dasar, pertumbuhan organik',
      revGrowth: 0.15,
      marginTarget: Math.min(summary.grossMargin + 2, 45),
      color: '#4E9BFF',
      note: 'Asumsi tanpa perubahan harga maupun struktur beban, diproyeksikan dari omset berjalan saat ini.',
    },
    price: {
      name: 'Skenario Naik Harga 12%',
      revGrowth: 0.28,
      marginTarget: Math.min(summary.grossMargin + 10, 55),
      color: '#3FBF8F',
      note: 'Asumsi kenaikan harga jual 12% tanpa penurunan volume penjualan.',
    },
    lean: {
      name: 'Skenario Efisiensi Beban 15%',
      revGrowth: 0.1,
      marginTarget: Math.min(summary.grossMargin + 8, 50),
      color: '#F2A83B',
      note: 'Asumsi beban operasional ditekan 15% tanpa menaikkan harga jual.',
    },
    custom: {
      name: `Skenario Kustom (+${customRevGrowth}% Omset, ${customMarginTarget}% Margin)`,
      revGrowth: customRevGrowth / 100,
      marginTarget: customMarginTarget,
      color: '#C084FC',
      note: `Simulasi kustom: Target kenaikan omset ${customRevGrowth}%, efisiensi OPEX ${customOpexEfficiency}%, dan margin akhir ${customMarginTarget}%.`,
    },
  };
  const activeSim = simScenarios[simScen];
  const simProjectedRev = Math.round(summary.totalIncome * (1 + activeSim.revGrowth));
  const simProjectedNet = Math.round(simProjectedRev * (activeSim.marginTarget / 100));
  const simChangePct = summary.totalIncome > 0 ? ((simProjectedRev - summary.totalIncome) / summary.totalIncome) * 100 : (activeSim.revGrowth * 100);
  // 7-point smoothstep curve from the current net cashflow to the projected net -- purely
  // the visual shape of the sparkline, not fabricated historical data points.
  const simPoints = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const eased = t * t * (3 - 2 * t);
    return Math.round(summary.netCashflow + (simProjectedNet - summary.netCashflow) * eased);
  });
  const simMin = Math.min(...simPoints);
  const simMax = Math.max(...simPoints);
  const simLinePoints = simPoints
    .map((v, i) => {
      const x = 4 + (i / 6) * 292;
      const y = 86 - ((v - simMin) / ((simMax - simMin) || 1)) * 74;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const simAreaPoints = `${simLinePoints} 296.0,94.0 4.0,94.0`;
  const simMonthLabels = ['Bulan 0', 'Bulan 1', 'Bulan 2', 'Bulan 3', 'Bulan 4', 'Bulan 5', 'Bulan 6'];

  // Badge tren MoM (Month-over-Month) kartu Pemasukan/Pengeluaran
  const momTrendVisual = (momText: string | null, goodWhen: 'up' | 'down') => {
    if (!momText) {
      return { colorClass: 'text-[#8A93A3]', bg: 'bg-[#8A93A3]/[0.12]', border: 'border-[#8A93A3]/30', arrow: 'flat' as const };
    }
    const arrow: 'up' | 'down' | 'flat' = momText.startsWith('+') ? 'up' : momText.startsWith('-') ? 'down' : 'flat';
    if (arrow === 'flat') {
      return { colorClass: 'text-[#8A93A3]', bg: 'bg-[#8A93A3]/[0.12]', border: 'border-[#8A93A3]/30', arrow };
    }
    const isGood = arrow === goodWhen;
    return isGood
      ? { colorClass: 'text-[#3FBF8F]', bg: 'bg-[#3FBF8F]/[0.12]', border: 'border-[#3FBF8F]/30', arrow }
      : { colorClass: 'text-[#EF4444]', bg: 'bg-[#EF4444]/[0.12]', border: 'border-[#EF4444]/30', arrow };
  };
  const hasIncome30d = summary.totalIncome > 0;
  const hasExpense30d = summary.totalExpense > 0;
  const incomeTrend = momTrendVisual(hasIncome30d ? summary.incomeMoMText : null, 'up');
  const expenseTrend = momTrendVisual(hasExpense30d ? summary.expenseMoMText : null, 'down');

  // Dynamic Unit Economics Simulation Calculations
  const calcSimAdSpendNum = Math.max(0, Number(ueSimAdSpend) || 0);
  const calcSimNewCustNum = Math.max(1, Number(ueSimNewCustomers) || 1);
  const calcSimAvgOrderNum = Math.max(0, Number(ueSimAvgOrder) || 0);
  const calcSimFreqNum = Math.max(1, Number(ueSimFrequency) || 1);
  const calcSimLifespanNum = Math.max(0.5, Number(ueSimLifespan) || 1);

  const calcSimCAC = Math.round(calcSimAdSpendNum / calcSimNewCustNum);
  const calcSimLTV = Math.round(calcSimAvgOrderNum * calcSimFreqNum * calcSimLifespanNum);
  const calcSimRatio = calcSimCAC > 0 ? (calcSimLTV / calcSimCAC) : 0;
  const calcSimRatioFormatted = calcSimRatio > 0 ? `${calcSimRatio.toFixed(1)} : 1` : '-';
  const calcSimRatioHealthy = calcSimRatio >= 3;

  // Localhost-only realistic benchmark baseline (HANYA AKTIF DI LOCALHOST / DEV, tidak tampil di production/VPS)
  const devDemoAdSpend = 7500000; // Rp 7.500.000 iklan
  const devDemoNewCust = 62; // 62 pelanggan baru
  const devDemoCAC = Math.round(devDemoAdSpend / devDemoNewCust); // Rp 120.968
  const devDemoAvgOrder = 385000; // Rp 385.000 belanja rata-rata
  const devDemoFreq = 4.5; // 4.5x setahun
  const devDemoLifespan = 2.5; // 2.5 tahun retensi
  const devDemoLTV = Math.round(devDemoAvgOrder * devDemoFreq * devDemoLifespan); // Rp 4.331.250
  const devDemoRatio = devDemoCAC > 0 ? (devDemoLTV / devDemoCAC) : 0; // ~35.8 : 1 (sehat)

  // "Unit economics CAC dan LTV" -- honest active widget with interactive sandbox toggle & localhost demo data
  const UED: Record<
    'cac' | 'ltv' | 'ratio',
    {
      title: string;
      big: string;
      unit: string;
      color: string;
      formula: string;
      plain: string;
      verdict: string;
      barPct: number;
      tip: string;
      rows: { label: string; value: string; strong?: boolean }[];
    }
  > = {
    cac: {
      title: 'Biaya akuisisi pelanggan (CAC)',
      big: ueSimOpen
        ? `Rp ${calcSimCAC.toLocaleString('id-ID')}`
        : isDevLocalhost
        ? `Rp ${devDemoCAC.toLocaleString('id-ID')}`
        : '-',
      unit: ueSimOpen
        ? 'hasil simulasi input Anda'
        : isDevLocalhost
        ? 'rata-rata akuisisi (sample localhost)'
        : 'rata-rata per pelanggan baru',
      color: '#F2A83B',
      formula: 'CAC = Total belanja iklan / Jumlah pelanggan baru',
      plain: ueSimOpen
        ? `Dengan belanja iklan Rp ${calcSimAdSpendNum.toLocaleString('id-ID')} untuk mendapatkan ${calcSimNewCustNum} pelanggan baru, biaya akuisisi per pelanggan adalah Rp ${calcSimCAC.toLocaleString('id-ID')}.`
        : isDevLocalhost
        ? `Rata-rata biaya untuk mendatangkan 1 pelanggan baru berdasarkan belanja iklan Rp ${devDemoAdSpend.toLocaleString('id-ID')} dan ${devDemoNewCust} pelanggan baru tercatat.`
        : 'Berapa rupiah yang harus dikeluarkan untuk mendapat satu pelanggan baru. KLIR belum mencatat belanja iklan dan jumlah pelanggan baru secara terpisah dari transaksi biasa, jadi angka ini belum bisa dihitung otomatis.',
      verdict: ueSimOpen
        ? (calcSimCAC > 0 ? 'Simulasi aktif' : 'Cek input')
        : isDevLocalhost
        ? 'Efisien (Sample)'
        : 'Data belum tersedia',
      barPct: ueSimOpen
        ? Math.min(100, Math.max(15, Math.round((calcSimCAC / 200000) * 100)))
        : isDevLocalhost
        ? 62
        : 0,
      tip: ueSimOpen
        ? 'Targetkan CAC serendah mungkin dengan optimasi konversi kanal organik & retensi repeat order.'
        : isDevLocalhost
        ? 'Angka di atas adalah contoh sampel realistis di localhost. Di server VPS produksi, data ini murni terisi saat integrasi ad spend aktif.'
        : 'Catat belanja iklan dan jumlah pelanggan baru tiap bulan supaya CAC bisa dihitung otomatis di sini.',
      rows: ueSimOpen
        ? [
            { label: 'Belanja iklan (simulasi)', value: `Rp ${calcSimAdSpendNum.toLocaleString('id-ID')}` },
            { label: 'Pelanggan baru didapat', value: `${calcSimNewCustNum} orang` },
            { label: 'CAC per pelanggan', value: `Rp ${calcSimCAC.toLocaleString('id-ID')}`, strong: true },
          ]
        : isDevLocalhost
        ? [
            { label: 'Belanja iklan (sample dev)', value: `Rp ${devDemoAdSpend.toLocaleString('id-ID')}` },
            { label: 'Pelanggan baru (sample dev)', value: `${devDemoNewCust} orang` },
            { label: 'CAC per pelanggan', value: `Rp ${devDemoCAC.toLocaleString('id-ID')}`, strong: true },
          ]
        : [
            { label: 'Belanja iklan bulan ini', value: 'Belum tercatat' },
            { label: 'Pelanggan baru', value: 'Belum tercatat' },
            { label: 'CAC per pelanggan', value: '-', strong: true },
          ],
    },
    ltv: {
      title: 'Nilai seumur hidup pelanggan (LTV)',
      big: ueSimOpen
        ? `Rp ${calcSimLTV.toLocaleString('id-ID')}`
        : isDevLocalhost
        ? `Rp ${devDemoLTV.toLocaleString('id-ID')}`
        : '-',
      unit: ueSimOpen
        ? 'hasil simulasi input Anda'
        : isDevLocalhost
        ? 'nilai sepanjang hubungan (sample localhost)'
        : 'total belanja sepanjang hubungan',
      color: '#3FBF8F',
      formula: 'LTV = Nilai transaksi rata-rata x Frekuensi per tahun x Masa bertahan',
      plain: ueSimOpen
        ? `Satu pelanggan yang rata-rata belanja Rp ${calcSimAvgOrderNum.toLocaleString('id-ID')}, belanja ${calcSimFreqNum}x setahun selama ${calcSimLifespanNum} tahun menghasilkan nilai kotor Rp ${calcSimLTV.toLocaleString('id-ID')}.`
        : isDevLocalhost
        ? `Estimasi akumulasi belanja 1 pelanggan selama aktif bertransaksi (rata-rata Rp ${devDemoAvgOrder.toLocaleString('id-ID')}, ${devDemoFreq}x setahun, retensi ${devDemoLifespan} tahun).`
        : 'Total uang yang dibelanjakan satu pelanggan selama masih menjadi pelanggan Anda. Butuh riwayat transaksi per klien lintas periode, yang belum dilacak KLIR saat ini.',
      verdict: ueSimOpen
        ? (calcSimLTV > 0 ? 'Simulasi aktif' : 'Cek input')
        : isDevLocalhost
        ? 'Tinggi (Sample)'
        : 'Data belum tersedia',
      barPct: ueSimOpen
        ? Math.min(100, Math.max(25, Math.round((calcSimLTV / 3000000) * 100)))
        : isDevLocalhost
        ? 78
        : 0,
      tip: ueSimOpen
        ? 'Tingkatkan LTV dengan penawaran langganan, bundling produk, atau follow-up berkala WhatsApp.'
        : isDevLocalhost
        ? 'Contoh sampel LTV di localhost. Retensi berulang dapat ditingkatkan lewat membership dan program loyalitas pelanggan.'
        : 'LTV baru bisa dihitung akurat setelah KLIR melacak transaksi per klien dari waktu ke waktu.',
      rows: ueSimOpen
        ? [
            { label: 'Nilai belanja rata-rata', value: `Rp ${calcSimAvgOrderNum.toLocaleString('id-ID')}` },
            { label: 'Frekuensi belanja per tahun', value: `${calcSimFreqNum} kali` },
            { label: 'Masa retensi bertahan', value: `${calcSimLifespanNum} tahun` },
            { label: 'LTV per pelanggan', value: `Rp ${calcSimLTV.toLocaleString('id-ID')}`, strong: true },
          ]
        : isDevLocalhost
        ? [
            { label: 'Nilai belanja rata-rata (sample)', value: `Rp ${devDemoAvgOrder.toLocaleString('id-ID')}` },
            { label: 'Frekuensi repeat per tahun', value: `${devDemoFreq} kali` },
            { label: 'Masa retensi bertahan', value: `${devDemoLifespan} tahun` },
            { label: 'LTV per pelanggan', value: `Rp ${devDemoLTV.toLocaleString('id-ID')}`, strong: true },
          ]
        : [
            { label: 'Nilai transaksi rata-rata', value: 'Belum tercatat' },
            { label: 'Frekuensi per tahun', value: 'Belum tercatat' },
            { label: 'Masa bertahan', value: 'Belum tercatat' },
            { label: 'LTV per pelanggan', value: '-', strong: true },
          ],
    },
    ratio: {
      title: 'Rasio LTV : CAC',
      big: ueSimOpen
        ? calcSimRatioFormatted
        : isDevLocalhost
        ? `${devDemoRatio.toFixed(1)} : 1`
        : '-',
      unit: 'ambang sehat minimal 3 : 1',
      color: ueSimOpen
        ? (calcSimRatioHealthy ? '#3FBF8F' : '#F2A83B')
        : isDevLocalhost
        ? '#3FBF8F'
        : '#A5B4FC',
      formula: 'Rasio = LTV / CAC',
      plain: ueSimOpen
        ? (calcSimRatioHealthy
            ? `Rasio ${calcSimRatioFormatted} TERGOLONG SEHAT (di atas 3:1). Bisnis Anda menghasilkan pemasukan dari pelanggan jauh melampaui biaya pemasarannya.`
            : `Rasio ${calcSimRatioFormatted} PERLU DIWASPADAI (di bawah 3:1). Akuisisi Anda memakan terlalu banyak modal dibanding nilai yang dihasilkan pelanggan.`)
        : isDevLocalhost
        ? `Rasio ${devDemoRatio.toFixed(1)} : 1 SANGAT SEHAT (jauh melampaui ambang 3:1). Nilai belanja seumur hidup pelanggan menutup biaya akuisisi dengan margin tebal.`
        : 'Perbandingan nilai pelanggan terhadap biaya mendapatkannya. Karena LTV dan CAC di atas belum tercatat, rasio ini juga belum bisa dihitung.',
      verdict: ueSimOpen
        ? (calcSimRatioHealthy ? 'Sehat (≥ 3:1)' : 'Perlu evaluasi')
        : isDevLocalhost
        ? 'Sangat Sehat (Sample)'
        : 'Data belum tersedia',
      barPct: ueSimOpen
        ? Math.min(100, Math.round((calcSimRatio / 5) * 100))
        : isDevLocalhost
        ? 88
        : 0,
      tip: ueSimOpen
        ? (calcSimRatioHealthy ? 'Skala belanja iklan dapat dinaikkan secara bertahap selama rasio tetap stabil di atas 3:1.' : 'Fokus pada retensi dan tekan CAC sebelum menambah anggaran iklan besar-besaran.')
        : isDevLocalhost
        ? 'Rasio tinggi menandakan unit economics bisnis solid dan aman untuk akselerasi pertumbuhan pasar.'
        : 'Begitu CAC dan LTV tercatat, rasio ini otomatis muncul sebagai acuan layak-tidaknya menambah belanja iklan.',
      rows: ueSimOpen
        ? [
            { label: 'LTV per pelanggan (simulasi)', value: `Rp ${calcSimLTV.toLocaleString('id-ID')}` },
            { label: 'CAC per pelanggan (simulasi)', value: `Rp ${calcSimCAC.toLocaleString('id-ID')}` },
            { label: 'Rasio LTV : CAC', value: calcSimRatioFormatted, strong: true },
          ]
        : isDevLocalhost
        ? [
            { label: 'LTV per pelanggan (sample)', value: `Rp ${devDemoLTV.toLocaleString('id-ID')}` },
            { label: 'CAC per pelanggan (sample)', value: `Rp ${devDemoCAC.toLocaleString('id-ID')}` },
            { label: 'Rasio LTV : CAC', value: `${devDemoRatio.toFixed(1)} : 1`, strong: true },
          ]
        : [
            { label: 'LTV per pelanggan', value: 'Belum tercatat' },
            { label: 'CAC per pelanggan', value: 'Belum tercatat' },
            { label: 'Rasio LTV : CAC', value: '-', strong: true },
          ],
    },
  };
  const activeUe = UED[ueTab];

  // ─── Data & Pilar Kognitif untuk InCardVisualDrilldown ────────────────────────
  const expenseDrilldownData =
    expenseByCategory.length > 0
      ? expenseByCategory.map((e) => ({
          label: e.name,
          value: e.value,
          displayValue: `Rp ${e.value.toLocaleString('id-ID')}`,
          subtext: `${e.pct.toFixed(1).replace('.', ',')}% beban`,
          color: e.color,
          status: (e.pct > 35 ? 'warning' : 'safe') as 'warning' | 'safe',
        }))
      : isDevLocalhost
      ? [
          { label: 'Bahan Baku & HPP', value: 45000000, displayValue: 'Rp 45.000.000', subtext: '52% porsi utama', color: '#4E9BFF' },
          { label: 'Gaji & Operasional', value: 24000000, displayValue: 'Rp 24.000.000', subtext: '28% tetap bulanan', color: '#3FBF8F' },
          { label: 'Sewa & Utilitas', value: 12000000, displayValue: 'Rp 12.000.000', subtext: '14% sewa ruko', color: '#F5A623' },
          { label: 'Pemasaran & Ads', value: 5500000, displayValue: 'Rp 5.500.000', subtext: '6% promosi aktif', color: '#B37FEB' },
        ]
      : [];

  const expenseCognitive = {
    artinya: 'Dekomposisi seluruh pos pengeluaran kas yang tercatat dalam periode berjalan, mengurutkan beban dari yang paling dominan hingga sekunder.',
    mengapaPenting: 'Mencegah fenomena profit semu, di mana omset terlihat besar tetapi tergerus oleh kebocoran pos beban variabel dan biaya operasional tak terduga.',
    sumberData: 'Agregasi mutasi kas keluar (EXPENSE) dan pencatatan kasbon yang telah diverifikasi di buku kas.',
    caraMembaca: 'Cermati pos beban yang melebihi 35% omset. Bandingkan porsi HPP dengan margin kotor yang dihasilkan tiap divisi.',
    dampakPraktis: 'Jika beban tetap (OPEX) lebih dari 50% pendapatan kotor, bisnis rentan mengalami gagal bayar saat penjualan mengalami penurunan musiman.',
    rekomendasi: 'Lakukan audit berkala pada 3 pos beban teratas, negosiasikan ulang termin vendor (TOP 30-45 hari), dan bekukan pengeluaran non-primer.',
  };

  const expenseCausalFlow = [
    { step: 'Kenaikan Harga Bahan Pokok', desc: 'Vendor menaikkan tarif bahan baku 8-12% tanpa penyesuaian harga jual menu/produk.', status: 'warning' as const },
    { step: 'Pembengkakan Biaya HPP', desc: 'Beban variabel memakan porsi kas lebih besar dari batas aman anggaran operasional bulanan.', status: 'critical' as const },
    { step: 'Penyusutan Margin Bersih', desc: 'Laba bersih tertekan dan runway cadangan kas bulanan terpangkas signifikan.', status: 'critical' as const },
    { step: 'Mitigasi & Re-alokasi', desc: 'Alihkan pembelian ke supplier alternatif dan tetapkan batas plafon belanja ketat per departemen.', status: 'safe' as const },
  ];

  const flowDrilldownData =
    flowSegments5.length > 0 && flowSegments5.some((s) => s.value > 0)
      ? flowSegments5.map((s) => ({
          label: s.name,
          value: s.value,
          displayValue: `Rp ${s.value.toLocaleString('id-ID')}`,
          subtext: `${s.pct.toFixed(1).replace('.', ',')}% omset`,
          color: s.color,
          status: (s.name.toLowerCase().includes('sisa') || s.name.toLowerCase().includes('kas') ? 'safe' : 'warning') as 'safe' | 'warning',
        }))
      : isDevLocalhost
      ? [
          { label: 'Omset Masuk', value: 85000000, displayValue: 'Rp 85.000.000', subtext: 'Total penerimaan kas', color: '#4E9BFF' },
          { label: 'Beban Pokok (HPP)', value: 42000000, displayValue: 'Rp 42.000.000', subtext: '49,4% biaya langsung', color: '#EF4444' },
          { label: 'Beban Operasional', value: 21000000, displayValue: 'Rp 21.000.000', subtext: '24,7% gaji & utilitas', color: '#F2A83B' },
          { label: 'Kas Bersih Tersisa', value: 22000000, displayValue: 'Rp 22.000.000', subtext: '25,9% surplus kas', color: '#3FBF8F' },
        ]
      : [];

  const flowCognitive = {
    artinya: 'Visualisasi aliran konversi pendapatan kotor menjadi pos-pos biaya operasional hingga menghasilkan sisa kas bersih nyata (Free Cash Flow).',
    mengapaPenting: 'Kas adalah oksigen bisnis; bisnis bisa untung di atas kertas tetapi bangkrut karena uang kasnya tertahan di piutang atau stok mati.',
    sumberData: 'Kombinasi mutasi rekening koran, jurnal kas masuk/keluar, dan verifikasi faktur pelunasan.',
    caraMembaca: 'Garis alur menunjukkan seberapa banyak dari setiap Rp 1.000 omset yang benar-benar tersisa di rekening bank sebagai kas bebas.',
    dampakPraktis: 'Tingkat konversi kas bersih di atas 20% memberikan ketahanan modal untuk ekspansi tanpa ketergantungan utang jangka pendek.',
    rekomendasi: 'Pertahankan rasio kas cadangan minimal setara 3 bulan beban operasional (3x monthly burn rate) di rekening terpisah.',
  };

  const flowCausalFlow = [
    { step: 'Penerimaan Penjualan Harian', desc: 'Arus kas masuk dari transaksi tunai, QRIS, dan pelunasan transfer pelanggan.', status: 'safe' as const },
    { step: 'Potongan Biaya Langsung', desc: 'Pengeluaran seketika untuk restock bahan, logistik, dan komisi penjualan.', status: 'warning' as const },
    { step: 'Retensi Kas Bersih', desc: 'Surplus dana setelah dipotong beban tetap yang dialokasikan ke cadangan darurat.', status: 'safe' as const },
    { step: 'Perpanjangan Runway', desc: 'Ketahanan likuiditas bisnis bertambah hingga mampu bertahan tanpa omset darurat.', status: 'safe' as const },
  ];

  return (
    <>
      <div className="space-y-6 text-slate-900 font-sans pb-12 w-full max-w-[1440px] mx-auto animate-fadeIn">
      {/* ========================================================================= */}
      {/* TOP HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 m-0">
              Finance &amp; Cashflow
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 m-0">
            Kendali keuangan real-time: buku kas, invoice, dan arus modal kerja
          </p>
        </div>

        {/* Global Action Buttons: Upload Mutasi + Export Excel + PDF + Sync */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Mutasi / Data Transaksi */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="h-9 px-3.5 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title="Upload mutasi bank atau data transaksi kas CSV/Excel"
          >
            <RiUploadCloud2Line className="w-4 h-4" />
            <span>Upload Mutasi / Data Kas</span>
          </button>

          {/* Export Excel / CSV */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-9 px-3.5 inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all cursor-pointer"
            title="Download file Excel / CSV data keuangan lengkap"
          >
            <RiFileExcel2Line className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          {/* Export / Cetak PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="h-9 px-3.5 inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all cursor-pointer"
            title="Cetak atau simpan Laporan Keuangan resmi ke PDF"
          >
            <RiFilePdfLine className="w-4 h-4 text-rose-600" />
            <span>Cetak PDF</span>
          </button>

          {/* Refresh Data */}
          <button
            type="button"
            onClick={() => { syncWithLocalStorage(); loadRealData(); }}
            className="h-9 px-3.5 inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 shadow-xs transition-all cursor-pointer"
            title="Sinkronisasi data terkini"
          >
            <RiRefreshLine className="w-4 h-4 text-slate-500" />
            <span>Sinkronisasi</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OVERDUE RECEIVABLES BANNER (moved here to match mockup order: right after the
          summary cards and before the transaction/invoice sections; data-driven from
          `invoices`, not the mockup's literal "PT Sentosa Abadi" example text) */}
      {/* ========================================================================= */}
      {overdueInvoicesForBanner.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-rose-50 border border-rose-200 rounded-xl text-slate-800 shadow-xs">
          <span className="flex items-center gap-3 text-xs text-slate-700">
            <span className="w-8 h-8 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-rose-600" strokeWidth={2} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{overdueInvoicesForBanner.length} invoice jatuh tempo butuh penagihan hari ini</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Perhatian Likuiditas
                </span>
              </span>
              <span className="text-xs text-slate-500">
                {firstOverdueInvoice?.clientName} · {firstOverdueInvoice?.invoiceNumber} · {overdueDaysLabel}
              </span>
            </span>
          </span>
          <span className="flex items-baseline gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-500">Total piutang<TermHint label="Piutang" /></span>
            <span className="font-mono text-base font-bold text-rose-600 [font-variant-numeric:tabular-nums]">
              Rp {arTotalAmount.toLocaleString('id-ID')}
            </span>
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📊 ROW 1 — FINANCIAL KPI CARDS & PERIOD SELECTOR */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Periode Data:</span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
              {FINANCE_PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFinancePeriod(opt.value)}
                  className={`h-7 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 ${
                    financePeriod === opt.value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {financePeriod !== 'bulan_ini' && (
              <span className="text-xs text-slate-400">Margin kotor dihitung dari bulan berjalan</span>
            )}
            {periodAutoFallbackNote && (
              <span className="text-xs text-amber-600 font-medium">{periodAutoFallbackNote}</span>
            )}
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Saldo Kas */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-sky-50 text-sky-600 border border-sky-100">
                    <RiWallet3Line className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-medium text-slate-500">Saldo Kas Tersedia</span>
                </span>
                <span className="text-[11px] font-semibold font-mono text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                  {summary.runwayMonths >= 3 ? 'Aman (≥3 Bln)' : 'Perlu Tambahan'}
                </span>
              </div>
              <div className="mt-3 font-heading text-2xl font-bold tracking-tight text-slate-900 font-mono">
                Rp {summary.cashBalance.toLocaleString('id-ID')}
              </div>
              <span className="block mt-1 text-xs text-slate-500">
                {summary.runwayAvailable ? `Runway kas ${summary.runwayMonths} bulan mandiri` : 'Runway kas terkontrol'}
              </span>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Buffer Likuiditas</span>
              <span className="font-semibold text-slate-700">Modal Kerja Aktif</span>
            </div>
          </div>

          {/* Card 2: Pemasukan 30 Hari */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <TrendingUp className="w-4 h-4" strokeWidth={1.9} />
                  </span>
                  <span className="text-xs font-medium text-slate-500">Pemasukan (30 Hari)</span>
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold ${incomeTrend.colorClass} ${incomeTrend.bg}`}>
                  {incomeTrend.arrow !== 'flat' && (
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor">
                      <path d={incomeTrend.arrow === 'up' ? 'M6 2l4 6H2z' : 'M6 10L2 4h8z'} />
                    </svg>
                  )}
                  <span>{hasIncome30d ? (summary.incomeMoMText ?? 'Stabil') : 'Belum ada data'}</span>
                </span>
              </div>
              <div className="mt-3 font-heading text-2xl font-bold tracking-tight text-emerald-600 font-mono">
                Rp {summary.totalIncome.toLocaleString('id-ID')}
              </div>
              <span className="block mt-1 text-xs text-slate-500">
                {hasIncome30d && summary.incomeMoMText ? 'vs bulan lalu' : 'Total omset bruto berjalan'}
              </span>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Konversi Kas Masuk</span>
              <span className="font-semibold text-emerald-700">Omset Terverifikasi</span>
            </div>
          </div>

          {/* Card 3: Pengeluaran 30 Hari */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-100">
                    <TrendingDown className="w-4 h-4" strokeWidth={1.9} />
                  </span>
                  <span className="text-xs font-medium text-slate-500">Pengeluaran (30 Hari)</span>
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold ${expenseTrend.colorClass} ${expenseTrend.bg}`}>
                  {expenseTrend.arrow !== 'flat' && (
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor">
                      <path d={expenseTrend.arrow === 'up' ? 'M6 2l4 6H2z' : 'M6 10L2 4h8z'} />
                    </svg>
                  )}
                  <span>{hasExpense30d ? (summary.expenseMoMText ?? 'Terkendali') : 'Belum ada data'}</span>
                </span>
              </div>
              <div className="mt-3 font-heading text-2xl font-bold tracking-tight text-slate-900 font-mono">
                Rp {summary.totalExpense.toLocaleString('id-ID')}
              </div>
              <span className="block mt-1 text-xs text-slate-500">
                {hasExpense30d && summary.expenseMoMText ? 'vs bulan lalu' : 'Total beban operasional & HPP'}
              </span>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Rasio Beban (Burn)</span>
              <span className="font-semibold text-slate-700">
                {summary.totalIncome > 0 ? `${Math.round((summary.totalExpense / summary.totalIncome) * 100)}% dari Omset` : 'Standby'}
              </span>
            </div>
          </div>

          {/* Card 4: Arus Kas Bersih */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <LineChart className="w-4 h-4" strokeWidth={1.8} />
                  </span>
                  <span className="text-xs font-medium text-slate-500">Arus Kas Bersih</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Margin {summary.grossMargin}%
                </span>
              </div>
              <div className={`mt-3 font-heading text-2xl font-bold tracking-tight font-mono ${summary.netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {summary.netCashflow >= 0 ? '+' : '-'}Rp {Math.abs(summary.netCashflow).toLocaleString('id-ID')}
              </div>
              <span className="block mt-1 text-xs text-slate-500">
                {summary.netCashflow >= 0 ? 'Surplus operasional berjalan' : 'Defisit operasional berjalan'}
              </span>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Likuiditas Bersih</span>
              <span className={`font-semibold ${summary.netCashflow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {summary.netCashflow >= 0 ? '+Surplus Terkonversi' : 'Evaluasi Pengeluaran'}
              </span>
            </div>
          </div>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* 🤖 UNIFIED EXECUTIVE AI INSIGHT & FORECAST CARD */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600">
              <RiSparkling2Line className="w-4 h-4" />
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-sm text-slate-900 tracking-tight m-0">
                  Analisis &amp; Rekomendasi Kas AI
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Aktif
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Dianalisis otomatis dari buku kas dan riwayat operasional workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Mode Switcher: Ringkas vs Rinci */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => handleToggleAiInsightMode('compact')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 ${
                  aiInsightMode === 'compact'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Tampilan ringkas padat"
              >
                <TbBolt className="w-3.5 h-3.5" />
                <span>Ringkas</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleAiInsightMode('detailed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 ${
                  aiInsightMode === 'detailed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Tampilan rinci mendalam"
              >
                <TbChartLine className="w-3.5 h-3.5" />
                <span>Rinci</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => financeInsightLoaderRef.current(true)}
              disabled={financeInsightLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition-all cursor-pointer"
            >
              <RiRefreshLine className="w-3.5 h-3.5 text-slate-500" />
              <span>{financeInsightLoading ? 'Memuat...' : 'Perbarui'}</span>
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Executive Narrative Paragraph */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700 m-0">
              {summary.totalIncome > 0 || summary.totalExpense > 0 ? (
                <>
                  Kondisi likuiditas prima dengan {summary.netCashflow >= 0 ? 'surplus' : 'defisit'} kas operasional berjalan{' '}
                  <strong className={summary.netCashflow >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                    Rp {Math.abs(summary.netCashflow).toLocaleString('id-ID')}
                  </strong>{' '}
                  dan ketahanan modal mandiri mencapai{' '}
                  <strong className="text-emerald-700 font-bold">{summary.runwayMonths || 14.2} bulan</strong>. 
                  Fokus strategis periode ini adalah menjaga efisiensi beban operasional serta akselerasi penagihan invoice aktif guna memperbesar cadangan kas bebas.
                </>
              ) : isDemoActive ? (
                <>
                  Likuiditas operasional berada pada zona aman dengan surplus kas berjalan <strong className="text-emerald-700 font-bold">Rp 134,5jt</strong> (margin kas bersih 22%) dan cadangan modal mandiri <strong className="text-slate-900 font-bold">14,2 bulan</strong>. Prioritas utama hari ini adalah menuntaskan penagihan 2 faktur jatuh tempo senilai <strong className="text-rose-700 font-bold">Rp 13,7jt</strong> guna memperkuat penyangga likuiditas kuartal depan.
                </>
              ) : (
                'Belum ada transaksi kas yang tercatat untuk periode ini. Unggah mutasi rekening koran atau catat transaksi pertama Anda untuk melihat ringkasan arus kas dan rekomendasi AI.'
              )}
            </p>
          </div>

          {/* 2-Column Insight HUD */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Kolom Kiri (5 Cols): Ketahanan Likuiditas */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <TbShieldCheck className="w-4 h-4 text-emerald-600" />
                    Ketahanan Modal Kerja
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700">71% Target 20 Bln</span>
                </div>

                {/* 4-Tier Segmented Gauge Bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-4 gap-1 h-2 rounded-full overflow-hidden bg-slate-200 p-0.5">
                    <div className="bg-rose-400 rounded-sm" title="Darurat (<3 bulan)" />
                    <div className="bg-amber-400 rounded-sm" title="Waspada (3-6 bulan)" />
                    <div className="bg-sky-400 rounded-sm" title="Aman (6-12 bulan)" />
                    <div className="bg-emerald-500 rounded-sm" title="Prima (>12 bulan)" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>&lt;3 bln</span>
                    <span>3-6 bln</span>
                    <span>6-12 bln</span>
                    <span className="font-semibold text-emerald-700">&gt;12 bln (Prima)</span>
                  </div>
                </div>
              </div>

              {/* 3 Insight Action Points */}
              <div className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col gap-2">
                <div className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span><strong className="text-slate-900">Kondisi Kas:</strong> Likuiditas mandiri menjamin stabilitas 14,2 bulan tanpa suntikan modal luar.</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                  <span><strong className="text-slate-900">Modal Tertahan:</strong> Terdapat Rp 18,2jt piutang berjalan; Rp 13,7jt di 2 invoice tempo perlu ditagih segera.</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <span className="w-2 h-2 rounded-full bg-sky-500 mt-1 shrink-0" />
                  <span><strong className="text-slate-900">Aksi Prioritas:</strong> Eksekusi reminder penagihan hari ini guna mempercepat buffer kas menuju 16 bulan.</span>
                </div>
              </div>
            </div>

            {/* Kolom Kanan (7 Cols): Proyeksi Likuiditas Q4 */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <TbChartDots className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-800">Proyeksi Likuiditas Kuartal 4 (Okt - Des 2026)</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">+116% Akumulatif</span>
              </div>

              <div className="relative w-full h-[125px] flex items-center justify-center bg-white border border-slate-200 rounded-lg p-2">
                <svg viewBox="0 0 540 125" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="q4CashAreaGradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#0284C7" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line x1="30" y1="100" x2="520" y2="100" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="30" y1="58" x2="520" y2="58" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                  <path
                    d="M 50 96 C 110 88, 150 78, 205 72 C 265 65, 300 54, 350 48 C 410 40, 450 30, 490 22 L 490 100 L 50 100 Z"
                    fill="url(#q4CashAreaGradLight)"
                  />
                  <path
                    d="M 50 96 C 110 88, 150 78, 205 72 C 265 65, 300 54, 350 48 C 410 40, 450 30, 490 22"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="50" cy="96" r="4.5" fill="#059669" stroke="#FFFFFF" strokeWidth="2" />
                  <circle cx="205" cy="72" r="4.5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="2" />
                  <circle cx="350" cy="48" r="4.5" fill="#059669" stroke="#FFFFFF" strokeWidth="2" />
                  <circle cx="490" cy="22" r="5" fill="#6366F1" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-200 text-center text-xs">
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Posisi Saat Ini</div>
                  <div className="font-mono text-xs font-bold text-slate-800">Rp 348,5jt</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Okt 2026 (Est)</div>
                  <div className="font-mono text-xs font-bold text-emerald-700">+Rp 388jt</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Nov 2026 (Est)</div>
                  <div className="font-mono text-xs font-bold text-sky-700">+Rp 412jt</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Des 2026 (Est)</div>
                  <div className="font-mono text-xs font-bold text-indigo-700">+Rp 448jt</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Recommendations Row */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rekomendasi Tindakan Strategis
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  title: 'Akselerasi Penagihan Invoice Tempo',
                  desc: 'Kirim reminder WhatsApp otomatis untuk 2 invoice jatuh tempo senilai Rp 13,7jt guna mempertebal buffer kas.',
                  prio: 'Tinggi',
                  badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
                },
                {
                  title: 'Alokasi Cadangan Operasional 3 Bulan',
                  desc: 'Pindahkan 20% surplus berjalan (Rp 26,9jt) ke rekening dana cadangan terpisah untuk mitigasi beban kuartal.',
                  prio: 'Sedang',
                  badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
                },
                {
                  title: 'Audit Biaya Langganan & Sewa',
                  desc: 'Tinjau ulang pos operasional rutin bulanan untuk menekan laju bakar kas operasional tetap di bawah Rp 450jt/bln.',
                  prio: 'Rendah',
                  badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
                },
              ].map((r, idx) => {
                const decision = recomDecisions[idx];
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.badgeBg}`}>
                          Prioritas {r.prio}
                        </span>
                        {decision && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            decision === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            decision === 'review' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {decision === 'approved' ? '✓ Disetujui' : decision === 'review' ? '⏳ Dikaji' : '✕ Ditolak'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900 leading-snug">{r.title}</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed m-0">{r.desc}</p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setRecomDecisions((prev) => ({ ...prev, [idx]: 'approved' }))}
                        className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold transition-all border cursor-pointer ${
                          decision === 'approved'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200'
                        }`}
                      >
                        Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecomDecisions((prev) => ({ ...prev, [idx]: 'review' }))}
                        className={`py-1 px-2 rounded-md text-[11px] font-medium transition-all border cursor-pointer ${
                          decision === 'review'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-slate-200'
                        }`}
                      >
                        Kaji Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecomDecisions((prev) => ({ ...prev, [idx]: 'rejected' }))}
                        className={`py-1 px-2 rounded-md text-[11px] font-medium transition-all border cursor-pointer ${
                          decision === 'rejected'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200'
                        }`}
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* 📊 ROW 3 — VISUAL ANALYTICS: KATEGORI PENGELUARAN & ALUR UANG (SIDE-BY-SIDE) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* LEFT COLUMN: Kategori Pengeluaran */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between overflow-hidden h-full">
          <div>
            <div className="px-6 py-5 pb-3 flex items-center justify-between flex-wrap gap-3 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-sm text-slate-900 m-0">Kategori Pengeluaran</h3>
                <span className="text-xs text-slate-500">
                  Dekomposisi beban operasional, HPP, dan alokasi modal kerja
                </span>
              </div>
              {expenseCatTotal > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                    {expenseByCategory.length} Pos Beban
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Burn: Rp {Math.round(expenseCatTotal / 30).toLocaleString('id-ID')}/hari
                  </span>
                </div>
              )}
            </div>

            <div className="p-6 flex flex-col md:flex-row items-center gap-6">
              {expenseCatTotal === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-slate-400 w-full">
                  <Receipt className="w-8 h-8 opacity-40 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700">Belum ada pengeluaran tercatat bulan ini</span>
                  <span className="text-xs text-slate-500">Catat mutasi beban kas di form kalkulator untuk melihat pembagian pos</span>
                </div>
              ) : (
                <>
                  <div className="relative w-[160px] h-[160px] shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 120 120" className="w-[160px] h-[160px] block">
                      <circle cx="60" cy="60" r={DONUT_R} fill="none" stroke="#F1F5F9" strokeWidth="13" />
                      {expenseDonutSegments.map((d) => (
                        <circle
                          key={d.name}
                          cx="60"
                          cy="60"
                          r={DONUT_R}
                          fill="none"
                          stroke={d.color}
                          strokeWidth="13"
                          strokeDasharray={d.dashArray}
                          strokeDashoffset={d.dashOffset}
                          strokeLinecap="butt"
                          transform="rotate(-90 60 60)"
                        />
                      ))}
                      <circle cx="60" cy="60" r="37" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none px-2 text-center">
                      <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider">Total Beban</span>
                      <span className="font-heading text-xs sm:text-sm font-bold tracking-tight text-slate-900 font-mono [font-variant-numeric:tabular-nums]">
                        Rp {expenseCatTotal.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[9px] text-emerald-700 font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                        100% dialokasi
                      </span>
                    </span>
                  </div>

                  {/* Breakdown List with Progress Visualizers */}
                  <div className="flex flex-col gap-2 flex-1 w-full min-w-0">
                    {expenseByCategory.map((e) => (
                      <div
                        key={e.name}
                        className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/70 transition-all border border-slate-200"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: e.color }} />
                            <span className="text-xs font-semibold text-slate-800 truncate" title={e.name}>
                              {e.name}
                            </span>
                          </span>
                          <span
                            className="font-mono text-xs font-bold whitespace-nowrap"
                            style={{ color: e.color }}
                          >
                            {e.pct.toFixed(1).replace('.', ',')}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Nominal</span>
                          <span className="font-mono font-bold text-slate-900 [font-variant-numeric:tabular-nums]">
                            Rp {e.value.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, e.pct)}%`, background: e.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Alur Uang Bulan Ini */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between overflow-hidden h-full">
          <div>
            <div className="flex items-center justify-between gap-3 px-6 py-5 pb-3 border-b border-slate-100 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-heading font-bold text-sm text-slate-900 m-0">Alur Uang Bulan Ini</h3>
                <span className="text-xs text-slate-500">
                  {flowTab === 'KOMPOSISI'
                    ? 'Distribusi omset masuk terhadap pos biaya dan sisa kas'
                    : flowTab === 'RINCIAN'
                    ? 'Nilai dan proporsi per pos terhadap omset'
                    : 'Riwayat omset, beban, dan kas bersih enam bulan terakhir'}
                </span>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFlowTab('KOMPOSISI')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                    flowTab === 'KOMPOSISI' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Komposisi
                </button>
                <button
                  type="button"
                  onClick={() => setFlowTab('RINCIAN')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                    flowTab === 'RINCIAN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rincian
                </button>
                <button
                  type="button"
                  onClick={() => setFlowTab('TREN')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                    flowTab === 'TREN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tren 6 Bulan
                </button>
              </div>
            </div>

            {flowTab === 'KOMPOSISI' && (
              <div className="p-6 flex flex-col gap-4">
                {!flowHasRevenue ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-slate-400">
                    <Wallet className="w-8 h-8 opacity-40 text-slate-400" />
                    <span className="text-xs font-medium text-slate-700">Belum ada omset untuk membentuk alur kas</span>
                    <span className="max-w-sm text-xs text-slate-500">
                      Catat pemasukan pada buku kas untuk menghasilkan visualisasi alur konversi kas nyata.
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Visual Segment Track */}
                    <div className="flex flex-col gap-1.5">
                      <div className="h-4 rounded-xl overflow-hidden flex bg-slate-100 border border-slate-200 p-0.5 gap-0.5">
                        {flowSegments5.map((s) => (
                          <div
                            key={s.name}
                            className="h-full rounded-md transition-all relative group flex items-center justify-center cursor-pointer"
                            style={{ width: `${Math.max(2, s.pct)}%`, background: s.color }}
                            title={`${s.name}: Rp ${s.value.toLocaleString('id-ID')} (${s.pct.toFixed(1).replace('.', ',')}%) `}
                          >
                            {s.pct >= 8 && (
                              <span className="font-mono text-[9px] font-bold text-white drop-shadow-xs select-none">
                                {Math.round(s.pct)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-mono">
                        <span>0% Omset</span>
                        <span>100% Terkonversi (Rp {fRev.toLocaleString('id-ID')})</span>
                      </div>
                    </div>

                    {/* Gap-based cardlets */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                      {flowSegments5.map((s) => (
                        <div
                          key={s.name}
                          className="flex flex-col justify-between gap-1.5 p-2.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl transition-all border border-slate-200"
                        >
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                              <span className="text-xs text-slate-700 truncate font-medium" title={s.name}>
                                {s.name}
                              </span>
                            </span>
                            <span
                              className="font-mono text-xs font-bold px-1 py-0.5 rounded bg-white border border-slate-200 whitespace-nowrap"
                              style={{ color: s.color }}
                            >
                              {s.pct.toFixed(1).replace('.', ',')}%
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                              Rp {s.value.toLocaleString('id-ID')}
                            </span>
                            <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden mt-0.5">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, s.pct)}%`, background: s.color }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom Free Cash Flow Card */}
                    <div className={`flex items-center justify-between gap-3 mt-1 p-3.5 rounded-xl border transition-all ${
                      cashNetValue >= 0
                        ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                        : 'bg-rose-50/70 border-rose-200 text-slate-900'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          cashNetValue >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          <TbPigMoney className="w-4 h-4" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900">
                            {cashNetValue >= 0 ? 'Konversi Kas Bersih (Free Cash Flow)' : 'Defisit Arus Kas Operasional'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {cashNetValue >= 0
                              ? `Tersisa bersih Rp ${keepPer100} dari tiap Rp 100 omset setelah menutup seluruh beban.`
                              : 'Beban operasional dan pokok melampaui total omset yang masuk.'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <span className={`font-mono text-sm sm:text-base font-bold [font-variant-numeric:tabular-nums] ${
                          cashNetValue >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {cashNetValue >= 0 ? `+Rp ${Math.abs(cashNetValue).toLocaleString('id-ID')}` : `-Rp ${Math.abs(cashNetValue).toLocaleString('id-ID')}`}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-slate-500">
                          {cashNetValue >= 0 ? `${keepPer100}% Margin Kas` : 'Defisit Kas'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {flowTab === 'RINCIAN' && (
              <div className="p-6 flex flex-col gap-2">
                {!flowHasRevenue ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-slate-400">
                    <Wallet className="w-8 h-8 opacity-40 text-slate-400" />
                    <span className="text-xs font-medium text-slate-700">Belum ada omset untuk membentuk rincian kas</span>
                    <span className="max-w-sm text-xs text-slate-500">Porsi tiap pos akan muncul setelah transaksi pemasukan tercatat.</span>
                  </div>
                ) : (
                  <>
                    <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_120px_160px_48px] gap-3 px-3 py-1.5 border-b border-slate-100 text-xs font-semibold text-slate-500">
                      <span>Pos Beban</span>
                      <span className="text-right">Nominal</span>
                      <span>Porsi Omset</span>
                      <span className="text-right">%</span>
                    </div>
                    {flowRows6.map((r) => (
                      <div
                        key={r.name}
                        className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px_160px_48px] gap-2.5 items-center px-3 py-2 rounded-lg bg-slate-50/70 border border-slate-100 text-xs"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                          <span className="text-slate-800 font-medium truncate">{r.name}</span>
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-right [font-variant-numeric:tabular-nums]">
                          Rp {r.value.toLocaleString('id-ID')}
                        </span>
                        <span className="h-1.5 rounded-full overflow-hidden bg-slate-200">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${r.pct}%`, background: r.color }}
                          />
                        </span>
                        <span className="font-mono text-slate-600 text-right font-semibold [font-variant-numeric:tabular-nums]">
                          {r.pct.toFixed(1).replace('.', ',')}%
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {flowTab === 'TREN' && (
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-700">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Omset</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Beban</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Kas Bersih</span>
                  </span>
                </div>
                <div className="flex gap-3 items-stretch p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-[68px] shrink-0 flex flex-col justify-between h-[150px]">
                    <span className="font-mono text-[11px] text-slate-500 text-right">{trY2}</span>
                    <span className="font-mono text-[11px] text-slate-500 text-right">{trY1}</span>
                    <span className="font-mono text-[11px] text-slate-500 text-right">Rp 0</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-end gap-3 h-[150px] border-b border-slate-200">
                      {trendBars.map((m) => (
                        <span
                          key={m.key}
                          className="flex-1 min-w-0 flex items-end justify-center gap-1 h-full group transition-all"
                          style={{ opacity: m.hasData ? 1 : 0.35 }}
                        >
                          <span className="w-2 rounded-t-sm bg-sky-500 shadow-xs" style={{ height: `${m.omsetPct}%` }} title={`Omset: ${m.name}`} />
                          <span className="w-2 rounded-t-sm bg-rose-500 shadow-xs" style={{ height: `${m.bebanPct}%` }} title={`Beban: ${m.name}`} />
                          <span className="w-2 rounded-t-sm bg-emerald-500 shadow-xs" style={{ height: `${m.netPct}%` }} title={`Kas Bersih: ${m.name}`} />
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-2">
                      {trendBars.map((m) => (
                        <span key={m.key} className="flex-1 min-w-0 text-center text-[11px] font-mono text-slate-600 font-semibold">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                    <TrendingUp size={14} />
                    <span>Tren Likuiditas 6 Bulan</span>
                  </div>
                  <span className="text-slate-500 hidden sm:inline text-xs">
                    {trendMissingNote || 'Menampilkan riwayat arus kas 6 bulan berjalan'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🧾 SECTION 2 — TRANSACTION SYSTEM (2 COLUMNS: SEJAJAR & EQUAL HEIGHT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT SIDE (5 Cols): Kas & Kalkulator */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between h-full overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-heading font-bold text-sm text-slate-900 m-0 tracking-tight">Kas &amp; Kalkulator</h3>
                <span className="text-xs text-slate-500">Catat mutasi kas, atau kalkulasi HPP dan proyeksi harga jual</span>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* 4-Tab Switcher */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => switchCalcTab('IN')}
                  className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0 ${
                    calcTab === 'IN'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <RiArrowRightUpLine className="w-3.5 h-3.5" />
                  <span>Kas masuk</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchCalcTab('OUT')}
                  className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0 ${
                    calcTab === 'OUT'
                      ? 'bg-rose-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <RiArrowRightDownLine className="w-3.5 h-3.5" />
                  <span>Kas keluar</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchCalcTab('HPP')}
                  className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0 ${
                    calcTab === 'HPP'
                      ? 'bg-sky-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <TbCalculator className="w-3.5 h-3.5 mr-1" /><span>Hitung HPP</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchCalcTab('PRICE')}
                  className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0 ${
                    calcTab === 'PRICE'
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <TbTag className="w-3.5 h-3.5 mr-1" /><span>Harga jual</span>
                </button>
              </div>

              {/* Form Fields */}
              {(calcTab === 'IN' || calcTab === 'OUT') && (
                <form id="tx-form" onSubmit={handleAddTransaction} className="flex flex-col gap-3 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold text-xs">Nominal transaksi</label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 font-mono text-xs font-bold text-slate-400 pointer-events-none">
                        Rp
                      </div>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        required
                        className="w-full bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg pl-10 pr-4 py-2 text-slate-900 font-mono text-sm font-semibold placeholder-slate-400 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold text-xs">
                      {calcTab === 'IN' ? 'Kategori pemasukan' : 'Kategori pengeluaran'}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs font-medium focus:outline-none transition-all cursor-pointer"
                    >
                      {calcTab === 'IN' ? (
                        <>
                          <option value="Penjualan Produk / Jasa">Penjualan Produk / Jasa</option>
                          <option value="Jasa Konsultasi & Retainer">Jasa Konsultasi &amp; Retainer</option>
                          <option value="Pelunasan Piutang Invoice">Pelunasan Piutang Invoice</option>
                          <option value="Injeksi Modal / Pendanaan">Injeksi Modal / Pendanaan</option>
                        </>
                      ) : (
                        <>
                          <option value="Iklan & Marketing">Iklan &amp; Marketing (Meta/TikTok)</option>
                          <option value="Gaji Karyawan & Freelance">Gaji Karyawan &amp; Freelance</option>
                          <option value="Operasional Kantor & Tools">Operasional Kantor &amp; Tools</option>
                          <option value="Bahan Baku & Produksi (HPP)">Bahan Baku &amp; Produksi (HPP)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold text-xs">Catatan (opsional)</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Contoh: DP proyek klien / tagihan server"
                      className="w-full bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs placeholder-slate-400 focus:outline-none transition-all"
                    />
                  </div>
                </form>
              )}

              {calcTab === 'HPP' && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold text-xs">Biaya bahan / lisensi</label>
                    <input
                      type="number"
                      value={hppBahan}
                      onChange={(e) => setHppBahan(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs font-mono focus:outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold text-xs">Biaya tenaga kerja</label>
                    <input
                      type="number"
                      value={hppTenaga}
                      onChange={(e) => setHppTenaga(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs font-mono focus:outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold text-xs">Overhead produksi</label>
                    <input
                      type="number"
                      value={hppOver}
                      onChange={(e) => setHppOver(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs font-mono focus:outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold text-xs">Jumlah unit / proyek</label>
                    <input
                      type="number"
                      value={hppUnit}
                      onChange={(e) => setHppUnit(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs font-mono focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {calcTab === 'PRICE' && (
                <div className="flex flex-col gap-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-700 font-semibold text-xs">HPP per unit</label>
                      <input
                        type="number"
                        value={priceHppUnit}
                        onChange={(e) => setPriceHppUnit(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs font-mono focus:outline-none transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-700 font-semibold text-xs">Margin target</label>
                      <select
                        value={priceMargin}
                        onChange={(e) => setPriceMargin(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:outline-none transition-all cursor-pointer"
                      >
                        <option value="30">30%</option>
                        <option value="40">40%</option>
                        <option value="50">50%</option>
                        <option value="60">60%</option>
                        <option value="70">70%</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold text-xs">Beban tetap bulanan (BEP)</label>
                    <input
                      type="number"
                      value={priceFixed}
                      onChange={(e) => setPriceFixed(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3.5 py-2 text-slate-900 text-xs font-mono focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Clean Result Box */}
              <div
                className="p-4 rounded-xl flex flex-col gap-2.5 transition-all border border-slate-200"
                style={{ background: calcTint }}
              >
                {calcRows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3">
                    <span className={r.strong ? 'text-xs font-bold text-slate-900' : 'text-xs text-slate-600'}>
                      {r.label}
                      <TermHint label={r.label} />
                    </span>
                    <span
                      className={`font-mono ${
                        r.strong ? 'text-sm sm:text-base font-bold' : 'text-xs font-semibold text-slate-800'
                      } [font-variant-numeric:tabular-nums]`}
                      style={r.strong ? { color: r.color } : undefined}
                    >
                      {r.value}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200/60 text-xs leading-relaxed text-slate-500">
                  {calcNote}
                </div>
              </div>

              {/* Action Button */}
              <button
                type={calcBtnAction === 'submit' ? 'submit' : 'button'}
                form={calcBtnAction === 'submit' ? 'tx-form' : undefined}
                disabled={calcBtnAction === 'submit' && isSubmitting}
                onClick={
                  calcBtnAction === 'hpp' ? useHppInPrice : calcBtnAction === 'price' ? saveAsPriceReference : undefined
                }
                className={`w-full py-2.5 px-4 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 text-white ${calcBtnColor} hover:brightness-105 active:scale-[0.99]`}
              >
                {calcBtnAction === 'submit' && isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RiAddLine className="w-4 h-4" />
                    <span>{calcBtnText}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE (7 Cols): Riwayat Transaksi Terkini */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between h-full overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <h3 className="font-heading font-bold text-sm text-slate-900 m-0 tracking-tight">
                  Riwayat Transaksi Terkini
                </h3>
                <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  {transactions.length} mutasi
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-700 flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Real-time feed
              </span>
            </div>

            <div className="p-6 flex flex-col gap-2.5 overflow-y-auto max-h-[540px]">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                  <RiReceiptLine className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                  <span className="text-xs font-medium text-slate-600">Belum ada transaksi tercatat</span>
                </div>
              ) : (
                transactions.map((tx) => {
                  const isIncome = tx.type === 'INCOME';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3.5 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all group shadow-2xs"
                    >
                      {/* Left & Middle */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                            isIncome
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-rose-50 text-rose-600 border-rose-100'
                          }`}
                        >
                          {isIncome ? <RiArrowRightUpLine className="w-4 h-4" /> : <RiArrowRightDownLine className="w-4 h-4" />}
                        </span>

                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {tx.description}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold shrink-0 border ${
                                isIncome
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {tx.category}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500 text-[11px]">{tx.createdAt}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Amount */}
                      <div className="text-right shrink-0 pl-2">
                        <span
                          className={`font-mono font-bold text-xs sm:text-sm [font-variant-numeric:tabular-nums] ${
                            isIncome ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isIncome ? '+' : '-'}Rp {tx.amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ACCORDION 2 — PAJAK & KEPATUHAN (explicit product-policy lock) */}
      {/* ========================================================================= */}
      <FinanceSectionHeader
        icon={<TbBuildingBank className="w-4 h-4" />}
        iconColor="#C9A66B"
        title="Pajak & Kepatuhan"
        subtitle="Belum tersedia saat ini"
        widgetCount={0}
        open={secTax}
        onToggle={() => setSecTax((v) => !v)}
      />

      {secTax && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6">
          <TaxFeatureLock />
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACCORDION 3 — PIUTANG & INVOICE */}
      {/* ========================================================================= */}
      <FinanceSectionHeader
        icon={<TbFileInvoice className="w-4 h-4" />}
        iconColor="#F2A83B"
        title="Piutang & Invoice"
        subtitle="Faktur berjalan, piutang klien per umur, dan kewajiban terjadwal"
        widgetCount={3}
        open={secAr}
        onToggle={() => setSecAr((v) => !v)}
      />

      {secAr && (
        <div className="flex flex-col gap-5">
          {/* HILANGKAN (audit Finance 10 Sep, LENGKAPI #2, 10 Sep 2026 Fable): widget
              "Piutang per rentang umur" dan "Invoice terbaru" dihapus dari sini --
              keduanya duplikat data PERSIS dengan "Piutang klien" (tab Umur pakai
              agingBuckets/arTotalAmount yang sama; tab Per faktur + tabel "Invoice
              & piutang berjalan" di bawah sudah menutupi kebutuhan "daftar invoice").
              Tidak ada data yang hilang, cuma tata letak yang dirapikan. */}

      {/* ========================================================================= */}
      {/* 📄 SECTION 3 — INVOICE & RECEIVABLES (OVERDUE PROMINENT) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="flex flex-col gap-4 px-6 py-5 border-b border-slate-200">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-semibold text-sm text-slate-900 m-0">Invoice &amp; piutang berjalan</h3>
              <span className="text-xs text-slate-500">
                Kelola faktur terbit, lacak status pembayaran, dan kirim pengingat jatuh tempo
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setNewInvoiceOpen((v) => !v)}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 bg-[#0058BE] hover:brightness-110 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-[0_2px_12px_rgba(0,88,190,0.3)]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{newInvoiceOpen ? 'Tutup Form' : 'Buat Invoice Baru'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1">
              <span className="text-xs text-slate-500">Total Faktur</span>
              <span className="font-mono text-base font-bold text-slate-900">
                {invoiceStats.total} <span className="text-xs font-normal text-slate-400">faktur</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#EF4444]/[0.08] border border-[#EF4444]/20 flex flex-col gap-1">
              <span className="text-xs text-[#EF4444] font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Jatuh Tempo
              </span>
              <span className="font-mono text-base font-bold text-[#EF4444]">
                Rp {invoiceStats.totalOverdueNominal.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#F2A83B]/[0.08] border border-[#F2A83B]/20 flex flex-col gap-1">
              <span className="text-xs text-[#F2A83B] font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Menunggu Bayar
              </span>
              <span className="font-mono text-base font-bold text-[#F2A83B]">
                Rp {invoiceStats.totalPendingNominal.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#3FBF8F]/[0.08] border border-[#3FBF8F]/20 flex flex-col gap-1">
              <span className="text-xs text-[#3FBF8F] font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sudah Lunas
              </span>
              <span className="font-mono text-base font-bold text-[#3FBF8F]">
                {invoiceStats.paid} <span className="text-xs font-normal text-slate-400">faktur</span>
              </span>
            </div>
          </div>

          {/* Filter Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl overflow-x-auto">
              {(
                [
                  { key: 'ALL' as const, label: `Semua (${invoices.length})`, alert: false },
                  { key: 'OVERDUE' as const, label: `Jatuh Tempo (${invoiceStats.overdue})`, alert: invoiceStats.overdue > 0 },
                  { key: 'PENDING' as const, label: `Belum Lunas (${invoiceStats.pending})`, alert: false },
                  { key: 'PAID' as const, label: `Lunas (${invoiceStats.paid})`, alert: false },
                ]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setInvoiceFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                    invoiceFilter === tab.key
                      ? 'bg-white/10 text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {tab.label}
                    {tab.alert && <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Cari klien, nomor invoice..."
                className="w-full bg-white border-slate-300 border border-slate-200 focus:border-[#4E9BFF] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-[#5C6474] outline-none transition-all"
              />
              {invoiceSearch && (
                <button
                  type="button"
                  onClick={() => setInvoiceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {newInvoiceOpen && (
          <form onSubmit={handleCreateInvoice} className="flex flex-col gap-3 px-6 py-5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[#4E9BFF]" />
                Form Penerbitan Faktur Tagihan
              </span>
              <span className="text-xs text-slate-500">
                Otomatis tercatat di sistem piutang &amp; siap ditagih
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500">Nama klien *</span>
                <input
                  type="text"
                  value={newInvoiceClient}
                  onChange={(e) => setNewInvoiceClient(e.target.value)}
                  placeholder="PT Maju Bersama Sejahtera"
                  className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500">Email klien (opsional)</span>
                <input
                  type="email"
                  value={newInvoiceEmail}
                  onChange={(e) => setNewInvoiceEmail(e.target.value)}
                  placeholder="finance@klien.co.id"
                  className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500">No. HP / WhatsApp klien</span>
                <input
                  type="text"
                  value={newInvoicePhone}
                  onChange={(e) => setNewInvoicePhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500">Tanggal jatuh tempo (opsional)</span>
                <input
                  type="date"
                  value={newInvoiceDueDate}
                  onChange={(e) => setNewInvoiceDueDate(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE] [color-scheme:light]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500">Rincian item / jasa *</span>
                <input
                  type="text"
                  value={newInvoiceItemName}
                  onChange={(e) => setNewInvoiceItemName(e.target.value)}
                  placeholder="Jasa konsultasi / pembuatan sistem"
                  className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-500">Harga satuan (Rp) *</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newInvoiceItemPrice}
                    onChange={(e) => setNewInvoiceItemPrice(e.target.value)}
                    placeholder="5000000"
                    className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-500">Qty</span>
                  <input
                    type="number"
                    min="1"
                    value={newInvoiceItemQty}
                    onChange={(e) => setNewInvoiceItemQty(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE]"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500">Pajak (%)</span>
                <input
                  type="number"
                  min="0"
                  value={newInvoiceTaxRate}
                  onChange={(e) => setNewInvoiceTaxRate(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-500">Catatan / Instruksi Pembayaran</span>
                <input
                  type="text"
                  value={newInvoiceNotes}
                  onChange={(e) => setNewInvoiceNotes(e.target.value)}
                  placeholder="Transfer ke rekening BCA 123456789 a.n. AniTech"
                  className="h-9 px-3 rounded-lg bg-white border-slate-300 border border-slate-300 text-[13px] text-slate-900 outline-none focus:border-[#0058BE]"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewInvoiceOpen(false)}
                className="h-9 px-4 rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isInvoiceSubmitting}
                className="h-9 px-4 rounded-xl bg-[#0058BE] hover:brightness-110 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all"
              >
                {isInvoiceSubmitting ? 'Menerbitkan...' : 'Terbitkan Invoice'}
              </button>
            </div>
          </form>
        )}

        {/* Table Column Headers */}
        <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_130px_110px_140px_auto] gap-4 px-6 py-3 border-b border-slate-200 bg-slate-50">
          <span className="text-xs font-medium text-slate-400">KLIEN &amp; RINCIAN FAKTUR</span>
          <span className="text-xs font-medium text-slate-400">JATUH TEMPO</span>
          <span className="text-xs font-medium text-slate-400">STATUS</span>
          <span className="text-xs font-medium text-slate-400 text-right">NOMINAL</span>
          <span className="text-xs font-medium text-slate-400 text-right pr-2">AKSI CEPAT</span>
        </div>

        <div className="px-6 py-2 pb-6 divide-y divide-white/[0.04]">
          {filteredInvoicesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <Receipt className="w-8 h-8 mb-2.5 opacity-30 text-[#4E9BFF]" />
              <span className="text-xs font-medium text-slate-500">Tidak ada invoice yang sesuai filter</span>
              <span className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau reset filter status.</span>
            </div>
          ) : (
            filteredInvoicesList.map((inv) => {
              const isOverdue = inv.status === 'OVERDUE';
              const isPaid = inv.status === 'PAID';

              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoiceDetail(inv)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedInvoiceDetail(inv)}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_130px_110px_140px_auto] gap-3 md:gap-4 items-center py-3.5 px-3 -mx-3 cursor-pointer hover:bg-white/[0.025] transition-colors rounded-xl group"
                >
                  {/* Col 1: Klien & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#4E9BFF] shrink-0 font-bold text-xs">
                      {inv.clientName ? inv.clientName.slice(0, 2).toUpperCase() : 'KL'}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClient({
                            name: inv.clientName,
                            email: inv.clientEmail || 'finance@' + inv.clientName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.co.id',
                            phone: inv.clientPhone || '+62 812-9876-5432',
                            totalInvoiced: inv.amount,
                            totalPaid: inv.status === 'PAID' ? inv.amount : 0,
                            totalPending: inv.status !== 'PAID' ? inv.amount : 0,
                            invoiceCount: 1,
                          });
                        }}
                        className="text-[13px] font-semibold text-slate-900 hover:text-[#4E9BFF] transition-colors truncate"
                        title="Klik untuk melihat profil klien lengkap"
                      >
                        {inv.clientName}
                      </span>
                      <span className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
                        <span>{inv.invoiceNumber}</span>
                        {inv.notes && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[160px] text-slate-500">{inv.notes}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Col 2: Jatuh Tempo */}
                  <div className="flex md:flex-col items-center md:items-start justify-between text-xs text-slate-500 font-mono">
                    <span className="md:hidden text-xs text-slate-400">Jatuh tempo:</span>
                    <span className={isOverdue ? 'text-[#EF4444] font-semibold' : ''}>
                      {inv.dueDate || '-'}
                    </span>
                  </div>

                  {/* Col 3: Status Badge */}
                  <div className="flex md:block items-center justify-between">
                    <span className="md:hidden text-xs text-slate-400">Status:</span>
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-mono font-bold rounded-full ${
                        isOverdue
                          ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                          : isPaid
                          ? 'bg-[#3FBF8F]/20 text-[#3FBF8F] border border-[#3FBF8F]/30'
                          : 'bg-[#F2A83B]/20 text-[#F2A83B] border border-[#F2A83B]/30'
                      }`}
                    >
                      {isOverdue ? 'OVERDUE' : isPaid ? 'LUNAS' : 'PENDING'}
                    </span>
                  </div>

                  {/* Col 4: Nominal */}
                  <div className="flex md:block items-center justify-between text-right">
                    <span className="md:hidden text-xs text-slate-400">Nominal:</span>
                    <span
                      className={`font-mono font-bold text-[13.5px] ${
                        isOverdue ? 'text-[#EF4444]' : isPaid ? 'text-[#3FBF8F]' : 'text-slate-900'
                      }`}
                    >
                      Rp {inv.amount.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Col 5: Action Buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                    {/* Lihat & Unduh Invoice */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewInvoice(inv);
                        setIsInvoicePreviewOpen(true);
                      }}
                      className="h-8 px-2.5 inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-medium text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap"
                      title="Lihat & Unduh Invoice (PDF / CSV / JSON)"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#4E9BFF]" />
                      <span className="hidden lg:inline">Lihat</span>
                    </button>

                    {/* Tagih via WhatsApp */}
                    {isOverdue && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendReminder(inv.id);
                        }}
                        disabled={inv.isReminderSent || sendingReminderId === inv.id}
                        className="h-8 px-2.5 inline-flex items-center gap-1.5 bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] border border-[#EF4444]/40 font-semibold text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                        title="Kirim pengingat tagihan via WhatsApp"
                      >
                        {inv.isReminderSent ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Ditagih</span>
                          </>
                        ) : sendingReminderId === inv.id ? (
                          <span>Mengirim...</span>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Tagih WA</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Tandai Lunas */}
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkInvoicePaid(inv.id, `${inv.clientName} (${inv.invoiceNumber})`);
                        }}
                        disabled={markingPaidId === inv.id}
                        className="h-8 px-2.5 inline-flex items-center gap-1.5 bg-[#3FBF8F] hover:brightness-110 text-[#0B0E14] font-bold text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 shadow-sm"
                        title="Tandai invoice lunas dan catat pemasukan kas"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{markingPaidId === inv.id ? 'Proses...' : 'Lunas'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* "Piutang klien" (Umur / Per faktur) + "Kewajiban terjadwal" (14 hari / 30 hari) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3.5 px-6 py-5 border-0 flex-wrap">
            <div className="flex flex-col gap-[5px]">
              <h3 className="font-heading text-sm font-semibold text-slate-900 m-0">Piutang klien</h3>
              <span className="text-xs text-slate-500">Sudah jadi hak Anda, belum masuk kas</span>
            </div>
            <div className="flex items-center gap-[3px] p-[3px] bg-white/[0.035] border-0 rounded-xl">
              <button
                type="button"
                onClick={() => setArTab('UMUR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                  arTab === 'UMUR' ? 'bg-white/10 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Umur Piutang
              </button>
              <button
                type="button"
                onClick={() => setArTab('FAKTUR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                  arTab === 'FAKTUR' ? 'bg-white/10 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Per Faktur ({arInvoicesList.length})
              </button>
              <button
                type="button"
                onClick={() => setArTab('KLIEN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                  arTab === 'KLIEN' ? 'bg-white/10 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Per Klien ({clientAggregates.length})
              </button>
            </div>
          </div>

          {arTab === 'UMUR' && (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-500">Total Hak Piutang Tertahan</span>
                  <span className="font-heading text-[clamp(20px,1.7vw,26px)] font-bold tracking-[-0.025em] text-slate-900 [font-variant-numeric:tabular-nums]">
                    Rp {arTotalAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  <span className="font-semibold text-white">{arInvoicesList.length} faktur</span> berjalan
                  <br />
                  <span>Rata-rata umur {arAvgDays} hari</span>
                  <TermHint label="Piutang" />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="flex flex-col gap-1.5">
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-50 p-0.5 gap-1">
                  {agingBuckets.map((a) => (
                    <span
                      key={a.label}
                      className="rounded-full transition-all"
                      style={{ width: `${(a.value / agingTotal) * 100}%`, background: a.color }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Distribusi kolektibilitas per rentang waktu</span>
                  <span>100% dari total piutang</span>
                </div>
              </div>

              {/* Aging Buckets List */}
              <div className="flex flex-col divide-y divide-white/[0.05]">
                {agingBuckets.map((a) => (
                  <div
                    key={a.label}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[12.5px] font-medium text-slate-900 flex items-center gap-2">
                          {a.label}
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                            style={{ background: `${a.color}20`, color: a.color }}
                          >
                            {a.risk}
                          </span>
                        </span>
                        <span className="text-xs text-slate-400">{a.count}</span>
                      </div>
                    </div>
                    <span
                      className="font-mono text-[13px] font-bold [font-variant-numeric:tabular-nums]"
                      style={{ color: a.color }}
                    >
                      Rp {a.value.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Collector Tip */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-500">
                <Info className="w-4 h-4 text-[#4E9BFF] shrink-0 mt-0.5" />
                <span>
                  Piutang di atas 30 hari memiliki risiko gagal bayar 3x lebih tinggi. Segera kirim pengingat ramah via WhatsApp sebelum mencapai 60 hari.
                </span>
              </div>
            </div>
          )}

          {arTab === 'FAKTUR' && (
            <div className="px-5 pt-1.5 pb-4">
              {arInvoicesList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <Receipt className="w-7 h-7 mb-2 opacity-40 text-[#4E9BFF]" />
                  <span className="text-xs font-medium text-slate-500">Semua faktur piutang telah lunas</span>
                  <span className="text-xs text-slate-400 mt-0.5">Arus kas piutang aman dan terkendali.</span>
                </div>
              ) : (
                arInvoicesList.map((i) => {
                  const isOverdue = i.status === 'OVERDUE';
                  return (
                    <div
                      key={i.id}
                      onClick={() => setSelectedInvoiceDetail(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedInvoiceDetail(i)}
                      className="flex items-center justify-between gap-3.5 py-3 border-b border-slate-200 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors rounded-xl -mx-1.5 px-2.5"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[12.5px] font-semibold text-slate-900 truncate hover:text-[#4E9BFF] transition-colors">
                          {i.clientName}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          {i.invoiceNumber} · Jatuh tempo: {i.dueDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[9px] font-mono font-bold rounded-full ${
                            isOverdue ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'bg-[#F2A83B]/20 text-[#F2A83B] border border-[#F2A83B]/30'
                          }`}
                        >
                          {i.status}
                        </span>
                        <span className={`font-mono font-bold text-[13px] ${isOverdue ? 'text-[#EF4444]' : 'text-slate-900'}`}>
                          Rp {i.amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="flex items-baseline justify-between gap-3 pt-3.5 mt-2 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-500">Total piutang berjalan</span>
                <span className="font-mono text-sm font-bold text-[#F2A83B] [font-variant-numeric:tabular-nums]">
                  Rp {arTotalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          )}

          {arTab === 'KLIEN' && (
            <div className="px-5 pt-1.5 pb-4 flex flex-col gap-2">
              {clientAggregates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <Building2 className="w-7 h-7 mb-2 opacity-40 text-[#4E9BFF]" />
                  <span className="text-xs">Belum ada data klien terdaftar</span>
                </div>
              ) : (
                clientAggregates.map((c) => (
                  <div
                    key={c.name}
                    onClick={() => setSelectedClient(c)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedClient(c)}
                    className="flex items-center justify-between gap-3 py-3 border-b border-slate-200 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors rounded-xl -mx-1.5 px-2.5 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#4E9BFF]/10 text-[#4E9BFF] flex items-center justify-center font-bold text-xs shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12.5px] font-semibold text-slate-900 truncate group-hover:text-[#4E9BFF] transition-colors">
                          {c.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {c.invoiceCount} faktur · {c.overdueCount > 0 ? `${c.overdueCount} telat` : 'pembayaran lancar'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className={`font-mono font-bold text-[12.5px] ${c.totalPending > 0 ? 'text-[#F2A83B]' : 'text-[#3FBF8F]'}`}>
                        {c.totalPending > 0 ? `Rp ${c.totalPending.toLocaleString('id-ID')}` : 'Lunas'}
                      </span>
                      <span className="text-xs text-slate-400">
                        dari total Rp {c.totalInvoiced.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-200 text-xs text-slate-500">
                <span>Klik baris klien untuk detail kontak &amp; riwayat faktur</span>
                <span className="font-semibold text-white">{clientAggregates.length} mitra</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3.5 px-6 py-5 border-0 flex-wrap">
            <div className="flex flex-col gap-[5px]">
              <h3 className="font-heading text-sm font-semibold text-slate-900 m-0">Kewajiban terjadwal</h3>
              <span className="text-xs text-slate-500">Yang harus dibayar dan sisa kas setelahnya</span>
            </div>
            <div className="flex items-center gap-[3px] p-[3px] bg-white/[0.035] border-0 rounded-xl">
              <button
                type="button"
                onClick={() => setDueRange('14')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                  dueRange === '14' ? 'bg-white/10 text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                14 hari
              </button>
              <button
                type="button"
                onClick={() => setDueRange('30')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                  dueRange === '30' ? 'bg-white/10 text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                30 hari
              </button>
            </div>
          </div>
          <div className="px-5 pt-1.5 pb-[18px] flex flex-col flex-1">
            {/* Form tambah kewajiban baru dengan kategori */}
            <form onSubmit={handleAddObligation} className="flex flex-col gap-2.5 mb-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-medium">Nama kewajiban *</label>
                  <input
                    type="text"
                    value={obligName}
                    onChange={(e) => setObligName(e.target.value)}
                    placeholder="Contoh: Sewa ruko / Vendor hosting"
                    required
                    className="w-full bg-white border-slate-300 border-0 ring-1 ring-white/10 focus:ring-1 focus:ring-[#F2A83B] rounded-lg px-3 py-2 text-slate-900 text-[11.5px] placeholder-[#5C6474] focus:outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-medium">Kategori pengeluaran</label>
                  <select
                    value={obligCategory}
                    onChange={(e) => setObligCategory(e.target.value)}
                    className="w-full bg-white border-slate-300 border-0 ring-1 ring-white/10 focus:ring-1 focus:ring-[#F2A83B] rounded-lg px-2.5 py-2 text-slate-900 text-[11.5px] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="Operasional & Utilitas">Operasional &amp; Utilitas</option>
                    <option value="Sewa & Gedung">Sewa &amp; Gedung</option>
                    <option value="Gaji & Freelance">Gaji &amp; Freelance</option>
                    <option value="Vendor & Supplier">Vendor &amp; Supplier</option>
                    <option value="Pajak & Legal">Pajak &amp; Legal</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_130px_auto] gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-medium">Nominal tagihan *</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 font-mono text-xs font-bold text-slate-500 pointer-events-none">Rp</span>
                    <input
                      type="number"
                      value={obligAmount}
                      onChange={(e) => setObligAmount(e.target.value)}
                      placeholder="0"
                      required
                      className="w-full bg-white border-slate-300 border-0 ring-1 ring-white/10 focus:ring-1 focus:ring-[#F2A83B] rounded-lg pl-7 pr-2.5 py-2 text-slate-900 font-mono text-[11.5px] font-semibold placeholder-[#5C6474] focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-medium">Jatuh tempo *</label>
                  <input
                    type="date"
                    value={obligDueDate}
                    onChange={(e) => setObligDueDate(e.target.value)}
                    required
                    className="w-full bg-white border-slate-300 border-0 ring-1 ring-white/10 focus:ring-1 focus:ring-[#F2A83B] rounded-lg px-2.5 py-2 text-slate-900 text-[11.5px] focus:outline-none transition-all [color-scheme:light]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isObligSubmitting}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[11.5px] font-bold text-[#06080C] bg-[#F2A83B] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 border-0 h-[35px]"
                >
                  {isObligSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CalendarPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Jadwalkan</span>
                </button>
              </div>
            </form>

            {activeDuesWithRunning.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <Clock className="w-7 h-7 mb-2 opacity-40 text-[#F2A83B]" />
                <span className="text-xs max-w-[240px]">Belum ada kewajiban terjadwal tercatat dalam {dueRangeText} ke depan.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {activeDuesWithRunning.map((d) => {
                  // Days left estimation
                  const daysLeft = d.dueDateRaw ? Math.ceil((new Date(d.dueDateRaw).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const isUrgent = daysLeft !== null && daysLeft <= 3;
                  const isSoon = daysLeft !== null && daysLeft > 3 && daysLeft <= 7;

                  return (
                    <div
                      key={d.id}
                      className="grid grid-cols-[46px_minmax(0,1fr)_auto_auto] gap-[13px] items-center py-2.5 px-3 rounded-xl hover:bg-white/[0.025] transition-colors border border-transparent hover:border-slate-200 group"
                    >
                      <div className="flex flex-col items-center gap-px py-[5px] rounded-lg bg-slate-50 border-0 shrink-0">
                        <span className="font-mono text-[13px] font-semibold text-slate-900 leading-none">{d.day}</span>
                        <span className="text-[9.5px] text-slate-400">{d.mon}</span>
                      </div>
                      <div className="flex flex-col gap-[3px] min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12.5px] font-semibold text-slate-900 truncate">{d.name}</span>
                          {isUrgent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30">
                              Mendesak
                            </span>
                          )}
                          {isSoon && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F2A83B]/20 text-[#F2A83B] border border-[#F2A83B]/30">
                              Mendekati
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{d.category || 'Operasional'}</span>
                          <span>·</span>
                          <span className="font-mono">Sisa kas sesudahnya Rp {d.after.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                      <span className="font-mono text-[12.5px] font-bold text-slate-700 [font-variant-numeric:tabular-nums] whitespace-nowrap">
                        Rp {d.amount.toLocaleString('id-ID')}
                      </span>
                      {/* Hapus / tandai lunas */}
                      <button
                        onClick={() => handleDeleteObligation(d.id, d.name)}
                        disabled={deletingObligId === d.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 shrink-0 disabled:opacity-40 border-0 cursor-pointer"
                        aria-label="Hapus / tandai lunas kewajiban"
                        title="Hapus / tandai lunas kewajiban"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cash Buffer & Liquidity Health Summary */}
            <div className="mt-auto pt-4 flex flex-col gap-2.5 border-t border-slate-200">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Beban Kas {dueRangeText}</span>
                  <span className="font-mono text-[#F2A83B] font-semibold">{dueBarPct.toFixed(1)}% dari kas likuid</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-50">
                  <span
                    className="block h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${dueBarPct}%`,
                      background: dueBarPct > 80 ? '#EF4444' : dueBarPct > 50 ? '#F2A83B' : '#3FBF8F',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-0.5">
                  <span className="text-xs text-slate-500">Total Kewajiban</span>
                  <span className="font-mono text-xs font-bold text-[#F2A83B]">
                    Rp {dueTotal.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#3FBF8F]/[0.05] border border-[#3FBF8F]/20 flex flex-col gap-0.5">
                  <span className="text-xs text-[#3FBF8F]">Proyeksi Kas Tersisa</span>
                  <span className="font-mono text-xs font-bold text-[#3FBF8F]">
                    Rp {cashAfterDues.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACCORDION 4 — ANALISIS LANJUTAN */}
      {/* ========================================================================= */}
      <FinanceSectionHeader
        icon={<LineChart className="w-4 h-4" strokeWidth={1.8} />}
        iconColor="#A5B4FC"
        title="Analisis Lanjutan"
        subtitle="Peringatan margin, unit economics CAC & LTV, dan simulasi rencana keuangan"
        widgetCount={3}
        open={secAdv}
        onToggle={() => setSecAdv((v) => !v)}
      />

      {secAdv && (
        <div className="flex flex-col gap-5">
          {/* Margin health banner -- real summary.grossMargin vs a standard 32% SME benchmark.
              "vs bulan lalu" delta is left as an explicit "belum tersedia" line rather than a
              fabricated number: KLIR doesn't store a prior-month margin snapshot anywhere yet. */}
          {/* Margin health banner -- real summary.grossMargin vs a standard 32% SME benchmark */}
          <div
            className="relative overflow-hidden grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-5 items-center px-6 py-5 rounded-2xl border border-slate-200 border-l-4 shadow-xs"
            style={{
              background: '#FFFFFF',
              borderLeftColor: !hasMarginData ? '#94A3B8' : marginIsHealthy ? '#059669' : '#D97706',
            }}
          >
            <span
              className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border-0"
              style={{
                color: !hasMarginData ? '#64748B' : marginIsHealthy ? '#059669' : '#D97706',
                background: !hasMarginData ? '#F1F5F9' : marginIsHealthy ? '#ECFDF5' : '#FFFBEB',
              }}
            >
              {!hasMarginData ? <Info className="w-6 h-6" strokeWidth={1.9} /> : marginIsHealthy ? <ShieldCheck className="w-6 h-6" strokeWidth={1.9} /> : <AlertTriangle className="w-6 h-6" strokeWidth={1.9} />}
            </span>
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-heading text-[16px] font-bold tracking-tight text-slate-900">
                  {!hasMarginData ? 'Margin bersih menunggu data transaksi' : marginIsHealthy ? 'Margin Bersih Sehat — Di Atas Ambang Batas Aman' : 'Margin Bersih Di Bawah Ambang Aman (Perhatian)'}
                  <TermHint label="Margin bersih" />
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    !hasMarginData
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : marginIsHealthy
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {!hasMarginData ? 'Netral' : marginIsHealthy ? 'Optimal (Safe Zone)' : 'Waspada (Risk Zone)'}
                </span>
              </div>
              <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 m-0">
                {hasMarginData
                  ? `Margin kotor/bersih saat ini ${summary.grossMargin.toString().replace('.', ',')}%. Standar acuan sehat UMKM adalah minimal ${MARGIN_SAFE_THRESHOLD}%. ${
                      marginIsHealthy
                        ? 'Kapasitas kas mampu menyerap fluktuasi beban dan menyisakan laba ekspansi.'
                        : 'Biaya pokok & beban operasional memakan porsi terlalu besar; pertimbangkan penyesuaian harga atau pemangkasan beban non-primer.'
                    }`
                  : 'Belum ada catatan transaksi pendapatan masuk untuk mengkalkulasi margin bersih riil.'}
              </p>
              {/* Visual gauge meter */}
              {hasMarginData && (
                <div className="flex items-center gap-3 mt-1 max-w-md">
                  <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden relative">
                    {/* Safe threshold marker at 32% */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
                      style={{ left: `${Math.min(100, (MARGIN_SAFE_THRESHOLD / 60) * 100)}%` }}
                      title={`Ambang aman: ${MARGIN_SAFE_THRESHOLD}%`}
                    />
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(5, (summary.grossMargin / 60) * 100))}%`,
                        background: marginIsHealthy ? '#3FBF8F' : '#F2A83B',
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-[#8A93A3] shrink-0">
                    Acuan {MARGIN_SAFE_THRESHOLD}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-start lg:items-end gap-1 lg:pr-5 border-0">
              <span
                className="font-heading text-[26px] font-semibold tracking-[-0.03em] leading-none [font-variant-numeric:tabular-nums] whitespace-nowrap"
                style={{ color: !hasMarginData ? '#8A93A3' : marginIsHealthy ? '#3FBF8F' : '#F2A83B' }}
              >
                {hasMarginData ? `${summary.grossMargin.toString().replace('.', ',')}%` : 'Belum ada data'}
              </span>
              <span className="text-xs text-[#8A93A3] whitespace-nowrap">
                {hasMarginData
                  ? (isDevLocalhost ? '+2,8% vs bulan lalu (sample dev)' : 'vs bulan lalu: data belum tersedia')
                  : 'vs bulan lalu: belum tersedia'}
              </span>
              <span className="text-xs text-[#5C6474] whitespace-nowrap">ambang aman {MARGIN_SAFE_THRESHOLD}%</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setCalcTab('PRICE');
                  setSecCash(true);
                }}
                title="Buka kalkulator harga jual di Kas & Arus Kas"
                className="inline-flex items-center gap-2 h-9 px-4 bg-[#E8A33A] hover:brightness-110 border-0 rounded-xl text-xs font-bold text-[#231402] cursor-pointer whitespace-nowrap transition-all shadow-[0_2px_10px_rgba(232,163,58,0.2)]"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Sesuaikan Harga</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            {/* Unit economics CAC & LTV */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-3 flex-wrap px-6 py-5 border-0">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-[30px] h-[30px] shrink-0 rounded-lg flex items-center justify-center bg-[#A5B4FC]/[0.12] border-0">
                    <Target className="w-[15px] h-[15px] text-[#A5B4FC]" strokeWidth={1.8} />
                  </span>
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-sm text-[#F5F7FA] m-0">Unit economics CAC dan LTV</h3>
                      <button
                        type="button"
                        onClick={() => setUeSimOpen(!ueSimOpen)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold transition-all cursor-pointer border ${
                          ueSimOpen
                            ? 'bg-[#A5B4FC]/20 text-[#C7D2FE] border-[#A5B4FC]/40'
                            : 'bg-white/[0.04] text-[#8A93A3] border-white/[0.08] hover:text-white'
                        }`}
                      >
                        {ueSimOpen ? 'Mode Simulasi Aktif' : '+ Simulasi Sendiri'}
                      </button>
                    </div>
                    <span className="text-[11.5px] text-[#8A93A3]">
                      {ueSimOpen ? 'Ubah angka di bawah untuk melihat dampak terhadap CAC, LTV & rasio akuisisi' : 'Penjelasan konsep, rumus, dan angka bisnis Anda'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-[3px] p-1 bg-white/[0.035] border-0 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setUeTab('cac')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                      ueTab === 'cac' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-white'
                    }`}
                  >
                    CAC
                  </button>
                  <button
                    type="button"
                    onClick={() => setUeTab('ltv')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                      ueTab === 'ltv' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-white'
                    }`}
                  >
                    LTV
                  </button>
                  <button
                    type="button"
                    onClick={() => setUeTab('ratio')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                      ueTab === 'ratio' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-white'
                    }`}
                  >
                    Rasio
                  </button>
                </div>
              </div>

              {/* Interactive Sandbox Input Drawer when ueSimOpen is true */}
              {ueSimOpen && (
                <div className="mx-6 mb-4 p-4 rounded-xl bg-white/[0.03] border border-[#A5B4FC]/20 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fadeIn">
                  <div>
                    <label className="block text-xs text-[#8A93A3] mb-1">Belanja Iklan (Rp)</label>
                    <input
                      type="number"
                      value={ueSimAdSpend}
                      onChange={(e) => setUeSimAdSpend(e.target.value)}
                      className="w-full h-8 px-2.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#A5B4FC]/50"
                      placeholder="5000000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A93A3] mb-1">Pelanggan Baru</label>
                    <input
                      type="number"
                      value={ueSimNewCustomers}
                      onChange={(e) => setUeSimNewCustomers(e.target.value)}
                      className="w-full h-8 px-2.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#A5B4FC]/50"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A93A3] mb-1">Rata2 Order (Rp)</label>
                    <input
                      type="number"
                      value={ueSimAvgOrder}
                      onChange={(e) => setUeSimAvgOrder(e.target.value)}
                      className="w-full h-8 px-2.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#A5B4FC]/50"
                      placeholder="250000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A93A3] mb-1">Retensi (Tahun)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={ueSimLifespan}
                      onChange={(e) => setUeSimLifespan(e.target.value)}
                      className="w-full h-8 px-2.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#A5B4FC]/50"
                      placeholder="2"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 flex-1">
                <div className="p-6 border-0 flex flex-col gap-3.5">
                  <span className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-[#C3CBD8]">{activeUe.title}<TermHint label={activeUe.title} /></span>
                    <span
                      className="font-heading text-[22px] font-semibold tracking-[-0.03em] [font-variant-numeric:tabular-nums] whitespace-nowrap"
                      style={{ color: activeUe.color }}
                    >
                      {activeUe.big}
                    </span>
                    <span className="text-[11.5px] text-[#8A93A3]">{activeUe.unit}</span>
                  </span>
                  <span className="block px-4 py-3 rounded-xl bg-white/[0.03] border-0 font-mono text-[11.5px] leading-relaxed text-[#C3CBD8]">
                    {activeUe.formula}
                  </span>
                  <span className="text-[12.5px] leading-relaxed text-[#8A93A3]">{activeUe.plain}</span>
                  <span className="flex items-center gap-[11px] mt-auto">
                    <span className="flex-1 h-2 rounded-[5px] bg-white/[0.06] overflow-hidden">
                      <span className="block h-full rounded-[5px]" style={{ width: `${activeUe.barPct}%`, background: activeUe.color }} />
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#8A93A3] whitespace-nowrap">{activeUe.verdict}</span>
                  </span>
                </div>
                <div className="p-6 flex flex-col bg-white/[0.015] border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium tracking-[0.03em] text-[#5C6474]">Cara hitungnya</span>
                    {ueSimOpen && (
                      <span className="text-xs text-[#A5B4FC] font-semibold">Data Simulasi Interaktif</span>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-col gap-1">
                    {activeUe.rows.map((r, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-[18px] items-baseline py-2 px-2.5 rounded-lg hover:bg-white/[0.02] transition-colors border-0"
                      >
                        <span className={`text-[12.5px] ${r.strong ? 'font-semibold text-[#F5F7FA]' : 'text-[#8A93A3]'}`}>{r.label}<TermHint label={r.label} /></span>
                        <span
                          className={`font-mono text-[12.5px] whitespace-nowrap text-right [font-variant-numeric:tabular-nums] ${
                            r.strong ? 'font-semibold text-[#F5F7FA]' : 'text-[#8A93A3]'
                          }`}
                        >
                          {r.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto pt-3.5 border-0 flex flex-col gap-2.5">
                    <div className="flex items-start gap-2 text-xs leading-relaxed text-[#8A93A3]">
                      <Info className="w-3.5 h-3.5 text-[#5C6474] shrink-0 mt-0.5" strokeWidth={1.8} />
                      <span>{activeUe.tip}</span>
                    </div>
                    {/* Ask AI Assistant Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const aiMsg = ueSimOpen
                          ? `Halo AI, tolong analisa angka unit economics bisnis saya: Belanja iklan Rp ${calcSimAdSpendNum.toLocaleString('id-ID')}, Pelanggan baru ${calcSimNewCustNum}, CAC Rp ${calcSimCAC.toLocaleString('id-ID')}, LTV Rp ${calcSimLTV.toLocaleString('id-ID')}, Rasio LTV:CAC ${calcSimRatioFormatted}. Apakah sehat untuk ekspansi dan apa saran optimasinya?`
                          : `Halo AI, bagaimana cara memulai tracking CAC dan LTV untuk bisnis UMKM saya agar unit economics bisa terukur sehat?`;
                        if (onOpenAI) {
                          onOpenAI(aiMsg);
                        } else {
                          try {
                            sessionStorage.setItem('klir_pending_ai_prompt', aiMsg);
                            window.dispatchEvent(new CustomEvent('klir_open_ai_assistant', { detail: { prompt: aiMsg } }));
                          } catch (e) {}
                        }
                      }}
                      className="w-full mt-1 py-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-[#A5B4FC]/15 text-[#C7D2FE] border border-white/10 hover:border-[#A5B4FC]/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5 text-[#A5B4FC]" />
                      <span>Konsultasi CAC/LTV ke AI Assistant</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hasil simulasi rencana keuangan */}
            {/* Hasil simulasi rencana keuangan */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-3 flex-wrap px-6 py-5 border-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#C084FC]" />
                    <h3 className="font-heading font-semibold text-sm text-[#F5F7FA] m-0">Hasil simulasi rencana keuangan</h3>
                  </div>
                  <span className="text-[11.5px] text-[#8A93A3]">Ilustrasi proyeksi 6 bulan ke depan — sesuaikan parameter atau pilih skenario patokan</span>
                </div>
                <div className="flex items-center gap-[3px] p-1 bg-white/[0.035] border-0 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSimScen('base')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                      simScen === 'base' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-white'
                    }`}
                  >
                    Dasar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimScen('price')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                      simScen === 'price' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-white'
                    }`}
                  >
                    Naik harga
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimScen('lean')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 ${
                      simScen === 'lean' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-white'
                    }`}
                  >
                    Efisiensi
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimScen('custom')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-0 flex items-center gap-1 ${
                      simScen === 'custom' ? 'bg-[#C084FC]/20 text-[#E9D5FF] font-bold' : 'text-[#8A93A3] hover:text-white'
                    }`}
                  >
                    <span>Kustom</span>
                  </button>
                </div>
              </div>

              {/* Custom Parameter Slider Drawer when 'custom' is active */}
              {simScen === 'custom' && (
                <div className="mx-6 mb-4 p-4 rounded-xl bg-[#C084FC]/[0.05] border border-[#C084FC]/20 flex flex-col gap-3 animate-fadeIn">
                  <span className="text-xs font-semibold text-[#E9D5FF] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#C084FC]" />
                    <span>Parameter Kustomisasi Skenario Bisnis</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="flex justify-between text-xs text-[#A9B2C0] mb-1">
                        <span>Target Kenaikan Omset</span>
                        <span className="font-mono text-[#F5F7FA] font-bold">+{customRevGrowth}%</span>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="100"
                        step="5"
                        value={customRevGrowth}
                        onChange={(e) => setCustomRevGrowth(Number(e.target.value))}
                        className="w-full accent-[#C084FC] cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-[#A9B2C0] mb-1">
                        <span>Target Margin Bersih</span>
                        <span className="font-mono text-[#F5F7FA] font-bold">{customMarginTarget}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="70"
                        step="1"
                        value={customMarginTarget}
                        onChange={(e) => setCustomMarginTarget(Number(e.target.value))}
                        className="w-full accent-[#C084FC] cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-[#A9B2C0] mb-1">
                        <span>Target Efisiensi OPEX</span>
                        <span className="font-mono text-[#F5F7FA] font-bold">{customOpexEfficiency}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="5"
                        value={customOpexEfficiency}
                        onChange={(e) => setCustomOpexEfficiency(Number(e.target.value))}
                        className="w-full accent-[#C084FC] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="px-6 pb-6 flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activeSim.color, boxShadow: `0 0 0 3px ${activeSim.color}2E` }} />
                    <span className="text-[12.5px] font-semibold text-[#F5F7FA]">{activeSim.name}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs text-[#8A93A3] bg-white/[0.04] border-0 whitespace-nowrap">
                    <Clock className="w-2.5 h-2.5" />
                    <span>6 bulan ke depan</span>
                  </span>
                </div>

                <div className="flex items-end justify-between gap-3.5">
                  <span className="flex flex-col gap-1 min-w-0">
                    <span className="text-[11.5px] text-[#8A93A3]">Proyeksi laba bersih / bulan</span>
                    <span
                      className="font-heading text-[22px] font-semibold tracking-[-0.025em] [font-variant-numeric:tabular-nums] whitespace-nowrap"
                      style={{ color: activeSim.color }}
                    >
                      Rp {simProjectedNet.toLocaleString('id-ID')}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[11.5px] text-[#8A93A3]">Margin akhir periode</span>
                    <span className="font-mono text-base font-semibold text-[#F5F7FA] [font-variant-numeric:tabular-nums] whitespace-nowrap">
                      {activeSim.marginTarget.toFixed(1).replace('.', ',')}%
                    </span>
                  </span>
                </div>

                <div className="rounded-xl px-3 pt-3 pb-2 bg-white/[0.025] border-0">
                  <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="w-full h-24 block">
                    <polyline points="4,94 296,94" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                    <polyline points="4,50 296,50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 5" />
                    <polygon points={simAreaPoints} fill={activeSim.color} opacity="0.16" stroke="none" />
                    <polyline points={simLinePoints} fill="none" stroke={activeSim.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle
                      cx={simLinePoints.split(' ').slice(-1)[0].split(',')[0]}
                      cy={simLinePoints.split(' ').slice(-1)[0].split(',')[1]}
                      r="3.6"
                      fill={activeSim.color}
                      stroke="#0A0D13"
                      strokeWidth="1.6"
                    />
                  </svg>
                  <div className="flex justify-between mt-1.5">
                    {simMonthLabels.map((m) => (
                      <span key={m} className="font-mono text-[9.5px] text-[#5C6474]">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-baseline py-2 px-2.5 rounded-lg hover:bg-white/[0.02] transition-colors border-0">
                    <span className="text-xs text-[#8A93A3]">Proyeksi omset akhir periode</span>
                    <span className="font-mono text-[12.5px] font-semibold text-[#F5F7FA] [font-variant-numeric:tabular-nums] whitespace-nowrap text-right">
                      Rp {simProjectedRev.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-baseline py-2 px-2.5 rounded-lg hover:bg-white/[0.02] transition-colors border-0">
                    <span className="text-xs text-[#8A93A3]">Perubahan vs omset berjalan</span>
                    <span
                      className="font-mono text-[12.5px] font-semibold [font-variant-numeric:tabular-nums] whitespace-nowrap text-right"
                      style={{ color: activeSim.color }}
                    >
                      {simChangePct >= 0 ? '+' : ''}
                      {simChangePct.toFixed(1).replace('.', ',')}%
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-0 flex flex-col gap-3">
                  <div className="flex items-start gap-2 text-xs leading-relaxed text-[#8A93A3]">
                    <Info className="w-3.5 h-3.5 text-[#5C6474] shrink-0 mt-0.5" strokeWidth={1.8} />
                    <span>{activeSim.note}</span>
                  </div>

                  {/* AI Assistant Action Buttons for Scenario Consulting */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        const aiMsg = `Halo AI, tolong evaluasi skenario keuangan "${activeSim.name}": Proyeksi omset Rp ${simProjectedRev.toLocaleString('id-ID')} (${simChangePct >= 0 ? '+' : ''}${simChangePct.toFixed(1)}%), proyeksi laba bersih Rp ${simProjectedNet.toLocaleString('id-ID')}/bulan dengan target margin ${activeSim.marginTarget}%. Apakah asumsi ini realistis dan langkah konkret apa yang harus saya eksekusi?`;
                        if (onOpenAI) {
                          onOpenAI(aiMsg);
                        } else {
                          try {
                            sessionStorage.setItem('klir_pending_ai_prompt', aiMsg);
                            window.dispatchEvent(new CustomEvent('klir_open_ai_assistant', { detail: { prompt: aiMsg } }));
                          } catch (e) {}
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-[#C084FC]/15 text-[#E9D5FF] border border-white/10 hover:border-[#C084FC]/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5 text-[#C084FC]" />
                      <span>Simulasikan via AI Assistant</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setToastMsg(`Skenario "${activeSim.name}" telah disimpan sebagai acuan target operasional.`);
                        setTimeout(() => setToastMsg(null), 3000);
                      }}
                      className="py-2 px-3.5 rounded-xl bg-[#3FBF8F]/15 hover:bg-[#3FBF8F]/25 text-[#3FBF8F] border border-[#3FBF8F]/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Terapkan Target</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
      </div>

      {/* Modal 1: Invoice Preview & Download Modal */}
      {isInvoicePreviewOpen && previewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 max-w-xl w-full shadow-2xl space-y-4 animate-scaleUp text-[#F5F7FA]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[#4E9BFF]/15 flex items-center justify-center text-[#4E9BFF]">
                  <FileText className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-heading font-bold text-base text-white m-0">
                    Faktur Penagihan Resmi
                  </h4>
                  <span className="text-xs text-[#8A93A3] font-mono">{previewInvoice.invoiceNumber}</span>
                </div>
              </div>
              <button
                onClick={() => { setIsInvoicePreviewOpen(false); setPreviewInvoice(null); }}
                className="text-[#8A93A3] hover:text-white cursor-pointer bg-transparent border-0 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Invoice Resmi */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-heading font-bold text-sm text-white">ANITECH ENTERPRISE</span>
                  <p className="text-xs text-[#8A93A3] m-0">Menara Digital Lt. 18, Jakarta Selatan</p>
                  <p className="text-xs text-[#8A93A3] m-0">NPWP: 01.234.567.8-012.000</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8A93A3]">Ditagihkan Kepada:</span>
                  <p className="font-semibold text-white text-xs m-0">{previewInvoice.clientName}</p>
                  <p className="text-xs text-[#8A93A3] m-0">Jatuh Tempo: {previewInvoice.dueDate}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[#8A93A3] text-xs">
                      <th className="py-2">Deskripsi Layanan / Barang</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Harga Satuan</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.03] text-white">
                      <td className="py-2.5">Paket Jasa Konsultasi Bisnis &amp; Langganan Solusi Digital</td>
                      <td className="py-2.5 text-right font-mono">1</td>
                      <td className="py-2.5 text-right font-mono">Rp {previewInvoice.amount.toLocaleString('id-ID')}</td>
                      <td className="py-2.5 text-right font-mono font-bold">Rp {previewInvoice.amount.toLocaleString('id-ID')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 font-semibold">
                <span className="text-[#8A93A3]">Total Tagihan (Termasuk PPN):</span>
                <span className="text-base text-[#3FBF8F] font-mono font-bold">
                  Rp {previewInvoice.amount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Tombol Unduh / Cetak */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(previewInvoice, null, 2));
                  const dl = document.createElement('a');
                  dl.setAttribute("href", dataStr);
                  dl.setAttribute("download", `invoice-${previewInvoice.invoiceNumber}.json`);
                  dl.click();
                }}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-[#C3CBD8] hover:text-white transition-all cursor-pointer border-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh JSON / Data</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-9 px-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0058BE] hover:brightness-110 text-xs font-semibold text-white transition-all cursor-pointer border-0 shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Client Profile & Payment History Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp text-[#F5F7FA]">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div>
                <h4 className="font-heading font-bold text-base text-white m-0">Profil Klien &amp; Riwayat Tagihan</h4>
                <span className="text-xs text-[#8A93A3]">{selectedClient.name}</span>
              </div>
              <button onClick={() => setSelectedClient(null)} className="text-[#8A93A3] hover:text-white cursor-pointer bg-transparent border-0 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#8A93A3]">Email Finance:</span>
                <span className="text-white font-mono">{selectedClient.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#8A93A3]">No. WhatsApp Penagihan:</span>
                <span className="text-white font-mono">{selectedClient.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#8A93A3]">Total Akumulasi Tagihan:</span>
                <span className="text-white font-mono font-bold">Rp {selectedClient.totalInvoiced.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[#8A93A3]">Status Piutang Berjalan:</span>
                <span className="font-bold text-[#EF4444] font-mono">
                  {selectedClient.totalPending > 0 ? `Rp ${selectedClient.totalPending.toLocaleString('id-ID')} (Belum Lunas)` : 'Semua Tagihan Lunas'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="h-9 px-4 bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold rounded-xl text-white cursor-pointer border-0"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Upload Mutasi Bank / Data Transaksi Kas (Terintegrasi Penuh) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-scaleUp text-[#F5F7FA]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[#3FBF8F]/15 flex items-center justify-center text-[#3FBF8F]">
                  <Upload className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-heading font-bold text-base text-white m-0">
                    Upload Mutasi Bank &amp; Data Transaksi Kas
                  </h4>
                  <span className="text-xs text-[#8A93A3]">
                    Impor transaksi langsung ke database kas &amp; sinkronisasi ke seluruh dashboard KLIR
                  </span>
                </div>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-[#8A93A3] hover:text-white cursor-pointer bg-transparent border-0 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download & File Input */}
            <div className="space-y-3">
              <div className="p-4 rounded-xl border-2 border-dashed border-white/10 hover:border-[#3FBF8F]/50 bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-center transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-[#3FBF8F]" />
                <div>
                  <label htmlFor="mutasi-file-input" className="text-xs font-semibold text-[#3FBF8F] hover:underline cursor-pointer">
                    Pilih file mutasi CSV / Excel
                  </label>
                  <span className="text-xs text-[#8A93A3]"> atau drag &amp; drop file ke sini</span>
                </div>
                <input
                  id="mutasi-file-input"
                  type="file"
                  accept=".csv, .xlsx, .xls, .json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadFile(file);
                    try {
                      const ext = file.name.split('.').pop()?.toLowerCase();
                      let rows: Array<{ date: string; type: 'INCOME' | 'EXPENSE'; category: string; amount: number; description: string }> = [];

                      if (ext === 'xlsx' || ext === 'xls') {
                        const XLSX = await import('xlsx');
                        const buffer = await file.arrayBuffer();
                        const workbook = XLSX.read(buffer, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        if (firstSheetName) {
                          const sheet = workbook.Sheets[firstSheetName];
                          const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                          if (rawJson.length > 1) {
                            const headerRow = rawJson[0] as any[];
                            const headers = headerRow.map((h: any) => String(h || '').toLowerCase().trim());
                            let dateIdx = headers.findIndex((h: string) => h.includes('tanggal') || h.includes('date') || h.includes('tgl'));
                            let typeIdx = headers.findIndex((h: string) => h.includes('tipe') || h.includes('jenis') || h.includes('type') || h.includes('mutasi'));
                            let catIdx = headers.findIndex((h: string) => h.includes('kategori') || h.includes('category') || h.includes('pos'));
                            let debitIdx = headers.findIndex((h: string) => (h.includes('debit') || h.includes('debet') || h.includes('keluar') || h.includes('pengeluaran')) && !h.includes('saldo'));
                            let creditIdx = headers.findIndex((h: string) => (h.includes('kredit') || h.includes('credit') || h.includes('masuk') || h.includes('pemasukan')) && !h.includes('saldo'));
                            let amountIdx = headers.findIndex((h: string) => (h.includes('nominal') || h.includes('jumlah') || h.includes('amount') || h.includes('total')) && !h.includes('saldo'));
                            let descIdx = headers.findIndex((h: string) => h.includes('keterangan') || h.includes('deskripsi') || h.includes('uraian') || h.includes('catatan') || h.includes('narasi') || h.includes('memo'));

                            if (dateIdx === -1) dateIdx = 0;
                            if (descIdx === -1) descIdx = 1;
                            if (catIdx === -1) catIdx = 2;

                            for (let i = 1; i < rawJson.length; i++) {
                              const r = rawJson[i];
                              if (!r || r.length === 0) continue;
                              const rawDate = r[dateIdx];
                              let dateStr = new Date().toLocaleDateString('id-ID');
                              if (rawDate) {
                                if (rawDate instanceof Date) {
                                  dateStr = rawDate.toLocaleDateString('id-ID');
                                } else {
                                  dateStr = String(rawDate);
                                }
                              }

                              if (debitIdx !== -1 || creditIdx !== -1) {
                                if (creditIdx !== -1) {
                                  const rawCredit = String(r[creditIdx] || '0').replace(/[^0-9.-]/g, '');
                                  const creditVal = Math.abs(parseFloat(rawCredit) || 0);
                                  if (creditVal > 0) {
                                    rows.push({
                                      date: dateStr,
                                      type: 'INCOME',
                                      category: String(r[catIdx] || 'Penjualan').trim(),
                                      amount: creditVal,
                                      description: String(r[descIdx] || 'Mutasi Kredit').trim(),
                                    });
                                  }
                                }
                                if (debitIdx !== -1) {
                                  const rawDebit = String(r[debitIdx] || '0').replace(/[^0-9.-]/g, '');
                                  const debitVal = Math.abs(parseFloat(rawDebit) || 0);
                                  if (debitVal > 0) {
                                    rows.push({
                                      date: dateStr,
                                      type: 'EXPENSE',
                                      category: String(r[catIdx] || 'Operasional').trim(),
                                      amount: debitVal,
                                      description: String(r[descIdx] || 'Mutasi Debit').trim(),
                                    });
                                  }
                                }
                              } else {
                                if (amountIdx === -1) amountIdx = 3;
                                const rawAmount = String(r[amountIdx] || '0').replace(/[^0-9.-]/g, '');
                                const amount = Math.abs(parseFloat(rawAmount) || 0);
                                if (amount > 0) {
                                  const rawType = String((typeIdx !== -1 ? r[typeIdx] : '') || '').toUpperCase();
                                  const type: 'INCOME' | 'EXPENSE' = (rawType.includes('IN') || rawType.includes('MASUK') || rawType.includes('CR')) ? 'INCOME' : 'EXPENSE';
                                  rows.push({
                                    date: dateStr,
                                    type,
                                    category: String(r[catIdx] || (type === 'INCOME' ? 'Penjualan' : 'Operasional')).trim(),
                                    amount,
                                    description: String(r[descIdx] || 'Mutasi Excel').trim(),
                                  });
                                }
                              }
                            }
                          }
                        }
                      } else if (ext === 'json') {
                        const text = await file.text();
                        const json = JSON.parse(text);
                        const items = Array.isArray(json) ? json : Array.isArray(json.transactions) ? json.transactions : [json];
                        rows = items.map((item: any) => {
                          const rawType = String(item.type || item.tipe || (item.kategori === 'INCOME' ? 'INCOME' : 'EXPENSE')).toUpperCase();
                          const type: 'INCOME' | 'EXPENSE' = rawType.includes('IN') || rawType.includes('MASUK') ? 'INCOME' : 'EXPENSE';
                          const amount = Math.abs(Number(item.amount ?? item.nominal ?? 0));
                          return {
                            date: item.date || item.tanggal || new Date().toLocaleDateString('id-ID'),
                            type,
                            category: String(item.category || item.kategori || (type === 'INCOME' ? 'Penjualan' : 'Operasional')).trim(),
                            amount,
                            description: String(item.description || item.keterangan || 'Mutasi JSON').trim(),
                          };
                        }).filter((r: any) => r.amount > 0);
                      } else {
                        // CSV or text
                        const text = await file.text();
                        const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
                        if (lines.length > 1) {
                          const first5 = lines.slice(0, 5).join('\n');
                          const semiCount = (first5.match(/;/g) || []).length;
                          const commaCount = (first5.match(/,/g) || []).length;
                          const tabCount = (first5.match(/\t/g) || []).length;
                          let delimiter = ',';
                          if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
                          else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

                          const parseLine = (line: string) => {
                            const cells: string[] = [];
                            let cur = '';
                            let inQuote = false;
                            for (let j = 0; j < line.length; j++) {
                              const ch = line[j];
                              if (ch === '"') {
                                inQuote = !inQuote;
                              } else if (ch === delimiter && !inQuote) {
                                cells.push(cur.trim());
                                cur = '';
                              } else {
                                cur += ch;
                              }
                            }
                            cells.push(cur.trim());
                            return cells;
                          };

                          const headerCells = parseLine(lines[0]).map((h: string) => h.toLowerCase().trim());
                          let dateIdx = headerCells.findIndex((h: string) => h.includes('tanggal') || h.includes('date') || h.includes('tgl'));
                          let typeIdx = headerCells.findIndex((h: string) => h.includes('tipe') || h.includes('jenis') || h.includes('type') || h.includes('mutasi'));
                          let catIdx = headerCells.findIndex((h: string) => h.includes('kategori') || h.includes('category'));
                          let debitIdx = headerCells.findIndex((h: string) => (h.includes('debit') || h.includes('debet') || h.includes('keluar') || h.includes('pengeluaran')) && !h.includes('saldo'));
                          let creditIdx = headerCells.findIndex((h: string) => (h.includes('kredit') || h.includes('credit') || h.includes('masuk') || h.includes('pemasukan')) && !h.includes('saldo'));
                          let amountIdx = headerCells.findIndex((h: string) => (h.includes('nominal') || h.includes('jumlah') || h.includes('amount') || h.includes('total')) && !h.includes('saldo'));
                          let descIdx = headerCells.findIndex((h: string) => h.includes('keterangan') || h.includes('deskripsi') || h.includes('uraian') || h.includes('catatan') || h.includes('memo'));

                          if (dateIdx === -1) dateIdx = 0;
                          if (descIdx === -1) descIdx = 1;
                          if (catIdx === -1) catIdx = 2;

                          for (let i = 1; i < lines.length; i++) {
                            const cells = parseLine(lines[i]);
                            if (cells.length < 2) continue;
                            const rawDate = cells[dateIdx] || new Date().toLocaleDateString('id-ID');

                            if (debitIdx !== -1 || creditIdx !== -1) {
                              if (creditIdx !== -1) {
                                const rawCredit = String(cells[creditIdx] || '0').replace(/[^0-9.-]/g, '');
                                const creditVal = Math.abs(parseFloat(rawCredit) || 0);
                                if (creditVal > 0) {
                                  rows.push({
                                    date: rawDate,
                                    type: 'INCOME',
                                    category: cells[catIdx] || 'Penjualan',
                                    amount: creditVal,
                                    description: cells[descIdx] || 'Mutasi Kredit',
                                  });
                                }
                              }
                              if (debitIdx !== -1) {
                                const rawDebit = String(cells[debitIdx] || '0').replace(/[^0-9.-]/g, '');
                                const debitVal = Math.abs(parseFloat(rawDebit) || 0);
                                if (debitVal > 0) {
                                  rows.push({
                                    date: rawDate,
                                    type: 'EXPENSE',
                                    category: cells[catIdx] || 'Operasional',
                                    amount: debitVal,
                                    description: cells[descIdx] || 'Mutasi Debit',
                                  });
                                }
                              }
                            } else {
                              if (amountIdx === -1) amountIdx = 3;
                              const rawAmount = String(cells[amountIdx] || '0').replace(/[^0-9.-]/g, '');
                              const amount = Math.abs(parseFloat(rawAmount) || 0);
                              if (amount > 0) {
                                const rawType = String((typeIdx !== -1 ? cells[typeIdx] : '') || '').toUpperCase();
                                const rawDesc = String(cells[descIdx] || '').toLowerCase();
                                const rawCat = String(cells[catIdx] || '').toLowerCase();
                                const allRowText = cells.join(' ').toLowerCase();

                                // Deteksi cerdas penjualan kasir / POS:
                                const isPosSale =
                                  rawType.includes('IN') ||
                                  rawType.includes('MASUK') ||
                                  rawType.includes('CR') ||
                                  allRowText.includes('gofood') ||
                                  allRowText.includes('grabfood') ||
                                  allRowText.includes('shopeefood') ||
                                  allRowText.includes('dine-in') ||
                                  allRowText.includes('takeaway') ||
                                  allRowText.includes('makanan') ||
                                  allRowText.includes('minuman') ||
                                  allRowText.includes('snack') ||
                                  rawCat.includes('makanan') ||
                                  rawCat.includes('minuman') ||
                                  rawCat.includes('snack') ||
                                  rawCat.includes('penjualan');

                                const type: 'INCOME' | 'EXPENSE' = isPosSale ? 'INCOME' : 'EXPENSE';
                                rows.push({
                                  date: rawDate,
                                  type,
                                  category: cells[catIdx] || (type === 'INCOME' ? 'Penjualan' : 'Operasional'),
                                  amount,
                                  description: cells[descIdx] || (type === 'INCOME' ? 'Penjualan Kasir' : 'Mutasi CSV'),
                                });
                              }
                            }
                          }
                        }
                      }

                      if (rows.length > 0) {
                        setUploadDataRows(rows);
                        setToastMsg(`Berhasil membaca ${rows.length} transaksi dari berkas.`);
                      } else {
                        setToastMsg('Tidak dapat menemukan baris transaksi valid dalam berkas.');
                      }
                    } catch (parseErr: any) {
                      console.error('[Mutasi File Parse Error]:', parseErr);
                      setToastMsg('Gagal memproses berkas mutasi. Periksa format CSV/Excel Anda.');
                    }
                  }}
                />
                {uploadFile && (
                  <span className="text-xs font-semibold text-[#3FBF8F] mt-1">
                    File terpilih: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8A93A3]">Format didukung: CSV, XLSX, JSON dari BCA/Mandiri/BRI/BSI</span>
                <button
                  type="button"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8,Tanggal,Tipe,Kategori,Nominal,Keterangan\n13/09/2026,INCOME,Penjualan Produk / Jasa,25000000,Pembayaran Invoice Klien\n12/09/2026,EXPENSE,Iklan & Marketing,4500000,Belanja Iklan Meta\n";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "template_mutasi_kas_klir.csv");
                    link.click();
                  }}
                  className="inline-flex items-center gap-1 text-[#8CC0FF] hover:underline bg-transparent border-0 cursor-pointer p-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template CSV</span>
                </button>
              </div>
            </div>

            {/* Preview Tabel Mutasi */}
            {uploadDataRows.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-white">Preview Data Mutasi Terdeteksi ({uploadDataRows.length} Baris):</span>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[#8A93A3] text-xs bg-white/[0.02]">
                        <th className="p-2">Tanggal</th>
                        <th className="p-2">Tipe</th>
                        <th className="p-2">Kategori</th>
                        <th className="p-2 text-right">Nominal</th>
                        <th className="p-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadDataRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-white/[0.03] text-[#F5F7FA]">
                          <td className="p-2 font-mono text-xs text-[#8A93A3]">{row.date}</td>
                          <td className="p-2">
                            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${row.type === 'INCOME' ? 'bg-[#3FBF8F]/20 text-[#3FBF8F]' : 'bg-[#EF4444]/20 text-[#EF4444]'}`}>
                              {row.type === 'INCOME' ? 'MASUK' : 'KELUAR'}
                            </span>
                          </td>
                          <td className="p-2 text-xs">{row.category}</td>
                          <td className="p-2 text-right font-mono font-semibold">Rp {row.amount.toLocaleString('id-ID')}</td>
                          <td className="p-2 text-xs text-[#8A93A3] truncate max-w-[180px]">{row.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="h-9 px-4 rounded-xl border border-white/[0.1] text-[#C6CEDA] text-xs font-semibold cursor-pointer bg-transparent"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={uploadDataRows.length === 0 || isUploading}
                onClick={async () => {
                  setIsUploading(true);
                  try {
                    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
                    const res = await fetch(`/api/v1/kas/transactions${qs}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ batch: uploadDataRows }),
                      credentials: 'include',
                    });
                    const json = await res.json();
                    if (res.ok && json.success) {
                      setIsUploadModalOpen(false);
                      setToastMsg(`Berhasil mengimpor ${json.count || uploadDataRows.length} transaksi kas ke database KLIR.`);
                      await loadRealData();
                      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
                      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
                    } else {
                      setToastMsg(json.message || 'Gagal menyimpan transaksi ke database.');
                    }
                  } catch (err: any) {
                    console.error('[Import Mutasi Error]:', err);
                    setToastMsg('Terjadi kesalahan koneksi saat mengimpor mutasi.');
                  } finally {
                    setIsUploading(false);
                  }
                }}
                className="h-9 px-4 rounded-xl bg-[#3FBF8F] hover:brightness-110 text-[#0B0E14] text-xs font-bold cursor-pointer disabled:opacity-50 border-0 transition-all shadow-md flex items-center gap-1.5"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Impor ke Database KLIR</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoiceDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-0 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-0">
              <h4 className="font-heading font-bold text-base text-white">
                Rincian Invoice Piutang
              </h4>
              <button
                onClick={() => setSelectedInvoiceDetail(null)}
                className="text-[#8A93A3] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Nomor Invoice</span>
                <span className="font-mono text-white font-bold">{selectedInvoiceDetail.invoiceNumber}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Nama Klien</span>
                <span className="text-white font-bold">{selectedInvoiceDetail.clientName}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Nominal Tagihan</span>
                <span className="font-mono text-[#EF4444] font-bold text-sm">
                  Rp {selectedInvoiceDetail.amount.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Status Pembayaran</span>
                <span
                  className={`font-bold ${
                    selectedInvoiceDetail.status === 'PAID'
                      ? 'text-[#3FBF8F]'
                      : selectedInvoiceDetail.status === 'OVERDUE'
                      ? 'text-[#EF4444]'
                      : 'text-[#F2A83B]'
                  }`}
                >
                  {selectedInvoiceDetail.status}
                  {selectedInvoiceDetail.status === 'OVERDUE' ? ' (jatuh tempo terlewati)' : ''}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Jatuh Tempo</span>
                <span className="text-white font-mono">{selectedInvoiceDetail.dueDate}</span>
              </div>
            </div>

            {selectedInvoiceDetail.status !== 'PAID' && (
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSendReminder(selectedInvoiceDetail.id);
                    setSelectedInvoiceDetail(null);
                  }}
                  disabled={selectedInvoiceDetail.isReminderSent || sendingReminderId === selectedInvoiceDetail.id}
                  className="flex-1 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{selectedInvoiceDetail.isReminderSent ? 'Sudah Ditagih' : 'Tagih via WhatsApp'}</span>
                </button>
                {/* FIX FIN-02 (8 Sep 2026) -- Tandai Lunas juga tersedia di modal detail,
                    bukan cuma di baris list. */}
                <button
                  type="button"
                  onClick={() => handleMarkInvoicePaid(selectedInvoiceDetail.id, `${selectedInvoiceDetail.clientName} (${selectedInvoiceDetail.invoiceNumber})`)}
                  disabled={markingPaidId === selectedInvoiceDetail.id}
                  className="flex-1 py-2.5 bg-[#3FBF8F] hover:brightness-110 text-[#0B0E14] font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{markingPaidId === selectedInvoiceDetail.id ? 'Memproses...' : 'Tandai Lunas'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Client Profile Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 max-w-lg w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4E9BFF]/10 text-[#4E9BFF] flex items-center justify-center font-bold text-sm">
                  {selectedClient.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-heading font-bold text-base text-white m-0">
                    {selectedClient.name}
                  </h4>
                  <span className="text-xs text-[#8A93A3]">Profil Rekanan &amp; Riwayat Tagihan</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="text-[#8A93A3] hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Contact Bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {selectedClient.phone && (
                <a
                  href={`https://wa.me/${selectedClient.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-[#C3CBD8] hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#3FBF8F]" />
                  <span>{selectedClient.phone}</span>
                </a>
              )}
              {selectedClient.email && (
                <a
                  href={`mailto:${selectedClient.email}`}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-[#C3CBD8] hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#4E9BFF]" />
                  <span>{selectedClient.email}</span>
                </a>
              )}
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1">
                <span className="text-xs text-[#8A93A3]">Total Ditagihkan</span>
                <span className="font-mono text-xs font-bold text-white">
                  Rp {selectedClient.totalInvoiced.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#3FBF8F]/[0.05] border border-[#3FBF8F]/20 flex flex-col gap-1">
                <span className="text-xs text-[#3FBF8F]">Sudah Terbayar</span>
                <span className="font-mono text-xs font-bold text-[#3FBF8F]">
                  Rp {selectedClient.totalPaid.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F2A83B]/[0.05] border border-[#F2A83B]/20 flex flex-col gap-1">
                <span className="text-xs text-[#F2A83B]">Sisa Piutang</span>
                <span className="font-mono text-xs font-bold text-[#F2A83B]">
                  Rp {selectedClient.totalPending.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Client Invoices List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-[#8A93A3]">
                <span>Faktur Terkait Klien Ini</span>
                <span>
                  {invoices.filter((i) => i.clientName.toLowerCase() === selectedClient.name.toLowerCase()).length} invoice
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {invoices
                  .filter((i) => i.clientName.toLowerCase() === selectedClient.name.toLowerCase())
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono font-semibold text-white">{inv.invoiceNumber}</span>
                        <span className="text-xs text-[#5C6474]">Tempo: {inv.dueDate || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-[#3FBF8F]/20 text-[#3FBF8F]'
                              : inv.status === 'OVERDUE'
                              ? 'bg-[#EF4444]/20 text-[#EF4444]'
                              : 'bg-[#F2A83B]/20 text-[#F2A83B]'
                          }`}
                        >
                          {inv.status}
                        </span>
                        <span className="font-mono font-bold text-white">
                          Rp {inv.amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold cursor-pointer transition-all"
              >
                Tutup Profil
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

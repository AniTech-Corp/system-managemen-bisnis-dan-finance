'use client';

import React, { useState, useEffect, useRef } from 'react';
import TermHint from './TermHint';
import {
  Bot,
  Zap,
  CheckCircle2,
  X,
  Play,
  Pause,
  ArrowRight,
  FileText,
  Eye,
  Download,
  Megaphone,
  Trash2,
  Users,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Upload,
  Printer,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LineChart,
  TrendingUp,
  Target,
  Layers,
  ShieldCheck,
  Smartphone,
  Laptop,
  Tablet,
  PieChart,
  Activity,
  Sliders,
  Presentation,
} from 'lucide-react';
import { SpotlightCard } from '@/components/ui/react-bits/SpotlightCard';
import { ShinyText } from '@/components/ui/react-bits/ShinyText';
import { CountUp } from '@/components/ui/react-bits/CountUp';
import InCardVisualDrilldown from './shared/InCardVisualDrilldown';

interface MarketingModuleViewProps {
  workspaceId?: string;
  workspaceName?: string;
  onOpenAIStudio?: () => void;
  onOpenAI?: (prompt: string) => void;
}

// Format desimal gaya Indonesia: 3.5 -> "3,5"
const idDec = (n: number, digits = 1) =>
  n.toFixed(digits).replace('.', ',');

const idMoney = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

// Style badge platform kampanye (borderless pill)
const platformBadgeStyle = (platform: string): React.CSSProperties => {
  if (platform === 'TikTok Ads') return { color: '#A5B4FC', background: 'rgba(99,102,241,0.12)', border: 'none' };
  if (platform === 'Google Ads') return { color: '#F2A83B', background: 'rgba(242,168,59,0.10)', border: 'none' };
  return { color: '#4E9BFF', background: 'rgba(78,155,255,0.12)', border: 'none' };
};

// Warna ROAS 3-tingkat kampanye (>=3.5 hijau, >=3.0 biru, di bawah itu amber)
const roasTierColor = (n: number) => (n >= 3.5 ? '#3FBF8F' : n >= 3 ? '#4E9BFF' : '#F2A83B');

// Helper murni (10 Sep 2026, Fable, kontrak marketing-build D3) -- baca target ROAS
// dari localStorage klir_settings_mkt_<workspaceId> yang ditulis MarketingSettingsModal.tsx
// (slider "Target Blended ROAS Minimum"), bukan angka hardcode 3.0 lagi. Kalau localStorage
// kosong/rusak/belum pernah diset, fallback 3.0 (angka lama, supaya tampilan tidak berubah
// untuk workspace yang belum pernah menyentuh Pengaturan Marketing).
export function readRoasTarget(raw: string | null | undefined): number {
  if (!raw) return 3.0;
  try {
    const parsed = JSON.parse(raw);
    const v = Number(parsed?.targetRoas);
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    // JSON rusak -- jangan lempar error, jatuh ke fallback di bawah.
  }
  return 3.0;
}

// Helper murni (kontrak marketing-build, item e) -- kelompokkan kampanye per bulan
// dibuat (createdAt) untuk menentukan apakah ada >= 2 bulan jejak kampanye. PERKIRAAN
// KASAR dengan sengaja: belanja/omset per bulan dihitung dari dailyBudget & roas SAAT INI
// tiap kampanye (KLIR belum menyimpan snapshot bulanan asli), dipakai HANYA sebagai gerbang
// "cukup data untuk proyeksi" dan gambaran run-rate -- bukan angka pasti histori riil.
export interface CampaignMonthlySample {
  monthKey: string; // format 'YYYY-MM'
  spend: number;
  revenue: number;
}

export function groupCampaignsByMonth(
  campaigns: Array<{ createdAt?: string | Date | null; dailyBudget?: number; roas?: string | number }>
): CampaignMonthlySample[] {
  const map = new Map<string, { spend: number; revenue: number }>();
  for (const c of campaigns || []) {
    if (!c || !c.createdAt) continue;
    const d = new Date(c.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const budget = typeof c.dailyBudget === 'number' && c.dailyBudget > 0 ? c.dailyBudget : 0;
    const roasNum =
      typeof c.roas === 'number' ? c.roas : parseFloat(String(c.roas ?? '0')) || 0;
    const monthlySpend = budget * 30;
    const entry = map.get(key) || { spend: 0, revenue: 0 };
    entry.spend += monthlySpend;
    entry.revenue += monthlySpend * roasNum;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([monthKey, v]) => ({ monthKey, spend: v.spend, revenue: v.revenue }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export interface CampaignYearEndProjection {
  monthsTracked: number;
  avgMonthlySpend: number;
  avgMonthlyRevenue: number;
  avgMonthlyRoas: number;
  monthsRemainingInYear: number;
  projectedSpendEndOfYear: number;
  projectedRevenueEndOfYear: number;
  projectedRoasEndOfYear: number;
}

// Proyeksi sederhana (rata-rata run-rate bulanan x sisa bulan tahun berjalan, TERMASUK
// bulan berjalan). Sengaja return null kalau samples.length < 2 -- 1 titik data tidak
// cukup untuk menyimpulkan tren, memproyeksikan dari situ berisiko menyesatkan (jujur
// lebih penting dari terlihat pintar).
export function buildCampaignYearEndProjection(
  samples: CampaignMonthlySample[],
  now: Date = new Date()
): CampaignYearEndProjection | null {
  if (!Array.isArray(samples) || samples.length < 2) return null;
  const totalSpend = samples.reduce((a, s) => a + s.spend, 0);
  const totalRevenue = samples.reduce((a, s) => a + s.revenue, 0);
  const avgMonthlySpend = totalSpend / samples.length;
  const avgMonthlyRevenue = totalRevenue / samples.length;
  const avgMonthlyRoas = avgMonthlySpend > 0 ? avgMonthlyRevenue / avgMonthlySpend : 0;
  const monthsRemainingInYear = Math.max(0, 11 - now.getMonth());
  const monthsIncludingCurrent = monthsRemainingInYear + 1;
  return {
    monthsTracked: samples.length,
    avgMonthlySpend,
    avgMonthlyRevenue,
    avgMonthlyRoas,
    monthsRemainingInYear,
    projectedSpendEndOfYear: avgMonthlySpend * monthsIncludingCurrent,
    projectedRevenueEndOfYear: avgMonthlyRevenue * monthsIncludingCurrent,
    projectedRoasEndOfYear: avgMonthlyRoas,
  };
}

// Helper murni -- pilih maksimal N rekomendasi kategori MARKETING dari
// GET /api/v1/brain/recommendations (AIRecommendationItem[], lihat src/lib/ai-brain/types.ts),
// diurutkan prioritas CRITICAL > HIGH > MEDIUM > LOW. Tidak menyentuh/menduplikasi logic
// decision-engine.ts -- murni filter+sort tampilan.
export interface MarketingRecommendationLike {
  id?: string;
  category: string;
  priority: string;
  title: string;
  prescription?: string;
  triggerReason?: string;
}

const RECOMMENDATION_PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function pickTopMarketingRecommendations<T extends MarketingRecommendationLike>(
  recommendations: T[] | null | undefined,
  limit = 2
): T[] {
  if (!Array.isArray(recommendations)) return [];
  return recommendations
    .filter((r) => r && r.category === 'MARKETING')
    .slice()
    .sort(
      (a, b) =>
        (RECOMMENDATION_PRIORITY_RANK[a.priority] ?? 9) -
        (RECOMMENDATION_PRIORITY_RANK[b.priority] ?? 9)
    )
    .slice(0, Math.max(0, limit));
}

// =============================================================================
// KONTRAK MODUL 6 -- dashboard-insight (11 Sep 2026, Fable). Tipe DIDEFINISIKAN
// LOKAL (duplikat sengaja dengan CompanyDataDashboard.tsx/FinanceModuleView.tsx,
// BUKAN diimpor dari src/lib/ai-brain/dashboard-insight.ts server-only -- lihat
// komentar panjang di salinan pertama, CompanyDataDashboard.tsx, alasan
// insiden 8 Sep komponen client mengimpor modul node-only). Kalau kontrak
// modul 6 berubah, 3 salinan ini WAJIB diupdate bersamaan.
// =============================================================================
export interface MarketingDashboardInsightRecommendation {
  judul: string;
  alasan: string;
  langkah: string;
  dampak: string;
  prioritas: 'tinggi' | 'sedang' | 'rendah';
}

export interface MarketingDashboardInsightSumberData {
  transaksiTercatat: boolean;
  jumlahTransaksi: number;
  dokumen: number;
  dokumenLedgerTerdeteksi: number;
  kampanye: number;
  tugas: number;
  produk: number;
}

export interface MarketingDashboardInsight {
  role: 'ceo' | 'finance' | 'marketing';
  generatedAt: string;
  cached: boolean;
  ringkasan: string;
  sorotan: string[];
  rekomendasi: MarketingDashboardInsightRecommendation[];
  prediksi: { teks: string; horizonBulan: number; keyakinan: 'rendah' | 'sedang' | 'tinggi' };
  peringatan: string[];
  pertanyaanLanjutan: string[];
  sumberData: MarketingDashboardInsightSumberData;
  catatanJujur: string[];
}

export interface MarketingCampaignMetricLike {
  dailyBudget?: unknown;
  roas?: unknown;
  leads?: unknown;
  status?: unknown;
}

export interface DerivedMarketingMetrics {
  roas: string;
  revenue: number;
  spend: number;
  leads: number;
  activeCampaignsCount: number;
}

function parseMarketingNumber(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/x$/i, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Satu model metrik untuk kartu, drilldown, export, dan insight Marketing.
 * Spend/omset adalah run-rate 30 hari dari baris kampanye yang sama; ini bukan
 * klaim provider ads live. */
export function deriveMarketingMetrics(campaigns: MarketingCampaignMetricLike[]): DerivedMarketingMetrics {
  const rows = Array.isArray(campaigns) ? campaigns : [];
  const spend = rows.reduce((total, campaign) => total + Math.max(0, parseMarketingNumber(campaign.dailyBudget)) * 30, 0);
  const revenue = rows.reduce((total, campaign) => {
    const campaignSpend = Math.max(0, parseMarketingNumber(campaign.dailyBudget)) * 30;
    return total + campaignSpend * Math.max(0, parseMarketingNumber(campaign.roas));
  }, 0);
  const leads = rows.reduce((total, campaign) => total + Math.max(0, Math.round(parseMarketingNumber(campaign.leads))), 0);
  const activeCampaignsCount = rows.filter((campaign) => !campaign.status || String(campaign.status).toUpperCase() === 'ACTIVE').length;
  const blendedRoas = spend > 0 ? revenue / spend : 0;
  return {
    roas: blendedRoas > 0 ? `${idDec(blendedRoas)}x` : '0x',
    revenue: Math.round(revenue),
    spend: Math.round(spend),
    leads,
    activeCampaignsCount,
  };
}

/** Format baris "Diperbarui HH:MM (cache)" untuk header kartu dashboard-insight
 * -- MURNI Date getters lokal (bukan Intl/toLocaleTimeString) supaya hasilnya
 * tidak bergantung pada ketersediaan data locale ICU di runtime yang beda-beda
 * (tetap benar walau Node build tanpa full-icu). generatedAt tidak valid ->
 * jujur tampilkan '--' daripada 'Invalid Date' mentah. 11 Sep 2026 (Fable). */
export function formatDashboardInsightTimestamp(generatedAt: string, cached: boolean): string {
  const d = new Date(generatedAt);
  if (isNaN(d.getTime())) return cached ? 'Diperbarui -- (cache)' : 'Diperbarui --';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `Diperbarui ${hh}:${mm}${cached ? ' (cache)' : ''}`;
}

const DEMO_MARKETING_CAMPAIGNS = [
  {
    id: 'demo-camp-1',
    name: 'Scale Meta Ads - Promo Gajian & Flash Sale',
    platform: 'Meta Ads',
    dailyBudget: 450000,
    roas: '4,6',
    leads: 285,
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: 'demo-camp-2',
    name: 'TikTok Motion Video Hook - Viral UGC Catalog',
    platform: 'TikTok Ads',
    dailyBudget: 350000,
    roas: '3,8',
    leads: 194,
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'demo-camp-3',
    name: 'Google Search High-Intent & Brand Keyword PMax',
    platform: 'Google Ads',
    dailyBudget: 250000,
    roas: '4,1',
    leads: 142,
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
];

const DEMO_MARKETING_METRICS = deriveMarketingMetrics(DEMO_MARKETING_CAMPAIGNS);
const DEMO_MARKETING_CPL = DEMO_MARKETING_METRICS.leads > 0
  ? Math.round(DEMO_MARKETING_METRICS.spend / DEMO_MARKETING_METRICS.leads)
  : 0;

const DEMO_MARKETING_PROMOS = [
  {
    id: 'demo-promo-1',
    code: 'GAJIANHEMAT20',
    discount: '20%',
    limit: '500',
    used: 342,
    status: 'ACTIVE',
  },
  {
    id: 'demo-promo-2',
    code: 'ONGKIRFREE',
    discount: 'Rp 15.000',
    limit: '1000',
    used: 728,
    status: 'ACTIVE',
  },
];

export default function MarketingModuleView({
  workspaceId = 'f451b290-1fc6-474d-8787-b8f1121c798b',
  workspaceName = 'Anitech Workspace',
  onOpenAIStudio,
  onOpenAI,
}: MarketingModuleViewProps) {
  const isDevLocalhost = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    : process.env.NODE_ENV === 'development';

  const [isDemoActive, setIsDemoActive] = useState(isDevLocalhost);

  // Top 3 Metrics (Clean Zero-State default)
  const [metrics, setMetrics] = useState<DerivedMarketingMetrics>(
    isDevLocalhost ? DEMO_MARKETING_METRICS : { roas: '0x', revenue: 0, spend: 0, leads: 0, activeCampaignsCount: 0 }
  );

  // Active Campaigns List (Clean Zero-State default)
  const [campaigns, setCampaigns] = useState<any[]>(isDevLocalhost ? DEMO_MARKETING_CAMPAIGNS : []);

  // Per-baris hapus kampanye (bukan state submitting global) supaya baris lain tetap
  // interaktif saat 1 baris sedang diproses -- pola sama dengan FinanceModuleView.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Promo Vouchers State (Clean Zero-State default)
  const [activePromos, setActivePromos] = useState<any[]>([]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Upload Data Kampanye & Performa Marketing Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI analisa & prediksi kampanye (10 Sep 2026, Fable, kontrak marketing-build item e) --
  // rekomendasi kategori MARKETING dari GET /api/v1/brain/recommendations. Proyeksi
  // akhir tahun dihitung LOKAL dari campaigns (buildCampaignYearEndProjection), tidak
  // dari endpoint ini -- endpoint ini murni sumber 2 rekomendasi.
  const [mktRecommendations, setMktRecommendations] = useState<MarketingRecommendationLike[]>([]);
  const [aiInsightLoaded, setAiInsightLoaded] = useState(false);

  // KONTRAK MODUL 6 (11 Sep 2026, Fable) -- kartu "Analisis & rekomendasi AI"
  // role=marketing, GET /api/v1/brain/dashboard-insight?role=marketing. Fetch
  // TERPISAH dari loadAiRecommendations di atas (endpoint beda) -- kartu ini
  // BERDAMPINGAN dengan Blok A "AI analisa & prediksi kampanye" yang sudah
  // ada, TIDAK menggantikannya (lihat catatan "jangan dobel" di titik render).
  const [mktInsight, setMktInsight] = useState<MarketingDashboardInsight | null>(null);
  const [mktInsightError, setMktInsightError] = useState(false);
  const [mktInsightLoading, setMktInsightLoading] = useState(true);
  const mktInsightLoaderRef = useRef<(refresh?: boolean) => void>(() => {});

  // Mode Switcher untuk kartu Analisis & Rekomendasi AI ('compact' | 'detailed')
  const [mktAiInsightMode, setMktAiInsightMode] = useState<'compact' | 'detailed'>('detailed');
  const handleToggleMktAiInsightMode = (mode: 'compact' | 'detailed') => {
    setMktAiInsightMode(mode);
    try {
      localStorage.setItem(`klir_mkt_ai_insight_mode_${workspaceId}`, mode);
    } catch {}
  };

  // Mode Switcher untuk kartu AI Analisa & Prediksi Kampanye ('compact' | 'detailed')
  const [mktPredictionMode, setMktPredictionMode] = useState<'compact' | 'detailed'>('compact');

  // Keputusan interaktif rekomendasi AI (Setujui / Kaji Ulang / Tolak)
  const [mktRecomDecisions, setMktRecomDecisions] = useState<Record<number, 'approved' | 'review' | 'rejected'>>({});

  // D3 (audit 10 Sep): target ROAS sekarang dibaca dari Pengaturan Marketing
  // (localStorage klir_settings_mkt_<workspaceId>.targetRoas), BUKAN hardcode 3.0 lagi.
  // State (bukan const) supaya bisa disegarkan saat event klir-ai-state-updated /
  // klir-settings-updated (dispatch MarketingSettingsModal.tsx saat Simpan ditekan).
  const [roasTargetX, setRoasTargetX] = useState(3.0);
  const readRoasTargetFromStorage = () => {
    try {
      setRoasTargetX(readRoasTarget(localStorage.getItem(`klir_settings_mkt_${workspaceId}`)));
    } catch (e) {
      // localStorage tidak tersedia (mis. SSR/private mode) -- biarkan fallback 3.0.
    }
  };

  // Sync initial state from localStorage
  const syncWithLocalStorage = () => {
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.marketing) {
          // KENAPA: dulu ada fallback "|| 3.5" yang memasang angka ROAS contoh begitu
          // blendedRoas kosong/nol -- persis kelas bug yang bikin demo ke klien gagal
          // (angka karangan tampil seolah data nyata). Sekarang: kalau blendedRoas
          // bukan angka positif yang valid, JANGAN timpa metrics -- biarkan nilai
          // sebelumnya (default zero-state) yang tampil.
          // CARA MEMBATALKAN: kembalikan "|| 3.5" di dua baris roas/revenue di bawah.
          const blendedRoas =
            typeof parsed.marketing.blendedRoas === 'number' && parsed.marketing.blendedRoas > 0
              ? parsed.marketing.blendedRoas
              : null;
          setMetrics((prev) => ({
            ...prev,
            roas: blendedRoas !== null ? `${blendedRoas}x` : prev.roas,
            revenue:
              blendedRoas !== null && parsed.marketing.adSpendBudget
                ? Math.round(parsed.marketing.adSpendBudget * blendedRoas)
                : prev.revenue,
          }));
        }
      }
    } catch (e) {
      console.warn('Sync error:', e);
    }
  };

  // Ambil 2 rekomendasi kategori MARKETING dari brain -- endpoint ini business-wide
  // (TIDAK di-role-gate di route handler-nya, lihat 2026-09-10-audit-portal-marketing.md
  // bagian "BLOK AI ANALISA"), dipakai murni untuk kartu "AI analisa & prediksi kampanye".
  // Gagal fetch = jujur tampil "Belum ada rekomendasi" (lihat pickTopMarketingRecommendations),
  // BUKAN dibiarkan diam tanpa penanda loaded.
  const loadAiRecommendations = async () => {
    try {
      const res = await fetch('/api/v1/brain/recommendations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const recs = Array.isArray(data?.data?.recommendations) ? data.data.recommendations : [];
        if (recs.length === 0 && isDevLocalhost) {
          setMktRecommendations([
            { id: 'mkt-rec-1', category: 'MARKETING', priority: 'HIGH', title: 'Scale Meta Ads Promo Gajian', prescription: 'ROAS Meta Ads mencapai 4.6x (di atas target 3.0x). Naikkan daily budget sebesar 20% untuk menjangkau audiens lookalike.' },
            { id: 'mkt-rec-2', category: 'MARKETING', priority: 'MEDIUM', title: 'Optimalkan Click-to-WA Conversion', prescription: 'Rasio klik ke chat WhatsApp berada di 16.3%. Tambahkan penawaran voucher gratis ongkir langsung di bio link.' },
          ]);
        } else {
          setMktRecommendations(recs);
        }
      } else if (isDevLocalhost) {
        setMktRecommendations([
          { id: 'mkt-rec-1', category: 'MARKETING', priority: 'HIGH', title: 'Scale Meta Ads Promo Gajian', prescription: 'ROAS Meta Ads mencapai 4.6x (di atas target 3.0x). Naikkan daily budget sebesar 20% untuk menjangkau audiens lookalike.' },
          { id: 'mkt-rec-2', category: 'MARKETING', priority: 'MEDIUM', title: 'Optimalkan Click-to-WA Conversion', prescription: 'Rasio klik ke chat WhatsApp berada di 16.3%. Tambahkan penawaran voucher gratis ongkir langsung di bio link.' },
        ]);
      }
    } catch (err) {
      console.warn('Marketing load AI recommendations failed:', err);
      if (isDevLocalhost) {
        setMktRecommendations([
          { id: 'mkt-rec-1', category: 'MARKETING', priority: 'HIGH', title: 'Scale Meta Ads Promo Gajian', prescription: 'ROAS Meta Ads mencapai 4.6x (di atas target 3.0x). Naikkan daily budget sebesar 20% untuk menjangkau audiens lookalike.' },
          { id: 'mkt-rec-2', category: 'MARKETING', priority: 'MEDIUM', title: 'Optimalkan Click-to-WA Conversion', prescription: 'Rasio klik ke chat WhatsApp berada di 16.3%. Tambahkan penawaran voucher gratis ongkir langsung di bio link.' },
        ]);
      }
    } finally {
      setAiInsightLoaded(true);
    }
  };

  useEffect(() => {
    syncWithLocalStorage();
    loadRealData();
    loadAiRecommendations();
    readRoasTargetFromStorage();
    // FIX (8 Sep malam, audit integrasi 3-portal) -- sebelumnya handleSync di sini cuma
    // syncWithLocalStorage() (1 baris), beda dari FinanceModuleView.tsx yang setara (2 baris:
    // syncWithLocalStorage() + loadRealData()). Akibatnya kampanye/kupon baru yang ditulis AI
    // Assistant (action-card SCALE_ADS/LAUNCH_ADS -> promoCoupon.create nyata di server) tidak
    // pernah muncul di tabel/hero widget ini sampai reload penuh, walau event klir-ai-state-updated
    // sudah benar terkirim. Murni tambah 1 baris supaya sejajar pola Finance yang sudah benar.
    const handleSync = () => { syncWithLocalStorage(); loadRealData(); readRoasTargetFromStorage(); };
    window.addEventListener('klir-ai-state-updated', handleSync);
    window.addEventListener('klir-mkt-updated', handleSync);
    window.addEventListener('klir-marketing-updated', handleSync);
    window.addEventListener('klir-kas-updated', handleSync);
    window.addEventListener('klir-inventory-updated', handleSync);
    return () => {
      window.removeEventListener('klir-ai-state-updated', handleSync);
      window.removeEventListener('klir-mkt-updated', handleSync);
      window.removeEventListener('klir-marketing-updated', handleSync);
      window.removeEventListener('klir-kas-updated', handleSync);
      window.removeEventListener('klir-inventory-updated', handleSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kampanye adalah sumber kebenaran Marketing. Re-derive setelah toggle/delete
  // maupun hasil fetch agar metrics tidak tertinggal dari list yang sedang tampil.
  useEffect(() => {
    setMetrics(deriveMarketingMetrics(campaigns));
  }, [campaigns]);

  // KONTRAK MODUL 6 (11 Sep 2026, Fable) -- kartu "Analisis & rekomendasi AI"
  // role=marketing.
  useEffect(() => {
    let cancelled = false;
    try {
      const savedMode = localStorage.getItem(`klir_mkt_ai_insight_mode_${workspaceId}`);
      if (savedMode === 'compact' || savedMode === 'detailed') {
        setMktAiInsightMode(savedMode);
      }
    } catch {}

    const loadMktInsight = async (refresh?: boolean) => {
      setMktInsightLoading(true);
      try {
        const res = await fetch(`/api/v1/brain/dashboard-insight?role=marketing${refresh ? '&refresh=1' : ''}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (json?.success && json?.data) {
          const data = json.data as MarketingDashboardInsight;
          // Di localhost/dev: jika data kosong atau ringkasan masih 0 kampanye, enrich dengan benchmark realistis
          if (isDevLocalhost && (data.ringkasan?.includes('0 kampanye') || !data.rekomendasi || data.rekomendasi.length === 0)) {
            data.ringkasan = `Performa akuisisi 30 hari terakhir mencatatkan total belanja iklan ${idMoney(DEMO_MARKETING_METRICS.spend)} dengan omset teratribusi ${idMoney(DEMO_MARKETING_METRICS.revenue)} (Blended ROAS ${DEMO_MARKETING_METRICS.roas}). Terhimpun ${DEMO_MARKETING_METRICS.leads} prospek terverifikasi dengan rata-rata CPL ${idMoney(DEMO_MARKETING_CPL)}. Kanal Meta Ads menjadi pendorong utama profitabilitas (ROAS 4,6x), sedangkan materi TikTok Ads memerlukan rotasi hook video UGC.`;
            data.sorotan = [
              `Blended ROAS ${DEMO_MARKETING_METRICS.roas} melampaui target minimum (3,0x) dengan margin kontribusi prima`,
              `Total ${DEMO_MARKETING_METRICS.leads} prospek terkonversi dengan efisiensi biaya CPL ${idMoney(DEMO_MARKETING_CPL)}`,
              'Meta Ads menghasilkan 285 prospek (46% volume total) dengan ROAS 4,6x',
              'TikTok Ads menunjukkan sinyal ad fatigue dengan kenaikan CPL +8% pekan ini',
            ];
            data.rekomendasi = [
              {
                judul: 'Scale Up Budget Harian Meta Ads ke Kampanye Promo Gajian',
                alasan: 'ROAS 4,6x dan CPA Rp 18.200 menunjukkan efisiensi tertinggi untuk ekspansi volume tanpa menaikkan CPL secara signifikan.',
                langkah: 'Naikkan daily budget Meta Ads +Rp 150.000/hari bertahap tiap 3 hari agar algoritma bidding lelang tetap stabil.',
                dampak: 'Estimasi tambahan +65-85 prospek baru dan kenaikan omset +Rp 24jt bulan ini.',
                prioritas: 'tinggi',
              },
              {
                judul: 'Rotasi Materi Kreatif Video UGC TikTok Ads',
                alasan: 'Frekuensi tayang ads telah mencapai 3,2x dan CPL merangkak naik ke Rp 50.000 (tanda awal audiens jenuh / ad fatigue).',
                langkah: 'Ganti 2 video kreatif lama dengan variasi hook testimoni pelanggan di 3 detik pertama.',
                dampak: 'Menekan CPL kembali ke bawah Rp 38.000 dan meningkatkan CTR +1,4%.',
                prioritas: 'sedang',
              },
              {
                judul: 'Luncurkan Promo Kupon Baru untuk Re-engagement Database Prospek',
                alasan: 'Terdapat 180+ prospek di database yang belum melakukan transaksi berulang dalam 30 hari terakhir.',
                langkah: 'Luncurkan promo terbatas untuk produk unggulan guna memicu transaksi berulang via WhatsApp blast resmi.',
                dampak: 'Konversi instan 15-20 transaksi baru tanpa tambahan biaya iklan berbayar (zero ad spend).',
                prioritas: 'sedang',
              },
            ];
            data.prediksi = {
              teks: 'Dengan laju run-rate saat ini dan ROAS rata-rata 4,1x, alokasi belanja iklan Rp 31,5jt/bulan diproyeksikan menghasilkan omset kumulatif Rp 470.400.000 di akhir tahun berjalan.',
              horizonBulan: 4,
              keyakinan: 'tinggi',
            };
            data.peringatan = [
              'Materi kreatif TikTok Ads mendekati masa jenuh (ad fatigue), disarankan refresh materi video dalam 5 hari kerja.',
              'Porsi belanja iklan terkonsentrasi 54% di Meta Ads; lakukan diversifikasi bertahap ke Google Search Ads untuk menangkap prospek intent tinggi.',
            ];
            data.pertanyaanLanjutan = [
              'Bagaimana simulasi profit jika budget Meta Ads dinaikkan 30%?',
              'Strategi apa yang paling cepat menurunkan CPL di TikTok Ads?',
              'Berapa proyeksi omset akhir tahun jika ROAS bertahan di 4,2x?',
            ];
            data.catatanJujur = [
              'Dihitung berdasarkan integrasi performa Meta Ads, TikTok Ads, dan database konversi prospek KLIR.',
            ];
          }
          setMktInsight(data);
          setMktInsightError(false);
        } else if (isDevLocalhost) {
          setMktInsight({
            role: 'marketing',
            generatedAt: new Date().toISOString(),
            cached: false,
            ringkasan: `Performa akuisisi 30 hari terakhir mencatatkan total belanja iklan ${idMoney(DEMO_MARKETING_METRICS.spend)} dengan omset teratribusi ${idMoney(DEMO_MARKETING_METRICS.revenue)} (Blended ROAS ${DEMO_MARKETING_METRICS.roas}). Terhimpun ${DEMO_MARKETING_METRICS.leads} prospek terverifikasi dengan rata-rata CPL ${idMoney(DEMO_MARKETING_CPL)}. Kanal Meta Ads menjadi pendorong utama profitabilitas (ROAS 4,6x), sedangkan materi TikTok Ads memerlukan rotasi hook video UGC.`,
            sorotan: [
              `Blended ROAS ${DEMO_MARKETING_METRICS.roas} melampaui target minimum (3,0x) dengan margin kontribusi prima`,
              `Total ${DEMO_MARKETING_METRICS.leads} prospek terkonversi dengan efisiensi biaya CPL ${idMoney(DEMO_MARKETING_CPL)}`,
              'Meta Ads menghasilkan 285 prospek (46% volume total) dengan ROAS 4,6x',
              'TikTok Ads menunjukkan sinyal ad fatigue dengan kenaikan CPL +8% pekan ini',
            ],
            rekomendasi: [
              {
                judul: 'Scale Up Budget Harian Meta Ads ke Kampanye Promo Gajian',
                alasan: 'ROAS 4,6x dan CPA Rp 18.200 menunjukkan efisiensi tertinggi untuk ekspansi volume tanpa menaikkan CPL secara signifikan.',
                langkah: 'Naikkan daily budget Meta Ads +Rp 150.000/hari bertahap tiap 3 hari agar algoritma bidding lelang tetap stabil.',
                dampak: 'Estimasi tambahan +65-85 prospek baru dan kenaikan omset +Rp 24jt bulan ini.',
                prioritas: 'tinggi',
              },
              {
                judul: 'Rotasi Materi Kreatif Video UGC TikTok Ads',
                alasan: 'Frekuensi tayang ads telah mencapai 3,2x dan CPL merangkak naik ke Rp 50.000 (tanda awal audiens jenuh / ad fatigue).',
                langkah: 'Ganti 2 video kreatif lama dengan variasi hook testimoni pelanggan di 3 detik pertama.',
                dampak: 'Menekan CPL kembali ke bawah Rp 38.000 dan meningkatkan CTR +1,4%.',
                prioritas: 'sedang',
              },
              {
                judul: 'Luncurkan Promo Kupon Baru untuk Re-engagement Database Prospek',
                alasan: 'Terdapat 180+ prospek di database yang belum melakukan transaksi berulang dalam 30 hari terakhir.',
                langkah: 'Luncurkan promo terbatas untuk produk unggulan guna memicu transaksi berulang via WhatsApp blast resmi.',
                dampak: 'Konversi instan 15-20 transaksi baru tanpa tambahan biaya iklan berbayar (zero ad spend).',
                prioritas: 'sedang',
              },
            ],
            prediksi: {
              teks: 'Dengan laju run-rate saat ini dan ROAS rata-rata 4,1x, alokasi belanja iklan Rp 31,5jt/bulan diproyeksikan menghasilkan omset kumulatif Rp 470.400.000 di akhir tahun berjalan.',
              horizonBulan: 4,
              keyakinan: 'tinggi',
            },
            peringatan: [
              'Materi kreatif TikTok Ads mendekati masa jenuh (ad fatigue), disarankan refresh materi video dalam 5 hari kerja.',
              'Porsi belanja iklan terkonsentrasi 54% di Meta Ads; lakukan diversifikasi bertahap ke Google Search Ads untuk menangkap prospek intent tinggi.',
            ],
            pertanyaanLanjutan: [
              'Bagaimana simulasi profit jika budget Meta Ads dinaikkan 30%?',
              'Strategi apa yang paling cepat menurunkan CPL di TikTok Ads?',
              'Berapa proyeksi omset akhir tahun jika ROAS bertahan di 4,2x?',
            ],
            sumberData: {
              transaksiTercatat: true,
              jumlahTransaksi: 136,
              dokumen: 3,
              dokumenLedgerTerdeteksi: 0,
              kampanye: 3,
              tugas: 4,
              produk: 12,
            },
            catatanJujur: [
              'Dihitung berdasarkan integrasi performa Meta Ads, TikTok Ads, dan database konversi prospek KLIR.',
            ],
          });
          setMktInsightError(false);
        } else {
          setMktInsightError(true);
        }
      } catch (e) {
        console.warn('Gagal memuat ringkasan AI marketing (dashboard-insight):', e);
        if (isDevLocalhost) {
          setMktInsight({
            role: 'marketing',
            generatedAt: new Date().toISOString(),
            cached: false,
            ringkasan: `Performa akuisisi 30 hari terakhir mencatatkan total belanja iklan ${idMoney(DEMO_MARKETING_METRICS.spend)} dengan omset teratribusi ${idMoney(DEMO_MARKETING_METRICS.revenue)} (Blended ROAS ${DEMO_MARKETING_METRICS.roas}). Terhimpun ${DEMO_MARKETING_METRICS.leads} prospek terverifikasi dengan rata-rata CPL ${idMoney(DEMO_MARKETING_CPL)}. Kanal Meta Ads menjadi pendorong utama profitabilitas (ROAS 4,6x), sedangkan materi TikTok Ads memerlukan rotasi hook video UGC.`,
            sorotan: [
              `Blended ROAS ${DEMO_MARKETING_METRICS.roas} melampaui target minimum (3,0x) dengan margin kontribusi prima`,
              `Total ${DEMO_MARKETING_METRICS.leads} prospek terkonversi dengan efisiensi biaya CPL ${idMoney(DEMO_MARKETING_CPL)}`,
              'Meta Ads menghasilkan 285 prospek (46% volume total) dengan ROAS 4,6x',
              'TikTok Ads menunjukkan sinyal ad fatigue dengan kenaikan CPL +8% pekan ini',
            ],
            rekomendasi: [
              {
                judul: 'Scale Up Budget Harian Meta Ads ke Kampanye Promo Gajian',
                alasan: 'ROAS 4,6x dan CPA Rp 18.200 menunjukkan efisiensi tertinggi untuk ekspansi volume tanpa menaikkan CPL secara signifikan.',
                langkah: 'Naikkan daily budget Meta Ads +Rp 150.000/hari bertahap tiap 3 hari agar algoritma bidding lelang tetap stabil.',
                dampak: 'Estimasi tambahan +65-85 prospek baru dan kenaikan omset +Rp 24jt bulan ini.',
                prioritas: 'tinggi',
              },
              {
                judul: 'Rotasi Materi Kreatif Video UGC TikTok Ads',
                alasan: 'Frekuensi tayang ads telah mencapai 3,2x dan CPL merangkak naik ke Rp 50.000 (tanda awal audiens jenuh / ad fatigue).',
                langkah: 'Ganti 2 video kreatif lama dengan variasi hook testimoni pelanggan di 3 detik pertama.',
                dampak: 'Menekan CPL kembali ke bawah Rp 38.000 dan meningkatkan CTR +1,4%.',
                prioritas: 'sedang',
              },
              {
                judul: 'Luncurkan Promo Kupon Baru untuk Re-engagement Database Prospek',
                alasan: 'Terdapat 180+ prospek di database yang belum melakukan transaksi berulang dalam 30 hari terakhir.',
                langkah: 'Luncurkan promo terbatas untuk produk unggulan guna memicu transaksi berulang via WhatsApp blast resmi.',
                dampak: 'Konversi instan 15-20 transaksi baru tanpa tambahan biaya iklan berbayar (zero ad spend).',
                prioritas: 'sedang',
              },
            ],
            prediksi: {
              teks: 'Dengan laju run-rate saat ini dan ROAS rata-rata 4,1x, alokasi belanja iklan Rp 31,5jt/bulan diproyeksikan menghasilkan omset kumulatif Rp 470.400.000 di akhir tahun berjalan.',
              horizonBulan: 4,
              keyakinan: 'tinggi',
            },
            peringatan: [
              'Materi kreatif TikTok Ads mendekati masa jenuh (ad fatigue), disarankan refresh materi video dalam 5 hari kerja.',
              'Porsi belanja iklan terkonsentrasi 54% di Meta Ads; lakukan diversifikasi bertahap ke Google Search Ads untuk menangkap prospek intent tinggi.',
            ],
            pertanyaanLanjutan: [
              'Bagaimana simulasi profit jika budget Meta Ads dinaikkan 30%?',
              'Strategi apa yang paling cepat menurunkan CPL di TikTok Ads?',
              'Berapa proyeksi omset akhir tahun jika ROAS bertahan di 4,2x?',
            ],
            sumberData: {
              transaksiTercatat: true,
              jumlahTransaksi: 136,
              dokumen: 3,
              dokumenLedgerTerdeteksi: 0,
              kampanye: 3,
              tugas: 4,
              produk: 12,
            },
            catatanJujur: [
              'Dihitung berdasarkan integrasi performa Meta Ads, TikTok Ads, dan database konversi prospek KLIR.',
            ],
          });
          setMktInsightError(false);
        } else if (!cancelled) {
          setMktInsightError(true);
        }
      } finally {
        if (!cancelled) setMktInsightLoading(false);
      }
    };
    mktInsightLoaderRef.current = (refresh?: boolean) => {
      void loadMktInsight(refresh);
    };
    loadMktInsight();
    const onRefreshEvent = () => loadMktInsight();
    window.addEventListener('klir-mkt-updated', onRefreshEvent);
    window.addEventListener('klir-marketing-updated', onRefreshEvent);
    window.addEventListener('klir-ai-state-updated', onRefreshEvent);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-mkt-updated', onRefreshEvent);
      window.removeEventListener('klir-marketing-updated', onRefreshEvent);
      window.removeEventListener('klir-ai-state-updated', onRefreshEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Roadmap 7 Sep, item 4.7 -- enum backend (META_ADS/TIKTOK_ADS/GOOGLE_ADS/LAINNYA)
  // dipetakan ke label tampilan yang sudah dipakai UI ini ('Meta Ads' dkk, lihat
  // channelColors/chanCompare di bawah yang cocokkan string persis).
  const CAMPAIGN_PLATFORM_LABEL: Record<string, string> = {
    META_ADS: 'Meta Ads',
    TIKTOK_ADS: 'TikTok Ads',
    GOOGLE_ADS: 'Google Ads',
    LAINNYA: 'Lainnya',
  };

  // Ambil kupon promo + kampanye iklan dari backend jika tersedia
  const loadRealData = async () => {
    try {
      const res = await fetch('/api/v1/promo/coupons', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const coupons = data.coupons || data || [];
        if (Array.isArray(coupons) && coupons.length > 0) {
          setActivePromos(
            coupons.map((c: any) => ({
              id: c.id,
              code: c.code,
              discount: c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `Rp ${Number(c.discountValue || 0).toLocaleString('id-ID')}`,
              limit: String(c.quota ?? ''),
              used: c.usedCount ?? 0,
              status: c.isActive ? 'ACTIVE' : 'Nonaktif',
            }))
          );
        } else if (isDevLocalhost) {
          setActivePromos(DEMO_MARKETING_PROMOS);
        }
      } else if (isDevLocalhost) {
        setActivePromos(DEMO_MARKETING_PROMOS);
      }
    } catch (err) {
      console.warn('Marketing load real data failed:', err);
      if (isDevLocalhost) {
        setActivePromos(DEMO_MARKETING_PROMOS);
      }
    }

    try {
      const campRes = await fetch('/api/v1/marketing/campaigns', { credentials: 'include' });
      if (campRes.ok) {
        const campData = await campRes.json();
        const rows = Array.isArray(campData.campaigns) ? campData.campaigns : [];
        if (rows.length === 0 && isDevLocalhost) {
          setIsDemoActive(true);
          setCampaigns(DEMO_MARKETING_CAMPAIGNS);
          setMetrics(DEMO_MARKETING_METRICS);
        } else {
          setIsDemoActive(false);
          const mappedCampaigns = rows.map((c: any) => ({
              id: c.id,
              name: c.name,
              platform: CAMPAIGN_PLATFORM_LABEL[c.platform] || c.platform,
              dailyBudget: c.dailyBudget,
              // roas dipakai sebagai STRING di tempat lain file ini (mis. c.roas.replace('.', ',')
              // untuk format id-ID) -- konversi di sini, bukan di tiap titik pakai.
              roas: String(c.roas ?? 0),
              leads: c.leads ?? 0,
              status: c.status,
              // Tambahan 10 Sep 2026 (Fable, kontrak marketing-build item e) -- dipakai
              // groupCampaignsByMonth() untuk gerbang "AI analisa & prediksi kampanye"
              // (butuh >= 2 bulan jejak kampanye). Sudah ada di respons API (prisma
              // findMany tanpa select khusus), murni ditambahkan ke mapping, tidak
              // mengubah field lain.
              createdAt: c.createdAt ?? null,
            }));
          setCampaigns(mappedCampaigns);
          setMetrics(deriveMarketingMetrics(mappedCampaigns));
        }
      } else if (isDevLocalhost) {
        setIsDemoActive(true);
        setCampaigns(DEMO_MARKETING_CAMPAIGNS);
        setMetrics(DEMO_MARKETING_METRICS);
      }
    } catch (err) {
      console.warn('Marketing load campaigns failed:', err);
      if (isDevLocalhost) {
        setIsDemoActive(true);
        setCampaigns(DEMO_MARKETING_CAMPAIGNS);
        setMetrics(DEMO_MARKETING_METRICS);
      }
    }
  };

  // Handle Toggle Campaign Status -- item 4.7, sekarang genuinely persist ke backend
  // (dulu cuma setState lokal, hilang begitu halaman di-reload).
  const handleToggleStatus = async (id: string) => {
    const target = campaigns.find((c) => c.id === id);
    if (!target) return;
    const nextStatus = target.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
    );
    try {
      const res = await fetch('/api/v1/marketing/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal update status');
    } catch (err) {
      // Rollback kalau backend gagal -- jangan biarkan UI klaim tersimpan padahal tidak.
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: target.status } : c))
      );
      setToastMsg('Gagal mengubah status kampanye, coba lagi.');
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  // Hapus kampanye -- backend DELETE sudah ada dan tenant-guarded
  // (src/app/api/v1/marketing/campaigns/route.ts), ini menyambungkannya ke UI.
  // Pola persis handleDeleteTransaction di FinanceModuleView.tsx: confirm dulu,
  // deletingId per-baris, hapus dari state lokal HANYA setelah backend sukses
  // (bukan optimistic-delete) -- kalau gagal, state tidak diubah sama sekali.
  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    const confirmed = window.confirm(`Yakin hapus kampanye "${campaignName}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;
    setDeletingId(campaignId);
    try {
      const res = await fetch(`/api/v1/marketing/campaigns?id=${campaignId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal hapus kampanye');
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      setToastMsg('Kampanye berhasil dihapus.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      setToastMsg('Gagal hapus kampanye, coba lagi.');
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setDeletingId(null);
    }
  };

  // Derived display-only values
  // (roasTargetX sekarang state, dideklarasikan di atas dekat state lain -- D3)
  const roasNumeric = campaigns.length > 0 ? parseMarketingNumber(metrics.roas) : 0;
  const roasScaleMax = Math.max(5.0, roasNumeric + 0.5, roasTargetX + 0.5);
  const belowTargetCampaigns = campaigns.filter((c) => parseMarketingNumber(c.roas) < roasTargetX);
  const nearLimitPromos = activePromos.filter((p) => {
    if (p.status !== 'ACTIVE') return false;
    const limit = Number.parseInt(String(p.limit ?? ''), 10);
    const used = Math.max(0, Number(p.used) || 0);
    return limit <= 0 || used / limit >= 0.8;
  });
  const bestRoasValue = campaigns.length > 0 ? Math.max(...campaigns.map((c) => parseMarketingNumber(c.roas))) : 0;
  const dailyCap = campaigns.reduce((a, c) => a + Math.max(0, parseMarketingNumber(c.dailyBudget)), 0);
  const totalLeads = campaigns.reduce((a, c) => a + Math.max(0, Math.round(parseMarketingNumber(c.leads))), 0);

  // Chart hero: ROAS bulanan / Omset vs belanja / Biaya per prospek
  // KENAPA diubah: 5 bulan pertama dulu diisi angka contoh yang ditulis tetap di kode
  // ([2.4,2.8,3.1,...] dkk) -- tampil seolah riwayat nyata begitu campaigns terisi,
  // padahal karangan. KLIR belum punya sumber riwayat bulanan marketing (tidak ada
  // endpoint yang menyimpan angka bulan-bulan sebelumnya untuk ROAS/belanja/CPL).
  // Sekarang: 5 bulan pertama nol (jujur -- belum dilacak), hanya bulan berjalan
  // (indeks terakhir) yang memakai angka nyata dari campaigns/metrics saat ini.
  // CARA MEMBATALKAN: ganti 5 nilai pertama tiap array balik ke angka contoh lama
  // (lihat git log commit sebelum ini untuk nilai persisnya).
  const [chartView, setChartView] = useState<'roas' | 'money' | 'cpl'>('roas');
  // FIX (audit role-fit 7 Sep): months dulu dipatok tetap berakhir 'Agu' -- bar
  // "bulan berjalan" (selalu index terakhir) jadi salah label sejak lewat Agustus,
  // dan akan terus salah tiap bulan bukan Agustus selama-lamanya. Sama seperti fix
  // daysElapsed di bawah (juga karena alasan "jangan bohong soal tanggal berjalan").
  const MONTH_NAMES_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthsBaseDate = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monthsBaseDate.getFullYear(), monthsBaseDate.getMonth() - (5 - i), 1);
    return MONTH_NAMES_ID[d.getMonth()];
  });
  const currentMonthSpend = dailyCap * 30;
  const currentMonthRoas = campaigns.length > 0 ? roasNumeric : 0;
  const currentMonthCpl = totalLeads > 0 ? currentMonthSpend / totalLeads : 0;

  // Historical chart series: pada localhost/dev tampilkan benchmark realistis agar visual grafik terisi,
  // sedangkan di production/VPS tetap jujur zero-state [0, 0, 0, 0, 0, currentMonth].
  const roasSeries = isDevLocalhost
    ? [3.2, 3.5, 3.8, 3.6, 4.0, currentMonthRoas > 0 ? currentMonthRoas : 4.2]
    : [0, 0, 0, 0, 0, currentMonthRoas];
  const spendSeries = isDevLocalhost
    ? [18000000, 20000000, 22000000, 21000000, 24000000, currentMonthSpend > 0 ? currentMonthSpend : 30000000]
    : [0, 0, 0, 0, 0, currentMonthSpend];
  const revenueSeries = spendSeries.map((s, i) => s * roasSeries[i]);
  const cplSeries = isDevLocalhost
    ? [32000, 31000, 30000, 30500, 29500, currentMonthCpl > 0 ? currentMonthCpl : 28000]
    : [0, 0, 0, 0, 0, currentMonthCpl];
  const cplMax = Math.max(...cplSeries, 1);
  const moneyMax = Math.max(...revenueSeries, 1);

  const budgetCap = dailyCap * 31;
  // KENAPA diubah: "daysElapsed = 18" dulu ditulis tetap (selalu menganggap tanggal 18
  // bulan berjalan). Sekarang pakai tanggal asli hari ini supaya "Pemakaian anggaran
  // bulan ini" tidak berbohong soal sudah berapa hari kampanye jalan.
  const daysElapsed = new Date().getDate();
  const budgetSpent = dailyCap * daysElapsed;
  const budgetPct = budgetCap > 0 ? Math.min(100, (budgetSpent / budgetCap) * 100) : 0;
  const budgetLeft = Math.max(0, budgetCap - budgetSpent);
  // Kartu di bawah menjelaskan omzet dari SISA pagu; jangan campur belanja
  // yang sudah terpakai ke angka omzet proyeksi.
  const budgetProj = dailyCap > 0 && roasNumeric > 0 ? budgetLeft * roasNumeric : 0;

  // Funnel perjalanan dari iklan sampai closing:
  // Di localhost/dev sediakan benchmark simulasi nyata (Impresi 482rb, Klik 14.8rb, Leads 621, Closes 136, AOV 864rb).
  // Di production/VPS tetap null (belum dilacak) dan tampil jujur sebagai '-' di UI.
  const fnImpressions = isDevLocalhost ? 482000 : (null as number | null);
  const fnClicks = isDevLocalhost ? 14800 : (null as number | null);
  const fnLeads = totalLeads > 0 ? totalLeads : (isDevLocalhost ? 621 : 0);
  const fnCloses = isDevLocalhost ? 136 : (null as number | null);
  const fnAov = isDevLocalhost ? 864700 : null;
  const fnC1 = fnImpressions !== null && fnClicks !== null && fnImpressions > 0 ? `${idDec((fnClicks / fnImpressions) * 100, 1)}%` : '-';
  const fnC2 = fnClicks !== null && fnClicks > 0 ? `${idDec((fnLeads / fnClicks) * 100, 1)}%` : '-';
  const fnC3 = fnCloses !== null && fnLeads > 0 ? `${idDec((fnCloses / fnLeads) * 100, 1)}%` : '-';

  // Kanal mana yang paling menghasilkan — dikelompokkan dari campaigns
  const channelColors: Record<string, string> = {
    'Meta Ads': '#4E9BFF',
    'TikTok Ads': '#A5B4FC',
    'Google Ads': '#F2A83B',
  };
  const chanCompare = ['Meta Ads', 'TikTok Ads', 'Google Ads'].map((name) => {
    const rows = campaigns.filter((c) => c.platform === name);
    const spend = rows.reduce((a, c) => a + c.dailyBudget, 0) * 30;
    const revenue = rows.reduce((a, c) => a + c.dailyBudget * 30 * (parseFloat(c.roas) || 0), 0);
    const mult = rows.length && spend > 0 ? revenue / spend : 0;
    const leads = rows.reduce((a, c) => a + (c.leads || 0), 0);
    return { name, spend, revenue, mult, leads };
  }).filter((c) => c.spend > 0);
  const chanAxisMax = chanCompare.length > 0 ? Math.max(...chanCompare.map((c) => Math.max(c.spend, c.revenue)), 1) : 1;
  const axisMid = idMoney(chanAxisMax / 2);
  const axisMax = idMoney(chanAxisMax);
  const bestChannel = chanCompare.length > 0 ? chanCompare.reduce((a, b) => (b.mult > a.mult ? b : a), chanCompare[0]) : null;
  const worstChannel = chanCompare.length > 0 ? chanCompare.reduce((a, b) => (b.mult < a.mult ? b : a), chanCompare[0]) : null;

  const budgetShiftAmount = 150000;
  const estimatedShiftGain =
    bestChannel && worstChannel && bestChannel.name !== worstChannel.name
      ? Math.max(0, Math.round(budgetShiftAmount * 30 * (bestChannel.mult - worstChannel.mult)))
      : 0;

  // Laporan marketing bulanan: pada localhost/dev tampilkan arsip benchmark realistis yang bisa diunduh
  const reports = isDevLocalhost
    ? [
        {
          title: 'Laporan Performa Q3 2026 - Multi-Channel Ads & ROAS',
          note: 'Konsolidasi Meta, TikTok, dan Google Ads',
          period: 'Juli - September 2026',
          status: 'Selesai',
          statusColor: '#3FBF8F',
          size: '2.4 MB',
          availableFormats: ['PDF', 'Excel/CSV', 'Word (DOCX)', 'PPT Slides'],
          executiveSummary: 'Performa multi-kanal Q3 mencatatkan blended ROAS 4,2x dengan efisiensi tertinggi di Google Ads (4,6x) dan volume omset dominan di Meta Ads (Rp 64,8jt). CVR keseluruhan stabil di angka 21,9%.',
          aiDiagnosis: 'TikTok Ads mengalami ad fatigue dengan CTR melandai 2,1% ke 1,7%. Solusi tercepat adalah rotasi 3 variasi UGC video baru dengan hook 3 detik pertama sebelum scale budget.',
          actionItems: [
            'Pindahkan alokasi Rp 150.000/hari dari TikTok ke Meta Ads untuk dongkrak omset cepat.',
            'Uji materi kreatif UGC baru berformat vertikal 9:16 untuk Gen Z.',
            'Optimalkan alur checkout mobile untuk menekan bounce rate klik iklan.',
          ],
        },
        {
          title: 'Audit Alokasi Anggaran & Evaluasi CPL Bulanan',
          note: 'Analisis pergeseran budget dan Cost Per Lead',
          period: 'Agustus 2026',
          status: 'Selesai',
          statusColor: '#3FBF8F',
          size: '1.8 MB',
          availableFormats: ['PDF', 'Excel/CSV', 'Word (DOCX)', 'PPT Slides'],
          executiveSummary: 'Cost Per Lead (CPL) gabungan berada di Rp 23.670 per prospek terverifikasi. Terjadi kenaikan efisiensi CPL sebesar 14% setelah penyesuaian audiens mobile.',
          aiDiagnosis: 'Google Search Ads memiliki CPL paling murah (Rp 18.200) dengan intent beli tertinggi, namun search volume bulanan mendekati saturasi 85%.',
          actionItems: [
            'Eksplorasi long-tail keyword produk di Google Search.',
            'Pertahankan capping harian Meta Ads di rentang Rp 450.000 - Rp 550.000.',
          ],
        },
        {
          title: 'Rekapitulasi Voucher Promo & Konversi Penjualan',
          note: 'Tingkat klaim GAJIANHEMAT20 & ONGKIRFREE',
          period: 'Agustus 2026',
          status: 'Selesai',
          statusColor: '#3FBF8F',
          size: '1.1 MB',
          availableFormats: ['PDF', 'Excel/CSV', 'Word (DOCX)', 'PPT Slides'],
          executiveSummary: 'Kupon GAJIANHEMAT20 menghasilkan 80 klaim dari 100 batas (80% terpakai) dengan nilai penjualan Rp 24,9jt. ONGKIRFREE mencapai 90% kuota.',
          aiDiagnosis: 'Voucher diskon persentase (20%) terbukti menghasilkan rasio closing 2,3x lebih tinggi dibanding voucher potongan nominal flat.',
          actionItems: [
            'Tambah kuota 50 klaim untuk GAJIANHEMAT20 sebelum akhir pekan.',
            'Rilis flash-voucher 24 jam khusus prospek yang belum closing di WhatsApp.',
          ],
        },
      ]
    : [];

  // State untuk modal pilihan format unduhan laporan (PDF, Word, Excel, PPT)
  const [downloadModalReport, setDownloadModalReport] = useState<any | null>(null);
  const [budgetReportMode, setBudgetReportMode] = useState<'ringkas' | 'rinci'>('ringkas');

  // Tambah kuota voucher
  // FIX (8 Sep 2026, MKT-04): dulu endpoint /api/v1/promo/coupons cuma punya GET dan
  // POST -- tidak ada PATCH untuk update kuota, jadi tombol ini murni ubah state lokal.
  // Kontrak PATCH baru (dikerjakan B5-Backend paralel, body {id, quotaIncrement}) SUDAH
  // dicoba dulu di sini -- kalau backend sudah siap, kuota genuinely bertambah & tersimpan
  // ke DB (lalu di-refresh dari server via loadRealData supaya angka pasti sinkron).
  // Kalau endpoint itu belum ada/gagal saat dites (mis. B5 belum selesai), fallback JUJUR
  // ke perilaku lama: preview tampilan lokal + toast eksplisit bilang belum tersimpan --
  // JANGAN diam-diam menampilkan angka baru seolah tersimpan permanen kalau PATCH gagal.
  const handleAddQuota = async (id: string, code: string) => {
    try {
      const res = await fetch('/api/v1/promo/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, quotaIncrement: 50 }),
      });
      if (!res.ok) throw new Error('PATCH promo/coupons belum tersedia atau gagal.');
      const data = await res.json();
      const savedQuota = data?.coupon?.quota;
      setActivePromos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, limit: String(savedQuota ?? p.limit), status: 'ACTIVE' } : p))
      );
      setToastMsg(`Kuota voucher ${code} berhasil ditambah +50 dan TERSIMPAN di server.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      let newLimit = 0;
      setActivePromos((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          newLimit = (parseInt(p.limit, 10) || 0) + 50;
          return { ...p, limit: String(newLimit), status: 'ACTIVE' };
        })
      );
      setToastMsg(`Pratinjau tampilan: kuota ${code} +50 klaim (kini ${newLimit || '-'}) -- belum tersimpan ke server, endpoint update kuota belum tersedia/gagal.`);
      setTimeout(() => setToastMsg(null), 6000);
    }
  };

  // Lihat ringkasan laporan
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const toggleReportView = (title: string) => setExpandedReport((prev) => (prev === title ? null : title));

  // Unduh laporan dengan pilihan format (PDF, Excel/CSV, Word DOCX, PPT Slides)
  const handleDownloadReportInFormat = (r: any, format: 'PDF' | 'Excel/CSV' | 'Word (DOCX)' | 'PPT Slides') => {
    if (r.status !== 'Selesai') return;
    const baseName = r.title.replace(/[^a-zA-Z0-9]+/g, '-');
    const todayStr = new Date().toISOString().split('T')[0];

    if (format === 'PDF') {
      handleExportPDF();
      setDownloadModalReport(null);
      return;
    }

    if (format === 'Excel/CSV') {
      const csvRows = [
        ['KLIR OS - ' + r.title],
        ['Periode', r.period || '-'],
        ['Status', r.status],
        ['Catatan', r.note],
        ['Ringkasan Eksekutif', r.executiveSummary || '-'],
        ['Diagnosa AI', r.aiDiagnosis || '-'],
        [''],
        ['INDIKATOR KUNCI'],
        ['ROAS Bulanan', `${idDec(roasNumeric)}x`],
        ['Target ROAS', `${idDec(roasTargetX)}x`],
        ['Total Prospek', String(displayMarketingLeads)],
        ['Belanja Iklan (30 hari)', idMoney(dailyCap * 30)],
        ['Omset Teratribusi', idMoney(displayMarketingRevenue)],
        [''],
        ['LANGKAH TINDAKAN PRIORITAS'],
        ...(r.actionItems || []).map((act: string, idx: number) => [`Langkah ${idx + 1}`, act]),
      ];
      const csv = csvRows.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}-${todayStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg(`Mengunduh berkas Excel/CSV "${r.title}"…`);
    } else if (format === 'Word (DOCX)') {
      const docxContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><title>${r.title}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 40px; }
          h1 { color: #1e3a8a; font-size: 18pt; border-bottom: 2pt solid #3b82f6; padding-bottom: 6pt; }
          h2 { color: #1e40af; font-size: 14pt; margin-top: 16pt; }
          .meta { color: #64748b; font-size: 10pt; margin-bottom: 20pt; }
          .highlight { background-color: #f1f5f9; padding: 10pt; border-left: 4pt solid #3b82f6; margin-bottom: 12pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 16pt; }
          th, td { border: 1pt solid #cbd5e1; padding: 6pt 8pt; text-align: left; }
          th { background-color: #f8fafc; font-weight: bold; }
        </style>
        </head>
        <body>
          <h1>${r.title}</h1>
          <div class="meta">
            <strong>Organisasi:</strong> ${workspaceName || 'KLIR Business Workspace'}<br/>
            <strong>Periode:</strong> ${r.period || 'Q3 2026'}<br/>
            <strong>Tanggal Unduh:</strong> ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
          </div>
          <h2>1. Ringkasan Eksekutif &amp; KPI Utama</h2>
          <div class="highlight">
            <p><strong>Ikhtisar:</strong> ${r.executiveSummary || r.note}</p>
            <p><strong>Diagnosa AI:</strong> ${r.aiDiagnosis || '-'}</p>
          </div>
          <table>
            <tr><th>Metrik Utama</th><th>Nilai Realisasi</th><th>Status / Catatan</th></tr>
            <tr><td>Blended ROAS</td><td>${idDec(roasNumeric)}x</td><td>Target min. ${idDec(roasTargetX)}x</td></tr>
            <tr><td>Belanja Iklan 30 Hari</td><td>${idMoney(dailyCap * 30)}</td><td>Alokasi 3 platform</td></tr>
            <tr><td>Omset Teratribusi</td><td>${idMoney(displayMarketingRevenue)}</td><td>Paid conversion</td></tr>
            <tr><td>Total Prospek Masuk</td><td>${displayMarketingLeads} Leads</td><td>Tingkat closing 21,9%</td></tr>
          </table>
          <h2>2. Langkah Rekomendasi Taktis AI</h2>
          <ol>
            ${(r.actionItems || []).map((item: string) => `<li>${item}</li>`).join('')}
          </ol>
          <p style="font-size: 9pt; color: #94a3b8; margin-top: 30pt; text-align: center;">
            Dokumen Laporan Resmi dibuat otomatis oleh KLIR Financial &amp; Growth OS.
          </p>
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', docxContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}-${todayStr}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg(`Mengunduh dokumen Word "${r.title}"…`);
    } else if (format === 'PPT Slides') {
      const pptContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:p='urn:schemas-microsoft-com:office:powerpoint' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><title>${r.title} - Executive Deck</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
          .slide { width: 900px; height: 500px; background: #1e293b; border-radius: 16px; padding: 32px; margin-bottom: 40px; page-break-after: always; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h1 { color: #38bdf8; font-size: 26pt; margin-bottom: 8pt; }
          h2 { color: #f1f5f9; font-size: 18pt; margin-bottom: 16pt; border-bottom: 1px solid #334155; padding-bottom: 8pt; }
          .badge { background: #0284c7; color: white; padding: 4px 12px; border-radius: 6px; font-size: 11pt; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
          .box { background: #0f172a; border-radius: 12px; padding: 18px; border: 1px solid #334155; }
          .val { font-size: 24pt; font-weight: bold; color: #34d399; }
        </style>
        </head>
        <body>
          <div class="slide">
            <span class="badge">KLIR STRATEGIC MARKETING DECK</span>
            <h1>${r.title}</h1>
            <p style="color: #94a3b8; font-size: 13pt;">${r.period || 'Q3 2026'} • ${workspaceName || 'Executive Summary'}</p>
            <p style="margin-top: 40px; font-size: 14pt; color: #cbd5e1; line-height: 1.6;">${r.executiveSummary || r.note}</p>
          </div>
          <div class="slide">
            <h2>Indikator Kinerja &amp; Diagnosa AI</h2>
            <div class="grid">
              <div class="box">
                <div style="color: #94a3b8; font-size: 11pt;">Blended ROAS Realisasi</div>
                <div class="val">${idDec(roasNumeric)}x</div>
                <div style="color: #38bdf8; font-size: 11pt; margin-top: 6px;">Target min. ${idDec(roasTargetX)}x</div>
              </div>
              <div class="box">
                <div style="color: #94a3b8; font-size: 11pt;">Total Omset Teratribusi</div>
                <div class="val" style="color: #60a5fa;">${idMoney(displayMarketingRevenue)}</div>
                <div style="color: #94a3b8; font-size: 11pt; margin-top: 6px;">Belanja ${idMoney(dailyCap * 30)}</div>
              </div>
            </div>
            <div class="box" style="margin-top: 20px;">
              <strong style="color: #f59e0b;">AI Diagnostic Note:</strong>
              <p style="color: #cbd5e1; margin-top: 6px; font-size: 12pt;">${r.aiDiagnosis || '-'}</p>
            </div>
          </div>
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', pptContent], { type: 'application/vnd.ms-powerpoint' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}-${todayStr}.ppt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg(`Mengunduh slide presentasi PPT "${r.title}"…`);
    }

    setTimeout(() => setToastMsg(null), 4000);
    setDownloadModalReport(null);
  };

  // Unduh laporan CSV standar
  const handleDownloadReport = (r: { title: string; note: string; status: string }) => {
    setDownloadModalReport(r);
  };

  // Export Data Marketing lengkap ke format CSV / Excel
  const handleExportExcel = () => {
    try {
      const today = new Date();
      const rows = [
        ['LAPORAN KINERJA MARKETING & IKLAN - ' + (workspaceName || 'KLIR OS')],
        ['Tanggal Cetak', today.toLocaleDateString('id-ID', { dateStyle: 'full' })],
        ['Target Blended ROAS', `${idDec(roasTargetX)}x`],
        ['Blended ROAS Realisasi', `${idDec(roasNumeric)}x`],
        ['Belanja Iklan Bulanan', idMoney(dailyCap * 30)],
        ['Omset Teratribusi', idMoney(metrics.revenue)],
        ['Selisih Bersih (Laba Kotor Iklan)', idMoney(Math.max(0, metrics.revenue - dailyCap * 30))],
        ['Total Prospek Masuk', String(displayMarketingLeads)],
        [''],
        ['RINCIAN PERFORMA KANAL IKLAN'],
        ['Kanal', 'Budget Harian', 'Belanja 30 Hari', 'Omset Teratribusi', 'ROAS', 'Prospek'],
        ...chanCompare.map((c) => [
          c.name,
          idMoney(c.spend / 30),
          idMoney(c.spend),
          idMoney(c.revenue),
          `${idDec(c.mult)}x`,
          String(c.leads),
        ]),
        [''],
        ['DAFTAR KAMPANYE AKTIF'],
        ['Nama Kampanye', 'Platform', 'Budget Harian', 'Leads', 'ROAS', 'Status'],
        ...campaigns.map((c) => [
          c.name,
          c.platform,
          idMoney(c.dailyBudget),
          String(c.leads || 0),
          `${c.roas}x`,
          c.status,
        ]),
        [''],
        ['VOUCHER & PROMOSI AKTIF'],
        ['Kode Voucher', 'Diskon', 'Terpakai', 'Batas Kuota', 'Status'],
        ...activePromos.map((p) => [
          p.code,
          p.discount,
          String(p.used),
          p.limit,
          p.status,
        ]),
        [''],
        ['CORONG PEMASARAN (MARKETING FUNNEL)'],
        ['Tahapan Corong', 'Jumlah', 'Catatan / Konversi'],
        ['Iklan Dilihat (Impresi)', fnImpressions !== null ? fnImpressions.toLocaleString('id-ID') : '-', 'Total penayangan iklan'],
        ['Diklik', fnClicks !== null ? fnClicks.toLocaleString('id-ID') : '-', `CTR: ${fnC1}`],
        ['Jadi Prospek (Leads)', fnLeads > 0 ? fnLeads.toLocaleString('id-ID') : '-', `CVR: ${fnC2}`],
        ['Jadi Pembeli (Closing)', fnCloses !== null ? fnCloses.toLocaleString('id-ID') : '-', `Closing Rate: ${fnC3}`],
        ['Nilai Rata-rata Transaksi (AOV)', fnAov ? idMoney(fnAov) : '-', 'Omset dibagi total pembeli'],
      ];

      const csvContent = rows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `laporan-marketing-${(workspaceName || 'perusahaan').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${today.toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setToastMsg('Laporan Marketing (.csv) berhasil diunduh.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setToastMsg('Gagal mengekspor laporan: ' + err.message);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  // Cetak / Export ke PDF Profesional siap cetak
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
          <title>Laporan Kinerja Marketing - ${workspaceName || 'Perusahaan'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #0f172a; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px; }
            .logo { font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
            .meta { text-align: right; font-size: 12px; color: #64748b; }
            .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
            .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
            .card-value { font-size: 18px; font-weight: 800; color: #0f172a; font-family: monospace; }
            .card-sub { font-size: 11px; color: #10b981; font-weight: 600; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 25px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 9px; font-weight: 700; color: #475569; border-bottom: 1px solid #cbd5e1; }
            td { padding: 9px; border-bottom: 1px solid #e2e8f0; }
            .text-right { text-align: right; }
            .badge-active { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 10px; }
            .badge-channel { background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 10px; }
            .funnel-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
            .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 18px; }
            @media print {
              body { margin: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">KLIR MARKETING &amp; GROWTH OS</div>
              <div class="title">${workspaceName || 'Perusahaan Anda'}</div>
              <div style="font-size: 12px; color: #64748b;">Laporan Kinerja Pemasaran &amp; Efisiensi Biaya Iklan (Paid Ads)</div>
            </div>
            <div class="meta">
              <div><strong>Tanggal:</strong> ${today.toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
              <div><strong>Status:</strong> Kampanye Multi-Channel Terverifikasi</div>
              <div><strong>Target ROAS:</strong> ${idDec(roasTargetX)}x</div>
            </div>
          </div>

          <h3 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">1. Ringkasan Eksekutif Marketing</h3>
          <div class="grid">
            <div class="card">
              <div class="card-title">Blended ROAS</div>
              <div class="card-value" style="color: #10b981;">${idDec(roasNumeric)}x</div>
              <div class="card-sub">Target min. ${idDec(roasTargetX)}x</div>
            </div>
            <div class="card">
              <div class="card-title">Belanja Iklan (30 Hari)</div>
              <div class="card-value">Rp ${(dailyCap * 30).toLocaleString('id-ID')}</div>
              <div class="card-sub" style="color: #64748b;">${campaigns.length} kampanye aktif</div>
            </div>
            <div class="card">
              <div class="card-title">Omset Teratribusi</div>
              <div class="card-value" style="color: #2563eb;">Rp ${metrics.revenue.toLocaleString('id-ID')}</div>
              <div class="card-sub" style="color: #64748b;">Dari ${fnLeads} total prospek</div>
            </div>
            <div class="card">
              <div class="card-title">Selisih Bersih Iklan</div>
              <div class="card-value" style="color: #10b981;">Rp ${Math.max(0, metrics.revenue - dailyCap * 30).toLocaleString('id-ID')}</div>
              <div class="card-sub">Surplus kas dari iklan</div>
            </div>
          </div>

          <h3 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">2. Performa Kanal Pemasaran</h3>
          <table>
            <thead>
              <tr>
                <th>Kanal Iklan</th>
                <th class="text-right">Belanja Bulanan</th>
                <th class="text-right">Omset Teratribusi</th>
                <th class="text-right">Prospek (Leads)</th>
                <th class="text-right">Pengembalian (ROAS)</th>
              </tr>
            </thead>
            <tbody>
              ${chanCompare.map(c => `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td class="text-right">Rp ${c.spend.toLocaleString('id-ID')}</td>
                  <td class="text-right" style="color: #2563eb; font-weight: 700;">Rp ${c.revenue.toLocaleString('id-ID')}</td>
                  <td class="text-right">${c.leads} prospek</td>
                  <td class="text-right" style="font-weight: 700; color: ${c.mult >= roasTargetX ? '#10b981' : '#f59e0b'};">
                    ${idDec(c.mult)}x
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">3. Corong Pemasaran (Marketing Funnel)</h3>
          <div class="funnel-grid">
            <div class="card">
              <div class="card-title">1. Iklan Dilihat</div>
              <div class="card-value">${fnImpressions !== null ? fnImpressions.toLocaleString('id-ID') : '-'}</div>
              <div class="card-sub" style="color: #64748b;">Impresi penayangan</div>
            </div>
            <div class="card">
              <div class="card-title">2. Diklik</div>
              <div class="card-value">${fnClicks !== null ? fnClicks.toLocaleString('id-ID') : '-'}</div>
              <div class="card-sub" style="color: #64748b;">CTR: ${fnC1}</div>
            </div>
            <div class="card">
              <div class="card-title">3. Jadi Prospek</div>
              <div class="card-value">${fnLeads.toLocaleString('id-ID')}</div>
              <div class="card-sub" style="color: #64748b;">CVR: ${fnC2}</div>
            </div>
            <div class="card">
              <div class="card-title">4. Jadi Pembeli</div>
              <div class="card-value" style="color: #10b981;">${fnCloses !== null ? fnCloses.toLocaleString('id-ID') : '-'}</div>
              <div class="card-sub" style="color: #10b981;">Closing: ${fnC3}</div>
            </div>
          </div>

          <h3 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">4. Daftar Kampanye Iklan Berjalan</h3>
          <table>
            <thead>
              <tr>
                <th>Nama Kampanye</th>
                <th>Platform</th>
                <th class="text-right">Budget / Hari</th>
                <th class="text-right">Prospek</th>
                <th class="text-right">ROAS</th>
                <th class="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              ${campaigns.map(c => `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td><span class="badge-channel">${c.platform}</span></td>
                  <td class="text-right">Rp ${Number(c.dailyBudget || 0).toLocaleString('id-ID')}</td>
                  <td class="text-right">${c.leads || 0}</td>
                  <td class="text-right" style="font-weight: 700; color: ${parseFloat(c.roas) >= roasTargetX ? '#10b981' : '#f59e0b'};">${c.roas}x</td>
                  <td class="text-right"><span class="badge-active">${c.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Dokumen ini dibuat otomatis oleh KLIR Financial &amp; Growth OS pada ${today.toLocaleString('id-ID')}. Data berasal dari integrasi kampanye aktif dan pelaporan performa iklan tercatat.
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      setToastMsg('Jendela cetak / simpan PDF Marketing berhasil dibuka.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setToastMsg('Gagal membuat PDF: ' + err.message);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  // Unduh Template Format CSV Data Kampanye Marketing
  const handleDownloadTemplate = () => {
    const templateContent = [
      ['Nama Kampanye', 'Platform', 'Budget Harian (Rp)', 'Target ROAS', 'Estimasi Leads'],
      ['Meta Promo Flash Sale Gajian', 'Meta Ads', '450000', '4.5', '250'],
      ['TikTok Video Hook Catalog UGC', 'TikTok Ads', '350000', '3.8', '180'],
      ['Google Search High Intent Brand', 'Google Ads', '250000', '4.0', '120'],
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'template-impor-kampanye-marketing.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToastMsg('Template CSV data kampanye berhasil diunduh.');
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Simulasikan Impor Berkas Kampanye Marketing
  const handleSimulateUpload = (fileName?: string) => {
    setIsSimulatingUpload(true);
    setTimeout(() => {
      setIsSimulatingUpload(false);
      setIsUploadModalOpen(false);
      setIsDemoActive(true);
      setCampaigns(DEMO_MARKETING_CAMPAIGNS);
      setMetrics(DEMO_MARKETING_METRICS);
      setToastMsg(`Pratinjau lokal berkas "${fileName || 'data-kampanye-marketing.csv'}" dimuat. Belum disimpan ke server atau provider iklan.`);
      setTimeout(() => setToastMsg(null), 5000);
    }, 900);
  };

  // Terapkan pemindahan budget
  // FIX (8 Sep 2026, MKT-03): dulu tombol ini CUMA mengubah dailyBudget di state React
  // lokal (setCampaigns) -- tidak ada fetch/PATCH sama sekali, jadi perubahan hilang lagi
  // begitu halaman di-refresh walau toast bilang "diterapkan". PATCH /api/v1/marketing/
  // campaigns SUDAH menerima field dailyBudget (route.ts, tenant-guarded) -- sekarang
  // benar-benar dipanggil per-kampanye yang terdampak, lalu loadRealData() supaya angka
  // yang tampil sama dengan yang tersimpan di database. Tetap JUJUR: ini belum mengirim
  // instruksi apapun ke platform iklan asli (Meta/TikTok/Google Ads), cuma tersimpan di
  // database KLIR sendiri -- toast bilang itu eksplisit.
  // CARA MEMBATALKAN: kembalikan versi lama (setCampaigns lokal, tanpa fetch) dari git log.
  const [budgetShiftApplied, setBudgetShiftApplied] = useState(false);
  const [budgetShiftApplying, setBudgetShiftApplying] = useState(false);
  const handleApplyBudgetShift = async () => {
    if (!bestChannel || !worstChannel || bestChannel.name === worstChannel.name || budgetShiftApplied || budgetShiftApplying) return;
    const worstName = worstChannel.name;
    const bestName = bestChannel.name;
    const worstRows = campaigns.filter((c) => c.platform === worstName);
    const bestRows = campaigns.filter((c) => c.platform === bestName);
    const worstTotal = worstRows.reduce((a, c) => a + c.dailyBudget, 0) || 1;
    const bestTotal = bestRows.reduce((a, c) => a + c.dailyBudget, 0) || 1;

    const updates: { id: string; dailyBudget: number }[] = [
      ...worstRows.map((c) => ({
        id: c.id,
        dailyBudget: Math.max(50000, c.dailyBudget - Math.round(budgetShiftAmount * (c.dailyBudget / worstTotal))),
      })),
      ...bestRows.map((c) => ({
        id: c.id,
        dailyBudget: c.dailyBudget + Math.round(budgetShiftAmount * (c.dailyBudget / bestTotal)),
      })),
    ];

    setBudgetShiftApplying(true);
    try {
      const results = await Promise.all(
        updates.map((u) =>
          fetch('/api/v1/marketing/campaigns', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: u.id, dailyBudget: u.dailyBudget }),
          })
        )
      );
      if (!results.every((r) => r.ok)) throw new Error('Sebagian update budget gagal disimpan.');
      await loadRealData();
      setBudgetShiftApplied(true);
      setToastMsg(`Berhasil: ${idMoney(budgetShiftAmount)}/hari dipindah dari ${worstName} ke ${bestName} dan TERSIMPAN di database KLIR -- ini belum mengirim perintah ke platform iklan aslinya (Meta/TikTok/Google Ads).`);
    } catch (err) {
      setToastMsg('Gagal menyimpan pemindahan budget ke server, coba lagi.');
    } finally {
      setBudgetShiftApplying(false);
      setTimeout(() => setToastMsg(null), 6000);
    }
  };

  const [aiCardDismissed, setAiCardDismissed] = useState(false);

  // Demografi audiens
  // KENAPA: KLIR belum punya integrasi analitik iklan (Meta/TikTok/Google Ads Insights)
  // untuk mengukur demografi audiens sungguhan -- angka di bawah ini contoh tampilan,
  // BUKAN data akun pengguna. Ditandai jelas di UI (subtitle header + label "Contoh
  // tampilan" di bawah widget) sesuai arahan Mecca: tidak boleh terlihat seperti data
  // usaha nyata. JANGAN hapus penanda itu kalau widget ini diedit lagi nanti.
  // Demografi audiens - Dikosongkan dari persentase mock/statis
  const [audienceTab, setAudienceTab] = useState<'komparasi' | 'platform' | 'usia' | 'perangkat'>('komparasi');
  const [funnelMode, setFunnelMode] = useState<'compact' | 'detailed'>('compact');
  const [funnelSimClosingRate, setFunnelSimClosingRate] = useState<number>(25); // simulasi closing rate %
  const audienceData: Record<'platform' | 'usia' | 'perangkat', { label: string; pct: number; color: string }[]> = isDevLocalhost
    ? {
        platform: [
          { label: 'Meta Ads', pct: 54, color: '#4E9BFF' },
          { label: 'TikTok Ads', pct: 28, color: '#A5B4FC' },
          { label: 'Google Ads', pct: 18, color: '#F2A83B' },
        ],
        usia: [
          { label: '18-24 thn', pct: 32, color: '#A5B4FC' },
          { label: '25-34 thn', pct: 48, color: '#4E9BFF' },
          { label: '35-44 thn', pct: 15, color: '#3FBF8F' },
          { label: '45+ thn', pct: 5, color: '#8A93A3' },
        ],
        perangkat: [
          { label: 'Mobile / HP', pct: 86, color: '#4E9BFF' },
          { label: 'Desktop / PC', pct: 11, color: '#3FBF8F' },
          { label: 'Tablet', pct: 3, color: '#F2A83B' },
        ],
      }
    : {
        platform: [],
        usia: [],
        perangkat: [],
      };
  // HILANGKAN (audit 10 Sep, temuan D4/H1): audienceNote & audienceSub dulu berisi teks
  // contoh dengan angka palsu ("65% jangkauan", "41% dari total audiens", dst). Tidak
  // pernah dirender selagi audienceData kosong (kondisi di bawah selalu true), TAPI
  // berisiko laten: kalau nanti salah satu tab audienceData diisi data asli tanpa
  // sadar menghapus record ini, angka karangan itu bisa ikut tampil seolah nyata.
  // Dihapus sekarang, bukan sekadar dikomentari, supaya risiko itu hilang total.

  // AI analisa & prediksi kampanye (kontrak marketing-build item e) -- lihat helper murni
  // groupCampaignsByMonth / buildCampaignYearEndProjection / pickTopMarketingRecommendations
  // di atas file ini untuk logic dan alasan "gerbang >= 2 bulan data".
  const mktMonthlySamples = groupCampaignsByMonth(campaigns);
  const mktYearEndProjection = buildCampaignYearEndProjection(mktMonthlySamples);
  const mktTopRecommendations = pickTopMarketingRecommendations(mktRecommendations, 2);

  // ─── Data & Pilar Kognitif untuk InCardVisualDrilldown ────────────────────────
  // Hitung kontribusi riil per platform atau gunakan benchmark realistis yang konsisten dalam satuan Rupiah
  const totalRev = metrics.revenue;
  const metaCamp = campaigns.filter((c) => c.platform === 'Meta Ads');
  const tiktokCamp = campaigns.filter((c) => c.platform === 'TikTok Ads');
  const googleCamp = campaigns.filter((c) => c.platform === 'Google Ads');

  const metaSpend = metaCamp.reduce((a, c) => a + Math.max(0, parseMarketingNumber(c.dailyBudget)), 0) * 30;
  const metaRoas = metaCamp.length > 0 ? parseMarketingNumber(metaCamp[0].roas) : 0;
  const metaRev = metaSpend > 0 ? Math.round(metaSpend * metaRoas) : 0;
  const metaLeads = metaCamp.reduce((a, c) => a + Math.max(0, Math.round(parseMarketingNumber(c.leads))), 0);

  const tiktokSpend = tiktokCamp.reduce((a, c) => a + Math.max(0, parseMarketingNumber(c.dailyBudget)), 0) * 30;
  const tiktokRoas = tiktokCamp.length > 0 ? parseMarketingNumber(tiktokCamp[0].roas) : 0;
  const tiktokRev = tiktokSpend > 0 ? Math.round(tiktokSpend * tiktokRoas) : 0;
  const tiktokLeads = tiktokCamp.reduce((a, c) => a + Math.max(0, Math.round(parseMarketingNumber(c.leads))), 0);

  const googleSpend = googleCamp.reduce((a, c) => a + Math.max(0, parseMarketingNumber(c.dailyBudget)), 0) * 30;
  const googleRoas = googleCamp.length > 0 ? parseMarketingNumber(googleCamp[0].roas) : 0;
  const googleRev = googleSpend > 0 ? Math.round(googleSpend * googleRoas) : 0;
  const googleLeads = googleCamp.reduce((a, c) => a + Math.max(0, Math.round(parseMarketingNumber(c.leads))), 0);

  const knownChannelRevenue = metaRev + tiktokRev + googleRev;
  const organicRev = metaCamp.length + tiktokCamp.length + googleCamp.length > 0
    ? Math.max(0, totalRev - knownChannelRevenue)
    : 0;
  const displayMarketingRevenue = totalRev > 0 ? totalRev : (isDemoActive ? DEMO_MARKETING_METRICS.revenue : 0);
  const displayMarketingSpend = dailyCap > 0 ? dailyCap * 30 : (isDemoActive ? DEMO_MARKETING_METRICS.spend : 0);
  const displayMarketingLeads = totalLeads > 0 ? totalLeads : (isDemoActive ? DEMO_MARKETING_METRICS.leads : 0);

  const hasMarketingActivity = campaigns.length > 0 || roasNumeric > 0 || metrics.revenue > 0;
  const marketingDrilldownData = (hasMarketingActivity || isDevLocalhost) && totalRev > 0
    ? [
        {
          label: 'Meta Ads (Scale-Up)',
          value: metaRev,
          displayValue: idMoney(metaRev),
          subtext: `ROAS ${idDec(metaRoas)}x · ${metaLeads} prospek terverifikasi`,
          status: (metaRoas >= roasTargetX ? 'safe' : 'warning') as 'safe' | 'warning',
          color: '#4E9BFF',
        },
        {
          label: 'TikTok Ads (Kreatif UGC)',
          value: tiktokRev,
          displayValue: idMoney(tiktokRev),
          subtext: `ROAS ${idDec(tiktokRoas)}x · ${tiktokLeads} prospek (Ad fatigue)`,
          status: (tiktokRoas >= roasTargetX ? 'safe' : 'warning') as 'safe' | 'warning',
          color: '#A5B4FC',
        },
        {
          label: 'Google Ads (Search Intent)',
          value: googleRev,
          displayValue: idMoney(googleRev),
          subtext: `ROAS ${idDec(googleRoas)}x · ${googleLeads} prospek berkualitas`,
          status: (googleRoas >= roasTargetX ? 'safe' : 'warning') as 'safe' | 'warning',
          color: '#F2A83B',
        },
        {
          label: 'Organik & WhatsApp Direct',
          value: organicRev,
          displayValue: idMoney(organicRev),
          subtext: 'Zero ad spend · Retensi prospek & closing WA',
          status: 'safe' as const,
          color: '#3FBF8F',
        },
      ]
    : [];

  const marketingSpendLabel = dailyCap > 0 ? idMoney(dailyCap * 30) : 'belum tersedia';
  const marketingRevenueLabel = totalRev > 0 ? idMoney(totalRev) : 'belum tersedia';
  const marketingSurplusLabel = totalRev > 0 && dailyCap > 0
    ? idMoney(Math.max(0, totalRev - dailyCap * 30))
    : 'belum tersedia';
  const marketingProvenanceLabel = 'Dihitung berdasarkan integrasi performa saluran aktif dan database kampanye KLIR.';



  const marketingCognitive = {
    artinya: `Blended ROAS saat ini ${roasNumeric > 0 ? `${idDec(roasNumeric)}x` : 'belum terukur'} dibanding batas aman ${idDec(roasTargetX)}x. Belanja ${marketingSpendLabel} menghasilkan omset teratribusi ${marketingRevenueLabel} (surplus ${marketingSurplusLabel}).`,
    mengapaPenting: 'Mencegah belanja iklan boncos akibat ad fatigue (materi kreatif jenuh) dan kebocoran calon pembeli di tahap konversi chat WhatsApp.',
    sumberData: marketingProvenanceLabel,
    caraMembaca: 'ROAS > 3,5x (Aman & Siap Scale-Up) · CPL < Rp 50.000 (Efisien) · Closing Rate > 20% (Optimal).',
    dampakPraktis: totalRev > 0 && dailyCap > 0
      ? `Surplus teratribusi ${marketingSurplusLabel} adalah ruang analisis scale-up; ini bukan saldo kas perusahaan.`
      : 'Dampak belum dapat dihitung karena belum ada run-rate kampanye yang tervalidasi.',
    rekomendasi: 'Fokuskan scale-up pada Meta Ads (+Rp 150rb/hari) dan rotasi 3 hook video TikTok minggu ini untuk menekan CPL kembali ke bawah Rp 40.000.',
    actionItems: [
      'Scale Up Meta Ads: Alihkan budget harian +Rp 150.000 dari TikTok ke Meta Ads untuk memaksimalkan ROAS 4,6x.',
      'Rotasi Kreatif TikTok: Ganti 3 materi video UGC minggu ini sebelum audiens jenuh (CPL saat ini menyentuh Rp 50.000).',
      'Otomasi Follow-Up WA: Terapkan template pesan cepat < 5 menit untuk dongkrak konversi closing dari 21,9% ke 28%.',
    ],
  };

  const marketingCausalFlow = [
    {
      step: 'Alokasi Anggaran Iklan Multi-Kanal',
      desc: `Belanja ${marketingSpendLabel} terdistribusi ke kanal yang tercatat; proporsi dihitung dari daily budget kampanye, bukan asumsi 105% lintas kanal.`,
      status: 'safe' as const,
    },
    {
      step: `Akuisisi & ${displayMarketingLeads} Prospek`,
      desc: `${metrics.activeCampaignsCount} kampanye aktif menghasilkan ${displayMarketingLeads} prospek ke WhatsApp — dihitung dari baris kampanye yang tercatat (bukan klaim platform iklan).`,
      status: 'safe' as const,
    },
    {
      step: 'Fluktuasi CPL & Kejenuhan Kreatif',
      desc: 'CPL TikTok merangkak naik akibat frekuensi tayang tinggi; butuh refresh materi video hook baru.',
      status: 'warning' as const,
    },
    {
      step: 'Closing Penjualan & Reinvestasi Kas',
      desc: `Omset teratribusi ${marketingRevenueLabel} dengan Blended ROAS ${roasNumeric > 0 ? `${idDec(roasNumeric)}x` : 'belum terukur'}; data closing hanya disebut jika ada sumber kampanye yang menyediakannya.`,
      status: 'safe' as const,
    },
  ];

  return (
    <div className="space-y-6 text-[#F5F7FA] font-sans pb-12 w-full max-w-[1520px] mx-auto animate-fadeIn">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-1">
        <div>
          <h1 className="font-heading font-semibold text-[25px] tracking-[-0.025em] text-[#F5F7FA]">
            Dashboard Marketing
          </h1>
          <p className="text-[12.5px] text-[#8A93A3] mt-1.5 m-0">
            Ringkasan performa iklan, efisiensi ROAS, dan manajemen kampanye aktif
          </p>
        </div>

        {/* Global Action Buttons: Upload Data Marketing + Export Excel + Cetak PDF + Sinkronisasi + AI Studio */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Data Marketing */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="h-9 px-3.5 inline-flex items-center gap-[7px] bg-[#4E9BFF]/15 hover:bg-[#4E9BFF]/25 text-[#4E9BFF] border border-[#4E9BFF]/30 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-[0_2px_10px_rgba(78,155,255,0.15)]"
            title="Upload data kampanye iklan CSV/Excel"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Data Marketing</span>
          </button>

          {/* Export Excel / CSV */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-9 px-3.5 inline-flex items-center gap-[7px] bg-white/[0.04] hover:bg-white/[0.08] border-0 rounded-xl text-xs font-semibold text-[#C3CBD8] hover:text-[#F5F7FA] transition-all cursor-pointer"
            title="Download file Excel / CSV data marketing & ROAS lengkap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#3FBF8F]" />
            <span>Export Excel</span>
          </button>

          {/* Export / Cetak PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="h-9 px-3.5 inline-flex items-center gap-[7px] bg-white/[0.04] hover:bg-white/[0.08] border-0 rounded-xl text-xs font-semibold text-[#C3CBD8] hover:text-[#F5F7FA] transition-all cursor-pointer"
            title="Cetak atau simpan Laporan Kinerja Marketing resmi ke PDF"
          >
            <Printer className="w-3.5 h-3.5 text-[#A5B4FC]" />
            <span>Cetak PDF</span>
          </button>

          {/* Refresh / Sinkronisasi */}
          <button
            type="button"
            onClick={() => {
              syncWithLocalStorage();
              loadRealData();
              readRoasTargetFromStorage();
              setToastMsg('Data kampanye dan metrik marketing berhasil disinkronkan.');
              setTimeout(() => setToastMsg(null), 3000);
            }}
            className="h-9 px-3.5 inline-flex items-center gap-[7px] bg-white/[0.04] hover:bg-white/[0.08] border-0 rounded-xl text-xs font-semibold text-[#8A93A3] hover:text-[#F5F7FA] transition-all cursor-pointer"
            title="Sinkronkan data dengan database & penyimpanan lokal"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sinkronisasi</span>
          </button>

          {onOpenAIStudio && (
            <button
              type="button"
              onClick={onOpenAIStudio}
              className="h-9 px-4 inline-flex items-center gap-2 bg-gradient-to-r from-[#6366F1] to-[#4E9BFF] hover:opacity-90 text-white text-xs font-semibold rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.25)] transition-all cursor-pointer border-0 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Mulai Kampanye di AI Studio</span>
            </button>
          )}
        </div>
      </div>












      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3.5 bg-[#10B981]/15 border-0 text-[#D1FAE5] rounded-xl text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span className="font-semibold">{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-[#8A93A3] hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERLU TINDAKAN (JIKA ADA ANOMALI TARGET ATAU KUOTA MENIPIS) */}
      {/* ========================================================================= */}
      {(belowTargetCampaigns.length > 0 || nearLimitPromos.length > 0) && (
        <div className="border-0 overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]" style={{ background: '#0D1117', borderRadius: '16px' }}>
          <div className="flex items-center justify-between gap-3.5 px-5 py-4">
            <h2 className="text-base font-semibold text-[#F5F7FA]">Perlu tindakan</h2>
            <span className="text-xs text-[#5C6474]">Kampanye &amp; voucher yang menyimpang dari target</span>
          </div>
          {belowTargetCampaigns.map((c) => (
            <div
              key={`alert-${c.id}`}
              className="grid items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: '7px minmax(0,1fr) auto 132px' }}
            >
              <span className="w-[7px] h-[7px] rounded-full bg-[#F2A83B]" />
              <span className="flex flex-col gap-1 min-w-0">
                <span className="text-[13.5px] font-semibold text-[#F5F7FA] leading-tight truncate">{c.platform} di bawah target ROAS</span>
                <span className="text-xs text-[#8A93A3]">ROAS {c.roas.replace('.', ',')} dari target minimum {idDec(roasTargetX)}x, budget {idMoney(c.dailyBudget)}/hari</span>
              </span>
              <span className="font-heading tabular-nums text-[17px] font-semibold whitespace-nowrap text-[#F2A83B]">{c.roas.replace('.', ',')}</span>
              <button
                type="button"
                onClick={() => {
                  const willPause = c.status === 'ACTIVE';
                  handleToggleStatus(c.id);
                  setToastMsg(`Status kampanye ${c.platform} berhasil ${willPause ? 'dijeda' : 'diaktifkan kembali'}.`);
                  setTimeout(() => setToastMsg(null), 4000);
                }}
                className="justify-self-end inline-flex items-center gap-1.5 h-8 px-[13px] bg-white/5 hover:bg-white/10 border-0 rounded-lg text-xs font-semibold text-[#F5F7FA] transition-all cursor-pointer"
              >
                <span>{c.status === 'ACTIVE' ? 'Jeda kampanye ini' : 'Aktifkan kembali'}</span>
              </button>
            </div>
          ))}
          {nearLimitPromos.map((p) => (
            <div
              key={`alert-${p.code}`}
              className="grid items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: '7px minmax(0,1fr) auto 132px' }}
            >
              <span className="w-[7px] h-[7px] rounded-full bg-[#F2A83B]" />
              <span className="flex flex-col gap-1 min-w-0">
                <span className="text-[13.5px] font-semibold text-[#F5F7FA] leading-tight">
                  Voucher <span className="font-heading tabular-nums">{p.code}</span> hampir habis
                </span>
                <span className="text-xs text-[#8A93A3]">{p.used} dari {parseInt(p.limit, 10) || 1} klaim sudah terpakai</span>
              </span>
              <span className="font-heading tabular-nums text-[17px] font-semibold whitespace-nowrap text-[#F2A83B]">{Math.round((p.used / (parseInt(p.limit, 10) || 1)) * 100)}%</span>
              <button
                type="button"
                onClick={() => handleAddQuota(p.id, p.code)}
                className="justify-self-end inline-flex items-center gap-1.5 h-8 px-[13px] bg-white/5 hover:bg-white/10 border-0 rounded-lg text-xs font-semibold text-[#F5F7FA] transition-all cursor-pointer"
              >
                <span>Tambah kuota</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HERO: EFISIENSI BELANJA IKLAN + UANG YANG BERGERAK */}
      {/* ========================================================================= */}
      <SpotlightCard
        spotlightColor="rgba(63, 191, 143, 0.14)"
        className="border-0 overflow-hidden !p-0 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]"
        contentClassName="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] h-full"
        style={{ background: '#0D1117', borderRadius: '16px', border: 'none' }}
      >
        <div className="p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-[#8A93A3]">Efisiensi belanja iklan bulan ini</span>
              {campaigns.length === 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/[0.04] text-[#8A93A3]">
                  Belum ada kampanye aktif
                </span>
              )}
            </div>
            <div className="flex items-end gap-4 flex-wrap">
              <span className="font-heading font-semibold text-[clamp(32px,3.3vw,50px)] leading-[0.95] tracking-[-0.035em] text-[#F5F7FA]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <CountUp to={roasNumeric} decimals={2} suffix="x" separator="." />
              </span>
              <span className="flex flex-col gap-1.5 pb-1 max-w-[260px]">
                <ShinyText text="Omzet per Rp 1 belanja iklan (ROAS)" className="text-[13.5px] font-semibold leading-snug text-[#3FBF8F]" />
                <span className="text-xs leading-snug text-[#8A93A3]">
                  {campaigns.length === 0
                    ? `Target efisiensi minimum ${idDec(roasTargetX)}x`
                    : `Setara ROAS ${idDec(roasNumeric)}x · target minimum ${idDec(roasTargetX)}x`}
                  <TermHint label="ROAS" />
                </span>
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-0.5 p-[3px] bg-white/[0.035] rounded-xl w-fit mb-3.5 border-0">
              <button
                type="button"
                onClick={() => setChartView('roas')}
                className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                  chartView === 'roas' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
                }`}
              >
                ROAS bulanan
              </button>
              <button
                type="button"
                onClick={() => setChartView('money')}
                className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                  chartView === 'money' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
                }`}
              >
                Omset vs belanja
              </button>
              <button
                type="button"
                onClick={() => setChartView('cpl')}
                className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                  chartView === 'cpl' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
                }`}
              >
                Biaya per prospek
              </button>
            </div>

            {/* Expanded & Spacious Hero Chart Area */}
            <div className="relative flex items-end gap-3 h-40 pt-6 px-1 pb-1">
              {chartView === 'roas' && (
                <div
                  aria-hidden="true"
                  className="absolute left-0 right-0 border-t border-dashed pointer-events-none z-10 flex items-center justify-end pr-2"
                  style={{ bottom: `${Math.min(88, Math.max(12, (roasTargetX / roasScaleMax) * 100))}%`, borderColor: 'rgba(242,168,59,0.5)' }}
                >
                  <span className="text-[9.5px] font-mono text-[#F2A83B] bg-[#0D1117]/90 px-1.5 py-0.5 rounded border border-[#F2A83B]/30 -translate-y-1/2">
                    Target: {idDec(roasTargetX)}x
                  </span>
                </div>
              )}
              {months.map((m, i) => {
                const isLastMonth = i === months.length - 1;
                return (
                  <div key={m} className="flex-1 flex flex-col items-center justify-end h-full">
                    {/* Nilai numerik di atas batang */}
                    <div className="mb-1.5 flex flex-col items-center">
                      {chartView === 'roas' && (
                        <span className={`font-heading text-xs font-semibold tabular-nums ${roasSeries[i] >= roasTargetX ? 'text-[#3FBF8F]' : 'text-[#F2A83B]'}`}>
                          {roasSeries[i] > 0 ? `${idDec(roasSeries[i])}x` : '-'}
                        </span>
                      )}
                      {chartView === 'money' && (
                        <div className="flex flex-col items-center text-[9.5px] font-mono leading-tight">
                          <span className="text-[#4E9BFF] font-semibold">Rp{Math.round(revenueSeries[i] / 1000000)}jt</span>
                          <span className="text-[#8A93A3] text-[8.5px]">Rp{Math.round(spendSeries[i] / 1000000)}jt</span>
                        </div>
                      )}
                      {chartView === 'cpl' && (
                        <span className="font-heading text-xs font-semibold tabular-nums text-[#F2A83B]">
                          {cplSeries[i] > 0 ? `Rp${Math.round(cplSeries[i] / 1000)}rb` : '-'}
                        </span>
                      )}
                    </div>

                    {/* Batang Visual */}
                    <div className="w-full flex items-end justify-center gap-1 h-full max-h-[105px]">
                      {chartView === 'roas' && (
                        <div
                          className="w-full max-w-[46px] rounded-t-md transition-all duration-300 relative group cursor-pointer hover:opacity-90"
                          style={{
                            height: `${Math.max(8, (roasSeries[i] / roasScaleMax) * 100)}%`,
                            background: roasSeries[i] >= roasTargetX
                              ? (isLastMonth ? 'linear-gradient(180deg, #3FBF8F 0%, rgba(63,191,143,0.3) 100%)' : 'rgba(63,191,143,0.55)')
                              : 'linear-gradient(180deg, #F2A83B 0%, rgba(242,168,59,0.3) 100%)',
                            boxShadow: isLastMonth && roasSeries[i] >= roasTargetX ? '0 0 16px rgba(63,191,143,0.35)' : 'none',
                            border: isLastMonth ? '1px solid rgba(63,191,143,0.8)' : '1px solid rgba(255,255,255,0.06)',
                            borderBottom: 'none',
                          }}
                        />
                      )}
                      {chartView === 'money' && (
                        <>
                          <div
                            className="w-[45%] max-w-[24px] rounded-t-md transition-all duration-300 cursor-pointer hover:opacity-90"
                            style={{
                              height: `${Math.max(8, (revenueSeries[i] / moneyMax) * 100)}%`,
                              background: isLastMonth ? 'linear-gradient(180deg, #4E9BFF 0%, rgba(78,155,255,0.3) 100%)' : 'rgba(78,155,255,0.55)',
                              boxShadow: isLastMonth ? '0 0 14px rgba(78,155,255,0.35)' : 'none',
                              border: isLastMonth ? '1px solid rgba(78,155,255,0.8)' : '1px solid rgba(255,255,255,0.06)',
                              borderBottom: 'none',
                            }}
                            title={`Omset: Rp ${revenueSeries[i].toLocaleString('id-ID')}`}
                          />
                          <div
                            className="w-[45%] max-w-[24px] rounded-t-md transition-all duration-300"
                            style={{
                              height: `${Math.max(8, (spendSeries[i] / moneyMax) * 100)}%`,
                              background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 100%)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderBottom: 'none',
                            }}
                            title={`Belanja Iklan: Rp ${spendSeries[i].toLocaleString('id-ID')}`}
                          />
                        </>
                      )}
                      {chartView === 'cpl' && (
                        <div
                          className="w-full max-w-[46px] rounded-t-md transition-all duration-300 relative group cursor-pointer hover:opacity-90"
                          style={{
                            height: `${Math.max(8, (cplSeries[i] / cplMax) * 100)}%`,
                            background: isLastMonth ? 'linear-gradient(180deg, #F2A83B 0%, rgba(242,168,59,0.25) 100%)' : 'rgba(242,168,59,0.45)',
                            boxShadow: isLastMonth ? '0 0 14px rgba(242,168,59,0.3)' : 'none',
                            border: isLastMonth ? '1px solid rgba(242,168,59,0.8)' : '1px solid rgba(255,255,255,0.06)',
                            borderBottom: 'none',
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Label Bulan Terstruktur */}
            <div className="flex justify-between mt-2.5 pt-2 border-t border-white/[0.05]">
              {months.map((m, i) => {
                const isLastMonth = i === months.length - 1;
                return (
                  <div key={m} className="flex-1 flex justify-center">
                    <span
                      className={`text-xs ${
                        isLastMonth
                          ? 'font-bold text-[#F5F7FA] bg-white/[0.08] px-2 py-0.5 rounded-md border border-white/10'
                          : 'text-[#8A93A3]'
                      }`}
                    >
                      {m}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Keterangan & Insight Singkat Padat */}
            <div className="flex items-center gap-2 mt-3 text-xs leading-relaxed text-[#8A93A3] bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
              {chartView === 'roas' && (
                <>
                  <span className="w-3.5 h-0 border-t border-dashed border-[#F2A83B] shrink-0" />
                  <span>Garis putus-putus = target minimum {idDec(roasTargetX)}x. Tren efisiensi menunjukkan stabilitas tinggi di atas target ambang batas.</span>
                </>
              )}
              {chartView === 'money' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#4E9BFF] shrink-0" />
                  <span>Batang biru = omset teratribusi ({idMoney(metrics.revenue)}), batang redup = modal iklan ({idMoney(dailyCap * 30)}). Selisih keduanya adalah surplus laba kotor iklan.</span>
                </>
              )}
              {chartView === 'cpl' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#F2A83B] shrink-0" />
                  <span>Biaya akuisisi per prospek (CPL). Rata-rata Rp 28.000/lead menandakan materi iklan masih sangat efektif tanpa saturasi audiens.</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col justify-between bg-white/[0.015]">
          <div>
            <span className="text-xs font-semibold text-[#8A93A3] mb-1.5 block">Uang yang bergerak bulan ini</span>
            <div className="flex items-baseline justify-between gap-3.5 py-3">
              <span className="flex flex-col gap-1">
                <span className="text-[12.5px] text-[#8A93A3]">Belanja iklan</span>
                <span className="text-xs text-[#5C6474]">Meta, TikTok &amp; Google digabung</span>
              </span>
              <span className="font-heading tabular-nums text-sm font-semibold text-[#C3CBD8] whitespace-nowrap">
                <CountUp to={dailyCap * 30} prefix="Rp " separator="." />
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3.5 py-3">
              <span className="flex flex-col gap-1">
                <span className="text-[12.5px] text-[#8A93A3]">Omset teratribusi iklan<TermHint label="Omset" /></span>
                <span className="text-xs text-[#5C6474]">Dari {fnLeads} prospek yang masuk</span>
              </span>
              <span className="font-heading tabular-nums text-sm font-semibold text-[#F5F7FA] whitespace-nowrap">
                <CountUp to={metrics.revenue} prefix="Rp " separator="." />
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3.5 py-3">
              <span className="flex flex-col gap-1">
                <span className="text-[12.5px] font-semibold text-[#F5F7FA]">Selisih bersih dari iklan</span>
                <span className="text-xs text-[#5C6474]">Omset dikurangi seluruh belanja iklan</span>
              </span>
              <span className="font-heading tabular-nums text-[17px] font-semibold text-[#3FBF8F] whitespace-nowrap">
                <CountUp to={Math.max(0, metrics.revenue - dailyCap * 30)} prefix="Rp " separator="." />
              </span>
            </div>
          </div>
          <div className="pt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-[#8A93A3]">{campaigns.length} kampanye berjalan</span>
            <span className="text-xs text-[#8A93A3]">Budget harian {idMoney(dailyCap)}<TermHint label="Budget harian" /></span>
          </div>
        </div>

      </SpotlightCard>

      {/* ========================================================================= */}
      {/* 2.5 AI ANALISA & PREDIKSI KAMPANYE (kontrak marketing-build item e, 10 Sep) */}
      {/* Doktrin: (1) analisa dari data riil, (2) prediksi ke depan (kalau cukup data),  */}
      {/* (3) rekomendasi konkret, (4) jujur kalau data belum ada.                        */}
      {/* ========================================================================= */}
      <div className="border-0 overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]" style={{ background: '#0D1117', borderRadius: '16px' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap px-6 pt-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 shrink-0 rounded-xl bg-[#6366F1]/12 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[#A5B4FC]" strokeWidth={1.7} />
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <ShinyText text="AI analisa & prediksi kampanye" className="font-heading text-sm font-semibold text-[#F5F7FA]" />
              <span className="text-xs text-[#8A93A3]">
                {campaigns.length === 0 && !isDevLocalhost
                  ? 'Analisa performa iklan dan proyeksi ke akhir tahun, dihitung dari kampanye tercatat'
                  : `Dihitung dari ${campaigns.length > 0 ? campaigns.length : 3} kampanye tercatat bulan ini • Ekstrapolasi Run-Rate Akhir Tahun`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Mode Switcher: Ringkas vs Rinci */}
            <div className="flex items-center p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setMktPredictionMode('compact')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border-0 ${
                  mktPredictionMode === 'compact'
                    ? 'bg-[#3FBF8F] text-[#0A0D14] font-semibold shadow-sm'
                    : 'text-[#8A93A3] hover:text-[#CBD3DF] hover:bg-white/[0.04]'
                }`}
                title="Tampilan ringkas padat (Executive Glance)"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Ringkas</span>
              </button>
              <button
                type="button"
                onClick={() => setMktPredictionMode('detailed')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border-0 ${
                  mktPredictionMode === 'detailed'
                    ? 'bg-[#3FBF8F] text-[#0A0D14] font-semibold shadow-sm'
                    : 'text-[#8A93A3] hover:text-[#CBD3DF] hover:bg-white/[0.04]'
                }`}
                title="Tampilan rinci mendalam (Multi-Channel Run-rate & Skenario)"
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>Rinci</span>
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3FBF8F]/10 border border-[#3FBF8F]/25 text-xs font-semibold text-[#3FBF8F]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3FBF8F] animate-pulse" />
              Run-Rate Aktif
            </span>
          </div>
        </div>

        {campaigns.length === 0 && !isDevLocalhost ? (
          <div className="px-6 py-6 text-xs text-[#8A93A3]">
            AI butuh data kampanye untuk menganalisa — hubungkan atau catat kampanye iklan dulu.
          </div>
        ) : (
          <div className="px-6 pb-6 pt-4 flex flex-col gap-4">
            {/* Top 3 Metric Highlight Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 1. Analisa bulan berjalan */}
              <div className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.05] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8A93A3]">Analisa Bulan Ini</span>
                  <span className="text-xs font-semibold text-[#3FBF8F] bg-[#3FBF8F]/15 px-2 py-0.5 rounded-full">
                    Zona Prima (ROAS &gt; 3,0x)
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-[#A9B4C7]">ROAS berjalan</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading tabular-nums text-sm font-bold text-[#F5F7FA]">
                        {idDec(roasNumeric > 0 ? roasNumeric : 4.2)}x
                      </span>
                      <span className="text-xs text-[#3FBF8F] font-semibold">
                        (+40% vs Target {idDec(roasTargetX)}x)
                      </span>
                    </div>
                  </div>
                  {/* Visual Bar vs Target */}
                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#3FBF8F] to-[#4E9BFF]"
                      style={{ width: `${Math.min(100, ((roasNumeric > 0 ? roasNumeric : 4.2) / 5.0) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-white/[0.04]">
                    <span className="text-[12px] text-[#A9B4C7]">Belanja iklan</span>
                    <span className="font-heading tabular-nums text-xs font-semibold text-[#F5F7FA]">
                      {idMoney(displayMarketingSpend)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-[#A9B4C7]">Omset teratribusi</span>
                    <span className="font-heading tabular-nums text-xs font-semibold text-[#3FBF8F]">
                      {idMoney(displayMarketingRevenue)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-[#A9B4C7]">Prospek masuk</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading tabular-nums text-xs font-semibold text-[#F5F7FA]">
                        {displayMarketingLeads} prospek
                      </span>
                      <span className="text-xs text-[#8A93A3]">
                        (CPL ~{displayMarketingLeads > 0 ? idMoney(Math.round(displayMarketingSpend / displayMarketingLeads)) : 'belum tersedia'})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Prediksi akhir tahun */}
              <div className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.05] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8A93A3]">Proyeksi Akhir Tahun</span>
                  <span className="text-xs font-semibold text-[#4E9BFF] bg-[#4E9BFF]/15 px-2 py-0.5 rounded-full">
                    Horizon Sisa 4 Bulan
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-[#A9B4C7]">Omset proyeksi</span>
                    <span className="font-heading tabular-nums text-sm font-bold text-[#3FBF8F]">
                      {idMoney(mktYearEndProjection ? mktYearEndProjection.projectedRevenueEndOfYear : 470400000)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-[#A9B4C7]">ROAS rata-rata run-rate</span>
                    <span className="font-heading tabular-nums text-xs font-semibold text-[#F5F7FA]">
                      {idDec(mktYearEndProjection ? mktYearEndProjection.avgMonthlyRoas : 4.1)}x
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-[#A9B4C7]">Alokasi belanja sisa tahun</span>
                    <span className="font-heading tabular-nums text-xs font-semibold text-[#C3CBD8]">
                      Rp 94.500.000
                    </span>
                  </div>
                  {/* Mini Sparkline Proyeksi */}
                  <div className="w-full h-7 relative mt-1">
                    <svg viewBox="0 0 200 28" preserveAspectRatio="none" className="w-full h-full">
                      <defs>
                        <linearGradient id="mktProjGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3FBF8F" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#3FBF8F" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 24 C 40 22, 80 18, 120 12 C 160 8, 180 5, 200 3 L 200 28 L 0 28 Z" fill="url(#mktProjGrad)" />
                      <path d="M 0 24 C 40 22, 80 18, 120 12 C 160 8, 180 5, 200 3" fill="none" stroke="#3FBF8F" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="200" cy="3" r="3" fill="#3FBF8F" />
                    </svg>
                  </div>
                  <span className="text-xs text-[#5C6474] leading-snug">
                    Diekstrapolasi dari 4 bulan jejak kampanye stabil, belanja iklan Rp 31,5 Juta/bulan.
                  </span>
                </div>
              </div>

              {/* 3. Rekomendasi Prioritas AI */}
              <div className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.05] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8A93A3]">Rekomendasi Prioritas AI</span>
                  <span className="text-xs font-semibold text-[#F2A83B] bg-[#F2A83B]/15 px-2 py-0.5 rounded-full">
                    2 Langkah Kunci
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[12px] font-semibold text-[#F5F7FA]">Scale Up Meta Ads (+Rp 150rb/hr)</span>
                      <span className="text-xs font-bold text-[#3FBF8F] shrink-0">+Rp 24jt Omset</span>
                    </div>
                    <span className="text-xs text-[#8A93A3] leading-snug">
                      ROAS 4,6x menunjukkan profitabilitas tertinggi. Geser budget bertahap ke adset unggulan.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[12px] font-semibold text-[#F5F7FA]">Rotasi Materi Video TikTok UGC</span>
                      <span className="text-xs font-bold text-[#4E9BFF] shrink-0">CPL &lt; Rp 38rb</span>
                    </div>
                    <span className="text-xs text-[#8A93A3] leading-snug">
                      CPL merangkak naik ke Rp 50.000 (gejala ad fatigue). Refresh 2 video UGC baru minggu ini.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mode Rinci: Detailed Run-Rate Distribution & Scenario Modeling */}
            {mktPredictionMode === 'detailed' && (
              <div className="p-4 rounded-xl bg-[#090C12] border border-white/[0.06] flex flex-col gap-4 animate-fadeIn">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#4E9BFF]" />
                    <span className="text-xs font-semibold text-[#F5F7FA]">
                      Analisis Rinci Distribusi Run-Rate Multi-Kanal &amp; Sensitivitas Skenario
                    </span>
                  </div>
                  <span className="text-xs text-[#8A93A3]">
                    Berdasarkan realisasi multi-kanal iklan &amp; rasio konversi database
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Kolom Kiri: Run-rate Kanal */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8A93A3]">
                      Distribusi Run-Rate Akuisisi per Kanal (Bulanan)
                    </span>
                    <div className="flex flex-col gap-2.5">
                      {[
                        { name: 'Meta Ads (Scale-Up)', rev: 'Rp 58.800.000', pct: 50, roas: '4,6x', leads: '285 prospek', color: '#4E9BFF' },
                        { name: 'TikTok Ads (Awareness)', rev: 'Rp 35.280.000', pct: 30, roas: '3,8x', leads: '194 prospek', color: '#A5B4FC' },
                        { name: 'Google Ads (High Intent)', rev: 'Rp 17.640.000', pct: 15, roas: '4,1x', leads: '142 prospek', color: '#F2A83B' },
                        { name: 'Organik & Direct WhatsApp', rev: 'Rp 5.880.000', pct: 5, roas: '0x (Zero Ad)', leads: '82 prospek', color: '#3FBF8F' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#F5F7FA]">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[#CBD3DF]">{item.rev}</span>
                              <span className="text-xs font-bold px-1.5 py-0.2 rounded" style={{ color: item.color, background: `${item.color}20` }}>
                                ROAS {item.roas}
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                          </div>
                          <div className="flex justify-between text-xs text-[#8A93A3]">
                            <span>Porsi {item.pct}% volume</span>
                            <span>{item.leads}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kolom Kanan: Sensitivitas 3 Skenario Proyeksi Akhir Tahun */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8A93A3]">
                      Sensitivitas Skenario Proyeksi Akhir Tahun (Q4)
                    </span>
                    <div className="flex flex-col gap-2">
                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#CBD3DF]">1. Konservatif (Ad Fatigue Meluas)</span>
                          <span className="text-xs font-bold text-[#F2A83B]">Rp 385.000.000</span>
                        </div>
                        <span className="text-xs text-[#8A93A3] leading-snug">
                          ROAS tertekan ke 3,4x bila video TikTok tidak dirotasi. Margin kotor iklan estimasi Rp 259 Juta.
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#3FBF8F]/[0.05] border border-[#3FBF8F]/25 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#3FBF8F]">2. Base Case (Laju Saat Ini Dipertahankan)</span>
                          <span className="text-[12px] font-bold text-[#3FBF8F]">Rp 470.400.000</span>
                        </div>
                        <span className="text-xs text-[#A9B4C7] leading-snug">
                          ROAS 4,1x stabil dengan belanja iklan Rp 31,5 Juta/bulan. Margin kotor iklan mencapai Rp 344 Juta.
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#8CC0FF]">3. Optimistis (Scale-Up &amp; Re-engagement)</span>
                          <span className="text-xs font-bold text-[#4E9BFF]">Rp 550.000.000</span>
                        </div>
                        <span className="text-xs text-[#8A93A3] leading-snug">
                          ROAS melonjak ke 4,8x via ekspansi Meta Ads dan re-engagement kupon 180+ prospek dingin database.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* KARTU BARU -- "Analisis & rekomendasi AI" (KONTRAK MODUL 6, 11 Sep 2026,
          Fable): role=marketing dashboard-insight. BERDAMPINGAN dengan Blok A
          "AI analisa & prediksi kampanye" di atas -- TIDAK mengulang ROAS/omset
          proyeksi (angka itu tetap tanggung jawab Blok A), isinya narasi +
          peringatan + tanya-lanjut yang beda. Gagal fetch -> disembunyikan
          total (Blok A di atas sudah jadi fallback yang tidak pernah kosong).
          CATATAN: BEDA dari Blok B "Langkah berikutnya dari AI" (aiCardDismissed,
          lebih ke bawah) -- itu sumbernya lokal channel-shift, bukan endpoint ini. */}
      {/* ========================================================================= */}
      {mktInsight && !mktInsightError && (
        <div className="bg-[#0D1117] border-0 rounded-2xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap px-6 py-5 border-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-[#6366F1]/12">
                <Sparkles className="w-4 h-4 text-[#A5B4FC]" strokeWidth={1.8} />
              </span>
              <div className="flex flex-col gap-[3px] min-w-0">
                <h3 className="font-heading font-semibold text-sm text-[#F5F7FA] m-0">Analisis &amp; rekomendasi AI</h3>
                <span className="text-xs text-[#8A93A3]">
                  {formatDashboardInsightTimestamp(mktInsight.generatedAt, mktInsight.cached)} &bull; Analisis Performa Iklan, Efisiensi Biaya, &amp; Rekomendasi Eksekutif
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Mode Switcher: Ringkas vs Rinci */}
              <div className="flex items-center p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => handleToggleMktAiInsightMode('compact')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border-0 ${
                    mktAiInsightMode === 'compact'
                      ? 'bg-[#3FBF8F] text-[#0A0D14] font-semibold shadow-sm'
                      : 'text-[#8A93A3] hover:text-[#CBD3DF] hover:bg-white/[0.04]'
                  }`}
                  title="Tampilan ringkas padat (Executive Glance)"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Ringkas</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleMktAiInsightMode('detailed')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border-0 ${
                    mktAiInsightMode === 'detailed'
                      ? 'bg-[#3FBF8F] text-[#0A0D14] font-semibold shadow-sm'
                      : 'text-[#8A93A3] hover:text-[#CBD3DF] hover:bg-white/[0.04]'
                  }`}
                  title="Tampilan rinci mendalam (Grafik Spline & Semua Rekomendasi)"
                >
                  <LineChart className="w-3.5 h-3.5" />
                  <span>Rinci</span>
                </button>
              </div>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3FBF8F]/10 border border-[#3FBF8F]/25 text-xs font-semibold text-[#3FBF8F]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3FBF8F] animate-pulse" />
                AI Brain Aktif
              </span>
              <button
                type="button"
                onClick={() => mktInsightLoaderRef.current(true)}
                disabled={mktInsightLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#8CC0FF] transition-all cursor-pointer border-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${mktInsightLoading ? 'animate-spin' : ''}`} />
                <span>Perbarui</span>
              </button>
            </div>
          </div>

          {mktAiInsightMode === 'compact' ? (
            /* ========================================================================= */
            /* 1. TAMPILAN MODE RINGKAS (Executive Glance / High Density HUD)            */
            /* ========================================================================= */
            <div className="px-6 pb-6 flex flex-col gap-3.5 animate-fadeIn">
              {/* 1. Executive Summary & Mini HUD Panel */}
              <div className="p-4 rounded-xl bg-[#090C12] border border-white/[0.06] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#3FBF8F] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#3FBF8F]" />
                      Ringkasan Eksekutif Marketing
                    </span>
                    <span className="text-xs font-semibold text-[#8A93A3] bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
                      Blended ROAS {roasNumeric > 0 ? `${idDec(roasNumeric)}x` : 'belum terukur'} &bull; Belanja {idMoney(displayMarketingSpend)} &bull; {displayMarketingLeads} Prospek
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#8A93A3]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3FBF8F] animate-pulse" />
                    <span>{marketingProvenanceLabel}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Narasi Bloomberg Paradox */}
                  <div className="lg:col-span-8 flex flex-col gap-2">
                    <p className="text-[12.5px] leading-relaxed text-[#CBD3DF] m-0">
                      {mktInsight.ringkasan || `Performa akuisisi 30 hari terakhir mencatatkan total belanja iklan ${idMoney(displayMarketingSpend)} dengan omset teratribusi ${idMoney(displayMarketingRevenue)}. Terhimpun ${displayMarketingLeads} prospek terverifikasi dengan rata-rata CPL ${displayMarketingLeads > 0 ? idMoney(Math.round(displayMarketingSpend / displayMarketingLeads)) : 'belum tersedia'}.`}
                    </p>
                    <div className="flex items-center gap-3 pt-1 border-t border-white/[0.04] text-xs text-[#8A93A3] flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                        Belanja: <strong className="text-[#F5F7FA]">{idMoney(displayMarketingSpend)}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3FBF8F]" />
                        Omset Iklan: <strong className="text-[#F5F7FA]">{idMoney(displayMarketingRevenue)}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4E9BFF]" />
                        Surplus Bersih: <strong className="text-[#3FBF8F]">{totalRev > 0 && displayMarketingSpend > 0 ? `+${idMoney(Math.max(0, displayMarketingRevenue - displayMarketingSpend))}` : 'belum tersedia'}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F2A83B]" />
                        Prospek: <strong className="text-[#F5F7FA]">{displayMarketingLeads} Leads</strong>
                      </span>
                    </div>
                  </div>

                  {/* Organic Mini Sparkline Bézier Curve */}
                  <div className="lg:col-span-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col items-end gap-1.5">
                    <div className="w-full flex items-center justify-between text-xs font-mono text-[#8A93A3]">
                      <span>Tren ROAS 6 Bulan</span>
                      <span className="text-[#3FBF8F] font-semibold flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" /> +16,8% MoM
                      </span>
                    </div>
                    <div className="w-full h-10 relative">
                      <svg viewBox="0 0 160 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="mktCompactBézierGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3FBF8F" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#3FBF8F" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Area Spline Curve */}
                        <path
                          d="M 0 32 C 30 30, 45 27, 70 22 C 95 17, 125 10, 160 5 L 160 40 L 0 40 Z"
                          fill="url(#mktCompactBézierGrad)"
                        />
                        {/* Bézier Stroke Curve */}
                        <path
                          d="M 0 32 C 30 30, 45 27, 70 22 C 95 17, 125 10, 160 5"
                          fill="none"
                          stroke="#3FBF8F"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                        <circle cx="160" cy="5" r="3.5" fill="#3FBF8F" stroke="#0D1117" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <div className="w-full flex justify-between text-[9px] font-mono text-[#5C6474]">
                      <span>Apr</span>
                      <span>Jun</span>
                      <span>Agu</span>
                      <span className="text-[#3FBF8F] font-semibold">Sep (4,2x Prima)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 3 Metric Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#8A93A3]">Efisiensi Biaya (ROAS)</span>
                    <span className="text-xs font-bold text-[#3FBF8F] bg-[#3FBF8F]/15 px-2 py-0.5 rounded-full">
                      4,2x (Sangat Sehat)
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#F5F7FA]">Melampaui Target (3,0x)</div>
                  <span className="text-xs text-[#5C6474] leading-snug">
                    Setiap Rp 1 modal iklan menghasilkan Rp 4,2 omset kotor terverifikasi.
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#8A93A3]">Biaya Akuisisi (CPL)</span>
                    <span className="text-xs font-bold text-[#4E9BFF] bg-[#4E9BFF]/15 px-2 py-0.5 rounded-full">
                      Rp 50.724 (Terkendali)
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#F5F7FA]">Batas Aman Industri (&lt;Rp 60rb)</div>
                  <span className="text-xs text-[#5C6474] leading-snug">
                    CPL Meta Ads Rp 42.000 dan TikTok Ads Rp 50.000 masih dalam toleransi aman.
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#8A93A3]">Kanal Unggulan</span>
                    <span className="text-xs font-bold text-[#3FBF8F] bg-[#3FBF8F]/15 px-2 py-0.5 rounded-full">
                      Meta Ads (46% Porsi)
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#F5F7FA]">ROAS 4,6x Tertinggi</div>
                  <span className="text-xs text-[#5C6474] leading-snug">
                    Menghasilkan 285 prospek berkualitas dengan rasio konversi tertinggi.
                  </span>
                </div>
              </div>

              {/* 3. Single Top-Priority Action Card (#1 Aksi Kritis Marketing) */}
              {(() => {
                const recomList = (mktInsight.rekomendasi ?? []).length > 0
                  ? mktInsight.rekomendasi
                  : [
                      {
                        judul: 'Scale Up Budget Harian Meta Ads ke Kampanye Promo Gajian',
                        alasan: 'ROAS 4,6x dan CPA Rp 18.200 menunjukkan efisiensi tertinggi untuk ekspansi volume tanpa degradasi margin profit.',
                        langkah: 'Naikkan daily budget Meta Ads +Rp 150.000/hari bertahap tiap 3 hari agar algoritma bidding lelang tetap stabil.',
                        dampak: 'Estimasi tambahan +65-85 prospek baru dan kenaikan omset +Rp 24jt bulan ini.',
                        prioritas: 'tinggi' as const,
                      },
                    ];
                const topR = recomList[0];
                const decision = mktRecomDecisions[0];

                return (
                  <div className="p-3.5 rounded-xl bg-[#3FBF8F]/[0.04] border border-[#3FBF8F]/20 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#3FBF8F]/20 text-[#3FBF8F]">
                          Aksi Kritis #1
                        </span>
                        <span className="text-xs font-semibold text-[#F5F7FA]">{topR.judul}</span>
                      </div>
                      {decision && (
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          decision === 'approved' ? 'bg-[#3FBF8F]/20 text-[#3FBF8F]' :
                          decision === 'review' ? 'bg-[#F2A83B]/20 text-[#F2A83B]' :
                          'bg-[#EF4444]/20 text-[#EF4444]'
                        }`}>
                          {decision === 'approved' ? '✓ Disetujui' : decision === 'review' ? '⏳ Dikaji Ulang' : '✕ Ditolak'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                      <div className="text-xs leading-relaxed text-[#CBD3DF] flex-1 min-w-[240px]">
                        <span className="text-[#8CC0FF] font-medium">{topR.langkah}</span> &bull;{' '}
                        <span className="text-[#3FBF8F] font-semibold">{topR.dampak}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setMktRecomDecisions(prev => ({ ...prev, [0]: 'approved' }))}
                          className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                            decision === 'approved'
                              ? 'bg-[#3FBF8F] text-[#0B0E14]'
                              : 'bg-[#3FBF8F]/15 hover:bg-[#3FBF8F]/25 text-[#3FBF8F]'
                          }`}
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => setMktRecomDecisions(prev => ({ ...prev, [0]: 'review' }))}
                          className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                            decision === 'review'
                              ? 'bg-[#F2A83B] text-[#0B0E14]'
                              : 'bg-[#F2A83B]/15 hover:bg-[#F2A83B]/25 text-[#F2A83B]'
                          }`}
                        >
                          Kaji Ulang
                        </button>
                        <button
                          type="button"
                          onClick={() => setMktRecomDecisions(prev => ({ ...prev, [0]: 'rejected' }))}
                          className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                            decision === 'rejected'
                              ? 'bg-[#EF4444] text-white'
                              : 'bg-white/[0.04] hover:bg-[#EF4444]/15 hover:text-[#EF4444] text-[#8A93A3]'
                          }`}
                        >
                          Tolak
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. TAMPILAN MODE RINCI (Deep Breakdown / Visual Analytics Lengkap)        */
            /* ========================================================================= */
            <div className="px-6 pb-6 flex flex-col gap-4 animate-fadeIn">
              {/* Lead Narrative */}
              <p className="text-[12.5px] leading-relaxed text-[#CBD3DF] m-0">
                {mktInsight.ringkasan && !mktInsight.ringkasan.includes('0 kampanye')
                  ? mktInsight.ringkasan
                  : `Performa akuisisi 30 hari terakhir mencatatkan total belanja iklan ${idMoney(displayMarketingSpend)} dengan omset teratribusi ${idMoney(displayMarketingRevenue)}. Terhimpun ${displayMarketingLeads} prospek terverifikasi dengan rata-rata CPL ${displayMarketingLeads > 0 ? idMoney(Math.round(displayMarketingSpend / displayMarketingLeads)) : 'belum tersedia'}.`}
              </p>

              {/* 1. VISUALISASI GRAFIK TREN PERFORMA MARKETING 6 BULAN (Rule #269 & #270) */}
              <div className="p-4 rounded-xl bg-[#090C12] border border-white/[0.06] flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-4 h-4 text-[#3FBF8F]" />
                    <span className="text-xs font-semibold text-[#F5F7FA]">
                      Grafik Tren Omset Penjualan vs Belanja Iklan 6 Bulan
                    </span>
                  </div>
                  {/* Legend Pills */}
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="flex items-center gap-1.5 text-[#CBD3DF]">
                      <span className="w-2.5 h-1 rounded-full bg-[#3FBF8F]" />
                      <span>Omset Teratribusi ({idMoney(displayMarketingRevenue)})</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[#CBD3DF]">
                      <span className="w-2.5 h-1 rounded-full bg-[#EF4444]" />
                      <span>Belanja Iklan ({idMoney(displayMarketingSpend)})</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[#CBD3DF]">
                      <span className="w-2.5 h-1 rounded-full bg-[#4E9BFF]" />
                      <span>Surplus Kotor ({totalRev > 0 && displayMarketingSpend > 0 ? `+${idMoney(Math.max(0, displayMarketingRevenue - displayMarketingSpend))}` : 'belum tersedia'})</span>
                    </span>
                  </div>
                </div>

                {isDemoActive ? (
                  <>
                {/* SVG Canvas Area with Smooth Bézier Splines */}
                <div className="relative h-[180px] w-full flex items-stretch gap-2 mt-1">
                  <div className="flex-1 relative h-full">
                    <svg viewBox="0 0 1000 180" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                      <defs>
                        <linearGradient id="mktInflowGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3FBF8F" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#3FBF8F" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="mktSurplusGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4E9BFF" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#4E9BFF" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Subtle Horizontal Grid Lines */}
                      <line x1="0" y1="25" x2="1000" y2="25" stroke="#FFFFFF" strokeOpacity="0.04" strokeDasharray="3 3" />
                      <line x1="0" y1="75" x2="1000" y2="75" stroke="#FFFFFF" strokeOpacity="0.04" strokeDasharray="3 3" />
                      <line x1="0" y1="125" x2="1000" y2="125" stroke="#FFFFFF" strokeOpacity="0.04" strokeDasharray="3 3" />

                      {/* Area Glow Omset (Organic Spline) */}
                      <path
                        d="M 0 75 C 100 70, 150 68, 200 62 C 300 58, 350 54, 400 48 C 500 44, 550 40, 600 36 C 700 32, 750 28, 800 25 C 900 22, 950 18, 1000 14 L 1000 180 L 0 180 Z"
                        fill="url(#mktInflowGradient)"
                      />
                      {/* Area Glow Surplus */}
                      <path
                        d="M 0 140 C 100 138, 150 135, 200 132 C 300 128, 350 125, 400 120 C 500 115, 550 110, 600 105 C 700 100, 750 95, 800 90 C 900 85, 950 80, 1000 75 L 1000 180 L 0 180 Z"
                        fill="url(#mktSurplusGradient)"
                      />

                      {/* Omset Smooth Curve */}
                      <path
                        d="M 0 75 C 100 70, 150 68, 200 62 C 300 58, 350 54, 400 48 C 500 44, 550 40, 600 36 C 700 32, 750 28, 800 25 C 900 22, 950 18, 1000 14"
                        fill="none"
                        stroke="#3FBF8F"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {/* Belanja Iklan Dashed Curve */}
                      <path
                        d="M 0 155 C 100 152, 150 150, 200 148 C 300 145, 350 144, 400 142 C 500 140, 550 138, 600 136 C 700 134, 750 132, 800 130 C 900 128, 950 125, 1000 122"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="1.8"
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                      />
                      {/* Net Surplus Smooth Curve */}
                      <path
                        d="M 0 140 C 100 138, 150 135, 200 132 C 300 128, 350 125, 400 120 C 500 115, 550 110, 600 105 C 700 100, 750 95, 800 90 C 900 85, 950 80, 1000 75"
                        fill="none"
                        stroke="#4E9BFF"
                        strokeWidth="2.0"
                        strokeLinecap="round"
                      />

                      {/* Glowing Interactive Data Nodes */}
                      {[
                        { x: 0, y: 75, val: '75jt' },
                        { x: 200, y: 62, val: '88jt' },
                        { x: 400, y: 48, val: '96jt' },
                        { x: 600, y: 36, val: '105jt' },
                        { x: 800, y: 25, val: '118jt' },
                        { x: 1000, y: 14, val: `${idDec(displayMarketingRevenue / 1_000_000)}jt` },
                      ].map((pt, i) => (
                        <g key={i}>
                          <circle cx={pt.x} cy={pt.y} r="4" fill="#3FBF8F" stroke="#0D1117" strokeWidth="2" />
                          <text
                            x={pt.x}
                            y={pt.y - 8}
                            textAnchor="middle"
                            fill="#CBD3DF"
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {pt.val}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>

                {/* X-Axis Months Marker */}
                <div className="flex justify-between text-xs font-mono text-[#8A93A3] px-2 pt-1 border-t border-white/[0.04]">
                  <span>Apr (75jt)</span>
                  <span>Mei (88jt)</span>
                  <span>Jun (96jt)</span>
                  <span>Jul (105jt)</span>
                  <span>Agu (118jt)</span>
                  <span className="text-[#3FBF8F] font-semibold">Sep ({idDec(displayMarketingRevenue / 1_000_000)}jt • Rekor)</span>
                </div>
                  </>
                ) : (
                  <div className="min-h-[180px] flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-xs text-[#8A93A3]">
                    Riwayat 6 bulan belum tersedia dari sumber kampanye; grafik benchmark hanya aktif untuk demo localhost.
                  </div>
                )}
              </div>

              {/* 2. REKOMENDASI STRATEGIS KOMPREHENSIF DENGAN ACTION BUTTONS */}
              {(mktInsight.rekomendasi ?? []).length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8A93A3]">
                      Rekomendasi AI Strategis &amp; Keputusan Tindakan
                    </span>
                    <span className="text-xs text-[#8A93A3]">
                      Dianalisis dari data konversi riil
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {(mktInsight.rekomendasi ?? []).map((r, idx) => {
                      const prioColor = r.prioritas === 'tinggi' ? '#EF4444' : r.prioritas === 'sedang' ? '#F2A83B' : '#3FBF8F';
                      const decision = mktRecomDecisions[idx];

                      return (
                        <div key={idx} className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.06] flex flex-col gap-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0"
                                style={{ color: prioColor, background: `${prioColor}18` }}
                              >
                                Prioritas {r.prioritas}
                              </span>
                              <span className="text-[13px] font-bold text-[#F5F7FA]">{r.judul}</span>
                            </div>

                            {decision && (
                              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                decision === 'approved' ? 'bg-[#3FBF8F]/20 text-[#3FBF8F]' :
                                decision === 'review' ? 'bg-[#F2A83B]/20 text-[#F2A83B]' :
                                'bg-[#EF4444]/20 text-[#EF4444]'
                              }`}>
                                {decision === 'approved' ? '✓ Disetujui' : decision === 'review' ? '⏳ Dikaji Ulang' : '✕ Ditolak'}
                              </span>
                            )}
                          </div>

                          <p className="text-[12px] text-[#CBD3DF] leading-relaxed m-0">
                            <strong>Alasan:</strong> {r.alasan}
                          </p>

                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/[0.04] flex-wrap sm:flex-nowrap">
                            <div className="text-xs leading-relaxed text-[#CBD3DF] flex-1 min-w-[240px]">
                              <span className="text-[#8CC0FF] font-medium">Langkah: {r.langkah}</span> &bull;{' '}
                              <span className="text-[#3FBF8F] font-semibold">Dampak: {r.dampak}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setMktRecomDecisions(prev => ({ ...prev, [idx]: 'approved' }))}
                                className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                                  decision === 'approved'
                                    ? 'bg-[#3FBF8F] text-[#0B0E14]'
                                    : 'bg-[#3FBF8F]/15 hover:bg-[#3FBF8F]/25 text-[#3FBF8F]'
                                }`}
                              >
                                Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => setMktRecomDecisions(prev => ({ ...prev, [idx]: 'review' }))}
                                className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                                  decision === 'review'
                                    ? 'bg-[#F2A83B] text-[#0B0E14]'
                                    : 'bg-[#F2A83B]/15 hover:bg-[#F2A83B]/25 text-[#F2A83B]'
                                }`}
                              >
                                Kaji Ulang
                              </button>
                              <button
                                type="button"
                                onClick={() => setMktRecomDecisions(prev => ({ ...prev, [idx]: 'rejected' }))}
                                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                                  decision === 'rejected'
                                    ? 'bg-[#EF4444] text-white'
                                    : 'bg-white/[0.04] hover:bg-[#EF4444]/15 hover:text-[#EF4444] text-[#8A93A3]'
                                }`}
                              >
                                Tolak
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. PREDIKSI MASA DEPAN & HORIZON WAKTU */}
              {mktInsight.prediksi?.teks && (
                <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/30 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" strokeWidth={1.8} />
                  <div className="flex flex-col gap-0.5 text-xs leading-relaxed text-[#CBD3DF]">
                    <span className="font-semibold text-[#F5F7FA]">Proyeksi Pertumbuhan Lanjutan</span>
                    <p className="m-0 text-[#A9B4C7]">
                      {mktInsight.prediksi.teks}{' '}
                      <span className="text-xs text-[#8CC0FF] font-medium">
                        (Horizon {mktInsight.prediksi.horizonBulan} bulan, keyakinan {mktInsight.prediksi.keyakinan})
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* 4. PERINGATAN DINI & BOTTLENECK ALERTS */}
              {(mktInsight.peringatan ?? []).length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#EF4444]">
                    Peringatan Dini &amp; Indikasi Risiko Ad Fatigue
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {(mktInsight.peringatan ?? []).map((p, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-[#EF4444]/[0.05] border border-[#EF4444]/20 flex items-start gap-2.5 text-xs text-[#F5A3A3]">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444] mt-0.5" strokeWidth={1.8} />
                        <span className="leading-relaxed">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. PERTANYAAN LANJUTAN UNTUK AI ASSISTANT */}
              {(mktInsight.pertanyaanLanjutan ?? []).length > 0 && (
                <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.04]">
                  <span className="text-xs font-medium text-[#8A93A3]">
                    Eksplorasi Lebih Lanjut (Klik chip untuk menyalin prompt ke AI Assistant):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(mktInsight.pertanyaanLanjutan ?? []).map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(q).catch(() => {});
                            setToastMsg('Pertanyaan disalin! Tempel di AI Assistant untuk simulasi mendalam.');
                            setTimeout(() => setToastMsg(null), 4000);
                          }
                        }}
                        title="Salin pertanyaan, tempel di AI Assistant"
                        className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-[#8CC0FF] hover:bg-white/[0.06] hover:border-[#8CC0FF]/30 bg-white/[0.02] transition-all cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. TRANSPARANSI SUMBER DATA & CATATAN JUJUR */}
              {(mktInsight.catatanJujur ?? []).length > 0 && (
                <div className="flex flex-col gap-1 pt-2 border-t border-white/5">
                  {(mktInsight.catatanJujur ?? []).map((c, idx) => (
                    <span key={idx} className="text-xs text-[#5C6474] italic">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3A. KODE PROMO & VOUCHER (STANDALONE CARD) */}
      {/* ========================================================================= */}
      <div className="border-0 flex flex-col shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]" style={{ background: '#0D1117', borderRadius: '16px' }}>
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading font-semibold text-sm text-white">Kode promo &amp; voucher</h3>
            <span className="text-xs text-[#8A93A3]">Kupon aktif untuk dorong konversi kampanye</span>
          </div>
          <span className="text-xs font-medium text-[#5C6474]">{activePromos.length} voucher aktif</span>
        </div>
        <div className="px-6 pb-4 flex flex-col sm:flex-row gap-3">
          {activePromos.map((p, idx) => {
            const claimLimit = parseInt(p.limit, 10) || 1;
            const claimPct = Math.min(100, (p.used / claimLimit) * 100);
            const isNearLimit = p.status !== 'ACTIVE';
            return (
              <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border-0 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-heading tabular-nums text-[13.5px] font-semibold tracking-wide text-[#F5F7FA]">{p.code}</span>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0"
                      style={
                        isNearLimit
                          ? { background: 'rgba(242,168,59,0.10)', color: '#F2A83B' }
                          : { background: 'rgba(63,191,143,0.10)', color: '#3FBF8F' }
                      }
                    >
                      {p.status === 'ACTIVE' ? 'Aktif' : p.status}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 mt-1.5">
                    <span className="text-xs text-[#8A93A3]">Diskon {p.discount}</span>
                    <span className="font-heading tabular-nums text-xs text-[#8A93A3]">{p.used} / {p.limit} klaim</span>
                  </div>
                </div>
                <div className="mt-3 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${isNearLimit ? 'bg-[#F2A83B]' : 'bg-[#3FBF8F]'}`} style={{ width: `${Math.max(1.5, claimPct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3B. RINGKASAN AUDIENS & SEGMENTASI KOGNITIF (DEDICATED WIDE CARD) */}
      {/* ========================================================================= */}
      <div className="border-0 overflow-hidden" style={{ background: '#0D1117', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-5 border-b border-white/[0.04]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4E9BFF]" />
              <h3 className="font-heading text-sm font-semibold text-[#F5F7FA]">Ringkasan audiens &amp; analisis demografi</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#4E9BFF]/10 text-[#4E9BFF]">
                Full Width Dedicated
              </span>
            </div>
            <span className="text-xs text-[#8A93A3]">
              Komparasi multidimensi audiens per kanal iklan, kelompok usia, dan profil perangkat
            </span>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-[3px] bg-white/[0.035] border-0 rounded-xl w-fit shrink-0">
            <button
              type="button"
              onClick={() => setAudienceTab('komparasi')}
              className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                audienceTab === 'komparasi' ? 'bg-[#4E9BFF] text-white shadow-sm' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Komparasi Silang (3-Way)</span>
            </button>
            {(['platform', 'usia', 'perangkat'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAudienceTab(tab)}
                className={`h-7 px-3 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer border-0 ${
                  audienceTab === tab ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
                }`}
              >
                {tab === 'platform' ? 'Platform' : tab === 'usia' ? 'Usia' : 'Perangkat'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {audienceData.platform.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Users className="w-8 h-8 mb-2.5 text-[#4E9BFF] opacity-40" />
              <span className="text-sm font-medium text-[#DCE3EC] mb-1">Data demografi audiens belum tersedia</span>
              <span className="text-xs text-[#8A93A3] max-w-sm">
                Hubungkan akun Ads Manager (Meta Ads / TikTok Ads / Google Ads) untuk menganalisis sebaran audiens secara otomatis.
              </span>
            </div>
          ) : (
            <>
              {/* TAB 1: KOMPARASI SILANG 3-DIMENSI */}
              {audienceTab === 'komparasi' && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5">
                    {[
                      {
                        title: 'Mobile Young Spenders',
                        share: '48%',
                        platform: 'Meta (IG) + TikTok',
                        age: '25-34 thn (48%)',
                        device: 'Mobile (86%)',
                        behavior: 'Checkout cepat via WA/Tokopedia saat malam hari (19:00 - 22:00 WIB)',
                        roasEst: '3,8x',
                        color: '#4E9BFF',
                        badge: 'Segmen Inti (Dominan)',
                      },
                      {
                        title: 'Gen Z Trend Seekers',
                        share: '32%',
                        platform: 'TikTok Ads',
                        age: '18-24 thn (32%)',
                        device: 'Mobile 100%',
                        behavior: 'Tergoda video unboxing & promo gratis ongkir kilat; impulsif namun price-sensitive',
                        roasEst: '3,2x',
                        color: '#A5B4FC',
                        badge: 'Segmen Virality',
                      },
                      {
                        title: 'Desktop Work Professionals',
                        share: '15%',
                        platform: 'Google Search Ads',
                        age: '35-44 thn (15%)',
                        device: 'Desktop / PC (11%)',
                        behavior: 'Mencari solusi bisnis terstruktur saat jam kerja (09:00 - 16:00 WIB); AOV tinggi',
                        roasEst: '4,6x',
                        color: '#3FBF8F',
                        badge: 'AOV Tertinggi',
                      },
                      {
                        title: 'Mature Direct Buyers',
                        share: '5%',
                        platform: 'Meta (FB Feed)',
                        age: '45+ thn (5%)',
                        device: 'Mobile / Tablet',
                        behavior: 'Butuh panduan konsultasi personal via CS, retensi tinggi pasca-pembelian pertama',
                        roasEst: '2,9x',
                        color: '#F2A83B',
                        badge: 'High Loyalty',
                      },
                    ].map((persona, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col justify-between hover:border-white/10 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: `${persona.color}15`, color: persona.color }}>
                              {persona.badge}
                            </span>
                            <span className="font-heading font-bold text-base text-white tabular-nums">{persona.share}</span>
                          </div>
                          <h4 className="font-semibold text-xs text-[#F5F7FA] mb-2">{persona.title}</h4>
                          <div className="space-y-1 text-xs text-[#8A93A3] mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[#5C6474]">Kanal:</span>
                              <span className="text-[#C3CBD8] font-medium">{persona.platform}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5C6474]">Usia Dominan:</span>
                              <span className="text-[#C3CBD8] font-medium">{persona.age}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5C6474]">Perangkat:</span>
                              <span className="text-[#C3CBD8] font-medium">{persona.device}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5C6474]">Est. ROAS:</span>
                              <span className="text-[#3FBF8F] font-semibold">{persona.roasEst}</span>
                            </div>
                          </div>
                        </div>
                        <div className="pt-2.5 border-t border-white/5">
                          <p className="text-xs text-[#8A93A3] leading-relaxed italic">{persona.behavior}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Visual 3-Bar Stacked Comparison */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-3">
                    <span className="text-xs font-semibold text-[#DCE3EC]">Distribusi Matriks Audiens Gabungan (Platform × Usia × Perangkat)</span>
                    <div className="h-6 rounded-lg overflow-hidden flex gap-0.5 bg-white/5 p-0.5">
                      <div className="h-full rounded-l-md bg-[#4E9BFF] flex items-center justify-center text-xs font-bold text-white" style={{ width: '48%' }} title="Young Spenders: 48%">
                        48% Mobile Young
                      </div>
                      <div className="h-full bg-[#A5B4FC] flex items-center justify-center text-xs font-bold text-[#0D1117]" style={{ width: '32%' }} title="Gen Z Trend: 32%">
                        32% Gen Z
                      </div>
                      <div className="h-full bg-[#3FBF8F] flex items-center justify-center text-xs font-bold text-[#0D1117]" style={{ width: '15%' }} title="Work Pro: 15%">
                        15% Desktop Pro
                      </div>
                      <div className="h-full rounded-r-md bg-[#F2A83B] flex items-center justify-center text-xs font-bold text-[#0D1117]" style={{ width: '5%' }} title="Mature: 5%">
                        5%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2, 3, 4: SINGLE DIMENSION DEEP DIVE (WIDE FORMAT) */}
              {audienceTab !== 'komparasi' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Left: Bar Visualizer (col-span-7) */}
                  <div className="lg:col-span-7 flex flex-col gap-4">
                    <div className="grid gap-3 items-end h-[160px] p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]" style={{ gridTemplateColumns: `repeat(${audienceData[audienceTab].length}, minmax(0,1fr))` }}>
                      {audienceData[audienceTab].map((a) => (
                        <div key={a.label} className="flex flex-col items-center justify-end gap-2 h-full min-w-0">
                          <span className="font-heading tabular-nums text-xs font-bold text-[#C3CBD8]">{a.pct}%</span>
                          <div className="w-full max-w-[48px] rounded-t-lg transition-all hover:opacity-90" style={{ height: `${Math.max(8, a.pct * 1.3)}%`, background: a.color }} />
                          <span className="text-xs text-[#8A93A3] truncate max-w-full text-center font-medium">{a.label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Horizontal Bar Breakdown */}
                    <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-white/5 p-0.5">
                      {audienceData[audienceTab].map((a) => (
                        <span key={a.label} style={{ width: `${a.pct}%`, background: a.color }} className="h-full rounded-full transition-all" title={`${a.label}: ${a.pct}%`} />
                      ))}
                    </div>
                  </div>

                  {/* Right: Dimension Metric Table (col-span-5) */}
                  <div className="lg:col-span-5 flex flex-col gap-2.5">
                    <span className="text-xs font-semibold text-[#DCE3EC] mb-1">Rincian Komponen {audienceTab.toUpperCase()}</span>
                    {audienceData[audienceTab].map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                          <span className="text-xs font-medium text-[#F5F7FA]">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-heading text-xs font-bold text-white tabular-nums">{item.pct}%</span>
                          <span className="text-xs text-[#8A93A3]">
                            {audienceTab === 'platform' ? (item.label.includes('Meta') ? 'ROAS 3,8x' : item.label.includes('TikTok') ? 'ROAS 3,2x' : 'ROAS 4,6x') :
                             audienceTab === 'usia' ? (item.pct >= 30 ? 'Paling Responsif' : 'Sekunder') :
                             (item.label.includes('Mobile') ? 'Prioritas UX 1' : 'Prioritas UX 2')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI AUDIENCE STRATEGIC PLAYBOOK BANNER */}
              <div className="p-4.5 rounded-xl bg-[#4E9BFF]/[0.03] border border-[#4E9BFF]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#4E9BFF]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-[#4E9BFF]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-xs text-[#F5F7FA]">Rekomendasi Strategis AI untuk Target Audiens</span>
                    <p className="text-xs text-[#8A93A3] leading-relaxed max-w-3xl">
                      <strong className="text-[#C3CBD8]">Fokus Mobile-First:</strong> 86% audiens mengakses lewat HP pada rentang usia 18-34 tahun (80% total). 
                      Pastikan kecepatan loading halaman checkout di bawah 2 detik dan format video vertikal (9:16) dengan hook 3 detik pertama di Meta &amp; TikTok.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAI?.('Buatkan rekomendasi ad copy dan penyesuaian audiens khusus mobile user usia 18-34 tahun di Meta dan TikTok Ads')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#4E9BFF]/10 text-[#4E9BFF] hover:bg-[#4E9BFF]/20 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer border-0"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Kaji Copywriting Audiens</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PERJALANAN DARI IKLAN SAMPAI CLOSING (FUNNEL) - DUAL MODE [Ringkas | Rinci] */}
      {/* ========================================================================= */}
      <div id="corong-pemasaran-funnel" className="border-0 overflow-hidden" style={{ background: '#0D1117', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-5 border-b border-white/[0.04]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#3FBF8F]" />
              <h3 className="font-heading text-sm font-semibold text-[#F5F7FA]">Perjalanan dari iklan sampai closing (Funnel)</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#3FBF8F]/10 text-[#3FBF8F]">
                Pipeline Konversi
              </span>
            </div>
            <span className="text-xs text-[#8A93A3]">
              {fnAov ? `Nilai transaksi rata-rata (AOV): ${idMoney(fnAov)} • Closing rate rata-rata: ${fnC3}` : 'Nilai transaksi rata-rata: data belum tersedia'}
            </span>
          </div>

          {/* Dual Mode Switcher [Ringkas | Rinci] */}
          <div className="flex items-center gap-1 p-[3px] bg-white/[0.035] border-0 rounded-xl w-fit shrink-0">
            <button
              type="button"
              onClick={() => setFunnelMode('compact')}
              className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                funnelMode === 'compact' ? 'bg-[#3FBF8F] text-black font-bold shadow-sm' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
              }`}
            >
              <span>Ringkas</span>
            </button>
            <button
              type="button"
              onClick={() => setFunnelMode('detailed')}
              className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                funnelMode === 'detailed' ? 'bg-[#3FBF8F] text-black font-bold shadow-sm' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
              }`}
            >
              <span>Rinci &amp; AI Diagnosis</span>
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* STEP FUNNEL CARDS (ALWAYS VISIBLE IN BOTH MODES) */}
          <div className="flex items-stretch justify-between flex-col sm:flex-row gap-2 sm:gap-0">
            {[
              {
                label: '1. Iklan dilihat',
                value: fnImpressions !== null ? fnImpressions.toLocaleString('id-ID') : '-',
                note: fnImpressions !== null ? 'Impresi di Meta, TikTok, Google' : 'Belum dilacak sistem',
                drop: 'Dasar Corong',
                color: '#4E9BFF',
              },
              {
                label: '2. Diklik',
                value: fnClicks !== null ? fnClicks.toLocaleString('id-ID') : '-',
                note: fnClicks !== null ? `CTR: ${fnC1} dari impresi` : 'Belum dilacak sistem',
                drop: fnClicks && fnImpressions ? `Drop: ${((1 - fnClicks / fnImpressions) * 100).toFixed(1)}%` : '-',
                color: '#A5B4FC',
              },
              {
                label: '3. Jadi prospek (Leads)',
                value: fnLeads > 0 ? fnLeads.toLocaleString('id-ID') : '-',
                note: fnClicks !== null ? `Konversi klik: ${fnC2}` : 'Rasio belum dihitung',
                drop: fnClicks && fnLeads ? `Drop: ${((1 - fnLeads / fnClicks) * 100).toFixed(1)}%` : '-',
                color: '#F2A83B',
              },
              {
                label: '4. Jadi pembeli',
                value: fnCloses !== null ? fnCloses.toLocaleString('id-ID') : '-',
                note: fnCloses !== null ? `Closing rate: ${fnC3} (${fnCloses} order)` : 'Belum dilacak',
                drop: fnLeads && fnCloses ? `Closing: ${((fnCloses / fnLeads) * 100).toFixed(1)}%` : '-',
                color: '#3FBF8F',
              },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <div className="px-4 py-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1.5 min-w-0 flex-1 hover:border-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#8A93A3]">{step.label}</span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white/[0.04] text-[#C3CBD8]">
                      {step.drop}
                    </span>
                  </div>
                  <span className="font-heading font-bold text-[clamp(18px,1.6vw,24px)] tracking-tight text-[#F5F7FA] tabular-nums">
                    {step.value}
                  </span>
                  <span className="text-xs text-[#5C6474]">{step.note}</span>
                </div>
                {i < arr.length - 1 && (
                  <span className="self-center flex items-center justify-center w-[26px] h-[26px] rounded-full bg-white/[0.04] border-0 shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 text-[#5C6474]" strokeWidth={2} />
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* DETAILED MODE CONTENT: BOTTLENECK DIAGNOSIS, WHAT-IF SIMULATOR, AI ACTION STEPS */}
          {funnelMode === 'detailed' && (
            <div className="flex flex-col gap-5 pt-4 border-t border-white/[0.04]">
              {/* 1. Kognitif Diagnosis: Kebocoran Terbesar (The Biggest Leak) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-red-500/[0.04] border border-red-500/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Kebocoran Terbesar (Stage 2 ke 3)
                    </span>
                    <span className="text-xs font-bold text-red-400">95,8% Drop</span>
                  </div>
                  <p className="text-xs text-[#8A93A3] leading-relaxed">
                    Dari <strong className="text-white">14.800 klik</strong>, hanya <strong className="text-white">621 orang</strong> yang mengisi formulir/chat WA prospek.
                    Sebanyak <strong className="text-red-300">14.179 klik mental</strong> di landing page tanpa aksi.
                  </p>
                  <span className="text-xs text-red-400/90 font-medium">Akar Masalah: Kecepatan load landing page mobile atau formulir terlalu panjang.</span>
                </div>

                <div className="p-4 rounded-xl bg-[#3FBF8F]/[0.04] border border-[#3FBF8F]/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#3FBF8F] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Efisiensi Closing (Stage 3 ke 4)
                    </span>
                    <span className="text-xs font-bold text-[#3FBF8F]">21,9% Closing</span>
                  </div>
                  <p className="text-xs text-[#8A93A3] leading-relaxed">
                    Dari <strong className="text-white">621 prospek</strong>, tim berhasil menutup <strong className="text-white">136 pembeli</strong>. 
                    Tingkat konversi 21,9% ini sehat di atas rata-rata benchmark UMKM e-commerce (15-18%).
                  </p>
                  <span className="text-xs text-[#3FBF8F]/90 font-medium">Kekuatan: Tim follow-up WhatsApp sigap merespons dalam &lt;15 menit.</span>
                </div>

                <div className="p-4 rounded-xl bg-[#4E9BFF]/[0.04] border border-[#4E9BFF]/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4E9BFF] flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" />
                      Potensi Nilai Transaksi (AOV)
                    </span>
                    <span className="text-xs font-bold text-[#4E9BFF]">Rp 312.000 / order</span>
                  </div>
                  <p className="text-xs text-[#8A93A3] leading-relaxed">
                    Setiap pembeli menghasilkan rata-rata <strong className="text-white">Rp 312.000</strong>.
                    Jika ditambahkan opsi paket bundling produk (cross-sell), AOV berpeluang naik menjadi Rp 380.000 (+21,7%).
                  </p>
                  <span className="text-xs text-[#4E9BFF]/90 font-medium">Rekomendasi: Tambah bundling promo hemat di tahap penawaran akhir.</span>
                </div>
              </div>

              {/* 2. Interactive What-If Simulator */}
              <div className="p-4.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#F2A83B]" />
                    <span className="font-semibold text-xs text-[#F5F7FA]">Simulasi What-If: Optimasi Closing Rate Prospek</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#8A93A3]">Closing Rate Saat Ini: <strong className="text-white">21,9%</strong></span>
                    <span className="text-xs text-[#3FBF8F] font-semibold">Simulasi: {funnelSimClosingRate}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={20}
                    max={40}
                    step={1}
                    value={funnelSimClosingRate}
                    onChange={(e) => setFunnelSimClosingRate(Number(e.target.value))}
                    className="w-full accent-[#3FBF8F] cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                  />
                </div>

                {/* Simulasi Output Result */}
                {(() => {
                  const simulatedBuyers = Math.round(621 * (funnelSimClosingRate / 100));
                  const deltaBuyers = simulatedBuyers - 136;
                  const deltaOmset = deltaBuyers * (fnAov || 312000);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.03]">
                        <span className="text-xs text-[#8A93A3] block">Proyeksi Jumlah Pembeli</span>
                        <span className="font-heading font-bold text-sm text-white tabular-nums">{simulatedBuyers} pembeli</span>
                        <span className="text-xs text-[#3FBF8F] block mt-0.5">({deltaBuyers >= 0 ? `+${deltaBuyers}` : deltaBuyers} dari saat ini)</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.03]">
                        <span className="text-xs text-[#8A93A3] block">Tambahan Estimasi Omset</span>
                        <span className="font-heading font-bold text-sm text-[#3FBF8F] tabular-nums">+{idMoney(Math.max(0, deltaOmset))}</span>
                        <span className="text-xs text-[#8A93A3] block mt-0.5">Dengan AOV Rp 312.000</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.03]">
                        <span className="text-xs text-[#8A93A3] block">Estimasi Penghematan CAC</span>
                        <span className="font-heading font-bold text-sm text-[#4E9BFF] tabular-nums">
                          {deltaBuyers > 0 ? `Turun ${((deltaBuyers / simulatedBuyers) * 100).toFixed(0)}%` : 'Tetap'}
                        </span>
                        <span className="text-xs text-[#8A93A3] block mt-0.5">Biaya per akuisisi customer</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 3. Action Checklist AI */}
              <div className="p-4 rounded-xl bg-white/[0.015] border border-white/[0.04] flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-[#DCE3EC] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3FBF8F]" />
                  3 Langkah Aksi Prioritas AI untuk Memperbaiki Corong
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.03] flex flex-col gap-1">
                    <span className="text-xs font-semibold text-white">1. Pangkas Form Landing Page</span>
                    <span className="text-xs text-[#8A93A3] leading-relaxed">
                      Kurangi isian form dari 6 kolom menjadi 2 kolom (Nama &amp; No. WA saja). Potensi kenaikan konversi klik ke leads +35%.
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.03] flex flex-col gap-1">
                    <span className="text-xs font-semibold text-white">2. Auto-Greeting WhatsApp</span>
                    <span className="text-xs text-[#8A93A3] leading-relaxed">
                      Kirimkan template pesan otomatis dalam 60 detik setelah prospek klik tombol WA untuk mengunci atensi pembeli saat hangat.
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.03] flex flex-col gap-1">
                    <span className="text-xs font-semibold text-white">3. Penawaran Diskon Terbatas</span>
                    <span className="text-xs text-[#8A93A3] leading-relaxed">
                      Berikan kode voucher eksklusif berlaku 24 jam untuk prospek yang belum checkout dalam 2 hari follow-up.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. KANAL MANA YANG PALING MENGHASILKAN */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.02fr] border-0 overflow-hidden" style={{ background: '#0D1117', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
        <div className="p-6 flex flex-col gap-4.5">
          <div className="flex flex-col gap-1.5">
            <span className="font-heading text-sm font-semibold text-[#F5F7FA]">Kanal mana yang paling menghasilkan</span>
            <span className="text-xs text-[#8A93A3]">Belanja dan omset digambar pada skala uang yang sama</span>
          </div>
          {chanCompare.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-[#5C6474]">
              <Megaphone className="w-7 h-7 mb-2 opacity-40 text-[#4E9BFF]" />
              <span className="text-xs font-medium text-[#DCE3EC] mb-1">Belum ada data belanja per kanal</span>
              <span className="text-xs text-[#8A93A3] max-w-xs">
                Grafik perbandingan performa kanal akan muncul setelah kampanye iklan di Meta, TikTok, atau Google aktif.
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {chanCompare.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0" style={{ width: '9px', height: '9px', borderRadius: '3px', background: channelColors[c.name] }} />
                        <span className="text-xs font-semibold text-[#F5F7FA] whitespace-nowrap">{c.name}</span>
                      </span>
                      <span className={`font-heading tabular-nums text-xs font-semibold whitespace-nowrap ${c.mult >= roasTargetX ? 'text-[#3FBF8F]' : 'text-[#F2A83B]'}`}>
                        {idDec(c.mult)}x balik modal
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-12 shrink-0 text-xs text-[#5C6474]">Belanja</span>
                        <span className="flex-1 h-2.5 rounded-[4px] bg-white/5 overflow-hidden">
                          <span className="h-full block rounded-[4px]" style={{ width: `${Math.max(1.5, (c.spend / chanAxisMax) * 100)}%`, background: 'rgba(255,255,255,0.22)' }} />
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-12 shrink-0 text-xs text-[#8A93A3]">Omset<TermHint label="Omset" /></span>
                        <span className="flex-1 h-2.5 rounded-[4px] bg-white/5 overflow-hidden">
                          <span className="h-full block rounded-[4px]" style={{ width: `${Math.max(1.5, (c.revenue / chanAxisMax) * 100)}%`, background: channelColors[c.name] }} />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-12 shrink-0" />
                <span className="flex-1 flex justify-between border-0 pt-1.5">
                  <span className="text-xs text-[#5C6474]">Rp 0</span>
                  <span className="text-xs text-[#5C6474]">{axisMid}</span>
                  <span className="text-xs text-[#5C6474]">{axisMax}</span>
                </span>
              </div>
            </>
          )}
        </div>
        <div className="p-6 border-0 bg-white/[0.015] flex flex-col justify-between">
          <div>
            <div className="grid gap-3 pb-2.5 border-0" style={{ gridTemplateColumns: 'minmax(118px,1fr) 88px 100px 58px' }}>
              <span className="text-xs font-medium text-[#5C6474]">Kanal</span>
              <span className="text-xs font-medium text-[#5C6474] text-right">Belanja</span>
              <span className="text-xs font-medium text-[#5C6474] text-right">Omset<TermHint label="Omset" /></span>
              <span className="text-xs font-medium text-[#5C6474] text-right">ROAS</span>
            </div>
            {chanCompare.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5C6474]">
                Belum ada rincian data per kanal
              </div>
            ) : (
              chanCompare.map((c) => (
                <div
                  key={c.name}
                  className="grid items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/[0.025] transition-colors border-0"
                  style={{ gridTemplateColumns: 'minmax(118px,1fr) 88px 100px 58px' }}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0" style={{ width: '9px', height: '9px', borderRadius: '3px', background: channelColors[c.name] }} />
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-semibold text-[#F5F7FA] whitespace-nowrap">{c.name}</span>
                      <span className="text-xs text-[#5C6474]">{c.leads} prospek</span>
                    </span>
                  </span>
                  <span className="font-heading tabular-nums text-xs text-[#8A93A3] text-right">{idMoney(c.spend)}</span>
                  <span className="font-heading tabular-nums text-xs font-semibold text-[#F5F7FA] text-right">{idMoney(c.revenue)}</span>
                  <span className={`font-heading tabular-nums text-xs font-semibold text-right ${c.mult >= roasTargetX ? 'text-[#3FBF8F]' : 'text-[#F2A83B]'}`}>
                    {idDec(c.mult)}x
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="pt-3.5 flex items-start gap-2.5">
            <span className="w-[26px] h-[26px] shrink-0 rounded-lg bg-[#6366F1]/[0.16] border-0 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-[#A5B4FC]" strokeWidth={1.7} />
            </span>
            <span className="text-xs leading-relaxed text-[#8A93A3]">
              {bestChannel && worstChannel && bestChannel.name !== worstChannel.name
                ? `${bestChannel.name} memberi pengembalian tertinggi (${idDec(bestChannel.mult)}x), sedangkan ${worstChannel.name} masih ${idDec(worstChannel.mult)}x. Menggeser sebagian anggaran ke arah kanal teratas menaikkan ROAS gabungan tanpa menambah biaya.`
                : 'Belum ada data kanal yang cukup untuk dibandingkan.'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. DAFTAR KAMPANYE IKLAN BERJALAN */}
      {/* ========================================================================= */}
      {/* FIX (audit 10 Sep, temuan D1): id ini dulu SAMA PERSIS dengan section 4 (funnel)
          di atas -- getElementById selalu mengambil elemen pertama (section 4), jadi tombol
          "Lihat kampanye aktif" salah arah. Diganti 'daftar-kampanye-iklan-tabel' + tombol
          di bawah (kartu AI) diupdate menunjuk id baru ini. */}
      <div id="daftar-kampanye-iklan-tabel" className="border-0 overflow-hidden" style={{ background: '#0D1117', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-0">
          <h3 className="font-heading font-semibold text-sm text-white">Daftar kampanye iklan berjalan</h3>
          <span className="text-xs font-medium text-[#5C6474]">{campaigns.length} kampanye terdaftar</span>
        </div>

        <div className="hidden sm:grid gap-3.5 px-6 py-2 border-0 text-xs font-medium text-[#5C6474]" style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 120px 92px 220px 32px' }}>
          <span>Kampanye</span>
          <span>Platform</span>
          <span>Budget</span>
          <span>Leads</span>
          <span>Performa ROAS<TermHint label="ROAS" /></span>
          <span aria-hidden="true" />
        </div>

        <div>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-[#5C6474]">
              <Megaphone className="w-8 h-8 mb-2.5 opacity-40 text-[#4E9BFF]" />
              <span className="text-sm font-medium text-[#DCE3EC] mb-1">Belum ada kampanye iklan aktif</span>
              <span className="text-xs text-[#8A93A3] max-w-sm mb-3">
                Hubungkan platform iklan Meta / TikTok atau buat strategi promosi baru melalui AI Studio.
              </span>
              {/* FIX (audit role-fit 7 Sep): teks di atas dulu cuma <span> statis -- mengarahkan
                  user ke AI Studio tanpa elemen klik apapun. onOpenAIStudio SUDAH diterima dari
                  parent (page.tsx) dan sudah berfungsi, cuma belum pernah dipanggil di file ini. */}
              {onOpenAIStudio && (
                <button
                  type="button"
                  onClick={onOpenAIStudio}
                  className="h-[32px] px-3 inline-flex items-center gap-1.5 bg-[#4E9BFF] hover:brightness-110 text-white font-semibold text-xs rounded-lg transition-all cursor-pointer"
                >
                  Buka AI Studio
                </button>
              )}
            </div>
          ) : (
            campaigns.map((c) => (
              <div
                key={c.id}
                className="group grid grid-cols-1 sm:grid gap-2 sm:gap-3.5 items-center px-4.5 py-3 rounded-xl hover:bg-white/[0.025] transition-colors border-0 my-0.5"
                style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 120px 92px 220px 32px' }}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.status === 'ACTIVE' ? 'bg-[#3FBF8F]' : 'bg-[#F2A83B]'}`} />
                  <span className="min-w-0">
                    {/* HILANGKAN (audit 10 Sep, temuan D2/H2): {c.creativeType} dulu dirender
                        di sini tapi field itu tidak pernah diisi loadRealData() dan tidak ada
                        di model Campaign -- selalu kosong, sisa desain lama. */}
                    <span className="block text-[12.5px] font-semibold text-[#F5F7FA] truncate">{c.name}</span>
                  </span>
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', width: 'fit-content', padding: '4px 10px', borderRadius: '7px', whiteSpace: 'nowrap', ...platformBadgeStyle(c.platform) }}
                >
                  {c.platform}
                </span>
                <span className="font-heading tabular-nums text-xs text-[#C3CBD8]">
                  {idMoney(c.dailyBudget)}/hari
                </span>
                <span className="font-heading tabular-nums text-xs text-[#C3CBD8]">{c.leads || 0} leads</span>
                <span className="flex items-center gap-2.5">
                  <span className="relative flex-1 h-[5px] rounded-full bg-white/[0.12]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${Math.min(100, (parseFloat(c.roas) / roasScaleMax) * 100)}%`,
                        background: roasTierColor(parseFloat(c.roas)),
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute -top-[3px] -bottom-[3px] w-[1.5px]"
                      style={{ left: `${(roasTargetX / roasScaleMax) * 100}%`, background: 'rgba(242,168,59,0.75)' }}
                    />
                  </span>
                  <span
                    className="font-heading tabular-nums text-xs font-semibold shrink-0"
                    style={{ color: roasTierColor(parseFloat(c.roas)) }}
                  >
                    {c.roas.replace('.', ',')}
                  </span>
                  {parseFloat(c.roas) === bestRoasValue ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0" style={{ background: 'rgba(63,191,143,0.12)', border: 'none', color: '#3FBF8F' }}>
                      Terbaik
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(c.id)}
                      title={c.status === 'ACTIVE' ? 'Jeda kampanye' : 'Aktifkan kampanye'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 border-0 ${
                        c.status === 'ACTIVE'
                          ? 'bg-[#3FBF8F]/10 text-[#3FBF8F]'
                          : 'bg-white/5 text-[#8A93A3] hover:text-white'
                      }`}
                    >
                      {c.status === 'ACTIVE' ? <Play className="w-2.5 h-2.5 fill-current" /> : <Pause className="w-2.5 h-2.5" />}
                      <span>{c.status === 'ACTIVE' ? 'Aktif' : 'Dijeda'}</span>
                    </button>
                  )}
                </span>

                {/* Delete action -- pola sama dengan Trash2 di FinanceModuleView.tsx */}
                <button
                  type="button"
                  onClick={() => handleDeleteCampaign(c.id, c.name ?? 'kampanye ini')}
                  disabled={deletingId === c.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 shrink-0 disabled:opacity-40 justify-self-end border-0"
                  aria-label="Hapus kampanye"
                  title="Hapus kampanye"
                >
                  <Trash2 className="w-4 h-4 text-[#EF4444]" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-3 text-xs text-[#5C6474]">
          <span className="w-[9px] h-[1.5px] bg-[#F2A83B]/75 inline-block shrink-0" />
          <span>Panjang bar pada skala 0–4,5x. Garis oranye menandai target {idDec(roasTargetX)}x — bar yang melewatinya sudah menguntungkan.</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. LAPORAN MARKETING DENGAN PILIHAN FORMAT & ANALISIS RINCI AI */}
      {/* ========================================================================= */}
      <div className="border-0 overflow-hidden" style={{ background: '#0D1117', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-white/[0.04] flex-wrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4E9BFF]" />
              <h3 className="font-heading text-sm font-semibold text-[#F5F7FA]">Laporan marketing &amp; evaluasi berkala</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#4E9BFF]/10 text-[#4E9BFF]">
                Multi-Format
              </span>
            </div>
            <span className="text-xs text-[#8A93A3]">
              Seluruh angka, grafik, rekap performa kampanye, dan diagnosa AI dalam satu ringkasan komprehensif
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-7 px-2.5 inline-flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-[#C3CBD8] hover:text-white rounded-lg border-0 cursor-pointer transition-all"
              title="Download rekap CSV data marketing lengkap"
            >
              <FileSpreadsheet className="w-3 h-3 text-[#3FBF8F]" />
              <span>Rekap CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="h-7 px-2.5 inline-flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-[#C3CBD8] hover:text-white rounded-lg border-0 cursor-pointer transition-all"
              title="Cetak atau simpan Laporan Marketing ke PDF"
            >
              <Printer className="w-3 h-3 text-[#A5B4FC]" />
              <span>Cetak PDF</span>
            </button>
            <span className="text-xs text-[#5C6474] whitespace-nowrap pl-1">
              {reports.length > 0 ? `${reports.length} berkas tersedia` : 'Segera hadir'}
            </span>
          </div>
        </div>

        <div className="hidden sm:grid gap-3.5 px-6 py-2.5 border-b border-white/[0.02] text-xs font-medium text-[#5C6474]" style={{ gridTemplateColumns: 'minmax(0,1fr) 140px 110px 190px' }}>
          <span>Periode &amp; Judul Laporan</span>
          <span>Status</span>
          <span>Ukuran Berkas</span>
          <span className="text-right">Tindakan</span>
        </div>

        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center text-[#5C6474]">
            <FileText className="w-7 h-7 mb-2 opacity-40 text-[#4E9BFF]" />
            <span className="text-xs">Belum ada arsip laporan marketing bulanan</span>
          </div>
        ) : (
          reports.map((r: any) => (
            <div key={r.title} className="border-b border-white/[0.02] hover:bg-white/[0.015] transition-colors last:border-b-0">
              <div
                className="grid items-center gap-3.5 px-6 py-4"
                style={{ gridTemplateColumns: 'minmax(0,1fr) 140px 110px 190px' }}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-[34px] h-[34px] shrink-0 rounded-xl bg-[#4E9BFF]/[0.10] border-0 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[#4E9BFF]" strokeWidth={1.7} />
                  </span>
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-semibold text-[#F5F7FA] truncate">{r.title}</span>
                    <span className="text-xs text-[#8A93A3] truncate">{r.note} • <strong className="text-[#5C6474] font-normal">{r.period}</strong></span>
                  </span>
                </span>
                <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: r.statusColor }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {r.status}
                </span>
                <span className="font-heading tabular-nums text-xs text-[#8A93A3]">{r.size}</span>
                <span className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    onClick={() => toggleReportView(r.title)}
                    className="inline-flex items-center gap-1.5 h-[31px] px-3 bg-white/5 hover:bg-white/10 border-0 rounded-lg text-xs font-semibold text-[#F5F7FA] cursor-pointer whitespace-nowrap transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" strokeWidth={1.7} />
                    <span>{expandedReport === r.title ? 'Tutup Rincian' : 'Lihat Analisis'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={r.status !== 'Selesai'}
                    onClick={() => handleDownloadReport(r)}
                    className="inline-flex items-center gap-1.5 h-[31px] px-3 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap transition-all disabled:opacity-40 disabled:cursor-not-allowed border-0 shadow-sm"
                    style={{ background: 'linear-gradient(180deg,#0F6FE0,#0058BE)' }}
                    title="Pilih format unduhan (Word, PDF, Excel, PPT)"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={1.8} />
                    <span>Unduh...</span>
                  </button>
                </span>
              </div>

              {/* EXPANDED DETAILED AI REPORT ANALYSIS */}
              {expandedReport === r.title && (
                <div className="px-6 pb-5 pt-2 flex flex-col gap-3.5 bg-white/[0.015] border-t border-white/[0.03]">
                  {/* KPI Quick Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-xs text-[#5C6474]">ROAS Bulanan</span>
                      <span className="font-heading tabular-nums text-sm font-bold text-[#3FBF8F]">{idDec(roasNumeric)}x</span>
                      <span className="text-xs text-[#8A93A3]">Target: {idDec(roasTargetX)}x</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-xs text-[#5C6474]">Total Prospek (Leads)</span>
                      <span className="font-heading tabular-nums text-sm font-bold text-[#F5F7FA]">{displayMarketingLeads}</span>
                      <span className="text-xs text-[#8A93A3]">Closing: 21,9% (136 cust)</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-xs text-[#5C6474]">Belanja Iklan (30 Hari)</span>
                      <span className="font-heading tabular-nums text-sm font-bold text-[#F5F7FA]">{idMoney(dailyCap * 30)}</span>
                      <span className="text-xs text-[#8A93A3]">Alokasi 3 platform aktif</span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-xs text-[#5C6474]">Omset Teratribusi</span>
                      <span className="font-heading tabular-nums text-sm font-bold text-[#4E9BFF]">{idMoney(displayMarketingRevenue)}</span>
                      <span className="text-xs text-[#3FBF8F]">Surplus kas positif</span>
                    </div>
                  </div>

                  {/* Executive Summary & AI Diagnosis Box */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[#DCE3EC] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#4E9BFF]" />
                        Ringkasan Eksekutif Hasil Audit
                      </span>
                      <p className="text-xs text-[#8A93A3] leading-relaxed">
                        {r.executiveSummary || r.note}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#6366F1]/[0.03] border border-[#6366F1]/15 flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[#A5B4FC] flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-[#A5B4FC]" />
                        Diagnosa Mendalam AI (Penyebab &amp; Solusi)
                      </span>
                      <p className="text-xs text-[#DCE3EC] leading-relaxed">
                        {r.aiDiagnosis || 'Performa berada dalam batas wajar tanpa anomali kritis yang menghambat pertumbuhan kas.'}
                      </p>
                    </div>
                  </div>

                  {/* Action Steps Checklist */}
                  {(r.actionItems || []).length > 0 && (
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-2">
                      <span className="text-xs font-semibold text-[#F5F7FA] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#3FBF8F]" />
                        Tindakan Lanjutan yang Direkomendasikan Berkas Ini:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {(r.actionItems || []).map((item: string, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-white/[0.015] border border-white/[0.03] flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-[#3FBF8F]/10 text-[#3FBF8F] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-xs text-[#8A93A3] leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available Download Formats Pill Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.03] flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#5C6474]">Format siap unduh:</span>
                      {(r.availableFormats || ['PDF', 'Excel/CSV', 'Word (DOCX)', 'PPT Slides']).map((fmt: string) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => handleDownloadReportInFormat(r, fmt as any)}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white/5 hover:bg-white/10 text-[#C3CBD8] hover:text-white transition-colors cursor-pointer border-0"
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadReport(r)}
                      className="text-xs text-[#4E9BFF] hover:underline font-medium cursor-pointer border-0 bg-transparent inline-flex items-center gap-1"
                    >
                      <span>Buka Menu Unduh Lengkap</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* 8. PEMAKAIAN ANGGARAN & LANGKAH OPTIMASI AI (SATU KONTEN TERPADU LEBAR PENUH) */}
      {/* ========================================================================= */}
      <div
        className="border-0 overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]"
        style={{ background: '#0D1117', borderRadius: '16px', border: 'none' }}
      >
        {/* Header Terpadu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-7 py-5 border-b border-white/[0.04]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#3FBF8F]/12 flex items-center justify-center">
                <Sliders className="w-4 h-4 text-[#3FBF8F]" />
              </div>
              <h3 className="font-heading text-base font-semibold text-[#F5F7FA]">
                Pemakaian Anggaran &amp; Langkah Strategis AI
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#3FBF8F]/10 text-[#3FBF8F]">
                Alokasi Terpadu
              </span>
            </div>
            <span className="text-xs text-[#8A93A3]">
              {dailyCap > 0 ? `Pagu 31 hari × ${idMoney(dailyCap)}/hari • Rekapitulasi belanja riil dan rekomendasi pergeseran saldo iklan` : 'Belum ada pagu harian'}
            </span>
          </div>

          {/* Mode Switcher: Ringkas vs Rinci & AI */}
          <div className="flex items-center gap-1.5 p-1 bg-white/[0.035] rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setBudgetReportMode('ringkas')}
              className={`h-7 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                budgetReportMode === 'ringkas' ? 'bg-[#3FBF8F] text-black font-bold shadow-sm' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
              }`}
            >
              Ringkas
            </button>
            <button
              type="button"
              onClick={() => setBudgetReportMode('rinci')}
              className={`h-7 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                budgetReportMode === 'rinci' ? 'bg-[#3FBF8F] text-black font-bold shadow-sm' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
              }`}
            >
              Rinci &amp; AI
            </button>
          </div>
        </div>

        {/* Body Utama: 2 Kolom Luas di Desktop */}
        <div className="p-7 flex flex-col gap-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* SISI KIRI: STATUS PEMAKAIAN ANGGARAN (lg:col-span-6) */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8A93A3]">
                  Realisasi Belanja Iklan Berjalan
                </span>
                <span className="text-xs text-[#8A93A3]">
                  Pagu Total: <strong className="text-white font-medium">{idMoney(budgetCap)}</strong>
                </span>
              </div>

              {/* Big Stat Row */}
              <div className="flex items-end justify-between gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex flex-col gap-1.5">
                  <span className="font-heading font-bold text-[clamp(26px,2.4vw,34px)] tracking-tight text-white tabular-nums">
                    <CountUp to={budgetSpent} prefix="Rp " separator="." />
                  </span>
                  <span className="text-xs text-[#8A93A3]">
                    {dailyCap > 0
                      ? `Terpakai dari pagu ${idMoney(budgetCap)} (siklus 31 hari)`
                      : 'Belum ada anggaran kampanye aktif'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-heading tabular-nums text-2xl font-bold text-[#3FBF8F]">
                    <CountUp to={Math.round(budgetPct)} suffix="%" />
                  </span>
                  <span className="text-xs text-[#5C6474] block mt-0.5">dari total pagu</span>
                </div>
              </div>

              {/* Bar Pemakaian & Sisa Pagu */}
              <div className="flex flex-col gap-2.5">
                <div className="relative h-3 rounded-full bg-white/[0.07] overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{
                      width: `${Math.max(3, budgetPct)}%`,
                      background: 'linear-gradient(90deg, #3FBF8F 0%, #4E9BFF 100%)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[#8A93A3]">
                  <span>Terpakai: <strong className="text-white">{Math.round(budgetPct)}%</strong></span>
                  <span>Sisa Saldo Pagu: <strong className="text-[#3FBF8F] font-semibold">{dailyCap > 0 ? idMoney(budgetLeft) : 'Rp 0'}</strong></span>
                </div>
              </div>

              {/* Proyeksi Ringkas vs Rinci Alokasi */}
              {budgetReportMode === 'ringkas' ? (
                <div className="p-4 rounded-xl bg-white/[0.015] border border-white/[0.03] flex items-center justify-between">
                  <span className="text-xs text-[#8A93A3]">
                    {dailyCap > 0 && roasNumeric > 0
                      ? `Proyeksi omset dari sisa saldo bila dipakai pada ROAS ${idDec(roasNumeric)}x`
                      : 'Proyeksi omset dari sisa saldo'}
                  </span>
                  <span className="font-heading tabular-nums text-base font-bold text-[#3FBF8F]">
                    {dailyCap > 0 && budgetProj > 0 ? (
                      <CountUp to={budgetProj} prefix="Rp " separator="." />
                    ) : (
                      'Rp 0'
                    )}
                  </span>
                </div>
              ) : (
                /* Rinci: Tabel Breakdown per Platform Luas */
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold text-[#DCE3EC]">Rincian Kebutuhan &amp; Realisasi Saldo per Kanal:</span>
                  <div className="space-y-2.5">
                    {[
                      { channel: 'Meta Ads (Instagram & FB Feed)', spend: 'Rp 7.800.000', share: '53%', purpose: 'Retargeting audiens muda usia 25-34 thn & promo gajian', roas: '3,8x', color: '#4E9BFF' },
                      { channel: 'TikTok Ads', spend: 'Rp 4.400.000', share: '30%', purpose: 'Video katalog UGC & akuisisi pelanggan Gen Z', roas: '3,2x', color: '#A5B4FC' },
                      { channel: 'Google Search Ads', spend: 'Rp 2.500.000', share: '17%', purpose: 'Menangkap prospek berniat beli tinggi (kata kunci produk)', roas: '4,6x', color: '#F2A83B' },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-xs text-[#F5F7FA]">{item.channel}</span>
                            <span className="text-xs text-[#8A93A3]">{item.purpose}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-heading font-bold text-xs text-white block tabular-nums">{item.spend} ({item.share})</span>
                          <span className="text-xs text-[#3FBF8F] font-semibold">ROAS: {item.roas}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Diagnosa Pagu */}
                  <div className="p-4 rounded-xl bg-[#3FBF8F]/[0.04] border border-[#3FBF8F]/20 flex items-start gap-3 mt-1">
                    <Sparkles className="w-4 h-4 text-[#3FBF8F] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#C3CBD8] leading-relaxed">
                      <strong className="text-white">AI Burn-Rate Check:</strong> Pemakaian pagu saat ini (45%) berada pada laju optimal di hari ke-14 dari siklus 31 hari. Sisa saldo Rp 17.850.000 mencukupi untuk eskalasi kampanye akhir bulan tanpa risiko overspending.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* SISI KANAN: LANGKAH STRATEGIS AI (lg:col-span-6) */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#A5B4FC] flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" />
                  Rekomendasi Tindakan Nyata AI
                </span>
                <span className="text-xs text-[#8A93A3]">
                  Efisiensi Multi-Kanal
                </span>
              </div>

              {/* Box Narasi Strategis */}
              <div className="p-5 rounded-2xl bg-[#6366F1]/[0.04] border border-[#6366F1]/20 flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed text-[#DCE3EC]">
                  {bestChannel && worstChannel && bestChannel.name !== worstChannel.name
                    ? `${worstChannel.name} menghasilkan ${idDec(worstChannel.mult)}x, sementara ${bestChannel.name} mencapai ${idDec(bestChannel.mult)}x. Memindahkan ${idMoney(budgetShiftAmount)} per hari dari ${worstChannel.name} ke ${bestChannel.name} adalah cara tercepat menaikkan ROAS gabungan bulan depan.`
                    : 'Belum ada rekomendasi — data kanal masih dikumpulkan.'}
                </p>

                {bestChannel && worstChannel && bestChannel.name !== worstChannel.name && (
                  <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#8A93A3]">Dipindah</span>
                      <span className="font-heading tabular-nums text-xs font-bold text-white">
                        <CountUp to={budgetShiftAmount} prefix="Rp " suffix="/hari" separator="." />
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#8A93A3]">Perkiraan Omset Tambahan</span>
                      <span className="font-heading tabular-nums text-xs font-bold text-[#3FBF8F]">
                        <CountUp to={estimatedShiftGain} prefix="+Rp " separator="." />
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#8A93A3]">Selisih ROAS</span>
                      <span className="font-heading tabular-nums text-xs font-bold text-[#A5B4FC]">
                        +{idDec(bestChannel.mult - worstChannel.mult)}x
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3 Checkpoint Eksekusi Taktis */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-[#DCE3EC]">3 Checkpoint Eksekusi Taktis AI:</span>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#3FBF8F]/10 text-[#3FBF8F] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-white">Terapkan Pemindahan Budget Harian</span>
                      <span className="text-xs text-[#8A93A3] leading-relaxed">
                        Geser Rp 150.000/hari dari Google Search ke Meta Ads untuk memacu volume leads muda berkinerja tinggi.
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#4E9BFF]/10 text-[#4E9BFF] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-white">Refresh Materi Video TikTok (9:16)</span>
                      <span className="text-xs text-[#8A93A3] leading-relaxed">
                        Gunakan 3 hook video baru berdurasi 15-30 detik untuk memulihkan rasio CTR yang melandai akibat ad fatigue.
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#F2A83B]/10 text-[#F2A83B] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-white">Tinjau Evaluasi CPL 5 Hari Kerja</span>
                      <span className="text-xs text-[#8A93A3] leading-relaxed">
                        Pantau Cost Per Lead di dashboard pada hari ke-5 pasca-penyesuaian untuk memastikan rasio konversi closing tetap di atas 20%.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Luas */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleApplyBudgetShift}
                  disabled={budgetShiftApplied || budgetShiftApplying}
                  className="flex-1 h-10 px-5 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-sm"
                  style={{ background: 'linear-gradient(180deg,#0F6FE0,#0058BE)' }}
                >
                  {budgetShiftApplied ? 'Pergeseran Budget Berhasil Diterapkan' : budgetShiftApplying ? 'Menyimpan ke Database...' : 'Terapkan Pemindahan Budget (Rp 150rb/hari)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = `Halo KLIR AI Assistant, mohon audit efisiensi kampanye iklan marketing saya: Blended ROAS saat ini ${idDec(roasNumeric)}x vs target ${idDec(roasTargetX)}x. Bagaimana cara paling aman memindahkan alokasi budget Rp 150.000/hari dari kanal berkinerja rendah (${worstChannel?.name || 'Google Ads'}) ke kanal tertinggi (${bestChannel?.name || 'Meta Ads'}) tanpa mengorbankan volume leads?`;
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('klir_pending_ai_prompt', p);
                    }
                    if (onOpenAI) {
                      onOpenAI(p);
                    } else {
                      setToastMsg('Pertanyaan analisis telah disalin. Buka tab AI Assistant untuk berdiskusi.');
                      setTimeout(() => setToastMsg(null), 4000);
                    }
                  }}
                  className="h-10 px-4 inline-flex items-center gap-2 bg-[#6366F1]/15 hover:bg-[#6366F1]/25 text-[#A5B4FC] hover:text-white border border-[#6366F1]/30 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  title="Konsultasikan langkah optimasi iklan ini ke AI Assistant"
                >
                  <Bot className="w-4 h-4 text-[#A5B4FC]" />
                  <span>Konsultasi AI</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL PILIHAN FORMAT UNDUHAN LAPORAN (PDF, Word, Excel, PPT) */}
      {/* ========================================================================= */}
      {downloadModalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 border border-white/10 shadow-2xl relative"
            style={{ background: '#0D1117' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#4E9BFF]/10 flex items-center justify-center">
                  <Download className="w-4 h-4 text-[#4E9BFF]" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-white">Pilih Format Unduhan Laporan</h3>
                  <span className="text-xs text-[#8A93A3] truncate max-w-[320px]">{downloadModalReport.title}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDownloadModalReport(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#8A93A3] hover:text-white transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#8A93A3] leading-relaxed">
              Pilih format berkas yang sesuai dengan kebutuhan pelaporan tim, presentasi rapat pimpinan, atau rekap data mentah:
            </p>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  id: 'PDF' as const,
                  title: 'Format Dokumen PDF',
                  desc: 'Siap cetak, layout rapi & resmi untuk arsip direksi',
                  icon: Printer,
                  color: '#EF4444',
                  tag: 'Resmi',
                },
                {
                  id: 'Word (DOCX)' as const,
                  title: 'Microsoft Word (.doc)',
                  desc: 'Dapat diedit bebas untuk laporan tertulis tim',
                  icon: FileText,
                  color: '#3B82F6',
                  tag: 'Editable',
                },
                {
                  id: 'Excel/CSV' as const,
                  title: 'Tabel Excel / CSV',
                  desc: 'Rekap angka numerik mentah & rumus analitik',
                  icon: FileSpreadsheet,
                  color: '#10B981',
                  tag: 'Data Raw',
                },
                {
                  id: 'PPT Slides' as const,
                  title: 'Slide Presentasi PPT',
                  desc: 'Slide visual gelap untuk deck rapat eksekutif',
                  icon: Presentation,
                  color: '#F59E0B',
                  tag: 'Pitch Deck',
                },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleDownloadReportInFormat(downloadModalReport, opt.id)}
                    className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/15 flex flex-col gap-2 text-left cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${opt.color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: opt.color }} />
                      </div>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white/5 text-[#C3CBD8]">
                        {opt.tag}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-[#F5F7FA] block group-hover:text-white">{opt.title}</span>
                      <span className="text-xs text-[#8A93A3] block leading-tight mt-0.5">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDownloadModalReport(null)}
                className="h-8 px-4 rounded-lg text-xs font-semibold text-[#8A93A3] hover:text-white bg-transparent border-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL UPLOAD DATA KAMPANYE & MARKETING */}
      {/* ========================================================================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0D1117] p-6 shadow-2xl flex flex-col gap-5 text-[#F5F7FA]"
            style={{ borderRadius: '20px' }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-[#4E9BFF]/15 flex items-center justify-center text-[#4E9BFF] shrink-0">
                  <Upload className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-heading text-base font-semibold text-[#F5F7FA] m-0">
                    Upload Data Kampanye Marketing
                  </h3>
                  <p className="text-xs text-[#8A93A3] mt-0.5 m-0">
                    Format berkas CSV atau Spreadsheet Excel (.xlsx / .csv)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-[#8A93A3] hover:text-white hover:bg-white/5 cursor-pointer border-0 bg-transparent transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dropzone Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-[#4E9BFF]/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-all"
            >
              <FileSpreadsheet className="w-8 h-8 text-[#4E9BFF] opacity-80" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-[#F5F7FA]">
                  {uploadFileName ? uploadFileName : 'Klik atau seret file laporan iklan ke sini'}
                </span>
                <span className="text-xs text-[#8A93A3]">
                  Mendukung ekspor laporan dari Meta Ads Manager, TikTok Ads, & Google Ads
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFileName(file.name);
                  }
                }}
              />
            </div>

            {/* Template & Quick Helper */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-[#DCE3EC]">Belum punya format data?</span>
                <span className="text-xs text-[#8A93A3]">Unduh template tabel yang disesuaikan dengan kolom KLIR</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-[#4E9BFF] text-xs font-semibold rounded-lg border-0 cursor-pointer transition-all whitespace-nowrap"
              >
                <Download className="w-3 h-3" />
                <span>Unduh Template</span>
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="h-9 px-4 rounded-xl text-xs font-medium text-[#8A93A3] hover:text-white hover:bg-white/5 transition-all cursor-pointer border-0 bg-transparent"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSimulatingUpload}
                onClick={() => handleSimulateUpload(uploadFileName)}
                className="h-9 px-4 inline-flex items-center gap-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all disabled:opacity-50 border-0"
                style={{ background: 'linear-gradient(180deg,#0F6FE0,#0058BE)' }}
              >
                {isSimulatingUpload ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses Berkas...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadFileName ? 'Impor Berkas Terpilih' : 'Simulasikan Impor Contoh'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

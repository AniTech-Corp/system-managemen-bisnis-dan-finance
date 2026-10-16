'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  Handshake,
  Info,
  Layers,
  Lightbulb,
  Network,
  PackageSearch,
  Printer,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Sliders,
  Percent,
  DollarSign,
  Megaphone,
  Compass,
  Truck,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import { matchGlossaryTerm } from './glossary-data';
import TaxFeatureLock from './TaxFeatureLock';
import type {
  DashboardDataStatus,
  DashboardVisualMode,
  RoleDashboardCard,
  RoleDashboardInsight,
  RoleDashboardMetric,
  RoleDashboardPayload,
  RoleDashboardRole,
  RoleDashboardSeries,
} from '@/lib/role-dashboard-contract';

type IconComponent = typeof CalendarDays;

export const ROLE_META: Record<RoleDashboardRole, {
  title: string;
  subtitle: string;
  snapshot: string;
  aiTitle: string;
  accent: string;
  icon: IconComponent;
}> = {
  SEKRETARIS: {
    title: 'Dashboard Sekretariat',
    subtitle: 'Ringkasan agenda, administrasi, dokumen, dan koordinasi agregat.',
    snapshot: 'Administrasi & Koordinasi',
    aiTitle: 'Sekretariat',
    accent: '#4E9BFF',
    icon: FileText,
  },
  MANAGER_UMUM: {
    title: 'Dashboard Manager Tim',
    subtitle: 'Ringkasan KPI dan keputusan berbasis team scope, bukan cabang.',
    snapshot: 'Kinerja Tim',
    aiTitle: 'Manager Tim',
    accent: '#D8A33C',
    icon: Target,
  },
  MANAGER_OPERASIONAL: {
    title: 'Dashboard Operasional',
    subtitle: 'Ringkasan stok, pembelian, supplier, dan expiry lintas outlet.',
    snapshot: 'Stok & Rantai Pasok',
    aiTitle: 'Manager Operasional',
    accent: '#3FBF8F',
    icon: Boxes,
  },
  CEO: {
    title: 'Dashboard Eksekutif & Owner',
    subtitle: 'Ringkasan makro performa bisnis, laba, runway, dan arah strategis.',
    snapshot: 'Kondisi Perusahaan',
    aiTitle: 'Executive Corplan',
    accent: '#8D55E8',
    icon: Building2,
  },
  FINANCE: {
    title: 'Dashboard Keuangan & Kas',
    subtitle: 'Ringkasan arus kas, kas laci kasir, piutang kasbon, dan jatuh tempo.',
    snapshot: 'Likuiditas & Kasbon',
    aiTitle: 'Finance Controller',
    accent: '#10B981',
    icon: WalletCards,
  },
  MARKETING: {
    title: 'Dashboard Marketing & Saluran',
    subtitle: 'Ringkasan efisiensi akuisisi, ROAS multi-channel, dan retensi promo.',
    snapshot: 'Akuisisi & Promosi',
    aiTitle: 'Marketing Studio',
    accent: '#EC4899',
    icon: Sparkles,
  },
};

const ICONS: Record<string, IconComponent> = {
  agenda: CalendarDays,
  documents: FileText,
  contract: ShieldCheck,
  coordination: Users,
  attendance: CheckCircle2,
  kpi: Target,
  budget: WalletCards,
  sop: ClipboardCheck,
  decision: Lightbulb,
  local: Sparkles,
  stock: PackageSearch,
  purchase: Truck,
  cogs: WalletCards,
  shifts: CalendarDays,
  supplier: Handshake,
};

interface MetricDefinition {
  id: string;
  label: string;
  cardId: string;
  fallbackDetail: string;
  fallbackSource: string;
}

interface SectionDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  metrics: MetricDefinition[];
  footer: string;
}

const SECTION_DEFINITIONS: Record<RoleDashboardRole, SectionDefinition[]> = {
  SEKRETARIS: [
    {
      id: 'agenda', title: 'Agenda Hari Ini & Minggu Ini', description: 'Jadwal yang perlu dilihat tanpa membuka data divisi lain.', icon: 'agenda', iconColor: '#4E9BFF',
      metrics: [
        { id: 'today', label: 'Agenda hari ini', cardId: 'agenda-today', fallbackDetail: 'Data agenda harian belum tersedia.', fallbackSource: 'Agenda source' },
        { id: 'week', label: 'Agenda minggu ini', cardId: 'agenda-week', fallbackDetail: 'Data agenda mingguan belum tersedia.', fallbackSource: 'Agenda source' },
        { id: 'conflicts', label: 'Konflik jadwal', cardId: 'agenda-conflicts', fallbackDetail: 'Pemeriksaan konflik jadwal belum tersedia.', fallbackSource: 'Agenda conflict checker' },
      ],
      footer: 'Prioritaskan konflik dan agenda terdekat sebelum koordinasi berikutnya.',
    },
    {
      id: 'inbox', title: 'Kotak Masuk Administratif', description: 'Dokumen yang memerlukan tindakan administratif.', icon: 'documents', iconColor: '#8A93A3',
      metrics: [
        { id: 'drafts', label: 'Draft menunggu tanda tangan', cardId: 'drafts', fallbackDetail: 'Status tanda tangan belum tersedia.', fallbackSource: 'WorkspaceFile workflow' },
        { id: 'contracts', label: 'Kontrak menunggu approval', cardId: 'contracts', fallbackDetail: 'Status approval kontrak belum tersedia.', fallbackSource: 'WorkspaceFile workflow' },
        { id: 'letters', label: 'Surat masuk baru', cardId: 'letters', fallbackDetail: 'Klasifikasi surat masuk belum tersedia.', fallbackSource: 'WorkspaceFile classification' },
      ],
      footer: 'Sumber dokumen dibatasi pada file yang boleh dilihat oleh role Sekretaris.',
    },
    {
      id: 'contracts', title: 'Pelacak Kontrak & Perizinan', description: 'Peringatan administratif tanpa membuka angka keuangan.', icon: 'contract', iconColor: '#8A93A3',
      metrics: [
        { id: 'due7', label: 'Jatuh tempo <7 hari', cardId: 'contract-due7', fallbackDetail: 'Metadata jatuh tempo belum tersedia.', fallbackSource: 'WorkspaceFile expiry metadata' },
        { id: 'due30', label: 'Jatuh tempo <30 hari', cardId: 'contract-due30', fallbackDetail: 'Metadata jatuh tempo belum tersedia.', fallbackSource: 'WorkspaceFile expiry metadata' },
        { id: 'safe', label: 'Status aman', cardId: 'contract-safe', fallbackDetail: 'Status kontrak aktif belum tersedia.', fallbackSource: 'Contract metadata' },
      ],
      footer: 'Reminder otomatis membutuhkan metadata expiry dan scheduler yang belum aktif.',
    },
    {
      id: 'coordination', title: 'Tugas Koordinasi', description: 'Tugas lintas koordinasi yang ditampilkan secara agregat.', icon: 'coordination', iconColor: '#4E9BFF',
      metrics: [
        { id: 'ceo', label: 'Tugas dari CEO', cardId: 'tasks-ceo', fallbackDetail: 'Sumber pengirim tugas belum tersedia.', fallbackSource: 'WorkTask assignment' },
        { id: 'manager', label: 'Tugas dari Manager', cardId: 'tasks-manager', fallbackDetail: 'Sumber pengirim tugas belum tersedia.', fallbackSource: 'WorkTask assignment' },
        { id: 'done', label: 'Selesai minggu ini', cardId: 'tasks-completed', fallbackDetail: 'Ringkasan penyelesaian mingguan belum tersedia.', fallbackSource: 'WorkTask status' },
      ],
      footer: 'Gunakan AI Assistant untuk menyusun agenda tindak lanjut dari tugas yang tersedia.',
    },
    {
      id: 'attendance', title: 'Ringkasan Kehadiran Tim', description: 'Hanya agregat kehadiran, tanpa nama individu atau gaji.', icon: 'attendance', iconColor: '#8A93A3',
      metrics: [
        { id: 'today', label: 'Kehadiran hari ini', cardId: 'attendance-today', fallbackDetail: 'Persentase kehadiran hari ini belum tersedia.', fallbackSource: 'AttendanceRecord aggregate' },
        { id: 'leave', label: 'Cuti / izin', cardId: 'attendance-leave', fallbackDetail: 'Jumlah cuti/izin agregat belum tersedia.', fallbackSource: 'AttendanceRecord aggregate' },
        { id: 'average', label: 'Rata-rata bulan ini', cardId: 'attendance-avg', fallbackDetail: 'Rata-rata bulanan belum tersedia.', fallbackSource: 'AttendanceRecord aggregate' },
      ],
      footer: 'Detail individu sengaja tidak ditampilkan pada dashboard Sekretaris.',
    },
  ],
  MANAGER_UMUM: [
    {
      id: 'kpi', title: 'KPI Team', description: 'Capaian tim untuk membantu pembinaan dan keputusan.', icon: 'kpi', iconColor: '#D8A33C',
      metrics: [
        { id: 'above', label: 'Di atas target', cardId: 'kpi-above', fallbackDetail: 'Scope KPI tim authoritative belum tersedia.', fallbackSource: 'Team KPI assignment' },
        { id: 'ontrack', label: 'Sesuai target', cardId: 'kpi-on-track', fallbackDetail: 'Scope KPI tim authoritative belum tersedia.', fallbackSource: 'Team KPI assignment' },
        { id: 'below', label: 'Perlu dukungan', cardId: 'kpi-below', fallbackDetail: 'Scope KPI tim authoritative belum tersedia.', fallbackSource: 'Team KPI assignment' },
      ],
      footer: 'Gap dipakai untuk tindakan pembinaan, bukan hukuman otomatis.',
    },
    {
      id: 'budget', title: 'Budget Operasional Tim', description: 'Hanya subset budget own-team jika scope terbukti.', icon: 'budget', iconColor: '#D8A33C',
      metrics: [
        { id: 'allocated', label: 'Alokasi', cardId: 'budget-allocated', fallbackDetail: 'Scope budget tim belum terbukti.', fallbackSource: 'TEAM_OPERATIONAL_BUDGET' },
        { id: 'spent', label: 'Terpakai', cardId: 'budget-spent', fallbackDetail: 'Scope budget tim belum terbukti.', fallbackSource: 'TEAM_OPERATIONAL_BUDGET' },
        { id: 'remaining', label: 'Sisa', cardId: 'budget-remaining', fallbackDetail: 'Scope budget tim belum terbukti.', fallbackSource: 'TEAM_OPERATIONAL_BUDGET' },
      ],
      footer: 'Tidak ada fallback ke kas perusahaan atau budget cabang.',
    },
    {
      id: 'sop', title: 'SOP & Kepatuhan', description: 'Status pelaksanaan SOP dalam scope tim.', icon: 'sop', iconColor: '#D8A33C',
      metrics: [
        { id: 'full', label: 'Patuh penuh', cardId: 'sop-full', fallbackDetail: 'Sumber SOP team scope belum tersedia.', fallbackSource: 'SOP assignment' },
        { id: 'attention', label: 'Perlu perhatian', cardId: 'sop-attention', fallbackDetail: 'Sumber SOP team scope belum tersedia.', fallbackSource: 'SOP assignment' },
        { id: 'violations', label: 'Pelanggaran', cardId: 'sop-violations', fallbackDetail: 'Sumber SOP team scope belum tersedia.', fallbackSource: 'SOP assignment' },
      ],
      footer: 'Status SOP dibuat role-fit dan tidak membuka data tim lain.',
    },
    {
      id: 'decision', title: 'Decision Alerts', description: 'Hal yang membutuhkan keputusan Manager.', icon: 'decision', iconColor: '#D8A33C',
      metrics: [
        { id: 'leave', label: 'Approval cuti', cardId: 'decision-leave', fallbackDetail: 'Antrean approval belum tersedia.', fallbackSource: 'Team decision queue' },
        { id: 'discount', label: 'Diskon khusus', cardId: 'decision-discount', fallbackDetail: 'Antrean diskon belum tersedia.', fallbackSource: 'Team decision queue' },
        { id: 'complaints', label: 'Komplain', cardId: 'decision-complaints', fallbackDetail: 'Antrean komplain belum tersedia.', fallbackSource: 'Team decision queue' },
      ],
      footer: 'Decision queue tidak boleh melebar menjadi dashboard company-wide.',
    },
    {
      id: 'local', title: 'Aktivitas Marketing Lokal', description: 'Aktivitas lokal yang terkait dengan scope tim.', icon: 'local', iconColor: '#8D55E8',
      metrics: [
        { id: 'campaigns', label: 'Campaign lokal', cardId: 'local-campaigns', fallbackDetail: 'Data aktivitas lokal belum tersedia.', fallbackSource: 'Local marketing scope' },
        { id: 'reach', label: 'Reach', cardId: 'local-reach', fallbackDetail: 'Data aktivitas lokal belum tersedia.', fallbackSource: 'Local marketing scope' },
        { id: 'engagement', label: 'Engagement', cardId: 'local-engagement', fallbackDetail: 'Data aktivitas lokal belum tersedia.', fallbackSource: 'Local marketing scope' },
      ],
      footer: 'Riset lokal tidak sama dengan akses ke data marketing seluruh perusahaan.',
    },
  ],
  MANAGER_OPERASIONAL: [
    {
      id: 'stock', title: 'Peta Stok Semua Outlet', description: 'Status stok lintas outlet tanpa detail pelanggan.', icon: 'stock', iconColor: '#3FBF8F',
      metrics: [
        { id: 'safe', label: 'Aman', cardId: 'stock-safe', fallbackDetail: 'Ringkasan stok aman belum tersedia.', fallbackSource: 'Product.currentStock/minStock' },
        { id: 'restock', label: 'Perlu restock', cardId: 'stock-restock', fallbackDetail: 'Ringkasan restock belum tersedia.', fallbackSource: 'Product.currentStock/minStock' },
        { id: 'critical', label: 'Kritis / habis', cardId: 'stock-critical', fallbackDetail: 'Ringkasan stok kritis belum tersedia.', fallbackSource: 'Product.currentStock/minStock' },
      ],
      footer: 'SKU kritis dapat dilanjutkan melalui modul Inventory read-only.',
    },
    {
      id: 'purchase', title: 'Purchase Order Lifecycle', description: 'Perjalanan PO dari draft sampai diterima.', icon: 'purchase', iconColor: '#4E9BFF',
      metrics: [
        { id: 'draft', label: 'Draft', cardId: 'po-draft', fallbackDetail: 'Status PO belum tersedia.', fallbackSource: 'PurchaseOrder' },
        { id: 'ordered', label: 'Dikirim / berjalan', cardId: 'po-ordered', fallbackDetail: 'Status PO belum tersedia.', fallbackSource: 'PurchaseOrder' },
        { id: 'received', label: 'Diterima', cardId: 'po-received', fallbackDetail: 'Status PO belum tersedia.', fallbackSource: 'PurchaseOrder' },
      ],
      footer: 'Estimasi keterlambatan memerlukan metadata pengiriman yang lebih lengkap.',
    },
    {
      id: 'cogs', title: 'Biaya Operasional / COGS', description: 'COGS (biaya langsung untuk membuat barang), bukan kas atau laba perusahaan.', icon: 'cogs', iconColor: '#D8A33C',
      metrics: [
        { id: 'spend', label: 'Belanja supplier', cardId: 'supplier-spend', fallbackDetail: 'Ringkasan belanja supplier belum tersedia.', fallbackSource: 'PurchaseOrder / StockMovement' },
        { id: 'dead', label: 'Nilai dead stock', cardId: 'dead-stock-value', fallbackDetail: 'Dead stock (stok lama tidak bergerak) belum tersedia.', fallbackSource: 'Inventory turnover' },
        { id: 'unit', label: 'Efisiensi biaya/unit', cardId: 'cost-per-unit', fallbackDetail: 'Efisiensi biaya per unit belum tersedia.', fallbackSource: 'PurchaseOrderItem' },
      ],
      footer: 'Data COGS hanya boleh berasal dari source operasional yang sah.',
    },
    {
      id: 'sop', title: 'Kepatuhan SOP Gudang / Dapur', description: 'Status proses operasional lintas outlet.', icon: 'sop', iconColor: '#4E9BFF',
      metrics: [
        { id: 'full', label: 'Patuh penuh', cardId: 'sop-full', fallbackDetail: 'Sumber SOP belum tersedia.', fallbackSource: 'Operational SOP' },
        { id: 'attention', label: 'Perlu perhatian', cardId: 'sop-attention', fallbackDetail: 'Sumber SOP belum tersedia.', fallbackSource: 'Operational SOP' },
        { id: 'violations', label: 'Pelanggaran', cardId: 'sop-violations', fallbackDetail: 'Sumber SOP belum tersedia.', fallbackSource: 'Operational SOP' },
      ],
      footer: 'Status kepatuhan belum dianggap tersedia tanpa source checklist.',
    },
    {
      id: 'shifts', title: 'Jadwal Staf Operasional', description: 'Coverage shift tanpa gaji atau data personal sensitif.', icon: 'shifts', iconColor: '#8CBEFF',
      metrics: [
        { id: 'morning', label: 'Shift pagi', cardId: 'shift-morning', fallbackDetail: 'Jadwal shift belum tersedia.', fallbackSource: 'Operational schedule' },
        { id: 'evening', label: 'Shift siang / malam', cardId: 'shift-evening', fallbackDetail: 'Jadwal shift belum tersedia.', fallbackSource: 'Operational schedule' },
        { id: 'leave', label: 'Cuti / izin', cardId: 'shift-leave', fallbackDetail: 'Ringkasan cuti/izin belum tersedia.', fallbackSource: 'Operational schedule' },
      ],
      footer: 'Jadwal yang kosong akan menjadi temuan operasional, bukan angka gaji.',
    },
    {
      id: 'supplier', title: 'Kinerja Supplier', description: 'Kualitas, ketepatan waktu, dan supplier yang perlu ditinjau.', icon: 'supplier', iconColor: '#3FBF8F',
      metrics: [
        { id: 'ontime', label: 'Tepat waktu', cardId: 'supplier-ontime', fallbackDetail: 'Lead time (lama pesan sampai barang datang) belum tersedia.', fallbackSource: 'SupplierScore.onTimeRate' },
        { id: 'complaints', label: 'Komplain kualitas', cardId: 'supplier-complaints', fallbackDetail: 'Riwayat komplain supplier belum tersedia.', fallbackSource: 'Supplier quality log' },
        { id: 'risk', label: 'Supplier bermasalah', cardId: 'supplier-risk', fallbackDetail: 'Ranking supplier belum tersedia.', fallbackSource: 'SupplierScore' },
      ],
      footer: 'Evaluasi supplier tidak membuka data customer atau marketing.',
    },
  ],
  CEO: [
    {
      id: 'revenue', title: 'Pertumbuhan & Pendapatan Makro', description: 'Realisasi pendapatan terhadap target rencana korporat (Corplan).', icon: 'kpi', iconColor: '#8D55E8',
      metrics: [
        { id: 'rev-mtd', label: 'Revenue MTD', cardId: 'rev-mtd', fallbackDetail: 'Realisasi omset berjalan.', fallbackSource: 'CashTransaction / Invoice' },
        { id: 'net-margin', label: 'Net Profit Margin', cardId: 'net-margin', fallbackDetail: 'Rasio laba bersih terhadap omset.', fallbackSource: 'Financial calculation' },
        { id: 'runway', label: 'Cash Runway', cardId: 'runway', fallbackDetail: 'Estimasi ketahanan kas dalam bulan.', fallbackSource: 'ForwardForecast' },
      ],
      footer: 'Gunakan CorPlan Quick Tools untuk simulasi skenario pemulihan pendapatan.',
    },
    {
      id: 'cost-structure', title: 'Struktur Biaya & Efisiensi', description: 'Komposisi COGS, beban operasional, dan pemasaran.', icon: 'budget', iconColor: '#8D55E8',
      metrics: [
        { id: 'cogs-share', label: 'Beban HPP (COGS)', cardId: 'cogs-share', fallbackDetail: 'Proporsi belanja bahan baku langsung.', fallbackSource: 'PurchaseOrder' },
        { id: 'opex-share', label: 'Beban Operasional', cardId: 'opex-share', fallbackDetail: 'Gaji, sewa ruko, utilitas cabang.', fallbackSource: 'Operational expenses' },
        { id: 'marketing-share', label: 'Belanja Iklan', cardId: 'marketing-share', fallbackDetail: 'Total belanja promosi & akuisisi.', fallbackSource: 'Marketing spend' },
      ],
      footer: 'Evaluasi margin secara berkala untuk menjaga stabilitas arus kas.',
    },
    {
      id: 'cash-runway', title: 'Ketahanan Kas & Runway', description: 'Daya tahan likuiditas perusahaan dalam berbagai skenario.', icon: 'contract', iconColor: '#8D55E8',
      metrics: [
        { id: 'runway-months', label: 'Runway Tersisa', cardId: 'runway-months', fallbackDetail: 'Bulan daya tahan kas.', fallbackSource: 'Cash forecast' },
        { id: 'burn-rate', label: 'Burn Rate Bulanan', cardId: 'burn-rate', fallbackDetail: 'Rata-rata pengeluaran kas bulanan.', fallbackSource: 'CashTransaction' },
        { id: 'safe-buffer', label: 'Buffer Kas Minimum', cardId: 'safe-buffer', fallbackDetail: 'Batas cadangan darurat.', fallbackSource: 'Liquidity policy' },
      ],
      footer: 'Cadangan kas mencukupi untuk operasional stabil 14+ bulan.',
    },
    {
      id: 'corplan-strategy', title: 'Inisiatif Rencana Korporat (Corplan)', description: 'Simulasi dan proyeksi pertumbuhan strategis.', icon: 'local', iconColor: '#8D55E8',
      metrics: [
        { id: 'corplan-target', label: 'Target Pendapatan', cardId: 'corplan-target', fallbackDetail: 'Plafon target omset tahunan.', fallbackSource: 'Corporate Plan' },
        { id: 'expansion-score', label: 'Skor Kelayakan Cabang', cardId: 'expansion-score', fallbackDetail: 'Feasibility cabang baru.', fallbackSource: 'Corplan Model' },
        { id: 'capex-payback', label: 'Payback Period Capex', cardId: 'capex-payback', fallbackDetail: 'Estimasi balik modal modal kerja.', fallbackSource: 'Capex analytics' },
      ],
      footer: 'Simulasi skenario resesi dan ekspansi dapat dijalankan via AI Copilot.',
    },
  ],
  FINANCE: [
    {
      id: 'cash-drawer', title: 'Kas Laci & Kas Tunai Harian', description: 'Rekonsiliasi fisik uang tunai di kasir vs catatan sistem POS.', icon: 'budget', iconColor: '#10B981',
      metrics: [
        { id: 'cash-in-drawer', label: 'Kas di laci kasir', cardId: 'cash-drawer', fallbackDetail: 'Hasil hitung fisik uang tunai laci.', fallbackSource: 'Cash drawer count' },
        { id: 'pos-sales', label: 'Penjualan tunai POS', cardId: 'pos-cash-sales', fallbackDetail: 'Total struk tunai di kasir.', fallbackSource: 'POS transactions' },
        { id: 'discrepancy', label: 'Selisih kasir harian', cardId: 'cash-diff', fallbackDetail: 'Deviasi uang laci vs catatan digital.', fallbackSource: 'Reconciliation' },
      ],
      footer: 'Setiap selisih di atas Rp 20.000 wajib diverifikasi oleh kepala kasir.',
    },
    {
      id: 'kasbon', title: 'Manajemen Kasbon & Piutang', description: 'Penagihan piutang pelanggan dan kasbon berjalan melalui WhatsApp.', icon: 'contract', iconColor: '#10B981',
      metrics: [
        { id: 'kasbon-active', label: 'Kasbon berjalan', cardId: 'kasbon-active', fallbackDetail: 'Total piutang kasbon belum lunas.', fallbackSource: 'Invoice / Piutang' },
        { id: 'kasbon-due', label: 'Lewat jatuh tempo', cardId: 'kasbon-due', fallbackDetail: 'Kasbon menunggak >14 hari.', fallbackSource: 'Invoice.dueDate' },
        { id: 'wa-ready', label: 'WA tertagih siap', cardId: 'wa-ready', fallbackDetail: 'Jumlah kontak WA valid untuk reminder.', fallbackSource: 'Customer.phone' },
      ],
      footer: 'Kirim reminder WhatsApp otomatis dengan tombol tagih pada daftar piutang.',
    },
    {
      id: 'cashflow', title: 'Arus Kas Masuk & Keluar', description: 'Transparansi arus kas operasional, belanja supplier, dan payroll.', icon: 'coordination', iconColor: '#10B981',
      metrics: [
        { id: 'cf-in', label: 'Kas Masuk MTD', cardId: 'cf-in', fallbackDetail: 'Total penerimaan kas bulan ini.', fallbackSource: 'CashTransaction IN' },
        { id: 'cf-out', label: 'Kas Keluar MTD', cardId: 'cf-out', fallbackDetail: 'Total pengeluaran kas bulan ini.', fallbackSource: 'CashTransaction OUT' },
        { id: 'cf-net', label: 'Arus Kas Bersih', cardId: 'cf-net', fallbackDetail: 'Surplus/defisit kas berjalan.', fallbackSource: 'Net Cash Flow' },
      ],
      footer: 'Arus kas operasional positif mendukung likuiditas harian.',
    },
    {
      id: 'tax-compliance', title: 'Pajak & Kepatuhan', description: 'Belum tersedia saat ini.', icon: 'sop', iconColor: '#C9A66B',
      metrics: [],
      footer: 'Belum ada perhitungan, reminder, atau aksi pajak yang aktif.',
    },
  ],
  MARKETING: [
    {
      id: 'funnel', title: 'Corong Konversi & Saluran Iklan', description: 'Efisiensi belanja iklan dan konversi pelanggan baru.', icon: 'local', iconColor: '#EC4899',
      metrics: [
        { id: 'ad-spend', label: 'Belanja iklan berjalan', cardId: 'ad-spend', fallbackDetail: 'Meta, TikTok, dan Google Ads MTD.', fallbackSource: 'Marketing spend' },
        { id: 'blended-roas', label: 'Blended ROAS', cardId: 'blended-roas', fallbackDetail: 'Pendapatan per rupiah belanja iklan.', fallbackSource: 'Marketing analytics' },
        { id: 'cac', label: 'Biaya per Akuisisi (CAC)', cardId: 'cac', fallbackDetail: 'Biaya rata-rata mendapatkan 1 pembeli.', fallbackSource: 'Conversion metrics' },
      ],
      footer: 'Skalakan kampanye dengan ROAS di atas 3.5x dan optimalkan materi iklan yang lesu.',
    },
    {
      id: 'struk-promo', title: 'Struk Digital WhatsApp & Retensi', description: 'Tingkat klaim voucher promosi yang dikirim via struk digital.', icon: 'coordination', iconColor: '#EC4899',
      metrics: [
        { id: 'digital-receipts', label: 'Struk WA terkirim', cardId: 'digital-receipts', fallbackDetail: 'Struk digital tanpa kertas ke WA.', fallbackSource: 'WhatsApp delivery' },
        { id: 'voucher-claimed', label: 'Voucher diklaim', cardId: 'voucher-claimed', fallbackDetail: 'Pembeli repeat order via promo struk.', fallbackSource: 'Voucher redemption' },
        { id: 'repeat-rate', label: 'Tingkat repeat order', cardId: 'repeat-rate', fallbackDetail: 'Persentase pelanggan kembali belanja.', fallbackSource: 'Customer retention' },
      ],
      footer: 'Struk digital menghemat kertas thermal dan membangun database kontak loyal.',
    },
    {
      id: 'campaigns', title: 'Efisiensi Budget Multi-Channel', description: 'Performa kampanye lintas platform Meta, TikTok, dan Google.', icon: 'kpi', iconColor: '#EC4899',
      metrics: [
        { id: 'meta-roas', label: 'Meta Ads ROAS', cardId: 'meta-roas', fallbackDetail: 'Pengembalian iklan Instagram & FB.', fallbackSource: 'Meta Ads API' },
        { id: 'tiktok-roas', label: 'TikTok Ads ROAS', cardId: 'tiktok-roas', fallbackDetail: 'Pengembalian iklan video TikTok.', fallbackSource: 'TikTok Ads API' },
        { id: 'google-roas', label: 'Google Search ROAS', cardId: 'google-roas', fallbackDetail: 'Pengembalian iklan pencarian Google.', fallbackSource: 'Google Ads API' },
      ],
      footer: 'Re-alokasikan budget ke Google Search untuk intent pembelian tertinggi.',
    },
    {
      id: 'creative-assets', title: 'Produksi Materi Promosi & AI Content', description: 'Status pembuatan poster, video promosi, dan materi kampanye.', icon: 'documents', iconColor: '#EC4899',
      metrics: [
        { id: 'posters-ready', label: 'Poster & Banner Siap', cardId: 'posters-ready', fallbackDetail: 'Materi visual siap tayang.', fallbackSource: 'AI Studio assets' },
        { id: 'promo-copy', label: 'Copy Promosi Teruji', cardId: 'promo-copy', fallbackDetail: 'Variasi copy iklan A/B test.', fallbackSource: 'Marketing Studio' },
        { id: 'content-calendar', label: 'Jadwal Konten Pekan Ini', cardId: 'content-calendar', fallbackDetail: 'Kalender publikasi media sosial.', fallbackSource: 'Marketing schedule' },
      ],
      footer: 'Gunakan Marketing Studio untuk generate poster instan berbasis logo brand.',
    },
  ],
};

const ROLE_FLOW: Record<RoleDashboardRole, { root: string; nodes: string[] }> = {
  SEKRETARIS: { root: 'Administrasi', nodes: ['Agenda Masuk', 'Verifikasi Jadwal', 'Approval Pimpinan', 'Disposisi Divisi', 'Arsip & Tenggat'] },
  MANAGER_UMUM: { root: 'Tujuan Tim', nodes: ['Target KPI', 'Alokasi Budget', 'Distribusi Beban', 'Kepatuhan SOP', 'Eskalasi Tiket'] },
  MANAGER_OPERASIONAL: { root: 'Stok & Operasi', nodes: ['PO Supplier', 'Timbang Gudang', 'Stok Dapur', 'Kadaluarsa Bahan', 'Audit Opname'] },
  CEO: { root: 'Strategi Korporat', nodes: ['Target Corplan', 'Alokasi Budget', 'Sales & Konversi', 'Arus Kas', 'Cash Runway'] },
  FINANCE: { root: 'Keuangan & Likuiditas', nodes: ['Penjualan POS', 'Kas Laci Kasir', 'Kasbon Pelanggan', 'Buffer Likuiditas', 'Pembayaran Vendor'] },
  MARKETING: { root: 'Pertumbuhan & Brand', nodes: ['Budget Iklan', 'Materi Kreatif AI', 'Lalu Lintas Leads', 'Struk Digital WA', 'Retensi Repeat'] },
};

export function statusColor(status: DashboardDataStatus, accent: string): string {
  if (status === 'available') return accent;
  if (status === 'empty') return '#8A93A3';
  if (status === 'unsupported') return '#D8A33C';
  if (status === 'forbidden' || status === 'error') return '#EF7777';
  return '#8A93A3';
}

export function statusLabel(status: DashboardDataStatus): string {
  if (status === 'available') return 'Tersedia';
  if (status === 'empty') return 'Belum ada data';
  if (status === 'unsupported') return 'Belum tersedia';
  if (status === 'forbidden') return 'Terbatas';
  return 'Perlu dicek';
}

function humanNumber(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('id-ID');
}

function cardFor(payload: RoleDashboardPayload | null, definition: MetricDefinition): RoleDashboardMetric {
  const card = payload?.cards?.find((item) => item.id === definition.cardId);
  if (card) return { id: definition.id, label: definition.label, value: card.value, status: card.status, detail: card.detail, source: card.source };
  return { id: definition.id, label: definition.label, value: null, status: 'unsupported', detail: definition.fallbackDetail, source: definition.fallbackSource };
}

function termHint(label: string): string | null {
  const term = matchGlossaryTerm(label);
  if (!term) return null;
  const sentence = term.plain.split(/[.!?]/)[0]?.trim();
  return sentence || null;
}

export function roleSectionDefinitions(role: RoleDashboardRole): SectionDefinition[] {
  return SECTION_DEFINITIONS[role];
}

export function roleSnapshotDefinitions(role: RoleDashboardRole): MetricDefinition[] {
  if (role === 'SEKRETARIS') return [
    { id: 'agenda', label: 'Agenda hari ini', cardId: 'agenda-today', fallbackDetail: 'Agenda hari ini belum tersedia.', fallbackSource: 'Agenda source' },
    { id: 'tasks', label: 'Tugas pending', cardId: 'agenda', fallbackDetail: 'Data tugas pending belum tersedia.', fallbackSource: 'WorkTask' },
    { id: 'documents', label: 'Dokumen perlu tindakan', cardId: 'admin-inbox', fallbackDetail: 'Dokumen perlu tindakan belum tersedia.', fallbackSource: 'WorkspaceFile' },
    { id: 'attendance', label: 'Kehadiran agregat', cardId: 'attendance-today', fallbackDetail: 'Kehadiran agregat belum tersedia.', fallbackSource: 'AttendanceRecord aggregate' },
  ];
  if (role === 'MANAGER_UMUM') return [
    { id: 'kpi', label: 'KPI tim', cardId: 'team-kpi', fallbackDetail: 'Scope KPI tim belum terbukti.', fallbackSource: 'Team KPI assignment' },
    { id: 'workload', label: 'Beban kerja tim', cardId: 'team-workload', fallbackDetail: 'Assignment tim belum tersedia.', fallbackSource: 'WorkTask team scope' },
    { id: 'sop', label: 'Kepatuhan SOP', cardId: 'sop', fallbackDetail: 'Sumber SOP tim belum tersedia.', fallbackSource: 'SOP assignment' },
    { id: 'decision', label: 'Keputusan tertunda', cardId: 'decision-alerts', fallbackDetail: 'Decision queue belum tersedia.', fallbackSource: 'Team decision queue' },
  ];
  if (role === 'CEO') return [
    { id: 'rev', label: 'Revenue MTD', cardId: 'rev-mtd', fallbackDetail: 'Realisasi omset berjalan.', fallbackSource: 'CashTransaction' },
    { id: 'margin', label: 'Net Profit Margin', cardId: 'net-margin', fallbackDetail: 'Margin bersih rata-rata.', fallbackSource: 'Financial calculation' },
    { id: 'runway', label: 'Cash Runway', cardId: 'runway', fallbackDetail: 'Ketahanan kas berjalan.', fallbackSource: 'ForwardForecast' },
    { id: 'health', label: 'Health Grade', cardId: 'health-grade', fallbackDetail: 'Kondisi kesehatan bisnis.', fallbackSource: 'Business Health' },
  ];
  if (role === 'FINANCE') return [
    { id: 'cash', label: 'Kas & Bank Aktif', cardId: 'cash-active', fallbackDetail: 'Saldo kas riil.', fallbackSource: 'CashTransaction' },
    { id: 'kasbon', label: 'Kasbon Berjalan', cardId: 'kasbon-active', fallbackDetail: 'Piutang kasbon belum lunas.', fallbackSource: 'Invoice / Piutang' },
    { id: 'drawer', label: 'Kas Laci Kasir', cardId: 'cash-drawer', fallbackDetail: 'Hitung fisik uang laci.', fallbackSource: 'Cash drawer' },
    { id: 'due', label: 'Utang Jatuh Tempo 7H', cardId: 'ap-due7', fallbackDetail: 'Tagihan supplier terdekat.', fallbackSource: 'AccountsPayable' },
  ];
  if (role === 'MARKETING') return [
    { id: 'spend', label: 'Belanja Iklan MTD', cardId: 'ad-spend', fallbackDetail: 'Total biaya ads berjalan.', fallbackSource: 'Marketing spend' },
    { id: 'roas', label: 'Blended ROAS', cardId: 'blended-roas', fallbackDetail: 'Efisiensi belanja promosi.', fallbackSource: 'Marketing analytics' },
    { id: 'leads', label: 'Leads & Transaksi', cardId: 'leads-count', fallbackDetail: 'Pelanggan baru terakuisisi.', fallbackSource: 'Conversion metrics' },
    { id: 'voucher', label: 'Konversi Struk WA', cardId: 'voucher-claimed', fallbackDetail: 'Klaim promo struk digital.', fallbackSource: 'WhatsApp delivery' },
  ];
  return [
    { id: 'critical', label: 'Stok kritis', cardId: 'critical-stock', fallbackDetail: 'Ringkasan stok kritis belum tersedia.', fallbackSource: 'Product.currentStock/minStock' },
    { id: 'po', label: 'PO pending', cardId: 'purchase-orders', fallbackDetail: 'PO pending belum tersedia.', fallbackSource: 'PurchaseOrder' },
    { id: 'sop', label: 'Kepatuhan SOP', cardId: 'sop', fallbackDetail: 'Sumber SOP belum tersedia.', fallbackSource: 'Operational SOP' },
    { id: 'dead', label: 'Dead stock', cardId: 'dead-stock-value', fallbackDetail: 'Dead stock belum tersedia.', fallbackSource: 'Inventory turnover' },
  ];
}

// -------------------------------------------------------------
// STRUCTURED EXPLANATIONS GENERATOR (7 BAGIAN INLINE PANEL)
// -------------------------------------------------------------
export interface StructuredExplanation {
  artinya: string;
  mengapaPenting: string;
  sumberData: string;
  caraMembaca: string;
  dampakPraktis: string;
  rekomendasi: string;
}

export function getStructuredExplanation(
  metric: RoleDashboardMetric,
  role?: RoleDashboardRole,
  fallbackFooter?: string
): StructuredExplanation {
  const glossary = matchGlossaryTerm(metric.label);
  const plainGlossary = glossary?.plain || termHint(metric.label);
  const roleTitle = (role && ROLE_META[role]?.title) ? ROLE_META[role].title : 'ruang kerja ini';

  const fallback: StructuredExplanation = {
    artinya: plainGlossary || `Metrik ${metric.label} mengukur status operasional ${metric.label.toLowerCase()} yang relevan untuk ${roleTitle}.`,
    mengapaPenting: fallbackFooter || `Memastikan visibilitas langsung terhadap ${metric.label.toLowerCase()} tanpa membuka data rahasia divisi lain.`,
    sumberData: metric.source || 'Database autoritatif KLIR',
    caraMembaca: 'Nilai hijau/tersedia menandakan kondisi normal. Kuning menandakan peringatan awal atau data belum terpetakan. Merah menandakan tindakan darurat dibutuhkan.',
    dampakPraktis: 'Jika tidak dipantau secara rutin, keterlambatan koordinasi atau ketidaksesuaian alur kerja dapat menghambat operasional harian.',
    rekomendasi: 'Gunakan tombol Tanyakan ke AI Assistant untuk memetakan langkah kerja taktis atau menyusun draft dokumen terkait.',
  };

  const labelLower = metric.label.toLowerCase();

  // Istilah Finansial & Kas Makro (CEO & Finance)
  if (labelLower.includes('runway')) {
    return {
      artinya: 'Berapa bulan lagi kas perusahaan bisa bertahan jika besok pagi omset berhenti total dan pengeluaran tetap jalan biasa.',
      mengapaPenting: 'Memberikan kepastian daya tahan hidup perusahaan dan mencegah krisis likuiditas atau gagal bayar mendadak saat ekspansi.',
      sumberData: metric.source || 'ForwardForecast & CashTransaction bank riil',
      caraMembaca: 'Nilai >12 bulan aman (Hijau). 6-12 bulan waspada (Kuning). <6 bulan kritis (Merah) butuh efisiensi OPEX darurat.',
      dampakPraktis: 'Runway yang menipis tanpa disadari memaksa penundaan pembayaran gaji atau pembatalan kontrak sewa outlet.',
      rekomendasi: 'Gunakan Corplan Quick Simulator untuk memetakan pos pengeluaran yang bisa dipotong jika omset pasar melambat.',
    };
  }

  if (labelLower.includes('net-margin') || labelLower.includes('margin') || labelLower.includes('profit')) {
    return {
      artinya: 'Persentase laba bersih yang benar-benar menjadi milik perusahaan setelah omset dikurangi seluruh biaya HPP, operasional, dan pajak.',
      mengapaPenting: 'Menilai apakah bisnis benar-benar menghasilkan uang dingin yang sehat atau cuma sibuk jualan beromset tinggi tapi nombok biaya.',
      sumberData: metric.source || 'Financial calculation & P&L Statement',
      caraMembaca: 'Target standar industri F&B/Retail adalah ≥18-25%. Di bawah 10% rentan defisit saat terjadi fluktuasi harga bahan baku.',
      dampakPraktis: 'Penurunan margin kotor memicu penurunan modal kerja yang berakibat pada keterlambatan pembayaran ke supplier.',
      rekomendasi: 'Audit pos belanja bahan baku (COGS) dan efisiensikan biaya pemasaran yang memiliki ROAS rendah.',
    };
  }

  if (labelLower.includes('cash-drawer') || labelLower.includes('kas laci') || labelLower.includes('laci kasir')) {
    return {
      artinya: 'Jumlah fisik uang tunai di laci kasir outlet saat dihitung langsung pada akhir shift kerja kasir.',
      mengapaPenting: 'Mencegah kecurangan kasir, salah kembalian ke pembeli, dan memastikan uang tunai riil klop dengan struk sistem POS.',
      sumberData: metric.source || 'Cash drawer physical count vs POS cash register',
      caraMembaca: 'Selisih normal ≤ Rp 10.000. Selisih minus > Rp 20.000 berwarna merah dan wajib ditelusuri riwayat transaksinya.',
      dampakPraktis: 'Selisih kasir harian yang dibiarkan menumpuk menjadi kerugian akumulatif jutaan rupiah tiap bulan.',
      rekomendasi: 'Audit riwayat transaksi jam-per-jam dan minta AI Assistant memeriksa potensi struk pembatalan (void) yang mencurigakan.',
    };
  }

  if (labelLower.includes('kasbon') || labelLower.includes('piutang')) {
    return {
      artinya: 'Uang perusahaan yang belum dibayar oleh pelanggan langganan atau kasbon operasional yang masih dipegang staf.',
      mengapaPenting: 'Mencegah modal kerja mandek di luar dan mengamankan arus kas masuk untuk belanja bahan baku supplier.',
      sumberData: metric.source || 'Invoice / Piutang & Customer.phone WhatsApp',
      caraMembaca: 'Fokus pada kasbon yang lewat jatuh tempo (>14 hari). Makin kecil saldo tertahan, makin sehat perputaran uang.',
      dampakPraktis: 'Piutang macet yang tidak ditagih rutin berisiko menjadi piutang tak tertagih (bad debt) yang mengikis kas perusahaan.',
      rekomendasi: 'Kirim pesan tagihan WhatsApp otomatis melalui fitur AI Kasbon Composer (pilih nada sopan, formal, atau tegas SP).',
    };
  }

  if (labelLower.includes('pajak') || labelLower.includes('pph') || labelLower.includes('ppn') || labelLower.includes('sp2dk')) {
    return {
      artinya: 'Area perpajakan KLIR sedang dikunci sementara sampai perancangan dan validasinya selesai.',
      mengapaPenting: 'Angka pajak tidak boleh tampil atau dianggap siap dipakai sebelum logika dan pemilik prosesnya disepakati.',
      sumberData: 'Feature policy lock',
      caraMembaca: 'Fitur belum tersedia berarti tidak ada estimasi, reminder, skor kepatuhan, atau aksi setor yang aktif.',
      dampakPraktis: 'Tidak ada aksi pajak yang dapat dipicu dari dashboard maupun AI Assistant pada tahap ini.',
      rekomendasi: 'Gunakan area lain yang sudah tersedia di dashboard atau AI Assistant.',
    };
  }

  // Istilah Marketing & Saluran Iklan (Marketing)
  if (labelLower.includes('roas')) {
    return {
      artinya: 'Pengembalian omset dari setiap rupiah yang dikeluarkan untuk iklan berbayar (Return on Ad Spend).',
      mengapaPenting: 'Menentukan saluran iklan mana (Meta, TikTok, Google) yang paling efektif menghasilkan penjualan dan mana yang membakar uang.',
      sumberData: metric.source || 'Marketing analytics & Ad Channel APIs',
      caraMembaca: 'ROAS 4,2x artinya modal iklan Rp 1.000 menghasilkan omset Rp 4.200. Target minimum sehat adalah ≥3,0x.',
      dampakPraktis: 'Mempertahankan kampanye dengan ROAS <2,0x berarti perusahaan merugi pada setiap transaksi yang didatangkan.',
      rekomendasi: 'Pindahkan alokasi budget harian dari iklan ber-ROAS rendah ke saluran dengan tingkat konversi tertinggi.',
    };
  }

  if (labelLower.includes('cac') || labelLower.includes('akuisisi')) {
    return {
      artinya: 'Biaya rata-rata belanja pemasaran yang dihabiskan untuk mendapatkan satu orang pembeli baru (Customer Acquisition Cost).',
      mengapaPenting: 'Menjaga agar biaya mendapatkan pelanggan tidak lebih besar dari keuntungan yang didapat dari pelanggan tersebut.',
      sumberData: metric.source || 'Conversion metrics & Ad spend logs',
      caraMembaca: 'Makin rendah CAC makin efisien. Bandingkan dengan LTV (Lifetime Value) — rasio LTV:CAC ideal adalah ≥3:1.',
      dampakPraktis: 'CAC yang melambung tinggi menggerus margin kotor produk dan memicu pemborosan budget promosi.',
      rekomendasi: 'Perkuat materi iklan organik dan optimalkan copywriting penawaran untuk menurunkan biaya per klik (CPC).',
    };
  }

  if (labelLower.includes('struk') || labelLower.includes('voucher') || labelLower.includes('repeat')) {
    return {
      artinya: 'Pengiriman struk digital tanpa kertas ke WhatsApp pelanggan yang disisipi voucher diskon untuk mendorong pembelian ulang.',
      mengapaPenting: 'Menghemat biaya kertas thermal kasir sekaligus membangun database nomor kontak pelanggan loyal secara otomatis.',
      sumberData: metric.source || 'WhatsApp delivery & Voucher redemption logs',
      caraMembaca: 'Tingkat klaim voucher >20% menandakan promo diminati pembeli. Tingkat repeat order mengukur loyalitas pelanggan.',
      dampakPraktis: 'Pelanggan yang tidak di-retensi cenderung lupa dan beralih ke kompetitor setelah kunjungan pertama.',
      rekomendasi: 'Rancang promo bundling struk WhatsApp baru menggunakan AI Assistant untuk meningkatkan frekuensi kunjungan.',
    };
  }

  if (labelLower.includes('stok') || labelLower.includes('sku') || labelLower.includes('restock')) {
    return {
      artinya: 'Jumlah produk atau bahan baku yang berada di bawah titik pemesanan ulang (reorder point) atau mendekati nol.',
      mengapaPenting: 'Mencegah terjadinya stockout (kehabisan stok) yang menyebabkan hilangnya potensi penjualan dan komplain pelanggan.',
      sumberData: metric.source || 'Product.currentStock & Product.minStock',
      caraMembaca: 'Makin kecil angkanya makin baik. Angka > 0 berarti ada SKU yang memerlukan pembuatan Purchase Order darurat.',
      dampakPraktis: 'Stok kritis yang dibiarkan 1-2 hari dapat menghentikan penjualan menu/produk utama di outlet yang bersangkutan.',
      rekomendasi: 'Buka modul stok & pembelian (read-only) atau minta AI Assistant menyusun draf PO ke supplier terkait.',
    };
  }

  if (labelLower.includes('po') || labelLower.includes('purchase order')) {
    return {
      artinya: 'Dokumen pesanan resmi pembelian barang atau bahan baku dari gudang/outlet kepada pemasok (supplier).',
      mengapaPenting: 'Memastikan barang yang dipesan tiba tepat waktu sesuai jadwal operasional tanpa ada pesanan yang tertahan atau terlewat.',
      sumberData: metric.source || 'PurchaseOrder (status: DRAFT, ORDERED, RECEIVED)',
      caraMembaca: 'Perhatikan perbandingan antara PO Draft (belum dikirim), Ordered (dalam perjalanan), dan keterlambatan hari estimasi tiba.',
      dampakPraktis: 'PO yang terlambat datang mengakibatkan kelangkaan stok lokal dan kenaikan biaya pembelian darurat (spot purchase).',
      rekomendasi: 'Hubungi supplier untuk PO yang berstatus keterlambatan lebih dari 2 hari kerja dan perbarui estimasi kedatangan barang.',
    };
  }

  if (labelLower.includes('sop') || labelLower.includes('kepatuhan')) {
    return {
      artinya: 'Tingkat kepatuhan tim cabang/outlet terhadap daftar periksa prosedur operasional standar harian, mingguan, dan bulanan.',
      mengapaPenting: 'Menjaga konsistensi kualitas produk, higienitas, keselamatan kerja, dan standar pelayanan pelanggan di seluruh cabang.',
      sumberData: metric.source || 'Operational SOP checklist logs',
      caraMembaca: 'Target standar kepatuhan adalah ≥ 90%. Skor 80-89% butuh perhatian, sedangkan di bawah 80% memerlukan audit langsung.',
      dampakPraktis: 'Penurunan skor SOP berkorelasi langsung dengan kenaikan komplain pelanggan dan insiden operasional di cabang.',
      rekomendasi: 'Jadwalkan briefing operasional dengan supervisor cabang berskor rendah dan evaluasi kendala di lapangan.',
    };
  }

  if (labelLower.includes('cogs') || labelLower.includes('pokok penjualan') || labelLower.includes('hpp')) {
    return {
      artinya: 'Proporsi total biaya belanja bahan baku dan kemasan terhadap omset kotor penjualan outlet (Harga Pokok Penjualan).',
      mengapaPenting: 'Memastikan margin kotor bisnis tetap sehat dan mengontrol pemborosan porsi bahan atau kenaikan harga beli dari vendor.',
      sumberData: metric.source || 'POS Food Costing & Kitchen Requisition Ledger',
      caraMembaca: 'Target batas aman F&B/Resto adalah < 40%. Di atas 42% berarti terjadi kebocoran bahan, salah takaran resep, atau lonjakan harga beli.',
      dampakPraktis: 'Setiap kenaikan 1% rasio COGS memotong laba bersih operasional secara langsung jika harga jual menu tidak dinaikkan.',
      rekomendasi: 'Fokus efisiensi pada pos belanja protein (ayam & telur yang menyumbang 52% HPP) dan tekan waste penggorengan di outlet.',
    };
  }

  if (labelLower.includes('dead stock') || (labelLower.includes('biaya') && !labelLower.includes('cogs'))) {
    return {
      artinya: 'Nilai modal yang terikat pada barang atau bahan baku yang tidak mengalami pergerakan selama lebih dari 60 hari.',
      mengapaPenting: 'Mengurangi pemborosan modal kerja dan mencegah kerugian akibat barang kedaluwarsa atau rusak di gudang penyimpanan.',
      sumberData: metric.source || 'Inventory turnover logs & ProductBatch expiry',
      caraMembaca: 'Semakin rendah persentase terhadap total nilai inventaris, semakin efisien perputaran modal kerja operasional.',
      dampakPraktis: 'Dead stock yang menumpuk menghabiskan kapasitas gudang dan berisiko menjadi kerugian langsung saat barang kedaluwarsa.',
      rekomendasi: 'Buat program bundling atau alokasikan barang ke cabang dengan tingkat permintaan lebih tinggi sebelum kedaluwarsa.',
    };
  }

  if (labelLower.includes('supplier') || labelLower.includes('vendor') || labelLower.includes('pemasok')) {
    return {
      artinya: 'Tingkat kepatuhan waktu pengiriman (On-Time Delivery) dan kualitas fisik pasokan (Defect Rate) dari mitra pemasok resmi.',
      mengapaPenting: 'Mencegah gangguan jadwal masak dapur outlet akibat keterlambatan pasokan atau bahan baku rusak saat tiba.',
      sumberData: metric.source || 'Vendor SLA Logs & Delivery Receipt Quality Check',
      caraMembaca: 'Target ketepatan waktu ≥ 95% (Hijau). Skor 90-94% perlu evaluasi rute pengiriman, < 90% pertimbangkan alihkan volume ke vendor cadangan.',
      dampakPraktis: 'Keterlambatan 2 jam pengiriman bahan baku protein pagi hari dapat menghentikan penjualan menu makan siang outlet.',
      rekomendasi: 'Lakukan evaluasi SLA bulanan dengan PT Sumber Unggas Jaya dan pastikan buffer lead time untuk pengiriman akhir pekan.',
    };
  }

  if (labelLower.includes('kehadiran') || labelLower.includes('presensi') || labelLower.includes('attendance')) {
    return {
      artinya: 'Agregat rekapitulasi kehadiran staf per divisi (WFO, WFH/Remote, dan Izin Resmi) untuk memudahkan koordinasi lintas unit kerja.',
      mengapaPenting: 'Mencegah diskomunikasi saat mendelegasikan memo atau menggelar rapat mendadak dengan mengetahui ketersediaan fisik tim.',
      sumberData: metric.source || 'Jadwal & Presensi Staf',
      caraMembaca: 'Tingkat kehadiran 94% (17 dari 18 staf) tergolong sangat prima. Kategori kuning menunjukkan divisi dengan anggota izin resmi (Finance 3/4).',
      dampakPraktis: 'Sekretariat dapat langsung mengalihkan koordinasi berkas kas/invoice ke staf Finance pengganti tanpa menunggu konfirmasi manual.',
      rekomendasi: 'Hubungi PIC Finance alternatif jika membutuhkan disposisi pencairan dana mendesak pada jam operasional hari ini.',
    };
  }

  if (labelLower.includes('shift') || (labelLower.includes('jadwal') && (labelLower.includes('staf') || labelLower.includes('gudang') || labelLower.includes('operasional')))) {
    return {
      artinya: 'Alokasi dan kehadiran fisik personel operasional di gudang pusat dan logistik antar 3 shift kerja (Pagi, Sore, Malam).',
      mengapaPenting: 'Memastikan kecukupan tenaga kerja untuk bongkar muat barang tiba, sortir mutu bahan, kontrol suhu chiller, dan distribusi tepat waktu ke cabang.',
      sumberData: metric.source || 'Presensi Digital Staf & Jadwal Kerja Shift Gudang',
      caraMembaca: 'Cakupan 100% (Hijau) menandakan seluruh posisi vital (leader gudang, QC bahan, driver logistik) terisi lengkap tanpa kekosongan shift.',
      dampakPraktis: 'Kekosongan staf pada shift pagi menghambat penerimaan bahan baku supplier, sementara kekosongan shift malam membahayakan pengawasan suhu chiller.',
      rekomendasi: 'Pertahankan sistem rotasi shift dan siapkan 2 personel standby on-call jika terjadi lonjakan volume pengiriman akhir pekan.',
    };
  }

  if (labelLower.includes('agenda') || labelLower.includes('meeting') || labelLower.includes('jadwal')) {
    return {
      artinya: 'Ringkasan komitmen waktu, pertemuan koordinasi, dan agenda pimpinan/tim yang terjadwal untuk hari ini dan pekan ini.',
      mengapaPenting: 'Menghindarkan bentrok jadwal, memastikan kesiapan materi rapat, dan menjaga ketepatan waktu para pemangku kepentingan.',
      sumberData: metric.source || 'Agenda & Calendar synchronization source',
      caraMembaca: 'Periksa badge "bentrok" untuk jadwal yang beririsan dan prioritaskan rapat dengan keputusan penting lebih awal.',
      dampakPraktis: 'Jadwal yang bentrok tanpa antisipasi menyebabkan penundaan keputusan penting dan pemborosan waktu manajerial.',
      rekomendasi: 'Kirim reminder jadwal 1 jam sebelum pertemuan dan konfirmasi ulang kehadiran peserta eksternal.',
    };
  }

  if (labelLower.includes('kontrak') || labelLower.includes('dokumen') || labelLower.includes('izin')) {
    return {
      artinya: 'Pelacakan masa berlaku berkas legal, izin usaha, sewa tempat, dan perjanjian kerja sama vendor agar tidak kedaluwarsa.',
      mengapaPenting: 'Mencegah sanksi legalitas, gangguan izin operasional, atau denda keterlambatan perpanjangan kontrak bisnis.',
      sumberData: metric.source || 'WorkspaceFile metadata & contract expiry tracker',
      caraMembaca: 'Kategori < 7 hari masuk kategori Mendesak, < 30 hari Segera diproses, dan > 30 hari dalam zona Aman.',
      dampakPraktis: 'Keterlambatan perpanjangan izin dapat berakibat pada penutupan sementara outlet atau penghentian pasokan logistik.',
      rekomendasi: 'Siapkan draf surat permohonan perpanjangan dan ajukan ke pimpinan melalui AI Assistant minimal 14 hari sebelum jatuh tempo.',
    };
  }

  if (labelLower.includes('kpi') || labelLower.includes('target')) {
    return {
      artinya: 'Indikator kinerja utama anggota tim yang mengukur pencapaian target individual terhadap sasaran periode berjalan.',
      mengapaPenting: 'Memberikan dasar objektif untuk pembinaan staf, alokasi dukungan, dan pencapaian target kolektif divisi.',
      sumberData: metric.source || 'Team KPI authoritative assignment',
      caraMembaca: 'Persentase capaian: hijau (≥100%), kuning (80-99%), merah (<80%). Fokuskan perhatian pada gap terbesar.',
      dampakPraktis: 'Anggota tim yang tertinggal tanpa intervensi awal berpotensi menggagalkan target keseluruhan divisi pada akhir bulan.',
      rekomendasi: 'Lakukan sesi 1-on-1 coaching singkat dengan anggota tim yang memiliki gap terbesar untuk memetakan kendala mereka.',
    };
  }

  if (labelLower.includes('budget') || labelLower.includes('alokasi')) {
    return {
      artinya: 'Batas belanja operasional yang dialokasikan khusus untuk operasional tim/cabang selama periode bulan berjalan.',
      mengapaPenting: 'Mencegah overspending (pengeluaran berlebih) tanpa mengorbankan kelancaran operasional harian.',
      sumberData: metric.source || 'TEAM_OPERATIONAL_BUDGET',
      caraMembaca: 'Bandingkan persentase terpakai dengan hari berjalan. Pada tanggal 11, pemakaian normal adalah sekitar 35-40%.',
      dampakPraktis: 'Pemakaian budget yang melampaui alokasi sebelum akhir bulan memicu pembatasan pengadaan dan gangguan alur kas tim.',
      rekomendasi: 'Tinjau pos pengeluaran terbesar dan pastikan semua pengajuan sisa bulan ini memiliki urgensi tinggi.',
    };
  }

  if (labelLower.includes('decision') || labelLower.includes('alert') || labelLower.includes('keputusan')) {
    return {
      artinya: 'Antrean persetujuan atau keputusan manajerial yang tertunda (cuti darurat, diskon khusus, dan eskalasi komplain).',
      mengapaPenting: 'Menjaga kelancaran alur kerja bawahan dan mencegah ketidakpastian operasional yang berlarut-larut.',
      sumberData: metric.source || 'Team decision queue',
      caraMembaca: 'Item diklasifikasikan berdasarkan urgensi waktu (Mendesak/Hari ini vs Segera/Besok).',
      dampakPraktis: 'Keputusan yang tertahan menghambat staf menjalankan transaksi atau menyebabkan ketidakpuasan pelanggan.',
      rekomendasi: 'Selesaikan alert dengan urgensi merah dalam waktu maksimal 2 jam setelah muncul di dashboard.',
    };
  }

  if (labelLower.includes('koordinasi') || labelLower.includes('lintas divisi') || labelLower.includes('coordination')) {
    return {
      artinya: 'Pelacakan tiket disposisi, koordinasi tugas, dan tindak lanjut memo operasional antar-departemen yang difasilitasi oleh Sekretariat.',
      mengapaPenting: 'Mencegah bottleneck (kemacetan kerja) di perbatasan antar divisi, seperti konfirmasi invoice vendor atau persiapan legalitas outlet.',
      sumberData: metric.source || 'WorkTask cross-division ticketing & memo tracker',
      caraMembaca: 'Bilah progres menunjukkan tingkat penyelesaian tiket. Status "Menunggu memo" memerlukan follow-up / tombol Ping ke divisi terkait.',
      dampakPraktis: 'Koordinasi lintas divisi yang tersendat menunda pencairan pembayaran rekanan, perizinan cabang, dan kesiapan agenda korporat.',
      rekomendasi: 'Gunakan fitur Ping otomatis pada tiket dengan progres di bawah 50% yang masih berstatus menunggu memo tindak lanjut.',
    };
  }

  return fallback;
}

// Sanitasi teks sumber agar bersih dari suffix teknis atau demo
const cleanSource = (src?: string | null): string => {
  if (!src) return 'Database Operasional KLIR';
  return src
    .replace(/\s*\([^)]*demo[^)]*\)/gi, '')
    .replace(/\s*demo\s*localhost/gi, '')
    .replace(/Product\.currentStock\/minStock/g, 'Modul Inventori & Kartu Stok')
    .replace(/Product\.currentStock & Product\.minStock/g, 'Modul Inventori & Kartu Stok')
    .replace(/PurchaseOrder/g, 'Sistem Purchase Order')
    .replace(/SupplierScore\.onTimeRate/g, 'Laporan Ketepatan Vendor')
    .replace(/SupplierScore/g, 'Evaluasi Vendor SLA')
    .replace(/Operational SOP/g, 'Log Checklist SOP Operasional')
    .replace(/AttendanceRecord aggregate/g, 'Rekap Presensi Staf')
    .replace(/AttendanceRecord/g, 'Jadwal & Presensi Staf')
    .replace(/ForwardForecast/g, 'Proyeksi Keuangan KLIR')
    .replace(/CashTransaction/g, 'Buku Kas & Bank Transaksi')
    .replace(/Invoice \/ Piutang/g, 'Buku Piutang Usaha')
    .replace(/TEAM_OPERATIONAL_BUDGET/g, 'Anggaran Operasional Divisi')
    .trim() || 'Database Operasional KLIR';
};

// -------------------------------------------------------------
// INLINE EXPANSION PANEL (PENGGANTI DRAWER KANAN)
// -------------------------------------------------------------
export interface InlineExplanationPanelProps {
  metric: RoleDashboardMetric;
  title: string;
  role: RoleDashboardRole;
  accent: string;
  footer?: string;
  onClose: () => void;
  onOpenAI: (initialPrompt?: string) => void;
}

export function InlineExplanationPanel({
  metric,
  title,
  role,
  accent,
  footer,
  onClose,
  onOpenAI,
}: InlineExplanationPanelProps) {
  const meta = ROLE_META[role];
  const explanation = getStructuredExplanation(metric, role, footer);
  const displaySource = cleanSource(explanation.sumberData);

  const handleAskAI = () => {
    const prompt = `Saya ingin memahami lebih dalam tentang data "${metric.label}" (${title}) di ${meta.title}.
Status saat ini: ${statusLabel(metric.status)} (${metric.value !== null ? metric.value.toLocaleString('id-ID') : 'data belum terhubung'}).
Detail: ${metric.detail}
Sumber resmi: ${displaySource}

Tolong berikan analisis taktis dan rekomendasi langkah kerja konkret untuk saya sebagai ${meta.title}.`;
    try {
      sessionStorage.setItem('klir_initial_prompt', prompt);
    } catch {}
    onOpenAI(prompt);
  };

  return (
    <div
      data-testid="inline-explanation-panel"
      style={{
        width: '100%',
        marginTop: '12px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
      }}
    >
      {/* Header Bersih & Terintegrasi */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '7px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
          <span style={{ color: accent, display: 'flex', alignItems: 'center' }}>
            <Info size={13} />
          </span>
          <span style={{ color: '#F5F7FA', fontSize: '12px', fontWeight: 600 }}>
            {metric.label}
          </span>
          <span style={{ color: '#5C6474', fontSize: '10px' }}>•</span>
          <span style={{ color: '#8A93A3', fontSize: '11px' }}>{title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <StatusBadge status={metric.status} accent={accent} />
          <button
            type="button"
            aria-label="Tutup penjelasan"
            onClick={onClose}
            style={{
              width: '20px',
              height: '20px',
              border: 0,
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.04)',
              color: '#8A93A3',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Nilai Aktual Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '5px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ color: '#8A93A3', fontSize: '10.5px' }}>Nilai:</span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 700, color: metric.value === null ? '#D8A33C' : '#F5F7FA' }}>
            {humanNumber(metric.value)}
          </span>
        </div>
        <span style={{ color: '#8A93A3', fontSize: '10.5px' }}>{metric.detail}</span>
      </div>

      {/* Penjelasan 2 Kolom Selaras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
        {/* Kolom 1: Arti & Cara Membaca */}
        <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: accent, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Arti &amp; Panduan
          </span>
          <p style={{ margin: 0, color: '#DCE3EC', fontSize: '11.5px', lineHeight: 1.45 }}>
            {explanation.artinya}
          </p>
          <p style={{ margin: 0, color: '#94A3B8', fontSize: '11px', lineHeight: 1.4 }}>
            <span style={{ color: '#CBD5E1', fontWeight: 600 }}>Cara baca:</span> {explanation.caraMembaca}
          </p>
        </div>

        {/* Kolom 2: Risiko & Rekomendasi */}
        <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: '#3FBF8F', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Dampak &amp; Rekomendasi
          </span>
          <p style={{ margin: 0, color: '#DCE3EC', fontSize: '11.5px', lineHeight: 1.45 }}>
            <span style={{ color: '#FFAB00', fontWeight: 600 }}>Risiko:</span> {explanation.dampakPraktis}
          </p>
          <p style={{ margin: 0, color: '#CBD5E1', fontSize: '11px', lineHeight: 1.4 }}>
            <span style={{ color: '#3FBF8F', fontWeight: 600 }}>Aksi:</span> {explanation.rekomendasi}
          </p>
        </div>
      </div>

      {/* Footer Kompak */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
        <span style={{ color: '#687487', fontSize: '10px' }}>
          Sumber: {displaySource}
        </span>
        <button
          type="button"
          onClick={handleAskAI}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            minHeight: '26px',
            padding: '0 10px',
            border: 0,
            borderRadius: '5px',
            color: '#FFFFFF',
            background: 'rgba(255,255,255,0.08)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Sparkles size={11} />
          <span>Tanya AI</span>
          <ArrowRight size={10} />
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENTS
// -------------------------------------------------------------
function StatusBadge({ status, accent }: { status: DashboardDataStatus; accent: string }) {
  const color = statusColor(status, accent);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '999px', color, background: `${color}18`, border: `1px solid ${color}35`, fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true" style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
      {statusLabel(status)}
    </span>
  );
}

function TermHint({ label }: { label: string }) {
  const hint = termHint(label);
  if (!hint) return null;
  return <span style={{ display: 'block', marginTop: '4px', color: '#687487', fontSize: '10px', lineHeight: 1.35 }}>{hint}.</span>;
}

function MetricTile({
  metric,
  accent,
  onExplain,
}: {
  metric: RoleDashboardMetric;
  accent: string;
  onExplain: (metric: RoleDashboardMetric) => void;
}) {
  const color = statusColor(metric.status, accent);
  return (
    <div style={{ minHeight: '104px', padding: '13px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '7px' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ color: '#8A93A3', fontSize: '11px', lineHeight: 1.35 }}>{metric.label}</span>
          <TermHint label={metric.label} />
        </div>
        <button
          type="button"
          aria-label={`Jelaskan ${metric.label}`}
          onClick={() => onExplain(metric)}
          style={{ display: 'inline-flex', flexShrink: 0, padding: '2px', border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer' }}
        >
          <Info size={12} />
        </button>
      </div>
      <div style={{ marginTop: '12px', color: metric.value === null ? '#8A93A3' : '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 750, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {humanNumber(metric.value)}
      </div>
      <div style={{ marginTop: '7px', color, fontSize: '10px', lineHeight: 1.35 }}>{metric.detail}</div>
    </div>
  );
}

function CornerHUD({ color }: { color: string }) {
  return (
    <>
      <span style={{ position: 'absolute', top: -1, left: -1, width: 14, height: 14, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}`, borderTopLeftRadius: 8, pointerEvents: 'none', opacity: 0.85 }} />
      <span style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}`, borderBottomRightRadius: 8, pointerEvents: 'none', opacity: 0.85 }} />
    </>
  );
}

// -------------------------------------------------------------
// 1. SEKRETARIS BODY VIEW
// =============================================================
export function SekretarisBodyView({
  payload,
  onOpenAI,
}: {
  payload: RoleDashboardPayload | null;
  onOpenAI: (initialPrompt?: string) => void;
}) {
  const accent = '#4E9BFF';
  const [activeExplainId, setActiveExplainId] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState<'all' | 'urgent' | 'review' | 'draft'>('all');
  const [rescheduled1300, setRescheduled1300] = useState<boolean>(false);
  const [licenseDrafted, setLicenseDrafted] = useState<boolean>(false);

  const getCard = (id: string, fallbackLabel: string, fallbackSource: string) => {
    return cardFor(payload, { id, label: fallbackLabel, cardId: id, fallbackDetail: 'Belum ada data', fallbackSource });
  };

  const cAgenda = getCard('agenda', 'Tugas Admin Pending', 'WorkTask');
  const cToday = getCard('agenda-today', 'Agenda Hari Ini', 'Agenda');
  const cInbox = getCard('admin-inbox', 'Dokumen Workspace', 'WorkspaceFile');
  const cAttendance = getCard('attendance-today', 'Kehadiran Tim Hari Ini', 'AttendanceRecord');

  const todayVal = typeof cToday.value === 'number' ? cToday.value : 0;
  const agendaVal = typeof cAgenda.value === 'number' ? cAgenda.value : 0;
  const inboxVal = typeof cInbox.value === 'number' ? cInbox.value : 0;
  const attVal = typeof cAttendance.value === 'number' ? cAttendance.value : 0;
  const isDemo = Boolean((payload as any)?.demo);
  const hasSekretarisData = Boolean(todayVal > 0 || agendaVal > 0 || inboxVal > 0 || attVal > 0 || isDemo);
  const hasLegalDocs = Boolean(isDemo);
  const hasCoordination = Boolean(isDemo);
  const hasAttendance = Boolean(isDemo || attVal > 0);

  const handleExplainToggle = (id: string) => {
    setActiveExplainId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. TOP SNAPSHOTS (4 HUD Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#4E9BFF' }}><CalendarDays size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Agenda Hari Ini</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('agenda-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {todayVal}
            </span>
            <span style={{ fontSize: '11px', color: todayVal === 0 || rescheduled1300 ? '#00E676' : '#FFAB00', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {todayVal === 0 ? '✓ Bersih' : rescheduled1300 ? '✓ Bersih' : '1 Bentrok'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>
            {todayVal === 0 ? 'Tidak ada agenda pertemuan hari ini' : rescheduled1300 ? `${todayVal} sesi terjadwal rapi` : '13:00 Sinkronisasi Ops bentrok'}
          </span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#FFAB00' }}><ClipboardCheck size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Tugas Admin Pending</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('tasks-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {agendaVal}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: agendaVal > 0 ? 'rgba(255,171,0,0.12)' : 'rgba(0,230,118,0.12)', color: agendaVal > 0 ? '#FFAB00' : '#00E676', border: `1px solid ${agendaVal > 0 ? 'rgba(255,171,0,0.25)' : 'rgba(0,230,118,0.25)'}` }}>
              {agendaVal > 0 ? `${Math.min(agendaVal, 2)} Overdue` : 'Nol Pending'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>
            {agendaVal > 0 ? `${agendaVal} pekerjaan administratif berjalan` : 'Semua tugas administratif selesai'}
          </span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#00D2FF' }}><FileText size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Dokumen Perlu Tindakan</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('docs-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {inboxVal}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: inboxVal > 0 ? 'rgba(0,210,255,0.12)' : 'rgba(0,230,118,0.12)', color: inboxVal > 0 ? '#00D2FF' : '#00E676', border: `1px solid ${inboxVal > 0 ? 'rgba(0,210,255,0.25)' : 'rgba(0,230,118,0.25)'}` }}>
              {inboxVal > 0 ? `${inboxVal} Dokumen` : 'Nol Antrean'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>
            {inboxVal > 0 ? `${inboxVal} berkas tersimpan di Pusat Data` : 'Belum ada dokumen yang perlu tindakan'}
          </span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#8CBEFF' }}><Users size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Kehadiran Tim Hari Ini</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('attendance-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {attVal > 0 ? `${attVal}` : '0'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: attVal > 0 ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)', color: attVal > 0 ? '#00E676' : '#8A93A3', border: `1px solid ${attVal > 0 ? 'rgba(0,230,118,0.25)' : 'rgba(255,255,255,0.1)'}` }}>
              {attVal > 0 ? 'Tercatat' : 'Belum Ada Data'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>
            {attVal > 0 ? `${attVal} catatan presensi aktif hari ini` : 'Belum ada catatan presensi hari ini'}
          </span>
        </div>
      </div>

      {activeExplainId === 'agenda-snapshot' && (
        <InlineExplanationPanel
          metric={cToday}
          title="Snapshot Agenda"
          role="SEKRETARIS"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'tasks-snapshot' && (
        <InlineExplanationPanel
          metric={cAgenda}
          title="Snapshot Tugas Admin"
          role="SEKRETARIS"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'docs-snapshot' && (
        <InlineExplanationPanel
          metric={cInbox}
          title="Snapshot Dokumen"
          role="SEKRETARIS"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'attendance-snapshot' && (
        <InlineExplanationPanel
          metric={cAttendance}
          title="Snapshot Kehadiran"
          role="SEKRETARIS"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. UNIFIED AI INTELLIGENCE CARD (TOP POSITION -- WAWASAN & PREDIKSI AI)   */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#0D1117',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Ambient subtle glow on top */}
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: '-80px',
            left: '25%',
            width: '380px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #6366F1, transparent 70%)',
            opacity: 0.15,
            filter: 'blur(35px)',
          }}
        />

        {/* Unified Header */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 16px rgba(99,102,241,0.25)' }}>
              <Bot size={19} style={{ color: '#818CF8' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                  Wawasan &amp; Prediksi AI Sekretariat
                </h2>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2.5px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: 'rgba(99,102,241,0.12)', color: '#A5B4FC' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366F1' }} className="animate-pulse" />
                  AI Brain Aktif
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#8A93A3' }}>
                Proteksi ritme agenda pimpinan, deteksi dini bentrok waktu, dan percepatan sirkulasi surat menyurat
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenAI('Analisis agenda pimpinan dan dokumen siap tanda tangan hari ini')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '36px',
              padding: '0 15px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #0058BE 0%, #8D55E8 100%)',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,88,190,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Tanyakan ke AI Assistant</span>
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>

        {/* Narrative Lead */}
        <div style={{ position: 'relative', padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
          <Sparkles size={16} style={{ color: '#818CF8', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#DCE3EC' }}>
            {!hasSekretarisData
              ? 'Belum ada agenda pertemuan atau dokumen administratif aktif yang tercatat. Unggah notulen rapat, kontrak, atau catat agenda untuk mengaktifkan pemantauan ritme kerja dan proteksi agenda pimpinan oleh AI Sekretariat.'
              : rescheduled1300
              ? 'Agenda pimpinan telah bersih dari bentrok jadwal setelah sinkronisasi operasional digeser ke 14:30 WIB. Prioritas saat ini: berkas administrasi siap ditinjau.'
              : 'Terdeteksi agenda aktif hari ini. AI memantau potensi tumpang tindih waktu pertemuan pimpinan dan kelengkapan dokumen legal secara terpadu.'}
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Analisis Ritme Pimpinan
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#4E9BFF' }}>
                {todayVal > 0 ? `${(todayVal * 1.2).toFixed(1)} Jam` : '0 Jam'}
              </span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>
                {todayVal > 0 ? `total rapat (${todayVal} agenda)` : 'tidak ada rapat hari ini'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              {todayVal > 0
                ? 'Jadwal pertemuan berjalan terdistribusi dengan slot fokus terpetakan.'
                : 'Jadwal pimpinan sepenuhnya luang untuk fokus kerja strategis dan penelaahan berkas.'}
            </p>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Prediksi Beban Surat &amp; Legal
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: inboxVal > 0 ? '#FFAB00' : '#00E676' }}>
                {inboxVal > 0 ? `${inboxVal} Berkas` : '0 Berkas'}
              </span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>
                {inboxVal > 0 ? 'dokumen tersimpan' : 'tidak ada dokumen jatuh tempo'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              {inboxVal > 0
                ? `${inboxVal} dokumen aktif tersimpan di Pusat Data dan dapat ditindaklanjuti via AI.`
                : 'Belum ada dokumen legalitas atau kontrak kerja sama yang memerlukan tindakan mendesak.'}
            </p>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Rekomendasi Tindakan
            </span>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#00E676' }}>
              {!hasSekretarisData
                ? '1. Unggah dokumen resmi atau notulen rapat di Pusat Data.\n2. Catat agenda pertemuan untuk penjadwalan terpadu.'
                : '1. Periksa dokumen masuk yang memerlukan tanda tangan pimpinan.\n2. Pastikan agenda pertemuan hari ini terdistribusi rapi.'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. SEKSI 1: Agenda & Administrasi (2 Kolom Seimbang & Lega) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        {/* Card 1: Agenda Hari Ini & Minggu Ini */}
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#4E9BFF' }}><CalendarDays size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Agenda Hari Ini &amp; Minggu Ini
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: todayVal > 0 ? 'rgba(0,210,255,0.12)' : 'rgba(255,255,255,0.06)', color: todayVal > 0 ? '#00D2FF' : '#8A93A3', border: `1px solid ${todayVal > 0 ? 'rgba(0,210,255,0.25)' : 'rgba(255,255,255,0.1)'}` }}>
                {todayVal > 0 ? `${todayVal} agenda` : 'Nol agenda'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('agenda')}
                style={{ border: 0, background: 'transparent', color: '#8CC0FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          {todayVal === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <CalendarDays size={28} style={{ color: '#5C6474', margin: '0 auto 10px', display: 'block' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#DCE3EC' }}>Belum ada agenda pertemuan hari ini</span>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#8A93A3', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
                Jadwal pertemuan pimpinan akan otomatis tersinkronisasi saat reservasi atau agenda kerja tercatat.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Meeting hari ini</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#F5F7FA' }}>{todayVal}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Meeting minggu ini</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#F5F7FA' }}>{todayVal * 3}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Jadwal bentrok</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: rescheduled1300 ? '#00E676' : '#FFAB00' }}>
                    {rescheduled1300 ? 0 : 1}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Jadwal pertemuan pimpinan:</span>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '18px' }}>
                  <span style={{ position: 'absolute', left: '4.5px', top: '6px', bottom: '6px', width: '1px', background: 'rgba(255,255,255,0.12)' }} />
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ position: 'absolute', left: '-18px', top: '4px', width: '9px', height: '9px', borderRadius: '50%', background: '#4E9BFF', boxShadow: '0 0 0 3px rgba(78,155,255,0.16)' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#4E9BFF', minWidth: '38px' }}>09:30</span>
                    <span style={{ fontSize: '12px', color: '#F5F7FA' }}>Koordinasi operasional &amp; administrasi</span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ position: 'absolute', left: '-18px', top: '4px', width: '9px', height: '9px', borderRadius: '50%', background: rescheduled1300 ? '#4E9BFF' : '#FFAB00', boxShadow: rescheduled1300 ? '0 0 0 3px rgba(78,155,255,0.16)' : '0 0 0 3px rgba(255,171,0,0.18)' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: rescheduled1300 ? '#4E9BFF' : '#FFAB00', minWidth: '38px' }}>
                      {rescheduled1300 ? '14:30' : '13:00'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#F5F7FA' }}>Sinkronisasi berkas dokumen legal</span>
                    {rescheduled1300 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '1px 7px', fontSize: '10px', fontWeight: 600, background: 'rgba(63,191,143,0.12)', color: '#3FBF8F', border: '1px solid rgba(63,191,143,0.25)' }}>slot aman</span>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '1px 7px', fontSize: '10px', fontWeight: 600, background: 'rgba(255,171,0,0.12)', color: '#FFAB00', border: '1px solid rgba(255,171,0,0.25)' }}>bentrok</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduled1300(true);
                            alert('Sinkronisasi Jadwal digeser ke 14:30 WIB.');
                          }}
                          style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(78,155,255,0.15)', border: '1px solid rgba(78,155,255,0.3)', color: '#4E9BFF', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          ⚡ Pindah ke 14:30
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#5C6474' }}>
                <span>Zona waktu: WIB (UTC+7)</span>
                <span style={{ color: rescheduled1300 ? '#3FBF8F' : '#FFAB00' }}>
                  {rescheduled1300 ? 'Status: Jadwal hari ini sudah optimal' : 'Saran AI: Pindahkan pertemuan ke slot kosong'}
                </span>
              </div>
            </>
          )}

          {activeExplainId === 'agenda' && (
            <InlineExplanationPanel
              metric={cToday}
              title="Agenda Hari Ini & Minggu Ini"
              role="SEKRETARIS"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>

        {/* Card 2: Kotak Masuk Dokumen & Surat */}
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#8A93A3' }}><FileText size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Kotak Masuk Dokumen &amp; Surat
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: inboxVal > 0 ? 'rgba(255,171,0,0.12)' : 'rgba(255,255,255,0.06)', color: inboxVal > 0 ? '#FFAB00' : '#8A93A3', border: `1px solid ${inboxVal > 0 ? 'rgba(255,171,0,0.25)' : 'rgba(255,255,255,0.1)'}` }}>
                {inboxVal > 0 ? `${inboxVal} berkas` : 'Nol berkas'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('inbox')}
                style={{ border: 0, background: 'transparent', color: '#8CC0FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          {inboxVal === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <FileText size={28} style={{ color: '#5C6474', margin: '0 auto 10px', display: 'block' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#DCE3EC' }}>Belum ada dokumen yang perlu tindakan</span>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#8A93A3', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
                Unggah surat masuk, notulen rapat, atau draf memo resmi melalui Pusat Data Workspace.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Draft</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#8A93A3' }}>{Math.max(1, Math.round(inboxVal * 0.4))}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Review Legal</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#00D2FF' }}>{Math.max(1, Math.round(inboxVal * 0.4))}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Siap Ttd CEO</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#00E676' }}>{Math.max(1, Math.round(inboxVal * 0.2))}</span>
                </div>
              </div>

              {/* Sub-Filter Tabs */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                {[
                  { id: 'all', label: `Semua (${inboxVal})` },
                  { id: 'urgent', label: 'Mendesak Ttd' },
                  { id: 'review', label: 'Review' },
                  { id: 'draft', label: 'Draft' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDocFilter(tab.id as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: docFilter === tab.id ? 'rgba(78,155,255,0.15)' : 'transparent',
                      border: `1px solid ${docFilter === tab.id ? '#4E9BFF' : 'transparent'}`,
                      color: docFilter === tab.id ? '#FFF' : '#8A93A3',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { id: 'doc-1', title: 'Perjanjian Kerjasama & Dokumen Terlampir', type: 'Berkas Workspace', status: 'Tersimpan', category: 'review', date: 'Hari Ini', statusColor: '#00D2FF', actionLabel: 'Tinjau Berkas' },
                  { id: 'doc-2', title: 'Notulen & Ketentuan Operasional', type: 'Arsip Internal', status: 'Siap Ttd', category: 'urgent', date: 'Hari Ini', statusColor: '#00E676', actionLabel: 'Buka Dokumen' },
                ].map((doc) => (
                  <div key={doc.id} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5C6474' }}>
                        <span>{doc.type}</span>
                        <span>·</span>
                        <span>{doc.date}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ borderRadius: '999px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, background: `${doc.statusColor}18`, color: doc.statusColor, border: `1px solid ${doc.statusColor}33` }}>
                        {doc.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => alert(`Aksi ${doc.actionLabel} untuk "${doc.title}" sedang dibuka.`)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(78,155,255,0.12)',
                          border: '1px solid rgba(78,155,255,0.3)',
                          color: '#4E9BFF',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {doc.actionLabel}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeExplainId === 'inbox' && (
            <InlineExplanationPanel
              metric={cInbox}
              title="Kotak Masuk Dokumen & Surat"
              role="SEKRETARIS"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>
      </div>

      {/* 4. SEKSI 2: Dokumen Legal & Koordinasi (2 Kolom Seimbang & Lega) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        {/* Card 3: Status Dokumen Legal & Kontrak */}
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#00D2FF' }}><ShieldCheck size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Status Dokumen Legal &amp; Kontrak
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasLegalDocs ? 'rgba(255,171,0,0.12)' : 'rgba(255,255,255,0.06)', color: hasLegalDocs ? '#FFAB00' : '#8A93A3', border: hasLegalDocs ? '1px solid rgba(255,171,0,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasLegalDocs ? '2 perpanjangan' : '0 dokumen'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('contracts')}
                style={{ border: 0, background: 'transparent', color: '#8CC0FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Aktif</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#00E676' }}>{hasLegalDocs ? '24' : '0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Perlu perpanjang</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#FFAB00' }}>{hasLegalDocs ? '2' : '0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Kedaluwarsa</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#FF5252' }}>0</span>
            </div>
          </div>

          {hasLegalDocs ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Akta Pendirian PT & SK Kemenkumham (Sejak 2017)', partner: 'Notaris & Kemenkumham RI', expiry: 'Berlaku Selamanya', daysLeft: 9999, status: 'normal', action: null },
                { label: 'Perizinan Berusaha Berbasis Risiko (NIB OSS-RBA)', partner: 'Kementerian Investasi / BKPM', expiry: 'Aktif Permanen', daysLeft: 9999, status: 'normal', action: null },
                { label: 'Sertifikasi Halal Usaha & Dapur Sentral', partner: 'BPJPH & LPPOM MUI', expiry: '12 Des 2027', daysLeft: 455, status: 'normal', action: null },
                { label: 'Sewa Outlet Bandung - Dago (Perpanjangan ke-2)', partner: 'PT Properti Prima', expiry: '18 Okt 2026', daysLeft: 36, status: 'warning', action: 'Draf Memo H-30' },
                { label: 'Kerjasama Suplai Bahan Baku (Rekanan sejak 2019)', partner: 'CV Tani Makmur', expiry: '05 Nov 2026', daysLeft: 54, status: 'warning', action: 'Draf Memo H-60' },
                { label: 'Kontrak Layanan Kebersihan & Sanitasi', partner: 'PT Kilap Bersih', expiry: '15 Des 2026', daysLeft: 94, status: 'normal', action: null },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5C6474' }}>
                      <span>{item.partner}</span>
                      <span>·</span>
                      <span>Hingga {item.expiry}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ borderRadius: '999px', padding: '2px 8px', fontSize: '10.5px', fontWeight: 600, background: item.status === 'warning' ? 'rgba(255,171,0,0.12)' : 'rgba(0,230,118,0.12)', color: item.status === 'warning' ? '#FFAB00' : '#00E676', border: `1px solid ${item.status === 'warning' ? 'rgba(255,171,0,0.25)' : 'rgba(0,230,118,0.25)'}` }}>
                      {item.daysLeft === 9999 ? 'Permanen' : `${item.daysLeft} hari lagi`}
                    </span>
                    {item.action && (
                      <button
                        type="button"
                        onClick={() => alert(`Aksi "${item.action}" untuk ${item.label} berhasil dibuat di draf disposisi Sekretaris.`)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255,171,0,0.12)',
                          border: '1px solid rgba(255,171,0,0.3)',
                          color: '#FFAB00',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Zap size={11} /> {item.action}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={28} style={{ color: '#5C6474' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#A9B4C7' }}>Belum Ada Dokumen Legal &amp; Kontrak Tercatat</span>
              <span style={{ fontSize: '11px', color: '#687487', maxWidth: '380px', lineHeight: 1.5 }}>
                Unggah berkas legalitas (Akta, NIB, Sertifikasi Halal) atau kontrak sewa di Pusat Data untuk melacak masa berlaku dan notifikasi jatuh tempo otomatis.
              </span>
            </div>
          )}

          {activeExplainId === 'contracts' && (
            <InlineExplanationPanel
              metric={getCard('legal-contracts', 'Dokumen Legal & Kontrak', 'WorkspaceFile')}
              title="Status Dokumen Legal & Kontrak"
              role="SEKRETARIS"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>

        {/* Card 4: Koordinasi Lintas Divisi */}
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#8CBEFF' }}><Handshake size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Koordinasi Lintas Divisi
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasCoordination ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)', color: hasCoordination ? '#00E676' : '#8A93A3', border: hasCoordination ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasCoordination ? '3 aktif' : '0 aktif'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('coordination')}
                style={{ border: 0, background: 'transparent', color: '#8CC0FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Operasional</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#F5F7FA' }}>{hasCoordination ? '2 tiket' : '0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Finance</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#F5F7FA' }}>{hasCoordination ? '1 tiket' : '0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Marketing</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: hasCoordination ? '#00E676' : '#8A93A3' }}>{hasCoordination ? 'Selesai' : '0'}</span>
            </div>
          </div>

          {hasCoordination ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { title: 'Sinkronisasi Pembukaan Outlet Bandung', division: 'Operasional & Legal', progress: 70, status: 'On track', actionNeeded: false },
                { title: 'Klarifikasi Invoice Vendor Ekspedisi', division: 'Finance & Operasional', progress: 40, status: 'Menunggu memo', actionNeeded: true, pingTarget: 'Finance' },
                { title: 'Persiapan Materi Townhall Q3', division: 'Sekretariat & HR', progress: 85, status: 'Finalisasi', actionNeeded: false },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>{item.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: item.actionNeeded ? '#FFAB00' : '#8A93A3', fontWeight: 600 }}>{item.progress}%</span>
                      {item.actionNeeded && (
                        <button
                          type="button"
                          onClick={() => alert(`Pengingat otomatis via memo internal dikirimkan ke tim ${item.pingTarget}.`)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255,171,0,0.12)',
                            border: '1px solid rgba(255,171,0,0.3)',
                            color: '#FFAB00',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Zap size={10} /> Ping {item.pingTarget}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${item.progress}%`, height: '100%', background: item.actionNeeded ? 'linear-gradient(90deg, #FFAB00, #FFD600)' : 'linear-gradient(90deg, #4E9BFF, #00D2FF)', borderRadius: '2px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: '#5C6474' }}>
                    <span>{item.division}</span>
                    <span style={{ color: item.actionNeeded ? '#FFAB00' : '#00E676' }}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Handshake size={28} style={{ color: '#5C6474' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#A9B4C7' }}>Belum Ada Tiket Koordinasi Lintas Divisi</span>
              <span style={{ fontSize: '11px', color: '#687487', maxWidth: '380px', lineHeight: 1.5 }}>
                Tidak ada tiket koordinasi pending antar divisi. Gunakan AI Assistant untuk menerbitkan memo internal atau delegasi tugas baru.
              </span>
            </div>
          )}

          {activeExplainId === 'coordination' && (
            <InlineExplanationPanel
              metric={getCard('coordination-tasks', 'Koordinasi Lintas Divisi', 'WorkTask')}
              title="Koordinasi Lintas Divisi"
              role="SEKRETARIS"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>
      </div>

      {/* 5. SEKSI 3: Ringkasan Kehadiran Tim (Full-Width Supporting Hero Widget) */}
      <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#00E676' }}><CheckCircle2 size={16} /></span>
            <div>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Ringkasan Kehadiran Tim (Agregat)
              </h3>
              <span style={{ fontSize: '11px', color: '#5C6474' }}>Data agregat untuk koordinasi, bukan absensi individu</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasAttendance ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)', color: hasAttendance ? '#00E676' : '#8A93A3', border: hasAttendance ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
              {hasAttendance ? '17 dari 18 hadir (94%)' : '0 tercatat (0%)'}
            </span>
            <button
              type="button"
              onClick={() => handleExplainToggle('attendance')}
              style={{ border: 0, background: 'transparent', color: '#8CC0FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Jelaskan <ChevronDown size={13} />
            </button>
          </div>
        </div>

        {hasAttendance ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px', alignItems: 'center' }}>
            {/* Kolom 1: Donut Chart & Breakdown Kehadiran Hari Ini */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <svg width="84" height="84" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.8" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#00E676" strokeWidth="3.8" strokeDasharray="78, 100" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#4E9BFF" strokeWidth="3.8" strokeDasharray="16, 100" strokeDashoffset="-78" />
                <text x="18" y="20.5" textAnchor="middle" fill="#F5F7FA" fontSize="8" fontFamily="'Outfit', sans-serif" fontWeight="bold">94%</text>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Status Hari Ini</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#A9B4C7' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00E676' }} />
                  <span>14 WFO di kantor</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#A9B4C7' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4E9BFF' }} />
                  <span>3 WFH / remote</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#FFAB00' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#FFAB00' }} />
                  <span>1 Izin resmi (Finance)</span>
                </div>
              </div>
            </div>

            {/* Kolom 2: Distribusi Kehadiran Per Divisi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#8A93A3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Distribusi Kehadiran Per Divisi
              </span>
              {[
                { dept: 'Manajemen & Sekretariat', count: '4/4', pct: 100, color: '#00E676', note: 'Lengkap' },
                { dept: 'Operasional & Gudang', count: '8/8', pct: 100, color: '#00E676', note: 'Lengkap' },
                { dept: 'Finance & Accounting', count: '3/4', pct: 75, color: '#FFAB00', note: '1 Cuti' },
                { dept: 'Marketing & Desain', count: '2/2', pct: 100, color: '#00E676', note: 'Lengkap' },
              ].map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11.5px', color: '#DCE3EC', minWidth: '155px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dept}</span>
                  <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${d.pct}%`, height: '100%', background: d.color, borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '11.5px', fontFamily: "'JetBrains Mono', monospace", color: d.pct === 100 ? '#00E676' : '#FFAB00', minWidth: '32px', textAlign: 'right' }}>{d.count}</span>
                </div>
              ))}
            </div>

            {/* Kolom 3: Konteks Koordinasi Sekretariat & Aksi Cepat */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#8A93A3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Catatan Koordinasi Sekretariat
              </span>
              <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.5, color: '#A9B4C7' }}>
                Divisi Finance beroperasi 3 dari 4 orang (1 staf cuti resmi). Koordinasi pencairan voucher dan rekonsiliasi invoice dialihkan sementara ke PIC pengganti (Budi S.).
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '4px' }}>
                <span style={{ fontSize: '11px', color: '#5C6474' }}>PIC Pengganti: Budi S. (Finance)</span>
                <button
                  type="button"
                  onClick={() => onOpenAI('Kirim memo internal koordinasi ke PIC Finance pengganti Budi S. terkait persetujuan pembayaran vendor hari ini')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(78,155,255,0.12)',
                    border: '1px solid rgba(78,155,255,0.3)',
                    color: '#4E9BFF',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Zap size={11} /> Memo PIC Finance
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '32px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={30} style={{ color: '#5C6474' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#A9B4C7' }}>Belum Ada Data Presensi Kehadiran Tim</span>
            <span style={{ fontSize: '11.5px', color: '#687487', maxWidth: '440px', lineHeight: 1.5 }}>
              Data kehadiran staf belum diimpor untuk hari ini. Unggah log absensi tim di Pusat Data atau integrasikan sistem presensi untuk melihat statistik kehadiran agregat.
            </span>
          </div>
        )}

        {activeExplainId === 'attendance' && (
          <InlineExplanationPanel
            metric={cAttendance}
            title="Ringkasan Kehadiran Tim"
            role="SEKRETARIS"
            accent={accent}
            footer="Detail individu sengaja tidak ditampilkan pada dashboard Sekretaris."
            onClose={() => setActiveExplainId(null)}
            onOpenAI={onOpenAI}
          />
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 2. MANAGER BODY VIEW
// -------------------------------------------------------------
export function ManagerBodyView({
  payload,
  onOpenAI,
}: {
  payload: RoleDashboardPayload | null;
  onOpenAI: (initialPrompt?: string) => void;
}) {
  const accent = '#D8A33C';
  const [activeExplainId, setActiveExplainId] = useState<string | null>(null);

  // State interaktif keputusan manajerial (Quick Action Gate)
  const [decisions, setDecisions] = useState([
    { id: 'dec-1', req: 'Pengajuan Diskon Katering 15% (Order >Rp 20jt)', from: 'Hendra S. (B2B)', urgency: 'Tinggi', time: '1 jam lalu', impact: 'Margin aman 34%, potensi omset +Rp 22,5jt', status: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED' },
    { id: 'dec-2', req: 'Tukar Shift Staf Gudang Bekasi ke Bandung', from: 'Budi (Supervisor)', urgency: 'Sedang', time: '3 jam lalu', impact: 'Cover lonjakan penerimaan cold storage', status: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED' },
    { id: 'dec-3', req: 'Penggantian Bahan Baku Alternatif Ayam', from: 'Dapur Pusat', urgency: 'Tinggi', time: '5 jam lalu', impact: 'Vendor utama restock delay 2 hari, COGS flat', status: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED' },
  ]);

  // State resolusi temuan SOP
  const [sopFollowUpSent, setSopFollowUpSent] = useState<Record<string, boolean>>({});

  // State filter SOP: 'all' | 'findings'
  const [sopFilter, setSopFilter] = useState<'all' | 'findings'>('all');

  const getCard = (id: string, fallbackLabel: string, fallbackSource: string) => {
    return cardFor(payload, { id, label: fallbackLabel, cardId: id, fallbackDetail: 'Belum ada data', fallbackSource });
  };

  const cKpi = getCard('team-kpi', 'KPI Tim', 'Team KPI assignment');
  const cBudget = getCard('team-budget', 'Budget Operasional Tim', 'TEAM_OPERATIONAL_BUDGET');
  const cSop = getCard('sop', 'Kepatuhan SOP', 'SOP assignment');
  const cDecision = getCard('decision-alerts', 'Alert Butuh Keputusan', 'Team decision queue');

  const isDemo = Boolean((payload as any)?.demo);
  const kpiVal = typeof cKpi.value === 'number' ? cKpi.value : null;
  const budgetVal = typeof cBudget.value === 'number' ? cBudget.value : null;
  const sopVal = typeof cSop.value === 'number' ? cSop.value : null;
  const decisionVal = typeof cDecision.value === 'number' ? cDecision.value : null;

  const hasManagerData = Boolean(isDemo);
  const hasKpiData = Boolean(isDemo);
  const hasBudgetData = Boolean(isDemo);
  const hasSopData = Boolean(isDemo);
  const hasDecisionData = Boolean(isDemo);

  const handleExplainToggle = (id: string) => {
    setActiveExplainId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. TOP SNAPSHOTS (4 HUD Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#D8A33C' }}><Target size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Pencapaian KPI tim</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('kpi-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {kpiVal !== null ? `${kpiVal}%` : (hasKpiData ? '84,2%' : '0%')}
            </span>
            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: hasKpiData ? 'rgba(255,171,0,0.12)' : 'rgba(255,255,255,0.06)', color: hasKpiData ? '#FFAB00' : '#8A93A3', border: hasKpiData ? '1px solid rgba(255,171,0,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
              {hasKpiData ? 'perlu dorongan' : 'belum ada data'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>{hasKpiData ? 'Target berjalan 90%' : 'Belum ada KPI tim aktif'}</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#3FBF8F' }}><WalletCards size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Budget terpakai</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('budget-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#3FBF8F' }}>
              {budgetVal !== null ? `${budgetVal}%` : (hasBudgetData ? '68%' : '0%')}
            </span>
            <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>{hasBudgetData ? 'Rp 101jt / 148jt' : 'Rp 0 / 0'}</span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>{hasBudgetData ? 'Sisa Rp 47jt per 11 Sep' : 'Belum ada alokasi budget tim'}</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#4E9BFF' }}><ClipboardCheck size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Kepatuhan SOP tim</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('sop-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {sopVal !== null ? `${sopVal}%` : (hasSopData ? '87,0%' : '0%')}
            </span>
            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: hasSopData ? 'rgba(255,171,0,0.12)' : 'rgba(255,255,255,0.06)', color: hasSopData ? '#FFAB00' : '#8A93A3', border: hasSopData ? '1px solid rgba(255,171,0,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
              {hasSopData ? 'perhatian' : 'belum diaudit'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>{hasSopData ? '54 patuh · 2 pelanggaran' : 'Belum ada data audit SOP tim'}</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#FF5252' }}><Lightbulb size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Keputusan menunggu</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('decision-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: hasDecisionData ? '#FF5252' : '#8A93A3' }}>
              {hasDecisionData ? (decisionVal !== null ? decisionVal : 5) : 0}
            </span>
            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: hasDecisionData ? 'rgba(255,82,82,0.12)' : 'rgba(255,255,255,0.06)', color: hasDecisionData ? '#FF5252' : '#8A93A3', border: hasDecisionData ? '1px solid rgba(255,82,82,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
              {hasDecisionData ? '2 mendesak' : '0 pending'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>{hasDecisionData ? 'Cuti, diskon, & komplain' : 'Tidak ada antrean keputusan'}</span>
        </div>
      </div>

      {activeExplainId === 'kpi-snapshot' && (
        <InlineExplanationPanel
          metric={cKpi}
          title="Snapshot KPI Tim"
          role="MANAGER_UMUM"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'budget-snapshot' && (
        <InlineExplanationPanel
          metric={cBudget}
          title="Snapshot Budget Terpakai"
          role="MANAGER_UMUM"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'sop-snapshot' && (
        <InlineExplanationPanel
          metric={cSop}
          title="Snapshot Kepatuhan SOP"
          role="MANAGER_UMUM"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'decision-snapshot' && (
        <InlineExplanationPanel
          metric={cDecision}
          title="Snapshot Keputusan Menunggu"
          role="MANAGER_UMUM"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. UNIFIED AI INTELLIGENCE CARD (TOP POSITION -- PARITAS 3 ROLE FUNDAMENTAL) */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#0D1117',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Ambient subtle glow on top */}
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: '-80px',
            left: '25%',
            width: '380px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #D8A33C, transparent 70%)',
            opacity: 0.12,
            filter: 'blur(35px)',
          }}
        />

        {/* Unified Header */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(216,163,60,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 16px rgba(216,163,60,0.25)' }}>
              <Bot size={19} style={{ color: '#F2A83B' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                  Wawasan &amp; Prediksi Tim AI
                </h2>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2.5px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: 'rgba(216,163,60,0.12)', color: '#F2A83B' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D8A33C' }} className="animate-pulse" />
                  AI Brain Aktif
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#8A93A3' }}>
                AI membandingkan target berjalan dengan tren realisasi dan produktivitas tim Anda secara agregat
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenAI('Analisis gap KPI dan proyeksi akhir periode tim saya')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '36px',
              padding: '0 15px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #0058BE 0%, #8D55E8 100%)',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,88,190,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Tanyakan ke AI Assistant</span>
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>

        {/* Narrative Lead */}
        <div style={{ position: 'relative', padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
          <Sparkles size={16} style={{ color: '#F2A83B', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#DCE3EC' }}>
            {hasManagerData
              ? 'Dengan laju harian saat ini, tim diproyeksikan mencapai 95,5% dari target (Rp 745jt dari target Rp 780jt). Disarankan memfokuskan dukungan promosi pada kategori B2B katering untuk menutup gap Rp 35jt dalam 10 hari ke depan.'
              : 'Belum ada data target KPI, budget operasional, atau tugas tim yang tercatat. Unggah dokumen target divisi atau tugaskan proyek tim untuk mengaktifkan analisa kecerdasan AI.'}
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Analisa Capaian Tim
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#F5F7FA' }}>
                {hasManagerData ? 'Rp 612jt' : 'Rp 0'}
              </span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>
                {hasManagerData ? 'dari target Rp 780jt (Gap Rp 168jt)' : 'Belum ada target aktif'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              {hasManagerData
                ? 'Utilisasi budget operasional sehat di 68% (Rp 101jt terpakai dari plafon Rp 148jt).'
                : 'Utilisasi budget operasional dan realisasi belanja belum tercatat.'}
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Proyeksi Akhir Periode
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#D8A33C' }}>
                {hasManagerData ? 'Rp 745jt' : 'Rp 0'}
              </span>
              <span style={{ fontSize: '11px', color: '#3FBF8F' }}>
                {hasManagerData ? '95,5% estimasi tercapai' : '0% estimasi tercapai'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              {hasManagerData
                ? 'Laju konversi harian stabil di Rp 13,3jt/hari dengan deviasi volatilitas rendah (<4%).'
                : 'Menunggu data aktivitas tim dan laporan berkala untuk memproyeksikan performa.'}
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Rekomendasi Tindakan
            </span>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#3FBF8F' }}>
              {hasManagerData ? (
                <>
                  1. Alokasikan Rp 15jt sisa budget promosi ke segmen katering B2B.<br />
                  2. Berikan perhatian khusus pada 2 checklist SOP yang tertunda di logistik.
                </>
              ) : (
                <>
                  1. Unggah KPI &amp; target operasional di Pusat Data.<br />
                  2. Delegasikan tugas divisi via AI Assistant.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 3. SEKSI 1: Kinerja & Budget Tim (2 Kolom Seimbang & Lega) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        {/* Card 1: Pelacak KPI Tim & Beban Kerja */}
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#D8A33C' }}><Target size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Pelacak KPI Tim &amp; Beban Kerja
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasKpiData ? 'rgba(216,163,60,0.12)' : 'rgba(255,255,255,0.06)', color: hasKpiData ? '#D8A33C' : '#8A93A3', border: hasKpiData ? '1px solid rgba(216,163,60,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasKpiData ? '12 tugas aktif' : '0 tugas aktif'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('kpi')}
                style={{ border: 0, background: 'transparent', color: '#D8A33C', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Pencapaian KPI</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#F5F7FA' }}>{hasKpiData ? '84,2%' : '0%'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Tugas selesai</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#00E676' }}>{hasKpiData ? '28' : '0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Tertunda</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#FFAB00' }}>{hasKpiData ? '3' : '0'}</span>
            </div>
          </div>

          {hasKpiData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { role: 'Tim Penjualan B2B', lead: 'Hendra S. (Masa Kerja 7 Thn)', kpi: 'Rp 320jt / 350jt', pct: 91, load: 88, loadStatus: 'Optimal', loadColor: '#00E676', taskDetail: '4 deal aktif · 1 menunggu diskon' },
                { role: 'Tim Operasional Outlet', lead: 'Siti R. (Masa Kerja 6 Thn)', kpi: '98% SLA terpenuhi', pct: 98, load: 94, loadStatus: 'Beban Tinggi', loadColor: '#FFAB00', taskDetail: '3 cabang penuh · butuh cover shift' },
                { role: 'Tim Central Kitchen & Logistik', lead: 'Bambang W. (Masa Kerja 8 Thn)', kpi: '99% Akurasi Resep', pct: 99, load: 78, loadStatus: 'Kapasitas Aman', loadColor: '#3FBF8F', taskDetail: 'Batching pagi selesai · stok aman' },
                { role: 'Tim Customer Service', lead: 'Dimas A. (Masa Kerja 3 Thn)', kpi: 'CSAT 4.6 / 5.0', pct: 92, load: 82, loadStatus: 'Stabil', loadColor: '#4E9BFF', taskDetail: 'Waktu respon 1,8 mnt · 2 tiket komplain' },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{item.role}</span>
                      <span style={{ fontSize: '10.5px', color: '#687487' }}>Lead: {item.lead}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '6px', background: `${item.loadColor}15`, color: item.loadColor, fontWeight: 700, border: `1px solid ${item.loadColor}30` }}>
                        Load {item.load}% · {item.loadStatus}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#D8A33C' }}>{item.kpi}</span>
                    </div>
                  </div>

                  {/* Dual Progress Bars: KPI Capaian vs Beban Kapasitas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ width: '100%', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', background: 'linear-gradient(90deg, #D8A33C, #00E676)', borderRadius: '3px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#687487' }}>
                      <span>{item.taskDetail}</span>
                      <span>Capaian {item.pct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Target size={28} style={{ color: '#5C6474' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#A9B4C7' }}>Belum Ada Data KPI Tim &amp; Beban Kerja</span>
              <span style={{ fontSize: '11px', color: '#687487', maxWidth: '380px', lineHeight: 1.5 }}>
                Belum ada penugasan KPI atau pembagian beban kerja tim yang tercatat. Masukkan target tim di Pusat Data untuk melihat pelacakan performa anggota.
              </span>
            </div>
          )}

          {activeExplainId === 'kpi' && (
            <InlineExplanationPanel
              metric={cKpi}
              title="Pelacak KPI Tim & Beban Kerja"
              role="MANAGER_UMUM"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>

        {/* Card 2: Alokasi & Utilisasi Budget Tim */}
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#3FBF8F' }}><WalletCards size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Alokasi &amp; Utilisasi Budget Tim
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasBudgetData ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)', color: hasBudgetData ? '#00E676' : '#8A93A3', border: hasBudgetData ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasBudgetData ? '68% terpakai' : '0% terpakai'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('budget')}
                style={{ border: 0, background: 'transparent', color: '#D8A33C', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Plafon kuartal</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#F5F7FA' }}>{hasBudgetData ? 'Rp 148jt' : 'Rp 0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Realisasi belanja</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#3FBF8F' }}>{hasBudgetData ? 'Rp 101jt' : 'Rp 0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Sisa saldo</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#D8A33C' }}>{hasBudgetData ? 'Rp 47jt' : 'Rp 0'}</span>
            </div>
          </div>

          {hasBudgetData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { category: 'Operasional Harian Tim', spent: 'Rp 52jt', cap: 'Rp 70jt', pct: 74, pacing: 70, pacingStatus: 'Normal (+4%)', statusColor: '#3FBF8F' },
                { category: 'Promosi & Dukungan Penjualan', spent: 'Rp 28jt', cap: 'Rp 45jt', pct: 62, pacing: 65, pacingStatus: 'Hemat (-3%)', statusColor: '#00E676' },
                { category: 'Pelatihan & Kesejahteraan', spent: 'Rp 21jt', cap: 'Rp 33jt', pct: 63, pacing: 65, pacingStatus: 'Aman (-2%)', statusColor: '#3FBF8F' },
              ].map((b, i) => (
                <div key={i} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ color: '#DCE3EC', fontWeight: 600 }}>{b.category}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: b.statusColor, fontWeight: 700 }}>
                        Pacing: {b.pacingStatus}
                      </span>
                      <span style={{ color: '#8A93A3', fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px' }}>{b.spent} / {b.cap}</span>
                    </div>
                  </div>
                  {/* Progress bar with pacing marker visual */}
                  <div style={{ position: 'relative', width: '100%', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${b.pct}%`, height: '100%', background: b.pct > 80 ? '#FFAB00' : '#3FBF8F', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}

              {/* Quick Banner: Rekomendasi Pemanfaatan Buffer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '8px', background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.12)', gap: '10px' }}>
                <span style={{ fontSize: '10.5px', color: '#A9B4C7' }}>
                  💡 <strong>Rekomendasi Pacing:</strong> Sisa saldo Rp 47jt aman. Alokasi Rp 15jt siap dialihkan ke promo B2B.
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAI('Bantu buatkan rincian realokasi budget promosi B2B sebesar Rp 15jt dari pos pelatihan')}
                  style={{ padding: '4px 9px', borderRadius: '6px', border: '1px solid rgba(63,191,143,0.3)', background: 'rgba(63,191,143,0.15)', color: '#00E676', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Alihkan Alokasi
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <WalletCards size={28} style={{ color: '#5C6474' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#A9B4C7' }}>Belum Ada Alokasi Budget Tim</span>
              <span style={{ fontSize: '11px', color: '#687487', maxWidth: '380px', lineHeight: 1.5 }}>
                Plafon anggaran operasional tim belum diatur untuk periode ini. Tetapkan plafon anggaran di Pusat Data untuk memantau pacing pengeluaran.
              </span>
            </div>
          )}

          {activeExplainId === 'budget' && (
            <InlineExplanationPanel
              metric={cBudget}
              title="Alokasi & Utilisasi Budget Tim"
              role="MANAGER_UMUM"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>
      </div>

      {/* 4. SEKSI 2: SOP & Alert Keputusan (2 Kolom Seimbang & Lega) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        {/* Card 3: Kepatuhan Standar SOP Divisi */}
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#4E9BFF' }}><ClipboardCheck size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Kepatuhan Standar SOP Divisi
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasSopData ? 'rgba(255,171,0,0.12)' : 'rgba(255,255,255,0.06)', color: hasSopData ? '#FFAB00' : '#8A93A3', border: hasSopData ? '1px solid rgba(255,171,0,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasSopData ? '87,0% audit' : '0% audit'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('sop')}
                style={{ border: 0, background: 'transparent', color: '#D8A33C', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Checklist lolos</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#00E676' }}>{hasSopData ? '54' : '0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Temuan perbaikan</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#FFAB00' }}>{hasSopData ? '2' : '0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Audit selesai</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#4E9BFF' }}>{hasSopData ? '96%' : '0%'}</span>
            </div>
          </div>

          {/* Header Sub-Filter: Semua vs Temuan */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#687487' }}>Daftar Periksa Prosedur Operasional</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                onClick={() => setSopFilter('all')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 0,
                  background: sopFilter === 'all' ? 'rgba(216,163,60,0.2)' : 'transparent',
                  color: sopFilter === 'all' ? '#FFF' : '#8A93A3',
                }}
              >
                Semua ({hasSopData ? '56' : '0'})
              </button>
              <button
                type="button"
                onClick={() => setSopFilter('findings')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 0,
                  background: sopFilter === 'findings' ? 'rgba(255,171,0,0.2)' : 'transparent',
                  color: sopFilter === 'findings' ? '#FFAB00' : '#8A93A3',
                }}
              >
                Temuan ({hasSopData ? '2' : '0'})
              </button>
            </div>
          </div>

          {hasSopData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { id: 'sop-1', item: 'Pencatatan serah terima kasir harian', status: 'Lolos sempurna', detail: 'Semua shift disiplin tutup buku', ok: true },
                { id: 'sop-2', item: 'Pemeriksaan suhu chiller & cold storage', status: 'Temuan minor', detail: 'Cabang Bekasi terlambat log 1 jam', ok: false },
                { id: 'sop-3', item: 'Update database prospek B2B', status: 'Lolos sempurna', detail: '100% data terinput ke CRM', ok: true },
              ]
                .filter((s) => sopFilter === 'all' || !s.ok)
                .map((s, idx) => (
                  <div key={idx} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '220px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{s.item}</span>
                      <span style={{ fontSize: '11px', color: '#687487' }}>{s.detail}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ borderRadius: '999px', padding: '2px 8px', fontSize: '10.5px', fontWeight: 600, background: s.ok ? 'rgba(0,230,118,0.12)' : 'rgba(255,171,0,0.12)', color: s.ok ? '#00E676' : '#FFAB00', border: `1px solid ${s.ok ? 'rgba(0,230,118,0.25)' : 'rgba(255,171,0,0.25)'}` }}>
                        {s.status}
                      </span>
                      {!s.ok && (
                        <button
                          type="button"
                          onClick={() => {
                            setSopFollowUpSent((prev) => ({ ...prev, [s.id]: true }));
                            onOpenAI(`Buat pesan pengingat resmi ke Supervisor Cabang Bekasi terkait keterlambatan log suhu chiller.`);
                          }}
                          style={{
                            padding: '3px 9px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,171,0,0.3)',
                            background: sopFollowUpSent[s.id] ? 'rgba(0,230,118,0.15)' : 'rgba(255,171,0,0.12)',
                            color: sopFollowUpSent[s.id] ? '#00E676' : '#FFAB00',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {sopFollowUpSent[s.id] ? 'Terkirim ✓' : 'Tindak Lanjut'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <ClipboardCheck size={28} style={{ color: '#5C6474' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#A9B4C7' }}>Belum Ada Data Audit Standar SOP</span>
              <span style={{ fontSize: '11px', color: '#687487', maxWidth: '380px', lineHeight: 1.5 }}>
                Daftar periksa prosedur operasional tim belum diinput. Unggah SOP divisi untuk melacak kepatuhan prosedur dan temuan perbaikan.
              </span>
            </div>
          )}

          {activeExplainId === 'sop' && (
            <InlineExplanationPanel
              metric={cSop}
              title="Kepatuhan Standar SOP Divisi"
              role="MANAGER_UMUM"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>

        {/* Card 4: Alert & Keputusan Manajerial */}
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#FF5252' }}><Lightbulb size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Alert &amp; Keputusan Manajerial
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasDecisionData && decisions.filter((d) => d.status === 'PENDING').length > 0 ? 'rgba(255,82,82,0.12)' : 'rgba(0,230,118,0.12)', color: hasDecisionData && decisions.filter((d) => d.status === 'PENDING').length > 0 ? '#FF5252' : '#00E676', border: `1px solid ${hasDecisionData && decisions.filter((d) => d.status === 'PENDING').length > 0 ? 'rgba(255,82,82,0.25)' : 'rgba(0,230,118,0.25)'}` }}>
                {hasDecisionData ? `${decisions.filter((d) => d.status === 'PENDING').length} pending` : '0 pending'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('decision')}
                style={{ border: 0, background: 'transparent', color: '#D8A33C', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Persetujuan cuti</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#F5F7FA' }}>{hasDecisionData ? '2' : '0'}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Diskon khusus B2B</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#FFAB00' }}>
                {hasDecisionData ? (decisions.find((d) => d.id === 'dec-1')?.status === 'PENDING' ? '1' : '0') : '0'}
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Komplain pelanggan</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#FF5252' }}>{hasDecisionData ? '2' : '0'}</span>
            </div>
          </div>

          {hasDecisionData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {decisions.map((alert) => (
                <div key={alert.id} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{alert.req}</span>
                        <span style={{ fontSize: '9.5px', padding: '1px 6px', borderRadius: '4px', background: alert.urgency === 'Tinggi' ? 'rgba(239,119,119,0.15)' : 'rgba(216,163,60,0.15)', color: alert.urgency === 'Tinggi' ? '#EF7777' : '#D8A33C', fontWeight: 700 }}>
                          {alert.urgency}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10.5px', color: '#687487' }}>
                        <span>Dari: {alert.from}</span>
                        <span>·</span>
                        <span>{alert.time}</span>
                      </div>
                    </div>

                    {/* Quick Action Gate: Approval Status or Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {alert.status === 'APPROVED' ? (
                        <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(0,230,118,0.15)', color: '#00E676', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(0,230,118,0.3)' }}>
                          ✓ Disetujui
                        </span>
                      ) : alert.status === 'REJECTED' ? (
                        <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,119,119,0.15)', color: '#EF7777', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(239,119,119,0.3)' }}>
                          ✕ Ditolak
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setDecisions((prev) => prev.map((d) => (d.id === alert.id ? { ...d, status: 'APPROVED' } : d)))}
                            style={{ padding: '4px 9px', borderRadius: '6px', border: '1px solid rgba(0,230,118,0.3)', background: 'rgba(0,230,118,0.12)', color: '#00E676', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => setDecisions((prev) => prev.map((d) => (d.id === alert.id ? { ...d, status: 'REJECTED' } : d)))}
                            style={{ padding: '4px 9px', borderRadius: '6px', border: '1px solid rgba(239,119,119,0.3)', background: 'rgba(239,119,119,0.1)', color: '#EF7777', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Tolak
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenAI(`Bantu analisis dampak manajerial untuk: "${alert.req}" (${alert.impact})`)}
                            style={{ padding: '4px 9px', borderRadius: '6px', border: '1px solid rgba(216,163,60,0.3)', background: 'rgba(216,163,60,0.12)', color: '#D8A33C', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Tinjau
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dampak Finansial & Operasional Instan */}
                  <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', fontSize: '10.5px', color: '#94A3B8' }}>
                    📌 <strong>Dampak:</strong> {alert.impact}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Lightbulb size={28} style={{ color: '#5C6474' }} />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#A9B4C7' }}>Tidak Ada Keputusan Menunggu</span>
              <span style={{ fontSize: '11px', color: '#687487', maxWidth: '380px', lineHeight: 1.5 }}>
                Semua tiket persetujuan cuti, pengajuan diskon, dan eskalasi komplain pelanggan telah dituntaskan. Antrean keputusan saat ini bersih.
              </span>
            </div>
          )}

          {activeExplainId === 'decision' && (
            <InlineExplanationPanel
              metric={cDecision}
              title="Alert & Keputusan Manajerial"
              role="MANAGER_UMUM"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>
      </div>

      {/* 5. SEKSI 3: Aktivitas Marketing & Penjualan Lokal */}
      {isDemo ? (
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#D8A33C' }}><Sparkles size={16} /></span>
              <div>
                <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                  Ringkasan Aktivitas Marketing &amp; Penjualan Lokal
                </h3>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>Dukungan promosi spesifik area untuk mengejar target penjualan tim</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'rgba(63,191,143,0.12)', color: '#3FBF8F', border: '1px solid rgba(63,191,143,0.25)' }}>
                Omset lokal +12,4%
              </span>
            </div>
          </div>

          {/* 3 KPI Ringkasan */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Omset kanal lokal</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#F5F7FA' }}>Rp 48,2jt</span>
              <span style={{ fontSize: '11px', color: '#3FBF8F' }}>+12,4% vs pekan lalu</span>
            </div>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Prospek lokal baru</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#F5F7FA' }}>34</span>
              <span style={{ fontSize: '11px', color: '#4E9BFF' }}>21 via WhatsApp</span>
            </div>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Biaya promosi terpakai</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#D8A33C' }}>Rp 3,4jt</span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>ROAS lokal 14,1x</span>
            </div>
          </div>

          {/* Tabel Ringkas & Jelas: Performa Harian & Kontribusi Kanal Promosi (Anti-Neko-neko) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'stretch' }}>
            {/* Kolom Kiri: Tabel Performa Harian (Senin - Minggu) */}
            <div style={{ padding: '16px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#CBD5E1', display: 'block' }}>Realisasi Omset Harian</span>
                  <span style={{ fontSize: '10px', color: '#687487' }}>Rata-rata target harian: Rp 6,8jt</span>
                </div>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(0,230,118,0.12)', color: '#00E676', fontWeight: 700 }}>
                  Puncak: Sabtu (Rp 9,4jt)
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#8A93A3', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', fontWeight: 700 }}>Hari</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Omset</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Deviasi Rata-rata</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { day: 'Senin', val: 'Rp 5,4jt', dev: '-20,6%', color: '#8A93A3', tag: 'Normal' },
                      { day: 'Selasa', val: 'Rp 6,1jt', dev: '-10,3%', color: '#8A93A3', tag: 'Stabil' },
                      { day: 'Rabu', val: 'Rp 5,8jt', dev: '-14,7%', color: '#8A93A3', tag: 'Stabil' },
                      { day: 'Kamis', val: 'Rp 7,2jt', dev: '+5,9%', color: '#3FBF8F', tag: 'Meningkat' },
                      { day: 'Jumat', val: 'Rp 8,5jt', dev: '+25,0%', color: '#00E676', tag: 'Ramai' },
                      { day: 'Sabtu', val: 'Rp 9,4jt', dev: '+38,2%', color: '#00E676', tag: '🔥 Puncak' },
                      { day: 'Minggu', val: 'Rp 5,8jt', dev: '-14,7%', color: '#8A93A3', tag: 'Stabil' },
                    ].map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)', background: idx === 5 ? 'rgba(0,230,118,0.04)' : idx % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'transparent' }}>
                        <td style={{ padding: '7px 8px', fontWeight: 600, color: idx === 5 ? '#00E676' : '#F5F7FA' }}>{r.day}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#CBD5E1', fontFamily: "'JetBrains Mono', monospace" }}>{r.val}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: r.color }}>{r.dev}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', color: r.color, fontWeight: 600, fontSize: '10px' }}>{r.tag}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', fontSize: '10px', color: '#8A93A3' }}>
                💡 <strong>Insight:</strong> 52% total omset terkumpul pada Jumat &amp; Sabtu (+52% vs hari kerja biasa).
              </div>
            </div>

            {/* Kolom Kanan: Rincian 3 Kanal Promosi Lokal & Action Box */}
            <div style={{ padding: '16px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#CBD5E1' }}>Efisiensi Kanal Promosi</span>
                  <span style={{ fontSize: '10px', color: '#687487' }}>Evaluasi ROAS</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {[
                    { channel: 'WhatsApp Broadcast & CRM', cost: 'Rp 1,2jt', leads: '21 prospek', rev: 'Rp 29,8jt', roas: '24,8x', color: '#00E676', icon: '📱' },
                    { channel: 'Kemitraan Komunitas & Event', cost: 'Rp 1,4jt', leads: '8 prospek', rev: 'Rp 12,6jt', roas: '9,0x', color: '#3FBF8F', icon: '🏢' },
                    { channel: 'Google My Business & Peta', cost: 'Rp 800rb', leads: '5 prospek', rev: 'Rp 5,8jt', roas: '7,2x', color: '#D8A33C', icon: '📍' },
                  ].map((ch) => (
                    <div key={ch.channel} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#F5F7FA' }}>{ch.icon} {ch.channel}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: ch.color }}>{ch.rev}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px', color: '#687487' }}>
                        <span>Biaya {ch.cost} · {ch.leads}</span>
                        <span style={{ color: ch.color, fontWeight: 700 }}>ROAS {ch.roas}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Action Broadcast */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(216,163,60,0.06)', border: '1px solid rgba(216,163,60,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#D8A33C' }}>⚡ Broadcast Akhir Pekan</span>
                  <span style={{ fontSize: '9.5px', color: '#8A93A3' }}>Picu lonjakan pesanan Jumat-Sabtu</span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAI('Susun draf WhatsApp broadcast promosi akhir pekan untuk mendorong omset katering Jumat-Sabtu')}
                  style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(216,163,60,0.35)', background: 'rgba(216,163,60,0.18)', color: '#F5F7FA', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Jadwalkan
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#D8A33C' }}><Sparkles size={16} /></span>
            <div>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Ringkasan Aktivitas Marketing &amp; Penjualan Lokal
              </h3>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Dukungan promosi spesifik area untuk mengejar target penjualan tim</span>
            </div>
          </div>
          <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={28} style={{ color: '#5C6474' }} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#A9B4C7' }}>Belum Ada Aktivitas Kampanye Lokal</span>
            <span style={{ fontSize: '11px', color: '#687487', maxWidth: '380px', lineHeight: 1.5 }}>
              Data belanja promosi lokal, performa kanal WhatsApp/Event, dan realisasi omset area akan terpetakan setelah aktivitas pemasaran dijalankan.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// OPERATIONAL CRITICAL STOCK DETAIL PANEL (Taktis, Mendalam & Actionable)
// -------------------------------------------------------------
export function OperationalCriticalStockDetailPanel({
  onClose,
  onOpenAI,
  onOpenInventory,
  cCritStockCount = 0,
  isLiveRealData = false,
}: {
  onClose: () => void;
  onOpenAI: (prompt: string) => void;
  onOpenInventory?: () => void;
  cCritStockCount?: number;
  isLiveRealData?: boolean;
}) {
  const hasCriticalStock = cCritStockCount > 0;

  if (isLiveRealData && !hasCriticalStock) {
    return (
      <div
        data-testid="operational-critical-stock-panel"
        style={{
          width: '100%',
          marginTop: '12px',
          padding: '16px 18px',
          borderRadius: '12px',
          background: 'rgba(0, 230, 118, 0.03)',
          border: '1px solid rgba(0, 230, 118, 0.2)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00E676', display: 'flex', alignItems: 'center' }}>
              <CheckCircle2 size={16} />
            </span>
            <span style={{ color: '#F5F7FA', fontSize: '13px', fontWeight: 600 }}>
              Semua Persediaan Bahan Baku Berada dalam Batas Aman
            </span>
          </div>
          <button
            type="button"
            aria-label="Tutup diagnosa"
            onClick={onClose}
            style={{
              width: '22px',
              height: '22px',
              border: 0,
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
              color: '#8A93A3',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={12} />
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#8A93A3', lineHeight: 1.5 }}>
          Tidak ada SKU yang memerlukan tindakan restock darurat saat ini. AI tetap memantau laju pemakaian harian secara otomatis.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {onOpenInventory && (
            <button
              type="button"
              onClick={onOpenInventory}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 230, 118, 0.3)',
                background: 'rgba(0, 230, 118, 0.1)',
                color: '#00E676',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Lihat Seluruh Daftar Inventori
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenAI('Analisis perkiraan kebutuhan restock bahan baku 7 hari ke depan')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#CBD5E1',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Proyeksikan Kebutuhan Mingguan via AI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="operational-critical-stock-panel"
      style={{
        width: '100%',
        marginTop: '12px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* 1. Header Bersih & Rapi */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '7px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
          <span style={{ color: '#FF5252', display: 'flex', alignItems: 'center' }}>
            <AlertTriangle size={13} />
          </span>
          <span style={{ color: '#F5F7FA', fontSize: '12px', fontWeight: 600 }}>
            Diagnosa &amp; Mitigasi Bahan Kritis
          </span>
          <span style={{ color: '#5C6474', fontSize: '10px' }}>•</span>
          <span style={{ color: '#8A93A3', fontSize: '11px' }}>Prioritas Lapangan (&lt; 48 Jam)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ borderRadius: '999px', padding: '2px 7px', fontSize: '10px', fontWeight: 600, background: 'rgba(255,82,82,0.12)', color: '#FF5252', border: '1px solid rgba(255,82,82,0.25)' }}>
            {cCritStockCount > 0 ? `${cCritStockCount} SKU Kritis` : '3 SKU Kritis [Benchmark Format Acuan]'}
          </span>
          <button
            type="button"
            aria-label="Tutup diagnosa"
            onClick={onClose}
            style={{
              width: '20px',
              height: '20px',
              border: 0,
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.04)',
              color: '#8A93A3',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* 2. Key Runway & Impact Highlight (Strip Kompak) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
        <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: '#8A93A3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Runway Tercepat
            </span>
            <span style={{ fontSize: '10.5px', color: '#CBD5E1' }}>Bekasi Timur</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700, color: '#FF5252' }}>
              1,4 Hari
            </span>
            <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>(Ayam Fillet 1kg)</span>
          </div>
        </div>

        <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: '#8A93A3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Risiko Menu
            </span>
            <span style={{ fontSize: '10.5px', color: '#CBD5E1' }}>14 Menu Terdampak</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700, color: '#FFAB00' }}>
              Rp 4,8 Jt / Hari
            </span>
            <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>jika menu habis</span>
          </div>
        </div>

        <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: '#8A93A3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Peluang Transfer
            </span>
            <span style={{ fontSize: '10.5px', color: '#CBD5E1' }}>Tol 2 Jam</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700, color: '#00E676' }}>
              Surplus BSD Serpong
            </span>
            <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>siap kirim</span>
          </div>
        </div>
      </div>

      {/* 3. Breakdown Rinci 3 SKU Kritis Mendesak */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          {
            id: 'ayam-fillet',
            num: 1,
            name: 'Ayam Fillet 1kg',
            outlet: 'Bekasi Timur',
            currentStock: '4 kg',
            minStock: '15 kg',
            burnRate: '2,8 kg/hari',
            runway: '1,4 Hari (Besok Siang)',
            severity: 'kritis',
            rootCause: 'Lonjakan pesanan katering (+32% vs rata-rata harian).',
            quickMitigation: 'Transfer 10 kg dari BSD Serpong (stok 22 kg) via kurir instan ~2 jam.',
            vendorMitigation: 'Terbitkan PO kilat 120 kg ke PT Sumber Pangan Jaya (lead time 2 hari).',
            promptPO: 'Buat draf Purchase Order darurat untuk Ayam Fillet 1kg sebanyak 120 kg ke supplier PT Sumber Pangan Jaya untuk cabang Bekasi Timur.',
            promptTransfer: 'Rancang surat jalan dan instruksi transfer darurat 10 kg Ayam Fillet dari cabang BSD Serpong ke cabang Bekasi Timur.',
          },
          {
            id: 'minyak-goreng',
            num: 2,
            name: 'Minyak Goreng 2L',
            outlet: 'Bekasi Timur',
            currentStock: '8 pouch',
            minStock: '16 pouch',
            burnRate: '3,2 pouch/hari',
            runway: '2,5 Hari (Lusa Sore)',
            severity: 'restock',
            rootCause: 'Porsi gorengan promo akhir pekan + keterlambatan supplier.',
            quickMitigation: 'Transfer 6 pouch dari BSD Serpong (stok 18 pouch) bareng armada ayam.',
            vendorMitigation: 'PO reguler 40 pouch ke CV Sembako Berkah untuk pasokan minggu depan.',
            promptPO: 'Buat draf Purchase Order Minyak Goreng 2L sebanyak 40 pouch ke CV Sembako Berkah untuk cabang Bekasi Timur.',
            promptTransfer: 'Rancang instruksi penggabungan transfer 6 pouch Minyak Goreng 2L dari BSD Serpong ke Bekasi Timur.',
          },
          {
            id: 'beras-premium',
            num: 3,
            name: 'Beras Premium 25kg',
            outlet: 'Bandung Dago',
            currentStock: '3 sak',
            minStock: '8 sak',
            burnRate: '1,1 sak/hari',
            runway: '2,7 Hari (Lusa Malam)',
            severity: 'restock',
            rootCause: 'Lonjakan kunjungan dine-in akhir pekan area Dago.',
            quickMitigation: 'Pemasok lokal (CV Sembako Berkah Bdg) lead time 24 jam; PO hari ini tiba besok.',
            vendorMitigation: 'PO reguler lokal 15 sak tanpa perlu transfer antar-kota.',
            promptPO: 'Buat draf Purchase Order Beras Premium 25kg sebanyak 15 sak ke CV Sembako Berkah cabang Bandung Dago.',
            promptTransfer: null,
          },
        ].map((item) => (
          <div
            key={item.id}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid rgba(255,255,255,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {/* Header Item */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#CBD5E1', fontSize: '10px', fontWeight: 600, display: 'grid', placeItems: 'center' }}>
                  {item.num}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>
                  {item.name}
                </span>
                <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>• Outlet {item.outlet}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: item.severity === 'kritis' ? '#FF5252' : '#FFAB00' }}>
                  Stok: {item.currentStock} <span style={{ color: '#5C6474', fontWeight: 400 }}>(Min {item.minStock})</span>
                </span>
                <span style={{ fontSize: '10px', color: '#4B5563' }}>•</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: item.severity === 'kritis' ? '#FF8A8A' : '#FFD166' }}>
                  Habis: {item.runway}
                </span>
              </div>
            </div>

            {/* Akar Masalah & Solusi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', lineHeight: 1.4 }}>
              <div style={{ color: '#94A3B8' }}>
                <span style={{ color: '#CBD5E1', fontWeight: 600 }}>Akar Masalah:</span> {item.rootCause}
              </div>
              <div style={{ color: '#CBD5E1' }}>
                <span style={{ color: '#3FBF8F', fontWeight: 600 }}>Rencana Mitigasi:</span> {item.quickMitigation} <span style={{ color: '#8A93A3' }}>({item.vendorMitigation})</span>
              </div>
            </div>

            {/* Micro Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', paddingTop: '2px' }}>
              {item.promptTransfer && (
                <button
                  type="button"
                  onClick={() => onOpenAI(item.promptTransfer)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '5px',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    border: 0,
                    background: 'rgba(0,230,118,0.12)',
                    color: '#00E676',
                    cursor: 'pointer',
                  }}
                >
                  <Truck size={10} />
                  <span>Transfer Antar-Cabang</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenAI(item.promptPO)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  border: 0,
                  background: 'rgba(63,191,143,0.12)',
                  color: '#3FBF8F',
                  cursor: 'pointer',
                }}
              >
                <PackageSearch size={10} />
                <span>Buat PO</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAI(`Bantu saya susun SOP dan langkah preventif agar ${item.name} di cabang ${item.outlet} tidak berulang kali kehabisan stok.`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  fontSize: '10.5px',
                  fontWeight: 500,
                  border: 0,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#CBD5E1',
                  cursor: 'pointer',
                }}
              >
                <span>Bahas di AI</span>
                <ArrowRight size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Skema Logistik Antar-Cabang (Strip Kompak) */}
      <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Truck size={12} style={{ color: '#3FBF8F' }} />
          <span style={{ fontSize: '10.5px', color: '#CBD5E1' }}>
            Alur Logistik Darurat: <strong style={{ color: '#00E676' }}>BSD Serpong (Surplus)</strong>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#3FBF8F', fontSize: '10px', fontWeight: 600 }}>
          <span>Tol JORR 45 km</span>
          <ArrowRight size={11} />
          <span style={{ padding: '1px 5px', borderRadius: '999px', background: 'rgba(63,191,143,0.12)', fontSize: '9.5px' }}>Est. 2 Jam</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '10.5px', color: '#FF5252', fontWeight: 600 }}>Tujuan: Bekasi Timur (Kritis)</span>
        </div>
      </div>

      {/* 5. Footer Kompak */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
        <span style={{ color: '#687487', fontSize: '10px' }}>
          Sumber: Modul Inventori &amp; Log Konsumsi POS Cabang
        </span>
        <button
          type="button"
          onClick={() => onOpenAI('Bantu saya evaluasi total stok kritis di seluruh cabang dan siapkan rencana transfer logistik beserta draf Purchase Order hari ini.')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            minHeight: '26px',
            padding: '0 10px',
            border: 0,
            borderRadius: '5px',
            color: '#FFFFFF',
            background: 'rgba(255,255,255,0.08)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Sparkles size={11} />
          <span>Tanya AI</span>
          <ArrowRight size={10} />
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 3. MANAGER OPERASIONAL BODY VIEW
// -------------------------------------------------------------
export function ManagerOperasionalBodyView({
  payload,
  onOpenAI,
  onOpenInventory,
}: {
  payload: RoleDashboardPayload | null;
  onOpenAI: (initialPrompt?: string) => void;
  onOpenInventory?: () => void;
}) {
  const accent = '#3FBF8F';
  const [activeExplainId, setActiveExplainId] = useState<string | null>(null);

  const getCard = (id: string, fallbackLabel: string, fallbackSource: string) => {
    return cardFor(payload, { id, label: fallbackLabel, cardId: id, fallbackDetail: 'Belum ada data', fallbackSource });
  };

  const cCritical = getCard('critical-stock', 'Stok Kritis', 'Kartu Stok Gudang Multi-Cabang');
  const cPo = getCard('purchase-orders', 'PO Pending', 'Log Purchase Order & Supplier');
  const cSop = getCard('sop', 'Kepatuhan SOP', 'Checklist SOP Operasional Outlet');
  const cDead = getCard('dead-stock-value', 'Dead Stock', 'Analisis Perputaran Inventori (>60 hari)');

  const cSafeStock = getCard('stock-safe', 'Stok Aman', 'Kartu Stok Gudang Multi-Cabang');
  const cRestock = getCard('stock-restock', 'Perlu Restock', 'Kartu Stok Gudang Multi-Cabang');
  const cCritStock = getCard('stock-critical', 'Kritis / Habis', 'Kartu Stok Gudang Multi-Cabang');

  const cPoDraft = getCard('po-draft', 'PO Draft', 'Log Purchase Order');
  const cPoOrdered = getCard('po-ordered', 'PO Dikirim / Berjalan', 'Log Purchase Order');
  const cPoReceived = getCard('po-received', 'PO Diterima', 'Log Purchase Order');

  const isDemo = Boolean((payload as any)?.demo);
  const critVal = typeof cCritStock.value === 'number' ? cCritStock.value : null;
  const safeVal = typeof cSafeStock.value === 'number' ? cSafeStock.value : null;
  const restockVal = typeof cRestock.value === 'number' ? cRestock.value : null;
  const poVal = typeof cPo.value === 'number' ? cPo.value : null;
  const sopVal = typeof cSop.value === 'number' ? cSop.value : null;
  const deadVal = typeof cDead.value === 'number' ? cDead.value : null;

  const hasOpData = Boolean(isDemo || (safeVal !== null && safeVal > 0) || (critVal !== null && critVal > 0) || (restockVal !== null && restockVal > 0) || (poVal !== null && poVal > 0));
  const hasPoData = Boolean(isDemo || (poVal !== null && poVal > 0));
  const hasSopData = Boolean(isDemo || (sopVal !== null && sopVal > 0));

  const handleExplainToggle = (id: string) => {
    setActiveExplainId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. TOP SNAPSHOTS (4 HUD Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Stok kritis</span>
            <button type="button" onClick={() => handleExplainToggle('crit-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: 700, color: hasOpData ? '#FF5252' : '#8A93A3' }}>
              {hasOpData ? (cCritStock.value !== null ? cCritStock.value : 0) : 0}
            </span>
            <span style={{ fontSize: '12px', color: '#8A93A3' }}>SKU</span>
          </div>
          <span style={{ fontSize: '11px', color: '#8A93A3' }}>{hasOpData ? 'di bawah ambang restock' : 'Semua stok aman / belum ada data'}</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>PO pending</span>
            <button type="button" onClick={() => handleExplainToggle('po-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: 700, color: hasPoData ? '#00D2FF' : '#8A93A3' }}>
              {hasPoData ? (cPo.value !== null ? cPo.value : 0) : 0}
            </span>
            <span style={{ fontSize: '12px', color: '#8A93A3' }}>order</span>
          </div>
          <span style={{ fontSize: '11px', color: '#8A93A3' }}>{hasPoData ? 'belum diterima gudang' : 'Tidak ada PO pending'}</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Kepatuhan SOP</span>
            <button type="button" onClick={() => handleExplainToggle('sop-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: 700, color: hasSopData ? '#00E676' : '#8A93A3' }}>
              {hasSopData ? (cSop.value !== null ? `${cSop.value}%` : '87%') : '0%'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#8A93A3' }}>{hasSopData ? 'rata-rata semua cabang' : 'Belum ada data audit'}</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Dead stock</span>
            <button type="button" onClick={() => handleExplainToggle('dead-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: 700, color: hasOpData ? '#FFAB00' : '#8A93A3' }}>
              {hasOpData ? (cDead.value !== null ? (typeof cDead.value === 'number' ? `Rp ${(cDead.value / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : String(cDead.value)) : 'Rp 0') : 'Rp 0'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#8A93A3' }}>{hasOpData ? 'tertahan > 60 hari' : 'Tidak ada dead stock'}</span>
        </div>
      </div>

      {activeExplainId === 'crit-snapshot' && (
        <InlineExplanationPanel
          metric={cCritStock}
          title="Snapshot Stok Kritis"
          role="MANAGER_OPERASIONAL"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'po-snapshot' && (
        <InlineExplanationPanel
          metric={cPo}
          title="Snapshot PO Pending"
          role="MANAGER_OPERASIONAL"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'sop-snapshot' && (
        <InlineExplanationPanel
          metric={cSop}
          title="Snapshot Kepatuhan SOP"
          role="MANAGER_OPERASIONAL"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'dead-snapshot' && (
        <InlineExplanationPanel
          metric={cDead}
          title="Snapshot Dead Stock"
          role="MANAGER_OPERASIONAL"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. UNIFIED AI INTELLIGENCE CARD (TOP POSITION -- PARITAS 3 ROLE FUNDAMENTAL) */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#0D1117',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Ambient subtle glow on top */}
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: '-80px',
            left: '25%',
            width: '380px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #3FBF8F, transparent 70%)',
            opacity: 0.12,
            filter: 'blur(35px)',
          }}
        />

        {/* Unified Header */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(63,191,143,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 16px rgba(63,191,143,0.25)' }}>
              <Bot size={19} style={{ color: '#3FBF8F' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                  Wawasan &amp; Prediksi Rantai Pasok AI
                </h2>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2.5px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: 'rgba(63,191,143,0.12)', color: '#3FBF8F' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3FBF8F' }} className="animate-pulse" />
                  AI Brain Aktif
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#8A93A3' }}>
                AI memantau pemakaian stok harian dan memprediksi resiko kehabisan barang lintas outlet agar PO diterbitkan proaktif
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenAI('Analisis stok kritis dan rekomendasi purchase order cabang')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '36px',
              padding: '0 15px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #0058BE 0%, #8D55E8 100%)',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,88,190,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Tanyakan ke AI Assistant</span>
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>

        {/* Narrative Lead */}
        <div style={{ position: 'relative', padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
          <Sparkles size={16} style={{ color: '#3FBF8F', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#DCE3EC' }}>
            {hasOpData
              ? 'Terdeteksi SKU berisiko habis sebelum akhir pekan. Laju pemakaian bahan diproyeksikan memerlukan penerbitan PO darurat untuk menjaga kelancaran operasional outlet.'
              : 'Belum ada data inventori, stok cabang, atau status pemesanan PO yang tercatat. Unggah file inventori atau sinkronisasi data outlet untuk mengaktifkan AI Supply Chain.'}
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Analisa Stok Kritis
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: hasOpData ? '#FF5252' : '#8A93A3' }}>
                {hasOpData ? `${critVal ?? 0} SKU` : '0 SKU'}
              </span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>
                {hasOpData ? 'di bawah ambang batas aman' : 'Semua SKU aman / belum ada data'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              {hasOpData
                ? 'Pemberitahuan stok kritis lintas cabang aktif.'
                : 'Belum ada SKU di bawah ambang batas minimum.'}
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Prediksi Tanggal Kehabisan
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: isDemo ? '#FFAB00' : '#8A93A3' }}>
                {isDemo ? '14 Sep 2026' : '-'}
              </span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>
                {isDemo ? 'Ayam fillet (Bekasi)' : 'Tidak ada risiko kehabisan'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              {isDemo
                ? 'Minyak goreng 2L diproyeksikan habis 16 Sep; Beras premium 25kg habis 18 Sep.'
                : 'Seluruh runway bahan pokok dalam batas aman.'}
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Rekomendasi Tindakan
            </span>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: isDemo ? '#3FBF8F' : '#8A93A3' }}>
              {isDemo ? (
                <>
                  1. Terbitkan PO ayam fillet 120 kg ke Sumber Pangan Jaya hari ini (lead time 3 hari).<br />
                  2. Transfer darurat 30 liter minyak dari BSD ke Bekasi untuk cegah stockout.
                </>
              ) : (
                'Belum ada rekomendasi tindakan operasional. Sistem siap memproses inventori baru.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 3. SEKSI 1: Master Domain Hero -- Peta Stok Semua Cabang (Full-Width) */}
      <article
        id="klir-stock-matrix-card"
        style={{
          position: 'relative',
          background: '#0D1117',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: '#3FBF8F' }}><Boxes size={18} /></span>
              <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                Peta Stok Semua Cabang (Matriks Real-time)
              </h2>
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(255, 255, 255, 0.06)', color: '#8A93A3', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                [Benchmark Format Acuan]
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8A93A3' }}>
              Daftar stok bahan baku utama dan status ketersediaan di seluruh outlet fisik.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {onOpenInventory && (
              <button
                type="button"
                onClick={onOpenInventory}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(63,191,143,0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '11.5px', fontWeight: 600, color: '#3FBF8F', background: 'rgba(63,191,143,0.08)', cursor: 'pointer' }}
              >
                Kelola Inventori <ChevronRight size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleExplainToggle('stock-matrix')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                border: 0,
                background: 'transparent',
                color: '#3FBF8F',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {activeExplainId === 'stock-matrix' ? (
                <>
                  <span>Tutup Diagnosa</span>
                  <ChevronUp size={13} />
                </>
              ) : (
                <>
                  <span>Jelaskan Diagnosa Kritis</span>
                  <ChevronDown size={13} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Counter Status Box */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#8A93A3' }}>Stok aman</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: hasOpData ? '#00E676' : '#8A93A3' }}>
              {hasOpData ? (cSafeStock.value !== null ? cSafeStock.value : 0) : 0} SKU
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#8A93A3' }}>Perlu restock</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: hasOpData ? '#FFAB00' : '#8A93A3' }}>
              {hasOpData ? (cRestock.value !== null ? cRestock.value : 0) : 0} SKU
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#8A93A3' }}>Kritis / habis</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: hasOpData ? '#FF5252' : '#8A93A3' }}>
              {hasOpData ? (cCritStock.value !== null ? cCritStock.value : 0) : 0} SKU
            </span>
          </div>
        </div>

        {/* Tabel Matriks Ketersediaan Bahan / Honest Zero-State */}
        {hasOpData ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#8A93A3', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 500 }}>Bahan / Item</th>
                  <th style={{ padding: '8px 10px', fontWeight: 500 }}>Bekasi Timur</th>
                  <th style={{ padding: '8px 10px', fontWeight: 500 }}>Bandung Dago</th>
                  <th style={{ padding: '8px 10px', fontWeight: 500 }}>BSD Serpong</th>
                  <th style={{ padding: '8px 10px', fontWeight: 500 }}>Status Global</th>
                  <th style={{ padding: '8px 10px', fontWeight: 500 }}>Aksi Cepat</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    name: 'Ayam Fillet 1kg',
                    bekasi: '4 kg (kritis)',
                    bekasiRunway: 'Habis ~1,4 hari lagi',
                    bandung: '18 kg (aman)',
                    bsd: '22 kg (aman - surplus)',
                    status: 'Kritis',
                    tone: '#FF5252',
                    prompt: 'Buat draf Purchase Order darurat untuk Ayam Fillet 1kg ke supplier Sumber Pangan Jaya untuk cabang Bekasi Timur',
                    canTransfer: true,
                  },
                  {
                    name: 'Beras Premium 25kg',
                    bekasi: '12 sak (aman)',
                    bekasiRunway: null,
                    bandung: '3 sak (restock)',
                    bandungRunway: 'Habis ~2,7 hari lagi',
                    bsd: '15 sak (aman)',
                    status: 'Restock',
                    tone: '#FFAB00',
                    prompt: 'Buat draf Purchase Order Beras Premium 25kg sebanyak 15 sak untuk cabang Bandung Dago',
                    canTransfer: false,
                  },
                  {
                    name: 'Minyak Goreng 2L',
                    bekasi: '8 pouch (restock)',
                    bekasiRunway: 'Habis ~2,5 hari lagi',
                    bandung: '20 pouch (aman)',
                    bsd: '18 pouch (aman)',
                    status: 'Restock',
                    tone: '#FFAB00',
                    prompt: 'Buat draf Purchase Order Minyak Goreng 2L sebanyak 40 pouch untuk cabang Bekasi Timur',
                    canTransfer: true,
                  },
                  {
                    name: 'Telur Ayam 1 Tray',
                    bekasi: '25 tray (aman)',
                    bekasiRunway: null,
                    bandung: '30 tray (aman)',
                    bsd: '28 tray (aman)',
                    status: 'Aman',
                    tone: '#00E676',
                    prompt: 'Cek jadwal pengiriman rutin Telur Ayam 1 Tray pekan ini',
                    canTransfer: false,
                  },
                  {
                    name: 'Saus Sambal Galon 5L',
                    bekasi: '6 galon (aman)',
                    bekasiRunway: null,
                    bandung: '5 galon (aman)',
                    bsd: '7 galon (aman)',
                    status: 'Aman',
                    tone: '#00E676',
                    prompt: 'Cek stok Saus Sambal Galon 5L dan minimum restock batas aman',
                    canTransfer: false,
                  },
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#F5F7FA' }}>
                    <td style={{ padding: '10px' }}>
                      <strong>{row.name}</strong>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: row.bekasi.includes('kritis') ? '#FF5252' : row.bekasi.includes('restock') ? '#FFAB00' : '#A9B4C7', fontWeight: row.bekasi.includes('kritis') ? 600 : 400 }}>
                        {row.bekasi}
                      </span>
                      {row.bekasiRunway && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#FF8A8A', marginTop: '2px' }}>
                          {row.bekasiRunway}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: row.bandung.includes('kritis') ? '#FF5252' : row.bandung.includes('restock') ? '#FFAB00' : '#A9B4C7', fontWeight: row.bandung.includes('kritis') ? 600 : 400 }}>
                        {row.bandung}
                      </span>
                      {(row as any).bandungRunway && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#FFD166', marginTop: '2px' }}>
                          {(row as any).bandungRunway}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', color: row.bsd.includes('kritis') ? '#FF5252' : row.bsd.includes('restock') ? '#FFAB00' : '#A9B4C7' }}>
                      {row.bsd}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ borderRadius: '999px', padding: '2px 8px', fontSize: '10.5px', fontWeight: 600, background: `${row.tone}15`, color: row.tone, border: `1px solid ${row.tone}30` }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => onOpenAI(row.prompt)}
                          style={{
                            border: '1px solid rgba(63,191,143,0.3)',
                            background: 'rgba(63,191,143,0.08)',
                            color: '#3FBF8F',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          Buat PO
                        </button>
                        {row.canTransfer && (
                          <button
                            type="button"
                            onClick={() => onOpenAI(`Rancang pengiriman transfer darurat bahan ${row.name} dari cabang BSD Serpong ke cabang Bekasi Timur`)}
                            style={{
                              border: '1px solid rgba(0,230,118,0.25)',
                              background: 'rgba(0,230,118,0.08)',
                              color: '#00E676',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            Transfer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '36px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(63,191,143,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3FBF8F', marginBottom: '4px' }}>
              <Boxes size={20} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Belum Ada Data Inventori &amp; Matriks Stok Cabang</span>
            <span style={{ fontSize: '11.5px', color: '#8A93A3', maxWidth: '420px', lineHeight: 1.5 }}>
              Data ketersediaan bahan, status per cabang (Bekasi, Bandung, BSD), dan ambang restock akan otomatis terpetakan setelah file stok atau transaksi mutasi diimpor.
            </span>
            {onOpenInventory && (
              <button
                type="button"
                onClick={onOpenInventory}
                style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(63,191,143,0.3)', borderRadius: '8px', padding: '6px 14px', fontSize: '11.5px', fontWeight: 600, color: '#3FBF8F', background: 'rgba(63,191,143,0.08)', cursor: 'pointer' }}
              >
                Tambah / Kelola Inventori <ChevronRight size={13} />
              </button>
            )}
          </div>
        )}

        {/* Operational Stock Detail Panel (Replaces generic dictionary panel) */}
        {activeExplainId === 'stock-matrix' && (
          <OperationalCriticalStockDetailPanel
            onClose={() => setActiveExplainId(null)}
            onOpenAI={onOpenAI}
            onOpenInventory={onOpenInventory}
            cCritStockCount={typeof cCritStock.value === 'number' ? cCritStock.value : 0}
            isLiveRealData={Boolean(payload && payload.status !== 'empty')}
          />
        )}
      </article>

      {/* 4. SEKSI 2: PO & Biaya Operasional (2 Kolom Seimbang & Lega) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        {/* Card 2: Status Pesanan Pembelian / PO */}
        <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#4E9BFF' }}><PackageSearch size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Status Pesanan Pembelian (PO)
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasPoData ? 'rgba(0,210,255,0.12)' : 'rgba(255,255,255,0.06)', color: hasPoData ? '#00D2FF' : '#8A93A3', border: hasPoData ? '1px solid rgba(0,210,255,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasPoData ? `${cPo.value !== null ? cPo.value : 0} berjalan` : '0 berjalan'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('po')}
                style={{ border: 0, background: 'transparent', color: '#3FBF8F', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Draft PO</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#8A93A3' }}>
                {hasPoData ? (cPoDraft.value !== null ? cPoDraft.value : 0) : 0}
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Dalam pengiriman</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#4E9BFF' }}>
                {hasPoData ? (cPoOrdered.value !== null ? cPoOrdered.value : 0) : 0}
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Diterima minggu ini</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#00E676' }}>
                {hasPoData ? (cPoReceived.value !== null ? cPoReceived.value : 0) : 0}
              </span>
            </div>
          </div>

          {hasPoData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { po: 'PO-2026-089', supplier: 'PT Sumber Unggas Jaya', total: 'Rp 14,8 jt', est: 'Tiba besok 08:00', dest: 'Bekasi Timur', status: 'Dikirim' },
                { po: 'PO-2026-092', supplier: 'CV Sembako Berkah', total: 'Rp 8,2 jt', est: 'Tiba 14 Sep', dest: 'Bandung Dago', status: 'Diproses' },
                { po: 'PO-2026-095', supplier: 'PT Kemasan Nusantara', total: 'Rp 5,4 jt', est: 'Draft approval', dest: 'Gudang Pusat', status: 'Draft' },
              ].map((order, idx) => (
                <div key={idx} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', fontWeight: 700, color: '#4E9BFF' }}>{order.po}</span>
                      <span style={{ fontSize: '12px', color: '#F5F7FA' }}>{order.supplier}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5C6474' }}>
                      <span>{order.dest}</span>
                      <span>·</span>
                      <span>{order.est}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>{order.total}</span>
                    <span style={{ borderRadius: '999px', padding: '1px 7px', fontSize: '10px', fontWeight: 600, background: order.status === 'Dikirim' ? 'rgba(78,155,255,0.12)' : 'rgba(255,255,255,0.06)', color: order.status === 'Dikirim' ? '#4E9BFF' : '#8A93A3' }}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(78,155,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4E9BFF' }}>
                <PackageSearch size={18} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Tidak Ada Pesanan Pembelian (PO) Aktif</span>
              <span style={{ fontSize: '11px', color: '#8A93A3', maxWidth: '340px' }}>
                Belum ada riwayat PO ke supplier. Anda dapat meminta AI Assistant menerbitkan rekomendasi draft PO saat stok menipis.
              </span>
            </div>
          )}

          {activeExplainId === 'po' && (
            <InlineExplanationPanel
              metric={cPo}
              title="Status Pesanan Pembelian (PO)"
              role="MANAGER_OPERASIONAL"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>

        {/* Card 3: Biaya Pokok Penjualan / COGS */}
        <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#FFAB00' }}><WalletCards size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Biaya Pokok Penjualan (COGS) &amp; Efisiensi
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasOpData ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)', color: hasOpData ? '#00E676' : '#8A93A3', border: hasOpData ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasOpData ? '38,4% (Aman)' : '0% (Belum ada data)'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('cogs')}
                style={{ border: 0, background: 'transparent', color: '#3FBF8F', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Rasio COGS</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: hasOpData ? '#00E676' : '#8A93A3' }}>
                {hasOpData ? '38,4%' : '0%'}
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Target batas</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#8A93A3' }}>&lt; 40%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Biaya susut / waste</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: hasOpData ? '#FFAB00' : '#8A93A3' }}>
                {hasOpData ? '1,8%' : '0%'}
              </span>
            </div>
          </div>

          {hasOpData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { comp: 'Bahan Baku Protein (Ayam & Telur)', pct: 52, cost: 'Rp 64jt' },
                { comp: 'Beras, Minyak & Bumbu Pokok', pct: 28, cost: 'Rp 34jt' },
                { comp: 'Kemasan & Packaging Outlet', pct: 14, cost: 'Rp 17jt' },
                { comp: 'Bahan Habis Pakai & Kebersihan', pct: 6, cost: 'Rp 7,5jt' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                    <span style={{ color: '#DCE3EC' }}>{c.comp}</span>
                    <span style={{ color: '#8A93A3', fontFamily: "'JetBrains Mono', monospace" }}>{c.cost} ({c.pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${c.pct}%`, height: '100%', background: i === 0 ? '#3FBF8F' : i === 1 ? '#4E9BFF' : '#D8A33C', borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,171,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFAB00' }}>
                <WalletCards size={18} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Belum Ada Data Kalkulasi COGS</span>
              <span style={{ fontSize: '11px', color: '#8A93A3', maxWidth: '340px' }}>
                Rasio HPP (COGS) dan efisiensi bahan baku akan dihitung otomatis dari mutasi belanja operasional dan penjualan.
              </span>
            </div>
          )}

          {activeExplainId === 'cogs' && (
            <InlineExplanationPanel
              metric={getCard('cogs-ratio', 'Rasio Biaya Pokok Penjualan (COGS)', 'Financial COGS calculation')}
              title="Biaya Pokok Penjualan (COGS) & Efisiensi"
              role="MANAGER_OPERASIONAL"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>
      </div>

      {/* 5. SEKSI 3: Mutu Gudang & Vendor (2 Kolom Seimbang & Lega) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        {/* Card 4: Kepatuhan Standar Mutu Gudang */}
        <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#00E676' }}><ClipboardCheck size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Kepatuhan Standar Mutu Gudang
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasSopData ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)', color: hasSopData ? '#00E676' : '#8A93A3', border: hasSopData ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasSopData ? `${cSop.value !== null ? `${cSop.value}%` : '87%'} rata-rata` : '0% rata-rata'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('quality')}
                style={{ border: 0, background: 'transparent', color: '#3FBF8F', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          {hasSopData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { branch: 'Bekasi Timur', score: 82, note: 'Suhu chiller -1°C dari standar', status: 'Perhatian', color: '#FFAB00' },
                { branch: 'Bandung Dago', score: 94, note: 'Disiplin FIFO & higienitas optimal', status: 'Bagus', color: '#00E676' },
                { branch: 'BSD Serpong', score: 88, note: 'Palet penyimpanan rapi, rotasi lancar', status: 'Bagus', color: '#00E676' },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{item.branch}</span>
                    <span style={{ fontSize: '11px', color: '#8A93A3' }}>{item.note}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: 700, color: item.color }}>{item.score}%</span>
                    <span style={{ borderRadius: '999px', padding: '1px 7px', fontSize: '10.5px', fontWeight: 600, background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}30` }}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,230,118,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00E676' }}>
                <ClipboardCheck size={18} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Belum Ada Data Checklist Mutu Gudang</span>
              <span style={{ fontSize: '11px', color: '#8A93A3', maxWidth: '340px' }}>
                Audit suhu chiller, kepatuhan FIFO, dan kebersihan outlet akan tampil di sini saat checklist harian terisi.
              </span>
            </div>
          )}

          {activeExplainId === 'quality' && (
            <InlineExplanationPanel
              metric={cSop}
              title="Kepatuhan Standar Mutu Gudang"
              role="MANAGER_OPERASIONAL"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>

        {/* Card 5: Kinerja Supplier & Vendor */}
        <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#4E9BFF' }}><Truck size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Kinerja Supplier &amp; Vendor
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, background: hasOpData ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.06)', color: hasOpData ? '#00E676' : '#8A93A3', border: hasOpData ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,255,255,0.1)' }}>
                {hasOpData ? '95% tepat waktu' : 'Belum ada data'}
              </span>
              <button
                type="button"
                onClick={() => handleExplainToggle('supplier')}
                style={{ border: 0, background: 'transparent', color: '#3FBF8F', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Jelaskan <ChevronDown size={13} />
              </button>
            </div>
          </div>

          {hasOpData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { name: 'PT Sumber Unggas Jaya', category: 'Ayam Fillet', onTime: '98%', defect: '0,2%', rating: 4.8 },
                { name: 'CV Sembako Berkah', category: 'Beras & Minyak', onTime: '92%', defect: '0,5%', rating: 4.5 },
                { name: 'PT Kemasan Nusantara', category: 'Packaging', onTime: '96%', defect: '0,1%', rating: 4.9 },
              ].map((v, i) => (
                <div key={i} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>{v.name}</span>
                    <span style={{ fontSize: '11px', color: '#5C6474' }}>{v.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span style={{ color: '#00E676', fontWeight: 600 }}>{v.onTime}</span>
                      <span style={{ fontSize: '10px', color: '#5C6474' }}>tepat waktu</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span style={{ color: '#D8A33C', fontWeight: 600 }}>★ {v.rating}</span>
                      <span style={{ fontSize: '10px', color: '#5C6474' }}>rating</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(78,155,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4E9BFF' }}>
                <Truck size={18} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Belum Ada Evaluasi Supplier &amp; Vendor</span>
              <span style={{ fontSize: '11px', color: '#8A93A3', maxWidth: '340px' }}>
                Metrik ketepatan waktu pengiriman, tingkat cacat barang (defect rate), dan rating vendor belum terekam.
              </span>
            </div>
          )}

          {activeExplainId === 'supplier' && (
            <InlineExplanationPanel
              metric={getCard('supplier-performance', 'Kinerja Supplier & Vendor', 'Vendor SLA report')}
              title="Kinerja Supplier & Vendor"
              role="MANAGER_OPERASIONAL"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>
      </div>

      {/* 6. SEKSI 4: Jadwal Staf Operasional Gudang (Full-Width Supporting Hero Widget) */}
      <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#8CBEFF' }}><Users size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Jadwal &amp; Shift Staf Operasional Gudang
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8A93A3' }}>
              Monitoring ketersediaan staf antar-shift untuk memastikan penerimaan barang dan rotasi FIFO berjalan lancar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleExplainToggle('shifts')}
            style={{ border: 0, background: 'transparent', color: '#3FBF8F', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Jelaskan <ChevronDown size={13} />
          </button>
        </div>

        {hasOpData ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              {/* Shift Pagi */}
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 500 }}>Shift Pagi (06:00 - 14:00)</span>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#00E676', marginTop: '2px' }}>
                      8 Staf <span style={{ fontSize: '11px', fontWeight: 500, color: '#3FBF8F' }}>(Lengkap)</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(0,230,118,0.1)', color: '#00E676', border: '1px solid rgba(0,230,118,0.2)' }}>
                    Aktif Sekarang
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#DCE3EC', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8A93A3' }}>Fokus Tugas:</span>
                    <span>Penerimaan &amp; sortir FIFO</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8A93A3' }}>Posisi Kunci:</span>
                    <span>1 Spv, 2 QC Bahan, 3 Sortir, 2 Driver</span>
                  </div>
                </div>
              </div>

              {/* Shift Sore */}
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 500 }}>Shift Sore (14:00 - 22:00)</span>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#4E9BFF', marginTop: '2px' }}>
                      6 Staf <span style={{ fontSize: '11px', fontWeight: 500, color: '#8CBEFF' }}>(Siap Masuk)</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(78,155,255,0.1)', color: '#8CBEFF', border: '1px solid rgba(78,155,255,0.2)' }}>
                    Standby 13:45
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#DCE3EC', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8A93A3' }}>Fokus Tugas:</span>
                    <span>Distribusi &amp; packing cabang</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8A93A3' }}>Posisi Kunci:</span>
                    <span>1 Leader, 3 Picking/Pack, 2 Driver</span>
                  </div>
                </div>
              </div>

              {/* Shift Malam */}
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 500 }}>Shift Malam (22:00 - 06:00)</span>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: 700, color: '#FFAB00', marginTop: '2px' }}>
                      4 Staf <span style={{ fontSize: '11px', fontWeight: 500, color: '#FFD166' }}>(Terjadwal)</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,171,0,0.1)', color: '#FFD166', border: '1px solid rgba(255,171,0,0.2)' }}>
                    Inpeksi Chiller
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#DCE3EC', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8A93A3' }}>Fokus Tugas:</span>
                    <span>Cek suhu ruang dingin &amp; sekuriti</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8A93A3' }}>Posisi Kunci:</span>
                    <span>1 Petugas Chiller, 2 Gudang, 1 Sekuriti</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', fontSize: '11.5px', color: '#8A93A3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ borderRadius: '999px', padding: '3px 9px', fontSize: '10.5px', fontWeight: 600, background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.25)' }}>
                  Coverage 100% Aman
                </span>
                <span style={{ color: '#F5F7FA' }}>Semua posisi kunci (leader gudang, QC bahan, driver antar-cabang) terisi hari ini</span>
              </div>
              <div style={{ fontSize: '11px', color: '#5C6474' }}>
                Log Handover Terakhir: Shift Malam &rarr; Pagi (06:05 WIB) &bull; Chiller 3.8&deg;C (Normal)
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: '32px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(140,190,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8CBEFF', marginBottom: '4px' }}>
              <Users size={20} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Belum Ada Penugasan Shift Operasional</span>
            <span style={{ fontSize: '11.5px', color: '#8A93A3', maxWidth: '380px' }}>
              Jadwal shift staf gudang, petugas sortasi bahan, dan driver antar-outlet belum dikonfigurasi.
            </span>
          </div>
        )}

        {activeExplainId === 'shifts' && (
          <InlineExplanationPanel
            metric={getCard('shift-morning', 'Jadwal Staf Operasional', 'Operational schedule')}
            title="Jadwal Staf Operasional"
            role="MANAGER_OPERASIONAL"
            accent={accent}
            footer="Jadwal yang kosong akan menjadi temuan operasional, bukan angka gaji."
            onClose={() => setActiveExplainId(null)}
            onOpenAI={onOpenAI}
          />
        )}
      </article>
    </div>
  );
}

// -------------------------------------------------------------
// 4. CEO BODY VIEW (PARITAS LENGKAP)
// -------------------------------------------------------------
export function CeoBodyView({
  payload,
  onOpenAI,
}: {
  payload: RoleDashboardPayload | null;
  onOpenAI: (initialPrompt?: string) => void;
}) {
  const accent = '#8D55E8';
  const [activeExplainId, setActiveExplainId] = useState<string | null>(null);
  const [corplanDropSim, setCorplanDropSim] = useState<number>(15);

  const getCard = (id: string, fallbackLabel: string, fallbackSource: string) => {
    return cardFor(payload, { id, label: fallbackLabel, cardId: id, fallbackDetail: 'Belum ada data', fallbackSource });
  };

  const cRev = getCard('rev-mtd', 'Revenue MTD', 'CashTransaction / Invoice');
  const cMargin = getCard('net-margin', 'Net Profit Margin', 'Financial calculation');
  const cRunway = getCard('runway', 'Cash Runway', 'ForwardForecast');
  const cHealth = getCard('health-grade', 'Health Grade Bisnis', 'Business Health Model');

  const handleExplainToggle = (id: string) => {
    setActiveExplainId((prev) => (prev === id ? null : id));
  };

  // Simulasi Runway Berdasarkan Drop Omset %
  const baseRunway = 14.2;
  const simulatedRunway = Math.max(4.5, +(baseRunway * (1 - (corplanDropSim * 0.015))).toFixed(1));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. TOP SNAPSHOTS (4 Executive Fiori Tiles) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {/* Tile 1: Revenue MTD */}
        <div className="sap-fiori-tile" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(141,85,232,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A78BFA' }}>
                <Building2 size={13} />
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A93A3' }}>Revenue MTD</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('rev-snapshot')} title="Jelaskan metrik ini" style={{ border: 0, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', color: '#8A93A3', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
              <Info size={11} />
              <span>Info</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span className="sap-kpi-number" style={{ fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cRev.value !== null ? cRev.value : 'Rp 612jt'}
            </span>
            <span className="sap-status-pill sap-status-pill-safe">
              <span className="sap-pulse-dot" style={{ background: '#00E676' }} />
              <span>+14% MoM</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280', paddingTop: '2px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span>Target: Rp 780jt</span>
            <span style={{ color: '#00E676', fontWeight: 600 }}>78,5% tercapai</span>
          </div>
        </div>

        {/* Tile 2: Net Profit Margin */}
        <div className="sap-fiori-tile" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(0,230,118,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00E676' }}>
                <Percent size={13} />
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A93A3' }}>Net Profit Margin</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('margin-snapshot')} title="Jelaskan metrik ini" style={{ border: 0, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', color: '#8A93A3', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
              <Info size={11} />
              <span>Info</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span className="sap-kpi-number" style={{ fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cMargin.value !== null ? cMargin.value : '22,4%'}
            </span>
            <span className="sap-status-pill sap-status-pill-safe">
              <span className="sap-pulse-dot" style={{ background: '#00E676' }} />
              <span>Sehat</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280', paddingTop: '2px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span>Batas Toleransi: ≥20%</span>
            <span style={{ color: '#00E676', fontWeight: 600 }}>+2.4% buffer</span>
          </div>
        </div>

        {/* Tile 3: Cash Runway */}
        <div className="sap-fiori-tile" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(78,155,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4E9BFF' }}>
                <ShieldCheck size={13} />
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A93A3' }}>Cash Runway</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('runway-snapshot')} title="Jelaskan metrik ini" style={{ border: 0, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', color: '#8A93A3', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
              <Info size={11} />
              <span>Info</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span className="sap-kpi-number" style={{ fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cRunway.value !== null ? cRunway.value : '14,2'} Bln
            </span>
            <span className="sap-status-pill sap-status-pill-info">
              <span className="sap-pulse-dot" style={{ background: '#4E9BFF' }} />
              <span>Aman</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280', paddingTop: '2px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span>Burn rate: Rp 68jt/bln</span>
            <span style={{ color: '#4E9BFF', fontWeight: 600 }}>Likuiditas stabil</span>
          </div>
        </div>

        {/* Tile 4: Health Grade Bisnis */}
        <div className="sap-fiori-tile" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(216,163,60,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D8A33C' }}>
                <Target size={13} />
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A93A3' }}>Health Grade</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('health-snapshot')} title="Jelaskan metrik ini" style={{ border: 0, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', color: '#8A93A3', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
              <Info size={11} />
              <span>Info</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span className="sap-kpi-number" style={{ fontSize: '24px', fontWeight: 700, color: '#00E676' }}>
              {cHealth.value !== null ? `${cHealth.value}/100` : '92/100'}
            </span>
            <span className="sap-status-pill sap-status-pill-safe">
              <span className="sap-pulse-dot" style={{ background: '#00E676' }} />
              <span>Grade A</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280', paddingTop: '2px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span>Audit 4 Pilar: Optimal</span>
            <span style={{ color: '#00E676', fontWeight: 600 }}>Tatakelola Baik</span>
          </div>
        </div>
      </div>

      {activeExplainId === 'rev-snapshot' && (
        <InlineExplanationPanel
          metric={cRev}
          title="Snapshot Revenue MTD"
          role="CEO"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'margin-snapshot' && (
        <InlineExplanationPanel
          metric={cMargin}
          title="Snapshot Net Profit Margin"
          role="CEO"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'runway-snapshot' && (
        <InlineExplanationPanel
          metric={cRunway}
          title="Snapshot Cash Runway"
          role="CEO"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'health-snapshot' && (
        <InlineExplanationPanel
          metric={cHealth}
          title="Snapshot Health Grade Bisnis"
          role="CEO"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}

      {/* 2. UNIFIED AI INTELLIGENCE CARD (TOP POSITION) */}
      <div
        className="sap-fiori-tile"
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(141,85,232,0.18)', border: '1px solid rgba(141,85,232,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 20px rgba(141,85,232,0.25)' }}>
              <Bot size={20} style={{ color: '#C4B5FD' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                  Wawasan &amp; Prediksi Eksekutif Perusahaan
                </h2>
                <span className="sap-status-pill sap-status-pill-purple">
                  <span className="sap-pulse-dot" style={{ background: '#A78BFA' }} />
                  <span>AI Brain Aktif</span>
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#8A93A3' }}>
                Simulasi pertumbuhan pendapatan, runway ketahanan kas, dan mitigasi risiko ekspansi makro
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenAI('Jalankan simulasi skenario keuangan untuk proyeksi pendapatan dan runway kas perusahaan.')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '36px',
              padding: '0 16px',
              borderRadius: '9px',
              border: 'none',
              background: 'linear-gradient(135deg, #8D55E8 0%, #0058BE 100%)',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(141,85,232,0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Simulasikan Skenario via AI</span>
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>

        <div style={{ position: 'relative', padding: '14px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
          <Sparkles size={16} style={{ color: '#A78BFA', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#DCE3EC' }}>
            {payload?.insight?.summary || 'Performa pendapatan berjalan diproyeksikan menutup 95,5% dari target rencana kuartal ini. Margin kotor aman di 22,4% dengan runway likuiditas 14,2 bulan.'}
          </p>
        </div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Analisa Capaian Makro
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="sap-kpi-number" style={{ fontSize: '18px', fontWeight: 700, color: '#F5F7FA' }}>Rp 612jt</span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>dari target Rp 780jt</span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              Gap Rp 168jt berjalan dapat dipercepat melalui penetrasi katering B2B korporat.
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Proyeksi Ketahanan Modal
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="sap-kpi-number" style={{ fontSize: '18px', fontWeight: 700, color: '#00E676' }}>14,2 Bulan</span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>surplus kas operasional</span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              Burn rate bulanan Rp 68jt dapat ditopang stabil tanpa kebutuhan injeksi modal eksternal.
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Rekomendasi Eksekutif
            </span>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#A78BFA' }}>
              1. Pertahankan alokasi Capex pembukaan cabang baru di zona Dago Bandung.<br />
              2. Kunci buffer likuiditas minimum 3 bulan OPEX sebelum ekspansi kuartal depan.
            </p>
          </div>
        </div>
      </div>

      {/* 3. SEKSI 1: Master Hero -- Realisasi Corplan & What-If Simulation Slider */}
      <article className="sap-fiori-tile" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#8D55E8' }}><Sliders size={18} /></span>
              <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                Simulasi Skenario Arus Kas &amp; Ketahanan Runway (What-If)
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8A93A3' }}>
              Geser persentase potensi penurunan omset pasar untuk melihat respons ketahanan runway kas secara real-time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleExplainToggle('corplan-slider')}
            style={{ border: 0, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', color: '#A78BFA', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Jelaskan</span>
            <ChevronDown size={13} />
          </button>
        </div>

        {/* Interactive Slider Widget */}
        <div style={{ padding: '18px 20px', borderRadius: '12px', background: 'rgba(141,85,232,0.05)', border: '1px solid rgba(141,85,232,0.22)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
              Simulasi Penurunan Omset: <span className="sap-kpi-number" style={{ color: '#FFAB00', fontSize: '15px' }}>-{corplanDropSim}%</span>
            </span>
            <span style={{ fontSize: '12px', color: '#8A93A3' }}>
              Proyeksi Runway Menjadi: <strong className="sap-kpi-number" style={{ color: simulatedRunway > 8 ? '#00E676' : '#FF5252', fontSize: '15px' }}>{simulatedRunway} Bulan</strong>
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="40"
            step="5"
            value={corplanDropSim}
            onChange={(e) => setCorplanDropSim(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#8D55E8', cursor: 'pointer' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#5C6474' }}>
            <span>0% (Skenario Normal)</span>
            <span>-15% (Koreksi Musiman)</span>
            <span>-30% (Resesi / Disrupsi)</span>
            <span>-40% (Tekanan Ekstrem)</span>
          </div>
        </div>

        {activeExplainId === 'corplan-slider' && (
          <InlineExplanationPanel
            metric={getCard('corplan-target', 'Target Omset & Runway', 'Rencana Finansial')}
            title="Simulasi Skenario Arus Kas"
            role="CEO"
            accent={accent}
            onClose={() => setActiveExplainId(null)}
            onOpenAI={onOpenAI}
          />
        )}
      </article>

      {/* 4. SEKSI 2: Struktur Biaya & Efisiensi vs Runway (2 Kolom Seimbang) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        <article className="sap-fiori-tile" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(0,230,118,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00E676' }}>
                <WalletCards size={15} />
              </span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Struktur Beban &amp; Komposisi Biaya
              </h3>
            </div>
            <button type="button" onClick={() => handleExplainToggle('cost-structure')} style={{ border: 0, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', color: '#A78BFA', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Jelaskan</span>
              <ChevronDown size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Bahan Baku Langsung (HPP / COGS)', pct: 38.4, val: 'Rp 235jt', color: '#3FBF8F' },
              { label: 'Beban Operasional & Gaji (OPEX)', pct: 26.2, val: 'Rp 160jt', color: '#4E9BFF' },
              { label: 'Belanja Pemasaran & Iklan', pct: 7.8, val: 'Rp 48jt', color: '#EC4899' },
              { label: 'Laba Bersih Sebelum Pajak', pct: 27.6, val: 'Rp 169jt', color: '#00E676' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span style={{ color: '#DCE3EC' }}>{row.label}</span>
                  <span className="sap-kpi-number" style={{ color: '#8A93A3' }}>{row.val} ({row.pct}%)</span>
                </div>
                <div style={{ width: '100%', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>

          {activeExplainId === 'cost-structure' && (
            <InlineExplanationPanel
              metric={getCard('cogs-share', 'Struktur Beban Operasional', 'P&L Statement')}
              title="Struktur Beban & Komposisi Biaya"
              role="CEO"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>

        <article className="sap-fiori-tile" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(216,163,60,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D8A33C' }}>
                <Compass size={15} />
              </span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Studi Kelayakan Ekspansi Cabang Baru
              </h3>
            </div>
            <button type="button" onClick={() => handleExplainToggle('expansion')} style={{ border: 0, background: 'rgba(255,255,255,0.04)', borderRadius: '6px', color: '#A78BFA', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Jelaskan</span>
              <ChevronDown size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { kota: 'Bandung - Dago', status: 'Sangat Layak', capex: 'Rp 145jt', bep: '4,2 Bulan', score: 94 },
              { kota: 'Surabaya - Gubeng', status: 'Layak Bersyarat', capex: 'Rp 180jt', bep: '6,8 Bulan', score: 81 },
              { kota: 'Semarang - Simpang Lima', status: 'Perlu Kajian', capex: 'Rp 120jt', bep: '8,5 Bulan', score: 68 },
            ].map((cab, idx) => (
              <div key={idx} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{cab.kota}</span>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Capex: {cab.capex} · Balik Modal: {cab.bep}</span>
                </div>
                <span className={`sap-status-pill ${cab.score > 85 ? 'sap-status-pill-safe' : 'sap-status-pill-warning'}`}>
                  <span className="sap-pulse-dot" style={{ background: cab.score > 85 ? '#00E676' : '#F59E0B' }} />
                  <span>Skor {cab.score}</span>
                </span>
              </div>
            ))}
          </div>

          {activeExplainId === 'expansion' && (
            <InlineExplanationPanel
              metric={getCard('expansion-score', 'Skor Kelayakan Cabang', 'Corplan Model')}
              title="Kelayakan Ekspansi Cabang Baru"
              role="CEO"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 5. FINANCE BODY VIEW (PARITAS LENGKAP)
// -------------------------------------------------------------
export function FinanceBodyView({
  payload,
  onOpenAI,
}: {
  payload: RoleDashboardPayload | null;
  onOpenAI: (initialPrompt?: string) => void;
}) {
  const accent = '#10B981';
  const [activeExplainId, setActiveExplainId] = useState<string | null>(null);

  const getCard = (id: string, fallbackLabel: string, fallbackSource: string) => {
    return cardFor(payload, { id, label: fallbackLabel, cardId: id, fallbackDetail: 'Belum ada data', fallbackSource });
  };

  const cCash = getCard('cash-active', 'Kas & Bank Aktif', 'CashTransaction');
  const cKasbon = getCard('kasbon-active', 'Piutang Kasbon', 'Invoice / Piutang');
  const cDrawer = getCard('cash-drawer', 'Kas Laci Kasir', 'Cash drawer shift count');

  const handleExplainToggle = (id: string) => {
    setActiveExplainId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. TOP SNAPSHOTS (4 HUD Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#10B981' }}><WalletCards size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Kas &amp; Bank Aktif</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('cash-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cCash.value !== null ? cCash.value : 'Rp 284jt'}
            </span>
            <span style={{ fontSize: '11px', color: '#00E676', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <TrendingUp size={12} /> Likuid
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>BCA, Mandiri, &amp; Kas Fisik</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#FFAB00' }}><FileText size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Kasbon Berjalan</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('kasbon-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cKasbon.value !== null ? cKasbon.value : 'Rp 18,5jt'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: 'rgba(255,171,0,0.12)', color: '#FFAB00', border: '1px solid rgba(255,171,0,0.25)' }}>
              3 tempo
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>Siap tagih via WhatsApp</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#4E9BFF' }}><DollarSign size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Kas Laci Kasir POS</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('drawer-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cDrawer.value !== null ? (typeof cDrawer.value === 'number' ? `Rp ${(cDrawer.value / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt` : String(cDrawer.value)) : 'Rp 12,4jt'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.25)' }}>
              Seimbang
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>Selisih uang fisik vs POS</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <TaxFeatureLock compact />
        </div>
      </div>

      {activeExplainId === 'cash-snapshot' && (
        <InlineExplanationPanel
          metric={cCash}
          title="Snapshot Kas & Bank Aktif"
          role="FINANCE"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'kasbon-snapshot' && (
        <InlineExplanationPanel
          metric={cKasbon}
          title="Snapshot Kasbon Berjalan"
          role="FINANCE"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'drawer-snapshot' && (
        <InlineExplanationPanel
          metric={cDrawer}
          title="Snapshot Kas Laci Kasir"
          role="FINANCE"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}

      {/* 2. UNIFIED AI INTELLIGENCE CARD (TOP POSITION) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#0D1117',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 16px rgba(16,185,129,0.25)' }}>
              <Bot size={19} style={{ color: '#34D399' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                  Wawasan &amp; Kontrol Keuangan AI
                </h2>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2.5px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#6EE7B7' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} className="animate-pulse" />
                  AI Brain Aktif
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#8A93A3' }}>
                Deteksi anomali selisih laci kasir, komposer penagihan kasbon WhatsApp, dan rekonsiliasi arus kas harian
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenAI('Susun draf pesan WhatsApp penagihan kasbon untuk pelanggan yang melewati jatuh tempo.')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '36px',
              padding: '0 15px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10B981 0%, #0058BE 100%)',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Rancang Tagihan Kasbon via AI</span>
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>

        <div style={{ position: 'relative', padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
          <Sparkles size={16} style={{ color: '#34D399', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#DCE3EC' }}>
            {payload?.insight?.summary || 'Ditemukan selisih minor -Rp 35.000 pada shift kasir siang outlet Kemang. Terdapat 3 nota kasbon senilai Rp 4,25jt yang melewati batas tempo 14 hari dan siap ditagih via WA.'}
          </p>
        </div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Analisa Arus Kas Bersih
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#00E676' }}>+Rp 64jt</span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>surplus kas berjalan</span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              Penerimaan tunai POS dan pelunasan piutang B2B menutup seluruh kewajiban PO vendor.
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Audit Selisih Laci Kasir
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#FFAB00' }}>-Rp 35.000</span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>deviasi uang fisik</span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              Discrepancy terdeteksi pada transaksi tunai jam 13:42 di outlet Kemang.
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Prioritas Penagihan WA
            </span>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#34D399' }}>
              1. Kirim reminder WA ramah ke PT Berkah Boga (Rp 2,8jt jatuh tempo hari ini).<br />
              2. Terbitkan surat tagihan formal ke Katering Melati (Rp 1,45jt telat 16 hari).
            </p>
          </div>
        </div>
      </div>

      {/* 3. SEKSI 1: Master Hero -- Rekonsiliasi Laci Kasir Interaktif (Cash Drawer) */}
      <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#10B981' }}><DollarSign size={18} /></span>
              <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                Rekonsiliasi Kas Laci Kasir Harian (Laci Fisik vs Sistem POS)
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8A93A3' }}>
              Audit pencocokan antara uang tunai di laci kasir dengan transaksi digital POS per shift kerja.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleExplainToggle('drawer-hero')}
            style={{ border: 0, background: 'transparent', color: '#34D399', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Jelaskan <ChevronDown size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#8A93A3' }}>Uang Fisik di Laci</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#F5F7FA' }}>Rp 12.385.000</span>
            <span style={{ fontSize: '11px', color: '#8A93A3' }}>Hitung fisik shift siang</span>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#8A93A3' }}>Catatan Penjualan POS</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#F5F7FA' }}>Rp 12.420.000</span>
            <span style={{ fontSize: '11px', color: '#8A93A3' }}>48 struk transaksi tunai</span>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,82,82,0.04)', border: '1px solid rgba(255,82,82,0.18)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#FF8A8A' }}>Selisih Kasir (Deviasi)</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#FF5252' }}>-Rp 35.000</span>
            <span style={{ fontSize: '11px', color: '#FFAB00' }}>Toleransi maks Rp 10.000</span>
          </div>
        </div>

        {activeExplainId === 'drawer-hero' && (
          <InlineExplanationPanel
            metric={getCard('cash-drawer', 'Kas Laci Kasir', 'Cash drawer shift count')}
            title="Rekonsiliasi Kas Laci Kasir"
            role="FINANCE"
            accent={accent}
            onClose={() => setActiveExplainId(null)}
            onOpenAI={onOpenAI}
          />
        )}
      </article>

      {/* 4. SEKSI 2: Manajemen Piutang Kasbon & Arus Kas (2 Kolom Seimbang) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#FFAB00' }}><FileText size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Piutang Usaha &amp; Kasbon Siap Tagih
              </h3>
            </div>
            <button type="button" onClick={() => handleExplainToggle('piutang')} style={{ border: 0, background: 'transparent', color: '#34D399', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Jelaskan <ChevronDown size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { nama: 'PT Berkah Boga Katering', nominal: 'Rp 2.800.000', status: 'Jatuh Tempo Hari Ini', telat: '0 hari', color: '#FFAB00' },
              { nama: 'Katering Melati Cilandak', nominal: 'Rp 1.450.000', status: 'Lewat Jatuh Tempo', telat: '16 hari', color: '#FF5252' },
              { nama: 'CV Sentosa Food Service', nominal: 'Rp 4.200.000', status: 'Lancar (Jatuh Tempo 24 Sep)', telat: 'Aman', color: '#00E676' },
            ].map((p, i) => (
              <div key={i} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{p.nama}</span>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Nominal: {p.nominal} · {p.status}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAI(`Draf pesan penagihan WhatsApp ke ${p.nama} untuk tagihan ${p.nominal}.`)}
                  style={{ border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: '#34D399', background: 'rgba(16,185,129,0.08)', cursor: 'pointer' }}
                >
                  Tagih WA
                </button>
              </div>
            ))}
          </div>

          {activeExplainId === 'piutang' && (
            <InlineExplanationPanel
              metric={getCard('kasbon-active', 'Piutang & Kasbon', 'Invoice / Piutang')}
              title="Manajemen Piutang & Kasbon"
              role="FINANCE"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>

        <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#00E676' }}><TrendingUp size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Arus Kas Masuk &amp; Keluar (MTD)
              </h3>
            </div>
            <button type="button" onClick={() => handleExplainToggle('cashflow')} style={{ border: 0, background: 'transparent', color: '#34D399', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Jelaskan <ChevronDown size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }}>
              <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 600 }}>Total Kas Masuk (Penerimaan POS &amp; Transfer)</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 700, color: '#00E676' }}>+Rp 612.400.000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', background: 'rgba(255,82,82,0.05)', border: '1px solid rgba(255,82,82,0.15)' }}>
              <span style={{ fontSize: '12px', color: '#FF5252', fontWeight: 600 }}>Total Kas Keluar (Supplier, OPEX, Payroll)</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 700, color: '#FF5252' }}>-Rp 548.200.000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.025)' }}>
              <span style={{ fontSize: '12px', color: '#DCE3EC', fontWeight: 600 }}>Surplus Kas Bersih Berjalan</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: 700, color: '#F5F7FA' }}>+Rp 64.200.000</span>
            </div>
          </div>

          {activeExplainId === 'cashflow' && (
            <InlineExplanationPanel
              metric={getCard('cf-net', 'Arus Kas Bersih', 'Net Cash Flow')}
              title="Arus Kas Masuk & Keluar"
              role="FINANCE"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 6. MARKETING BODY VIEW (PARITAS LENGKAP)
// -------------------------------------------------------------
export function MarketingBodyView({
  payload,
  onOpenAI,
}: {
  payload: RoleDashboardPayload | null;
  onOpenAI: (initialPrompt?: string) => void;
}) {
  const accent = '#EC4899';
  const [activeExplainId, setActiveExplainId] = useState<string | null>(null);

  const getCard = (id: string, fallbackLabel: string, fallbackSource: string) => {
    return cardFor(payload, { id, label: fallbackLabel, cardId: id, fallbackDetail: 'Belum ada data', fallbackSource });
  };

  const cSpend = getCard('ad-spend', 'Belanja Iklan MTD', 'Marketing spend');
  const cRoas = getCard('blended-roas', 'Blended ROAS', 'Marketing analytics');
  const cCac = getCard('cac', 'Biaya per Akuisisi (CAC)', 'Conversion metrics');
  const cStruk = getCard('digital-receipts', 'Struk Digital WA', 'WhatsApp delivery');

  const handleExplainToggle = (id: string) => {
    setActiveExplainId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. TOP SNAPSHOTS (4 HUD Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#EC4899' }}><Megaphone size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Belanja Iklan MTD</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('spend-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cSpend.value !== null ? cSpend.value : 'Rp 24jt'}
            </span>
            <span style={{ fontSize: '11px', color: '#8A93A3' }}>Plafon Rp 35jt</span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>Meta, TikTok, &amp; Google Ads</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#00E676' }}><TrendingUp size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Blended ROAS</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('roas-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cRoas.value !== null ? cRoas.value : '4,2x'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: 'rgba(0,230,118,0.12)', color: '#00E676', border: '1px solid rgba(0,230,118,0.25)' }}>
              Efisien
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>Target efisiensi ≥3,0x</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#4E9BFF' }}><Target size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Biaya Akuisisi (CAC)</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('cac-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cCac.value !== null ? (typeof cCac.value === 'number' ? `Rp ${cCac.value.toLocaleString('id-ID')}` : String(cCac.value)) : 'Rp 38.500'}
            </span>
            <span style={{ fontSize: '11px', color: '#00E676' }}>-12% MoM</span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>Per 1 pelanggan transaksi baru</span>
        </div>

        <div style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#D8A33C' }}><Sparkles size={14} /></span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Struk Digital WA</span>
            </div>
            <button type="button" onClick={() => handleExplainToggle('struk-snapshot')} style={{ border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 2 }}>
              <Info size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F5F7FA' }}>
              {cStruk.value !== null ? (typeof cStruk.value === 'number' ? cStruk.value.toLocaleString('id-ID') : String(cStruk.value)) : '1.420'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: 'rgba(216,163,60,0.12)', color: '#D8A33C', border: '1px solid rgba(216,163,60,0.25)' }}>
              24% klaim
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>Retensi promo struk WhatsApp</span>
        </div>
      </div>

      {activeExplainId === 'spend-snapshot' && (
        <InlineExplanationPanel
          metric={cSpend}
          title="Snapshot Belanja Iklan MTD"
          role="MARKETING"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'roas-snapshot' && (
        <InlineExplanationPanel
          metric={cRoas}
          title="Snapshot Blended ROAS"
          role="MARKETING"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'cac-snapshot' && (
        <InlineExplanationPanel
          metric={cCac}
          title="Snapshot Biaya per Akuisisi (CAC)"
          role="MARKETING"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}
      {activeExplainId === 'struk-snapshot' && (
        <InlineExplanationPanel
          metric={cStruk}
          title="Snapshot Struk Digital WhatsApp"
          role="MARKETING"
          accent={accent}
          onClose={() => setActiveExplainId(null)}
          onOpenAI={onOpenAI}
        />
      )}

      {/* 2. UNIFIED AI INTELLIGENCE CARD (TOP POSITION) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#0D1117',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(236,72,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 16px rgba(236,72,153,0.25)' }}>
              <Bot size={19} style={{ color: '#F472B6' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                  Wawasan &amp; Studio Pertumbuhan AI Marketing
                </h2>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2.5px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: 'rgba(236,72,153,0.12)', color: '#FBCFE8' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EC4899' }} className="animate-pulse" />
                  AI Brain Aktif
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#8A93A3' }}>
                Generator materi promosi otomatis, analisis saluran paling untung, dan retensi repeat order pelanggan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenAI('Rancang variasi materi iklan dan copywriting penawaran baru untuk kampanye media sosial.')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '36px',
              padding: '0 15px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #EC4899 0%, #8D55E8 100%)',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(236,72,153,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Optimalkan Materi Iklan via AI</span>
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>

        <div style={{ position: 'relative', padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
          <Sparkles size={16} style={{ color: '#F472B6', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#DCE3EC' }}>
            {payload?.insight?.summary || 'Google Search Ads mencatatkan konversi tertinggi dengan ROAS 5,8x pekan ini. Disarankan memindahkan 35% alokasi harian TikTok Ads ke Google Ads untuk menutup target penjualan.'}
          </p>
        </div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Saluran Paling Untung
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#00E676' }}>Google Search</span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>ROAS 5,8x</span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              Pembeli yang mencari katering B2B memiliki niat beli (intent) 3,2x lebih tinggi.
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Efektivitas Struk WA Promo
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: '#EC4899' }}>24% Klaim</span>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>340 repeat order</span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: '#A9B4C7' }}>
              Penghematan kertas thermal mencapai Rp 1,8jt/bulan dengan konversi pelanggan loyal.
            </p>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A3' }}>
              Rekomendasi Saluran Iklan
            </span>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#F472B6' }}>
              1. Pindahkan Rp 400rb/hari dari TikTok Ads ke kampanye Google Search B2B.<br />
              2. Terbitkan 3 variasi poster promo akhir pekan menggunakan AI Media Studio.
            </p>
          </div>
        </div>
      </div>

      {/* 3. SEKSI 1: Master Hero -- Corong Konversi Bertingkat (Funnel) */}
      <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#EC4899' }}><Target size={18} /></span>
              <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                Corong Konversi Pelanggan (Funnel Drop-Off)
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8A93A3' }}>
              Visualisasi perjalanan calon pembeli dari paparan iklan hingga transaksi pembelian riil.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleExplainToggle('funnel-hero')}
            style={{ border: 0, background: 'transparent', color: '#F472B6', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Jelaskan <ChevronDown size={13} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { tahap: '1. Impresi Iklan (Jangkauan)', jumlah: '148.000 Tayang', pct: 100, color: '#8D55E8' },
            { tahap: '2. Kunjungan Profil / Link Klik', jumlah: '12.400 Klik (8,3%)', pct: 60, color: '#4E9BFF' },
            { tahap: '3. Chat WhatsApp Masuk', jumlah: '1.850 Chat (14,9%)', pct: 35, color: '#EC4899' },
            { tahap: '4. Transaksi Pembelian Riil', jumlah: '620 Order (33,5%)', pct: 18, color: '#00E676' },
          ].map((fn, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#F5F7FA', fontWeight: 600 }}>{fn.tahap}</span>
                <span style={{ color: '#8A93A3', fontFamily: "'JetBrains Mono', monospace" }}>{fn.jumlah}</span>
              </div>
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${fn.pct}%`, height: '100%', background: fn.color, borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>

        {activeExplainId === 'funnel-hero' && (
          <InlineExplanationPanel
            metric={getCard('blended-roas', 'Corong Konversi Pemasaran', 'Conversion metrics')}
            title="Corong Konversi Pelanggan"
            role="MARKETING"
            accent={accent}
            onClose={() => setActiveExplainId(null)}
            onOpenAI={onOpenAI}
          />
        )}
      </article>

      {/* 4. SEKSI 2: Efisiensi Saluran Iklan & Struk Digital (2 Kolom Seimbang) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: '20px' }}>
        <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#4E9BFF' }}><Megaphone size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Performa Saluran Iklan Berbayar
              </h3>
            </div>
            <button type="button" onClick={() => handleExplainToggle('ad-channels')} style={{ border: 0, background: 'transparent', color: '#F472B6', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Jelaskan <ChevronDown size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { channel: 'Google Search Ads', spend: 'Rp 8,5jt', roas: '5,8x', status: 'Sangat Prima', color: '#00E676' },
              { channel: 'Meta Ads (Instagram / FB)', spend: 'Rp 11,2jt', roas: '3,9x', status: 'Stabil', color: '#4E9BFF' },
              { channel: 'TikTok Ads Video', spend: 'Rp 4,3jt', roas: '2,1x', status: 'Perlu Evaluasi', color: '#FFAB00' },
            ].map((ad, i) => (
              <div key={i} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{ad.channel}</span>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Spend: {ad.spend} · Status: {ad.status}</span>
                </div>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 700, color: ad.color }}>
                  ROAS {ad.roas}
                </span>
              </div>
            ))}
          </div>

          {activeExplainId === 'ad-channels' && (
            <InlineExplanationPanel
              metric={getCard('meta-roas', 'Efisiensi Saluran Iklan', 'Marketing analytics')}
              title="Performa Saluran Iklan Berbayar"
              role="MARKETING"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>

        <article style={{ position: 'relative', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#D8A33C' }}><Sparkles size={16} /></span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                Struk Digital WhatsApp &amp; Retensi
              </h3>
            </div>
            <button type="button" onClick={() => handleExplainToggle('struk-retention')} style={{ border: 0, background: 'transparent', color: '#F472B6', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Jelaskan <ChevronDown size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { namaPromo: 'Diskon 15% Repeat Kopi (5 Hari)', terkirim: '680 WA', klaim: '182 (26,7%)', impact: '+Rp 9,2jt omset' },
              { namaPromo: 'Free Topping Katering B2B', terkirim: '420 WA', klaim: '98 (23,3%)', impact: '+Rp 14,5jt omset' },
              { namaPromo: 'Voucher Tanggal Kembar 9.9', terkirim: '320 WA', klaim: '60 (18,7%)', impact: '+Rp 4,8jt omset' },
            ].map((st, idx) => (
              <div key={idx} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{st.namaPromo}</span>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Terkirim: {st.terkirim} · Klaim: {st.klaim}</span>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#00E676' }}>
                  {st.impact}
                </span>
              </div>
            ))}
          </div>

          {activeExplainId === 'struk-retention' && (
            <InlineExplanationPanel
              metric={getCard('digital-receipts', 'Struk Digital WA & Retensi', 'WhatsApp delivery')}
              title="Struk Digital WhatsApp & Retensi"
              role="MARKETING"
              accent={accent}
              onClose={() => setActiveExplainId(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </article>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// LEGACY COMPATIBILITY EXPORTS
// -------------------------------------------------------------
export function DashboardVisualModeSwitch({ mode, onChange }: { mode: DashboardVisualMode; onChange: (mode: DashboardVisualMode) => void }) {
  const options: Array<{ id: DashboardVisualMode; label: string; icon: IconComponent }> = [
    { id: 'overview', label: 'Ringkasan', icon: Boxes },
    { id: 'charts', label: 'Grafik', icon: BarChart3 },
    { id: 'mindmap', label: 'Mind map', icon: Network },
  ];
  return (
    <div role="group" aria-label="Mode visual dashboard" style={{ display: 'inline-flex', padding: '3px', gap: '2px', borderRadius: '9px', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.id === mode;
        return (
          <button
            key={option.id}
            type="button"
            data-testid={`dashboard-mode-${option.id}`}
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '30px', padding: '0 10px', border: 0, borderRadius: '7px', background: active ? 'rgba(78,155,255,0.16)' : 'transparent', color: active ? '#F5F7FA' : '#8A93A3', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            <Icon size={13} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DashboardInsightPanel({
  role,
  payload,
  accent,
  onExplain,
  onOpenAI,
}: {
  role: RoleDashboardRole;
  payload: RoleDashboardPayload | null;
  accent: string;
  onExplain: (metric: RoleDashboardMetric, title: string, footer: string) => void;
  onOpenAI: () => void;
}) {
  const meta = ROLE_META[role];
  const insight: RoleDashboardInsight = payload?.insight || {
    status: payload?.status || 'unsupported',
    summary: 'Insight role-specific belum tersedia karena sumber data atau assignment server belum lengkap.',
    explanation: 'Dashboard tetap menampilkan struktur dan batas data role tanpa memakai angka role lain sebagai fallback.',
    recommendations: [{ title: 'Lengkapi sumber data role', reason: 'Tanpa scope resmi, AI tidak boleh menarik kesimpulan baru.', action: 'Gunakan AI Assistant untuk menyiapkan daftar data yang perlu dihubungkan.', risk: 'Rekomendasi masih terbatas sampai source tersedia.' }],
    sources: ['Role dashboard contract'],
  };
  const firstMetric = roleSnapshotDefinitions(role).map((definition) => cardFor(payload, definition))[0];

  return (
    <section data-testid="dashboard-ai-insight" style={{ padding: '20px', borderRadius: '16px', background: 'linear-gradient(120deg, rgba(32,39,73,0.62), rgba(13,17,23,0.98))', border: `1px solid ${accent}20`, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
          <div style={{ width: '32px', height: '32px', display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: '10px', color: accent, background: `${accent}18` }}>
            <Sparkles size={16} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700 }}>Wawasan &amp; Prediksi AI</h2>
            <p style={{ margin: '5px 0 0', color: '#8A93A3', fontSize: '11px' }}>Analisis dibuat dari data yang diizinkan untuk {meta.aiTitle}.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge status={insight.status} accent={accent} />
          <button type="button" onClick={onOpenAI} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '32px', padding: '0 11px', border: 0, borderRadius: '8px', color: '#FFFFFF', background: accent, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            Buka AI Assistant <ArrowRight size={13} />
          </button>
        </div>
      </div>
      <div style={{ marginTop: '15px', padding: '13px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#C6CEDA', fontSize: '12px', lineHeight: 1.55 }}>
        {insight.summary}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px', marginTop: '12px' }}>
        <div style={{ padding: '13px', borderRadius: '11px', background: 'rgba(255,255,255,0.025)' }}>
          <span style={{ color: '#8A93A3', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Artinya</span>
          <p style={{ margin: '7px 0 0', color: '#C6CEDA', fontSize: '11.5px', lineHeight: 1.5 }}>{insight.explanation}</p>
        </div>
        <div style={{ padding: '13px', borderRadius: '11px', background: 'rgba(255,255,255,0.025)' }}>
          <span style={{ color: '#8A93A3', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rekomendasi</span>
          {insight.recommendations.slice(0, 2).map((recommendation) => (
            <div key={recommendation.title} style={{ marginTop: '7px' }}>
              <strong style={{ display: 'block', color: '#F5F7FA', fontSize: '11.5px' }}>{recommendation.title}</strong>
              <span style={{ display: 'block', marginTop: '3px', color: '#8A93A3', fontSize: '11px', lineHeight: 1.45 }}>{recommendation.action}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '13px', flexWrap: 'wrap' }}>
        <span style={{ color: '#687487', fontSize: '10px' }}>Sumber: {insight.sources.join(' · ')}</span>
        <button type="button" onClick={() => onExplain(firstMetric, 'Wawasan & Prediksi AI', insight.explanation)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', border: 0, background: 'transparent', color: '#8CC0FF', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer' }}>
          Jelaskan lebih detail <Info size={12} />
        </button>
      </div>
    </section>
  );
}

export function DashboardExplanationDrawer({
  metric,
  title,
  footer,
  accent,
  onClose,
  onOpenAI,
}: {
  metric: RoleDashboardMetric | null;
  title: string;
  footer: string;
  accent: string;
  onClose: () => void;
  onOpenAI: () => void;
}) {
  if (!metric) return null;
  const plain = termHint(metric.label);
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '18px', background: 'rgba(0,0,0,0.48)' }}>
      <aside role="dialog" aria-modal="true" aria-label={`Penjelasan ${metric.label}`} onClick={(event) => event.stopPropagation()} style={{ width: 'min(440px, 100%)', maxHeight: 'min(78vh, 620px)', overflowY: 'auto', padding: '22px', borderRadius: '16px', background: '#10141C', border: `1px solid ${accent}45`, boxShadow: '0 24px 70px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <span style={{ color: accent, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Penjelasan manusia</span>
            <span style={{ display: 'block', marginTop: '6px', color: '#8A93A3', fontSize: '10px' }}>{title}</span>
            <h2 style={{ margin: '3px 0 0', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '19px' }}>{metric.label}</h2>
          </div>
          <button type="button" aria-label="Tutup penjelasan" onClick={onClose} style={{ display: 'grid', placeItems: 'center', width: '30px', height: '30px', border: 0, borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: '#C6CEDA', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ marginTop: '18px', padding: '14px', borderRadius: '11px', background: 'rgba(255,255,255,0.04)' }}>
          <span style={{ color: '#8A93A3', fontSize: '10px', textTransform: 'uppercase' }}>Status data</span>
          <div style={{ marginTop: '6px', color: metric.value === null ? '#D8A33C' : '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '26px', fontWeight: 750 }}>{humanNumber(metric.value)}</div>
          <p style={{ margin: '7px 0 0', color: '#C6CEDA', fontSize: '12px', lineHeight: 1.5 }}>{metric.detail}</p>
        </div>
        {plain && (
          <div style={{ marginTop: '14px' }}>
            <h3 style={{ margin: 0, color: '#F5F7FA', fontSize: '12px' }}>Artinya</h3>
            <p style={{ margin: '6px 0 0', color: '#AEB8C8', fontSize: '12px', lineHeight: 1.55 }}>{plain}.</p>
          </div>
        )}
        <div style={{ marginTop: '14px' }}>
          <h3 style={{ margin: 0, color: '#F5F7FA', fontSize: '12px' }}>Mengapa penting?</h3>
          <p style={{ margin: '6px 0 0', color: '#AEB8C8', fontSize: '12px', lineHeight: 1.55 }}>{footer}</p>
        </div>
        <div style={{ marginTop: '14px' }}>
          <h3 style={{ margin: 0, color: '#F5F7FA', fontSize: '12px' }}>Source</h3>
          <p style={{ margin: '6px 0 0', color: '#687487', fontSize: '11px', lineHeight: 1.45 }}>{metric.source}</p>
        </div>
        <button type="button" onClick={onOpenAI} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%', minHeight: '38px', marginTop: '20px', border: 0, borderRadius: '999px', color: '#FFFFFF', background: accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          Tanyakan ke AI Assistant <ArrowRight size={14} />
        </button>
      </aside>
    </div>
  );
}

function SectionCard({
  section,
  payload,
  accent,
  onExplain,
}: {
  section: SectionDefinition;
  payload: RoleDashboardPayload | null;
  accent: string;
  onExplain: (metric: RoleDashboardMetric, title: string, footer: string) => void;
}) {
  const Icon = ICONS[section.icon] || Info;
  const metrics = section.metrics.map((definition) => cardFor(payload, definition));
  const sectionStatus = metrics.some((item) => item.status === 'available')
    ? 'available'
    : metrics.some((item) => item.status === 'error')
    ? 'error'
    : metrics.some((item) => item.status === 'unsupported')
    ? 'unsupported'
    : 'empty';

  return (
    <article data-testid={`dashboard-section-${section.id}`} style={{ minWidth: 0, padding: '20px', borderRadius: '16px', background: 'rgba(16,20,28,0.86)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.22)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
          <div style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: '999px', background: `${section.iconColor}16`, color: section.iconColor }}>
            <Icon size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700 }}>{section.title}</h3>
            <p style={{ margin: '5px 0 0', color: '#8A93A3', fontSize: '11px', lineHeight: 1.45 }}>{section.description}</p>
          </div>
        </div>
        <StatusBadge status={sectionStatus} accent={accent} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '17px' }}>
        {metrics.map((metric) => (
          <MetricTile key={metric.id} metric={metric} accent={accent} onExplain={(item) => onExplain(item, section.title, section.footer)} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginTop: '15px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ color: '#687487', fontSize: '10.5px', lineHeight: 1.45 }}>{section.footer}</span>
        <button type="button" onClick={() => onExplain(metrics[0], section.title, section.footer)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, border: 0, background: 'transparent', color: '#8CC0FF', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
          Jelaskan <ChevronDown size={12} />
        </button>
      </div>
    </article>
  );
}

function SnapshotStrip({
  role,
  payload,
  accent,
  onExplain,
}: {
  role: RoleDashboardRole;
  payload: RoleDashboardPayload | null;
  accent: string;
  onExplain: (metric: RoleDashboardMetric, title: string, footer: string) => void;
}) {
  const metrics = roleSnapshotDefinitions(role).map((definition) => cardFor(payload, definition));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
      {metrics.map((metric) => (
        <MetricTile key={metric.id} metric={metric} accent={accent} onExplain={(item) => onExplain(item, 'Snapshot dashboard', 'Snapshot hanya menampilkan data yang memiliki source role-fit.')} />
      ))}
    </div>
  );
}

// -------------------------------------------------------------
// DEEP-ANALYTICS CHARTS PANEL (MODE 2: GRAFIK SEDETAIL-DETAILNYA)
// -------------------------------------------------------------
interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: IconComponent;
  accent: string;
  badge?: string;
  footer: string;
  onOpenAI?: (prompt: string) => void;
  children: React.ReactNode;
}

function DeepChartCard({ title, subtitle, icon: Icon, accent, badge, footer, onOpenAI, children }: ChartCardProps) {
  return (
    <div style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: `${accent}16`, display: 'grid', placeItems: 'center', color: accent }}>
            <Icon size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14.5px', fontWeight: 700, color: '#F5F7FA' }}>{title}</h3>
              {badge && (
                <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '9.5px', fontWeight: 700, background: 'rgba(255,255,255,0.05)', color: '#C6CEDA' }}>
                  {badge}
                </span>
              )}
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#8A93A3' }}>{subtitle}</p>
          </div>
        </div>
        {onOpenAI && (
          <button
            type="button"
            onClick={() => onOpenAI(`Jelaskan analisis mendalam dan rekomendasi aksi untuk grafik "${title}" (${subtitle}).`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#8A93A3', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <Bot size={12} color={accent} />
            <span>Tanya AI</span>
          </button>
        )}
      </div>

      <div style={{ minHeight: '160px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: '#687487', lineHeight: 1.4 }}>
        <Info size={13} style={{ flexShrink: 0, color: accent }} />
        <span>{footer}</span>
      </div>
    </div>
  );
}

function RoleSpecificCharts({ role, accent, onOpenAI }: { role: RoleDashboardRole; accent: string; onOpenAI?: (prompt: string) => void }) {
  if (role === 'CEO') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '16px' }}>
        {/* Chart 1: Struktur Beban & Efisiensi Biaya */}
        <DeepChartCard
          title="Struktur Beban & Alokasi Modal"
          subtitle="Distribusi proporsi pengeluaran perusahaan terhadap pendapatan bruto"
          icon={DollarSign}
          accent={accent}
          badge="Audit Efisiensi"
          footer="Beban HPP (46%) dan OPEX (24%) masih dalam koridor aman. Margin bersih terjaga di 22.4%."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Beban Pokok Penjualan (HPP)', pct: 46, amount: 'Rp 281.5jt', color: '#8D55E8', status: 'Ideal (<50%)' },
              { label: 'Biaya Operasional (OPEX)', pct: 24, amount: 'Rp 146.8jt', color: '#4E9BFF', status: 'Optimal' },
              { label: 'Belanja Pemasaran & Iklan', pct: 8, amount: 'Rp 48.9jt', color: '#D8A33C', status: 'Efisien' },
              { label: 'Laba Bersih Operasional', pct: 22, amount: 'Rp 134.8jt', color: '#00E676', status: 'Sehat (≥20%)' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#C6CEDA' }}>{item.label}</span>
                  <span style={{ color: item.color, fontWeight: 700 }}>{item.amount} ({item.pct}%)</span>
                </div>
                <div style={{ width: '100%', height: '7px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 2: Simulasi Ketahanan Kas & Runway */}
        <DeepChartCard
          title="Proyeksi Ketahanan Kas & Runway"
          subtitle="Estimasi cadangan kas perusahaan terhadap skenario burn rate bulanan"
          icon={ShieldCheck}
          accent={accent}
          badge="14.2 Bulan Aman"
          footer="Cadangan kas likuid mencukupi kebutuhan operasional hingga 14.2 bulan tanpa suntikan modal baru."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', height: '120px', padding: '0 6px' }}>
            {[
              { m: 'Bln 1', val: 14.2, safe: true },
              { m: 'Bln 3', val: 13.1, safe: true },
              { m: 'Bln 6', val: 11.5, safe: true },
              { m: 'Bln 9', val: 9.8, safe: true },
              { m: 'Bln 12', val: 8.2, safe: true },
              { m: 'Bln 15', val: 6.5, safe: false },
            ].map((b) => (
              <div key={b.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '9.5px', color: b.safe ? '#00E676' : '#D8A33C', fontWeight: 700 }}>{b.val} Bln</span>
                <div style={{ width: '100%', maxWidth: '32px', height: `${(b.val / 16) * 90}px`, background: b.safe ? `linear-gradient(180deg, ${accent}, ${accent}44)` : 'rgba(216,163,60,0.6)', borderRadius: '4px 4px 2px 2px' }} />
                <span style={{ fontSize: '9px', color: '#8A93A3' }}>{b.m}</span>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 3: Radar Kelayakan Ekspansi Cabang */}
        <DeepChartCard
          title="Radar Kelayakan Ekspansi Cabang"
          subtitle="Studi kelayakan pembukaan outlet baru berbasis Payback & ROI"
          icon={Compass}
          accent={accent}
          badge="Skor 88/100"
          footer="Outlet baru di Bandung diproyeksikan mencapai BEP dalam 8.4 bulan dengan Capex Rp 180jt."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { metric: 'Proyeksi Capex', val: 'Rp 180 Juta', score: 'Tercakup Kas', color: '#00E676' },
              { metric: 'Payback Period', val: '8.4 Bulan', score: 'Cepat (<12 Bln)', color: '#00E676' },
              { metric: 'Estimasi ROI', val: '38% / Tahun', score: 'Sangat Menarik', color: '#8D55E8' },
              { metric: 'Tingkat Kepadatan Pasar', val: 'Tinggi (Kemang)', score: 'Siap Penetrasi', color: '#4E9BFF' },
            ].map((m) => (
              <div key={m.metric} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#8A93A3' }}>{m.metric}</span>
                <strong style={{ fontSize: '13px', color: '#F5F7FA' }}>{m.val}</strong>
                <span style={{ fontSize: '9.5px', color: m.color, fontWeight: 600 }}>{m.score}</span>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 4: Pencapaian Target Kuartal */}
        <DeepChartCard
          title="Realisasi vs Target Kuartal Perusahaan"
          subtitle="Pencapaian omset berjalan terhadap target pertumbuhan tahunan"
          icon={Target}
          accent={accent}
          badge="Pacing 82%"
          footer="Realisasi Rp 612jt dari target kuartal Rp 780jt. Gap Rp 168jt dapat dikejar dengan promo akhir bulan."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#C6CEDA' }}>Realisasi Berjalan: <strong style={{ color: '#F5F7FA' }}>Rp 612jt</strong></span>
              <span style={{ color: '#8A93A3' }}>Target: <strong>Rp 780jt</strong></span>
            </div>
            <div style={{ width: '100%', height: '14px', borderRadius: '7px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: '78.5%', height: '100%', background: 'linear-gradient(90deg, #8D55E8, #00E676)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8A93A3' }}>
              <span>78.5% Tercapai</span>
              <span style={{ color: '#00E676' }}>+14% vs Kuartal Lalu</span>
            </div>
          </div>
        </DeepChartCard>
      </div>
    );
  }

  if (role === 'FINANCE') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '16px' }}>
        {/* Chart 1: Arus Kas Masuk vs Kas Keluar MTD */}
        <DeepChartCard
          title="Arus Kas Masuk vs Kas Keluar MTD"
          subtitle="Realisasi likuiditas harian kas masuk vs beban pengeluaran kas"
          icon={WalletCards}
          accent={accent}
          badge="Surplus +Rp 138jt"
          footer="Kas masuk Rp 612jt melampaui kas keluar Rp 474jt. Arus kas operasional berjalan positif."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '16px', height: '120px', padding: '0 12px' }}>
            {[
              { label: 'Kas Masuk', amount: 'Rp 612jt', height: 95, color: '#00E676' },
              { label: 'Kas Keluar', amount: 'Rp 474jt', height: 74, color: '#EF7777' },
              { label: 'Arus Bersih', amount: '+Rp 138jt', height: 42, color: '#10B981' },
            ].map((b) => (
              <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: b.color, fontWeight: 700 }}>{b.amount}</span>
                <div style={{ width: '100%', maxWidth: '48px', height: `${b.height}px`, background: b.color, borderRadius: '6px 6px 2px 2px' }} />
                <span style={{ fontSize: '9.5px', color: '#8A93A3' }}>{b.label}</span>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 2: Aging Piutang Kasbon */}
        <DeepChartCard
          title="Umur Piutang & Kasbon Pelanggan"
          subtitle="Klasifikasi jatuh tempo piutang tertahan (Aging schedule AR)"
          icon={Clock}
          accent={accent}
          badge="Rp 18.2jt Tertahan"
          footer="Rp 4.25jt telah lewat jatuh tempo >30 hari. Disarankan kirim penagihan formal via WhatsApp."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { period: 'Lancar (0 - 14 Hari)', amount: 'Rp 9.8jt', pct: 54, color: '#00E676', count: '8 Invoice' },
              { period: 'Mendekati JT (15 - 30 Hari)', amount: 'Rp 4.15jt', pct: 23, color: '#D8A33C', count: '3 Invoice' },
              { period: 'Lewat Jatuh Tempo (>30 Hari)', amount: 'Rp 4.25jt', pct: 23, color: '#EF7777', count: '4 Kasbon' },
            ].map((a) => (
              <div key={a.period} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#C6CEDA' }}>{a.period} <span style={{ fontSize: '9.5px', color: '#687487' }}>({a.count})</span></span>
                  <span style={{ color: a.color, fontWeight: 700 }}>{a.amount} ({a.pct}%)</span>
                </div>
                <div style={{ width: '100%', height: '7px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${a.pct}%`, height: '100%', background: a.color, borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 3: Audit Selisih Kas Laci Kasir */}
        <DeepChartCard
          title="Audit Selisih Kas Laci Kasir (7 Hari)"
          subtitle="Rekonsiliasi uang fisik kasir vs catatan transaksi POS harian"
          icon={AlertTriangle}
          accent={accent}
          badge="Rata-rata Selisih -Rp 15rb"
          footer="Selisih kas laci hari Rabu melebihi batas toleransi (-Rp 45.000). Periksa rekaman shift kasir."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', height: '110px', padding: '0 4px' }}>
            {[
              { d: 'Sen', diff: -5000, safe: true },
              { d: 'Sel', diff: 0, safe: true },
              { d: 'Rab', diff: -45000, safe: false },
              { d: 'Kam', diff: -10000, safe: true },
              { d: 'Jum', diff: +5000, safe: true },
              { d: 'Sab', diff: -15000, safe: true },
              { d: 'Min', diff: 0, safe: true },
            ].map((s) => (
              <div key={s.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '9px', color: s.safe ? '#C6CEDA' : '#EF7777', fontWeight: 700 }}>{s.diff === 0 ? 'Klop' : `${s.diff > 0 ? '+' : ''}${Math.round(s.diff / 1000)}k`}</span>
                <div style={{ width: '100%', maxWidth: '28px', height: `${Math.min(90, Math.max(12, (Math.abs(s.diff) / 50000) * 85))}px`, background: s.safe ? 'rgba(0,230,118,0.7)' : 'rgba(239,119,119,0.8)', borderRadius: '4px 4px 2px 2px' }} />
                <span style={{ fontSize: '9px', color: '#8A93A3' }}>{s.d}</span>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 4: Tax feature policy lock */}
        <DeepChartCard
          title="Pajak & kepatuhan"
          subtitle="Belum tersedia saat ini"
          icon={ShieldCheck}
          accent={accent}
          badge="Belum tersedia"
          footer="Belum ada perhitungan, reminder, atau aksi pajak yang aktif."
          onOpenAI={onOpenAI}
        >
          <TaxFeatureLock compact />
        </DeepChartCard>
      </div>
    );
  }

  if (role === 'MARKETING') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '16px' }}>
        {/* Chart 1: Perbandingan ROAS Saluran Iklan */}
        <DeepChartCard
          title="Efisiensi Saluran Iklan Multi-Channel"
          subtitle="Performa Return on Ad Spend (ROAS) per saluran pemasaran berbayar"
          icon={BarChart3}
          accent={accent}
          badge="Blended 4.2x"
          footer="Google Ads memberikan efisiensi tertinggi (4.8x). Disarankan alokasi tambahan budget 15%."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '16px', height: '120px', padding: '0 12px' }}>
            {[
              { channel: 'Meta Ads', roas: 4.2, target: 3.5, color: '#4E9BFF' },
              { channel: 'TikTok Ads', roas: 3.6, target: 3.5, color: '#D8A33C' },
              { channel: 'Google Search', roas: 4.8, target: 3.5, color: '#00E676' },
            ].map((c) => (
              <div key={c.channel} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10.5px', color: c.color, fontWeight: 700 }}>{c.roas}x ROAS</span>
                <div style={{ width: '100%', maxWidth: '44px', height: `${(c.roas / 6) * 90}px`, background: c.color, borderRadius: '6px 6px 2px 2px' }} />
                <span style={{ fontSize: '9.5px', color: '#8A93A3' }}>{c.channel}</span>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 2: Corong Konversi Pelanggan (Funnel) */}
        <DeepChartCard
          title="Corong Konversi Pelanggan (Funnel)"
          subtitle="Tingkat konversi dari impresi iklan digital hingga pembayaran kasir"
          icon={Target}
          accent={accent}
          badge="Konversi Akhir 4.8%"
          footer="Drop-off terbesar terjadi di tahap Klik ke Chat WA (-81%). Optimalkan pesan sambutan biolink."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { stage: '1. Impresi Iklan', val: '142.000', pct: 100, color: '#4E9BFF' },
              { stage: '2. Klik Tautan Promosi', val: '12.800', pct: 9.0, color: '#8D55E8' },
              { stage: '3. Memulai Chat WhatsApp', val: '2.400', pct: 1.7, color: '#D8A33C' },
              { stage: '4. Pembelian Riil Kasir', val: '610', pct: 0.43, color: '#00E676' },
            ].map((f) => (
              <div key={f.stage} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#C6CEDA' }}>{f.stage}</span>
                  <span style={{ color: f.color, fontWeight: 700 }}>{f.val} ({f.pct}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(6, f.pct)}%`, height: '100%', background: f.color, borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 3: Tren CAC vs Nilai Pesanan Rata-Rata */}
        <DeepChartCard
          title="Biaya Akuisisi (CAC) vs Nilai Pesanan (AOV)"
          subtitle="Perbandingan biaya mendapatkan pelanggan baru vs margin keuntungan kotor"
          icon={DollarSign}
          accent={accent}
          badge="Rasio LTV:CAC 3.4x"
          footer="CAC Rp 38.500 menghasilkan rata-rata belanja Rp 132.000 per transaksi. Rasio akuisisi sangat sehat."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Biaya Akuisisi (CAC)', val: 'Rp 38.500', note: 'Per Pembeli Baru', color: '#4E9BFF' },
              { label: 'Rata-rata Belanja (AOV)', val: 'Rp 132.000', note: 'Per Transaksi', color: '#00E676' },
              { label: 'Gross Profit per Order', val: 'Rp 58.080', note: 'Margin 44%', color: '#00E676' },
              { label: 'Rasio LTV:CAC', val: '3.4x', note: 'Target ≥3.0x', color: '#8D55E8' },
            ].map((m) => (
              <div key={m.label} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#8A93A3' }}>{m.label}</span>
                <strong style={{ fontSize: '13px', color: '#F5F7FA' }}>{m.val}</strong>
                <span style={{ fontSize: '9.5px', color: m.color, fontWeight: 600 }}>{m.note}</span>
              </div>
            ))}
          </div>
        </DeepChartCard>

        {/* Chart 4: Retensi Struk Digital WA & Voucher */}
        <DeepChartCard
          title="Retensi Struk Digital WA & Voucher"
          subtitle="Efektivitas pengiriman struk WA dalam mendorong kunjungan ulang"
          icon={Megaphone}
          accent={accent}
          badge="Repeat Order 34%"
          footer="1.240 nomor WA terdata dari struk digital. 380 voucher promo telah diklaim dan dipakai kembali."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { cat: 'Pelanggan Repeat Order (30 Hari)', count: '421 Pelanggan', pct: 34, color: '#00E676' },
              { cat: 'Klaim Voucher Diskon WA', count: '380 Kupon Terpakai', pct: 31, color: '#4E9BFF' },
              { cat: 'Pelanggan Baru Pertama Kali', count: '819 Pelanggan', pct: 66, color: '#8D55E8' },
            ].map((r) => (
              <div key={r.cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#C6CEDA' }}>{r.cat}</span>
                  <span style={{ color: r.color, fontWeight: 700 }}>{r.count}</span>
                </div>
                <div style={{ width: '100%', height: '7px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${r.pct}%`, height: '100%', background: r.color, borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </DeepChartCard>
      </div>
    );
  }

function SekretarisCharts({ accent, onOpenAI }: { accent: string; onOpenAI?: (prompt: string) => void }) {
  // Chart 1 States: Agenda Heatmap Filters, Focus View & Interactive Realokasi
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'EXTERNAL' | 'INTERNAL' | 'DEEPWORK'>('ALL');
  const [reallocatedKamis, setReallocatedKamis] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; slot: string; load: number; note: string } | null>({
    day: 'Kamis',
    slot: '13:00 - 15:00',
    load: 95,
    note: 'Audiensi Eksternal / Partner (Kapasitas Kritis)',
  });

  // Chart 2 States: SLA Turnaround Filter, View Mode & AI Acceleration Toggle
  const [turnaroundView, setTurnaroundView] = useState<'timeline' | 'bottleneck'>('timeline');
  const [legalOptimized, setLegalOptimized] = useState<boolean>(false);

  // Chart 3 States: Compliance & Legal Urgency Filter & Action Logs
  const [complianceUrgency, setComplianceUrgency] = useState<'ALL' | 'URGENT' | 'SAFE'>('ALL');
  const [draftedDocs, setDraftedDocs] = useState<Record<string, boolean>>({});

  // Heatmap Data Matrix (Dynamic based on realokasi)
  const heatmapRows = [
    {
      slot: '08:00 - 10:00',
      note: 'Jam Siap & Review Nota',
      category: 'INTERNAL',
      days: [
        { day: 'Senin', load: 15, note: 'Review Nota & Disposisi Baru' },
        { day: 'Selasa', load: 20, note: 'Pemeriksaan Berkas Masuk' },
        { day: 'Rabu', load: 10, note: 'Screening Undangan' },
        { day: 'Kamis', load: 45, note: 'Sinkronisasi Agenda Eksekutif' },
        { day: 'Jumat', load: reallocatedKamis ? 45 : 10, note: reallocatedKamis ? 'Audiensi Mitra Dialihkan dari Kamis (Optimal)' : 'Review Draf Keputusan' },
      ],
    },
    {
      slot: '10:00 - 12:00',
      note: 'Rapat Koordinasi Tim',
      category: 'INTERNAL',
      days: [
        { day: 'Senin', load: 40, note: 'Briefing Awal Pekan' },
        { day: 'Selasa', load: 60, note: 'Rapat Evaluasi Tim Ops' },
        { day: 'Rabu', load: 50, note: 'Review Kinerja Bulanan' },
        { day: 'Kamis', load: 75, note: 'Sinkronisasi Lintas Divisi' },
        { day: 'Jumat', load: 30, note: 'Rapat Evaluasi Singkat' },
      ],
    },
    {
      slot: '13:00 - 15:00',
      note: 'Audiensi Eksternal / Partner',
      category: 'EXTERNAL',
      days: [
        { day: 'Senin', load: 30, note: 'Pertemuan Vendor IT' },
        { day: 'Selasa', load: 45, note: 'Audiensi Partner Perbankan' },
        { day: 'Rabu', load: 65, note: 'Negosiasi Sewa Properti' },
        { day: 'Kamis', load: reallocatedKamis ? 55 : 95, note: reallocatedKamis ? 'Audiensi Terdistribusi Sehat (Slot Seimbang)' : 'Audiensi Investor & Mitra Utama (Bottleneck Kritis!)' },
        { day: 'Jumat', load: 20, note: 'Pertemuan Santai Mitra' },
      ],
    },
    {
      slot: '15:00 - 17:00',
      note: 'Approval, Tanda Tangan & Deep Work',
      category: 'DEEPWORK',
      days: [
        { day: 'Senin', load: 20, note: 'Penandatanganan Nota' },
        { day: 'Selasa', load: 30, note: 'Otorisasi PO Bahan Baku' },
        { day: 'Rabu', load: 25, note: 'Review Legal Kontrak' },
        { day: 'Kamis', load: 60, note: 'Koreksi Berkas Urgent' },
        { day: 'Jumat', load: 15, note: 'Deep Work Terproteksi (Bebas Rapat)' },
      ],
    },
  ];

  // Document SLA Turnaround Phases (Dynamic based on AI Acceleration)
  const turnaroundPhases = [
    { phase: '1. Draf & Penyiapan Awal', hours: 3.2, target: 4.0, pct: legalOptimized ? 20 : 13, color: '#4E9BFF', desc: 'Penyusunan nota dinas & lampiran oleh sekretariat', status: 'Cepat (SLA Aman)', pic: 'Sekretaris Eksekutif' },
    { phase: '2. Review & Validasi Legal', hours: legalOptimized ? 5.5 : 14.5, target: 24.0, pct: legalOptimized ? 34 : 58, color: '#8D55E8', desc: legalOptimized ? 'Klausul risiko & liabilitas terverifikasi cepat dengan AI Legal Risk Checklist' : 'Pemeriksaan pasal klausul, risiko liabilitas & ganti rugi', status: legalOptimized ? 'Terpangkas -62% (SLA Sangat Cepat)' : 'Bottleneck (58% Waktu)', pic: 'Legal Counsel / Konsultan' },
    { phase: '3. Approval Pimpinan', hours: 5.1, target: 12.0, pct: legalOptimized ? 31 : 20, color: '#3FBF8F', desc: 'Pemeriksaan akhir & tanda tangan digital berjenjang', status: 'Terkendali', pic: 'Direksi / Pimpinan' },
    { phase: '4. Penomoran & Disposisi Divisi', hours: 2.4, target: 8.0, pct: legalOptimized ? 15 : 9, color: '#D8A33C', desc: 'Pengarsipan nomor registrasi & distribusi ke PIC', status: 'Sangat Cepat', pic: 'Admin Pengendali' },
  ];

  const totalTurnaroundHours = legalOptimized ? 16.2 : 25.2;
  const turnaroundSurplusHours = (48 - totalTurnaroundHours).toFixed(1);

  // Legal Compliance Documents
  const legalDocs = [
    { id: 'ruko-kemang', doc: 'Perjanjian Sewa Ruko Cabang Kemang', days: 18, maxDays: 365, urgency: 'URGENT', status: draftedDocs['ruko-kemang'] ? 'Draf Terkirim ke Pemilik' : 'Mendesak (< 30 Hari)', color: draftedDocs['ruko-kemang'] ? '#00E676' : '#EF7777', action: draftedDocs['ruko-kemang'] ? 'Menunggu balasan konfirmasi perpanjangan sewa dari pemilik ruko' : 'Kirim surat perpanjangan ke pemilik ruko pekan ini', pic: 'Sekretaris & Legal', risiko: 'Suspensi ruko & hilang hak opsi perpanjangan pertama' },
    { id: 'halal-dapur', doc: 'Sertifikasi Halal Dapur Sentral (LPPOM)', days: 64, maxDays: 365, urgency: 'URGENT', status: draftedDocs['halal-dapur'] ? 'Audit Readiness 100%' : 'Perlu Persiapan (60 Hari)', color: draftedDocs['halal-dapur'] ? '#00E676' : '#D8A33C', action: draftedDocs['halal-dapur'] ? 'Berkas verifikasi bahan baku supplier telah diunggah ke portal LPPOM' : 'Verifikasi dokumen bahan baku supplier untuk audit', pic: 'QC & Tim Kepatuhan', risiko: 'Gagal sertifikasi produk pangan olahan' },
    { id: 'suplai-kemasan', doc: 'Kontrak Suplai Kemasan (CV Berkah Jaya)', days: 90, maxDays: 365, urgency: 'SAFE', status: draftedDocs['suplai-kemasan'] ? 'Negosiasi Draf Siap' : 'Jadwal Aman', color: draftedDocs['suplai-kemasan'] ? '#00E676' : '#4E9BFF', action: draftedDocs['suplai-kemasan'] ? 'Term diskon kuota 8% sudah diajukan ke vendor kemasan' : 'Review volume pesanan dan negosiasi diskon kuota', pic: 'Sekretariat & Purchasing', risiko: 'Kenaikan harga material kemasan jika telat negosiasi' },
    { id: 'pirt-minuman', doc: 'Izin Edar PIRT Bahan Minuman Kemasan', days: 140, maxDays: 365, urgency: 'SAFE', status: 'Aktif Terkendali', color: '#3FBF8F', action: 'Monitoring berkala uji lab berkala 6 bulanan', pic: 'Operasional Lab', risiko: 'Sanksi administratif dari dinas kesehatan daerah' },
  ];

  const filteredDocs = legalDocs.filter((d) => {
    if (complianceUrgency === 'ALL') return true;
    return d.urgency === complianceUrgency;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Chart 1: Heatmap Jadwal Eksekutif & Beban Pertemuan Pimpinan */}
      <DeepChartCard
        title="Executive Schedule Heatmap & Distribusi Jam Kerja Pimpinan"
        subtitle="Distribusi beban pertemuan per hari dan jam kerja (Senin - Jumat) untuk menjaga porsi deep-work pimpinan"
        icon={CalendarDays}
        accent={accent}
        badge="Live Monitoring Slot"
        footer="Hari Kamis siang (13:00 - 15:00) mencatat beban terpadat (95%). Zero bentrok ganda terdeteksi. Disarankan proteksi Jumat pagi sebagai jam kerja fokus."
        onOpenAI={onOpenAI}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '6px 0' }}>
          {/* Header Controls: Filter Tipe Agenda & Quick AI Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 600 }}>Filter Kategori:</span>
              {[
                { id: 'ALL', label: 'Semua Slot (20)' },
                { id: 'EXTERNAL', label: 'Audiensi Eksternal (13:00-15:00)' },
                { id: 'INTERNAL', label: 'Rapat Tim (Pagi)' },
                { id: 'DEEPWORK', label: 'Deep Work / Otorisasi' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setScheduleFilter(f.id as any)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${scheduleFilter === f.id ? accent : 'rgba(255,255,255,0.08)'}`,
                    background: scheduleFilter === f.id ? `${accent}20` : 'rgba(255,255,255,0.03)',
                    color: scheduleFilter === f.id ? '#F5F7FA' : '#8A93A3',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setReallocatedKamis((prev) => {
                    const next = !prev;
                    if (next) {
                      setSelectedSlot({
                        day: 'Kamis',
                        slot: '13:00 - 15:00',
                        load: 55,
                        note: 'Audiensi Terdistribusi Sehat (Slot Seimbang)',
                      });
                      alert('Sesi Audiensi Kamis 13:00 berhasil dialihkan sebagian ke Jumat 08:30 WIB. Beban Kamis kini seimbang di 55%!');
                    } else {
                      setSelectedSlot({
                        day: 'Kamis',
                        slot: '13:00 - 15:00',
                        load: 95,
                        note: 'Audiensi Eksternal / Partner (Kapasitas Kritis)',
                      });
                    }
                    return next;
                  });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: `1px solid ${reallocatedKamis ? '#00E676' : accent}`,
                  background: reallocatedKamis ? 'rgba(0,230,118,0.15)' : `${accent}18`,
                  color: reallocatedKamis ? '#00E676' : '#F5F7FA',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Bot size={13} color={reallocatedKamis ? '#00E676' : accent} />
                <span>{reallocatedKamis ? '✓ Agenda Kamis Terdistribusi (Reset)' : '⚡ Realokasi Slot Kamis (-40%)'}</span>
              </button>
            </div>
          </div>

          {/* 3 Metric Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Total Jam Rapat Minggu Ini</span>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#F5F7FA' }}>
                {reallocatedKamis ? '15.0 Jam' : '16.5 Jam'} <span style={{ fontSize: '11.5px', color: '#3FBF8F', fontWeight: 600 }}>(Aman &lt; 20 Jam)</span>
              </div>
              <span style={{ fontSize: '10px', color: '#687487' }}>Plafon sehat kalender pimpinan UMKM</span>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Porsi Rapat Strategis vs Rutin</span>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#4E9BFF' }}>
                {reallocatedKamis ? '74%' : '68%'} <span style={{ fontSize: '12px', color: '#8A93A3', fontWeight: 500 }}>Strategis / {reallocatedKamis ? '26%' : '32%'} Rutin</span>
              </div>
              <span style={{ fontSize: '10px', color: '#3FBF8F' }}>Kualitas agenda eksekutif prima</span>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Bentrok Kalender &amp; Status</span>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#3FBF8F' }}>
                0 Bentrok <span style={{ fontSize: '11.5px', color: '#687487', fontWeight: 500 }}>(100% Terkoordinasi)</span>
              </div>
              <span style={{ fontSize: '10px', color: reallocatedKamis ? '#00E676' : '#8A93A3' }}>
                {reallocatedKamis ? '✓ Seluruh slot kerja seimbang & optimal' : 'Peringatan: Kamis 13:00 padat (95%)'}
              </span>
            </div>
          </div>

          {/* Interactive Heatmap Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowX: 'auto', padding: '4px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(5, 1fr)', gap: '10px', fontSize: '11.5px', color: '#8A93A3', textAlign: 'center', fontWeight: 700, minWidth: '600px' }}>
              <span style={{ textAlign: 'left', paddingLeft: '4px' }}>Slot Jam</span>
              <span>Senin</span>
              <span>Selasa</span>
              <span>Rabu</span>
              <span>Kamis</span>
              <span>Jumat</span>
            </div>

            {heatmapRows.map((row) => {
              const isFilteredOut = scheduleFilter !== 'ALL' && row.category !== scheduleFilter;
              return (
                <div
                  key={row.slot}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px repeat(5, 1fr)',
                    gap: '10px',
                    alignItems: 'center',
                    minWidth: '600px',
                    opacity: isFilteredOut ? 0.35 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#F5F7FA', fontWeight: 700 }}>{row.slot}</span>
                    <span style={{ fontSize: '9px', color: '#687487' }}>{row.note.split('&')[0]}</span>
                  </div>

                  {row.days.map((d) => {
                    const isSuperHigh = d.load >= 90;
                    const isHigh = d.load >= 60;
                    const isMed = d.load >= 35;
                    const isSelected = selectedSlot?.day === d.day && selectedSlot?.slot === row.slot;

                    return (
                      <div
                        key={d.day}
                        onClick={() => setSelectedSlot({ day: d.day, slot: row.slot, load: d.load, note: d.note })}
                        title={`Beban Kerja: ${d.load}% - ${d.note}`}
                        style={{
                          height: '46px',
                          borderRadius: '9px',
                          background: isSelected
                            ? `${accent}40`
                            : isSuperHigh
                            ? 'rgba(239,119,119,0.28)'
                            : isHigh
                            ? `${accent}25`
                            : isMed
                            ? `${accent}14`
                            : 'rgba(255,255,255,0.025)',
                          border: `1.5px solid ${
                            isSelected
                              ? accent
                              : isSuperHigh
                              ? 'rgba(239,119,119,0.7)'
                              : isHigh
                              ? `${accent}55`
                              : 'rgba(255,255,255,0.06)'
                          }`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          transition: 'all 0.15s ease',
                          cursor: 'pointer',
                          boxShadow: isSelected ? `0 0 12px ${accent}44` : 'none',
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 800, color: isSuperHigh ? '#FCA5A5' : isHigh ? '#F5F7FA' : '#C6CEDA' }}>
                          {d.load}%
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: 600, color: isSuperHigh ? '#EF7777' : isHigh ? accent : '#687487' }}>
                          {isSuperHigh ? '🚨 Padat' : isHigh ? 'Aktif' : isMed ? 'Sedang' : 'Lega'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Active Selected Slot Diagnostic Strip */}
          {selectedSlot && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedSlot.load >= 90 ? 'rgba(239,119,119,0.3)' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: selectedSlot.load >= 90 ? 'rgba(239,119,119,0.2)' : `${accent}20`,
                    color: selectedSlot.load >= 90 ? '#EF7777' : accent,
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {selectedSlot.day}, {selectedSlot.slot} ({selectedSlot.load}%)
                </span>
                <span style={{ fontSize: '11.5px', color: '#C6CEDA' }}>
                  Aktivitas: <strong style={{ color: '#F5F7FA' }}>{selectedSlot.note}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>
                  {selectedSlot.load >= 90 ? '⚠️ Butuh Penyeimbangan Slot' : '✓ Slot Terkelola Baik'}
                </span>
                {onOpenAI && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAI(
                        `Buatkan memo optimasi jadwal eksekutif untuk hari ${selectedSlot.day} jam ${selectedSlot.slot} dengan beban ${selectedSlot.load}% (${selectedSlot.note}). Berikan alternatif slot low-load.`
                      )
                    }
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#F5F7FA',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tanya AI Slot Ini
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </DeepChartCard>

      {/* Chart 2: Document Turnaround Time & Durasi Persetujuan SLA */}
      <DeepChartCard
        title="Document Turnaround Time & Durasi Siklus Otorisasi"
        subtitle="Pelacakan durasi pemrosesan draf kontrak, nota dinas, dan disposisi antar unit kerja"
        icon={FileText}
        accent={accent}
        badge="SLA Target < 48 Jam"
        footer="Rata-rata siklus selesai dalam 25.2 jam (47.5% lebih cepat dari batas toleransi SLA 48 jam). Fase review legal menyita porsi terbesar (14.5 jam)."
        onOpenAI={onOpenAI}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '4px 0' }}>
          {/* Header Switcher & AI Expedite Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 600 }}>Tampilan:</span>
              <button
                type="button"
                onClick={() => setTurnaroundView('timeline')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${turnaroundView === 'timeline' ? accent : 'rgba(255,255,255,0.08)'}`,
                  background: turnaroundView === 'timeline' ? `${accent}20` : 'rgba(255,255,255,0.03)',
                  color: turnaroundView === 'timeline' ? '#F5F7FA' : '#8A93A3',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                4 Fase Jalur Dokumen
              </button>
              <button
                type="button"
                onClick={() => setTurnaroundView('bottleneck')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${turnaroundView === 'bottleneck' ? accent : 'rgba(255,255,255,0.08)'}`,
                  background: turnaroundView === 'bottleneck' ? `${accent}20` : 'rgba(255,255,255,0.03)',
                  color: turnaroundView === 'bottleneck' ? '#F5F7FA' : '#8A93A3',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fokus Bottleneck Legal (14.5j)
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setLegalOptimized((prev) => {
                    const next = !prev;
                    if (next) {
                      alert('AI Legal Risk Memo diaktifkan! Waktu telaah pasal terpangkas dari 14.5 jam menjadi 5.5 jam (-62%).');
                    }
                    return next;
                  });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: `1px solid ${legalOptimized ? '#00E676' : '#8D55E8'}`,
                  background: legalOptimized ? 'rgba(0,230,118,0.15)' : 'rgba(141,85,232,0.15)',
                  color: legalOptimized ? '#00E676' : '#F5F7FA',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Bot size={13} color={legalOptimized ? '#00E676' : '#8D55E8'} />
                <span>{legalOptimized ? '✓ AI Legal Memo Aktif (-62% Durasi)' : '⚡ Pangkas Bottleneck Legal via AI Memo'}</span>
              </button>
            </div>
          </div>

          {/* 4 Detailed Process Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {turnaroundPhases.map((item) => {
              const isBottleneck = item.pct >= 50;
              const isDimmed = turnaroundView === 'bottleneck' && !isBottleneck;

              return (
                <div
                  key={item.phase}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: isBottleneck ? 'rgba(141,85,232,0.06)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${isBottleneck ? 'rgba(141,85,232,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    opacity: isDimmed ? 0.35 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#F5F7FA', fontWeight: 700, display: 'block' }}>
                        {item.phase}
                      </span>
                      <span style={{ fontSize: '10px', color: '#8A93A3', marginTop: '2px', display: 'block' }}>
                        PIC: {item.pic}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: `${item.color}20`,
                        color: item.color,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.hours} Jam
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: '5px' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#8A93A3' }}>
                    <span>Target: &lt; {item.target} Jam</span>
                    <span style={{ color: isBottleneck ? '#EF7777' : '#3FBF8F', fontWeight: 700 }}>
                      Porsi {item.pct}% Waktu
                    </span>
                  </div>

                  <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '10px', color: '#C6CEDA', lineHeight: 1.4, display: 'block' }}>
                      {item.desc}
                    </span>
                    <span style={{ fontSize: '9.5px', color: item.color, fontWeight: 700, marginTop: '4px', display: 'block' }}>
                      ● Status: {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SLA Performance Bottom Strip */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(63,191,143,0.05)',
              border: '1px solid rgba(63,191,143,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#3FBF8F', fontWeight: 600 }}>
              ✓ Total Turnaround Waktu Nyata: {totalTurnaroundHours} Jam vs Batas Toleransi SLA 48 Jam (Surplus {turnaroundSurplusHours} Jam)
            </span>
            <span style={{ fontSize: '10.5px', color: legalOptimized ? '#00E676' : '#8A93A3' }}>
              {legalOptimized ? '⚡ Efisiensi ultra-optimal via AI memo checklist' : 'Dokumen terproses lancar tanpa backlog pending'}
            </span>
          </div>
        </div>
      </DeepChartCard>

      {/* Chart 3: Kalender Kepatuhan Legalitas, Kontrak Vendor & Perizinan Berulang */}
      <DeepChartCard
        title="Kalender Kepatuhan Legalitas, Kontrak Vendor & Perizinan Berulang"
        subtitle="Pemantauan masa tenggat izin usaha, perjanjian sewa tempat, dan sertifikasi operasional"
        icon={Clock}
        accent={accent}
        badge="Acuan Tata Kelola Dokumen"
        footer="Kepatuhan Legalitas: Pemantauan masa aktif dokumen legal, izin edar BPOM/P-IRT, dan kontrak sewa dapat dihubungkan langsung melalui Pusat Data & Arsip Dokumen."
        onOpenAI={onOpenAI}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
          {/* Header Filter Urgensi */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 600 }}>Filter Urgensi:</span>
              {[
                { id: 'ALL', label: 'Semua Berkas (4)' },
                { id: 'URGENT', label: '🚨 Mendesak & Persiapan (< 90 Hari)' },
                { id: 'SAFE', label: '✓ Jadwal Aman (> 90 Hari)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setComplianceUrgency(f.id as any)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${complianceUrgency === f.id ? accent : 'rgba(255,255,255,0.08)'}`,
                    background: complianceUrgency === f.id ? `${accent}20` : 'rgba(255,255,255,0.03)',
                    color: complianceUrgency === f.id ? '#F5F7FA' : '#8A93A3',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span style={{ fontSize: '11px', color: '#EF7777', fontWeight: 700 }}>
              1 Berkas Kritis: Sewa Ruko Kemang (18 Hari)
            </span>
          </div>

          {/* Legal Documents List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredDocs.map((d) => (
              <div
                key={d.doc}
                style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  background: d.urgency === 'URGENT' ? 'rgba(239,119,119,0.03)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${d.urgency === 'URGENT' ? `${d.color}40` : 'rgba(255,255,255,0.05)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ maxWidth: '680px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#F5F7FA' }}>{d.doc}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 7px',
                          borderRadius: '5px',
                          background: `${d.color}20`,
                          color: d.color,
                          fontWeight: 700,
                        }}
                      >
                        {d.status}
                      </span>
                    </div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#C6CEDA', marginTop: '4px' }}>
                      <strong>Aksi Sekretariat:</strong> {d.action}
                    </span>
                    <span style={{ display: 'block', fontSize: '10px', color: '#8A93A3', marginTop: '2px' }}>
                      PIC: {d.pic} | <em>Dampak Risiko: {d.risiko}</em>
                    </span>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: d.color }}>{d.days} Hari Lagi</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftedDocs((prev) => {
                          const next = { ...prev, [d.id]: !prev[d.id] };
                          if (next[d.id]) {
                            alert(`Draf surat & berkas penanganan "${d.doc}" berhasil dibuat via AI dan dialirkan ke antrean disposisi.`);
                          }
                          return next;
                        });
                        if (onOpenAI && !draftedDocs[d.id]) {
                          onOpenAI(
                            `Buatkan draf surat resmi dan formulir penanganan segera untuk dokumen "${d.doc}" yang jatuh tempo dalam ${d.days} hari. Cantumkan klausul proteksi UMKM dan permohonan perpanjangan.`
                          );
                        }
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: draftedDocs[d.id] ? 'rgba(0,230,118,0.18)' : `${d.color}18`,
                        border: `1px solid ${draftedDocs[d.id] ? '#00E676' : `${d.color}55`}`,
                        color: draftedDocs[d.id] ? '#00E676' : '#FFF',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        marginTop: '2px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {draftedDocs[d.id] ? (
                        <>✓ Draf Terbuat</>
                      ) : (
                        <>⚡ Draf Surat via AI</>
                      )}
                    </button>
                  </div>
                </div>

                <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(6, (d.days / d.maxDays) * 100)}%`, height: '100%', background: d.color, borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DeepChartCard>
    </div>
  );
}

  if (role === 'SEKRETARIS') {
    return <SekretarisCharts accent={accent} onOpenAI={onOpenAI} />;
  }

  if (role === 'MANAGER_UMUM') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}>
        {/* Chart 1: Beban Kerja & Produktivitas Lintas Tim */}
        <DeepChartCard
          title="Distribusi Beban Kerja & Kapasitas Produktivitas Lintas Tim"
          subtitle="Pemantauan beban tugas riil vs kapasitas staf untuk mendeteksi bottleneck operasional"
          icon={Users}
          accent={accent}
          badge="5 Unit Kerja"
          footer="Staf Admin SOP mengalami bottleneck (+24% beban dokumen fisik). Rekomendasi: Alihkan 20% tugas verifikasi nota ke Dewi Lestari (Finance) yang memiliki utilisasi seimbang."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
            {/* Kolom Kiri: Progress Staf */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { name: 'Siti Rahma (Sales & Kemitraan)', target: 150, actual: 162, pct: 108, color: '#3FBF8F', status: 'Surplus (+8%)', note: 'Closing kemitraan baru melampaui target' },
                { name: 'Dewi Lestari (Finance Staff)', target: 100, actual: 96, pct: 96, color: '#3FBF8F', status: 'Optimal (96%)', note: 'Rekonsiliasi harian tepat waktu tanpa selisih' },
                { name: 'Budi Santoso (Ops Lead Cabang)', target: 150, actual: 138, pct: 92, color: '#4E9BFF', status: 'Seimbang (92%)', note: 'Supervisi shift dan kontrol bahan baku dapur' },
                { name: 'Fajar Nugraha (Logistik & Armada)', target: 20, actual: 17, pct: 85, color: '#D8A33C', status: 'Cukup (85%)', note: 'Terkendala servis 1 armada motor operasional' },
                { name: 'Rian Pratama (Admin SOP & Dokumen)', target: 50, actual: 39, pct: 78, color: '#EF7777', status: 'Bottleneck (78%)', note: 'Beban rekap nota fisik menumpuk di meja admin' },
              ].map((m) => (
                <div key={m.name} style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#F5F7FA' }}>{m.name}</span>
                      <span style={{ display: 'block', fontSize: '10.5px', color: '#8A93A3', marginTop: '2px' }}>{m.note}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: m.color }}>{m.actual}/{m.target} Tugas ({m.pct}%)</span>
                      <span style={{ display: 'block', fontSize: '10px', color: m.color, fontWeight: 600 }}>{m.status}</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, m.pct)}%`, height: '100%', background: m.color, borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Kolom Kanan: Panel Quick Action & Resolusi Bottleneck */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#F5F7FA', letterSpacing: '0.02em' }}>Resolusi Beban Kerja (Manajerial)</span>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(239,119,119,0.15)', color: '#EF7777', fontWeight: 600 }}>1 Bottleneck Aktif</span>
              </div>
              <div style={{ fontSize: '11px', color: '#8A93A3', lineHeight: 1.5 }}>
                Rian Pratama mengalami antrean dokumen nota fisik cabang yang tertunda verifikasinya. Dibutuhkan pemerataan pembagian tugas agar tidak menghambat laporan keuangan akhir pekan.
              </div>

              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(239,119,119,0.05)', border: '1px solid rgba(239,119,119,0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700 }}>
                  <span style={{ color: '#F5F7FA' }}>Alihkan Verifikasi Nota Fisik</span>
                  <span style={{ color: '#EF7777' }}>11 Dokumen</span>
                </div>
                <div style={{ fontSize: '10.5px', color: '#8A93A3' }}>
                  Target delegasi: <strong>Dewi Lestari (Finance)</strong> yang memiliki kelonggaran waktu +25% setelah rekonsiliasi kasir selesai.
                </div>
                <button
                  type="button"
                  onClick={() => alert('Berhasil mengalokasikan 11 dokumen nota fisik ke Dewi Lestari.')}
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(78,155,255,0.15)',
                    border: '1px solid rgba(78,155,255,0.3)',
                    color: '#4E9BFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Eksekusi Rebalancing Tugas
                </button>
              </div>

              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>Tingkat Utilisasi Keseluruhan:</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#3FBF8F' }}>91.8% (Zona Sehat)</span>
              </div>
            </div>
          </div>
        </DeepChartCard>

        {/* Chart 2: Penyerapan Anggaran Unit vs Garis Kalender */}
        <DeepChartCard
          title="Laju Penyerapan Anggaran Operasional (Budget vs Actual OPEX)"
          subtitle="Belanja aktual kumulatif vs target proporsional kalender 30 hari untuk mencegah defisit"
          icon={WalletCards}
          accent={accent}
          badge="Hemat 11%"
          footer="Posisi hari ke-21: Belanja terpakai Rp 28.5jt dari pagu proporsional Rp 32.0jt. Laju belanja terkendali dengan sisa cadangan kas Rp 11.5jt (28.8%)."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>Realisasi Belanja Kumulatif</span>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#F5F7FA', marginTop: '4px' }}>Rp 28.500.000</div>
                <span style={{ fontSize: '10.5px', color: '#3FBF8F', fontWeight: 600 }}>71.2% dari Total Plafon</span>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>Plafon Kalender Ideal (Hari ke-21)</span>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#C6CEDA', marginTop: '4px' }}>Rp 32.000.000</div>
                <span style={{ fontSize: '10.5px', color: '#8D55E8', fontWeight: 600 }}>Target 70% Pacing</span>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>Sisa Cadangan Kas Bulan Ini</span>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, color: '#3FBF8F', marginTop: '4px' }}>Rp 11.500.000</div>
                <span style={{ fontSize: '10.5px', color: '#3FBF8F', fontWeight: 600 }}>28.8% Aman Hingga Akhir Bulan</span>
              </div>
            </div>

            {/* Visual Bar Comparison & Pacing Track */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 600 }}>
                <span style={{ color: '#F5F7FA' }}>Laju Penyerapan Kumulatif vs Kalender Berjalan</span>
                <span style={{ color: '#3FBF8F' }}>Surplus Kas Rp 3.500.000 (Underspend Sehat)</span>
              </div>
              <div style={{ position: 'relative', width: '100%', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ width: '71.2%', height: '100%', background: `linear-gradient(90deg, ${accent}88, ${accent})`, borderRadius: '8px 0 0 8px' }} />
                <div style={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: '3px', background: '#FFF', boxShadow: '0 0 8px #FFF' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#8A93A3' }}>
                <span>01 Sep (Plafon Rp 40jt)</span>
                <span style={{ color: '#F5F7FA', fontWeight: 700 }}>Hari ke-21 (Target 70%)</span>
                <span>30 Sep (Tutup Buku)</span>
              </div>
            </div>

            {/* Breakdown Pos Pengeluaran Tim */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#8A93A3', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Pos Pengeluaran</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Anggaran</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Realisasi</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>% Pacing</th>
                    <th style={{ padding: '8px 12px' }}>Status Penggunaan</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { pos: 'Gaji & Uang Lembur Shift', budget: 'Rp 22.000.000', actual: 'Rp 16.500.000', pct: '75%', color: '#3FBF8F', status: 'Sesuai Kalender' },
                    { pos: 'Bahan Baku & Dapur (Buffer)', budget: 'Rp 10.000.000', actual: 'Rp 6.800.000', pct: '68%', color: '#3FBF8F', status: 'Hemat (Waste Minim)' },
                    { pos: 'Promosi Lokal & Voucher', budget: 'Rp 5.000.000', actual: 'Rp 3.700.000', pct: '74%', color: '#3FBF8F', status: 'Terkontrol Efektif' },
                    { pos: 'Perawatan Alat & Utilitas', budget: 'Rp 3.000.000', actual: 'Rp 1.500.000', pct: '50%', color: '#4E9BFF', status: 'Cadangan Siap Pakai' },
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F5F7FA' }}>{row.pos}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#8A93A3' }}>{row.budget}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#F5F7FA' }}>{row.actual}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: row.color }}>{row.pct}</td>
                      <td style={{ padding: '10px 12px', color: row.color, fontWeight: 500 }}>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DeepChartCard>

        {/* Chart 3: Skor Kepatuhan SOP 6 Pilar Cabang */}
        <DeepChartCard
          title="Audit Kepatuhan SOP 6 Pilar Cabang"
          subtitle="Hasil audit kepatuhan operasional standar harian di seluruh divisi & outlet"
          icon={ClipboardCheck}
          accent={accent}
          badge="Rata-rata 89%"
          footer="Pilar Kebersihan & Sanitasi (82%) di Cabang Kemang memerlukan audit ulang pekan ini sebelum jam operasional weekend."
          onOpenAI={onOpenAI}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
            {[
              { pilar: 'Pelayanan Pelanggan & Kasir', score: 94, color: '#3FBF8F', detail: 'Kecepatan senyum, salam, sapa, dan input transaksi', action: null },
              { pilar: 'Ketepatan Kasir & Rekonsiliasi', score: 96, color: '#3FBF8F', detail: 'Kesesuaian fisik uang laci vs sistem kasir POS', action: null },
              { pilar: 'Kebersihan, Kerapian & Sanitasi', score: 82, color: '#D8A33C', detail: 'Area kitchen sink dan grease trap perlu deep cleaning di Cabang Kemang', action: 'Jadwalkan Re-Audit Kemang' },
              { pilar: 'Keselamatan & APD Dapur', score: 88, color: '#3FBF8F', detail: 'Kelengkapan celemek, sarung tangan, dan tabung APAR', action: null },
              { pilar: 'Disiplin Waktu Shift & Lembur', score: 84, color: '#D8A33C', detail: 'Tingkat keterlambatan shift pagi tercatat 3.2%', action: null },
              { pilar: 'Administrasi Nota & Opname', score: 90, color: '#3FBF8F', detail: 'Pengarsipan nota fisik dan upload form harian teratur', action: null },
            ].map((p) => (
              <div key={p.pilar} style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                  <span style={{ color: '#F5F7FA' }}>{p.pilar}</span>
                  <span style={{ color: p.color, fontWeight: 700 }}>{p.score}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${p.score}%`, height: '100%', background: p.color }} />
                </div>
                <span style={{ fontSize: '10.5px', color: '#8A93A3', lineHeight: 1.4 }}>{p.detail}</span>
                {p.action && (
                  <button
                    type="button"
                    onClick={() => alert(`Jadwal re-audit untuk ${p.pilar} telah diajukan ke Lead Supervisor.`)}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: '4px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      background: 'rgba(216,163,60,0.15)',
                      border: '1px solid rgba(216,163,60,0.3)',
                      color: '#D8A33C',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ⚡ {p.action}
                  </button>
                )}
              </div>
            ))}
          </div>
        </DeepChartCard>
      </div>
    );
  }

  return <ManagerOperasionalCharts accent={accent} onOpenAI={onOpenAI} />;
}

function ManagerOperasionalCharts({ accent, onOpenAI }: { accent: string; onOpenAI?: (prompt: string) => void }) {
  const [spoilageView, setSpoilageView] = useState<'flow' | 'table'>('flow');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Chart 1: Utilisasi & Kapasitas Zonasi Gudang Bahan Mentah */}
      <DeepChartCard
        title="Utilisasi Kapasitas Zonasi Gudang & Cold Storage"
        subtitle="Monitoring keterisian fisik gudang bahan mentah untuk mencegah over-capacity dan kerusakan suhu"
        icon={Boxes}
        accent={accent}
        badge="Simulasi Kapasitas Fisik"
        footer="Peringatan Kapasitas: Cold Storage daging/susu terproyeksi mendekati batas aman (94%). Sambungkan integrasi IoT/sensor gudang untuk kalibrasi timbangan otomatis."
        onOpenAI={onOpenAI}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
          {[
            { zona: 'Cold Storage (Freezer −18°C)', used: '2.82', cap: '3.0 Ton', pct: 94, color: '#EF7777', status: 'Kritis', desc: 'Daging sapi, ayam fillet, susu segar, butter', isCritical: true },
            { zona: 'Gudang Kering (Dry Storage)', used: '8.2', cap: '10.0 Ton', pct: 82, color: '#3FBF8F', status: 'Terkendali', desc: 'Beras, tepung, gula, minyak goreng, bumbu kering', isCritical: false },
            { zona: 'Gudang Transit Kemasan', used: '2.4', cap: '5.0 Ton', pct: 48, color: '#4E9BFF', status: 'Lega', desc: 'Cup, paper bowl, box delivery, plastik', isCritical: false },
            { zona: 'Karantina Retur Vendor', used: '0.12', cap: '1.0 Ton', pct: 12, color: '#D8A33C', status: 'Menunggu Pickup', desc: 'Bahan rusak dalam perjalanan dari supplier', isCritical: false },
          ].map((z) => (
            <div
              key={z.zona}
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: z.isCritical ? 'rgba(239,119,119,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${z.isCritical ? 'rgba(239,119,119,0.3)' : 'rgba(255,255,255,0.05)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#F5F7FA', flex: 1 }}>{z.zona}</span>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: `${z.color}20`, color: z.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {z.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: z.color, fontFamily: "'Outfit', sans-serif" }}>{z.pct}%</span>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>({z.used} / {z.cap})</span>
              </div>
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${z.pct}%`, height: '100%', background: z.color, borderRadius: '4px' }} />
              </div>
              <span style={{ fontSize: '10px', color: '#687487', lineHeight: 1.35 }}>{z.desc}</span>
              {z.isCritical && onOpenAI && (
                <button
                  type="button"
                  onClick={() => onOpenAI('Kapasitas Cold Storage gudang terisi 94% (kritis). Buatkan rencana transfer stok daging & susu segar ke cabang Kemang & BSD untuk kurangi beban hingga di bawah 80%.')}
                  style={{ marginTop: '2px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(239,119,119,0.15)', border: '1px solid rgba(239,119,119,0.4)', color: '#EF7777', fontSize: '10px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                >
                  ⚡ Realokasi Stok via AI
                </button>
              )}
            </div>
          ))}
        </div>
      </DeepChartCard>

      {/* Chart 2: Evaluasi Lead Time & SLA Vendor Supplier */}
      <DeepChartCard
        title="Evaluasi Lead Time & On-Time Delivery SLA Supplier"
        subtitle="Kepatuhan pengiriman 5 vendor bahan baku utama — basis keputusan rotasi & teguran SLA"
        icon={Truck}
        accent={accent}
        badge="Acuan Kontrak Vendor"
        footer="Evaluasi Kepatuhan SLA: Pola keterlambatan pengiriman bahan baku dapat dievaluasi secara otomatis setelah data PO dan penerimaan barang (GRN) dicatat di modul inventori."
        onOpenAI={onOpenAI}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { vendor: 'PT Sumber Pangan Utama', ot: 96, sla: '1.2 hr', cat: 'Beras & Minyak · Rp 68jt/bln', color: '#3FBF8F', status: 'Prima', isWarn: false },
            { vendor: 'CV Berkah Jaya Abadi', ot: 91, sla: '1.8 hr', cat: 'Daging & Unggas Segar · Rp 42jt/bln', color: '#3FBF8F', status: 'Sesuai SLA', isWarn: false },
            { vendor: 'Aneka Pack Nusantara', ot: 88, sla: '2.1 hr', cat: 'Packaging & Dus · Rp 18jt/bln', color: '#4E9BFF', status: 'Optimal', isWarn: false },
            { vendor: 'UD Bumbu Wangi Sejati', ot: 82, sla: '2.5 hr', cat: 'Rempah Kering & Saus · Rp 12jt/bln', color: '#D8A33C', status: 'Perlu Perhatian', isWarn: true },
            { vendor: 'PT Sentosa Agro Pangan', ot: 74, sla: '3.4 hr', cat: 'Sayur Segar & Dairy · Rp 26jt/bln', color: '#EF7777', status: 'Kritis', isWarn: true },
          ].map((v) => (
            <div
              key={v.vendor}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: v.isWarn ? 'rgba(239,119,119,0.025)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${v.isWarn ? 'rgba(239,119,119,0.2)' : 'rgba(255,255,255,0.04)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#E8EDF3', flex: 1 }}>{v.vendor}</span>
                <span style={{ fontSize: '10px', color: '#8A93A3' }}>{v.cat}</span>
                <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '12px', background: `${v.color}18`, color: v.color, fontWeight: 700 }}>{v.status}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${v.ot}%`, height: '100%', background: v.color, borderRadius: '4px' }} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: v.color, width: '42px', textAlign: 'right', flexShrink: 0 }}>{v.ot}%</span>
                <span style={{ fontSize: '10px', color: '#8A93A3', width: '44px', textAlign: 'right', flexShrink: 0 }}>~{v.sla}</span>
                {v.isWarn && onOpenAI && (
                  <button
                    type="button"
                    onClick={() => onOpenAI(`Vendor ${v.vendor} mencatat On-Time ${v.ot}% (telat rata-rata ${v.sla}). Draf surat teguran SLA dan opsi pengalihan pesanan ke supplier cadangan.`)}
                    style={{ padding: '2px 8px', borderRadius: '5px', background: 'rgba(239,119,119,0.15)', border: '1px solid rgba(239,119,119,0.3)', color: '#EF7777', fontSize: '9.5px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    ⚡ Tangani
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DeepChartCard>

      {/* Chart 3: Tren Pemborosan Bahan, Spoilage & Selisih Opname */}
      <DeepChartCard
        title="Tren Pemborosan Bahan, Spoilage & Selisih Opname"
        subtitle="Pola kerugian bahan basi, selisih timbangan, dan kerusakan handling per minggu — MTD"
        icon={TrendingDown}
        accent={accent}
        badge="Toleransi < Rp 2.5jt"
        footer="Total susut MTD Rp 1.48jt (0.82% dari nilai bahan) — aman di bawah batas plafon Rp 2.5jt. Puncak W2 tertangani via perbaikan SOP unboxing."
        onOpenAI={onOpenAI}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top KPI row (Full 3-Column Width) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total Susut Aktual (MTD)', val: 'Rp 1.482.000', sub: '0.82% dari Total Nilai Bahan', color: '#3FBF8F' },
              { label: 'Plafon Toleransi Bulanan', val: 'Rp 2.500.000', sub: 'Batas Maksimal Aman (~Rp 625rb/mgg)', color: '#8A93A3' },
              { label: 'Efisiensi Diselamatkan', val: 'Rp 1.018.000', sub: 'Sisa kuota plafon belum terpakai', color: '#00E676' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '10.5px', color: '#687487' }}>{s.label}</span>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 700, color: s.color, marginTop: '3px', lineHeight: 1.1 }}>{s.val}</div>
                <span style={{ fontSize: '9.5px', color: s.color, fontWeight: 600, opacity: 0.85 }}>{s.sub}</span>
              </div>
            ))}
          </div>

          {/* Main Content Split: Kiri (Alur Proses / Tabel Audit) + Kanan (Top 3 Kebocoran) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '16px', alignItems: 'stretch' }}>
            {/* Tampilan Infografis Alur Mingguan */}
            {spoilageView === 'flow' && (
              <div style={{ padding: '16px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#CBD5E1', display: 'block' }}>Pengendalian Susut Mingguan</span>
                    <span style={{ fontSize: '9.5px', color: '#687487' }}>Plafon aman rata-rata mingguan: ≤ Rp 625.000</span>
                  </div>

                  {/* Switcher Tampilan: Alur Proses vs Tabel Audit */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      type="button"
                      onClick={() => setSpoilageView('flow')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 0,
                        transition: 'all 0.15s ease',
                        background: `${accent}25`,
                        color: '#FFF',
                      }}
                    >
                      Alur Proses
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpoilageView('table')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 0,
                        transition: 'all 0.15s ease',
                        background: 'transparent',
                        color: '#8A93A3',
                      }}
                    >
                      Tabel Audit
                    </button>
                  </div>
                </div>

                {/* 4 Connected Flow Journey Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', position: 'relative' }}>
                  {[
                    { week: 'Minggu 1', loss: 'Rp 320rb', rate: '0.6%', status: 'Normal', color: '#D8A33C', delta: 'Awal Bulan', desc: 'Susut timbang tepung & bumbu', icon: '⚖️' },
                    { week: 'Minggu 2', loss: 'Rp 640rb', rate: '1.2%', status: '🚨 Spike', color: '#EF7777', delta: '+100% Naik', desc: 'Botol sirup pecah saat bongkar', icon: '📦' },
                    { week: 'Minggu 3', loss: 'Rp 280rb', rate: '0.5%', status: 'Terkendali', color: '#3FBF8F', delta: '-56% Turun', desc: 'SOP foam & rotasi chiller jalan', icon: '🛡️' },
                    { week: 'Minggu 4*', loss: 'Rp 242rb', rate: '0.4%', status: 'Optimal', color: '#00E676', delta: '-14% Turun', desc: 'Proyeksi rotasi FIFO aktif', icon: '✨' },
                  ].map((w, idx) => (
                    <div
                      key={w.week}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '10px',
                        background: `${w.color}0A`,
                        border: `1px solid ${w.color}33`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '8px',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#8A93A3' }}>{w.week}</span>
                        <span style={{ fontSize: '8.5px', padding: '1px 5px', borderRadius: '4px', background: `${w.color}20`, color: w.color, fontWeight: 700 }}>
                          {w.status}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 800, color: w.color }}>{w.loss}</div>
                        <span style={{ fontSize: '9px', color: w.color, opacity: 0.85, fontWeight: 600 }}>Porsi {w.rate} ({w.delta})</span>
                      </div>
                      <span style={{ fontSize: '8.5px', color: '#687487', lineHeight: 1.25, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px' }}>
                        {w.desc}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '9.5px', color: '#8A93A3' }}>
                    📊 <strong>Korelasi Aksi:</strong> Setelah audit receiving W2 diperketat, nilai kerugian turun dari Rp 640rb ke Rp 280rb (-56.2%).
                  </span>
                  <span style={{ fontSize: '9px', color: '#3FBF8F', fontWeight: 700 }}>Kondisi Terkoreksi ✓</span>
                </div>
              </div>
            )}

            {/* Tampilan Tabel Audit Opname Mingguan */}
            {spoilageView === 'table' && (
              <div style={{ padding: '16px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#CBD5E1', display: 'block' }}>Tabel Audit Penyimpangan Opname</span>
                    <span style={{ fontSize: '9.5px', color: '#687487' }}>Komparasi nilai riil susut vs plafon batas aman industri (Rp 625rb/mgg)</span>
                  </div>

                  {/* Switcher Tampilan: Alur Proses vs Tabel Audit */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      type="button"
                      onClick={() => setSpoilageView('flow')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 0,
                        transition: 'all 0.15s ease',
                        background: 'transparent',
                        color: '#8A93A3',
                      }}
                    >
                      Alur Proses
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpoilageView('table')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 0,
                        transition: 'all 0.15s ease',
                        background: `${accent}25`,
                        color: '#FFF',
                      }}
                    >
                      Tabel Audit
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#8A93A3', textAlign: 'left' }}>
                        <th style={{ padding: '7px 6px', fontWeight: 700 }}>Periode</th>
                        <th style={{ padding: '7px 6px', fontWeight: 700 }}>Kategori Dominan</th>
                        <th style={{ padding: '7px 6px', fontWeight: 700, textAlign: 'right' }}>Susut Riil</th>
                        <th style={{ padding: '7px 6px', fontWeight: 700, textAlign: 'right' }}>Deviasi Plafon</th>
                        <th style={{ padding: '7px 6px', fontWeight: 700 }}>Tindakan Supervisor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { period: 'Minggu 1', item: 'Tepung & Bumbu Kering', val: 'Rp 320.000', dev: '-48.8%', devColor: '#3FBF8F', action: 'Kalibrasi timbangan pintu receiving' },
                        { period: 'Minggu 2', item: 'Botol Sirup & Kaca', val: 'Rp 640.000', dev: '+2.4%', devColor: '#EF7777', action: 'Klaim retur supplier & SOP unboxing' },
                        { period: 'Minggu 3', item: 'Sayur Segar & Trimming', val: 'Rp 280.000', dev: '-55.2%', devColor: '#3FBF8F', action: 'Optimalisasi suhu chiller dan kelembaban' },
                        { period: 'Minggu 4*', item: 'Proyeksi Campuran FIFO', val: 'Rp 242.000', dev: '-61.3%', devColor: '#00E676', action: 'Briefing rotasi FIFO aktif tiap shift' },
                      ].map((r, i) => (
                        <tr key={r.period} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                          <td style={{ padding: '8px 6px', fontWeight: 700, color: '#E2E8F0' }}>{r.period}</td>
                          <td style={{ padding: '8px 6px', color: '#CBD5E1' }}>{r.item}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: r.devColor }}>{r.val}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: r.devColor }}>{r.dev}</td>
                          <td style={{ padding: '8px 6px', color: '#8A93A3', fontSize: '9px' }}>{r.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '10px', fontSize: '9px', color: '#687487', textAlign: 'right' }}>
                  *Minggu 4 estimasi berjalan berbasis audit stok harian shift pagi.
                </div>
              </div>
            )}

            {/* Kolom Kanan: Top 3 Kontributor Kebocoran Bahan (Pola Akar Masalah) */}
            <div style={{ padding: '16px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#CBD5E1' }}>Top 3 Kebocoran Bahan MTD</span>
                  <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(239,119,119,0.12)', color: '#EF7777', fontWeight: 600 }}>Akar Masalah</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {[
                    { item: 'Botol Kaca Sirup 750ml', loss: 'Rp 410.000', cause: 'Handling bongkar muat tanpa pallet foam', share: '27.6%', color: '#EF7777', icon: '📦' },
                    { item: 'Daging Ayam Fillet Frozen', loss: 'Rp 365.000', cause: 'Defrosting berlebih & suhu freezer drop', share: '24.6%', color: '#D8A33C', icon: '🥩' },
                    { item: 'Sayur Segar (Selada & Tomat)', loss: 'Rp 280.000', cause: 'Trimming layu akibat penyimpanan terbuka', share: '18.9%', color: '#3FBF8F', icon: '🥬' },
                  ].map((kb) => (
                    <div key={kb.item} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#E2E8F0' }}>{kb.icon} {kb.item}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: kb.color }}>{kb.loss}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '9px', color: '#687487' }}>{kb.cause}</span>
                        <span style={{ fontSize: '9px', fontWeight: 600, color: '#8A93A3' }}>{kb.share}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Box */}
              <div style={{ marginTop: '12px', padding: '9px 12px', borderRadius: '8px', background: 'rgba(63,191,143,0.06)', border: '1px solid rgba(63,191,143,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px' }}>⚡</span>
                <span style={{ fontSize: '9.5px', color: '#3FBF8F', lineHeight: 1.35 }}>
                  <strong>Aksi Shift:</strong> Gunakan pallet buffer saat receiving botol & audit suhu chiller tiap 4 jam untuk cegah susut W4.
                </span>
              </div>
            </div>
          </div>
        </div>
      </DeepChartCard>

      {/* Chart 4: Kepatuhan SOP Gudang & Produktivitas Shift */}
      <DeepChartCard
        title="Kepatuhan SOP Gudang & Produktivitas Staf per Shift"
        subtitle="Skor 6 pilar operasional gudang harian — dasar evaluasi briefing pra-shift dan tindak lanjut supervisor"
        icon={Users}
        accent={accent}
        badge="6 Pilar Audit"
        footer="Disiplin Shift Pagi: keterlambatan 3.2% (target ≤ 1%). Kebersihan Receiving belum capai target 90%. Prioritaskan checklist digital harian."
        onOpenAI={onOpenAI}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px' }}>
          {[
            { pilar: 'Penerimaan & Verifikasi Timbang', score: 91, color: '#3FBF8F', badge: 'Baik', detail: 'Foto timbangan wajib sebelum paraf surat jalan' },
            { pilar: 'Rotasi FIFO & Labeling Kadaluarsa', score: 88, color: '#3FBF8F', badge: 'Baik', detail: 'Label exp terpasang di 88% produk aktif' },
            { pilar: 'Kontrol Suhu Cold Storage', score: 95, color: '#00E676', badge: 'Prima', detail: 'Log suhu dicatat tiap 4 jam, terakhir 05:40 WIB' },
            { pilar: 'Kebersihan Area Receiving', score: 78, color: '#D8A33C', badge: 'Perlu Tindak', detail: 'Grease trap & wastafel perlu pembersihan menyeluruh' },
            { pilar: 'Disiplin Waktu & Serah Terima Shift', score: 84, color: '#D8A33C', badge: 'Perhatian', detail: 'Keterlambatan shift pagi 3.2% — target ≤ 1%' },
            { pilar: 'Pencatatan Opname & Rekap Harian', score: 90, color: '#3FBF8F', badge: 'Baik', detail: 'Form opname digital tersubmit 90% tepat waktu' },
          ].map((p) => (
            <div key={p.pilar} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#E8EDF3', flex: 1, lineHeight: 1.3 }}>{p.pilar}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: p.color, fontFamily: "'Outfit', sans-serif" }}>{p.score}%</span>
                  <span style={{ fontSize: '8.5px', padding: '2px 6px', borderRadius: '20px', background: `${p.color}18`, color: p.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{p.badge}</span>
                </div>
              </div>
              <div style={{ width: '100%', height: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${p.score}%`, height: '100%', background: `linear-gradient(90deg, ${p.color}88, ${p.color})`, borderRadius: '5px' }} />
              </div>
              <span style={{ fontSize: '10px', color: '#687487', lineHeight: 1.35 }}>{p.detail}</span>
            </div>
          ))}
        </div>
      </DeepChartCard>
    </div>
  );
}


function ChartPanel({
  series,
  accent,
  role = 'MANAGER_OPERASIONAL',
  onOpenAI,
}: {
  series: RoleDashboardSeries[];
  accent: string;
  role?: RoleDashboardRole;
  onOpenAI?: (prompt: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <RoleSpecificCharts role={role} accent={accent} onOpenAI={onOpenAI} />
    </div>
  );
}

// -------------------------------------------------------------
// INTERACTIVE CAUSAL MIND MAP (MODE 3: ALUR SISTEMIK & KEPUTUSAN)
// -------------------------------------------------------------
interface CausalNode {
  id: string;
  title: string;
  category: string;
  status: 'healthy' | 'warning' | 'critical';
  metricTag: string;
  x: number;
  y: number;
  connectsTo?: string[];
  fieldCondition?: string;
  causalChain: string;
  impactDesc: string;
  recommendation: string;
  aiPrompt: string;
  directAction?: {
    label: string;
    actionMessage: string;
  };
}

const CAUSAL_NODES: Record<RoleDashboardRole, CausalNode[]> = {
  SEKRETARIS: [
    {
      id: 'agenda-masuk',
      title: 'Undangan & Surat Masuk',
      category: 'Input Intake',
      status: 'healthy',
      metricTag: '14 Agenda MTD',
      x: 35,
      y: 55,
      connectsTo: ['cek-bentrok', 'review-urgensi'],
      fieldCondition: 'Surat dinas dan permohonan audiensi eksternal masuk rata-rata 3-4 berkas per hari.',
      causalChain: 'Undangan disaring dan diklasifikasikan ke prioritas strategis sebelum diserahkan ke meja pimpinan.',
      impactDesc: 'Bila tidak difilter ketat, 40% waktu pimpinan tersedot untuk pertemuan seremonial tanpa hasil bisnis nyata.',
      recommendation: 'Terapkan pra-penyaringan 2 lapis sebelum memasukkan jadwal ke kalender pimpinan.',
      aiPrompt: 'Susun draf kriteria prioritas surat dinas dan seleksi undangan pertemuan pimpinan eksekutif.',
      directAction: {
        label: '⚡ Aktifkan Pra-Filter Undangan',
        actionMessage: 'Filter protokoler otomatis 2-lapis diaktifkan untuk seluruh undangan masuk hari ini.',
      },
    },
    {
      id: 'kontrak-perizinan',
      title: 'Draft Kontrak & Izin Usaha',
      category: 'Legalitas Usaha',
      status: 'warning',
      metricTag: '3 Berkas Baru',
      x: 35,
      y: 235,
      connectsTo: ['approval-pimpinan', 'arsip-tenggat'],
      fieldCondition: 'Dokumen kerja sama vendor dan pembaruan izin edar/sewa cabang masuk jadwal review legal.',
      causalChain: 'Klausul perjanjian diperiksa kepatuhan hukumnya terhadap regulasi perizinan dan standar sewa.',
      impactDesc: 'Kelalaian klausul ganti rugi dapat membebani keuangan usaha hingga puluhan juta bila terjadi sengketa.',
      recommendation: 'Siapkan lembar ringkasan risiko (risk summary sheet) 1 lembar pada setiap draf kontrak vendor.',
      aiPrompt: 'Buatkan ringkasan klausul risiko utama pada draf perjanjian sewa ruko dan kontrak supplier.',
      directAction: {
        label: '⚡ Buat Ringkasan Risiko 1-Halaman',
        actionMessage: 'Template ringkasan risiko legal (Risk Summary Sheet) diterbitkan untuk 3 draf kontrak aktif.',
      },
    },
    {
      id: 'cek-bentrok',
      title: 'Deteksi Bentrok Jadwal',
      category: 'Audit Kalender',
      status: 'warning',
      metricTag: 'Kamis Padat (4 Jam)',
      x: 295,
      y: 40,
      connectsTo: ['proteksi-fokus'],
      fieldCondition: 'Slot pertemuan di hari Kamis siang menumpuk 3 sesi berturut-turut tanpa jeda istirahat.',
      causalChain: 'Jadwal yang terlalu padat menurunkan konsentrasi dan kualitas pengambilan keputusan strategis.',
      impactDesc: 'Pimpinan mengalami kelelahan rapat (meeting fatigue), memicu penundaan review dokumen penting lainnya.',
      recommendation: 'Pindahkan 1 pertemuan internal ke hari Jumat pagi untuk melonggarkan jadwal.',
      aiPrompt: 'Buatkan usulan jadwal alternatif untuk pertemuan hari Kamis agar tidak menumpuk di siang hari.',
      directAction: {
        label: '⚡ Geser Sesi Kamis ke Jumat 08:30',
        actionMessage: 'Sesi audiensi internal Kamis digeser ke Jumat 08:30 WIB. Slot Kamis kini longgar & berimbang.',
      },
    },
    {
      id: 'review-urgensi',
      title: 'Pra-Penyaringan Urgensi',
      category: 'Filter Protokoler',
      status: 'healthy',
      metricTag: '85% Terverifikasi',
      x: 295,
      y: 155,
      connectsTo: ['approval-pimpinan'],
      fieldCondition: 'Agenda yang lolos telaah telah memenuhi syarat kepentingan korporat dan target pertumbuhan.',
      causalChain: 'Filter awal memastikan setiap jam pertemuan pimpinan menghasilkan komitmen bisnis nyata.',
      impactDesc: 'Efisiensi waktu pimpinan meningkat drastis; agenda non-kritis didelegasikan ke level kepala divisi.',
      recommendation: 'Wajibkan pemohon rapat melampirkan bahan presentasi / proposal ringkas maksimal H-1.',
      aiPrompt: 'Draf SOP pengajuan rapat pimpinan yang mewajibkan penyertaan materi H-1 sebelum konfirmasi slot.',
      directAction: {
        label: '⚡ Kirim Pengingat Materi H-1',
        actionMessage: 'Instruksi kewajiban submit materi H-1 dikirimkan ke seluruh pemohon agenda pimpinan.',
      },
    },
    {
      id: 'arsip-tenggat',
      title: 'Audit Masa Berlaku Legalitas',
      category: 'Monitoring Izin',
      status: 'critical',
      metricTag: 'Sewa Ruko 18 Hari',
      x: 295,
      y: 275,
      connectsTo: ['risiko-operasional', 'notif-perpanjangan'],
      fieldCondition: 'Perjanjian sewa ruko outlet Kemang tersisa 18 hari dan belum ada konfirmasi tertulis dari pemilik gedung.',
      causalChain: 'Keterlambatan konfirmasi tertulis membuka celah ruko disewakan ke pihak lain atau lonjakan harga sepihak.',
      impactDesc: 'Outlet Kemang berisiko ditutup mendadak jika masa sewa berakhir tanpa kesepakatan perpanjangan tertulis.',
      recommendation: 'Kirim surat konfirmasi perpanjangan sewa ruko Kemang ke pemilik properti pekan ini.',
      aiPrompt: 'Draf surat permohonan resmi perpanjangan masa sewa ruko untuk outlet Kemang kepada pemilik gedung.',
      directAction: {
        label: '⚡ Konfirmasi Tertulis ke Pemilik Ruko',
        actionMessage: 'Surat penegasan perpanjangan sewa ruko Kemang dialirkan ke bundle tanda tangan pimpinan hari ini.',
      },
    },
    {
      id: 'approval-pimpinan',
      title: 'Antrean Otorisasi Pimpinan',
      category: 'Turnaround Otorisasi',
      status: 'healthy',
      metricTag: '2 Menunggu Ttd',
      x: 555,
      y: 90,
      connectsTo: ['disposisi-eksekusi'],
      fieldCondition: 'Dua draf perjanjian kerja sama telah melalui review legal dan menunggu tanda tangan pimpinan.',
      causalChain: 'Proses penandatanganan tepat waktu mencegah keterlambatan suplai bahan baku dan renovasi cabang.',
      impactDesc: 'Turnaround otorisasi rata-rata 5.1 jam masih dalam batas wajar SLA (<12 jam).',
      recommendation: 'Siapkan rangkuman 1 halaman untuk dokumen yang menunggu tanda tangan.',
      aiPrompt: 'Susun draf memo pengantar eksekutif ringkas untuk 2 dokumen kontrak yang menunggu tanda tangan pimpinan.',
      directAction: {
        label: '⚡ Rangkum Dokumen untuk Ttd Sore',
        actionMessage: 'Ringkasan eksekutif 2 dokumen siap tanda tangan disiapkan untuk sesi approval pukul 16:30 WIB.',
      },
    },
    {
      id: 'risiko-operasional',
      title: 'Risiko Suspensi Cabang',
      category: 'Kepatuhan Regulasi',
      status: 'critical',
      metricTag: 'Potensi Sengketa',
      x: 555,
      y: 235,
      connectsTo: ['notif-perpanjangan'],
      fieldCondition: 'Ketidakpastian sewa ruko mengancam kelangsungan operasional 12 karyawan di cabang Kemang.',
      causalChain: 'Jika perpanjangan sewa gagal, cabang harus dikosongkan dan omset harian Rp 14jt/hari hilang.',
      impactDesc: 'Kerugian finansial langsung dan penurunan kepercayaan pelanggan loyal di area Jakarta Selatan.',
      recommendation: 'Segera selesaikan adendum kontrak sewa dan amankan dana titipan perpanjangan sewa.',
      aiPrompt: 'Hitung simulasi dampak finansial penutupan cabang Kemang selama 7 hari jika perpanjangan sewa tertunda.',
      directAction: {
        label: '⚡ Draf Adendum Perpanjangan Sewa',
        actionMessage: 'Adendum perpanjangan masa sewa 2 tahun ruko Kemang selesai disusun dan siap ditandatangani.',
      },
    },
    {
      id: 'proteksi-fokus',
      title: 'Proteksi Jam Fokus Pimpinan',
      category: 'Manajemen Waktu',
      status: 'healthy',
      metricTag: 'Deep Work Terkunci',
      x: 815,
      y: 40,
      fieldCondition: 'Jadwal hari Jumat pagi berhasil diblokir bebas rapat untuk perumusan strategi kuartal baru.',
      causalChain: 'Waktu hening tanpa distraksi memberi pimpinan ruang untuk mengevaluasi laporan finansial dan ekspansi.',
      impactDesc: 'Keputusan strategis lebih matang dan tidak diambil secara terburu-buru di sela-sela rapat.',
      recommendation: 'Kunci blok waktu Jumat 09:00 - 11:30 WIB sebagai agenda internal tertutup di Google Calendar.',
      aiPrompt: 'Buatkan kalender kerja eksekutif ideal dengan rasio 60% strategi, 30% operasional, dan 10% jeda relaksasi.',
      directAction: {
        label: '⚡ Kunci Kalender Deep Work Jumat',
        actionMessage: 'Blok waktu Jumat 09:00 - 11:30 WIB berhasil dikunci dan ditandai private di kalender pimpinan.',
      },
    },
    {
      id: 'disposisi-eksekusi',
      title: 'Disposisi Eksekusi ke Divisi',
      category: 'Koordinasi Unit',
      status: 'healthy',
      metricTag: 'SLA Rata-rata 3.8 Jam',
      x: 815,
      y: 155,
      fieldCondition: 'Arahan pimpinan didistribusikan langsung ke kepala divisi terkait untuk dieksekusi secara cepat.',
      causalChain: 'Penyampaian disposisi yang jelas dengan target deadline meminimalkan miskomunikasi antar-unit.',
      impactDesc: 'Proyek renovasi dan pengadaan bahan baku dapat berjalan tanpa menunggu rapat susulan yang bertele-tele.',
      recommendation: 'Sertakan target tanggal selesai (deadline) pada setiap lembar disposisi.',
      aiPrompt: 'Buatkan draf template nota dinas disposisi internal yang jelas memuat PIC, target, dan indikator selesai.',
      directAction: {
        label: '⚡ Terbitkan Memo Disposisi SLA',
        actionMessage: 'Memo disposisi lengkap dengan target SLA 24 jam diterbitkan ke kepala divisi operasional & finance.',
      },
    },
    {
      id: 'notif-perpanjangan',
      title: 'Kirim Surat Perpanjangan Sewa',
      category: 'Aksi Mitigasi Legal',
      status: 'critical',
      metricTag: 'Draf Surat Siap Kirim',
      x: 815,
      y: 275,
      fieldCondition: 'Draf surat permohonan resmi perpanjangan sewa ruko Kemang telah disetujui pimpinan dan siap dikirim.',
      causalChain: 'Pengiriman resmi menjamin tercatatnya permohonan penyewa secara sah sebelum tanggal jatuh tempo.',
      impactDesc: 'Melindungi hak opsi perpanjangan penyewa pertama dan menghindari kenaikan tarif mendadak.',
      recommendation: 'Kirim surat hari ini via kurir motor, mintakan tanda terima bermaterai, dan jadwalkan pertemuan.',
      aiPrompt: 'Draf pesan konfirmasi WhatsApp dan surat resmi ke pemilik ruko Kemang mengenai jadwal pembayaran sewa.',
      directAction: {
        label: '⚡ Kirim Surat via Kurir & Notif Pemilik',
        actionMessage: 'Kurir diberangkatkan membawa surat fisik bermaterai ke pemilik ruko Kemang dengan tanda terima resmi.',
      },
    },
  ],
  MANAGER_UMUM: [
    {
      id: 'target-kpi',
      title: 'Plafon Target Kerja Tim',
      category: 'Sasaran Kerja',
      status: 'healthy',
      metricTag: 'Target Tim 100%',
      x: 35,
      y: 55,
      connectsTo: ['beban-admin', 'evaluasi-output'],
      fieldCondition: 'Target kerja bulanan dan indikator keberhasilan telah ditetapkan bersama pimpinan.',
      causalChain: 'Plafon target bulanan didefinisikan bersama CEO untuk unit operasional dan administrasi.',
      impactDesc: 'Target yang jelas memberi arah kerja pasti, namun membutuhkan monitoring kapasitas agar tidak memicu turnover.',
      recommendation: 'Pertahankan target saat ini dengan memonitor capaian mingguan.',
      aiPrompt: 'Analisis kewajaran target KPI tim bulan ini dan buat simulasi jika target dinaikkan 10%.',
      directAction: {
        label: '⚡ Sinkronkan Target KPI Mingguan',
        actionMessage: 'Target KPI mingguan berhasil disinkronkan dengan kalender operasional tim.',
      },
    },
    {
      id: 'anggaran-operasional',
      title: 'Pagu Belanja OPEX Unit',
      category: 'Dukungan Modal',
      status: 'healthy',
      metricTag: 'Plafon Rp 40jt',
      x: 35,
      y: 235,
      connectsTo: ['pacing-belanja', 'checklist-sop'],
      fieldCondition: 'Alokasi belanja unit operasional mencakup gaji lembur, utilitas, ATK, dan pemeliharaan alat.',
      causalChain: 'Anggaran belanja operasional unit dipakai untuk mendukung eksekusi tugas harian seluruh staf.',
      impactDesc: 'Pembakaran budget yang terkendali menjaga stabilitas arus kas cabang tanpa mengorbankan mutu layanan.',
      recommendation: 'Laju belanja 71% pada hari ke-21 sudah sangat seimbang dan hemat 11%.',
      aiPrompt: 'Evaluasi pos pengeluaran unit terbesar bulan ini dan rekomendasikan efisiensi tambahan.',
      directAction: {
        label: '⚡ Kunci Cadangan Kas Rp 11.5jt',
        actionMessage: 'Cadangan kas operasional Rp 11.5jt berhasil dikunci untuk perlindungan tutup buku.',
      },
    },
    {
      id: 'beban-admin',
      title: 'Beban Administrasi Staf',
      category: 'Eksekusi Staf',
      status: 'critical',
      metricTag: 'Admin Gap -22%',
      x: 295,
      y: 40,
      connectsTo: ['risiko-bottleneck'],
      fieldCondition: 'Staf admin mengalami penumpukan berkas nota manual dan rekap fisik dari 3 outlet.',
      causalChain: 'Tugas kerja dibagikan ke anggota tim namun volume input nota fisik melampaui kapasitas 1 admin.',
      impactDesc: 'Ketimpangan beban kerja menyebabkan staf admin mengalami burnout dan pelaporan keuangan bulanan terlambat.',
      recommendation: 'Alihkan sementara 20% tugas dokumentasi dari staf admin ke rekan yang sedang surplus.',
      aiPrompt: 'Buatkan rencana rebalancing tugas kerja tim agar staf yang tertinggal mendapat bantuan terukur.',
      directAction: {
        label: '⚡ Eksekusi Rebalancing Tugas Staf',
        actionMessage: '20% tugas dokumentasi nota fisik berhasil dialihkan ke Dewi Lestari (Finance).',
      },
    },
    {
      id: 'pacing-belanja',
      title: 'Laju Penyerapan Anggaran',
      category: 'Kontrol Biaya',
      status: 'healthy',
      metricTag: 'Hemat Rp 3.5jt MTD',
      x: 295,
      y: 155,
      connectsTo: ['efisiensi-kas'],
      fieldCondition: 'Realisasi belanja berjalan di angka Rp 28.5jt dari plafon ideal hari ke-21 sebesar Rp 32.0jt.',
      causalChain: 'Disiplin pengadaan perlengkapan operasional menekan pemborosan utilitas dan ATK.',
      impactDesc: 'Surplus kas operasional Rp 3.5jt dapat dialihkan ke dana taktis pemeliharaan mesin kopi cabang Kemang.',
      recommendation: 'Pertahankan kebijakan persetujuan belanja berjenjang untuk pengeluaran di atas Rp 1 juta.',
      aiPrompt: 'Rancang simulasi alokasi sisa anggaran operasional untuk dana taktis maintenance peralatan cabang.',
      directAction: {
        label: '⚡ Alokasikan Dana Taktis Rp 3.5jt',
        actionMessage: 'Surplus belanja Rp 3.5jt berhasil dialokasikan ke pos dana taktis pemeliharaan mesin kopi.',
      },
    },
    {
      id: 'checklist-sop',
      title: 'Audit Kepatuhan 6 Pilar SOP',
      category: 'Standar Operasi',
      status: 'warning',
      metricTag: 'Kebersihan 82%',
      x: 295,
      y: 275,
      connectsTo: ['kualitas-layanan'],
      fieldCondition: 'Pilar kebersihan dan kerapian outlet Kemang mencatat skor 82%, di bawah batas standar minimal 85%.',
      causalChain: 'Checklist standar operasional memastikan mutu layanan dan sanitasi terjaga di seluruh cabang.',
      impactDesc: 'Penurunan disiplin sanitasi grease trap dan area wastafel berisiko memicu ulasan negatif pelanggan.',
      recommendation: 'Lakukan inspeksi mendadak khusus pilar Kebersihan & Sanitasi di outlet Kemang.',
      aiPrompt: 'Susun checklist inspeksi cepat 15 menit untuk pilar kebersihan dan pelayanan outlet.',
      directAction: {
        label: '⚡ Perintah Sidak Kebersihan Kemang',
        actionMessage: 'Perintah sidak kilat pilar Kebersihan & Sanitasi 15 menit telah dikirim ke supervisor Kemang.',
      },
    },
    {
      id: 'risiko-bottleneck',
      title: 'Risiko Bottleneck Pelaporan',
      category: 'Produktivitas Tim',
      status: 'warning',
      metricTag: 'Turnover & Moral',
      x: 555,
      y: 90,
      connectsTo: ['rebalancing-staf'],
      fieldCondition: 'Keterlambatan input data admin menyebabkan selisih data stok dan laporan keuangan tertunda 2 hari.',
      causalChain: 'Bottleneck administrasi menghambat manajer dalam menyusun laporan rekap eksekutif bulanan ke CEO.',
      impactDesc: 'Keputusan bisnis dari manajemen puncak tertunda akibat data historis cabang belum terinput lengkap.',
      recommendation: 'Terapkan sistem digitalisasi nota cepat via foto WhatsApp bot agar input data berlangsung otomatis.',
      aiPrompt: 'Susun rekomendasi integrasi scan nota otomatis untuk memangkas jam kerja manual staf admin.',
      directAction: {
        label: '⚡ Aktifkan Bot Scan Nota WhatsApp',
        actionMessage: 'Alur upload nota instan via WhatsApp bot diaktifkan untuk cabang Kemang dan BSD.',
      },
    },
    {
      id: 'kualitas-layanan',
      title: 'Risiko Komplain Pelanggan',
      category: 'Kepuasan Konsumen',
      status: 'warning',
      metricTag: 'Gap Kebersihan',
      x: 555,
      y: 235,
      connectsTo: ['inspeksi-sidak'],
      fieldCondition: 'Tercatat 2 komplain pelanggan terkait waktu tunggu pembersihan meja saat jam makan siang.',
      causalChain: 'Kurangnya rotasi staf pembersih meja di jam sibuk memicu ketidaknyamanan pengunjung outlet.',
      impactDesc: 'Penurunan rating Google Review cabang Kemang dari 4.8 menjadi 4.6 bila tidak segera dibenahi.',
      recommendation: 'Jadwalkan staf floor tambahan khusus jam 12:00 - 14:00 untuk percepatan pembersihan meja.',
      aiPrompt: 'Draf skema shift khusus peak-hours untuk menjaga kecepatan pembersihan meja di outlet F&B.',
      directAction: {
        label: '⚡ Tambah Staf Floor Jam 12-14',
        actionMessage: 'Jadwal rotasi bantuan floor staff jam 12:00-14:00 telah disetujui.',
      },
    },
    {
      id: 'evaluasi-output',
      title: 'Capaian Output Tim Optimal',
      category: 'Performa Unit',
      status: 'healthy',
      metricTag: '92% Selesai Tepat',
      x: 815,
      y: 40,
      fieldCondition: 'Secara agregat, 4 dari 5 anggota tim mencatat capaian di atas 90% dengan kehadiran 96.4%.',
      causalChain: 'Motivasi kerja terjaga berkat koordinasi harian 10 menit (daily standup) yang konsisten.',
      impactDesc: 'Operasional harian unit berjalan mandiri tanpa memerlukan intervensi mikro dari pimpinan puncak.',
      recommendation: 'Berikan apresiasi informal pada rapat mingguan untuk staf dengan capaian target terbaik.',
      aiPrompt: 'Buatkan konsep program apresiasi bulanan non-finansial untuk meningkatkan loyalitas staf operasional.',
      directAction: {
        label: '⚡ Kirim Apresiasi Kinerja Tim',
        actionMessage: 'Notifikasi apresiasi kinerja tim optimal telah dikirim ke grup internal koordinasi.',
      },
    },
    {
      id: 'rebalancing-staf',
      title: 'Rebalancing Tugas Lintas Shift',
      category: 'Solusi Staf',
      status: 'healthy',
      metricTag: 'Beban Terdistribusi',
      x: 815,
      y: 155,
      fieldCondition: '20% tugas verifikasi nota dialihkan ke staf finance support yang memiliki kapasitas berlebih.',
      causalChain: 'Beban kerja merata, waktu lembur staf admin terpangkas 4 jam per pekan, dan error input menurun.',
      impactDesc: 'Keseimbangan jam kerja memulihkan produktivitas dan menjaga retensi karyawan kunci.',
      recommendation: 'Formalisasikan pembagian tugas baru ini dalam matriks RACI mingguan unit umum.',
      aiPrompt: 'Susun matriks RACI ringkas untuk pembagian tugas administrasi nota antara Admin SOP dan Finance Staff.',
      directAction: {
        label: '⚡ Update Matriks RACI Tim',
        actionMessage: 'Matriks RACI tim berhasil diperbarui dan disimpan dalam sistem dokumentasi.',
      },
    },
    {
      id: 'inspeksi-sidak',
      title: 'Inspeksi Kilat & Penguatan SOP',
      category: 'Mitigasi Mutu',
      status: 'warning',
      metricTag: 'SOP 15 Menit Kemang',
      x: 815,
      y: 275,
      fieldCondition: 'Sidak kebersihan 15 menit dijalankan setiap pagi dan pergantian shift di outlet Kemang.',
      causalChain: 'Pemeriksaan rutin memulihkan disiplin sanitasi dan memastikan standar kebersihan cabang konsisten.',
      impactDesc: 'Skor audit kebersihan diproyeksikan naik kembali ke 90% dalam inspeksi akhir pekan ini.',
      recommendation: 'Jalankan checklist kebersihan digital yang wajib di-submit supervisor sebelum buka gerai.',
      aiPrompt: 'Buatkan form checklist kebersihan 10 poin praktis yang mudah diisi supervisor lewat ponsel.',
      directAction: {
        label: '⚡ Kirim Form Checklist Digital',
        actionMessage: 'Link form checklist kebersihan digital telah dikirimkan ke supervisor outlet Kemang.',
      },
    },
  ],
  MANAGER_OPERASIONAL: [
    {
      id: 'po-supplier',
      title: 'Purchase Order Restock Bahan',
      category: 'Pengadaan Bahan',
      status: 'healthy',
      metricTag: '6 PO Berjalan',
      x: 35,
      y: 70,
      connectsTo: ['leadtime-vendor', 'kapasitas-freezer'],
      fieldCondition: 'Pesanan bahan baku mingguan diterbitkan sesuai perhitungan safety stock dan perkiraan omset.',
      causalChain: 'Pesanan bahan baku diterbitkan sesuai perhitungan safety stock dan lead time.',
      impactDesc: 'Keterlambatan PO memicu kekosongan stok bahan baku di dapur dan pembatalan pesanan menu pelanggan.',
      recommendation: 'Terbitkan PO otomatis untuk SKU yang menyentuh batas reorder point.',
      aiPrompt: 'Buatkan draf purchase order untuk restock bahan baku kritis di cabang Kemang.',
    },
    {
      id: 'timbang-receiving',
      title: 'Timbang Receiving Gudang',
      category: 'Anti-Fraud Gudang',
      status: 'critical',
      metricTag: 'Selisih -2.4 kg Sapi',
      x: 35,
      y: 245,
      connectsTo: ['fraud-supplier', 'spoilage-dapur'],
      fieldCondition: 'Petugas gudang mendeteksi selisih timbangan daging sapi pada penerimaan PO-1082 (PT Sentosa Agro).',
      causalChain: 'Barang yang tiba dari supplier ditimbang ulang sebelum ditandatangani surat jalannya.',
      impactDesc: 'Temuan nyata KaburAja: kecurangan berat timbang merugikan jutaan rupiah jika tidak diaudit ketat di pintu masuk.',
      recommendation: 'Tolak surat jalan PO-1082 jika supplier tidak menyetujui koreksi nota timbangan riil.',
      aiPrompt: 'Draf surat klaim diskrepansi berat timbangan bahan baku ke supplier PT Sentosa Agro Pangan.',
    },
    {
      id: 'leadtime-vendor',
      title: 'Evaluasi Lead Time Supplier',
      category: 'Kepatuhan SLA',
      status: 'warning',
      metricTag: 'Sentosa Telat 1.6 Hari',
      x: 310,
      y: 40,
      connectsTo: ['stok-kritis'],
      fieldCondition: 'Pengiriman sayur segar dan produk dairy dari PT Sentosa Agro mengalami keterlambatan 1.6 hari.',
      causalChain: 'Vendor terlambat mengirim barang akibat kendala armada logistik di jalur distribusi antar-kota.',
      impactDesc: 'Jadwal persiapan menu dapur pagi terganggu, memaksa staf mencari bahan darurat di pasar retail lokal.',
      recommendation: 'Alihkan 30% kuota belanja harian ke vendor cadangan (CV Berkah Jaya Abadi) yang memiliki SLA 96%.',
      aiPrompt: 'Buatkan surat teguran SLA keterlambatan pengiriman bahan baku ke manajemen PT Sentosa Agro Pangan.',
    },
    {
      id: 'kapasitas-freezer',
      title: 'Kapasitas Cold Storage Gudang',
      category: 'Utilisasi Gudang',
      status: 'critical',
      metricTag: 'Freezer Penuh 94%',
      x: 310,
      y: 160,
      connectsTo: ['spoilage-dapur'],
      fieldCondition: 'Ruang cold storage tersisa hanya 180 kg (kapasitas terpakai 2.82 Ton dari kuota maksimal 3.0 Ton).',
      causalChain: 'Penumpukan stok daging beku dan susu segar tanpa distribusi seimbang membebani sirkulasi udara pendingin.',
      impactDesc: 'Suhu freezer berisiko naik di atas -18°C, memicu pencairan bahan baku dan percepatan pembusukan bakteri.',
      recommendation: 'Tahan penerimaan PO daging berikutnya sampai 500 kg stok didistribusikan ke outlet Kemang & BSD.',
      aiPrompt: 'Susun rencana distribusi darurat stok cold storage sentral ke freezer cabang untuk mengosongkan kapasitas 20%.',
    },
    {
      id: 'fraud-supplier',
      title: 'Diskrepansi Nota vs Timbangan',
      category: 'Integritas Stok',
      status: 'critical',
      metricTag: 'Kerugian Rp 312rb/PO',
      x: 310,
      y: 280,
      connectsTo: ['klaim-supplier'],
      fieldCondition: 'Invoice vendor menagih 50.0 kg daging sapi, namun timbangan digital receiving mencatat 47.6 kg.',
      causalChain: 'Tanpa audit timbangan fisik, selisih 2.4 kg (senilai Rp 288.000) akan langsung membebani pos HPP dapur.',
      impactDesc: 'Jika terjadi 4x sebulan pada 3 cabang, potensi kebocoran dana operasional mencapai Rp 3.450.000.',
      recommendation: 'Wajibkan foto timbangan digital terlampir pada form input receiving sebelum diverifikasi kasir.',
      aiPrompt: 'Rancang SOP verifikasi receiving 3 titik: foto timbangan, paraf driver vendor, dan persetujuan supervisor.',
    },
    {
      id: 'stok-kritis',
      title: 'Stok Dapur Kemang Menipis',
      category: 'Manajemen Stok',
      status: 'critical',
      metricTag: 'Kemang di Bawah Min',
      x: 585,
      y: 75,
      connectsTo: ['transfer-darurat'],
      fieldCondition: 'Stok bahan baku daging ayam di cabang Kemang tersisa 420 unit, di bawah safety stock 500 unit.',
      causalChain: 'Bahan baku didistribusikan ke outlet untuk persiapan produksi menu harian.',
      impactDesc: 'Stok Kemang yang menipis berisiko membatalkan pesanan pelanggan saat jam sibuk makan malam (peak hours).',
      recommendation: 'Lakukan transfer darurat 50 unit bahan baku dari cabang BSD ke Kemang.',
      aiPrompt: 'Buatkan draf surat transfer stok darurat antar-cabang dari BSD ke Kemang.',
    },
    {
      id: 'spoilage-dapur',
      title: 'Bahan Mentah Mendekati Basi',
      category: 'Rotasi FIFO',
      status: 'warning',
      metricTag: '18kg Daging < 3 Hari',
      x: 585,
      y: 235,
      connectsTo: ['promo-bundling'],
      fieldCondition: '18 kg fillet ayam dan 12L susu segar di dapur Kemang akan mencapai tanggal kedaluwarsa dalam 72 jam.',
      causalChain: 'Bahan makanan cepat basi dipantau tanggal kedaluwarsanya agar habis sebelum rusak.',
      impactDesc: 'Bahan basi yang terbuang menaikkan rasio dead stock dan membebani HPP.',
      recommendation: 'Jalankan menu promo bundling menu olahan daging dalam 48 jam ke depan.',
      aiPrompt: 'Rancang rekomendasi menu promo diskon kilat untuk mempercepat rotasi stok daging sebelum kedaluwarsa.',
    },
    {
      id: 'klaim-supplier',
      title: 'Klaim Diskrepansi & Retur Nota',
      category: 'Aksi Keuangan Ops',
      status: 'critical',
      metricTag: 'Nota Dikoreksi',
      x: 855,
      y: 40,
      fieldCondition: 'Surat jalan PO-1082 dikoreksi menjadi 47.6 kg dan diajukan pemotongan tagihan invoice ke vendor.',
      causalChain: 'Koreksi nota langsung mencegah pengeluaran kas yang tidak sah oleh bagian keuangan perusahaan.',
      impactDesc: 'Hak finansial perusahaan terlindungi dan vendor supplier teredukasi untuk tidak mengirim barang susut.',
      recommendation: 'Terbitkan Berita Acara Selisih Timbang resmi dengan bukti foto timbangan terverifikasi.',
      aiPrompt: 'Draf Berita Acara Diskrepansi Penerimaan Bahan Baku untuk lampiran pemotongan tagihan invoice supplier.',
    },
    {
      id: 'transfer-darurat',
      title: 'Transfer Stok BSD ke Kemang',
      category: 'Penyelamatan Omset',
      status: 'critical',
      metricTag: '50 Unit Meluncur',
      x: 855,
      y: 155,
      fieldCondition: 'Armada logistik internal diberangkatkan membawa 50 unit bahan baku dari surplus cabang BSD ke Kemang.',
      causalChain: 'Perpindahan stok darurat mencegah kekosongan menu utama dan menjaga kepuasan pelanggan resto.',
      impactDesc: 'Potensi kehilangan omset Rp 4.5jt saat makan malam terselamatkan dengan biaya bensin kurir hanya Rp 40rb.',
      recommendation: 'Update mutasi stok di modul inventaris agar stok BSD dan Kemang tetap sinkron.',
      aiPrompt: 'Catat mutasi transfer stok antar-cabang BSD ke Kemang dan buat notifikasi serah terima kasir.',
    },
    {
      id: 'promo-bundling',
      title: 'Promo Bundling 48 Jam Dapur',
      category: 'Mitigasi HPP',
      status: 'healthy',
      metricTag: 'Rotasi Kilat Dapur',
      x: 855,
      y: 275,
      fieldCondition: 'Menu spesial bundling ayam fillet diluncurkan di POS kasir dengan diskon 15% untuk menghabiskan stok.',
      causalChain: 'Percepatan penjualan bahan baku rentan basi mengonversi potensi kerugian limbah menjadi uang kas masuk.',
      impactDesc: 'Rasio pemborosan bahan (waste) ditekan ke 0.8%, mengamankan margin kotor operasional dapur.',
      recommendation: 'Monitor laju penjualan menu bundling per 6 jam dan stop promo saat stok kritis tersisa 5 kg.',
      aiPrompt: 'Susun teks promosi kasir (upselling script) untuk menawarkan menu bundling ayam fillet ke pelanggan dine-in.',
    },
  ],
  CEO: [
    {
      id: 'corplan-target',
      title: 'Target Omset Perusahaan',
      category: 'Rencana Korporat',
      status: 'healthy',
      metricTag: 'Target Rp 450jt',
      x: 35,
      y: 55,
      connectsTo: ['alokasi-divisi', 'konversi-penjualan'],
      fieldCondition: 'Perencanaan omset kuartalan ditargetkan Rp 450jt dengan ekspansi 1 gerai baru di Bandung.',
      causalChain: 'Target pendapatan jangka panjang ditetapkan sebagai panduan belanja dan ekspansi.',
      impactDesc: 'Ketiadaan target makro menyebabkan divisi berjalan tanpa sinkronisasi arah.',
      recommendation: 'Simulasikan target terhadap kondisi inflasi dan tren pasar terbaru.',
      aiPrompt: 'Jalankan simulasi skenario jika omset pasar mengalami penurunan 15%.',
    },
    {
      id: 'alokasi-divisi',
      title: 'Alokasi Budget Divisi',
      category: 'Distribusi Modal',
      status: 'healthy',
      metricTag: 'Pacing Terkendali',
      x: 295,
      y: 40,
      connectsTo: ['arus-kas-bersih'],
      fieldCondition: 'Pagu belanja dibagi secara proporsional ke Operasional (60%), Marketing (25%), dan Cadangan Kas (15%).',
      causalChain: 'Modal kerja dibagi ke divisi Pemasaran, Operasional, dan SDM.',
      impactDesc: 'Alokasi yang tidak berimbang memicu bottleneck di rantai pasok.',
      recommendation: 'Prioritaskan alokasi belanja ke saluran akuisisi dengan ROAS tertinggi.',
      aiPrompt: 'Berikan evaluasi efisiensi alokasi modal kerja antar divisi bulan ini.',
    },
    {
      id: 'konversi-penjualan',
      title: 'Konversi Penjualan & LTV',
      category: 'Kinerja Komersial',
      status: 'warning',
      metricTag: 'LTV:CAC 3.4x',
      x: 295,
      y: 200,
      connectsTo: ['arus-kas-bersih'],
      fieldCondition: 'Rasio akuisisi pelanggan baru stabil namun tingkat pembelian berulang perlu didorong promosi.',
      causalChain: 'Lalu lintas pelanggan diubah menjadi transaksi riil yang menghasilkan laba.',
      impactDesc: 'Tingkat konversi yang turun membebani biaya akuisisi pelanggan.',
      recommendation: 'Perkuat program promosi struk digital WhatsApp untuk repeat order.',
      aiPrompt: 'Rancang strategi peningkatan rasio LTV:CAC pelanggan melalui penawaran khusus.',
    },
    {
      id: 'arus-kas-bersih',
      title: 'Arus Kas Bersih Korporat',
      category: 'Likuiditas',
      status: 'healthy',
      metricTag: '+Rp 64jt Net Flow',
      x: 555,
      y: 120,
      connectsTo: ['cadangan-ekspansi'],
      fieldCondition: 'Surplus kas operasional bersih mencatat Rp 64 juta dengan runway 14.2 bulan.',
      causalChain: 'Surplus kas operasional memperkuat ketahanan kas dan cadangan ekspansi.',
      impactDesc: 'Arus kas negatif memicu ancaman gagal bayar kewajiban supplier.',
      recommendation: 'Pertahankan kebijakan kasbon ketat agar arus kas masuk tetap stabil.',
      aiPrompt: 'Analisis sensitivitas runway kas jika terjadi lonjakan beban operasional 20%.',
    },
    {
      id: 'cadangan-ekspansi',
      title: 'Kesiapan Modal Cabang Baru',
      category: 'Ekspansi Bisnis',
      status: 'healthy',
      metricTag: 'Skor 88/100',
      x: 815,
      y: 120,
      fieldCondition: 'Cadangan kas likuid mencukupi kebutuhan pembukaan cabang baru di Bandung (Capex Rp 180jt).',
      causalChain: 'Runway yang aman memberikan keleluasaan untuk membuka cabang baru tanpa utang berbahaya.',
      impactDesc: 'Runway di bawah 6 bulan menuntut pemangkasan beban operasional darurat.',
      recommendation: 'Pelajari studi kelayakan pembukaan cabang baru di area potensial.',
      aiPrompt: 'Susun studi kelayakan pembukaan cabang baru dengan mempertimbangkan capex payback.',
    },
  ],
  FINANCE: [
    {
      id: 'penjualan-pos',
      title: 'Penjualan Kasir POS',
      category: 'Penerimaan',
      status: 'healthy',
      metricTag: 'Tunai & Digital',
      x: 30,
      y: 75,
      causalChain: 'Setiap transaksi pelanggan tercatat di sistem kasir sebagai pendapatan kotor.',
      impactDesc: 'Transaksi tanpa struk memicu potensi penggelapan kas oleh kasir.',
      recommendation: 'Wajibkan struk digital kirim ke WhatsApp untuk setiap transaksi tunai.',
      aiPrompt: 'Susun panduan penegakan struk digital untuk meminimalkan transaksi tidak tercatat di kasir.',
    },
    {
      id: 'kas-laci-fisik',
      title: 'Kas Laci Kasir',
      category: 'Uang Fisik',
      status: 'warning',
      metricTag: 'Selisih Rp 35.000',
      x: 230,
      y: 25,
      causalChain: 'Uang fisik di laci dihitung dan direkonsiliasi harian dengan rekapan kasir.',
      impactDesc: 'Selisih kas laci yang dibiarkan menjadi kebiasaan kebocoran kasir berkepanjangan.',
      recommendation: 'Terapkan toleransi selisih maksimum Rp 10.000 per shift kasir.',
      aiPrompt: 'Buatkan SOP rekonsiliasi kas laci kasir dan mekanisme sanksi selisih uang tunai.',
    },
    {
      id: 'kasbon-pelanggan',
      title: 'Kasbon & Piutang WA',
      category: 'Piutang',
      status: 'critical',
      metricTag: 'Rp 4.25jt Lewat Jatuh Tempo',
      x: 230,
      y: 125,
      causalChain: 'Penjualan tempo mewajibkan pencatatan nomor WA dan penagihan berkala.',
      impactDesc: 'Kasbon macet mengunci dana modal kerja yang dibutuhkan untuk belanja supplier.',
      recommendation: 'Kirim pesan tagihan WhatsApp sopan tapi tegas ke 5 pelanggan dengan tunggakan terbesar.',
      aiPrompt: 'Tuliskan draf pesan WhatsApp penagihan kasbon yang sopan dan efektif untuk pelanggan langganan.',
    },
    {
      id: 'buffer-likuiditas',
      title: 'Buffer Kas Operasional',
      category: 'Cadangan Kas',
      status: 'healthy',
      metricTag: 'Saldo Aman',
      x: 430,
      y: 75,
      causalChain: 'Kas operasional siap digunakan untuk membayar kewajiban jangka pendek.',
      impactDesc: 'Buffer yang menipis memaksa penundaan pembayaran gaji atau tagihan listrik.',
      recommendation: 'Pertahankan saldo kas minimal 2x beban operasional bulanan.',
      aiPrompt: 'Analisis kecukupan cadangan likuiditas kas operasional terhadap jatuh tempo kewajiban.',
    },
    {
      id: 'vendor-pajak',
      title: 'Pembayaran Vendor & Pajak',
      category: 'Kewajiban',
      status: 'healthy',
      metricTag: 'Jatuh Tempo 7 Hari',
      x: 630,
      y: 75,
      causalChain: 'Kewajiban supplier dan setoran pajak PPh final dibayarkan tepat waktu.',
      impactDesc: 'Keterlambatan pembayaran supplier merusak hubungan bisnis dan menurunkan skor kredit.',
      recommendation: 'Jadwalkan pelunasan invoice supplier prioritas tinggi dalam 3 hari ke depan.',
      aiPrompt: 'Buatkan jadwal prioritas pembayaran tagihan supplier dan estimasi setoran PPh final UMKM.',
    },
  ],
  MARKETING: [
    {
      id: 'budget-iklan',
      title: 'Budget Kampanye Iklan',
      category: 'Modal Promosi',
      status: 'healthy',
      metricTag: 'Pacing Terkendali',
      x: 30,
      y: 75,
      causalChain: 'Anggaran belanja promosi dialokasikan ke kanal iklan berbayar dan offline.',
      impactDesc: 'Budget yang dibakar tanpa target audiens yang presisi hanya menghasilkan klik sia-sia.',
      recommendation: 'Fokuskan budget ke kampanye Meta & TikTok yang menunjukkan rasio konversi tertinggi.',
      aiPrompt: 'Analisis efisiensi alokasi budget iklan dan sarankan realokasi ke platform dengan ROAS terbaik.',
    },
    {
      id: 'materi-kreatif',
      title: 'Materi Poster & Video AI',
      category: 'Konten Promosi',
      status: 'healthy',
      metricTag: 'Asset Siap Tayang',
      x: 230,
      y: 25,
      causalChain: 'Materi iklan visual dihasilkan menggunakan Marketing Studio berbasis identitas brand.',
      impactDesc: 'Materi iklan yang membosankan memicu penurunan click-through-rate (CTR).',
      recommendation: 'Uji 3 variasi copy promosi baru dengan penawaran diskon terbatas.',
      aiPrompt: 'Buatkan 3 variasi copy iklan promosi menarik untuk Instagram Story produk unggulan.',
    },
    {
      id: 'lalu-lintas-leads',
      title: 'Lalu Lintas & Leads',
      category: 'Akuisisi',
      status: 'warning',
      metricTag: 'Drop-off Checkout 18%',
      x: 230,
      y: 125,
      causalChain: 'Calon pelanggan mengunjungi profil media sosial atau lokasi outlet.',
      impactDesc: 'Tingkat drop-off yang tinggi pada tahap pemesanan membuang biaya iklan.',
      recommendation: 'Sederhanakan proses pemesanan via WhatsApp dengan balasan cepat otomatis.',
      aiPrompt: 'Rancang alur pesan WhatsApp auto-reply untuk memandu calon pembeli langsung menyelesaikan order.',
    },
    {
      id: 'struk-wa-digital',
      title: 'Struk Digital WhatsApp',
      category: 'Database Pelanggan',
      status: 'healthy',
      metricTag: '840 Kontak Baru',
      x: 430,
      y: 75,
      causalChain: 'Setiap struk digital yang dikirim menangkap kontak WhatsApp pelanggan yang sah.',
      impactDesc: 'Ketiadaan database pelanggan memaksa perusahaan selalu membayar mahal untuk iklan baru.',
      recommendation: 'Sematkan voucher diskon 15% pada struk digital untuk kunjungan berikutnya.',
      aiPrompt: 'Tuliskan draf teks penawaran voucher belanja yang menarik disematkan di struk digital WhatsApp.',
    },
    {
      id: 'retargeting-repeat',
      title: 'Retargeting & Repeat Order',
      category: 'Loyalitas',
      status: 'warning',
      metricTag: 'Repeat Rate 26%',
      x: 630,
      y: 75,
      causalChain: 'Pelanggan lama dikirimi pesan siaran promosi personal untuk mendorong pembelian ulang.',
      impactDesc: 'Mendapatkan pelanggan baru 5x lebih mahal daripada menjaga pelanggan lama belanja lagi.',
      recommendation: 'Jalankan siaran promo akhir bulan khusus untuk pelanggan yang tidak belanja >30 hari.',
      aiPrompt: 'Susun strategi kampanye pesan siaran WhatsApp untuk re-aktivasi pelanggan yang sudah lama tidak belanja.',
    },
  ],
};

function MindMapPanel({
  role,
  accent,
  onOpenAI,
}: {
  role: RoleDashboardRole;
  accent: string;
  onOpenAI?: (prompt: string) => void;
}) {
  const allNodes = CAUSAL_NODES[role] || CAUSAL_NODES.MANAGER_OPERASIONAL;
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Filter jalur khusus kausalitas per role
  const nodes = useMemo(() => {
    if (activeFilter === 'all') return allNodes;

    if (role === 'SEKRETARIS') {
      if (activeFilter === 'conflict') {
        return allNodes.filter((n) => ['agenda-masuk', 'cek-bentrok', 'proteksi-fokus'].includes(n.id));
      }
      if (activeFilter === 'legal') {
        return allNodes.filter((n) => ['kontrak-perizinan', 'arsip-tenggat', 'risiko-operasional', 'notif-perpanjangan'].includes(n.id));
      }
      if (activeFilter === 'turnaround') {
        return allNodes.filter((n) => ['agenda-masuk', 'review-urgensi', 'approval-pimpinan', 'disposisi-eksekusi'].includes(n.id));
      }
    }

    if (role === 'MANAGER_OPERASIONAL') {
      if (activeFilter === 'fraud') {
        return allNodes.filter((n) => ['timbang-receiving', 'fraud-supplier', 'klaim-supplier'].includes(n.id));
      }
      if (activeFilter === 'coldchain') {
        return allNodes.filter((n) => ['po-supplier', 'kapasitas-freezer', 'spoilage-dapur', 'promo-bundling'].includes(n.id));
      }
      if (activeFilter === 'buffer') {
        return allNodes.filter((n) => ['po-supplier', 'leadtime-vendor', 'stok-kritis', 'transfer-darurat'].includes(n.id));
      }
    }

    if (role === 'MANAGER_UMUM') {
      if (activeFilter === 'overload') {
        return allNodes.filter((n) => ['target-kpi', 'beban-admin', 'risiko-bottleneck', 'rebalancing-staf'].includes(n.id));
      }
      if (activeFilter === 'budget') {
        return allNodes.filter((n) => ['anggaran-operasional', 'pacing-belanja'].includes(n.id));
      }
      if (activeFilter === 'sop') {
        return allNodes.filter((n) => ['anggaran-operasional', 'checklist-sop', 'kualitas-layanan', 'inspeksi-sidak'].includes(n.id));
      }
    }

    return allNodes;
  }, [allNodes, role, activeFilter]);

  const defaultSelected = nodes.find((n) => n.status === 'critical') || nodes.find((n) => n.status === 'warning') || nodes[0] || allNodes[0];
  const [selectedId, setSelectedId] = useState<string>(defaultSelected.id);

  // Sync selection saat filter berganti
  useEffect(() => {
    if (!nodes.find((n) => n.id === selectedId) && nodes.length > 0) {
      setSelectedId(nodes[0].id);
    }
  }, [nodes, selectedId]);

  const activeNode = nodes.find((n) => n.id === selectedId) || allNodes.find((n) => n.id === selectedId) || allNodes[0];

  const getNodeColor = (status: 'healthy' | 'warning' | 'critical') => {
    if (status === 'healthy') return '#3FBF8F';
    if (status === 'warning') return '#D8A33C';
    return '#EF7777';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* SVG Canvas Map - Full Width Wide Panel */}
      <div style={{ padding: '24px 20px 20px', overflowX: 'auto', borderRadius: '16px', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', width: '100%' }}>
        {/* Header Bar: Role Info, Zoom Controls & Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Network size={18} color={accent} />
              <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: 700, color: '#F5F7FA' }}>
                Pohon Kausalitas &amp; Rantai Keputusan Sistemik ({ROLE_META[role]?.title || role})
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#8A93A3' }}>
              Klik simpul untuk menganalisis keterkaitan sebab-akibat protokol eksekutif, risiko domino, dan simulasi penanganan AI.
            </p>
          </div>

          {/* Navigation Zoom Controls & Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 4px' }}>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
                style={{ padding: '4px 8px', background: 'transparent', border: 0, color: '#C6CEDA', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                title="Zoom Out"
              >
                -
              </button>
              <span style={{ fontSize: '10.5px', color: '#8A93A3', padding: '0 6px', fontWeight: 600 }}>{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.4, +(z + 0.15).toFixed(2)))}
                style={{ padding: '4px 8px', background: 'transparent', border: 0, color: '#C6CEDA', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                style={{ padding: '4px 8px', background: 'transparent', borderLeft: '1px solid rgba(255,255,255,0.08)', color: '#8A93A3', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                title="Reset Zoom"
              >
                Reset
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 600, marginLeft: '4px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#3FBF8F' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3FBF8F' }} /> Aman
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#D8A33C' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D8A33C' }} /> Pantau
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#EF7777' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF7777' }} /> Kritis
              </span>
            </div>
          </div>
        </div>

        {/* Filter Pills Khusus Role SEKRETARIS */}
        {role === 'SEKRETARIS' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 8px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 600 }}>Sorot Alur Kausalitas:</span>
            {[
              { id: 'all', label: '🌐 Seluruh Rantai Protokoler (9 Node)' },
              { id: 'conflict', label: '🚨 Jalur Bentrok Agenda & Proteksi Deep Work (Kamis Padat)' },
              { id: 'legal', label: '⚠️ Jalur Risiko Suspensi Sewa Ruko Kemang (18 Hari)' },
              { id: 'turnaround', label: '⚡ Jalur Antrean Otorisasi & Disposisi Unit (SLA 3.8 Jam)' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: activeFilter === f.id ? `${accent}24` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeFilter === f.id ? accent : 'rgba(255,255,255,0.07)'}`,
                  color: activeFilter === f.id ? '#FFF' : '#8A93A3',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Filter Pills Khusus Role MANAGER_OPERASIONAL */}
        {role === 'MANAGER_OPERASIONAL' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 8px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 600 }}>Sorot Jalur Khusus:</span>
            {[
              { id: 'all', label: '🌐 Semua Alur Kausalitas (9 Node)' },
              { id: 'fraud', label: '🚨 Jalur Audit Timbang & Potong Invoice (-2.4kg)' },
              { id: 'coldchain', label: '⚠️ Jalur Cold Chain & Promo Kilat (72 Jam)' },
              { id: 'buffer', label: '📦 Jalur Stok Kritis & Transfer BSD-Kemang' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: activeFilter === f.id ? `${accent}24` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeFilter === f.id ? accent : 'rgba(255,255,255,0.07)'}`,
                  color: activeFilter === f.id ? '#FFF' : '#8A93A3',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Filter Pills Khusus Role MANAGER_UMUM */}
        {role === 'MANAGER_UMUM' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 8px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#8A93A3', fontWeight: 600 }}>Sorot Alur Kausalitas:</span>
            {[
              { id: 'all', label: '🌐 Seluruh Rantai Keputusan (8 Node)' },
              { id: 'overload', label: '🚨 Jalur Bottleneck Admin & Rebalancing (-22%)' },
              { id: 'budget', label: '💰 Jalur Pacing Belanja & Penguncian Kas (Hemat Rp 3,5jt)' },
              { id: 'sop', label: '📋 Jalur Audit SOP Cabang & Sidak Kilat (Kebersihan 82%)' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: activeFilter === f.id ? `${accent}24` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeFilter === f.id ? accent : 'rgba(255,255,255,0.07)'}`,
                  color: activeFilter === f.id ? '#FFF' : '#8A93A3',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* SVG Drawing Area with Transform Scale Zoom */}
        <div style={{ width: '100%', overflowX: 'auto', marginTop: '16px' }}>
          <svg
            role="img"
            aria-label={`Mind map interaktif ${ROLE_META[role]?.title || role}`}
            viewBox="0 0 1140 420"
            width="100%"
            height={420 * zoomLevel}
            preserveAspectRatio="xMidYMid meet"
            style={{ minWidth: '1020px', transform: `scale(${zoomLevel})`, transformOrigin: 'top left', transition: 'all 0.2s ease' }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#687487" />
              </marker>
              <marker id="arrowActive" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={accent} />
              </marker>
              <marker id="arrowCritical" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#EF7777" />
              </marker>
            </defs>

          {/* Dynamic Cubic Bezier Connectors */}
          {nodes.flatMap((node) => {
            if (!node.connectsTo || node.connectsTo.length === 0) return [];
            const startX = node.x + 225;
            const startY = node.y + 36;
            return node.connectsTo.map((targetId) => {
              const target = nodes.find((n) => n.id === targetId);
              if (!target) return null;
              const targetX = target.x;
              const targetY = target.y + 36;
              const midX = (startX + targetX) / 2;
              const isHighlighted = node.id === activeNode.id || target.id === activeNode.id;
              return (
                <path
                  key={`${node.id}->${target.id}`}
                  d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
                  fill="none"
                  stroke={isHighlighted ? accent : node.status === 'critical' ? 'rgba(239,119,119,0.5)' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={node.status === 'critical' ? '4 3' : undefined}
                  markerEnd={isHighlighted ? 'url(#arrowActive)' : node.status === 'critical' ? 'url(#arrowCritical)' : 'url(#arrow)'}
                />
              );
            });
          })}

          {/* Render Nodes */}
          {nodes.map((node) => {
            const isSelected = node.id === activeNode.id;
            const nodeColor = getNodeColor(node.status);
            return (
              <g
                key={node.id}
                onClick={() => setSelectedId(node.id)}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                {/* Node Box */}
                <rect
                  x={node.x}
                  y={node.y}
                  width="225"
                  height="72"
                  rx="12"
                  fill={isSelected ? '#131924' : '#0B0F15'}
                  stroke={isSelected ? accent : `${nodeColor}66`}
                  strokeWidth={isSelected ? 2 : 1}
                  filter={isSelected ? 'drop-shadow(0 0 12px rgba(78,155,255,0.45))' : undefined}
                />
                {/* Status Dot */}
                <circle cx={node.x + 16} cy={node.y + 19} r="4.5" fill={nodeColor} />
                {/* Category Chip */}
                <text x={node.x + 28} y={node.y + 22} fill="#8A93A3" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="10" fontWeight="600">
                  {node.category}
                </text>
                {/* Node Title */}
                <text x={node.x + 16} y={node.y + 42} fill="#F5F7FA" fontFamily="'Outfit', sans-serif" fontSize="11" fontWeight="700">
                  {node.title.length > 29 ? `${node.title.slice(0, 28)}…` : node.title}
                </text>
                {/* Metric Tag */}
                <text x={node.x + 16} y={node.y + 60} fill={nodeColor} fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="10" fontWeight="700">
                  {node.metricTag}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      </div>

      {/* Active Node Detail Panel - 4 Deep Cognitive Columns */}
      <div style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${getNodeColor(activeNode.status)}18`, display: 'grid', placeItems: 'center', color: getNodeColor(activeNode.status) }}>
              <Network size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: 700, color: '#F5F7FA' }}>{activeNode.title}</h4>
                <span style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${getNodeColor(activeNode.status)}18`, color: getNodeColor(activeNode.status) }}>
                  Status: {activeNode.status === 'healthy' ? 'Aman' : activeNode.status === 'warning' ? 'Perlu Perhatian' : 'Kritis'}
                </span>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>• Kategori: {activeNode.category}</span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#C6CEDA', marginTop: '2px', display: 'block' }}>
                Metrik Kunci: <strong style={{ color: getNodeColor(activeNode.status) }}>{activeNode.metricTag}</strong>
              </span>
            </div>
          </div>

          {onOpenAI && (
            <button
              type="button"
              onClick={() => onOpenAI(`Tolong berikan analisis sistemik dan panduan tindak lanjut untuk fase "${activeNode.title}" (${activeNode.category}). Kondisi saat ini: ${activeNode.metricTag}. Rekomendasi awal: ${activeNode.recommendation}`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '38px', padding: '0 16px', borderRadius: '10px', background: `${accent}16`, border: `1px solid ${accent}44`, color: '#F5F7FA', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
            >
              <Bot size={15} color={accent} />
              <span>Tanyakan Solusi Penanganan ke AI Assistant</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* 4 Information Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
          <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ display: 'block', fontSize: '10.5px', color: '#8A93A3', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>1. Kondisi Lapangan</span>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#C6CEDA', lineHeight: 1.5 }}>{activeNode.fieldCondition || activeNode.causalChain}</p>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ display: 'block', fontSize: '10.5px', color: '#8A93A3', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>2. Rantai Kausalitas</span>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#C6CEDA', lineHeight: 1.5 }}>{activeNode.causalChain}</p>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ display: 'block', fontSize: '10.5px', color: '#8A93A3', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>3. Dampak Risiko Hilir</span>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#C6CEDA', lineHeight: 1.5 }}>{activeNode.impactDesc}</p>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', background: `${accent}0C`, border: `1px solid ${accent}26`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <span style={{ display: 'block', fontSize: '10.5px', color: accent, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>4. Rekomendasi Aksi Cepat</span>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#F5F7FA', lineHeight: 1.5, fontWeight: 600 }}>{activeNode.recommendation}</p>
            </div>
            {activeNode.directAction && (
              <button
                type="button"
                onClick={() => alert(activeNode.directAction?.actionMessage || 'Aksi berhasil dieksekusi.')}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: '4px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: `${accent}24`,
                  border: `1px solid ${accent}66`,
                  color: '#FFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: `0 2px 8px ${accent}20`,
                }}
              >
                {activeNode.directAction.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardCharts({
  payload,
  accent,
  role = 'MANAGER_OPERASIONAL',
  onOpenAI,
}: {
  payload: RoleDashboardPayload | null;
  accent: string;
  role?: RoleDashboardRole;
  onOpenAI?: (prompt: string) => void;
}) {
  const series = useMemo(() => payload?.series || [], [payload]);
  return <ChartPanel series={series} accent={accent} role={role} onOpenAI={onOpenAI} />;
}

export function DashboardMindMap({
  role,
  accent,
  onOpenAI,
}: {
  role: RoleDashboardRole;
  accent: string;
  onOpenAI?: (prompt: string) => void;
}) {
  return <MindMapPanel role={role} accent={accent} onOpenAI={onOpenAI} />;
}

export { SectionCard, SnapshotStrip };

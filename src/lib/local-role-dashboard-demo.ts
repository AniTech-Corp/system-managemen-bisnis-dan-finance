import type {
  DashboardDataStatus,
  RoleDashboardCard,
  RoleDashboardInsight,
  RoleDashboardPayload,
  RoleDashboardRole,
  RoleDashboardSeries,
} from './role-dashboard-contract';

const available = (id: string, label: string, value: number, detail: string, source: string): RoleDashboardCard => ({
  id,
  label,
  value,
  status: 'available',
  detail,
  source,
});

const unsupported = (id: string, label: string, detail: string, source: string): RoleDashboardCard => ({
  id,
  label,
  value: null,
  status: 'unsupported',
  detail,
  source,
});

const insight = (summary: string, explanation: string, title: string, reason: string, action: string, sources: string[]): RoleDashboardInsight => ({
  status: 'available',
  summary,
  explanation,
  recommendations: [{ title, reason, action }],
  sources,
});

const series = (id: string, label: string, labels: string[], values: number[], source: string): RoleDashboardSeries => ({
  id,
  label,
  labels,
  values,
  status: 'available',
  source,
});

export function buildLocalRoleDashboardDemo(role: RoleDashboardRole, generatedAt = new Date().toISOString()): RoleDashboardPayload {
  const common = {
    role,
    status: 'available' as const,
    generatedAt,
    notice: 'Ringkasan operasional terhubung langsung dengan sistem KLIR.',
  };

  if (role === 'CEO') {
    return {
      ...common,
      cards: [
        available('rev-mtd', 'Revenue MTD', 612500000, 'Realisasi omset MTD Rp 612.500.000.', 'CashTransaction / Invoice'),
        available('net-margin', 'Net Profit Margin', 22, 'Margin laba bersih 22%.', 'Financial calculation'),
        available('runway', 'Cash Runway', 14.2, 'Estimasi daya tahan kas 14,2 bulan.', 'ForwardForecast'),
        available('health-grade', 'Health Grade Bisnis', 92, 'Skor kesehatan bisnis 92/100.', 'Business Health Model'),
        available('cash-active', 'Kas & Bank Aktif', 428000000, 'Saldo kas likuid Rp 428.000.000.', 'CashTransaction'),
        available('safe-buffer', 'Cadangan Kas Aman', 120000000, 'Cadangan kas aman Rp 120.000.000.', 'Liquidity policy'),
        available('corplan-target', 'Target Omset Korporat', 750000000, 'Target omset Rp 750.000.000.', 'Corporate Plan'),
        available('burn-rate', 'Burn Rate Bulanan', 38000000, 'Rata-rata pengeluaran kas Rp 38.000.000/bln.', 'CashTransaction'),
        available('expansion-score', 'Skor Kelayakan Ekspansi', 88, 'Kelayakan buka cabang baru 88/100.', 'Corplan Model'),
        available('cogs-share', 'Beban HPP (COGS)', 245000000, 'Alokasi HPP Rp 245.000.000.', 'PurchaseOrder'),
        available('opex-share', 'Beban Operasional', 185000000, 'Alokasi OPEX Rp 185.000.000.', 'Operational expenses'),
        available('marketing-share', 'Belanja Pemasaran', 45000000, 'Alokasi promosi Rp 45.000.000.', 'Marketing spend'),
      ],
      series: [series('revenue-expenses', 'Realisasi Keuangan MTD', ['Pendapatan', 'Pengeluaran', 'Laba Bersih'], [612500000, 475000000, 137500000], 'Financial Ledger')],
      insight: insight('Omset MTD Rp 612,5jt dengan margin bersih 22% dan runway 14,2 bulan.', 'Dashboard CEO menampilkan rangkuman arus kas, runway, dan kelayakan ekspansi cabang.', 'Tinjau rencana ekspansi cabang baru', 'Runway di atas 12 bulan dan cash reserve solid.', 'Buka Corplan Simulator di AI Assistant.', ['Financial calculation', 'ForwardForecast', 'CashTransaction']),
    };
  }

  if (role === 'FINANCE') {
    return {
      ...common,
      cards: [
        available('cash-active', 'Kas & Bank Aktif', 428000000, 'Saldo kas likuid Rp 428.000.000.', 'CashTransaction'),
        available('cash-in-mtd', 'Total Kas Masuk MTD', 612400000, 'Penerimaan operasional Rp 612.400.000.', 'CashTransaction'),
        available('cash-out-mtd', 'Total Kas Keluar MTD', 548200000, 'Pengeluaran operasional Rp 548.200.000.', 'CashTransaction'),
        available('cf-net', 'Surplus Kas Bersih', 64200000, 'Surplus kas bersih Rp 64.200.000.', 'CashTransaction'),
        available('cash-drawer', 'Kas Fisik Laci Kasir', 12500000, 'Saldo fisik laci kasir Rp 12.500.000.', 'POS Cash Register'),
        available('kasbon-active', 'Piutang & Kasbon Berjalan', 8450000, '8 pelanggan memiliki saldo piutang.', 'Invoice / Piutang'),
        available('dead-stock-value', 'Nilai Dead Stock', 2800000, 'Nilai persediaan non-aktif Rp 2.800.000.', 'Inventory turnover'),
        available('tax-reserve', 'Cadangan Pajak Berjalan', 18400000, 'Alokasi estimasi pajak Rp 18.400.000.', 'Tax Estimation'),
        unsupported('tax-compliance', 'Pajak & Kepatuhan', 'Fitur perpajakan belum tersedia saat ini.', 'Tax Compliance Policy'),
      ],
      series: [series('cash-flow-breakdown', 'Rincian Arus Kas Berjalan', ['Penerimaan', 'Pengeluaran', 'Surplus'], [612400000, 548200000, 64200000], 'CashTransaction')],
      insight: insight('Kas likuid Rp 428jt dengan surplus bersih berjalan Rp 64,2jt.', 'Dashboard Finance memantau kas, piutang, kasbon, dan pencadangan pajak.', 'Follow-up piutang lewat jatuh tempo', 'Terdapat Rp 8,45jt piutang langganan yang perlu ditagih.', 'Gunakan AI Kasbon Composer untuk draf pesan WhatsApp.', ['CashTransaction', 'Invoice', 'Piutang']),
    };
  }

  if (role === 'MARKETING') {
    return {
      ...common,
      cards: [
        available('spend-mtd', 'Belanja Iklan MTD', 28000000, 'Total belanja promosi Rp 28.000.000.', 'MarketingCampaign'),
        available('ad-spend', 'Belanja iklan berjalan', 28000000, 'Realisasi spend iklan Rp 28.000.000.', 'MarketingCampaign'),
        available('blended-roas', 'Blended ROAS', 4.2, 'Pengembalian belanja iklan 4,2x.', 'Marketing analytics'),
        available('cac', 'Biaya per Akuisisi (CAC)', 28500, 'Estimasi CAC Rp 28.500.', 'Conversion metrics'),
        available('leads-count', 'Leads & Transaksi', 621, '621 prospek/leads tercatat.', 'Campaign.leads'),
        available('digital-receipts', 'Struk WA terkirim', 1840, '1.840 pelanggan terhubung.', 'WhatsApp delivery'),
        available('voucher-claimed', 'Voucher diklaim', 2, '2 kupon promosi aktif.', 'Voucher redemption'),
        available('repeat-rate', 'Tingkat repeat order', 34, 'Tingkat repeat order 34%.', 'Customer retention'),
        available('meta-roas', 'Meta Ads ROAS', 4.2, 'Performa Meta Ads 4,2x.', 'Meta Ads API'),
        available('tiktok-roas', 'TikTok Ads ROAS', 3.6, 'Performa TikTok Ads 3,6x.', 'TikTok Ads API'),
        available('google-roas', 'Google Search ROAS', 4.8, 'Performa Google Search 4,8x.', 'Google Ads API'),
        available('posters-ready', 'Poster & Banner Siap', 8, '8 aset promosi tersimpan.', 'WorkspaceFile image'),
        available('content-calendar', 'Jadwal Konten Pekan Ini', 5, '5 rencana konten tersimpan.', 'ContentCalendar'),
      ],
      series: [series('campaign-roas', 'Efisiensi Saluran Iklan', ['Meta Ads', 'TikTok Ads', 'Google Ads'], [4.2, 3.6, 4.8], 'Marketing analytics')],
      insight: insight('3 kampanye aktif dengan blended ROAS 4,2x dan belanja iklan Rp 28.000.000.', 'Dashboard Marketing memperlihatkan hubungan belanja, ROAS, CAC, dan retensi pelanggan.', 'Optimalkan alokasi budget ke saluran terbaik', 'Google Ads dan Meta menunjukkan performa tertinggi.', 'Gunakan AI Studio untuk materi kreatif baru.', ['MarketingCampaign', 'Customer', 'Coupon']),
    };
  }

  if (role === 'MANAGER_UMUM') {
    return {
      ...common,
      cards: [
        available('team-kpi', 'KPI Tim', 84.2, 'Pencapaian KPI Tim 84,2%.', 'Team KPI assignment'),
        available('team-workload', 'Beban Kerja Tim', 78, 'Indeks beban kerja 78%.', 'WorkTask team scope'),
        available('team-budget', 'Budget Operasional Tim', 148000000, 'Budget tim Rp 148.000.000.', 'TEAM_OPERATIONAL_BUDGET'),
        available('sop', 'Kepatuhan SOP', 87, 'Kepatuhan SOP 87%.', 'SOP assignment'),
        available('decision-alerts', 'Keputusan Tertunda', 5, '5 keputusan menunggu persetujuan.', 'Team decision queue'),
        available('local-campaigns', 'Campaign Lokal', 3, '3 inisiatif promosi lokal aktif.', 'Local marketing scope'),
        available('kpi-above', 'KPI Di Atas Target', 4, '4 proyek melampaui target.', 'Team KPI assignment'),
        available('kpi-on-track', 'KPI Sesuai Target', 8, '8 proyek sesuai target.', 'Team KPI assignment'),
        available('kpi-below', 'KPI Perlu Dukungan', 2, '2 proyek memerlukan dukungan.', 'Team KPI assignment'),
        available('budget-allocated', 'Alokasi Budget Tim', 148000000, 'Alokasi budget Rp 148.000.000.', 'TEAM_OPERATIONAL_BUDGET'),
        available('budget-spent', 'Budget Terpakai', 101000000, 'Realisasi budget Rp 101.000.000.', 'TEAM_OPERATIONAL_BUDGET'),
        available('budget-remaining', 'Sisa Budget Tim', 47000000, 'Sisa budget Rp 47.000.000.', 'TEAM_OPERATIONAL_BUDGET'),
      ],
      series: [series('team-overview', 'Kinerja dan Beban Tim', ['Pencapaian KPI', 'Kepatuhan SOP', 'Serapan Anggaran'], [84.2, 87, 68], 'Team Performance')],
      insight: insight('Tim mencapai KPI 84,2% dengan kepatuhan SOP 87% dan 5 keputusan pending.', 'Dashboard Manager Umum menampilkan kontrol kinerja, beban, budget, dan antrean keputusan.', 'Tinjau antrean keputusan pending', 'Ada 5 keputusan yang perlu ditindaklanjuti.', 'Buka AI Assistant untuk delegasi tugas tim.', ['Team KPI assignment', 'WorkTask team scope', 'SOP assignment']),
    };
  }

  if (role === 'MANAGER_OPERASIONAL') {
    return {
      ...common,
      cards: [
        available('stock', 'Produk Aktif', 184, '184 produk aktif.', 'Product'),
        available('critical-stock', 'Stok Kritis', 12, '12 SKU di bawah ambang restock.', 'Product.currentStock/minStock'),
        available('purchase-orders', 'PO Pending', 5, '5 PO masih draft/ordered.', 'PurchaseOrder'),
        available('suppliers', 'Supplier Terukur', 8, '8 supplier memiliki skor.', 'SupplierScore'),
        available('expiry', 'Batch Kedaluwarsa ≤30 Hari', 2, '2 batch perlu ditinjau.', 'ProductBatch'),
        available('stock-safe', 'Stok Aman', 172, '172 SKU di atas minimum.', 'Product.currentStock/minStock'),
        available('stock-restock', 'Perlu Restock', 9, '9 SKU perlu dipesan ulang.', 'Product.currentStock/minStock'),
        available('stock-critical', 'Kritis / Habis', 3, '3 SKU kritis atau habis.', 'Product.currentStock/minStock'),
        available('po-draft', 'PO Draft', 2, '2 PO masih draft.', 'PurchaseOrder'),
        available('po-ordered', 'PO Dikirim / Berjalan', 3, '3 PO sedang berjalan.', 'PurchaseOrder'),
        available('po-received', 'PO Diterima', 14, '14 PO sudah diterima.', 'PurchaseOrder'),
        available('supplier-spend', 'Belanja Supplier', 42500000, 'Belanja supplier MTD Rp 42.500.000.', 'PurchaseOrder / StockMovement'),
        available('cogs-ratio', 'Rasio Biaya Pokok Penjualan (COGS)', 38.5, 'Rasio HPP 38,5%.', 'Financial COGS calculation'),
        available('dead-stock-value', 'Nilai Dead Stock', 2800000, 'Nilai dead stock Rp 2.800.000.', 'Inventory turnover'),
        available('sop', 'Kepatuhan SOP Operasional', 91, 'Kepatuhan SOP 91%.', 'Operational SOP'),
        available('shift-morning', 'Shift Pagi', 12, '12 staf bertugas pagi.', 'AttendanceRecord'),
        available('shift-evening', 'Shift Siang / Malam', 8, '8 staf bertugas siang/malam.', 'AttendanceRecord'),
      ],
      series: [series('stock-status', 'Status stok', ['Aman', 'Restock', 'Kritis'], [172, 9, 3], 'Product.currentStock/minStock'), series('po-lifecycle', 'Purchase Order Lifecycle', ['Draft', 'Berjalan', 'Diterima'], [2, 3, 14], 'PurchaseOrder')],
      insight: insight('184 produk aktif, 9 SKU perlu restock, 5 PO pending, dan 8 supplier terukur.', 'Dashboard Manager Operasional berfokus pada stok, PO, supplier, expiry, dan shift.', 'Tinjau SKU kritis', 'Ada 3 SKU kritis atau habis.', 'Buka AI Assistant untuk pencatatan dan rencana restock.', ['Product', 'PurchaseOrder', 'SupplierScore']),
    };
  }

  return {
    ...common,
    cards: [
      available('agenda', 'Tugas Administratif Pending', 7, '7 pekerjaan belum selesai.', 'WorkTask'),
      available('agenda-today', 'Agenda Hari Ini', 4, '4 agenda pertemuan hari ini.', 'BookingReservation'),
      available('agenda-week', 'Agenda Minggu Ini', 11, '11 agenda pekan ini.', 'BookingReservation'),
      available('admin-inbox', 'Dokumen Workspace', 24, '5 dokumen pending dari 24 arsip.', 'WorkspaceFile'),
      available('legal-contracts', 'Dokumen Legal & Kontrak', 26, '24 aktif, 2 perlu perpanjangan.', 'WorkspaceFile'),
      available('coordination-tasks', 'Koordinasi Lintas Divisi', 3, '3 tiket aktif lintas divisi.', 'WorkTask'),
      available('drafts', 'Draft Menunggu Tanda Tangan', 3, '3 berkas menunggu tanda tangan.', 'WorkspaceFile workflow'),
      available('contracts', 'Kontrak Menunggu Approval', 2, '2 kontrak menunggu approval.', 'WorkspaceFile workflow'),
      available('tasks-ceo', 'Tugas Prioritas Tinggi', 3, '3 tugas prioritas tinggi.', 'WorkTask.priority'),
      available('tasks-completed', 'Selesai Minggu Ini', 19, '19 tugas terselesaikan.', 'WorkTask.status'),
      available('attendance-today', 'Kehadiran Hari Ini', 18, '18 catatan absensi hari ini.', 'AttendanceRecord'),
      available('attendance-avg', 'Catatan Kehadiran 30 Hari', 142, '142 catatan agregat.', 'AttendanceRecord aggregate'),
      available('expiry', 'Pengingat Kedaluwarsa', 2, '2 dokumen mendekati expiry.', 'WorkspaceFile expiry metadata'),
    ],
    series: [series('admin-snapshot', 'Data administrasi yang terbaca', ['Tugas', 'Dokumen', 'Kehadiran'], [7, 24, 142], 'WorkTask · WorkspaceFile · AttendanceRecord')],
    insight: insight('7 tugas administratif berjalan, 4 agenda hari ini, dan 24 dokumen tersimpan.', 'Dashboard Sekretaris hanya menampilkan administrasi, dokumen, agenda, dan kehadiran agregat.', 'Prioritaskan tugas pending', 'Masih ada pekerjaan administratif yang perlu ditindaklanjuti.', 'Buka AI Assistant untuk membuat daftar follow-up.', ['WorkTask', 'WorkspaceFile', 'AttendanceRecord aggregate']),
  };
}

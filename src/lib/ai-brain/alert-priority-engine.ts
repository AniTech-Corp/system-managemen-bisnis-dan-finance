/**
 * KLIR AI Brain - Priority & Alert Engine
 * Triages business events and anomalies into CRITICAL, WARNING, and INFO tiers
 * so the CEO and executives see only high-leverage items.
 */

import { BusinessContextSnapshot, PriorityAlert } from './types';

export class AlertPriorityEngine {
  /**
   * Generates prioritized executive alerts from business context snapshot
   */
  public static triageAlerts(snapshot: BusinessContextSnapshot): PriorityAlert[] {
    const alerts: PriorityAlert[] = [];
    const timestamp = new Date().toISOString();

    // 1. CRITICAL: Cash Runway < 2 months
    if (snapshot.financials.runwayMonths < 2 && snapshot.financials.monthlyBurnRate > 0) {
      alerts.push({
        id: 'alt-crit-runway',
        severity: 'CRITICAL',
        category: 'FINANCE',
        title: '🚨 CRITICAL: Cadangan Runway Kas di Bawah 60 Hari',
        message: `Cadangan kas tersisa ${snapshot.financials.runwayMonths.toFixed(1)} bulan dengan burn rate Rp ${snapshot.financials.monthlyBurnRate.toLocaleString('id-ID')}/bulan. Perlu intervensi pemotongan biaya atau percepatan penagihan piutang segera.`,
        timestamp,
        actionLabel: 'Audit OpEx Sekarang',
        suggestedActionType: 'AUDIT_OPEX',
      });
    }

    // 2. CRITICAL: Large Overdue Invoices (> 10 Million)
    if (snapshot.financials.overdueInvoicesCount > 0 && snapshot.financials.totalUnpaidInvoices >= 10000000) {
      alerts.push({
        id: 'alt-crit-overdue-inv',
        severity: 'CRITICAL',
        category: 'FINANCE',
        title: `🚨 CRITICAL: Piutang Tertunggak Senilai Rp ${snapshot.financials.totalUnpaidInvoices.toLocaleString('id-ID')}`,
        message: `Terdapat ${snapshot.financials.overdueInvoicesCount} faktur piutang yang telah melewati batas tanggal jatuh tempo. Likuiditas terikat pada klien.`,
        timestamp,
        actionLabel: 'Kirim Reminder Otomatis',
        suggestedActionType: 'COLLECT_INVOICES',
      });
    }

    // 3. WARNING: Task Bottlenecks
    if (snapshot.operations.completionRatePercent < 30 && snapshot.operations.totalTasks > 0) {
      alerts.push({
        id: 'alt-warn-tasks',
        severity: 'WARNING',
        category: 'OPERATIONS',
        title: '⚠️ WARNING: Hambatan Eksekusi Operasional Tim',
        message: `Tingkat penyelesaian tugas tim saat ini hanya ${snapshot.operations.completionRatePercent}%. Terdapat risiko keterlambatan delivery proyek ke klien.`,
        timestamp,
        actionLabel: 'Tinjau Beban Kerja',
        suggestedActionType: 'GENERAL_ADVICE',
      });
    }

    // 4. INFO: High ROAS / Growth Acceleration Opportunity
    if (snapshot.marketing.estimatedROAS >= 3.0 && snapshot.marketing.estimatedMarketingSpend30d > 0) {
      alerts.push({
        id: 'alt-info-scale-ads',
        severity: 'INFO',
        category: 'MARKETING',
        title: `ℹ️ INFO: Efisiensi Akuisisi Pelanggan Sangat Tinggi (ROAS ${snapshot.marketing.estimatedROAS.toFixed(1)}x)`,
        message: `Metrik konversi pemasaran menunjukkan profitabilitas tinggi. Sangat direkomendasikan untuk menaikkan budget promosi 20-30%.`,
        timestamp,
        actionLabel: 'Eskalasi Anggaran Promo',
        suggestedActionType: 'SCALE_MARKETING',
        actionPayload: { scaleBudgetPercent: 25 },
      });
    }

    // Sort: CRITICAL first, then WARNING, then INFO
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  }
}

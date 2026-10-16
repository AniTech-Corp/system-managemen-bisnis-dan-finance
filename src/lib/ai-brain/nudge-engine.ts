/**
 * KLIR AI Brain - Human Behavior & Nudging Layer Engine
 * Detects stale/missing data, inaction, and gaps, prompting the team
 * with low-friction contextual nudges to maintain data velocity.
 */

import { BusinessContextSnapshot, NudgeItem } from './types';

export class NudgeEngine {
  /**
   * Generates behavioral nudges based on system state
   */
  public static scanNudges(snapshot: BusinessContextSnapshot): NudgeItem[] {
    const nudges: NudgeItem[] = [];

    // Nudge 1: Overdue Invoice Followup
    if (snapshot.financials.overdueInvoicesCount > 0) {
      nudges.push({
        id: 'ndg-inv-overdue',
        title: 'Faktur Menunggu Follow-up',
        description: `Ada ${snapshot.financials.overdueInvoicesCount} faktur senilai Rp ${snapshot.financials.totalUnpaidInvoices.toLocaleString('id-ID')} belum menerima respon. Kirim WhatsApp reminder sekarang?`,
        urgency: 'HIGH',
        category: 'INVOICE_FOLLOWUP',
        actionType: 'COLLECT_INVOICES',
        actionLabel: 'Kirim Pengingat Cepat →',
        deepLinkPath: 'finance',
      });
    }

    // Nudge 2: Operations / Task completion
    if (snapshot.operations.inProgressTasks > 0) {
      nudges.push({
        id: 'ndg-ops-task-check',
        title: 'Pembaruan Status Tugas Tim',
        description: `Terdapat ${snapshot.operations.inProgressTasks} tugas yang sedang dikerjakan tim. Konfirmasi apakah ada kendala atau blocker?`,
        urgency: 'MEDIUM',
        category: 'OKR_REVIEW',
        actionType: 'GENERAL_ADVICE',
        actionLabel: 'Lihat Papan Tugas →',
        deepLinkPath: 'kerja',
      });
    }

    // Nudge 3: Strategic OKR
    if (snapshot.strategy.corplanProjectsCount === 0) {
      nudges.push({
        id: 'ndg-strat-empty',
        title: 'Lengkapi Model Bisnis & Target Q3',
        description: 'Belum ada proyeksi rencana bisnis di CorPlan. Susun dokumen rencana bisnis dalam 5 menit dengan bantuan AI.',
        urgency: 'LOW',
        category: 'DATA_INPUT',
        actionType: 'GENERAL_ADVICE',
        actionLabel: 'Buka CorPlan →',
        deepLinkPath: 'corplan',
      });
    }

    return nudges;
  }
}

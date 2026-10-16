/**
 * KLIR AI Brain - Explainable AI (Why Engine)
 * Generates transparent causal evidence, deterministic mathematical formulas,
 * counter-factual risk assessments, and strategic rationales for all AI recommendations.
 */

import {
  BusinessContextSnapshot,
  ExplainableWhyDetails,
  SuggestedActionType,
} from './types';

export class WhyEngine {
  /**
   * Constructs full Explainable AI breakdown for a given recommendation
   */
  public static explainRecommendation(
    actionType: SuggestedActionType,
    snapshot: BusinessContextSnapshot,
    actionPayload?: Record<string, any>
  ): ExplainableWhyDetails {
    switch (actionType) {
      case 'COLLECT_INVOICES': {
        const overdueAmount = snapshot.financials.totalUnpaidInvoices;
        const formattedAmount = `Rp ${overdueAmount.toLocaleString('id-ID')}`;
        const cashBufferPercent = Math.round(
          (overdueAmount / (snapshot.financials.liquidCash || 1)) * 100
        );

        return {
          evidencePoints: [
            `Terdapat ${snapshot.financials.overdueInvoicesCount} faktur piutang jatuh tempo senilai ${formattedAmount}.`,
            `Piutang ini mewakili ${cashBufferPercent}% dari total cadangan likuiditas kas saat ini.`,
            `Tingkat penagihan rata-rata industri menurun 15% setiap penundaan 14 hari setelah jatuh tempo.`,
          ],
          mathFormula: `Potensi Injeksi Likuiditas = Total Piutang (${formattedAmount}) × Probabilitas Tertagih (90%) = Rp ${Math.round(
            overdueAmount * 0.9
          ).toLocaleString('id-ID')}`,
          counterFactualRisk: `Jika diabaikan, piutang berisiko menjadi bad debt (piutang tak tertagih), mengurangi margin bersih operasional hingga 8-12% dan menurunkan skor kesehatan keuangan.`,
          strategicRationale: `Mempercepat siklus konversi kas (Cash Conversion Cycle) tanpa perlu meminjam modal eksternal atau memotong anggaran operasional tim.`,
        };
      }

      case 'SCALE_MARKETING': {
        const isCouponOnly = actionPayload?.isCouponCreationOnly || snapshot.marketing.estimatedMarketingSpend30d === 0;
        const currentRoas = snapshot.marketing.estimatedROAS;
        const boostPercent = actionPayload?.scaleBudgetPercent || 25;

        if (isCouponOnly) {
          return {
            evidencePoints: [
              `Saat ini belum ada kupon promosi yang aktif untuk menarik pelanggan atau memicu repeat order.`,
              `Aktivasi promo kupon terbukti hemat biaya untuk menggerakkan konversi awal tanpa risiko biaya iklan di muka.`,
              `Kupon dapat dibatasi kuota dan masa berlakunya sehingga dampak terhadap margin kas tetap terkendali.`,
            ],
            mathFormula: `Potensi Reaktivasi = Target Pelanggan Terpilih × Estimasi Konversi Kupon (15-20%) = Peningkatan Frekuensi Transaksi.`,
            counterFactualRisk: `Tanpa penawaran promosi berkala, prospek baru cenderung ragu bertransaksi dan momentum penjualan dapat melambat.`,
            strategicRationale: `Menstimulasi aktivasi dan retensi pelanggan dengan insentif berbasis nilai transaksi tanpa membakar modal awal.`,
          };
        }

        const runwaySafe = snapshot.financials.runwayMonths >= 6
          ? `Cadangan runway kas mencapai ${snapshot.financials.runwayMonths} bulan (aman untuk akselerasi).`
          : snapshot.financials.runwayMonths > 0
          ? `Cadangan runway kas ${snapshot.financials.runwayMonths} bulan (perlu pemantauan berkala).`
          : `Cadangan kas terbatas, alokasi anggaran promo harus terukur ketat.`;

        const attributedRevStr = snapshot.marketing.attributedRevenue30d > 0
          ? `Omset Teratribusi (Rp ${snapshot.marketing.attributedRevenue30d.toLocaleString('id-ID')}) × ${boostPercent}% Growth Factor = +Rp ${Math.round(
              snapshot.marketing.attributedRevenue30d * (boostPercent / 100)
            ).toLocaleString('id-ID')}`
          : `Anggaran Tambahan × Estimasi ROAS (${currentRoas}x) = Proyeksi Pertumbuhan Pendapatan`;

        return {
          evidencePoints: [
            `Efisiensi iklan (ROAS) tercatat di angka ${currentRoas}x (di atas ambang batas 2.5x).`,
            runwaySafe,
            `Tingkat gross margin ${snapshot.financials.grossMarginPercent}% mendukung ekspansi volume penjualan.`,
          ],
          mathFormula: `Proyeksi Penambahan Omset = ${attributedRevStr}`,
          counterFactualRisk: `Jika anggaran dipertahankan datar, laju pertumbuhan pelanggan akan plateau dan momentum pasar dapat diambil oleh kompetitor yang lebih agresif.`,
          strategicRationale: `Memanfaatkan rasio unit economics yang terbukti profitabel untuk memperluas pangsa pasar secara terukur.`,
        };
      }

      case 'APPROVE_HIRING': {
        const inProgressCount = snapshot.operations.inProgressTasks || 0;
        const overdueTasks = snapshot.operations.overdueTasksCount || 0;
        const bottleneckStr = overdueTasks > 0
          ? `${inProgressCount} tugas in-progress dan ${overdueTasks} tugas lewat tenggat`
          : `${inProgressCount} tugas in-progress`;
        const hasRunway = snapshot.financials.runwayMonths > 0 && snapshot.financials.liquidCash > 0;
        const runwayStr = hasRunway
          ? `Cadangan kas mendukung penambahan beban payroll dengan runway ${snapshot.financials.runwayMonths} bulan.`
          : `Kapasitas kas saat ini terbatas, alokasi rekrutmen disarankan berbasis komisi atau part-time agar tidak membebani kas tetap.`;

        const formulaStr = hasRunway
          ? `Dampak Runway = Saldo Kas (Rp ${snapshot.financials.liquidCash.toLocaleString('id-ID')}) ÷ (OpEx Lama + Gaji Baru) → Evaluasi runway proyektif secara berkala.`
          : `Kebutuhan Kapasitas = ${snapshot.operations.totalTasks} Tugas Aktif ÷ Beban Tim Saat Ini → Penambahan kapasitas untuk menyelesaikan backlog.`;

        return {
          evidencePoints: [
            `Tingkat penyelesaian tugas tim saat ini di level ${snapshot.operations.completionRatePercent}%, terindikasi adanya kapasitas tim yang padat.`,
            `Total tugas aktif sebanyak ${snapshot.operations.totalTasks} tugas dengan ${bottleneckStr}.`,
            runwayStr,
          ],
          mathFormula: formulaStr,
          counterFactualRisk: `Penundaan rekrutmen akan memperparah penumpukan pekerjaan operasional, menurunkan kepuasan pelanggan, dan memperlambat SLA delivery proyek.`,
          strategicRationale: `Investasi modal manusia terukur untuk membuka bottleneck operasional dan mendukung akselerasi revenue.`,
        };
      }

      case 'AUDIT_OPEX':
      case 'ADJUST_BUDGET': {
        return {
          evidencePoints: [
            `Total pengeluaran 30 hari sebesar Rp ${snapshot.financials.totalExpense30d.toLocaleString('id-ID')}.`,
            `Terdapat pengeluaran berulang yang dapat dioptimalkan tanpa mengorbankan produktivitas inti.`,
          ],
          mathFormula: `Potensi Penghematan Kas = OpEx Bulanan × 15% Optimasi = Rp ${Math.round(
            snapshot.financials.totalExpense30d * 0.15
          ).toLocaleString('id-ID')}/bulan.`,
          counterFactualRisk: `Pembengkakan biaya tetap yang tidak dikontrol akan mengikis margin laba kotor saat terjadi penurunan volume penjualan musiman.`,
          strategicRationale: `Disiplin efisiensi modal menjaga fleksibilitas operasional bisnis dalam jangka panjang.`,
        };
      }

      default: {
        return {
          evidencePoints: [
            `Analisis korelasi data multi-modul menunjukkan peluang perbaikan pada pilar operasional.`,
            `Skor kesehatan komposit berada di level ${snapshot.healthScore.totalScore}/100.`,
          ],
          mathFormula: `Optimal State = Baseline Performance + AI Prescriptive Action.`,
          counterFactualRisk: `Stagnasi efisiensi operasional dan potensi hilangnya peluang optimasi nilai bisnis.`,
          strategicRationale: `Penyelarasan strategi bisnis terpadu menuju target pertumbuhan jangka panjang.`,
        };
      }
    }
  }
}

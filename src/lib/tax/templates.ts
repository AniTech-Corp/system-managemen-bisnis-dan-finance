import { ComplianceCategory, Recurrence, TaxType } from '@prisma/client';
import { addMonths, dateAtWibMidnight, lastDayOfMonth } from './dates';

/**
 * Template tenggat nasional. Disimpan di kode (bukan tabel) supaya bisa
 * diperbarui bersama rilis tanpa migrasi data; saat di-generate, setiap tenggat
 * disalin ke `ComplianceDeadline` sehingga owner tetap bisa mengubah tanggal,
 * menambah catatan, atau menandainya selesai.
 *
 * PENTING: tenggat di bawah adalah acuan umum. Peraturan dapat berubah dan
 * beberapa jenis usaha punya kewajiban tambahan. UI selalu menampilkan dasar
 * hukum dan mengingatkan pengguna untuk memverifikasi ke DJP.
 */

export type DayOfMonth = number | 'last';

export interface DeadlineTemplate {
  key: string;
  title: string;
  description: string;
  category: ComplianceCategory;
  taxType?: TaxType;
  frequency: 'MONTHLY' | 'ANNUAL';
  /** Jarak bulan jatuh tempo dari bulan masa pajak (1 = bulan berikutnya). */
  monthOffset: number;
  payment?: { day: DayOfMonth };
  filing?: { day: DayOfMonth };
  /** Untuk template tahunan: bulan & hari jatuh tempo pada tahun berikutnya. */
  annual?: { month: number; day: number };
  legalBasis: string;
  reminderDays: number[];
}

export const DEADLINE_TEMPLATES: DeadlineTemplate[] = [
  {
    key: 'ppn',
    title: 'PPN',
    description: 'Setor dan lapor SPT Masa PPN untuk masa pajak terkait.',
    category: ComplianceCategory.TAX,
    taxType: TaxType.PPN,
    frequency: 'MONTHLY',
    monthOffset: 1,
    payment: { day: 'last' },
    filing: { day: 'last' },
    legalBasis: 'UU PPN — setor & lapor paling lambat akhir bulan berikutnya',
    reminderDays: [14, 7, 3, 1],
  },
  {
    key: 'pph-final-umkm',
    title: 'PPh Final UMKM',
    description: 'Setor PPh Final 0,5% dan lapor SPT Masa PPh Final UMKM.',
    category: ComplianceCategory.TAX,
    taxType: TaxType.PPH_FINAL_UMKM,
    frequency: 'MONTHLY',
    monthOffset: 1,
    payment: { day: 15 },
    filing: { day: 20 },
    legalBasis: 'PP No. 55 Tahun 2022',
    reminderDays: [14, 7, 3, 1],
  },
  {
    key: 'pph-21',
    title: 'PPh 21',
    description: 'Setor PPh 21 atas penghasilan pegawai dan lapor SPT Masa.',
    category: ComplianceCategory.TAX,
    taxType: TaxType.PPH_21,
    frequency: 'MONTHLY',
    monthOffset: 1,
    payment: { day: 10 },
    filing: { day: 20 },
    legalBasis: 'UU PPh & PMK 168/2023',
    reminderDays: [7, 3, 1],
  },
  {
    key: 'pph-23',
    title: 'PPh 23',
    description: 'Setor PPh 23 atas jasa/sewa dan lapor SPT Masa.',
    category: ComplianceCategory.TAX,
    taxType: TaxType.PPH_23,
    frequency: 'MONTHLY',
    monthOffset: 1,
    payment: { day: 10 },
    filing: { day: 20 },
    legalBasis: 'UU PPh Pasal 23',
    reminderDays: [7, 3, 1],
  },
  {
    key: 'pph-4-2',
    title: 'PPh 4 ayat (2)',
    description: 'Setor PPh final atas sewa tanah/bangunan, jasa konstruksi, dsb.',
    category: ComplianceCategory.TAX,
    taxType: TaxType.PPH_4_2,
    frequency: 'MONTHLY',
    monthOffset: 1,
    payment: { day: 10 },
    filing: { day: 20 },
    legalBasis: 'UU PPh Pasal 4 ayat (2) & PP 34/2017',
    reminderDays: [7, 3, 1],
  },
  {
    key: 'bpjs',
    title: 'Iuran BPJS',
    description: 'Setor iuran BPJS Kesehatan & Ketenagakerjaan pegawai.',
    category: ComplianceCategory.BPJS,
    taxType: TaxType.BPJS,
    frequency: 'MONTHLY',
    monthOffset: 1,
    payment: { day: 15 },
    legalBasis: 'Perpres Jaminan Sosial',
    reminderDays: [7, 3, 1],
  },
  {
    key: 'spt-tahunan-badan',
    title: 'SPT Tahunan PPh Badan',
    description: 'Lapor SPT Tahunan PPh Badan tahun pajak sebelumnya.',
    category: ComplianceCategory.TAX,
    taxType: TaxType.PPH_FINAL_UMKM,
    frequency: 'ANNUAL',
    monthOffset: 0,
    annual: { month: 4, day: 30 },
    legalBasis: 'UU KUP — paling lambat 4 bulan setelah tahun pajak berakhir',
    reminderDays: [60, 30, 14, 7, 3, 1],
  },
  {
    key: 'spt-tahunan-op',
    title: 'SPT Tahunan PPh Orang Pribadi',
    description: 'Lapor SPT Tahunan PPh Orang Pribadi tahun pajak sebelumnya.',
    category: ComplianceCategory.TAX,
    taxType: TaxType.PPH_FINAL_UMKM,
    frequency: 'ANNUAL',
    monthOffset: 0,
    annual: { month: 3, day: 31 },
    legalBasis: 'UU KUP — paling lambat 3 bulan setelah tahun pajak berakhir',
    reminderDays: [60, 30, 14, 7, 3, 1],
  },
];

export const DEADLINE_TEMPLATE_BY_KEY = new Map(DEADLINE_TEMPLATES.map((t) => [t.key, t]));

function resolveDay(year: number, month: number, day: DayOfMonth): number {
  return day === 'last' ? lastDayOfMonth(year, month) : Math.min(day, lastDayOfMonth(year, month));
}

export interface MonthlyDueDates {
  payment?: Date;
  filing?: Date;
}

/**
 * Tenggat setor/lapor untuk satu jenis pajak pada masa pajak tertentu.
 * Mengembalikan `undefined` bila jenis tersebut tidak punya template bulanan.
 */
export function getMonthlyDueDates(
  taxType: TaxType,
  year: number,
  month: number
): MonthlyDueDates {
  const template = DEADLINE_TEMPLATES.find((t) => t.frequency === 'MONTHLY' && t.taxType === taxType);
  if (!template) return {};
  const due = addMonths(year, month, template.monthOffset);
  return {
    payment: template.payment
      ? dateAtWibMidnight(due.year, due.month, resolveDay(due.year, due.month, template.payment.day))
      : undefined,
    filing: template.filing
      ? dateAtWibMidnight(due.year, due.month, resolveDay(due.year, due.month, template.filing.day))
      : undefined,
  };
}

export interface GeneratedDeadline {
  templateKey: string;
  title: string;
  description: string;
  category: ComplianceCategory;
  taxType?: TaxType;
  dueDate: Date;
  recurrence: Recurrence;
  reminderDays: number[];
  legalBasis: string;
  /** Masa pajak yang diwakili tenggat ini (untuk ditautkan ke TaxPeriod). */
  periodYear: number;
  periodMonth: number;
}

/**
 * Menghasilkan seluruh tenggat yang jatuh pada `year`.
 *
 * Contoh: PPh 21 masa Desember 2025 jatuh tempo 10 Januari 2026. Karena itu
 * untuk `year = 2026` kita ikut membuat tenggat dengan masa pajak Desember 2025.
 */
export function generateDeadlinesForYear(
  year: number,
  options: { enablePpn?: boolean; includeAnnual?: boolean } = {}
): GeneratedDeadline[] {
  const { enablePpn = true, includeAnnual = true } = options;
  const out: GeneratedDeadline[] = [];

  for (const template of DEADLINE_TEMPLATES) {
    if (template.taxType === TaxType.PPN && !enablePpn) continue;
    if (template.frequency === 'ANNUAL' && !includeAnnual) continue;

    if (template.frequency === 'MONTHLY') {
      // Iterasi bulan JATUH TEMPO di tahun ini, bukan bulan masa pajak.
      for (let dueMonth = 1; dueMonth <= 12; dueMonth += 1) {
        const period = addMonths(year, dueMonth, -template.monthOffset);

        if (template.payment) {
          out.push({
            templateKey: `${template.key}:pay`,
            title: `${template.title} — Setor`,
            description: template.description,
            category: template.category,
            taxType: template.taxType,
            dueDate: dateAtWibMidnight(
              year,
              dueMonth,
              resolveDay(year, dueMonth, template.payment.day)
            ),
            recurrence: Recurrence.MONTHLY,
            reminderDays: template.reminderDays,
            legalBasis: template.legalBasis,
            periodYear: period.year,
            periodMonth: period.month,
          });
        }

        if (template.filing) {
          out.push({
            templateKey: `${template.key}:file`,
            title: `${template.title} — Lapor`,
            description: template.description,
            category: template.category,
            taxType: template.taxType,
            dueDate: dateAtWibMidnight(
              year,
              dueMonth,
              resolveDay(year, dueMonth, template.filing.day)
            ),
            recurrence: Recurrence.MONTHLY,
            reminderDays: template.reminderDays,
            legalBasis: template.legalBasis,
            periodYear: period.year,
            periodMonth: period.month,
          });
        }
      }
      continue;
    }

    if (template.annual) {
      out.push({
        templateKey: `${template.key}:file`,
        title: template.title,
        description: template.description,
        category: template.category,
        taxType: template.taxType,
        dueDate: dateAtWibMidnight(year, template.annual.month, template.annual.day),
        recurrence: Recurrence.ANNUAL,
        reminderDays: template.reminderDays,
        legalBasis: template.legalBasis,
        periodYear: year - 1,
        periodMonth: 12,
      });
    }
  }

  return out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

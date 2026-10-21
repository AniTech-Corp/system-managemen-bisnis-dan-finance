import { JournalStatus, Prisma, TaxProfile } from '@prisma/client';
import { prisma } from '../prisma';
import type { DateRange } from './period';
import {
  AGING_BUCKETS,
  bucketForDaysOverdue,
  daysOverdue as daysPastDue,
  summarizeAgingByPartner,
  type AgingBucketKey,
  type PartnerAgingRow,
} from './ar-ap';

/**
 * Laporan pendukung (sub-ledger): umur piutang/utang dan ringkasan PPN.
 *
 * Beda dari 6 laporan utama, laporan di sini memang membaca dokumen sumber
 * (faktur & kewajiban) karena umur tagihan hanya bisa dihitung dari tanggal
 * jatuh tempo dokumen — bukan dari jurnal. Agar tetap bisa dipercaya, setiap
 * laporan menyertakan **saldo buku besar** sebagai pembanding dan menampilkan
 * selisihnya secara terbuka. Tidak ada angka dokumen yang dipakai untuk
 * menggantikan angka jurnal di laporan utama.
 */

const ZERO = new Prisma.Decimal(0);

export type AgingType = 'AR' | 'AP';

export interface AgingRow {
  id: string;
  reference: string;
  partner: string;
  /** Tautan ke master pihak lawan (Partner). Null untuk dokumen lama. */
  partnerId: string | null;
  dueDate: Date;
  daysOverdue: number;
  /** Sisa tagihan/utang (total dokumen dikurangi pembayaran sampai `asOf`). */
  amount: Prisma.Decimal;
  /** Total dokumen sebelum dikurangi pembayaran (untuk transparansi). */
  documentAmount: Prisma.Decimal;
  /** Pembayaran sebagian yang sudah dialokasikan sampai `asOf`. */
  paidAmount: Prisma.Decimal;
  bucket: AgingBucketKey;
}

// Definisi bucket & perhitungan hari terlambat tinggal di ar-ap.ts (logika
// murni) agar laporan umur dan modul AR/AP lain memakai sumber yang sama.
export type { AgingBucketKey };

export interface AgingBucket {
  key: AgingBucketKey;
  label: string;
  amount: Prisma.Decimal;
  count: number;
}

export interface AgingReport {
  type: AgingType;
  asOf: Date;
  rows: AgingRow[];
  buckets: AgingBucket[];
  /** Ringkasan umur per pihak lawan (pelanggan/vendor). */
  byPartner: PartnerAgingRow[];
  total: Prisma.Decimal;
  ledgerBalance: Prisma.Decimal;
  difference: Prisma.Decimal;
  warnings: string[];
}

async function ledgerBalanceFor(workspaceId: string, type: AgingType, asOf: Date): Promise<Prisma.Decimal> {
  const code = type === 'AR' ? '1-1300' : '2-1100';
  const lines = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      account: { code },
      entry: { status: JournalStatus.POSTED, entryDate: { lte: asOf } },
    },
    select: { debit: true, credit: true },
  });

  // Piutang = aset (debit menambah), utang = liabilitas (kredit menambah).
  return lines.reduce(
    (acc, l) => (type === 'AR' ? acc.plus(l.debit).minus(l.credit) : acc.plus(l.credit).minus(l.debit)),
    ZERO
  );
}

/**
 * Umur piutang (AR) atau utang (AP) per tanggal potong.
 *
 * AR: faktur UNPAID/OVERDUE/PARTIAL yang sudah diterbitkan.
 * AP: kewajiban PENDING/PARTIAL yang sudah dicatat.
 *
 * Nilai baris = sisa dokumen (total dikurangi pembayaran sampai `asOf`).
 * Laporan juga menyertakan ringkasan per pihak lawan (`byPartner`).
 */
export async function getAgingReport(
  workspaceId: string,
  type: AgingType,
  asOf: Date
): Promise<AgingReport> {
  const warnings: string[] = [];

  const [documents, ledgerBalance, allocationSums] = await Promise.all([
    type === 'AR'
      ? prisma.invoice.findMany({
          where: {
            workspaceId,
            // PARTIAL = sudah dibayar sebagian, sisanya masih piutang.
            status: { in: ['UNPAID', 'OVERDUE', 'PARTIAL'] },
            issueDate: { lte: asOf },
          },
          select: { id: true, invoiceNumber: true, clientName: true, partnerId: true, dueDate: true, totalAmount: true },
          orderBy: { dueDate: 'asc' },
        })
      : prisma.scheduledObligation.findMany({
          where: { workspaceId, status: { in: ['PENDING', 'PARTIAL'] }, createdAt: { lte: asOf } },
          select: { id: true, name: true, partnerId: true, dueDate: true, amount: true },
          orderBy: { dueDate: 'asc' },
        }),
    ledgerBalanceFor(workspaceId, type, asOf),
    // Sisa dihitung dari ALOKASI sampai tanggal potong, bukan hanya flag status,
    // supaya laporan masa lalu tetap benar walau dokumen sudah lunas belakangan.
    prisma.paymentAllocation.groupBy({
      by: ['invoiceId', 'obligationId'],
      where: { workspaceId, transactionDate: { lte: asOf } },
      _sum: { amount: true },
    }),
  ]);

  const paidByInvoice = new Map<string, Prisma.Decimal>();
  const paidByObligation = new Map<string, Prisma.Decimal>();
  for (const row of allocationSums) {
    if (row.invoiceId) paidByInvoice.set(row.invoiceId, new Prisma.Decimal(row._sum.amount ?? 0));
    if (row.obligationId) paidByObligation.set(row.obligationId, new Prisma.Decimal(row._sum.amount ?? 0));
  }

  const rows: AgingRow[] = documents
    .map((doc) => {
      const documentAmount = new Prisma.Decimal(
        'totalAmount' in doc ? doc.totalAmount : doc.amount
      ).toDecimalPlaces(2);
      const paidAmount = (
        'invoiceNumber' in doc ? paidByInvoice.get(doc.id) : paidByObligation.get(doc.id)
      ) ?? ZERO;
      const amount = Prisma.Decimal.max(ZERO, documentAmount.minus(paidAmount)).toDecimalPlaces(2);
      const overdueDays = daysPastDue(doc.dueDate, asOf);
      return {
        id: doc.id,
        reference: 'invoiceNumber' in doc ? doc.invoiceNumber : doc.name,
        partner: 'clientName' in doc ? doc.clientName : doc.name,
        partnerId: doc.partnerId ?? null,
        dueDate: doc.dueDate,
        daysOverdue: overdueDays,
        amount,
        documentAmount,
        paidAmount,
        bucket: bucketForDaysOverdue(overdueDays),
      };
    })
    // Dokumen yang sudah lunas per tanggal potong tidak lagi jadi piutang/utang.
    .filter((row) => row.amount.gt(0.005));

  const buckets: AgingBucket[] = AGING_BUCKETS.map((b) => {
    const inBucket = rows.filter((r) => r.bucket === b.key);
    return {
      key: b.key,
      label: b.label,
      amount: inBucket.reduce((acc, r) => acc.plus(r.amount), ZERO),
      count: inBucket.length,
    };
  });

  const byPartner = summarizeAgingByPartner(rows).partners;

  const total = rows.reduce((acc, r) => acc.plus(r.amount), ZERO);
  const difference = total.minus(ledgerBalance);

  if (!difference.isZero()) {
    warnings.push(
      `Saldo buku besar (${ledgerBalance.toFixed(2)}) berbeda dengan daftar dokumen (${total.toFixed(2)}). ` +
        'Selisih bisa berasal dari saldo awal, jurnal manual, atau pembayaran yang tidak ditautkan ke dokumen.'
    );
  }
  if (type === 'AR') {
    const paidWithoutJournal = await prisma.invoice.count({
      where: { workspaceId, status: 'PAID', paidAt: { lte: asOf } },
    });
    if (paidWithoutJournal > 0) {
      warnings.push(
        `${paidWithoutJournal} faktur sudah lunas dan tidak masuk daftar ini. Kalau pelunasannya dicatat tanpa menautkan faktur, saldo piutang di buku besar bisa lebih besar.`
      );
    }
  }

  return { type, asOf, rows, buckets, byPartner, total, ledgerBalance, difference, warnings };
}

/* ─────────────────────────── PAJAK (PPN) ─────────────────────────── */

export interface TaxAccountLine {
  code: string;
  name: string;
  amount: Prisma.Decimal;
}

export interface TaxSummary {
  period: DateRange;
  isPkp: boolean;
  outputTax: Prisma.Decimal;
  inputTax: Prisma.Decimal;
  netPayable: Prisma.Decimal;
  withholding: TaxAccountLine[];
  warnings: string[];
}

/**
 * Ringkasan PPN satu periode dari jurnal:
 *
 *   PPN Keluaran (2-1310)  kredit − debit  → pajak yang dipungut dari pembeli
 *   PPN Masukan  (1-1600)  debit − kredit  → pajak yang dibayar ke pemasok
 *   Kurang bayar = Keluaran − Masukan
 *
 * Untuk non-PKP angkanya memang nol karena akun PPN tidak dipakai.
 */
export async function getTaxSummary(
  workspaceId: string,
  period: DateRange,
  taxProfile: TaxProfile
): Promise<TaxSummary> {
  const lines = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      entry: {
        status: JournalStatus.POSTED,
        entryDate: { gte: period.startDate, lte: period.endDate },
      },
      account: { code: { in: ['1-1600', '2-1310', '2-1320', '2-1330'] } },
    },
    select: {
      debit: true,
      credit: true,
      account: { select: { code: true, name: true } },
    },
  });

  const sumBy = (code: string, side: 'debit' | 'credit') =>
    lines
      .filter((l) => l.account.code === code)
      .reduce((acc, l) => acc.plus(side === 'debit' ? l.debit.minus(l.credit) : l.credit.minus(l.debit)), ZERO);

  const outputTax = sumBy('2-1310', 'credit');
  const inputTax = sumBy('1-1600', 'debit');
  const netPayable = outputTax.minus(inputTax);

  const withholding: TaxAccountLine[] = ['2-1320', '2-1330'].map((code) => {
    const account = lines.find((l) => l.account.code === code)?.account;
    return {
      code,
      name: account?.name ?? code,
      amount: sumBy(code, 'credit'),
    };
  });

  const warnings: string[] = [];
  // PKP = semua profil selain UMKM non-PKP (lihat setup/settings route).
  const isPkp = taxProfile !== TaxProfile.UMKM_NON_PKP;
  if (!isPkp && (!outputTax.isZero() || !inputTax.isZero())) {
    warnings.push('Profil pajak workspace bukan PKP, tetapi ada jurnal di akun PPN. Periksa kembali pencatatannya.');
  }
  if (isPkp && outputTax.isZero() && inputTax.isZero()) {
    warnings.push('Tidak ada transaksi PPN pada periode ini.');
  }

  return { period, isPkp, outputTax, inputTax, netPayable, withholding, warnings };
}

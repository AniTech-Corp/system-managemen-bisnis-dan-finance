import { JournalStatus, Prisma, TaxProfile } from '@prisma/client';
import { prisma } from '../prisma';
import type { DateRange } from './period';

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
  dueDate: Date;
  daysOverdue: number;
  amount: Prisma.Decimal;
  bucket: AgingBucketKey;
}

export type AgingBucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

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
  total: Prisma.Decimal;
  ledgerBalance: Prisma.Decimal;
  difference: Prisma.Decimal;
  warnings: string[];
}

const BUCKETS: Array<{ key: AgingBucketKey; label: string; min: number; max: number }> = [
  { key: 'current', label: 'Belum jatuh tempo', min: -Infinity, max: 0 },
  { key: 'd1_30', label: '1–30 hari', min: 1, max: 30 },
  { key: 'd31_60', label: '31–60 hari', min: 31, max: 60 },
  { key: 'd61_90', label: '61–90 hari', min: 61, max: 90 },
  { key: 'd90_plus', label: '> 90 hari', min: 91, max: Infinity },
];

function bucketFor(daysOverdue: number): AgingBucketKey {
  const found = BUCKETS.find((b) => daysOverdue >= b.min && daysOverdue <= b.max);
  return found?.key ?? 'd90_plus';
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
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
 * AR: faktur berstatus UNPAID/OVERDUE yang sudah diterbitkan.
 * AP: kewajiban berstatus PENDING yang sudah dicatat.
 *
 * Belum ada pembayaran sebagian, jadi nilai baris = nilai penuh dokumen.
 */
export async function getAgingReport(
  workspaceId: string,
  type: AgingType,
  asOf: Date
): Promise<AgingReport> {
  const warnings: string[] = [];

  const [documents, ledgerBalance] = await Promise.all([
    type === 'AR'
      ? prisma.invoice.findMany({
          where: {
            workspaceId,
            status: { in: ['UNPAID', 'OVERDUE'] },
            issueDate: { lte: asOf },
          },
          select: { id: true, invoiceNumber: true, clientName: true, dueDate: true, totalAmount: true },
          orderBy: { dueDate: 'asc' },
        })
      : prisma.scheduledObligation.findMany({
          where: { workspaceId, status: 'PENDING', createdAt: { lte: asOf } },
          select: { id: true, name: true, dueDate: true, amount: true },
          orderBy: { dueDate: 'asc' },
        }),
    ledgerBalanceFor(workspaceId, type, asOf),
  ]);

  const rows: AgingRow[] = documents.map((doc) => {
    const amount = new Prisma.Decimal('totalAmount' in doc ? doc.totalAmount : doc.amount).toDecimalPlaces(2);
    const daysOverdue = Math.max(0, daysBetween(doc.dueDate, asOf));
    return {
      id: doc.id,
      reference: 'invoiceNumber' in doc ? doc.invoiceNumber : doc.name,
      partner: 'clientName' in doc ? doc.clientName : doc.name,
      dueDate: doc.dueDate,
      daysOverdue,
      amount,
      bucket: bucketFor(daysOverdue),
    };
  });

  const buckets: AgingBucket[] = BUCKETS.map((b) => {
    const inBucket = rows.filter((r) => r.bucket === b.key);
    return {
      key: b.key,
      label: b.label,
      amount: inBucket.reduce((acc, r) => acc.plus(r.amount), ZERO),
      count: inBucket.length,
    };
  });

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

  return { type, asOf, rows, buckets, total, ledgerBalance, difference, warnings };
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

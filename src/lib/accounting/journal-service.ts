import {
  JournalSource,
  JournalStatus,
  PeriodStatus,
  Prisma,
  type JournalEntry,
  type JournalLine,
} from '@prisma/client';
import { prisma } from '../prisma';
import { getOrCreatePeriod, getJakartaParts, isPeriodWritable, PeriodClosedError } from './period';
import { toMoney, type MoneyInput } from './money';

export interface JournalLineInput {
  accountId: string;
  debit?: MoneyInput;
  credit?: MoneyInput;
  description?: string;
  cashAccountId?: string | null;
  partnerId?: string | null;
  costCenter?: string | null;
  currency?: string;
  exchangeRate?: MoneyInput;
}

export interface CreateJournalInput {
  workspaceId: string;
  userId: string;
  entryDate: Date;
  description: string;
  source: JournalSource;
  sourceId?: string | null;
  lines: JournalLineInput[];
  /** Manual journal default DRAFT. Auto-posting memakai POSTED. */
  status?: JournalStatus;
  /** Untuk sumber otomatis: langsung posted tanpa langkah review. */
  postImmediately?: boolean;
  /**
   * Izinkan posting ke periode yang sudah CLOSED. Hanya dipakai jurnal penutup
   * tahun: bulan terakhir biasanya sudah ditutup bulanan sebelum tutup tahun.
   * Periode LOCKED tetap selalu ditolak.
   */
  allowClosedPeriod?: boolean;
}

export class JournalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JournalValidationError';
  }
}

interface NormalizedLine {
  accountId: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  description?: string;
  cashAccountId?: string | null;
  partnerId?: string | null;
  costCenter?: string | null;
  currency: string;
  exchangeRate: Prisma.Decimal;
}

function normalizeLines(lines: JournalLineInput[]): NormalizedLine[] {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new JournalValidationError('Jurnal minimal terdiri dari dua baris (debit dan kredit).');
  }

  return lines.map((line, index) => {
    if (!line.accountId) {
      throw new JournalValidationError(`Baris ${index + 1}: akun wajib dipilih.`);
    }

    const debit = toMoney(line.debit, `Debit baris ${index + 1}`);
    const credit = toMoney(line.credit, `Kredit baris ${index + 1}`);

    if (debit.isNegative() || credit.isNegative()) {
      throw new JournalValidationError(`Baris ${index + 1}: nominal tidak boleh negatif.`);
    }
    if (debit.isZero() && credit.isZero()) {
      throw new JournalValidationError(`Baris ${index + 1}: debit atau kredit harus lebih dari nol.`);
    }
    if (!debit.isZero() && !credit.isZero()) {
      throw new JournalValidationError(`Baris ${index + 1}: satu baris hanya boleh berisi debit ATAU kredit.`);
    }

    return {
      accountId: line.accountId,
      debit,
      credit,
      description: line.description?.trim() || undefined,
      cashAccountId: line.cashAccountId ?? null,
      partnerId: line.partnerId ?? null,
      costCenter: line.costCenter?.trim() || null,
      currency: (line.currency || 'IDR').toUpperCase().slice(0, 3),
      exchangeRate: toMoney(line.exchangeRate ?? 1, `Kurs baris ${index + 1}`),
    };
  });
}

/**
 * Ambil nomor jurnal berikutnya secara atomik.
 *
 * Memakai INSERT ... ON CONFLICT DO UPDATE ... RETURNING supaya dua staf yang
 * menyimpan pada detik yang sama tidak pernah mendapat nomor yang sama.
 * `next_number - 1` adalah nomor yang dipakai pada pemanggilan ini.
 */
async function nextEntryNumber(tx: Prisma.TransactionClient, workspaceId: string, date: Date): Promise<string> {
  const { year, month } = getJakartaParts(date);
  const key = `JE-${year}-${String(month).padStart(2, '0')}`;

  const rows = await tx.$queryRaw<Array<{ next_number: number }>>`
    INSERT INTO document_sequences (id, workspace_id, key, next_number)
    VALUES (gen_random_uuid(), ${workspaceId}::uuid, ${key}, 2)
    ON CONFLICT (workspace_id, key)
    DO UPDATE SET next_number = document_sequences.next_number + 1
    RETURNING next_number - 1 AS next_number
  `;

  const number = rows[0]?.next_number ?? 1;
  return `${key}-${String(number).padStart(4, '0')}`;
}

async function validateAccounts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  lines: NormalizedLine[]
): Promise<void> {
  const ids = Array.from(new Set(lines.map((l) => l.accountId)));
  const accounts = await tx.account.findMany({
    where: { workspaceId, id: { in: ids } },
    select: { id: true, code: true, name: true, isActive: true, isPostable: true },
  });

  if (accounts.length !== ids.length) {
    throw new JournalValidationError('Ada akun yang tidak ditemukan di workspace ini.');
  }

  const map = new Map(accounts.map((a) => [a.id, a]));
  for (const line of lines) {
    const account = map.get(line.accountId)!;
    if (!account.isActive) {
      throw new JournalValidationError(`Akun ${account.code} ${account.name} sudah nonaktif.`);
    }
    if (!account.isPostable) {
      throw new JournalValidationError(
        `Akun ${account.code} ${account.name} adalah akun header dan tidak bisa dipakai di jurnal.`
      );
    }
  }

  const cashIds = Array.from(new Set(lines.map((l) => l.cashAccountId).filter(Boolean))) as string[];
  if (cashIds.length > 0) {
    const cashAccounts = await tx.cashAccount.findMany({
      where: { workspaceId, id: { in: cashIds } },
      select: { id: true, isActive: true },
    });
    if (cashAccounts.length !== cashIds.length) {
      throw new JournalValidationError('Rekening kas/bank tidak ditemukan di workspace ini.');
    }
    if (cashAccounts.some((c) => !c.isActive)) {
      throw new JournalValidationError('Rekening kas/bank yang dipilih sudah nonaktif.');
    }
  }
}

export type JournalWithLines = JournalEntry & { lines: JournalLine[] };

/**
 * Buat jurnal beserta barisnya dalam satu transaksi database.
 * Melempar JournalValidationError untuk kesalahan yang bisa diperbaiki user.
 */
export async function createJournal(input: CreateJournalInput): Promise<JournalWithLines> {
  return prisma.$transaction((tx) => createJournalInTx(tx, input));
}

/**
 * Versi yang menerima transaction client eksternal. Dipakai auto-posting kas
 * supaya CashTransaction dan jurnalnya dibuat dalam SATU transaksi database --
 * kalau jurnal gagal, transaksi kas ikut batal (tidak ada data setengah jadi).
 */
export async function createJournalInTx(
  tx: Prisma.TransactionClient,
  input: CreateJournalInput
): Promise<JournalWithLines> {
  const lines = normalizeLines(input.lines);

  const totalDebit = lines.reduce((acc, l) => acc.plus(l.debit), new Prisma.Decimal(0));
  const totalCredit = lines.reduce((acc, l) => acc.plus(l.credit), new Prisma.Decimal(0));

  if (!totalDebit.equals(totalCredit)) {
    throw new JournalValidationError(
      `Jurnal tidak balance: total debit ${totalDebit.toFixed(2)} vs total kredit ${totalCredit.toFixed(2)}.`
    );
  }
  if (totalDebit.isZero()) {
    throw new JournalValidationError('Total jurnal tidak boleh nol.');
  }

  const shouldPost = input.status === JournalStatus.POSTED || input.postImmediately === true;

  const period = await getOrCreatePeriod(tx, input.workspaceId, input.entryDate);
  const closedButAllowed = input.allowClosedPeriod === true && period.status === PeriodStatus.CLOSED;
  if (!isPeriodWritable(period.status) && !closedButAllowed) {
    throw new PeriodClosedError(period.status);
  }

  await validateAccounts(tx, input.workspaceId, lines);
  const entryNumber = await nextEntryNumber(tx, input.workspaceId, input.entryDate);

  let entry: JournalEntry;
  try {
    entry = await tx.journalEntry.create({
      data: {
        workspaceId: input.workspaceId,
        periodId: period.id,
        entryNumber,
        entryDate: input.entryDate,
        description: input.description.trim() || 'Jurnal',
        source: input.source,
        sourceId: input.sourceId ?? null,
        status: shouldPost ? JournalStatus.POSTED : JournalStatus.DRAFT,
        totalDebit,
        totalCredit,
        createdBy: input.userId,
        postedBy: shouldPost ? input.userId : null,
        postedAt: shouldPost ? new Date() : null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new JournalValidationError(
        'Dokumen sumber ini sudah pernah dijurnal. Gunakan jurnal pembalik bila ingin mengoreksi.'
      );
    }
    throw err;
  }

  await tx.journalLine.createMany({
    data: lines.map((line, index) => ({
      workspaceId: input.workspaceId,
      entryId: entry.id,
      lineNo: index + 1,
      accountId: line.accountId,
      cashAccountId: line.cashAccountId ?? null,
      partnerId: line.partnerId ?? null,
      description: line.description ?? null,
      debit: line.debit,
      credit: line.credit,
      currency: line.currency,
      exchangeRate: line.exchangeRate,
      costCenter: line.costCenter ?? null,
    })),
  });

  const createdLines = await tx.journalLine.findMany({
    where: { entryId: entry.id },
    orderBy: { lineNo: 'asc' },
  });

  return { ...entry, lines: createdLines };
}

/** Posting jurnal draft. Hanya ADMIN/OWNER yang boleh memanggil (dicek di route). */
export async function postJournal(
  workspaceId: string,
  entryId: string,
  userId: string
): Promise<JournalWithLines> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findFirst({
      where: { id: entryId, workspaceId },
      include: { lines: { orderBy: { lineNo: 'asc' } }, period: true },
    });

    if (!entry) throw new JournalValidationError('Jurnal tidak ditemukan.');
    if (entry.status === JournalStatus.POSTED) {
      throw new JournalValidationError('Jurnal ini sudah diposting.');
    }
    if (!isPeriodWritable(entry.period.status)) {
      throw new PeriodClosedError(entry.period.status);
    }
    if (!entry.totalDebit.equals(entry.totalCredit)) {
      throw new JournalValidationError('Jurnal tidak balance dan tidak bisa diposting.');
    }

    const updated = await tx.journalEntry.update({
      where: { id: entry.id },
      data: { status: JournalStatus.POSTED, postedBy: userId, postedAt: new Date() },
    });

    return { ...updated, lines: entry.lines };
  });
}

/**
 * Buat jurnal pembalik untuk jurnal yang sudah posted.
 * Jurnal asli TIDAK dihapus/diedit -- hanya ditandai reversedBy.
 */
export async function reverseJournal(
  workspaceId: string,
  entryId: string,
  userId: string,
  reason: string
): Promise<JournalWithLines> {
  return prisma.$transaction((tx) => reverseJournalInTx(tx, workspaceId, entryId, userId, reason));
}

/**
 * Versi yang menerima transaction client eksternal, dipakai ketika pembalikan
 * harus terjadi bersamaan dengan aksi lain (mis. menghapus transaksi kas).
 */
export async function reverseJournalInTx(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  entryId: string,
  userId: string,
  reason: string
): Promise<JournalWithLines> {
  const original = await tx.journalEntry.findFirst({
    where: { id: entryId, workspaceId },
    include: { lines: { orderBy: { lineNo: 'asc' } }, period: true },
  });

  if (!original) throw new JournalValidationError('Jurnal tidak ditemukan.');
  if (original.status !== JournalStatus.POSTED) {
    throw new JournalValidationError('Hanya jurnal yang sudah diposting yang bisa dibalik.');
  }
  if (original.reversedBy) {
    throw new JournalValidationError('Jurnal ini sudah pernah dibalik.');
  }

  // Tanggal pembalik: pakai hari ini, TETAPI tidak boleh lebih awal dari
  // jurnal aslinya. Jurnal asli bisa bertanggal masa depan (mis. jurnal
  // penyesuaian akhir bulan yang dibuat lebih dulu); tanpa penjagaan ini
  // pembaliknya akan mendarat di periode SEBELUM jurnal asli dan laporan
  // bulanan jadi menyesatkan.
  const now = new Date();
  const reversalDate = now.getTime() < original.entryDate.getTime() ? original.entryDate : now;
  const period = await getOrCreatePeriod(tx, workspaceId, reversalDate);
  if (!isPeriodWritable(period.status)) throw new PeriodClosedError(period.status);

  const entryNumber = await nextEntryNumber(tx, workspaceId, reversalDate);

  const reversal = await tx.journalEntry.create({
    data: {
      workspaceId,
      periodId: period.id,
      entryNumber,
      entryDate: reversalDate,
      description: `Pembalik ${original.entryNumber}: ${reason.trim() || 'koreksi'}`,
      source: JournalSource.REVERSAL,
      sourceId: original.id,
      status: JournalStatus.POSTED,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      createdBy: userId,
      postedBy: userId,
      postedAt: now,
      reversalOfId: original.id,
    },
  });

  await tx.journalLine.createMany({
    data: original.lines.map((line, index) => ({
      workspaceId,
      entryId: reversal.id,
      lineNo: index + 1,
      accountId: line.accountId,
      cashAccountId: line.cashAccountId,
      partnerId: line.partnerId,
      description: line.description,
      debit: line.credit,
      credit: line.debit,
      currency: line.currency,
      exchangeRate: line.exchangeRate,
      costCenter: line.costCenter,
    })),
  });

  await tx.journalEntry.update({
    where: { id: original.id },
    data: { reversedBy: reversal.id },
  });

  const lines = await tx.journalLine.findMany({
    where: { entryId: reversal.id },
    orderBy: { lineNo: 'asc' },
  });

  return { ...reversal, lines };
}

/** Hapus jurnal draft. Jurnal posted tidak boleh dihapus. */
export async function deleteDraftJournal(workspaceId: string, entryId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findFirst({
      where: { id: entryId, workspaceId },
      select: { id: true, status: true },
    });
    if (!entry) throw new JournalValidationError('Jurnal tidak ditemukan.');
    if (entry.status !== JournalStatus.DRAFT) {
      throw new JournalValidationError('Jurnal yang sudah diposting tidak bisa dihapus. Gunakan jurnal pembalik.');
    }
    await tx.journalEntry.delete({ where: { id: entry.id } });
  });
}

/**
 * Cari jurnal posted milik sebuah dokumen sumber (mis. faktur atau transaksi kas).
 * Mengembalikan null bila belum pernah dijurnal atau jurnalnya sudah dibalik.
 */
export async function findActiveJournalBySourceInTx(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  source: JournalSource,
  sourceId: string
): Promise<{ id: string; entryNumber: string } | null> {
  return tx.journalEntry.findFirst({
    where: { workspaceId, source, sourceId, status: JournalStatus.POSTED, reversedBy: null },
    select: { id: true, entryNumber: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Balik jurnal milik sebuah dokumen sumber. Dipakai saat dokumennya dibatalkan
 * (mis. faktur di-CANCEL): jurnal aslinya tidak dihapus, cukup dibalik supaya
 * jejak auditnya tetap ada.
 *
 * Mengembalikan null bila tidak ada jurnal aktif untuk dibalik -- bukan error,
 * karena modul akuntansi bisa saja baru diaktifkan setelah dokumen dibuat.
 */
export async function reverseJournalBySourceInTx(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  userId: string,
  source: JournalSource,
  sourceId: string,
  reason: string
): Promise<{ id: string; entryNumber: string } | null> {
  const target = await findActiveJournalBySourceInTx(tx, workspaceId, source, sourceId);
  if (!target) return null;

  const reversal = await reverseJournalInTx(tx, workspaceId, target.id, userId, reason);
  return { id: reversal.id, entryNumber: reversal.entryNumber };
}

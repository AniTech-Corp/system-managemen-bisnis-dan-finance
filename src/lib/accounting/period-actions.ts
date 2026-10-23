import { AccountType, JournalSource, JournalStatus, PeriodStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { createJournalInTx, JournalValidationError } from './journal-service';
import { fiscalYearRange, jakartaEndOfMonth } from './period';
import { recordAudit } from '@/lib/audit/audit-trail';

export interface PeriodActionResult {
  id: string;
  year: number;
  month: number;
  status: PeriodStatus;
}

async function getPeriod(workspaceId: string, periodId: string) {
  const period = await prisma.fiscalPeriod.findFirst({ where: { id: periodId, workspaceId } });
  if (!period) throw new JournalValidationError('Periode tidak ditemukan.');
  return period;
}

/** Tutup buku bulanan. Menolak bila masih ada jurnal draft menggantung. */
export async function closePeriod(workspaceId: string, periodId: string, userId: string): Promise<PeriodActionResult> {
  const period = await getPeriod(workspaceId, periodId);

  if (period.status === PeriodStatus.CLOSED || period.status === PeriodStatus.LOCKED) {
    throw new JournalValidationError('Periode ini sudah ditutup.');
  }

  const draftCount = await prisma.journalEntry.count({
    where: { workspaceId, periodId, status: JournalStatus.DRAFT },
  });
  if (draftCount > 0) {
    throw new JournalValidationError(
      `Masih ada ${draftCount} jurnal draft di periode ini. Posting atau hapus semuanya sebelum menutup buku.`
    );
  }

  const updated = await prisma.fiscalPeriod.update({
    where: { id: period.id },
    data: { status: PeriodStatus.CLOSED, closedAt: new Date(), closedBy: userId },
  });

  await prisma.activityEvent.create({
    data: {
      workspaceId,
      userId,
      type: 'ACCOUNTING_PERIOD_CLOSED',
      payload: { periodId: period.id, year: period.year, month: period.month },
    },
  });

  await recordAudit({
    workspaceId,
    userId,
    action: 'CLOSE',
    entityType: 'PERIOD',
    entityId: period.id,
    before: { status: period.status, year: period.year, month: period.month },
    after: { status: updated.status, year: updated.year, month: updated.month },
    metadata: { periodId: period.id },
  });

  return { id: updated.id, year: updated.year, month: updated.month, status: updated.status };
}

/* ───────────────────────── TUTUP TAHUN BUKU ───────────────────────── */

export interface FiscalYearCloseResult {
  periodId: string;
  year: number;
  journalId: string;
  entryNumber: string;
  /** Laba (positif) atau rugi (negatif) tahun buku, sudah 2 desimal. */
  profit: string;
  retainedEarningsAccount: { id: string; code: string; name: string };
  lineCount: number;
  revenueClosed: string;
  expenseClosed: string;
}

/**
 * Jurnal penutup tahun buku.
 *
 * Memindahkan seluruh saldo akun pendapatan & beban sepanjang tahun buku ke
 * akun Saldo Laba (3-2000). Setelah ini:
 *   - akun pendapatan/beban kembali nol (siap untuk tahun berikutnya),
 *   - laba tahun berjalan berpindah menjadi bagian ekuitas,
 *   - "Laba Tahun Berjalan" di neraca menjadi 0 (karena saldonya sudah pindah),
 *   - laporan laba rugi tahun tersebut TETAP menampilkan angka penuh, karena
 *     mesin laporan sengaja mengecualikan jurnal CLOSING.
 *
 * Hanya boleh dijalankan pada bulan terakhir tahun buku, dan hanya sekali.
 */
export async function closeFiscalYear(
  workspaceId: string,
  periodId: string,
  userId: string
): Promise<FiscalYearCloseResult> {
  return prisma.$transaction(async (tx) => {
    const period = await tx.fiscalPeriod.findFirst({ where: { id: periodId, workspaceId } });
    if (!period) throw new JournalValidationError('Periode tidak ditemukan.');
    if (period.status === PeriodStatus.LOCKED) {
      throw new JournalValidationError(
        'Periode ini terkunci. Buka kembali dulu sebelum menutup tahun buku.'
      );
    }

    const setting = await tx.accountingSetting.findUnique({ where: { workspaceId } });
    if (!setting?.isEnabled) {
      throw new JournalValidationError('Modul laporan keuangan belum aktif.');
    }

    const startMonth = setting.fiscalYearStartMonth ?? 1;
    const endMonth = startMonth === 1 ? 12 : startMonth - 1;
    if (period.month !== endMonth) {
      throw new JournalValidationError(
        `Tutup tahun hanya bisa dijalankan pada bulan terakhir tahun buku, yaitu bulan ${endMonth}.`
      );
    }

    const range = fiscalYearRange(period.year, period.month, startMonth);

    const alreadyClosed = await tx.journalEntry.findFirst({
      where: {
        workspaceId,
        source: JournalSource.CLOSING,
        status: JournalStatus.POSTED,
        entryDate: { gte: range.startDate, lte: range.endDate },
        reversedBy: null,
      },
      select: { entryNumber: true },
    });
    if (alreadyClosed) {
      throw new JournalValidationError(
        `Tahun buku ini sudah ditutup (jurnal ${alreadyClosed.entryNumber}).`
      );
    }

    const draftCount = await tx.journalEntry.count({
      where: {
        workspaceId,
        status: JournalStatus.DRAFT,
        entryDate: { gte: range.startDate, lte: range.endDate },
      },
    });
    if (draftCount > 0) {
      throw new JournalValidationError(
        `Masih ada ${draftCount} jurnal draft di tahun buku ini. Posting atau hapus semuanya sebelum tutup tahun.`
      );
    }

    const lines = await tx.journalLine.findMany({
      where: {
        workspaceId,
        account: { type: { in: [AccountType.REVENUE, AccountType.EXPENSE] } },
        entry: {
          status: JournalStatus.POSTED,
          entryDate: { gte: range.startDate, lte: range.endDate },
          // Saldo awal bukan mutasi laba rugi, dan jurnal penutup tidak boleh
          // ikut ditutup lagi (kalau dijalankan setelah pembalikan).
          source: { notIn: [JournalSource.OPENING, JournalSource.CLOSING] },
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
        account: { select: { code: true, name: true, type: true } },
      },
    });

    const byAccount = new Map<
      string,
      {
        accountId: string;
        code: string;
        name: string;
        type: AccountType;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
      }
    >();

    for (const line of lines) {
      const existing = byAccount.get(line.accountId) ?? {
        accountId: line.accountId,
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      existing.debit = existing.debit.plus(line.debit);
      existing.credit = existing.credit.plus(line.credit);
      byAccount.set(line.accountId, existing);
    }

    const retained = setting.retainedEarningsAccountId
      ? await tx.account.findFirst({
          where: { id: setting.retainedEarningsAccountId, workspaceId },
          select: { id: true, code: true, name: true },
        })
      : await tx.account.findFirst({
          where: { workspaceId, code: '3-2000' },
          select: { id: true, code: true, name: true },
        });
    if (!retained) {
      throw new JournalValidationError(
        'Akun Saldo Laba (3-2000) tidak ditemukan di bagan akun. Periksa Pengaturan → Bagan Akun.'
      );
    }

    const closingLines: Array<{
      accountId: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      description: string;
    }> = [];

    let totalRevenue = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    for (const acc of byAccount.values()) {
      if (acc.type === AccountType.REVENUE) {
        // Pendapatan bersaldo kredit; untuk menolkan saldonya ia harus DIDEBIIT.
        const amount = acc.credit.minus(acc.debit);
        if (amount.isZero()) continue;
        totalRevenue = totalRevenue.plus(amount);
        closingLines.push(
          amount.greaterThan(0)
            ? { accountId: acc.accountId, debit: amount, credit: new Prisma.Decimal(0), description: `Menutup pendapatan ${acc.code}` }
            : { accountId: acc.accountId, debit: new Prisma.Decimal(0), credit: amount.abs(), description: `Menutup pendapatan ${acc.code}` }
        );
      } else {
        // Beban bersaldo debit; untuk menolkan saldonya ia harus DIKREDIT.
        const amount = acc.debit.minus(acc.credit);
        if (amount.isZero()) continue;
        totalExpense = totalExpense.plus(amount);
        closingLines.push(
          amount.greaterThan(0)
            ? { accountId: acc.accountId, debit: new Prisma.Decimal(0), credit: amount, description: `Menutup beban ${acc.code}` }
            : { accountId: acc.accountId, debit: amount.abs(), credit: new Prisma.Decimal(0), description: `Menutup beban ${acc.code}` }
        );
      }
    }

    const profit = totalRevenue.minus(totalExpense);

    if (closingLines.length === 0) {
      throw new JournalValidationError(
        'Tidak ada saldo pendapatan atau beban pada tahun buku ini, jadi tidak ada yang perlu ditutup.'
      );
    }

    if (profit.greaterThan(0)) {
      closingLines.push({
        accountId: retained.id,
        debit: new Prisma.Decimal(0),
        credit: profit,
        description: 'Laba tahun berjalan dipindah ke Saldo Laba',
      });
    } else if (profit.lessThan(0)) {
      closingLines.push({
        accountId: retained.id,
        debit: profit.abs(),
        credit: new Prisma.Decimal(0),
        description: 'Rugi tahun berjalan dipindah ke Saldo Laba',
      });
    }

    const journal = await createJournalInTx(tx, {
      workspaceId,
      userId,
      entryDate: jakartaEndOfMonth(period.year, period.month),
      description: `Jurnal penutup tahun buku ${period.year}`,
      source: JournalSource.CLOSING,
      lines: closingLines,
      postImmediately: true,
      // Bulan terakhir biasanya sudah ditutup bulanan sebelum tutup tahun.
      allowClosedPeriod: true,
    });

    await tx.fiscalPeriod.update({
      where: { id: period.id },
      data: { status: PeriodStatus.CLOSED, closedAt: new Date(), closedBy: userId },
    });

    await tx.activityEvent.create({
      data: {
        workspaceId,
        userId,
        type: 'ACCOUNTING_FISCAL_YEAR_CLOSED',
        payload: {
          periodId: period.id,
          year: period.year,
          journalId: journal.id,
          entryNumber: journal.entryNumber,
          profit: profit.toFixed(2),
        },
      },
    });

    return {
      periodId: period.id,
      year: period.year,
      journalId: journal.id,
      entryNumber: journal.entryNumber,
      profit: profit.toFixed(2),
      retainedEarningsAccount: retained,
      lineCount: closingLines.length,
      revenueClosed: totalRevenue.toFixed(2),
      expenseClosed: totalExpense.toFixed(2),
    };
  });
}

/** Kunci periode. Hanya OWNER (dicek di route). */
export async function lockPeriod(workspaceId: string, periodId: string, userId: string): Promise<PeriodActionResult> {
  const period = await getPeriod(workspaceId, periodId);

  if (period.status === PeriodStatus.LOCKED) {
    throw new JournalValidationError('Periode ini sudah terkunci.');
  }

  const updated = await prisma.fiscalPeriod.update({
    where: { id: period.id },
    data: { status: PeriodStatus.LOCKED, lockedAt: new Date(), lockedBy: userId },
  });

  await prisma.activityEvent.create({
    data: {
      workspaceId,
      userId,
      type: 'ACCOUNTING_PERIOD_LOCKED',
      payload: { periodId: period.id, year: period.year, month: period.month },
    },
  });

  await recordAudit({
    workspaceId,
    userId,
    action: 'LOCK',
    entityType: 'PERIOD',
    entityId: period.id,
    before: { status: period.status, year: period.year, month: period.month },
    after: { status: updated.status, year: updated.year, month: updated.month },
  });

  return { id: updated.id, year: updated.year, month: updated.month, status: updated.status };
}

/** Buka kembali periode terkunci. Wajib menyertakan alasan; dicatat di activity log. */
export async function reopenPeriod(
  workspaceId: string,
  periodId: string,
  userId: string,
  reason: string
): Promise<PeriodActionResult> {
  const period = await getPeriod(workspaceId, periodId);

  if (period.status === PeriodStatus.OPEN) {
    throw new JournalValidationError('Periode ini sudah terbuka.');
  }
  if (!reason.trim()) {
    throw new JournalValidationError('Alasan membuka kembali periode wajib diisi.');
  }

  const updated = await prisma.fiscalPeriod.update({
    where: { id: period.id },
    data: { status: PeriodStatus.OPEN, closedAt: null, closedBy: null, lockedAt: null, lockedBy: null },
  });

  await prisma.activityEvent.create({
    data: {
      workspaceId,
      userId,
      type: 'ACCOUNTING_PERIOD_REOPENED',
      payload: { periodId: period.id, year: period.year, month: period.month, reason: reason.trim() },
    },
  });

  await recordAudit({
    workspaceId,
    userId,
    action: 'REOPEN',
    entityType: 'PERIOD',
    entityId: period.id,
    before: { status: period.status, year: period.year, month: period.month },
    after: { status: updated.status, year: updated.year, month: updated.month },
    reason: reason.trim(),
  });

  return { id: updated.id, year: updated.year, month: updated.month, status: updated.status };
}

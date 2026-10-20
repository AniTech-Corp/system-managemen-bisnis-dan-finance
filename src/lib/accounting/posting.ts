import {
  AccountType,
  CashAccountType,
  JournalSource,
  Prisma,
  TransactionType,
  type Account,
  type CashAccount,
  type CashTransaction,
  type EmployeePayroll,
  type Invoice,
  type ScheduledObligation,
} from '@prisma/client';
import {
  createJournalInTx,
  JournalValidationError,
  type JournalLineInput,
  type JournalWithLines,
} from './journal-service';
import { toMoney } from './money';

/**
 * Auto-posting transaksi kas ke jurnal double-entry.
 *
 * Dipanggil dari dalam transaksi database yang sama dengan pembuatan
 * CashTransaction, sehingga tidak mungkin ada transaksi kas tanpa jurnalnya
 * (saat modul akuntansi aktif).
 */

export interface PostingContext {
  workspaceId: string;
  userId: string;
  transaction: Pick<
    CashTransaction,
    | 'id'
    | 'type'
    | 'category'
    | 'amount'
    | 'description'
    | 'paymentMethod'
    | 'transactionDate'
    | 'invoiceId'
    | 'obligationId'
    | 'payrollId'
  >;
}

export async function getAccountingSetting(tx: Prisma.TransactionClient, workspaceId: string) {
  return tx.accountingSetting.findUnique({ where: { workspaceId } });
}

function cashAccountTypeForPaymentMethod(paymentMethod: string | null | undefined): CashAccountType | null {
  const normalized = (paymentMethod || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized.includes('CASH') || normalized.includes('TUNAI') || normalized.includes('KAS')) {
    return CashAccountType.CASH;
  }
  if (normalized.includes('BANK') || normalized.includes('TRANSFER')) {
    return CashAccountType.BANK;
  }
  return null;
}

/**
 * Pilih rekening kas/bank yang dipakai transaksi.
 *
 * Urutan pencocokan -- yang paling spesifik menang:
 *   1. Nama/kode rekening yang disebut di `paymentMethod` (mis. "Kas Kecil" → rekening KAS-01)
 *   2. Tipe rekening dari kata kunci (TUNAI/KAS → CASH, TRANSFER/BANK → BANK)
 *   3. Rekening default dari pengaturan
 *   4. Rekening aktif pertama
 *
 * Rekening default sengaja ditaruh SETELAH pencocokan nama/kata kunci. Sebelumnya
 * default menang lebih dulu, sehingga memilih "Kas Kecil" di form tetap dijurnal
 * ke rekening bank default -- dan laporan arus kas per rekening jadi salah.
 */
export async function resolveCashAccount(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  paymentMethod: string | null | undefined
): Promise<CashAccount & { account: Account }> {
  const setting = await getAccountingSetting(tx, workspaceId);
  const method = (paymentMethod || '').trim();
  const normalized = method.toUpperCase();

  const active = await tx.cashAccount.findMany({
    where: { workspaceId, isActive: true },
    orderBy: { code: 'asc' },
    include: { account: true },
  });

  if (active.length === 0) {
    throw new JournalValidationError(
      'Belum ada rekening kas/bank aktif. Tambahkan rekening terlebih dahulu di Laporan Keuangan → Pengaturan.'
    );
  }

  const byLabel = method
    ? active.find((c) => {
        const name = c.name.toUpperCase();
        const code = c.code.toUpperCase();
        const bank = (c.bankName || '').toUpperCase();
        return (
          name === normalized ||
          code === normalized ||
          normalized === bank ||
          (normalized.length >= 3 && (name.includes(normalized) || normalized.includes(name)))
        );
      })
    : undefined;
  if (byLabel) return byLabel;

  const type = cashAccountTypeForPaymentMethod(method);
  if (type) {
    const byType = active.find((c) => c.type === type);
    if (byType) return byType;
  }

  if (setting?.defaultCashAccountId) {
    const preferred = active.find((c) => c.id === setting.defaultCashAccountId);
    if (preferred) return preferred;
  }

  return active[0];
}

/** Cari akun tujuan untuk sebuah kategori transaksi kas. */
export async function resolveCategoryAccount(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  category: string,
  transactionType: TransactionType
): Promise<{ accountId: string }> {
  const accountType = transactionType === TransactionType.INCOME ? AccountType.REVENUE : AccountType.EXPENSE;

  const mapping = await tx.categoryAccountMap.findUnique({
    where: {
      workspaceId_category_type: { workspaceId, category: category.trim(), type: accountType },
    },
    select: { accountId: true },
  });

  if (!mapping) {
    const label = transactionType === TransactionType.INCOME ? 'pendapatan' : 'beban';
    throw new JournalValidationError(
      `Kategori "${category}" belum dipetakan ke akun ${label}. Buka Laporan Keuangan → Pengaturan Akun → Pemetaan Kategori.`
    );
  }

  return mapping;
}

/* ─────────────────── FAKTUR (PIUTANG / AR) ─────────────────── */

/**
 * Akun sistem yang dipakai penjurnalan faktur. Semuanya ada di bagan akun
 * bawaan, jadi cukup dirujuk lewat kode -- tidak perlu kolom pengaturan baru.
 */
const RECEIVABLE_ACCOUNT_CODE = '1-1300'; // Piutang Usaha
const PAYABLE_ACCOUNT_CODE = '2-1100'; // Utang Usaha
const PPN_OUTPUT_ACCOUNT_CODE = '2-1310'; // PPN Keluaran
const DEFAULT_REVENUE_ACCOUNT_CODE = '4-1100'; // Pendapatan Jasa
const SALARY_EXPENSE_ACCOUNT_CODE = '6-1100'; // Beban Gaji & Tunjangan
const SALARY_PAYABLE_ACCOUNT_CODE = '2-1200'; // Utang Gaji
const FALLBACK_INCOME_ACCOUNT_CODE = '4-1900'; // Pendapatan Lain-lain
const FALLBACK_EXPENSE_ACCOUNT_CODE = '6-9000'; // Beban Lain-lain

/**
 * Kategori yang dipakai modul faktur saat mencatat pelunasan sebagai transaksi
 * kas. Diekspor supaya rute faktur dan pengujian memakai nilai yang sama.
 */
export const INVOICE_SETTLEMENT_CATEGORY = 'Pelunasan Invoice Digital';

/**
 * Kategori yang dipakai saat kewajiban dibayar. Hanya label di Buku Kas --
 * jurnalnya tidak memakai pemetaan kategori karena langsung melunasi utang.
 */
export const OBLIGATION_SETTLEMENT_CATEGORY = 'Pembayaran Kewajiban';

async function resolveAccountIdByCode(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  code: string
): Promise<string> {
  const account = await tx.account.findFirst({
    where: { workspaceId, code },
    select: { id: true },
  });
  if (!account) {
    throw new JournalValidationError(
      `Akun ${code} tidak ditemukan di bagan akun. Buka Laporan Keuangan → Pengaturan untuk menyiapkan ulang bagan akun.`
    );
  }
  return account.id;
}

/**
 * Akun pendapatan untuk faktur. Faktur hanya menyimpan item (nama/harga/qty)
 * tanpa kategori akun, jadi owner memilih satu akun default di Pengaturan.
 */
async function resolveInvoiceRevenueAccountId(
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<string> {
  const setting = await getAccountingSetting(tx, workspaceId);

  if (setting?.defaultRevenueAccountId) {
    const configured = await tx.account.findFirst({
      where: { id: setting.defaultRevenueAccountId, workspaceId, isActive: true },
      select: { id: true },
    });
    if (configured) return configured.id;
  }

  const byCode = await tx.account.findFirst({
    where: { workspaceId, code: DEFAULT_REVENUE_ACCOUNT_CODE, isActive: true },
    select: { id: true },
  });
  if (byCode) return byCode.id;

  const anyRevenue = await tx.account.findFirst({
    where: { workspaceId, type: AccountType.REVENUE, isPostable: true, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true },
  });
  if (!anyRevenue) {
    throw new JournalValidationError(
      'Belum ada akun pendapatan yang aktif. Periksa bagan akun di Laporan Keuangan → Pengaturan.'
    );
  }
  return anyRevenue.id;
}

export interface InvoicePostingContext {
  workspaceId: string;
  userId: string;
  invoice: Pick<
    Invoice,
    'id' | 'invoiceNumber' | 'clientName' | 'subtotal' | 'taxAmount' | 'totalAmount' | 'issueDate'
  >;
}

/**
 * Jurnal saat faktur DITERBITKAN (basis akrual):
 *
 *   Dr  Piutang Usaha      sebesar total faktur
 *   Cr  Pendapatan         sebesar subtotal
 *   Cr  PPN Keluaran       sebesar pajak   (hanya bila profil pajak PKP)
 *
 * Inilah yang membuat laba diakui saat jasa diserahkan, bukan saat uang masuk.
 * Saat faktur dilunasi, jurnal pelunasan hanya memindahkan piutang menjadi kas
 * (lihat postCashTransaction dengan `invoiceId`) sehingga pendapatan tidak
 * terhitung dua kali.
 */
export async function postInvoiceIssuedInTx(
  tx: Prisma.TransactionClient,
  ctx: InvoicePostingContext
): Promise<JournalWithLines | null> {
  const setting = await getAccountingSetting(tx, ctx.workspaceId);
  if (!setting?.isEnabled) return null;

  const { invoice } = ctx;
  const receivableId = await resolveAccountIdByCode(tx, ctx.workspaceId, RECEIVABLE_ACCOUNT_CODE);
  const revenueId = await resolveInvoiceRevenueAccountId(tx, ctx.workspaceId);

  const subtotal = toMoney(invoice.subtotal);
  const taxAmount = toMoney(invoice.taxAmount);
  const total = toMoney(invoice.totalAmount);

  // PPN hanya dipisahkan kalau workspace terdaftar PKP. Untuk non-PKP, seluruh
  // nilai faktur diakui sebagai pendapatan supaya totalnya tetap sama dengan
  // nilai yang ditagih ke klien.
  const ppnAccountId =
    setting.enablePpn && taxAmount.greaterThan(0)
      ? await resolveAccountIdByCode(tx, ctx.workspaceId, PPN_OUTPUT_ACCOUNT_CODE)
      : null;

  const lines: JournalLineInput[] = [
    {
      accountId: receivableId,
      debit: total,
      credit: 0,
      description: `Piutang faktur ${invoice.invoiceNumber}`,
    },
  ];

  if (ppnAccountId && subtotal.greaterThan(0)) {
    lines.push({
      accountId: revenueId,
      debit: 0,
      credit: subtotal,
      description: `Pendapatan faktur ${invoice.invoiceNumber}`,
    });
    lines.push({
      accountId: ppnAccountId,
      debit: 0,
      credit: taxAmount,
      description: `PPN keluaran faktur ${invoice.invoiceNumber}`,
    });
  } else {
    lines.push({
      accountId: revenueId,
      debit: 0,
      credit: total,
      description: `Pendapatan faktur ${invoice.invoiceNumber}`,
    });
  }

  return createJournalInTx(tx, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    entryDate: invoice.issueDate,
    description: `Faktur ${invoice.invoiceNumber} — ${invoice.clientName}`,
    source: JournalSource.INVOICE,
    sourceId: invoice.id,
    lines,
    postImmediately: true,
  });
}

/**
 * Jurnal saat KEWAJIBAN dicatat (basis akrual):
 *
 *   Dr  Beban (sesuai kategori)   sebesar nilai kewajiban
 *   Cr  Utang Usaha (2-1100)
 *
 * Beban diakui sekarang, walau uangnya baru keluar nanti. Saat kewajiban
 * dibayar, jurnalnya hanya memindahkan utang menjadi kas (lihat
 * postCashTransaction dengan `obligationId`), sehingga beban tidak dihitung dua
 * kali.
 */
export async function postObligationIssuedInTx(
  tx: Prisma.TransactionClient,
  ctx: {
    workspaceId: string;
    userId: string;
    obligation: Pick<ScheduledObligation, 'id' | 'name' | 'amount' | 'category' | 'createdAt'>;
    /** Tanggal pengakuan beban. Default: saat kewajiban dicatat. */
    entryDate?: Date;
  }
): Promise<JournalWithLines | null> {
  const setting = await getAccountingSetting(tx, ctx.workspaceId);
  if (!setting?.isEnabled) return null;

  const { obligation } = ctx;
  const category = (obligation.category ?? '').trim();
  if (!category) {
    throw new JournalValidationError(
      'Kewajiban ini belum punya kategori beban. Isi kategorinya supaya bisa dijurnal otomatis.'
    );
  }

  const target = await resolveCategoryAccount(tx, ctx.workspaceId, category, TransactionType.EXPENSE);
  const payableId = await resolveAccountIdByCode(tx, ctx.workspaceId, PAYABLE_ACCOUNT_CODE);
  const amount = toMoney(obligation.amount);

  return createJournalInTx(tx, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    // Tanggal pencatatan kewajiban. Jatuh tempo bisa di masa depan; jurnal
    // bertanggal masa depan membuat periode yang belum terjadi ikut terisi.
    entryDate: ctx.entryDate ?? obligation.createdAt,
    description: `Kewajiban ${obligation.name}`,
    source: JournalSource.OBLIGATION,
    sourceId: obligation.id,
    lines: [
      {
        accountId: target.accountId,
        debit: amount,
        credit: 0,
        description: `Beban ${category}`,
      },
      {
        accountId: payableId,
        debit: 0,
        credit: amount,
        description: 'Utang usaha',
      },
    ],
    postImmediately: true,
  });
}

/**
 * Buat jurnal otomatis untuk satu transaksi kas.
 * Mengembalikan null bila modul akuntansi belum diaktifkan untuk workspace.
 */
export async function postCashTransaction(
  tx: Prisma.TransactionClient,
  ctx: PostingContext
): Promise<JournalWithLines | null> {
  const setting = await getAccountingSetting(tx, ctx.workspaceId);
  if (!setting?.isEnabled) return null;

  const { transaction } = ctx;
  const cashAccount = await resolveCashAccount(tx, ctx.workspaceId, transaction.paymentMethod);
  const amount = toMoney(transaction.amount);

  // Pelunasan faktur: uang masuk TIDAK menambah pendapatan lagi, tetapi
  // mengurangi piutang yang sudah diakui saat faktur diterbitkan.
  if (transaction.invoiceId && transaction.type === TransactionType.INCOME) {
    const receivableId = await resolveAccountIdByCode(tx, ctx.workspaceId, RECEIVABLE_ACCOUNT_CODE);
    return createJournalInTx(tx, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      entryDate: transaction.transactionDate,
      description: transaction.description || `Pelunasan faktur`,
      source: JournalSource.CASH_TX,
      sourceId: transaction.id,
      lines: [
        { accountId: cashAccount.account.id, cashAccountId: cashAccount.id, debit: amount, credit: 0 },
        { accountId: receivableId, debit: 0, credit: amount },
      ],
      postImmediately: true,
    });
  }

  // Pembayaran kewajiban: uang keluar TIDAK menambah beban lagi, tetapi
  // melunasi utang yang sudah diakui saat kewajiban dicatat.
  if (transaction.obligationId && transaction.type === TransactionType.EXPENSE) {
    const payableId = await resolveAccountIdByCode(tx, ctx.workspaceId, PAYABLE_ACCOUNT_CODE);
    return createJournalInTx(tx, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      entryDate: transaction.transactionDate,
      description: transaction.description || 'Pembayaran kewajiban',
      source: JournalSource.CASH_TX,
      sourceId: transaction.id,
      lines: [
        { accountId: payableId, debit: amount, credit: 0 },
        { accountId: cashAccount.account.id, cashAccountId: cashAccount.id, debit: 0, credit: amount },
      ],
      postImmediately: true,
    });
  }

  // Pembayaran gaji: uang keluar melunasi UTANG GAJI yang sudah diakui saat
  // slip gaji dibuat, bukan menambah beban gaji lagi.
  if (transaction.payrollId && transaction.type === TransactionType.EXPENSE) {
    const payableId = await resolveAccountIdByCode(tx, ctx.workspaceId, SALARY_PAYABLE_ACCOUNT_CODE);
    return createJournalInTx(tx, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      entryDate: transaction.transactionDate,
      description: transaction.description || 'Pembayaran gaji',
      source: JournalSource.CASH_TX,
      sourceId: transaction.id,
      lines: [
        { accountId: payableId, debit: amount, credit: 0 },
        { accountId: cashAccount.account.id, cashAccountId: cashAccount.id, debit: 0, credit: amount },
      ],
      postImmediately: true,
    });
  }

  const target = await resolveCategoryAccount(
    tx,
    ctx.workspaceId,
    transaction.category,
    transaction.type
  );

  const lines =
    transaction.type === TransactionType.INCOME
      ? [
          // Uang masuk: Kas bertambah (debit), Pendapatan bertambah (kredit)
          { accountId: cashAccount.account.id, cashAccountId: cashAccount.id, debit: amount, credit: 0 },
          { accountId: target.accountId, debit: 0, credit: amount },
        ]
      : [
          // Uang keluar: Beban bertambah (debit), Kas berkurang (kredit)
          { accountId: target.accountId, debit: amount, credit: 0 },
          { accountId: cashAccount.account.id, cashAccountId: cashAccount.id, debit: 0, credit: amount },
        ];

  return createJournalInTx(tx, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    entryDate: transaction.transactionDate,
    description: transaction.description || transaction.category,
    source: JournalSource.CASH_TX,
    sourceId: transaction.id,
    lines,
    postImmediately: true,
  });
}

/* ─────────────────── GAJI (PAYROLL) ─────────────────── */

/**
 * Jurnal saat slip gaji dibuat (basis akrual):
 *
 *   Dr  Beban Gaji & Tunjangan (6-1100)
 *       Cr  Utang Gaji (2-1200)
 *
 * Pembayaran gaji nanti hanya memindahkan utang menjadi kas, jadi beban tidak
 * dihitung dua kali.
 *
 * Catatan v1: `deductions` pada slip dianggap sudah disetor di luar sistem, jadi
 * yang diakui adalah `netSalary` (jumlah yang benar-benar dibayarkan).
 */
export async function postPayrollAccruedInTx(
  tx: Prisma.TransactionClient,
  ctx: {
    workspaceId: string;
    userId: string;
    payroll: Pick<EmployeePayroll, 'id' | 'employeeName' | 'netSalary' | 'monthYear' | 'createdAt'>;
    /** Tanggal pengakuan beban. Default: saat slip dibuat. */
    entryDate?: Date;
  }
): Promise<JournalWithLines | null> {
  const setting = await getAccountingSetting(tx, ctx.workspaceId);
  if (!setting?.isEnabled) return null;

  const amount = toMoney(ctx.payroll.netSalary);
  const expenseId = await resolveAccountIdByCode(tx, ctx.workspaceId, SALARY_EXPENSE_ACCOUNT_CODE);
  const payableId = await resolveAccountIdByCode(tx, ctx.workspaceId, SALARY_PAYABLE_ACCOUNT_CODE);

  return createJournalInTx(tx, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    entryDate: ctx.entryDate ?? ctx.payroll.createdAt,
    description: `Gaji ${ctx.payroll.employeeName} — ${ctx.payroll.monthYear}`,
    source: JournalSource.PAYROLL,
    sourceId: ctx.payroll.id,
    lines: [
      { accountId: expenseId, debit: amount, credit: 0, description: 'Beban gaji' },
      { accountId: payableId, debit: 0, credit: amount, description: 'Utang gaji' },
    ],
    postImmediately: true,
  });
}

/* ─────────────────── PINTU TUNGGAL TRANSAKSI KAS ─────────────────── */

/**
 * Cari user yang dipakai sebagai pembuat jurnal. Modul otomatis (workflow, AI)
 * kadang tidak punya user; jurnal tetap harus punya `createdBy` yang valid.
 */
async function resolveJournalUserId(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  preferred?: string | null
): Promise<string> {
  if (preferred) return preferred;

  const owner = await tx.workspaceMember.findFirst({
    where: { workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
    orderBy: { joinedAt: 'asc' },
  });
  if (owner?.userId) return owner.userId;

  const anyMember = await tx.workspaceMember.findFirst({
    where: { workspaceId },
    select: { userId: true },
  });
  if (anyMember?.userId) return anyMember.userId;

  throw new JournalValidationError('Tidak ada pengguna workspace untuk mencatat jurnal.');
}

/**
 * **Pintu tunggal** pencatatan uang keluar/masuk di luar form Buku Kas.
 *
 * Semua modul (payroll, inventori, booking, workflow, AI) WAJIB memakai fungsi
 * ini supaya setiap baris `cash_transactions` punya jurnal. Kalau tidak, angka
 * Buku Kas dan Laporan Keuangan akan berbeda.
 *
 * `autoMapFallback`: kategori yang belum dipetakan otomatis dipetakan ke akun
 * "lain-lain" (4-1900 / 6-9000) dan pemetaannya disimpan, sehingga muncul di
 * layar Pemetaan Kategori untuk dibetulkan. Tanpa opsi ini, kategori yang belum
 * dipetakan tetap ditolak (perilaku form manual).
 */
/**
 * Pastikan sebuah kategori punya pemetaan akun. Kalau belum ada, buat pemetaan
 * ke akun cadangan (`fallbackAccountCode`) supaya transaksi otomatis tidak
 * gagal saat modul akuntansi aktif. Pemetaan yang dibuat bisa dibetulkan owner
 * di layar Pemetaan Kategori.
 *
 * Mengembalikan `created: false` bila modul akuntansi belum aktif (tidak perlu
 * mengotori pemetaan).
 */
export async function ensureCategoryMappingInTx(
  tx: Prisma.TransactionClient,
  ctx: {
    workspaceId: string;
    category: string;
    type: AccountType;
    fallbackAccountCode: string;
  }
): Promise<{ created: boolean; warning?: string }> {
  const category = ctx.category.trim().slice(0, 100);
  if (!category) return { created: false };

  const setting = await getAccountingSetting(tx, ctx.workspaceId);
  if (!setting?.isEnabled) return { created: false };

  const existing = await tx.categoryAccountMap.findUnique({
    where: {
      workspaceId_category_type: { workspaceId: ctx.workspaceId, category, type: ctx.type },
    },
    select: { id: true },
  });
  if (existing) return { created: false };

  const accountId = await resolveAccountIdByCode(tx, ctx.workspaceId, ctx.fallbackAccountCode);
  await tx.categoryAccountMap.create({
    data: { workspaceId: ctx.workspaceId, category, type: ctx.type, accountId },
  });

  return {
    created: true,
    warning: `Kategori "${category}" belum dipetakan; sementara dicatat ke ${ctx.fallbackAccountCode}. Lengkapi di Pengaturan → Pemetaan Kategori.`,
  };
}

export async function recordCashTransaction(
  tx: Prisma.TransactionClient,
  ctx: {
    workspaceId: string;
    userId?: string | null;
    type: TransactionType;
    category: string;
    amount: number | Prisma.Decimal;
    description: string;
    paymentMethod?: string;
    transactionDate?: Date;
    invoiceId?: string | null;
    obligationId?: string | null;
    payrollId?: string | null;
    autoMapFallback?: boolean;
  }
): Promise<{ transaction: CashTransaction; journal: JournalWithLines | null; warning?: string }> {
  const category = ctx.category.trim().slice(0, 100);
  let warning: string | undefined;

  if (ctx.autoMapFallback) {
    const accountType = ctx.type === TransactionType.INCOME ? AccountType.REVENUE : AccountType.EXPENSE;
    const mapped = await ensureCategoryMappingInTx(tx, {
      workspaceId: ctx.workspaceId,
      category,
      type: accountType,
      fallbackAccountCode:
        accountType === AccountType.REVENUE ? FALLBACK_INCOME_ACCOUNT_CODE : FALLBACK_EXPENSE_ACCOUNT_CODE,
    });
    warning = mapped.warning;
  }

  const created = await tx.cashTransaction.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId ?? null,
      type: ctx.type,
      category,
      amount: Number(ctx.amount),
      description: ctx.description,
      paymentMethod: ctx.paymentMethod ?? 'TRANSFER_BANK',
      transactionDate: ctx.transactionDate ?? new Date(),
      invoiceId: ctx.invoiceId ?? null,
      obligationId: ctx.obligationId ?? null,
      payrollId: ctx.payrollId ?? null,
    },
  });

  const journalUserId = await resolveJournalUserId(tx, ctx.workspaceId, ctx.userId);
  const journal = await postCashTransaction(tx, {
    workspaceId: ctx.workspaceId,
    userId: journalUserId,
    transaction: created,
  });

  return { transaction: created, journal, warning };
}

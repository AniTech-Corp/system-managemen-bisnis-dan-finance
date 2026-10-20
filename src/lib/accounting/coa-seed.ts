import {
  AccountType,
  CashAccountType,
  NormalBalance,
  Prisma,
  TaxProfile,
  type Account,
} from '@prisma/client';

/**
 * Template bagan akun (Chart of Accounts) standar Indonesia yang disederhanakan
 * untuk UMKM. Kode memakai format `X-XXXX` supaya mudah dibaca owner:
 *
 *   1-xxxx  Aset
 *   2-xxxx  Liabilitas
 *   3-xxxx  Ekuitas
 *   4-xxxx  Pendapatan
 *   5-xxxx  Harga Pokok Penjualan
 *   6-xxxx  Beban Operasional
 *   7-xxxx  Beban Pajak Penghasilan
 *
 * Akun bertanda `isPostable: false` adalah header (tidak boleh dipakai di jurnal).
 * Akun persediaan/HPP sengaja sudah ada tapi modulnya belum aktif, supaya saat
 * bisnis mulai menjual barang tidak perlu migrasi struktur.
 */
export interface CoaTemplateEntry {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode?: string;
  isPostable?: boolean;
  isSystem?: boolean;
  isActive?: boolean;
  description?: string;
}

/**
 * Pemetaan kategori bawaan untuk transaksi yang dibuat modul lain (payroll,
 * inventori, booking, workflow, AI). Tanpa pemetaan ini, transaksi dari modul
 * tersebut akan gagal dijurnal saat modul akuntansi aktif. Owner tetap bisa
 * mengubahnya lewat Pengaturan → Pemetaan Kategori.
 */
export const DEFAULT_CATEGORY_MAPPINGS: Array<{
  category: string;
  type: AccountType;
  accountCode: string;
}> = [
  { category: 'Gaji Staf & Honor Tim', type: AccountType.EXPENSE, accountCode: '6-1100' },
  { category: 'Beban Gaji & Upah Karyawan', type: AccountType.EXPENSE, accountCode: '6-1100' },
  { category: 'Pembelian Stok/Purchasing', type: AccountType.EXPENSE, accountCode: '5-1100' },
  // Barang titip-jual yang laku: HPP bertambah, lawannya Utang Usaha.
  { category: 'HPP Konsinyasi', type: AccountType.EXPENSE, accountCode: '5-1100' },
  { category: 'Operasional', type: AccountType.EXPENSE, accountCode: '6-9000' },
  { category: 'Penjualan Stok/Kasir', type: AccountType.REVENUE, accountCode: '4-1200' },
  { category: 'Deposit Reservasi Booking', type: AccountType.REVENUE, accountCode: '4-1100' },
  { category: 'Pelunasan Layanan Booking', type: AccountType.REVENUE, accountCode: '4-1100' },
  { category: 'Penjualan / Layanan Jasa', type: AccountType.REVENUE, accountCode: '4-1100' },
  { category: 'Pemasukan Lainnya', type: AccountType.REVENUE, accountCode: '4-1900' },
];

export const DEFAULT_COA_TEMPLATE: CoaTemplateEntry[] = [
  // ── ASET ────────────────────────────────────────────────────────────────
  { code: '1-1000', name: 'Aset Lancar', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, isPostable: false },
  { code: '1-1100', name: 'Kas', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1000', isSystem: true },
  { code: '1-1110', name: 'Kas Kecil', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1100', isSystem: true },
  { code: '1-1200', name: 'Bank', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1000', isPostable: false },
  { code: '1-1210', name: 'Bank Utama', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1200', isSystem: true },
  { code: '1-1300', name: 'Piutang Usaha', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1000', isSystem: true },
  { code: '1-1310', name: 'Piutang Lain-lain', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1000' },
  { code: '1-1400', name: 'Persediaan Barang Dagang', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1000', isSystem: true },
  { code: '1-1500', name: 'Beban Dibayar di Muka', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1000' },
  { code: '1-1600', name: 'PPN Masukan', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1000', isSystem: true },
  { code: '1-1900', name: 'Aset Lancar Lain-lain', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-1000' },

  { code: '1-2000', name: 'Aset Tetap', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, isPostable: false },
  { code: '1-2100', name: 'Peralatan', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-2000' },
  { code: '1-2200', name: 'Kendaraan', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-2000' },
  { code: '1-2300', name: 'Bangunan', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-2000' },
  { code: '1-2400', name: 'Akumulasi Penyusutan', type: AccountType.ASSET, normalBalance: NormalBalance.CREDIT, parentCode: '1-2000', isSystem: true },
  { code: '1-2900', name: 'Aset Tetap Lain-lain', type: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1-2000' },

  // ── LIABILITAS ──────────────────────────────────────────────────────────
  { code: '2-1000', name: 'Liabilitas Jangka Pendek', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, isPostable: false },
  { code: '2-1100', name: 'Utang Usaha', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1000', isSystem: true },
  { code: '2-1200', name: 'Utang Gaji', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1000', isSystem: true },
  { code: '2-1300', name: 'Utang Pajak', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1000', isSystem: true },
  { code: '2-1310', name: 'PPN Keluaran', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1300', isSystem: true },
  { code: '2-1320', name: 'PPh 21', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1300', isSystem: true },
  { code: '2-1330', name: 'PPh Final UMKM', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1300', isSystem: true },
  { code: '2-1400', name: 'Utang Bank Jangka Pendek', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1000' },
  { code: '2-1500', name: 'Beban Masih Harus Dibayar', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1000' },
  { code: '2-1900', name: 'Liabilitas Jangka Pendek Lain-lain', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-1000' },

  { code: '2-2000', name: 'Liabilitas Jangka Panjang', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, isPostable: false },
  { code: '2-2100', name: 'Utang Bank Jangka Panjang', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-2000' },
  { code: '2-2200', name: 'Utang Leasing', type: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2-2000' },

  // ── EKUITAS ─────────────────────────────────────────────────────────────
  { code: '3-1000', name: 'Modal', type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT, isPostable: false },
  { code: '3-1100', name: 'Modal Disetor', type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT, parentCode: '3-1000', isSystem: true },
  { code: '3-1200', name: 'Prive / Dividen', type: AccountType.EQUITY, normalBalance: NormalBalance.DEBIT, parentCode: '3-1000', isSystem: true },
  { code: '3-2000', name: 'Saldo Laba', type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT, isSystem: true },
  { code: '3-3000', name: 'Laba Tahun Berjalan', type: AccountType.EQUITY, normalBalance: NormalBalance.CREDIT, isSystem: true },

  // ── PENDAPATAN ──────────────────────────────────────────────────────────
  { code: '4-1000', name: 'Pendapatan Usaha', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, isPostable: false },
  { code: '4-1100', name: 'Pendapatan Jasa', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '4-1000', isSystem: true },
  { code: '4-1200', name: 'Pendapatan Penjualan Barang', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '4-1000', isSystem: true },
  { code: '4-1900', name: 'Pendapatan Lain-lain', type: AccountType.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '4-1000' },
  { code: '4-2000', name: 'Diskon & Retur Penjualan', type: AccountType.REVENUE, normalBalance: NormalBalance.DEBIT, parentCode: '4-1000' },

  // ── HARGA POKOK PENJUALAN ───────────────────────────────────────────────
  { code: '5-1000', name: 'Harga Pokok Penjualan', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, isPostable: false },
  { code: '5-1100', name: 'HPP Barang Dagang', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '5-1000', isSystem: true },
  { code: '5-1200', name: 'HPP Jasa Langsung', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '5-1000' },

  // ── BEBAN OPERASIONAL ───────────────────────────────────────────────────
  { code: '6-1000', name: 'Beban Operasional', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, isPostable: false },
  { code: '6-1100', name: 'Beban Gaji & Tunjangan', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000', isSystem: true },
  { code: '6-1200', name: 'Beban Sewa', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-1300', name: 'Beban Listrik & Air', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-1400', name: 'Beban Internet & Telepon', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-1500', name: 'Beban Transportasi & Perjalanan', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-1600', name: 'Beban Marketing & Iklan', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-1700', name: 'Beban Perlengkapan & ATK', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-1800', name: 'Beban Penyusutan', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000', isSystem: true },
  { code: '6-1900', name: 'Beban Pemeliharaan & Perbaikan', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-2000', name: 'Beban Jasa Profesional', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-2100', name: 'Beban Asuransi', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-2200', name: 'Beban Pajak & Retribusi', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },
  { code: '6-9000', name: 'Beban Lain-lain', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '6-1000' },

  // ── PAJAK PENGHASILAN ───────────────────────────────────────────────────
  { code: '7-1000', name: 'Beban Pajak Penghasilan', type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, isSystem: true },
];

export interface SetupResult {
  accountsCreated: number;
  accountsExisting: number;
  cashAccountsCreated: number;
  categoryMappingsCreated: number;
  setting: {
    booksStartDate: Date;
    taxProfile: TaxProfile;
    entityType: string;
  };
}

/**
 * Inisialisasi CoA + pengaturan + rekening kas default untuk satu workspace.
 * Idempoten: aman dipanggil ulang; akun yang sudah ada TIDAK ditimpa
 * (owner mungkin sudah mengubah nama atau menonaktifkannya).
 */
export async function seedChartOfAccounts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  options: {
    booksStartDate?: Date;
    taxProfile?: TaxProfile;
    entityType?: string;
    createDefaultCashAccounts?: boolean;
  } = {}
): Promise<SetupResult> {
  const existingBefore = await tx.account.findMany({
    where: { workspaceId },
    select: { code: true },
  });
  const existingCodes = new Set(existingBefore.map((a) => a.code));

  let created = 0;
  for (const entry of DEFAULT_COA_TEMPLATE) {
    if (existingCodes.has(entry.code)) continue;
    await tx.account.create({
      data: {
        workspaceId,
        code: entry.code,
        name: entry.name,
        type: entry.type,
        normalBalance: entry.normalBalance,
        isPostable: entry.isPostable ?? true,
        isSystem: entry.isSystem ?? false,
        isActive: entry.isActive ?? true,
        description: entry.description,
      },
    });
    created += 1;
  }

  // Pass kedua: sambungkan hierarki. Hanya isi parentId yang masih kosong agar
  // perubahan struktur oleh owner tidak ditimpa saat setup dijalankan ulang.
  const all = await tx.account.findMany({ where: { workspaceId }, select: { id: true, code: true, parentId: true } });
  const byCode = new Map(all.map((a) => [a.code, a]));

  for (const entry of DEFAULT_COA_TEMPLATE) {
    if (!entry.parentCode) continue;
    const child = byCode.get(entry.code);
    const parent = byCode.get(entry.parentCode);
    if (!child || !parent || child.parentId) continue;
    await tx.account.update({ where: { id: child.id }, data: { parentId: parent.id } });
  }

  const retained = byCode.get('3-2000');
  const currentProfit = byCode.get('3-3000');
  const cashAccount = byCode.get('1-1110');
  const bankAccount = byCode.get('1-1210');
  const defaultRevenue = byCode.get('4-1100');

  // Pemetaan kategori bawaan: hanya dibuat kalau belum ada, supaya pilihan owner
  // tidak tertimpa saat setup dijalankan ulang.
  let mappingsCreated = 0;
  for (const mapping of DEFAULT_CATEGORY_MAPPINGS) {
    const account = byCode.get(mapping.accountCode);
    if (!account) continue;
    const existingMap = await tx.categoryAccountMap.findUnique({
      where: {
        workspaceId_category_type: {
          workspaceId,
          category: mapping.category,
          type: mapping.type,
        },
      },
      select: { id: true },
    });
    if (existingMap) continue;
    await tx.categoryAccountMap.create({
      data: {
        workspaceId,
        category: mapping.category,
        type: mapping.type,
        accountId: account.id,
      },
    });
    mappingsCreated += 1;
  }

  // Awal bulan BERJALAN (bukan bulan depan). Tanggal mulai pembukuan yang jatuh
  // di masa depan membuat setiap jurnal yang dibuat hari ini tercatat sebelum
  // pembukuan dimulai -- membingungkan dan membuat periode berjalan kosong.
  const defaultBooksStart =
    options.booksStartDate ??
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) - 7 * 3600 * 1000);

  // Dibaca lebih dulu supaya pilihan owner tidak tertimpa saat setup dijalankan ulang.
  const existingSetting = await tx.accountingSetting.findUnique({
    where: { workspaceId },
    select: { defaultRevenueAccountId: true },
  });

  const setting = await tx.accountingSetting.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      isEnabled: false,
      booksStartDate: defaultBooksStart,
      taxProfile: options.taxProfile ?? TaxProfile.UMKM_NON_PKP,
      entityType: options.entityType ?? 'BADAN_USAHA',
      retainedEarningsAccountId: retained?.id,
      currentYearProfitAccountId: currentProfit?.id,
      defaultRevenueAccountId: defaultRevenue?.id,
    },
    update: {
      retainedEarningsAccountId: retained?.id,
      currentYearProfitAccountId: currentProfit?.id,
      // Hanya diisi kalau owner belum pernah memilih akun pendapatan faktur.
      ...(existingSetting?.defaultRevenueAccountId
        ? {}
        : { defaultRevenueAccountId: defaultRevenue?.id }),
    },
  });

  let cashCreated = 0;
  if (options.createDefaultCashAccounts !== false) {
    const defaults: Array<{ code: string; name: string; type: CashAccountType; accountId?: string; bankName?: string }> = [
      { code: 'KAS-01', name: 'Kas Kecil', type: CashAccountType.CASH, accountId: cashAccount?.id },
      { code: 'BANK-01', name: 'Bank Utama', type: CashAccountType.BANK, accountId: bankAccount?.id, bankName: 'BCA' },
    ];

    for (const d of defaults) {
      if (!d.accountId) continue;
      const exists = await tx.cashAccount.findUnique({
        where: { workspaceId_code: { workspaceId, code: d.code } },
        select: { id: true },
      });
      if (exists) continue;
      await tx.cashAccount.create({
        data: {
          workspaceId,
          code: d.code,
          name: d.name,
          type: d.type,
          accountId: d.accountId,
          bankName: d.bankName,
        },
      });
      cashCreated += 1;
    }
  }

  const firstCash = await tx.cashAccount.findFirst({
    where: { workspaceId, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true },
  });
  if (firstCash && !setting.defaultCashAccountId) {
    await tx.accountingSetting.update({
      where: { workspaceId },
      data: { defaultCashAccountId: firstCash.id },
    });
  }

  return {
    accountsCreated: created,
    accountsExisting: existingBefore.length,
    cashAccountsCreated: cashCreated,
    categoryMappingsCreated: mappingsCreated,
    setting: {
      booksStartDate: setting.booksStartDate ?? defaultBooksStart,
      taxProfile: setting.taxProfile,
      entityType: setting.entityType,
    },
  };
}

/** Cari akun sistem berdasarkan kode; melempar error yang bisa ditindaklanjuti bila belum di-seed. */
export async function requireAccountByCode(
  client: Prisma.TransactionClient | typeof import('../prisma').prisma,
  workspaceId: string,
  code: string
): Promise<Account> {
  const account = await client.account.findUnique({
    where: { workspaceId_code: { workspaceId, code } },
  });
  if (!account) {
    throw new Error(`Akun ${code} belum ada. Jalankan inisialisasi bagan akun terlebih dahulu.`);
  }
  return account;
}

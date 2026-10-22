import {
  AccountType,
  JournalSource,
  NormalBalance,
  Prisma,
  type Asset,
} from '@prisma/client';
import { createJournalInTx, type JournalLineInput, type JournalWithLines } from '@/lib/accounting/journal-service';
import { getAccountingSetting } from '@/lib/accounting/posting';
import { toMoney } from '@/lib/accounting/money';

/**
 * Penjurnalan otomatis modul Manajemen Aset & Penyusutan.
 *
 * Aturan akun (bisa ditimpa per aset lewat kolom `assetAccountId`,
 * `depreciationExpenseAccountId`, dan `accumulatedDepreciationAccountId`):
 *
 *   Penyusutan bulanan   Dr 6-1800 Beban Penyusutan
 *                        Cr 1-2400 Akumulasi Penyusutan
 *
 *   Pelepasan aset       Dr 1-2400 Akumulasi Penyusutan
 *                        Dr 1-1100 Kas / akun hasil penjualan (bila ada hasil)
 *                        Dr 6-9200 Kerugian Pelepasan (bila rugi)
 *                        Cr 1-2xxx Akun Aset (harga perolehan)
 *                        Cr 4-1910 Keuntungan Pelepasan (bila untung)
 *
 *   Penurunan nilai      Dr 6-9300 Kerugian Penurunan Nilai
 *                        Cr 1-2500 Akumulasi Penurunan Nilai Aset
 *
 * Kalau modul akuntansi belum diaktifkan, semua fungsi mengembalikan null dan
 * entri tetap tersimpan sebagai catatan operasional (isPosted = false).
 */

export const ASSET_ACCOUNT_CODES = {
  defaultAsset: '1-2100',
  depreciationExpense: '6-1800',
  accumulatedDepreciation: '1-2400',
  accumulatedImpairment: '1-2500',
  gainOnDisposal: '4-1910',
  lossOnDisposal: '6-9200',
  impairmentLoss: '6-9300',
  defaultProceeds: '1-1100',
} as const;

interface AccountBlueprint {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode: string;
}

const ACCOUNT_BLUEPRINTS: Record<string, AccountBlueprint> = {
  [ASSET_ACCOUNT_CODES.accumulatedImpairment]: {
    code: ASSET_ACCOUNT_CODES.accumulatedImpairment,
    name: 'Akumulasi Penurunan Nilai Aset',
    type: AccountType.ASSET,
    normalBalance: NormalBalance.CREDIT,
    parentCode: '1-2000',
  },
  [ASSET_ACCOUNT_CODES.gainOnDisposal]: {
    code: ASSET_ACCOUNT_CODES.gainOnDisposal,
    name: 'Keuntungan Pelepasan Aset Tetap',
    type: AccountType.REVENUE,
    normalBalance: NormalBalance.CREDIT,
    parentCode: '4-1000',
  },
  [ASSET_ACCOUNT_CODES.lossOnDisposal]: {
    code: ASSET_ACCOUNT_CODES.lossOnDisposal,
    name: 'Kerugian Pelepasan Aset Tetap',
    type: AccountType.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
    parentCode: '6-1000',
  },
  [ASSET_ACCOUNT_CODES.impairmentLoss]: {
    code: ASSET_ACCOUNT_CODES.impairmentLoss,
    name: 'Kerugian Penurunan Nilai Aset',
    type: AccountType.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
    parentCode: '6-1000',
  },
};

/**
 * Cari akun berdasarkan kode; buat otomatis bila belum ada (idempoten). Workspace
 * lama bisa disiapkan sebelum akun aset ditambahkan ke bagan akun bawaan.
 */
export async function ensureAccountByCode(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  code: string
): Promise<string> {
  const existing = await tx.account.findFirst({
    where: { workspaceId, code },
    select: { id: true },
  });
  if (existing) return existing.id;

  const blueprint = ACCOUNT_BLUEPRINTS[code];
  if (!blueprint) {
    const fallback = await tx.account.findFirst({
      where: { workspaceId, isPostable: true, isActive: true, type: AccountType.ASSET },
      orderBy: { code: 'asc' },
      select: { id: true },
    });
    if (!fallback) {
      throw new Error(
        `Akun ${code} tidak ditemukan dan tidak ada akun aset lain untuk dipakai. Siapkan bagan akun terlebih dahulu.`
      );
    }
    return fallback.id;
  }

  const parent = await tx.account.findFirst({
    where: { workspaceId, code: blueprint.parentCode },
    select: { id: true },
  });

  const created = await tx.account.create({
    data: {
      workspaceId,
      code: blueprint.code,
      name: blueprint.name,
      type: blueprint.type,
      normalBalance: blueprint.normalBalance,
      parentId: parent?.id ?? null,
      isSystem: true,
    },
    select: { id: true },
  });
  return created.id;
}

export interface AssetAccountSet {
  assetAccountId: string;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
}

/** Kumpulan akun yang dipakai sebuah aset (override per aset, fallback bawaan). */
export async function resolveAssetAccounts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  asset: Pick<
    Asset,
    'assetAccountId' | 'depreciationExpenseAccountId' | 'accumulatedDepreciationAccountId'
  >
): Promise<AssetAccountSet> {
  return {
    assetAccountId:
      asset.assetAccountId ??
      (await ensureAccountByCode(tx, workspaceId, ASSET_ACCOUNT_CODES.defaultAsset)),
    depreciationExpenseAccountId:
      asset.depreciationExpenseAccountId ??
      (await ensureAccountByCode(tx, workspaceId, ASSET_ACCOUNT_CODES.depreciationExpense)),
    accumulatedDepreciationAccountId:
      asset.accumulatedDepreciationAccountId ??
      (await ensureAccountByCode(tx, workspaceId, ASSET_ACCOUNT_CODES.accumulatedDepreciation)),
  };
}

/** Pastikan modul akuntansi aktif untuk workspace. */
export async function isAccountingEnabled(
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<boolean> {
  const setting = await getAccountingSetting(tx, workspaceId);
  return Boolean(setting?.isEnabled);
}

export interface PostDepreciationInput {
  workspaceId: string;
  userId: string;
  asset: Pick<Asset, 'id' | 'name' | 'assetAccountId' | 'depreciationExpenseAccountId' | 'accumulatedDepreciationAccountId'>;
  depreciationEntryId: string;
  amount: number;
  entryDate: Date;
  description: string;
}

/**
 * Jurnal penyusutan satu periode. `sourceId` = id entri penyusutan supaya
 * constraint (workspace, source, sourceId) mencegah jurnal dobel.
 */
export async function postDepreciationInTx(
  tx: Prisma.TransactionClient,
  ctx: PostDepreciationInput
): Promise<JournalWithLines | null> {
  if (!(await isAccountingEnabled(tx, ctx.workspaceId))) return null;

  const amount = toMoney(ctx.amount);
  if (amount.lte(0)) return null;

  const accounts = await resolveAssetAccounts(tx, ctx.workspaceId, ctx.asset);
  const lines: JournalLineInput[] = [
    {
      accountId: accounts.depreciationExpenseAccountId,
      debit: amount,
      credit: 0,
      description: `Beban penyusutan ${ctx.asset.name}`,
    },
    {
      accountId: accounts.accumulatedDepreciationAccountId,
      debit: 0,
      credit: amount,
      description: `Akumulasi penyusutan ${ctx.asset.name}`,
    },
  ];

  return createJournalInTx(tx, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    entryDate: ctx.entryDate,
    description: ctx.description,
    source: JournalSource.ASSET_DEPRECIATION,
    sourceId: ctx.depreciationEntryId,
    lines,
    postImmediately: true,
  });
}

export interface PostDisposalInput {
  workspaceId: string;
  userId: string;
  asset: Pick<
    Asset,
    | 'id'
    | 'name'
    | 'assetAccountId'
    | 'depreciationExpenseAccountId'
    | 'accumulatedDepreciationAccountId'
  >;
  entryDate: Date;
  /** Nilai buku saat pelepasan (harga perolehan - akumulasi penyusutan - penurunan nilai). */
  carryingAmount: number;
  acquisitionCost: number;
  accumulatedDepreciation: number;
  accumulatedImpairment?: number;
  /** Hasil penjualan/pelepasan. 0 untuk aset yang dihapuskan. */
  proceeds: number;
  /** Akun penerima hasil pelepasan. Default 1-1100 Kas. */
  proceedsAccountId?: string | null;
}

export interface DisposalResult {
  journal: JournalWithLines | null;
  gainLoss: number;
  gain: number;
  loss: number;
}

/**
 * Jurnal pelepasan aset. Keuntungan/kerugian dihitung dari hasil penjualan
 * dikurangi nilai buku, dan jurnalnya selalu balance.
 */
export async function postDisposalInTx(
  tx: Prisma.TransactionClient,
  ctx: PostDisposalInput
): Promise<DisposalResult> {
  const cost = toMoney(ctx.acquisitionCost);
  const accumulated = toMoney(Math.min(ctx.accumulatedDepreciation, ctx.acquisitionCost));
  const impairment = toMoney(
    Math.min(ctx.accumulatedImpairment ?? 0, Math.max(0, ctx.acquisitionCost - ctx.accumulatedDepreciation))
  );
  const carrying = toMoney(Math.max(0, ctx.carryingAmount));
  const proceeds = toMoney(Math.max(0, ctx.proceeds));
  const gainLoss = proceeds.minus(carrying).toNumber();

  if (!(await isAccountingEnabled(tx, ctx.workspaceId))) {
    return { journal: null, gainLoss, gain: Math.max(0, gainLoss), loss: Math.max(0, -gainLoss) };
  }

  const accounts = await resolveAssetAccounts(tx, ctx.workspaceId, ctx.asset);
  const lines: JournalLineInput[] = [];

  if (accumulated.greaterThan(0)) {
    lines.push({
      accountId: accounts.accumulatedDepreciationAccountId,
      debit: accumulated,
      credit: 0,
      description: `Hapus akumulasi penyusutan ${ctx.asset.name}`,
    });
  }

  if (impairment.greaterThan(0)) {
    lines.push({
      accountId: await ensureAccountByCode(tx, ctx.workspaceId, ASSET_ACCOUNT_CODES.accumulatedImpairment),
      debit: impairment,
      credit: 0,
      description: `Hapus akumulasi penurunan nilai ${ctx.asset.name}`,
    });
  }

  if (proceeds.greaterThan(0)) {
    const proceedsAccountId =
      ctx.proceedsAccountId ?? (await ensureAccountByCode(tx, ctx.workspaceId, ASSET_ACCOUNT_CODES.defaultProceeds));
    lines.push({
      accountId: proceedsAccountId,
      debit: proceeds,
      credit: 0,
      description: `Hasil pelepasan ${ctx.asset.name}`,
    });
  }

  if (gainLoss < 0) {
    lines.push({
      accountId: await ensureAccountByCode(tx, ctx.workspaceId, ASSET_ACCOUNT_CODES.lossOnDisposal),
      debit: toMoney(-gainLoss),
      credit: 0,
      description: `Kerugian pelepasan ${ctx.asset.name}`,
    });
  }

  lines.push({
    accountId: accounts.assetAccountId,
    debit: 0,
    credit: cost,
    description: `Hapus nilai perolehan ${ctx.asset.name}`,
  });

  if (gainLoss > 0) {
    lines.push({
      accountId: await ensureAccountByCode(tx, ctx.workspaceId, ASSET_ACCOUNT_CODES.gainOnDisposal),
      debit: 0,
      credit: toMoney(gainLoss),
      description: `Keuntungan pelepasan ${ctx.asset.name}`,
    });
  }

  const journal = await createJournalInTx(tx, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    entryDate: ctx.entryDate,
    description: `Pelepasan aset ${ctx.asset.name}`,
    source: JournalSource.ASSET_DISPOSAL,
    sourceId: ctx.asset.id,
    lines,
    postImmediately: true,
  });

  return { journal, gainLoss, gain: Math.max(0, gainLoss), loss: Math.max(0, -gainLoss) };
}

export interface PostImpairmentInput {
  workspaceId: string;
  userId: string;
  asset: Pick<Asset, 'id' | 'name'>;
  impairmentId: string;
  entryDate: Date;
  loss: number;
}

/** Jurnal penurunan nilai aset (impairment). */
export async function postImpairmentInTx(
  tx: Prisma.TransactionClient,
  ctx: PostImpairmentInput
): Promise<JournalWithLines | null> {
  if (!(await isAccountingEnabled(tx, ctx.workspaceId))) return null;

  const loss = toMoney(ctx.loss);
  if (loss.lte(0)) return null;

  return createJournalInTx(tx, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    entryDate: ctx.entryDate,
    description: `Penurunan nilai aset ${ctx.asset.name}`,
    source: JournalSource.ASSET_IMPAIRMENT,
    sourceId: ctx.impairmentId,
    lines: [
      {
        accountId: await ensureAccountByCode(tx, ctx.workspaceId, ASSET_ACCOUNT_CODES.impairmentLoss),
        debit: loss,
        credit: 0,
        description: `Kerugian penurunan nilai ${ctx.asset.name}`,
      },
      {
        accountId: await ensureAccountByCode(tx, ctx.workspaceId, ASSET_ACCOUNT_CODES.accumulatedImpairment),
        debit: 0,
        credit: loss,
        description: `Akumulasi penurunan nilai ${ctx.asset.name}`,
      },
    ],
    postImmediately: true,
  });
}

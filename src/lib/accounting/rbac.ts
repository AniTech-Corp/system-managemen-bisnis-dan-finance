import { Role } from '@prisma/client';
import type { AuthContext } from '../tenant-guard';

/**
 * Izin modul akuntansi. Sengaja TIDAK memakai DivisionRole.FINANCE sebagai
 * penambah izin, supaya hanya ada satu sumber kebenaran (Role workspace).
 */
export type AccountingAction =
  | 'view'
  | 'draft'
  | 'post'
  | 'manage_accounts'
  | 'close_period'
  | 'lock_period'
  | 'manage_settings'
  | 'opening_balance';

const ROLE_RANK: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

const MIN_RANK: Record<AccountingAction, number> = {
  view: 1,
  draft: 2,
  post: 4, // ADMIN ke atas
  manage_accounts: 4,
  close_period: 4,
  lock_period: 5, // OWNER
  manage_settings: 5,
  opening_balance: 5,
};

export function canAccounting(auth: Pick<AuthContext, 'membership'>, action: AccountingAction): boolean {
  if (auth.membership.isOwner) return true;
  return ROLE_RANK[auth.membership.role] >= MIN_RANK[action];
}

export function accountingForbidden(action: AccountingAction): string {
  const labels: Record<AccountingAction, string> = {
    view: 'melihat laporan',
    draft: 'membuat jurnal',
    post: 'posting jurnal',
    manage_accounts: 'mengubah bagan akun',
    close_period: 'menutup buku',
    lock_period: 'mengunci periode',
    manage_settings: 'mengubah pengaturan akuntansi',
    opening_balance: 'mengisi saldo awal',
  };
  return `Anda tidak memiliki izin untuk ${labels[action]}.`;
}

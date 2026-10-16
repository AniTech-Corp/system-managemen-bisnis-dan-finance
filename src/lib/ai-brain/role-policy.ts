import type { DivisionRole } from './data-visibility';

export type RoleCapability =
  | 'chat'
  | 'documents'
  | 'image'
  | 'video'
  | 'research'
  | 'local_research'
  | 'forecast'
  | 'location'
  | 'inventory'
  | 'financial_actions';

const ROLE_CAPABILITIES: Record<DivisionRole, ReadonlySet<RoleCapability>> = {
  CEO: new Set(['chat', 'documents', 'image', 'video', 'research', 'local_research', 'forecast', 'location', 'inventory', 'financial_actions']),
  FINANCE: new Set(['chat', 'documents', 'image', 'video', 'research', 'local_research', 'forecast', 'location', 'inventory', 'financial_actions']),
  MARKETING: new Set(['chat', 'documents', 'image', 'video', 'research', 'local_research', 'location']),
  SEKRETARIS: new Set(['chat', 'documents', 'image', 'video']),
  MANAGER_UMUM: new Set(['chat', 'documents', 'image', 'video', 'local_research', 'location']),
  MANAGER_OPERASIONAL: new Set(['chat', 'documents', 'image', 'video', 'inventory']),
  LAIN: new Set(['chat', 'documents', 'image', 'video']),
};

export const FINANCIAL_ACTION_TYPES = new Set([
  'RESOLVE_INVOICE',
  'OPTIMIZE_EXPENSES',
  'RECONCILE_BANK',
  'TAX_PROJECTION',
  'CREATE_INVOICE',
  'PAYROLL_ACTION',
  'COMPANY_CASH_ACTION',
]);

export function canRoleUseCapability(role: DivisionRole, capability: RoleCapability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export function isNewDivisionRole(role: DivisionRole): role is 'SEKRETARIS' | 'MANAGER_UMUM' | 'MANAGER_OPERASIONAL' {
  return role === 'SEKRETARIS' || role === 'MANAGER_UMUM' || role === 'MANAGER_OPERASIONAL';
}

export function canRoleUseScopedCapability(
  role: DivisionRole,
  capability: RoleCapability,
  options: { hasAuthoritativeTeamScope?: boolean } = {},
): boolean {
  if (!canRoleUseCapability(role, capability)) return false;
  if ((capability === 'local_research' || capability === 'location' || capability === 'forecast') && role === 'MANAGER_UMUM') {
    return options.hasAuthoritativeTeamScope === true;
  }
  return true;
}

export function isFinancialActionType(actionType?: string | null): boolean {
  return FINANCIAL_ACTION_TYPES.has((actionType || '').trim().toUpperCase());
}

/**
 * UI containment untuk tombol lanjutan yang punya jalur domain khusus.
 * Ini bukan pengganti authorization backend; ia mencegah role baru mendapat
 * CTA import kas/riset/forecast/lokasi sebelum kontrak scope datanya tersedia.
 */
export function filterNextActionsForRole<T extends { kind: string }>(actions: T[], role: DivisionRole): T[] {
  if (!isNewDivisionRole(role)) return actions;
  const blockedKinds = new Set(['import-ledger', 'riset', 'prediksi', 'lokasi']);
  return actions.filter((action) => !blockedKinds.has(action.kind));
}

export function mediaBackendRoleForDivision(role: DivisionRole): 'marketing' | 'executive' | 'finance' {
  if (role === 'FINANCE') return 'finance';
  if (role === 'MARKETING') return 'marketing';
  return 'executive';
}

export function unsupportedCapabilityMessage(role: DivisionRole, capability: RoleCapability): string {
  const labels: Record<RoleCapability, string> = {
    chat: 'chat',
    documents: 'dokumen',
    image: 'gambar',
    video: 'video',
    research: 'riset umum',
    local_research: 'riset lokal berbasis scope tim',
    forecast: 'forecast',
    location: 'analisis lokasi',
    inventory: 'inventory',
    financial_actions: 'aksi finansial',
  };
  return `Role ${role} belum memiliki kontrak akses untuk ${labels[capability]}. Data tidak dikirim dan tidak ada aksi yang dijalankan.`;
}

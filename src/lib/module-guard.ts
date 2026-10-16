import { prisma } from './prisma';

/**
 * Satu-satunya sumber kebenaran nama modul KLIR yang bisa di-toggle per workspace.
 * HARUS selalu sinkron dengan default Workspace.enabledModules di prisma/schema.prisma.
 */
export const KLIR_MODULE_KEYS = [
  'corplan',
  'personal',
  'finance',
  'advertising',
  'workspace',
  'schedule',
  'inventory',
] as const;

export type KlirModuleKey = (typeof KLIR_MODULE_KEYS)[number];

/**
 * Default kalau workspace belum punya enabledModules sama sekali (sesi lama,
 * atau fallback saat query DB gagal). Semua modul nyala -- fail-open, bukan
 * fail-closed, supaya sesi lama tidak tiba-tiba kehilangan akses.
 */
export const DEFAULT_ENABLED_MODULES: KlirModuleKey[] = [...KLIR_MODULE_KEYS];

/**
 * Cek apakah satu modul aktif untuk sebuah workspace.
 * Fail-open: array kosong/null/undefined -> true (backward-compatible untuk
 * sesi/workspace lama yang belum punya kolom enabledModules terisi).
 */
export function isModuleEnabled(
  enabledModules: string[] | null | undefined,
  key: KlirModuleKey
): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

/**
 * Ambil enabledModules sebuah workspace langsung dari DB.
 * try/catch + fallback DEFAULT_ENABLED_MODULES kalau query gagal (pola sama
 * dengan getWorkspacePlan() di src/lib/plan-guard.ts baris 60-75) -- gating
 * modul TIDAK BOLEH menjatuhkan seluruh request kalau DB lagi bermasalah.
 */
export async function getEnabledModules(workspaceId: string): Promise<string[]> {
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { enabledModules: true },
    });

    if (!ws || !ws.enabledModules || ws.enabledModules.length === 0) {
      return DEFAULT_ENABLED_MODULES;
    }

    return ws.enabledModules;
  } catch (err) {
    console.warn('[ModuleGuard] Gagal membaca enabledModules, fallback ke semua modul nyala:', err);
    return DEFAULT_ENABLED_MODULES;
  }
}

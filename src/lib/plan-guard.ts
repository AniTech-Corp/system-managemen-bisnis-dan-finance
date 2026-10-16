import { prisma } from './prisma';
import { PlanType } from '@prisma/client';

/**
 * Fitur "premium" yang TIDAK tersedia di paket FREE.
 * Fitur dasar (generate-plan, hpp, kur, understand, check-budget, kas, kerja, booking, copywriting)
 * selalu tersedia untuk semua paket.
 */
export type PlanFeature =
  | 'roadmap'
  | 'mediaGeneration'
  | 'byokAiKeys'
  | 'exportPdf'
  | 'pitchdeck'
  | 'valuationSwot';

export interface PlanConfig {
  plan: PlanType;
  label: string;
  weeklyCredit: number;
  rateLimitPerMin: number;
  premiumFeatures: PlanFeature[];
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  FREE: {
    plan: 'FREE',
    label: 'Free (Gratis)',
    weeklyCredit: 100,
    rateLimitPerMin: 30,
    premiumFeatures: [],
  },
  STARTED: {
    plan: 'STARTED',
    label: 'Starter',
    weeklyCredit: 2000,
    rateLimitPerMin: 60,
    premiumFeatures: ['roadmap', 'mediaGeneration'],
  },
  BUSINESS: {
    plan: 'BUSINESS',
    label: 'Business',
    weeklyCredit: 8000,
    rateLimitPerMin: 300,
    premiumFeatures: ['roadmap', 'mediaGeneration', 'byokAiKeys', 'exportPdf'],
  },
};

export const PLAN_LABELS: Record<PlanType, string> = {
  FREE: 'Free',
  STARTED: 'Starter',
  BUSINESS: 'Business',
};

/**
 * Mendapatkan konfigurasi paket aktif sebuah workspace.
 * Subskripsi dianggap aktif hanya jika status ACTIVE dan belum kedaluwarsa.
 * Default: FREE.
 */
export async function getWorkspacePlan(workspaceId: string): Promise<PlanConfig> {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (sub && sub.status === 'ACTIVE' && sub.endDate > new Date()) {
      return PLAN_CONFIGS[sub.planType] || PLAN_CONFIGS.FREE;
    }

    return PLAN_CONFIGS.FREE;
  } catch (err) {
    console.warn('[PlanGuard] Gagal membaca subscription, fallback ke FREE:', err);
    return PLAN_CONFIGS.FREE;
  }
}

/**
 * Cek apakah workspace boleh memakai fitur premium tertentu.
 */
export async function planAllowsFeature(workspaceId: string, feature: PlanFeature): Promise<boolean> {
  const config = await getWorkspacePlan(workspaceId);
  return config.premiumFeatures.includes(feature);
}

import { prisma } from './prisma';

export type WorkspaceTier = 'PUBLIC_SAAS' | 'PRIVATE_ENTERPRISE';

export interface TierEntitlements {
  tier: WorkspaceTier;
  label: string;
  weeklyCreditLimit: number;
  monthlyMaxLimit: number;
  rateLimitPerMin: number;
  hasDedicatedAiKey: boolean;
  hasCustomWebhooks: boolean;
  hasAuditRetentionUnlimited: boolean;
  features: {
    corplan: boolean;
    anivirtual: boolean;
    kas: boolean;
    promo: boolean;
    kerja: boolean;
    booking: boolean;
    workflows: boolean;
    byokAiKeys: boolean;
    exportPdfData: boolean;
    canGenerateMedia: boolean;
  };
}

export const TIER_CONFIGS: Record<WorkspaceTier, TierEntitlements> = {
  PUBLIC_SAAS: {
    tier: 'PUBLIC_SAAS',
    label: 'Public SaaS (UMKM / Starter)',
    weeklyCreditLimit: 1500,
    monthlyMaxLimit: 10000,
    rateLimitPerMin: 60,
    hasDedicatedAiKey: false,
    hasCustomWebhooks: false,
    hasAuditRetentionUnlimited: false,
    features: {
      corplan: true,
      anivirtual: true,
      kas: true,
      promo: true,
      kerja: true,
      booking: true,
      workflows: true,
      byokAiKeys: false,
      exportPdfData: true,
      canGenerateMedia: false, // Dibatasi untuk paket Free / Public dasar
    },
  },
  PRIVATE_ENTERPRISE: {
    tier: 'PRIVATE_ENTERPRISE',
    label: 'Private Enterprise (Korporat / Dedicated)',
    weeklyCreditLimit: 9000,
    monthlyMaxLimit: 46000,
    rateLimitPerMin: 300,
    hasDedicatedAiKey: true,
    hasCustomWebhooks: true,
    hasAuditRetentionUnlimited: true,
    features: {
      corplan: true,
      anivirtual: true,
      kas: true,
      promo: true,
      kerja: true,
      booking: true,
      workflows: true,
      byokAiKeys: true,
      exportPdfData: true,
      canGenerateMedia: true,
    },
  },
};

/**
 * Mendapatkan entitas dan hak akses tier workspace
 */
export async function getWorkspaceTierEntitlements(workspaceId?: string): Promise<TierEntitlements> {
  const isUuid = workspaceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId);

  if (isUuid) {
    try {
      const dedicatedKey = await prisma.workspaceAIKey.findFirst({
        where: { workspaceId, isActive: true },
      });

      if (dedicatedKey) {
        return TIER_CONFIGS.PRIVATE_ENTERPRISE;
      }
    } catch {
      // Fallback
    }
  }

  return TIER_CONFIGS.PUBLIC_SAAS; // Default: publik (bukan enterprise)
}

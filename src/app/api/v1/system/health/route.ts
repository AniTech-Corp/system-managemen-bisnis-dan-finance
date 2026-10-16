import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceTierEntitlements } from '@/lib/tier-hardening';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let dbStatus = 'DISCONNECTED';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = 'HEALTHY';
  } catch (err: any) {
    // Keep provider/connection details server-side. This endpoint is public by
    // design for uptime monitoring, so raw Prisma errors and row counts are
    // not an acceptable response contract.
    console.error('[SystemHealth] database probe failed:', err);
    dbStatus = 'UNAVAILABLE';
  }

  const sampleTier = await getWorkspaceTierEntitlements('sample');

  const healthData = {
    status: dbStatus === 'HEALTHY' ? 'OPERATIONAL' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    version: '1.0.0-production-rc1',
    uptime: process.uptime(),
    components: {
      database: {
        provider: 'postgresql',
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      aiGateway: {
        provider: 'Multi-Provider Neural Router (AI Pipeline)',
        status: 'READY',
        deterministicFallback: 'ACTIVE',
      },
      creditEconomy: {
        status: 'ACTIVE',
        model: 'Atomic Reserve & Ledger',
      },
      dualTierSystem: {
        status: 'ENFORCED',
        tiersAvailable: ['PUBLIC_SAAS', 'PRIVATE_ENTERPRISE'],
        activeProfile: sampleTier.label,
      },
      ecosystemPillars: {
        pilar1_corplan: 'OPERATIONAL (6 Bab, Deck, HPP, KUR, Valuasi)',
        pilar2_anivirtual: 'OPERATIONAL (Multi-Tone, Budget, Roadmap)',
        pilar3_legalitas: 'ON_HOLD (Repository Hukum)',
        pilar4_kas: 'OPERATIONAL (Buku Kas, Invoice QRIS/VA, PPh 0.5%)',
        pilar5_promo: 'OPERATIONAL (AI Copywriting, Kalender, BioLink)',
        pilar6_kerja: 'OPERATIONAL (Kanban, Presensi GPS, Gaji, KPI, SOP)',
        pilar7_booking: 'OPERATIONAL (Reservasi, Antrean, WA Reminder, Loyalty)',
        pilar8_workflows: 'OPERATIONAL (Cross-Pillar Event Dispatcher)',
      },
    },
    totalResponseTimeMs: Date.now() - startTime,
  };

  return NextResponse.json(healthData, {
    status: dbStatus === 'HEALTHY' ? 200 : 503,
  });
}

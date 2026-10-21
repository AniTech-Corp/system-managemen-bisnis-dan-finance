import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantGuard } from '@/lib/tenant-guard';
import { guardAccounting, badRequest, serverError } from '@/lib/accounting/api';
import { runProjection, getDefaultScenarios } from '@/lib/accounting/scenario-projection';
import { serializeReportValue } from '@/lib/accounting/api';

const scenarioParamSchema = z.object({
  id: z.string(),
  label: z.string(),
  salesDeltaPct: z.number().finite().min(-100).max(500),
  opexDeltaPct: z.number().finite().min(-100).max(500),
  delayDays: z.number().int().min(0).max(365),
});

const bodySchema = z.object({
  horizonMonths: z.number().int().min(1).max(24).optional(),
  lookbackMonths: z.number().int().min(1).max(24).optional(),
  scenarios: z.array(scenarioParamSchema).optional(),
});

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      let rawBody: unknown;
      try {
        rawBody = await req.json();
      } catch {
        rawBody = {};
      }

      const parsed = bodySchema.safeParse(rawBody);
      if (!parsed.success) {
        return badRequest('Parameter tidak valid: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
      }

      const { horizonMonths = 6, lookbackMonths = 6, scenarios: customScenarios } = parsed.data;
      const scenarios = customScenarios ?? getDefaultScenarios();

      const result = await runProjection(auth.workspace.id, lookbackMonths, horizonMonths, scenarios);

      return NextResponse.json({
        success: true,
        data: serializeReportValue(result),
      });
    } catch (err) {
      return serverError('scenario-projection', err, 'Gagal menghitung proyeksi skenario.');
    }
  },
  { minRole: 'VIEWER' }
);
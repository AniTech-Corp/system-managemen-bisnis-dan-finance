import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { guardAccounting, badRequest, notFound, serverError, serializeReportValue } from '@/lib/accounting/api';

const scenarioParamSchema = z.object({
  id: z.string(),
  label: z.string(),
  salesDeltaPct: z.number().finite().min(-100).max(500),
  opexDeltaPct: z.number().finite().min(-100).max(500),
  delayDays: z.number().int().min(0).max(365),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  lookbackMonths: z.number().int().min(1).max(24).default(6),
  horizonMonths: z.number().int().min(1).max(24).default(6),
  scenarios: z.array(scenarioParamSchema).min(1),
  baselineJson: z.unknown(), // MonthlyBaseline[]
  resultsJson: z.unknown().optional(), // ScenarioProjection[]
});

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const scenarios = await prisma.financialScenario.findMany({
        where: { workspaceId: auth.workspace.id, isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          baselineJson: true,
          paramsJson: true,
          resultsJson: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: serializeReportValue({ scenarios }),
      });
    } catch (err) {
      return serverError('scenarios-list', err, 'Gagal memuat daftar skenario.');
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view'); // 'draft' might be more appropriate but 'view' for now
    if (forbidden) return forbidden;

    try {
      let rawBody: unknown;
      try {
        rawBody = await req.json();
      } catch {
        return badRequest('Body JSON tidak valid.');
      }

      const parsed = createSchema.safeParse(rawBody);
      if (!parsed.success) {
        return badRequest('Parameter tidak valid: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
      }

      const { name, description, lookbackMonths, horizonMonths, scenarios, baselineJson, resultsJson } = parsed.data;

      const scenario = await prisma.financialScenario.create({
        data: {
          workspaceId: auth.workspace.id,
          name,
          description,
          baselineJson: baselineJson as any,
          paramsJson: { lookbackMonths, horizonMonths, scenarios } as any,
          resultsJson: resultsJson as any,
        },
      });

      return NextResponse.json({
        success: true,
        data: serializeReportValue({ scenario }),
      });
    } catch (err) {
      return serverError('scenario-create', err, 'Gagal menyimpan skenario.');
    }
  },
  { minRole: 'ADMIN' }
);

export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      let rawBody: unknown;
      try {
        rawBody = await req.json();
      } catch {
        return badRequest('Body JSON tidak valid.');
      }

      const parsed = updateSchema.safeParse(rawBody);
      if (!parsed.success) {
        return badRequest('Parameter tidak valid: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
      }

      const { id, name, description, lookbackMonths, horizonMonths, scenarios, baselineJson, resultsJson } = parsed.data;

      const existing = await prisma.financialScenario.findUnique({
        where: { id },
      });

      if (!existing || existing.workspaceId !== auth.workspace.id) {
        return notFound('Skenario tidak ditemukan.');
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (baselineJson !== undefined) updateData.baselineJson = baselineJson;
      if (resultsJson !== undefined) updateData.resultsJson = resultsJson;
      if (lookbackMonths !== undefined || horizonMonths !== undefined || scenarios !== undefined) {
        const currentParams = existing.paramsJson as any;
        updateData.paramsJson = {
          lookbackMonths: lookbackMonths ?? currentParams?.lookbackMonths ?? 6,
          horizonMonths: horizonMonths ?? currentParams?.horizonMonths ?? 6,
          scenarios: scenarios ?? currentParams?.scenarios ?? [],
        };
      }

      const scenario = await prisma.financialScenario.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        data: serializeReportValue({ scenario }),
      });
    } catch (err) {
      return serverError('scenario-update', err, 'Gagal memperbarui skenario.');
    }
  },
  { minRole: 'ADMIN' }
);

export const DELETE = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const id = req.nextUrl.searchParams.get('id');
      if (!id) return badRequest('Parameter id wajib.');

      const existing = await prisma.financialScenario.findUnique({ where: { id } });
      if (!existing || existing.workspaceId !== auth.workspace.id) {
        return notFound('Skenario tidak ditemukan.');
      }

      await prisma.financialScenario.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({ success: true, message: 'Skenario diarsipkan.' });
    } catch (err) {
      return serverError('scenario-delete', err, 'Gagal menghapus skenario.');
    }
  },
  { minRole: 'ADMIN' }
);
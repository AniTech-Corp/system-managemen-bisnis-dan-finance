import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { undoIngest } from '@/lib/ai-brain/auto-ingest';
import { invalidateDashboardInsightCache } from '@/lib/ai-brain/dashboard-insight';

/**
 * POST /api/v1/workspace-files/[id]/undo-ingest -- 11 Sep 2026 (komando, ADENDUM fase 2 C).
 * Membatalkan impor OTOMATIS satu file: hapus record turunan (CashTransaction/Product/
 * EmployeePayroll/WorkTask) yang tercatat di [INGEST_LOG] file itu SAJA -- data lain tidak
 * disentuh. Guard tenant sama seperti route Pusat Data lain (minRole MEMBER).
 */
export const POST = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    const result = await undoIngest(auth.workspace.id, id);
    if (result.ok) void invalidateDashboardInsightCache(auth.workspace.id);
    return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 404 });
  },
  { minRole: 'MEMBER' }
);

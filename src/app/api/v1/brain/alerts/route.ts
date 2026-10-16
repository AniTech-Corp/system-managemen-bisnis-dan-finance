import { NextRequest, NextResponse } from 'next/server';
import { AlertPriorityEngine, ContextEngine } from '@/lib/ai-brain';
import { authenticateTenantRequest } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    // SECURITY (Multi-Tenant Isolation): pastikan pemanggil adalah owner/member
    // dari workspace-nya sendiri — bukan sekadar mengirim workspaceId lewat header/query.
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }
    const workspaceId = guard.auth.workspace.id;

    const snapshot = await ContextEngine.getSnapshot(workspaceId);
    const alerts = AlertPriorityEngine.triageAlerts(snapshot);

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        alerts,
        criticalCount: alerts.filter((a) => a.severity === 'CRITICAL').length,
        warningCount: alerts.filter((a) => a.severity === 'WARNING').length,
        infoCount: alerts.filter((a) => a.severity === 'INFO').length,
      },
    });
  } catch (err: any) {
    console.error('Priority Alerts API error:', err);
    return NextResponse.json(
      { message: publicApiError('Gagal mengambil alerts.') },
      { status: 500 }
    );
  }
}

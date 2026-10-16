import { NextRequest, NextResponse } from 'next/server';
import { authenticateTenantRequest } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { computeWeeklyAnalysis } from './service';

export async function GET(req: NextRequest) {
  try {
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }

    const workspaceId = guard.auth.workspace.id;
    const weeklyData = await computeWeeklyAnalysis(workspaceId);

    return NextResponse.json({
      success: true,
      data: weeklyData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal memproses analisis mingguan.') },
      { status: 500 }
    );
  }
}

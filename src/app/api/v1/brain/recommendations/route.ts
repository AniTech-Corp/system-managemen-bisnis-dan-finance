import { NextRequest, NextResponse } from 'next/server';
import {
  getOrBuildBusinessContext,
  generateStrategicRecommendations,
  runForwardForecast,
} from '@/lib/ai-brain';
import { authenticateTenantRequest } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { resolveDivisionRole } from '@/lib/ai-brain/data-visibility';
import { isNewDivisionRole } from '@/lib/ai-brain/role-policy';

export async function GET(req: NextRequest) {
  try {
    // SECURITY (Multi-Tenant Isolation): pastikan pemanggil adalah owner/member
    // dari workspace-nya sendiri — bukan sekadar mengirim workspaceId lewat header/query.
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }
    const divisionRole = resolveDivisionRole({ email: guard.auth.user.email, membershipRole: guard.auth.membership.role, membershipDivisionRole: guard.auth.membership.divisionRole });
    if (isNewDivisionRole(divisionRole)) {
      return NextResponse.json({ success: false, code: 'ROLE_CAPABILITY_UNSUPPORTED', message: 'Rekomendasi strategis company-wide belum tersedia untuk role baru.' }, { status: 403 });
    }
    const workspaceId = guard.auth.workspace.id;

    const context = await getOrBuildBusinessContext(workspaceId, false, null, { includeCompanyKnowledge: true, includeMarketingMetrics: true });
    const recommendations = generateStrategicRecommendations(context);
    const forecast = runForwardForecast(context, 6);

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        healthScore: context.healthScore,
        recommendations,
        forecast,
      },
    });
  } catch (error: any) {
    console.error('[AI Brain Recommendations API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicApiError('Gagal membuat rekomendasi bisnis.'),
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { NudgeEngine, ContextEngine } from '@/lib/ai-brain';
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
    const nudges = NudgeEngine.scanNudges(snapshot);

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        nudges,
      },
    });
  } catch (err: any) {
    console.error('Human Nudges API error:', err);
    return NextResponse.json(
      { message: publicApiError('Gagal mengambil nudges.') },
      { status: 500 }
    );
  }
}

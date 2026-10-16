import { NextRequest, NextResponse } from 'next/server';
import { DecisionMemoryEngine, FeedbackLoopEngine, ContextEngine } from '@/lib/ai-brain';
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
    const decisions = DecisionMemoryEngine.getDecisions(workspaceId);
    const feedbackLoop = FeedbackLoopEngine.evaluateFeedbackLoop(workspaceId, snapshot);

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        totalDecisions: decisions.length,
        decisions,
        feedbackLoop,
      },
    });
  } catch (err: any) {
    console.error('Decision Memory API error:', err);
    return NextResponse.json(
      { message: publicApiError('Gagal mengambil Decision Memory.') },
      { status: 500 }
    );
  }
}

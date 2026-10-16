import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateTenantRequest } from '@/lib/tenant-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;

    // SECURITY (Multi-Tenant Isolation): pastikan pemanggil adalah owner/member
    // dari workspace yang diminta di URL — bukan sekadar user terautentikasi.
    const guard = await authenticateTenantRequest(req, { requiredWorkspaceId: workspaceId });
    if (guard.errorResponse) {
      return guard.errorResponse;
    }

    const creditAccount = await prisma.creditAccount.findUnique({
      where: { workspaceId },
      include: {
        workspace: {
          include: { subscription: true },
        },
      },
    });

    if (!creditAccount) {
      return NextResponse.json({ message: 'Credit account not found' }, { status: 404 });
    }

    return NextResponse.json({
      workspaceId: creditAccount.workspaceId,
      weeklyCredit: creditAccount.weeklyCredit,
      reserveCredit: creditAccount.reserveCredit,
      planType: creditAccount.workspace.subscription?.planType || 'FREE',
      lastReset: creditAccount.lastReset,
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

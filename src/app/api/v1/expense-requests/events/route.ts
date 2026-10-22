import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { Role } from '@prisma/client';

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const workspaceId = auth.workspace.id;
    const userId = auth.user.id;
    const userRole = auth.membership.role as Role;

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    let intervalId: NodeJS.Timeout;
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`));

        // Function to check for updates and send events
        const checkUpdates = async () => {
          if (isClosed) return;

          try {
            // Check for new pending approvals for this user
            const pendingCount = await prisma.expenseApproval.count({
              where: {
                expenseRequest: { workspaceId },
                status: 'PENDING',
                requiredRole: { in: getAuthorizedRoles(userRole) },
              },
            });

            // Check for finance review needed (if user is finance)
            let financeReviewCount = 0;
            if (['FINANCE', 'ADMIN', 'OWNER'].includes(userRole)) {
              financeReviewCount = await prisma.expenseRequest.count({
                where: { workspaceId, status: 'FINANCE_REVIEW' },
              });
            }

            // Check for user's own requests that changed status
            const userRequests = await prisma.expenseRequest.findMany({
              where: { workspaceId, requesterId: userId },
              select: { id: true, status: true, updatedAt: true },
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'update',
                  timestamp: new Date().toISOString(),
                  payload: {
                    pendingApprovals: pendingCount,
                    financeReviewNeeded: financeReviewCount,
                    userRequests: userRequests.map(r => ({
                      id: r.id,
                      status: r.status,
                      updatedAt: r.updatedAt,
                    })),
                  },
                })}\n\n`
              )
            );
          } catch (err) {
            console.error('[SSE] Error checking updates:', err);
          }
        };

        // Initial check
        await checkUpdates();

        // Poll every 15 seconds
        intervalId = setInterval(checkUpdates, 15000);

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          isClosed = true;
          if (intervalId) clearInterval(intervalId);
          controller.close();
        });
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  },
  { minRole: 'MEMBER' }
);

function getAuthorizedRoles(userRole: Role): Role[] {
  const hierarchy: Record<Role, number> = {
    OWNER: 5,
    ADMIN: 4,
    MANAGER: 3,
    MEMBER: 2,
    VIEWER: 1,
  };
  const userLevel = hierarchy[userRole] ?? 0;
  const allRoles: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
  return allRoles.filter(r => hierarchy[r] <= userLevel);
}
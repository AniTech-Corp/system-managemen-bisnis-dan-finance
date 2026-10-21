import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJwtToken, signJwtToken } from '@/lib/auth';
import { extractTokenFromRequest } from '@/lib/tenant-guard';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  verifyRefreshToken,
  setAuthCookies,
} from '@/lib/session';

/**
 * GET /auth/me — memulihkan sesi dari cookie httpOnly atau Bearer token.
 * Jika access token valid → kembalikan sesi.
 * Jika access token kedaluwarsa tapi refresh token valid → terbitkan access token baru.
 */
export async function GET(req: NextRequest) {
  try {
    // Demo mode: bypass authentication, return demo user data
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      console.log('[DEMO MODE] Bypassing authentication for auth/me endpoint');

      const requestedWsId = req.headers.get('x-workspace-id') || req.nextUrl.searchParams.get('workspaceId');
      const workspaceId = requestedWsId || process.env.NEXT_PUBLIC_DEMO_WORKSPACE_ID || 'a1000000-0000-0000-0000-000000000001';

      return NextResponse.json({
        user: {
          id: 'demo-user-id',
          email: 'demo@klir.ai',
          fullName: 'Demo User',
          avatarUrl: null,
        },
        activeWorkspace: {
          id: workspaceId,
          name: 'Demo Workspace',
          slug: 'demo-workspace',
          ownerId: 'demo-user-id',
        },
        workspaces: [
          {
            id: workspaceId,
            name: 'Demo Workspace',
            slug: 'demo-workspace',
            ownerId: 'demo-user-id',
          },
        ],
        tokens: { accessToken: 'demo-token', tokenType: 'Bearer' },
      });
    }
    
    const accessToken = extractTokenFromRequest(req) || req.cookies.get(ACCESS_TOKEN_COOKIE)?.value || null;
    const payload = accessToken ? verifyJwtToken(accessToken) : null;

    if (!payload) {
      const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value || null;
      if (refreshToken) {
        const userId = await verifyRefreshToken(refreshToken);
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
              ownedWorkspaces: true,
              memberships: { include: { workspace: true } },
            },
          });

          if (user) {
            const allWorkspaces = [
              ...user.ownedWorkspaces,
              ...user.memberships.map((m) => m.workspace).filter(Boolean),
            ];
            const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map((w) => [w.id, w])).values());
            const requestedWsId = req.headers.get('x-workspace-id') || req.nextUrl.searchParams.get('workspaceId');
            const workspace = (requestedWsId ? uniqueWorkspaces.find((w) => w.id === requestedWsId) : null)
              || user.ownedWorkspaces[0]
              || user.memberships[0]?.workspace;

            const newAccessToken = signJwtToken({
              userId: user.id,
              email: user.email,
              workspaceId: workspace?.id,
              role: 'OWNER',
            });

            const response = NextResponse.json({
              user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
              },
              activeWorkspace: workspace,
              workspaces: uniqueWorkspaces,
              tokens: { accessToken: newAccessToken, tokenType: 'Bearer' },
            });

            setAuthCookies(response, newAccessToken, refreshToken);
            return response;
          }
        }
      }

      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Sesi tidak valid atau telah berakhir.' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        ownedWorkspaces: true,
        memberships: { include: { workspace: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Akun tidak ditemukan.' }, { status: 401 });
    }

    const allWorkspaces = [
      ...user.ownedWorkspaces,
      ...user.memberships.map((m) => m.workspace).filter(Boolean),
    ];
    const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map((w) => [w.id, w])).values());
    const requestedWsId = req.headers.get('x-workspace-id') || req.nextUrl.searchParams.get('workspaceId') || payload.workspaceId;
    const workspace = (requestedWsId ? uniqueWorkspaces.find((w) => w.id === requestedWsId) : null)
      || user.ownedWorkspaces[0]
      || user.memberships[0]?.workspace;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      activeWorkspace: workspace,
      workspaces: uniqueWorkspaces,
      tokens: { accessToken, tokenType: 'Bearer' },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

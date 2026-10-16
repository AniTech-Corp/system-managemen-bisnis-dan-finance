import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signJwtToken } from '@/lib/auth';
import {
  REFRESH_TOKEN_COOKIE,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  setAuthCookies,
} from '@/lib/session';

/**
 * POST /auth/refresh — menukar refresh token dengan access token baru (rotasi).
 * Menerima refresh token dari body ATAU cookie.
 */
export async function POST(req: NextRequest) {
  try {
    let refreshToken: string | null = null;

    const body = await req.json().catch(() => null);
    refreshToken = body?.refreshToken || req.cookies.get(REFRESH_TOKEN_COOKIE)?.value || null;

    if (!refreshToken) {
      return NextResponse.json({ code: 'MISSING_REFRESH', message: 'Refresh token tidak ditemukan.' }, { status: 400 });
    }

    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) {
      return NextResponse.json({ code: 'INVALID_REFRESH', message: 'Refresh token tidak valid atau kedaluwarsa.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedWorkspaces: true,
        memberships: { include: { workspace: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ code: 'USER_NOT_FOUND', message: 'Akun tidak ditemukan.' }, { status: 401 });
    }

    // Rotasi: cabut refresh token lama, terbitkan yang baru
    await revokeRefreshToken(refreshToken);
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, newRefreshToken);

    const workspace = user.ownedWorkspaces[0] || user.memberships[0]?.workspace;
    const accessToken = signJwtToken({
      userId: user.id,
      email: user.email,
      workspaceId: workspace?.id,
      role: 'OWNER',
    });

    const response = NextResponse.json({
      tokens: { accessToken, refreshToken: newRefreshToken, tokenType: 'Bearer' },
    });

    setAuthCookies(response, accessToken, newRefreshToken);

    return response;
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

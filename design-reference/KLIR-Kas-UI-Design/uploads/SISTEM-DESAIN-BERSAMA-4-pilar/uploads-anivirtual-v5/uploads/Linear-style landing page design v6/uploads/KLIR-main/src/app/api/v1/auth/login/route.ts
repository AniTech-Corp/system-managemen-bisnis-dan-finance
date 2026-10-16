import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signJwtToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        ownedWorkspaces: true,
        memberships: { include: { workspace: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User tidak ditemukan' }, { status: 400 });
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      return NextResponse.json({ message: 'Password salah' }, { status: 400 });
    }

    const activeWorkspace = user.ownedWorkspaces[0] || user.memberships[0]?.workspace;

    const accessToken = signJwtToken({
      userId: user.id,
      email: user.email,
      workspaceId: activeWorkspace?.id,
      role: 'OWNER',
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, fullName: user.fullName },
      activeWorkspace,
      tokens: { accessToken, tokenType: 'Bearer' },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

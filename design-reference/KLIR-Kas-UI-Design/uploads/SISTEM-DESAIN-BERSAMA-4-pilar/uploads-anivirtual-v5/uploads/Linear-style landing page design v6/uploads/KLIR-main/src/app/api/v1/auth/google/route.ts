import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signJwtToken } from '@/lib/auth';
import { PlanType, AccessType, Role } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, fullName, avatarUrl } = body;

    if (!email) {
      return NextResponse.json({ message: 'Email dari Google tidak ditemukan' }, { status: 400 });
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        ownedWorkspaces: true,
        memberships: { include: { workspace: true } },
      },
    });

    let workspace: any;

    if (!user) {
      // Auto-register Google User & Auto-provision Workspace
      const dummyPassword = await hashPassword(`google-auth-${Date.now()}-${Math.random()}`);

      const result = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            passwordHash: dummyPassword,
            fullName: fullName || email.split('@')[0],
            avatarUrl: avatarUrl || null,
          },
        });

        const slug = `ws-google-${Date.now().toString(36)}`;
        const newWorkspace = await tx.workspace.create({
          data: {
            name: `${fullName || email.split('@')[0]}'s Workspace`,
            slug,
            ownerId: newUser.id,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: newWorkspace.id,
            userId: newUser.id,
            role: Role.OWNER,
          },
        });

        await tx.subscription.create({
          data: {
            workspaceId: newWorkspace.id,
            planType: PlanType.FREE,
            accessType: AccessType.KLIR_ALL,
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          },
        });

        await tx.creditAccount.create({
          data: {
            workspaceId: newWorkspace.id,
            weeklyCredit: 100,
            reserveCredit: 0,
          },
        });

        return { newUser, newWorkspace };
      });

      user = await prisma.user.findUnique({
        where: { id: result.newUser.id },
        include: {
          ownedWorkspaces: true,
          memberships: { include: { workspace: true } },
        },
      });
      workspace = result.newWorkspace;
    } else {
      workspace = user.ownedWorkspaces[0] || user.memberships[0]?.workspace;
    }

    if (!user || !workspace) {
      return NextResponse.json({ message: 'Gagal memproses autentikasi Google' }, { status: 500 });
    }

    // Sign JWT Token
    const accessToken = signJwtToken({
      userId: user.id,
      email: user.email,
      workspaceId: workspace.id,
      role: 'OWNER',
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      activeWorkspace: workspace,
      tokens: { accessToken, tokenType: 'Bearer' },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

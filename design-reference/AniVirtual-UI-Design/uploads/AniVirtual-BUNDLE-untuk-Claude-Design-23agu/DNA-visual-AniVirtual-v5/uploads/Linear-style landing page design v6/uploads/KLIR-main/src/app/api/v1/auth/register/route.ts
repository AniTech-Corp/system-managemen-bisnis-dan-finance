import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signJwtToken } from '@/lib/auth';
import { PlanType, AccessType, Role } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: 'Email sudah terdaftar' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, passwordHash, fullName },
      });

      const slug = `ws-${Date.now().toString(36)}`;
      const workspace = await tx.workspace.create({
        data: { name: `${fullName}'s Workspace`, slug, ownerId: newUser.id },
      });

      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: newUser.id, role: Role.OWNER },
      });

      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          planType: PlanType.FREE,
          accessType: AccessType.KLIR_ALL,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
      });

      await tx.creditAccount.create({
        data: { workspaceId: workspace.id, weeklyCredit: 100, reserveCredit: 0 },
      });

      return { newUser, workspace };
    });

    const accessToken = signJwtToken({
      userId: result.newUser.id,
      email: result.newUser.email,
      workspaceId: result.workspace.id,
      role: 'OWNER',
    });

    return NextResponse.json({
      user: { id: result.newUser.id, email: result.newUser.email, fullName: result.newUser.fullName },
      workspace: result.workspace,
      tokens: { accessToken, tokenType: 'Bearer' },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

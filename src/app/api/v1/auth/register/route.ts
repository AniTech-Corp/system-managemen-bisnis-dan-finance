import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signJwtToken } from '@/lib/auth';
import { PlanType, AccessType, Role } from '@prisma/client';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { generateRefreshToken, storeRefreshToken, setAuthCookies } from '@/lib/session';

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, { max: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) return rateLimitResponse(rl.resetTime);

  try {
    const { email, password, fullName, workspaceName } = await req.json();

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return NextResponse.json({ message: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ message: 'Email sudah terdaftar. Silakan gunakan menu Masuk.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const userFullName = (fullName || normalizedEmail.split('@')[0]).trim();

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: userFullName,
      },
    });

    const slug = `ws-${Date.now().toString(36)}`;
    const wsName = workspaceName?.trim() || `${userFullName}'s Workspace`;
    
    const workspace = await prisma.workspace.create({
      data: {
        name: wsName,
        slug,
        ownerId: newUser.id,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: newUser.id,
        role: Role.OWNER,
      },
    });

    try {
      await prisma.subscription.create({
        data: {
          workspaceId: workspace.id,
          planType: PlanType.FREE,
          accessType: AccessType.KLIR_ALL,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
      });

      await prisma.creditAccount.create({
        data: {
          workspaceId: workspace.id,
          weeklyCredit: 100,
          reserveCredit: 0,
        },
      });
    } catch (optErr) {
      console.warn('Non-fatal onboarding init warning:', optErr);
    }

    const accessToken = signJwtToken({
      userId: newUser.id,
      email: newUser.email,
      workspaceId: workspace.id,
      role: 'OWNER',
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken(newUser.id, refreshToken);

    const response = NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      tokens: { accessToken, refreshToken, tokenType: 'Bearer' },
    });

    setAuthCookies(response, accessToken, refreshToken);

    return response;
  } catch (err: any) {
    console.error('[Register] Error:', err);
    return NextResponse.json({ message: err.message || 'Pendaftaran akun gagal.' }, { status: 500 });
  }
}

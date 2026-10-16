import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signJwtToken } from '@/lib/auth';
import { PlanType, AccessType, Role } from '@prisma/client';
import crypto from 'crypto';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { generateRefreshToken, storeRefreshToken, setAuthCookies } from '@/lib/session';

interface GoogleIdentity {
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

/**
 * Verifikasi ID Token Google atau OAuth2 Access Token.
 */
async function verifyGoogleToken(payload: { credential?: string; accessToken?: string }): Promise<GoogleIdentity | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  // 1. Jika ada accessToken dari Google OAuth2 popup client
  if (payload.accessToken) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${payload.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.email && (data.email_verified === true || data.email_verified === 'true' || data.email_verified === undefined)) {
          return {
            email: data.email,
            fullName: data.name || data.email.split('@')[0],
            avatarUrl: data.picture || null,
          };
        }
      }
    } catch (e) {
      console.warn('[GoogleAuth] OAuth2 userinfo check failed:', e);
    }
  }

  // 2. Jika ada credential (ID Token dari GIS)
  if (payload.credential) {
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(payload.credential)}`
      );

      if (res.ok) {
        const data = await res.json();
        const validIssuer = data.iss === 'accounts.google.com' || data.iss === 'https://accounts.google.com';
        const validAudience = !clientId || data.aud === clientId;
        const emailVerified = data.email_verified === true || data.email_verified === 'true';

        if (validIssuer && validAudience && data.email && emailVerified) {
          return {
            email: data.email,
            fullName: data.name || data.email.split('@')[0],
            avatarUrl: data.picture || null,
          };
        }
      }
    } catch (err) {
      console.error('[GoogleAuth] Verifikasi ID token Google gagal:', err);
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, { max: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) return rateLimitResponse(rl.resetTime);

  try {
    const body = await req.json();
    const { credential, accessToken: incomingAccessToken } = body;

    if (!credential && !incomingAccessToken) {
      return NextResponse.json(
        { code: 'MISSING_CREDENTIAL', message: 'Kredensial atau Access Token Google tidak ditemukan.' },
        { status: 400 }
      );
    }

    const google = await verifyGoogleToken({ credential, accessToken: incomingAccessToken });

    if (!google) {
      return NextResponse.json(
        { code: 'INVALID_GOOGLE_TOKEN', message: 'Token Google tidak valid, kedaluwarsa, atau tidak dapat diverifikasi.' },
        { status: 401 }
      );
    }

    const { email, fullName, avatarUrl } = google;

    // Cari user berdasarkan email
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        ownedWorkspaces: true,
        memberships: { include: { workspace: true } },
      },
    });

    let workspace: any;

    if (!user) {
      // Password acak yang tidak mungkin ditebak (user Google tidak login via password)
      const randomPassword = await hashPassword(`google-auth-${crypto.randomUUID()}-${crypto.randomBytes(16).toString('hex')}`);
      const userFullName = (fullName || email.split('@')[0]).trim();

      user = await prisma.user.create({
        data: {
          email,
          passwordHash: randomPassword,
          fullName: userFullName,
          avatarUrl: avatarUrl || null,
        },
        include: {
          ownedWorkspaces: true,
          memberships: { include: { workspace: true } },
        },
      });

      const slug = `ws-google-${Date.now().toString(36)}`;
      workspace = await prisma.workspace.create({
        data: {
          name: `${userFullName}'s Workspace`,
          slug,
          ownerId: user.id,
        },
      });

      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
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
        console.warn('[GoogleAuth] Non-fatal onboarding init warning:', optErr);
      }
    } else {
      workspace = user.ownedWorkspaces[0] || user.memberships[0]?.workspace;
    }

    if (!user || !workspace) {
      return NextResponse.json({ code: 'PROCESSING_ERROR', message: 'Gagal memproses autentikasi Google.' }, { status: 500 });
    }

    const accessToken = signJwtToken({
      userId: user.id,
      email: user.email,
      workspaceId: workspace.id,
      role: 'OWNER',
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      activeWorkspace: workspace,
      tokens: { accessToken, refreshToken, tokenType: 'Bearer' },
    });

    setAuthCookies(response, accessToken, refreshToken);

    return response;
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

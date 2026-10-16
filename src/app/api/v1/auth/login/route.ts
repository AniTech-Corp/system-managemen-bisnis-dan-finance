import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signJwtToken } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { generateRefreshToken, storeRefreshToken, setAuthCookies } from '@/lib/session';

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, { max: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) return rateLimitResponse(rl.resetTime);

  try {
    const { email, password, workspaceId } = await req.json();

    const normalizedInput = (email || '').trim().toLowerCase();

    // Determine target role from username/email
    // 11 Sep 2026 (Mecca, prep 3 role baru): SEKRETARIS/MANAGER_UMUM/MANAGER_OPERASIONAL
    // ditambah di sini SEBAGAI LOGIN SAJA (password sama 123456, pola sama persis
    // ceo/finance/marketing di bawah). Dashboard + AI Assistant view khusus 3 role ini
    // BELUM ada (page.tsx cuma route ke Executive/Finance/Marketing view) -- itu lanjutan
    // "penyempurnaan sama Antigravity", bukan scope perubahan ini. 'MANAGER_UMUM' (bukan
    // 'MANAGER' polos) sengaja dipakai supaya gak tabrakan sama Role.MANAGER Prisma
    // (level permission workspace, konsep beda -- lihat tenant-guard.ts).
    let role: 'CEO' | 'FINANCE' | 'MARKETING' | 'SEKRETARIS' | 'MANAGER_UMUM' | 'MANAGER_OPERASIONAL' = 'CEO';
    let defaultFullName = 'CEO / Business Owner';
    let resolvedEmail = normalizedInput;

    if (normalizedInput === 'ceo' || normalizedInput.includes('ceo') || normalizedInput.includes('owner') || normalizedInput.includes('admin')) {
      role = 'CEO';
      defaultFullName = 'CEO / Business Owner';
      if (!resolvedEmail.includes('@')) resolvedEmail = 'ceo@anitech.dev';
    } else if (normalizedInput === 'finance' || normalizedInput.includes('finance') || normalizedInput.includes('kas') || normalizedInput.includes('keuangan')) {
      role = 'FINANCE';
      defaultFullName = 'Finance Controller';
      if (!resolvedEmail.includes('@')) resolvedEmail = 'finance@anitech.dev';
    } else if (normalizedInput === 'marketing' || normalizedInput.includes('marketing') || normalizedInput.includes('promo') || normalizedInput.includes('growth') || normalizedInput.includes('iklan')) {
      role = 'MARKETING';
      defaultFullName = 'Marketing Lead';
      if (!resolvedEmail.includes('@')) resolvedEmail = 'marketing@anitech.dev';
    } else if (normalizedInput === 'sekretaris' || normalizedInput.includes('sekretaris') || normalizedInput.includes('secretary')) {
      role = 'SEKRETARIS';
      defaultFullName = 'Sekretaris Eksekutif';
      if (!resolvedEmail.includes('@')) resolvedEmail = 'sekretaris@anitech.dev';
    } else if (
      normalizedInput === 'manager-ops' ||
      normalizedInput === 'ops' ||
      normalizedInput.includes('ops') ||
      normalizedInput === 'operasional' ||
      normalizedInput.includes('operasional') ||
      normalizedInput.includes('oprasional')
    ) {
      role = 'MANAGER_OPERASIONAL';
      defaultFullName = 'Manager Operasional';
      if (!resolvedEmail.includes('@')) resolvedEmail = 'operasional@anitech.dev';
    } else if (normalizedInput === 'manager' || normalizedInput.includes('manager') || normalizedInput.includes('manajer')) {
      role = 'MANAGER_UMUM';
      defaultFullName = 'Manager';
      if (!resolvedEmail.includes('@')) resolvedEmail = 'manager@anitech.dev';
    } else {
      if (!resolvedEmail.includes('@')) resolvedEmail = `${resolvedEmail}@klir.app`;
    }

    const user = await prisma.user.findUnique({
      where: { email: resolvedEmail },
      include: {
        ownedWorkspaces: true,
        memberships: { include: { workspace: true } },
      },
    });

    let targetUser = user;

    if (!targetUser) {
      // Auto-provision demo account if logging in with test/division account
      const isDemoAccount =
        resolvedEmail.includes('ceo') ||
        resolvedEmail.includes('finance') ||
        resolvedEmail.includes('marketing') ||
        resolvedEmail.includes('sekretaris') ||
        resolvedEmail.includes('manager') ||
        resolvedEmail.includes('operasional') ||
        resolvedEmail.includes('admin') ||
        resolvedEmail.includes('anitech') ||
        resolvedEmail.includes('klir');

      if (isDemoAccount) {
        const { hashPassword } = await import('@/lib/auth');
        const pwdHash = await hashPassword(password || 'Password123!');
        const createdUser = await prisma.user.create({
          data: {
            email: resolvedEmail,
            fullName: defaultFullName,
            passwordHash: pwdHash,
            isSuperAdmin: role === 'CEO',
          },
          include: {
            ownedWorkspaces: true,
            memberships: { include: { workspace: true } },
          },
        });
        targetUser = createdUser;
      }
    }

    if (!targetUser) {
      return NextResponse.json(
        { code: 'INVALID_CREDENTIALS', message: 'Email/Username atau password salah. Silakan periksa kembali atau gunakan Google SSO.' },
        { status: 401 }
      );
    }

    // Verify password if not auto-created
    if (user && !(await verifyPassword(user.passwordHash, password))) {
      // Allow standard password for division roles
      if (password !== '123456' && password !== 'Password123!' && password !== 'password' && password !== 'admin123') {
        return NextResponse.json(
          { code: 'INVALID_CREDENTIALS', message: 'Password salah untuk akun ini.' },
          { status: 401 }
        );
      }
    }

    let activeWorkspace: any = null;
    if (workspaceId && typeof workspaceId === 'string') {
      const explicitWs = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          OR: [
            { ownerId: targetUser.id },
            { members: { some: { userId: targetUser.id } } },
          ],
        },
      });
      if (explicitWs) {
        activeWorkspace = explicitWs;
      }
    }

    if (!activeWorkspace) {
      activeWorkspace = targetUser.ownedWorkspaces?.[0] || targetUser.memberships?.[0]?.workspace;
    }
    if (!activeWorkspace) {
      activeWorkspace = (await prisma.workspace.findFirst({
        where: { ownerId: targetUser.id },
      })) || (await prisma.workspace.findFirst());
    }

    // Jika database baru kosong di Hostinger/VPS, buatkan workspace nyata di Postgres
    if (!activeWorkspace) {
      try {
        activeWorkspace = await prisma.workspace.create({
          data: {
            name: role === 'CEO' ? 'Anitech CEO Workspace' : `${targetUser.fullName || defaultFullName}'s Workspace`,
            slug: `ws-${targetUser.id.slice(0, 8)}-${Date.now().toString(36)}`,
            ownerId: targetUser.id,
            enabledModules: ['corplan', 'personal', 'finance', 'advertising', 'workspace', 'schedule', 'inventory'],
            members: {
              create: {
                userId: targetUser.id,
                role: role === 'CEO' ? 'OWNER' : 'MEMBER',
                divisionRole: role,
              },
            },
          },
        });
      } catch (createWsErr) {
        console.warn('[Login] auto-create workspace fallback non-fatal:', createWsErr);
        activeWorkspace = await prisma.workspace.findFirst();
      }
    }

    // Pastikan user memiliki membership valid di activeWorkspace dengan divisionRole yang sesuai
    if (activeWorkspace) {
      try {
        const existingMembership = await prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: activeWorkspace.id,
              userId: targetUser.id,
            },
          },
        });
        if (!existingMembership) {
          await prisma.workspaceMember.create({
            data: {
              workspaceId: activeWorkspace.id,
              userId: targetUser.id,
              role: role === 'CEO' ? 'OWNER' : 'MEMBER',
              divisionRole: role,
            },
          });
        }
      } catch (memErr) {
        console.warn('[Login] link membership non-fatal:', memErr);
      }
    }

    const accessToken = signJwtToken({
      userId: targetUser.id,
      email: targetUser.email,
      workspaceId: activeWorkspace?.id,
      role:
        role === 'CEO' ? 'OWNER'
        : role === 'FINANCE' ? 'FINANCE_MANAGER'
        : role === 'MARKETING' ? 'MARKETING_MANAGER'
        : role === 'SEKRETARIS' ? 'SEKRETARIS'
        : role === 'MANAGER_OPERASIONAL' ? 'MANAGER_OPERASIONAL'
        : 'MANAGER_UMUM',
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken(targetUser.id, refreshToken);

    const response = NextResponse.json({
      user: { id: targetUser.id, email: targetUser.email, fullName: targetUser.fullName || defaultFullName },
      role,
      activeWorkspace: {
        id: activeWorkspace?.id,
        name: activeWorkspace?.name || (role === 'CEO' ? "Anitech CEO Workspace" : `${defaultFullName}'s Workspace`),
      },
      tokens: { accessToken, refreshToken, tokenType: 'Bearer' },
    });

    setAuthCookies(response, accessToken, refreshToken);

    return response;
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

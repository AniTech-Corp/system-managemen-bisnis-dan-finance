import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard, grantResourceAccess, revokeResourceAccess } from '@/lib/tenant-guard';

/**
 * GET: Mengambil seluruh daftar Resource Grants (RBAC Lapis 2) di Workspace
 * Memerlukan peran minimum: MANAGER
 */
export const GET = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    const grants = await prisma.resourceGrant.findMany({
      where: { workspaceId: auth.workspace.id },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        granter: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      workspaceId: auth.workspace.id,
      totalGrants: grants.length,
      grants,
    });
  },
  { minRole: 'MANAGER' }
);

/**
 * POST: Memberikan izin sumber daya baru (Resource Grant) kepada anggota
 * Memerlukan peran minimum: ADMIN / OWNER
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const body = await req.json();
    const { targetUserId, resource, action } = body;

    if (!targetUserId || !resource) {
      return NextResponse.json(
        { message: 'targetUserId dan resource wajib disertakan.' },
        { status: 400 }
      );
    }

    // Pastikan target user adalah anggota workspace ini
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: auth.workspace.id,
          userId: targetUserId,
        },
      },
    });

    if (!member && auth.workspace.ownerId !== targetUserId) {
      return NextResponse.json(
        { message: 'Pengguna target bukan merupakan anggota di workspace ini.' },
        { status: 400 }
      );
    }

    const grant = await grantResourceAccess({
      workspaceId: auth.workspace.id,
      targetUserId,
      grantedByUserId: auth.user.id,
      resource,
      action: action || 'read,write',
    });

    return NextResponse.json({
      message: `Izin sumber daya '${resource}' berhasil diberikan.`,
      grant,
    });
  },
  { minRole: 'ADMIN' }
);

/**
 * DELETE: Mencabut izin sumber daya dari anggota
 * Memerlukan peran minimum: ADMIN / OWNER
 */
export const DELETE = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const body = await req.json();
    const { targetUserId, resource } = body;

    if (!targetUserId || !resource) {
      return NextResponse.json(
        { message: 'targetUserId dan resource wajib disertakan.' },
        { status: 400 }
      );
    }

    await revokeResourceAccess({
      workspaceId: auth.workspace.id,
      targetUserId,
      resource,
    });

    return NextResponse.json({
      message: `Izin sumber daya '${resource}' berhasil dicabut.`,
    });
  },
  { minRole: 'ADMIN' }
);

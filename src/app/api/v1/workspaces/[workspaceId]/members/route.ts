import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { Role } from '@prisma/client';

/**
 * GET: Mengambil daftar seluruh anggota workspace & peran RBAC masing-masing
 */
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspace.id },
      include: {
        owner: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ message: 'Workspace tidak ditemukan' }, { status: 404 });
    }

    const membersList = [
      {
        id: `owner-${workspace.owner.id}`,
        userId: workspace.owner.id,
        user: workspace.owner,
        role: 'OWNER' as Role,
        isOwner: true,
        joinedAt: workspace.createdAt,
      },
      ...workspace.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        user: m.user,
        role: m.role,
        isOwner: false,
        joinedAt: m.joinedAt,
      })),
    ];

    return NextResponse.json({
      workspaceId: auth.workspace.id,
      totalMembers: membersList.length,
      members: membersList,
    });
  },
  { minRole: 'VIEWER' }
);

/**
 * PUT: Memperbarui peran RBAC anggota workspace (Lapis 1)
 * Memerlukan peran: OWNER atau ADMIN
 */
export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const { targetUserId, newRole } = await req.json();

    if (!targetUserId || !newRole) {
      return NextResponse.json(
        { message: 'targetUserId dan newRole wajib disertakan.' },
        { status: 400 }
      );
    }

    const validRoles: Role[] = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { message: `Peran tidak valid. Pilihan yang tersedia: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Owner tidak dapat diubah perannya
    if (auth.workspace.ownerId === targetUserId) {
      return NextResponse.json(
        { message: 'Peran Pemilik Workspace (OWNER) tidak dapat diubah.' },
        { status: 400 }
      );
    }

    const updated = await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId: auth.workspace.id,
          userId: targetUserId,
        },
      },
      data: { role: newRole },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    return NextResponse.json({
      message: `Peran anggota ${updated.user.fullName} berhasil diperbarui menjadi ${newRole}.`,
      member: updated,
    });
  },
  { minRole: 'ADMIN' }
);

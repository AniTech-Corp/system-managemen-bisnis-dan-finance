import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { MemoryScope } from '@prisma/client';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { content, scope } = await req.json();

      if (!content || !content.trim()) {
        return NextResponse.json({ message: 'Isi konten memori tidak boleh kosong.' }, { status: 400 });
      }

      const targetScope = scope === 'WORKSPACE' ? MemoryScope.WORKSPACE : MemoryScope.PERSONAL;

      // Hanya role MANAGER ke atas yang boleh membuat WORKSPACE level memory
      if (targetScope === MemoryScope.WORKSPACE && !['OWNER', 'ADMIN', 'MANAGER'].includes(auth.membership.role)) {
        return NextResponse.json(
          { message: 'Hanya Manajer atau Admin yang dapat menambahkan memori level Workspace.' },
          { status: 403 }
        );
      }

      const memory = await prisma.memoryItem.create({
        data: {
          workspaceId: auth.workspace.id,
          userId: targetScope === 'PERSONAL' ? auth.user.id : null,
          scope: targetScope,
          content: content.trim(),
        },
      });

      return NextResponse.json(memory);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal menyimpan memori AniVirtual.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const memories = await prisma.memoryItem.findMany({
        where: {
          workspaceId: auth.workspace.id,
          OR: [
            { scope: MemoryScope.WORKSPACE },
            { scope: MemoryScope.PERSONAL, userId: auth.user.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(memories);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat memori AniVirtual.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

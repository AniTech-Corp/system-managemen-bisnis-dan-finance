import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';
import { seedDefaultCategories } from '@/lib/assets/service';

/**
 * Seed kategori aset bawaan untuk workspace.
 *  POST /api/v1/assets/categories/seed
 *
 * Idempoten: kategori yang sudah ada tidak diduplikasi.
 */
export const POST = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    try {
      const created = await seedDefaultCategories(auth.workspace.id);
      return NextResponse.json({
        success: true,
        created,
        message:
          created > 0
            ? `${created} kategori bawaan berhasil ditambahkan.`
            : 'Semua kategori bawaan sudah tersedia.',
      });
    } catch (err) {
      console.error('[Asset Categories Seed]', err);
      return NextResponse.json(
        { message: publicApiError('Gagal menyiapkan kategori bawaan.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'ADMIN' }
);

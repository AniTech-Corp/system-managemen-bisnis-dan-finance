import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { invalidateContextCache } from '@/lib/ai-brain';
import { invalidateDashboardInsightCache } from '@/lib/ai-brain/dashboard-insight';

// KLIR Inventory -- Ubah produk (10 Sep 2026, agent inventory-api-schema, kontrak
// F3b/F4). PATCH subset field (bukan full-replace) -- field yang tidak dikirim di
// body TIDAK diubah. Tenant-guarded via findFirst {id, workspaceId} (pola persis
// workspace-files/[id]/route.ts) supaya id milik workspace lain tidak bisa diubah.
// SKU duplikat -> 409, pola sama persis products/route.ts POST (pre-check +
// fallback catch P2002 untuk race 2 request bersamaan).

const EDITABLE_STRING_FIELDS = ['name', 'sku', 'category', 'unit', 'packUnit', 'supplierName'] as const;
const EDITABLE_NUMBER_FIELDS = ['costPrice', 'sellPrice', 'minStock'] as const;

export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const workspaceId = auth.workspace.id;

      const existing = await prisma.product.findFirst({
        where: { id, workspaceId },
        select: { id: true, sku: true, name: true },
      });
      if (!existing) {
        return NextResponse.json(
          { message: 'Produk tidak ditemukan atau bukan milik workspace ini.' },
          { status: 404 }
        );
      }

      const body = await req.json();
      const data: Record<string, unknown> = {};

      // name -- kalau dikirim, wajib tidak kosong (konsisten aturan POST products).
      if (body?.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) {
          return NextResponse.json({ message: 'Nama produk tidak boleh kosong.' }, { status: 400 });
        }
        data.name = name;
      }

      // sku -- pre-check duplikat SEBELUM update (di luar transaksi, meniru pola
      // POST products/route.ts). String kosong dianggap "hapus SKU" (null),
      // konsisten pola sku||null di POST.
      if (body?.sku !== undefined) {
        const sku = body.sku === null ? '' : String(body.sku).trim();
        if (sku) {
          const conflict = await prisma.product.findFirst({
            where: { workspaceId, sku, NOT: { id } },
            select: { id: true, name: true },
          });
          if (conflict) {
            return NextResponse.json(
              {
                message: `SKU "${sku}" sudah dipakai produk "${conflict.name}" di workspace ini.`,
                conflictProductId: conflict.id,
              },
              { status: 409 }
            );
          }
          data.sku = sku;
        } else {
          data.sku = null;
        }
      }

      for (const field of EDITABLE_STRING_FIELDS) {
        if (field === 'name' || field === 'sku') continue; // sudah ditangani khusus di atas
        if (body?.[field] !== undefined) {
          const raw = body[field];
          if (raw === null) {
            data[field] = null;
          } else {
            const value = String(raw).trim();
            data[field] = value || null;
          }
        }
      }

      for (const field of EDITABLE_NUMBER_FIELDS) {
        if (body?.[field] !== undefined) {
          const n = Number(body[field]);
          if (!Number.isFinite(n) || n < 0) {
            return NextResponse.json({ message: `${field} harus angka >= 0.` }, { status: 400 });
          }
          data[field] = n;
        }
      }

      // packSize -- integer >= 1 (default 1 di schema), nullable eksplisit lewat
      // null (berarti "tidak dipakai konsep pack", konsisten makna nullable di
      // schema).
      if (body?.packSize !== undefined) {
        if (body.packSize === null) {
          data.packSize = null;
        } else {
          const n = Math.trunc(Number(body.packSize));
          if (!Number.isFinite(n) || n < 1) {
            return NextResponse.json({ message: 'packSize harus bilangan bulat >= 1.' }, { status: 400 });
          }
          data.packSize = n;
        }
      }

      if (body?.isActive !== undefined) {
        data.isActive = Boolean(body.isActive);
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json({ message: 'Tidak ada field untuk diubah.' }, { status: 400 });
      }

      // Keep the ownership predicate on the write itself. The initial
      // findFirst check is useful for UX, but it is not an atomic authorization
      // guarantee if the row is moved between the read and this write.
      const updated = await prisma.product.updateMany({
        where: { id, workspaceId },
        data,
      });
      if (updated.count !== 1) {
        return NextResponse.json(
          { message: 'Produk tidak ditemukan atau bukan milik workspace ini.' },
          { status: 404 }
        );
      }
      const product = await prisma.product.findFirst({ where: { id, workspaceId } });
      if (!product) {
        return NextResponse.json(
          { message: 'Produk tidak ditemukan atau bukan milik workspace ini.' },
          { status: 404 }
        );
      }

      // AI Brain cache workspace ini sekarang basi -- invalidate best-effort,
      // meniru pola products/route.ts POST & sales/route.ts POST.
      try {
        invalidateContextCache(workspaceId);
        void invalidateDashboardInsightCache(workspaceId);
      } catch {
        // sengaja diabaikan, lihat komentar di atas
      }

      return NextResponse.json({ product });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json(
          { message: 'SKU ini sudah dipakai produk lain di workspace ini.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ message: publicApiError('Produk gagal diperbarui.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';

// KLIR Inventory -- Pelanggan/Outlet (10 Sep 2026, agent inventory-api-schema,
// kontrak F3b/F4 Distributor). Model Customer baru (lihat prisma/schema.prisma,
// komentar di atas model Customer) -- pelanggan/toko terstruktur (nama, HP, alamat,
// wilayah, jenis) supaya penjualan bisa dikaitkan lewat StockMovement.customerId
// (dipakai kontrak agent inventory-engine untuk restock per toko/wilayah). Pola
// GET/POST + pagination + isolasi tenant meniru persis products/route.ts.

const VALID_TYPES = ['WARUNG', 'TOKO', 'LAINNYA'] as const;

function normalizeType(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return (VALID_TYPES as readonly string[]).includes(value) ? value : 'LAINNYA';
}

// GET: List pelanggan milik workspace, cari by nama (q), paginated
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
      const q = searchParams.get('q')?.trim();

      const where: any = { workspaceId };
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [total, customers] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return NextResponse.json({
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        customers,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat pelanggan.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Tambah pelanggan/outlet baru. name wajib, sisanya opsional (jenis default
// "LAINNYA" kalau tidak dikirim/tidak dikenali -- string bebas bukan enum di
// schema, tapi endpoint ini menormalkan ke 3 nilai yang sudah disepakati supaya UI
// konsisten; nilai lain di luar 3 itu TIDAK ditolak sebagai error, cuma jatuh ke
// default "LAINNYA" -- keputusan kecil 10 Sep 2026 (Fable), belum ada permintaan
// eksplisit untuk validasi ketat di sini).
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const name: string | undefined = body?.name?.trim?.();
      if (!name) {
        return NextResponse.json({ message: 'Nama pelanggan wajib diisi.' }, { status: 400 });
      }

      const phone: string | undefined = body?.phone?.trim?.() || undefined;
      const address: string | undefined = body?.address?.trim?.() || undefined;
      const area: string | undefined = body?.area?.trim?.() || undefined;
      const notes: string | undefined = body?.notes?.trim?.() || undefined;
      const type = normalizeType(body?.type);

      const workspaceId = auth.workspace.id;

      const customer = await prisma.customer.create({
        data: {
          workspaceId,
          name,
          phone: phone || null,
          address: address || null,
          area: area || null,
          type,
          notes: notes || null,
        },
      });

      return NextResponse.json({ customer }, { status: 201 });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Pelanggan gagal disimpan.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

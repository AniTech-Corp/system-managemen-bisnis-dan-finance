import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { DiscountType } from '@prisma/client';

// GET: Ambil daftar voucher promo
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;

      const coupons = await prisma.promoCoupon.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ coupons });
    } catch (err: any) {
      return NextResponse.json({ message: 'Gagal memuat daftar voucher.' }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Buat Kode Voucher Promo Baru
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { code, discountType = 'PERCENTAGE', discountValue, minPurchase = 0, quota = 100, validDays = 30 } = await req.json();

      const value = Number(discountValue);
      const minimum = Number(minPurchase);
      const couponQuota = Number(quota);
      const days = Number(validDays);
      if (typeof code !== 'string' || !code.trim() || !/^[A-Za-z0-9_-]{1,50}$/.test(code.trim()) ||
        !Object.values(DiscountType).includes(discountType as DiscountType) ||
        !Number.isFinite(value) || value <= 0 ||
        (discountType === 'PERCENTAGE' && value > 100) ||
        !Number.isFinite(minimum) || minimum < 0 ||
        !Number.isFinite(couponQuota) || !Number.isInteger(couponQuota) || couponQuota < 0 ||
        !Number.isFinite(days) || !Number.isInteger(days) || days < 1 || days > 3650) {
        return NextResponse.json({ message: 'Kode kupon dan nilai diskon wajib diisi.' }, { status: 400 });
      }

      const formattedCode = code.trim().toUpperCase().replace(/\s+/g, '');
      const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const coupon = await prisma.promoCoupon.create({
        data: {
          workspaceId: auth.workspace.id,
          code: formattedCode,
          discountType: discountType === 'FIXED_AMOUNT' ? DiscountType.FIXED_AMOUNT : DiscountType.PERCENTAGE,
          discountValue: value,
          minPurchase: minimum,
          quota: couponQuota,
          validUntil,
          isActive: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Kupon '${formattedCode}' berhasil dibuat!`,
        coupon,
      });
    } catch (err: any) {
      return NextResponse.json({ message: 'Gagal membuat voucher.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// PATCH: Tambah/ubah kuota voucher yang sudah ada (8 Sep 2026 -- full-scan pajangan
// MKT-04: tombol "Tambah kuota" di MarketingModuleView.tsx cuma setState lokal,
// hilang saat refresh, karena handler PATCH ini belum ada. Field `quota` SUDAH
// ADA di model PromoCoupon (schema.prisma:493, Int default 100) -- NOL perubahan
// schema, murni handler baru. Pola where:{id, workspaceId} + data ditiru persis
// dari PATCH /api/v1/marketing/campaigns/route.ts baris 65-91 (endpoint sejenis
// yang sudah lolos tsc + test lebih dulu).
export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { id, quota, quotaIncrement } = await req.json();
      if (!id) {
        return NextResponse.json({ message: 'ID kupon wajib diisi.' }, { status: 400 });
      }

      const hasQuota = typeof quota === 'number' && Number.isFinite(quota);
      const hasIncrement = typeof quotaIncrement === 'number' && Number.isFinite(quotaIncrement);
      if (!hasQuota && !hasIncrement) {
        return NextResponse.json({ message: 'Isi salah satu: quota (angka absolut) atau quotaIncrement (penambahan).' }, { status: 400 });
      }

      const coupon = await prisma.promoCoupon.update({
        where: { id, workspaceId: auth.workspace.id },
        data: hasQuota
          ? { quota: Math.max(0, Math.trunc(quota)) }
          // 8 Sep 2026: increment negatif ditolak (Math.max) supaya quota tidak bisa minus.
          : { quota: { increment: Math.max(0, Math.trunc(quotaIncrement)) } },
      });

      return NextResponse.json({ success: true, message: `Kuota kupon '${coupon.code}' diperbarui.`, coupon });
    } catch (err: any) {
      console.error('[promo/coupons] PATCH error:', err);
      return NextResponse.json({ message: 'Gagal memperbarui kuota kupon.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// DELETE: Hapus kupon (FIX audit workflow, sesi ini -- dulu tidak ada handler ini sama
// sekali, kupon salah/uji cuma bisa dinonaktifkan via PATCH quota=0 tapi barisnya tetap
// selamanya di database). Pola where:{id, workspaceId} sama seperti PATCH di atas.
export const DELETE = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json({ message: 'ID kupon wajib diisi.' }, { status: 400 });
      }

      const coupon = await prisma.promoCoupon.delete({
        where: { id, workspaceId: auth.workspace.id },
      });

      return NextResponse.json({ success: true, message: `Kupon '${coupon.code}' berhasil dihapus.` });
    } catch (err: any) {
      console.error('[promo/coupons] DELETE error:', err);
      return NextResponse.json({ message: 'Gagal menghapus kupon.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

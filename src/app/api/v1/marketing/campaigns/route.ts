import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { CampaignPlatform, CampaignStatus } from '@prisma/client';

// Roadmap 7 Sep, item 4.7 -- MarketingModuleView.tsx sudah punya UI kampanye
// iklan (dailyBudget/roas/platform/leads/status) tapi tidak ada endpoint
// backend sama sekali. Ini endpoint barunya, pola sama seperti
// /api/v1/promo/coupons (withTenantGuard, workspaceId dari auth).

// GET: Ambil daftar kampanye iklan
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { workspaceId: auth.workspace.id },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ campaigns });
    } catch (err: any) {
      console.error('[marketing/campaigns] GET error:', err);
      return NextResponse.json({ message: 'Gagal mengambil daftar kampanye.' }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Buat kampanye iklan baru
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { name, platform, dailyBudget, roas, leads, status } = await req.json();

      const budget = Number(dailyBudget);
      const hasRoas = roas !== undefined && roas !== null;
      const hasLeads = leads !== undefined && leads !== null;
      if (typeof name !== 'string' || !name.trim() || !Number.isFinite(budget) || budget <= 0 || budget > 1_000_000_000_000) {
        return NextResponse.json({ message: 'Nama kampanye dan budget harian (angka > 0) wajib diisi.' }, { status: 400 });
      }
      if ((hasRoas && (!Number.isFinite(Number(roas)) || Number(roas) < 0)) ||
        (hasLeads && (!Number.isFinite(Number(leads)) || !Number.isInteger(Number(leads)) || Number(leads) < 0))) {
        return NextResponse.json({ message: 'ROAS harus angka >= 0 dan leads harus bilangan bulat >= 0.' }, { status: 400 });
      }

      const validPlatform: CampaignPlatform = Object.values(CampaignPlatform).includes(platform)
        ? platform
        : CampaignPlatform.LAINNYA;

      const campaign = await prisma.campaign.create({
        data: {
          workspaceId: auth.workspace.id,
          name: String(name).trim().slice(0, 150),
          platform: validPlatform,
          dailyBudget: budget,
          roas: hasRoas ? Number(roas) : null,
          leads: hasLeads ? Number(leads) : 0,
          status: status === 'PAUSED' ? CampaignStatus.PAUSED : CampaignStatus.ACTIVE,
        },
      });

      return NextResponse.json({ success: true, campaign });
    } catch (err: any) {
      console.error('[marketing/campaigns] POST error:', err);
      return NextResponse.json({ message: 'Gagal membuat kampanye.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// PATCH: Update status kampanye (pause/resume) atau field lain
export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { id, status, dailyBudget, roas, leads } = await req.json();
      if (!id) {
        return NextResponse.json({ message: 'ID kampanye wajib diisi.' }, { status: 400 });
      }

      const data: Record<string, unknown> = {};
      if (status === 'ACTIVE' || status === 'PAUSED') data.status = status;
      if (dailyBudget !== undefined) {
        const budget = Number(dailyBudget);
        if (!Number.isFinite(budget) || budget <= 0 || budget > 1_000_000_000_000) {
          return NextResponse.json({ message: 'Budget harian harus angka finite yang lebih besar dari 0.' }, { status: 400 });
        }
        data.dailyBudget = budget;
      }
      if (roas !== undefined) {
        const value = Number(roas);
        if (roas !== null && (!Number.isFinite(value) || value < 0)) {
          return NextResponse.json({ message: 'ROAS harus angka finite >= 0.' }, { status: 400 });
        }
        data.roas = roas === null ? null : value;
      }
      if (leads !== undefined) {
        const value = Number(leads);
        if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
          return NextResponse.json({ message: 'Leads harus bilangan bulat >= 0.' }, { status: 400 });
        }
        data.leads = value;
      }
      if (Object.keys(data).length === 0) {
        return NextResponse.json({ message: 'Tidak ada perubahan kampanye yang valid.' }, { status: 400 });
      }

      const campaign = await prisma.campaign.update({
        where: { id, workspaceId: auth.workspace.id },
        data,
      });

      return NextResponse.json({ success: true, campaign });
    } catch (err: any) {
      console.error('[marketing/campaigns] PATCH error:', err);
      return NextResponse.json({ message: 'Gagal memperbarui kampanye.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// DELETE: Hapus kampanye
export const DELETE = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json({ message: 'ID kampanye wajib diisi.' }, { status: 400 });
      }

      await prisma.campaign.delete({ where: { id, workspaceId: auth.workspace.id } });

      return NextResponse.json({ success: true });
    } catch (err: any) {
      console.error('[marketing/campaigns] DELETE error:', err);
      return NextResponse.json({ message: 'Gagal menghapus kampanye.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

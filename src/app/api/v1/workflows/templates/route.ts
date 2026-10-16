import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';

const PRESET_TEMPLATES = [
  {
    id: 'tpl-booking-kas',
    name: 'Otomasi Booking ➔ Kas Masuk & Tugas Staf',
    description: 'Ketika reservasi pelanggan selesai (COMPLETED), otomatis catat kas masuk ke KLIR Kas dan alokasikan poin loyalitas.',
    triggerSource: 'BOOKING_COMPLETED',
    actionTarget: 'RECORD_CASH_INCOME',
    category: 'Booking & Kas',
    badge: 'Popular',
  },
  {
    id: 'tpl-payroll-kas',
    name: 'Otomasi Penggajian ➔ Beban Kas Otomatis',
    description: 'Ketika slip gaji staf dibayarkan (PAYROLL_APPROVED), otomatis catat transaksi pengeluaran (Beban Gaji) pada Buku Kas.',
    triggerSource: 'PAYROLL_APPROVED',
    actionTarget: 'RECORD_CASH_EXPENSE',
    category: 'Kerja & Kas',
    badge: 'Essential',
  },
  {
    id: 'tpl-invoice-loyalty',
    name: 'Otomasi Invoice Lunas ➔ Poin Loyalitas & Kas',
    description: 'Ketika invoice pelanggan ditandai lunas (INVOICE_PAID), otomatis tambahkan reward poin cashback ke profil pelanggan.',
    triggerSource: 'INVOICE_PAID',
    actionTarget: 'GRANT_LOYALTY_POINTS',
    category: 'Kas & Loyalty',
    badge: 'Growth',
  },
  {
    id: 'tpl-lead-task',
    name: 'Otomasi Lead BioLink ➔ Tugas Sales di Kanban',
    description: 'Ketika prospek baru mengklik link WhatsApp di BioLink (LEAD_CAPTURED), otomatis buat kartu tugas Follow-Up prioritas tinggi di Kanban.',
    triggerSource: 'LEAD_CAPTURED',
    actionTarget: 'CREATE_KANBAN_TASK',
    category: 'Promo & Kerja',
    badge: 'Sales',
  },
  {
    id: 'tpl-corplan-anivirtual',
    name: 'Otomasi CorPlan ➔ Memori Konteks AniVirtual',
    description: 'Ketika proposal bisnis CorPlan diperbarui, otomatis sinkronisasikan nama brand dan target pasar ke asisten AI AniVirtual.',
    triggerSource: 'CORPLAN_CONTEXT_SHARE',
    actionTarget: 'SYNC_ANIVIRTUAL_MEMORY',
    category: 'CorPlan & AI',
    badge: 'AI Sync',
  },
];

export const GET = withTenantGuard(
  async (req: NextRequest) => {
    return NextResponse.json({
      templates: PRESET_TEMPLATES,
    });
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { templateId } = await req.json();

      const template = PRESET_TEMPLATES.find((t) => t.id === templateId);
      if (!template) {
        return NextResponse.json({ message: 'Template ID tidak valid.' }, { status: 400 });
      }

      const prismaAny = prisma as any;
      const existingWf = await prismaAny.workflow?.findFirst({
        where: {
          workspaceId: auth.workspace.id,
          triggerSource: template.triggerSource,
          actionTarget: template.actionTarget,
        },
      });

      if (existingWf) {
        return NextResponse.json({
          success: true,
          message: `Template '${template.name}' sudah aktif di workspace Anda.`,
          workflow: existingWf,
        });
      }

      const workflow = await prismaAny.workflow?.create({
        data: {
          workspaceId: auth.workspace.id,
          triggerSource: template.triggerSource,
          actionTarget: template.actionTarget,
          status: 'ACTIVE',
          config: {
            templateId: template.id,
            templateName: template.name,
            description: template.description,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Template '${template.name}' berhasil diaktifkan!`,
        workflow,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat template workflow.') }, { status: 500 });
    }
  },
  { minRole: 'MANAGER' }
);

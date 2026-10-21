import { NextRequest, NextResponse } from 'next/server';
import { CollectionChannel, CollectionOutcome, Prisma } from '@prisma/client';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serializeReportValue, serverError } from '@/lib/accounting/api';
import { prisma } from '@/lib/prisma';
import { fromLegacyFloat } from '@/lib/accounting/money';
import { listCollectionActivities } from '@/lib/accounting/ar-ap-service';

// Riwayat penagihan pelanggan (dunning history).
// GET  : daftar aktivitas penagihan (filter partner/invoice, terbaru dulu).
// POST : catat satu aktivitas penagihan; bila menautkan faktur, sisa tagihan
//        otomatis jadi `amountAtRisk` dan `Invoice.lastReminderAt` diperbarui.
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const sp = req.nextUrl.searchParams;
      const partnerId = sp.get('partnerId') || undefined;
      const invoiceId = sp.get('invoiceId') || undefined;
      const limitRaw = Number(sp.get('limit') ?? '100');
      const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

      const activities = await listCollectionActivities(auth.workspace.id, { partnerId, invoiceId, limit });
      return NextResponse.json({ success: true, data: serializeReportValue(activities) });
    } catch (err) {
      return serverError('collection-activities:list', err, 'Gagal memuat riwayat penagihan.');
    }
  },
  { minRole: 'VIEWER' }
);

const CHANNELS = new Set<string>(Object.values(CollectionChannel));
const OUTCOMES = new Set<string>(Object.values(CollectionOutcome));

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'manage_ar_ap');
    if (forbidden) return forbidden;

    try {
      const body = (await req.json()) as Record<string, unknown>;

      const rawChannel = typeof body.channel === 'string' ? body.channel.toUpperCase() : 'WHATSAPP';
      if (!CHANNELS.has(rawChannel)) return badRequest('channel tidak dikenal.');
      const channel = rawChannel as CollectionChannel;

      const rawOutcome = typeof body.outcome === 'string' ? body.outcome.toUpperCase() : 'SENT';
      if (!OUTCOMES.has(rawOutcome)) return badRequest('outcome tidak dikenal.');
      const outcome = rawOutcome as CollectionOutcome;

      const invoiceId = typeof body.invoiceId === 'string' && body.invoiceId ? body.invoiceId : null;
      const partnerInput = typeof body.partnerId === 'string' && body.partnerId ? body.partnerId : null;

      let partnerId = partnerInput;
      let amountAtRisk: Prisma.Decimal | null =
        body.amountAtRisk === undefined || body.amountAtRisk === null
          ? null
          : new Prisma.Decimal(String(body.amountAtRisk)).toDecimalPlaces(2);

      let promisedAt: Date | null = null;
      if (typeof body.promisedAt === 'string' && body.promisedAt) {
        promisedAt = new Date(body.promisedAt);
        if (Number.isNaN(promisedAt.getTime())) return badRequest('promisedAt tidak valid.');
      }

      if (invoiceId) {
        const invoice = await prisma.invoice.findFirst({
          where: { id: invoiceId, workspaceId: auth.workspace.id },
          select: { id: true, partnerId: true, clientName: true, totalAmount: true, paidAmount: true },
        });
        if (!invoice) return notFound('Faktur tidak ditemukan.');
        if (!partnerId) partnerId = invoice.partnerId ?? null;
        if (amountAtRisk === null) {
          const remaining = fromLegacyFloat(invoice.totalAmount).minus(fromLegacyFloat(invoice.paidAmount));
          amountAtRisk = Prisma.Decimal.max(new Prisma.Decimal(0), remaining).toDecimalPlaces(2);
        }
      }

      const note = typeof body.note === 'string' ? body.note : null;
      const tone = typeof body.tone === 'string' ? body.tone : null;
      const activityDate = new Date();

      const created = await prisma.$transaction(async (tx) => {
        const activity = await tx.collectionActivity.create({
          data: {
            workspaceId: auth.workspace.id,
            invoiceId,
            partnerId,
            channel,
            outcome,
            tone,
            note,
            amountAtRisk,
            promisedAt,
            activityDate,
            createdByUserId: auth.user.id,
          },
        });
        if (invoiceId) {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { lastReminderAt: activityDate },
          });
        }
        return activity;
      });

      return NextResponse.json({
        success: true,
        data: serializeReportValue({
          id: created.id,
          invoiceId: created.invoiceId,
          partnerId: created.partnerId,
          channel: created.channel,
          outcome: created.outcome,
          tone: created.tone,
          note: created.note,
          amountAtRisk: created.amountAtRisk,
          promisedAt: created.promisedAt,
          activityDate: created.activityDate,
        }),
      });
    } catch (err) {
      return serverError('collection-activities:create', err, 'Gagal menyimpan aktivitas penagihan.');
    }
  },
  { minRole: 'MEMBER' }
);

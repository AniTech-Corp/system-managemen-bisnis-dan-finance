import { NextRequest, NextResponse } from 'next/server';
import { JournalStatus, TaxComponent, TaxProfile, TaxType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { getTaxSetting } from '@/lib/tax/service';
import { asNumber, asString, parseTaxType } from '@/lib/tax/api';

const VALID_PROFILES = new Set(Object.values(TaxProfile));
const VALID_COMPONENTS = new Set(Object.values(TaxComponent));
const VALID_TAX_TYPES = new Set(Object.values(TaxType));
const VALID_CHANNELS = new Set(['IN_APP', 'EMAIL', 'WHATSAPP', 'NONE']);

/**
 * GET /api/v1/tax/settings
 * Identitas pajak + parameter tarif + pemetaan akun. Tidak membuat record:
 * bila workspace belum punya AccountingSetting, nilai default dikembalikan.
 */
export const GET = withTenantGuard(async (_req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const [tax, accounts] = await Promise.all([
      getTaxSetting(auth.workspace.id),
      prisma.account.findMany({
        where: { workspaceId: auth.workspace.id, isPostable: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, type: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      ...tax,
      accounts,
    });
  } catch (err) {
    return serverError('tax-settings-get', err, 'Gagal memuat pengaturan pajak.');
  }
});

/**
 * PATCH /api/v1/tax/settings
 * Hanya mengubah kolom pajak. Tidak menyentuh konfigurasi akuntansi lain.
 */
export const PATCH = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'manage_settings');
  if (forbidden) return forbidden;

  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = auth.workspace.id;

    const existing = await prisma.accountingSetting.findUnique({ where: { workspaceId } });
    if (existing) {
      const postedCount = await prisma.journalEntry.count({
        where: { workspaceId, status: JournalStatus.POSTED },
      });
      if (body.taxProfile !== undefined && body.taxProfile !== existing.taxProfile && postedCount > 0) {
        return badRequest(
          'Profil pajak tidak bisa diubah setelah ada jurnal diposting. Ubah pada batas periode.'
        );
      }
      if (body.entityType !== undefined && body.entityType !== existing.entityType && postedCount > 0) {
        return badRequest(
          'Bentuk badan usaha tidak bisa diubah setelah ada jurnal diposting.'
        );
      }
    }

    const data: Record<string, unknown> = {};

    if (body.taxProfile !== undefined) {
      if (!VALID_PROFILES.has(body.taxProfile)) return badRequest('Profil pajak tidak dikenal.');
      data.taxProfile = body.taxProfile;
      data.enablePpn = body.taxProfile !== TaxProfile.UMKM_NON_PKP;
    }
    if (body.enablePpn !== undefined) {
      if (typeof body.enablePpn !== 'boolean') return badRequest('enablePpn harus boolean.');
      data.enablePpn = body.enablePpn;
    }
    if (body.entityType !== undefined) {
      const entity = String(body.entityType);
      if (!['BADAN_USAHA', 'ORANG_PRIBADI', 'CV', 'FIRMA', 'KOPERASI', 'YAYASAN'].includes(entity)) {
        return badRequest('Bentuk badan usaha tidak dikenal.');
      }
      data.entityType = entity;
    }

    if (body.npwp !== undefined) data.npwp = asString(body.npwp, 30);
    if (body.nik !== undefined) data.nik = asString(body.nik, 20);
    if (body.kppName !== undefined) data.kppName = asString(body.kppName, 150);

    if (body.pkpEffectiveDate !== undefined) {
      if (body.pkpEffectiveDate === null || body.pkpEffectiveDate === '') {
        data.pkpEffectiveDate = null;
      } else {
        const parsed = new Date(body.pkpEffectiveDate);
        if (Number.isNaN(parsed.getTime())) return badRequest('Tanggal efektif PKP tidak valid.');
        data.pkpEffectiveDate = parsed;
      }
    }

    const rateFields: Array<[string, string, number]> = [
      ['ppnRate', 'ppnRate', 100],
      ['pphFinalRate', 'pphFinalRate', 100],
      ['pph23Rate', 'pph23Rate', 100],
      ['pph42Rate', 'pph42Rate', 100],
    ];
    for (const [field, label, max] of rateFields) {
      if (body[field] === undefined) continue;
      const value = asNumber(body[field]);
      if (value === null || value < 0 || value > max) {
        return badRequest(`Tarif ${label} harus berupa angka 0-${max}.`);
      }
      data[field] = value;
    }

    if (body.umkmThreshold !== undefined) {
      const value = asNumber(body.umkmThreshold);
      if (value === null || value < 0) return badRequest('Ambang UMKM tidak valid.');
      data.umkmThreshold = Math.round(value);
    }

    if (body.pph21Method !== undefined) {
      const method = String(body.pph21Method).toUpperCase();
      if (!['MANUAL', 'TER', 'GROSS_UP'].includes(method)) {
        return badRequest('Metode PPh 21 tidak dikenal.');
      }
      data.pph21Method = method;
    }

    if (body.taxReminderDays !== undefined) {
      if (!Array.isArray(body.taxReminderDays)) {
        return badRequest('taxReminderDays harus berupa array.');
      }
      const days: number[] = body.taxReminderDays
        .map((n: unknown) => asNumber(n))
        .filter((n: number | null): n is number => n !== null && n >= 0 && n <= 365)
        .map((n: number) => Math.round(n));
      data.taxReminderDays = Array.from(new Set(days)).sort((a, b) => b - a);
    }

    if (body.taxReminderChannel !== undefined) {
      const channel = String(body.taxReminderChannel).toUpperCase();
      if (!VALID_CHANNELS.has(channel)) return badRequest('Kanal pengingat tidak dikenal.');
      data.taxReminderChannel = channel;
    }

    await prisma.accountingSetting.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: data,
    });

    // Pemetaan akun opsional: [{ taxType, component, accountId }]
    if (Array.isArray(body.accountMaps)) {
      for (const raw of body.accountMaps.slice(0, 40)) {
        const taxType = parseTaxType(raw?.taxType);
        const component = String(raw?.component ?? '').toUpperCase() as TaxComponent;
        const accountId = asString(raw?.accountId, 64);
        if (!taxType || !VALID_TAX_TYPES.has(taxType)) {
          return badRequest('Jenis pajak pada pemetaan akun tidak valid.');
        }
        if (!VALID_COMPONENTS.has(component)) {
          return badRequest('Komponen pajak pada pemetaan akun tidak valid.');
        }
        if (!accountId) return badRequest('Akun pada pemetaan tidak boleh kosong.');
        const account = await prisma.account.findFirst({
          where: { id: accountId, workspaceId },
          select: { id: true },
        });
        if (!account) return badRequest('Akun pemetaan tidak ditemukan di workspace ini.');
        await prisma.taxAccountMap.upsert({
          where: {
            workspaceId_taxType_component: { workspaceId, taxType, component },
          },
          create: { workspaceId, taxType, component, accountId },
          update: { accountId },
        });
      }
    }

    const refreshed = await getTaxSetting(workspaceId);
    return NextResponse.json({ success: true, setting: refreshed.setting, accountMaps: refreshed.accountMaps });
  } catch (err) {
    return serverError('tax-settings-patch', err, 'Gagal menyimpan pengaturan pajak.');
  }
});

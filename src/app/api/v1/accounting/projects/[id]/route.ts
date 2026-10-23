import { NextRequest, NextResponse } from 'next/server';
import { ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serverError } from '@/lib/accounting/api';
import { normalizeCashDivision } from '@/lib/accounting/budget-divisions';
import { projectSnapshot, recordAudit } from '@/lib/audit/audit-trail';

const STATUSES = new Set(Object.values(ProjectStatus));

function parseDate(raw: unknown, label: string): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} tidak valid.`);
  return date;
}

function normalizeStatus(raw: unknown): ProjectStatus {
  const value = String(raw).trim().toUpperCase() as ProjectStatus;
  if (!STATUSES.has(value)) {
    throw new Error('Status proyek tidak dikenal. Pilih ACTIVE, ON_HOLD, COMPLETED, atau ARCHIVED.');
  }
  return value;
}

// PATCH: Ubah data / status proyek
export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'manage_projects');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const existing = await prisma.project.findFirst({
        where: { id, workspaceId: auth.workspace.id },
      });
      if (!existing) return notFound('Proyek tidak ditemukan.');

      const body = (await req.json()) as Record<string, unknown>;
      const data: Record<string, unknown> = {};

      if (body.name !== undefined) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return badRequest('Nama proyek wajib diisi.');
        data.name = name.slice(0, 255);
      }
      if (body.code !== undefined) {
        const raw = body.code === null || body.code === '' ? null : String(body.code).trim().toUpperCase().slice(0, 50);
        if (raw) {
          const duplicate = await prisma.project.findFirst({
            where: { workspaceId: auth.workspace.id, code: raw, id: { not: id } },
            select: { id: true },
          });
          if (duplicate) return badRequest('Kode proyek sudah dipakai proyek lain di workspace ini.');
        }
        data.code = raw;
      }
      if (body.clientName !== undefined) {
        data.clientName = body.clientName === null || body.clientName === '' ? null : String(body.clientName).trim().slice(0, 150);
      }
      if (body.description !== undefined) {
        data.description = body.description === null || body.description === '' ? null : String(body.description).trim();
      }
      if (body.division !== undefined) {
        data.division = normalizeCashDivision(body.division);
      }
      if (body.status !== undefined) {
        data.status = normalizeStatus(body.status);
      }

      const startDate = body.startDate !== undefined ? parseDate(body.startDate, 'Tanggal mulai') : existing.startDate;
      const endDate = body.endDate !== undefined ? parseDate(body.endDate, 'Tanggal selesai') : existing.endDate;
      if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
        return badRequest('Tanggal mulai tidak boleh setelah tanggal selesai.');
      }
      if (body.startDate !== undefined) data.startDate = startDate;
      if (body.endDate !== undefined) data.endDate = endDate;

      const project = await prisma.project.update({ where: { id }, data });

      if (Object.keys(data).length > 0) {
        await recordAudit({
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          action: 'UPDATE',
          entityType: 'PROJECT',
          entityId: project.id,
          before: projectSnapshot(existing),
          after: projectSnapshot(project),
          metadata: { source: 'project_form' },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Proyek "${project.name}" berhasil diperbarui.`,
        project,
      });
    } catch (err) {
      if (err instanceof Error && /wajib|valid|tidak boleh|tidak dikenal/i.test(err.message)) {
        return badRequest(err.message);
      }
      return serverError('projects:patch', err, 'Gagal memperbarui proyek.');
    }
  },
  { minRole: 'MEMBER' }
);

// DELETE: Arsipkan proyek (histori jurnal tetap utuh)
export const DELETE = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'manage_projects');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const existing = await prisma.project.findFirst({
        where: { id, workspaceId: auth.workspace.id },
      });
      if (!existing) return notFound('Proyek tidak ditemukan.');

      const project = await prisma.project.update({
        where: { id },
        data: { status: ProjectStatus.ARCHIVED },
      });

      await recordAudit({
        workspaceId: auth.workspace.id,
        userId: auth.user.id,
        action: 'ARCHIVE',
        entityType: 'PROJECT',
        entityId: project.id,
        before: projectSnapshot(existing),
        after: projectSnapshot(project),
        metadata: { source: 'project_form', operation: 'ARCHIVE' },
      });

      return NextResponse.json({
        success: true,
        message: `Proyek "${project.name}" diarsipkan. Histori jurnalnya tetap tersimpan.`,
        project,
      });
    } catch (err) {
      return serverError('projects:delete', err, 'Gagal mengarsipkan proyek.');
    }
  },
  { minRole: 'MEMBER' }
);

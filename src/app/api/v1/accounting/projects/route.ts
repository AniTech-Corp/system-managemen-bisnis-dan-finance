import { NextRequest, NextResponse } from 'next/server';
import { ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { normalizeCashDivision } from '@/lib/accounting/budget-divisions';
import { projectSnapshot, recordAudit } from '@/lib/audit/audit-trail';

const STATUSES = new Set(Object.values(ProjectStatus));

function parseDate(raw: unknown, label: string): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} tidak valid.`);
  return date;
}

function normalizeCode(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim().toUpperCase().slice(0, 50);
  return value || null;
}

function normalizeStatus(raw: unknown): ProjectStatus {
  if (raw === null || raw === undefined || raw === '') return ProjectStatus.ACTIVE;
  const value = String(raw).trim().toUpperCase() as ProjectStatus;
  if (!STATUSES.has(value)) {
    throw new Error('Status proyek tidak dikenal. Pilih ACTIVE, ON_HOLD, COMPLETED, atau ARCHIVED.');
  }
  return value;
}

function parseName(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) throw new Error('Nama proyek wajib diisi.');
  return value.slice(0, 255);
}

function parseText(raw: unknown, max: number): string | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  return value ? value.slice(0, max) : null;
}

interface ProjectPayload {
  name: string;
  code: string | null;
  clientName: string | null;
  description: string | null;
  division: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
}

function parseCreatePayload(body: Record<string, unknown>): ProjectPayload {
  const name = parseName(body.name);
  const startDate = parseDate(body.startDate, 'Tanggal mulai');
  const endDate = parseDate(body.endDate, 'Tanggal selesai');
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new Error('Tanggal mulai tidak boleh setelah tanggal selesai.');
  }
  return {
    name,
    code: normalizeCode(body.code),
    clientName: parseText(body.clientName, 150),
    description: parseText(body.description, 5000),
    division: normalizeCashDivision(body.division),
    status: normalizeStatus(body.status),
    startDate,
    endDate,
  };
}

function duplicateCodeMessage(): string {
  return 'Kode proyek sudah dipakai proyek lain di workspace ini.';
}

// GET: Daftar proyek untuk pemilih transaksi & halaman profitabilitas
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const sp = req.nextUrl.searchParams;
      const statusParam = (sp.get('status') || '').trim().toUpperCase();
      const includeArchived =
        statusParam === 'ALL' || sp.get('includeArchived') === 'true';
      const status = STATUSES.has(statusParam as ProjectStatus)
        ? (statusParam as ProjectStatus)
        : null;

      const projects = await prisma.project.findMany({
        where: {
          workspaceId: auth.workspace.id,
          ...(status ? { status } : includeArchived ? {} : { status: { not: ProjectStatus.ARCHIVED } }),
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      });

      // `data.projects` adalah bentuk standar untuk `useApi` di UI akuntansi;
      // `projects` di root dipertahankan untuk pemanggil lama (FinanceModuleView).
      return NextResponse.json({ success: true, projects, data: { projects } });
    } catch (err) {
      return serverError('projects', err, 'Gagal memuat daftar proyek.');
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Buat proyek baru
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'manage_projects');
    if (forbidden) return forbidden;

    try {
      const payload = parseCreatePayload((await req.json()) as Record<string, unknown>);

      if (payload.code) {
        const existing = await prisma.project.findFirst({
          where: { workspaceId: auth.workspace.id, code: payload.code },
          select: { id: true },
        });
        if (existing) return badRequest(duplicateCodeMessage());
      }

      const project = await prisma.project.create({
        data: {
          workspaceId: auth.workspace.id,
          createdBy: auth.user.id,
          ...payload,
        },
      });

      await recordAudit({
        workspaceId: auth.workspace.id,
        userId: auth.user.id,
        action: 'CREATE',
        entityType: 'PROJECT',
        entityId: project.id,
        after: projectSnapshot(project),
        metadata: { source: 'project_form' },
      });

      return NextResponse.json({
        success: true,
        message: `Proyek "${project.name}" berhasil dibuat.`,
        project,
      });
    } catch (err) {
      if (err instanceof Error && /wajib|valid|tidak boleh|tidak dikenal|sudah dipakai/i.test(err.message)) {
        return badRequest(err.message);
      }
      return serverError('projects', err, 'Gagal membuat proyek.');
    }
  },
  { minRole: 'MEMBER' }
);

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { loadIngestLogs, undoIngest } from '@/lib/ai-brain/auto-ingest';
import { deleteCompanyKnowledgeByFile } from '@/lib/ai-brain/company-memory';
import { resolveDivisionRole, classifyFileDivision, canRoleSeeDivision, FILE_DIVISION_LABEL } from '@/lib/ai-brain/data-visibility';
import { getFileExtension } from '@/lib/workspace-file-extraction';
import { invalidateContextCache } from '@/lib/ai-brain/context-engine';
import { invalidateDashboardInsightCache } from '@/lib/ai-brain/dashboard-insight';
import { scheduleCompanyBriefRefresh } from '@/lib/ai-brain/company-brief';

/**
 * GET /api/v1/workspace-files/[id] -- detail SATU file Pusat Data, termasuk
 * extractedSummary PENUH (sampai 24000 char sejak 7 Sep 2026 malam).
 *
 * Kenapa perlu: GET /api/v1/workspace-files (daftar) sengaja memotong extractedSummary
 * ke 1200 char + `summaryTruncated:true` supaya payload daftar tetap ringan. Panel
 * "Lihat isi" dan tombol "Tanya AI soal file ini" di WorkspaceDataHub.tsx butuh isi
 * penuh -- endpoint ini yang menyediakannya saat user membuka satu file (bukan untuk
 * semua file sekaligus). Tenant-guarded: id milik workspace lain = 404.
 *
 * FILTER DIVISI (11 Sep 2026 sore, keputusan produk Mecca): file di luar divisi
 * pembaca (mis. laporan keuangan dibuka akun marketing@) = 404 juga -- SAMA dengan
 * "tidak ada", supaya id file yang bocor lewat jalur lain tidak bisa dipakai membaca
 * isinya. File upload sendiri selalu boleh. Lihat data-visibility.ts.
 */
export const GET = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    const file = await prisma.workspaceFile.findFirst({
      where: { id, workspaceId: auth.workspace.id },
      select: {
        id: true, fileName: true, fileType: true, sizeBytes: true, extractedSummary: true,
        linkedRecordIds: true, status: true, createdAt: true, uploadedBy: true,
        uploader: { select: { fullName: true } },
      },
    });
    if (!file) {
      return NextResponse.json({ message: 'File tidak ditemukan di workspace ini.' }, { status: 404 });
    }
    const division = resolveDivisionRole({
      email: auth.user.email,
      membershipRole: auth.membership.role,
      membershipDivisionRole: auth.membership.divisionRole,
      declaredRole: req.nextUrl.searchParams.get('portal'),
    });
    const ingestKind = (await loadIngestLogs(auth.workspace.id).catch(() => new Map())).get(file.id)?.kind ?? null;
    const divisi = classifyFileDivision(file.fileName, file.extractedSummary, ingestKind);
    const own = file.uploadedBy === auth.user.id;
    if (!own && !canRoleSeeDivision(division, divisi)) {
      return NextResponse.json({ message: 'File tidak ditemukan di workspace ini.' }, { status: 404 });
    }
    const { uploadedBy: _uploadedBy, ...rest } = file;
    return NextResponse.json(
      { success: true, file: { ...rest, divisi, divisiLabel: FILE_DIVISION_LABEL[divisi] } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  },
  { minRole: 'VIEWER' }
);

export const DELETE = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      if (!id) {
        return NextResponse.json({ message: 'ID file wajib diisi.' }, { status: 400 });
      }

      const target = await prisma.workspaceFile.findFirst({
        where: { id, workspaceId: auth.workspace.id },
        select: { id: true, fileName: true, linkedRecordIds: true },
      });
      if (!target) {
        return NextResponse.json({ message: 'File tidak ditemukan di workspace ini.' }, { status: 404 });
      }

      const isZipParent = getFileExtension(target.fileName) === 'zip' && target.linkedRecordIds.length > 0;
      
      // Kumpulkan nama-nama file yang dihapus untuk membersihkan MemoryItem[COMPANY_KNOWLEDGE]
      const fileNamesToDelete: string[] = [target.fileName];
      const targetChildIds: string[] = isZipParent ? target.linkedRecordIds : [];

      if (isZipParent) {
        const childFiles = await prisma.workspaceFile.findMany({
          where: { id: { in: target.linkedRecordIds }, workspaceId: auth.workspace.id },
          select: { id: true, fileName: true },
        });
        for (const cf of childFiles) {
          fileNamesToDelete.push(cf.fileName);
          await undoIngest(auth.workspace.id, cf.id).catch(() => {});
        }
      } else {
        await undoIngest(auth.workspace.id, target.id).catch(() => {});
      }

      // Hapus MemoryItem[COMPANY_KNOWLEDGE] untuk file-file ini
      await deleteCompanyKnowledgeByFile(auth.workspace.id, fileNamesToDelete);

      // Bersihkan transaksi kas turunan jika ada yang diimpor dari file ini
      const deletedChildCount = await prisma.$transaction(async (tx) => {
        // Hapus cashTransaction terkait (berdasarkan linkedRecordIds atau deskripsi impor)
        const fileMatchPatterns = fileNamesToDelete.flatMap((name) => [
          { description: { contains: `(impor dari "${name}")` } },
          { description: { contains: `(impor otomatis dari "${name}")` } },
        ]);

        const recordIdConditions = target.linkedRecordIds.length > 0 && !isZipParent
          ? [{ id: { in: target.linkedRecordIds } }]
          : [];

        await tx.cashTransaction.deleteMany({
          where: {
            workspaceId: auth.workspace.id,
            OR: [
              ...fileMatchPatterns,
              ...recordIdConditions,
              { sourceFileId: target.id },
            ],
          },
        }).catch(() => {});

        // Pembersihan defensif multi-domain jika linkedRecordIds berisi id produk/payroll/task/campaign
        if (target.linkedRecordIds.length > 0 && !isZipParent) {
          await (tx as any).product?.deleteMany?.({
            where: {
              workspaceId: auth.workspace.id,
              OR: [
                { id: { in: target.linkedRecordIds } },
                { sourceFileId: target.id },
              ],
            },
          }).catch(() => {});
          await (tx as any).employeePayroll?.deleteMany?.({
            where: { workspaceId: auth.workspace.id, id: { in: target.linkedRecordIds } },
          }).catch(() => {});
          await (tx as any).campaign?.deleteMany?.({
            where: { workspaceId: auth.workspace.id, id: { in: target.linkedRecordIds } },
          }).catch(() => {});
          await (tx as any).workTask?.deleteMany?.({
            where: {
              workspaceId: auth.workspace.id,
              OR: [
                { id: { in: target.linkedRecordIds } },
                { sourceFileId: target.id },
              ],
            },
          }).catch(() => {});
        } else {
          await (tx as any).product?.deleteMany?.({
            where: { workspaceId: auth.workspace.id, sourceFileId: target.id },
          }).catch(() => {});
          await (tx as any).workTask?.deleteMany?.({
            where: { workspaceId: auth.workspace.id, sourceFileId: target.id },
          }).catch(() => {});
        }

        let children = 0;
        if (isZipParent) {
          const childDelete = await tx.workspaceFile.deleteMany({
            where: { id: { in: target.linkedRecordIds }, workspaceId: auth.workspace.id },
          });
          children = childDelete.count;
        } else {
          const parent = await tx.workspaceFile.findFirst({
            where: { workspaceId: auth.workspace.id, linkedRecordIds: { has: id } },
            select: { id: true, linkedRecordIds: true },
          });
          if (parent) {
            await tx.workspaceFile.update({
              where: { id: parent.id },
              data: { linkedRecordIds: parent.linkedRecordIds.filter((childId) => childId !== id) },
            });
          }
        }

        await tx.activityEvent.create({
          data: {
            workspaceId: auth.workspace.id,
            userId: auth.user.id,
            type: 'WORKSPACE_FILE_DELETED',
            payload: {
              fileId: target.id,
              fileName: target.fileName,
              linkedRecordIds: target.linkedRecordIds,
              deletedChildIds: targetChildIds,
              domainRecordsRetained: false,
            },
          },
        });

        await tx.workspaceFile.delete({ where: { id, workspaceId: auth.workspace.id } });
        return children;
      });

      invalidateContextCache(auth.workspace.id);
      void invalidateDashboardInsightCache(auth.workspace.id);
      scheduleCompanyBriefRefresh(auth.workspace.id, 'Hapus file Pusat Data');

      return NextResponse.json({
        success: true,
        domainRecordsRetained: false,
        ...(isZipParent ? { deletedChildCount } : {}),
      });
    } catch (err: any) {
      console.error('[workspace-files/[id]] DELETE error:', err);
      return NextResponse.json({ message: 'Gagal menghapus file.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);


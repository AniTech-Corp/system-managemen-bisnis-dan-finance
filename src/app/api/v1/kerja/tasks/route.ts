import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TaskStatus, TaskPriority } from '@prisma/client';

// GET: Ambil daftar tugas tim (Kanban Board)
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;

      const tasks = await prisma.workTask.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      });

      const todoTasks = tasks.filter((t) => t.status === TaskStatus.TODO);
      const inProgressTasks = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS);
      const doneTasks = tasks.filter((t) => t.status === TaskStatus.DONE);

      return NextResponse.json({
        summary: {
          totalTasks: tasks.length,
          todoCount: todoTasks.length,
          inProgressCount: inProgressTasks.length,
          doneCount: doneTasks.length,
        },
        columns: {
          TODO: todoTasks,
          IN_PROGRESS: inProgressTasks,
          DONE: doneTasks,
        },
        allTasks: tasks,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat tugas kerja.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Buat tugas baru
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { title, description, assigneeName = 'Tim Operasional', priority = 'MEDIUM', dueDate } = await req.json();

      if (!title || !title.trim()) {
        return NextResponse.json({ message: 'Judul tugas wajib diisi.' }, { status: 400 });
      }

      const task = await prisma.workTask.create({
        data: {
          workspaceId: auth.workspace.id,
          title: title.trim(),
          description: description?.trim(),
          assigneeName: assigneeName.trim(),
          priority: (priority as TaskPriority) || TaskPriority.MEDIUM,
          status: TaskStatus.TODO,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Tugas '${task.title}' berhasil ditambahkan ke Kanban Board!`,
        task,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Tugas kerja gagal dibuat.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// PUT: Perbarui status tugas (TODO -> IN_PROGRESS -> DONE)
export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { taskId, status } = await req.json();

      if (!taskId || !status) {
        return NextResponse.json({ message: 'Task ID dan status baru wajib diisi.' }, { status: 400 });
      }

      if (!Object.values(TaskStatus).includes(status as TaskStatus)) {
        return NextResponse.json({ message: 'Status tugas tidak valid.' }, { status: 400 });
      }

      const updated = await prisma.workTask.updateMany({
        where: { id: taskId, workspaceId: auth.workspace.id },
        data: { status: status as TaskStatus },
      });
      if (updated.count !== 1) {
        return NextResponse.json({ message: 'Tugas tidak ditemukan.' }, { status: 404 });
      }
      const task = await prisma.workTask.findFirst({
        where: { id: taskId, workspaceId: auth.workspace.id },
      });
      if (!task) {
        return NextResponse.json({ message: 'Tugas tidak ditemukan.' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Status tugas '${task.title}' diperbarui menjadi ${status}.`,
        task,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Tugas kerja gagal diperbarui.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

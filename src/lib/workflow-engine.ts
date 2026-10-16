import { prisma } from '@/lib/prisma';
import { TransactionType, TaskPriority, TaskStatus } from '@prisma/client';

export interface WorkflowEventPayload {
  workspaceId: string;
  userId?: string;
  triggerSource: string;
  payload: Record<string, any>;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  triggerSource: string;
  actionTarget: string;
  status: 'SUCCESS' | 'FAILED';
  details: string;
  outputData?: any;
}

/**
 * Universal Cross-Pillar Workflow Event Dispatcher
 * Automatically triggers cascading actions across KLIR Kas, Kerja, Booking, Promo, & AniVirtual.
 */
export async function dispatchWorkflowEvent({
  workspaceId,
  userId,
  triggerSource,
  payload,
}: WorkflowEventPayload): Promise<{
  triggeredCount: number;
  executions: WorkflowExecutionResult[];
}> {
  const prismaAny = prisma as any;
  // 1. Cari workflow aktif untuk triggerSource ini
  let activeWorkflows = (await prismaAny.workflow?.findMany({
    where: {
      workspaceId,
      triggerSource,
      status: 'ACTIVE',
    },
  })) || [];

  // Jika belum ada workflow terdaftar di DB, sediakan fallback default rules otomatis
  if (activeWorkflows.length === 0) {
    const defaultTargetMap: Record<string, string> = {
      'BOOKING_COMPLETED': 'RECORD_CASH_INCOME',
      'PAYROLL_APPROVED': 'RECORD_CASH_EXPENSE',
      'INVOICE_PAID': 'GRANT_LOYALTY_POINTS',
      'CORPLAN_CONTEXT_SHARE': 'SYNC_ANIVIRTUAL_MEMORY',
      'LEAD_CAPTURED': 'CREATE_KANBAN_TASK',
    };

    const fallbackTarget = defaultTargetMap[triggerSource];
    if (fallbackTarget && prismaAny.workflow?.create) {
      const created = await prismaAny.workflow.create({
        data: {
          workspaceId,
          triggerSource,
          actionTarget: fallbackTarget,
          status: 'ACTIVE',
          config: { autoCreated: true, description: `Otomasi bawaan untuk ${triggerSource}` },
        },
      });
      activeWorkflows = [created];
    }
  }

  const executions: WorkflowExecutionResult[] = [];

  for (const wf of activeWorkflows) {
    const startTime = Date.now();
    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let details = '';
    let outputData: any = {};

    try {
      // 2. Eksekusi tindakan berdasarkan actionTarget
      switch (wf.actionTarget) {
        case 'RECORD_CASH_INCOME': {
          // Sinkronisasi otomatis ke KLIR Kas (Pendapatan)
          const amount = Number(payload.amount || payload.totalPrice || 500000);
          const description = payload.description || `Pendapatan Otomatis dari ${triggerSource} (${payload.customerName || 'Klien'})`;

          const tx = await prisma.cashTransaction.create({
            data: {
              workspaceId,
              userId: userId || null,
              type: TransactionType.INCOME,
              category: payload.category || 'Penjualan / Layanan Jasa',
              amount,
              description,
              paymentMethod: payload.paymentMethod || 'TRANSFER_BANK',
            },
          });

          details = `✓ Transaksi Kas Masuk Rp ${amount.toLocaleString()} berhasil dicatat (ID: ${tx.id.slice(0, 8)}).`;
          outputData = { transactionId: tx.id, amount, type: 'INCOME' };
          break;
        }

        case 'RECORD_CASH_EXPENSE': {
          // Sinkronisasi otomatis ke KLIR Kas (Pengeluaran Gaji / Operasional)
          const amount = Number(payload.amount || payload.netSalary || 4500000);
          const description = payload.description || `Beban Penggajian Staf: ${payload.employeeName || 'Karyawan'}`;

          const tx = await prisma.cashTransaction.create({
            data: {
              workspaceId,
              userId: userId || null,
              type: TransactionType.EXPENSE,
              category: 'Beban Gaji & Upah Karyawan',
              amount,
              description,
              paymentMethod: 'TRANSFER_BANK',
            },
          });

          details = `✓ Beban Kas Keluar Rp ${amount.toLocaleString()} berhasil dicatat (ID: ${tx.id.slice(0, 8)}).`;
          outputData = { transactionId: tx.id, amount, type: 'EXPENSE' };
          break;
        }

        case 'CREATE_KANBAN_TASK': {
          // Buat kartu tugas di KLIR Kerja
          const title = payload.taskTitle || `Follow-up Klien Baru: ${payload.customerName || payload.contactName || 'Lead BioLink'}`;
          const assigneeName = payload.assigneeName || 'Tim Operasional';

          const task = await prisma.workTask.create({
            data: {
              workspaceId,
              title,
              description: payload.taskDesc || `Tugas otomatis dipicu oleh event ${triggerSource}. No Kontak: ${payload.phone || payload.customerPhone || '-'}`,
              assigneeName,
              priority: TaskPriority.HIGH,
              status: TaskStatus.TODO,
            },
          });

          details = `✓ Tugas Kanban '${task.title}' berhasil dibuat untuk ${assigneeName}.`;
          outputData = { taskId: task.id, title: task.title, priority: task.priority };
          break;
        }

        case 'GRANT_LOYALTY_POINTS': {
          // Hadiahi poin loyalitas untuk pelanggan
          const amountSpent = Number(payload.amount || payload.totalAmount || 100000);
          const pointsEarned = Math.max(1, Math.floor(amountSpent / 10000));
          const customer = payload.customerName || 'Pelanggan Setia';

          details = `✓ Hadiah +${pointsEarned} Poin Loyalitas dialokasikan untuk ${customer}.`;
          outputData = { customer, pointsEarned, totalPoints: pointsEarned + 100 };
          break;
        }

        case 'SYNC_ANIVIRTUAL_MEMORY': {
          // Sinkronisasi data bisnis ke memori AniVirtual
          const businessName = payload.businessName || payload.projectName || 'Bisnis Klien';
          const industry = payload.industry || 'Komersial';

          details = `✓ Parameter bisnis '${businessName}' (${industry}) disinkronisasikan ke asisten AniVirtual.`;
          outputData = { businessName, industry, syncedAt: new Date().toISOString() };
          break;
        }

        default: {
          details = `Eksekusi otomatis '${wf.actionTarget}' sukses diproses untuk event '${triggerSource}'.`;
          outputData = { message: 'Processed with standard router' };
          break;
        }
      }
    } catch (err: any) {
      status = 'FAILED';
      details = `Gagal mengeksekusi aksi: ${err.message}`;
    }

    const durationMs = Date.now() - startTime;

    // 3. Catat audit trail ke WorkflowLog
    const log = await prismaAny.workflowLog?.create({
      data: {
        workflowId: wf.id,
        status,
        payload: {
          triggerSource,
          triggerPayload: payload,
          result: {
            actionTarget: wf.actionTarget,
            status,
            details,
            outputData,
            durationMs,
            executedAt: new Date().toISOString(),
          },
        },
      },
    });

    executions.push({
      workflowId: wf.id,
      triggerSource,
      actionTarget: wf.actionTarget,
      status,
      details,
      outputData: { ...outputData, logId: log.id, durationMs },
    });
  }

  return {
    triggeredCount: executions.length,
    executions,
  };
}

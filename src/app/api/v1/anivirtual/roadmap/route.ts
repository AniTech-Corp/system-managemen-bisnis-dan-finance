import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { withAtomicCredit } from '@/lib/credit';
import { executeAIRequest } from '@/lib/ai-gateway';
import { planAllowsFeature, getWorkspacePlan } from '@/lib/plan-guard';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { goal, timeframeWeeks = 4, targetPIC = 'Tim Operasional' } = await req.json();

      if (!goal || !goal.trim()) {
        return NextResponse.json({ message: 'Target tujuan / goal roadmap wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      // PREMIUM GATE: Roadmap Operasional AI tertutup untuk paket FREE
      if (!(await planAllowsFeature(workspaceId, 'roadmap'))) {
        const plan = await getWorkspacePlan(workspaceId);
        return NextResponse.json(
          {
            message: `Fitur Roadmap Operasional AI hanya tersedia di paket Starter & Business. Paket Anda saat ini: ${plan.label}. Silakan upgrade untuk membuka fitur ini.`,
            code: 'FEATURE_LOCKED',
            requiredFeature: 'roadmap',
            currentPlan: plan.plan,
          },
          { status: 403 }
        );
      }

      // Eksekusi atomis dengan jaminan 20 kredit
      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'anivirtual.roadmap',
          userId: auth.user.id,
          customCost: 20,
          metadata: { goal, timeframeWeeks },
        },
        async () => {
          const prompt = `Buatkan Rencana Kerja & Roadmap Operasional ${timeframeWeeks} Minggu untuk target: "${goal}".
PIC Utama: ${targetPIC}.

Format output WAJIB JSON persis:
{
  "roadmapTitle": "Roadmap: ${goal.slice(0, 40)}",
  "totalDuration": "${timeframeWeeks} Minggu",
  "milestones": [
    {
      "week": 1,
      "phaseName": "Fase Persiapan & Alignment",
      "deliverables": ["Deliverable 1", "Deliverable 2"],
      "actionItems": ["Tugas 1", "Tugas 2"],
      "status": "READY"
    },
    {
      "week": 2,
      "phaseName": "Fase Eksekusi Inti",
      "deliverables": ["Deliverable 1", "Deliverable 2"],
      "actionItems": ["Tugas 1", "Tugas 2"],
      "status": "PENDING"
    },
    {
      "week": 3,
      "phaseName": "Fase Integrasi & QA",
      "deliverables": ["Deliverable 1", "Deliverable 2"],
      "actionItems": ["Tugas 1", "Tugas 2"],
      "status": "PENDING"
    },
    {
      "week": 4,
      "phaseName": "Fase Peluncuran & Evaluasi",
      "deliverables": ["Deliverable 1", "Deliverable 2"],
      "actionItems": ["Tugas 1", "Tugas 2"],
      "status": "PENDING"
    }
  ]
}`;

          const aiRes = await executeAIRequest({
            workspaceId,
            prompt,
            jsonMode: true,
            temperature: 0.6,
          });

          const roadmapData = aiRes.json || {
            roadmapTitle: `Roadmap Operasional: ${goal.slice(0, 40)}`,
            totalDuration: `${timeframeWeeks} Minggu`,
            milestones: [
              { week: 1, phaseName: 'Persiapan & Audit Kebutuhan', deliverables: ['Dokumen spesifikasi', 'Persetujuan anggaran'], actionItems: ['Briefing tim PIC', 'Setup resources'], status: 'READY' },
              { week: 2, phaseName: 'Eksekusi & Implementasi Tahap 1', deliverables: ['Draf awal pekerjaan', 'Laporan progres mingguan'], actionItems: ['Pengerjaan modul', 'Sinkronisasi tim'], status: 'PENDING' },
              { week: 3, phaseName: 'Review Kualitas & Validasi', deliverables: ['Checklist QA', 'Umpan balik stakeholder'], actionItems: ['Testing operasional', 'Penyesuaian minor'], status: 'PENDING' },
              { week: 4, phaseName: 'Finalisasi & Go-Live', deliverables: ['Dokumen BAST / Penutupan', 'Monitoring berkala'], actionItems: ['Rilis resmi', 'Evaluasi hasil'], status: 'PENDING' },
            ],
          };

          return {
            roadmap: roadmapData,
            generatedBy: auth.user.fullName,
            provider: aiRes.provider,
          };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Roadmap AniVirtual gagal diproses.') }, { status: 400 });
    }
  },
  { minRole: 'VIEWER' }
);

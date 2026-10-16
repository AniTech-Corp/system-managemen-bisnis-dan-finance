import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { deductCredit } from '@/lib/credit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateStructuredJson } from '@/lib/ai-gateway';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { title, description } = await req.json();

      if (!title) {
        return NextResponse.json({ message: 'Judul proposal bisnis wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      // Potong 500 Kredit Secara Atomis dari Akun Workspace
      await deductCredit(workspaceId, 500, 'corplan.generate', auth.user.id);

      // Panggil AI via Emergent Universal LLM Gateway (fallback deterministik otomatis)
      let outputJson: any = null;
      try {
        const { data: aiJson } = await generateStructuredJson<any>(
          workspaceId,
          `Buatkan proposal bisnis 6 bab terstruktur untuk usaha "${title}". Deskripsi usaha: ${description || 'Bisnis komersial inovatif UMKM Indonesia'}. Sasaran: UMKM Indonesia. Gunakan bahasa Indonesia yang mudah dipahami pemilik usaha kecil, tetap formal dan siap diajukan ke bank/investor. Kembalikan JSON dengan keys PERSIS: bab1_eksekutif_summary, bab2_analisis_pasar, bab3_rencana_pemasaran, bab4_rencana_operasional, bab5_rencana_keuangan, bab6_manajemen_risiko. Setiap value berupa paragraf 3-5 kalimat.`,
          'Anda konsultan bisnis profesional untuk UMKM Indonesia yang menyusun dokumen proposal bisnis formal.'
        );
        if (aiJson && aiJson.bab1_eksekutif_summary) {
          outputJson = aiJson;
        }
      } catch (aiErr) {
        console.warn('[CorPlan] AI gateway gagal, pakai deterministic engine:', aiErr);
        outputJson = null;
      }

      if (!outputJson) {
        // FIX (audit workflow, sesi ini): fallback ini dulu tidak punya penanda apapun --
        // user menerima angka finansial spesifik karangan (BEP bulan-6, margin 42%, ROI
        // 68%) seolah hasil AI asli kalau AI gateway gagal/timeout. isSampleData WAJIB
        // dibaca+ditampilkan sebagai disclaimer oleh pemanggil manapun yang menyambungkan
        // endpoint ini ke UI/AI tool-calling di kemudian hari.
        outputJson = {
          isSampleData: true,
          dataSourceNote: 'AI gateway gagal merespons -- ini contoh statis, bukan hasil analisis AI untuk bisnis Anda. Coba lagi.',
          bab1_eksekutif_summary: `Proposal bisnis "${title}" dirancang untuk menjawab peluang pasar modern dengan model bisnis yang scalable dan efisiensi operasional tinggi.`,
          bab2_analisis_pasar: `Pasar sasaran terdiri dari segmen profesional muda dan pelaku usaha berkembang dengan pertumbuhan pasar rata-rata 24% per tahun.`,
          bab3_rencana_pemasaran: `Strategi pemasaran digital omni-channel berbasis komunitas, kemitraan strategis, dan kampanye iklan berpenargetan konversi tinggi.`,
          bab4_rencana_operasional: `Sistem operasional terotomatisasi penuh terintegrasi dengan ekosistem KLIR OS untuk meminimalkan beban administrasi berulang.`,
          bab5_rencana_keuangan: `Investasi awal diproyeksikan mencapai titik impas (BEP) pada bulan ke-6 dengan estimasi Margin Laba Kotor 42% dan ROI tahun pertama 68%.`,
          bab6_manajemen_risiko: `Mitigasi risiko operasional dan pasar melalui diversifikasi portofolio layanan, SOP terdokumentasi, serta cadangan dana darurat minimal 3 bulan operasional.`,
        };
      }

      const project = await (prisma as any).corPlanProject.create({
        data: {
          workspaceId,
          title,
          revisionSeq: 1,
          outputs: {
            create: {
              module: 'business_plan',
              outputData: outputJson,
            },
          },
        },
        include: { outputs: true },
      });

      return NextResponse.json(project);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Pembuatan rencana bisnis gagal diproses.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

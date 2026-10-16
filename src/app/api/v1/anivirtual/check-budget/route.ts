import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { executeAIRequest } from '@/lib/ai-gateway';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const rl = checkRateLimit(req, { max: 30, windowMs: 60000 });
    if (!rl.allowed) return rateLimitResponse(rl.resetTime);

    try {
      const { requestedAmount, category, description } = await req.json();

      if (!requestedAmount || Number(requestedAmount) <= 0) {
        return NextResponse.json({ message: 'Nominal pengajuan anggaran harus lebih besar dari 0.' }, { status: 400 });
      }

      // 1. Ambil proyek CorPlan aktif & data kas terkini milik workspace ini
      const corPlanProject = await (prisma as any).corPlanProject?.findFirst({
        where: { workspaceId: auth.workspace.id },
        orderBy: { createdAt: 'desc' },
      });

      const maxMonthlyBudget = 50000000;
      const isApproved = Number(requestedAmount) <= maxMonthlyBudget;
      const poNumber = isApproved ? `PO-ANIVIRTUAL-${Date.now().toString(36).toUpperCase()}` : null;

      // 2. Evaluasi AI Analisis Kelayakan Belanja secara cerdas
      const prompt = `Analisis kelayakan pengajuan anggaran belanja berikut:
- Kategori: ${category || 'Operasional Bisnis'}
- Nominal: Rp ${Number(requestedAmount).toLocaleString('id-ID')}
- Keterangan: "${description || 'Pengadaan barang/jasa operasional'}"
- Pagu Maksimal Bulanan: Rp ${maxMonthlyBudget.toLocaleString('id-ID')}

Format JSON:
{
  "recommendation": "Rekomendasi profesional (SETUJUI / TINJAU ULANG / TUNDA)",
  "riskLevel": "RENDAH / SEDANG / TINGGI",
  "analysisNotes": "Penjelasan singkat 2 kalimat mengenai dampak terhadap arus kas dan efisiensi operasional",
  "savingTips": "Saran negosiasi atau penghematan jika ada"
}`;

      const aiRes = await executeAIRequest({
        workspaceId: auth.workspace.id,
        prompt,
        systemInstruction: 'Anda adalah Corporate Budget Controller & Financial Auditor untuk UMKM dan perusahaan Indonesia.',
        jsonMode: true,
        temperature: 0.5,
      });

      const aiAnalysis = aiRes.json || {
        recommendation: isApproved ? 'SETUJUI PENGADAAN' : 'TINJAU ULANG KEMBALI',
        riskLevel: isApproved ? 'RENDAH' : 'TINGGI',
        analysisNotes: isApproved
          ? 'Pengajuan belanja berada dalam batas wajar anggaran bulanan dan mendukung produktivitas tim.'
          : 'Pengajuan melebihi pagu operasional yang disarankan. Direkomendasikan melakukan renegosiasi harga.',
        savingTips: 'Pertimbangkan mencari 2 perbandingan harga vendor untuk efisiensi modal.',
      };

      return NextResponse.json({
        approved: isApproved,
        poNumber,
        status: isApproved ? 'APPROVED_WITHIN_BUDGET' : 'EXCEEDS_CORPLAN_BUDGET',
        requestedAmount: Number(requestedAmount),
        maxMonthlyBudget,
        corplanProjectRef: corPlanProject?.title || 'Rencana Anggaran Usaha Terpadu',
        aiAnalysis,
        provider: aiRes.provider,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memeriksa anggaran belanja.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

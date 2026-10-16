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
      const { title, annualRevenue = 500000000, annualNetProfit = 150000000, industryType = 'F&B / Retail' } = await req.json();

      if (!title) {
        return NextResponse.json({ message: 'Judul bisnis wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      // PREMIUM GATE: Analisis Valuasi &amp; SWOT tertutup untuk paket FREE
      if (!(await planAllowsFeature(workspaceId, 'valuationSwot'))) {
        const plan = await getWorkspacePlan(workspaceId);
        return NextResponse.json(
          {
            message: `Fitur Valuasi & SWOT AI hanya tersedia di paket Starter & Business. Paket Anda saat ini: ${plan.label}. Silakan upgrade untuk membuka fitur ini.`,
            code: 'FEATURE_LOCKED',
            requiredFeature: 'valuationSwot',
            currentPlan: plan.plan,
          },
          { status: 403 }
        );
      }

      // Kalkulasi Valuasi Bisnis Matematis
      // 1. Multiple of Revenue (Industri Retail/F&B rata-rata 1.5x - 2.5x)
      const revenueMultiple = industryType.toLowerCase().includes('tech') || industryType.toLowerCase().includes('saas') ? 4.5 : 2.0;
      const valuationByRevenue = Number(annualRevenue) * revenueMultiple;

      // 2. Multiple of Earnings / Net Profit (P/E Multiple rata-rata 5x - 8x)
      const profitMultiple = industryType.toLowerCase().includes('tech') ? 10.0 : 6.0;
      const valuationByProfit = Number(annualNetProfit) * profitMultiple;

      // Rata-rata Valuasi Wajar
      const estimatedFairValuation = Math.round((valuationByRevenue + valuationByProfit) / 2);

      // Eksekusi AI untuk Analisis SWOT & Manajemen Risiko (Biaya: 50 Kredit)
      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'corplan.swot',
          userId: auth.user.id,
          customCost: 50,
        },
        async () => {
          const prompt = `Lakukan Analisis SWOT mendalam dan rencana mitigasi risiko untuk bisnis '${title}' (Industri: ${industryType}, Omset: Rp ${annualRevenue}, Profit: Rp ${annualNetProfit}).
Format JSON keys:
{
  "strengths": ["...", "...", "..."],
  "weaknesses": ["...", "...", "..."],
  "opportunities": ["...", "...", "..."],
  "threats": ["...", "...", "..."],
  "riskMitigations": [
    { "risk": "...", "mitigation": "..." },
    { "risk": "...", "mitigation": "..." }
  ]
}`;

          const aiRes = await executeAIRequest({
            workspaceId,
            prompt,
            jsonMode: true,
            temperature: 0.6,
          });

          // FIX (audit workflow, sesi ini): fallback SWOT dulu tidak berpenanda, tampil
          // seolah hasil analisis AI asli kalau AI gateway gagal. isSampleData dipakai
          // pemanggil manapun yang menyambungkan endpoint ini ke UI di kemudian hari.
          const isFallback = !aiRes.json;
          const swotData = aiRes.json || {
            strengths: ['Diferensiasi produk kuat dengan standar kualitas tinggi', 'Efisiensi biaya melalui platform terintegrasi'],
            weaknesses: ['Ketergantungan pada rantai pasok lokal', 'Brand awareness tahap awal'],
            opportunities: ['Pertumbuhan segmen pasar digital 25% YoY', 'Peluang ekspansi kemitraan B2B'],
            threats: ['Fluktuasi harga bahan baku musiman', 'Masuknya kompetitor serupa berbiaya rendah'],
            riskMitigations: [
              { risk: 'Fluktuasi Bahan Baku', mitigation: 'Kontrak jangka panjang dengan petani/supplier utama' },
              { risk: 'Kompetisi Ketat', mitigation: 'Perkuat program loyalitas pelanggan dan keunikan cita rasa' },
            ],
          };

          return {
            businessTitle: title,
            valuation: {
              annualRevenue: Number(annualRevenue),
              annualNetProfit: Number(annualNetProfit),
              industryType,
              valuationByRevenue,
              valuationByProfit,
              estimatedFairValuation,
            },
            swot: swotData,
            provider: aiRes.provider,
            isSampleData: isFallback,
          };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Analisis valuasi dan SWOT gagal diproses.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

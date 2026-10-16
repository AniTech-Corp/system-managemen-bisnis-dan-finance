import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { deductCredit } from '@/lib/credit';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const userPayload = getUserFromRequest(req);
    if (!userPayload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { title, description } = await req.json();
    const workspaceId = userPayload.workspaceId;

    // Deduct 500 Credits Atomically
    await deductCredit(workspaceId, 500, 'corplan.generate', userPayload.userId);

    // Call Gemini AI or generate structured JSON output
    let outputJson: any;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Buatkan proposal bisnis 6 bab terstruktur JSON untuk bisnis '${title}': ${description}`;
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      outputJson = { bab1_eksekutif_summary: rawText.slice(0, 500) };
    } else {
      outputJson = {
        bab1_eksekutif_summary: `Proposal bisnis "${title}" dirancang untuk menjawab peluang pasar modern dengan efisiensi tinggi.`,
        bab2_analisis_pasar: `Pasar sasaran terdiri dari profesional dan pelaku usaha teknologi dengan pertumbuhan 24% per tahun.`,
        bab3_rencana_pemasaran: `Strategi pemasaran digital omni-channel berbasis komunitas dan kampanye berpenargetan.`,
        bab4_rencana_operasional: `Sistem operasional terotomatisasi penuh terintegrasi dengan ekosistem KLIR OS.`,
        bab5_rencana_keuangan: `Proyeksi Break-Even Point (BEP) tercapai pada bulan ke-6 dengan Margin Laba Kotor 42%.`,
        bab6_manajemen_risiko: `Mitigasi risiko operasional dan pasar melalui diversifikasi layanan serta cadangan dana darurat.`,
      };
    }

    const project = await prisma.corPlanProject.create({
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
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}

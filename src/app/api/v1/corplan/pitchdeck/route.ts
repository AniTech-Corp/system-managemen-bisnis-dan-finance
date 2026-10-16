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
      const { title, description, targetMarket, fundingGoal } = await req.json();

      if (!title) {
        return NextResponse.json({ message: 'Judul bisnis wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      // PREMIUM GATE: Pitch Deck AI tertutup untuk paket FREE
      if (!(await planAllowsFeature(workspaceId, 'pitchdeck'))) {
        const plan = await getWorkspacePlan(workspaceId);
        return NextResponse.json(
          {
            message: `Fitur Pitch Deck AI hanya tersedia di paket Starter & Business. Paket Anda saat ini: ${plan.label}. Silakan upgrade untuk membuka fitur ini.`,
            code: 'FEATURE_LOCKED',
            requiredFeature: 'pitchdeck',
            currentPlan: plan.plan,
          },
          { status: 403 }
        );
      }

      // Eksekusi atomis dengan jaminan pemotongan 300 kredit &amp; auto-refund jika gagal
      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'corplan.pitchdeck',
          userId: auth.user.id,
          metadata: { title, targetMarket },
        },
        async () => {
          const prompt = `Buatkan Pitch Deck Investor 12 Slide profesional dalam format JSON untuk bisnis '${title}'. 
Deskripsi: ${description || 'Bisnis komersial inovatif'}.
Target Market: ${targetMarket || 'Nasional Indonesia'}.
Target Pendanaan: ${fundingGoal || 'Rp 500.000.000'}.

Format output wajib JSON persis dengan array 12 slide berikut:
{
  "title": "${title}",
  "slides": [
    { "slideNumber": 1, "topic": "Cover & Vision", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 2, "topic": "Problem Statement", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 3, "topic": "Solution & Value Proposition", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 4, "topic": "Market Size & TAM SAM SOM", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 5, "topic": "Business Model & Monetization", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 6, "topic": "Traction & Milestones", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 7, "topic": "Go-To-Market Strategy", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 8, "topic": "Competitive Advantage & Moat", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 9, "topic": "Financial Projections (3 Years)", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 10, "topic": "Team & Key Leadership", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 11, "topic": "The Ask & Fund Allocation", "headline": "...", "bullets": ["...", "..."] },
    { "slideNumber": 12, "topic": "Closing & Contact", "headline": "...", "bullets": ["...", "..."] }
  ]
}`;

          const aiRes = await executeAIRequest({
            workspaceId,
            prompt,
            jsonMode: true,
            temperature: 0.6,
          });

          // FIX (audit workflow, sesi ini): fallback ini dulu tidak berpenanda (angka TAM/ARR/
          // NPS karangan tampil seolah hasil AI asli) DAN slide 12 hardcode kontak internal
          // AniTech ('ceo@anitech.dev'/'anitech.dev') -- bocor identitas internal ke output
          // pitch deck user lain kalau fallback ini terpicu. isFallback dipakai pemanggil
          // manapun yang menyambungkan endpoint ini ke UI di kemudian hari.
          const isFallback = !aiRes.json?.slides;
          const slidesData = aiRes.json?.slides || [
            { slideNumber: 1, topic: 'Cover & Vision', headline: `${title} — Masa Depan Industri`, bullets: ['Solusi inovatif untuk efisiensi bisnis', 'Didukung teknologi ekosistem cerdas'] },
            { slideNumber: 2, topic: 'Problem Statement', headline: 'Tantangan Operasional & Efisiensi', bullets: ['Proses manual membuang 40% waktu kerja', 'Tingginya biaya operasional konvensional'] },
            { slideNumber: 3, topic: 'Solution', headline: 'Platform Terpadu & Terotomatisasi', bullets: ['Integrasi data end-to-end tanpa silo', 'Pengurangan biaya operasional hingga 60%'] },
            { slideNumber: 4, topic: 'Market Size', headline: 'Potensi Pasar UMKM & Komersial', bullets: ['TAM: Rp 120 Triliun pasar nasional', 'SOM: Rp 15 Miliar target tahun pertama'] },
            { slideNumber: 5, topic: 'Business Model', headline: 'Langganan Berjenjang & Transaksional', bullets: ['Recurring subscription bulanan', 'Monetisasi berbasis kuota & transaksi'] },
            { slideNumber: 6, topic: 'Traction', headline: 'Pertumbuhan Pengguna & Retensi Kuat', bullets: ['Pertumbuhan MoM 25%', 'Net Promoter Score (NPS) 88/100'] },
            { slideNumber: 7, topic: 'Go-To-Market', headline: 'Direct Sales & Community Driven', bullets: ['Kemitraan strategis asosiasi bisnis', 'Pemasaran konten edukasi berpenargetan'] },
            { slideNumber: 8, topic: 'Competitive Advantage', headline: 'Ekosistem Terpadu & Standar Lokal', bullets: ['Kepatuhan regulasi & perbankan Indonesia', 'Model data terisolasi & efisiensi biaya'] },
            { slideNumber: 9, topic: 'Financial Projections', headline: 'Proyeksi Laba Bersih & Arus Kas Positif', bullets: ['BEP tercapai pada bulan ke-6', 'Proyeksi ARR Rp 2,4 Miliar di Tahun 2'] },
            { slideNumber: 10, topic: 'Team', headline: 'Kepemimpinan Berpengalaman', bullets: ['Pendiri berpengalaman industri teknologi & finansial', 'Didukung tim engineering kelas dunia'] },
            { slideNumber: 11, topic: 'The Ask', headline: `Penggalangan Dana ${fundingGoal || 'Rp 500 Juta'}`, bullets: ['50% Pengembangan Produk & AI', '30% Ekspansi Pasar & Sales', '20% Cadangan Operasional'] },
            { slideNumber: 12, topic: 'Closing', headline: 'Mari Berkolaborasi Bersama Kami', bullets: ['Hubungi tim Anda untuk detail lebih lanjut', 'Lampirkan kontak resmi bisnis Anda di sini'] },
          ];

          const project = await (prisma as any).corPlanProject.create({
            data: {
              workspaceId,
              title: `${title} (Pitch Deck)`,
              revisionSeq: 1,
              outputs: {
                create: {
                  module: 'pitch_deck',
                  outputData: { slides: slidesData },
                },
              },
            },
            include: { outputs: true },
          });

          return { project, slides: slidesData, provider: aiRes.provider, isSampleData: isFallback };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Pembuatan pitch deck gagal diproses.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

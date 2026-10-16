import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrBuildBusinessContext, runForwardForecast } from '@/lib/ai-brain';
import { authenticateTenantRequest, extractTokenFromRequest } from '@/lib/tenant-guard';
import { blendForecast, extractSignalsFromResearch } from '@/lib/forecast-blend';
import type { ExternalSignal, ResearchWebResult } from '@/lib/research-types';
import { publicApiError } from '@/lib/api-error';
import { resolveDivisionRole } from '@/lib/ai-brain/data-visibility';
import { isNewDivisionRole } from '@/lib/ai-brain/role-policy';

// POST /api/v1/brain/forecast -- prediksi kas masa depan (1/3/6/12 bulan)
// yang MENGGABUNGKAN proyeksi internal (runForwardForecast, prediction-engine.ts
// milik Fatur, DIBACA SAJA lewat barrel '@/lib/ai-brain') dengan sinyal riset
// publik opsional (researchWeb milik B1) dan input tambahan pengguna. Dibangun
// 8 Sep 2026 (wave B2-forecast-blend), permintaan Mecca 8 Sep sore.
//
// SECURITY (Multi-Tenant Isolation): pola guard SAMA seperti recommendations/
// route.ts, simulate/route.ts, dan location/route.ts -- authenticateTenantRequest
// dulu sebelum apapun lain, workspaceId HANYA dari sesi terautentikasi.
export const runtime = 'nodejs';

const extraDataSchema = z
  .object({
    targetRevenue: z.number().finite().positive().optional(),
    priceChangePct: z.number().finite().min(-100).max(500).optional(),
    newBranch: z.boolean().optional(),
    costChangePct: z.number().finite().min(-100).max(500).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .optional();

const bodySchema = z.object({
  horizonMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).optional(),
  question: z.string().trim().max(500).optional(),
  extraData: extraDataSchema,
  useResearch: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // SECURITY (Zero-Auth Bypass Guard, 8 Sep sore, pola chat/route.ts): tanpa token sama sekali
    // tenant-guard dev-mode fallback ke user pertama -- tolak di sini dulu.
    if (!extractTokenFromRequest(req)) {
      return NextResponse.json({ success: false, code: 'UNAUTHENTICATED', message: 'Autentikasi diperlukan.' }, { status: 401 });
    }
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }
    const divisionRole = resolveDivisionRole({ email: guard.auth.user.email, membershipRole: guard.auth.membership.role, membershipDivisionRole: guard.auth.membership.divisionRole });
    if (isNewDivisionRole(divisionRole)) {
      return NextResponse.json({ success: false, code: 'ROLE_CAPABILITY_UNSUPPORTED', message: divisionRole === 'MANAGER_UMUM' ? 'Forecast Manager membutuhkan scope tim authoritative; company-wide finance tidak digunakan sebagai fallback.' : 'Forecast keuangan belum tersedia untuk role ini.' }, { status: divisionRole === 'MANAGER_UMUM' ? 409 : 403 });
    }
    const workspaceId = guard.auth.workspace.id;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      // Body kosong/tidak ada JSON dianggap "pakai semua default" (horizon=3,
      // tanpa riset, tanpa extraData) -- BUKAN error, konsisten dengan
      // semangat "klien lama tetap jalan" di context pack.
      rawBody = {};
    }

    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Input prediksi tidak valid',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { horizonMonths: rawHorizon, question, extraData, useResearch } = parsed.data;
    const horizonMonths = (rawHorizon ?? 3) as 1 | 3 | 6 | 12;

    const context = await getOrBuildBusinessContext(workspaceId, false, null, { includeCompanyKnowledge: true, includeMarketingMetrics: true });
    const base = runForwardForecast(context, horizonMonths);

    let researchUsed: ResearchWebResult | null = null;
    let externalSignals: ExternalSignal[] = [];

    if (useResearch) {
      try {
        // Dynamic import (bukan import statis di kepala file) SENGAJA -- kalau
        // web-research.ts (milik B1) belum ada/gagal load saat build/tsc modul
        // lain, endpoint ini TIDAK ikut pecah untuk pemanggil yang tidak minta
        // riset (useResearch tidak dikirim/false). fail-soft juga untuk error
        // runtime apapun dari researchWeb sendiri (timeout/429/dst sudah
        // ditangani di dalam researchWeb, tapi dijaga dobel di sini).
        const { researchWeb } = await import('@/lib/web-research');
        const query = question && question.length > 0 ? question : `tren bisnis ${context.strategy?.primaryIndustry || 'UMKM'}`;
        researchUsed = await researchWeb(query, { region: 'ID' });
        if (researchUsed && researchUsed.available && researchUsed.summary) {
          externalSignals = extractSignalsFromResearch(researchUsed.summary);
        }
      } catch (err) {
        console.warn('[Brain Forecast] researchWeb gagal/tidak tersedia -- lanjut tanpa data publik:', err);
        researchUsed = null;
        externalSignals = [];
      }
    }

    const forecast = blendForecast({
      base,
      horizonMonths,
      externalSignals,
      extraData,
      // KOREKSI kritik "terlewat" TINGGI #1 (lihat forecast-blend.ts) -- kirim
      // angka 30 hari asli supaya dataSufficiency tidak salah tebak workspace
      // yang breakeven/untung sebagai "tidak ada data".
      financials30d: {
        totalIncome30d: context.financials.totalIncome30d,
        totalExpense30d: context.financials.totalExpense30d,
      },
    });

    return NextResponse.json({
      success: true,
      data: { forecast, researchUsed },
    });
  } catch (error: any) {
    console.error('[AI Brain Forecast API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicApiError('Gagal membuat prediksi bisnis.'),
      },
      { status: 500 }
    );
  }
}

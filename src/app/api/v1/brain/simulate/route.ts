import { NextRequest, NextResponse } from 'next/server';
import {
  getOrBuildBusinessContext,
  runWhatIfSimulation,
  SimulationScenarioInput,
} from '@/lib/ai-brain';
import { authenticateTenantRequest } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { resolveDivisionRole } from '@/lib/ai-brain/data-visibility';
import { isNewDivisionRole } from '@/lib/ai-brain/role-policy';

export async function POST(req: NextRequest) {
  try {
    // SECURITY (Multi-Tenant Isolation): resolve workspace HANYA dari sesi
    // pemanggil yang terautentikasi -- bukan dari body/header yang dikontrol
    // pemanggil. Tanpa requiredWorkspaceId: fungsi otomatis resolve ke
    // workspace milik user (lihat tenant-guard.ts baris 119-136).
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }
    const divisionRole = resolveDivisionRole({ email: guard.auth.user.email, membershipRole: guard.auth.membership.role, membershipDivisionRole: guard.auth.membership.divisionRole });
    if (isNewDivisionRole(divisionRole)) {
      return NextResponse.json({ success: false, code: 'ROLE_CAPABILITY_UNSUPPORTED', message: 'Simulasi Finance tidak tersedia untuk role baru dan tidak memakai company-wide cash sebagai fallback.' }, { status: 403 });
    }
    const workspaceId = guard.auth.workspace.id;

    const body = await req.json();

    const context = await getOrBuildBusinessContext(workspaceId, false, null, { includeCompanyKnowledge: true, includeMarketingMetrics: true });

    // Heuristic parameter extraction from natural language prompt
    const prompt = (body.promptDescription || '').trim();
    let additionalMonthlyExpense = body.adjustments?.additionalMonthlyExpense || 0;
    let oneTimeCapex = body.adjustments?.oneTimeCapex || 0;
    let marketingBudgetDeltaPercent = body.adjustments?.marketingBudgetDeltaPercent || 0;
    let expectedRevenueDeltaPercent = body.adjustments?.expectedRevenueDeltaPercent || 0;
    let durationMonths = body.adjustments?.durationMonths || 6;

    if (prompt) {
      const lower = prompt.toLowerCase();

      // 1. Deteksi durasi dari teks prompt jika ada (mis. "selama 3 bulan", "dalam 12 bulan")
      const durMatch = lower.match(/(?:selama|dalam|periode|horizon)\s+(\d+)\s*(?:bulan|bln)/i);
      if (durMatch) {
        durationMonths = Math.min(24, Math.max(1, parseInt(durMatch[1], 10)));
      }

      // 2. Deteksi gaji jika disebutkan di prompt (mis. "gaji 8jt", "gaji 12 juta", "gaji 5.5 jt")
      let parsedSalary = 6000000; // default benchmark per orang
      const salaryMatch = lower.match(/(?:gaji|upah|fee)\s*(?:sebesar)?\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:jt|juta|k|ribu)?/i);
      if (salaryMatch) {
        const raw = parseFloat(salaryMatch[1].replace(',', '.'));
        if (raw < 1000) parsedSalary = Math.round(raw * 1000000);
        else parsedSalary = Math.round(raw);
      }

      // 3. Pangkas / Kurangi Karyawan (Penghematan Biaya Gaji / Expense Berkurang)
      const cutStaffMatch = lower.match(/(?:pangkas|kurangi|cut|phk|pecat|berhentikan)\s+(?:karyawan\s+)?(\d+)?\s*(?:orang|karyawan|staf|staff|dev|developer|admin|sales)?/i);
      if (cutStaffMatch) {
        const count = cutStaffMatch[1] ? parseInt(cutStaffMatch[1], 10) : 2;
        additionalMonthlyExpense -= (count * parsedSalary);
      }

      // 4. Rekrut / Tambah Karyawan (Penambahan Beban Gaji)
      const hireMatch = lower.match(/(?:rekrut|hire|tambah)\s+(\d+)?\s*(?:orang|karyawan|staf|staff|dev|developer|admin|sales)/i);
      if (hireMatch) {
        const count = hireMatch[1] ? parseInt(hireMatch[1], 10) : 1;
        additionalMonthlyExpense += (count * parsedSalary);
      }

      // 5. Pangkas Biaya Operasional / Umum
      const cutOpsMatch = lower.match(/(?:pangkas|kurangi|turunkan|hemat)\s+(?:biaya|beban|operasional|ops)\s*(?:sebesar)?\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:jt|juta|k|ribu)?/i);
      if (cutOpsMatch) {
        const raw = parseFloat(cutOpsMatch[1].replace(',', '.'));
        const amt = raw < 1000 ? Math.round(raw * 1000000) : Math.round(raw);
        additionalMonthlyExpense -= amt;
      }

      // 6. Turunkan Budget Iklan / Marketing (Persentase Negatif)
      const mktDownMatch = lower.match(/(?:turunkan|pangkas|kurangi|potong)\s+(?:budget|anggaran|biaya)?\s*(?:iklan|ads|marketing|promo).*?(\d+)%/i);
      if (mktDownMatch) {
        marketingBudgetDeltaPercent -= parseInt(mktDownMatch[1], 10);
      }

      // 7. Naikkan Budget Iklan / Marketing (Persentase Positif)
      const mktUpMatch = lower.match(/(?:naikkan|tambah|tingkatkan)\s+(?:budget|anggaran|biaya)?\s*(?:iklan|ads|marketing|promo).*?(\d+)%/i);
      if (mktUpMatch) {
        marketingBudgetDeltaPercent += parseInt(mktUpMatch[1], 10);
      }

      // 8. Target Kenaikan Omset / Revenue
      const revMatch = lower.match(/(?:omset|revenue|pendapatan).*?(?:naik|tumbuh|tambah|target).*?(\d+)%/i);
      if (revMatch) {
        expectedRevenueDeltaPercent += parseInt(revMatch[1], 10);
      }
    }

    const input: SimulationScenarioInput = {
      workspaceId,
      scenarioTitle: body.scenarioTitle || prompt.slice(0, 50) || 'Simulasi Strategis',
      promptDescription: prompt,
      adjustments: {
        additionalMonthlyExpense,
        oneTimeCapex,
        marketingBudgetDeltaPercent,
        expectedRevenueDeltaPercent,
        durationMonths,
      },
    };

    const simulationResult = runWhatIfSimulation(context, input);

    return NextResponse.json({
      success: true,
      data: simulationResult,
    });
  } catch (error: any) {
    console.error('[AI Brain Simulator API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicApiError('Simulasi strategi gagal diproses.'),
      },
      { status: 500 }
    );
  }
}

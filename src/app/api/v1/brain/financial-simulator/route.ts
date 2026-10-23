import { NextRequest, NextResponse } from 'next/server';
import {
  getOrBuildBusinessContext,
  runEnhancedFinancialDecisionSimulation,
  type DecisionSimulationInput,
  type DecisionSimulationAdjustments,
  type DecisionScenarioType,
} from '@/lib/ai-brain';
import { authenticateTenantRequest } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { resolveDivisionRole } from '@/lib/ai-brain/data-visibility';
import { isNewDivisionRole } from '@/lib/ai-brain/role-policy';

const SCENARIO_TYPES: DecisionScenarioType[] = [
  'employee_hiring',
  'asset_purchase',
  'pricing_change',
  'cost_change',
  'custom',
];

const FINANCING_METHODS = ['cash', 'installment', 'lease'] as const;

/** Angka dari body: dipaksa finite dan dijepit ke rentang wajar. */
function readOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

/**
 * Ekstraksi parameter dari prompt bahasa natural. Hanya dipakai untuk mengisi
 * field yang TIDAK dikirim eksplisit lewat `adjustments` -- input eksplisit
 * dari UI selalu menang.
 */
function extractFromPrompt(prompt: string, target: DecisionSimulationAdjustments): void {
  const lower = prompt.toLowerCase();

  const durationMatch = lower.match(/(?:selama|dalam|periode|horizon)\s+(\d+)\s*(?:bulan|bln)/i);
  if (durationMatch && target.durationMonths === undefined) {
    target.durationMonths = Number(durationMatch[1]);
  }

  const salaryMatch = lower.match(/(?:gaji|upah|fee)\s*(?:sebesar)?\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(jt|juta|k|ribu)?/i);
  if (salaryMatch && target.averageSalary === undefined) {
    const raw = Number(salaryMatch[1].replace(',', '.'));
    const unit = (salaryMatch[2] || '').toLowerCase();
    if (unit === 'jt' || unit === 'juta') target.averageSalary = raw * 1_000_000;
    else if (unit === 'k' || unit === 'ribu') target.averageSalary = raw * 1_000;
    else target.averageSalary = raw < 1000 ? raw * 1_000_000 : raw;
  }

  const hireMatch = lower.match(/(?:rekrut|rekrutmen|hire|tambah)\s+(\d+)?\s*(?:orang|karyawan|pegawai|staf|staff|dev|developer|admin|sales)/i);
  if (hireMatch && target.hiringCount === undefined) {
    target.hiringCount = hireMatch[1] ? Number(hireMatch[1]) : 1;
  }

  const priceMatch = lower.match(/(?:naikkan|turunkan|ubah)\s+harga\s*(?:sebesar)?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (priceMatch && target.priceChangePercent === undefined) {
    const magnitude = Number(priceMatch[1].replace(',', '.'));
    target.priceChangePercent = /turunkan/i.test(priceMatch[0]) ? -magnitude : magnitude;
  }

  const assetMatch = lower.match(/(?:beli|pembelian)\s+(?:aset|mesin|peralatan|kendaraan)\s*(?:sebesar|senilai)?\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(jt|juta|m|miliar)?/i);
  if (assetMatch && target.assetCost === undefined) {
    const raw = Number(assetMatch[1].replace(',', '.'));
    const unit = (assetMatch[2] || '').toLowerCase();
    if (unit === 'jt' || unit === 'juta') target.assetCost = raw * 1_000_000;
    else if (unit === 'm' || unit === 'miliar') target.assetCost = raw * 1_000_000_000;
    else target.assetCost = raw;
  }
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY (Multi-Tenant Isolation): workspace diambil HANYA dari sesi
    // terautentikasi, bukan dari body/header yang dikontrol pemanggil.
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }

    const divisionRole = resolveDivisionRole({
      email: guard.auth.user.email,
      membershipRole: guard.auth.membership.role,
      membershipDivisionRole: guard.auth.membership.divisionRole,
    });
    if (isNewDivisionRole(divisionRole)) {
      return NextResponse.json(
        {
          success: false,
          code: 'ROLE_CAPABILITY_UNSUPPORTED',
          message:
            'Simulasi Keputusan Finansial tidak tersedia untuk role baru dan tidak memakai company-wide cash sebagai fallback.',
        },
        { status: 403 }
      );
    }

    const workspaceId = guard.auth.workspace.id;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, code: 'INVALID_BODY', message: 'Body harus JSON yang valid.' },
        { status: 400 }
      );
    }

    const prompt = String(body?.promptDescription || '').trim();
    const rawAdjustments = body?.adjustments ?? {};

    // Tipe skenario eskplisit divalidasi terhadap whitelist.
    const requestedType = rawAdjustments?.scenarioType;
    const scenarioType: DecisionScenarioType | undefined = SCENARIO_TYPES.includes(requestedType)
      ? requestedType
      : undefined;

    const adjustments: DecisionSimulationAdjustments = {
      scenarioType,

      // Legacy / what-if fields
      additionalMonthlyExpense: readOptionalNumber(rawAdjustments?.additionalMonthlyExpense, -10_000_000_000, 10_000_000_000),
      oneTimeCapex: readOptionalNumber(rawAdjustments?.oneTimeCapex, 0, 1_000_000_000_000),
      marketingBudgetDeltaPercent: readOptionalNumber(rawAdjustments?.marketingBudgetDeltaPercent, -100, 500),
      expectedRevenueDeltaPercent: readOptionalNumber(rawAdjustments?.expectedRevenueDeltaPercent, -100, 1000),
      durationMonths: readOptionalNumber(rawAdjustments?.durationMonths, 1, 60),

      // employee_hiring
      hiringCount: readOptionalNumber(rawAdjustments?.hiringCount, 0, 500),
      averageSalary: readOptionalNumber(rawAdjustments?.averageSalary, 0, 1_000_000_000),
      onboardingCost: readOptionalNumber(rawAdjustments?.onboardingCost, 0, 1_000_000_000),
      productivityImpact: readOptionalNumber(rawAdjustments?.productivityImpact, -1, 5),

      // asset_purchase
      assetCost: readOptionalNumber(rawAdjustments?.assetCost, 0, 1_000_000_000_000),
      depreciationPeriodYears: readOptionalNumber(rawAdjustments?.depreciationPeriodYears, 1, 50),
      financingMethod: FINANCING_METHODS.includes(rawAdjustments?.financingMethod)
        ? rawAdjustments.financingMethod
        : undefined,
      expectedROI: readOptionalNumber(rawAdjustments?.expectedROI, 0, 5),

      // pricing_change
      priceChangePercent: readOptionalNumber(rawAdjustments?.priceChangePercent, -95, 500),
      volumeChangeImpact: readOptionalNumber(rawAdjustments?.volumeChangeImpact, 0, 5),
      competitiveResponse:
        typeof rawAdjustments?.competitiveResponse === 'boolean' ? rawAdjustments.competitiveResponse : undefined,

      // cost_change
      materialCostChangePercent: readOptionalNumber(rawAdjustments?.materialCostChangePercent, -100, 300),
      laborCostChangePercent: readOptionalNumber(rawAdjustments?.laborCostChangePercent, -100, 300),
      operationalEfficiency: readOptionalNumber(rawAdjustments?.operationalEfficiency, 0.1, 10),
    };

    if (prompt) extractFromPrompt(prompt, adjustments);

    // Default horizon 12 bulan untuk simulator keputusan.
    if (adjustments.durationMonths === undefined) adjustments.durationMonths = 12;

    const context = await getOrBuildBusinessContext(workspaceId, false, null, {
      includeCompanyKnowledge: true,
      includeMarketingMetrics: true,
    });

    const input: DecisionSimulationInput = {
      workspaceId,
      scenarioTitle: String(body?.scenarioTitle || '').trim() || prompt.slice(0, 60) || 'Simulasi Keputusan Finansial',
      promptDescription: prompt,
      adjustments,
    };

    const simulationResult = runEnhancedFinancialDecisionSimulation(context, input);

    return NextResponse.json({
      success: true,
      data: simulationResult,
    });
  } catch (error: any) {
    console.error('[AI Brain Financial Decision Simulator API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicApiError('Simulasi keputusan finansial gagal diproses.'),
      },
      { status: 500 }
    );
  }
}

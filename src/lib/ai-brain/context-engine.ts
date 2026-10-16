import { prisma } from '../prisma';
import {
  BusinessContextSnapshot,
  FinancialHealthMetrics,
  MarketingHealthMetrics,
  OperationsHealthMetrics,
  StrategyHealthMetrics,
  InventoryHealthMetrics,
  DocumentHealthMetrics,
  CompanyHealthScore,
} from './types';
import { resolveDateRange } from '../time-series-engine';
// TAMBAHAN (KELOMPOK 3, 6-7 Sep 2026): reuse fungsi yang SUDAH ADA di company-memory.ts,
// BUKAN menulis query prisma.memoryItem baru di sini -- supaya batas jumlah/panjang (10
// item terakhir, potong ~3000 karakter) dan format gabungannya tetap SATU sumber kebenaran,
// tidak ada 2 cara berbeda membaca tag [COMPANY_KNOWLEDGE] yang bisa divergen. Fungsi ini
// non-fatal (try/catch di dalamnya sendiri, return '' kalau gagal, TIDAK PERNAH throw),
// jadi aman ditaruh langsung di Promise.all tanpa .catch() tambahan di sini.
import { getAccumulatedCompanyKnowledge } from './company-memory';
import { buildWorkspaceKnowledgeBlock } from './workspace-knowledge';

/** Company knowledge untuk konsumen context-engine (bukan chat): manifest semua file
 * Pusat Data + isi 4 file terbaru (query kosong -> urut kebaruan). Kalau modul baru
 * mengembalikan kosong (Pusat Data kosong) atau gagal, jatuh ke jalur lama
 * getAccumulatedCompanyKnowledge supaya tidak ada regresi untuk workspace yang cuma
 * punya pengetahuan dari lampiran chat. Non-fatal: selalu resolve string. */
async function buildContextCompanyKnowledge(workspaceId: string): Promise<string> {
  try {
    const block = await buildWorkspaceKnowledgeBlock(workspaceId, '');
    const combined = [block.manifest, block.relevant].filter(Boolean).join('\n\n');
    if (combined) return combined;
  } catch (err) {
    console.warn('[ContextEngine] workspace-knowledge gagal, fallback ke company-memory (non-fatal):', err);
  }
  return getAccumulatedCompanyKnowledge(workspaceId);
}

// In-Memory Cache Store for Business Context Snapshots
const contextSnapshotCache = new Map<string, { snapshot: BusinessContextSnapshot; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 Seconds

/**
 * TAMBAHAN (KELOMPOK 3, 6-7 Sep 2026). Opsional, default false SUPAYA PERILAKU LAMA
 * PERSIS SAMA untuk SEMUA pemanggil yang sudah ada (brain/alerts, brain/nudges,
 * brain/recommendations, brain/simulate, brain/decision-memory, brain/execute lewat
 * execution-engine.ts, brain/chat, generation-engine.ts) -- NOL query prisma tambahan,
 * NOL perubahan bentuk snapshot yang mereka terima, kalau opsi ini tidak diminta.
 * Dibuat opt-in (bukan otomatis jalan tiap kali) setelah ketahuan lewat test suite
 * (tests/brain-execute-guard.test.ts) bahwa beberapa jalur pemanggil sengaja diverifikasi
 * ketat "tidak ada operasi Prisma tak terduga" -- menambah query baru begitu saja di
 * jalur bersama ini akan mematahkan kontrak test itu meski tidak ada bug fungsional.
 * Consumer yang BUTUH companyKnowledgeSummary tinggal panggil dengan
 * `{ includeCompanyKnowledge: true }` (lihat field baru di types.ts untuk detail batas
 * panjang/jumlahnya).
 */
export interface BusinessContextOptions {
  includeCompanyKnowledge?: boolean;
  // Campaign count is additive and opt-in. Legacy/shared consumers such as
  // action execution must not gain a new Prisma dependency just by reading
  // the existing business snapshot.
  includeMarketingMetrics?: boolean;
}

/**
 * Deterministic Context Engine
 * Aggregates multi-tenant business data from Postgres/Prisma into a unified snapshot.
 */
export async function getOrBuildBusinessContext(
  workspaceId: string,
  forceFresh: boolean = false,
  targetMonth?: string | null,
  options?: BusinessContextOptions
): Promise<BusinessContextSnapshot> {
  const now = Date.now();
  const includeCompanyKnowledge = options?.includeCompanyKnowledge === true;
  const includeMarketingMetrics = options?.includeMarketingMetrics === true;
  // Varian "dengan company knowledge" dikasih namespace cache TERPISAH (suffix "_ck") dari
  // varian biasa -- TTL_MS dan mekanisme expiresAt-nya TIDAK diubah sama sekali, cuma
  // dicegah supaya snapshot tanpa companyKnowledgeSummary (di-cache pemanggil lama) tidak
  // pernah salah kepakai balik oleh pemanggil baru yang minta field itu, atau sebaliknya.
  const cacheKey = `${targetMonth ? `${workspaceId}_${targetMonth}` : workspaceId}${includeCompanyKnowledge ? '_ck' : ''}${includeMarketingMetrics ? '_mkt' : ''}`;
  const cached = contextSnapshotCache.get(cacheKey);

  if (!forceFresh && cached && cached.expiresAt > now) {
    return cached.snapshot;
  }

  // 1. Fetch Workspace & Basic Data + Dynamic Profile Memory
  // TAMBAHAN (KELOMPOK 3): companyKnowledgeSummary HANYA di-query kalau diminta eksplisit
  // (lihat BusinessContextOptions di atas) -- cara baca [COMPANY_PROFILE] di elemen kedua
  // (profileMemory) TIDAK disentuh/digabung sama sekali, tetap query+parsing persis seperti
  // sebelumnya untuk SEMUA pemanggil, diminta company knowledge atau tidak.
  const [workspace, profileMemory, companyKnowledgeSummary] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
    }),
    prisma.memoryItem.findFirst({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: '[COMPANY_PROFILE]' },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // 7 Sep malam: konsumen context-engine (brain/alerts, recommendations, simulate,
    // generation-engine utk PPT/Word/Excel dari data perusahaan) sekarang ikut dapat
    // manifest SEMUA file Pusat Data + isi file terbaru (workspace-knowledge.ts, query
    // kosong = urut kebaruan), bukan cuma 10 MemoryItem terpotong. Fallback ke
    // getAccumulatedCompanyKnowledge kalau Pusat Data kosong / modul gagal (non-fatal).
    includeCompanyKnowledge ? buildContextCompanyKnowledge(workspaceId) : Promise.resolve(''),
  ]);

  let workspaceName = workspace?.name || 'Workspace Bisnis';

  // Parse company profile from memory if available
  let memoryIndustry: string | null = null;
  let memoryTargetMarket: string | null = null;
  if (profileMemory?.content) {
    const nameMatch = profileMemory.content.match(/Nama:\s*([^|]+)/i);
    if (nameMatch && nameMatch[1].trim() && nameMatch[1].trim() !== '-') {
      workspaceName = nameMatch[1].trim();
    }
    const indMatch = profileMemory.content.match(/Industri:\s*([^|]+)/i);
    if (indMatch && indMatch[1].trim() && indMatch[1].trim() !== '-') {
      memoryIndustry = indMatch[1].trim();
    }
    const targetMatch = profileMemory.content.match(/Target Pasar:\s*([^|]+)/i);
    if (targetMatch && targetMatch[1].trim() && targetMatch[1].trim() !== '-') {
      memoryTargetMarket = targetMatch[1].trim();
    }
  }

  // 2. Fetch Financial Data (Transactions & Invoices)
  const resolution = resolveDateRange({ month: targetMonth });

  const [allTransactions, last30dTransactions, allInvoices] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: {
        workspaceId,
        transactionDate: { lte: resolution.endDate },
      },
      select: { type: true, amount: true, category: true, transactionDate: true },
    }),
    prisma.cashTransaction.findMany({
      where: {
        workspaceId,
        transactionDate: {
          gte: resolution.startDate,
          lte: resolution.endDate,
        },
      },
      select: { type: true, amount: true, category: true },
    }),
    prisma.invoice.findMany({
      where: { workspaceId },
      select: { status: true, totalAmount: true, dueDate: true },
    }),
  ]);

  // Aggregate Liquid Cash
  let totalAllIncome = 0;
  let totalAllExpense = 0;
  for (const tx of allTransactions) {
    if (tx.type === 'INCOME') totalAllIncome += tx.amount;
    else totalAllExpense += tx.amount;
  }
  // Saldo kas boleh negatif. Clamping defisit menjadi nol membuat AI kehilangan
  // sinyal paling penting untuk runway dan keputusan pemulihan kas.
  const liquidCash = totalAllIncome - totalAllExpense;

  // Aggregate 30d Financials
  let totalIncome30d = 0;
  let totalExpense30d = 0;
  let opEx30d = 0;
  let capEx30d = 0;

  for (const tx of last30dTransactions) {
    if (tx.type === 'INCOME') {
      totalIncome30d += tx.amount;
    } else {
      totalExpense30d += tx.amount;
      const cat = (tx.category || '').toLowerCase();
      if (cat.includes('capex') || cat.includes('aset') || cat.includes('investasi') || cat.includes('mesin')) {
        capEx30d += tx.amount;
      } else {
        opEx30d += tx.amount;
      }
    }
  }

  const netCashflow30d = totalIncome30d - totalExpense30d;
  const monthlyBurnRate = netCashflow30d < 0 ? Math.abs(netCashflow30d) : 0;
  
  // Tanpa transaksi kas sama sekali, runway belum bisa dihitung. Nilai 99 hanya
  // sah sebagai "tidak terbatas" kalau memang ada histori transaksi dengan burn 0;
  // default 99 pada workspace kosong membuat AI mengklaim kas aman padahal belum
  // ada sumber data.
  let runwayMonths = 0.0;
  let runwayIsUnbounded = false;
  if (liquidCash > 0) {
    if (monthlyBurnRate > 0) {
      runwayMonths = Number((liquidCash / monthlyBurnRate).toFixed(1));
    } else {
      // Kas positif tanpa defisit bulanan
      runwayMonths = 99.0;
      runwayIsUnbounded = true;
    }
  }

  // Aggregate Invoices
  let totalUnpaidInvoices = 0;
  let unpaidInvoicesCount = 0;
  let overdueInvoicesCount = 0;
  const currentDate = new Date();

  for (const inv of allInvoices) {
    if (inv.status === 'UNPAID' || inv.status === 'DRAFT' || inv.status === 'OVERDUE') {
      totalUnpaidInvoices += inv.totalAmount;
      unpaidInvoicesCount++;
      if (inv.dueDate && new Date(inv.dueDate) < currentDate) {
        overdueInvoicesCount++;
      }
    }
  }

  const grossMarginPercent = totalIncome30d > 0
    ? Math.max(0, Math.min(100, Math.round(((totalIncome30d - totalExpense30d) / totalIncome30d) * 100)))
    : 0;

  const financials: FinancialHealthMetrics = {
    liquidCash,
    totalIncome30d,
    totalExpense30d,
    netCashflow30d,
    monthlyBurnRate,
    runwayMonths,
    runwayIsUnbounded,
    totalUnpaidInvoices,
    unpaidInvoicesCount,
    overdueInvoicesCount,
    opEx30d,
    capEx30d,
    grossMarginPercent,
  };

  // 3. Fetch Marketing Data (Promo Coupons & Campaigns). Campaigns and coupons
  // are different domain objects; active coupons must never be reported as active
  // ad campaigns. Redemption history has no event timestamp in the current schema,
  // so it is intentionally not fabricated as a 30-day metric.
  const [promoCouponsResult, activeCampaignsResult] = await Promise.allSettled([
    prisma.promoCoupon.findMany({ where: { workspaceId } }),
    includeMarketingMetrics
      ? prisma.campaign.count({ where: { workspaceId, status: 'ACTIVE' } })
      : Promise.resolve(0),
  ]);
  const promoCoupons = promoCouponsResult.status === 'fulfilled' ? promoCouponsResult.value : [];
  const activeCampaignsCount = activeCampaignsResult.status === 'fulfilled' ? activeCampaignsResult.value : 0;
  if (promoCouponsResult.status === 'rejected') {
    console.warn('[ContextEngine] metrik kupon tidak tersedia (non-fatal):', promoCouponsResult.reason);
  }
  if (activeCampaignsResult.status === 'rejected') {
    console.warn('[ContextEngine] metrik kampanye tidak tersedia (non-fatal):', activeCampaignsResult.reason);
  }

  const activeCoupons = promoCoupons.filter((c) => c.isActive);
  // Marketing spend from transactions categorized as Marketing/Iklan/Promo
  const marketingSpend30d = last30dTransactions
    .filter((tx) => tx.type === 'EXPENSE' && /marketing|iklan|promo|ads|endorse/i.test(tx.category || ''))
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Cash income is not campaign attribution. The schema currently has no
  // campaignId on cash transactions and no dated coupon-redemption table, so a
  // guessed percentage or lifetime counter would make AI/dashboard claims false.
  const attributedRevenue30d = 0;
  const estimatedROAS = 0;
  const estimatedCAC = 0;

  const marketing: MarketingHealthMetrics = {
    activeCampaignsCount,
    activeCouponsCount: activeCoupons.length,
    couponRedemptions30d: 0,
    estimatedMarketingSpend30d: marketingSpend30d,
    attributedRevenue30d,
    estimatedROAS,
    estimatedCAC,
    attributionDataAvailable: false,
    couponRedemptionsDateScoped: false,
  };

  // 4. Fetch Operations Data (Work Tasks)
  const workTasks = await prisma.workTask.findMany({
    where: { workspaceId },
  });

  const totalTasks = workTasks.length;
  const completedTasks = workTasks.filter((t) => t.status === 'DONE').length;
  const inProgressTasks = workTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const todoTasks = workTasks.filter((t) => t.status === 'TODO').length;
  const overdueTasksCount = workTasks.filter(
    (t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < currentDate
  ).length;

  // Workspace tanpa tugas belum punya completion rate. 100% berarti semua tugas
  // yang ada selesai, bukan "belum ada tugas = 100%".
  const completionRatePercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const operations: OperationsHealthMetrics = {
    totalTasks,
    completedTasks,
    inProgressTasks,
    todoTasks,
    completionRatePercent,
    overdueTasksCount,
  };

  // 5. Strategy & Corporate Planning Data
  const primaryIndustry = workspace?.industry || memoryIndustry || 'Belum ditentukan';
  const targetMarket = (workspace as any)?.targetMarket || memoryTargetMarket || 'Belum ditentukan';
  const hasProfile = Boolean(
    (workspace?.industry && workspace.industry !== 'Belum ditentukan') ||
    (memoryIndustry && memoryIndustry !== 'Belum ditentukan')
  );

  const strategy: StrategyHealthMetrics = {
    corplanProjectsCount: 0,
    strategicPillarsDefined: hasProfile,
    primaryIndustry,
    targetMarket,
    hasActiveOKRs: false,
  };

  // 5b. Inventory & Document Metrics (Pintu 6)
  const [productsResult, filesResult] = await Promise.allSettled([
    prisma.product.findMany({
      where: { workspaceId, isActive: true },
      select: { currentStock: true, minStock: true, costPrice: true },
    }),
    prisma.workspaceFile.findMany({
      where: { workspaceId },
      select: { fileName: true, fileType: true, extractedSummary: true },
      take: 100,
    }),
  ]);

  const productsList = productsResult.status === 'fulfilled' ? productsResult.value : [];
  const filesList = filesResult.status === 'fulfilled' ? filesResult.value : [];

  const totalStockValue = productsList.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
  const lowStockAlertCount = productsList.filter((p) => p.currentStock <= p.minStock).length;
  const productsCount = productsList.length;

  const inventory: InventoryHealthMetrics = {
    totalStockValue,
    lowStockAlertCount,
    productsCount,
  };

  const legalContractsCount = filesList.filter((f) =>
    /\b(kontrak|sewa|perjanjian|mou|pasal|akta)\b/i.test(f.fileName + ' ' + (f.extractedSummary || ''))
  ).length;
  const meetingNotesCount = filesList.filter((f) =>
    /\b(notulen|rapat|agenda|evaluasi|berita acara)\b/i.test(f.fileName + ' ' + (f.extractedSummary || ''))
  ).length;
  const financialDocsCount = filesList.filter((f) =>
    /\b(kas|laba|rugi|faktur|invoice|rekening|mutasi|ledger)\b/i.test(f.fileName + ' ' + (f.extractedSummary || ''))
  ).length;
  const summaryManifest = filesList.slice(0, 10).map((f) => `- ${f.fileName} (${f.fileType})`).join('\n');

  const documents: DocumentHealthMetrics = {
    totalFiles: filesList.length,
    legalContractsCount,
    meetingNotesCount,
    financialDocsCount,
    summaryManifest,
  };

  // 6. Compute Deterministic Company Health Score (CHS: 0 - 100)
  // Skor komposit hanya boleh muncul setelah ada minimal satu sumber operasional
  // yang benar-benar bisa dinilai. Sebelumnya nilai default tiap pilar (finance 70,
  // growth 65, ops 60, strategy 50) menghasilkan skor 77 untuk workspace kosong.
  const hasHealthData =
    allTransactions.length > 0 ||
    allInvoices.length > 0 ||
    promoCoupons.length > 0 ||
    workTasks.length > 0;
  const healthScore: CompanyHealthScore = hasHealthData
    ? calculateCompanyHealthScore(financials, marketing, operations, strategy)
    : {
        totalScore: 0,
        grade: 'WAITING',
        breakdown: { financeScore: 0, growthScore: 0, opsScore: 0, strategyScore: 0 },
        keyRisks: [],
        keyStrengths: [],
      };

  const snapshot: BusinessContextSnapshot = {
    workspaceId,
    workspaceName,
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
    financials,
    marketing,
    operations,
    strategy,
    inventory,
    documents,
    healthScore,
    // TAMBAHAN (KELOMPOK 3): field baru opsional, string kosong -> undefined supaya
    // konsumen yang cuma cek `if (ctx.companyKnowledgeSummary)` tidak perlu bedakan
    // "kosong" vs "tidak ada" -- dua-duanya falsy.
    companyKnowledgeSummary: companyKnowledgeSummary || undefined,
  };

  // Save to Cache
  contextSnapshotCache.set(cacheKey, {
    snapshot,
    expiresAt: now + CACHE_TTL_MS,
  });

  return snapshot;
}

/**
 * Deterministic Health Score Calculation Algorithm
 * CHS = 0.35 * Finance + 0.30 * Growth + 0.20 * Ops + 0.15 * Strategy
 */
function calculateCompanyHealthScore(
  fin: FinancialHealthMetrics,
  mkt: MarketingHealthMetrics,
  ops: OperationsHealthMetrics,
  strat: StrategyHealthMetrics
): CompanyHealthScore {
  const keyRisks: string[] = [];
  const keyStrengths: string[] = [];

  // --- 1. Finance Score (0 - 100) ---
  let financeScore = 70;
  if (fin.liquidCash <= 0 && fin.totalIncome30d === 0) {
    financeScore = 50;
    keyRisks.push('Data keuangan awal belum tercatat (Saldo kas dan omset masih Rp 0)');
  } else if (fin.runwayMonths >= 6) {
    financeScore += 20;
    keyStrengths.push(`Cadangan runway kas aman (${fin.runwayMonths} bulan)`);
  } else if (fin.runwayMonths >= 3) {
    financeScore += 5;
  } else if (fin.runwayMonths < 2 && fin.liquidCash > 0) {
    financeScore -= 35;
    keyRisks.push(`Peringatan Likuiditas: Runway kas kritis (${fin.runwayMonths} bulan)`);
  } else if (fin.liquidCash <= 0) {
    financeScore -= 30;
    keyRisks.push('Cadangan kas likuid kosong (Rp 0)');
  }

  if (fin.netCashflow30d > 0) {
    financeScore += 10;
    keyStrengths.push('Arus kas operasional positif (Net Cashflow surplus)');
  } else if (fin.monthlyBurnRate > 0) {
    financeScore -= 10;
  }

  if (fin.overdueInvoicesCount > 0) {
    financeScore -= Math.min(20, fin.overdueInvoicesCount * 5);
    keyRisks.push(`Terdapat ${fin.overdueInvoicesCount} faktur piutang menunggak (Overdue)`);
  }

  financeScore = Math.max(10, Math.min(100, financeScore));

  // --- 2. Growth / Marketing Score (0 - 100) ---
  let growthScore = 60;
  if (mkt.estimatedMarketingSpend30d > 0) {
    if (mkt.estimatedROAS >= 3.0) {
      growthScore += 25;
      keyStrengths.push(`Efisiensi akuisisi tinggi dengan estimasi ROAS ${mkt.estimatedROAS}x`);
    } else if (mkt.estimatedROAS < 1.5) {
      growthScore -= 20;
      keyRisks.push('Efisiensi konversi pemasaran rendah (ROAS di bawah 1.5x)');
    }
  } else {
    if (mkt.activeCouponsCount > 0) {
      growthScore += 10;
      keyStrengths.push(`Terdapat ${mkt.activeCouponsCount} kupon promosi aktif`);
    } else {
      keyRisks.push('Belum ada kampanye promosi atau kupon aktif');
    }
  }
  growthScore = Math.max(10, Math.min(100, growthScore));

  // --- 3. Operations Score (0 - 100) ---
  let opsScore = 60;
  if (ops.totalTasks === 0) {
    opsScore = 50;
  } else if (ops.completionRatePercent >= 80) {
    opsScore += 30;
    keyStrengths.push(`Kecepatan eksekusi tim tinggi (${ops.completionRatePercent}% tugas selesai)`);
  } else if (ops.completionRatePercent < 50) {
    opsScore -= 25;
    keyRisks.push('Tingkat penyelesaian tugas operasional di bawah 50%');
  }

  if (ops.overdueTasksCount > 0) {
    opsScore -= Math.min(20, ops.overdueTasksCount * 4);
    keyRisks.push(`Ada ${ops.overdueTasksCount} tugas operasional melewati tenggat waktu`);
  }
  opsScore = Math.max(10, Math.min(100, opsScore));

  // --- 4. Strategy Score (0 - 100) ---
  let strategyScore = 50;
  if (strat.strategicPillarsDefined) {
    strategyScore += 30;
    keyStrengths.push('Pilar strategi dan profil bisnis telah terdefinisi di CorPlan');
  } else {
    keyRisks.push('Pilar target dan roadmap strategis belum diformulasikan');
  }
  if (strat.corplanProjectsCount > 0) {
    strategyScore += 20;
  }
  strategyScore = Math.max(10, Math.min(100, strategyScore));

  // Composite Weighted Score
  const totalScore = Math.round(
    0.35 * financeScore + 0.30 * growthScore + 0.20 * opsScore + 0.15 * strategyScore
  );

  let grade: CompanyHealthScore['grade'] = 'HEALTHY';
  if (totalScore >= 85) grade = 'EXCELLENT';
  else if (totalScore >= 70) grade = 'HEALTHY';
  else if (totalScore >= 50) grade = 'WARNING';
  else grade = 'CRITICAL';

  return {
    totalScore,
    grade,
    breakdown: {
      financeScore,
      growthScore,
      opsScore,
      strategyScore,
    },
    keyRisks: Array.from(new Set(keyRisks)),
    keyStrengths: Array.from(new Set(keyStrengths)),
  };
}

export function invalidateContextCache(workspaceId?: string) {
  if (workspaceId) {
    for (const key of Array.from(contextSnapshotCache.keys())) {
      if (key === workspaceId || key.startsWith(`${workspaceId}_`)) {
        contextSnapshotCache.delete(key);
      }
    }
  } else {
    contextSnapshotCache.clear();
  }
}

export const ContextEngine = {
  getSnapshot: getOrBuildBusinessContext,
  invalidateCache: invalidateContextCache,
};



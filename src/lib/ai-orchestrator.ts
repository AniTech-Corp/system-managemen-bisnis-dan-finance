import { prisma } from './prisma';
import { executeAIRequest } from './ai-gateway';
import type { AIGenerateOptions, AIGenerateResult, AIProvider, EffortLevel } from './ai-gateway';
// 11 Sep 2026 (wave B1-backend-routing, arahan Mecca 11 Sep poin 4): extract_json/summarize
// dipetakan ke model hemat tier via JSON_EXTRACTION_MODEL (model-tiers.ts), BUKAN lagi
// dibiarkan pakai default provider apa adanya -- default murah eksplisit, bukan kebetulan.
import { JSON_EXTRACTION_MODEL } from './model-tiers';

/**
 * KLIR AI Orchestrator ("Hermes-lite") -- FASE 3.5 roadmap 6 Sep.
 *
 * Pembungkus tipis di ATAS executeAIRequest (ai-gateway.ts), TIDAK mengubah
 * file itu sama sekali. Tujuannya: satu titik masuk `orchestrate()` yang
 * memetakan "jenis pekerjaan" (task) ke kombinasi provider + model +
 * temperature yang MASUK AKAL secara eksplisit dan terdokumentasi -- bukan
 * hardcode provider/temperature berulang di tiap route/engine pemanggil.
 *
 * Prinsip DETERMINISTIK DULU: pemetaan task->route di TASK_ROUTES adalah
 * tabel statis (bukan LLM yang memilih providernya sendiri). Satu-satunya
 * bagian "belajar dari pengalaman" (pickRouteWithHistory) juga murni
 * hitungan deterministik atas catatan MemoryItem lama, bukan LLM judgement.
 *
 * Pencatatan hasil pakai Pola D (lihat reference_klir_extend_pattern_fatur_
 * backend_4_pola.md): MemoryItem dengan tag baru [ORCH_ROUTE_STATS], query
 * terpisah milik sendiri, tidak menyentuh [COMPANY_KNOWLEDGE] atau
 * [BRAIN_MISTAKE] yang sudah ada. Non-fatal: gagal catat tidak pernah
 * menggagalkan request AI itu sendiri (pola recordCompanyKnowledge di
 * src/lib/ai-brain/company-memory.ts).
 */

export type OrchestratorTask = 'chat' | 'analyze' | 'research' | 'extract_json' | 'summarize' | 'creative';

export interface OrchestrateOptions {
  workspaceId: string;
  task: OrchestratorTask;
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  temperature?: number;
  modelName?: string;
  maxOutputTokens?: number;
  history?: Array<{ role: string; content: string }>;
  /**
   * DITAMBAHKAN 8 Sep 2026 (wave B3-backend-chat) menyusul temuan KRITIS #1 kritik
   * "bantah" 8 Sep: orchestrate() SEBELUM perubahan ini men-destructure field terbatas
   * dari OrchestrateOptions lalu membangun object baru untuk executeAIRequest -- field
   * apapun di luar daftar lama (termasuk rencana modelId/effort composer) DIBUANG DIAM-
   * DIAM, padahal route.ts:1629 (satu-satunya jalur nyata chat utama) MEMANGGIL
   * orchestrate(), bukan executeAIRequest() langsung. Field di bawah diteruskan APA
   * ADANYA ke executeAIRequest, TIDAK mempengaruhi TASK_ROUTES/pickRouteWithHistory
   * sama sekali -- request lama yang tidak mengirim field ini berperilaku identik.
   */
  forceProvider?: AIGenerateOptions['forceProvider'];
  /** Server-side caller override for a known product mode (never trust raw client text). */
  preferredProvider?: AIGenerateOptions['preferredProvider'];
  effort?: EffortLevel;
  requestedModelId?: string;
}

export interface OrchestrateResult extends AIGenerateResult {
  task: OrchestratorTask;
  routedProvider: AIGenerateOptions['preferredProvider'];
  historyDowngraded: boolean;
}

type RouteProvider = NonNullable<AIGenerateOptions['preferredProvider']>;

interface TaskRoute {
  /** Provider yang dicoba pertama untuk task ini, dan ALASANnya. */
  preferredProvider: RouteProvider;
  reason: string;
  /** Provider pengganti kalau preferredProvider gagal berulang (lihat pickRouteWithHistory). */
  fallbackProvider: RouteProvider;
  temperature: number;
  jsonMode: boolean;
  modelName?: string;
}

/**
 * Tabel routing deterministik per task. SSOT untuk "provider mana buat kerjaan
 * apa" di seluruh KLIR -- pemanggil baru cukup lewat `task`, tidak perlu tahu
 * provider mana yang sedang sehat.
 *
 * DIUBAH 11 Sep 2026 (wave B1-backend-routing, Context Pack integrasi-ai-data-model-hemat,
 * arahan Mecca 11 Sep poin 4: "OpenRouter = UTAMA. Groq + Gemini = cadangan"). Sebelum
 * perubahan ini, chat/extract_json/summarize preferredProvider='groq' -- Groq tier gratis
 * (limit 8k token/menit, insiden 8 Sep) jadi jalur PERTAMA untuk task paling sering dipakai
 * (chat utama AI Assistant). Sekarang keempatnya (chat/analyze/extract_json/summarize)
 * preferredProvider='openrouter' dengan fallbackProvider='groq' -- OpenRouter dicoba dulu
 * (model hemat dari model-tiers.ts by default), Groq jadi cadangan kalau OpenRouter gagal
 * berulang (lihat pickRouteWithHistory). research & creative TIDAK berubah (gemini/openrouter
 * sudah sesuai arahan sebelumnya):
 * - chat: percakapan umum AI Assistant -> 'openrouter' (model hemat default dari
 *   model-tiers.ts kecuali effort/modelName lain), fallback 'groq'.
 * - analyze: ekstraksi/analisis dokumen/data -> 'openrouter', fallback 'groq' (DULU
 *   fallback 'gemini' -- diselaraskan supaya SEMUA task teks non-riset punya fallback
 *   yang sama, 'groq', konsisten dengan chat/extract_json/summarize).
 * - research: butuh grounding web/pengetahuan terkini -> 'gemini' (Google
 *   Search grounding, lihat CLAUDE.md WEB RESEARCH doctrine), fallback ke
 *   'auto' kalau Gemini key tidak ada/gagal berulang. TIDAK BERUBAH.
 * - extract_json: HARUS jsonMode + temperature 0 supaya angka/struktur deterministik ->
 *   'openrouter' dengan modelName=JSON_EXTRACTION_MODEL (model-tiers.ts, murah + mendukung
 *   response_format json_object), fallback 'groq' (openai/gpt-oss-120b default callGroq).
 * - summarize: ringkasan teks -> 'openrouter' dengan modelName=JSON_EXTRACTION_MODEL juga
 *   (murah, task ini tidak butuh model mahal), fallback 'groq'.
 * - creative: copywriting/narasi kreatif -> 'openrouter' (akses model
 *   terluas, termasuk model dengan gaya lebih ekspresif), temperature tinggi. TIDAK BERUBAH.
 */
const TASK_ROUTES: Record<OrchestratorTask, TaskRoute> = {
  chat: {
    preferredProvider: 'openrouter',
    reason: '11 Sep 2026: OpenRouter jadi provider utama (arahan Mecca) -- model hemat default dari model-tiers.ts, bukan lagi Groq tier gratis yang mudah kena limit 8k token/menit.',
    fallbackProvider: 'groq',
    temperature: 0.7,
    jsonMode: false,
  },
  analyze: {
    preferredProvider: 'openrouter',
    reason: 'Analisis dokumen/data dan multi-file diprioritaskan ke OpenRouter dengan katalog model yang lebih luas.',
    fallbackProvider: 'groq',
    temperature: 0.2,
    jsonMode: false,
  },
  research: {
    preferredProvider: 'gemini',
    reason: 'Google Search grounding -- basis pengetahuan web terluas untuk riset (doktrin WEB RESEARCH CLAUDE.md).',
    fallbackProvider: 'auto',
    temperature: 0.3,
    jsonMode: false,
  },
  extract_json: {
    preferredProvider: 'openrouter',
    reason: '11 Sep 2026: ekstraksi terstruktur pindah ke OpenRouter modelName=JSON_EXTRACTION_MODEL (model-tiers.ts) -- murah, mendukung response_format json_object, dan konsisten dengan "OpenRouter = utama". Groq (openai/gpt-oss-120b) jadi cadangan.',
    fallbackProvider: 'groq',
    temperature: 0,
    jsonMode: true,
    modelName: JSON_EXTRACTION_MODEL,
  },
  summarize: {
    preferredProvider: 'openrouter',
    reason: '11 Sep 2026: ringkasan teks pindah ke OpenRouter modelName=JSON_EXTRACTION_MODEL (murah, task ini tidak butuh model mahal), fallback Groq.',
    fallbackProvider: 'groq',
    temperature: 0.3,
    jsonMode: false,
    modelName: JSON_EXTRACTION_MODEL,
  },
  creative: {
    preferredProvider: 'openrouter',
    reason: 'Copywriting/narasi kreatif butuh keragaman gaya -- katalog OpenRouter paling luas, temperature tinggi.',
    fallbackProvider: 'auto',
    temperature: 0.9,
    jsonMode: false,
  },
};

const ORCH_ROUTE_STATS_TAG = '[ORCH_ROUTE_STATS]';

/** Ambang gagal: provider yang gagal >= ini dari N catatan terakhir untuk task tsb diturunkan prioritasnya. */
const FAILURE_THRESHOLD = 3;
/** Jumlah catatan riwayat terakhir (per task) yang dipakai untuk menghitung failure rate. */
const HISTORY_WINDOW = 20;

/**
 * Catat 1 hasil routing sebagai MemoryItem (scope WORKSPACE, Pola D) --
 * tag [ORCH_ROUTE_STATS], format content: "provider|task|ok|latencyMs".
 * Non-fatal: kegagalan catat cuma di-log, TIDAK PERNAH melempar ke caller
 * (mengikuti pola recordCompanyKnowledge di ai-brain/company-memory.ts).
 */
async function recordRouteStats(
  workspaceId: string,
  task: OrchestratorTask,
  provider: string,
  ok: boolean,
  latencyMs: number
): Promise<void> {
  try {
    await prisma.memoryItem.create({
      data: {
        workspaceId,
        userId: null,
        scope: 'WORKSPACE',
        content: `${ORCH_ROUTE_STATS_TAG} provider=${provider}|task=${task}|ok=${ok}|latencyMs=${latencyMs}`,
      },
    });
  } catch (err) {
    console.warn('[AIOrchestrator] gagal mencatat ORCH_ROUTE_STATS ke memory (non-fatal):', err);
  }
}

/** Hasil parse 1 baris content [ORCH_ROUTE_STATS], null kalau formatnya tidak dikenali. */
function parseRouteStatsLine(content: string): { provider: string; task: string; ok: boolean } | null {
  const match = content.match(/^\[ORCH_ROUTE_STATS\]\s*provider=([^|]+)\|task=([^|]+)\|ok=(true|false)\|/);
  if (!match) return null;
  return { provider: match[1], task: match[2], ok: match[3] === 'true' };
}

/**
 * Belajar dari pengalaman (sederhana, deterministik, BUKAN LLM): ambil
 * HISTORY_WINDOW catatan [ORCH_ROUTE_STATS] terakhir workspace ini untuk
 * `task` yang sama. Kalau preferredProvider route gagal >= FAILURE_THRESHOLD
 * kali di jendela itu, turunkan ke fallbackProvider route untuk panggilan
 * ini. Non-fatal: query gagal -> pakai preferredProvider apa adanya (tidak
 * pernah throw, tidak pernah memblokir request AI yang sesungguhnya).
 */
export async function pickRouteWithHistory(
  workspaceId: string,
  task: OrchestratorTask,
  route: TaskRoute
): Promise<{ provider: RouteProvider; downgraded: boolean }> {
  try {
    const recent = await prisma.memoryItem.findMany({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: ORCH_ROUTE_STATS_TAG, contains: `task=${task}|` },
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
    });

    const failuresForPreferred = recent.filter((item: { content: string }) => {
      const parsed = parseRouteStatsLine(item.content);
      return parsed && parsed.provider === route.preferredProvider && !parsed.ok;
    }).length;

    if (failuresForPreferred >= FAILURE_THRESHOLD && route.fallbackProvider !== route.preferredProvider) {
      return { provider: route.fallbackProvider, downgraded: true };
    }
    return { provider: route.preferredProvider, downgraded: false };
  } catch (err) {
    console.warn('[AIOrchestrator] gagal membaca riwayat ORCH_ROUTE_STATS (non-fatal), pakai preferredProvider default:', err);
    return { provider: route.preferredProvider, downgraded: false };
  }
}

/**
 * Titik masuk utama Hermes-lite. Memetakan `task` ke route TASK_ROUTES,
 * menyesuaikan provider berdasar riwayat (pickRouteWithHistory), memanggil
 * executeAIRequest (ai-gateway.ts), lalu mencatat hasilnya
 * non-fatal ke MemoryItem [ORCH_ROUTE_STATS].
 *
 * Override eksplisit dari caller (temperature/modelName/jsonMode) SELALU
 * menang atas default TASK_ROUTES -- tabel routing cuma default yang masuk
 * akal, bukan paksaan.
 */
export async function orchestrate(options: OrchestrateOptions): Promise<OrchestrateResult> {
  const { workspaceId, task, prompt, systemInstruction, history, maxOutputTokens, forceProvider, preferredProvider, effort, requestedModelId } = options;
  const route = TASK_ROUTES[task];
  if (!route) {
    throw new Error(`[AIOrchestrator] task tidak dikenal: ${task}`);
  }

  const effectiveRoute = preferredProvider && preferredProvider !== 'auto'
    ? { ...route, preferredProvider, fallbackProvider: route.fallbackProvider === preferredProvider ? 'auto' : route.fallbackProvider }
    : route;
  const { provider, downgraded } = await pickRouteWithHistory(workspaceId, task, effectiveRoute);

  const temperature = options.temperature ?? route.temperature;
  const jsonMode = options.jsonMode ?? route.jsonMode;
  const modelName = options.modelName ?? route.modelName;

  const startedAt = Date.now();
  let result: AIGenerateResult;
  try {
    result = await executeAIRequest({
      workspaceId,
      prompt,
      systemInstruction,
      history,
      maxOutputTokens,
      preferredProvider: provider,
      temperature,
      jsonMode,
      modelName,
      // Diteruskan APA ADANYA (lihat komentar OrchestrateOptions di atas) -- undefined
      // untuk ketiganya kalau caller tidak mengirim, sama persis perilaku sebelum
      // field ini ada.
      forceProvider,
      effort,
      requestedModelId,
    });
  } catch (err) {
    await recordRouteStats(workspaceId, task, provider, false, Date.now() - startedAt);
    throw err;
  }

  // Dicatat di bawah `provider` yang DIROUTE (bukan result.provider) supaya konsisten dengan
  // apa yang dibaca pickRouteWithHistory -- kalau ai-gateway sendiri jatuh ke
  // 'deterministic_fallback' secara internal, itu tetap dihitung sebagai kegagalan route
  // yang diminta di panggilan ini, bukan kegagalan provider bernama "deterministic_fallback".
  const ok = result.provider !== 'deterministic_fallback';
  await recordRouteStats(workspaceId, task, provider, ok, Date.now() - startedAt);

  return {
    ...result,
    task,
    routedProvider: provider,
    historyDowngraded: downgraded,
  };
}

/** Diekspos untuk observability/debugging (mis. endpoint admin) -- tabel routing apa adanya, read-only. */
export function getTaskRoutes(): Readonly<Record<OrchestratorTask, TaskRoute>> {
  return TASK_ROUTES;
}

export type { AIProvider };

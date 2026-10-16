import { GoogleGenerativeAI } from '@google/generative-ai';
import { LlmChat, UserMessage } from 'emergentintegrations';
import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { getWorkspacePlan } from './plan-guard';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Deteksi error yang bisa dicoba ulang (rate limit / quota / 429 / 5xx). */
function isRetryableError(err: any): boolean {
  const msg = String(err?.message || '');
  return /429|rate.?limit|quota|too many requests|resource.*exhausted|503|502|500/i.test(msg);
}

/** Panggil fungsi dengan retry otomatis (backoff) untuk error yang bisa dicoba ulang. */
async function callWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (i < attempts - 1 && isRetryableError(err)) {
        const delay = (i + 1) * 2500; // 2.5s, 5s
        console.warn(`[AIGateway] Retry percobaan ${i + 1}/${attempts - 1} setelah ${delay}ms (${err.message})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export type AIProvider = 'groq' | 'emergent' | 'openrouter' | 'openai' | 'opencode' | 'gemini' | 'byok_custom' | 'deterministic_fallback';

/**
 * RECONCILED 8 Sep 2026 (wave B3-backend-chat): EffortLevel/EFFORT_MAP dan
 * validateTextModel SEMULA di-mirror/stopgap lokal di sini karena
 * src/lib/chat-composer-types.ts dan src/lib/text-model-catalog.ts (milik
 * B1-lib-katalog-prefs) belum ada di disk saat kode ini pertama ditulis. Keduanya
 * SUDAH ADA sekarang (dicek ulang dalam sesi kerja yang sama) -- diverifikasi nilai
 * EFFORT_MAP-nya IDENTIK dengan mirror lama (tidak ada drift), jadi diganti jadi
 * re-export/delegasi asli di bawah, BUKAN duplikat lagi. JANGAN kembalikan ke
 * definisi lokal -- SSOT tunggal sekarang ada di chat-composer-types.ts +
 * text-model-catalog.ts.
 */
export type { EffortLevel } from './chat-composer-types';
export { EFFORT_MAP as EFFORT_SETTINGS } from './chat-composer-types';
import type { EffortLevel } from './chat-composer-types';
import { EFFORT_MAP as EFFORT_SETTINGS } from './chat-composer-types';
import { validateTextModel, getModelReasoningEfforts } from './text-model-catalog';
/**
 * 11 Sep 2026 (wave B1-backend-routing, Context Pack integrasi-ai-data-model-hemat):
 * SSOT tier model OpenRouter murah/standar/maksimal -- lihat model-tiers.ts. Menggantikan
 * resolveOpenRouterTextModel() lama yang selalu memakai SATU default statis
 * ('google/gemini-3.5-flash', $1.50/$9.00 per juta token) untuk semua permintaan OpenRouter
 * tanpa modelName eksplisit. Sekarang dipilih dari effort composer (resolveTierForEffort),
 * dengan model hemat sebagai default kalau effort tidak dikirim -- arahan Mecca 11 Sep
 * poin 4 "default WAJIB model murah".
 */
import { resolveTierForEffort, resolveTierSpec, modelIdsForTier } from './model-tiers';

/**
 * Validasi model eksplisit dari composer "Setelan Jawaban" (8 Sep 2026, wave
 * B3-backend-chat) -- syarat GO Council poin 2 (allowlist + kelas biaya divalidasi
 * SERVER-SIDE). Delegasi PENUH ke validateTextModel (text-model-catalog.ts, milik
 * B1) -- katalog OpenRouter live dicek setiap panggilan (di-cache 1 jam di sana),
 * model mahal (>$20/juta token prompt) atau tidak ada di katalog otomatis ditolak.
 * ASYNC (beda dari versi stopgap lama yang sync) -- SEMUA pemanggil (route.ts,
 * tryExplicitOpenRouterModel di bawah) WAJIB `await`.
 */
export async function validateRequestedModel(modelId: string): Promise<boolean> {
  if (typeof modelId !== 'string') return false;
  const trimmed = modelId.trim();
  if (!trimmed || trimmed.length > 200) return false;
  return validateTextModel(trimmed);
}

export interface AIGenerateOptions {
  workspaceId: string;
  prompt: string;
  systemInstruction?: string;
  modelName?: string;
  preferredProvider?: 'groq' | 'openrouter' | 'openai' | 'opencode' | 'gemini' | 'auto';
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  history?: Array<{ role: string; content: string }>;
  /**
   * Setelan Jawaban composer (8 Sep 2026, wave B3-backend-chat). SEMUA opsional --
   * tidak dikirim sama sekali = perilaku IDENTIK dengan sebelum field ini ada (diverifikasi
   * lewat 676 test existing, lihat tests/brain-chat-composer-extras.test.ts kasus "klien
   * lama"). forceProvider:'openrouter' + requestedModelId dicoba PALING AWAL di
   * executeAIRequest, sebelum BYOK/Emergent/cascade lama -- lihat tryExplicitOpenRouterModel.
   */
  forceProvider?: 'openrouter';
  effort?: EffortLevel;
  requestedModelId?: string;
}

export interface AIGenerateResult {
  text: string;
  json?: any;
  provider: AIProvider;
  modelUsed: string;
  latencyMs: number;
  /** Diisi HANYA kalau caller minta model eksplisit (requestedModelId di options) --
   * apa yang diminta, terlepas dari apakah akhirnya benar-benar dipakai atau di-fallback. */
  requestedModelId?: string;
  /** Diisi HANYA kalau jalur model eksplisit gagal/ditolak dan request jatuh ke cascade
   * lama -- pesan manusiawi untuk ditunjukkan/dicatat client, BUKAN error (response tetap 200). */
  fallbackNote?: string;
}

/**
 * Key env dianggap USABLE hanya kalau bukan placeholder (dummy / your_ / changeme / "...")
 * dan panjangnya wajar. Mengikuti pola hasProviderKey() di media-catalog.ts.
 */
// EXPORT ditambah 8 Sep 2026 (wave B1-web-research) -- dipakai web-research.ts +
// location-research.ts untuk cek kredensial GEMINI_API_KEY/GOOGLE_MAPS_API_KEY
// dengan aturan "usable" yang SAMA (bukan cuma exists) sebelum panggil fetch.
// Perilaku fungsi TIDAK berubah, hanya visibility (nol dampak ke pemanggil lama).
export function isUsableProviderKey(value: string | undefined): value is string {
  const trimmed = value?.trim();
  return !!trimmed && trimmed.length > 10 && !/dummy|placeholder|your[_-]|changeme|\.\.\./i.test(trimmed);
}

/** Batas token output valid hanya kalau angka > 0; selain itu provider pakai default sendiri. */
function normalizeMaxTokens(maxOutputTokens?: number): number | undefined {
  return typeof maxOutputTokens === 'number' && Number.isFinite(maxOutputTokens) && maxOutputTokens > 0
    ? Math.floor(maxOutputTokens)
    : undefined;
}

/** Parse output JSON model: strip pagar ```json lalu JSON.parse, null kalau gagal. */
function parseJsonOutput(textOutput: string): any {
  try {
    const cleaned = textOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Nama model OpenRouter untuk gateway teks. DIGANTI 11 Sep 2026 (wave B1-backend-routing) --
 * dulu fungsi ini (resolveOpenRouterTextModel) selalu mengembalikan SATU string model.
 * Sekarang mengembalikan DAFTAR kandidat (untuk dicoba berurutan dalam satu percobaan
 * provider 'openrouter' di cascade, lihat model-tiers.ts kontrak "fallback tier dicoba
 * sebelum lempar ke provider berikutnya"), atau `null` kalau modelName ini sebetulnya
 * bukan urusan OpenRouter sama sekali:
 *   - modelName 'fast'        -> null (tetap milik Groq, lihat cabang 'groq' di bawah)
 *   - modelName mulai 'gemini' -> null (tetap milik Gemini direct, cabang 'gemini')
 *   - modelName mengandung '/' -> [modelName] (passthrough eksplisit, TANPA daftar
 *     fallback tier -- pemanggil sudah pilih model spesifik, jangan diam-diam diganti)
 *   - modelName === 'deep'     -> tier 'maksimal' (permintaan "pikir dalam" lama)
 *   - selain itu (undefined/'auto'/nama lain tak dikenal) -> tier dari resolveTierForEffort(effort)
 * DEEP THINKING LAMA (OPENROUTER_TEXT_MODEL_DEEP) tetap dihormati sebagai override tier
 * 'maksimal' lewat resolveTierSpec (bukan lagi lookup env terpisah di sini) -- lihat
 * model-tiers.ts kalau perlu menelusuri urutan override.
 */
function resolveOpenRouterModelIds(
  modelName: string | undefined,
  effort: EffortLevel | undefined
): string[] | null {
  if (modelName === 'fast') return null;
  if (modelName && modelName.toLowerCase().startsWith('gemini')) return null;
  if (modelName && modelName.includes('/')) return [modelName];
  const wantsDeepThinking = modelName === 'deep' || (modelName || '').includes('deepseek-r1');
  const tier = wantsDeepThinking ? 'maksimal' : resolveTierForEffort(effort);
  return modelIdsForTier(tier);
}

/**
 * Mengambil API key custom tersendiri milik workspace (BYOK - Bring Your Own Key)
 */
async function resolveCustomApiKey(workspaceId: string): Promise<{ apiKey: string | null; provider?: string }> {
  try {
    const isUuid = workspaceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId);
    if (isUuid) {
      const customKey = await prisma.workspaceAIKey.findUnique({
        where: { workspaceId },
      });
      if (customKey && customKey.isActive && customKey.apiKeyEnc) {
        return { apiKey: customKey.apiKeyEnc, provider: customKey.provider };
      }
    }
  } catch (err) {
    console.warn('[AIGateway] Gagal membaca WorkspaceAIKey:', err);
  }
  return { apiKey: null };
}

/**
 * 0. Panggil Groq API (Ultra-Fast OpenAI GPT-OSS 120B / Qwen 3.8 27B)
 */
async function callGroq(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  modelName: string = 'openai/gpt-oss-120b',
  temperature: number = 0.7,
  jsonMode: boolean = false,
  history?: Array<{ role: string; content: string }>,
  maxOutputTokens?: number
): Promise<{ text: string; json?: any; modelUsed: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  if (history && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({
          role: h.role === 'ai' || h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        });
      }
    }
  }

  messages.push({ role: 'user', content: prompt });

  const resolvedModel =
    modelName === 'fast' || modelName?.includes('20b')
      ? 'openai/gpt-oss-20b'
      : modelName === 'qwen'
      ? 'qwen/qwen3.8-27b'
      : modelName && (modelName.includes('gpt-oss') || modelName.includes('qwen'))
      ? modelName
      : 'openai/gpt-oss-120b';

  const body: any = {
    model: resolvedModel,
    messages,
    temperature,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const maxTokens = normalizeMaxTokens(maxOutputTokens);
  if (maxTokens) {
    body.max_tokens = maxTokens;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Retry with Qwen 3.8 27B if 120B has limits
    const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...body,
        model: 'qwen/qwen3.8-27b',
      }),
    });

    if (!fallbackRes.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    const fbData = await fallbackRes.json();
    const fbOutput = fbData.choices?.[0]?.message?.content || '';
    // Jalur retry wajib parse JSON juga, kalau tidak caller jsonMode dapat json null padahal output valid.
    const fbJson = jsonMode ? parseJsonOutput(fbOutput) : null;
    return { text: fbOutput, json: fbJson, modelUsed: 'qwen/qwen3.8-27b' };
  }

  const data = await response.json();
  const textOutput = data.choices?.[0]?.message?.content || '';

  let parsedJson: any = null;
  if (jsonMode) {
    try {
      const cleaned = textOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      parsedJson = JSON.parse(cleaned);
    } catch {
      // Fallback
    }
  }

  return { text: textOutput, json: parsedJson, modelUsed: resolvedModel };
}

/**
 * 1. Panggil OpenAI ChatGPT API (GPT-4o-mini / GPT-4o) dengan riwayat percakapan
 */
async function callOpenAI(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  modelName: string = 'gpt-4o-mini',
  temperature: number = 0.7,
  jsonMode: boolean = false,
  history?: Array<{ role: string; content: string }>,
  maxOutputTokens?: number
): Promise<{ text: string; json?: any; modelUsed: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  // Tambahkan riwayat percakapan sebelumnya jika ada
  if (history && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({ role: h.role === 'ai' || h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
      }
    }
  }

  messages.push({ role: 'user', content: prompt });

  const body: any = {
    model: modelName,
    messages,
    temperature,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const maxTokens = normalizeMaxTokens(maxOutputTokens);
  if (maxTokens) {
    body.max_tokens = maxTokens;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textOutput = data.choices?.[0]?.message?.content || '';

  let parsedJson: any = null;
  if (jsonMode) {
    try {
      const cleaned = textOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      parsedJson = JSON.parse(cleaned);
    } catch {
      // Fallback
    }
  }

  return { text: textOutput, json: parsedJson, modelUsed: modelName };
}

/**
 * Helper internal: chat completion ke endpoint OpenRouter (dipakai oleh jalur
 * OpenCode legacy DAN jalur OpenRouter resmi). Perilaku OpenCode dipertahankan
 * (tanpa timeout, error bawa body provider); jalur OpenRouter memakai timeout 120s
 * dan error yang disanitasi (status saja, tanpa body provider).
 */
async function callOpenRouterChat(
  apiKey: string,
  prompt: string,
  systemInstruction: string | undefined,
  modelName: string,
  temperature: number,
  jsonMode: boolean,
  history: Array<{ role: string; content: string }> | undefined,
  maxOutputTokens: number | undefined,
  opts: {
    errorLabel: string;
    sanitizeError: boolean;
    timeoutMs?: number;
    /** D-8 (8 Sep 2026, wave B3-backend-chat), DIPERLUAS 11 Sep 2026 (wave
     * B1-backend-routing): semula HANYA dikirim di jalur model eksplisit
     * (tryExplicitOpenRouterModel). Sekarang callOpenRouter() (dipakai cascade
     * 'auto'/preferredProvider biasa) JUGA bisa meneruskan field ini -- HANYA untuk
     * tier 'maksimal' (satu-satunya TierSpec yang punya reasoningEffort, lihat
     * model-tiers.ts), dan HANYA kalau katalog live bilang model kandidat mendukung
     * nilai itu (getModelReasoningEfforts, sama pola gate seperti jalur eksplisit).
     * callOpenCode TETAP tidak pernah meneruskan field ini (legacy DeepSeek default,
     * di luar scope tier baru). */
    reasoningEffort?: 'low' | 'medium' | 'high';
  }
): Promise<{ text: string; json?: any; modelUsed: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  if (history && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({ role: h.role === 'ai' || h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
      }
    }
  }

  messages.push({ role: 'user', content: prompt });

  const body: any = {
    model: modelName,
    messages,
    temperature,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  // D-8 (8 Sep 2026), DIPERLUAS 11 Sep 2026: reasoning.effort provider-spesifik
  // OpenRouter, dikirim dari jalur model eksplisit (tryExplicitOpenRouterModel) MAUPUN
  // dari cascade biasa untuk tier 'maksimal' (lihat komentar opts.reasoningEffort di
  // signature) -- lihat opts.reasoningEffort di signature. Kalau model tujuan
  // tidak mendukung nilai ini, OpenRouter akan menolak request (4xx) -- caller
  // (tryExplicitOpenRouterModel ATAU attemptProvider('openrouter')) menangkapnya sebagai
  // kegagalan biasa dan jatuh ke kandidat/provider berikutnya, BUKAN 500 ke user (lihat
  // catatan_jujur soal supported_efforts bervariasi antar model, temuan kritik "terlewat"
  // 8 Sep -- filtering per-model proaktif belum dikerjakan di wave ini, menyusul dari
  // katalog live B1).
  if (opts.reasoningEffort) {
    body.reasoning = { effort: opts.reasoningEffort };
  }

  const maxTokens = normalizeMaxTokens(maxOutputTokens);
  if (maxTokens) {
    body.max_tokens = maxTokens;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://anitech.dev',
      'X-Title': 'KLIR OS',
    },
    body: JSON.stringify(body),
    ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
  });

  if (!response.ok) {
    if (opts.sanitizeError) {
      // Body provider bisa memuat prompt / detail internal -- jangan diteruskan ke caller.
      throw new Error(`${opts.errorLabel} API error (${response.status})`);
    }
    const errText = await response.text();
    throw new Error(`${opts.errorLabel} API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  let textOutput = data.choices?.[0]?.message?.content || '';
  if (!textOutput && data.choices?.[0]?.message?.reasoning && !jsonMode) {
    textOutput = data.choices[0].message.reasoning;
  }
  const parsedJson = jsonMode ? parseJsonOutput(textOutput) : null;

  return { text: textOutput, json: parsedJson, modelUsed: modelName };
}

/**
 * 2. Panggil OpenCode / OpenRouter API (DeepSeek / OpenCode Models) -- key OPENCODE_API_KEY (legacy).
 */
async function callOpenCode(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  modelName: string = 'deepseek/deepseek-chat',
  temperature: number = 0.7,
  jsonMode: boolean = false,
  history?: Array<{ role: string; content: string }>,
  maxOutputTokens?: number
): Promise<{ text: string; json?: any; modelUsed: string }> {
  return callOpenRouterChat(apiKey, prompt, systemInstruction, modelName, temperature, jsonMode, history, maxOutputTokens, {
    errorLabel: 'OpenCode/OpenRouter',
    sanitizeError: false,
  });
}

/**
 * 2b. Panggil OpenRouter resmi -- key OPENROUTER_API_KEY (key yang sama dengan media provider).
 * `reasoningEffort` ditambah 11 Sep 2026 (wave B1-backend-routing) supaya cascade
 * 'auto'/preferredProvider bisa mengirim reasoning.effort untuk tier 'maksimal' -- default
 * undefined = perilaku identik sebelum parameter ini ada.
 * Timeout adaptif: 25 detik untuk normal, 60 detik untuk penalaran tinggi (mencegah abort 90s browser).
 */
async function callOpenRouter(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  modelName: string = 'google/gemini-3.5-flash',
  temperature: number = 0.7,
  jsonMode: boolean = false,
  history?: Array<{ role: string; content: string }>,
  maxOutputTokens?: number,
  reasoningEffort?: 'low' | 'medium' | 'high'
): Promise<{ text: string; json?: any; modelUsed: string }> {
  const timeoutMs = reasoningEffort === 'high' ? 60_000 : 25_000;
  return callOpenRouterChat(apiKey, prompt, systemInstruction, modelName, temperature, jsonMode, history, maxOutputTokens, {
    errorLabel: 'OpenRouter',
    sanitizeError: true,
    timeoutMs,
    reasoningEffort,
  });
}

/**
 * 3. Panggil Google Gemini API (Gemini 2.0 Flash / Pro)
 */
async function callGemini(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  modelName: string = 'gemini-flash-lite-latest',
  temperature: number = 0.7,
  jsonMode: boolean = false,
  maxOutputTokens?: number
): Promise<{ text: string; json?: any; modelUsed: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const maxTokens = normalizeMaxTokens(maxOutputTokens);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
      responseMimeType: jsonMode ? 'application/json' : 'text/plain',
      ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
    },
    systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
  });

  const result = await callWithRetry(() => model.generateContent(prompt));
  const textOutput = result.response.text();
  let parsedJson: any = null;
  if (jsonMode) {
    try {
      const cleaned = textOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      parsedJson = JSON.parse(cleaned);
    } catch {
      // Fallback
    }
  }

  return { text: textOutput, json: parsedJson, modelUsed: modelName };
}

/**
 * 0. Panggil Emergent Universal LLM Key (proxy resmi platform).
 *    Ini jalur AI UTAMA untuk demo — satu key untuk OpenAI/Anthropic/Gemini.
 */
async function callEmergent(
  prompt: string,
  systemInstruction?: string,
  provider: string = 'openai',
  modelName: string = 'gpt-4o-mini',
  temperature: number = 0.7,
  jsonMode: boolean = false,
  maxOutputTokens?: number
): Promise<{ text: string; json?: any; modelUsed: string }> {
  const apiKey = process.env.EMERGENT_LLM_KEY as string;
  const sys =
    (systemInstruction || 'Anda asisten bisnis KLIR untuk UMKM Indonesia. Jawab ringkas, praktis, dan mudah dipahami pemilik usaha kecil.') +
    (jsonMode ? '\nBalas HANYA dalam JSON valid tanpa blok markdown / tanpa ```.' : '');

  // withParams() menggabungkan ke extraParams yang diteruskan ke request (temperature, max_tokens, dst).
  const maxTokens = normalizeMaxTokens(maxOutputTokens);
  const chat = new LlmChat(apiKey, `klir-${randomUUID()}`, sys)
    .withModel(provider, modelName)
    .withParams({ temperature, ...(maxTokens ? { max_tokens: maxTokens } : {}) });

  const textOutput = await chat.sendMessage(new UserMessage({ text: prompt }));

  let parsedJson: any = null;
  if (jsonMode) {
    try {
      const cleaned = String(textOutput).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      parsedJson = JSON.parse(cleaned);
    } catch {
      // biarkan null -> caller akan fallback
    }
  }

  return { text: String(textOutput ?? ''), json: parsedJson, modelUsed: `emergent:${provider}/${modelName}` };
}

/**
 * Jalur model eksplisit ("Setelan Jawaban" composer, 8 Sep 2026 wave B3-backend-chat) --
 * dicoba dari executeAIRequest() SEBELUM cascade lama (runProviderCascade), TIDAK PERNAH
 * dari dalam cascade itu sendiri. Mengembalikan { result } kalau berhasil, atau
 * { note } (fallbackNote manusiawi, BUKAN throw) kalau ditolak/gagal -- caller lalu
 * melanjutkan ke runProviderCascade seperti biasa dan menempelkan note ke hasilnya.
 * KRITIS #2 (kritik "terlewat" 8 Sep): validateRequestedModel() WAJIB dipanggil di sini
 * SEBELUM requestedModelId menyentuh callOpenRouterChat -- modelId mentah dari body
 * request TIDAK PERNAH diteruskan tanpa lolos allowlist (walau stopgap, lihat komentar
 * validateRequestedModel di atas).
 */
async function tryExplicitOpenRouterModel(
  options: AIGenerateOptions,
  requestedModelId: string
): Promise<{ result?: AIGenerateResult; note?: string }> {
  const startTime = Date.now();
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!isUsableProviderKey(openRouterKey)) {
    return { note: 'OpenRouter API key tidak tersedia/tidak valid -- model yang diminta tidak bisa dipakai, memakai jawaban model default.' };
  }
  if (!(await validateRequestedModel(requestedModelId))) {
    return { note: `Model yang diminta ("${requestedModelId}") tidak dikenal/tidak lolos validasi katalog -- memakai jawaban model default.` };
  }
  try {
    // D-8 + temuan TINGGI kritik "terlewat" 8 Sep (supported_efforts bervariasi drastis
    // antar model OpenRouter): HANYA kirim reasoning.effort kalau model tujuan benar-benar
    // mendukung nilai itu (getModelReasoningEfforts, data live/cache dari validateRequestedModel
    // di atas -- panggilan ini SETELAHNYA jadi murah, baca dari reasoningCache in-memory, tidak
    // fetch ulang). undefined dari getModelReasoningEfforts (model tak dikenal/tak reasoning/
    // katalog fallback) -> treat sebagai "jangan kirim field reasoning", BUKAN asumsi didukung.
    const desiredEffort = options.effort ? EFFORT_SETTINGS[options.effort].openRouterReasoningEffort : undefined;
    const supportedEfforts = getModelReasoningEfforts(requestedModelId);
    const reasoningEffort = desiredEffort && supportedEfforts?.includes(desiredEffort) ? desiredEffort : undefined;
    const res = await callOpenRouterChat(
      openRouterKey as string,
      options.prompt,
      options.systemInstruction,
      requestedModelId,
      options.temperature ?? 0.7,
      options.jsonMode ?? false,
      options.history,
      options.maxOutputTokens,
      { errorLabel: 'OpenRouter (model eksplisit)', sanitizeError: true, timeoutMs: reasoningEffort === 'high' ? 60_000 : 30_000, reasoningEffort }
    );
    if (options.jsonMode && !res.json) {
      return { note: 'Model yang diminta gagal menghasilkan JSON valid -- memakai jawaban model default.' };
    }
    return { result: { ...res, provider: 'openrouter', latencyMs: Date.now() - startTime, requestedModelId } };
  } catch (err: any) {
    console.warn(`[AIGateway] Model eksplisit (${requestedModelId}) gagal (${err?.message}). Jatuh ke cascade default...`);
    return { note: `Model yang diminta ("${requestedModelId}") gagal dipanggil -- memakai jawaban model default.` };
  }
}

/**
 * CENTRALIZED HYBRID MULTI-PROVIDER AI GATEWAY
 * Otomatis memilih AI terbaik sesuai jenis tugas dan melakukan failover otomatis!
 *
 * (8 Sep 2026, wave B3-backend-chat) Sekarang pembungkus TIPIS di atas
 * runProviderCascade -- kalau options.forceProvider==='openrouter' DAN
 * options.requestedModelId ada, coba tryExplicitOpenRouterModel() dulu; gagal/ditolak ->
 * jatuh rapi ke runProviderCascade PERSIS SEPERTI SEBELUM PERUBAHAN INI (badan cascade
 * di bawah TIDAK DIUBAH SAMA SEKALI, cuma dipindah ke fungsi baru ini supaya bisa dibungkus
 * tanpa menyentuh satu pun baris `return` di dalamnya -- diff surgical, bukan restrukturisasi
 * cascade). Client lama yang tidak pernah mengirim forceProvider/requestedModelId TIDAK
 * PERNAH masuk cabang baru ini sama sekali (short-circuit di kondisi if di bawah).
 */
export async function executeAIRequest(options: AIGenerateOptions): Promise<AIGenerateResult> {
  if (options.forceProvider === 'openrouter' && options.requestedModelId) {
    const explicit = await tryExplicitOpenRouterModel(options, options.requestedModelId);
    if (explicit.result) return explicit.result;
    const fallback = await runProviderCascade(options);
    return { ...fallback, requestedModelId: options.requestedModelId, fallbackNote: explicit.note };
  }
  return runProviderCascade(options);
}

async function runProviderCascade(options: AIGenerateOptions): Promise<AIGenerateResult> {
  const startTime = Date.now();
  const {
    workspaceId,
    prompt,
    systemInstruction,
    modelName,
    preferredProvider = 'auto',
    temperature = 0.7,
    maxOutputTokens,
    jsonMode = false,
    history,
  } = options;

  // 1. Cek apakah ada Custom BYOK API Key di Workspace
  const customKey = await resolveCustomApiKey(workspaceId);
  if (customKey.apiKey) {
    try {
      if (customKey.apiKey.startsWith('sk-proj') || customKey.apiKey.startsWith('sk-')) {
        const res = await callOpenAI(customKey.apiKey, prompt, systemInstruction, modelName || 'gpt-4o-mini', temperature, jsonMode, history, maxOutputTokens);
        return { ...res, provider: 'byok_custom', latencyMs: Date.now() - startTime };
      } else {
        const res = await callGemini(customKey.apiKey, prompt, systemInstruction, modelName || 'gemini-flash-lite-latest', temperature, jsonMode, maxOutputTokens);
        return { ...res, provider: 'byok_custom', latencyMs: Date.now() - startTime };
      }
    } catch (err: any) {
      console.warn('[AIGateway] BYOK execution failed, cascading to platform pool:', err.message);
    }
  }

  // 3. Routing berbasis paket berlangganan (getWorkspacePlan). Provider yang
  // diminta caller sekarang benar-benar menjadi percobaan pertama. Sebelumnya
   // `preferredProvider` dipakai sebagai urutan percobaan pertama. Fallback
   // tetap tersedia, tetapi route analisis berat tidak lagi diam-diam masuk
   // jalur cepat hanya karena provider default berada di posisi pertama.
  const plan = await getWorkspacePlan(workspaceId);
  const isFree = plan.plan === 'FREE';
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openCodeKey = process.env.OPENCODE_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const promptLower = prompt.toLowerCase();
  const isMarketingOrChat = promptLower.includes('copywriting') || promptLower.includes('caption') || promptLower.includes('instagram') || promptLower.includes('tiktok') || promptLower.includes('anivirtual') || promptLower.includes('pesan');

  type RoutedProvider = 'groq' | 'openrouter' | 'opencode' | 'openai' | 'gemini';
  // 11 Sep 2026 (wave B1-backend-routing, arahan Mecca 11 Sep poin 4): OpenRouter = UTAMA,
  // Groq + Gemini = cadangan. Urutan lama ['groq','openrouter',...] menaruh Groq (tier
  // gratis, limit 8k token/menit -- insiden 8 Sep) di depan OpenRouter untuk SEMUA request
  // 'auto' tanpa preferredProvider eksplisit; sekarang dibalik supaya cascade default benar-
  // benar mencerminkan keputusan produk, bukan cuma urutan historis penulisan kode.
  const defaultOrder: RoutedProvider[] = ['openrouter', 'groq', 'gemini', 'openai', 'opencode'];
  const providerOrder: RoutedProvider[] = preferredProvider && preferredProvider !== 'auto'
    ? [preferredProvider, ...defaultOrder.filter((provider) => provider !== preferredProvider)]
    : defaultOrder;

  const attemptProvider = async (provider: RoutedProvider): Promise<AIGenerateResult | null> => {
    if (provider === 'groq' && groqKey?.startsWith('gsk_')) {
      const selectedModel = modelName === 'deep'
        ? 'deepseek-r1-distill-llama-70b'
        : modelName === 'fast' || modelName === 'gemini'
          ? 'llama-3.3-70b-versatile'
          : (modelName || 'llama-3.3-70b-versatile');
      let res;
      try {
        res = await callGroq(groqKey, prompt, systemInstruction, selectedModel, temperature, jsonMode, history, maxOutputTokens);
      } catch (firstErr: any) {
        const msg = String(firstErr?.message || '');
        if ((msg.includes('413') || msg.includes('too large') || msg.includes('rate_limit_exceeded')) && Array.isArray(history) && history.length > 0) {
          console.warn('[AIGateway] Groq 413/limit token -- coba ulang tanpa histori percakapan.');
          res = await callGroq(groqKey, prompt, systemInstruction, selectedModel, temperature, jsonMode, [], maxOutputTokens);
        } else {
          throw firstErr;
        }
      }
      if (jsonMode && !res.json) throw new Error('Groq JSON parse kosong, cascade ke provider berikutnya');
      return { ...res, provider: 'groq', latencyMs: Date.now() - startTime };
    }

    if (provider === 'openrouter' && isUsableProviderKey(openRouterKey)) {
      // 11 Sep 2026 (wave B1-backend-routing): dulu SATU model per percobaan (resolveOpenRouterTextModel).
      // Sekarang bisa berupa DAFTAR kandidat tier (model-tiers.ts) -- primary tier dicoba
      // dulu, lalu tiap fallback tier berurutan, SEMUA di dalam satu percobaan provider
      // 'openrouter' ini, sebelum cascade luar menyerah dan pindah ke provider berikutnya
      // (kontrak Context Pack B1: "coba primary tier lalu tiap fallback tier sebelum lempar
      // ke provider berikutnya"). `null` berarti modelName ini bukan urusan OpenRouter sama
      // sekali (mis. 'fast'/'gemini-*') -- kembalikan null supaya cascade lanjut ke provider
      // lain yang memang menanganinya (Groq/Gemini direct).
      const candidateModels = resolveOpenRouterModelIds(modelName, options.effort);
      if (candidateModels === null) return null;

      const isPassthrough = !!modelName && modelName.includes('/');
      const wantsDeepThinking = modelName === 'deep' || (modelName || '').includes('deepseek-r1');
      const tierForReasoning = isPassthrough ? undefined : resolveTierSpec(wantsDeepThinking ? 'maksimal' : resolveTierForEffort(options.effort));

      let lastErr: any;
      for (const candidateModel of candidateModels) {
        try {
          // reasoning.effort HANYA dikirim kalau tier punya reasoningEffort (hanya tier
          // 'maksimal' yang punya) DAN katalog live bilang model kandidat ini mendukung
          // nilai tsb (pola sama seperti tryExplicitOpenRouterModel di atas) -- gate ganda
          // ini mencegah 4xx diam-diam ke model yang tidak mendukung reasoning literal ini.
          const desiredEffort = tierForReasoning?.reasoningEffort;
          const supportedEfforts = getModelReasoningEfforts(candidateModel);
          const reasoningEffort = desiredEffort && supportedEfforts?.includes(desiredEffort) ? desiredEffort : undefined;
          const res = await callOpenRouter(openRouterKey, prompt, systemInstruction, candidateModel, temperature, jsonMode, history, maxOutputTokens, reasoningEffort);
          if (jsonMode && !res.json) throw new Error('OpenRouter JSON parse kosong, coba kandidat tier berikutnya');
          return { ...res, provider: 'openrouter', latencyMs: Date.now() - startTime };
        } catch (err: any) {
          lastErr = err;
          // Log warn TANPA body provider (kegagalan tiap model di-log, bukan dilempar) --
          // kontrak Context Pack B1 poin cascade 'auto'.
          console.warn(`[AIGateway] OpenRouter model "${candidateModel}" gagal (${err?.message || 'unknown error'}), coba kandidat tier berikutnya...`);
        }
      }
      throw lastErr || new Error('OpenRouter: semua kandidat model tier gagal tanpa error tercatat');
    }

    if (provider === 'opencode' && openCodeKey && (openCodeKey.startsWith('sk-') || openCodeKey.length > 20)) {
      const selectedModel = modelName === 'deep' ? 'deepseek/deepseek-r1' : (modelName || 'deepseek/deepseek-chat');
      const res = await callOpenCode(openCodeKey, prompt, systemInstruction, selectedModel, temperature, jsonMode, history, maxOutputTokens);
      if (jsonMode && !res.json) throw new Error('OpenCode JSON parse kosong, cascade ke provider berikutnya');
      return { ...res, provider: 'opencode', latencyMs: Date.now() - startTime };
    }

    if (provider === 'openai' && openAiKey?.startsWith('sk-')) {
      const selectedModel = isMarketingOrChat ? 'gpt-4o-mini' : (modelName || 'gpt-4o-mini');
      const res = await callOpenAI(openAiKey, prompt, systemInstruction, selectedModel, temperature, jsonMode, history, maxOutputTokens);
      if (jsonMode && !res.json) throw new Error('OpenAI JSON parse kosong, cascade ke provider berikutnya');
      return { ...res, provider: 'openai', latencyMs: Date.now() - startTime };
    }

    if (provider === 'gemini' && isUsableProviderKey(geminiKey)) {
      const wantsDeepThinking = modelName === 'deep' || (modelName || '').includes('deepseek-r1') || (modelName || '').includes('deepseek/deepseek-r1');
      const geminiModel = modelName && modelName.startsWith('gemini')
        ? modelName
        : wantsDeepThinking
          ? 'gemini-2.5-flash'
          : 'gemini-flash-lite-latest';
      const res = await callGemini(geminiKey, prompt, systemInstruction, geminiModel, temperature, jsonMode, maxOutputTokens);
      if (jsonMode && !res.json) throw new Error('Gemini JSON parse kosong, cascade ke provider berikutnya');
      return { ...res, provider: 'gemini', latencyMs: Date.now() - startTime };
    }

    return null;
  };

  // Emergent tetap menjadi fallback platform, bukan override atas route eksplisit.
  // Ini menjaga BYOK dan routing task tetap deterministik di layer external provider.
  for (const provider of providerOrder) {
    try {
      const result = await attemptProvider(provider);
      if (result) return result;
    } catch (err: any) {
      console.warn(`[AIGateway] ${provider} gagal (${err?.message || 'unknown error'}). Beralih ke provider berikutnya...`);
    }
  }

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (emergentKey && emergentKey.startsWith('sk-emergent-')) {
    try {
      const emergentProvider = isFree ? 'gemini' : 'openai';
      const emergentModel = isFree ? 'gemini-flash-lite-latest' : (modelName || 'gpt-4o-mini');
      const res = await callEmergent(prompt, systemInstruction, emergentProvider, emergentModel, temperature, jsonMode, maxOutputTokens);
      if (jsonMode && !res.json) throw new Error('Emergent JSON parse kosong, cascade ke fallback');
      return { ...res, provider: 'emergent', latencyMs: Date.now() - startTime };
    } catch (err: any) {
      console.warn(`[AIGateway] Emergent LLM gagal (${err?.message || 'unknown error'}). Mengaktifkan Fallback Core...`);
    }
  }

  // Rute 4: DETERMINISTIC FALLBACK CORE (High-Quality Standar UMKM Indonesia)
  const latencyMs = Date.now() - startTime;
  let fallbackJson: any = null;

  if (jsonMode) {
    if (promptLower.includes('pitch deck') || promptLower.includes('slides')) {
      fallbackJson = {
        title: 'Presentasi Pitch Deck Investor',
        slides: [
          { slideNumber: 1, topic: 'Cover & Vision', headline: 'Membangun Ekosistem Bisnis Cerdas Terpadu', bullets: ['Solusi inovatif untuk efisiensi UMKM', 'Didukung kecerdasan buatan berbasis konteks'] },
          { slideNumber: 2, topic: 'Problem Statement', headline: 'Fragmentasi Sistem Operasional & Beban Manual', bullets: ['40% waktu operasional terbuang pada administrasi', 'Data keuangan dan operasional terpecah di berbagai aplikasi'] },
          { slideNumber: 3, topic: 'Solution & Value Prop', headline: 'Satu Sistem Operasi untuk Seluruh Pilar Bisnis', bullets: ['Integrasi proposal, operasional, kas, dan promo', 'Pengurangan biaya overhead hingga 50%'] },
          { slideNumber: 4, topic: 'Market Size (TAM SAM SOM)', headline: 'Potensi Pasar UMKM & Komersial Nasional', bullets: ['TAM: Rp 120 Triliun pasar nasional', 'SAM: Rp 18 Triliun segmen berkembang', 'SOM: Rp 500 Juta target tahun ke-1'] },
          { slideNumber: 5, topic: 'Business Model', headline: 'Model Langganan Berjenjang & Fee Transaksi', bullets: ['SaaS Subscription bulanan/tahunan', 'Monetisasi fitur AI berbasis kuota kredit'] },
          { slideNumber: 6, topic: 'Traction & Milestones', headline: 'Validasi Pasar Kuat & Retensi Tinggi', bullets: ['Pertumbuhan transaksi MoM 25%', 'Net Promoter Score 90+'] },
          { slideNumber: 7, topic: 'Go-To-Market', headline: 'Pemasaran Berbasis Komunitas & Kemitraan', bullets: ['Kemitraan asosiasi bisnis lokal', 'Distribusi digital terarah & omni-channel'] },
          { slideNumber: 8, topic: 'Competitive Advantage', headline: 'Pemisahan Jalur Publik & Privat yang Aman', bullets: ['Kepatuhan hukum & perbankan Indonesia', 'Multi-tenant RBAC aman'] },
          { slideNumber: 9, topic: 'Financial Projections', headline: 'Titik Impas (BEP) Cepat & Arus Kas Positif', bullets: ['BEP tercapai pada bulan ke-6', 'Margin laba bersih diproyeksikan 35%'] },
          { slideNumber: 10, topic: 'Team Leadership', headline: 'Kombinasi Keahlian Teknologi & Industri', bullets: ['Founder berpengalaman teknologi & finansial', 'Didukung tim rekayasa perangkat lunak solid'] },
          { slideNumber: 11, topic: 'The Ask (Funding)', headline: 'Penggalangan Dana untuk Akselerasi Pertumbuhan', bullets: ['50% Pengembangan Produk & AI', '30% Ekspansi Pasar', '20% Cadangan Operasional'] },
          { slideNumber: 12, topic: 'Closing & Contact', headline: 'Mari Bersinergi Menciptakan Dampak Nyata', bullets: ['Email: contact@anitech.dev', 'Website: https://anitech.dev'] },
        ],
      };
    } else if (promptLower.includes('swot') || promptLower.includes('valuasi')) {
      fallbackJson = {
        strengths: ['Diferensiasi produk kuat dengan keunikan lokal', 'Efisiensi operasional tinggi berbasis sistem terpadu', 'Margin kotor di atas rata-rata industri'],
        weaknesses: ['Ketergantungan rantai pasok pada supplier musiman', 'Brand awareness yang masih dalam tahap akselerasi'],
        opportunities: ['Pertumbuhan adopsi digital segmen muda mencapai 28% YoY', 'Peluang ekspansi ke kanal B2B dan kemitraan korporasi'],
        threats: ['Fluktuasi harga bahan mentah', 'Persaingan harga dari pemain konvensional berbiaya murah'],
        riskMitigations: [
          { risk: 'Fluktuasi Bahan Baku', mitigation: 'Kontrak pasokan jangka panjang dengan produsen lokal' },
          { risk: 'Kompetisi Pasar', mitigation: 'Fokus pada loyalitas pelanggan & kualitas layanan standar tinggi' },
        ],
      };
    } else if (promptLower.includes('materi promosi') || promptLower.includes('copywriting') || promptLower.includes('instagram')) {
      fallbackJson = {
        productName: 'Produk Unggulan Pilihan',
        toneUsed: 'SKENA_JAKSEL',
        instagram: {
          headline: '🔥 Promo Eksklusif Hari Ini — Jangan Sampai Ketinggalan!',
          caption: 'Jujurly nemu yang se-worth it ini susah banget! Solusi terbaik buat kamu yang mau serba efisien, berkualitas tinggi, dan pastinya bikin harimu makin produktif. Yuk cobain sekarang juga!',
          callToAction: '👉 Klik link di bio buat klaim voucher diskon spesial kamu sebelum kehabisan slot ya!',
          hashtags: ['#BisnisLokal', '#UMKMIndonesia', '#PromoSpesial', '#RekomendasiProduk', '#ViralIndonesia'],
        },
        tiktok: {
          hook3Detik: 'POV: Kamu baru nemu produk yang bikin hidup 10x lebih gampang tapi belum banyak yang tahu!',
          scriptVideo: 'Buka video dengan nunjukin masalah sehari-hari. Lalu reveal produk. Tunjukin cara pakainya yang simpel dalam 5 detik. Kasih info diskon khusus!',
          callToAction: 'Klik keranjang kuning sekarang sebelum promo flash sale berakhir ya guys!',
        },
        whatsappBroadcast: {
          salamPembuka: 'Halo Sahabat Terbaik! 👋',
          isiPesan: 'Kabar gembira! Khusus hari ini kami ada penawaran diskon potongan harga istimewa. Stok terbatas hanya untuk pemesan pertama hari ini.',
          linkPemesanan: 'https://wa.me/6281234567890?text=Halo+saya+mau+order+promo+spesial',
        },
        metaAds: {
          adHeadline: 'Tingkatkan Kualitas Hari Anda Bersama Kami',
          primaryText: 'Solusi terpercaya dengan garansi kepuasan dan pengiriman cepat ke seluruh Indonesia.',
          ctaButton: 'Pesan Sekarang',
        },
      };
    } else {
      fallbackJson = {
        status: 'SUCCESS',
        summary: `Hasil analisis AI terstruktur untuk: ${prompt.slice(0, 80)}`,
        insights: [
          'Model bisnis terverifikasi sesuai standar industri komersial Indonesia.',
          'Efisiensi operasional terkelola optimal melalui platform KLIR OS.',
          'Format output terstruktur siap pakai tanpa error.',
        ],
        generatedAt: new Date().toISOString(),
      };
    }
    return {
      text: JSON.stringify(fallbackJson, null, 2),
      json: fallbackJson,
      provider: 'deterministic_fallback',
      modelUsed: 'klir-hybrid-fallback-core',
      latencyMs,
    };
  }

  return {
    text: `Analisis AI KLIR OS:\n\nBerdasarkan data yang diberikan, rekomendasi operasional telah diproses secara presisi dan siap diimplementasikan.`,
    json: null,
    provider: 'deterministic_fallback',
    modelUsed: 'klir-hybrid-fallback-core',
    latencyMs,
  };
}

/**
 * Analisis gambar (foto papan tulis, dokumen hasil scan/foto, diagram, dst) via
 * Gemini Vision. Beda dari generateImage() (yang MEMBUAT gambar) -- ini MEMBACA
 * gambar yang sudah ada. Langsung ke Gemini (satu-satunya provider vision dengan
 * key real di sistem ini sekarang), sengaja TIDAK lewat cascade multi-provider
 * executeAIRequest karena provider teks lain di cascade itu (Groq/OpenAI/dst)
 * tidak semuanya vision-capable dan tidak ada jaminan key-nya real.
 */
export async function analyzeImageWithGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; modelUsed: string }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === 'AIzaSy...') {
    throw new Error('GEMINI_API_KEY tidak tersedia untuk analisis gambar.');
  }
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
  });
  const result = await callWithRetry(() =>
    model.generateContent([{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }])
  );
  return { text: result.response.text(), modelUsed: 'gemini-2.5-flash' };
}

/**
 * Helper: Generate Output JSON Terstruktur dengan Schema
 */
export async function generateStructuredJson<T = any>(
  workspaceId: string,
  prompt: string,
  systemInstruction?: string,
  optionsOrModelName?: string | { modelName?: string; effort?: EffortLevel }
): Promise<{ data: T; provider: string; latencyMs: number }> {
  const modelName = typeof optionsOrModelName === 'string' ? optionsOrModelName : optionsOrModelName?.modelName;
  const effort = typeof optionsOrModelName === 'object' ? optionsOrModelName?.effort : undefined;

  const result = await executeAIRequest({
    workspaceId,
    prompt,
    systemInstruction: (systemInstruction || '') + '\nOutput MUST be valid JSON only without markdown code blocks.',
    jsonMode: true,
    modelName,
    effort,
  });

  return {
    data: (result.json as T) || ({} as T),
    provider: result.provider,
    latencyMs: result.latencyMs,
  };
}

/** Compatibility adapter: all image callers share the validated media provider. */
export async function generateImage(
  prompt: string,
  modelName?: string
): Promise<{ imageBase64: string | null; mimeType: string; provider: string; modelUsed: string; latencyMs: number }> {
  const { generateImageMedia } = await import('./media-provider');
  const result = await generateImageMedia(prompt, { model: modelName });
  return { imageBase64: result.base64 || null, mimeType: result.mimeType, provider: result.provider, modelUsed: result.modelUsed, latencyMs: result.latencyMs };
}

/**
 * Streaming chat — menghasilkan token secara bertahap (async generator).
 * Dipakai untuk pengalaman chat seperti ChatGPT (jawaban muncul token demi token).
 */
export async function streamChatText(
  prompt: string,
  systemInstruction?: string,
  modelName: string = 'gemini-flash-lite-latest'
): Promise<AsyncGenerator<string, void, unknown>> {
  // Jalur utama: Groq streaming (ultra-cepat) — openai/gpt-oss-120b / qwen3.8-27b
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.startsWith('gsk_')) {
    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages, temperature: 0.8, stream: true }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        async function* groqTokenGenerator(): AsyncGenerator<string, void, unknown> {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const payload = trimmed.slice(6);
              if (payload === '[DONE]') continue;
              try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) yield delta;
              } catch {
                /* abaikan chunk rusak */
              }
            }
          }
        }

        return groqTokenGenerator();
      }
      console.warn('[AIGateway] Groq stream gagal, fallback ke Gemini:', res.status);
    } catch (err: any) {
      console.warn('[AIGateway] Groq stream error, fallback ke Gemini:', err.message);
    }
  }

  // Jalur fallback: Gemini streaming
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey || geminiKey === 'AIzaSy...') {
    throw new Error('Tidak ada provider streaming yang tersedia (Groq/Gemini).');
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    ...(systemInstruction ? { systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] } } : {}),
  });

  const result = await callWithRetry(() => model.generateContentStream(prompt));

  async function* tokenGenerator(): AsyncGenerator<string, void, unknown> {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  return tokenGenerator();
}

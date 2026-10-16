// src/lib/model-tiers.ts
// BARU 11 Sep 2026 (wave B1-backend-routing, Context Pack integrasi-ai-data-model-hemat).
// KENAPA: arahan Mecca 11 Sep poin 4 -- "OpenRouter = UTAMA. Groq + Gemini = cadangan.
// Default WAJIB model murah; user yang mau serius pilih sendiri mode/model canggih."
// Sebelum file ini ada, ai-gateway.ts:147 (resolveOpenRouterTextModel lama) memakai SATU
// default statis untuk SEMUA permintaan OpenRouter tanpa modelName eksplisit:
// 'google/gemini-3.5-flash' -- harga live 11 Sep 2026 $1.50/$9.00 per juta token
// (prompt/completion), MAHAL untuk jadi default percakapan sehari-hari. File ini jadi
// SSOT tier model: 'hemat' (default), 'standar' (effort serius), 'maksimal' (PILIHAN
// USER, tidak pernah dipilih otomatis oleh auto-effort.ts).
//
// PURE MODULE: nol import node-only, nol process.env di top-level (aturan seksi 5 Context
// Pack). resolveTierSpec() boleh baca process.env karena itu terjadi DI DALAM fungsi saat
// dipanggil, bukan saat modul dievaluasi -- aman diimpor dari server routes/lib manapun,
// termasuk (kalau suatu saat perlu) dari komponen client tanpa risiko menyeret Node API.
//
// CATATAN OPERASIONAL 11 Sep 2026 (komando/B1): file ini SEMPAT ditimpa DUA KALI oleh stub
// sementara agent lain (B2/B3) yang butuh signature modul ini untuk tsc/test lokal mereka
// sebelum implementasi resmi ini ada di disk (kerja paralel, kontrak file disjoint tapi
// urutan tulis tidak terjamin). Versi INI (dengan resolveTierSpec yang benar-benar membaca
// env override, bukan cuma `return MODEL_TIERS[tier]`) adalah SSOT final -- JANGAN
// ditimpa balik ke stub tanpa env override.

/** Tingkat biaya/kemampuan model OpenRouter yang dipetakan dari effort composer.
 * REVISI KOMANDO 11 Sep 2026 siang (arahan susulan Mecca: "cek lagi model yang LITERAL
 * lebih murah... obrolan santai cukup model murah meriah asal kualitas bagus"): tier
 * 'santai' ditambahkan di bawah 'hemat', dan default hemat diturunkan dari
 * gemini-3.1-flash-lite ($0.25/$1.50) ke deepseek-v4-flash ($0.065/$0.18). Sumber harga:
 * docs/2026-09-11-openrouter-catalog-screening.md (katalog live 11 Sep, 437 model teks). */
export type ModelTier = 'santai' | 'hemat' | 'standar' | 'maksimal';

export interface TierSpec {
  tier: ModelTier;
  /** Model utama yang dicoba pertama untuk tier ini. */
  primary: string;
  /** Model cadangan, dicoba berurutan kalau primary gagal -- SEBELUM cascade ai-gateway.ts
   * menyerah dari provider 'openrouter' dan pindah ke provider lain (lihat kontrak B1). */
  fallbacks: string[];
  /** Kalau diisi, DAN katalog live (getModelReasoningEfforts) bilang model kandidat
   * mendukung nilai ini, ai-gateway.ts mengirim body.reasoning.effort = nilai ini. */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Alasan pemilihan tier ini -- untuk observability/debug, bukan dipakai logic. */
  note: string;
}

// Harga per-juta-token (prompt/completion) di komentar ini adalah snapshot live 11 Sep
// 2026 dari katalog OpenRouter (lihat Context Pack seksi 3.A) -- dicatat sebagai alasan
// keputusan, BUKAN dibaca oleh kode (harga sesungguhnya tetap dari discoverTextModels()
// di text-model-catalog.ts kalau suatu saat dibutuhkan live).
export const MODEL_TIERS: Record<ModelTier, TierSpec> = {
  santai: {
    tier: 'santai',
    primary: 'qwen/qwen3.8-flash',
    fallbacks: ['deepseek/deepseek-v4.1-flash', 'openai/gpt-4o-mini'],
    note:
      '16 Sep 2026: sapaan, konfirmasi, obrolan santai -- qwen3.8-flash, ' +
      'fallback deepseek-v4.1-flash dan gpt-4o-mini. Cepat, hemat kredit, dan responsif.',
  },
  hemat: {
    tier: 'hemat',
    primary: 'deepseek/deepseek-v4.1-flash',
    fallbacks: ['openai/gpt-4o-mini', 'qwen/qwen3.8-flash'],
    note:
      '16 Sep 2026: DEFAULT chat normal / auto-effort + brief perusahaan -- ' +
      'deepseek-v4.1-flash sebagai primary murah berkinerja tinggi, fallback gpt-4o-mini dan qwen3.8-flash.',
  },
  standar: {
    tier: 'standar',
    primary: 'openai/gpt-5.6-luna',
    fallbacks: ['deepseek/deepseek-v4.1-flash', 'openai/gpt-4o-mini'],
    note:
      '16 Sep 2026: dipakai untuk effort serius / mode analis & riset tim bisnis -- ' +
      'openai/gpt-5.6-luna berpenalaran mendalam, fallback deepseek-v4.1-flash.',
  },
  maksimal: {
    tier: 'maksimal',
    primary: 'openai/gpt-5.6-luna',
    reasoningEffort: 'high',
    fallbacks: ['google/gemini-3.5-flash', 'deepseek/deepseek-v4.1-flash'],
    note:
      '16 Sep 2026: effort maksimal pilihan user -- openai/gpt-5.6-luna dengan high reasoning effort, ' +
      'fallback gemini-3.5-flash.',
  },
};

/** Model default untuk task ekstraksi JSON deterministik (extract_json/summarize di
 * ai-orchestrator.ts) -- sama dengan tier hemat.primary per keputusan Mecca 11 Sep
 * (default murah), TAPI dideklarasikan terpisah supaya kalau tier hemat berubah di masa
 * depan, task ekstraksi JSON tidak ikut berubah diam-diam tanpa keputusan eksplisit.
 * Fallback Groq untuk task ini tetap 'openai/gpt-oss-120b' (default callGroq() yang sudah
 * ada, tidak diduplikasi di sini -- lihat ai-gateway.ts callGroq).
 */
export const JSON_EXTRACTION_MODEL = 'deepseek/deepseek-v4-flash-0731';

/**
 * Petakan effort composer ke tier model. santai -> santai (revisi 11 Sep siang);
 * normal/undefined -> hemat (default paling umum); serius -> standar; maksimal -> maksimal
 * (satu-satunya jalur ke tier termahal, dan HANYA lewat pilihan eksplisit --
 * classifyEffort() di auto-effort.ts tidak pernah mengembalikan 'maksimal').
 */
export function resolveTierForEffort(
  effort: 'santai' | 'normal' | 'serius' | 'maksimal' | undefined
): ModelTier {
  if (effort === 'santai') return 'santai';
  if (effort === 'serius') return 'standar';
  if (effort === 'maksimal') return 'maksimal';
  return 'hemat';
}

/**
 * Ambil spec tier dengan override env diterapkan (dibaca di dalam fungsi, bukan top-level,
 * supaya modul ini tetap PURE saat diimpor). Env override per tier:
 *   OPENROUTER_MODEL_HEMAT / OPENROUTER_MODEL_STANDAR / OPENROUTER_MODEL_MAKSIMAL
 * mengganti `primary` tier terkait. OPENROUTER_TEXT_MODEL (env lama, sebelum sistem tier
 * ini ada) TETAP dihormati sebagai override tier 'hemat' untuk kompatibilitas mundur --
 * deployment yang sudah set env ini sebelum 11 Sep 2026 tidak mendadak berubah perilaku.
 * Kalau kedua env (lama dan baru) sama-sama di-set untuk tier hemat, yang baru
 * (OPENROUTER_MODEL_HEMAT) menang karena lebih spesifik.
 */
export function resolveTierSpec(tier: ModelTier): TierSpec {
  const base = MODEL_TIERS[tier];
  const specificEnvKey =
    tier === 'santai'
      ? 'OPENROUTER_MODEL_SANTAI'
      : tier === 'hemat'
      ? 'OPENROUTER_MODEL_HEMAT'
      : tier === 'standar'
      ? 'OPENROUTER_MODEL_STANDAR'
      : 'OPENROUTER_MODEL_MAKSIMAL';
  const legacyOverride = tier === 'hemat' ? process.env.OPENROUTER_TEXT_MODEL : undefined;
  const override = process.env[specificEnvKey] || legacyOverride;
  const trimmed = override?.trim();
  if (trimmed) {
    return { ...base, primary: trimmed };
  }
  return base;
}

/** Daftar unik model (primary + fallbacks, dengan override env diterapkan) untuk dicoba
 * berurutan pada satu percobaan provider 'openrouter' di cascade ai-gateway.ts. */
export function modelIdsForTier(tier: ModelTier): string[] {
  const spec = resolveTierSpec(tier);
  return Array.from(new Set([spec.primary, ...spec.fallbacks]));
}

import { prisma } from '@/lib/prisma';
import { orchestrate } from '@/lib/ai-orchestrator';
import { buildWorkspaceKnowledgeBlock } from './workspace-knowledge';
import { invalidateContextCache } from './context-engine';
// B3_AI, 11 Sep 2026 (kontrak modul 4 -- company-brief.ts, wiring milik B3 sendiri):
// brief naratif ikut di-refresh setelah profil 7-field otomatis selesai sync --
// fire-and-forget, never-throw, Map debounce TERPISAH dari modul ini sendiri
// (lihat JSDoc company-brief.ts kenapa 8 detik vs 5 detik di sini).
import { scheduleCompanyBriefRefresh } from './company-brief';

/**
 * KLIR AI Brain -- Auto Company Profile Sync (8 Sep 2026, KOMANDO B3_AI, T4d).
 *
 * Latar belakang (T4 context pack): setelah upload batch ke Pusat Data, profil
 * perusahaan (nama/industri/target pasar/deskripsi/produk) HARUS otomatis
 * terisi kalau field itu masih kosong -- SEKALI PER BATCH (bukan per file),
 * dan JANGAN PERNAH menimpa field yang sudah diisi manual (CEOSettingsModal,
 * source='MANUAL' -- lihat profile/route.ts POST baris 144).
 *
 * DEBOUNCE (bukan queue/lock): dipanggil B1 fire-and-forget dari workspace-files
 * POST SETIAP file yang sukses (termasuk per-entri zip T2) -- kalau logic inti
 * (ekstraksi LLM) langsung jalan tiap panggilan, upload 12 file berurutan bakal
 * memicu 12x panggilan LLM sia-sia. Map in-memory `timers` (pola SAMA persis
 * dengan `contextSnapshotCache` di context-engine.ts -- app ini jalan sebagai
 * SATU proses PM2 persisten di VPS [ecosystem.config.js instances:1, VERIFIED
 * langsung oleh agent kritik sesi sintesis], BUKAN serverless, jadi Map
 * in-memory lintas-request AMAN di topologi produksi SAAT INI) menyimpan timer
 * per workspaceId -- panggilan baru me-reset timer yang lama, jadi logic inti
 * baru benar-benar jalan ~5 detik SETELAH panggilan TERAKHIR dalam satu batch.
 * Trade-off jujur: kalau proses PM2 di-restart PAS di tengah window 5 detik,
 * 1x sync batch itu hilang (non-fatal -- file mentahnya AMAN tersimpan di
 * WorkspaceFile, cuma auto-fill profil tertunda sampai upload berikutnya
 * memicu timer baru lagi. Tidak ada risiko kehilangan data).
 *
 * KONTRAK NEVER-THROW (dipanggil B1 fire-and-forget TANPA try/catch tambahan
 * DAN TANPA await): scheduleAutoCompanyProfileSync() sendiri sinkron murni
 * (cuma set/clear Timeout, tidak pernah reject apapun ke caller). Handler
 * async di dalam timer membungkus SELURUH isinya di try/catch tunggal --
 * kegagalan prisma ATAUPUN orchestrate() TIDAK PERNAH keluar sebagai
 * unhandled rejection, cukup di-log non-fatal.
 *
 * CATATAN EKSPLISIT (kewajiban laporan komando 3b): fungsi ini SENGAJA TIDAK
 * memperbaiki bug F4 (src/app/api/v1/documents/analyze/route.ts baris 290-317,
 * overwrite MemoryItem[COMPANY_PROFILE] TANPA cek field lama/manual) --
 * file itu DI LUAR daftar file yang di-assign ke agent manapun di wave 8 Sep
 * ini (bukan lupa, murni disiplin scope). Dilaporkan terpisah ke komando di
 * bagian "ditunda" hasil sintesis, BUKAN diam-diam ditambal di luar file yang
 * diizinkan kontrak build ini.
 */

const COMPANY_PROFILE_TAG = '[COMPANY_PROFILE]';

/** Debounce window: waktu tunggu sejak panggilan TERAKHIR sebelum logic inti
 * benar-benar jalan. 5 detik dipilih supaya cukup untuk "jeda antar file" saat
 * upload 12-file-berurutan (T1, client mengirim request satu-satu) tanpa
 * membuat user menunggu lama untuk melihat profil ter-auto-isi. */
const DEBOUNCE_MS = 5000;

/** Map in-memory workspaceId -> timer aktif. Lihat komentar debounce di atas
 * untuk alasan kenapa Map biasa (bukan Redis/DB) aman dipakai di topologi
 * produksi KLIR saat ini (1 proses PM2, bukan cluster/serverless). */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

interface ExtractedProfileFields {
  name?: string;
  industry?: string;
  targetMarket?: string;
  description?: string;
  primaryProduct?: string;
  businessModel?: string;
  nib?: string;
}

interface ParsedProfileFields {
  name: string;
  industry: string;
  targetMarket: string;
  description: string;
  primaryProduct: string;
  businessModel: string;
  nib: string;
  source: string;
}

/**
 * Parse 1 baris content MemoryItem[COMPANY_PROFILE] jadi 7 field + Sumber.
 * Regex PERSIS SAMA dengan src/app/api/v1/workspaces/[workspaceId]/profile/
 * route.ts GET handler baris 54-93 (termasuk field Model Bisnis & NIB yang
 * BARU ditambahkan pagi 8 Sep 2026 -- WAJIB ikut, mudah kelewat kalau
 * mengikuti rancangan lama 5-field, lihat catatan_jujur sintesis komando
 * KOREKSI #1). "-" atau kosong dianggap BELUM TERISI, sama seperti route itu.
 * Field yang tidak ketemu match -> string kosong (dianggap belum terisi).
 */
function parseCompanyProfileContent(content: string): ParsedProfileFields {
  const extractField = (label: string): string => {
    const match = content.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'));
    if (match && match[1].trim() && match[1].trim() !== '-') {
      return match[1].trim();
    }
    return '';
  };
  const srcMatch = content.match(/Sumber:\s*([^|]+)/i);
  const source = srcMatch && srcMatch[1].trim() ? srcMatch[1].trim() : '';

  return {
    name: extractField('Nama'),
    industry: extractField('Industri'),
    targetMarket: extractField('Target Pasar'),
    description: extractField('Deskripsi'),
    primaryProduct: extractField('Produk'),
    businessModel: extractField('Model Bisnis'),
    nib: extractField('NIB'),
    source,
  };
}

/** Susun content MemoryItem[COMPANY_PROFILE], format PERSIS sama dengan
 * profile/route.ts POST baris 181 supaya GET/parser lain yang sudah ada tetap
 * bisa membacanya tanpa perubahan apapun. Field kosong ditulis "-" (konvensi
 * yang sama). */
function formatCompanyProfileContent(fields: ParsedProfileFields): string {
  return `${COMPANY_PROFILE_TAG} Nama: ${fields.name || '-'} | Industri: ${fields.industry || '-'} | Target Pasar: ${fields.targetMarket || '-'} | Deskripsi: ${fields.description || '-'} | Produk: ${fields.primaryProduct || '-'} | Model Bisnis: ${fields.businessModel || '-'} | NIB: ${fields.nib || '-'} | Sumber: ${fields.source || '-'}`;
}

/**
 * Logic inti (dipanggil SETELAH debounce settle) -- 1 batch = 1 panggilan LLM
 * MAKSIMAL. Never-throw: seluruh isi dibungkus try/catch tunggal.
 */
async function runAutoCompanyProfileSync(workspaceId: string, sourceLabel: string): Promise<void> {
  try {
    // (a) Manifest kosong (tidak ada WorkspaceFile) -> tidak ada bahan ekstraksi, skip.
    const knowledge = await buildWorkspaceKnowledgeBlock(workspaceId, '');
    if (!knowledge.manifest && !knowledge.relevant) {
      return;
    }

    // (b) Ekstraksi profil via LLM (task extract_json -> jsonMode+temperature 0,
    // deterministik, lihat ai-orchestrator.ts). orchestrate() bisa reject (mis.
    // semua provider down) -- ditangkap oleh try/catch terluar fungsi ini.
    const extractionPrompt = `${knowledge.manifest}\n\n${knowledge.relevant}`.trim();
    if (!extractionPrompt) return;

    const result = await orchestrate({
      workspaceId,
      task: 'extract_json',
      prompt: `Berdasarkan daftar file dan isi dokumen Pusat Data berikut, ekstrak profil perusahaan/bisnis kalau informasinya ADA secara eksplisit di dokumen. JANGAN MENGARANG -- field yang tidak ada infonya di dokumen, kosongkan (string kosong).\n\n${extractionPrompt.slice(0, 12000)}`,
      systemInstruction:
        'Anda mengekstrak profil perusahaan dari dokumen Pusat Data sebuah workspace KLIR. Balas HANYA JSON valid PERSIS format ' +
        '{"name": "", "industry": "", "targetMarket": "", "description": "", "primaryProduct": "", "businessModel": "", "nib": ""} ' +
        'tanpa teks lain di luar JSON. Isi HANYA field yang informasinya benar-benar tersurat di dokumen; kosongkan (string kosong "") field yang tidak ada infonya -- JANGAN menebak/mengarang.',
    });

    let extracted: ExtractedProfileFields | null = result.json ?? null;
    if (!extracted) {
      try {
        extracted = JSON.parse(result.text);
      } catch {
        extracted = null;
      }
    }
    if (!extracted || typeof extracted !== 'object') return;

    // (c) Baca MemoryItem[COMPANY_PROFILE] TERBARU, pola query PERSIS sama
    // dengan profile/route.ts baris 36-43 & context-engine.ts baris 97-104.
    const latestMemory = await prisma.memoryItem.findFirst({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: COMPANY_PROFILE_TAG },
      },
      orderBy: { createdAt: 'desc' },
    });

    const existing: ParsedProfileFields = latestMemory?.content
      ? parseCompanyProfileContent(latestMemory.content)
      : { name: '', industry: '', targetMarket: '', description: '', primaryProduct: '', businessModel: '', nib: '', source: '' };

    // (d) Merge per FIELD -- existing kosong/'-'/absen -> pakai hasil ekstraksi;
    // existing SUDAH terisi -> PERTAHANKAN, JANGAN timpa (syarat keras T4).
    const merged: ParsedProfileFields = {
      name: existing.name || (extracted.name || '').trim(),
      industry: existing.industry || (extracted.industry || '').trim(),
      targetMarket: existing.targetMarket || (extracted.targetMarket || '').trim(),
      description: existing.description || (extracted.description || '').trim(),
      primaryProduct: existing.primaryProduct || (extracted.primaryProduct || '').trim(),
      // Field Model Bisnis & NIB BARU ditambahkan 8 Sep pagi (lihat komentar
      // parseCompanyProfileContent) -- WAJIB ikut merge sama seperti 5 field
      // lama supaya tidak accidentally ter-reset ke "-" saat auto-sync jalan.
      businessModel: existing.businessModel || (extracted.businessModel || '').trim(),
      nib: existing.nib || (extracted.nib || '').trim(),
      // Sumber: existing.Sumber KALAU ADA (terutama 'MANUAL' -- WAJIB
      // dipertahankan, JANGAN downgrade ke sourceLabel batch), atau
      // sourceLabel kalau memang belum ada record sama sekali.
      source: existing.source || sourceLabel,
    };

    // (e) Tidak ada field yang berubah dari existing -> no-op, JANGAN tulis
    // MemoryItem baru (cegah penumpukan record sia-sia tiap batch upload).
    const unchanged =
      merged.name === existing.name &&
      merged.industry === existing.industry &&
      merged.targetMarket === existing.targetMarket &&
      merged.description === existing.description &&
      merged.primaryProduct === existing.primaryProduct &&
      merged.businessModel === existing.businessModel &&
      merged.nib === existing.nib &&
      merged.source === existing.source;
    if (unchanged) return;

    // (f) Ada perubahan -> tulis MemoryItem baru (pola append-only yang sama
    // dengan profile/route.ts POST -- "terbaru menang" dibaca via orderBy desc).
    await prisma.memoryItem.create({
      data: {
        workspaceId,
        userId: null,
        scope: 'WORKSPACE',
        content: formatCompanyProfileContent(merged),
      },
    });

    // (g) Invalidasi cache AI Brain supaya dashboard/chat langsung "melihat"
    // profil baru tanpa nunggu TTL 60 detik contextSnapshotCache habis sendiri.
    invalidateContextCache(workspaceId);
    // (h) B3_AI, 11 Sep 2026: profil 7-field baru saja berubah -- brief naratif
    // (company-brief.ts) ikut dijadwalkan refresh supaya narasinya tidak
    // ketinggalan zaman dibanding profil terbaru. Debounce sendiri (8 detik,
    // Map terpisah di company-brief.ts), TIDAK memblokir/menunda fungsi ini.
    scheduleCompanyBriefRefresh(workspaceId, sourceLabel);
  } catch (err) {
    // Never-throw (kontrak dengan B1, dipanggil fire-and-forget tanpa
    // try/catch tambahan) -- kegagalan apapun di sini cukup di-log, TIDAK
    // PERNAH keluar sebagai unhandled rejection.
    console.warn('[AutoCompanyProfile] gagal sync profil perusahaan otomatis (non-fatal):', err);
  }
}

/**
 * Titik masuk publik -- dipanggil B1 (workspace-files/route.ts POST) fire-
 * and-forget SETELAH invalidateContextCache, TIDAK di-await. Sinkron murni:
 * reset debounce timer workspace ini, TIDAK PERNAH throw.
 */
export function scheduleAutoCompanyProfileSync(workspaceId: string, sourceLabel: string): void {
  const existingTimer = timers.get(workspaceId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    timers.delete(workspaceId);
    void runAutoCompanyProfileSync(workspaceId, sourceLabel);
  }, DEBOUNCE_MS);
  timers.set(workspaceId, timer);
}

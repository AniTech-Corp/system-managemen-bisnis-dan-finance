/**
 * Registry gabungan seluruh template dokumen KLIR (laporan keuangan, invoice/surat niaga,
 * presentasi, dan brief video) menjadi satu titik akses tunggal untuk fase integrate.
 *
 * File ini TIDAK mendefinisikan template baru apapun -- semua struktur/aturan tetap hidup
 * di 4 file sumbernya masing-masing (financial-report-templates.ts, invoice-templates.ts,
 * deck-templates.ts, video-brief-templates.ts). Modul ini murni penyatu: tipe umum, fungsi
 * pencarian lintas sumber, dan fungsi yang memperkaya brief pengguna dengan instruksi
 * struktur template sebelum diserahkan ke runGeneration (generation-engine.ts, milik Fatur).
 *
 * NOL panggilan LLM/network/DB di file ini. Semua fungsi murni (pure), deterministik.
 *
 * Prinsip yang dijaga (sama dengan 4 file sumber):
 * - Struktur template TIDAK PERNAH diubah dari sini. File ini hanya membaca dan merangkai
 *   ulang apa yang sudah ada di sumbernya.
 * - templateId tak dikenal -> hasil "tidak ada perubahan" (brief asli dikembalikan apa
 *   adanya, bukan mengarang struktur), mengikuti pola resolveIndustryTemplate/
 *   enrichWithIndustry di industry-image-templates.ts yang sudah terbukti dipakai proyek ini.
 * - Import GenerationType dari generation-engine.ts (milik Fatur) HANYA sebagai type,
 *   bukan pemanggilan fungsi apapun dari file itu -- file Fatur tidak tersentuh.
 */

import type { GenerationType } from '@/lib/generation-engine';
import {
  FINANCIAL_REPORT_TEMPLATES,
  resolveFinancialReportTemplate,
  buildFinancialReportInstruction,
} from './financial-report-templates';
import {
  INVOICE_DOC_TEMPLATES,
  resolveInvoiceTemplate,
  buildInvoiceTemplateInstruction,
} from './invoice-templates';
import {
  DECK_TEMPLATE_LIST,
  resolveDeckTemplate,
  buildDeckTemplateInstruction,
} from './deck-templates';
import {
  VIDEO_BRIEF_TEMPLATES,
  resolveVideoBriefTemplate,
  buildVideoBriefInstruction,
} from './video-brief-templates';

/** Empat sumber template yang digabung di registry ini. */
export type DocTemplateSource = 'financial-report' | 'invoice' | 'deck' | 'video-brief';

/**
 * Bentuk umum yang menyatukan keempat jenis template untuk kebutuhan listing/pemilihan
 * di UI. Detail struktur lengkap (section/pos akun/slide/scene) TIDAK dipindahkan ke sini
 * -- itu tetap dibaca dari file sumbernya lewat source+sourceId kalau dibutuhkan, supaya
 * satu-satunya tempat definisi struktur tetap file aslinya (tidak ada duplikasi data).
 */
export interface DocTemplate {
  /** Id unik di seluruh registry gabungan ini. Dipakai sebagai nilai templateId dari luar
   *  (route/UI). Biasanya sama dengan sourceId, KECUALI ada tabrakan id lintas file --
   *  lihat catatan tabrakan di buildRegistry(). */
  id: string;
  /** Id asli di file sumbernya, dipakai internal untuk memanggil resolver/builder di sana. */
  sourceId: string;
  source: DocTemplateSource;
  label: string;
  outputType: GenerationType;
  description: string;
}

interface RegistryCandidate {
  sourceId: string;
  source: DocTemplateSource;
  label: string;
  outputType: GenerationType;
  description: string;
}

/**
 * Susun kandidat registry dari 4 sumber, urutan tetap (financial, invoice, deck, video)
 * supaya urutan tampil di UI konsisten dan bisa diprediksi antar build.
 *
 * Catatan per sumber:
 * - financial-report: outputType sudah 'excel' di source-nya, dipakai apa adanya.
 * - invoice: outputType sudah 'word'|'excel' di source-nya, dipakai apa adanya.
 * - deck: source-nya (DeckTemplate) TIDAK punya field outputType sendiri karena semua
 *   templatenya memang untuk presentasi -- di-hardcode 'ppt' di sini, bukan ditebak.
 * - video-brief: source-nya menghasilkan storyboard/naskah (bukan video jadi, lihat
 *   VIDEO_BRIEF_CATATAN_STATUS_PRODUK di file sumbernya) -- dipetakan ke GenerationType
 *   'video-plan' karena itu satu-satunya tipe generation-engine.ts yang menghasilkan
 *   dokumen storyboard, konsisten dengan cara generateVideoPlan() bekerja di sana.
 */
function buildCandidates(): RegistryCandidate[] {
  const financial: RegistryCandidate[] = Object.values(FINANCIAL_REPORT_TEMPLATES).map((t) => ({
    sourceId: t.id,
    source: 'financial-report',
    label: t.label,
    outputType: t.outputType,
    description: t.deskripsiSingkat,
  }));

  const invoice: RegistryCandidate[] = INVOICE_DOC_TEMPLATES.map((t) => ({
    sourceId: t.id,
    source: 'invoice',
    label: t.label,
    outputType: t.outputType,
    description: t.description,
  }));

  const deck: RegistryCandidate[] = DECK_TEMPLATE_LIST.map((t) => ({
    sourceId: t.id,
    source: 'deck',
    label: t.label,
    outputType: 'ppt',
    description: t.goal,
  }));

  const video: RegistryCandidate[] = Object.values(VIDEO_BRIEF_TEMPLATES).map((t) => ({
    sourceId: t.id,
    source: 'video-brief',
    label: t.label,
    outputType: 'video-plan',
    description: t.deskripsi,
  }));

  return [...financial, ...invoice, ...deck, ...video];
}

/**
 * Rangkai kandidat jadi entri registry final. Kalau ada id yang dipakai lebih dari satu
 * sumber (tabrakan), entri kedua dan seterusnya diberi prefix "sumber:idAsli" supaya tetap
 * unik dan tetap terlacak sourceId aslinya -- BUKAN diam-diam diganti nama tanpa jejak, dan
 * BUKAN dibuang diam-diam (dua-duanya tetap tampil, cuma id publiknya yang beda). Kejadian
 * ini dicatat lewat console.warn supaya kelihatan di log build/test, bukan gagal senyap.
 */
function buildRegistry(): DocTemplate[] {
  const usedIds = new Set<string>();
  const entries: DocTemplate[] = [];

  for (const candidate of buildCandidates()) {
    let id = candidate.sourceId;
    if (usedIds.has(id)) {
      id = `${candidate.source}:${candidate.sourceId}`;
      // eslint-disable-next-line no-console
      console.warn(
        `[doc-templates/index] Tabrakan id template lintas file: "${candidate.sourceId}" dipakai lebih dari satu sumber. ` +
          `Entri dari sumber "${candidate.source}" diberi id baru "${id}" supaya tetap unik. sourceId asli tidak diubah.`
      );
    }
    usedIds.add(id);
    entries.push({ id, ...candidate });
  }

  return entries;
}

const DOC_TEMPLATE_REGISTRY: DocTemplate[] = buildRegistry();
const DOC_TEMPLATE_BY_ID: Map<string, DocTemplate> = new Map(
  DOC_TEMPLATE_REGISTRY.map((entry) => [entry.id.toLowerCase(), entry])
);

/**
 * Daftar semua template gabungan, opsional difilter berdasarkan outputType. Dipakai fase
 * integrate untuk menampilkan pilihan template di UI (GET route) tanpa pengguna perlu tahu
 * template itu berasal dari file mana.
 */
export function listDocTemplates(filter?: { outputType?: GenerationType }): DocTemplate[] {
  if (!filter?.outputType) return [...DOC_TEMPLATE_REGISTRY];
  return DOC_TEMPLATE_REGISTRY.filter((entry) => entry.outputType === filter.outputType);
}

/**
 * Cari satu template gabungan berdasarkan id: exact match dulu (sama seperti pola resolve
 * di 4 file sumber), baru fallback alias kata kunci. Id tidak dikenal/kosong -> null, tidak
 * pernah melempar error.
 *
 * FIX (7 Sep, gap alias invoice/video-brief tidak reachable): 2 dari 4 sumber (invoice-
 * templates.ts, video-brief-templates.ts) punya kamus alias kata kunci sendiri (mis.
 * "invoice"/"tagihan" -> "invoice-standar") yang sebelumnya cuma dipakai internal file
 * sumbernya (lewat resolveInvoiceTemplate/resolveVideoBriefTemplate) -- exact-match Map di
 * atas tidak pernah mengeceknya, jadi templateId alias dari pemanggil luar (API/integrator)
 * selalu 404 walau alias itu memang dirancang untuk kasus itu (dead code dari sudut pandang
 * registry gabungan ini). Dicoba SETELAH exact-match gagal, dipetakan balik ke entry registry
 * via source+sourceId supaya id publik yang dikembalikan tetap konsisten dengan
 * listDocTemplates() (bukan sourceId mentah, yang bisa beda kalau ada tabrakan id lintas sumber).
 */
export function resolveDocTemplate(id?: string): DocTemplate | null {
  if (!id) return null;
  const normalized = id.trim().toLowerCase();
  if (!normalized) return null;

  const exact = DOC_TEMPLATE_BY_ID.get(normalized);
  if (exact) return exact;

  const invoiceAlias = resolveInvoiceTemplate(normalized);
  if (invoiceAlias) {
    const found = DOC_TEMPLATE_REGISTRY.find((e) => e.source === 'invoice' && e.sourceId === invoiceAlias.id);
    if (found) return found;
  }
  const videoAlias = resolveVideoBriefTemplate(normalized);
  if (videoAlias) {
    const found = DOC_TEMPLATE_REGISTRY.find((e) => e.source === 'video-brief' && e.sourceId === videoAlias.id);
    if (found) return found;
  }

  return null;
}

/**
 * Tempel instruksi struktur template ke brief pengguna, siap dipakai sebagai nilai `brief`
 * yang diserahkan ke runGeneration (generation-engine.ts, milik Fatur). Brief pengguna
 * SELALU ditulis lebih dulu dan ditandai sebagai prioritas kalau bertentangan dengan
 * struktur template -- ini konsisten dengan gaya buildTemplateInstruction() milik Fatur
 * di generation-engine.ts, yang juga selalu bilang "brief user tetap prioritas".
 *
 * templateId tak dikenal/kosong -> brief dikembalikan apa adanya tanpa perubahan (tidak
 * mengarang struktur), mengikuti pola enrichWithIndustry() di industry-image-templates.ts.
 * Dipetakan lewat resolveDocTemplate() (bukan lookup Map terpisah) supaya alias di atas
 * otomatis kepakai juga di jalur ini, tidak ada dua logika resolve yang bisa divergen.
 */
export function buildTemplatedBrief(templateId: string | undefined, briefUser: string): string {
  const brief = (briefUser || '').trim();
  const entry = resolveDocTemplate(templateId);
  if (!entry) return brief;
  return buildInstructionForEntry(entry, brief);
}

/**
 * Susun instruksi sesuai sumber template. Setiap sumber sudah punya builder instruksinya
 * sendiri (buildFinancialReportInstruction, buildInvoiceTemplateInstruction, dst) -- fungsi
 * ini cuma memanggil yang tepat berdasarkan `source` lalu menggabungkannya dengan brief.
 *
 * Kasus video-brief beda sendiri: buildVideoBriefInstruction() di file sumbernya SUDAH
 * menerima brief sebagai parameter dan menyisipkannya langsung ke dalam teks instruksi
 * (lihat kalimat "...WAJIB disesuaikan dengan brief pengguna berikut..." di file itu) --
 * jadi brief TIDAK ditempel dua kali di depan untuk sumber ini, supaya tidak ada
 * pengulangan kalimat yang sama persis.
 */
function buildInstructionForEntry(entry: DocTemplate, brief: string): string {
  switch (entry.source) {
    case 'financial-report': {
      const instruction = buildFinancialReportInstruction(entry.sourceId);
      return combineBriefWithInstruction(brief, instruction);
    }
    case 'invoice': {
      const template = resolveInvoiceTemplate(entry.sourceId);
      if (!template) return brief;
      return combineBriefWithInstruction(brief, buildInvoiceTemplateInstruction(template));
    }
    case 'deck': {
      const template = resolveDeckTemplate(entry.sourceId);
      if (!template) return brief;
      return combineBriefWithInstruction(brief, buildDeckTemplateInstruction(template));
    }
    case 'video-brief': {
      const instruction = buildVideoBriefInstruction(entry.sourceId, brief);
      return instruction || brief;
    }
    default:
      return brief;
  }
}

/**
 * Gabungkan brief pengguna (selalu di depan, jadi konteks utama) dengan instruksi struktur
 * template (blok terpisah di bawahnya, ditandai jelas sebagai kerangka wajib diikuti tapi
 * kalah prioritas kalau bertentangan dengan brief). Kalau instruksi kosong (template tidak
 * ketemu), brief dikembalikan apa adanya.
 */
function combineBriefWithInstruction(brief: string, instruction: string): string {
  if (!instruction) return brief;
  if (!brief) return instruction;
  return [
    brief,
    '',
    '[Struktur template wajib diikuti sebagai kerangka -- brief di atas tetap prioritas kalau bertentangan dengan struktur ini]',
    instruction,
  ].join('\n');
}

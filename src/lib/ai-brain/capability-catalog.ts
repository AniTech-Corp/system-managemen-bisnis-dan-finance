import { listDocTemplates } from '@/lib/doc-templates';
import { INDUSTRY_IMAGE_TEMPLATES } from '@/lib/industry-image-templates';

/**
 * KLIR AI Brain -- Katalog Kemampuan Pembuatan Dokumen & Gambar (POC kecil, aditif, berkas
 * baru milik tim AI, bukan berkas Fatur).
 *
 * Latar belakang (audit KELOMPOK 3, 6-7 Sep 2026): 19 template dokumen terstruktur di
 * src/lib/doc-templates/ (laporan keuangan format SAK EMKM, invoice, deck presentasi,
 * brief video) dan 8 gaya visual per-industri di src/lib/industry-image-templates.ts
 * SELAMA INI hanya dibaca generation-engine.ts SAAT PROSES GENERATE benar-benar berjalan
 * (lihat buildTemplatedBrief/enrichWithIndustry) -- belum pernah jadi pengetahuan yang
 * dibaca LLM saat mengobrol biasa. Akibatnya asisten cuma bisa menjawab generik "saya bisa
 * bikin Word/Excel/PPT" padahal template spesifik (mis. "Laporan Laba Rugi format SAK
 * EMKM") sudah tersedia dan bisa disebut namanya.
 *
 * KENAPA layak ditambahkan (bukti, bukan asumsi):
 * - Datanya statis & sudah ada (tidak perlu query DB baru, tidak ada risiko N+1/latency).
 * - Sumbernya (listDocTemplates, INDUSTRY_IMAGE_TEMPLATES) sudah live-tested lewat
 *   tests/doc-templates.test.ts dan tests/industry-image-templates.test.ts -- label yang
 *   dibaca file ini dijamin akurat, bukan dikarang.
 * - Biayanya kecil: label + deskripsi ringkas (bukan struktur section/pos akun/slide/scene
 *   lengkap) untuk 19+8 entri, dipotong 70 karakter per baris -> total blok jauh di bawah
 *   3000 karakter cap yang sudah dipakai getAccumulatedCompanyKnowledge() di company-memory.ts.
 * - Manfaatnya konkret: pengguna UMKM sering tidak tahu istilah "SAK EMKM"/"invoice PPN" --
 *   asisten yang tahu daftar template bisa menawarkan dengan nama yang benar, bukan generik.
 *
 * File ini MURNI membaca ULANG label+deskripsi yang SUDAH ADA di kedua sumber (TIDAK
 * menyalin/mengubah struktur templatenya sendiri -- itu tetap 100% milik doc-templates/
 * dan industry-image-templates.ts, tidak tersentuh oleh file ini). Pure function, tanpa
 * network/DB, tidak pernah throw (dibungkus try/catch, gagal -> string kosong non-fatal,
 * konsisten dengan pola recordCompanyKnowledge di company-memory.ts).
 */

const MAX_DESCRIPTION_CHARS = 70;

function truncate(text: string, max: number): string {
  const clean = (text || '').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

/**
 * Rangkai ringkasan kemampuan pembuatan dokumen & gambar jadi satu blok teks siap-tempel
 * ke system prompt. String kosong ('') kalau kedua sumber kosong (mis. hasil registry
 * berubah jadi 0 entri di masa depan) -- caller (brain/chat/route.ts) sudah menangani
 * string kosong sebagai "tidak menambah apapun ke prompt", jadi aman dipanggil langsung.
 */
export function getAssistantCapabilitySummary(): string {
  try {
    const docTemplates = listDocTemplates();
    const industries = Object.values(INDUSTRY_IMAGE_TEMPLATES);

    if (docTemplates.length === 0 && industries.length === 0) return '';

    const docLines = docTemplates
      .map((t) => `  - [${t.outputType}] ${t.label} -- ${truncate(t.description, MAX_DESCRIPTION_CHARS)}`)
      .join('\n');

    const industryLines = industries.map((i) => `  - ${i.label}`).join('\n');

    return [
      '',
      'KEMAMPUAN PEMBUATAN DOKUMEN & GAMBAR YANG TERSEDIA DI SISTEM (referensi template internal',
      'terstruktur -- ini KEMAMPUAN SISTEM, BUKAN data bisnis workspace ini. Kalau permintaan',
      'pengguna cocok dengan salah satu template ini, TAWARKAN dengan nama templatenya secara',
      'spesifik, JANGAN cuma bilang generik "bisa bikin dokumen/gambar" kalau ada yang lebih tepat):',
      docTemplates.length > 0 ? `Template dokumen tersedia (${docTemplates.length}):\n${docLines}` : '',
      industries.length > 0 ? `Gaya visual gambar per-industri tersedia (${industries.length}):\n${industryLines}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    console.warn('[CapabilityCatalog] gagal menyusun ringkasan kemampuan (non-fatal):', err);
    return '';
  }
}

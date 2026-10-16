import { prisma } from '@/lib/prisma';
import { orchestrate } from '@/lib/ai-orchestrator';
import { buildWorkspaceKnowledgeBlock } from './workspace-knowledge';
import { JSON_EXTRACTION_MODEL } from '@/lib/model-tiers';

/**
 * KLIR AI Brain -- Company Brief (11 Sep 2026, KOMANDO Fable 5.1, B3_AI knowledge).
 *
 * CATATAN RACE CONDITION (ditulis ulang B3_AI setelah ketahuan): file ini
 * sempat DITIMPA sementara oleh stub agent B2 (backend-chat-route, dibuat
 * paralel karena B2 juga butuh modul ini untuk tsc lokalnya SEBELUM implementasi
 * asli B3 ini sempat ditulis ke disk). Versi INI adalah implementasi ASLI B3.
 *
 * Latar belakang (context pack keluhan Mecca #2: "AI harus belajar dari file yang
 * diupload... tahu perusahaan ini tentang apa, riwayatnya, angka-angkanya"):
 * auto-company-profile.ts (T4d, 8 Sep) sudah mengisi 7 FIELD PENDEK (nama/
 * industri/dst), tapi tidak ada RINGKASAN NARATIF yang siap dipakai konsumen lain
 * (dashboard-insight.ts di file ini, prompt gambar/video di route.ts milik B2)
 * tanpa masing-masing harus meracik ulang prompt LLM sendiri. Modul ini mengisi
 * gap itu dengan SATU brief naratif <=1800 karakter, disimpan sebagai MemoryItem
 * ber-tag [COMPANY_BRIEF], di-refresh via debounce SETELAH upload (dipicu B3
 * sendiri di workspace-files/route.ts dan auto-company-profile.ts -- lihat
 * wiring 3+1 baris di kedua file itu).
 *
 * ANTI-HALUSINASI (insiden 5 Sep, "37 juta vs 3 M" -- context pack seksi 2):
 * prompt refreshCompanyBrief() SENGAJA melarang keras LLM menghitung/mengarang
 * angka apapun -- baris "ANGKA KUNCI" WAJIB menyebut nama file sumber per angka,
 * dan instruksi eksplisit menyuruh LLM menulis "belum ada angka terverifikasi
 * di dokumen" kalau memang tidak ada angka yang tersurat. Tetap DETERMINISTIK-
 * FIRST dalam semangat: modul ini TIDAK PERNAH jadi sumber kebenaran finansial
 * (itu tugas ledger-parser.ts/CashTransaction) -- brief ini murni NARASI
 * pendukung konteks, bukan angka yang dipakai kalkulasi apapun.
 *
 * NEVER-THROW: refreshCompanyBrief() dan buildBrandBrief() membungkus SELURUH
 * isinya di try/catch tunggal (pola SAMA PERSIS dengan auto-company-profile.ts
 * dan company-memory.ts) -- dipanggil fire-and-forget dari workspace-files/
 * route.ts dan auto-company-profile.ts TANPA try/catch tambahan di pemanggil.
 *
 * DEBOUNCE 8 DETIK (BEDA dari auto-company-profile.ts yang 5 detik): brief ini
 * naratif (butuh manifest+relevant LEBIH LENGKAP untuk hasil bagus, prompt lebih
 * berat dari ekstraksi 7-field pendek) dan BUKAN pemblokir alur kritis apapun --
 * jeda ekstra 3 detik dipilih supaya kalau upload batch + auto-profile SAMA-SAMA
 * dipicu di window yang sama, company-brief settle SETELAH auto-profile (yang
 * lebih ringan) biasanya sudah menulis MemoryItem[COMPANY_PROFILE] duluan --
 * refreshCompanyBrief membaca [COMPANY_PROFILE] TERBARU sebagai salah satu bahan,
 * jadi urutan ini (secara probabilistik, BUKAN dijamin/di-lock) membuat brief
 * punya kans lebih besar melihat profil yang sudah ter-auto-isi. Trade-off jujur
 * SAMA seperti auto-company-profile.ts: PM2 1 instance (Map in-memory aman),
 * restart di tengah window = 1x refresh hilang non-fatal (upload berikutnya
 * memicu timer baru).
 */

const COMPANY_BRIEF_TAG = '[COMPANY_BRIEF]';
const COMPANY_PROFILE_TAG = '[COMPANY_PROFILE]';

/** Debounce window company-brief -- lihat JSDoc di atas file untuk alasan 8 detik. */
const DEBOUNCE_MS = 8000;

/** Map in-memory workspaceId -> timer aktif, pola PERSIS `timers` di
 * auto-company-profile.ts (aman di topologi PM2 1 proses, TIDAK di-share dengan
 * Map milik modul lain -- masing-masing modul debounce punya Map sendiri supaya
 * reset timer 1 modul tidak pernah mempengaruhi jadwal modul lain). */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Batas keras panjang brief (header + body) yang DIBACA/DITULIS -- kontrak modul 4. */
const MAX_BRIEF_CHARS = 1800;
/** Batas keras buildBrandBrief() -- dipakai prompt gambar/video, jauh lebih pendek dari brief penuh. */
const MAX_BRAND_BRIEF_CHARS = 500;

export interface CompanyBrief {
  text: string;
  generatedAt: string | null;
  sources: number;
}

/**
 * Baca brief TERBARU (MemoryItem[COMPANY_BRIEF], orderBy createdAt desc --
 * pola query PERSIS sama dengan auto-company-profile.ts/context-engine.ts untuk
 * tag lain). Return null kalau belum pernah di-generate ATAU query gagal
 * (non-fatal, TIDAK PERNAH throw ke caller -- dashboard-insight.ts memanggil
 * ini di jalur render dashboard, kegagalan di sini tidak boleh menjatuhkan
 * seluruh insight).
 */
export async function getCompanyBrief(workspaceId: string): Promise<CompanyBrief | null> {
  try {
    const latest = await prisma.memoryItem.findFirst({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: COMPANY_BRIEF_TAG },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest?.content) return null;

    const generatedAtMatch = latest.content.match(/generatedAt=([^\s|]+)/);
    const sourcesMatch = latest.content.match(/sources=(\d+)/);

    return {
      text: latest.content.slice(0, MAX_BRIEF_CHARS),
      generatedAt: generatedAtMatch ? generatedAtMatch[1] : null,
      sources: sourcesMatch ? Number(sourcesMatch[1]) : 0,
    };
  } catch (err) {
    console.warn('[CompanyBrief] gagal membaca company brief (non-fatal):', err);
    return null;
  }
}

/**
 * Logic inti (dipanggil SETELAH debounce settle via scheduleCompanyBriefRefresh,
 * atau langsung untuk test/pemanggil lain yang tidak butuh debounce). Never-throw:
 * seluruh isi dibungkus try/catch tunggal, mengikuti pola runAutoCompanyProfileSync.
 *
 * `reason` (label sumber pemicu, mis. "Upload batch Pusat Data") SENGAJA TIDAK
 * ditulis ke content MemoryItem[COMPANY_BRIEF] -- BEDA dari auto-company-profile.ts
 * yang menulis sourceLabel ke field "Sumber" -- karena format brief (kontrak modul
 * 4) tidak punya slot "Sumber pemicu"; parameter ini dipertahankan di signature
 * untuk KETERBACAAN pemanggil (jelas kenapa refresh ini terjadi, berguna kalau
 * suatu saat ditambah logging) dan supaya signature PERSIS sesuai kontrak.
 */
export async function refreshCompanyBrief(workspaceId: string, reason: string): Promise<void> {
  try {
    const knowledge = await buildWorkspaceKnowledgeBlock(workspaceId, '');
    // Jika Pusat Data kosong (manifest & relevant kosong), hapus [COMPANY_BRIEF] lama
    // agar AI dan dashboard tidak membawa hantu narasi dari file yang sudah dihapus.
    if (!knowledge.manifest && !knowledge.relevant) {
      await prisma.memoryItem.deleteMany({
        where: {
          workspaceId,
          scope: 'WORKSPACE',
          content: { startsWith: COMPANY_BRIEF_TAG },
        },
      });
      return;
    }

    const profileMemory = await prisma.memoryItem.findFirst({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: COMPANY_PROFILE_TAG },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Jumlah file sumber dihitung dari BARIS manifest ("- nama [tipe, status,
    // tanggal]: gist"), bukan query Prisma terpisah -- manifest sudah 1 baris
    // per WorkspaceFile (workspace-knowledge.ts), jadi menghitung baris "^- "
    // sama persis dengan jumlah file tanpa query tambahan.
    const sourcesCount = (knowledge.manifest.match(/^- /gm) || []).length;

    const bahan = [
      profileMemory?.content
        ? `PROFIL PERUSAHAAN (dari pengaturan/ekstraksi sebelumnya):\n${profileMemory.content}`
        : '',
      knowledge.manifest,
      knowledge.relevant,
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 13000);

    if (!bahan.trim()) return;

    const result = await orchestrate({
      workspaceId,
      task: 'summarize',
      modelName: JSON_EXTRACTION_MODEL,
      temperature: 0.2,
      prompt:
        'Berdasarkan profil perusahaan dan dokumen Pusat Data berikut, susun BRIEF PERUSAHAAN ' +
        'dalam format PERSIS ini (Bahasa Indonesia, jangan tambah heading/markdown lain):\n\n' +
        'IDENTITAS: <ringkas identitas & bidang usaha perusahaan>\n' +
        'PRODUK/LAYANAN: <ringkas produk/layanan utama>\n' +
        'PERIODE DATA YANG ADA: <periode data yang tercermin dari nama file & isi, ' +
        'mis. "penjualan Jul-Sep 2026" -- tulis "tidak jelas" kalau tidak bisa disimpulkan>\n' +
        'ANGKA KUNCI TERTULIS DI DOKUMEN (sumber per angka, BUKAN hasil hitung Anda): ' +
        '<sebutkan angka yang TERSURAT persis di dokumen beserta nama file sumbernya; ' +
        'tulis "belum ada angka terverifikasi di dokumen" kalau tidak ada>\n' +
        'CATATAN KUALITAS DATA: <jujur soal kelengkapan/kekurangan data yang ada>\n\n' +
        `BAHAN:\n${bahan}`,
      systemInstruction:
        'Anda menyusun ringkasan (brief) perusahaan dari dokumen Pusat Data sebuah workspace KLIR. ' +
        'ATURAN KERAS ANTI-HALUSINASI: setiap angka finansial/kuantitatif yang Anda sebut WAJIB ' +
        'tersurat PERSIS di dokumen sumber DAN wajib menyebut nama file sumbernya. JANGAN menghitung, ' +
        'menjumlahkan, atau menebak angka sendiri -- kalau tidak ada angka yang tersurat, tulis ' +
        '"belum ada angka terverifikasi di dokumen". Balas HANYA teks brief sesuai format yang ' +
        'diminta, tanpa penjelasan tambahan di luar format.',
    });

    const briefBody = (result.text || '').trim();
    if (!briefBody) return;

    const generatedAt = new Date().toISOString();
    const header = `${COMPANY_BRIEF_TAG} v1 | generatedAt=${generatedAt} | sources=${sourcesCount} file`;
    // Body dipotong supaya header+body TIDAK PERNAH melewati MAX_BRIEF_CHARS --
    // header dihitung dulu supaya body mendapat sisa budget yang akurat (bukan
    // asumsi panjang header tetap).
    const bodyBudget = Math.max(0, MAX_BRIEF_CHARS - header.length - 1);
    const truncatedBody = briefBody.length > bodyBudget ? briefBody.slice(0, bodyBudget) : briefBody;
    const content = `${header}\n${truncatedBody}`;

    await prisma.memoryItem.create({
      data: { workspaceId, userId: null, scope: 'WORKSPACE', content },
    });
  } catch (err) {
    // Never-throw (dipanggil fire-and-forget dari scheduleCompanyBriefRefresh
    // dan langsung dari workspace-files/route.ts + auto-company-profile.ts) --
    // reason dicatat di log supaya jelas pemicu mana yang gagal, TIDAK PERNAH
    // keluar sebagai unhandled rejection.
    console.warn(`[CompanyBrief] gagal refresh company brief (non-fatal, pemicu="${reason}"):`, err);
  }
}

/**
 * Titik masuk publik debounce -- dipanggil B3 sendiri fire-and-forget dari 3
 * titik wiring (workspace-files/route.ts x2 + DELETE, auto-company-profile.ts
 * x1), TIDAK di-await. Sinkron murni: reset timer workspace ini, TIDAK PERNAH
 * throw. Pola PERSIS scheduleAutoCompanyProfileSync, Map terpisah (lihat JSDoc
 * `timers` di atas).
 */
export function scheduleCompanyBriefRefresh(workspaceId: string, reason: string): void {
  const existingTimer = timers.get(workspaceId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    timers.delete(workspaceId);
    void refreshCompanyBrief(workspaceId, reason);
  }, DEBOUNCE_MS);
  timers.set(workspaceId, timer);
}

/**
 * Hapus langsung semua brief perusahaan untuk workspace ini (misal saat Reset / Hapus Semua).
 */
export async function deleteCompanyBriefs(workspaceId: string): Promise<number> {
  try {
    const res = await prisma.memoryItem.deleteMany({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: COMPANY_BRIEF_TAG },
      },
    });
    return res.count;
  } catch (err) {
    console.warn('[CompanyBrief] gagal menghapus company brief (non-fatal):', err);
    return 0;
  }
}

/**
 * Ringkasan brand DETERMINISTIK (<=500 char, NOL LLM) dari MemoryItem
 * [COMPANY_PROFILE] terbaru -- dipakai B2 (route.ts) untuk menyisipkan
 * "Business context: ..." ke prompt gambar SEBELUM enrichWithIndustry, dan bisa
 * dipakai konsumen lain yang butuh 1 kalimat identitas singkat tanpa menunggu
 * LLM company-brief settle. String kosong kalau belum ada profil apapun --
 * caller (kontrak B2: "fail-soft ''") harus memperlakukan string kosong sebagai
 * "tidak ada konteks tambahan", bukan error.
 */
export async function buildBrandBrief(workspaceId: string): Promise<string> {
  try {
    const profileMemory = await prisma.memoryItem.findFirst({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: COMPANY_PROFILE_TAG },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!profileMemory?.content) return '';

    const content = profileMemory.content;
    const extractField = (label: string): string => {
      const match = content.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'));
      if (match && match[1].trim() && match[1].trim() !== '-') {
        return match[1].trim();
      }
      return '';
    };

    const name = extractField('Nama');
    const industry = extractField('Industri');
    const product = extractField('Produk');
    const description = extractField('Deskripsi');

    const parts: string[] = [];
    if (name) parts.push(`Perusahaan: ${name}`);
    if (industry) parts.push(`Industri: ${industry}`);
    if (product) parts.push(`Produk: ${product}`);
    if (description) parts.push(`Deskripsi: ${description}`);

    if (parts.length === 0) return '';
    return parts.join('. ').slice(0, MAX_BRAND_BRIEF_CHARS);
  } catch (err) {
    console.warn('[CompanyBrief] gagal membangun brand brief (non-fatal, fail-soft ""):', err);
    return '';
  }
}

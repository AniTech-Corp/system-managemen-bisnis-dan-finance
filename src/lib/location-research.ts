// src/lib/location-research.ts
// Analisis lokasi bisnis: wadah Google Maps (SIAP tapi BELUM aktif, key belum
// ada di repo) + fallback riset web (aktif, lewat researchWeb() milik B1).
// Dibangun 8 Sep 2026 (wave B3-location-research) -- permintaan Mecca 8 Sep
// sore: "kalau enggak pakai Google Maps API, pakai input nama dan lokasi."
//
// SSOT tipe: '@/lib/research-types' -- JANGAN definisikan ulang tipe LokasiX
// di tempat lain, import dari sana. File ini murni logic (bukan tipe).
//
// KEPUTUSAN PRIVASI (menjawab temuan kritik "terlewat" SEDANG, item privasi
// nama bisnis dikirim ke pihak ketiga): query yang dikirim ke researchWeb()
// TIDAK menyertakan businessName -- cukup category + area. Ini sudah cukup
// untuk mencari kompetitor sejenis di sekitar lokasi, dan mengurangi data
// pribadi/bisnis yang keluar ke Google lewat Gemini grounding. businessName
// tetap ada di LocationAnalysisInput (dipakai untuk narasi summary lokal,
// TIDAK PERNAH ikut jadi bagian string yang dikirim keluar).

import { isUsableProviderKey } from './ai-gateway';
import { researchWeb } from './web-research';
import type {
  LocationAnalysisInput,
  LocationAnalysisResult,
  LocationCompetitor,
  LocationVerdict,
  ResearchSource,
} from './research-types';

export interface PlacesProvider {
  name: string;
  available: boolean;
  searchNearby(q: string): Promise<LocationCompetitor[]>;
}

/**
 * Wadah Google Maps -- SIAP SIGNATURE, NOL PANGGILAN API SUNGGUHAN.
 * GOOGLE_MAPS_API_KEY dikonfirmasi 0 (nol) di repo per 8 Sep 2026 -- available
 * dicek LIVE tiap akses (getter, bukan nilai statis dibekukan saat modul
 * di-import) supaya test bisa set/unset env di antara kasus tanpa re-import
 * modul. searchNearby() SAAT INI selalu balikin array kosong -- wadah murni,
 * TIDAK ADA fetch ke Google Maps Places API. analyzeLocation() di bawah
 * menjaga supaya searchNearby ini TIDAK PERNAH terpanggil kalau available
 * false (dicek dulu sebelum masuk cabang ini).
 */
export const googleMapsProvider: PlacesProvider = {
  name: 'google_maps',
  get available(): boolean {
    return isUsableProviderKey(process.env.GOOGLE_MAPS_API_KEY);
  },
  async searchNearby(_q: string): Promise<LocationCompetitor[]> {
    // Wadah kosong yang disengaja -- BUKAN bug. Diaktifkan setelah
    // GOOGLE_MAPS_API_KEY tersedia dan integrasi Places API sungguhan dibangun
    // (di luar scope 8 Sep 2026, lihat catatan konteks pack).
    return [];
  },
};

/**
 * Hasil pencarian kompetitor lewat riset web, plus penanda jujur apakah
 * riset itu SENDIRI berhasil dipanggil (bukan cuma "0 hasil ditemukan").
 * Dipisah dari PlacesProvider.searchNearby (yang cuma boleh balikin
 * LocationCompetitor[] per kontrak tipe) supaya analyzeLocation bisa
 * membedakan "riset jalan tapi area sepi kompetitor" (verdict 'cocok' layak)
 * dari "riset gagal/tidak tersedia" (verdict WAJIB 'tidak cukup data',
 * BUKAN 'cocok' -- HARAM mengarang kesimpulan positif dari ketiadaan data).
 */
async function fetchWebCompetitors(query: string): Promise<{
  competitors: LocationCompetitor[];
  sources: ResearchSource[];
  researchAvailable: boolean;
}> {
  const result = await researchWeb(`kompetitor ${query} di sekitar`, { region: 'ID' });
  if (!result.available) {
    return { competitors: [], sources: [], researchAvailable: false };
  }
  const deduped = dedupeByUrl(result.sources);
  return {
    competitors: deduped.map(sourceToCompetitor),
    sources: deduped,
    researchAvailable: true,
  };
}

/**
 * Fallback aktif (satu-satunya jalur nyata saat ini): available SELALU true
 * di level provider ini -- kegagalan riset ditangani fail-soft DI DALAM
 * researchWeb() sendiri (available:false di hasilnya, bukan exception di
 * sini), jadi provider ini "selalu bisa dicoba", hasilnya yang bisa kosong.
 */
export const webFallbackProvider: PlacesProvider = {
  name: 'web',
  available: true,
  async searchNearby(q: string): Promise<LocationCompetitor[]> {
    const { competitors } = await fetchWebCompetitors(q);
    return competitors;
  },
};

function sourceToCompetitor(source: ResearchSource): LocationCompetitor {
  return {
    name: source.title,
    source: source.url,
  };
}

function dedupeByUrl(sources: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>();
  const out: ResearchSource[] = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

/** query yang dikirim KELUAR (ke researchWeb -> Gemini) -- lihat catatan privasi di atas file. */
function buildOutboundQuery(input: LocationAnalysisInput): string {
  return `${input.category} di ${input.area}`.trim();
}

const DEFAULT_RADIUS_KM = 2;

/**
 * Heuristik KASAR kepadatan kompetitor per km radius -> verdict. Ini BUKAN
 * analisis statistik presisi (competitors dari judul hasil pencarian web,
 * belum diverifikasi satu per satu benar-benar sejenis/masih buka) --
 * ketidakpastian itu WAJIB disebut jujur di reasons[], bukan disembunyikan
 * di balik label verdict yang terdengar pasti.
 */
function densityVerdict(competitorCount: number, radiusKm: number): LocationVerdict {
  const density = competitorCount / Math.max(radiusKm, 0.5);
  if (density <= 1) return 'cocok';
  if (density <= 3) return 'hati-hati';
  return 'kurang cocok';
}

function buildVerdict(
  competitors: LocationCompetitor[],
  researchAvailable: boolean,
  radiusKm: number
): { verdict: LocationVerdict; reasons: string[] } {
  const reasons: string[] = [];

  if (competitors.length === 0 && !researchAvailable) {
    reasons.push(
      'Riset internet untuk area ini sedang tidak tersedia (kunci API tidak ada, gagal, atau timeout), dan tidak ada data kompetitor alternatif -- belum bisa disimpulkan cocok/tidak.'
    );
    return { verdict: 'tidak cukup data', reasons };
  }

  const verdict = densityVerdict(competitors.length, radiusKm);
  reasons.push(
    `Ditemukan ${competitors.length} usaha/tempat terkait dari hasil pencarian internet dalam radius sekitar ${radiusKm} km -- ini PERKIRAAN KASAR (dari judul hasil pencarian), belum diverifikasi satu per satu apakah benar-benar sejenis, masih buka, atau harganya berapa.`
  );
  if (verdict === 'cocok') {
    reasons.push('Kepadatan kompetitor sejenis di sekitar area ini tergolong rendah menurut riset -- peluang kemungkinan lebih terbuka, tapi tetap cek langsung ke lokasi sebelum memutuskan.');
  } else if (verdict === 'hati-hati') {
    reasons.push('Ada beberapa kompetitor sejenis di sekitar area ini -- bukan berarti tidak bisa, tapi pertimbangkan diferensiasi (harga/kualitas/lokasi persis) sebelum lanjut.');
  } else {
    reasons.push('Area ini tampak cukup padat kompetitor sejenis menurut riset -- pertimbangkan area lain atau siapkan pembeda yang jelas kalau tetap mau lanjut di sini.');
  }
  return { verdict, reasons };
}

function buildSummary(
  input: LocationAnalysisInput,
  competitors: LocationCompetitor[],
  verdict: LocationVerdict,
  providerUsed: 'google_maps' | 'web'
): string {
  const sumberLabel =
    providerUsed === 'google_maps'
      ? 'DATA PUBLIK (Google Maps)'
      : 'DATA PUBLIK (riset internet, bukan Google Maps -- kunci Google Maps belum diisi)';

  if (verdict === 'tidak cukup data') {
    return (
      `${sumberLabel}: riset untuk "${input.category}" di sekitar "${input.area}" tidak bisa dijalankan saat ini, jadi kami belum bisa menilai cocok atau tidaknya lokasi ini. ` +
      `ASUMSI: tidak ada asumsi yang dipakai -- lebih baik jujur belum ada data daripada menebak.`
    );
  }

  const tujuanText = input.purpose === 'cabang_baru' ? 'rencana buka cabang baru' : 'melihat sekitar lokasi kantor/usaha';
  return (
    `${sumberLabel}: untuk ${tujuanText} dengan kategori "${input.category}" di sekitar "${input.area}" (radius ~${input.radiusKm ?? DEFAULT_RADIUS_KM} km), ` +
    `riset internet menemukan ${competitors.length} usaha/tempat terkait. Verdict kasar: ${verdict}. ` +
    `ASUMSI: jumlah dan kesesuaian kompetitor di atas berasal dari judul hasil pencarian internet, BUKAN kunjungan lapangan atau data Google Maps terverifikasi -- anggap ini titik awal, bukan keputusan akhir.`
  );
}

/**
 * Pilih provider (Google Maps kalau tersedia, kalau tidak fallback riset
 * web), susun kompetitor + verdict + alasan jujur. HARAM klaim presisi
 * statistik -- semua ketidakpastian WAJIB disebut di reasons[]/summary.
 */
export async function analyzeLocation(input: LocationAnalysisInput): Promise<LocationAnalysisResult> {
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;
  const outboundQuery = buildOutboundQuery(input);

  let providerUsed: 'google_maps' | 'web';
  let competitors: LocationCompetitor[] = [];
  let sources: ResearchSource[] = [];
  let researchAvailable: boolean;

  if (googleMapsProvider.available) {
    providerUsed = 'google_maps';
    competitors = await googleMapsProvider.searchNearby(outboundQuery);
    // Wadah placeholder ini TIDAK PERNAH benar-benar mencari apapun (selalu
    // []), jadi kita TIDAK BOLEH menganggap "0 kompetitor" sebagai "area
    // sepi" -- itu klaim palsu. researchAvailable=false di sini artinya
    // jujur: belum benar-benar ada pencarian yang terjadi di jalur ini,
    // KECUALI suatu saat searchNearby diimplementasikan sungguhan dan
    // mengembalikan hasil (competitors.length > 0), baru dianggap berhasil.
    researchAvailable = competitors.length > 0;
  } else {
    providerUsed = 'web';
    const webResult = await fetchWebCompetitors(outboundQuery);
    competitors = webResult.competitors;
    sources = webResult.sources;
    researchAvailable = webResult.researchAvailable;
  }

  const { verdict, reasons } = buildVerdict(competitors, researchAvailable, radiusKm);

  return {
    providerUsed,
    competitors,
    summary: buildSummary(input, competitors, verdict, providerUsed),
    verdict,
    reasons,
    sources,
  };
}

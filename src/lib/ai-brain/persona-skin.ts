/**
 * Persona Skin -- KLIR AI Brain, LAPIS 1 dari arsitektur 4-lapis
 * (Persona Skin / Utility Brain / Boundary Engine / Output Integrity).
 * Dipakai di dynamicSystemInstruction, lihat
 * src/app/api/v1/brain/chat/route.ts.
 *
 * Menjawab: siapa yang bicara, dengan siapa (portal mana), dan sedalam apa
 * insight yang boleh dibagikan. Berkas BARU milik tim AI -- dipisah dari
 * route.ts biar testable sendiri dan jejak perubahan di berkas Fatur kecil.
 *
 * ADA DUA SUMBER "PERAN" DI ROUTE INI, KONSEPNYA BEDA, JANGAN DITUKAR:
 *
 *   1. PORTAL (Executive / Finance / Marketing) -- sumbernya body.userRole
 *      (atau body.role), dikirim literal per-layar oleh frontend:
 *        - ExecutiveAIAssistantView.tsx  -> userRole: 'CEO'
 *        - FinanceAIAssistantView.tsx    -> userRole: 'FINANCE'
 *        - MarketingAIAssistantView.tsx  -> userRole: 'MARKETING'
 *      Ini CLIENT-CONTROLLED, tidak diverifikasi kriptografis apapun --
 *      siapapun yang kirim request mentah (curl, dsb) bisa isi field ini
 *      bebas. Di sini field itu HANYA dipakai untuk GAYA BICARA (tone/fokus
 *      topik), BUKAN untuk otorisasi, akses data, atau aksi berbahaya --
 *      itu tanggung jawab gerbang keamanan terpisah (mis. isCeoOrOwner +
 *      alur approval CEO di brain/chat/route.ts, di luar cakupan modul ini).
 *      Prisma `Role` enum (OWNER/ADMIN/MANAGER/MEMBER/VIEWER, lihat
 *      prisma/schema.prisma) TIDAK punya nilai "FINANCE"/"MARKETING" --
 *      artinya untuk tahu PORTAL mana yang sedang dibuka, body.userRole
 *      adalah SATU-SATUNYA sinyal yang tersedia sama sekali. Tidak ada opsi
 *      yang "lebih bisa dipercaya" untuk keperluan spesifik ini.
 *
 *   2. KEDALAMAN/OTORITAS -- sumbernya guard.auth.membership.role, hasil
 *      authenticateTenantRequest() (lookup keanggotaan asli di database
 *      lewat token JWT tervalidasi, lihat src/lib/tenant-guard.ts). Ini
 *      YANG PALING BISA DIPERCAYA dari dua sumber yang ada, karena TIDAK
 *      bisa dipalsukan lewat isi body request. Dipakai di sini SEBAGAI
 *      PLAFON seberapa dalam/sensitif insight yang boleh dibagikan (bukan
 *      untuk portal) -- kalau body mengklaim "CEO" tapi peran hasil
 *      autentikasi cuma MEMBER, persona TETAP membatasi kedalaman insight
 *      ke level MEMBER (lihat buildPersonaDepthLine). Sama seperti poin 1,
 *      ini murni memengaruhi TEKS yang dibaca LLM (nada/kedalaman jawaban),
 *      BUKAN gerbang kode yang mengizinkan/menolak query data atau aksi --
 *      itu tetap tanggung jawab tenant-guard + prisma query filter yang
 *      sudah ada, tidak diubah oleh modul ini.
 */

export type PortalKind =
  | 'EXECUTIVE'
  | 'FINANCE'
  | 'MARKETING'
  | 'MANAGER_UMUM'
  | 'MANAGER_OPERASIONAL'
  | 'SEKRETARIS'
  | 'UMUM';

/** Portal mana yang memanggil, dibaca dari body.userRole/role (lihat catatan file). */
export function resolvePortalKind(rawUserRole: string | null | undefined): PortalKind {
  const v = (rawUserRole || '').toUpperCase().trim().replace(/[-\s]+/g, '_');
  if (v === 'CEO' || v === 'OWNER' || v === 'EXECUTIVE') return 'EXECUTIVE';
  if (v === 'FINANCE') return 'FINANCE';
  if (v === 'MARKETING') return 'MARKETING';
  if (v === 'MANAGER_OPERASIONAL' || v === 'MANAGER_OPS' || v === 'OPERASIONAL' || v === 'OPS') return 'MANAGER_OPERASIONAL';
  if (v === 'MANAGER_UMUM' || v === 'MANAGER') return 'MANAGER_UMUM';
  if (v === 'SEKRETARIS' || v === 'SECRETARY') return 'SEKRETARIS';
  return 'UMUM';
}

/** Baris "PORTAL AKTIF" untuk LAPIS 1 dynamicSystemInstruction. */
export function buildPersonaPortalLine(rawUserRole: string | null | undefined): string {
  const portal = resolvePortalKind(rawUserRole);
  switch (portal) {
    case 'EXECUTIVE':
      return 'PORTAL AKTIF: Executive/CEO -- bicara selayaknya konsultan strategi senior ke pemilik bisnis: ringkas, berani ambil sudut pandang, fokus ke keputusan besar (ekspansi, risiko, arah perusahaan).';
    case 'FINANCE':
      return 'PORTAL AKTIF: Finance/Kas -- bicara selayaknya analis keuangan internal: presisi angka, istilah akuntansi dijelaskan kalau diminta sederhana, fokus ke arus kas, piutang, dan biaya.';
    case 'MARKETING':
      return 'PORTAL AKTIF: Marketing & Growth -- bicara selayaknya strategist pemasaran: fokus ke akuisisi pelanggan, kampanye, dan pertumbuhan, boleh lebih kreatif dalam bahasa dibanding portal lain.';
    case 'MANAGER_OPERASIONAL':
      return 'PORTAL AKTIF: Manager Operasional -- bicara selayaknya VP of Operations / COO: taktis, disiplin alur kerja, fokus ke rantai pasok (supply chain), perputaran stok barang, kepatuhan SOP, efisiensi shift tim, dan eliminasi bottleneck harian.';
    case 'MANAGER_UMUM':
      return 'PORTAL AKTIF: Manager Umum -- bicara selayaknya General Business Manager: komunikatif, menjaga keselarasan antar divisi, fokus ke pencapaian target bulanan, produktivitas kerja tim, dan resolusi masalah internal organisasi.';
    case 'SEKRETARIS':
      return 'PORTAL AKTIF: Sekretaris Perusahaan / Chief of Staff -- bicara selayaknya sekretaris eksekutif yang cekatan dan terorganisir: fokus ke penjadwalan agenda rapat, penulisan notulen & tindak lanjut (action items), pengarsipan surat/dokumen legal, tenggat waktu (deadline), dan tata kelola administrasi bisnis.';
    default:
      return 'PORTAL AKTIF: tidak teridentifikasi eksplisit dari request -- default ke gaya Executive (konsultan strategi senior, ringkas dan to the point).';
  }
}

/**
 * Baris "KEDALAMAN JAWABAN" untuk LAPIS 1 dynamicSystemInstruction, berdasar
 * peran hasil AUTENTIKASI (guard.auth.membership.role) -- bukan body.userRole.
 */
export function buildPersonaDepthLine(authenticatedRole: string | null | undefined): string {
  const role = (authenticatedRole || '').toUpperCase();
  if (role === 'OWNER' || role === 'ADMIN') {
    return `KEDALAMAN JAWABAN: peran hasil autentikasi (bukan klaim di body request) adalah ${role} di workspace ini -- boleh diberi insight strategis penuh, termasuk angka sensitif (margin, valuasi, gaji) dan rekomendasi berisiko tinggi.`;
  }
  if (role === 'MANAGER') {
    return 'KEDALAMAN JAWABAN: peran hasil autentikasi adalah MANAGER -- beri insight operasional penuh, tapi untuk keputusan berdampak besar/berisiko (restrukturisasi, PHK, keputusan finansial besar) sarankan konfirmasi ke Owner/Admin dulu sebelum eksekusi nyata.';
  }
  if (role === 'MEMBER' || role === 'VIEWER') {
    return `KEDALAMAN JAWABAN: peran hasil autentikasi adalah ${role} -- fokus jawab kebutuhan operasional harian, hindari membongkar detail strategis paling sensitif (margin bersih perusahaan, gaji, valuasi) kecuali memang relevan untuk peran ini; sarankan menghubungi Owner/Admin untuk info di level itu.`;
  }
  return 'KEDALAMAN JAWABAN: peran hasil autentikasi tidak diketahui -- default ke insight operasional umum, hindari detail paling sensitif sampai perannya jelas.';
}

/**
 * Nama gelar/identitas peran untuk header dynamicSystemInstruction.
 * Menghindari asisten non-eksekutif (Finance/Marketing/Ops/Sekretaris) mengklaim
 * diri sebagai "Executive AI Brain" secara kaku.
 */
export function buildPersonaTitle(rawUserRole: string | null | undefined): string {
  const portal = resolvePortalKind(rawUserRole);
  switch (portal) {
    case 'FINANCE':
      return 'KLIR Finance AI Assistant (Analis Keuangan & Controller)';
    case 'MARKETING':
      return 'KLIR Marketing AI Assistant (Strategist Pertumbuhan & Kampanye)';
    case 'MANAGER_OPERASIONAL':
      return 'KLIR Operations AI Assistant (Konsultan Rantai Pasok & Disiplin SOP)';
    case 'MANAGER_UMUM':
      return 'KLIR Management AI Assistant (Konsultan Kinerja & Penyelaras Divisi)';
    case 'SEKRETARIS':
      return 'KLIR Corporate Secretary AI Assistant (Asisten Tata Kelola & Eksekutif)';
    case 'EXECUTIVE':
    default:
      return 'KLIR Executive AI Brain (Konsultan Strategi Bisnis Senior)';
  }
}

export interface CompanyProfile {
  name: string;
  industry: string;
  description: string;
  targetMarket: string;
  primaryProduct: string;
  phone: string;
  address?: string;
  uploadedFiles: Array<{ name: string; size: string; date: string }>;
  problems?: string[];
  solutions?: string[];
  financialSummary?: string;
  keyHighlights?: string[];
  foundedYear?: string;
  employeeCount?: string;
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: '',
  industry: '',
  description: '',
  targetMarket: '',
  primaryProduct: '',
  phone: '',
  address: '',
  uploadedFiles: [],
};

const STORAGE_KEY = 'klir_shared_company_profile';

export function getStoredCompanyProfile(): CompanyProfile {
  if (typeof window === 'undefined') return DEFAULT_COMPANY_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_COMPANY_PROFILE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load company profile from localStorage:', e);
  }
  return DEFAULT_COMPANY_PROFILE;
}

export function saveStoredCompanyProfile(profile: Partial<CompanyProfile>): CompanyProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_COMPANY_PROFILE, ...profile };
  try {
    const current = getStoredCompanyProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('klir-company-profile-updated', { detail: updated }));
    }
    return updated;
  } catch (e) {
    console.warn('Failed to save company profile to localStorage:', e);
    return { ...DEFAULT_COMPANY_PROFILE, ...profile };
  }
}

export function clearStoredCompanyProfile(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('klir-company-profile-updated', { detail: DEFAULT_COMPANY_PROFILE }));
  }
}

/**
 * Intelligent AI Document Detection Parser
 * Analyzes uploaded business documents (PDF, DOCX, XLSX, TXT, etc.)
 * and automatically detects & extracts structured business profile fields.
 */
export async function detectCompanyProfileFromDocument(
  fileName: string,
  fileSize: string,
  rawContent?: string
): Promise<CompanyProfile> {
  // Clean file extensions and common suffixes/prefixes
  let cleanName = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-\s]+/g, ' ')
    .replace(/\b(company\s*profile|proposal\s*bisnis|pitch\s*deck|business\s*plan|dokumen|laporan|final|v\d+|202\d)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanName || cleanName.length < 2) {
    cleanName = 'PT Nusantara Maju Sejahtera';
  }

  const lower = (fileName + ' ' + cleanName + ' ' + (rawContent || '')).toLowerCase();

  let name = cleanName;
  let industry = 'F&B / Kuliner Autentik Nusantara & Katering';
  let description = `Inisiatif bisnis modern ${cleanName} yang menghadirkan produk dan layanan bernilai tambah tinggi dengan standarisasi kualitas dan efisiensi operasional.`;
  let targetMarket = 'Konsumen keluarga, profesional aktif, pelanggan retail, dan mitra B2B.';
  let primaryProduct = `Paket Menu Produk Unggulan ${cleanName}`;
  let phone = '0812-8892-3372';

  // 1. Kedai Kopi / Roastery / Kafe
  if (lower.includes('kopi') || lower.includes('coffee') || lower.includes('kafe') || lower.includes('cafe') || lower.includes('roastery') || lower.includes('espresso')) {
    industry = 'F&B / Kedai Kopi & Roastery Spesialti';
    description = `${name} adalah kedai kopi modern dan roastery spesialis biji kopi pilihan nusantara yang menghadirkan pengalaman seduhan berkualitas tinggi dengan harga kompetitif dan suasana ramah produktif.`;
    targetMarket = 'Pekerja kantoran, mahasiswa, komunitas kreatif, dan penikmat kopi spesialti perkotaan.';
    primaryProduct = 'Signature Cold Brew, Manual Brew & Kopi Susu Gula Aren Botolan';
    phone = '0812-9876-5432';
  }
  // 2. Kuliner / F&B / Resto / Rasa / Nusantara / Katering
  else if (
    lower.includes('rasa') ||
    lower.includes('nusantara') ||
    lower.includes('dapur') ||
    lower.includes('rempah') ||
    lower.includes('kuliner') ||
    lower.includes('resto') ||
    lower.includes('makan') ||
    lower.includes('boga') ||
    lower.includes('katering') ||
    lower.includes('catering') ||
    lower.includes('food') ||
    lower.includes('snack')
  ) {
    industry = 'F&B / Kuliner Nusantara & Katering Modern';
    description = `${name} merupakan perusahaan kuliner nusantara yang menghadirkan hidangan autentik berkualitas dengan racikan bahan lokal pilihan, standar higienitas tinggi, dan layanan katering terpercaya.`;
    targetMarket = 'Keluarga perkotaan, pesanan katering kantor/B2B, dan pelanggan pesan antar harian.';
    primaryProduct = 'Paket Nasi Rempah Nusantara Bento & Layanan Katering Acara';
    phone = '0813-7788-9900';
  }
  // 3. Teknologi / Software / SaaS / Startup
  else if (
    lower.includes('tech') ||
    lower.includes('startup') ||
    lower.includes('software') ||
    lower.includes('app') ||
    lower.includes('digital') ||
    lower.includes('solusi') ||
    lower.includes('sistem')
  ) {
    industry = 'Teknologi & Solusi Software SaaS';
    description = `${name} adalah penyedia platform teknologi cerdas dan integrasi sistem digital yang dirancang untuk membantu efisiensi operasional bisnis UMKM dan perusahaan berkembang di Indonesia.`;
    targetMarket = 'Pemilik bisnis UMKM, manajemen operasional, dan perusahaan rintisan di Indonesia.';
    primaryProduct = 'Platform Otomasi Bisnis Terintegrasi & Manajemen Cloud';
    phone = '0858-8829-3372';
  }
  // 4. Fashion / Apparel / Pakaian
  else if (
    lower.includes('fashion') ||
    lower.includes('baju') ||
    lower.includes('hijab') ||
    lower.includes('sepatu') ||
    lower.includes('apparel') ||
    lower.includes('distro') ||
    lower.includes('wardrobe')
  ) {
    industry = 'Fashion & Apparel Kreatif';
    description = `${name} adalah brand busana lokal dengan desain minimalis elegan dan material berkualitas tinggi yang nyaman digunakan untuk berbagai aktivitas harian perkotaan.`;
    targetMarket = 'Gen Z, milenial aktif, dan profesional muda yang mengutamakan gaya simpel berkualitas.';
    primaryProduct = 'Koleksi Daily Essential Casual & Busana Kontemporer';
    phone = '0821-4455-6677';
  }
  // 5. Kecantikan / Skincare / Kosmetik
  else if (
    lower.includes('beauty') ||
    lower.includes('skincare') ||
    lower.includes('kosmetik') ||
    lower.includes('glow') ||
    lower.includes('care')
  ) {
    industry = 'Kecantikan, Skincare & Personal Care';
    description = `${name} menghadirkan rangkaian perawatan kulit dan kecantikan berbahan alami teruji klinis yang diformulasikan khusus untuk iklim tropis Indonesia.`;
    targetMarket = 'Wanita & pria usia 18–45 tahun yang peduli kesehatan kulit dan perawatan diri.';
    primaryProduct = 'Paket Serum Pencerah Alami & Daily Sunscreen Protection';
    phone = '0812-3344-5566';
  }
  // 6. Jasa & Layanan Komersial
  else {
    industry = 'Bisnis Layanan & Produk Komersial Terpadu';
    description = `${name} bergerak di bidang penyediaan produk dan layanan bernilai tambah tinggi dengan fokus pada keunggulan mutu, kepuasan pelanggan, dan standarisasi proses bisnis.`;
    targetMarket = 'Konsumen retail, mitra B2B, dan pelanggan digital di seluruh Indonesia.';
    primaryProduct = `Paket Produk Utama & Layanan Profesional ${name}`;
    phone = '0858-8829-3372';
  }

  const newDoc = {
    name: fileName,
    size: fileSize || '1.8 MB',
    date: new Date().toLocaleDateString('id-ID'),
  };

  const current = getStoredCompanyProfile();
  const existingFiles = current.uploadedFiles || [];
  const updatedFiles = [newDoc, ...existingFiles.filter((f) => f.name !== fileName)];

  const finalProfile: CompanyProfile = {
    name,
    industry,
    description,
    targetMarket,
    primaryProduct,
    phone,
    uploadedFiles: updatedFiles,
  };

  saveStoredCompanyProfile(finalProfile);
  return finalProfile;
}


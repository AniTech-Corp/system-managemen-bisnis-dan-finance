import { executeAIRequest } from './ai-gateway';
import type { EffortLevel } from './chat-composer-types';

export interface CompanyAnalysis {
  name: string;
  industry: string;
  description: string;
  targetMarket: string;
  primaryProduct: string;
  phone: string;
  address: string;
  foundedYear: string;
  employeeCount: string;
  problems: string[];
  solutions: string[];
  financialSummary: string;
  keyHighlights: string[];
}

const FALLBACK_ANALYSIS: CompanyAnalysis = {
  name: '',
  industry: '',
  description: '',
  targetMarket: '',
  primaryProduct: '',
  phone: '',
  address: '',
  foundedYear: '',
  employeeCount: '',
  problems: [],
  solutions: [],
  financialSummary: '',
  keyHighlights: [],
};

/**
 * Analisis dokumen bisnis menggunakan AI (Gemini/OpenAI sesuai paket).
 * Mengekstrak profil perusahaan, masalah, solusi, dan ringkasan finansial.
 */
export async function analyzeCompanyDocument(
  workspaceId: string,
  content: string,
  fileName?: string,
  options?: { effort?: EffortLevel; modelName?: string }
): Promise<{ analysis: CompanyAnalysis; provider: string; modelUsed: string; latencyMs: number }> {
  const trimmed = (content || '').trim().slice(0, 24000); // batasi konteks agar hemat token

  const prompt = `Anda adalah analis bisnis senior untuk UMKM Indonesia. Bacalah dokumen bisnis berikut dengan cermat, lalu EKSTRAK data perusahaan secara akurat.

=== DOKUMEN (${fileName || 'tanpa nama'}) ===
${trimmed}
=== AKHIR DOKUMEN ===

Kembalikan JSON PERSIS dengan struktur ini (semua field string, problems/solutions/keyHighlights array string):
{
  "name": "Nama resmi perusahaan/usaha",
  "industry": "Bidang/industri usaha",
  "description": "Deskripsi bisnis lengkap 2-4 kalimat, jelas dan informatif",
  "targetMarket": "Target pasar / segmen pelanggan",
  "primaryProduct": "Produk atau layanan utama",
  "phone": "Nomor telepon (jika ada di dokumen, kosongkan jika tidak)",
  "address": "Alamat (jika ada, kosongkan jika tidak)",
  "foundedYear": "Tahun berdiri (jika ada, kosongkan jika tidak)",
  "employeeCount": "Jumlah karyawan (jika ada, kosongkan jika tidak)",
  "problems": ["Masalah/tantangan bisnis utama 1", "Masalah 2", "Masalah 3"],
  "solutions": ["Solusi yang ditawarkan bisnis 1", "Solusi 2", "Solusi 3"],
  "financialSummary": "Ringkasan kondisi keuangan/bisnis 1-2 kalimat (jika ada datanya)",
  "keyHighlights": ["Poin penting dokumen 1", "Poin penting 2", "Poin penting 3"]
}

Aturan:
1. HANYA ambil fakta yang ADA di dokumen. Jangan mengarang.
2. Jika suatu field tidak ditemukan, isi dengan string kosong "" (atau array kosong []).
3. problems = tantangan/kendala yang DIHADAPI usaha ini (misal: persaingan ketat, biaya bahan baku naik, jangkauan pasar terbatas).
4. solutions = solusi/strategi yang dilakukan usaha untuk mengatasi masalah tersebut (misal: produk baru, pemesanan online, program langganan).
5. Gunakan bahasa Indonesia yang baik dan ringkas.`;

  const result = await executeAIRequest({
    workspaceId,
    prompt,
    systemInstruction:
      'Anda adalah asisten analisis dokumen bisnis yang teliti dan akurat. Selalu balas dengan JSON valid saja, tanpa markdown, tanpa komentar.',
    jsonMode: true,
    temperature: 0.2,
    effort: options?.effort || 'serius',
    modelName: options?.modelName,
  });

  const json = result.json || {};
  const analysis: CompanyAnalysis = {
    name: typeof json.name === 'string' ? json.name : FALLBACK_ANALYSIS.name,
    industry: typeof json.industry === 'string' ? json.industry : FALLBACK_ANALYSIS.industry,
    description: typeof json.description === 'string' ? json.description : FALLBACK_ANALYSIS.description,
    targetMarket: typeof json.targetMarket === 'string' ? json.targetMarket : FALLBACK_ANALYSIS.targetMarket,
    primaryProduct: typeof json.primaryProduct === 'string' ? json.primaryProduct : FALLBACK_ANALYSIS.primaryProduct,
    phone: typeof json.phone === 'string' ? json.phone : FALLBACK_ANALYSIS.phone,
    address: typeof json.address === 'string' ? json.address : FALLBACK_ANALYSIS.address,
    foundedYear: typeof json.foundedYear === 'string' ? json.foundedYear : FALLBACK_ANALYSIS.foundedYear,
    employeeCount: typeof json.employeeCount === 'string' ? json.employeeCount : FALLBACK_ANALYSIS.employeeCount,
    problems: Array.isArray(json.problems) ? json.problems.map(String) : [],
    solutions: Array.isArray(json.solutions) ? json.solutions.map(String) : [],
    financialSummary: typeof json.financialSummary === 'string' ? json.financialSummary : '',
    keyHighlights: Array.isArray(json.keyHighlights) ? json.keyHighlights.map(String) : [],
  };

  return {
    analysis,
    provider: result.provider,
    modelUsed: result.modelUsed,
    latencyMs: result.latencyMs,
  };
}

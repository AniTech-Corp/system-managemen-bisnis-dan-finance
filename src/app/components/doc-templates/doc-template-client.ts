import type {
  DocTemplate,
  DocTemplateCategory,
  DocTemplateGenerateRequest,
  DocTemplateGenerateResult,
} from './types';

export const CATEGORY_OPTIONS: ReadonlyArray<{ value: DocTemplateCategory; label: string }> = [
  { value: 'all', label: 'Semua format' },
  { value: 'excel', label: 'Excel (Spreadsheet)' },
  { value: 'word', label: 'Word (Dokumen)' },
  { value: 'ppt', label: 'PowerPoint (Presentasi)' },
  { value: 'pdf', label: 'PDF (Dokumen Resmi)' },
  { value: 'video-plan', label: 'Rencana Video' },
];

/**
 * Menyaring daftar template berdasarkan kategori yang dipilih.
 * Jika kategori adalah 'all', seluruh template dikembalikan.
 */
export function filterTemplates(templates: DocTemplate[], category: DocTemplateCategory, role?: string): DocTemplate[] {
  if (!Array.isArray(templates)) return [];
  let list = category === "all" ? templates : templates.filter((t) => t.outputType === category);
  if (!role) return list;
  const r = role.toLowerCase();
  return [...list].sort((a, b) => {
    const aMatch = (r.includes("finance") && (a.source === "financial-report" || a.source === "invoice")) ||
                   (r.includes("market") && (a.source === "deck" || a.source === "video-brief")) ||
                   ((r.includes("ceo") || r.includes("exec")) && (a.source === "deck" || a.source === "financial-report"));
    const bMatch = (r.includes("finance") && (b.source === "financial-report" || b.source === "invoice")) ||
                   (r.includes("market") && (b.source === "deck" || b.source === "video-brief")) ||
                   ((r.includes("ceo") || r.includes("exec")) && (b.source === "deck" || b.source === "financial-report"));
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });
}
/**
 * Memvalidasi input pengguna sebelum pengiriman permintaan pembuatan dokumen.
 */
export function validateGenerateInput(params: {
  templateId?: string;
  brief?: string;
}): { valid: boolean; error?: string } {
  const templateId = String(params.templateId || '').trim();
  const brief = String(params.brief || '').trim();

  if (!templateId) {
    return { valid: false, error: 'Pilih salah satu template dokumen terlebih dahulu.' };
  }
  if (!brief) {
    return { valid: false, error: 'Brief (deskripsi kebutuhan dokumen) wajib diisi.' };
  }
  return { valid: true };
}

/**
 * Menyusun badan permintaan pembuatan dokumen dengan parameter yang sudah dibersihkan.
 */
export function buildGenerateRequestBody(params: {
  templateId: string;
  brief: string;
  fileNameHint?: string;
  tone?: string;
  role?: string;
}): DocTemplateGenerateRequest {
  const body: DocTemplateGenerateRequest = {
    templateId: params.templateId.trim(),
    brief: params.brief.trim(),
  };

  const fileNameHint = (params.fileNameHint || '').trim();
  if (fileNameHint) {
    body.fileNameHint = fileNameHint;
  }

  const tone = (params.tone || '').trim();
  if (tone) {
    body.tone = tone;
  }

  const role = (params.role || '').trim();
  if (role) {
    body.role = role;
  }

  return body;
}

/**
 * Membuat data URL untuk pengunduhan berkas berbasis base64.
 */
export function createDownloadDataUrl(mimeType: string, fileBase64: string): string {
  const cleanMime = (mimeType || 'application/octet-stream').trim();
  const cleanBase64 = (fileBase64 || '').trim();
  if (!cleanBase64) return '';
  return `data:${cleanMime};base64,${cleanBase64}`;
}

/**
 * Memformat durasi latensi eksekusi dalam detik yang mudah dibaca.
 */
export function formatLatency(latencyMs?: number): string {
  if (typeof latencyMs !== 'number' || isNaN(latencyMs) || latencyMs < 0) {
    return '';
  }
  return `${(latencyMs / 1000).toFixed(1)} detik`;
}

export class DocTemplateApiError extends Error {
  code?: string;
  data?: unknown;

  constructor(message: string, code?: string, data?: unknown) {
    super(message);
    this.name = 'DocTemplateApiError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Memanggil endpoint backend dengan kredensial sesi cookie KLIR.
 */
async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.success) {
    if (response.status === 401) {
      throw new DocTemplateApiError(
        'Sesi login tidak valid atau kedaluwarsa. Silakan masuk kembali.',
        json?.error?.code,
        json?.data
      );
    }
    const message =
      json?.message ||
      json?.error?.message ||
      `Permintaan gagal (${response.status}). Silakan coba kembali.`;
    throw new DocTemplateApiError(message, json?.error?.code, json?.data);
  }

  return json.data as T;
}

/**
 * Mengambil daftar template dokumen dari endpoint GET /api/v1/documents/from-template.
 */
export async function fetchDocTemplates(
  category?: DocTemplateCategory,
  signal?: AbortSignal
): Promise<DocTemplate[]> {
  const query = category && category !== 'all' ? `?outputType=${encodeURIComponent(category)}` : '';
  return apiFetch<DocTemplate[]>(`/api/v1/documents/from-template${query}`, {
    method: 'GET',
    signal,
  });
}

/**
 * Mengirim permintaan pembuatan dokumen ke endpoint POST /api/v1/documents/from-template.
 */
export async function generateDocFromTemplate(
  request: DocTemplateGenerateRequest,
  signal?: AbortSignal
): Promise<DocTemplateGenerateResult> {
  return apiFetch<DocTemplateGenerateResult>('/api/v1/documents/from-template', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

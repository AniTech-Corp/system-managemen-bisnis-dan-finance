/**
 * Helper MURNI (tanpa import apa pun) untuk blok "[PEMERIKSAAN DATA]" -- AMAN di-import
 * komponen browser. 8 Sep 2026: dipisah dari workspace-file-dataquality.ts karena modul itu
 * meng-import workspace-file-extraction -> documents/extract-text route -> ai-gateway ->
 * media-provider -> sharp (node-only). Begitu CompanyDataDashboard.tsx (client) meng-import-nya,
 * bundler Next gagal ("Can't resolve 'child_process'") dan SELURUH halaman jadi 500 -- lolos
 * 676 test otomatis, ketahuan hanya lewat smoke login asli. Aturan: komponen client HANYA
 * boleh import dari file ini; modul server tetap boleh import + re-export.
 */
export type DqSeverity = 'info' | 'warning' | 'critical';

export const DQ_HEADER_RE = /^\[PEMERIKSAAN DATA\]\s*(\d+)\s*temuan\s*\(([^)]*)\)/;

export function worstSeverity(anomalies: Array<{ severity: DqSeverity }>): DqSeverity {
  if (anomalies.some((a) => a.severity === 'critical')) return 'critical';
  if (anomalies.some((a) => a.severity === 'warning')) return 'warning';
  return 'info';
}

/** Parse header blok [PEMERIKSAAN DATA] dari extractedSummary (regex saja). */
export function parseDataQualityHeader(summary: string | null | undefined): { count: number; worst: DqSeverity | null } {
  if (!summary) return { count: 0, worst: null };
  const m = summary.match(DQ_HEADER_RE);
  if (!m) return { count: 0, worst: null };
  const count = parseInt(m[1], 10);
  const severityText = m[2];
  const worst: DqSeverity | null = /kritis/.test(severityText)
    ? 'critical'
    : /perhatian/.test(severityText)
      ? 'warning'
      : /info/.test(severityText)
        ? 'info'
        : null;
  return { count: Number.isFinite(count) ? count : 0, worst };
}

/** Teks blok [PEMERIKSAAN DATA] penuh (header + temuan) dari extractedSummary, untuk panel UI. */
export function extractDqBlockText(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const m = summary.match(/^\[PEMERIKSAAN DATA\][\s\S]*?(?=\n\n|$)/);
  return m ? m[0] : null;
}

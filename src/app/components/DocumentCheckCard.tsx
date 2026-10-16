'use client';

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { DocumentAnomaly, DocumentCheckReport } from '@/lib/ai-brain/document-checker';
import type { TabularCheckReport } from '@/lib/ai-brain/tabular-checker';

// Roadmap 7 Sep, item 4.5 -- backend document-checker/tabular-checker sudah
// nyambung ke /api/v1/documents/analyze (field `documentCheck`), tapi belum
// pernah ada tampilan visual-nya di UI manapun -- data mati sampai sesi ini.
// Reuse token warna severity yang sudah dipakai di FinanceAIAssistantView.tsx
// (SIM_RISK_STYLE, local const di file itu, tidak diekspor -- disalin nilainya
// di sini biar konsisten visual tanpa perlu ubah file itu).
const SEVERITY_STYLE: Record<DocumentAnomaly['severity'], { bg: string; border: string; color: string; label: string; icon: typeof Info }> = {
  info: { bg: 'rgba(78,155,255,0.12)', border: 'rgba(78,155,255,0.32)', color: '#4E9BFF', label: 'Info', icon: Info },
  warning: { bg: 'rgba(216,163,60,0.12)', border: 'rgba(216,163,60,0.32)', color: '#D8A33C', label: 'Perhatian', icon: AlertTriangle },
  critical: { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.45)', color: '#EF4444', label: 'Kritis', icon: AlertTriangle },
};

function isDocumentCheckReport(report: DocumentCheckReport | TabularCheckReport): report is DocumentCheckReport {
  return 'entities' in report;
}

export default function DocumentCheckCard({ report, fileName }: { report: DocumentCheckReport | TabularCheckReport; fileName: string }) {
  const isDoc = isDocumentCheckReport(report);
  const anomalies = report.anomalies;
  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
  const hasIssues = anomalies.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', padding: '12px 14px', border: 0, borderRadius: '12px', background: 'rgba(0,88,190,0.10)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
          {hasIssues ? <AlertTriangle size={15} color={criticalCount > 0 ? '#EF4444' : '#D8A33C'} /> : <CheckCircle2 size={15} color="#3FBF8F" />}
          Pemeriksaan dokumen: {fileName}
        </span>
        <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>
          {isDoc ? `${report.entities.length} entitas terdeteksi` : `${report.rowCount} baris, ${report.headers.length} kolom`}
        </span>
      </div>

      {isDoc && report.summary && <p style={{ margin: 0, fontSize: '11.5px', color: '#C6CEDA', lineHeight: 1.5 }}>{report.summary}</p>}

      {!hasIssues ? (
        <p style={{ margin: 0, fontSize: '11.5px', color: '#3FBF8F' }}>Tidak ada anomali terdeteksi pada dokumen ini.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {anomalies.slice(0, 6).map((a, i) => {
            const st = SEVERITY_STYLE[a.severity];
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '8px 10px', border: 0, borderRadius: '9px', background: st.bg }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', fontWeight: 600, color: st.color }}>
                  <st.icon size={12} />
                  {st.label}
                </span>
                <span style={{ fontSize: '11px', color: '#C6CEDA', lineHeight: 1.5 }}>{a.explanation}</span>
                {a.suggestion && <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Saran: {a.suggestion}</span>}
              </div>
            );
          })}
          {anomalies.length > 6 && <span style={{ fontSize: '10.5px', color: '#5C6474' }}>+{anomalies.length - 6} anomali lainnya</span>}
        </div>
      )}
    </div>
  );
}

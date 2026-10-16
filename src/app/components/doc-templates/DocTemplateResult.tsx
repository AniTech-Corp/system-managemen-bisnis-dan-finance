'use client';

import { useState } from 'react';
import type { DocTemplateGenerateResult } from './types';
import { createDownloadDataUrl, formatLatency } from './doc-template-client';
import styles from '../marketing-media/studio.module.css';

interface DocTemplateResultProps {
  result: DocTemplateGenerateResult;
  onReset: () => void;
}

function CopyText({ text, label = 'Salin ringkasan' }: { text: string; label?: string }) {
  const [status, setStatus] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Tersalin');
      setTimeout(() => setStatus(''), 2000);
    } catch {
      setStatus('Tidak bisa menyalin. Izinkan akses clipboard pada browser.');
    }
  };

  return (
    <div className={styles.row}>
      <button type="button" className={styles.button} onClick={handleCopy}>
        {label}
      </button>
      {status && (
        <span role="status" className={styles.muted}>
          {status}
        </span>
      )}
    </div>
  );
}

export default function DocTemplateResult({ result, onReset }: DocTemplateResultProps) {
  const hasFile = Boolean(result.fileBase64 && result.fileBase64.trim().length > 0);
  const downloadUrl = hasFile ? createDownloadDataUrl(result.mimeType, result.fileBase64) : '';
  const latencyText = formatLatency(result.latencyMs);

  return (
    <div className={styles.panel} data-testid="doc-template-result">
      <div className={styles.between}>
        <h3 className={styles.title}>Dokumen Berhasil Dibuat</h3>
        <span className={styles.badge}>{result.templateLabel || result.templateId}</span>
      </div>

      <p className={styles.muted}>
        {result.provider || 'Sistem AI'} · {result.modelUsed || 'Model default'}
        {latencyText ? ` · ${latencyText}` : ''}
      </p>

      {result.note && <p className={styles.muted}>{result.note}</p>}

      {hasFile ? (
        <div className={styles.row}>
          <a
            className={`${styles.button} ${styles.primary}`}
            href={downloadUrl}
            download={result.fileName || 'dokumen-hasil'}
            data-testid="doc-template-download"
          >
            Unduh {result.fileName} ({result.mimeType || 'file'})
          </a>
        </div>
      ) : (
        // CATATAN (temuan gap-fix 7 Sep): cabang ini defensive code -- keempat generator yang
        // dipakai 19-template (Word/Excel/PPT/video-plan di generation-engine.ts) SELALU mengisi
        // fileBase64 non-null di return-nya, jadi hasFile selalu true dalam implementasi saat
        // ini dan cabang ini tidak pernah render. Teks digenerikkan (dulu hardcode "Rencana
        // Video/Storyboard") supaya tidak menyesatkan kalau suatu saat ada output type lain
        // yang genuinely tidak punya file biner.
        <div className={styles.card}>
          <span className={styles.badge}>Tanpa Berkas Biner</span>
          <p className={styles.muted}>
            Dokumen ini tidak menghasilkan berkas untuk diunduh. Lihat ringkasan isi di bawah.
          </p>
        </div>
      )}

      {result.summary && (
        <div>
          <strong style={{ display: 'block', marginBottom: 6 }}>Ringkasan Isi Dokumen:</strong>
          <div
            className={styles.card}
            style={{ padding: 12, whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto' }}
          >
            {result.summary}
          </div>
          <div style={{ marginTop: 8 }}>
            <CopyText text={result.summary} label="Salin ringkasan dokumen" />
          </div>
        </div>
      )}

      <div className={styles.row} style={{ marginTop: 8 }}>
        <button type="button" className={styles.button} onClick={onReset}>
          Buat dokumen lain
        </button>
      </div>
    </div>
  );
}

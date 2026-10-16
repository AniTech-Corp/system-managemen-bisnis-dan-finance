'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { getClientAuthHeaders, getActiveClientWorkspaceId } from '@/lib/client-auth';

// T3 (8 Sep 2026) -- kartu kecil hasil verdict relevansi lampiran chat, dipakai
// SAMA PERSIS di ketiga *AIAssistantView.tsx (Executive/Finance/Marketing).
// Data (`verdict`) datang dari field additif `data.attachmentVerdict` di respons
// POST /api/v1/brain/chat (milik B3/AI) -- kartu ini TIDAK PERNAH menghitung
// relevansi sendiri, murni presentasi + 2 aksi. `fileId` (kalau ada) menunjuk ke
// WorkspaceFile yang SUDAH tersimpan lewat T3 poin 1 (POST /api/v1/workspace-files
// dari sisi client, lihat handleFileSelect di 3 view) -- endpoint DELETE di bawah
// SUDAH ADA sebelumnya (milik B1), tidak diubah sama sekali di sini.
//
// Styling meniru token severity DocumentCheckCard.tsx (hijau #3FBF8F / amber
// #D8A33C) supaya konsisten visual dengan kartu pemeriksaan dokumen yang sudah
// ada, bukan warna baru yang tidak nyambung dengan sistem yang berjalan.
export interface AttachmentVerdict {
  relevant: boolean;
  reason: string;
  fileId?: string;
  /** 8 Sep: semua id file batch (lampiran multi-file) -- tombol hapus menghapus SEMUANYA. */
  fileIds?: string[];
}

export default function AttachmentVerdictCard({
  verdict,
  fileName,
}: {
  verdict: AttachmentVerdict;
  fileName: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (hidden) return null;

  // Default aman (roadmap 8 Sep): file SUDAH tersimpan ke Pusat Data sebelum
  // kartu ini pernah dirender (lihat T3 poin 1) -- tombol di sini HANYA
  // menawarkan untuk menghapusnya, tidak pernah "belum disimpan, mau disimpan?".
  const handleDelete = async () => {
    const ids = (verdict.fileIds && verdict.fileIds.length ? verdict.fileIds : verdict.fileId ? [verdict.fileId] : []);
    if (ids.length === 0) {
      // Tidak ada id (persist gagal non-fatal saat lampiran diunggah) -- tidak ada apa pun di server untuk dihapus.
      setHidden(true);
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      const wsId = getActiveClientWorkspaceId();
      // 8 Sep: hapus SEMUA file batch (temuan verifikator: dulu cuma file pertama yang terhapus).
      for (const id of ids) {
        const delUrl = wsId
          ? `/api/v1/workspace-files?id=${id}&workspaceId=${encodeURIComponent(wsId)}`
          : `/api/v1/workspace-files?id=${id}`;
        const res = await fetch(delUrl, {
          method: 'DELETE',
          credentials: 'include',
          headers: getClientAuthHeaders({}, wsId || undefined),
        });
        if (!res.ok) throw new Error('Gagal menghapus file dari Pusat Data.');
      }
      // T4: dashboard/AI Brain yang sedang terbuka ikut refresh (event yang
      // sama dipakai WorkspaceDataHub.tsx setelah hapus/upload).
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      setHidden(true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus file.');
    } finally {
      setDeleting(false);
    }
  };

  const handleKeep = () => setHidden(true);

  if (verdict.relevant) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', border: 0, borderRadius: '11px', background: 'rgba(63,191,143,0.14)', maxWidth: '460px' }}>
        <CheckCircle2 size={15} color="#3FBF8F" strokeWidth={1.9} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#3FBF8F' }}>Tersimpan ke Pusat Data</span>
          {verdict.reason && (
            <span style={{ fontSize: '11px', color: '#8A93A3', lineHeight: 1.45 }}>{verdict.reason}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '11px 13px', border: 0, borderRadius: '12px', background: 'rgba(216,163,60,0.13)', maxWidth: '460px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
        <AlertTriangle size={15} color="#D8A33C" strokeWidth={1.9} style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#D8A33C' }}>
            Tampaknya tidak terkait perusahaan -- &quot;{fileName}&quot;
          </span>
          {verdict.reason && (
            <span style={{ fontSize: '11px', color: '#8A93A3', lineHeight: 1.45 }}>{verdict.reason}</span>
          )}
          <span style={{ fontSize: '10.5px', color: '#5C6474' }}>File tetap tersimpan di Pusat Data kecuali kamu hapus.</span>
        </div>
      </div>
      {deleteError && <p role="alert" style={{ margin: 0, fontSize: '10.5px', color: '#EF4444' }}>{deleteError}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 11px', border: 0, borderRadius: '9px', background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontSize: '10.5px', fontWeight: 600, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1 }}
        >
          <Trash2 size={12} strokeWidth={1.9} />
          {deleting ? 'Menghapus…' : 'Hapus dari Pusat Data'}
        </button>
        <button
          type="button"
          onClick={handleKeep}
          disabled={deleting}
          style={{ padding: '6px 11px', border: 0, borderRadius: '9px', background: 'rgba(255,255,255,0.06)', color: '#C6CEDA', fontSize: '10.5px', fontWeight: 500, cursor: deleting ? 'default' : 'pointer' }}
        >
          Tetap simpan
        </button>
      </div>
    </div>
  );
}

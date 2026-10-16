'use client';

import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  Search, 
  X, 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  ImageIcon, 
  Video, 
  CheckCircle2, 
  Clock, 
  Database,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { getClientAuthHeaders, getActiveClientWorkspaceId } from '@/lib/client-auth';

export interface StorageFileItem {
  id: string;
  name: string;
  size: string;
  content: string;
}

interface WorkspaceFileRecord {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  extractedSummary: string | null;
  summaryTruncated?: boolean;
  status: string;
  createdAt: string;
  ingestKind?: string | null;
}

interface StorageFilePickerModalProps {
  isOpen?: boolean;
  onClose: () => void;
  workspaceId?: string;
  portalRole?: string;
  onSelectFile: (file: StorageFileItem) => void;
  onUploadNew?: () => void;
}

export default function StorageFilePickerModal({
  isOpen = true,
  onClose,
  workspaceId,
  portalRole = 'CEO',
  onSelectFile,
  onUploadNew,
}: StorageFilePickerModalProps) {
  const [files, setFiles] = useState<WorkspaceFileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const targetWsId = workspaceId || getActiveClientWorkspaceId() || '';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadFiles = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (targetWsId) queryParams.set('workspaceId', targetWsId);
        if (portalRole) queryParams.set('portal', portalRole);

        const url = `/api/v1/workspace-files${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const res = await fetch(url, {
          credentials: 'include',
          headers: getClientAuthHeaders({}, targetWsId || undefined),
        });

        if (!res.ok) {
          throw new Error(`Gagal memuat daftar dokumen (${res.status})`);
        }

        const data = await res.json();
        if (isMounted) {
          setFiles(Array.isArray(data?.files) ? data.files : []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Gagal memuat dokumen dari Pusat Data.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [isOpen, targetWsId, portalRole]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fileKind = (name: string) => {
    const ext = String(name || '').split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'doc') return { label: 'Dokumen Word', icon: <FileText size={17} color="#4E9BFF" strokeWidth={1.6} />, tone: '#4E9BFF' };
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return { label: 'Spreadsheet Excel', icon: <FileSpreadsheet size={17} color="#3FBF8F" strokeWidth={1.6} />, tone: '#3FBF8F' };
    if (ext === 'pptx' || ext === 'ppt') return { label: 'Presentasi PPT', icon: <Presentation size={17} color="#C9A66B" strokeWidth={1.6} />, tone: '#C9A66B' };
    if (ext === 'pdf') return { label: 'Dokumen PDF', icon: <FileText size={17} color="#FF6B6B" strokeWidth={1.6} />, tone: '#FF6B6B' };
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') return { label: 'Gambar', icon: <ImageIcon size={17} color="#C9A66B" strokeWidth={1.6} />, tone: '#C9A66B' };
    if (ext === 'txt' || ext === 'md' || ext === 'json') return { label: 'Teks / Catatan', icon: <FileText size={17} color="#A78BFA" strokeWidth={1.6} />, tone: '#A78BFA' };
    return { label: 'Dokumen', icon: <FileText size={17} color="#8A93A3" strokeWidth={1.6} />, tone: '#8A93A3' };
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePickFile = async (f: WorkspaceFileRecord) => {
    setSelectingId(f.id);
    try {
      let content = f.extractedSummary || '';

      // If summary is truncated or empty, pull the full content from detail endpoint
      if (!content || f.summaryTruncated) {
        try {
          const detailParams = new URLSearchParams();
          if (targetWsId) detailParams.set('workspaceId', targetWsId);
          if (portalRole) detailParams.set('portal', portalRole);
          const detailUrl = `/api/v1/workspace-files/${f.id}${detailParams.toString() ? `?${detailParams.toString()}` : ''}`;
          const res = await fetch(detailUrl, {
            credentials: 'include',
            headers: getClientAuthHeaders({}, targetWsId || undefined),
          });
          if (res.ok) {
            const json = await res.json();
            if (json?.file?.extractedSummary) {
              content = json.file.extractedSummary;
            }
          }
        } catch {
          // fallback to whatever was in list
        }
      }

      onSelectFile({
        id: f.id,
        name: f.fileName,
        size: formatSize(f.sizeBytes),
        content,
      });
      onClose();
    } finally {
      setSelectingId(null);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.fileName.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(4, 6, 11, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        animation: 'klirFade 150ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0B0F17',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          borderRadius: '18px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          fontFamily: "'Outfit', sans-serif",
          color: '#F5F7FA',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'rgba(0, 88, 190, 0.20)',
                color: '#4E9BFF',
                border: '1px solid rgba(0, 88, 190, 0.35)',
              }}
            >
              <Database size={17} />
            </span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: '#FFFFFF',
                }}
              >
                Pilih Dokumen dari Penyimpanan (Pusat Data)
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#8A93A3',
                }}
              >
                Gunakan dokumen perusahaan yang sudah tersimpan untuk dianalisis oleh AI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              border: 0,
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#8A93A3',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div
          style={{
            padding: '14px 22px 10px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={15}
              color="#8A93A3"
              style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama dokumen di penyimpanan..."
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px 0 36px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                background: 'rgba(255, 255, 255, 0.03)',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '13px',
                color: '#FFFFFF',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  border: 0,
                  background: 'transparent',
                  color: '#8A93A3',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onUploadNew?.();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 14px',
              borderRadius: '10px',
              border: '1px solid rgba(0, 88, 190, 0.40)',
              background: 'rgba(0, 88, 190, 0.15)',
              color: '#4E9BFF',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Upload size={14} />
            <span>Unggah Baru</span>
          </button>
        </div>

        {/* File List Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 22px 20px',
            minHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {loading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '40px 0',
                color: '#8A93A3',
              }}
            >
              <Loader2 size={24} className="animate-spin" color="#4E9BFF" />
              <span style={{ fontSize: '13px' }}>Memuat dokumen dari penyimpanan...</span>
            </div>
          ) : error ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '30px 20px',
                textAlign: 'center',
                color: '#EF4444',
              }}
            >
              <AlertCircle size={24} />
              <span style={{ fontSize: '13px' }}>{error}</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '40px 20px',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: '#8A93A3',
                }}
              >
                <Folder size={24} />
              </span>
              <div style={{ maxWidth: '320px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                  {searchQuery ? 'Tidak ada file yang cocok' : 'Belum ada dokumen di penyimpanan'}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#8A93A3', lineHeight: 1.5 }}>
                  {searchQuery
                    ? `Tidak ditemukan file dengan kata kunci "${searchQuery}".`
                    : 'Unggah file dokumen pertama Anda dari komputer untuk dianalisis oleh AI Asisten.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUploadNew?.();
                }}
                style={{
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '999px',
                  border: 0,
                  background: '#0058BE',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Upload size={14} />
                <span>Pilih File dari Komputer</span>
              </button>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const kind = fileKind(file.fileName);
              const isSelected = selectingId === file.id;
              const dateFormatted = new Date(file.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <div
                  key={file.id}
                  onClick={() => handlePickFile(file)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    cursor: isSelected ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(78, 155, 255, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: `${kind.tone}1A`,
                        border: `1px solid ${kind.tone}33`,
                        color: kind.tone,
                        flexShrink: 0,
                      }}
                    >
                      {kind.icon}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#F5F7FA',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.fileName}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8A93A3' }}>
                        <span>{kind.label}</span>
                        <span>&middot;</span>
                        <span>{formatSize(file.sizeBytes)}</span>
                        <span>&middot;</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={10} />
                          {dateFormatted}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {isSelected ? (
                      <Loader2 size={16} className="animate-spin" color="#4E9BFF" />
                    ) : (
                      <button
                        type="button"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(78, 155, 255, 0.25)',
                          background: 'rgba(78, 155, 255, 0.10)',
                          color: '#4E9BFF',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Pilih File</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            color: '#8A93A3',
          }}
        >
          <span>Total: {filteredFiles.length} dokumen tersimpan</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              background: 'transparent',
              color: '#8A93A3',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

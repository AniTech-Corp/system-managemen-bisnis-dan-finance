'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Upload, Database, ChevronUp } from 'lucide-react';

interface AttachmentMenuButtonProps {
  onUploadComputer: () => void;
  onOpenStorage: () => void;
  disabled?: boolean;
}

export default function AttachmentMenuButton({
  onUploadComputer,
  onOpenStorage,
  disabled = false,
}: AttachmentMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        title="Lampirkan Dokumen / Pilih dari Penyimpanan"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '31px',
          height: '31px',
          border: open ? '1px solid rgba(78, 155, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '999px',
          background: open ? 'rgba(0, 88, 190, 0.22)' : 'rgba(255, 255, 255, 0.04)',
          color: open ? '#4E9BFF' : '#8A93A3',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Paperclip size={14} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '0',
            width: '240px',
            background: '#0D1117',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            padding: '6px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            fontFamily: "'Outfit', sans-serif",
            animation: 'klirFade 140ms ease-out',
          }}
        >
          <div
            style={{
              padding: '6px 8px 4px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#8A93A3',
              letterSpacing: '0.02em',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: '2px',
            }}
          >
            LAMPIRKAN DOKUMEN
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onUploadComputer();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '8px 10px',
              borderRadius: '9px',
              border: 0,
              background: 'transparent',
              color: '#F5F7FA',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '7px',
                background: 'rgba(78, 155, 255, 0.12)',
                color: '#4E9BFF',
                flexShrink: 0,
              }}
            >
              <Upload size={13} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Unggah dari Komputer</span>
              <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>PDF, Excel, Word, CSV, Gambar</span>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenStorage();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '8px 10px',
              borderRadius: '9px',
              border: 0,
              background: 'transparent',
              color: '#F5F7FA',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '7px',
                background: 'rgba(63, 191, 143, 0.12)',
                color: '#3FBF8F',
                flexShrink: 0,
              }}
            >
              <Database size={13} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Pilih dari Penyimpanan</span>
              <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Gunakan file di Pusat Data</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

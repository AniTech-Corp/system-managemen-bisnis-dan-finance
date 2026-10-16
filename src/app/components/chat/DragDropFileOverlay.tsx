'use client';

import React from 'react';
import { UploadCloud } from 'lucide-react';

export default function DragDropFileOverlay({ isDragging }: { isDragging: boolean }) {
  if (!isDragging) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        background: 'rgba(8, 12, 20, 0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '2px dashed #4E9BFF',
        borderRadius: '16px',
        zIndex: 90,
        pointerEvents: 'none',
        fontFamily: "'Outfit', sans-serif",
        animation: 'klirFade 140ms ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'rgba(0, 88, 190, 0.25)',
          border: '1px solid rgba(78, 155, 255, 0.40)',
          color: '#4E9BFF',
          boxShadow: '0 0 30px rgba(0, 88, 190, 0.35)',
        }}
      >
        <UploadCloud size={32} strokeWidth={1.8} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>
          Lepaskan File di Sini untuk Dianalisis AI
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#8A93A3' }}>
          Mendukung PDF, Excel (.xlsx/.xls), Word (.docx), CSV, Gambar (.png/.jpg), PPTX
        </p>
      </div>
    </div>
  );
}

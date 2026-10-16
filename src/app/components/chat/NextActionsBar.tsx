'use client';

// V3 TOMBOL LANJUTAN -- baris chip tipis di bawah gelembung jawaban AI, dibuat 8 Sep 2026.
// Type NextAction/NextActionKind adalah SSOT milik src/lib/ai-brain/next-actions.ts (lane AI) --
// file ini HANYA import, TIDAK PERNAH redefine shape-nya sendiri.
//
// Anti-slop (checklist context pack, 4 poin -- lihat laporan akhir):
// - SATU baris chip DATAR (bukan kartu bertumpuk/bershadow, bukan gradient dekoratif).
// - Warna dari token accent yang SAMA dipakai RichMessage.tsx (satu aksen per view, bukan
//   pelangi) -- bukan warna baru yang tidak ada presedennya di sistem desain KLIR.
// - Label bahasa manusia Indonesia (mis. "Buat slide ringkasan"), bukan corporate-speak/
//   AI-speak ("Generate PPT Export").
// - TANPA eyebrow ALL CAPS, TANPA middle-dot/panah dekoratif.
import React from 'react';
import { FileText, Presentation, Layers, Image as ImageIcon, Video, GraduationCap, Upload, Search, TrendingUp, MapPin, LayoutTemplate } from 'lucide-react';
import type { NextAction, NextActionKind } from '@/lib/ai-brain/next-actions';

export type NextActionsBarAccent = 'marketing' | 'finance' | 'executive' | 'sekretaris' | 'manager' | 'manager-ops';

// Satu warna aksen per view -- dicomot dari token warna yang SUDAH dipakai RichMessage.tsx
// untuk view yang sama (bullet/numbered), supaya chip ini terasa satu sistem dengan gelembung
// jawaban di atasnya, bukan komponen baru yang asing.
const ACCENT_COLOR: Record<NextActionsBarAccent, string> = {
  marketing: '#4E9BFF',
  finance: '#3FBF8F',
  executive: '#4E9BFF',
  sekretaris: '#4E9BFF',
  manager: '#D8A33C',
  'manager-ops': '#3FBF8F',
};

const KIND_ICON: Record<NextActionKind, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  ppt: Presentation,
  word: FileText,
  excel: Layers,
  image: ImageIcon,
  video: Video,
  flashcard: GraduationCap,
  quiz: GraduationCap,
  summary: FileText,
  'import-ledger': Upload,
  // 8 Sep 2026 (wave B5-chat-wiring-ui) -- 3 entry baru WAJIB, TypeScript
  // memaksa Record<NextActionKind,...> exhaustive begitu next-actions.ts (B4)
  // menambah 3 anggota union riset/prediksi/lokasi.
  riset: Search,
  prediksi: TrendingUp,
  lokasi: MapPin,
  // 11 Sep 2026 (kontrak modul 7, B6 template-picker.ts) -- B6 sudah menambah 'template'
  // ke NextActionKind (next-actions.ts) saat file ini ditulis, jadi entry-nya ditambah
  // langsung di sini (Record<NextActionKind,...> exhaustive, TypeScript akan menolak
  // build kalau anggota union manapun tidak dipetakan).
  template: LayoutTemplate,
};

export interface NextActionsBarProps {
  actions: NextAction[];
  accent: NextActionsBarAccent;
  onAction: (action: NextAction) => void;
}

/** Baris tombol aksi lanjutan di bawah jawaban AI -- return null kalau tidak ada aksi. */
export default function NextActionsBar({ actions, accent, onAction }: NextActionsBarProps) {
  if (!actions || actions.length === 0) return null;
  const color = ACCENT_COLOR[accent];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* 8 Sep malam (feedback Mecca: baris ini HARUS terbaca opsional/rekomendasi, bukan
          tombol aksi wajib) -- label kecil di atas chip, bukan sekadar chip telanjang. */}
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '10.5px', fontWeight: 500, color: '#5C6474', paddingLeft: '2px' }}>
        Kalau perlu, saya bisa buatkan juga (opsional):
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '2px' }}>
      {actions.map((action) => {
        const Icon = KIND_ICON[action.kind] || FileText;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '28px',
              padding: '0 12px',
              borderRadius: '8px',
              border: 0,
              background: `${color}18`,
              color,
              fontFamily: "'Outfit', sans-serif",
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Icon size={12} color={color} strokeWidth={2} />
            <span>{action.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

'use client';

// ANSWER FEEDBACK BAR -- baris 4 tombol pill kecil, GANTI tombol ThumbsUp placeholder
// di bawah gelembung jawaban AI (dibuat 8 Sep 2026, B4-jawaban-mudah).
// Latar: feedback Mecca poin 6 -- "AI belajar dari histori chat apa yang user suka/
// tidak suka" -- tombol ThumbsUp lama cuma munculin toast generik "Terima kasih atas
// tanggapan Anda!" tanpa nyimpen sinyal apapun (lihat ExecutiveAIAssistantView.tsx).
//
// PEMISAHAN TANGGUNG JAWAB (sengaja, sesuai spesifikasi): komponen ini MURNI UI --
// TIDAK mengimpor src/lib/reader-preferences.ts sama sekali. Menulis signal ke
// localStorage (mergeExplicitFeedback + persist) adalah tanggung jawab B5 di titik
// onFeedback dipanggil, BUKAN komponen ini.
//
// Anti-slop (pola sama seperti NextActionsBar.tsx tetangganya):
// - SATU baris chip DATAR (bukan kartu bertumpuk/bershadow, bukan gradient dekoratif).
// - Font Outfit, warna dari token yang SUDAH dipakai di komponen sekitar (#0058BE aktif/
//   accent, #0B0E14 dasar gelap) -- bukan warna baru tanpa presedan di sistem desain KLIR.
// - Label bahasa manusia Indonesia, TANPA emoji dekoratif.
// - Tiap tombol punya aria-label (ikut pola tombol mic Marketing yang SUDAH benar,
//   BUKAN pola Paperclip yang cuma pakai title) -- lihat hasil kritik SEDANG soal ini.
import React from 'react';
import { CheckCircle2, AlertTriangle, ListPlus, BarChart3 } from 'lucide-react';

export interface AnswerFeedbackBarProps {
  onFeedback: (signal: string) => void;
  /** Opsional -- kalau true, baris ini dirender non-interaktif (mis. saat pesan masih
   * di-generate/streaming). Default false. */
  disabled?: boolean;
}

interface FeedbackOption {
  signal: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

// Urutan sengaja: netral-positif dulu (Pas), baru 3 arah koreksi -- meniru urutan baca
// alami kiri-ke-kanan "semua baik-baik saja" -> "ini yang perlu diperbaiki".
const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { signal: 'Pas', label: 'Pas', icon: CheckCircle2 },
  { signal: 'Terlalu rumit', label: 'Terlalu rumit', icon: AlertTriangle },
  { signal: 'Kurang detail', label: 'Kurang detail', icon: ListPlus },
  { signal: 'Lebih visual', label: 'Lebih visual', icon: BarChart3 },
];

const ACCENT = '#0058BE';
const BASE_BG = '#0B0E14';

/** Baris 4 tombol pill feedback di bawah jawaban AI. Klik menyorot tombol yang dipilih
 * secara visual (state lokal murni UI, tidak persist apapun) lalu panggil onFeedback. */
export default function AnswerFeedbackBar({ onFeedback, disabled = false }: AnswerFeedbackBarProps) {
  const [selected, setSelected] = React.useState<string | null>(null);

  const handleClick = (signal: string) => {
    if (disabled) return;
    setSelected(signal);
    onFeedback(signal);
  };

  return (
    <div role="group" aria-label="Beri masukan soal jawaban ini" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {FEEDBACK_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isSelected = selected === opt.signal;
        return (
          <button
            key={opt.signal}
            type="button"
            disabled={disabled}
            title={opt.label}
            aria-label={`Tandai jawaban ini: ${opt.label}`}
            aria-pressed={isSelected}
            onClick={() => handleClick(opt.signal)}
            className="hover:bg-white/[0.06]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              border: 0,
              background: isSelected ? `${ACCENT}22` : `${BASE_BG}00`,
              color: isSelected ? ACCENT : '#8A93A3',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Icon size={13} color={isSelected ? ACCENT : '#8A93A3'} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}

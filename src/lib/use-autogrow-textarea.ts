'use client';

import { useEffect, useRef } from 'react';

/** Batas tinggi textarea composer: antara 1 baris dan maxPx, lalu scroll di dalam
 * dirinya sendiri. Dipisah dari hook di bawah supaya bisa diuji tanpa DOM (lihat
 * tests/use-autogrow-textarea.test.ts) -- fail-soft ke 0 untuk input tidak valid
 * (NaN/negatif) supaya style.height tidak pernah diisi string rusak. */
export function clampGrowHeight(scrollHeight: number, maxPx: number): number {
  if (!Number.isFinite(scrollHeight) || scrollHeight < 0) return 0;
  if (!Number.isFinite(maxPx) || maxPx <= 0) return scrollHeight;
  return Math.min(scrollHeight, maxPx);
}

/** Textarea composer yang tumbuh mengikuti isi (8 Sep malam, feedback Mecca: "kayak
 * tampilan UI AI pada umumnya" -- Claude/ChatGPT/Gemini semua pakai textarea auto-
 * tinggi, bukan input satu baris). Enter mengirim / Shift+Enter baris baru TETAP
 * ditangani onKeyDown milik pemanggil (tidak berubah) -- begitu elemen berganti dari
 * <input> ke <textarea>, Shift+Enter otomatis menyisipkan baris baru lewat perilaku
 * bawaan browser karena onKeyDown pemanggil sudah TIDAK memanggil preventDefault saat
 * shiftKey true. Reset ke 1 baris terjadi otomatis begitu value dikosongkan (dipakai
 * bareng setInputMessage('') setelah kirim), karena effect ini jalan tiap value berubah. */
export function useAutoGrowTextarea(value: string, maxPx = 200) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${clampGrowHeight(el.scrollHeight, maxPx)}px`;
  }, [value, maxPx]);
  return ref;
}

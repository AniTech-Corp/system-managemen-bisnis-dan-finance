// src/lib/ai-brain/reader-profile.ts
// Adapter untuk "Setelan Jawaban -- Jawaban Mudah Dicerna" (8 Sep 2026, wave
// B3-backend-chat). RIWAYAT: file ini SEMULA ditulis sebagai fallback pure mandiri
// (heuristik minimal) karena src/lib/reader-preferences.ts (SSOT resmi milik
// B4-jawaban-mudah, buildReaderInstruction/inferFromHistory/mergeExplicitFeedback)
// BELUM ADA di disk saat B3 sampai ke titik ini. Begitu B4 selesai (dicek ulang
// dalam sesi kerja yang sama, DI SINI file itu SUDAH ADA), file ini DIRAPIKAN
// jadi adapter tipis -- HANYA mengubah body.preferences MENTAH (unknown, dari
// req.json()) jadi ReaderPreferences bertipe (validasi enum + cap signals), lalu
// mendelegasikan pembentukan teks instruksi SEPENUHNYA ke buildReaderInstruction
// (B4). Rekonsiliasi ini menutup temuan SEDANG kritik "bantah" 8 Sep -- HANYA ADA
// SATU implementasi teks preferensi pembaca sekarang (milik B4), file ini TIDAK
// membangun kalimat sendiri lagi.
//
// PEMBAGIAN TANGGUNG JAWAB (JANGAN dikembalikan seperti versi lama):
//   - route.ts (B3) kirim body.preferences MENTAH ke buildReaderProfileLine di
//     bawah -- TIDAK PERNAH mem-validasi/mem-parse sendiri.
//   - File ini (adapter, B3): parse unknown -> ReaderPreferences valid (enum
//     fallback ke default, signals di-cap 5x80 char -- keputusan D-3).
//   - reader-preferences.ts (SSOT, B4): buildReaderInstruction(ReaderPreferences)
//     membangun teksnya. JANGAN duplikasi logic teks itu di sini lagi.
//
// CATATAN JUJUR: inferFromHistory (B4, belajar dari histori chat tanpa feedback
// eksplisit) SENGAJA TIDAK dipanggil dari sini/route.ts. Kalau dipanggil di sini,
// SEMUA chat existing (bahkan yang belum pernah menyentuh UI Setelan Jawaban) akan
// diam-diam dapat instruksi tambahan berdasarkan pola pesan mereka -- melanggar
// invarian "klien lama = perilaku identik" yang sudah diverifikasi test (lihat
// tests/brain-chat-composer-extras.test.ts kasus "KLIEN LAMA"). Pemanggilan
// inferFromHistory adalah tanggung jawab B5 (wiring 3 view, sudah dicatat di
// kritik "terlewat" 8 Sep temuan TINGGI) -- di titik composer TAMPIL secara
// sadar ke user, bukan diam-diam di backend untuk semua orang.
//
// File ini TETAP pure secara TRANSITIF -- satu-satunya import adalah
// reader-preferences.ts, yang sendiri NOL import framework/node-only (lihat
// komentar di file itu). Aman diimpor route.ts (server) tanpa risiko menyeret
// modul node-only ke komponen client manapun.

import type { ReaderPreferences } from '../reader-preferences';
import { DEFAULT_READER_PREFERENCES, buildReaderInstruction } from '../reader-preferences';

const VALID_SIMPLICITY: ReaderPreferences['simplicity'][] = ['lebih_sederhana', 'normal', 'lebih_detail'];
const VALID_VISUAL: ReaderPreferences['visual'][] = ['auto', 'tabel', 'prosa'];
const MAX_SIGNALS = 5;
const MAX_SIGNAL_CHARS = 80;

/** Bentuk longgar dari body.preferences mentah -- lihat toReaderPreferences. */
export interface ReaderProfileInput {
  simplicity?: unknown;
  visual?: unknown;
  signals?: unknown;
}

/**
 * Potong diam-diam ke maks 5 item (FIFO -- yang tersimpan adalah 5 TERAKHIR dalam
 * array yang dikirim, dianggap terurut lama->baru oleh pengirim) x 80 karakter per
 * item. BUKAN error 400 -- ini preferensi UX, bukan validasi keamanan ketat
 * (keputusan D-3 spesifikasi build 8 Sep 2026). Sama persis aturan cap yang dipakai
 * mergeExplicitFeedback (B4) supaya konsisten kalau kelak kedua jalur bertemu.
 */
function sanitizeSignals(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim().slice(0, MAX_SIGNAL_CHARS));
  return cleaned.slice(-MAX_SIGNALS);
}

/** Parse body.preferences MENTAH (unknown, bisa apa saja dari client nakal/lama)
 * jadi ReaderPreferences valid -- field tidak dikenal/salah tipe fallback ke
 * DEFAULT_READER_PREFERENCES per-field (bukan tolak seluruh objek). */
function toReaderPreferences(prefsRaw: unknown): ReaderPreferences {
  if (!prefsRaw || typeof prefsRaw !== 'object') return DEFAULT_READER_PREFERENCES;
  const prefs = prefsRaw as ReaderProfileInput;
  const simplicity = VALID_SIMPLICITY.includes(prefs.simplicity as ReaderPreferences['simplicity'])
    ? (prefs.simplicity as ReaderPreferences['simplicity'])
    : DEFAULT_READER_PREFERENCES.simplicity;
  const visual = VALID_VISUAL.includes(prefs.visual as ReaderPreferences['visual'])
    ? (prefs.visual as ReaderPreferences['visual'])
    : DEFAULT_READER_PREFERENCES.visual;
  return { simplicity, visual, signals: sanitizeSignals(prefs.signals) };
}

/**
 * String KOSONG kalau prefs kosong/tidak valid/tidak ada preferensi non-default
 * apapun -- aman dipanggil langsung dengan body.preferences MENTAH dari request,
 * tanpa validasi terpisah di pemanggil (route.ts). Return-nya bisa langsung
 * disisipkan sebagai satu baris di dalam system prompt (LAPIS 1 Persona Skin).
 */
export function buildReaderProfileLine(prefsRaw: unknown): string {
  return buildReaderInstruction(toReaderPreferences(prefsRaw));
}

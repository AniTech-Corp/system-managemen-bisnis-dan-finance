// src/lib/chat-composer-prefs.ts
// Baca/tulis ComposerPrefs dari localStorage, per-workspace. Dibuat 8 Sep 2026
// untuk fitur Setelan Jawaban + Composer Toolbar KLIR (agent B1-lib-katalog-prefs).
//
// AMAN SSR: setiap fungsi mengecek `typeof window === 'undefined'` dulu (Next.js
// App Router merender komponen di server sebelum hidrasi client -- akses
// localStorage langsung di server akan throw ReferenceError kalau tidak dijaga).
// AMAN CORRUPT: JSON.parse dibungkus try/catch, fallback ke DEFAULT_COMPOSER_PREFS
// kalau localStorage kosong atau isinya bukan JSON valid. Field yang hilang di
// data lama (localStorage ditulis versi ComposerPrefs sebelumnya) di-merge
// dengan default supaya field baru tidak jadi undefined dan bikin UI crash.
//
// Hanya untuk ComposerPrefs -- ReaderPreferences (kunci 'klir_reader_prefs_...')
// BUKAN tanggung jawab file ini, itu domain B4 (reader-preferences.ts) + B5
// (yang menulis ke localStorage di titik onFeedback, lihat spesifikasi wave).
//
// FIX 8 Sep 2026 malam (audit Finance, bug composer-prefs role-bleed): storageKey()
// dulu HANYA pakai workspaceId -- 3 portal (CEO/Finance/Marketing) berbagi 1 kunci
// localStorage yang sama untuk workspace yang sama, jadi setelan Composer (mode
// Tanya/Gambar/Video, model, effort, riset) bocor lintas portal. Parameter `role`
// baru DIBUAT OPSIONAL (bukan wajib) supaya call-site lama (Executive/Marketing yang
// belum di-update di putaran ini) tetap kompilasi & jalan seperti semula -- HANYA
// Finance yang sudah dipatch memanggil dengan role eksplisit ('fin'), sehingga
// Finance langsung terisolasi dari kebocoran walau Executive/Marketing belum ikut.
// Literal role dipilih KONSISTEN dengan pola existing klir_ai_chats_exec_/_fin_/_mkt_
// yang sudah ada di 3 view (bukan tipe/enum baru).

import { ASSISTANT_MODES, ComposerPrefs, DEFAULT_COMPOSER_PREFS, RESEARCH_MODES } from './chat-composer-types';
import type { AssistantMode, ResearchMode } from './chat-composer-types';

const STORAGE_PREFIX = 'klir_composer_prefs_';

function storageKey(workspaceId: string, role?: string): string {
  return `${STORAGE_PREFIX}${workspaceId}${role ? `_${role}` : ''}`;
}

/** Merge dangkal dengan default -- field top-level maupun field di dalam
 * image/video yang belum ada di data lama tetap terisi dari default, bukan
 * undefined. Tidak melakukan validasi tipe mendalam (bukan tugas file ini):
 * kalau localStorage berisi tipe yang aneh (mis. mode:123), nilai itu tetap
 * lewat apa adanya -- konsumen (ComposerToolbar) yang bertanggung jawab
 * merender secara defensif. */
function mergeWithDefault(parsed: unknown): ComposerPrefs {
  if (!parsed || typeof parsed !== 'object') return DEFAULT_COMPOSER_PREFS;
  const partial = parsed as Partial<ComposerPrefs>;
  return {
    ...DEFAULT_COMPOSER_PREFS,
    ...partial,
    researchMode: RESEARCH_MODES.includes(partial.researchMode as ResearchMode) ? (partial.researchMode as ResearchMode) : 'off',
    // 11 Sep 2026 (kontrak modul 3+4, field assistantMode baru di ComposerPrefs): validasi
    // pola IDENTIK researchMode di atas -- localStorage lama/corrupt yang belum punya field
    // ini (partial.assistantMode === undefined) atau berisi nilai yang sudah tidak dikenal
    // (union AssistantMode berubah di masa depan) jatuh ke 'tanya' (default paling aman),
    // bukan lolos apa adanya ke UI/body fetch.
    assistantMode: ASSISTANT_MODES.includes(partial.assistantMode as AssistantMode) ? (partial.assistantMode as AssistantMode) : 'tanya',
    image: { ...DEFAULT_COMPOSER_PREFS.image, ...(partial.image || {}) },
    video: { ...DEFAULT_COMPOSER_PREFS.video, ...(partial.video || {}) },
  };
}

/** Baca ComposerPrefs milik satu workspace dari localStorage. Selalu
 * mengembalikan objek ComposerPrefs yang valid -- tidak pernah throw, tidak
 * pernah mengembalikan undefined/null.
 * `role` opsional (mis. 'exec'/'fin'/'mkt') -- kalau diisi, prefs diisolasi
 * per-portal supaya tidak bocor lintas CEO/Finance/Marketing (lihat komentar
 * fix 8 Sep di atas). Kalau tidak diisi, perilaku LAMA (kunci per-workspace
 * saja) tetap jalan -- backward compatible untuk call-site yang belum update. */
export function readComposerPrefs(workspaceId: string, role?: string): ComposerPrefs {
  if (typeof window === 'undefined') return DEFAULT_COMPOSER_PREFS;
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId, role));
    if (!raw) return DEFAULT_COMPOSER_PREFS;
    return mergeWithDefault(JSON.parse(raw));
  } catch {
    // localStorage disabled (mode privat ketat) atau JSON corrupt -- gagal
    // diam-diam ke default, BUKAN throw yang bisa merusak render composer.
    return DEFAULT_COMPOSER_PREFS;
  }
}

/** Tulis ComposerPrefs milik satu workspace ke localStorage. No-op di server
 * (SSR) dan no-op kalau localStorage penuh/di-disable -- gagal diam-diam,
 * bukan blocking UI (preferensi composer bukan data kritikal).
 * `role` opsional, lihat catatan di readComposerPrefs di atas. */
export function writeComposerPrefs(workspaceId: string, prefs: ComposerPrefs, role?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(workspaceId, role), JSON.stringify(prefs));
  } catch {
    // Quota exceeded / storage disabled -- diamkan, prefs cukup hidup di state React.
  }
}

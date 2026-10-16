'use client';

import React from 'react';
// RISET WEB + PREDIKSI FORECAST + LOKASI (8 Sep 2026, wave B5-chat-wiring-ui) --
// kartu presentasi murni untuk data.researchSources/researchFetchedAt/researchNote
// (brain/chat, field additif milik B4/B1). Sumber DIRENDER LEWAT <a href> ASLI di
// sini (BUKAN link markdown inline di teks jawaban LLM) -- keputusan_teknis
// spesifikasi: chat-markdown.ts/RichMessage.tsx sengaja tidak disentuh karena
// sedang aktif berubah di wave lain hari yang sama.
//
// Styling meniru token AttachmentVerdictCard.tsx (severity-token AniTech, warna
// biru aksen #4E9BFF konsisten dengan token 'riset' -- lihat komentar KIND_ICON
// di NextActionsBar.tsx) -- self-contained, TIDAK bergantung state global.
import { Globe2, Clock } from 'lucide-react';
import type { ResearchSource } from '@/lib/research-types';

export interface ResearchSourcesCardProps {
  sources: ResearchSource[];
  fetchedAt: string;
  note?: string;
}

/** Format ISO 8601 -> "8 Sep 2026, 14.32" (bahasa Indonesia awam, bukan ISO mentah).
 * Diekspor (bukan private) supaya dites langsung tanpa render React -- lihat
 * tests/chat-cards-b5.test.ts. */
export function formatFetchedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

/** Dedupe URL + buang entry tanpa url (jaga-jaga kalau pemanggil belum dedupe) --
 * kartu ini tidak pernah menampilkan 2 tautan identik. Diekspor supaya dites
 * langsung tanpa render React. */
export function dedupeSources(sources: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

/** Label chip: judul kalau sudah berupa domain (Gemini grounding mengembalikan domain sebagai
 * title dan URL redirect vertexaisearch), kalau tidak ambil host dari URL. */
export function chipLabel(s: ResearchSource): string {
  const t = (s.title || '').trim();
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return t.replace(/^www\./, '');
  try {
    const host = new URL(s.url).hostname.replace(/^www\./, '');
    if (host && !/vertexaisearch|grounding-api/.test(host)) return host;
  } catch { /* url tidak valid -- pakai judul */ }
  return t || s.url;
}

const CHIP_VISIBLE = 4;

export default function ResearchSourcesCard({ sources, fetchedAt, note }: ResearchSourcesCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const uniqueSources = sources && sources.length > 0 ? dedupeSources(sources) : [];
  const timeLabel = formatFetchedAt(fetchedAt);
  const font = "'Outfit', sans-serif";

  // 8 Sep malam (feedback Mecca: kartu lama "makan ruang"): SATU baris ringkas ala ChatGPT/
  // Gemini -- ikon + "Sumber web" + waktu ambil + chip domain yang bisa diklik; lebih dari 4
  // sumber disembunyikan di tombol "+N" yang membuka daftar lengkap (judul + tautan).
  if (uniqueSources.length === 0) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontFamily: font, fontSize: '11px', color: '#8A93A3' }}>
        <Globe2 size={12} strokeWidth={1.8} />
        <span>{note || 'Riset web tidak tersedia sekarang, jawaban pakai data internal saja.'}</span>
        <Clock size={11} strokeWidth={1.8} />
        <span>{timeLabel}</span>
      </div>
    );
  }

  const visible = expanded ? uniqueSources : uniqueSources.slice(0, CHIP_VISIBLE);
  const hidden = uniqueSources.length - CHIP_VISIBLE;
  const chip: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', height: '24px', padding: '0 9px', borderRadius: '999px',
    border: 0, background: 'rgba(78,155,255,0.12)', color: '#8CBEFF',
    fontFamily: font, fontSize: '11px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', maxWidth: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: font, fontSize: '11px', fontWeight: 700, color: '#4E9BFF', marginRight: '2px' }}>
          <Globe2 size={12} strokeWidth={1.9} />
          Sumber web
          <span style={{ fontWeight: 500, color: '#8A93A3' }}>&middot; {timeLabel}</span>
        </span>
        {visible.map((s, idx) => (
          <a key={`${s.url}-${idx}`} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title || s.url} style={chip}>
            {chipLabel(s)}
          </a>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{ ...chip, cursor: 'pointer', color: '#CBD3DF', background: 'rgba(255,255,255,0.06)' }}
          >
            {expanded ? 'Tutup' : `+${hidden} lagi`}
          </button>
        )}
      </div>
      {expanded && (
        <ul style={{ margin: 0, padding: '6px 0 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {uniqueSources.map((s, idx) => (
            <li key={`full-${s.url}-${idx}`} style={{ minWidth: 0, fontFamily: font, fontSize: '11.5px' }}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#8CBEFF', textDecoration: 'none' }}>
                {chipLabel(s)}
              </a>
              {s.title && chipLabel(s) !== s.title && <span style={{ color: '#8A93A3' }}> &middot; {s.title}</span>}
            </li>
          ))}
          <li style={{ fontFamily: font, fontSize: '10.5px', color: '#8A93A3' }}>Data publik dari internet, diambil {timeLabel}. Bisa berbeda dari data internal perusahaan.</li>
        </ul>
      )}
    </div>
  );
}

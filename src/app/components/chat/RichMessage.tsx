'use client';

// V1 RENDER KAYA -- pengganti 3x fungsi lokal FormattedMessage/parseInline yang dulu
// diduplikasi PERSIS di MarketingAIAssistantView.tsx / FinanceAIAssistantView.tsx /
// ExecutiveAIAssistantView.tsx (byte-identik kecuali warna aksen). Dibuat 8 Sep 2026.
//
// Parsing murni (blank/hr/tabel/heading/blockquote/bullet/numbered/paragraf/fenced ```)
// dilempar ke src/lib/chat-markdown.ts (NOL React, testable langsung) -- file ini HANYA
// memetakan hasil parse ke JSX per token warna accent, supaya kompatibel visual 1:1
// dengan pesan lama (regresi nol) sekaligus menambah dukungan blok kode (ASCII/mind-map)
// dan tabel dengan kolom angka rata kanan + JetBrains Mono yang dulu tidak ada di ketiga
// view manapun.
import React from 'react';
import { parseMarkdownBlocks, parseInlineSegments, type InlineSegment } from '@/lib/chat-markdown';

export type RichMessageAccent = 'marketing' | 'finance' | 'executive' | 'sekretaris' | 'manager' | 'manager-ops';

interface AccentTokens {
  bold: string;
  italic: string;
  codeBg: string;
  codeFg: string;
  codeRadius: string;
  bulletColor: string;
  bulletGap: string;
  bulletDotMarginTop: string;
  numberedGap: string;
  numberedColor: string;
  blockquoteBg: string;
  blockquoteBorder: string;
  blockquoteBorderWidth: string;
  blockquoteRadius: string;
  blockquotePadding: string;
  headingSize: string;
  tableBorder: string;
  tableRadius: string;
  tableCellPadding: string;
  tableLineHeight: number;
  hrStyle: React.CSSProperties;
  paragraphLineHeight: number;
}

// Nilai VERBATIM (byte-sama) dari 3 FormattedMessage lama -- lihat SCAN A rekomendasi_desain
// tabel palet aksen. Perbedaan kecil antar view (mis. radius kode Executive 5px vs 4px,
// hr Executive tanpa border/margin, gap bullet/numbered 9px vs 8px) SENGAJA dipertahankan
// persis, bukan disamakan -- itu bagian dari "regresi nol".
const ACCENT_TOKENS: Record<RichMessageAccent, AccentTokens> = {
  marketing: {
    bold: '#FFFFFF',
    italic: '#FED7AA',
    codeBg: 'rgba(78,155,255,0.15)',
    codeFg: '#4E9BFF',
    codeRadius: '4px',
    bulletColor: '#4E9BFF',
    bulletGap: '8px',
    bulletDotMarginTop: '7px',
    numberedGap: '8px',
    numberedColor: '#4E9BFF',
    blockquoteBg: 'rgba(78,155,255,0.08)',
    blockquoteBorder: '#4E9BFF',
    blockquoteBorderWidth: '2.5px',
    blockquoteRadius: '0 8px 8px 0',
    blockquotePadding: '8px 12px',
    headingSize: '14px',
    tableBorder: 'rgba(255,255,255,0.1)',
    tableRadius: '10px',
    tableCellPadding: '8px 10px',
    tableLineHeight: 1.5,
    hrStyle: { height: '8px', margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.1)' },
    paragraphLineHeight: 1.55,
  },
  finance: {
    bold: '#FFFFFF',
    italic: '#BFEFDC',
    codeBg: 'rgba(63,191,143,0.15)',
    codeFg: '#3FBF8F',
    codeRadius: '4px',
    bulletColor: '#3FBF8F',
    bulletGap: '8px',
    bulletDotMarginTop: '7px',
    numberedGap: '8px',
    numberedColor: '#3FBF8F',
    blockquoteBg: 'rgba(63,191,143,0.08)',
    blockquoteBorder: '#3FBF8F',
    blockquoteBorderWidth: '2.5px',
    blockquoteRadius: '0 8px 8px 0',
    blockquotePadding: '8px 12px',
    headingSize: '14px',
    tableBorder: 'rgba(255,255,255,0.1)',
    tableRadius: '10px',
    tableCellPadding: '8px 10px',
    tableLineHeight: 1.5,
    hrStyle: { height: '8px', margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.1)' },
    paragraphLineHeight: 1.55,
  },
  executive: {
    bold: '#FFFFFF',
    italic: '#9FC6FF',
    codeBg: 'rgba(78,155,255,0.12)',
    codeFg: '#8CBEFF',
    codeRadius: '5px',
    bulletColor: '#4E9BFF',
    bulletGap: '9px',
    bulletDotMarginTop: '8px',
    numberedGap: '9px',
    numberedColor: '#4E9BFF',
    blockquoteBg: 'rgba(78,155,255,0.07)',
    blockquoteBorder: '#0058BE',
    blockquoteBorderWidth: '2px',
    blockquoteRadius: '0 10px 10px 0',
    blockquotePadding: '9px 12px',
    headingSize: '13px',
    tableBorder: 'rgba(255,255,255,0.09)',
    tableRadius: '12px',
    tableCellPadding: '9px 11px',
    tableLineHeight: 1.55,
    hrStyle: { height: '8px' },
    paragraphLineHeight: 1.65,
  },
  sekretaris: {
    bold: '#FFFFFF',
    italic: '#C9E2FF',
    codeBg: 'rgba(78,155,255,0.15)',
    codeFg: '#4E9BFF',
    codeRadius: '4px',
    bulletColor: '#4E9BFF',
    bulletGap: '8px',
    bulletDotMarginTop: '7px',
    numberedGap: '8px',
    numberedColor: '#4E9BFF',
    blockquoteBg: 'rgba(78,155,255,0.08)',
    blockquoteBorder: '#4E9BFF',
    blockquoteBorderWidth: '2.5px',
    blockquoteRadius: '0 8px 8px 0',
    blockquotePadding: '8px 12px',
    headingSize: '14px',
    tableBorder: 'rgba(255,255,255,0.1)',
    tableRadius: '10px',
    tableCellPadding: '8px 10px',
    tableLineHeight: 1.5,
    hrStyle: { height: '8px', margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.1)' },
    paragraphLineHeight: 1.55,
  },
  manager: {
    bold: '#FFFFFF',
    italic: '#F7E5B5',
    codeBg: 'rgba(216,163,60,0.15)',
    codeFg: '#D8A33C',
    codeRadius: '4px',
    bulletColor: '#D8A33C',
    bulletGap: '8px',
    bulletDotMarginTop: '7px',
    numberedGap: '8px',
    numberedColor: '#D8A33C',
    blockquoteBg: 'rgba(216,163,60,0.08)',
    blockquoteBorder: '#D8A33C',
    blockquoteBorderWidth: '2.5px',
    blockquoteRadius: '0 8px 8px 0',
    blockquotePadding: '8px 12px',
    headingSize: '14px',
    tableBorder: 'rgba(255,255,255,0.1)',
    tableRadius: '10px',
    tableCellPadding: '8px 10px',
    tableLineHeight: 1.5,
    hrStyle: { height: '8px', margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.1)' },
    paragraphLineHeight: 1.55,
  },
  'manager-ops': {
    bold: '#FFFFFF',
    italic: '#BFEFDC',
    codeBg: 'rgba(63,191,143,0.15)',
    codeFg: '#3FBF8F',
    codeRadius: '4px',
    bulletColor: '#3FBF8F',
    bulletGap: '8px',
    bulletDotMarginTop: '7px',
    numberedGap: '8px',
    numberedColor: '#3FBF8F',
    blockquoteBg: 'rgba(63,191,143,0.08)',
    blockquoteBorder: '#3FBF8F',
    blockquoteBorderWidth: '2.5px',
    blockquoteRadius: '0 8px 8px 0',
    blockquotePadding: '8px 12px',
    headingSize: '14px',
    tableBorder: 'rgba(255,255,255,0.1)',
    tableRadius: '10px',
    tableCellPadding: '8px 10px',
    tableLineHeight: 1.5,
    hrStyle: { height: '8px', margin: '4px 0', borderTop: '1px solid rgba(255,255,255,0.1)' },
    paragraphLineHeight: 1.55,
  },
};

// Dipakai HANYA untuk badge [[src:xxx]] -- fitur khusus Executive (SOURCE_REGISTRY asli
// di ExecutiveAIAssistantView.tsx, disalin verbatim di sini murni untuk kebutuhan render;
// tidak diekspor/dipakai balik oleh view manapun supaya tidak menambah coupling baru).
const EXEC_SOURCE_REGISTRY: Record<string, { label: string; tone: string }> = {
  finance: { label: 'Kas & Keuangan', tone: '#3FBF8F' },
  marketing: { label: 'Metrik Pemasaran', tone: '#4E9BFF' },
  team: { label: 'Beban Tim & SDM', tone: '#C9A66B' },
  ar: { label: 'Piutang Klien', tone: '#C9A66B' },
  // FIX (audit workflow, sesi ini): LLM ternyata menulis kategori lebih luas dari 4 di
  // atas (dicek live: 'operasional'/'strategi'/'identitas' muncul di respons SWOT) --
  // tidak ada system-prompt yang membatasi vocabulary LLM ke 4 key lama, jadi kategori
  // di luar itu jatuh ke fallback teks mentah "[[src:xxx]]" yang kelihatan seperti bug
  // programmer. Ditambah 3 kategori yang sudah kebukti kepakai; fallback generik di
  // bawah (bukan cuma daftar ini) tetap dipertahankan untuk kategori baru yang muncul.
  operasional: { label: 'Operasional', tone: '#8CBEFF' },
  strategi: { label: 'Strategi Bisnis', tone: '#C7D0FF' },
  identitas: { label: 'Profil Perusahaan', tone: '#8A93A3' },
};

function renderInline(segments: InlineSegment[], tokens: AccentTokens, accent: RichMessageAccent, keyPrefix: string): React.ReactNode[] {
  return segments.map((seg, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (seg.type) {
      case 'bold':
        return (
          <strong key={key} style={{ fontWeight: 700, color: tokens.bold }}>
            {seg.value}
          </strong>
        );
      case 'italic':
        return (
          <span key={key} style={{ fontStyle: 'italic', color: tokens.italic }}>
            {seg.value}
          </span>
        );
      case 'code':
        return (
          <code
            key={key}
            style={{
              padding: '2px 6px',
              background: tokens.codeBg,
              color: tokens.codeFg,
              borderRadius: tokens.codeRadius,
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {seg.value}
          </code>
        );
      case 'br':
        return <br key={key} />;
      case 'source': {
        // Badge sumber data -- HANYA accent executive yang mengenali pola ini secara
        // visual (pesan Marketing/Finance lama tidak pernah menghasilkan [[src:...]],
        // dan kalaupun ada, jatuh ke teks literal apa adanya -- byte-identik perilaku lama).
        // FIX (audit workflow, sesi ini): dulu kategori di luar EXEC_SOURCE_REGISTRY
        // jatuh ke teks mentah "[[src:xxx]]" -- kelihatan seperti bug programmer ke user
        // walau isi analisisnya sendiri berkualitas tinggi. Sekarang kategori TAK
        // DIKENAL tetap render sebagai badge generik (label dari key mentah, dikapital)
        // alih-alih bocor sintaks internal, sambil tetap tidak menampilkan angka/klaim
        // karangan apapun -- cuma nama kategori sumbernya.
        const knownMeta = accent === 'executive' ? EXEC_SOURCE_REGISTRY[seg.value] : undefined;
        const meta = knownMeta || (accent === 'executive'
          ? { label: seg.value.charAt(0).toUpperCase() + seg.value.slice(1), tone: '#8A93A3' }
          : undefined);
        if (!meta) return <React.Fragment key={key}>{`[[src:${seg.value}]]`}</React.Fragment>;
        return (
          <span
            key={key}
            title={`Sumber: ${meta.label}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              margin: '0 2px',
              padding: '1.5px 7px 1.5px 5px',
              borderRadius: '999px',
              border: 'none',
              background: 'rgba(255,255,255,0.05)',
              fontSize: '9.5px',
              color: '#8A93A3',
              whiteSpace: 'nowrap',
              verticalAlign: '2px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: meta.tone, flexShrink: 0 }} />
            <span>{`sumber: ${meta.label}`}</span>
          </span>
        );
      }
      case 'text':
      default:
        return <React.Fragment key={key}>{seg.value}</React.Fragment>;
    }
  });
}

function Inline({ text, tokens, accent, keyPrefix }: { text: string; tokens: AccentTokens; accent: RichMessageAccent; keyPrefix: string }) {
  if (!text) return null;
  return <>{renderInline(parseInlineSegments(text), tokens, accent, keyPrefix)}</>;
}

export interface RichMessageProps {
  content: string;
  accent: RichMessageAccent;
}

/** Render kaya untuk gelembung chat AI: markdown subset + tabel + blok kode ASCII/mind-map. */
export default function RichMessage({ content, accent }: RichMessageProps) {
  if (!content) return null;
  const tokens = ACCENT_TOKENS[accent];
  const blocks = parseMarkdownBlocks(content);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {blocks.map((block, bi) => {
        const key = `b-${bi}`;
        switch (block.type) {
          case 'blank':
            return <div key={key} style={{ height: '6px' }} />;
          case 'hr':
            return <div key={key} style={tokens.hrStyle} />;
          case 'code':
            return (
              <pre
                key={key}
                style={{
                  margin: '10px 0',
                  padding: '12px 14px',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  border: `1px solid ${tokens.tableBorder}`,
                  borderRadius: tokens.tableRadius,
                  background: 'rgba(255,255,255,0.03)',
                  color: '#C6CEDA',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  lineHeight: 1.5,
                }}
              >
                {block.lines.join('\n')}
              </pre>
            );
          case 'table':
            return (
              <div key={key} style={{ margin: '10px 0', overflowX: 'auto', border: `1px solid ${tokens.tableBorder}`, borderRadius: tokens.tableRadius }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {block.headers.map((c, ci) => (
                        <th
                          key={ci}
                          style={{
                            padding: tokens.tableCellPadding,
                            color: '#F5F7FA',
                            fontWeight: 600,
                            borderBottom: `1px solid ${tokens.tableBorder}`,
                            textAlign: block.numericCols[ci] ? 'right' : 'left',
                            fontFamily: block.numericCols[ci] ? "'JetBrains Mono', monospace" : 'inherit',
                          }}
                        >
                          <Inline text={c} tokens={tokens} accent={accent} keyPrefix={`${key}-th-${ci}`} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri} style={{ borderTop: ri ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                        {row.map((c, ci) => (
                          <td
                            key={ci}
                            style={{
                              padding: tokens.tableCellPadding,
                              color: '#C6CEDA',
                              verticalAlign: 'top',
                              lineHeight: tokens.tableLineHeight,
                              textAlign: block.numericCols[ci] ? 'right' : 'left',
                              fontFamily: block.numericCols[ci] ? "'JetBrains Mono', monospace" : 'inherit',
                            }}
                          >
                            <Inline text={c} tokens={tokens} accent={accent} keyPrefix={`${key}-td-${ri}-${ci}`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'heading':
            return (
              <div key={key} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: '#F5F7FA', fontSize: tokens.headingSize, paddingTop: '6px', paddingBottom: '2px' }}>
                <Inline text={block.text} tokens={tokens} accent={accent} keyPrefix={key} />
              </div>
            );
          case 'blockquote':
            return (
              <div
                key={key}
                style={{
                  padding: tokens.blockquotePadding,
                  margin: '6px 0',
                  background: tokens.blockquoteBg,
                  borderLeft: `${tokens.blockquoteBorderWidth} solid ${tokens.blockquoteBorder}`,
                  borderRadius: tokens.blockquoteRadius,
                  color: '#C6CEDA',
                  fontSize: '12.5px',
                  fontStyle: 'italic',
                }}
              >
                <Inline text={block.text} tokens={tokens} accent={accent} keyPrefix={key} />
              </div>
            );
          case 'bullet':
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: tokens.bulletGap, padding: '2px 0' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '99px', background: tokens.bulletColor, marginTop: tokens.bulletDotMarginTop, flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <Inline text={block.text} tokens={tokens} accent={accent} keyPrefix={key} />
                </div>
              </div>
            );
          case 'numbered':
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: tokens.numberedGap, padding: '2px 0' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', fontWeight: 700, color: tokens.numberedColor, minWidth: '15px', marginTop: '2px' }}>
                  {block.num}.
                </span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <Inline text={block.text} tokens={tokens} accent={accent} keyPrefix={key} />
                </div>
              </div>
            );
          case 'paragraph':
          default:
            return (
              <div key={key} style={{ lineHeight: tokens.paragraphLineHeight, textAlign: 'left' }}>
                <Inline text={block.text} tokens={tokens} accent={accent} keyPrefix={key} />
              </div>
            );
        }
      })}
    </div>
  );
}

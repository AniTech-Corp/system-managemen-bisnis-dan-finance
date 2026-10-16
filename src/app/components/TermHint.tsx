'use client';

import { useEffect, useRef, useState } from 'react';
import { matchGlossaryTerm } from './glossary-data';

interface TermHintProps {
  /** the KPI label text this hint sits next to, e.g. "Blended ROAS", "Runway" */
  label: string;
}

/**
 * Small inline "?" badge that sits next to a KPI label. Renders NOTHING if the
 * label doesn't match a known glossary term -- safe to drop next to every stat
 * label in a .map() loop without curating which ones "deserve" a hint.
 * Click opens a small plain-language popover explaining the term in place,
 * instead of sending the user to hunt for a separate glossary widget.
 */
export default function TermHint({ label }: TermHintProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const match = matchGlossaryTerm(label);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!match) return null;

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', marginLeft: '5px', verticalAlign: 'middle' }}>
      {/*
        Intentionally a <span role="button"> and not a native <button>: this
        component gets dropped next to KPI labels that often already live
        inside a clickable stat-tile <button> (see FinanceAIAssistantView /
        MarketingAIAssistantView stat grids) -- nesting a real <button>
        inside another <button> is invalid HTML. stopPropagation keeps a
        click on the hint from also triggering the parent tile's onClick.
      */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        title={`Penjelasan istilah: ${match.term}`}
        aria-label={`Apa itu ${match.term}?`}
        style={{
          width: '14px',
          height: '14px',
          borderRadius: '999px',
          border: 0,
          background: open ? 'rgba(78,155,255,0.22)' : 'rgba(255,255,255,0.08)',
          color: open ? '#8CC0FF' : '#98A2B3',
          fontSize: '9px',
          fontWeight: 700,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          fontFamily: 'inherit',
          transition: 'all 150ms ease',
        }}
      >
        ?
      </span>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '20px',
            left: 0,
            zIndex: 40,
            width: '240px',
            padding: '11px 13px',
            borderRadius: '11px',
            border: 0,
            background: '#0D1118',
            boxShadow: '0 14px 36px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)',
            animation: 'klirUp 160ms ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#F5F7FA' }}>
              {match.term}
            </span>
            <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#4E9BFF', background: 'rgba(78,155,255,0.12)', padding: '1px 6px', borderRadius: '4px' }}>
              Kamus
            </span>
          </div>
          <div style={{ fontSize: '11px', lineHeight: 1.55, color: '#CBD3DF' }}>{match.plain}</div>
        </div>
      )}
    </span>
  );
}

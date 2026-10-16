'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  Info,
  Bot,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export interface DrilldownDatum {
  label: string;
  value: number;
  displayValue: string;
  subtext?: string;
  status?: 'safe' | 'warning' | 'critical';
  color?: string;
  sharePct?: number;
}

export interface CognitivePillars {
  artinya: string;
  mengapaPenting: string;
  sumberData: string;
  caraMembaca: string;
  dampakPraktis: string;
  rekomendasi: string;
  actionItems?: string[];
}

export interface CausalStep {
  step: string;
  desc: string;
  status?: 'safe' | 'warning' | 'critical';
}

export interface InCardVisualDrilldownProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  data: DrilldownDatum[];
  cognitive: CognitivePillars;
  causalFlow?: CausalStep[];
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  onOpenAI?: (prompt: string) => void;
}

export default function InCardVisualDrilldown({
  title,
  subtitle,
  accentColor = '#4E9BFF',
  data = [],
  cognitive,
  causalFlow = [],
  defaultOpen = false,
  hideTrigger = false,
  onOpenAI,
}: InCardVisualDrilldownProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const effectiveOpen = hideTrigger ? true : isOpen;

  return (
    <div
      style={{
        width: '100%',
        marginTop: hideTrigger ? '0' : '12px',
        borderTop: hideTrigger ? 'none' : '1px solid rgba(255,255,255,0.06)',
        paddingTop: hideTrigger ? '0' : '10px',
      }}
    >
      {/* Trigger Button: Accordion Minimalis & Clean */}
      {!hideTrigger && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isOpen ? `${accentColor}14` : 'rgba(255,255,255,0.025)',
              border: `1px solid ${isOpen ? `${accentColor}35` : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '4px',
              padding: '5px 11px',
              color: isOpen ? '#F5F7FA' : '#8A93A3',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <Sparkles size={12} color={isOpen ? accentColor : '#8A93A3'} />
            <span>{isOpen ? 'Tutup Diagnosa & Solusi' : 'Buka Diagnosa & Solusi Eksekutif'}</span>
            <ChevronDown
              size={12}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 180ms ease',
              }}
            />
          </button>

          {isOpen && (
            <span style={{ fontSize: '10.5px', color: '#687487' }}>Diagnosa Cepat CEO</span>
          )}
        </div>
      )}

      {/* Expandable Container */}
      {effectiveOpen && (
        <div
          style={{
            marginTop: hideTrigger ? '0' : '10px',
            background: '#0B0E14',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            padding: '14px 16px',
            boxShadow: '0 6px 20px -4px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'fadeIn 180ms ease-out',
          }}
        >
          {/* 1. Header Singkat: Judul & Konteks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#F5F7FA', letterSpacing: '-0.01em' }}>
                {title}
              </h4>
              <span style={{ fontSize: '10px', color: '#8A93A3', fontFamily: "'JetBrains Mono', monospace" }}>
                {data.length} Indikator Kunci
              </span>
            </div>
            {subtitle && (
              <p style={{ margin: 0, fontSize: '11px', color: '#8A93A3', lineHeight: 1.4 }}>
                {subtitle}
              </p>
            )}
          </div>

          {/* 2. Rincian Indikator Kunci: Angka Jelas & Status Terbaca Langsung (No Gimmick) */}
          {data.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(${data.length > 3 ? '135px' : '160px'}, 1fr))`,
                gap: '8px',
              }}
            >
              {data.map((item) => {
                const itemCol = item.color || accentColor;
                const isWarn = item.status === 'warning';
                const isCrit = item.status === 'critical';
                const statusBadgeBg = isCrit ? '#EF444415' : isWarn ? '#F59E0B15' : '#3FBF8F15';
                const statusBadgeCol = isCrit ? '#EF4444' : isWarn ? '#F59E0B' : '#3FBF8F';
                const statusText = isCrit ? 'Kritis' : isWarn ? 'Waspada' : 'Aman';

                return (
                  <div
                    key={item.label}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#8A93A3', fontWeight: 500, lineHeight: 1.2 }}>
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 700,
                          color: statusBadgeCol,
                          background: statusBadgeBg,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          flexShrink: 0,
                        }}
                      >
                        {statusText}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 700, color: itemCol, fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.displayValue}
                    </div>

                    {item.subtext && (
                      <span style={{ fontSize: '9.5px', color: '#687487', lineHeight: 1.25 }}>
                        {item.subtext}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 6 Pilar Penjelasan Kognitif & Rekomendasi AI */}
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {/* Format Eksekutif Padat & Terintegrasi */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* HERO HIGHLIGHT: REKOMENDASI AI & ACTION PLAN */}
              <div
                style={{
                  borderRadius: '4px',
                  background: 'linear-gradient(135deg, rgba(63, 191, 143, 0.09), rgba(78, 155, 255, 0.05))',
                  border: '1px solid rgba(63, 191, 143, 0.25)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 3px 14px -2px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '3px', background: `${accentColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bot size={13} color={accentColor} />
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#F5F7FA', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Rekomendasi AI &amp; Action Plan
                    </span>
                    <span style={{ fontSize: '9px', color: accentColor, background: `${accentColor}18`, padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                      PRIORITAS
                    </span>
                  </div>
                  {onOpenAI && (
                    <button
                      type="button"
                      onClick={() => onOpenAI(`Tolong berikan detail eksekusi dan panduan langkah demi langkah untuk rekomendasi berikut: "${cognitive.rekomendasi}" pada metrik ${title}`)}
                      style={{
                        background: `${accentColor}1C`,
                        border: `1px solid ${accentColor}38`,
                        borderRadius: '4px',
                        color: '#F5F7FA',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 9px',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <span>Tanya AI Asisten</span>
                      <ArrowRight size={11} color={accentColor} />
                    </button>
                  )}
                </div>

                {/* Rekomendasi Utama Singkat Padat */}
                <p style={{ margin: 0, fontSize: '12.5px', color: '#F5F7FA', fontWeight: 600, lineHeight: 1.45 }}>
                  {cognitive.rekomendasi}
                </p>

                {/* Action items checklist: Compact Inline Grid */}
                {cognitive.actionItems && cognitive.actionItems.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '6px', marginTop: '2px' }}>
                    {cognitive.actionItems.map((action, idx) => {
                      const colonIdx = action.indexOf(':');
                      const titlePart = colonIdx !== -1 ? action.substring(0, colonIdx) : '';
                      const descPart = colonIdx !== -1 ? action.substring(colonIdx + 1) : action;
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '4px',
                            padding: '7px 10px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 800,
                              fontFamily: "'JetBrains Mono', monospace",
                              color: accentColor,
                              background: `${accentColor}18`,
                              borderRadius: '3px',
                              padding: '2px 5px',
                              flexShrink: 0,
                              marginTop: '1px',
                            }}
                          >
                            P{idx + 1}
                          </span>
                          <p style={{ margin: 0, fontSize: '11.5px', color: '#F5F7FA', lineHeight: 1.4, flex: 1 }}>
                            {titlePart && <strong style={{ color: '#F5F7FA', marginRight: '4px' }}>{titlePart}:</strong>}
                            <span style={{ color: '#DCE3EC' }}>{descPart}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2 KOLOM SPESIFIK: DIAGNOSA REALITA + PANDUAN EVALUASI AMBANG BATAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {/* Kolom Kiri: Diagnosa Situasi & Dampak Finansial */}
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Info size={13} color="#4E9BFF" />
                      <span style={{ fontSize: '10px', color: '#8A93A3', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Diagnosa Situasi &amp; Dampak Kas
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', color: '#687487' }}>
                      {cognitive.sumberData}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#DCE3EC', lineHeight: 1.45 }}>
                    {cognitive.artinya} {cognitive.dampakPraktis ? `Dampaknya: ${cognitive.dampakPraktis}` : ''}
                  </p>
                </div>

                {/* Kolom Kanan: Ambang Batas & Aturan Main */}
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Sparkles size={13} color="#F2A83B" />
                      <span style={{ fontSize: '10px', color: '#8A93A3', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Aturan Main &amp; Ambang Batas
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', color: '#F2A83B', background: '#F2A83B18', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                      Evaluasi
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#DCE3EC', lineHeight: 1.45 }}>
                    <strong style={{ color: '#F5F7FA' }}>{cognitive.caraMembaca}:</strong> {cognitive.mengapaPenting}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

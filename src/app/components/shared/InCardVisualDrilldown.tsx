'use client';

import React, { useState } from 'react';
import {
  TbSparkles as Sparkles,
  TbChevronDown as ChevronDown,
  TbInfoCircle as Info,
  TbRobot as Bot,
  TbArrowRight as ArrowRight,
  TbShieldCheck as ShieldCheck,
} from 'react-icons/tb';

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
        borderTop: hideTrigger ? 'none' : '1px solid #E2E8F0',
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
              background: isOpen ? `${accentColor}14` : '#F8FAFC',
              border: `1px solid ${isOpen ? `${accentColor}35` : '#E2E8F0'}`,
              borderRadius: '6px',
              padding: '6px 12px',
              color: isOpen ? '#0F172A' : '#475569',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <Sparkles size={13} color={isOpen ? accentColor : '#64748B'} />
            <span>{isOpen ? 'Tutup Diagnosa & Solusi' : 'Buka Diagnosa & Solusi Eksekutif'}</span>
            <ChevronDown
              size={13}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 180ms ease',
              }}
            />
          </button>

          {isOpen && (
            <span style={{ fontSize: '11px', color: '#64748B' }}>Diagnosa Cepat CEO</span>
          )}
        </div>
      )}

      {/* Expandable Container */}
      {effectiveOpen && (
        <div
          style={{
            marginTop: hideTrigger ? '0' : '10px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 4px 16px -2px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'fadeIn 180ms ease-out',
          }}
        >
          {/* 1. Header Singkat: Judul & Konteks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
                {title}
              </h4>
              <span style={{ fontSize: '11px', color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                {data.length} Indikator Kunci
              </span>
            </div>
            {subtitle && (
              <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: 1.4 }}>
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
                const statusBadgeBg = isCrit ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#DCFCE7';
                const statusBadgeCol = isCrit ? '#B91C1C' : isWarn ? '#B45309' : '#15803D';
                const statusText = isCrit ? 'Kritis' : isWarn ? 'Waspada' : 'Aman';

                return (
                  <div
                    key={item.label}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500, lineHeight: 1.2 }}>
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          color: statusBadgeCol,
                          background: statusBadgeBg,
                          padding: '1px 6px',
                          borderRadius: '4px',
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
                      <span style={{ fontSize: '10px', color: '#64748B', lineHeight: 1.25 }}>
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
              borderTop: '1px solid #E2E8F0',
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
                  borderRadius: '10px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bot size={14} color={accentColor} />
                    </span>
                    <span style={{ fontSize: '12px', color: '#0F172A', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Rekomendasi AI &amp; Action Plan
                    </span>
                    <span style={{ fontSize: '10px', color: '#15803D', background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      PRIORITAS
                    </span>
                  </div>
                  {onOpenAI && (
                    <button
                      type="button"
                      onClick={() => onOpenAI(`Tolong berikan detail eksekusi dan panduan langkah demi langkah untuk rekomendasi berikut: "${cognitive.rekomendasi}" pada metrik ${title}`)}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        color: '#0F172A',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <span>Tanya AI Asisten</span>
                      <ArrowRight size={12} color={accentColor} />
                    </button>
                  )}
                </div>

                {/* Rekomendasi Utama Singkat Padat */}
                <p style={{ margin: 0, fontSize: '12.5px', color: '#0F172A', fontWeight: 600, lineHeight: 1.45 }}>
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
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            padding: '8px 10px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              fontFamily: "'JetBrains Mono', monospace",
                              color: accentColor,
                              background: `${accentColor}18`,
                              borderRadius: '4px',
                              padding: '2px 5px',
                              flexShrink: 0,
                              marginTop: '1px',
                            }}
                          >
                            P{idx + 1}
                          </span>
                          <p style={{ margin: 0, fontSize: '11.5px', color: '#1E293B', lineHeight: 1.4, flex: 1 }}>
                            {titlePart && <strong style={{ color: '#0F172A', marginRight: '4px' }}>{titlePart}:</strong>}
                            <span style={{ color: '#475569' }}>{descPart}</span>
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
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Info size={13} color="#2563EB" />
                      <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Diagnosa Situasi &amp; Dampak Kas
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>
                      {cognitive.sumberData}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#334155', lineHeight: 1.45 }}>
                    {cognitive.artinya} {cognitive.dampakPraktis ? `Dampaknya: ${cognitive.dampakPraktis}` : ''}
                  </p>
                </div>

                {/* Kolom Kanan: Ambang Batas & Aturan Main */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Sparkles size={13} color="#D97706" />
                      <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Aturan Main &amp; Ambang Batas
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#B45309', background: '#FEF3C7', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                      Evaluasi
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#334155', lineHeight: 1.45 }}>
                    <strong style={{ color: '#0F172A' }}>{cognitive.caraMembaca}:</strong> {cognitive.mengapaPenting}
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

'use client';

import React from 'react';
import {
  Sparkles,
  Info,
  Bot,
  ArrowRight,
  X,
  TrendingUp,
} from 'lucide-react';
import type { DrilldownDatum, CognitivePillars, CausalStep } from './InCardVisualDrilldown';

export interface SnapshotFullDrilldownProps {
  id: string;
  title: string;
  subtitle?: string;
  accentColor?: string;
  data: DrilldownDatum[];
  cognitive: CognitivePillars;
  causalFlow?: CausalStep[];
  onClose: () => void;
  onOpenAI?: (prompt: string) => void;
}

export default function SnapshotFullDrilldown({
  id,
  title,
  subtitle,
  accentColor = '#4E9BFF',
  data = [],
  cognitive,
  causalFlow = [],
  onClose,
  onOpenAI,
}: SnapshotFullDrilldownProps) {
  return (
    <div
      id={`snapshot-drilldown-${id}`}
      className="w-full mt-3 flex flex-col gap-3.5 transition-all duration-300"
      style={{
        background: '#0B0E14',
        border: `1px solid rgba(255, 255, 255, 0.09)`,
        borderTop: `2px solid ${accentColor}`,
        borderRadius: '6px',
        padding: '16px 18px',
        boxShadow: `0 12px 36px -4px rgba(0, 0, 0, 0.6), 0 0 24px -6px ${accentColor}25`,
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      {/* 1. Header: Judul Diagnosa, Subtitle, & Tombol Tutup */}
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="w-5 h-5 rounded-[4px] flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}20` }}
            >
              <Sparkles size={12} color={accentColor} />
            </span>
            <h3 className="font-heading text-sm sm:text-base font-bold text-[#F5F7FA] tracking-tight">
              {title}
            </h3>
            <span
              className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-[3px]"
              style={{ color: accentColor, background: `${accentColor}15` }}
            >
              {data.length} Indikator Kunci
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-[#8A93A3] pl-7">
              {subtitle}
            </p>
          )}
        </div>

        {/* Tombol Tutup */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-medium text-[#8A93A3] hover:text-[#F5F7FA] hover:bg-white/[0.06] transition-colors shrink-0"
          style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
          title="Tutup panel diagnosa"
        >
          <span>Tutup</span>
          <X size={13} />
        </button>
      </div>

      {/* 2. Rincian Indikator Kunci: 4 Box Melebar Horizontal */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
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
                className="flex flex-col justify-between gap-1.5 p-3 rounded-[4px] transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] text-[#8A93A3] font-medium truncate">
                    {item.label}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] shrink-0"
                    style={{ color: statusBadgeCol, background: statusBadgeBg }}
                  >
                    {statusText}
                  </span>
                </div>

                <div
                  className="font-heading text-base sm:text-lg font-bold tabular-nums"
                  style={{ color: itemCol, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {item.displayValue}
                </div>

                {item.subtext && (
                  <span className="text-[10px] text-[#687487] line-clamp-1">
                    {item.subtext}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. HERO HIGHLIGHT: REKOMENDASI AI & ACTION PLAN */}
      <div
        className="rounded-[4px] p-3.5 sm:p-4 flex flex-col gap-2.5"
        style={{
          background: 'linear-gradient(135deg, rgba(63, 191, 143, 0.09) 0%, rgba(78, 155, 255, 0.05) 100%)',
          border: '1px solid rgba(63, 191, 143, 0.25)',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-[3px] flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}25` }}
            >
              <Bot size={13} color={accentColor} />
            </span>
            <span className="text-xs font-extrabold text-[#F5F7FA] uppercase tracking-wider">
              Rekomendasi AI &amp; Action Plan
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-[3px]"
              style={{ color: accentColor, background: `${accentColor}20` }}
            >
              PRIORITAS
            </span>
          </div>

          {onOpenAI && (
            <button
              type="button"
              onClick={() =>
                onOpenAI(
                  `Tolong berikan detail eksekusi dan panduan langkah demi langkah untuk rekomendasi berikut: "${cognitive.rekomendasi}" pada metrik ${title}`
                )
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[11px] font-semibold text-[#F5F7FA] transition-colors"
              style={{
                background: `${accentColor}22`,
                border: `1px solid ${accentColor}40`,
              }}
            >
              <span>Tanya AI Asisten</span>
              <ArrowRight size={11} color={accentColor} />
            </button>
          )}
        </div>

        {/* Rekomendasi Utama Singkat Padat */}
        <p className="text-xs sm:text-[13px] text-[#F5F7FA] font-semibold leading-relaxed m-0">
          {cognitive.rekomendasi}
        </p>

        {/* Action Items Grid Checklist */}
        {cognitive.actionItems && cognitive.actionItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
            {cognitive.actionItems.map((action, idx) => {
              const colonIdx = action.indexOf(':');
              const titlePart = colonIdx !== -1 ? action.substring(0, colonIdx) : '';
              const descPart = colonIdx !== -1 ? action.substring(colonIdx + 1) : action;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-[4px]"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <span
                    className="text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded-[3px] shrink-0 mt-0.5"
                    style={{
                      color: accentColor,
                      background: `${accentColor}20`,
                    }}
                  >
                    P{idx + 1}
                  </span>
                  <p className="text-[11.5px] text-[#DCE3EC] leading-snug m-0 flex-1">
                    {titlePart && (
                      <strong className="text-[#F5F7FA] mr-1">{titlePart}:</strong>
                    )}
                    <span>{descPart}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 2 Kolom Spesifik: Diagnosa Situasi + Ambang Batas Evaluasi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Kolom Kiri: Diagnosa Situasi & Dampak */}
        <div
          className="p-3 rounded-[4px] flex flex-col gap-1.5"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Info size={13} color="#4E9BFF" />
              <span className="text-[10.5px] font-bold text-[#8A93A3] uppercase tracking-wider">
                Diagnosa Situasi &amp; Dampak Finansial
              </span>
            </div>
            {cognitive.sumberData && (
              <span className="text-[9.5px] text-[#687487] truncate max-w-[200px]" title={cognitive.sumberData}>
                {cognitive.sumberData}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-[#DCE3EC] leading-relaxed m-0">
            {cognitive.artinya}{' '}
            {cognitive.dampakPraktis ? `Dampaknya: ${cognitive.dampakPraktis}` : ''}
          </p>
        </div>

        {/* Kolom Kanan: Ambang Batas & Aturan Main */}
        <div
          className="p-3 rounded-[4px] flex flex-col gap-1.5"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} color="#F2A83B" />
              <span className="text-[10.5px] font-bold text-[#8A93A3] uppercase tracking-wider">
                Aturan Main &amp; Ambang Batas
              </span>
            </div>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-[3px]"
              style={{ color: '#F2A83B', background: '#F2A83B20' }}
            >
              Evaluasi
            </span>
          </div>
          <p className="text-[11.5px] text-[#DCE3EC] leading-relaxed m-0">
            <strong className="text-[#F5F7FA]">{cognitive.caraMembaca}:</strong>{' '}
            {cognitive.mengapaPenting}
          </p>
        </div>
      </div>

      {/* 5. Causal Flow Chain (Jika Ada) */}
      {causalFlow && causalFlow.length > 0 && (
        <div
          className="p-2.5 rounded-[4px] flex flex-col gap-2"
          style={{
            background: 'rgba(255, 255, 255, 0.015)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} color={accentColor} />
            <span className="text-[10px] font-bold text-[#8A93A3] uppercase tracking-wider">
              Rantai Sebab-Akibat (Causal Flow)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {causalFlow.map((step, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-1 p-2 rounded-[3px] bg-black/20 border border-white/[0.04]"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: accentColor }}>
                  <span className="w-3.5 h-3.5 rounded-[2px] bg-white/[0.06] flex items-center justify-center text-[8.5px]">
                    {idx + 1}
                  </span>
                  <span>{step.step}</span>
                </div>
                <span className="text-[10.5px] text-[#8A93A3] leading-snug">
                  {step.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

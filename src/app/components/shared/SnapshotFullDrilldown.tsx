'use client';

import React from 'react';
import {
  TbSparkles as Sparkles,
  TbInfoCircle as Info,
  TbRobot as Bot,
  TbArrowRight as ArrowRight,
  TbX as X,
  TbTrendingUp as TrendingUp,
} from 'react-icons/tb';
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
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderTop: `3px solid ${accentColor}`,
        borderRadius: '16px',
        padding: '18px 20px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      {/* 1. Header: Judul Diagnosa, Subtitle, & Tombol Tutup */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}15` }}
            >
              <Sparkles size={13} color={accentColor} />
            </span>
            <h3 className="font-heading text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              {title}
            </h3>
            <span
              className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
              style={{ color: accentColor, background: `${accentColor}12` }}
            >
              {data.length} Indikator Kunci
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 pl-8">
              {subtitle}
            </p>
          )}
        </div>

        {/* Tombol Tutup */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 cursor-pointer border border-slate-200"
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
            const statusBadgeBg = isCrit ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#DCFCE7';
            const statusBadgeCol = isCrit ? '#DC2626' : isWarn ? '#D97706' : '#16A34A';
            const statusText = isCrit ? 'Kritis' : isWarn ? 'Waspada' : 'Aman';

            return (
              <div
                key={item.label}
                className="flex flex-col justify-between gap-1.5 p-3 rounded-xl transition-colors bg-slate-50 border border-slate-200/80"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] text-slate-600 font-medium truncate">
                    {item.label}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
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
                  <span className="text-[10px] text-slate-500 line-clamp-1">
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
        className="rounded-xl p-3.5 sm:p-4 flex flex-col gap-2.5 bg-emerald-50/70 border border-emerald-200 shadow-xs"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-emerald-600/10 text-emerald-700"
            >
              <Bot size={13} />
            </span>
            <span className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
              Rekomendasi AI &amp; Action Plan
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800"
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-100/60 border border-emerald-300 transition-colors cursor-pointer shadow-xs"
            >
              <span>Tanya AI Asisten</span>
              <ArrowRight size={11} />
            </button>
          )}
        </div>

        {/* Rekomendasi Utama Singkat Padat */}
        <p className="text-xs sm:text-[13px] text-emerald-900 font-semibold leading-relaxed m-0">
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
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-white border border-emerald-200/80 shadow-2xs"
                >
                  <span
                    className="text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 text-emerald-700 bg-emerald-100"
                  >
                    P{idx + 1}
                  </span>
                  <p className="text-[11.5px] text-slate-700 leading-snug m-0 flex-1">
                    {titlePart && (
                      <strong className="text-slate-900 mr-1">{titlePart}:</strong>
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
          className="p-3.5 rounded-xl flex flex-col gap-1.5 bg-slate-50 border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Info size={13} className="text-sky-600" />
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                Diagnosa Situasi &amp; Dampak Finansial
              </span>
            </div>
            {cognitive.sumberData && (
              <span className="text-[9.5px] text-slate-500 truncate max-w-[200px]" title={cognitive.sumberData}>
                {cognitive.sumberData}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-slate-700 leading-relaxed m-0">
            {cognitive.artinya}{' '}
            {cognitive.dampakPraktis ? `Dampaknya: ${cognitive.dampakPraktis}` : ''}
          </p>
        </div>

        {/* Kolom Kanan: Ambang Batas & Aturan Main */}
        <div
          className="p-3.5 rounded-xl flex flex-col gap-1.5 bg-slate-50 border border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                Aturan Main &amp; Ambang Batas
              </span>
            </div>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-amber-700 bg-amber-100"
            >
              Evaluasi
            </span>
          </div>
          <p className="text-[11.5px] text-slate-700 leading-relaxed m-0">
            <strong className="text-slate-900">{cognitive.caraMembaca}:</strong>{' '}
            {cognitive.mengapaPenting}
          </p>
        </div>
      </div>

      {/* 5. Causal Flow Chain (Jika Ada) */}
      {causalFlow && causalFlow.length > 0 && (
        <div
          className="p-3 rounded-xl flex flex-col gap-2 bg-slate-50 border border-slate-200"
        >
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} color={accentColor} />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              Rantai Sebab-Akibat (Causal Flow)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {causalFlow.map((step, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-1 p-2.5 rounded-lg bg-white border border-slate-200"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: accentColor }}>
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center text-[8.5px] text-slate-700">
                    {idx + 1}
                  </span>
                  <span>{step.step}</span>
                </div>
                <span className="text-[10.5px] text-slate-600 leading-snug">
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

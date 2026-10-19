'use client';

import React from 'react';
import { TbChevronDown as ChevronDown } from 'react-icons/tb';

export interface SnapshotKpiCardProps {
  id: string;
  title: string;
  badgeText: string;
  badgeColor?: string;
  badgeBg?: string;
  value: React.ReactNode;
  subtitle: string;
  accentColor: string;
  progressPercent?: number;
  isActive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export default function SnapshotKpiCard({
  id,
  title,
  badgeText,
  badgeColor = '#3FBF8F',
  badgeBg,
  value,
  subtitle,
  accentColor = '#3FBF8F',
  progressPercent = 100,
  isActive = false,
  onClick,
  disabled = false,
}: SnapshotKpiCardProps) {
  const computedBadgeBg = badgeBg || `${badgeColor}18`;

  return (
    <button
      type="button"
      id={`snapshot-card-${id}`}
      onClick={onClick}
      disabled={disabled}
      className="group relative flex flex-col justify-between text-left transition-all duration-300 select-none w-full hover:-translate-y-0.5"
      style={{
        background: isActive ? '#FFFFFF' : '#FFFFFF',
        border: isActive
          ? `2px solid ${accentColor}`
          : '1px solid #E2E8F0',
        borderRadius: '16px',
        padding: '16px 18px 14px 18px',
        boxShadow: isActive
          ? `0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 12px ${accentColor}25`
          : '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        minHeight: '116px',
      }}
      aria-expanded={isActive}
    >
      {/* Active Pointer Arrow at bottom */}
      {isActive && (
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 z-20 pointer-events-none"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${accentColor}`,
          }}
        />
      )}

      {/* Row 1: Uppercase Title & Status Pill Badge */}
      <div className="flex items-center justify-between gap-2 w-full">
        <span
          className="text-[10px] sm:text-[11px] font-bold font-mono tracking-wider uppercase truncate"
          style={{ color: isActive ? '#0F172A' : '#64748B' }}
        >
          {title}
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap shadow-xs"
          style={{
            color: badgeColor,
            background: computedBadgeBg,
            border: `1px solid ${badgeColor}35`,
          }}
        >
          {badgeText}
        </span>
      </div>

      {/* Row 2: Large Hero Value */}
      <div className="mt-2 mb-1">
        <div
          className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums truncate group-hover:text-black transition-colors"
        >
          {value}
        </div>
      </div>

      {/* Row 3: Subtitle Context & Small Indicator Icon */}
      <div className="flex items-center justify-between gap-1.5 text-[11px] text-slate-500 mb-2.5 truncate">
        <span className="truncate group-hover:text-slate-700 transition-colors" title={subtitle}>
          {subtitle}
        </span>
        <ChevronDown
          size={12}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: isActive ? accentColor : '#94A3B8',
            transform: isActive ? 'rotate(180deg)' : 'none',
          }}
        />
      </div>

      {/* Row 4: Progress / Accent Line at card bottom */}
      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.max(8, progressPercent))}%`,
            background: accentColor,
            boxShadow: isActive ? `0 0 10px ${accentColor}80` : 'none',
          }}
        />
      </div>
    </button>
  );
}

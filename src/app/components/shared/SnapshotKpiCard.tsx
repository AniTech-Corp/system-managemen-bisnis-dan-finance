'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

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
      className="group relative flex flex-col justify-between text-left transition-all duration-200 select-none w-full"
      style={{
        background: isActive
          ? 'linear-gradient(180deg, #131A26 0%, #0D121C 100%)'
          : 'linear-gradient(180deg, #0F141E 0%, #0A0E15 100%)',
        border: isActive
          ? `1.5px solid ${accentColor}`
          : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '6px',
        padding: '12px 14px 10px 14px',
        boxShadow: isActive
          ? `0 0 20px -3px ${accentColor}30, 0 6px 16px rgba(0,0,0,0.5)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        minHeight: '112px',
      }}
      aria-expanded={isActive}
    >
      {/* Active Pointer Arrow at bottom */}
      {isActive && (
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 z-20 pointer-events-none"
          style={{
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: `7px solid ${accentColor}`,
          }}
        />
      )}

      {/* Row 1: Uppercase Title & Status Pill Badge */}
      <div className="flex items-center justify-between gap-1.5 w-full">
        <span
          className="text-[10px] sm:text-[10.5px] font-bold font-mono tracking-wider truncate"
          style={{ color: isActive ? '#F5F7FA' : '#8A93A3' }}
        >
          {title}
        </span>
        <span
          className="text-[9.5px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-[4px] flex items-center gap-1 shrink-0 whitespace-nowrap"
          style={{
            color: badgeColor,
            background: computedBadgeBg,
            border: `1px solid ${badgeColor}30`,
          }}
        >
          {badgeText}
        </span>
      </div>

      {/* Row 2: Large Hero Value */}
      <div className="mt-1 mb-0.5">
        <div
          className="font-heading text-lg sm:text-xl lg:text-[22px] font-bold text-[#F5F7FA] tracking-tight tabular-nums truncate"
        >
          {value}
        </div>
      </div>

      {/* Row 3: Subtitle Context & Small Indicator Icon */}
      <div className="flex items-center justify-between gap-1 text-[10.5px] sm:text-[11px] text-[#8A93A3] mb-2 truncate">
        <span className="truncate" title={subtitle}>
          {subtitle}
        </span>
        <ChevronDown
          size={12}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: isActive ? accentColor : '#5C6474',
            transform: isActive ? 'rotate(180deg)' : 'none',
          }}
        />
      </div>

      {/* Row 4: Progress / Accent Line at card bottom */}
      <div className="w-full h-1 rounded-[2px] bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-[2px] transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.max(8, progressPercent))}%`,
            background: accentColor,
            boxShadow: isActive ? `0 0 8px ${accentColor}80` : 'none',
          }}
        />
      </div>
    </button>
  );
}

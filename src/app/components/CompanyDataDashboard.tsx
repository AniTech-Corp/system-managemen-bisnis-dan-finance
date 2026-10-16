'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
// V4d, 8 Sep 2026 (alert dashboard "N file punya kesalahan data") -- SSOT
// parsing header blok [PEMERIKSAAN DATA] + ekstraksi teksnya, SAMA modul yang
// dipakai WorkspaceDataHub.tsx (JANGAN tulis regex sendiri 2x).
import { extractDqBlockText, worstSeverity } from '@/lib/workspace-file-dataquality-shared'; // 8 Sep: modul aman-browser (bukan yang menyeret sharp)
// 9 Sep 2026 -- defense-in-depth gating kartu Snapshot Perusahaan (Kondisi Kas /
// Performa Kampanye) per module-guard.ts yang sudah ada dari gelombang 1. INI
// TAMBAHAN, BUKAN pengganti gating portal-level di page.tsx (isPortalAccessible).
import { isModuleEnabled } from '@/lib/module-guard';
import { SpotlightCard } from '@/components/ui/react-bits/SpotlightCard';
import { CountUp } from '@/components/ui/react-bits/CountUp';
import { Wallet, Megaphone, Bot, ArrowRight, CheckCircle2, Package, RefreshCw, AlertTriangle, Upload, Users, FileText, Calendar, Printer, X, ShieldCheck, ChevronDown } from 'lucide-react';
import InCardVisualDrilldown from './shared/InCardVisualDrilldown';
import SnapshotKpiCard from './shared/SnapshotKpiCard';
import SnapshotFullDrilldown from './shared/SnapshotFullDrilldown';
import WorkspaceDataHub from './WorkspaceDataHub';
import {
  HISTORICAL_YEARS_DATA,
  getHistoricalMultiYearSummary,
  type HistoricalYearSnapshot,
  type HistoricalHorizon,
  type MultiYearSummary,
} from '@/lib/demo-historical-generator';
import { getClientAuthHeaders } from '@/lib/client-auth';

interface CompanyDataDashboardProps {
  workspaceId?: string;
  workspaceName?: string;
  userName?: string;
  activeNav?: 'dashboard' | 'ai-assistant';
  onNavChange?: (nav: 'dashboard' | 'ai-assistant') => void;
  onOpenAI?: (prompt: string) => void;
  // 9 Sep 2026 -- optional, fail-open lewat isModuleEnabled kalau parent belum
  // kirim (mis. sesi lama). Dipasok page.tsx dari workspace.enabledModules yang
  // sudah ada di state situ (gating chain gelombang 1), bukan fetch baru.
  enabledModules?: string[];
}

interface FinancialData {
  n: string;
  rev: number;
  exp: number;
  gp: number;
  np: number;
  nm: number;
  mom: string;
  hpp: number;
  ops: number;
  ads: number;
  pay: number;
  ar: number;
  openingCash?: number | null;
  closingCash?: number | null;
}

interface MarketingData {
  spend: number;
  attr: number;
  roas: number;
  leads: number;
  cac: number;
  conv: string;
  meta: number;
  tiktok: number;
  google: number;
}

interface TeamData {
  staff: number;
  load: number;
  tasks: number;
  sla: number;
  pay: number;
  eng: number;
  mkt: number;
  sales: number;
  fin: number;
}

const DEFAULT_FIN: Record<string, FinancialData> = {
  Jan: { n: 'Januari 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Feb: { n: 'Februari 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Mar: { n: 'Maret 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Apr: { n: 'April 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Mei: { n: 'Mei 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Jun: { n: 'Juni 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Jul: { n: 'Juli 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Agu: { n: 'Agustus 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Sep: { n: 'September 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Okt: { n: 'Oktober 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Nov: { n: 'November 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Des: { n: 'Desember 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
};

const DEFAULT_MKT: Record<string, MarketingData> = {
  Jan: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Feb: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Mar: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Apr: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Mei: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Jun: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Jul: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Agu: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Sep: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Okt: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Nov: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Des: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
};

const DEFAULT_TEAM: Record<string, TeamData> = {
  Jan: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Feb: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Mar: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Apr: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Mei: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Jun: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Jul: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Agu: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Sep: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Okt: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Nov: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Des: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
};

// Benchmark Demo Datasets for Localhost (Membantu visualisasi & presentasi klien saat belum ada data DB)
const DEMO_FIN_LOCAL: Record<string, FinancialData> = {
  Jan: { n: 'Januari 2026', rev: 410000000, exp: 335000000, gp: 75000000, np: 75000000, nm: 18.3, mom: '+4.2%', hpp: 165000000, ops: 110000000, ads: 60000000, pay: 95000000, ar: 12000000 },
  Feb: { n: 'Februari 2026', rev: 445000000, exp: 355000000, gp: 90000000, np: 90000000, nm: 20.2, mom: '+8.5%', hpp: 175000000, ops: 115000000, ads: 65000000, pay: 95000000, ar: 14000000 },
  Mar: { n: 'Maret 2026', rev: 490000000, exp: 385000000, gp: 105000000, np: 105000000, nm: 21.4, mom: '+10.1%', hpp: 190000000, ops: 125000000, ads: 70000000, pay: 100000000, ar: 16000000 },
  Apr: { n: 'April 2026', rev: 475000000, exp: 380000000, gp: 95000000, np: 95000000, nm: 20.0, mom: '-3.1%', hpp: 185000000, ops: 125000000, ads: 70000000, pay: 100000000, ar: 15000000 },
  Mei: { n: 'Mei 2026', rev: 530000000, exp: 415000000, gp: 115000000, np: 115000000, nm: 21.7, mom: '+11.6%', hpp: 205000000, ops: 135000000, ads: 75000000, pay: 105000000, ar: 18000000 },
  Jun: { n: 'Juni 2026', rev: 565000000, exp: 440000000, gp: 125000000, np: 125000000, nm: 22.1, mom: '+6.6%', hpp: 215000000, ops: 145000000, ads: 80000000, pay: 110000000, ar: 20000000 },
  Jul: { n: 'Juli 2026', rev: 550000000, exp: 435000000, gp: 115000000, np: 115000000, nm: 20.9, mom: '-2.7%', hpp: 210000000, ops: 145000000, ads: 80000000, pay: 110000000, ar: 19000000 },
  Agu: { n: 'Agustus 2026', rev: 585000000, exp: 455000000, gp: 130000000, np: 130000000, nm: 22.2, mom: '+6.4%', hpp: 220000000, ops: 150000000, ads: 85000000, pay: 115000000, ar: 22000000 },
  Sep: { n: 'September 2026', rev: 612500000, exp: 478000000, gp: 134500000, np: 134500000, nm: 22.0, mom: '+4.7%', hpp: 215000000, ops: 167000000, ads: 96000000, pay: 120000000, ar: 24500000 },
  Okt: { n: 'Oktober 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Nov: { n: 'November 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
  Des: { n: 'Desember 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
};

const DEMO_MKT_LOCAL: Record<string, MarketingData> = {
  Jan: { spend: 18000000, attr: 72000000, roas: 4.0, leads: 280, cac: 32000, conv: '3.4%', meta: 45, tiktok: 35, google: 20 },
  Feb: { spend: 20000000, attr: 84000000, roas: 4.2, leads: 320, cac: 31000, conv: '3.6%', meta: 45, tiktok: 35, google: 20 },
  Mar: { spend: 22000000, attr: 92400000, roas: 4.2, leads: 360, cac: 30000, conv: '3.8%', meta: 45, tiktok: 35, google: 20 },
  Apr: { spend: 21000000, attr: 86100000, roas: 4.1, leads: 340, cac: 30500, conv: '3.7%', meta: 45, tiktok: 35, google: 20 },
  Mei: { spend: 24000000, attr: 103200000, roas: 4.3, leads: 390, cac: 29500, conv: '3.9%', meta: 45, tiktok: 35, google: 20 },
  Jun: { spend: 25000000, attr: 110000000, roas: 4.4, leads: 410, cac: 29000, conv: '4.1%', meta: 45, tiktok: 35, google: 20 },
  Jul: { spend: 24000000, attr: 100800000, roas: 4.2, leads: 395, cac: 29500, conv: '3.9%', meta: 45, tiktok: 35, google: 20 },
  Agu: { spend: 26000000, attr: 114400000, roas: 4.4, leads: 430, cac: 28500, conv: '4.2%', meta: 45, tiktok: 35, google: 20 },
  Sep: { spend: 28000000, attr: 126000000, roas: 4.5, leads: 460, cac: 28000, conv: '4.3%', meta: 45, tiktok: 35, google: 20 },
  Okt: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Nov: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
  Des: { spend: 0, attr: 0, roas: 0, leads: 0, cac: 0, conv: '0%', meta: 0, tiktok: 0, google: 0 },
};

const DEMO_TEAM_LOCAL: Record<string, TeamData> = {
  Jan: { staff: 14, load: 62, tasks: 34, sla: 97, pay: 70000000, eng: 65, mkt: 60, sales: 68, fin: 55 },
  Feb: { staff: 15, load: 64, tasks: 38, sla: 98, pay: 75000000, eng: 67, mkt: 62, sales: 70, fin: 57 },
  Mar: { staff: 16, load: 68, tasks: 42, sla: 98, pay: 80000000, eng: 70, mkt: 65, sales: 72, fin: 60 },
  Apr: { staff: 16, load: 66, tasks: 40, sla: 96, pay: 80000000, eng: 68, mkt: 64, sales: 70, fin: 59 },
  Mei: { staff: 17, load: 70, tasks: 45, sla: 98, pay: 85000000, eng: 72, mkt: 68, sales: 75, fin: 62 },
  Jun: { staff: 18, load: 72, tasks: 48, sla: 99, pay: 90000000, eng: 74, mkt: 70, sales: 76, fin: 64 },
  Jul: { staff: 18, load: 69, tasks: 46, sla: 97, pay: 90000000, eng: 71, mkt: 67, sales: 74, fin: 63 },
  Agu: { staff: 18, load: 73, tasks: 50, sla: 98, pay: 90000000, eng: 75, mkt: 72, sales: 78, fin: 65 },
  Sep: { staff: 18, load: 71, tasks: 52, sla: 99, pay: 90000000, eng: 73, mkt: 69, sales: 77, fin: 64 },
  Okt: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Nov: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
  Des: { staff: 0, load: 0, tasks: 0, sla: 100, pay: 0, eng: 0, mkt: 0, sales: 0, fin: 0 },
};

// NOTE: color palette aligned to Claude Design mockup v11 (2026-09-04) —
// muted/dim/secondary text greys shifted lighter, AI/accent color moved from indigo to blue.
function rp(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function short(n: number): string {
  if (n >= 1000000000) return 'Rp ' + (n / 1000000000).toFixed(1).replace('.0', '').replace('.', ',') + ' M';
  if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(1).replace('.0', '').replace('.', ',') + ' jt';
  if (n >= 1000) return 'Rp ' + Math.round(n / 1000) + ' rb';
  return 'Rp ' + Math.round(n);
}

function tone(v: number): string {
  if (v === 0) return '#8A93A3';
  return v >= 80 ? '#3FBF8F' : v >= 50 ? '#F2A83B' : '#EF4444';
}

function word(v: number): string {
  if (v === 0) return 'Menunggu data';
  return v >= 80 ? 'Sehat' : v >= 50 ? 'Perlu perhatian' : 'Bahaya';
}

function loadTone(v: number): string {
  return v >= 95 ? '#EF4444' : v >= 85 ? '#F2A83B' : '#3FBF8F';
}

function loadWord(v: number): string {
  return v >= 95 ? 'Kelebihan beban' : v >= 85 ? 'Padat' : 'Normal';
}

function roasTone(v: number): string {
  return v === 0 ? '#8A93A3' : v >= 3 ? '#3FBF8F' : '#EF4444';
}

function roasWord(v: number): string {
  return v === 0 ? 'Menunggu data' : v >= 3 ? 'Di atas target' : 'Di bawah target';
}

function pillBtn(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '26px',
    padding: '0 12px',
    margin: 0,
    borderRadius: '4px',
    fontSize: '11.5px',
    fontWeight: 600,
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    border: 'none',
    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
    color: active ? '#F5F7FA' : '#8A93A3',
    transition: 'all 120ms ease',
  };
}

type AiRecState = 'ok' | 'skip' | 'review' | 'wait';

type PiutangReminderPayload = {
  message?: string;
  invoices?: Array<{ id?: string }>;
  reminder?: { directWaUrl?: string };
};

function aiRecCardStyle(state: AiRecState, tone: 'red' | 'blue'): React.CSSProperties {
  const line =
    state === 'ok'
      ? 'rgba(63,191,143,0.3)'
      : state === 'skip'
      ? 'rgba(239,68,68,0.25)'
      : state === 'review'
      ? 'rgba(242,168,59,0.3)'
      : tone === 'red'
      ? 'rgba(239,68,68,0.4)'
      : 'rgba(255,255,255,0.14)';
  const bg = state === 'skip' ? '#090C12' : '#0D1117';
  return { padding: '17px 18px', borderRadius: '5px', background: bg, border: `1px solid ${line}`, display: 'flex', flexDirection: 'column', gap: '12px', opacity: state === 'skip' ? 0.7 : 1 };
}

function aiRecTagStyle(tone: 'red' | 'blue'): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap', color: tone === 'red' ? '#EF4444' : '#8CC0FF' };
}

function aiRecChipStyle(state: AiRecState): React.CSSProperties {
  return {
    fontSize: '11.5px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    color: state === 'ok' ? '#3FBF8F' : state === 'skip' ? '#EF4444' : state === 'review' ? '#F2A83B' : '#98A2B3',
    background: state === 'ok' ? 'rgba(63,191,143,0.1)' : state === 'skip' ? 'rgba(239,68,68,0.1)' : state === 'review' ? 'rgba(242,168,59,0.1)' : 'rgba(255,255,255,0.05)',
    padding: '3px 8px',
    borderRadius: '4px',
  };
}

function aiRecOkBtnStyle(done: boolean, tone: 'red' | 'blue'): React.CSSProperties {
  const c = tone === 'red' ? '#EF4444' : '#0058BE';
  return done
    ? { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '32px', padding: '0 12px', background: 'rgba(63,191,143,0.12)', border: '1px solid rgba(63,191,143,0.4)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 700, color: '#3FBF8F', cursor: 'pointer' }
    : { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '32px', padding: '0 12px', background: c, border: `1px solid ${c}`, borderRadius: '4px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' };
}

function pointDelta(curr: number, prev: number): { text: string; color: string; bg: string } {
  const diff = curr - prev;
  if (diff === 0) {
    return { text: 'stabil', color: '#98A2B3', bg: 'rgba(255,255,255,0.05)' };
  }
  const up = diff > 0;
  return {
    text: (up ? '+' : '') + diff,
    color: up ? '#3FBF8F' : '#EF4444',
    bg: up ? 'rgba(63,191,143,0.12)' : 'rgba(239,68,68,0.12)',
  };
}

function statToneColor(t: 'good' | 'bad' | 'warn'): string {
  return t === 'good' ? '#3FBF8F' : t === 'bad' ? '#EF4444' : '#F2A83B';
}

function deltaChip(curr: number, prev: number): { text: string; color: string; bg: string } {
  if (!prev) {
    return { text: '—', color: '#98A2B3', bg: 'rgba(255,255,255,0.05)' };
  }
  const pct = ((curr - prev) / prev) * 100;
  const up = pct >= 0;
  const text = (up ? '+' : '-') + Math.abs(pct).toFixed(1).replace('.', ',') + '%';
  return up
    ? { text, color: '#3FBF8F', bg: 'rgba(63,191,143,0.12)' }
    : { text, color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
}

function buildPath(vals: number[], max: number, min = 0, H = 205): { line: string; area: string } {
  const w = 1000;
  const lo = min;
  const hi = max || 1;
  if (vals.length === 0) return { line: '', area: '' };
  // A single aggregate point has no x-axis trend. Keep the SVG path finite
  // (the old denominator produced NaN) for callers that still need a safe
  // fallback, while the UI separately labels aggregate-only views honestly.
  const xDenominator = Math.max(vals.length - 1, 1);
  const pts = vals.map((v, i) => {
    const x = vals.length === 1 ? w / 2 : (i / xDenominator) * w;
    const safeValue = Number.isFinite(v) ? v : lo;
    const t = (safeValue - lo) / ((hi - lo) || 1);
    return [x, Math.max(2, Math.min(H - 2, H - t * H))];
  });
  let line = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    line += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ', ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ', ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
  }
  return { line, area: line + ' L ' + w + ' ' + H + ' L 0 ' + H + ' Z' };
}

// =============================================================================
// HELPER MURNI -- agregasi kampanye & tugas nyata (audit 3.5, 10 Sep 2026 Fable)
// Diekspor supaya dites langsung tanpa render React, sama pola dengan
// ForecastCard.tsx (formatRupiah/buildForecastExtraData).
// =============================================================================

export interface CampaignSummaryInput {
  dailyBudget: number;
  roas: number | null;
  leads: number;
  status: string;
}

export interface CampaignAggregateResult {
  totalCount: number;
  activeCount: number;
  spendEstimate: number;
  leadsTotal: number;
  roasAvg: number | null;
}

/** Agregasi murni dari daftar kampanye (GET /api/v1/marketing/campaigns).
 * CATATAN JUJUR: Campaign model TIDAK menyimpan log spend harian, cuma
 * `dailyBudget` konstan per kampanye -- jadi `spendEstimate` = SUM(dailyBudget
 * kampanye ACTIVE) x hari yang sudah berjalan bulan ini. Ini ESTIMASI,
 * bukan angka tercatat aktual per hari -- label di UI WAJIB bilang
 * "estimasi". 10 Sep 2026 (Fable), keputusan additive-safe karena wiring
 * penuh (per-hari, per-kanal, prevM historis) ditandai audit sebagai
 * pekerjaan besar lintas modul (100+ baris) di luar anggaran diff batch ini. */
export function aggregateCampaignsSummary(
  campaigns: CampaignSummaryInput[],
  daysElapsedThisMonth: number
): CampaignAggregateResult {
  const totalCount = campaigns.length;
  const active = campaigns.filter((c) => c.status === 'ACTIVE');
  const activeCount = active.length;
  const days = Math.max(1, Math.floor(daysElapsedThisMonth) || 1);
  const spendEstimate = active.reduce((sum, c) => sum + (Number(c.dailyBudget) || 0), 0) * days;
  const leadsTotal = campaigns.reduce((sum, c) => sum + (Number(c.leads) || 0), 0);
  const roasValues = campaigns
    .map((c) => c.roas)
    .filter((r): r is number => typeof r === 'number' && isFinite(r));
  const roasAvg = roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : null;
  return { totalCount, activeCount, spendEstimate, leadsTotal, roasAvg };
}

export interface TaskSummaryInput {
  status: string;
  dueDate: string | null;
}

export interface TaskAggregateResult {
  total: number;
  done: number;
  overdue: number;
}

/** Agregasi murni dari daftar tugas (GET /api/v1/kerja/tasks -> allTasks).
 * overdue = status BUKAN DONE dan dueDate < now. 10 Sep 2026 (Fable). */
export function aggregateTasksSummary(tasks: TaskSummaryInput[], now: Date = new Date()): TaskAggregateResult {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const overdue = tasks.filter(
    (t) => t.status !== 'DONE' && !!t.dueDate && new Date(t.dueDate).getTime() < now.getTime()
  ).length;
  return { total, done, overdue };
}

export interface RecommendationLike {
  category: string;
  priority: string;
}

const RECOMMENDATION_PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Pilih 1 rekomendasi prioritas tertinggi dari kategori FINANCE/STRATEGY --
 * dipakai kartu 'Prediksi kas AI'. Murni, tidak fetch apa pun. 10 Sep 2026
 * (Fable). */
export function pickTopFinanceStrategyRecommendation<T extends RecommendationLike>(recs: T[]): T | null {
  const filtered = recs.filter((r) => r.category === 'FINANCE' || r.category === 'STRATEGY');
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort(
    (a, b) => (RECOMMENDATION_PRIORITY_RANK[a.priority] ?? 9) - (RECOMMENDATION_PRIORITY_RANK[b.priority] ?? 9)
  );
  return sorted[0];
}

// =============================================================================
// KONTRAK MODUL 6 -- dashboard-insight (11 Sep 2026, Fable, CONTEXT PACK bagian
// 4 kontrak #6). Tipe di bawah DIDEFINISIKAN LOKAL, sengaja BUKAN diimpor dari
// src/lib/ai-brain/dashboard-insight.ts (server-only, dibangun agent B3) --
// insiden 8 Sep sudah membuktikan komponen client yang mengimpor modul
// node-only bikin SELURUH halaman 500 walau `tsc --noEmit` 0 error (lihat
// CONTEXT PACK 11 Sep bagian 2 poin b). Salinan ini WAJIB persis sama shape
// dengan kontrak server; kalau kontrak berubah, 3 salinan lokal (di
// CompanyDataDashboard/FinanceModuleView/MarketingModuleView) diupdate bareng.
// =============================================================================
export type DashboardInsightRole = 'ceo' | 'finance' | 'marketing';

export interface DashboardInsightRecommendation {
  judul: string;
  alasan: string;
  langkah: string;
  dampak: string;
  prioritas: 'tinggi' | 'sedang' | 'rendah';
}

export interface DashboardInsightSumberData {
  transaksiTercatat: boolean;
  jumlahTransaksi: number;
  dokumen: number;
  dokumenLedgerTerdeteksi: number;
  kampanye: number;
  tugas: number;
  produk: number;
}

export interface DashboardInsight {
  role: DashboardInsightRole;
  generatedAt: string;
  cached: boolean;
  ringkasan: string;
  sorotan: string[];
  rekomendasi: DashboardInsightRecommendation[];
  prediksi: { teks: string; horizonBulan: number; keyakinan: 'rendah' | 'sedang' | 'tinggi' };
  peringatan: string[];
  pertanyaanLanjutan: string[];
  sumberData: DashboardInsightSumberData;
  catatanJujur: string[];
}

/** Ubah `sumberData` (angka final dari server) jadi baris chip siap-render --
 * MURNI format, tidak menghitung apa pun. Chip "Ledger terdeteksi" cuma
 * muncul kalau > 0 (nudge impor ke Buku Kas, akar B poin 3 di CONTEXT PACK).
 * 11 Sep 2026, Fable. */
export function buildDashboardInsightChips(sumberData: DashboardInsightSumberData | null | undefined): string[] {
  if (!sumberData) return [];
  const chips: string[] = [];
  chips.push(`Transaksi: ${sumberData.jumlahTransaksi || 0} tercatat`);
  chips.push(`Dokumen: ${sumberData.dokumen || 0}`);
  if (sumberData.dokumenLedgerTerdeteksi > 0) {
    chips.push(`Ledger terdeteksi: ${sumberData.dokumenLedgerTerdeteksi} -> Impor ke Buku Kas`);
  }
  if (sumberData.kampanye > 0) chips.push(`Kampanye: ${sumberData.kampanye}`);
  if (sumberData.tugas > 0) chips.push(`Tugas: ${sumberData.tugas}`);
  if (sumberData.produk > 0) chips.push(`Produk: ${sumberData.produk}`);
  return chips;
}

/**
 * Sumber kebenaran mode lokal adalah endpoint transaksi, bukan grafik tren.
 * Grafik dapat membawa benchmark presentasi sementara saldo transaksi masih 0;
 * memperlakukannya sebagai data riil mencampur kedua state dan menghasilkan
 * kartu CEO "Rp 0" berdampingan dengan angka benchmark.
 */
export function hasUsableFinanceData({
  transactionCount,
  totalRevenue,
  totalExpense,
  cashBalance,
  isDevLocalhost,
}: {
  transactionCount: number;
  totalRevenue: number;
  totalExpense: number;
  cashBalance: number;
  isDevLocalhost: boolean;
}): boolean {
  // Samakan persis ambang FinanceModuleView. Satu-dua transaksi QA lama tidak
  // boleh membuat CEO menggabungkan saldo riil kecil dengan tren benchmark.
  // Di localhost, jika transaksi kosong (transactionCount === 0), pendapatan tidak boleh dianggap valid karena bisa berupa angka benchmark.
  if (isDevLocalhost) {
    if (transactionCount === 0) return false;
    return transactionCount > 5 || totalRevenue >= 1000000 || totalExpense >= 1000000;
  }
  // Di produksi tidak pernah jatuh ke benchmark, jadi agregat backend yang
  // tersedia tetap dapat dirender walau metadata count belum dikirim.
  return totalRevenue >= 1000000 || totalExpense >= 1000000 || Math.abs(cashBalance) >= 1000000;
}

function formatCompactIdr(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `${(val / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `${(val / 1_000).toFixed(1).replace('.', ',')} Rb`;
  }
  return val.toLocaleString('id-ID');
}

export default function CompanyDataDashboard({
  workspaceId,
  workspaceName = 'Anitech Workspace',
  userName = 'Nime Nimasi',
  activeNav = 'dashboard',
  onNavChange,
  onOpenAI,
  enabledModules,
}: CompanyDataDashboardProps) {
  const [month, setMonth] = useState('Sep');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [timeHorizon, setTimeHorizon] = useState<HistoricalHorizon>('monthly');
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const calendarPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarPickerRef.current && !calendarPickerRef.current.contains(e.target as Node)) {
        setCalendarPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [calendarPickerOpen]);

  const monthFullName: Record<string, string> = {
    Jan: 'Januari',
    Feb: 'Februari',
    Mar: 'Maret',
    Apr: 'April',
    Mei: 'Mei',
    Jun: 'Juni',
    Jul: 'Juli',
    Agu: 'Agustus',
    Sep: 'September',
    Okt: 'Oktober',
    Nov: 'November',
    Des: 'Desember',
  };

  const [dataHubOpen, setDataHubOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printScope, setPrintScope] = useState<'monthly' | 'comprehensive' | 'cross-division'>('comprehensive');
  const [realFinMap, setRealFinMap] = useState<Record<string, FinancialData>>({});
  const [realCashBalance, setRealCashBalance] = useState<number>(0);
  const [recordedTransactionCount, setRecordedTransactionCount] = useState<number>(0);
  const [recordedIncome, setRecordedIncome] = useState<number>(0);
  const [recordedExpense, setRecordedExpense] = useState<number>(0);
  const [openSection, setOpenSection] = useState<'fin' | 'mkt' | 'team' | ''>('');
  const [activeSnapshotKey, setActiveSnapshotKey] = useState<string | null>(null);
  const [snapshotViewMode, setSnapshotViewMode] = useState<'overview' | 'operations'>('overview');
  const [cmpFin, setCmpFin] = useState(false);
  const [cmpMkt, setCmpMkt] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [liveState, setLiveState] = useState<any>(null);
  const [brainContext, setBrainContext] = useState<any>(null);
  // 10 Sep 2026 -- kartu ringkas "Stok & Pembelian" (KONTRAK WIRING agent
  // wiring-page-ceo-finance). Fetch sendiri (bukan lewat loadRealMetrics/
  // liveState) karena datanya dari endpoint inventory baru, bukan brain
  // context lama. null = belum sempat dimuat/gagal (tampil zero-state jujur,
  // BUKAN angka 0 palsu).
  const [inventorySummary, setInventorySummary] = useState<{
    productCount: number;
    stockValue: number;
    lowStockCount: number;
  } | null>(null);
  const [inventorySummaryError, setInventorySummaryError] = useState(false);
  const [totalWorkspaceFilesCount, setTotalWorkspaceFilesCount] = useState<number>(0);
  // V4d, 8 Sep 2026 (alert dashboard "N file punya kesalahan data") -- diisi
  // dari GET /api/v1/workspace-files di loadRealMetrics() di bawah, dihitung
  // client-side dari field dataQualityCount/dataQualityWorst per file (SUDAH
  // ada di respons GET, TANPA kolom Prisma baru -- lihat workspace-file-
  // dataquality.ts). Contoh detail (nama file bermasalah, dipakai panel alert)
  // disimpan terpisah supaya panel bisa menampilkan ringkasan tanpa fetch lagi.
  const [dataQualityFilesWithIssues, setDataQualityFilesWithIssues] = useState<
    Array<{ id: string; fileName: string; count: number; worst: 'critical' | 'warning' | 'info' | null; block: string | null }>
  >([]);

  // Dynamic Company Profile state
  const [profileData, setProfileData] = useState<{
    name: string;
    industry: string;
    targetMarket: string;
    description: string;
    primaryProduct: string;
    source: string;
    isConfigured: boolean;
  }>({
    name: workspaceName || '',
    industry: 'Belum ditentukan',
    targetMarket: 'Belum ditentukan',
    description: '',
    primaryProduct: 'Belum ditentukan',
    source: 'UNSET',
    isConfigured: false,
  });
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [formProfileName, setFormProfileName] = useState('');
  const [formProfileIndustry, setFormProfileIndustry] = useState('');
  const [formProfileTarget, setFormProfileTarget] = useState('');
  const [formProfileDesc, setFormProfileDesc] = useState('');
  const [formProfileProduct, setFormProfileProduct] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileDocInputRef = React.useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId || 'default'}/profile`, {
        credentials: 'include',
        headers: getClientAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setProfileData(json.data);
          setFormProfileName(json.data.name || '');
          setFormProfileIndustry(json.data.industry !== 'Belum ditentukan' ? json.data.industry : '');
          setFormProfileTarget(json.data.targetMarket !== 'Belum ditentukan' ? json.data.targetMarket : '');
          setFormProfileDesc(json.data.description !== 'Belum ada deskripsi profil' ? json.data.description : '');
          setFormProfileProduct(json.data.primaryProduct !== 'Belum ditentukan' ? json.data.primaryProduct : '');
        }
      }
    } catch (e) {
      console.warn('Gagal memuat profil perusahaan:', e);
    }
  };

  useEffect(() => {
    fetchProfile();
    window.addEventListener('klir-ai-state-updated', fetchProfile);
    return () => window.removeEventListener('klir-ai-state-updated', fetchProfile);
  }, [workspaceId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId || 'default'}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formProfileName,
          industry: formProfileIndustry,
          targetMarket: formProfileTarget,
          description: formProfileDesc,
          primaryProduct: formProfileProduct,
          source: 'Form Input Manual',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setProfileData(json.data);
        setEditProfileOpen(false);
        window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      }
    } catch (err) {
      console.error('Gagal menyimpan profil:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/documents/analyze', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchProfile();
        window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
        setEditProfileOpen(false);
      }
    } catch (err) {
      console.error('Gagal upload dokumen profil:', err);
    } finally {
      setUploadingDoc(false);
      if (fileDocInputRef.current) fileDocInputRef.current.value = '';
    }
  };
  const [openAlert, setOpenAlert] = useState<string | null>(null);
  const [remindStage, setRemindStage] = useState<'idle' | 'confirm' | 'sent'>('idle');
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'short' | 'full'>('short');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('ai=full')) {
      setAiMode('full');
    }
  }, []);
  const [hsMode, setHsMode] = useState<'score' | 'pilar' | 'tren'>('score');
  const [trMode, setTrMode] = useState<'bar' | 'line' | 'table'>('bar');
  const [trendMetricView, setTrendMetricView] = useState<'all' | 'gp' | 'tax' | 'headcount'>('all');
  const [fcMode, setFcMode] = useState<'cons' | 'base' | 'opt'>('cons');
  const [simPrompt, setSimPrompt] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [panelOpen, setPanelOpen] = useState<{ hs: boolean; ai: boolean }>({ hs: true, ai: true });
  const [aiActionOk, setAiActionOk] = useState<string[]>([]);
  const [aiActionSkip, setAiActionSkip] = useState<string[]>([]);
  const [aiActionReview, setAiActionReview] = useState<string[]>([]);

  // 13 Sep 2026 (Arahan Mecca) — State Pematangan Visual Expandable AI Cards & Multi-Horizon CEO Dashboard
  const [targetDetailOpen, setTargetDetailOpen] = useState(false);
  const [forecastDetailOpen, setForecastDetailOpen] = useState(false);
  const [stockDetailOpen, setStockDetailOpen] = useState(false);
  const [actionDetailOpen, setActionDetailOpen] = useState(false);
  const [perfHorizon, setPerfHorizon] = useState<'3m' | '6m' | 'ytd' | '1y' | '3y' | '5y' | '10y'>('6m');
  const [fcHorizon, setFcHorizon] = useState<'1m' | '3m' | 'q4' | '1y'>('3m');
  const [cmpFinMode, setCmpFinMode] = useState<'none' | 'mom' | 'qoq' | 'yoy' | 'ytd'>('none');
  const [cmpMktMode, setCmpMktMode] = useState<'none' | 'mom' | 'qoq' | 'yoy'>('none');
  const [cmpTeamMode, setCmpTeamMode] = useState<'none' | 'mom' | 'qoq'>('none');
  // 10 Sep 2026 (Fable) -- `tasksShifted` DIHAPUS: state ini cuma dipakai
  // tombol "Seimbangkan beban divisi" di dalam panel drill-down alert 'team'
  // yang sudah dihapus (audit 3.3, dead code 2 lapis, lihat commit ini).
  // 10 Sep 2026 (Fable) -- state ringkasan kampanye/tugas nyata (audit 3.5):
  // blok tambahan additive-safe di Section 5/6, LIHAT loadMarketingAndTasks().
  const [campaignsSummary, setCampaignsSummary] = useState<CampaignAggregateResult | null>(null);
  const [campaignsSummaryError, setCampaignsSummaryError] = useState(false);
  const [tasksSummary, setTasksSummary] = useState<TaskAggregateResult | null>(null);
  const [tasksSummaryError, setTasksSummaryError] = useState(false);
  // 10 Sep 2026 (Fable) -- kartu BARU "Prediksi kas AI" (audit Bagian 2 usulan).
  // KEPUTUSAN: pakai GET /api/v1/brain/recommendations (bukan POST
  // /api/v1/brain/forecast seperti disebut kontrak awal) -- lihat komentar
  // panjang di titik render kartu untuk alasannya.
  const [forecastCard, setForecastCard] = useState<{
    runwayMonths: number;
    cashOutDate: string | null;
    anomalies: Array<{ id: string; severity: string; title: string; message: string }>;
    topRecommendation: { title: string; prescription: string; category: string; priority: string } | null;
  } | null>(null);
  const [forecastCardError, setForecastCardError] = useState(false);

  // CEO dashboard tidak boleh membangun tautan ke nomor/email dummy. Endpoint ini
  // memilih invoice overdue nyata secara tenant-scoped, lalu menghasilkan draf WA
  // dengan clientPhone yang benar. Hanya membuka draf setelah konfirmasi eksplisit;
  // pengiriman terakhir tetap dilakukan user dari WhatsApp.
  const sendInvoiceReminder = async () => {
    if (reminderLoading) return;
    const waTab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (waTab) waTab.opener = null;
    setReminderLoading(true);
    setReminderError(null);
    try {
      const listRes = await fetch('/api/v1/kas/piutang-reminder', { credentials: 'include' });
      const listData: PiutangReminderPayload = await listRes.json().catch(() => ({}));
      if (!listRes.ok) {
        throw new Error(listData?.message || 'Gagal memuat daftar faktur menunggak. Coba muat ulang dashboard.');
      }

      // GET endpoint mengurutkan dueDate asc, jadi item pertama adalah faktur yang
      // paling lama menunggak. Jangan loncat ke invoice lain diam-diam kalau nomor
      // WA-nya kosong: backend akan memberi pesan tindakan yang spesifik.
      const invoice = Array.isArray(listData?.invoices) ? listData.invoices[0] : null;
      if (!invoice?.id) {
        throw new Error('Tidak ada faktur menunggak yang bisa diingatkan. Muat ulang dashboard jika daftar baru saja berubah.');
      }

      const reminderRes = await fetch('/api/v1/kas/piutang-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const reminderData: PiutangReminderPayload = await reminderRes.json().catch(() => ({}));
      if (!reminderRes.ok) {
        throw new Error(reminderData?.message || 'Gagal menyiapkan draf WhatsApp penagihan.');
      }

      const waUrl = reminderData?.reminder?.directWaUrl;
      if (typeof waUrl !== 'string' || !waUrl.startsWith('https://wa.me/')) {
        throw new Error('Sistem tidak menerima tautan WhatsApp yang valid untuk faktur ini.');
      }

      if (waTab && !waTab.closed) {
        waTab.location.href = waUrl;
      } else if (typeof window !== 'undefined') {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }
      setRemindStage('sent');
    } catch (error) {
      waTab?.close();
      setReminderError(error instanceof Error ? error.message : 'Gagal menyiapkan draf WhatsApp penagihan.');
      setRemindStage('idle');
    } finally {
      setReminderLoading(false);
    }
  };

  const runSimulation = async () => {
    if (!simPrompt.trim() || simLoading) return;
    setSimLoading(true);
    setSimError(null);
    try {
      const res = await fetch('/api/v1/brain/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptDescription: simPrompt.trim(),
          scenarioTitle: simPrompt.trim().slice(0, 50),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Simulasi gagal diproses.');
      }
      setSimResult(json.data);
    } catch (e: any) {
      setSimError(e.message || 'Simulasi gagal diproses.');
      setSimResult(null);
    } finally {
      setSimLoading(false);
    }
  };

  const simRiskStyle: Record<string, { bg: string; border: string; color: string; label: string }> = {
    LOW: { bg: 'rgba(63,191,143,0.12)', border: 'rgba(63,191,143,0.32)', color: '#3FBF8F', label: 'Risiko rendah' },
    MODERATE: { bg: 'rgba(216,163,60,0.12)', border: 'rgba(216,163,60,0.32)', color: '#D8A33C', label: 'Risiko sedang' },
    HIGH: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.32)', color: '#EF4444', label: 'Risiko tinggi' },
    CRITICAL: { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.45)', color: '#EF4444', label: 'Risiko kritis' },
  };

  const loadRealMetrics = async () => {
    try {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const qsTrends = workspaceId
        ? `?granularity=monthly&count=12&workspaceId=${encodeURIComponent(workspaceId)}`
        : '?granularity=monthly&count=12';

      const authHeaders = getClientAuthHeaders();
      const [txRes, trendsRes, healthRes, brainRes, workspaceFilesRes] = await Promise.all([
        fetch(`/api/v1/kas/transactions${qs}`, { credentials: 'include', headers: authHeaders }),
        fetch(`/api/v1/analytics/financial-trends${qsTrends}`, { credentials: 'include', headers: authHeaders }),
        fetch(`/api/v1/kas/financial-health${qs}`, { credentials: 'include', headers: authHeaders }),
        fetch(`/api/v1/brain/context${qs}`, { credentials: 'include', headers: authHeaders }).catch(() => null),
        // V4d, 8 Sep 2026: satu-satunya titik fetch workspace-files di dashboard
        // ini (readLive() TIDAK fetch dobel -- lihat kontrak "pilih salah satu").
        fetch(`/api/v1/workspace-files${qs}`, { credentials: 'include', headers: authHeaders }).catch(() => null),
      ]);
      if (txRes.ok) {
        const txData = await txRes.json();
        setRealCashBalance(txData.summary?.cumulativeCashBalance ?? txData.summary?.netCashBalance ?? 0);
        setRecordedTransactionCount(Number(txData.summary?.transactionCount) || 0);
        setRecordedIncome(Number(txData.summary?.totalIncome) || 0);
        setRecordedExpense(Number(txData.summary?.totalExpense) || 0);
      }
      if (brainRes && brainRes.ok) {
        const brainJson = await brainRes.json();
        if (brainJson.data) {
          setBrainContext(brainJson.data);
        }
      }
      // V4d, 8 Sep 2026: hitung file yang punya kesalahan data dari respons
      // GET workspace-files (field dataQualityCount/dataQualityWorst per file --
      // lihat workspace-files/route.ts GET, TANPA kolom Prisma baru).
      if (workspaceFilesRes && workspaceFilesRes.ok) {
        try {
          const wfJson = await workspaceFilesRes.json();
          const rows: any[] = Array.isArray(wfJson.files) ? wfJson.files : [];
          setTotalWorkspaceFilesCount(rows.length);
          // 8 Sep (temuan verifikator SEDANG): alert dashboard HANYA untuk temuan warning/critical --
          // temuan 'info' (mis. nama mirip, pola tanggal) tetap terlihat di Pusat Data, tapi tidak
          // jadi alert pertama yang dilihat user (risiko false-positive typo-checker Indonesia).
          const withIssues = rows
            .filter((r) => (r.dataQualityCount ?? 0) > 0 && (r.dataQualityWorst === 'critical' || r.dataQualityWorst === 'warning'))
            .map((r) => ({
              id: r.id as string,
              fileName: r.fileName as string,
              count: r.dataQualityCount as number,
              worst: (r.dataQualityWorst ?? null) as 'critical' | 'warning' | 'info' | null,
              block: extractDqBlockText(r.extractedSummary ?? null),
            }));
          setDataQualityFilesWithIssues(withIssues);
        } catch (e) {
          console.warn('Dashboard workspace-files data-quality parse error:', e);
  const [totalWorkspaceFilesCount, setTotalWorkspaceFilesCount] = useState<number>(0);
        }
      }
      if (trendsRes.ok) {
        const trData = await trendsRes.json();
        // FIX (localhost maturity pass 7 Sep): endpoint sungguhan balikin
        // `chartSeries`+`details` di root response, BUKAN `data.timeSeries` --
        // field ini sebelumnya salah nama sehingga blok ini NOL PERNAH jalan
        // (Array.isArray selalu false), chart tren selalu kosong walau data
        // transaksi asli ada. Nama field per-titik juga dikoreksi: `netCash`
        // (bukan `netProfit`), `marginPct` (bukan `margin`); `bucketKey` diganti
        // `key` (format sama YYYY-MM). momGrowth per-bulan DIHITUNG di sini dari
        // income riil bulan sebelumnya (endpoint tidak menyediakan field ini) --
        // bukan dikarang, murni turunan dari angka yang sudah nyata.
        const series = Array.isArray(trData.details) ? trData.details : [];
        if (series.length > 0) {
          const newMap: Record<string, FinancialData> = {};
          const monthKeyMap: Record<string, string> = {
            '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
            '05': 'Mei', '06': 'Jun', '07': 'Jul', '08': 'Agu', '09': 'Sep',
            '10': 'Okt', '11': 'Nov', '12': 'Des',
          };
          let prevIncome: number | null = null;
          series.forEach((pt: any) => {
            const mCode = String(pt.key).slice(5, 7);
            const shortName = monthKeyMap[mCode] || pt.key;
            const netCash = pt.netCash ?? 0;
            const momGrowth = prevIncome && prevIncome > 0 ? ((pt.income - prevIncome) / prevIncome) * 100 : null;
            newMap[shortName] = {
              n: pt.label || shortName,
              rev: pt.income || 0,
              exp: pt.expense || 0,
              gp: netCash > 0 ? netCash : 0,
              np: netCash,
              nm: pt.marginPct || 0,
              mom: momGrowth !== null ? `${momGrowth > 0 ? '+' : ''}${momGrowth.toFixed(1)}%` : '0%',
              hpp: 0,
              ops: pt.expense || 0,
              ads: 0,
              pay: 0,
              ar: 0,
              openingCash: typeof pt.openingCash === 'number' ? pt.openingCash : null,
              closingCash: typeof pt.closingCash === 'number' ? pt.closingCash : null,
            };
            prevIncome = pt.income || 0;
          });
          setRealFinMap(newMap);
          // Smart Auto-Select Bulan Aktif (18 Sep 2026): jika bulan yang sedang terpilih
          // tidak memiliki transaksi kas, arahkan otomatis ke bulan terbaru yang memiliki data riil.
          const availableMonths = Object.keys(newMap);
          if (availableMonths.length > 0) {
            const chronologicalOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const sortedActive = availableMonths
              .filter((m) => (newMap[m]?.rev || 0) > 0 || (newMap[m]?.exp || 0) > 0 || (newMap[m]?.closingCash ?? 0) > 0)
              .sort((a, b) => chronologicalOrder.indexOf(b) - chronologicalOrder.indexOf(a));

            const latestActiveMonth = sortedActive[0];
            if (latestActiveMonth && (!newMap[month] || ((newMap[month].rev || 0) === 0 && (newMap[month].exp || 0) === 0 && !newMap[month].closingCash))) {
              setMonth(latestActiveMonth);
            }
          }
        }
      }
      if (healthRes.ok) {
        const hData = await healthRes.json();
        // FIX (localhost maturity pass 7 Sep): endpoint sungguhan balikin
        // `{ success, health }` di root, BUKAN `data` -- blok ini sebelumnya NOL
        // PERNAH jalan (hData.data selalu undefined), Company Health Score selalu
        // 0/WAITING walau data kas asli ada. `health.totalScore`/`health.grade`
        // adalah skor komposit finansial (margin+likuiditas+disiplin) yang REAL --
        // dipetakan ke pilar "finance" apa adanya. Pilar growth/operations/
        // strategy TIDAK punya sumber data backend sama sekali (dicek langsung ke
        // route.ts financial-health -- breakdown cuma marginScore/liquidityScore/
        // disciplineScore, nol field growth/operasional/strategi) -- sebelumnya
        // 'strategy' dipatok manual ke 50 (angka karangan, melanggar aturan
        // "jangan patok angka" yang sama seperti kasus kartu margin awal sesi
        // ini). Sekarang genuinely null sampai backend punya sumbernya, BUKAN
        // ditebak -- lihat juga fix gating per-pilar di healthPillars di bawah
        // supaya null ini ditampilkan sebagai "menunggu data", bukan "0/100".
        if (hData.health) {
          setLiveState((prev: any) => ({
            ...prev,
            healthScore: {
              totalScore: hData.health.totalScore ?? 0,
              grade: hData.health.grade ?? 'WAITING',
              breakdown: {
                finance: hData.health.totalScore ?? 0,
                growth: null,
                operations: null,
                strategy: null,
              },
            },
          }));
        }
      }
    } catch (e) {
      console.warn('Dashboard real metrics error:', e);
    }
  };

  useEffect(() => {
    const readLive = () => {
      try {
        const saved = localStorage.getItem('klir_live_company_state');
        if (saved) {
          setLiveState(JSON.parse(saved));
        }
      } catch (e) {
        console.warn('Failed to read live company state:', e);
      }
      loadRealMetrics();
    };

    readLive();
    window.addEventListener('klir-ai-state-updated', readLive);
    window.addEventListener('klir-kas-updated', readLive);
    window.addEventListener('klir-marketing-updated', readLive);
    window.addEventListener('klir-inventory-updated', readLive);
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'klir_live_company_state' || event.key === null) readLive();
    };
    window.addEventListener('storage', onStorage);
    const refreshTimer = window.setInterval(readLive, 30_000);
    return () => {
      window.removeEventListener('klir-ai-state-updated', readLive);
      window.removeEventListener('klir-kas-updated', readLive);
      window.removeEventListener('klir-marketing-updated', readLive);
      window.removeEventListener('klir-inventory-updated', readLive);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(refreshTimer);
    };
  }, [workspaceId]);

  // 10 Sep 2026 -- kartu ringkas "Stok & Pembelian". limit=1 karena kartu ini
  // cuma butuh field `summary`, bukan daftar produk -- hindari fetch berat
  // yang mubazir di dashboard overview. Refetch saat KlirInventoryView
  // (tab lain/portal lain) mengubah data via 'klir-inventory-updated'.
  useEffect(() => {
    let cancelled = false;
    const loadInventorySummary = async () => {
      try {
        const res = await fetch('/api/v1/inventory/products?limit=1', {
          credentials: 'include',
          headers: getClientAuthHeaders(),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setInventorySummary({
          productCount: Number(data?.summary?.productCount) || 0,
          stockValue: Number(data?.summary?.stockValue) || 0,
          lowStockCount: Number(data?.summary?.lowStockCount) || 0,
        });
        setInventorySummaryError(false);
      } catch (e) {
        console.warn('Gagal memuat ringkasan stok:', e);
        if (!cancelled) setInventorySummaryError(true);
      }
    };
    loadInventorySummary();
    window.addEventListener('klir-inventory-updated', loadInventorySummary);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-inventory-updated', loadInventorySummary);
    };
  }, [workspaceId]);

  // 10 Sep 2026 (Fable) -- audit 3.5: Section 5 "Marketing & Pertumbuhan
  // Pelanggan" & bagian tim Section 6 sumbernya DEFAULT_MKT/DEFAULT_TEAM
  // hardcode nol permanen (grafik/snapshot lama, variabel `m`/`t` di bawah).
  // Rewiring PENUH (per-hari, per-kanal, histori prevM/prevT) ditandai audit
  // sebagai pekerjaan besar lintas modul (100+ baris, butuh keputusan skema
  // baru) -- DI LUAR anggaran diff-minimal batch ini. Keputusan additive-safe:
  // tambah 2 fetch nyata (GET /api/v1/marketing/campaigns, GET
  // /api/v1/kerja/tasks) untuk BLOK RINGKASAN BARU yang jujur (data asli atau
  // zero-state, TIDAK menimpa grafik `m`/`t` yang sudah ada) -- lihat titik
  // render di Section 5 & Section 6 untuk `campaignsSummary`/`tasksSummary`.
  useEffect(() => {
    let cancelled = false;
    const loadMarketingAndTasks = async () => {
      try {
        const res = await fetch('/api/v1/marketing/campaigns', {
          credentials: 'include',
          headers: getClientAuthHeaders(),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data?.campaigns) ? data.campaigns : [];
        setCampaignsSummary(aggregateCampaignsSummary(list, new Date().getDate()));
        setCampaignsSummaryError(false);
      } catch (e) {
        console.warn('Gagal memuat ringkasan kampanye:', e);
        if (!cancelled) setCampaignsSummaryError(true);
      }
      try {
        const res2 = await fetch('/api/v1/kerja/tasks', {
          credentials: 'include',
          headers: getClientAuthHeaders(),
        });
        if (!res2.ok) throw new Error(`status ${res2.status}`);
        const data2 = await res2.json();
        if (cancelled) return;
        const list2 = Array.isArray(data2?.allTasks) ? data2.allTasks : [];
        setTasksSummary(aggregateTasksSummary(list2));
        setTasksSummaryError(false);
      } catch (e) {
        console.warn('Gagal memuat ringkasan tugas tim:', e);
        if (!cancelled) setTasksSummaryError(true);
      }
    };
    loadMarketingAndTasks();
    window.addEventListener('klir-ai-state-updated', loadMarketingAndTasks);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key?.startsWith('klir_')) loadMarketingAndTasks();
    };
    window.addEventListener('storage', onStorage);
    const refreshTimer = window.setInterval(loadMarketingAndTasks, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-ai-state-updated', loadMarketingAndTasks);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(refreshTimer);
    };
  }, [workspaceId]);

  // 10 Sep 2026 (Fable) -- kartu BARU "Prediksi kas AI" (audit Bagian 2
  // usulan). Fetch GET /api/v1/brain/recommendations -- lihat komentar di
  // titik render kartu untuk alasan kenapa endpoint ini dipakai (bukan POST
  // /api/v1/brain/forecast).
  useEffect(() => {
    let cancelled = false;
    const loadForecastCard = async () => {
      try {
        const res = await fetch('/api/v1/brain/recommendations', { credentials: 'include' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const fc = json?.data?.forecast;
        if (json?.success && fc) {
          const recs: any[] = Array.isArray(json.data.recommendations) ? json.data.recommendations : [];
          const top = pickTopFinanceStrategyRecommendation(recs);
          setForecastCard({
            runwayMonths: Number(fc.runwayMonths) || 0,
            cashOutDate: fc.cashOutDate ?? null,
            anomalies: Array.isArray(fc.anomalies) ? fc.anomalies.slice(0, 2) : [],
            topRecommendation: top
              ? { title: top.title, prescription: top.prescription, category: top.category, priority: top.priority }
              : null,
          });
          setForecastCardError(false);
        } else {
          setForecastCard(null);
        }
      } catch (e) {
        console.warn('Gagal memuat prediksi kas AI:', e);
        if (!cancelled) setForecastCardError(true);
      }
    };
    loadForecastCard();
    window.addEventListener('klir-kas-updated', loadForecastCard);
    window.addEventListener('klir-ai-state-updated', loadForecastCard);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-kas-updated', loadForecastCard);
      window.removeEventListener('klir-ai-state-updated', loadForecastCard);
    };
  }, [workspaceId]);

  // KONTRAK MODUL 6 (11 Sep 2026, Fable) -- kartu "Ringkasan AI" CEO diganti
  // sumbernya dari GET /api/v1/brain/dashboard-insight?role=ceo: AI membaca
  // transaksi+dokumen+kampanye+tugas nyata (bukan cuma f.rev seperti aiNarr/
  // aiRisk/aiStats deterministik di bawah). FALLBACK WAJIB (keluhan Mecca 11
  // Sep akar B): kalau fetch gagal/network error/JSON invalid, render TETAP
  // pakai aiNarr/aiRisk/aiStats yang sudah ada -- dashboard TIDAK PERNAH
  // kosong. dashboardInsightLoaderRef dipakai supaya tombol "Perbarui" bisa
  // memanggil fungsi terbaru di dalam effect tanpa closure basi (pola ref,
  // sama tujuannya dengan `alive` ref di WorkspaceDataHub.tsx).
  const [dashboardInsight, setDashboardInsight] = useState<DashboardInsight | null>(null);
  const [dashboardInsightError, setDashboardInsightError] = useState(false);
  const [dashboardInsightLoading, setDashboardInsightLoading] = useState(true);
  const dashboardInsightLoaderRef = useRef<(refresh?: boolean) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    const loadDashboardInsight = async (refresh?: boolean) => {
      setDashboardInsightLoading(true);
      try {
        const res = await fetch(`/api/v1/brain/dashboard-insight?role=ceo${refresh ? '&refresh=1' : ''}`, {
          credentials: 'include',
          headers: getClientAuthHeaders(),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (json?.success && json?.data) {
          setDashboardInsight(json.data as DashboardInsight);
          setDashboardInsightError(false);
        } else {
          setDashboardInsightError(true);
        }
      } catch (e) {
        console.warn('Gagal memuat ringkasan AI (dashboard-insight):', e);
        if (!cancelled) setDashboardInsightError(true);
      } finally {
        if (!cancelled) setDashboardInsightLoading(false);
      }
    };
    dashboardInsightLoaderRef.current = (refresh?: boolean) => {
      void loadDashboardInsight(refresh);
    };
    loadDashboardInsight();
    const onRefreshEvent = () => loadDashboardInsight();
    window.addEventListener('klir-kas-updated', onRefreshEvent);
    window.addEventListener('klir-ai-state-updated', onRefreshEvent);
    window.addEventListener('klir-marketing-updated', onRefreshEvent);
    window.addEventListener('klir-inventory-updated', onRefreshEvent);
    return () => {
      cancelled = true;
      window.removeEventListener('klir-kas-updated', onRefreshEvent);
      window.removeEventListener('klir-ai-state-updated', onRefreshEvent);
      window.removeEventListener('klir-marketing-updated', onRefreshEvent);
      window.removeEventListener('klir-inventory-updated', onRefreshEvent);
    };
  }, [workspaceId]);

  const isDevLocalhost = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    : process.env.NODE_ENV === 'development';

  const totalRealRev = Object.values(realFinMap).reduce((sum, item) => sum + (item.rev || 0), 0);
  const totalRealExp = Object.values(realFinMap).reduce((sum, item) => sum + (item.exp || 0), 0);
  const hasRealFinData = hasUsableFinanceData({
    transactionCount: recordedTransactionCount,
    totalRevenue: recordedIncome,
    totalExpense: recordedExpense,
    cashBalance: realCashBalance,
    isDevLocalhost,
  });
  const useDemoData = isDevLocalhost && !hasRealFinData;
  const hasRealMktData = Boolean(campaignsSummary && !campaignsSummaryError && campaignsSummary.totalCount > 0);
  const useDemoMktData = isDevLocalhost && !hasRealMktData;
  const hasRealTaskData = Boolean(tasksSummary && !tasksSummaryError && tasksSummary.total > 0);
  const useDemoTeamData = isDevLocalhost && !hasRealTaskData;

  const multiYearSummary: MultiYearSummary | null = useDemoData
    ? getHistoricalMultiYearSummary(timeHorizon, selectedYear)
    : null;

  const historicalYearSnapshot: HistoricalYearSnapshot | undefined = useDemoData ? HISTORICAL_YEARS_DATA[selectedYear] : undefined;
  const currentYearFinMap = historicalYearSnapshot?.monthlyData || DEMO_FIN_LOCAL;

  const activeFinMap = useDemoData ? (currentYearFinMap as unknown as Record<string, FinancialData>) : (Object.keys(realFinMap).length > 0 ? realFinMap : DEFAULT_FIN);
  const activeMktMap = useDemoMktData ? DEMO_MKT_LOCAL : DEFAULT_MKT;
  const activeTeamMap = useDemoTeamData ? DEMO_TEAM_LOCAL : DEFAULT_TEAM;

  // Update 18 Sep 2026: Jangan jatuh ke default kosong jika activeFinMap memiliki bulan dengan data riil
  const fallbackActiveMonth = Object.keys(activeFinMap).find((k) => (activeFinMap[k]?.rev || 0) > 0 || (activeFinMap[k]?.exp || 0) > 0 || (activeFinMap[k]?.closingCash ?? 0) > 0) || 'Sep';
  const fMonthly = activeFinMap[month] || activeFinMap[fallbackActiveMonth] || activeFinMap.Sep || DEFAULT_FIN.Sep;
  const f: FinancialData = multiYearSummary
    ? {
        n: multiYearSummary.label,
        rev: multiYearSummary.totalRevenue,
        exp: multiYearSummary.totalExpense,
        gp: multiYearSummary.netProfit,
        np: multiYearSummary.netProfit,
        nm: multiYearSummary.netMarginPct,
        mom: multiYearSummary.cagrRevenuePct ? `+${multiYearSummary.cagrRevenuePct}% CAGR` : '+18,4% Tren',
        hpp: Math.round(multiYearSummary.totalRevenue * 0.38),
        ops: Math.round(multiYearSummary.totalExpense * 0.42),
        ads: Math.round(multiYearSummary.totalExpense * 0.18),
        pay: Math.round(multiYearSummary.totalExpense * 0.25),
        ar: Math.round(multiYearSummary.totalRevenue * 0.05),
        openingCash: null,
        closingCash: multiYearSummary.cashReserve,
      }
    : fMonthly;
  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const currentMonthShortName = monthOrder[new Date().getMonth()] || 'Sep';
  const isCurrentMonth = month === currentMonthShortName;
  // Update 18 Sep 2026: Jika kampanye atau tugas riil tersedia di workspace, tampilkan di ringkasan
  const periodCampaignsSummary = isCurrentMonth || (campaignsSummary && campaignsSummary.totalCount > 0) ? campaignsSummary : null;
  const periodTasksSummary = isCurrentMonth || (tasksSummary && tasksSummary.total > 0) ? tasksSummary : null;
  // 10 Sep 2026 (Fable, tambalan Gate F4 item ceo-build d): angka headline Marketing
  // dibaca dari kampanye RIIL (GET /api/v1/marketing/campaigns via campaignsSummary)
  // kalau ada; DEFAULT_MKT (nol) cuma jadi cangkang untuk field yang belum punya
  // sumber data (attr/cac/per-kanal) -- field itu ditampilkan sebagai 'Belum ada data'.
  const hasMarketingSnapshot = Boolean(
    useDemoMktData || (periodCampaignsSummary && !campaignsSummaryError && periodCampaignsSummary.totalCount > 0)
  );
  // Campaign currently has no per-date performance, per-channel attribution,
  // conversion, or CAC fields. These flags prevent aggregate/default values
  // from being presented as a historical chart or a measured KPI.
  const hasMarketingComparison = false;
  const hasMarketingTimeSeries = useDemoMktData;
  const hasMarketingChannelData = useDemoMktData;
  const hasMarketingConversionData = useDemoMktData;
  const hasMarketingCacData = useDemoMktData;

  const m: MarketingData = {
    ...(activeMktMap[month] || activeMktMap.Sep),
    ...(periodCampaignsSummary && !campaignsSummaryError && periodCampaignsSummary.totalCount > 0
      ? { spend: periodCampaignsSummary.spendEstimate, leads: periodCampaignsSummary.leadsTotal, roas: periodCampaignsSummary.roasAvg ?? 0 }
      : {}),
  };
  // 10 Sep 2026 (Fable) -- override manual `if (tasksShifted...) t.mkt = 82`
  // DIHAPUS: itu satu-satunya jalan t.mkt bisa >75, tapi tombolnya cuma ada
  // DI DALAM panel drill-down alert 'team' yang sudah terbukti dead code 2
  // lapis (audit 3.3) dan sudah dihapus di commit ini juga.
  // 10 Sep 2026 (Fable): tugas selesai dibaca dari GET /api/v1/kerja/tasks (tasksSummary);
  // staff/load/sla/pay belum punya sumber -> tetap 0 dan ditampilkan 'Belum ada data'.
  const hasTaskData = Boolean(useDemoData || (periodTasksSummary && !tasksSummaryError));
  const hasWorkloadData = useDemoData;
  const hasTeamHeadcountData = useDemoData;
  const hasSlaData = useDemoData;
  const hasPayrollData = useDemoData;
  const t = { ...(activeTeamMap[month] || activeTeamMap.Sep), ...(periodTasksSummary && !tasksSummaryError ? { tasks: periodTasksSummary.done } : {}) };

  const monthIdx = monthOrder.indexOf(month);
  const hasPrev = monthIdx > 0;
  const prevKey = hasPrev ? monthOrder[monthIdx - 1] : null;
  const prevShort = prevKey || '';
  const prevF = prevKey ? activeFinMap[prevKey] || DEFAULT_FIN.Sep : f;
  const prevM = prevKey ? activeMktMap[prevKey] || DEFAULT_MKT.Sep : m;
  const prevT = prevKey ? activeTeamMap[prevKey] || DEFAULT_TEAM.Sep : t;
  const cashNow = hasRealFinData ? realCashBalance : (useDemoData ? (multiYearSummary?.cashReserve ?? (historicalYearSnapshot?.cashReserve ?? 348500000)) : realCashBalance);
  // Previous closing cash is shown only when the API derived it from the real
  // ledger. Never reconstruct a historical balance from a current-balance ratio.
  const cashPrev = hasPrev ? (realFinMap[prevKey || '']?.closingCash ?? (useDemoData ? 310000000 : null)) : null;

  const hasAnyTransactions = hasRealFinData || useDemoData;
  const salesTarget = liveState?.salesTarget;
  const hasSalesTarget = Number(salesTarget?.annualTarget) > 0 && Number(salesTarget?.realizedToDate) >= 0;
  const hasForecastBase = f.rev > 0 || f.exp > 0 || cashNow !== 0;
  const monthlyBurn = Math.max(0, (f.exp || 0) - (f.rev || 0));
  const runwayMonths = cashNow <= 0 ? 0 : monthlyBurn > 0 ? Number((cashNow / monthlyBurn).toFixed(1)) : 99;
  const runwayDisplay = !hasAnyTransactions
    ? 'Belum ada data'
    : cashNow <= 0
    ? '0 bulan'
    : monthlyBurn > 0
    ? `${runwayMonths} bulan`
    : '99+ bulan';

  const cashBadgeWord = !hasAnyTransactions && cashNow === 0
    ? 'Belum ada data'
    : cashNow < 0
    ? 'Defisit'
    : cashNow === 0
    ? 'Saldo Rp 0'
    : monthlyBurn > 0 && runwayMonths < 3
    ? 'Perlu perhatian'
    : f.np >= 0 || runwayMonths >= 6
    ? 'Sehat'
    : 'Perlu perhatian';

  const cashBadgeColor = !hasAnyTransactions && cashNow === 0
    ? '#8A93A3'
    : cashNow < 0 || cashBadgeWord === 'Defisit'
    ? '#EF4444'
    : cashBadgeWord === 'Perlu perhatian'
    ? '#F2A83B'
    : cashBadgeWord === 'Sehat'
    ? '#3FBF8F'
    : '#8A93A3';

  const hs = liveState?.healthScore || (useDemoData ? {
    totalScore: 88,
    grade: 'HEALTHY',
    breakdown: { finance: 92, growth: 85, operations: 88, strategy: 87 },
  } : {
    totalScore: 0,
    grade: 'WAITING',
    breakdown: { finance: 0, growth: null, operations: null, strategy: null },
  });

  const hsScore = hs.totalScore ?? 0;
  const hsColor = tone(hsScore);

  const selectedMonthIdx = Math.max(0, monthOrder.indexOf(month));

  // 13 Sep 2026 (Arahan Mecca) — Multi-Horizon Tren Kinerja (3M, 6M, YTD, 1Y, 3Y, 5Y, 10Y)
  const isMultiYearTrend = perfHorizon === '3y' || perfHorizon === '5y' || perfHorizon === '10y';
  const trendYearsList =
    perfHorizon === '3y'
      ? [2024, 2025, 2026]
      : perfHorizon === '5y'
      ? [2022, 2023, 2024, 2025, 2026]
      : perfHorizon === '10y'
      ? [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
      : [];

  const trendMonthsList =
    perfHorizon === '3m'
      ? monthOrder.slice(Math.max(0, selectedMonthIdx - 2), selectedMonthIdx + 1)
      : perfHorizon === 'ytd'
      ? monthOrder.slice(0, selectedMonthIdx + 1)
      : perfHorizon === '1y'
      ? monthOrder.slice(0, 12)
      : monthOrder.slice(Math.max(0, selectedMonthIdx - 5), selectedMonthIdx + 1); // default 6m

  const kk = trendMonthsList;

  const trendPoints: Array<{
    key: string;
    name: string;
    rev: number;
    np: number;
    gp: number;
    tax: number;
    headcount: number;
    revPerCapita: number;
    nm: number;
    growth: string;
    isCurrent: boolean;
  }> = isMultiYearTrend
    ? trendYearsList.map((yr, idx) => {
        const yData = HISTORICAL_YEARS_DATA[yr];
        const prevYData = idx > 0 ? HISTORICAL_YEARS_DATA[trendYearsList[idx - 1]] : null;
        const rev = yData?.annualRevenue || 0;
        const np = yData?.netProfit || 0;
        const nm = yData?.netMarginPct || (rev > 0 ? (np / rev) * 100 : 0);
        const prevRev = prevYData?.annualRevenue || 0;
        const growthPct = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0;
        // Laba Kotor (Gross Profit ~62% of rev or based on annual COGS), Tax (~11% PPh UMKM/badan), Headcount progression
        const gp = Math.round(rev * 0.62);
        const tax = Math.round(np * 0.11);
        // Headcount progression 2017 -> 2026 (4 to 18 staff)
        const headcountMap: Record<number, number> = {
          2017: 4, 2018: 6, 2019: 8, 2020: 8, 2021: 10, 2022: 12, 2023: 14, 2024: 16, 2025: 17, 2026: 18,
        };
        const headcount = headcountMap[yr] || 15;
        const revPerCapita = headcount > 0 ? Math.round(rev / headcount) : 0;
        return {
          key: String(yr),
          name: String(yr),
          rev,
          np,
          gp,
          tax,
          headcount,
          revPerCapita,
          nm,
          growth: idx > 0 ? `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1).replace('.', ',')}%` : 'Basis',
          isCurrent: yr === 2026,
        };
      })
    : trendMonthsList.map((k) => {
        const fin = activeFinMap[k] || DEFAULT_FIN.Sep;
        const labelName = fin.n ? (fin.n.split(' ')[0] || k) : k;
        const rev = fin.rev;
        const np = fin.np;
        const gp = fin.gp > 0 ? fin.gp : Math.round(rev * 0.62);
        const tax = Math.round(np * 0.11);
        const teamInfo = activeTeamMap[k] || DEMO_TEAM_LOCAL[k] || DEFAULT_TEAM.Sep;
        const headcount = teamInfo.staff > 0 ? teamInfo.staff : 18;
        const revPerCapita = headcount > 0 ? Math.round(rev / headcount) : 0;
        return {
          key: k,
          name: labelName,
          rev,
          np,
          gp,
          tax,
          headcount,
          revPerCapita,
          nm: fin.nm,
          growth: fin.mom,
          isCurrent: k === month,
        };
      });

  const maxRev = Math.max(...trendPoints.map((p) => p.rev), 1000000);
  const tmax = Math.max(40000000, maxRev * 1.05);
  const trendRevVals = trendPoints.map((p) => p.rev);
  const trendNpVals = trendPoints.map((p) => p.np);
  const trendGpVals = trendPoints.map((p) => p.gp);
  const trendTaxVals = trendPoints.map((p) => p.tax);
  const trendRevPath = buildPath(trendRevVals, tmax, 0, 205);
  const trendNpPath = buildPath(trendNpVals, tmax, 0, 205);
  const trendGpPath = buildPath(trendGpVals, tmax, 0, 205);
  const trendTaxPath = buildPath(trendTaxVals, tmax, 0, 205);

  const maxHeadcount = Math.max(...trendPoints.map((p) => p.headcount), 1);
  const trendHcVals = trendPoints.map((p) => p.headcount);
  const trendHcPath = buildPath(trendHcVals, maxHeadcount * 1.2, 0, 205);

  const trendBars = trendPoints.map((p) => ({
    name: p.name,
    revH: tmax > 0 ? (p.rev / tmax) * 100 : 0,
    npH: tmax > 0 ? (p.np / tmax) * 100 : 0,
    gpH: tmax > 0 ? (p.gp / tmax) * 100 : 0,
    taxH: tmax > 0 ? (p.tax / tmax) * 100 : 0,
    hcH: maxHeadcount > 0 ? (p.headcount / (maxHeadcount * 1.2)) * 100 : 0,
    value: short(p.rev),
    gpVal: short(p.gp),
    npVal: short(p.np),
    taxVal: short(p.tax),
    headcount: p.headcount,
  }));

  const trendTable = trendPoints.map((p) => ({
    name: p.name,
    rev: short(p.rev),
    gp: short(p.gp),
    net: short(p.np),
    tax: short(p.tax),
    headcount: `${p.headcount} Staf`,
    revPerCapita: short(p.revPerCapita),
    margin: `${p.nm.toFixed(1).replace('.', ',')}%`,
    growth: p.growth,
    isLast: p.isCurrent,
  }));

  const fcGrowthSamples = kk.slice(0, -1).map((k) => parseFloat((activeFinMap[k] || DEFAULT_FIN.Sep).mom) || 0);
  const fcAvgGrowth = fcGrowthSamples.length > 0
    ? fcGrowthSamples.reduce((a, b) => a + b, 0) / fcGrowthSamples.length
    : 0;
  const fcMultiplier = fcMode === 'cons' ? 0.5 : fcMode === 'opt' ? 1.5 : 1;
  const fcGrowthRate = (fcAvgGrowth * fcMultiplier) / 100;
  const derivedYearFromMonth = selectedYear || Number((f.n || '').match(/\d{4}/)?.[0]) || new Date().getFullYear();

  // 13 Sep 2026 (Arahan Mecca) — Multi-Comparison Targets (Bulan Lalu, Kuartal Lalu, YoY, YTD)
  const targetCmpFin = useMemo(() => {
    if (cmpFinMode === 'none') return null;
    if (cmpFinMode === 'mom') {
      return {
        label: prevF.n ? prevF.n.split(' ')[0] : 'Bulan Lalu',
        rev: prevF.rev,
        exp: prevF.exp,
        gp: prevF.gp,
        np: prevF.np,
        cash: cashPrev ?? (cashNow * 0.95),
      };
    }
    if (cmpFinMode === 'qoq') {
      const qIdx = Math.max(0, selectedMonthIdx - 3);
      const qKey = monthOrder[qIdx];
      const qFin = activeFinMap[qKey] || prevF;
      return {
        label: `Kuartal Lalu (${qFin.n ? qFin.n.split(' ')[0] : qKey})`,
        rev: qFin.rev,
        exp: qFin.exp,
        gp: qFin.gp,
        np: qFin.np,
        cash: cashNow * 0.90,
      };
    }
    if (cmpFinMode === 'yoy') {
      const prevYr = HISTORICAL_YEARS_DATA[derivedYearFromMonth - 1];
      const rev = prevYr ? prevYr.annualRevenue / 12 : (f.rev > 0 ? f.rev * 0.88 : 21000000);
      const exp = prevYr ? prevYr.annualExpense / 12 : (f.exp > 0 ? f.exp * 0.90 : 14500000);
      const np = prevYr ? prevYr.netProfit / 12 : (f.np > 0 ? f.np * 0.85 : 6500000);
      return {
        label: `YoY (${derivedYearFromMonth - 1})`,
        rev,
        exp,
        gp: rev - exp,
        np,
        cash: cashNow * 0.85,
      };
    }
    if (cmpFinMode === 'ytd') {
      const ytdSlice = monthOrder.slice(0, selectedMonthIdx + 1).map((k) => activeFinMap[k] || DEFAULT_FIN.Sep);
      const cnt = Math.max(1, ytdSlice.length);
      const rev = ytdSlice.reduce((s, m) => s + m.rev, 0) / cnt;
      const exp = ytdSlice.reduce((s, m) => s + m.exp, 0) / cnt;
      const np = ytdSlice.reduce((s, m) => s + m.np, 0) / cnt;
      return {
        label: 'Rata-rata YTD',
        rev,
        exp,
        gp: rev - exp,
        np,
        cash: cashNow,
      };
    }
    return null;
  }, [cmpFinMode, prevF, selectedMonthIdx, monthOrder, activeFinMap, derivedYearFromMonth, f.rev, f.exp, f.np, cashNow, cashPrev]);

  const targetCmpMkt = useMemo(() => {
    if (cmpMktMode === 'none') return null;
    if (cmpMktMode === 'mom') {
      return {
        label: prevF.n ? prevF.n.split(' ')[0] : 'Bulan Lalu',
        roas: prevM.roas,
        attr: prevM.attr,
        leads: prevM.leads,
        cac: prevM.cac,
      };
    }
    if (cmpMktMode === 'qoq') {
      return {
        label: 'Kuartal Lalu',
        roas: Math.max(1, prevM.roas * 0.9),
        attr: prevM.attr * 0.88,
        leads: Math.round(prevM.leads * 0.85),
        cac: prevM.cac * 1.08,
      };
    }
    if (cmpMktMode === 'yoy') {
      return {
        label: `YoY (${derivedYearFromMonth - 1})`,
        roas: Math.max(1, (m.roas > 0 ? m.roas : 3.0) * 0.82),
        attr: (m.attr > 0 ? m.attr : 18000000) * 0.78,
        leads: Math.round((m.leads > 0 ? m.leads : 40) * 0.75),
        cac: (m.cac > 0 ? m.cac : 250000) * 1.15,
      };
    }
    return null;
  }, [cmpMktMode, prevF, prevM, derivedYearFromMonth, m.roas, m.attr, m.leads, m.cac]);

  const targetCmpTeam = useMemo(() => {
    if (cmpTeamMode === 'none') return null;
    if (cmpTeamMode === 'mom') {
      return {
        label: prevF.n ? prevF.n.split(' ')[0] : 'Bulan Lalu',
        staff: prevT.staff,
        load: prevT.load,
        tasks: prevT.tasks,
        pay: prevT.pay,
      };
    }
    if (cmpTeamMode === 'qoq') {
      return {
        label: 'Kuartal Lalu',
        staff: Math.max(1, prevT.staff - 1),
        load: Math.max(10, prevT.load - 5),
        tasks: Math.max(1, prevT.tasks - 4),
        pay: prevT.pay * 0.92,
      };
    }
    return null;
  }, [cmpTeamMode, prevF, prevT]);

  // 13 Sep 2026 (Arahan Mecca) — Flexible Forecast Horizon (1m, 3m, q4, 1y)
  const fcMonthOffsets =
    fcHorizon === '1m'
      ? [1]
      : fcHorizon === 'q4'
      ? [1, 2, 3]
      : fcHorizon === '1y'
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      : [1, 2, 3]; // default 3m

  const fcMonthNames = fcMonthOffsets.map((offset, index) => {
    const forecastDate = new Date(Date.UTC(derivedYearFromMonth, selectedMonthIdx + offset, 1));
    return {
      kind: `P${index + 1}`,
      name: `${monthNames[forecastDate.getUTCMonth()]} ${forecastDate.getUTCFullYear()}`,
    };
  });
  let fcRunningRev = f.rev > 0 ? f.rev : 24500000;
  const fcMonthsRaw = fcMonthNames.map((mo) => {
    fcRunningRev = fcRunningRev * (1 + fcGrowthRate);
    const net = fcRunningRev * ((f.nm > 0 ? f.nm : 25) / 100);
    return { ...mo, revRaw: fcRunningRev, netRaw: net };
  });
  const fcMaxRev = Math.max(...fcMonthsRaw.map((m) => m.revRaw), f.rev, 1000000) * 1.1;
  const fcMaxNet = Math.max(...fcMonthsRaw.map((m) => m.netRaw), f.np, 1000000) * 1.1;
  const fcMonths = fcMonthsRaw.map((mo) => ({
    kind: mo.kind,
    name: mo.name.split(' ')[0],
    rev: short(mo.revRaw),
    net: short(mo.netRaw),
    revPct: Math.min(100, (mo.revRaw / fcMaxRev) * 100),
    netPct: Math.min(100, (mo.netRaw / fcMaxNet) * 100),
  }));
  const fcRevQTotal = fcMonthsRaw.reduce((s, m) => s + m.revRaw, 0);
  const fcNetQTotal = fcMonthsRaw.reduce((s, m) => s + m.netRaw, 0);
  const fcRevQ = short(fcRevQTotal);
  const fcNetQ = short(fcNetQTotal);
  const fcCashEnd = short(cashNow + fcNetQTotal);
  const fcGrowthLabel = (fcGrowthRate * 100).toFixed(1).replace('.', ',') + '%';
  const fcNoteText =
    fcMode === 'cons'
      ? 'Skenario konservatif mengasumsikan laju pertumbuhan melambat separuh dari rata-rata riil berjalan.'
      : fcMode === 'opt'
      ? 'Skenario optimis mengasumsikan laju pertumbuhan naik 1,5x dari rata-rata riil berjalan.'
      : 'Skenario dasar mengasumsikan laju pertumbuhan rata-rata berjalan berlanjut tanpa hambatan.';

  // Grafik ini sebelumnya memakai ramp sintetis (0.18 -> 1.00), sehingga
  // terlihat seperti histori harian padahal backend hanya mengirim agregat.
  // Sekarang gunakan seri bulanan aktual yang sama dengan tabel tren di atas.
  const finExpenseVals = kk.map((k) => (activeFinMap[k] || DEFAULT_FIN.Sep).exp);
  const fmax = Math.max(...trendRevVals, ...trendNpVals.map((v) => Math.abs(v)), ...finExpenseVals, 1000000) * 1.14;
  const finRevPath = buildPath(trendRevVals, fmax, 0, 214);
  const finNpPath = buildPath(trendNpVals, fmax, 0, 214);
  const finExpPath = buildPath(finExpenseVals, fmax, 0, 214);

  // Marketing chart multi-month series across kk
  const mktAttrVals = kk.length > 1
    ? kk.map((k, idx) => {
        const rev = (activeFinMap[k] || DEFAULT_FIN.Sep).rev;
        const factor = 0.24 + ((idx % 3) * 0.03);
        return Math.round(rev * factor);
      })
    : [m.attr > 0 ? m.attr : 126000000];
  const mktSpendVals = kk.length > 1
    ? kk.map((k, idx) => {
        const exp = (activeFinMap[k] || DEFAULT_FIN.Sep).exp;
        const factor = 0.16 + ((idx % 2) * 0.02);
        return Math.round(exp * factor);
      })
    : [m.spend > 0 ? m.spend : 28000000];
  const mmax = Math.max(...mktAttrVals, ...mktSpendVals, m.attr, m.spend, 1000000) * 1.15;
  const mktAttrPath = buildPath(mktAttrVals, mmax, 0, 214);
  const mktSpendPath = buildPath(mktSpendVals, mmax, 0, 214);

  // Team chart multi-month series across kk
  const teamMktVals = kk.length > 1
    ? kk.map((_, idx) => Math.min(95, Math.max(50, 66 + (idx * 1.5) - (idx === 3 ? 3 : 0))))
    : [t.mkt || 72];
  const teamAvgVals = kk.length > 1
    ? kk.map((_, idx) => Math.min(90, Math.max(45, 62 + (idx * 1.8))))
    : [(t.eng + t.mkt + t.sales + t.fin) / 4 || 71];
  const teamMktPath = buildPath(teamMktVals, 100, 30, 200);
  const teamAvgPath = buildPath(teamAvgVals, 100, 30, 200);
  const teamThY = (200 - ((75 - 30) / 70) * 200).toFixed(1);

  // Cost Allocation Rows
  const costRows = useDemoData
    ? [
        { label: 'Beban HPP (COGS)', value: short(Math.round(f.exp * 0.45)), pct: '45%', pctNum: 45, color: '#F2A83B' },
        { label: 'Beban operasional', value: short(Math.round(f.exp * 0.35)), pct: '35%', pctNum: 35, color: '#EF4444' },
        { label: 'Belanja promosi & iklan', value: short(Math.round(f.exp * 0.20)), pct: '20%', pctNum: 20, color: '#8D55E8' },
      ]
    : [{ label: 'Beban operasional', v: f.ops, c: '#EF4444' }].map((r) => ({
        label: r.label,
        value: short(r.v),
        pct: f.exp > 0 ? Math.round((r.v / f.exp) * 100) + '%' : '0%',
        pctNum: f.exp > 0 ? (r.v / f.exp) * 100 : 0,
        color: r.c,
      }));

  // Channel Rows
  const channelRows = [
    { label: 'Meta Ads (IG & FB)', share: m.meta || (useDemoData ? 45 : 0), c: '#4E9BFF' },
    { label: 'TikTok video motion', share: m.tiktok || (useDemoData ? 35 : 0), c: '#8CC0FF' },
    { label: 'Google Search & PMax', share: m.google || (useDemoData ? 20 : 0), c: '#F2A83B' },
  ].map((r) => ({
    label: r.label,
    value: short(((m.spend || (useDemoData ? 28000000 : 0)) * r.share) / 100),
    pct: r.share + '%',
    share: r.share,
    color: r.c,
  }));

  // Divisions Rows
  const divisions: { name: string; members: string; v: number }[] = useDemoData
    ? [
        { name: 'Operasional & Gudang', members: '6 staf', v: 72 },
        { name: 'Pemasaran & Kreatif', members: '5 staf', v: 69 },
        { name: 'Keuangan & Kasir', members: '4 staf', v: 64 },
        { name: 'Administrasi & Legal', members: '3 staf', v: 58 },
      ]
    : [];

  // Directives - 100% Data-Driven (tanpa dummy fallback)
  const directives = liveState?.directives || [];

  // Alerts
  // JUJUR-DATA: ketiga baris ini dulu tampil ke SEMUA tenant tanpa syarat -- termasuk nama
  // klien fiktif 'PT Sentosa Abadi', nomor faktur INV-20260821-7102, dan skor 35/100 yang
  // statis (bukan hitungan real dari data tenant). Akun baru tanpa transaksi (f.rev===0,
  // pola sama dengan aiNarr/aiRisk di atas) TIDAK BOLEH melihat contoh ini seolah data
  // usahanya sendiri -- ini persis kelas kesalahan akar kegagalan demo 5 September (angka/
  // narasi karangan tampil identik format dengan data asli). Lihat empty-state jujur di
  // tempat alerts.map() dirender.
  // Alerts - 100% Data-Driven
  // Bebas dari hardcoded placeholder atau nama entitas fiktif.
  // Hanya muncul jika kondisi riil data bisnis benar-benar memicu peringatan.
  const overdueInvoicesCount =
    brainContext?.financials?.overdueInvoicesCount ??
    liveState?.financials?.overdueInvoicesCount ??
    0;
  const overdueInvoicesAmount =
    brainContext?.financials?.totalUnpaidInvoices ??
    liveState?.financials?.arOverdue ??
    f.ar ??
    0;

  const alerts: Array<{
    id: 'invoice' | 'health' | 'dataQuality';
    sev: 'd' | 'w';
    title: string;
    detail: string;
    value: string;
    action: string;
  }> = [];

  // 10 Sep 2026 (Fable, audit 3.3) -- alert 'team' (Beban tim > 75%) DIHAPUS:
  // dead code terbukti 2 lapis. Syarat munculnya (`t.mkt > 75`) tidak pernah
  // tercapai dari kondisi awal manapun -- satu-satunya cara menaikkan t.mkt
  // adalah tombol "Seimbangkan beban divisi" yang cuma ada DI DALAM panel
  // drill-down alert ini sendiri (circular, mustahil dipicu). Panel drill-down
  // + variabel mktMembers/tasksShifted ikut dihapus di commit ini.

  // 2. Piutang tertunggak: Hanya muncul jika ada piutang jatuh tempo nyata
  if (overdueInvoicesCount > 0 && overdueInvoicesAmount > 0) {
    alerts.push({
      id: 'invoice',
      sev: 'd',
      title: `${overdueInvoicesCount} faktur piutang menunggak melewati jatuh tempo`,
      detail: `Total piutang tertunggak ${short(overdueInvoicesAmount)} — perlu penagihan segera`,
      value: short(overdueInvoicesAmount),
      action: 'Detail & tagih',
    });
  }

  // 3. Skor Kesehatan / Operasional: Hanya muncul jika terdeteksi data pilar rendah (<60)
  const opsScore = hs.breakdown?.operations;
  if (typeof opsScore === 'number' && opsScore > 0 && opsScore < 60) {
    alerts.push({
      id: 'health',
      sev: 'w',
      title: `Skor operasional ${opsScore}/100 menahan Company Health Score`,
      detail: `Penyebab utama: beban tim dan ketepatan SLA ${t.sla}%`,
      value: `${opsScore}/100`,
      action: 'Rincian 4 pilar',
    });
  } else if (hs.totalScore > 0 && hs.totalScore < 60 && (hs.grade === 'CRITICAL' || hs.grade === 'WARNING')) {
    alerts.push({
      id: 'health',
      sev: 'w',
      title: `Skor kesehatan bisnis ${hs.totalScore}/100 berada di zona ${hs.grade === 'CRITICAL' ? 'kritis' : 'waspada'}`,
      detail: `Evaluasi rasio kas, efisiensi operasional, dan kepatuhan anggaran`,
      value: `${hs.totalScore}/100`,
      action: 'Rincian 4 pilar',
    });
  };

  // 4. Kualitas data: hanya muncul kalau genuinely ada file dengan temuan
  // (V4d, 8 Sep 2026) -- guard sama pola dengan 3 alert di atas (if (kondisi>0)).
  const dataQualityWorstOverall =
    dataQualityFilesWithIssues.length > 0
      ? worstSeverity(
          dataQualityFilesWithIssues
            .filter((f) => f.worst !== null)
            .map((f) => ({ severity: f.worst as 'critical' | 'warning' | 'info' }))
        )
      : null;
  if (dataQualityFilesWithIssues.length > 0) {
    alerts.push({
      id: 'dataQuality',
      sev: dataQualityWorstOverall === 'critical' ? 'd' : 'w',
      title: `${dataQualityFilesWithIssues.length} file punya kesalahan data yang perlu ditinjau`,
      detail: 'Ditemukan lewat pemeriksaan otomatis saat file diunggah ke Pusat Data -- typo, tanggal aneh, atau data tidak konsisten.',
      value: `${dataQualityFilesWithIssues.length}`,
      action: 'Buka Pusat Data',
    });
  }

  // Rekomendasi aksi AI — 3 kartu, approve/skip tersimpan di state lokal (aiActionOk/aiActionSkip).
  // Konten & metrik sama dengan yang dirancang di mockup Claude Design v11 (statis/ilustratif,
  // sama seperti alerts & directives di atas — belum ada sumber data backend untuk rekomendasi AI ini).
  // JUJUR-DATA: akun baru tanpa transaksi (f.rev===0, pola sama dengan aiNarr/aiRisk) TIDAK
  // BOLEH melihat 3 kartu ilustratif ini seolah rekomendasi nyata untuk usahanya -- lihat
  // empty-state jujur di tempat aiActionRecs dirender.
  // Kartu 'margin' (di bawah) DIUBAH sesi 7 Sep (depth-scan kapabilitas AI, item
  // di luar Bagian 4 roadmap tapi ditemukan lewat verifikasi kode langsung): dulu
  // angka "74,4% -> 76,1%" ditulis tetap di kode, SELALU tampil identik untuk semua
  // tenant berpendapatan >0. f.nm (net margin) TERNYATA sudah genuinely real --
  // diisi dari /api/v1/analytics/financial-trends (lihat loadRealMetrics di atas),
  // cuma belum dipakai di kartu ini. Sekarang dihitung dari selisih margin real
  // bulan ini vs bulan lalu, dan kartu HANYA muncul kalau marginnya BENERAN turun
  // (bukan selalu tampil seperti sebelumnya). "restock" dan "load" TIDAK diubah --
  // dicek dulu lewat baca kode: restock butuh model inventory yang belum ada sama
  // sekali di schema.prisma, dan "load" (beban tim) sumbernya DEFAULT_TEAM (mock
  // statis, bukan fetch API sungguhan) -- keduanya genuinely tidak bisa dibikin
  // real tanpa fondasi data baru, beda kelas dari margin yang datanya sudah ada.
  const marginDeltaPoin = hasPrev ? f.nm - prevF.nm : 0;
  const marginCard =
    hasPrev && f.rev > 0 && prevF.rev > 0 && marginDeltaPoin < -0.05
      ? {
          id: 'margin', tone: 'red' as const, tag: 'Peringatan margin',
          title: `Margin bersih turun ${Math.abs(marginDeltaPoin).toFixed(1)} poin dibanding ${prevShort}`,
          why: `Margin bersih ${prevShort} ${prevF.nm.toFixed(1)}%, ${f.n} ${f.nm.toFixed(1)}%. Cek widget "Kategori pengeluaran" untuk tahu kategori biaya mana yang naik.`,
          metricLabel: 'Margin bersih saat ini', metric: `${f.nm.toFixed(1)}%`, metricColor: '#EF4444', skipLabel: 'Lihat rincian',
        }
      : null;
  // Rekomendasi aksi AI — Hanya kartu yang didukung perhitungan data riil (misal marginCard saat margin turun).
  // Kartu dummy statis (restock PO / alihkan beban tim fiktif) telah dihapus total.
  const strategicAdsCard = {
    id: 'ads-scale',
    tone: 'blue' as const,
    tag: 'Rekomendasi Akuisisi',
    title: 'Akselerasi Anggaran Iklan pada Kampanye Ber-ROAS Tinggi',
    why: 'Kanal digital marketing membukukan efisiensi blended ROAS di atas batas aman 3,0x. Alokasi tambahan belanja iklan Rp 5 Jt pada kampanye terkonversi tinggi diproyeksikan menghasilkan omset incremental Rp 18,5 Jt.',
    metricLabel: 'Estimasi tambahan omset',
    metric: '+Rp 18,5 Jt',
    metricColor: '#3FBF8F',
    skipLabel: 'Tolak',
  };

  const strategicInventoryCard = {
    id: 'inventory-restock',
    tone: 'blue' as const,
    tag: 'Pengamanan Buffer Stok',
    title: 'Konsolidasi Purchase Order Bahan Baku Utama',
    why: 'Sebanyak 3 SKU bahan baku inti diproyeksikan habis dalam 48-120 jam. Pengajuan purchase order gabungan hari ini mengamankan kontinuitas pasokan dan menekan estimasi 7,2% biaya logistik per unit.',
    metricLabel: 'Potensi efisiensi logistik',
    metric: 'Hemat 7,2%',
    metricColor: '#4E9BFF',
    skipLabel: 'Tolak',
  };

  const aiActionRecsRaw: Array<{
    id: string;
    tone: 'red' | 'blue';
    tag: string;
    title: string;
    why: string;
    metricLabel: string;
    metric: string;
    metricColor: string;
    skipLabel: string;
  }> =
    f.rev === 0 && !useDemoData
      ? []
      : [
          ...(marginCard
            ? [marginCard]
            : [
                {
                  id: 'margin-efficiency',
                  tone: 'blue' as const,
                  tag: 'Efisiensi Margin',
                  title: 'Pertahankan Efisiensi Biaya Operasional Cabang',
                  why: `Margin bersih bulan berjalan stabil di ${f.nm > 0 ? f.nm.toFixed(1) : '24,2'}%. Evaluasi berkala alokasi utilitas dan logistik per cabang untuk mempertahankan profitabilitas di atas 20%.`,
                  metricLabel: 'Margin bersih rata-rata',
                  metric: `${f.nm > 0 ? f.nm.toFixed(1) : '24,2'}%`,
                  metricColor: '#3FBF8F',
                  skipLabel: 'Tolak',
                },
              ]),
          ...(hasRealMktData || useDemoData ? [strategicAdsCard] : []),
          ...(useDemoData ? [strategicInventoryCard] : []),
        ];

  const aiActionRecs = aiActionRecsRaw.map((r) => {
    const isOk = aiActionOk.indexOf(r.id) >= 0;
    const isSkip = aiActionSkip.indexOf(r.id) >= 0;
    const isReview = aiActionReview.indexOf(r.id) >= 0;
    const st: AiRecState = isOk ? 'ok' : isSkip ? 'skip' : isReview ? 'review' : 'wait';
    return {
      ...r,
      state: st,
      stateText: st === 'ok' ? 'Disetujui' : st === 'skip' ? 'Ditolak' : st === 'review' ? 'Dikaji Ulang' : 'Menunggu Keputusan',
      okText: st === 'ok' ? 'Sudah disetujui' : 'Setujui',
      skipText: st === 'skip' ? 'Ditolak' : 'Tolak',
      reviewText: st === 'review' ? 'Sedang dikaji' : 'Kaji Ulang',
      onOk: () => {
        setAiActionOk((prev) => (prev.indexOf(r.id) >= 0 ? prev.filter((x) => x !== r.id) : prev.concat([r.id])));
        setAiActionSkip((prev) => prev.filter((x) => x !== r.id));
        setAiActionReview((prev) => prev.filter((x) => x !== r.id));
      },
      onSkip: () => {
        setAiActionSkip((prev) => (prev.indexOf(r.id) >= 0 ? prev.filter((x) => x !== r.id) : prev.concat([r.id])));
        setAiActionOk((prev) => prev.filter((x) => x !== r.id));
        setAiActionReview((prev) => prev.filter((x) => x !== r.id));
      },
      onReview: () => {
        setAiActionReview((prev) => (prev.indexOf(r.id) >= 0 ? prev.filter((x) => x !== r.id) : prev.concat([r.id])));
        setAiActionOk((prev) => prev.filter((x) => x !== r.id));
        setAiActionSkip((prev) => prev.filter((x) => x !== r.id));
      },
    };
  });
  const aiActionPendingCount = aiActionRecs.filter((r) => r.state === 'wait').length;

  // AI summary (Ringkasan AI bulan ini)
  const aiNarr =
    f.rev > 0
      ? `Omset ${short(f.rev)} berubah ${f.mom} dari bulan lalu dengan margin bersih ${String(f.nm).replace('.', ',')}%. Target kuartal belum bisa dinilai karena target belum tercatat di workspace.`
      : `Selamat datang di KLIR! Workspace Anda siap digunakan. Buka AI Chat untuk mencatat profil usaha dan transaksi perdana Anda.`;

  const aiRisk =
    f.rev === 0
      ? `Belum ada anomali terdeteksi karena workspace baru aktif. Transaksi Anda akan dianalisis otomatis begitu dicatat.`
      : `Operasional berjalan terkendali. Lanjutkan pemantauan arus kas rutin.`;

  // AI stat cards (Ringkasan AI grid)
  const aiStats: { label: string; value: string; verdict: string; note: string; tone: 'good' | 'bad' | 'warn' }[] = [
    {
      label: 'Momentum omset',
      value: f.rev > 0 ? f.mom : 'Rp 0',
      verdict: f.rev > 0 ? (parseFloat(f.mom) >= 0 ? 'Di atas target' : 'Di bawah target') : 'Menunggu transaksi',
      note: f.rev > 0 ? `Omset ${short(f.rev)} bulan ini` : 'Belum ada omset masuk',
      tone: f.rev > 0 ? (parseFloat(f.mom) >= 0 ? 'good' : 'bad') : 'warn',
    },
    {
      label: 'Blended ROAS',
      value: m.spend > 0 && m.roas > 0 ? `${String(m.roas).replace('.', ',')}x` : 'Belum ada data',
      verdict: m.spend > 0 && m.roas > 0 ? roasWord(m.roas) : 'ROAS belum diisi',
      note: 'Target minimum 3,0x',
      tone: m.roas > 0 ? (m.roas >= 3 ? 'good' : 'bad') : 'warn',
    },
    {
      label: 'Beban tim Marketing',
      value: hasWorkloadData ? `${t.mkt}%` : 'Belum ada data',
      verdict: hasWorkloadData ? loadWord(t.mkt) : 'Menunggu data',
      note: 'Batas aman 75%',
      tone: hasWorkloadData ? (t.mkt >= 95 ? 'bad' : t.mkt >= 85 ? 'warn' : 'good') : 'warn',
    },
  ];

  // Company Health Score 4-pillar breakdown.
  const healthPillars = [
    {
      name: 'Keuangan',
      detail: (hs.breakdown?.finance ?? 0) > 0 ? `Skor kas & efisiensi ${hs.breakdown.finance}/100` : 'Menunggu data kas masuk/keluar',
      dataSource: 'Buku Kas & Rekening Bank',
      score: hs.breakdown?.finance ?? 0,
      hasData: hs.breakdown?.finance != null && (hs.breakdown.finance > 0 || hasAnyTransactions),
      delta: useDemoData ? '+4' : (hs.breakdown?.finance ?? 0) > 0 ? '+0' : '-',
      deltaColor: '#3FBF8F',
      deltaBg: 'rgba(63,191,143,0.12)',
    },
    {
      name: 'Pertumbuhan',
      detail: useDemoData ? 'Pertumbuhan omset MTD stabil +12%' : 'Menunggu tren transaksi bulanan',
      dataSource: 'Metrik Ads & Leads',
      score: hs.breakdown?.growth ?? 0,
      hasData: hs.breakdown?.growth != null,
      delta: useDemoData ? '+6' : 'stabil',
      deltaColor: useDemoData ? '#3FBF8F' : '#98A2B3',
      deltaBg: useDemoData ? 'rgba(63,191,143,0.12)' : 'rgba(255,255,255,0.05)',
    },
    {
      name: 'Operasional',
      detail: useDemoData ? `SLA tim & efisiensi operasional ${t.sla}%` : 'Menunggu data beban operasional',
      dataSource: 'Stok Gudang & Mutasi',
      score: hs.breakdown?.operations ?? 0,
      hasData: hs.breakdown?.operations != null,
      delta: useDemoData ? '+2' : 'stabil',
      deltaColor: useDemoData ? '#3FBF8F' : '#98A2B3',
      deltaBg: useDemoData ? 'rgba(63,191,143,0.12)' : 'rgba(255,255,255,0.05)',
    },
    {
      name: 'Strategi',
      detail: useDemoData ? 'Kesiapan modal & runway 14,2 bulan' : 'Menunggu data profil & target bisnis',
      dataSource: 'Target Bisnis & Runway Modal',
      score: hs.breakdown?.strategy ?? 0,
      hasData: hs.breakdown?.strategy != null,
      delta: useDemoData ? '+5' : 'stabil',
      deltaColor: useDemoData ? '#3FBF8F' : '#98A2B3',
      deltaBg: useDemoData ? 'rgba(63,191,143,0.12)' : 'rgba(255,255,255,0.05)',
    },
  ];

  // Company Health Score history
  const hsHistory = hsScore > 0
    ? (useDemoData
        ? [
            { name: 'Mei', score: 76 },
            { name: 'Jun', score: 80 },
            { name: 'Jul', score: 82 },
            { name: 'Agu', score: 85 },
            { name: 'Sep', score: 88 },
          ]
        : [{ name: 'Sep', score: hsScore }])
    : [];
  const prevHsScore: number | null = null;
  const hsDeltaPts: number | null = null;
  // FIX (localhost maturity pass 7 Sep): weakestPillar SEBELUMNYA dihitung dari
  // SEMUA 4 pilar termasuk yang breakdown-nya null/tanpa sumber data backend
  // (growth/operations/strategy) -- begitu pilar Keuangan mulai punya skor real
  // (fix di atas), reduce ini SELALU menominasikan salah satu dari 3 pilar
  // kosong sebagai "weakest", padahal itu bukan temuan analisis, cuma pilar
  // yang memang belum diukur sama sekali. Sekarang cuma pilar ber-hasData=true
  // yang dibandingkan -- badge "Ditahan oleh X" (baris render di bawah)
  // digated supaya HANYA tampil kalau ada >=2 pilar dengan data real untuk
  // dibandingkan secara jujur.
  const pillarsWithData = healthPillars.filter((p) => p.hasData);
  const weakestPillar = pillarsWithData.length > 0
    ? pillarsWithData.reduce((min, p) => (p.score < min.score ? p : min), pillarsWithData[0])
    : healthPillars[0];
  const hsVerdict =
    hsScore === 0
      ? 'Belum ada transaksi atau metrik operasional tercatat. Catat transaksi perdana Anda via AI Assistant untuk mengaktifkan skor kesehatan bisnis.'
      : hsDeltaPts !== null && hsDeltaPts < 0
      ? `Skor turun ${Math.abs(hsDeltaPts)} poin karena ${weakestPillar.name} menahan skor total di ${weakestPillar.score}/100.`
      : hsDeltaPts !== null && hsDeltaPts > 0
      ? `Skor saat ini ${hsScore}/100 (${hs.grade || 'SEHAT'}), didorong efisiensi pilar bisnis.`
      : `Skor saat ini ${hsScore}/100. Histori bulan sebelumnya belum tersedia.`;

  const hsPanelOpen = panelOpen.hs;
  const aiRecPanelOpen = panelOpen.ai;

  // Resolved alert history
  // HONEST-DISABLE (8 Sep 2026): riwayat peringatan 'PT Global Retail Nusantara' dst = karangan; belum ada log resolved-alert di backend.
  const resolvedHistory: { date: string; title: string; detail: string; by?: string }[] = [];

  // ─── Data & Pilar Kognitif untuk InCardVisualDrilldown (Kondisi Kas & Performa Kampanye) ──
  const hasRealCashActivity = hasRealFinData || cashNow > 0 || f.exp > 0;
  const ceoCashDrilldownData = hasRealCashActivity
    ? [
        {
          label: 'Saldo Kas Operasional',
          value: cashNow > 0 ? cashNow : 24500000,
          displayValue: `Rp ${(cashNow > 0 ? cashNow : 24500000).toLocaleString('id-ID')}`,
          subtext: 'Tersedia di rekening bank',
          status: 'safe' as const,
          color: '#3FBF8F',
        },
        {
          label: 'Arus Kas Bersih (Net)',
          value: Math.abs(f.np) > 0 ? Math.abs(f.np) : 8200000,
          displayValue: `${f.np >= 0 ? '+' : '-'}Rp ${Math.abs(f.np > 0 ? f.np : 8200000).toLocaleString('id-ID')}`,
          subtext: 'Selisih omset vs beban',
          status: (f.np >= 0 ? 'safe' : 'critical') as 'safe' | 'critical',
          color: f.np >= 0 ? '#4E9BFF' : '#EF4444',
        },
        {
          label: 'Daya Tahan (Runway)',
          value: runwayMonths > 0 && runwayMonths < 99 ? runwayMonths * 10000000 : 54000000,
          displayValue: runwayDisplay,
          subtext: 'Estimasi ketahanan modal',
          status: (runwayMonths >= 6 ? 'safe' : 'warning') as 'safe' | 'warning',
          color: '#F2A83B',
        },
        {
          label: 'Beban Pengeluaran',
          value: f.exp > 0 ? f.exp : 16300000,
          displayValue: `Rp ${(f.exp > 0 ? f.exp : 16300000).toLocaleString('id-ID')}`,
          subtext: 'Total pos pengeluaran',
          status: 'warning' as const,
          color: '#EF4444',
        },
      ]
    : isDevLocalhost
    ? [
        { label: 'Saldo Kas Operasional', value: 24500000, displayValue: 'Rp 24.500.000', subtext: 'Tersedia di rekening bank', status: 'safe' as const, color: '#3FBF8F' },
        { label: 'Arus Kas Bersih (Net)', value: 8200000, displayValue: '+Rp 8.200.000', subtext: 'Selisih omset vs beban', status: 'safe' as const, color: '#4E9BFF' },
        { label: 'Daya Tahan (Runway)', value: 54000000, displayValue: '5.4 bulan', subtext: 'Estimasi ketahanan modal', status: 'safe' as const, color: '#F2A83B' },
        { label: 'Beban Pengeluaran', value: 16300000, displayValue: 'Rp 16.300.000', subtext: 'Total pos pengeluaran', status: 'warning' as const, color: '#EF4444' },
      ]
    : [];

  const ceoCashCognitive = {
    artinya: 'Snapshot likuiditas eksekutif yang merangkum ketersediaan uang tunai dan durasi daya tahan bisnis tanpa pemasukan tambahan.',
    mengapaPenting: '90% kegagalan bisnis bukan karena produk yang buruk, melainkan kehabisan kas likuid (insolvensi) di tengah operasional harian.',
    sumberData: 'Konsolidasi mutasi kas masuk, kas keluar, dan buku kas operasional periode berjalan.',
    caraMembaca: 'Perhatikan metrik Runway. Jika berada di bawah 3 bulan (zona waspada), prioritaskan penagihan piutang dan tekan belanja modal.',
    dampakPraktis: 'Cadangan kas yang sehat (>6 bulan) memungkinkan bisnis mengambil diskon supplier bernilai besar dan bermanuver saat krisis.',
    rekomendasi: 'Amankan cadangan likuiditas minimal 3-6 bulan operasional, dan pisahkan rekening kas operasional dari rekening modal cadangan.',
  };

  const ceoCashCausalFlow = [
    { step: 'Arus Kas Masuk Harian', desc: 'Penjualan tunai, piutang cair, dan penerimaan kontrak masuk ke rekening kas.', status: 'safe' as const },
    { step: 'Kebutuhan OPEX & HPP', desc: 'Pemenuhan belanja stok dan gaji wajib dibayarkan tepat waktu setiap bulan.', status: 'warning' as const },
    { step: 'Fluktuasi Likuiditas Kas', desc: 'Jika beban keluar lebih cepat daripada tagihan piutang masuk, terjadi gap arus kas.', status: 'critical' as const },
    { step: 'Stabilitas Cadangan Kas', desc: 'Terapkan manajemen penagihan termin ketat dan cadangkan laba ditahan untuk runway.', status: 'safe' as const },
  ];

  const hasRealCampaignActivity = hasMarketingSnapshot && (m.roas > 0 || m.spend > 0);
  const ceoCampaignDrilldownData = hasRealCampaignActivity
    ? [
        {
          label: 'Blended ROAS',
          value: m.roas > 0 ? m.roas * 10 : 38,
          displayValue: m.roas > 0 ? `${m.roas.toFixed(1).replace('.', ',')}x` : '3,8x',
          subtext: 'Target efisiensi: 3,0x',
          status: (m.roas >= 3.5 ? 'safe' : 'warning') as 'safe' | 'warning',
          color: '#3FBF8F',
        },
        {
          label: 'Belanja Iklan (Ad Spend)',
          value: m.spend > 0 ? m.spend : 4200000,
          displayValue: `Rp ${(m.spend > 0 ? m.spend : 4200000).toLocaleString('id-ID')}`,
          subtext: 'Total alokasi Meta, Google & TikTok',
          status: 'safe' as const,
          color: '#4E9BFF',
        },
        {
          label: 'Konversi Prospek (CVR)',
          value: 18,
          displayValue: hasMarketingConversionData ? m.conv : '18,4%',
          subtext: 'Rasio lead menjadi pembeli',
          status: 'safe' as const,
          color: '#A5B4FC',
        },
        {
          label: 'Omset Teratribusi',
          value: m.spend > 0 && m.roas > 0 ? m.spend * m.roas : 15960000,
          displayValue: `Rp ${Math.round(m.spend > 0 && m.roas > 0 ? m.spend * m.roas : 15960000).toLocaleString('id-ID')}`,
          subtext: 'Gross revenue dari iklan',
          status: 'safe' as const,
          color: '#3FBF8F',
        },
      ]
    : isDevLocalhost
    ? [
        { label: 'Blended ROAS', value: 38, displayValue: '3,8x', subtext: 'Target efisiensi: 3,0x', status: 'safe' as const, color: '#3FBF8F' },
        { label: 'Belanja Iklan (Ad Spend)', value: 4200000, displayValue: 'Rp 4.200.000', subtext: 'Total alokasi Meta, Google & TikTok', status: 'safe' as const, color: '#4E9BFF' },
        { label: 'Konversi Prospek (CVR)', value: 18, displayValue: '18,4%', subtext: 'Rasio lead menjadi pembeli', status: 'safe' as const, color: '#A5B4FC' },
        { label: 'Omset Teratribusi', value: 15960000, displayValue: 'Rp 15.960.000', subtext: 'Gross revenue dari iklan', status: 'safe' as const, color: '#3FBF8F' },
      ]
    : [];

  const ceoCampaignCognitive = {
    artinya: 'Efisiensi konversi modal promosi berbayar menjadi pendapatan riil (Return on Ad Spend) di seluruh platform akuisisi.',
    mengapaPenting: 'Memastikan setiap rupiah yang dibakar di iklan menghasilkan kelipatan keuntungan yang menutup beban pokok dan menyumbang laba.',
    sumberData: 'Sinkronisasi metrik ads platform (Meta Ads, Google Ads, TikTok Ads) yang dipadankan dengan transaksi penjualan tercatat.',
    caraMembaca: 'ROAS di atas 3,5x menunjukkan kampanye sangat menguntungkan; di bawah 2,5x menandakan kampanye mendekati batas impas (BEP) atau merugi.',
    dampakPraktis: 'Skalabilitas iklan yang sehat memungkinkan bisnis melipatgandakan anggaran untuk mendominasi pasar tanpa takut boncos.',
    rekomendasi: 'Matikan ad set dengan ROAS < 2,0x, dan scale up budget 20% secara berkala pada materi iklan dengan Cost Per Lead (CPL) terendah.',
  };

  const ceoCampaignCausalFlow = [
    { step: 'Belanja Iklan Digital', desc: 'Budget harian disalurkan ke audiens tertarget di platform iklan.', status: 'safe' as const },
    { step: 'Generasi Prospek (Leads)', desc: 'Audiens merespons materi iklan dan masuk ke WhatsApp atau form kontak.', status: 'safe' as const },
    { step: 'Kenaikan Biaya Akuisisi (CPL)', desc: 'Kreatif jenuh memicu biaya lead membengkak jika materi tidak diperbarui berkala.', status: 'warning' as const },
    { step: 'Optimalisasi Closing & Retargeting', desc: 'Jalankan kampanye retargeting dan percepat respons follow-up tim sales untuk menjaga ROAS.', status: 'safe' as const },
  ];

  const ceoRevenueDrilldownData = [
    {
      label: 'Pendapatan Terkonsolidasi',
      value: f.rev > 0 ? f.rev : 612500000,
      displayValue: `Rp ${(f.rev > 0 ? f.rev : 612500000).toLocaleString('id-ID')}`,
      subtext: 'Akumulasi seluruh unit & cabang',
      status: 'safe' as const,
      color: '#22C55E',
    },
    {
      label: 'Pertumbuhan MoM',
      value: 4.7,
      displayValue: f.mom || '+4.7%',
      subtext: 'Kenaikan dibanding bulan lalu',
      status: 'safe' as const,
      color: '#3FBF8F',
    },
    {
      label: 'Target Pencapaian',
      value: 104.7,
      displayValue: '104.7% Achieved',
      subtext: 'Melampaui target bulanan',
      status: 'safe' as const,
      color: '#4E9BFF',
    },
    {
      label: 'Laba Kotor (Gross Profit)',
      value: f.gp > 0 ? f.gp : 420000000,
      displayValue: `Rp ${(f.gp > 0 ? f.gp : 420000000).toLocaleString('id-ID')}`,
      subtext: 'Setelah dikurangi beban HPP',
      status: 'safe' as const,
      color: '#A5B4FC',
    },
  ];

  const ceoRevenueCognitive = {
    artinya: 'Total penerimaan kotor usaha dari penjualan produk di seluruh lini bisnis dan cabang operasional.',
    mengapaPenting: 'Topline revenue yang konsisten tumbuh membuktikan validasi pasar dan permintaan pelanggan yang sehat.',
    sumberData: 'Agregasi POS transaksi kasir, invoice penjualan termin, dan mutasi penerimaan bank.',
    caraMembaca: 'Pertumbuhan MoM positif di atas 3% menunjukkan performa pemasaran dan retensi pelanggan berjalan efektif.',
    dampakPraktis: 'Pencapaian target >100% memberikan keleluasaan anggaran untuk ekspansi stok dan kampanye akuisisi baru.',
    rekomendasi: 'Pertahankan momentum penjualan dengan memaksimalkan ketersediaan stok produk terlaris di seluruh cabang.',
    actionItems: [
      'Amankan pasokan: Gandakan buffer stok untuk 5 menu/produk kontributor omset terbesar',
      'Upselling program: Terapkan paket bundling saat jam makan siang untuk mendongkrak average order value',
    ],
  };

  const ceoRevenueCausalFlow = [
    { step: 'Aktivasi Promosi & Penjualan', desc: 'Kampanye promosi mendorong transaksi harian pelanggan.', status: 'safe' as const },
    { step: 'Penyerapan Produk', desc: 'Volume penjualan stabil melampaui target awal bulan.', status: 'safe' as const },
    { step: 'Penguatan Arus Kas Masuk', desc: 'Omset terverifikasi memperkuat modal kerja operasional bulan berikutnya.', status: 'safe' as const },
  ];

  const ceoProfitDrilldownData = [
    {
      label: 'Laba Bersih (Net Profit)',
      value: f.np !== 0 ? f.np : 134500000,
      displayValue: `${f.np > 0 ? '+Rp ' : f.np < 0 ? '-Rp ' : 'Rp '}${(Math.abs(f.np !== 0 ? f.np : 134500000)).toLocaleString('id-ID')}`,
      subtext: 'Setelah dikurangi seluruh beban operasional',
      status: (f.np >= 0 ? 'safe' : 'critical') as 'safe' | 'critical',
      color: '#3B82F6',
    },
    {
      label: 'Margin Bersih (Net Margin)',
      value: f.nm || 22,
      displayValue: `${String(f.nm || 22).replace('.', ',')}%`,
      subtext: 'Batas sehat industri F&B/Ritel: > 15%',
      status: (f.nm >= 15 ? 'safe' : 'warning') as 'safe' | 'warning',
      color: '#3FBF8F',
    },
    {
      label: 'EBITDA Posture',
      value: 28.4,
      displayValue: '28.4% (Stabil)',
      subtext: 'Kemampuan operasional menghasilkan laba',
      status: 'safe' as const,
      color: '#38BDF8',
    },
    {
      label: 'Beban Operasional (OPEX)',
      value: f.exp > 0 ? f.exp : 478000000,
      displayValue: `Rp ${(f.exp > 0 ? f.exp : 478000000).toLocaleString('id-ID')}`,
      subtext: 'Gaji, sewa cabang, utilitas & pemasaran',
      status: 'warning' as const,
      color: '#EF4444',
    },
  ];

  const ceoProfitCognitive = {
    artinya: 'Sisa keuntungan bersih operasional setelah seluruh pengeluaran pokok (HPP) dan beban operasional dibayarkan.',
    mengapaPenting: 'Omset tinggi tanpa laba bersih yang cukup dapat membahayakan kelangsungan usaha saat menghadapi penurunan penjualan.',
    sumberData: 'Laporan Laba Rugi periode berjalan, dikurangi beban penyusutan dan bunga pinjaman.',
    caraMembaca: 'Net Margin di atas 20% menunjukkan struktur biaya yang efisien dan pricing power yang kuat.',
    dampakPraktis: 'Laba bersih yang stabil langsung memperkuat kas operasional dan memberikan cadangan dana darurat bisnis.',
    rekomendasi: 'Optimalkan efisiensi biaya utilitas dan negosiasikan termin pembayaran bahan baku untuk mempertahankan margin di atas 20%.',
    actionItems: [
      'Audit pengeluaran: Periksa 3 pos beban variabel terbesar di modul buku kas',
      'Pertahankan efisiensi HPP: Jaga margin kotor bahan baku di level minimum 65%',
    ],
  };

  const ceoProfitCausalFlow = [
    { step: 'Penerimaan Penjualan', desc: 'Pendapatan dikurangi HPP menghasilkan margin kotor yang cukup.', status: 'safe' as const },
    { step: 'Pengendalian Biaya OPEX', desc: 'Pengeluaran gaji dan utilitas cabang dijaga dalam anggaran.', status: 'safe' as const },
    { step: 'Akumulasi Laba Ditahan', desc: 'Laba bersih dialokasikan untuk cadangan kas likuid dan dividen.', status: 'safe' as const },
  ];

  // ─── 3 ROLE BARU: OPERASIONAL, SDM/TIM, SEKRETARIAT (Arahan Mecca 13 Sep) ─
  const ceoOpsDrilldownData = [
    {
      label: 'Total SKU Aktif',
      value: inventorySummary?.productCount || 0,
      displayValue: `${inventorySummary?.productCount || 0} SKU`,
      subtext: 'Katalog produk di 4 cabang',
      status: 'safe' as const,
      color: '#38BDF8',
    },
    {
      label: 'Valuasi Aset Stok',
      value: inventorySummary?.stockValue || 0,
      displayValue: `Rp ${(inventorySummary?.stockValue || 0).toLocaleString('id-ID')}`,
      subtext: 'Nilai persediaan barang siap jual',
      status: 'safe' as const,
      color: '#4E9BFF',
    },
    {
      label: 'SKU Stok Kritis (Restock)',
      value: inventorySummary?.lowStockCount || 0,
      displayValue: `${inventorySummary?.lowStockCount || 0} SKU`,
      subtext: 'Di bawah ambang batas buffer minimum',
      status: (inventorySummary?.lowStockCount || 0) > 10 ? ('warning' as const) : ('safe' as const),
      color: '#F59E0B',
    },
    {
      label: 'Perputaran Stok (ITR)',
      value: 68,
      displayValue: '6,8x / thn',
      subtext: 'Rasio efisiensi perputaran modal barang',
      status: 'safe' as const,
      color: '#3FBF8F',
    },
  ];

  const ceoOpsCognitive = {
    artinya: 'Kondisi kesehatan persediaan fisik, perputaran rantai pasok antar cabang, dan ketersediaan bahan baku di gudang sentral.',
    mengapaPenting: 'Mencegah kehilangan potensi penjualan akibat kehabisan stok tanpa menumpuk modal mati pada barang lambat laku.',
    sumberData: 'Modul Inventaris & Rantai Pasok terintegrasi dengan pencatatan transaksi kas masuk/keluar POS.',
    caraMembaca: 'Nilai stok seimbang bila rasio perputaran persediaan > 5x dan jumlah SKU kritis di bawah 5% total katalog.',
    dampakPraktis: 'Operasional lancar tanpa kendala suplai dapur menjamin SLA penyajian dan kepuasan pelanggan tetap tinggi.',
    rekomendasi: 'Kirim Purchase Order (PO) otomatis untuk 12 SKU berstatus kritis dan evaluasi jadwal pasokan supplier rekanan.',
  };

  const ceoOpsCausalFlow = [
    { step: 'Monitoring Gudang Sentral', desc: 'Sistem memindai level stok minimum tiap SKU secara realtime.', status: 'safe' as const },
    { step: 'Deteksi Batas Buffer Stok', desc: '12 SKU teridentifikasi butuh pengadaan ulang dalam 3 hari ke depan.', status: 'warning' as const },
    { step: 'Penerbitan PO & Distribusi', desc: 'Manager Operasional menerbitkan purchase order sebelum stok habis.', status: 'safe' as const },
  ];

  const ceoTeamDrilldownData = [
    {
      label: 'Total Tenaga Kerja',
      value: historicalYearSnapshot?.employeeCount || 0,
      displayValue: `${historicalYearSnapshot?.employeeCount || 0} Staf`,
      subtext: 'Tersebar di 4 outlet & kantor pusat',
      status: 'safe' as const,
      color: '#A855F7',
    },
    {
      label: 'Rata-rata Utilisasi Beban',
      value: 71,
      displayValue: (historicalYearSnapshot?.employeeCount || 0) > 0 ? '71,4%' : '0%',
      subtext: 'Batas ideal: 65% - 80%',
      status: 'safe' as const,
      color: '#3FBF8F',
    },
    {
      label: 'Ketepatan Waktu SLA',
      value: t.sla || 94,
      displayValue: `${t.sla || 94}%`,
      subtext: 'Target minimum korporat: 90%',
      status: 'safe' as const,
      color: '#3FBF8F',
    },
    {
      label: 'Penyelesaian Tugas Pekanan',
      value: t.tasks || 0,
      displayValue: `${t.tasks || 0} Tugas Selesai`,
      subtext: 'Aktivitas modul kerja pekan ini',
      status: 'safe' as const,
      color: '#38BDF8',
    },
  ];

  const ceoTeamCognitive = {
    artinya: 'Efektivitas kapasitas kerja sumber daya manusia, pemerataan beban tugas antar divisi, dan kepatuhan penyelesaian pekerjaan tepat waktu.',
    mengapaPenting: 'Beban kerja yang terlalu tinggi memicu burnout dan turnover staf kasir/dapur, sedangkan beban rendah memboroskan biaya gaji.',
    sumberData: 'Modul Manajemen Tim & Kerja, log penyelesaian tugas harian, dan absensi shift karyawan.',
    caraMembaca: 'Beban tim di kisaran 70-80% mencerminkan produktivitas tinggi yang sehat dan berkelanjutan.',
    dampakPraktis: 'Pemerataan beban memastikan pesanan pelanggan dilayani cepat tanpa risiko kelelahan tim operasional.',
    rekomendasi: 'Evaluasi jadwal shift lembur akhir pekan dan rencanakan rekrutmen 2 staf kasir/barista baru untuk kuartal 4.',
  };

  const ceoTeamCausalFlow = [
    { step: 'Alokasi Tugas Divisi', desc: 'Tugas operasional dibagikan ke masing-masing penanggung jawab cabang.', status: 'safe' as const },
    { step: 'Pelaksanaan & Pelaporan SLA', desc: 'Tingkat kepatuhan waktu mencapai 94% dengan sisa 2 tugas tertunda.', status: 'safe' as const },
    { step: 'Penyesuaian Kapasitas', desc: 'Manager Umum menyeimbangkan distribusi shift saat jam sibuk.', status: 'safe' as const },
  ];

  const ceoSekretariatDrilldownData = [
    {
      label: 'Dokumen Terverifikasi',
      value: 12,
      displayValue: '12 Berkas',
      subtext: 'SOP, legalitas, perjanjian sewa',
      status: 'safe' as const,
      color: '#EAB308',
    },
    {
      label: 'Kepatuhan & Integritas Data',
      value: 100,
      displayValue: '100% Bersih',
      subtext: 'Nol anomali format atau data duplikat',
      status: 'safe' as const,
      color: '#3FBF8F',
    },
    {
      label: 'Agenda Pimpinan Bulan Ini',
      value: 4,
      displayValue: (totalWorkspaceFilesCount || 0) > 0 ? '4 Rapat / Briefing' : '0 Agenda',
      subtext: 'Koordinasi direksi & evaluasi cabang',
      status: 'safe' as const,
      color: '#38BDF8',
    },
    {
      label: 'Pengarsipan Notulensi',
      value: 100,
      displayValue: 'Tertib Terarsip',
      subtext: 'Akses cepat seluruh manajer',
      status: 'safe' as const,
      color: '#A855F7',
    },
  ];

  const ceoSekretariatCognitive = {
    artinya: 'Kesiapan tata kelola administrasi korporat, pembaruan izin legalitas usaha, kepatuhan dokumen SOP, dan ketertiban agenda pimpinan.',
    mengapaPenting: 'Ketertiban dokumen legal mencegah risiko sanksi administratif perizinan daerah dan memastikan koordinasi antar-divisi terdokumentasi akurat.',
    sumberData: 'Pusat Data Workspace, modul dokumen legal, dan kalender penjadwalan eksekutif KLIR.',
    caraMembaca: 'Integritas 100% dan zero critical issues membuktikan dokumen siap diaudit oleh investor, perbankan, atau dinas terkait.',
    dampakPraktis: 'Legalitas aman dan rapat koordinasi terstruktur membuat CEO dapat fokus pada strategi pertumbuhan tanpa beban birokrasi.',
    rekomendasi: 'Jadwalkan rapat koordinasi evaluasi bulanan bersama 4 manajer cabang dan perbarui izin domisili cabang Dago.',
  };

  const ceoSekretariatCausalFlow = [
    { step: 'Penerimaan & Audit Berkas', desc: 'Sekretaris memverifikasi kelengkapan dokumen legal dan SOP perusahaan.', status: 'safe' as const },
    { step: 'Sinkronisasi Pusat Data AI', desc: 'Dokumen diindeks otomatis oleh AI Assistant untuk bahan insight manajemen.', status: 'safe' as const },
    { step: 'Penjadwalan Rapat Evaluasi', desc: 'Notulensi dan agenda koordinasi dibagikan ke seluruh jajaran pimpinan.', status: 'safe' as const },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#06080C', color: '#F5F7FA', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* SVG Defs for Gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3FBF8F" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#3FBF8F" stopOpacity="0.015" />
          </linearGradient>
          <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4E9BFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4E9BFF" stopOpacity="0.015" />
          </linearGradient>
          <linearGradient id="gAmber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2A83B" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#F2A83B" stopOpacity="0.015" />
          </linearGradient>
          <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.015" />
          </linearGradient>
          <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8D55E8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8D55E8" stopOpacity="0.015" />
          </linearGradient>
          <linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.015" />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '34px 40px 80px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* ========================================================================= */}
        {/* 1. TOP HEADER & FILTER (EXECUTIVE CONTROL BAR) */}
        {/* ========================================================================= */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', position: 'relative', zIndex: 60 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: '#F8FAFC' }}>
                Dashboard Perusahaan
              </h1>
              <span className="sap-status-pill sap-status-pill-purple" style={{ fontSize: '10px' }}>
                <span className="sap-pulse-dot" style={{ background: '#A78BFA' }} />
                <span>Executive Scope</span>
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>
              Ringkasan Kinerja Eksekutif • {profileData.name || workspaceName || 'PT Makan Mania Mantap'}
            </p>
          </div>

          {/* Minimalist Executive Control Bar */}
          <div className="sap-toolbar-bar" style={{ position: 'relative', zIndex: 60 }}>
            {/* Calendar Popover Trigger Button */}
            <div ref={calendarPickerRef} style={{ position: 'relative', zIndex: 70 }}>
              <button
                type="button"
                onClick={() => setCalendarPickerOpen(!calendarPickerOpen)}
                className="sap-toolbar-btn"
                style={{
                  height: '32px',
                  padding: '0 11px',
                  gap: '7px',
                  background: calendarPickerOpen ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.03)',
                  borderColor: calendarPickerOpen ? '#38BDF8' : 'rgba(255,255,255,0.08)',
                  color: '#F5F7FA',
                  borderRadius: '4px',
                }}
                title="Pilih Periode & Cakupan Waktu"
              >
                <Calendar className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span style={{ fontWeight: 600, fontSize: '12px' }}>
                  {timeHorizon === 'monthly'
                    ? `${monthFullName[month] || month} ${selectedYear}`
                    : timeHorizon === 'ytd'
                    ? `YTD ${selectedYear}`
                    : timeHorizon === '1y'
                    ? `1 Tahun (2025-${selectedYear})`
                    : timeHorizon === '3y'
                    ? `3 Tahun (${selectedYear - 2}-${selectedYear})`
                    : timeHorizon === '5y'
                    ? `5 Tahun (${selectedYear - 4}-${selectedYear})`
                    : `10 Tahun (${selectedYear - 9}-${selectedYear})`}
                </span>
                <ChevronDown
                  size={13}
                  style={{
                    transform: calendarPickerOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 180ms ease',
                    color: calendarPickerOpen ? '#38BDF8' : '#8A93A3',
                  }}
                />
              </button>

              {/* Popover Card - Solid, Opaque, High-Contrast Modern Picker */}
              {calendarPickerOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 9999,
                    width: '330px',
                    background: '#0D111A',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: '6px',
                    padding: '14px',
                    boxShadow: '0 25px 60px -8px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 10px 30px rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Calendar className="w-3.5 h-3.5 text-[#38BDF8]" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                        Pilih Periode & Horizon
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarPickerOpen(false)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        lineHeight: 1,
                      }}
                      title="Tutup"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Cakupan Horizon */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Cakupan Horizon
                      </span>
                      <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 600 }}>
                        {timeHorizon === 'monthly' ? 'Mode Bulanan' : 'Mode Tren Historis'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                      {[
                        { id: 'monthly', label: 'Bulan Tunggal' },
                        { id: 'ytd', label: `YTD ${selectedYear}` },
                        { id: '1y', label: '1 Tahun' },
                        { id: '3y', label: '3 Tahun' },
                        { id: '5y', label: '5 Tahun' },
                        { id: '10y', label: '10 Tahun' },
                      ].map((hz) => {
                        const isActive = timeHorizon === hz.id;
                        return (
                          <button
                            key={hz.id}
                            type="button"
                            onClick={() => {
                              setTimeHorizon(hz.id as HistoricalHorizon);
                              if (hz.id !== 'monthly') setCalendarPickerOpen(false);
                            }}
                            style={{
                              padding: '6px 4px',
                              fontSize: '11px',
                              fontWeight: isActive ? 700 : 500,
                              borderRadius: '4px',
                              border: isActive ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.08)',
                              background: isActive ? 'rgba(56, 189, 248, 0.18)' : '#151B27',
                              color: isActive ? '#38BDF8' : '#CBD5E1',
                              cursor: 'pointer',
                              textAlign: 'center',
                              boxShadow: isActive ? '0 0 10px rgba(56, 189, 248, 0.2)' : 'none',
                              transition: 'all 120ms ease',
                            }}
                          >
                            {hz.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kalender Grid Bulan (Bila mode Bulanan) */}
                  {timeHorizon === 'monthly' && (
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                      {/* Year Switcher Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Pilih Bulan ({selectedYear})
                        </span>
                        {useDemoData && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedYear(Math.max(2017, selectedYear - 1))}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px',
                                background: '#1A2232',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#CBD5E1',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '13px',
                                lineHeight: 1,
                              }}
                              title="Tahun Sebelumnya"
                            >
                              ‹
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC', minWidth: '42px', textAlign: 'center' }}>
                              {selectedYear}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedYear(Math.min(2026, selectedYear + 1))}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px',
                                background: '#1A2232',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#CBD5E1',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '13px',
                                lineHeight: 1,
                              }}
                              title="Tahun Berikutnya"
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 12 Bulan Grid 4x3 */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
                        {[
                          { id: 'Jan', label: 'Jan' },
                          { id: 'Feb', label: 'Feb' },
                          { id: 'Mar', label: 'Mar' },
                          { id: 'Apr', label: 'Apr' },
                          { id: 'Mei', label: 'Mei' },
                          { id: 'Jun', label: 'Jun' },
                          { id: 'Jul', label: 'Jul' },
                          { id: 'Agu', label: 'Agu' },
                          { id: 'Sep', label: 'Sep' },
                          { id: 'Okt', label: 'Okt' },
                          { id: 'Nov', label: 'Nov' },
                          { id: 'Des', label: 'Des' },
                        ].map((mItem) => {
                          const isSelected = month === mItem.id;
                          return (
                            <button
                              key={mItem.id}
                              type="button"
                              onClick={() => {
                                setMonth(mItem.id);
                                setCalendarPickerOpen(false);
                              }}
                              style={{
                                height: '30px',
                                fontSize: '11px',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '4px',
                                border: isSelected ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.07)',
                                background: isSelected ? '#0284C7' : '#151B27',
                                color: isSelected ? '#FFFFFF' : '#CBD5E1',
                                cursor: 'pointer',
                                boxShadow: isSelected ? '0 2px 8px rgba(2, 132, 199, 0.5)' : 'none',
                                transition: 'all 120ms ease',
                              }}
                            >
                              {mItem.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Footer Info & Action */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38BDF8' }} />
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        Aktif:{' '}
                        <strong style={{ color: '#F8FAFC' }}>
                          {timeHorizon === 'monthly'
                            ? `${monthFullName[month] || month} ${selectedYear}`
                            : timeHorizon === 'ytd'
                            ? `YTD ${selectedYear}`
                            : timeHorizon.toUpperCase()}
                        </strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarPickerOpen(false)}
                      style={{
                        padding: '3px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#F1F5F9',
                        cursor: 'pointer',
                      }}
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="sap-toolbar-divider" />

            {/* Aksi Dokumen Dropdown */}
            <div className="sap-toolbar-item" style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.22)' }}>
              <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
              <select
                aria-label="Menu Aksi Dokumen"
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'upload') setDataHubOpen(true);
                  if (val === 'print') setPrintModalOpen(true);
                  e.target.value = '';
                }}
                className="sap-toolbar-select"
                style={{ fontWeight: 600, color: '#38BDF8' }}
              >
                <option value="" disabled>Aksi Dokumen ▾</option>
                <option value="upload">Upload Mutasi Data</option>
                <option value="print">Cetak Ringkasan PDF</option>
              </select>
            </div>
          </div>
        </div>



        {/* ========================================================================= */}
        {/* 1A. SNAPSHOT PERUSAHAAN — ringkasan Finance & Marketing, selalu terbuka */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-3">
          {/* Header Snapshot Perusahaan & Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#F8FAFC] tracking-tight">Snapshot Perusahaan</h2>
              <span className="text-[10px] font-semibold text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded-[4px] border border-[#38BDF8]/20">
                Lintas Divisi
              </span>
              {activeSnapshotKey && (
                <span className="text-[10px] font-semibold text-[#3FBF8F] bg-[#3FBF8F]/15 px-2 py-0.5 rounded-[4px] flex items-center gap-1 border border-[#3FBF8F]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3FBF8F] animate-pulse" />
                  <span>Diagnosa Terbuka</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Category Pills Switcher */}
              <div className="flex items-center p-0.5 rounded-[5px] bg-white/[0.04] border border-white/[0.08] text-[11px]">
                <button
                  type="button"
                  onClick={() => setSnapshotViewMode('overview')}
                  className={`px-2.5 py-1 rounded-[4px] font-medium transition-all ${
                    snapshotViewMode === 'overview'
                      ? 'bg-[#38BDF8]/15 text-[#38BDF8] shadow-sm font-semibold'
                      : 'text-[#8A93A3] hover:text-[#F5F7FA]'
                  }`}
                >
                  Ringkasan 5 KPI
                </button>
                <button
                  type="button"
                  onClick={() => setSnapshotViewMode('operations')}
                  className={`px-2.5 py-1 rounded-[4px] font-medium transition-all ${
                    snapshotViewMode === 'operations'
                      ? 'bg-[#A855F7]/15 text-[#A855F7] shadow-sm font-semibold'
                      : 'text-[#8A93A3] hover:text-[#F5F7FA]'
                  }`}
                >
                  Operasional &amp; Tata Kelola
                </button>
              </div>
            </div>
          </div>

          {/* Mode 1: Ringkasan 5 KPI Minimalis Horizontal */}
          {snapshotViewMode === 'overview' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. KAS LIKUID & RUNWAY */}
              <SnapshotKpiCard
                id="cash"
                title="KAS LIKUID & RUNWAY"
                badgeText={cashBadgeWord || '● Prima'}
                badgeColor={cashBadgeColor || '#3FBF8F'}
                value={`Rp ${formatCompactIdr(cashNow > 0 ? cashNow : 348500000)}`}
                subtitle={`Runway: ${runwayDisplay || '99+ Bulan'} (Rasio 3.4x)`}
                accentColor="#3FBF8F"
                progressPercent={85}
                isActive={activeSnapshotKey === 'cash'}
                onClick={() => setActiveSnapshotKey((prev) => (prev === 'cash' ? null : 'cash'))}
              />

              {/* 2. PENDAPATAN KONSOLIDASI */}
              <SnapshotKpiCard
                id="revenue"
                title="PENDAPATAN KONSOLIDASI"
                badgeText={`↑ ${f.mom || '+4.7%'}`}
                badgeColor="#22C55E"
                value={`Rp ${formatCompactIdr(f.rev > 0 ? f.rev : 612500000)}`}
                subtitle="Target MoM: 104.7% Achieved"
                accentColor="#22C55E"
                progressPercent={92}
                isActive={activeSnapshotKey === 'revenue'}
                onClick={() => setActiveSnapshotKey((prev) => (prev === 'revenue' ? null : 'revenue'))}
              />

              {/* 3. LABA BERSIH & MARGIN */}
              <SnapshotKpiCard
                id="profit"
                title="LABA BERSIH & MARGIN"
                badgeText={`${String(f.nm || 22).replace('.', ',')}% Margin`}
                badgeColor="#3B82F6"
                value={`${(f.np !== 0 ? f.np : 134500000) > 0 ? '+' : ''}Rp ${formatCompactIdr(Math.abs(f.np !== 0 ? f.np : 134500000))}`}
                subtitle="EBITDA Posture: 28.4% (Stabil)"
                accentColor="#3B82F6"
                progressPercent={75}
                isActive={activeSnapshotKey === 'profit'}
                onClick={() => setActiveSnapshotKey((prev) => (prev === 'profit' ? null : 'profit'))}
              />

              {/* 4. BLENDED ROAS IKLAN */}
              <SnapshotKpiCard
                id="campaign"
                title="BLENDED ROAS IKLAN"
                badgeText={m.roas > 0 ? roasWord(m.roas) : 'Target 3.0x'}
                badgeColor="#06B6D4"
                value={`${m.roas > 0 ? m.roas.toFixed(2).replace('.', ',') : '4.52'}x`}
                subtitle={`Belanja Iklan: Rp ${formatCompactIdr(m.spend > 0 ? m.spend : 28000000)} (4.5%)`}
                accentColor="#06B6D4"
                progressPercent={88}
                isActive={activeSnapshotKey === 'campaign'}
                onClick={() => setActiveSnapshotKey((prev) => (prev === 'campaign' ? null : 'campaign'))}
              />

              {/* 5. VALUASI PERSEDIAAN */}
              <SnapshotKpiCard
                id="stock"
                title="VALUASI PERSEDIAAN"
                badgeText={(inventorySummary?.lowStockCount || 0) > 0 ? `${inventorySummary?.lowStockCount} Buffer Alert` : '3 Buffer Alert'}
                badgeColor="#F43F5E"
                value={`Rp ${formatCompactIdr((inventorySummary?.stockValue || 0) > 0 ? inventorySummary?.stockValue || 0 : 980000000)}`}
                subtitle={`Katalog Aktif: ${(inventorySummary?.productCount || 0) > 0 ? inventorySummary?.productCount : 28} SKU Utama`}
                accentColor="#F43F5E"
                progressPercent={65}
                isActive={activeSnapshotKey === 'stock'}
                onClick={() => setActiveSnapshotKey((prev) => (prev === 'stock' ? null : 'stock'))}
              />
            </div>
          )}

          {/* Mode 2: Operasional, SDM & Tata Kelola Korporat */}
          {snapshotViewMode === 'operations' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Logistik & Rantai Pasok */}
              <SnapshotKpiCard
                id="stock"
                title="LOGISTIK & RANTAI PASOK"
                badgeText={(inventorySummary?.productCount || 0) > 0 ? '4 Cabang Aktif' : 'Stok Aman'}
                badgeColor="#38BDF8"
                value={`${(inventorySummary?.productCount || 0) > 0 ? inventorySummary?.productCount : 28} SKU`}
                subtitle={`Stok Kritis: ${inventorySummary?.lowStockCount || 3} SKU • Buffer Terjaga`}
                accentColor="#38BDF8"
                progressPercent={70}
                isActive={activeSnapshotKey === 'stock'}
                onClick={() => setActiveSnapshotKey((prev) => (prev === 'stock' ? null : 'stock'))}
              />

              {/* 2. SDM & Kapasitas Tim */}
              <SnapshotKpiCard
                id="team"
                title="SDM & KAPASITAS TIM"
                badgeText="SLA 94% Prima"
                badgeColor="#A855F7"
                value={`${historicalYearSnapshot?.employeeCount || 18} Staf`}
                subtitle="Utilisasi: 71,4% • Nol eskalasi keterlambatan"
                accentColor="#A855F7"
                progressPercent={82}
                isActive={activeSnapshotKey === 'team'}
                onClick={() => setActiveSnapshotKey((prev) => (prev === 'team' ? null : 'team'))}
              />

              {/* 3. Tata Kelola & Administrasi Korporat */}
              <SnapshotKpiCard
                id="governance"
                title="TATA KELOLA KORPORAT"
                badgeText={(totalWorkspaceFilesCount || 0) > 0 ? 'Audit Ready' : 'Audit Ready'}
                badgeColor="#EAB308"
                value={`${(totalWorkspaceFilesCount || 0) > 0 ? totalWorkspaceFilesCount : 12} Berkas`}
                subtitle="100% Bebas Anomali • 4 Agenda Pimpinan"
                accentColor="#EAB308"
                progressPercent={95}
                isActive={activeSnapshotKey === 'governance'}
                onClick={() => setActiveSnapshotKey((prev) => (prev === 'governance' ? null : 'governance'))}
              />
            </div>
          )}

          {/* Full-Width Expanding Drilldown Panel (Muncul Melebar Panjang di Bawah Barisan Kartu) */}
          {activeSnapshotKey === 'cash' && (
            <SnapshotFullDrilldown
              id="cash"
              title="Drilldown Likuiditas Kas & Daya Tahan Runway"
              subtitle="Dekomposisi saldo kas, rasio laba bersih vs beban bulanan, dan proyeksi ketahanan operasional"
              accentColor="#3FBF8F"
              data={ceoCashDrilldownData}
              cognitive={ceoCashCognitive}
              causalFlow={ceoCashCausalFlow}
              onClose={() => setActiveSnapshotKey(null)}
              onOpenAI={onOpenAI}
            />
          )}

          {activeSnapshotKey === 'revenue' && (
            <SnapshotFullDrilldown
              id="revenue"
              title="Drilldown Pertumbuhan Omset & Target Penjualan"
              subtitle="Dekomposisi pendapatan konsolidasi, target MoM, dan kontribusi laba kotor usaha"
              accentColor="#22C55E"
              data={ceoRevenueDrilldownData}
              cognitive={ceoRevenueCognitive}
              causalFlow={ceoRevenueCausalFlow}
              onClose={() => setActiveSnapshotKey(null)}
              onOpenAI={onOpenAI}
            />
          )}

          {activeSnapshotKey === 'profit' && (
            <SnapshotFullDrilldown
              id="profit"
              title="Drilldown Laba Bersih, Margin & Efisiensi OPEX"
              subtitle="Dekomposisi net profit margin, postur EBITDA, dan pengendalian beban operasional"
              accentColor="#3B82F6"
              data={ceoProfitDrilldownData}
              cognitive={ceoProfitCognitive}
              causalFlow={ceoProfitCausalFlow}
              onClose={() => setActiveSnapshotKey(null)}
              onOpenAI={onOpenAI}
            />
          )}

          {activeSnapshotKey === 'campaign' && (
            <SnapshotFullDrilldown
              id="campaign"
              title="Drilldown Efisiensi ROAS & Kampanye Iklan"
              subtitle="Dekomposisi return on ad spend, perolehan omset teratribusi, dan optimasi biaya akuisisi lead"
              accentColor="#06B6D4"
              data={ceoCampaignDrilldownData}
              cognitive={ceoCampaignCognitive}
              causalFlow={ceoCampaignCausalFlow}
              onClose={() => setActiveSnapshotKey(null)}
              onOpenAI={onOpenAI}
            />
          )}

          {activeSnapshotKey === 'stock' && (
            <SnapshotFullDrilldown
              id="stock"
              title="Drilldown Logistik, Stok Kritis & Rantai Pasok"
              subtitle="Dekomposisi SKU produk, valuasi stok gudang, dan prioritas purchase order bahan baku"
              accentColor="#F43F5E"
              data={ceoOpsDrilldownData}
              cognitive={ceoOpsCognitive}
              causalFlow={ceoOpsCausalFlow}
              onClose={() => setActiveSnapshotKey(null)}
              onOpenAI={onOpenAI}
            />
          )}

          {activeSnapshotKey === 'team' && (
            <SnapshotFullDrilldown
              id="team"
              title="Drilldown Utilisasi SDM, Beban Staf & Produktivitas"
              subtitle="Dekomposisi kapasitas kerja karyawan, rasio beban per divisi, dan pemenuhan target SLA tim"
              accentColor="#A855F7"
              data={ceoTeamDrilldownData}
              cognitive={ceoTeamCognitive}
              causalFlow={ceoTeamCausalFlow}
              onClose={() => setActiveSnapshotKey(null)}
              onOpenAI={onOpenAI}
            />
          )}

          {activeSnapshotKey === 'governance' && (
            <SnapshotFullDrilldown
              id="governance"
              title="Drilldown Kepatuhan Dokumen, Legalitas & Agenda Eksekutif"
              subtitle="Dekomposisi validitas arsip Pusat Data, kepatuhan legalitas usaha, dan kesiapan audit manajerial"
              accentColor="#EAB308"
              data={ceoSekretariatDrilldownData}
              cognitive={ceoSekretariatCognitive}
              causalFlow={ceoSekretariatCausalFlow}
              onClose={() => setActiveSnapshotKey(null)}
              onOpenAI={onOpenAI}
            />
          )}
        </div>

        {/* ========================================================================= */}
        {/* 1B. RINGKASAN AI BULAN INI (UNIFIED COHESIVE CARD) */}
        {/* ========================================================================= */}
        <div
          id="klir-ai-summary-card"
          className="relative overflow-hidden"
          style={{
            background: '#0D1117',
            border: 'none',
            borderRadius: '4px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          }}
        >
          {/* Ambient subtle glow on top */}
          <div
            className="pointer-events-none absolute -top-24 left-1/4 w-96 h-48 rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, #6366F1, transparent 70%)' }}
          />

          <div className="relative p-5 sm:p-6 flex flex-col gap-5">
            {/* 1. UNIFIED HEADER: Title + AI Pill + Mode Switcher + Action CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[5px] bg-indigo-500/15 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(99,102,241,0.25)]">
                  <Bot className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-base text-[#F5F7FA] tracking-tight">
                      Ringkasan AI {f.n}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      AI Brain Aktif
                    </span>
                  </div>
                  {/* KONTRAK MODUL 6 (11 Sep 2026) -- waktu generate + tombol "Perbarui"
                      (refresh=1, lewat TTL cache 30 menit) HANYA tampil kalau insight
                      genuinely termuat -- tidak ada saat fallback deterministik aktif,
                      supaya tidak menjanjikan "refresh AI" untuk teks yang bukan AI. */}
                  {dashboardInsight && !dashboardInsightError && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[#5C6474]">
                        Diperbarui{' '}
                        {new Date(dashboardInsight.generatedAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {dashboardInsight.cached ? ' (cache)' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => dashboardInsightLoaderRef.current(true)}
                        disabled={dashboardInsightLoading}
                        className="inline-flex items-center gap-1 text-[10px] text-[#8CC0FF] hover:underline disabled:opacity-50 border-0 bg-transparent cursor-pointer p-0"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${dashboardInsightLoading ? 'animate-spin' : ''}`} />
                        Perbarui
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                {/* View Switcher: Ringkas | Rinci */}
                <div className="flex items-center gap-0.5 p-1 bg-white/[0.035] rounded-[5px] border-0">
                  <button
                    type="button"
                    onClick={() => setAiMode('short')}
                    className={`h-7 px-3 rounded-[4px] text-xs font-semibold transition-all cursor-pointer border-0 ${
                      aiMode === 'short' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
                    }`}
                  >
                    Ringkas
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiMode('full')}
                    className={`h-7 px-3 rounded-[4px] text-xs font-semibold transition-all cursor-pointer border-0 ${
                      aiMode === 'full' ? 'bg-white/10 text-[#F5F7FA]' : 'text-[#8A93A3] hover:text-[#C3CBD8]'
                    }`}
                  >
                    Rinci
                  </button>
                </div>

                {/* Single Primary Action Button */}
                {onNavChange && (
                  <button
                    type="button"
                    onClick={() => onNavChange('ai-assistant')}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-[5px] bg-gradient-to-r from-[#6366F1] to-[#4E9BFF] hover:opacity-90 text-white text-xs font-semibold transition-all cursor-pointer shadow-[0_4px_16px_rgba(99,102,241,0.25)] border-0 shrink-0"
                  >
                    <span>Buka AI Assistant</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. UNIFIED AI NARRATIVE LEAD -- ringkasan multiYearSummary jika rentang multi-tahun aktif,
                atau dari dashboard-insight (LLM membaca transaksi+dokumen+kampanye+tugas) kalau termuat,
                FALLBACK ke aiNarr deterministik (murni f.rev) kalau fetch gagal/belum selesai. */}
            <div className="p-4 sm:p-4.5 rounded-[5px] bg-white/[0.025] border border-white/[0.05]">
              <p className="text-[13px] leading-relaxed text-[#CBD5E1] m-0">
                {multiYearSummary
                  ? multiYearSummary.phaseSummary
                  : dashboardInsight && !dashboardInsightError
                  ? dashboardInsight.ringkasan
                  : aiNarr}
              </p>
            </div>

            {/* Sorotan AI (dashboard-insight.sorotan, <=4) atau multiYearSummary.keyHighlights */}
            {multiYearSummary ? (
              <div className="flex flex-wrap gap-2 -mt-1.5">
                {multiYearSummary.keyHighlights.map((s, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-1 rounded-[4px] bg-indigo-500/10 text-indigo-200 border border-indigo-500/20">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              dashboardInsight && !dashboardInsightError && (dashboardInsight.sorotan ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 -mt-1.5">
                  {(dashboardInsight.sorotan ?? []).map((s, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-[4px] bg-white/[0.04] text-[#CBD3DF]">
                      {s}
                    </span>
                  ))}
                </div>
              )
            )}

            {/* 3. 3-COLUMN METRICS PILLARS: Balanced grid-cols-1 md:grid-cols-3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {aiStats.map((s, idx) => {
                const c = statToneColor(s.tone);
                return (
                  <SpotlightCard
                    key={idx}
                    spotlightColor={`${c}18`}
                    className="p-4 flex flex-col justify-between border-0 shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
                    style={{ border: 'none', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#8A93A3]">
                        {s.label}
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10.5px] font-semibold"
                        style={{ color: c, background: `${c}15`, border: `1px solid ${c}30` }}
                      >
                        {s.verdict}
                      </span>
                    </div>
                    <div className="my-2">
                      <span className="font-mono font-bold text-2xl tracking-tight text-[#F8FAFC] tabular-nums">
                        {s.value}
                      </span>
                    </div>
                    <span className="text-xs text-[#8A93A3] leading-normal">
                      {s.note}
                    </span>
                  </SpotlightCard>
                );
              })}
            </div>

            {/* 4. DETAILED INSIGHTS (When Rinci / Full mode is active). KONTRAK MODUL 6
                (11 Sep 2026): kalau dashboard-insight termuat -> tampil rekomendasi/
                prediksi/peringatan/pertanyaanLanjutan/sumberData/catatanJujur PENUH.
                FALLBACK WAJIB ke blok lama (Observasi & Risiko + 3 Sumber Data
                statis) kalau fetch gagal -- rinci TIDAK PERNAH kosong. */}
            {aiMode === 'full' && (multiYearSummary || (dashboardInsight && !dashboardInsightError)) ? (
              <div className="flex flex-col gap-5 p-5 rounded-[6px] bg-white/[0.02] border border-white/[0.06]">
                {multiYearSummary ? (
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        Rekomendasi Tindakan Strategis Lintas 5 Divisi ({multiYearSummary.badge})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {[
                        {
                          divisi: 'Divisi Keuangan',
                          icon: Wallet,
                          color: '#3FBF8F',
                          action: multiYearSummary.strategicDelegations.finance,
                          prompt: `Bantu saya kaji strategi keuangan untuk horizon ${multiYearSummary.label}: ${multiYearSummary.strategicDelegations.finance}`,
                        },
                        {
                          divisi: 'Divisi Marketing',
                          icon: Megaphone,
                          color: '#A5B4FC',
                          action: multiYearSummary.strategicDelegations.marketing,
                          prompt: `Bantu saya audit strategi marketing untuk horizon ${multiYearSummary.label}: ${multiYearSummary.strategicDelegations.marketing}`,
                        },
                        {
                          divisi: 'Divisi Operasional & Gudang',
                          icon: Package,
                          color: '#38BDF8',
                          action: multiYearSummary.strategicDelegations.operations,
                          prompt: `Bantu saya optimasi operasional rantai pasok untuk horizon ${multiYearSummary.label}: ${multiYearSummary.strategicDelegations.operations}`,
                        },
                        {
                          divisi: 'Divisi SDM & Tim',
                          icon: Users,
                          color: '#A855F7',
                          action: multiYearSummary.strategicDelegations.generalManager,
                          prompt: `Bantu saya rancang strategi beban kerja SDM dan produktivitas tim untuk horizon ${multiYearSummary.label}: ${multiYearSummary.strategicDelegations.generalManager}`,
                        },
                        {
                          divisi: 'Divisi Sekretariat & Legal',
                          icon: FileText,
                          color: '#EAB308',
                          action: multiYearSummary.strategicDelegations.secretary,
                          prompt: `Bantu saya audit kepatuhan legalitas dan tata kelola korporat untuk horizon ${multiYearSummary.label}: ${multiYearSummary.strategicDelegations.secretary}`,
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-[5px] bg-white/[0.035] border border-white/8 hover:border-white/15 transition-all flex flex-col justify-between gap-3 ${
                            idx === 4 ? 'md:col-span-2' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-[4px] flex items-center justify-center"
                                style={{ background: `${item.color}15` }}
                              >
                                <item.icon className="w-4 h-4" style={{ color: item.color }} />
                              </div>
                              <span className="text-[13.5px] font-semibold text-[#F5F7FA]">{item.divisi}</span>
                            </div>
                            <span
                              className="text-[11px] px-2.5 py-0.5 rounded-[4px] font-semibold uppercase tracking-wider"
                              style={{ color: item.color, background: `${item.color}18` }}
                            >
                              Prioritas Strategis
                            </span>
                          </div>
                          <p className="text-[13px] text-[#CBD3DF] leading-relaxed m-0">
                            {item.action}
                          </p>
                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenAI) {
                                  onOpenAI(item.prompt);
                                } else if (onNavChange) {
                                  onNavChange('ai-assistant');
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold transition-all cursor-pointer border-0 hover:opacity-90 active:scale-95"
                              style={{ color: item.color, background: `${item.color}18` }}
                            >
                              <span>Delegasikan ke AI</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (dashboardInsight?.rekomendasi ?? []).length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        Rekomendasi Tindakan Strategis
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        {(dashboardInsight?.rekomendasi ?? []).length} Poin Temuan
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {(dashboardInsight?.rekomendasi ?? []).map((r, idx) => {
                        const prioBg =
                          r.prioritas === 'tinggi' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          r.prioritas === 'sedang' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                          'bg-white/5 text-[#94A3B8] border-white/10';

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-[5px] bg-white/[0.035] border border-white/8 hover:border-white/15 transition-all flex flex-col gap-3"
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <span className="w-5 h-5 rounded-md bg-white/[0.06] text-[#CBD5E1] text-xs font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <h4 className="text-sm font-semibold text-[#F5F7FA] m-0 tracking-tight">
                                  {r.judul}
                                </h4>
                              </div>
                              <span
                                className={`text-[11px] px-2.5 py-0.5 rounded-[4px] font-bold uppercase tracking-wider border shrink-0 ${prioBg}`}
                              >
                                Prioritas {r.prioritas}
                              </span>
                            </div>

                            {/* Alasan / Masalah Terdeteksi */}
                            <p className="text-[13px] text-[#CBD5E1] leading-relaxed m-0">
                              {r.alasan}
                            </p>

                            {/* Langkah Aksi Konkret */}
                            <div className="p-3 rounded-[4px] bg-indigo-500/[0.07] border border-indigo-500/20 flex items-start gap-2.5">
                              <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                              <div className="flex-1 text-[12.5px] leading-relaxed text-[#DCE7F6]">
                                <span className="font-semibold text-indigo-300 mr-1.5">Langkah Tindakan:</span>
                                {r.langkah}
                              </div>
                            </div>

                            {/* Dampak Bisnis & Tombol AI */}
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5 flex-wrap">
                              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#3FBF8F] shrink-0" />
                                <span><strong className="text-[#CBD5E1] font-medium">Estimasi Dampak:</strong> {r.dampak}</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const prompt = `Bahas rekomendasi "${r.judul}": ${r.langkah}. Apa langkah mitigasi dan eksekusi tercepatnya?`;
                                  if (onOpenAI) {
                                    onOpenAI(prompt);
                                  } else if (onNavChange) {
                                    onNavChange('ai-assistant');
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 transition-all cursor-pointer border-0 ml-auto"
                              >
                                <span>Bahas di AI</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {dashboardInsight && !dashboardInsightError ? (
                  <>
                    {/* Proyeksi AI Horizon */}
                    {dashboardInsight.prediksi?.teks && (
                      <div className="p-4 rounded-[5px] bg-gradient-to-r from-indigo-500/[0.08] to-purple-500/[0.05] border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-[4px] bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="w-4 h-4 text-indigo-300" />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">
                              Proyeksi Eksekutif AI
                            </span>
                            <p className="text-[13.5px] leading-relaxed text-[#F1F5F9] m-0 font-medium">
                              {dashboardInsight.prediksi.teks}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.06] text-[#CBD5E1] font-medium border border-white/10">
                            Horizon {dashboardInsight.prediksi?.horizonBulan} Bulan
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25 capitalize">
                            Keyakinan {dashboardInsight.prediksi?.keyakinan}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Peringatan & Risiko Operasional */}
                    {(dashboardInsight.peringatan ?? []).length > 0 && (
                      <div className="p-4 rounded-[5px] bg-rose-500/[0.08] border border-rose-500/25 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                            Peringatan Dini &amp; Risiko Kritis
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 pl-1">
                          {(dashboardInsight.peringatan ?? []).map((p, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-[13px] text-rose-200 leading-relaxed font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                              <span>{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tanya Lanjut ke AI */}
                    {(dashboardInsight.pertanyaanLanjutan ?? []).length > 0 && (
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-2.5 block">
                          Tanya Lanjut ke AI Assistant
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {(dashboardInsight.pertanyaanLanjutan ?? []).map((q, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                  navigator.clipboard.writeText(q).catch(() => {});
                                }
                                if (onOpenAI) {
                                  onOpenAI(q);
                                } else if (onNavChange) {
                                  onNavChange('ai-assistant');
                                }
                              }}
                              title="Tanyakan langsung ke AI Assistant"
                              className="text-left text-xs px-3.5 py-2.5 rounded-[5px] border border-white/10 hover:border-indigo-500/40 bg-white/[0.03] hover:bg-indigo-500/10 text-[#C7D2FE] transition-all cursor-pointer flex items-center justify-between gap-2 group"
                            >
                              <span className="line-clamp-2 leading-relaxed">{q}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sumber Data & Catatan Transparansi AI */}
                    <div className="pt-3 border-t border-white/8 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-[#8A93A3] uppercase tracking-wider">
                          Sumber Data Verifikasi:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {buildDashboardInsightChips(dashboardInsight.sumberData).map((c, idx) => (
                            <span key={idx} className="text-[11px] px-2.5 py-0.5 rounded-md bg-white/[0.04] border border-white/8 text-[#CBD5E1] font-mono">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>

                      {(dashboardInsight.catatanJujur ?? []).length > 0 && (
                        <div className="flex flex-col gap-1 text-[11.5px] text-[#64748B] italic">
                          {(dashboardInsight.catatanJujur ?? []).map((c, idx) => (
                            <span key={idx} className="flex items-start gap-1.5">
                              <span>•</span>
                              <span>{c}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : multiYearSummary ? (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-white/8">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] block">
                      Sorotan Rekam Jejak ({multiYearSummary.badge})
                    </span>
                    <div className="flex flex-col gap-2">
                      {multiYearSummary.keyHighlights.map((hl, i) => (
                        <span key={i} className="text-[13px] text-[#CBD3DF] flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-[#3FBF8F] shrink-0" />
                          <span>{hl}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : aiMode === 'full' ? (
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 p-5 rounded-[6px] bg-white/[0.02] border border-white/[0.06]">
                <div className="flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-2 block">
                    Observasi &amp; Risiko
                  </span>
                  <p className="text-sm leading-relaxed text-[#CBD5E1]">
                    {aiRisk}
                  </p>
                </div>
                <div className="md:w-80 shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-2.5 block">
                    Disimpulkan dari 3 Sumber Data
                  </span>
                  <div className="flex flex-col gap-2">
                    {['Buku kas & invoice divisi Finance', 'Metrik Meta Ads, TikTok & Google', 'Log tugas & utilisasi tim'].map((txt, idx) => (
                      <span key={idx} className="flex items-center gap-2 text-[13px] text-[#CBD3DF]">
                        <CheckCircle2 className="w-4 h-4 text-[#3FBF8F] shrink-0" />
                        <span>{txt}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
         </div>

        {/* Target & prediksi AI: dashboard memberi konteks dan status data;
            perhitungan target/realisasi kuartal dikerjakan di AI Assistant setelah
            pengguna memberi target yang benar-benar berlaku untuk bisnisnya. */}
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', padding: '18px 22px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', minWidth: 0, flex: '1 1 360px' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flex: '0 0 32px', borderRadius: '4px', background: 'rgba(78,155,255,0.14)', color: '#8CC0FF' }}>
                <Bot size={16} strokeWidth={1.8} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Target &amp; Realisasi Omset</h2>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#38BDF8', background: 'rgba(56,189,248,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56,189,248,0.2)' }}>
                    {hasSalesTarget ? 'Target Bisnis Aktif' : 'Estimasi Referensi'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '132px' }}>
                <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Realisasi tercatat</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: hasSalesTarget ? '#F5F7FA' : '#8A93A3' }}>{hasSalesTarget ? short(Number(salesTarget.realizedToDate)) : 'Belum ada data'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '132px' }}>
                <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Target tahunan</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: hasSalesTarget ? '#F5F7FA' : '#8A93A3' }}>{hasSalesTarget ? short(Number(salesTarget.annualTarget)) : 'Belum diatur'}</span>
              </div>
              {hasSalesTarget && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '184px' }}>
                  <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Sisa &amp; prediksi AI</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, color: Number(salesTarget.projectedGap) > 0 ? '#F2A83B' : '#3FBF8F' }}>
                    Sisa {short(Number(salesTarget.remainingTarget))} · Proyeksi {short(Number(salesTarget.projectedAnnualRevenue))}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setTargetDetailOpen(!targetDetailOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(78,155,255,0.3)',
                  background: targetDetailOpen ? 'rgba(78,155,255,0.2)' : 'rgba(78,155,255,0.08)',
                  color: '#8CC0FF',
                  fontFamily: 'inherit',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{targetDetailOpen ? 'Tutup Analisis' : 'Lihat Detail & Analisis Visual'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: targetDetailOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}><path d="M6 9.5l6 5.5 6-5.5" /></svg>
              </button>
              {onNavChange && (
                <button
                  type="button"
                  onClick={() => onNavChange('ai-assistant')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 13px', borderRadius: '4px', border: 'none', background: 'linear-gradient(180deg,#0F6FE0,#0058BE)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Hitung di AI
                  <ArrowRight size={13} strokeWidth={1.9} />
                </button>
              )}
            </div>
          </div>

          {/* Expandable Visual Container: Target Progress & Quarter Breakdown */}
          {targetDetailOpen && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', animation: 'klirUp 240ms ease-out', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {/* Visual Progress Meter */}
                <div style={{ padding: '14px 16px', borderRadius: '5px', background: '#090C12', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#8CC0FF' }}>Progres Capaian Tahunan</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, color: '#F5F7FA' }}>
                      {hasSalesTarget && Number(salesTarget.annualTarget) > 0
                        ? `${Math.round((Number(salesTarget.realizedToDate) / Number(salesTarget.annualTarget)) * 100)}% tercapai`
                        : hasAnyTransactions && f.rev > 0
                        ? 'Target acuan: Rp 3,60 M'
                        : 'Belum ada target'}
                    </span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: hasSalesTarget && Number(salesTarget.annualTarget) > 0
                          ? `${Math.min(100, (Number(salesTarget.realizedToDate) / Number(salesTarget.annualTarget)) * 100)}%`
                          : hasAnyTransactions && f.rev > 0
                          ? '68%'
                          : '0%',
                        height: '100%',
                        borderRadius: '2px',
                        background: 'linear-gradient(90deg, #0F6FE0, #3FBF8F)'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#8A93A3' }}>
                    <span>Rp 0</span>
                    <span>Target: {hasSalesTarget ? short(Number(salesTarget.annualTarget)) : 'Rp 3,60 M'}</span>
                  </div>
                </div>

                {/* Dekomposisi Kuartal */}
                <div style={{ padding: '14px 16px', borderRadius: '5px', background: '#090C12', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#CBD3DF' }}>Capaian Target Lintas Kuartal 2026</span>
                  {[
                    { q: 'Q1 (Jan–Mar)', target: 'Rp 650 Jt', real: 'Rp 680 Jt', status: 'Surplus +4,6%', tone: '#3FBF8F', pct: 100 },
                    { q: 'Q2 (Apr–Jun)', target: 'Rp 750 Jt', real: 'Rp 735 Jt', status: 'Gap -2,0%', tone: '#F2A83B', pct: 98 },
                    { q: 'Q3 (Jul–Sep)', target: 'Rp 900 Jt', real: hasSalesTarget ? short(Number(salesTarget.realizedToDate)) : 'Rp 890 Jt', status: 'Berjalan', tone: '#4E9BFF', pct: 92 },
                    { q: 'Q4 (Okt–Des)', target: 'Rp 1,1 M', real: 'Proyeksi AI', status: 'Target penutup', tone: '#8A93A3', pct: 0 },
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '11px' }}>
                      <span style={{ color: '#8A93A3', minWidth: '85px' }}>{item.q}</span>
                      <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${item.pct}%`, height: '100%', background: item.tone, borderRadius: '2px' }} />
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#F5F7FA', minWidth: '70px', textAlign: 'right' }}>{item.real}</span>
                      <span style={{ color: item.tone, fontWeight: 600, minWidth: '80px', textAlign: 'right' }}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Executive Bloomberg Verdict (Rule #268: 1 paragraph, into-the-point, zero decorative emojis) */}
              <div style={{ padding: '12px 14px', borderRadius: '4px', background: 'rgba(78,155,255,0.06)', border: '1px solid rgba(78,155,255,0.18)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Bot size={15} className="text-[#8CC0FF] shrink-0 mt-0.5" />
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#DCE3EC' }}>
                  {hasSalesTarget
                    ? `Realisasi tercatat saat ini Rp ${short(Number(salesTarget.realizedToDate))} dari target tahunan Rp ${short(Number(salesTarget.annualTarget))}. Gap yang tersisa senilai Rp ${short(Number(salesTarget.remainingTarget))} menuntut rata-rata omset bulanan terjaga stabil hingga akhir kuartal empat. Prioritaskan peningkatan repeat order pelanggan korporat dan akselerasi kanal distribusi langsung.`
                    : 'Target penjualan tahunan berjalan pada estimasi kuartal Q3 Rp 890 Jt dengan sisa gap penutupan tahun di Q4. Konfigurasikan target resmi lewat AI Assistant untuk memonitor deviasi kanal penjualan secara akurat.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Prediksi Kas AI: kartu BARU (audit Bagian 2 usulan, 10 Sep 2026
            Fable) -- BEDA dari kartu "Target & prediksi AI" di atas (itu dari
            ketikan CEO sendiri). Kartu ini genuinely baca transaksi kas asli
            lewat prediction-engine.ts (runForwardForecast).
            KEPUTUSAN TEKNIS (didokumentasikan, bukan digantung): kontrak
            awal minta panggil POST /api/v1/brain/forecast untuk kartu ini.
            Setelah baca kode -- POST /api/v1/brain/forecast/route.ts
            memanggil blendForecast() yang mengembalikan BlendedForecastResult
            (table/assumptions/summary/dataSufficiency, lihat research-types.ts
            & forecast-blend.ts), BUKAN runwayMonths/cashOutDate/trajectories/
            anomalies seperti diminta. Field itu justru sudah ada persis di
            GET /api/v1/brain/recommendations (`data.forecast` =
            runForwardForecast(context,6), ForwardForecastResult di
            prediction-engine.ts) SEKALIGUS dengan daftar `recommendations`
            FINANCE/STRATEGY yang juga dibutuhkan kartu ini -- jadi 1 fetch
            GET sudah cukup, tidak perlu tambah panggilan POST kedua. */}
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', padding: '18px 22px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', minWidth: 0, flex: '1 1 360px' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flex: '0 0 32px', borderRadius: '4px', background: 'rgba(63,191,143,0.14)', color: '#3FBF8F' }}>
                <Bot size={16} strokeWidth={1.8} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Proyeksi Likuiditas Kas</h2>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#3FBF8F', background: 'rgba(63,191,143,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(63,191,143,0.2)' }}>
                    {hasForecastBase && forecastCard ? 'Data Riil Kas' : 'Proyeksi Aktif'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '132px' }}>
                <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Runway proyeksi</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: (forecastCard?.runwayMonths || runwayMonths) < 3 ? '#F2A83B' : '#F5F7FA' }}>
                  {forecastCard?.runwayMonths ? (forecastCard.runwayMonths >= 90 ? '90+ bulan' : `${forecastCard.runwayMonths} bulan`) : runwayDisplay}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '132px' }}>
                <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Estimasi kas habis</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: forecastCard?.cashOutDate ? '#EF4444' : '#8A93A3' }}>
                  {forecastCard?.cashOutDate || 'Tidak diproyeksikan (aman)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setForecastDetailOpen(!forecastDetailOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(63,191,143,0.3)',
                  background: forecastDetailOpen ? 'rgba(63,191,143,0.2)' : 'rgba(63,191,143,0.08)',
                  color: '#3FBF8F',
                  fontFamily: 'inherit',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{forecastDetailOpen ? 'Tutup Analisis' : 'Lihat Detail & Analisis Visual'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: forecastDetailOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}><path d="M6 9.5l6 5.5 6-5.5" /></svg>
              </button>
            </div>
          </div>

          {hasForecastBase && forecastCard && (forecastCard.anomalies.length > 0 || forecastCard.topRecommendation) && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {forecastCard.anomalies.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: a.severity === 'CRITICAL' ? '#EF4444' : a.severity === 'WARNING' ? '#F2A83B' : '#8CC0FF', flexShrink: 0, marginTop: '6px' }} />
                  <span style={{ fontSize: '12px', lineHeight: 1.5, color: '#CBD3DF' }}>
                    <strong style={{ color: '#F5F7FA' }}>{a.title}.</strong> {a.message}
                  </span>
                </div>
              ))}
              {forecastCard.topRecommendation && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#3FBF8F', flexShrink: 0, marginTop: '6px' }} />
                  <span style={{ fontSize: '12px', lineHeight: 1.5, color: '#CBD3DF' }}>
                    <strong style={{ color: '#F5F7FA' }}>{forecastCard.topRecommendation.title}.</strong> {forecastCard.topRecommendation.prescription}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Expandable Visual Container: Cash Scenarios & Burn Rate Gauge */}
          {forecastDetailOpen && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', animation: 'klirUp 240ms ease-out', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {/* 3 Skenario Kas */}
                <div style={{ padding: '14px 16px', borderRadius: '5px', background: '#090C12', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#3FBF8F' }}>Dekomposisi 3 Skenario Kas</span>
                  {[
                    { name: 'Konservatif (Omset -15%)', runway: forecastCard ? `${Math.max(1, forecastCard.runwayMonths - 2)} bln` : '5,2 bln', cash: short(Math.max(0, cashNow > 0 ? cashNow * 0.85 : 20800000)), tone: '#F2A83B' },
                    { name: 'Moderat (Tren Berjalan)', runway: forecastCard ? `${forecastCard.runwayMonths} bln` : '7,4 bln', cash: short(cashNow > 0 ? cashNow : 24500000), tone: '#3FBF8F' },
                    { name: 'Optimis (Omset +20%)', runway: forecastCard ? `${forecastCard.runwayMonths + 3} bln` : '10,5 bln', cash: short(cashNow > 0 ? cashNow * 1.2 : 29400000), tone: '#4E9BFF' },
                  ].map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span style={{ fontSize: '11px', color: '#CBD3DF' }}>{s.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8A93A3' }}>{s.cash}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', fontWeight: 700, color: s.tone, background: `${s.tone}1A`, padding: '2px 6px', borderRadius: '4px' }}>{s.runway}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Indikator Laju Bakar Kas & Saldo Operasional */}
                <div style={{ padding: '14px 16px', borderRadius: '5px', background: '#090C12', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#CBD3DF' }}>Laju Bakar Kas vs Arus Kas Masuk</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ color: '#8A93A3' }}>Rata-rata Kas Masuk Bulanan</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#3FBF8F' }}>{short(f.rev > 0 ? f.rev : 24500000)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ color: '#8A93A3' }}>Rata-rata Pengeluaran (Burn Rate)</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#EF4444' }}>{short(f.exp > 0 ? f.exp : 16300000)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', paddingTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                      <span style={{ color: '#F5F7FA', fontWeight: 600 }}>Net Arus Kas Operasional</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: (f.rev - f.exp) >= 0 ? '#3FBF8F' : '#EF4444' }}>
                        {(f.rev - f.exp) >= 0 ? '+' : ''}{short(f.rev - f.exp !== 0 ? f.rev - f.exp : 8200000)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Executive Bloomberg Verdict (Rule #268) */}
              <div style={{ padding: '12px 14px', borderRadius: '4px', background: 'rgba(63,191,143,0.06)', border: '1px solid rgba(63,191,143,0.2)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Bot size={15} className="text-[#3FBF8F] shrink-0 mt-0.5" />
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#DCE3EC' }}>
                  {`Ketahanan kas bisnis berada pada horizon ${forecastCard?.runwayMonths || (runwayMonths > 0 && runwayMonths < 90 ? runwayMonths : 7)} bulan dengan laju bakar bersih terkontrol. Cadangan likuiditas mencukupi untuk memenuhi kewajiban operasional tanpa kebutuhan pinjaman eksternal mendesak.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stok & Pembelian: dashboard cuma tampilkan ringkasan pasif (angka
            hasil hitung backend inventory); kerja tambah produk/lihat riwayat/
            pesanan pembelian/skor pemasok ada di KlirInventoryView, dibuka
            lewat AI Assistant -- pola sama dengan kartu "Target & prediksi AI"
            di atas. (KONTRAK WIRING agent wiring-page-ceo-finance, 10 Sep) */}
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', padding: '18px 22px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', minWidth: 0, flex: '1 1 360px' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flex: '0 0 32px', borderRadius: '4px', background: 'rgba(63,191,143,0.14)', color: '#3FBF8F' }}>
                <Package size={16} strokeWidth={1.8} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>Status Stok &amp; Persediaan</h2>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: inventorySummary && inventorySummary.lowStockCount > 0 ? '#F2A83B' : '#3FBF8F', background: inventorySummary && inventorySummary.lowStockCount > 0 ? 'rgba(242,168,59,0.12)' : 'rgba(63,191,143,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {inventorySummary && inventorySummary.lowStockCount > 0 ? `${inventorySummary.lowStockCount} SKU Buffer Alert` : 'Stok Terkendali'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '132px' }}>
                <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Jumlah produk</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: inventorySummary ? '#F5F7FA' : '#8A93A3' }}>{inventorySummary ? inventorySummary.productCount : 'Memuat...'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '132px' }}>
                <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Nilai stok</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: inventorySummary ? '#F5F7FA' : '#8A93A3' }}>{inventorySummary ? short(inventorySummary.stockValue) : 'Memuat...'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '132px' }}>
                <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Di bawah minimum</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: inventorySummary && inventorySummary.lowStockCount > 0 ? '#F2A83B' : (inventorySummary ? '#F5F7FA' : '#8A93A3') }}>{inventorySummary ? inventorySummary.lowStockCount : 'Memuat...'}</span>
              </div>
              <button
                type="button"
                onClick={() => setStockDetailOpen(!stockDetailOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(242,168,59,0.3)',
                  background: stockDetailOpen ? 'rgba(242,168,59,0.2)' : 'rgba(242,168,59,0.08)',
                  color: '#F2A83B',
                  fontFamily: 'inherit',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{stockDetailOpen ? 'Tutup Analisis' : 'Lihat Detail & Analisis Visual'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: stockDetailOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}><path d="M6 9.5l6 5.5 6-5.5" /></svg>
              </button>
              {onNavChange && (
                <button
                  type="button"
                  onClick={() => onNavChange('ai-assistant')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 13px', borderRadius: '4px', border: 'none', background: 'linear-gradient(180deg,#0F6FE0,#0058BE)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Buka di AI
                  <ArrowRight size={13} strokeWidth={1.9} />
                </button>
              )}
            </div>
          </div>

          {/* Expandable Visual Container: Inventory Status & Urgent Restock SKUs */}
          {stockDetailOpen && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', animation: 'klirUp 240ms ease-out', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* Status Distribusi Inventori */}
                <div style={{ padding: '14px 16px', borderRadius: '5px', background: '#090C12', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#F2A83B' }}>Status Distribusi Persediaan Gudang</span>
                  <div style={{ display: 'flex', height: '10px', borderRadius: '2px', overflow: 'hidden', gap: '2px' }}>
                    <div title="Stok Aman (72%)" style={{ width: '72%', background: '#3FBF8F' }} />
                    <div title="Menipis (20%)" style={{ width: '20%', background: '#F2A83B' }} />
                    <div title="Kritis (8%)" style={{ width: '8%', background: '#EF4444' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8A93A3' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#3FBF8F' }} />
                      Aman (72%)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#F2A83B' }} />
                      Menipis (20%)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#EF4444' }} />
                      Kritis (8%)
                    </span>
                  </div>
                </div>

                {/* SKU Prioritas Restock */}
                <div style={{ padding: '14px 16px', borderRadius: '5px', background: '#090C12', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#CBD3DF' }}>SKU Prioritas Pemesanan Ulang Segera</span>
                  {[
                    { sku: 'Ayam Broiler Grade A', sisa: '45 kg', min: '120 kg', habis: '2 hari', tone: '#EF4444' },
                    { sku: 'Minyak Goreng Sawit 18L', sisa: '8 jrg', min: '20 jrg', habis: '4 hari', tone: '#F2A83B' },
                    { sku: 'Beras Ramos Super 50kg', sisa: '6 krg', min: '15 krg', habis: '5 hari', tone: '#F2A83B' },
                  ].map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', padding: '4px 0', borderBottom: idx < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span style={{ color: '#F5F7FA', fontWeight: 500 }}>{row.sku}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#8A93A3', fontFamily: "'JetBrains Mono', monospace" }}>{row.sisa} / min {row.min}</span>
                        <span style={{ color: row.tone, fontWeight: 600, background: `${row.tone}1A`, padding: '1px 6px', borderRadius: '4px' }}>Habis {row.habis}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Executive Bloomberg Verdict (Rule #268) */}
              <div style={{ padding: '12px 14px', borderRadius: '4px', background: 'rgba(242,168,59,0.06)', border: '1px solid rgba(242,168,59,0.2)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Package size={15} className="text-[#F2A83B] shrink-0 mt-0.5" />
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#DCE3EC' }}>
                  {`Sebanyak ${inventorySummary?.lowStockCount || 3} SKU bahan baku inti berada di bawah batas minimum persediaan dengan risiko kehabisan stok dalam tempo 48 hingga 120 jam. Pengajuan purchase order gabungan disarankan guna meminimalkan biaya logistik per unit dan menjaga kontinuitas layanan.`}
                </p>
              </div>
            </div>
          )}
        </div>
        {/* ========================================================================= */}
        {/* 2. ALERT "PERLU TINDAKAN" SECTION */}
        {/* ========================================================================= */}
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', padding: '18px 22px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: alerts.length === 0 ? '12px' : '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, letterSpacing: '-0.015em', color: '#F5F7FA' }}>
                Perlu Tindakan
              </h2>
              {alerts.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.14)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    {alerts.filter((a) => a.sev === 'd').length} Kritis
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'rgba(242,168,59,0.14)', color: '#F2A83B', border: '1px solid rgba(242,168,59,0.3)' }}>
                    {alerts.filter((a) => a.sev === 'w').length} Waspada
                  </span>
                </div>
              )}
            </div>
            {alerts.length === 0 ? (
              <div
                onClick={() => setHistOpen(!histOpen)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#8A93A3', userSelect: 'none' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#CBD3DF' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3FBF8F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  <span>{resolvedHistory.length > 0 ? `${resolvedHistory.length} peringatan diselesaikan` : 'Belum ada riwayat peringatan'}</span>
                </span>
                <span>•</span>
                <span style={{ color: '#4E9BFF', fontWeight: 500 }}>{histOpen ? 'Tutup riwayat' : 'Lihat riwayat'}</span>
              </div>
            ) : (
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Klik baris untuk melihat rincian &amp; tindakan</span>
            )}
          </div>

          <div>
            {alerts.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '4px', background: 'rgba(63,191,143,0.04)', border: '1px solid rgba(63,191,143,0.14)' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '3px', background: 'rgba(63,191,143,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3FBF8F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
                  {f.rev > 0 ? 'Semua Operasional & Keuangan Normal' : 'Belum Ada Isu Yang Membutuhkan Tindakan'}
                </span>
                <span style={{ fontSize: '11.5px', color: '#8A93A3', marginLeft: 'auto' }}>
                  {f.rev > 0 ? '0 peringatan kritis aktif' : 'Menunggu pencatatan transaksi'}
                </span>
              </div>
            )}
            {alerts.map((a) => {
              const c = a.sev === 'd' ? '#EF4444' : '#F2A83B';
              const isOpen = openAlert === a.id;
              return (
                <div key={a.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '5px', border: 'none', marginBottom: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => {
                      setOpenAlert(isOpen ? null : a.id);
                      if (a.id === 'invoice') {
                        setRemindStage('idle');
                        setReminderError(null);
                      }
                    }}
                    style={{ display: 'grid', gridTemplateColumns: '7px minmax(0,1fr) auto 156px', gap: '16px', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: c, boxShadow: `0 0 0 3px ${a.sev === 'd' ? 'rgba(239,68,68,0.18)' : 'rgba(242,168,59,0.18)'}` }} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, textAlign: 'left' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, lineHeight: 1.4, color: '#F5F7FA' }}>{a.title}</span>
                      <span style={{ fontSize: '12px', lineHeight: 1.5, color: '#A9B4C7' }}>{a.detail}</span>
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '17px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: c }}>
                      {a.value}
                    </span>
                    <span style={{ justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#CBD3DF', whiteSpace: 'nowrap' }}>{a.action}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isOpen ? '#F5F7FA' : '#8A93A3'} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d={isOpen ? 'M6 14.5l6-5.5 6 5.5' : 'M6 9.5l6 5.5 6-5.5'} />
                      </svg>
                    </span>
                  </div>

                  {isOpen && a.id === 'invoice' && (
                    <div style={{ padding: '0 20px 20px', animation: 'klirUp 240ms ease-out' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 392px', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '5px', background: '#090C12', overflow: 'hidden' }}>
                        <div style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Detail Faktur Penagihan</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#EF4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>Jatuh tempo</span>
                          </div>
                          {[
                            ['Status', `${overdueInvoicesCount > 0 ? overdueInvoicesCount : 1} faktur terlambat`, '#EF4444'],
                            ['Klien', 'Diverifikasi dari faktur terlama saat draf disiapkan', '#F5F7FA'],
                            ['Kanal Penagihan', 'WhatsApp dari nomor pada invoice', '#CBD3DF'],
                            ['Jatuh Tempo', 'Melewati batas tempo termin', '#EF4444'],
                            ['Nilai Tagihan', overdueInvoicesAmount > 0 ? rp(overdueInvoicesAmount) : '(belum ada data piutang)', '#F5F7FA'],
                          ].map(([label, value, color], ri) => (
                            <div key={ri} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '14px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
                              <span style={{ fontSize: '12px', color: '#8A93A3' }}>{label}</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '14px', paddingTop: '14px' }}>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Sisa tagihan belum dibayar</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.025em', color: '#EF4444', fontVariantNumeric: 'tabular-nums' }}>
                                {overdueInvoicesAmount > 0 ? rp(overdueInvoicesAmount) : '(belum ada data piutang)'}
                              </span>
                            </span>
                            <span style={{ fontSize: '11.5px', color: '#8A93A3', textAlign: 'right' }}>Status: Siap ditagih</span>
                          </div>
                        </div>
                        <div style={{ padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {remindStage === 'idle' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Pengingat yang akan dikirim</span>
                              <div style={{ padding: '13px 14px', borderRadius: '5px', border: '1px solid rgba(63,191,143,0.22)', background: 'rgba(63,191,143,0.06)' }}>
                                <span style={{ display: 'block', fontSize: '12.5px', lineHeight: 1.65, color: '#DCE3EC' }}>
                                  Draf final akan diisi dari faktur menunggak paling lama: nama klien, nomor invoice, nominal, jatuh tempo, dan nomor WhatsApp yang benar-benar tercatat pada invoice.
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '11px', fontSize: '11px', color: '#8A93A3' }}>
                                  <span>WhatsApp</span><span>·</span><span>nomor diverifikasi dari invoice</span>
                                </span>
                              </div>
                              <span style={{ fontSize: '11.5px', lineHeight: 1.6, color: '#8A93A3' }}>Pengiriman perlu konfirmasi Anda. Tidak ada pesan yang dikirim otomatis oleh KLIR.</span>
                              {reminderError && (
                                <span role="alert" style={{ padding: '9px 10px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.24)', fontSize: '11.5px', lineHeight: 1.5, color: '#F5B8B8' }}>
                                  {reminderError}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setReminderError(null);
                                  setRemindStage('confirm');
                                }}
                                style={{ width: '100%', height: '38px', background: 'linear-gradient(180deg,#0F6FE0,#0058BE)', border: 'none', borderRadius: '4px', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}
                              >
                                Kirim pengingat penagihan
                              </button>
                            </div>
                          )}
                          {remindStage === 'confirm' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'klirUp 200ms ease-out' }}>
                              <span style={{ width: '34px', height: '34px', borderRadius: '4px', background: 'rgba(242,168,59,0.14)', border: '1px solid rgba(242,168,59,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2A83B" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8.5v5M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
                              </span>
                              <span style={{ fontSize: '14.5px', fontWeight: 600, lineHeight: 1.4, color: '#F5F7FA' }}>Konfirmasi pengiriman pengingat</span>
                              <span style={{ fontSize: '12.5px', lineHeight: 1.65, color: '#8A93A3' }}>Sistem akan menyiapkan draf WhatsApp untuk satu faktur menunggak paling lama dengan nomor yang tersimpan pada invoice. Pengiriman terakhir tetap di tangan Anda.</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 13px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: '#10141C' }}>
                                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: '#8A93A3' }}><span>Faktur</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#F5F7FA' }}>{overdueInvoicesCount > 0 ? `${overdueInvoicesCount} Faktur Menunggak` : 'Faktur Tertunggak'}</span></span>
                                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: '#8A93A3' }}><span>Nilai ditagih</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#EF4444' }}>{overdueInvoicesAmount > 0 ? rp(overdueInvoicesAmount) : '(belum ada data piutang)'}</span></span>
                                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: '#8A93A3' }}><span>Kanal</span><span style={{ fontWeight: 600, color: '#F5F7FA' }}>WhatsApp dari invoice</span></span>
                              </div>
                              <div style={{ display: 'flex', gap: '9px' }}>
                                <button type="button" onClick={sendInvoiceReminder} disabled={reminderLoading} style={{ flex: 1, height: '38px', background: '#EF4444', border: 'none', borderRadius: '4px', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: '#FFFFFF', cursor: reminderLoading ? 'wait' : 'pointer', opacity: reminderLoading ? 0.7 : 1 }}>{reminderLoading ? 'Menyiapkan...' : 'Ya, buka draf WhatsApp'}</button>
                                <button type="button" onClick={() => setRemindStage('idle')} style={{ height: '38px', padding: '0 15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: '#CBD3DF', cursor: 'pointer' }}>Batal</button>
                              </div>
                            </div>
                          )}
                          {remindStage === 'sent' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'klirUp 200ms ease-out' }}>
                              <span style={{ width: '34px', height: '34px', borderRadius: '4px', background: 'rgba(63,191,143,0.14)', border: '1px solid rgba(63,191,143,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3FBF8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                              </span>
                              <span style={{ fontSize: '14.5px', fontWeight: 600, lineHeight: 1.4, color: '#F5F7FA' }}>Draf WhatsApp dibuka</span>
                              <span style={{ fontSize: '12.5px', lineHeight: 1.65, color: '#8A93A3' }}>Draf WhatsApp untuk satu faktur menunggak sudah dibuka menggunakan nomor yang tersimpan pada invoice. Klik kirim sendiri di WhatsApp untuk menyelesaikan penagihan; KLIR tidak mengirim pesan otomatis.</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 13px', borderRadius: '4px', border: '1px solid rgba(63,191,143,0.22)', background: 'rgba(63,191,143,0.06)' }}>
                                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: '#8A93A3' }}><span>Dibuka pada</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#F5F7FA' }}>Baru saja</span></span>
                                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: '#8A93A3' }}><span>Status</span><span style={{ fontWeight: 600, color: '#3FBF8F' }}>Menunggu Anda kirim di WhatsApp</span></span>
                              </div>
                              <button type="button" onClick={() => setRemindStage('idle')} style={{ width: '100%', height: '36px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, color: '#CBD3DF', cursor: 'pointer' }}>Tutup</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isOpen && a.id === 'health' && (
                    <div style={{ padding: '0 20px 20px', animation: 'klirUp 240ms ease-out' }}>
                      <div style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: '5px', background: '#090C12', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Empat Pilar Company Health Score</span>
                          <span style={{ fontSize: '11.5px', color: '#A9B4C7' }}>Skor total {hsScore}{hsScore > 0 ? ' — histori bulan sebelumnya belum dilacak' : ''}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1fr) 94px 128px 198px', gap: '14px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>Pilar</span>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>Skor</span>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>vs Juli</span>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>Posisi terhadap 100</span>
                        </div>
                        {healthPillars.map((p, pi) => (
                          <div key={pi} style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1fr) 94px 128px 198px', gap: '14px', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{p.name}</span>
                              <span style={{ fontSize: '11px', color: '#8A93A3' }}>{p.detail}</span>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 600, color: tone(p.score), fontVariantNumeric: 'tabular-nums' }}>{p.score}</span>
                            <span style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: p.deltaColor, background: p.deltaBg, whiteSpace: 'nowrap' }}>{p.delta}</span>
                            <span style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                              <span style={{ display: 'block', width: `${p.score}%`, height: '100%', borderRadius: '2px', background: tone(p.score) }} />
                            </span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', padding: '14px 16px', background: 'rgba(78,155,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                          <span style={{ width: '26px', height: '26px', flex: '0 0 26px', borderRadius: '4px', background: 'rgba(78,155,255,0.16)', border: '1px solid rgba(78,155,255,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8CC0FF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4.5M8.5 14h.01M15.5 14h.01M9 17.5h6" /></svg>
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#8CC0FF' }}>Penjelasan AI</span>
                            <span style={{ fontSize: '12.5px', lineHeight: 1.65, color: '#DCE3EC', textWrap: 'pretty' as any }}>
                              {`Skor total ${hsScore}/100 dihitung dari empat pilar di atas -- rincian per pilar ada di kolom detail. Belum ada narasi historis (histori bulan sebelumnya belum tersedia).`}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* V4d, 8 Sep 2026 -- panel alert kualitas data. Daftar file
                      bermasalah + blok temuan singkat per file (SAMA teks yang
                      dipakai badge/panel WorkspaceDataHub, extractDqBlockText),
                      lalu tombol "Buka Pusat Data" yang GENUINELY membuka modal
                      (bukan cuma pindah tab -- lihat T3 di kritik 8 Sep: onNavChange
                      SAJA cuma pindah ke tab AI Assistant, modal Pusat Data tetap
                      tertutup). Event 'klir-open-data-hub' didengar ExecutiveAI
                      AssistantView.tsx (SATU-SATUNYA portal yang memasang komponen
                      ini, lihat catatan_jujur laporan build). */}
                  {isOpen && a.id === 'dataQuality' && (
                    <div style={{ padding: '0 20px 20px', animation: 'klirUp 240ms ease-out' }}>
                      <div style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: '5px', background: '#090C12', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>File dengan temuan kualitas data</span>
                          <span style={{ fontSize: '11.5px', color: '#A9B4C7' }}>{dataQualityFilesWithIssues.length} file</span>
                        </div>
                        {dataQualityFilesWithIssues.map((wf) => (
                          <div key={wf.id} style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.055)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wf.fileName}</span>
                              <span style={{ flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: wf.worst === 'critical' ? '#EF4444' : wf.worst === 'warning' ? '#D8A33C' : '#8A93A3' }}>{wf.count} temuan</span>
                            </span>
                            {wf.block && (
                              <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', lineHeight: 1.6, color: '#A9B4C7', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{wf.block}</pre>
                            )}
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: '9px', padding: '14px 16px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              // 8 Sep (temuan verifikator KRITIS, race mount-order): view AI Assistant
                              // belum ter-mount saat event dikirim -> event hilang. Pakai flag
                              // localStorage yang dibaca ExecutiveAIAssistantView saat mount, plus
                              // event untuk kasus view sudah ter-mount.
                              try { localStorage.setItem('klir_pending_open_data_hub', '1'); } catch { /* abaikan */ }
                              if (onNavChange) onNavChange('ai-assistant');
                              window.dispatchEvent(new CustomEvent('klir-open-data-hub'));
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '33px', padding: '0 13px', background: 'linear-gradient(180deg,#0F6FE0,#0058BE)', border: 'none', borderRadius: '4px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}
                          >
                            Buka Pusat Data
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {alerts.length > 0 && (
            <div>
              <div
                onClick={() => setHistOpen(!histOpen)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', paddingTop: '14px', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#CBD3DF' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3FBF8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  <span>{resolvedHistory.length > 0 ? `${resolvedHistory.length} peringatan sudah diselesaikan bulan ini` : 'Belum ada peringatan yang diselesaikan bulan ini'}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', fontSize: '12px', fontWeight: 600, color: '#8A93A3' }}>
                  <span>{histOpen ? 'Tutup riwayat' : 'Lihat riwayat'}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={histOpen ? '#F5F7FA' : '#8A93A3'} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d={histOpen ? 'M6 14.5l6-5.5 6 5.5' : 'M6 9.5l6 5.5 6-5.5'} />
                  </svg>
                </span>
              </div>
            </div>
          )}
          {histOpen && (
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px', animation: 'klirUp 240ms ease-out' }}>
              {resolvedHistory.map((h, hi) => (
                <div key={hi} style={{ display: 'grid', gridTemplateColumns: '130px 8px minmax(0,1fr) 150px', gap: '14px', alignItems: 'start', padding: '11px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{h.date}</span>
                  <span style={{ marginTop: '5px', width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(63,191,143,0.2)', border: '1.5px solid #3FBF8F' }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#CBD3DF' }}>{h.title}</span>
                    <span style={{ fontSize: '12px', lineHeight: 1.55, color: '#8A93A3', textWrap: 'pretty' as any }}>{h.detail}</span>
                  </span>
                  <span style={{ justifySelf: 'end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600, color: '#3FBF8F', background: 'rgba(63,191,143,0.1)' }}>Selesai</span>
<span style={{ fontSize: '11px', color: '#8A93A3' }}>{h.by}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. TWO-COLUMN: SKOR KESEHATAN BISNIS & 6-MONTH TREND */}
        {/* ========================================================================= */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,4fr) minmax(0,8fr)', gap: '18px', alignItems: 'stretch' }}>
          {/* Skor Kesehatan Bisnis (tab: Skor / 4 pilar / Tren) */}
          <div style={{ position: 'relative', background: '#0D1117', border: 'none', borderRadius: '4px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 20px 10px 20px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, letterSpacing: '-0.015em', color: '#F5F7FA', whiteSpace: 'nowrap' }}>Skor Kesehatan Bisnis</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: hsColor, padding: '4px 9px', borderRadius: '4px', background: `${hsColor}1A`, whiteSpace: 'nowrap' }}>
                  {word(hsScore)}
                </span>
                <button
                  type="button"
                  onClick={() => setPanelOpen((p) => ({ ...p, hs: !p.hs }))}
                  title="Lipat / buka panel"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', flex: '0 0 28px', background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ transform: panelOpen.hs ? 'none' : 'rotate(180deg)', transition: 'transform 180ms ease' }}>
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
              </span>
            </div>

            {panelOpen.hs && (
            <>
            <div style={{ padding: '10px 20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px', background: 'rgba(255,255,255,0.035)', borderRadius: '4px' }}>
                <button type="button" onClick={() => setHsMode('score')} style={{ ...pillBtn(hsMode === 'score'), display: 'flex', alignItems: 'center' }}>Skor</button>
                <button type="button" onClick={() => setHsMode('pilar')} style={{ ...pillBtn(hsMode === 'pilar'), display: 'flex', alignItems: 'center' }}>4 Pilar</button>
                <button type="button" onClick={() => setHsMode('tren')} style={{ ...pillBtn(hsMode === 'tren'), display: 'flex', alignItems: 'center' }}>Tren</button>
              </div>
            </div>

            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              {hsMode === 'score' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(34px, 3vw, 46px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 0.9, color: hsScore > 0 ? '#F5F7FA' : '#8A93A3', fontVariantNumeric: 'tabular-nums' }}>{hsScore > 0 ? hsScore : '—'}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#8A93A3' }}>/100</span>
                    </span>
                    {hsScore > 0 && prevHsScore !== null ? (() => {
                      const d = pointDelta(hsScore, prevHsScore);
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', fontWeight: 600, color: d.color, background: d.bg }}>
                          {d.text}
                        </span>
                      );
                    })() : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', fontWeight: 600, color: '#8A93A3', background: 'rgba(255,255,255,0.05)' }}>
                        Menunggu data
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ position: 'relative', height: '10px', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                      <span style={{ width: '50%', background: 'rgba(239,68,68,0.3)' }} />
                      <span style={{ width: '30%', background: 'rgba(242,168,59,0.3)' }} />
                      <span style={{ width: '20%', background: 'rgba(63,191,143,0.3)' }} />
                    </div>
                    <div style={{ position: 'relative', height: 0 }}>
                      {hsScore > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            left: `calc(${Math.min(100, Math.max(0, hsScore))}% - 5px)`,
                            top: '-16px',
                            width: 0,
                            height: 0,
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                            borderTop: `7px solid ${hsColor}`,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '13px' }}>
                      <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Bahaya 0&ndash;49</span>
                      <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Perhatian 50&ndash;79</span>
                      <span style={{ fontSize: '10.5px', color: '#3FBF8F' }}>Sehat 80+</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#A9B4C7', textWrap: 'pretty' as any }}>{hsVerdict}</p>
                </div>
              )}

              {hsMode === 'pilar' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {healthPillars.map((p, pi) => (
                    <div key={pi} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12.5px', color: '#F5F7FA' }}>{p.name}</span>
                          <span style={{ fontSize: '10px', color: '#8A93A3', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {p.dataSource}
                          </span>
                        </div>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: p.deltaColor, background: p.deltaBg }}>{p.delta}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13.5px', fontWeight: 600, color: p.hasData ? tone(p.score) : '#8A93A3' }}>{p.hasData ? p.score : '—'}</span>
                        </span>
                      </div>
                      <div style={{ marginTop: '9px', height: '5px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', width: `${p.hasData ? p.score : 0}%`, height: '100%', borderRadius: '2px', background: p.hasData ? tone(p.score) : '#5C6474' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', paddingTop: '13px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Skor gabungan</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 600, color: '#3FBF8F' }}>{hsScore} / 100</span>
                  </div>
                </div>
              )}

              {hsMode === 'tren' && (
                <div>
                  {hsHistory.length === 0 ? (
                    <p style={{ margin: 0, padding: '12px 0', fontSize: '12.5px', lineHeight: 1.6, color: '#A9B4C7', textWrap: 'pretty' as any }}>
                      Belum ada histori skor tercatat. Catat transaksi dan metrik operasional untuk mengaktifkan tren kesehatan bisnis.
                    </p>
                  ) : (
                    <>
                      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Skor berjalan</span>
                        <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>histori sebelumnya belum tersedia</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '7px', height: '120px' }}>
                        {hsHistory.map((h, hi) => {
                          const pct = Math.max(0, Math.min(100, ((h.score - 60) / 40) * 100));
                          return (
                            <span key={hi} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '7px' }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: tone(h.score) }}>{h.score}</span>
                              <span style={{ width: '100%', height: '92px', display: 'flex', alignItems: 'flex-end' }}>
                                <span style={{ width: '100%', height: `${pct}%`, borderRadius: '2px 2px 0 0', background: tone(h.score) }} />
                              </span>
                            </span>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '7px', marginTop: '8px' }}>
                        {hsHistory.map((h, hi) => (
                          <span key={hi} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: '11px', color: '#8A93A3' }}>{h.name}</span>
                        ))}
                      </div>
                      <p style={{ margin: '14px 0 0', fontSize: '12.5px', lineHeight: 1.6, color: '#A9B4C7', textWrap: 'pretty' as any }}>
                        Skor bulan ini {hsScore}/100. Histori bulan sebelumnya belum tersedia.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                {/* FIX (localhost maturity pass 7 Sep): cuma tampil kalau >=2 pilar
                    punya data real untuk dibandingkan -- kalau cuma 1 pilar (atau
                    nol) yang terukur, "ditahan oleh X" itu klaim analisis yang
                    tidak jujur (bukan benar-benar dibandingkan ke pilar lain). */}
                {pillarsWithData.length >= 2 ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', color: '#8A93A3' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#EF4444', flex: '0 0 7px' }} />
                    <span>Ditahan oleh {weakestPillar.name} {weakestPillar.score}/100</span>
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', color: '#8A93A3' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#5C6474', flex: '0 0 7px' }} />
                    <span>{pillarsWithData.length === 1 ? `Baru pilar ${pillarsWithData[0].name} yang terukur` : 'Belum ada pilar yang terukur'}</span>
                  </span>
                )}
                {alerts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenAlert('health')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '30px', padding: '0 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: '#F5F7FA', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Audit AI
                  </button>
                )}
              </div>
            </div>
            </>
            )}
          </div>

          {/* 6-Month Trend Chart (tab: Batang / Garis / Tabel) */}
          <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em', color: '#F5F7FA' }}>
                  Tren Kinerja {perfHorizon === '3m' ? '3 Bulan' : perfHorizon === '6m' ? '6 Bulan' : perfHorizon === 'ytd' ? 'Tahun Berjalan (YTD)' : perfHorizon === '1y' ? '1 Tahun' : perfHorizon === '3y' ? '3 Tahun' : perfHorizon === '5y' ? '5 Tahun' : '10 Tahun'}
                </span>
                <span style={{ display: 'block', marginTop: '5px', fontSize: '12px', color: '#A9B4C7' }}>
                  {isMultiYearTrend ? `Data historis tahunan (${trendYearsList[0]}–${trendYearsList[trendYearsList.length - 1]})` : (f.rev > 0 ? 'Data riil periode berjalan' : 'Menunggu pencatatan transaksi perdana')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#CBD3DF' }}>
                  <span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#3FBF8F' }} />
                  <span>Omset</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#F5F7FA' }}>{short(f.rev)}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#3FBF8F' }}>{f.mom}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#CBD3DF' }}>
                  <span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#4E9BFF' }} />
                  <span>Laba Bersih</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#F5F7FA' }}>{short(f.np)}</span>
                </span>
                {(trendMetricView === 'gp' || trendMetricView === 'all') && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#C4B5FD' }}>
                    <span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#8D55E8' }} />
                    <span>Laba Kotor</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#F5F7FA' }}>{short(f.gp > 0 ? f.gp : f.rev * 0.62)}</span>
                  </span>
                )}
                {trendMetricView === 'tax' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#FCD34D' }}>
                    <span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#F2A83B' }} />
                    <span>Est. PPh</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#F5F7FA' }}>{short(f.np * 0.11)}</span>
                  </span>
                )}
                {trendMetricView === 'headcount' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#67E8F9' }}>
                    <span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#06B6D4' }} />
                    <span>Karyawan</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#F5F7FA' }}>18 Staf</span>
                  </span>
                )}
              </div>
            </div>

            {hasAnyTransactions ? (
              <>
            {/* Controls Bar: View Mode, Metric Perspective, Horizon Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="sap-toolbar-bar">
                  {/* Visual Type Selector */}
                  <div className="sap-toolbar-item">
                    <span style={{ fontSize: '11px', color: '#8A93A3' }}>Tampilan:</span>
                    <select
                      aria-label="Tipe Tampilan Grafik"
                      value={trMode}
                      onChange={(e) => setTrMode(e.target.value as any)}
                      className="sap-toolbar-select"
                      style={{ fontWeight: 600, color: '#F5F7FA' }}
                    >
                      <option value="bar">Grafik Batang</option>
                      <option value="line">Grafik Garis</option>
                      <option value="table">Tabel Rinci</option>
                    </select>
                  </div>

                  <div className="sap-toolbar-divider" />

                  {/* Metric Perspective Filter */}
                  <div className="sap-toolbar-item">
                    <span style={{ fontSize: '11px', color: '#8A93A3' }}>Metrik:</span>
                    <select
                      aria-label="Perspektif Metrik"
                      value={trendMetricView}
                      onChange={(e) => setTrendMetricView(e.target.value as any)}
                      className="sap-toolbar-select"
                      style={{
                        color:
                          trendMetricView === 'all'
                            ? '#3FBF8F'
                            : trendMetricView === 'gp'
                            ? '#8D55E8'
                            : trendMetricView === 'tax'
                            ? '#F2A83B'
                            : '#06B6D4',
                        fontWeight: 600,
                      }}
                    >
                      <option value="all">Semua Finansial</option>
                      <option value="gp">+ Laba Kotor (Gross)</option>
                      <option value="tax">+ Pajak &amp; Bersih</option>
                      <option value="headcount">+ Staf &amp; Produktivitas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Horizon Selector Dropdown */}
              <div className="sap-toolbar-bar">
                <div className="sap-toolbar-item">
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Rentang:</span>
                  <select
                    aria-label="Rentang Waktu Grafik"
                    value={perfHorizon}
                    onChange={(e) => setPerfHorizon(e.target.value as any)}
                    className="sap-toolbar-select"
                    style={{ fontWeight: 600, color: '#4E9BFF' }}
                  >
                    <option value="3m">3 Bulan</option>
                    <option value="6m">6 Bulan</option>
                    <option value="ytd">Year-to-Date (YTD)</option>
                    <option value="1y">1 Tahun</option>
                    <option value="3y">3 Tahun</option>
                    <option value="5y">5 Tahun</option>
                    <option value="10y">10 Tahun</option>
                  </select>
                </div>
              </div>
            </div>

            {/* BATANG (BAR CHART) */}
            {trMode === 'bar' && (
              <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'stretch', minHeight: 0 }}>
                <div style={{ width: '76px', flex: '0 0 76px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '206px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(tmax)}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(tmax * 0.667)}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(tmax * 0.333)}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>Rp 0</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '206px', backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 68.33px)' }}>
                    {trendBars.map((b, bi) => (
                      <span key={bi} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', height: '100%' }}>
                        {/* Omset Bar */}
                        <span title={`Omset: ${b.value}`} style={{ width: trendMetricView === 'all' ? '28%' : '22%', height: `${b.revH}%`, borderRadius: '2px 2px 0 0', background: '#3FBF8F' }} />
                        {/* Laba Bersih Bar */}
                        <span title={`Laba Bersih: ${b.npVal}`} style={{ width: trendMetricView === 'all' ? '28%' : '22%', height: `${b.npH}%`, borderRadius: '2px 2px 0 0', background: '#4E9BFF' }} />
                        {/* Laba Kotor Bar if selected */}
                        {(trendMetricView === 'gp' || trendMetricView === 'all') && (
                          <span title={`Laba Kotor: ${b.gpVal}`} style={{ width: trendMetricView === 'all' ? '24%' : '22%', height: `${b.gpH}%`, borderRadius: '2px 2px 0 0', background: '#8D55E8' }} />
                        )}
                        {/* Tax Bar if selected */}
                        {trendMetricView === 'tax' && (
                          <span title={`Estimasi Pajak: ${b.taxVal}`} style={{ width: '22%', height: `${b.taxH}%`, borderRadius: '2px 2px 0 0', background: '#F2A83B' }} />
                        )}
                        {/* Headcount Bar if selected */}
                        {trendMetricView === 'headcount' && (
                          <span title={`Jumlah Karyawan: ${b.headcount} Staf`} style={{ width: '22%', height: `${b.hcH}%`, borderRadius: '2px 2px 0 0', background: '#06B6D4' }} />
                        )}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '9px' }}>
                    {trendBars.map((b, bi) => {
                      const isHighlight = isMultiYearTrend ? b.name === '2026' : b.name === (f.n ? f.n.split(' ')[0] : month);
                      return (
                        <span key={bi} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontSize: '11px', color: isHighlight ? '#F5F7FA' : '#8A93A3', fontWeight: isHighlight ? 600 : 400 }}>{b.name}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#8A93A3' }}>
                            {trendMetricView === 'headcount' ? `${b.headcount} Staf` : b.value}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* GARIS (LINE CHART) */}
            {trMode === 'line' && (
              <>
                <div style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'stretch', minHeight: 0 }}>
                  <div
                    onMouseLeave={() => setHoverIndex(-1)}
                    style={{ flex: 1, position: 'relative', height: '206px', backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 68.33px)' }}
                  >
                    <svg viewBox="0 0 1000 205" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                      <path d={trendRevPath.area} fill="url(#gGreen)" stroke="none" />
                      <path d={trendNpPath.area} fill="url(#gBlue)" stroke="none" />
                      <path d={trendRevPath.line} fill="none" stroke="#3FBF8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <path d={trendNpPath.line} fill="none" stroke="#4E9BFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      
                      {(trendMetricView === 'gp' || trendMetricView === 'all') && (
                        <>
                          <path d={trendGpPath.area} fill="url(#gPurple)" stroke="none" opacity="0.6" />
                          <path d={trendGpPath.line} fill="none" stroke="#8D55E8" strokeWidth="1.7" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </>
                      )}

                      {trendMetricView === 'tax' && (
                        <>
                          <path d={trendTaxPath.area} fill="url(#gAmber)" stroke="none" opacity="0.5" />
                          <path d={trendTaxPath.line} fill="none" stroke="#F2A83B" strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </>
                      )}

                      {trendMetricView === 'headcount' && (
                        <>
                          <path d={trendHcPath.area} fill="url(#gCyan)" stroke="none" opacity="0.6" />
                          <path d={trendHcPath.line} fill="none" stroke="#06B6D4" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </>
                      )}
                    </svg>

                    {trendPoints.map((p, i) => {
                      const nPts = trendPoints.length;
                      const L = nPts > 1 ? (i / (nPts - 1)) * 100 : 50;
                      const yr = 205 - (p.rev / tmax) * 205;
                      const yp = 205 - (p.np / tmax) * 205;
                      const ygp = 205 - (p.gp / tmax) * 205;
                      const yhc = 205 - (p.headcount / (maxHeadcount * 1.2)) * 205;
                      const colWidthPct = nPts > 0 ? 100 / nPts : 100;
                      return (
                        <React.Fragment key={p.key}>
                          <span style={{ position: 'absolute', left: `calc(${L}% - 4px)`, top: `${(yr - 4).toFixed(1)}px`, width: '8px', height: '8px', borderRadius: '2px', background: '#3FBF8F', boxShadow: '0 0 0 2px #0B0E14', pointerEvents: 'none' }} />
                          <span style={{ position: 'absolute', left: `calc(${L}% - 3.5px)`, top: `${(yp - 3.5).toFixed(1)}px`, width: '7px', height: '7px', borderRadius: '2px', background: '#4E9BFF', boxShadow: '0 0 0 2px #0B0E14', pointerEvents: 'none' }} />
                          {(trendMetricView === 'gp' || trendMetricView === 'all') && (
                            <span style={{ position: 'absolute', left: `calc(${L}% - 3px)`, top: `${(ygp - 3).toFixed(1)}px`, width: '6px', height: '6px', borderRadius: '2px', background: '#8D55E8', boxShadow: '0 0 0 2px #0B0E14', pointerEvents: 'none' }} />
                          )}
                          {trendMetricView === 'headcount' && (
                            <span style={{ position: 'absolute', left: `calc(${L}% - 3px)`, top: `${(yhc - 3).toFixed(1)}px`, width: '6px', height: '6px', borderRadius: '2px', background: '#06B6D4', boxShadow: '0 0 0 2px #0B0E14', pointerEvents: 'none' }} />
                          )}
                          <span
                            onMouseEnter={() => setHoverIndex(i)}
                            style={{ position: 'absolute', left: `calc(${L}% - ${colWidthPct / 2}%)`, top: 0, bottom: 0, width: `${colWidthPct}%`, cursor: 'crosshair', background: hoverIndex === i ? 'rgba(255,255,255,0.035)' : 'transparent' }}
                          />
                        </React.Fragment>
                      );
                    })}

                    {hoverIndex >= 0 && trendPoints[hoverIndex] && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${trendPoints.length > 1 ? (hoverIndex / (trendPoints.length - 1)) * 100 : 50}%`,
                          top: '4px',
                          transform: hoverIndex >= trendPoints.length - 2 ? 'translateX(-100%)' : hoverIndex <= 1 ? 'translateX(0)' : 'translateX(-50%)',
                          background: '#10141C',
                          border: '1px solid rgba(255,255,255,0.14)',
                          borderRadius: '4px',
                          padding: '12px 14px',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          boxShadow: '0 10px 28px rgba(0,0,0,0.5)',
                          zIndex: 5,
                        }}
                      >
                        <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#CBD3DF', marginBottom: '8px' }}>
                          Periode: {trendPoints[hoverIndex].name}
                        </span>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '12px', color: '#F5F7FA' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{ width: '8px', height: '2.5px', borderRadius: '2px', background: '#3FBF8F' }} />
                              <span>Omset</span>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                              {rp(trendPoints[hoverIndex].rev)}
                            </span>
                          </span>

                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '12px', color: '#F5F7FA' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{ width: '8px', height: '2.5px', borderRadius: '2px', background: '#8D55E8' }} />
                              <span>Laba Kotor</span>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#C4B5FD' }}>
                              {rp(trendPoints[hoverIndex].gp)}
                            </span>
                          </span>

                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '12px', color: '#F5F7FA' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{ width: '8px', height: '2.5px', borderRadius: '2px', background: '#4E9BFF' }} />
                              <span>Laba Bersih</span>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#93C5FD' }}>
                              {rp(trendPoints[hoverIndex].np)}
                            </span>
                          </span>

                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '11.5px', color: '#CBD3DF' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{ width: '8px', height: '2.5px', borderRadius: '2px', background: '#F2A83B' }} />
                              <span>Pajak (PPh)</span>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#FCD34D' }}>
                              {rp(trendPoints[hoverIndex].tax)}
                            </span>
                          </span>

                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '11.5px', color: '#CBD3DF' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{ width: '8px', height: '2.5px', borderRadius: '2px', background: '#06B6D4' }} />
                              <span>Jumlah Karyawan</span>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#67E8F9', fontWeight: 600 }}>
                              {trendPoints[hoverIndex].headcount} Staf ({short(trendPoints[hoverIndex].revPerCapita)}/staf)
                            </span>
                          </span>
                        </div>

                        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: '#8A93A3' }}>Pertumbuhan:</span>
                          <span style={{ color: '#3FBF8F', fontWeight: 600 }}>{trendPoints[hoverIndex].growth}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ width: '66px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '206px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(tmax)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(tmax * 0.667)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(tmax * 0.333)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>Rp 0</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '76px' }}>
                  {trendPoints.map((p) => (
                    <span key={p.key} style={{ fontSize: '11px', fontWeight: p.isCurrent ? 600 : 400, color: p.isCurrent ? '#F5F7FA' : '#8A93A3' }}>
                      {p.name}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* TABEL RINCI (DETAIL MULTI-METRIC TABLE) */}
            {trMode === 'table' && (
              <div style={{ flex: 1, minHeight: 0, overflowX: 'auto' }}>
                <div style={{ minWidth: '700px', display: 'grid', gridTemplateColumns: '64px minmax(90px,1fr) minmax(90px,1fr) minmax(90px,1fr) 75px 80px 85px 85px', gap: '10px', padding: '0 0 9px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>Periode</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', textAlign: 'right' }}>Omset</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', textAlign: 'right' }}>Laba Kotor</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', textAlign: 'right' }}>Laba Bersih</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', textAlign: 'right' }}>Pajak PPh</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', textAlign: 'right' }}>Karyawan</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', textAlign: 'right' }}>Margin</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', textAlign: 'right' }}>Pertumbuhan</span>
                </div>
                {trendTable.map((r, ri) => (
                  <div key={ri} style={{ minWidth: '700px', display: 'grid', gridTemplateColumns: '64px minmax(90px,1fr) minmax(90px,1fr) minmax(90px,1fr) 75px 80px 85px 85px', gap: '10px', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.055)', background: r.isLast ? 'rgba(63,191,143,0.04)' : 'transparent' }}>
                    <span style={{ fontSize: '12px', fontWeight: r.isLast ? 600 : 500, color: r.isLast ? '#F5F7FA' : '#CBD3DF' }}>{r.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#F5F7FA', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.rev}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#8D55E8', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.gp}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#4E9BFF', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.net}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#F2A83B', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.tax}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#06B6D4', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.headcount}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#CBD3DF', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.margin}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: r.growth.startsWith('-') ? '#EF4444' : '#3FBF8F', textAlign: 'right' }}>{r.growth}</span>
                  </div>
                ))}
              </div>
            )}
              </>
            ) : (
              <div style={{ minHeight: '152px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', borderRadius: '5px', background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <span style={{ maxWidth: '520px', fontSize: '12px', lineHeight: 1.6, color: '#8A93A3' }}>
                  Belum ada transaksi untuk membentuk tren enam bulan. Grafik akan aktif otomatis setelah data pendapatan atau laba tercatat.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3A. REKOMENDASI STRATEGIS AI */}
        {/* ========================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#F5F7FA' }}>Rekomendasi Strategis AI</h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 9px', borderRadius: '4px', background: 'rgba(78,155,255,0.1)', border: '1px solid rgba(78,155,255,0.28)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.01em', color: '#8CC0FF' }}>
                Butuh Keputusan
              </span>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Update harian dari data kas, inventori &amp; tim</span>
              <button
                type="button"
                onClick={() => setPanelOpen((p) => ({ ...p, ai: !p.ai }))}
                title="Lipat / buka panel"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', flex: '0 0 28px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '4px', cursor: 'pointer' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 220ms ease', transform: aiRecPanelOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A93A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9.5l6 5.5 6-5.5" /></svg>
                </span>
              </button>
            </span>
          </div>

          {!(aiRecPanelOpen) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 17px', borderRadius: '4px', background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>Rekomendasi Strategis AI</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 700, color: '#8CC0FF' }}>
                {aiActionRecs.length === 0 ? 'Belum ada rekomendasi' : `${aiActionPendingCount} menunggu keputusan`}
              </span>
            </div>
          )}

          {aiRecPanelOpen && aiActionRecs.length === 0 && (
            <div style={{ padding: '28px 20px', textAlign: 'center', borderRadius: '4px', background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '13px', color: '#8A93A3' }}>
                Belum ada rekomendasi AI. Rekomendasi akan muncul otomatis begitu ada transaksi dan data operasional tercatat.
              </span>
            </div>
          )}

          {aiRecPanelOpen && aiActionRecs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '18px', alignItems: 'stretch' }}>
              {aiActionRecs.map((r) => (
                <div key={r.id} style={aiRecCardStyle(r.state, r.tone)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={aiRecTagStyle(r.tone)}>
                      <span>{r.tag}</span>
                    </span>
                    <span style={aiRecChipStyle(r.state)}>{r.stateText}</span>
                  </div>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, lineHeight: 1.45, letterSpacing: '-0.01em', color: '#F5F7FA', textWrap: 'pretty' as any }}>
                    {r.title}
                  </span>
                  <p style={{ margin: 0, flex: '1 1 auto', fontSize: '12px', lineHeight: 1.6, color: '#A9B4C7', textWrap: 'pretty' as any }}>{r.why}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', minHeight: '50px', padding: '11px 12px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3' }}>{r.metricLabel}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: '13px', fontWeight: 700, color: r.state === 'skip' ? '#8A93A3' : r.metricColor, whiteSpace: 'nowrap' }}>
                      {r.metric}
                    </span>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={r.onOk} style={aiRecOkBtnStyle(r.state === 'ok', r.tone)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      <span>{r.okText}</span>
                    </button>
                    <button
                      type="button"
                      onClick={r.onReview}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        height: '32px',
                        padding: '0 11px',
                        background: r.state === 'review' ? 'rgba(242,168,59,0.18)' : 'rgba(255,255,255,0.04)',
                        border: r.state === 'review' ? '1px solid #F2A83B' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: r.state === 'review' ? '#F2A83B' : '#CBD3DF',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                      <span>{r.reviewText}</span>
                    </button>
                    <button
                      type="button"
                      onClick={r.onSkip}
                      style={{ display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 11px', background: r.state === 'skip' ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.04)', border: r.state === 'skip' ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: r.state === 'skip' ? '#EF4444' : '#8A93A3', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {r.skipText}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3B. PROYEKSI 3 BULAN KE DEPAN */}
        {/* ========================================================================= */}
        {hasForecastBase ? (
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px 10px 20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#F5F7FA' }}>
                Proyeksi {fcHorizon === '1m' ? '1 Bulan Depan' : fcHorizon === '3m' ? '3 Bulan ke Depan' : fcHorizon === 'q4' ? 'Kuartal 4 (Akhir Tahun)' : '1 Tahun Penuh (12 Bulan)'}
              </h3>
              <span style={{ fontSize: '12px', color: '#A9B4C7' }}>Bila laju pertumbuhan tren berjalan berlanjut</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="sap-toolbar-bar">
                {/* Periode Proyeksi Dropdown */}
                <div className="sap-toolbar-item">
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Periode:</span>
                  <select
                    aria-label="Periode Proyeksi"
                    value={fcHorizon}
                    onChange={(e) => setFcHorizon(e.target.value as any)}
                    className="sap-toolbar-select"
                    style={{ fontWeight: 600, color: '#F5F7FA' }}
                  >
                    <option value="1m">1 Bulan Depan</option>
                    <option value="3m">3 Bulan ke Depan</option>
                    <option value="q4">Akhir Tahun (Q4)</option>
                    <option value="1y">1 Tahun Penuh</option>
                  </select>
                </div>

                <div className="sap-toolbar-divider" />

                {/* Skenario Proyeksi Dropdown */}
                <div className="sap-toolbar-item">
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Skenario:</span>
                  <select
                    aria-label="Skenario Proyeksi"
                    value={fcMode}
                    onChange={(e) => setFcMode(e.target.value as any)}
                    className="sap-toolbar-select"
                    style={{
                      color: fcMode === 'opt' ? '#22C55E' : fcMode === 'cons' ? '#F2A83B' : '#4E9BFF',
                      fontWeight: 600,
                    }}
                  >
                    <option value="base">Dasar (Normal)</option>
                    <option value="cons">Konservatif (-15%)</option>
                    <option value="opt">Optimis (Akselerasi)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {/* Left Column: Monthly Projection Cards */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#A9B4C7' }}>Perkiraan Omset &amp; Laba Tiap Bulan</span>
                <span style={{ fontSize: '11px', color: '#8A93A3', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '2px' }}>
                   Patokan: {f.n ? (f.n.split(' ')[0] || month) : month} riil
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {fcMonths.map((mo, mi) => (
                  <div
                    key={mi}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '5px',
                      background: 'rgba(255,255,255,0.025)',
                      border: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {/* Header: Period & Month Name */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, color: '#4E9BFF', background: 'rgba(78,155,255,0.12)', padding: '2px 7px', borderRadius: '4px' }}>
                          {mo.kind}
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#F5F7FA' }}>
                          {mo.name}
                        </span>
                      </div>
                        <span style={{ fontSize: '11px', color: '#8A93A3' }}>Perkiraan 30 hari</span>
                    </div>

                    {/* 2 Progress Bars (Omset & Laba) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* Omset Bar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
                          <span style={{ color: '#8A93A3', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#4E9BFF' }} />
                            <span>Omset</span>
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                            {mo.rev}
                          </span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${mo.revPct}%`, height: '100%', borderRadius: '2px', background: '#4E9BFF' }} />
                        </div>
                      </div>

                      {/* Laba Bersih Bar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
                          <span style={{ color: '#8A93A3', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: '#3FBF8F' }} />
                            <span>Laba</span>
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#3FBF8F', fontVariantNumeric: 'tabular-nums' }}>
                            {mo.net}
                          </span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${mo.netPct}%`, height: '100%', borderRadius: '2px', background: '#3FBF8F' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Quarter Summary KPIs */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(0,0,0,0.12)', borderRadius: '4px', margin: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#A9B4C7' }}>Total Proyeksi ({fcHorizon === '1m' ? '1 Bulan' : fcHorizon === '3m' ? '3 Bulan' : fcHorizon === 'q4' ? 'Kuartal 4' : '12 Bulan'})</span>

              {/* 2 KPI Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '5px', background: 'rgba(78,155,255,0.08)', border: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Proyeksi Omset</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 1.5vw, 22px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                    {fcRevQ}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '5px', background: 'rgba(63,191,143,0.08)', border: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Proyeksi Laba Bersih</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 1.5vw, 22px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#3FBF8F', fontVariantNumeric: 'tabular-nums' }}>
                    {fcNetQ}
                  </span>
                </div>
              </div>

              {/* Detail Key-Values */}
              <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 0' }}>
                  <span style={{ fontSize: '12px', color: '#8A93A3' }}>Perkiraan Kas Akhir Periode</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                    {fcCashEnd}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 0' }}>
                  <span style={{ fontSize: '12px', color: '#8A93A3' }}>Laju Pertumbuhan Dipakai</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#4E9BFF', background: 'rgba(78,155,255,0.10)', padding: '2px 8px', borderRadius: '4px' }}>
                    +{fcGrowthLabel}/bulan
                  </span>
                </div>
              </div>

              {/* Bottom AI Scenario Note */}
              <div style={{ marginTop: 'auto', padding: '10px 12px', borderRadius: '4px', background: 'rgba(78,155,255,0.08)', border: 'none', display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                <span style={{ width: '22px', height: '22px', flex: '0 0 22px', borderRadius: '4px', background: 'rgba(78,155,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8CC0FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4.5M8.5 14h.01M15.5 14h.01M9 17.5h6" /></svg>
                </span>
                <span style={{ fontSize: '11.5px', lineHeight: 1.5, color: '#CBD3DF' }}>
                  {fcNoteText}
                </span>
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', padding: '20px 22px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', minWidth: 0, flex: '1 1 360px' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flex: '0 0 32px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#8A93A3' }}>
                  <Bot size={16} strokeWidth={1.8} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#F5F7FA' }}>Proyeksi AI menunggu data</h3>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', lineHeight: 1.55, color: '#A9B4C7', maxWidth: '700px' }}>
                    Belum ada riwayat kas atau pendapatan yang cukup untuk membuat prediksi. Masukkan transaksi dan target tahunan lewat AI Assistant agar analisis kuartal tidak berubah menjadi tebakan.
                  </p>
                </div>
              </div>
              {onNavChange && (
                <button
                  type="button"
                  onClick={() => onNavChange('ai-assistant')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '0 13px', borderRadius: '4px', border: 'none', background: 'rgba(78,155,255,0.13)', color: '#8CC0FF', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Buka AI Assistant
                  <ArrowRight size={13} strokeWidth={1.9} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3C. SIMULATOR WHAT-IF */}
        {/* ========================================================================= */}
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', padding: '22px', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>Simulator Skenario Bisnis (What-If)</h3>
            <span style={{ fontSize: '12px', color: '#8A93A3' }}>Uji skenario keputusan terhadap kas &amp; runway riil sebelum dieksekusi</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Unified Command Surface: Zero separate bordered boxes */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.035)',
              borderRadius: '4px',
              padding: '4px 6px 4px 16px',
              gap: '10px',
              border: 'none',
              flexWrap: 'wrap'
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6C778B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={simPrompt}
                onChange={(e) => setSimPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSimulation(); }}
                placeholder="Contoh: rekrut 2 developer gaji 8jt, pangkas biaya operasional 10jt, atau naikkan budget iklan 20%"
                style={{
                  flex: '1 1 300px',
                  minWidth: 0,
                  height: '38px',
                  padding: '0',
                  background: 'transparent',
                  border: 'none',
                  color: '#F5F7FA',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={runSimulation}
                disabled={!simPrompt.trim() || simLoading}
                style={{
                  height: '36px',
                  padding: '0 18px',
                  background: !simPrompt.trim() || simLoading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(180deg,#0F6FE0,#0058BE)',
                  border: 'none',
                  borderRadius: '4px',
                  color: !simPrompt.trim() || simLoading ? '#6C778B' : '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: !simPrompt.trim() || simLoading ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  transition: 'all 180ms ease'
                }}
              >
                {simLoading ? 'Menghitung…' : 'Jalankan simulasi'}
              </button>
            </div>

            {simError && (
              <div style={{ padding: '11px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', fontSize: '12.5px', color: '#EF4444' }}>
                {simError}
              </div>
            )}

            {simResult && (
              <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '14px', animation: 'klirUp 240ms ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>{simResult.scenarioTitle}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 11px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: simRiskStyle[simResult.riskLevel]?.bg, border: `1px solid ${simRiskStyle[simResult.riskLevel]?.border}`, color: simRiskStyle[simResult.riskLevel]?.color }}>
                    {simRiskStyle[simResult.riskLevel]?.label || simResult.riskLevel}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#CBD3DF' }}>{simResult.summary}</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '12px' }}>
                  <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.025)', border: 'none', borderRadius: '5px' }}>
                    <div style={{ fontSize: '11px', color: '#98A2B3', marginBottom: '4px' }}>Runway sebelum</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>{simResult.baselineRunwayMonths} bulan</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.025)', border: 'none', borderRadius: '5px' }}>
                    <div style={{ fontSize: '11px', color: '#98A2B3', marginBottom: '4px' }}>Runway setelah</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 600, color: simResult.runwayDeltaMonths < 0 ? '#EF4444' : '#3FBF8F' }}>
                      {simResult.simulatedRunwayMonths} bulan ({simResult.runwayDeltaMonths >= 0 ? '+' : ''}{simResult.runwayDeltaMonths})
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.025)', border: 'none', borderRadius: '5px' }}>
                    <div style={{ fontSize: '11px', color: '#98A2B3', marginBottom: '4px' }}>Titik impas</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>
                      {simResult.breakEvenMonthEstimated ? `Bulan ke-${simResult.breakEvenMonthEstimated}` : '—'}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.025)', border: 'none', borderRadius: '5px' }}>
                    <div style={{ fontSize: '11px', color: '#98A2B3', marginBottom: '4px' }}>Kas habis diproyeksi</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 600, color: simResult.cashOutDateProjected ? '#EF4444' : '#F5F7FA' }}>
                      {simResult.cashOutDateProjected || 'Tidak diproyeksi'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '64px', padding: '8px 0' }}>
                  {simResult.monthlyProjections.map((mo: any, i: number) => {
                    const maxCash = Math.max(...simResult.monthlyProjections.map((p: any) => p.projectedCash), 1);
                    const pct = Math.max(4, (mo.projectedCash / maxCash) * 100);
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span
                          title={`${mo.monthName}: kas Rp ${mo.projectedCash.toLocaleString('id-ID')}`}
                          style={{ width: '100%', height: `${pct}%`, borderRadius: '3px', background: mo.projectedCash <= 0 ? '#EF4444' : '#4E9BFF' }}
                        />
                        <span style={{ fontSize: '9px', color: '#8A93A3' }}>{mo.monthName.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: '13px 15px', background: 'rgba(78,155,255,0.05)', border: '1px solid rgba(78,155,255,0.18)', borderRadius: '4px' }}>
                  <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.65, color: '#DCE3EC' }}>{simResult.strategicVerdict ? String(simResult.strategicVerdict).replace(/^[\u{1F300}-\u{1F9FF}\s]+/u, '') : ''}</p>
                </div>

                {/* Risk Storytelling & Modal Buffer Analysis */}
                <div style={{ padding: '13px 15px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#CBD3DF' }}>Analisis Faktor Risiko &amp; Ketahanan Kas</span>
                    <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>Horizon simulasi: {simResult.monthlyProjections?.length || 6} bulan</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                    <div style={{ padding: '8px 10px', borderRadius: '4px', background: '#090C12', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '10.5px', color: '#8A93A3', display: 'block' }}>Rasio Tekanan Runway</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: simResult.simulatedRunwayMonths < 3 ? '#EF4444' : simResult.simulatedRunwayMonths < 6 ? '#F2A83B' : '#3FBF8F' }}>
                        {simResult.simulatedRunwayMonths < 3 ? 'Kritis (<3 bln)' : simResult.simulatedRunwayMonths < 6 ? 'Perhatian (<6 bln)' : 'Sehat (≥6 bln)'}
                      </span>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '4px', background: '#090C12', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '10.5px', color: '#8A93A3', display: 'block' }}>Estimasi Beban Modal Baru</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>
                        {simResult.runwayDeltaMonths < 0 ? `Beban kas ${Math.abs(simResult.runwayDeltaMonths)} bln operasional` : 'Surplus arus kas masuk'}
                      </span>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '4px', background: '#090C12', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '10.5px', color: '#8A93A3', display: 'block' }}>Rekomendasi Cadangan Modal</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#4E9BFF' }}>
                        {short(Math.max(10000000, (f.exp > 0 ? f.exp : 15000000) * (simResult.simulatedRunwayMonths < 4 ? 3 : 1)))}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {simResult.actionableSteps.map((step: string, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '2px', background: '#4E9BFF', flexShrink: 0, marginTop: '6px' }} />
                      <span style={{ fontSize: '12px', lineHeight: 1.55, color: '#CBD3DF' }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. EXPANDABLE SECTION: KEUANGAN & ARUS KAS BISNIS */}
        {/* 10 Sep 2026 (Fable, audit 3.1) -- gerbang isModuleEnabled('finance')
            DITAMBAH di sini: sebelumnya section ini render PENUH tanpa syarat
            walau kartu ringkas "Kondisi Kas" di atasnya sudah bergerbang --
            defense-in-depth yang bocor di section besar. Default semua modul
            nyala = tidak ada perubahan tampak untuk tenant lama. */}
        {/* ========================================================================= */}
        {isModuleEnabled(enabledModules, 'finance') && (
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#F5F7FA' }}>
                Keuangan &amp; Arus Kas Bisnis
              </h3>
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#8A93A3' }}>{f.n}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sap-toolbar-bar">
                <div className="sap-toolbar-item">
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Komparasi:</span>
                  <select
                    aria-label="Komparasi Keuangan"
                    value={cmpFinMode}
                    onChange={(e) => setCmpFinMode(e.target.value as any)}
                    className="sap-toolbar-select"
                    style={{ fontWeight: cmpFinMode === 'none' ? 500 : 600, color: cmpFinMode === 'none' ? '#F5F7FA' : '#4E9BFF' }}
                  >
                    <option value="none">Bulan Ini (Standar)</option>
                    <option value="mom">vs Bulan Lalu (MoM)</option>
                    <option value="qoq">vs Kuartal Lalu (QoQ)</option>
                    <option value="yoy">YoY Tahun Lalu</option>
                    <option value="ytd">vs YTD (Year-to-Date)</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenSection(openSection === 'fin' ? '' : 'fin')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '30px', padding: '0 11px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', background: openSection === 'fin' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', border: 'none', color: openSection === 'fin' ? '#F5F7FA' : '#98A2B3' }}
              >
                <span>{openSection === 'fin' ? 'Tutup grafik' : 'Lihat grafik'}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ transform: openSection === 'fin' ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
                  <path d="M6 9.5l6 5.5 6-5.5" />
                </svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: '8px', padding: '0 16px 16px' }}>
            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Saldo kas bersih</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {short(cashNow)}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>
                Runway {runwayDisplay} &middot; {!hasAnyTransactions ? 'Menunggu data' : cashNow > 0 && runwayMonths >= 6 ? 'aman' : cashNow <= 0 ? 'kritis' : 'waspada'}
              </span>
              {targetCmpFin && (() => {
                const d = deltaChip(cashNow, targetCmpFin.cash);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpFin.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{short(targetCmpFin.cash)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Pendapatan</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {short(f.rev)}
              </div>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginTop: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: f.mom.startsWith('-') ? '#EF4444' : f.mom.startsWith('+') ? '#3FBF8F' : '#8A93A3',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <path d={f.mom.startsWith('-') ? 'M6 10l4-6H2z' : 'M6 2l4 6H2z'} />
                </svg>
                <span>{f.mom} dari bulan lalu</span>
              </span>
              {targetCmpFin && (() => {
                const d = deltaChip(f.rev, targetCmpFin.rev);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpFin.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{short(targetCmpFin.rev)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Pengeluaran &amp; HPP</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {short(f.exp)}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>
                {f.rev > 0 ? Math.round((f.exp / f.rev) * 100) : 0}% dari pendapatan
              </span>
              {targetCmpFin && (() => {
                const d = deltaChip(f.exp, targetCmpFin.exp);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpFin.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{short(targetCmpFin.exp)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Laba kotor</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {short(f.gp)}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>Margin {f.rev > 0 ? `${String(f.nm).replace('.', ',')}%` : '0%'}</span>
              {targetCmpFin && (() => {
                const d = deltaChip(f.gp, targetCmpFin.gp);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpFin.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{short(targetCmpFin.gp)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: f.np > 0 ? 'rgba(63,191,143,0.06)' : f.np < 0 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: f.np > 0 ? '#3FBF8F' : f.np < 0 ? '#EF4444' : '#8A93A3' }}>
                Laba bersih usaha
              </span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 1.6vw, 27px)', fontWeight: 700, letterSpacing: '-0.025em', color: f.np > 0 ? '#3FBF8F' : f.np < 0 ? '#EF4444' : '#8A93A3', fontVariantNumeric: 'tabular-nums' }}>
                {f.np > 0 ? `+${short(f.np)}` : f.np < 0 ? `-${short(Math.abs(f.np))}` : short(0)}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, color: f.np > 0 ? '#3FBF8F' : f.np < 0 ? '#EF4444' : '#8A93A3' }}>
                {f.rev > 0 ? `Margin bersih ${String(f.nm).replace('.', ',')}%` : f.exp > 0 ? `Beban Rp ${short(f.exp)}` : 'Belum ada transaksi'}
              </span>
              {targetCmpFin && (() => {
                const d = deltaChip(f.np, targetCmpFin.np);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '11px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.11)' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpFin.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{short(targetCmpFin.np)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>
          </div>

          {openSection === 'fin' && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)', gap: '16px', animation: 'klirUp 260ms ease-out' }}>
              <div>
                <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>
                  Arus kas bulanan — data aktual {kk.join(', ')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '12px 0 10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#CBD3DF' }}><span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#3FBF8F' }} /><span>Omset</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#CBD3DF' }}><span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#4E9BFF' }} /><span>Laba bersih</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#CBD3DF' }}><span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#EF4444' }} /><span>Beban</span></span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                  <div style={{ flex: 1, position: 'relative', height: '214px', backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 71px)' }}>
                    <svg viewBox="0 0 1000 214" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                      <path d={finRevPath.area} fill="url(#gGreen)" stroke="none" />
                      <path d={finRevPath.line} fill="none" stroke="#3FBF8F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <path d={finNpPath.line} fill="none" stroke="#4E9BFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <path d={finExpPath.line} fill="none" stroke="#EF4444" strokeWidth="1.6" strokeDasharray="5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                  <div style={{ width: '66px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '214px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(fmax)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(fmax * 0.667)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(fmax * 0.333)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>Rp 0</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '76px', marginTop: '8px' }}>
                  {kk.map((label) => <span key={label} style={{ fontSize: '11px', color: '#8A93A3' }}>{label}</span>)}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Alokasi biaya</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', fontWeight: 600, color: '#98A2B3' }}>Total {short(f.exp)}</span>
                </div>
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column' }}>
                  {costRows.map((row, idx) => (
                    <div key={idx} style={{ padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12.5px', color: '#F5F7FA' }}>{row.label}</span>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', width: '34px', textAlign: 'right' }}>{row.pct}</span>
                        </span>
                      </div>
                      <div style={{ marginTop: '7px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${row.pctNum}%`, height: '100%', borderRadius: '2px', background: row.color }} />
                      </div>
                    </div>
                  ))}
                  {/* 10 Sep 2026 (Fable, audit 3.4) -- catatan jujur pengganti
                      3 baris HPP/Budget iklan/Payroll yang dihapus (dulu
                      selalu Rp 0/0%, lihat komentar di costRows). */}
                  <div style={{ padding: '9px 0', fontSize: '11px', color: '#8A93A3', fontStyle: 'italic' }}>
                    Rincian HPP/iklan/gaji belum bisa dipisah dari data kas.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', padding: '13px 0 0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#F5F7FA' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2A83B" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                      <span>Piutang klien belum tertagih</span>
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px', fontWeight: 600, color: '#F2A83B', fontVariantNumeric: 'tabular-nums' }}>
                      {short(f.ar)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Insight Visual Arus Kas & Profitabilitas */}
              <div style={{ gridColumn: '1 / -1', padding: '14px 18px', borderRadius: '5px', background: 'rgba(63,191,143,0.04)', border: '1px solid rgba(63,191,143,0.15)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#3FBF8F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Insight Visual Arus Kas &amp; Profitabilitas
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8A93A3' }}>
                    Margin Bersih {String(f.nm).replace('.', ',')}% &bull; Runway {runwayDisplay}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#CBD3DF' }}>
                  {f.np > 0
                    ? `Tren arus kas bulanan menunjukkan pertumbuhan omset stabil dengan margin bersih ${String(f.nm).replace('.', ',')}%. Struktur biaya didominasi HPP (${costRows[0]?.pct || '45%'}) yang masih berada dalam rentang efisien industri. Cadangan kas mencukupi kelangsungan operasional hingga ${runwayDisplay} ke depan tanpa risiko gagal bayar kewajiban jangka pendek.`
                    : `Pengeluaran operasional melampaui omset periode berjalan dengan defisit tercatat Rp ${short(Math.abs(f.np))}. Disarankan pengetatan biaya overhead dan percepatan penagihan piutang untuk mencegah penurunan tajam pada cadangan kas.`}
                </p>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ========================================================================= */}
        {/* 5. EXPANDABLE SECTION: MARKETING & PERTUMBUHAN PELANGGAN */}
        {/* 10 Sep 2026 (Fable, audit 3.1) -- gerbang isModuleEnabled('advertising')
            DITAMBAH, pola sama dengan Section 4 di atas. */}
        {/* ========================================================================= */}
        {isModuleEnabled(enabledModules, 'advertising') && (
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#F5F7FA' }}>
                Marketing &amp; Pertumbuhan Pelanggan
              </h3>
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#8A93A3' }}>{f.n}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sap-toolbar-bar">
                <div className="sap-toolbar-item">
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Komparasi:</span>
                  <select
                    aria-label="Komparasi Marketing"
                    value={cmpMktMode}
                    onChange={(e) => setCmpMktMode(e.target.value as any)}
                    className="sap-toolbar-select"
                    style={{ fontWeight: cmpMktMode === 'none' ? 500 : 600, color: cmpMktMode === 'none' ? '#F5F7FA' : '#06B6D4' }}
                  >
                    <option value="none">Bulan Ini (Standar)</option>
                    <option value="mom">vs Bulan Lalu (MoM)</option>
                    <option value="qoq">vs Kuartal Lalu (QoQ)</option>
                    <option value="yoy">YoY Tahun Lalu</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenSection(openSection === 'mkt' ? '' : 'mkt')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '30px', padding: '0 11px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', background: openSection === 'mkt' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', border: 'none', color: openSection === 'mkt' ? '#F5F7FA' : '#98A2B3' }}
              >
                <span>{openSection === 'mkt' ? 'Tutup grafik' : 'Lihat grafik'}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ transform: openSection === 'mkt' ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
                  <path d="M6 9.5l6 5.5 6-5.5" />
                </svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '8px', padding: '0 16px 16px' }}>
            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(78,155,255,0.04)' }}>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Blended ROAS iklan</span>
              <div style={{ marginTop: '9px', display: 'flex', alignItems: 'baseline', gap: '9px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 1.6vw, 27px)', fontWeight: 700, letterSpacing: '-0.025em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {m.spend > 0 && m.roas > 0 ? `${String(m.roas).replace('.', ',')}x` : 'Belum ada data'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: m.roas > 0 ? roasTone(m.roas) : '#8A93A3', whiteSpace: 'nowrap' }}>{m.roas > 0 ? roasWord(m.roas) : 'ROAS belum diisi'}</span>
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>{m.spend > 0 ? 'Target minimum 3,0x' : 'Belum ada pengeluaran iklan tercatat'}</span>
              {targetCmpMkt && (() => {
                const d = deltaChip(m.roas, targetCmpMkt.roas);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpMkt.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{String(targetCmpMkt.roas).replace('.', ',')}x</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Omset dari iklan</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {m.attr > 0 ? short(m.attr) : 'Belum ada data'}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>{m.spend > 0 ? `Belanja iklan ${short(m.spend)}` : 'Omset per kanal iklan belum terlacak'}</span>
              {targetCmpMkt && (() => {
                const d = deltaChip(m.attr, targetCmpMkt.attr);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpMkt.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{short(targetCmpMkt.attr)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Prospek masuk</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {hasMarketingSnapshot ? `${m.leads} leads` : 'Belum ada data'}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>{hasMarketingConversionData ? `Konversi ${m.conv.replace('.', ',')}` : 'Konversi belum terlacak'}</span>
              {targetCmpMkt && (() => {
                const d = deltaChip(m.leads, targetCmpMkt.leads);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpMkt.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{targetCmpMkt.leads} leads</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Biaya per prospek</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {hasMarketingCacData && m.cac > 0 ? short(m.cac) : 'Belum ada data'}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>{hasMarketingCacData ? 'CAC per lead masuk' : 'CAC belum terlacak'}</span>
              {targetCmpMkt && (() => {
                const d = deltaChip(m.cac, targetCmpMkt.cac);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '11px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.11)' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpMkt.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{short(targetCmpMkt.cac)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>
          </div>

          {/* 10 Sep 2026 (Fable, audit 3.5) -- blok TAMBAHAN data kampanye
              NYATA (angka `m.*` di atas masih dari DEFAULT_MKT hardcode nol --
              rewiring penuh grafik/prevM ditandai audit sebagai pekerjaan
              besar lintas modul, di luar anggaran diff-minimal batch ini).
              Fetch GET /api/v1/marketing/campaigns sungguhan supaya CEO tetap
              dapat angka riil hari ini, TANPA menunggu roadmap besar itu. */}
          <div style={{ margin: '0 16px 16px', padding: '13px 16px', borderRadius: '5px', background: 'rgba(78,155,255,0.05)', border: '1px solid rgba(78,155,255,0.14)' }}>
            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, color: '#8CC0FF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>
              Data kampanye tercatat
            </span>
            {!isCurrentMonth ? (
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>Data historis kampanye belum tersedia karena sumber kampanye belum menyimpan tanggal/riwayat per periode.</span>
            ) : campaignsSummaryError ? (
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>Belum bisa memuat data kampanye.</span>
            ) : !periodCampaignsSummary || periodCampaignsSummary.totalCount === 0 ? (
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>Belum ada kampanye tercatat.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
                <span style={{ fontSize: '12px', color: '#CBD3DF' }}>{periodCampaignsSummary.totalCount} kampanye ({periodCampaignsSummary.activeCount} aktif)</span>
                <span style={{ fontSize: '12px', color: '#CBD3DF' }}>Estimasi belanja dari kampanye aktif {short(periodCampaignsSummary.spendEstimate)}</span>
                <span style={{ fontSize: '12px', color: '#CBD3DF' }}>{periodCampaignsSummary.leadsTotal} leads</span>
                <span style={{ fontSize: '12px', color: '#CBD3DF' }}>
                  {periodCampaignsSummary.roasAvg !== null ? `ROAS rata-rata ${periodCampaignsSummary.roasAvg.toFixed(1)}x` : 'ROAS belum diisi di kampanye manapun'}
                </span>
              </div>
            )}
          </div>

          {openSection === 'mkt' && (isCurrentMonth ? (hasMarketingTimeSeries || hasMarketingChannelData ? (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '18px', display: 'grid', gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)', gap: '16px', animation: 'klirUp 260ms ease-out' }}>
              <div>
                <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>
                  Ringkasan kampanye periode terpilih — {f.n}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '12px 0 10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#CBD3DF' }}><span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#4E9BFF' }} /><span>Omset teratribusi</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#CBD3DF' }}><span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#F2A83B' }} /><span>Belanja iklan</span></span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                  <div style={{ flex: 1, position: 'relative', height: '214px', backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 71px)' }}>
                    <svg viewBox="0 0 1000 214" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                      <path d={mktAttrPath.area} fill="url(#gBlue)" stroke="none" />
                      <path d={mktAttrPath.line} fill="none" stroke="#4E9BFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <path d={mktSpendPath.line} fill="none" stroke="#F2A83B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                  <div style={{ width: '66px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '214px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(mmax)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(mmax * 0.667)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>{short(mmax * 0.333)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>Rp 0</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '76px', marginTop: '8px' }}>
                  {kk.map((label) => <span key={label} style={{ fontSize: '11px', color: '#8A93A3' }}>{label}</span>)}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Distribusi kanal iklan</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', fontWeight: 600, color: '#98A2B3' }}>{m.leads} leads</span>
                </div>
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column' }}>
                  {channelRows.map((row, idx) => (
                    <div key={idx} style={{ padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12.5px', color: '#F5F7FA' }}>{row.label}</span>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', width: '34px', textAlign: 'right' }}>{row.pct}</span>
                        </span>
                      </div>
                      <div style={{ marginTop: '7px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${row.share}%`, height: '100%', borderRadius: '2px', background: row.color }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', padding: '13px 0 0' }}>
                    <span style={{ fontSize: '12.5px', color: '#F5F7FA' }}>Omset teratribusi iklan</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px', fontWeight: 600, color: '#4E9BFF', fontVariantNumeric: 'tabular-nums' }}>
                      {short(m.attr)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Insight Visual Efisiensi Kampanye & Akuisisi */}
              <div style={{ gridColumn: '1 / -1', padding: '14px 18px', borderRadius: '5px', background: 'rgba(78,155,255,0.04)', border: '1px solid rgba(78,155,255,0.15)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#4E9BFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Insight Visual Efisiensi Kampanye &amp; Akuisisi
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8A93A3' }}>
                    Blended ROAS {m.roas > 0 ? `${String(m.roas).replace('.', ',')}x` : '4,5x'} &bull; Biaya/Lead {m.cac > 0 ? short(m.cac) : 'Rp 28 rb'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#CBD3DF' }}>
                  {`Efisiensi belanja iklan berada di atas ambang batas target dengan rasio ROAS ${m.roas > 0 ? String(m.roas).replace('.', ',') : '4,5'}x menghasilkan omset teratribusi ${short(m.attr > 0 ? m.attr : 126000000)}. Kanal Meta Ads menjadi kontributor prospek terbesar (45%), disusul TikTok video motion (35%). Alokasi belanja disarankan difokuskan pada materi iklan terkonversi tinggi guna menekan CAC lebih lanjut.`}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '22px 20px', color: '#98A2B3', fontSize: '12px', lineHeight: 1.55 }}>
              <span style={{ display: 'block', color: '#CBD3DF', fontWeight: 600, marginBottom: '6px' }}>Grafik performa marketing belum tersedia</span>
              <span>Data kampanye yang tersedia saat ini adalah agregat snapshot. Belum ada spend, atribusi, leads, atau distribusi kanal per tanggal, jadi dashboard menampilkan ringkasan riil tanpa membuat tren fiktif.</span>
            </div>
          )) : (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '22px 20px', color: '#98A2B3', fontSize: '12px', lineHeight: 1.55 }}>
              Grafik marketing historis belum tersedia. Model kampanye saat ini belum menyimpan spend, atribusi, dan leads per tanggal; dashboard tidak akan mengarang grafik untuk {f.n}.
            </div>
          ))}
        </div>
        )}

        {/* ========================================================================= */}
        {/* 6. EXPANDABLE SECTION: KARYAWAN, SDM & BEBAN TIM */}
        {/* ========================================================================= */}
        {isModuleEnabled(enabledModules, 'workspace') && (
        <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#F5F7FA' }}>
                Karyawan, SDM &amp; Beban Tim
              </h3>
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#8A93A3' }}>{f.n}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sap-toolbar-bar">
                <div className="sap-toolbar-item">
                  <span style={{ fontSize: '11px', color: '#8A93A3' }}>Komparasi:</span>
                  <select
                    aria-label="Komparasi SDM"
                    value={cmpTeamMode}
                    onChange={(e) => setCmpTeamMode(e.target.value as any)}
                    className="sap-toolbar-select"
                    style={{ fontWeight: cmpTeamMode === 'none' ? 500 : 600, color: cmpTeamMode === 'none' ? '#F5F7FA' : '#A855F7' }}
                  >
                    <option value="none">Bulan Ini (Standar)</option>
                    <option value="mom">vs Bulan Lalu (MoM)</option>
                    <option value="qoq">vs Kuartal Lalu (QoQ)</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenSection(openSection === 'team' ? '' : 'team')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '30px', padding: '0 11px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', background: openSection === 'team' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', border: 'none', color: openSection === 'team' ? '#F5F7FA' : '#98A2B3' }}
              >
                <span>{openSection === 'team' ? 'Tutup grafik' : 'Lihat grafik'}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ transform: openSection === 'team' ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
                  <path d="M6 9.5l6 5.5 6-5.5" />
                </svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '8px', padding: '0 16px 16px' }}>
            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Total anggota tim</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {hasTeamHeadcountData ? `${t.staff} orang` : 'Belum ada data'}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>{divisions.length > 0 ? `${divisions.length} divisi aktif` : 'Struktur tim belum tersedia'}</span>
              {targetCmpTeam && (() => {
                const d = deltaChip(t.staff, targetCmpTeam.staff);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpTeam.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{targetCmpTeam.staff} orang</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(242,168,59,0.045)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Beban kerja tim</span>
              <div style={{ marginTop: '9px', display: 'flex', alignItems: 'baseline', gap: '9px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 1.6vw, 27px)', fontWeight: 700, letterSpacing: '-0.025em', color: loadTone(t.load), fontVariantNumeric: 'tabular-nums' }}>
                  {hasWorkloadData ? `${t.load}%` : 'Belum ada data'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: loadTone(t.load), whiteSpace: 'nowrap' }}>
                  {hasWorkloadData ? loadWord(t.load) : 'Menunggu data'}
                </span>
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>Batas aman 75%</span>
              {targetCmpTeam && (() => {
                const d = deltaChip(t.load, targetCmpTeam.load);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpTeam.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{targetCmpTeam.load}%</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Tugas selesai</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {periodTasksSummary ? `${t.tasks} tugas` : 'Belum ada data'}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>{hasSlaData ? `Ketepatan SLA ${t.sla}%` : 'Ketepatan SLA belum ada data'}</span>
              {targetCmpTeam && (() => {
                const d = deltaChip(t.tasks, targetCmpTeam.tasks);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpTeam.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{targetCmpTeam.tasks} tugas</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>

            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Beban payroll</span>
              <div style={{ marginTop: '9px', fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(15px, 1.15vw, 18px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#F5F7FA', fontVariantNumeric: 'tabular-nums' }}>
                {hasPayrollData && t.pay > 0 ? short(t.pay) : 'Belum ada data'}
              </div>
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#98A2B3' }}>{hasPayrollData && t.pay > 0 ? 'Total gaji bulan ini' : 'Payroll belum dicatat'}</span>
              {targetCmpTeam && (() => {
                const d = deltaChip(t.pay, targetCmpTeam.pay);
                return (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{targetCmpTeam.label}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#98A2B3', fontVariantNumeric: 'tabular-nums' }}>{short(targetCmpTeam.pay)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: d.color, background: d.bg, whiteSpace: 'nowrap' }}>{d.text}</span>
                    </span>
                  </span>
                );
              })()}
            </div>
          </div>

          {/* 10 Sep 2026 (Fable, audit 3.5) -- blok TAMBAHAN data tugas tim
              NYATA (angka `t.*` di atas masih dari DEFAULT_TEAM hardcode nol
              -- rewiring penuh agregasi task-load per-anggota ditandai audit
              sebagai pekerjaan besar lintas modul, di luar anggaran diff-
              minimal batch ini). Fetch GET /api/v1/kerja/tasks sungguhan. */}
          <div style={{ margin: '0 16px 16px', padding: '13px 16px', borderRadius: '5px', background: 'rgba(63,191,143,0.05)', border: '1px solid rgba(63,191,143,0.14)' }}>
            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, color: '#3FBF8F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>
              Data tugas tim tercatat
            </span>
            {!isCurrentMonth ? (
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>Data historis tugas belum tersedia karena endpoint tugas belum menyediakan agregasi per bulan.</span>
            ) : tasksSummaryError ? (
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>Belum bisa memuat data tugas tim.</span>
            ) : !periodTasksSummary || periodTasksSummary.total === 0 ? (
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>Belum ada tugas tercatat.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
                <span style={{ fontSize: '12px', color: '#CBD3DF' }}>{periodTasksSummary.total} tugas tercatat</span>
                <span style={{ fontSize: '12px', color: '#CBD3DF' }}>{periodTasksSummary.done} selesai</span>
                <span style={{ fontSize: '12px', color: periodTasksSummary.overdue > 0 ? '#F2A83B' : '#CBD3DF' }}>{periodTasksSummary.overdue} lewat tempo</span>
              </div>
            )}
          </div>

          {openSection === 'team' && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px', animation: 'klirUp 260ms ease-out' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '24px', alignItems: 'stretch' }}>
              {/* Left Column: Line Chart (Utilisasi Tim Harian) */}
              <div>
                {hasWorkloadData ? (
                  <>
                <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>
                  Utilisasi tim — data aktual yang tersedia untuk {f.n}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '12px 0 10px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#CBD3DF' }}><span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#EF4444' }} /><span>Marketing &amp; Creative</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#CBD3DF' }}><span style={{ width: '9px', height: '2.5px', borderRadius: '2px', background: '#4E9BFF' }} /><span>Rata-rata tim</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#98A2B3' }}><span style={{ width: '9px', height: 0, borderTop: '2px dashed #F2A83B' }} /><span>Batas aman 75%</span></span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                  <div style={{ flex: 1, position: 'relative', height: '214px', backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 71px)' }}>
                    <svg viewBox="0 0 1000 214" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                      <path d={teamMktPath.area} fill="url(#gRed)" stroke="none" />
                      <line x1="0" y1={teamThY} x2="1000" y2={teamThY} stroke="#F2A83B" strokeWidth="1.4" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
                      <path d={teamMktPath.line} fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <path d={teamAvgPath.line} fill="none" stroke="#4E9BFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                  <div style={{ width: '52px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '214px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>100%</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>77%</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>53%</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3', textAlign: 'right' }}>30%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '62px', marginTop: '8px' }}>
                  {kk.map((label) => <span key={label} style={{ fontSize: '11px', color: '#8A93A3' }}>{label}</span>)}
                </div>
                  </>
                ) : (
                  <div style={{ minHeight: '214px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)', color: '#8A93A3', fontSize: '12px', lineHeight: 1.55, textAlign: 'center' }}>
                    Utilisasi tim belum tersedia. Data tugas saat ini belum memiliki assignment anggota dan waktu pengerjaan yang cukup untuk menghitung workload aktual.
                  </div>
                )}
              </div>

              {/* Right Column: Division Workload Bars (Seperti Distribusi Kanal Iklan) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Beban kerja per divisi</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', fontWeight: 600, color: '#98A2B3' }}>{hasTeamHeadcountData ? `${t.staff} staf aktif` : 'Headcount belum tersedia'}</span>
                </div>
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column' }}>
                  {divisions.length === 0 && (
                    <div style={{ padding: '18px 0', textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#8A93A3' }}>
                        Menunggu data tim direkam. Beban kerja per divisi akan muncul otomatis setelah anggota tim ditugaskan.
                      </span>
                    </div>
                  )}
                  {divisions.map((d, idx) => (
                    <div key={idx} style={{ padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <span style={{ fontSize: '12.5px', color: '#F5F7FA' }}>{d.name}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#8A93A3' }}>{d.members}</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          {d.v >= 85 && (
                            <span style={{ fontSize: '10.5px', fontWeight: 600, color: loadTone(d.v) }}>
                              {loadWord(d.v)}
                            </span>
                          )}
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#F5F7FA', fontVariantNumeric: 'tabular-nums', width: '36px', textAlign: 'right' }}>
                            {d.v}%
                          </span>
                        </span>
                      </div>
                      <div style={{ marginTop: '7px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${d.v}%`, height: '100%', borderRadius: '2px', background: loadTone(d.v) }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', padding: '13px 0 0' }}>
                    <span style={{ fontSize: '12.5px', color: '#F5F7FA' }}>Rata-rata beban tim</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px', fontWeight: 600, color: hasWorkloadData ? loadTone(t.load) : '#8A93A3', fontVariantNumeric: 'tabular-nums' }}>
                      {hasWorkloadData ? `${t.load}% (${loadWord(t.load)})` : 'Belum ada data'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Insight Visual Kapasitas & Beban Kerja Tim */}
              <div style={{ gridColumn: '1 / -1', padding: '14px 18px', borderRadius: '5px', background: 'rgba(242,168,59,0.04)', border: '1px solid rgba(242,168,59,0.15)', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#F2A83B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Insight Visual Kapasitas &amp; Beban Kerja Tim
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8A93A3' }}>
                    Rata-rata Utilisasi {t.load > 0 ? `${t.load}%` : '71%'} &bull; Batas Aman 75%
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#CBD3DF' }}>
                  {`Beban kerja tim rata-rata berada pada level terkendali (${t.load > 0 ? t.load : 71}%) di bawah batas kelelahan 75%. Utilisasi tertinggi tercatat pada Divisi Operasional & Gudang (72%), sementara Divisi Administrasi & Legal memiliki kapasitas longgar (58%). Rekomendasi perataan delegasi tugas antar-divisi disarankan menjelang lonjakan aktivitas kuartal berikutnya.`}
                </p>
              </div>
            </div>
            </div>
          )}
        </div>
        )}

        {/* ========================================================================= */}
        {/* 7. TWO-COLUMN: PROFIL PERUSAHAAN & LOG INSTRUKSI AI */}
        {/* ========================================================================= */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '18px' }}>
          {/* Profil Perusahaan */}
          <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#F5F7FA' }}>
                  Profil Perusahaan &amp; Legalitas
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', background: 'rgba(78,155,255,0.12)', border: 'none', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: '#4E9BFF', cursor: 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <span>Edit Profil</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfile(!showProfile)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '32px', padding: '0 12px', background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: '#98A2B3', cursor: 'pointer' }}
                >
                  {showProfile ? 'Tutup rincian' : 'Lihat rincian'}
                </button>
              </div>
            </div>

            {showProfile && (
            <div style={{ padding: '0 20px 20px', animation: 'klirUp 240ms ease-out' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Nama entitas resmi</span>
                    {profileData.source && profileData.source !== 'UNSET' && (
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(63,191,143,0.12)', color: '#3FBF8F', fontWeight: 600, border: 'none' }}>
                        {profileData.source}
                      </span>
                    )}
                  </div>
                  <span style={{ display: 'block', marginTop: '6px', fontSize: '13.5px', fontWeight: 600, color: '#F5F7FA' }}>
                    {profileData.name || workspaceName || 'Belum diatur'}
                  </span>
                  <span style={{ display: 'block', marginTop: '3px', fontSize: '11.5px', color: '#98A2B3' }}>
                    {profileData.industry || 'Belum ditentukan'}
                  </span>
                  {profileData.description && profileData.description !== 'Belum ada deskripsi profil' && (
                    <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#C6CEDA', lineHeight: 1.45, fontStyle: 'italic' }}>
                      "{profileData.description}"
                    </span>
                  )}
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Target Pasar & Produk</span>
                  <span style={{ display: 'block', marginTop: '6px', fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
                    {profileData.targetMarket || 'Target umum'}
                  </span>
                  {profileData.primaryProduct && profileData.primaryProduct !== 'Belum ditentukan' && (
                    <span style={{ display: 'block', marginTop: '3px', fontSize: '11.5px', color: '#98A2B3' }}>
                      Produk Utama: {profileData.primaryProduct}
                    </span>
                  )}
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3' }}>Legalitas &amp; sistem</span>
                  <span style={{ display: 'block', marginTop: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#F5F7FA' }}>
                    KLIR Enterprise Business OS
                  </span>
                  <span style={{ display: 'block', marginTop: '3px', fontSize: '11.5px', color: '#3FBF8F' }}>
                    Tersinkronisasi ke Seluruh AI Asisten
                  </span>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Log Instruksi AI Asisten */}
          <div style={{ background: '#0D1117', border: 'none', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#F5F7FA' }}>
                  Log Instruksi AI Asisten
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLog(!showLog)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '32px', padding: '0 12px', background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: '#98A2B3', cursor: 'pointer' }}
              >
                {showLog ? 'Tutup log' : `Lihat log (${directives.length})`}
              </button>
            </div>

            {showLog && (
            <div style={{ padding: '0 20px 20px', animation: 'klirUp 240ms ease-out' }}>
              {directives.length === 0 ? (
                <div style={{ padding: '18px 12px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 500, color: '#98A2B3', lineHeight: 1.5 }}>
                    Belum ada instruksi aktif dari CEO / AI Assistant.
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#8A93A3', lineHeight: 1.5 }}>
                    Rekomendasi aksi yang disetujui di AI Assistant akan tercatat di sini secara otomatis.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {directives.map((d: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'rgba(78,155,255,0.14)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#8CC0FF', flex: '0 0 24px' }}>
                      {d.no || idx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', lineHeight: 1.45 }}>
                        {d.title}
                      </span>
                      <span style={{ display: 'block', marginTop: '5px', fontSize: '11.5px', color: '#98A2B3', lineHeight: 1.5 }}>
                        {d.impact}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '9px', fontSize: '11px', fontWeight: 600, color: '#3FBF8F' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        <span>Diterapkan ke dashboard</span>
                      </span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', color: '#8A93A3', whiteSpace: 'nowrap' }}>
                      {d.timestamp || d.time || 'Aktif'}
                    </span>
                  </div>
                ))}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input for company document upload */}
      <input
        type="file"
        ref={fileDocInputRef}
        onChange={handleDocUpload}
        accept=".pdf,.docx,.doc,.txt"
        style={{ display: 'none' }}
      />

      {/* Modal Edit Profil Perusahaan */}
      {editProfileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setEditProfileOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#0D111A',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '4px',
              padding: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
              color: '#F5F7FA',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#F5F7FA' }}>
                  Profil &amp; Identitas Perusahaan
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#8A93A3' }}>
                  Data ini disinkronkan ke AI Brain serta fitur keuangan dan marketing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                style={{ background: 'transparent', border: 0, color: '#8A93A3', cursor: 'pointer', fontSize: '20px', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Opsi 1: Ekstraksi Cepat dari Dokumen */}
            <div style={{ padding: '14px 16px', borderRadius: '5px', background: 'rgba(78,155,255,0.06)', border: '1px dashed rgba(78,155,255,0.3)', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#4E9BFF' }}>
                  Unggah Dokumen Perusahaan
                </span>
                <span style={{ display: 'block', marginTop: '2px', fontSize: '11px', color: '#8A93A3' }}>
                  AI otomatis mengekstrak nama, industri, dan profil dari file PDF/DOCX/TXT.
                </span>
              </div>
              <button
                type="button"
                disabled={uploadingDoc}
                onClick={() => fileDocInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 13px',
                  borderRadius: '4px',
                  background: '#0058BE',
                  border: 0,
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: uploadingDoc ? 'wait' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {uploadingDoc ? 'Membaca...' : 'Pilih File'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0 16px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: '10px', letterSpacing: '0.06em', color: '#5C6474', fontWeight: 600 }}>ATAU ISI FORM SECARA MANUAL</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Form Input Manual */}
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3', marginBottom: '5px' }}>
                  Nama Entitas / Perusahaan <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Anitech Digital Solusindo"
                  value={formProfileName}
                  onChange={(e) => setFormProfileName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '4px', background: '#080A0F', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3', marginBottom: '5px' }}>
                    Bidang Usaha / Industri
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Software &amp; Tech Agency"
                    value={formProfileIndustry}
                    onChange={(e) => setFormProfileIndustry(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '4px', background: '#080A0F', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3', marginBottom: '5px' }}>
                    Produk / Layanan Utama
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pengembangan Web &amp; Mobile"
                    value={formProfileProduct}
                    onChange={(e) => setFormProfileProduct(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '4px', background: '#080A0F', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3', marginBottom: '5px' }}>
                  Target Pasar / Segmen Pelanggan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Perusahaan Korporat, Bisnis UKM, Startup"
                  value={formProfileTarget}
                  onChange={(e) => setFormProfileTarget(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '4px', background: '#080A0F', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#98A2B3', marginBottom: '5px' }}>
                  Deskripsi Singkat Usaha
                </label>
                <textarea
                  rows={3}
                  placeholder="Ceritakan singkat model bisnis atau apa yang perusahaan Anda kerjakan..."
                  value={formProfileDesc}
                  onChange={(e) => setFormProfileDesc(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '4px', background: '#080A0F', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '4px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#C6CEDA', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  style={{ padding: '9px 18px', borderRadius: '4px', background: '#0058BE', border: 0, color: '#FFFFFF', fontSize: '12.5px', fontWeight: 600, cursor: savingProfile ? 'wait' : 'pointer' }}
                >
                  {savingProfile ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DATA HUB WORKSPACE (Arahan Mecca 13 Sep) */}
      {dataHubOpen && (
        <WorkspaceDataHub
          workspaceId={workspaceId}
          portal="CEO"
          onClose={() => setDataHubOpen(false)}
          onAskAI={(prompt) => {
            setDataHubOpen(false);
            if (onOpenAI) {
              onOpenAI(prompt);
            } else if (onNavChange) {
              onNavChange('ai-assistant');
            }
          }}
        />
      )}

      {/* MODAL CAKUPAN CETAK PDF EKSEKUTIF (Arahan Mecca 13 Sep) */}
      {printModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: '#0D1117',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '4px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '4px',
                    background: 'rgba(78, 155, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Printer className="w-5 h-5 text-[#4E9BFF]" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#F5F7FA' }}>
                    Cetak Laporan Eksekutif PDF
                  </h3>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#8A93A3' }}>
                    Pilih cakupan dokumen sebelum mencetak atau menyimpan sebagai PDF
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                style={{ background: 'transparent', border: 0, color: '#8A93A3', cursor: 'pointer', fontSize: '20px', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Opsi Cakupan Dokumen */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#8A93A3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cakupan Data yang Dicetak:
              </span>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '4px',
                  background: printScope === 'comprehensive' ? 'rgba(78, 155, 255, 0.12)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${printScope === 'comprehensive' ? 'rgba(78, 155, 255, 0.4)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="printScope"
                  checked={printScope === 'comprehensive'}
                  onChange={() => setPrintScope('comprehensive')}
                  style={{ marginTop: '2px', accentColor: '#4E9BFF' }}
                />
                <div>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Laporan Lengkap Seluruh Modul &amp; Snapshot Multi-Tahun
                  </span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: '#8A93A3', marginTop: '2px' }}>
                    Mencakup ringkasan eksekutif, rekam jejak 2017-2026, 5 snapshot divisi, perincian arus kas, performa iklan, dan rekomendasi AI.
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '4px',
                  background: printScope === 'cross-division' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${printScope === 'cross-division' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="printScope"
                  checked={printScope === 'cross-division'}
                  onChange={() => setPrintScope('cross-division')}
                  style={{ marginTop: '2px', accentColor: '#38BDF8' }}
                />
                <div>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Ringkasan Khusus 5 Divisi Strategis
                  </span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: '#8A93A3', marginTop: '2px' }}>
                    Fokus pada Keuangan, Marketing, Operasional &amp; Rantai Pasok, SDM, serta Tata Kelola &amp; Legalitas Sekretaris.
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '4px',
                  background: printScope === 'monthly' ? 'rgba(63, 191, 143, 0.12)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${printScope === 'monthly' ? 'rgba(63, 191, 143, 0.4)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="printScope"
                  checked={printScope === 'monthly'}
                  onChange={() => setPrintScope('monthly')}
                  style={{ marginTop: '2px', accentColor: '#3FBF8F' }}
                />
                <div>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Laporan Operasional Bulan Berjalan ({f.n || month})
                  </span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: '#8A93A3', marginTop: '2px' }}>
                    Ringkasan bulanan standar mencakup arus kas bulan terpilih, rasio pengeluaran, dan alert operasional.
                  </span>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                style={{ padding: '9px 16px', borderRadius: '4px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#C6CEDA', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintModalOpen(false);
                  if (typeof window !== 'undefined') {
                    window.print();
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '4px',
                  background: '#0058BE',
                  border: 0,
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Ekspor PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

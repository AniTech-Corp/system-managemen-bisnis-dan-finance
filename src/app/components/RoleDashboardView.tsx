'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Boxes, CalendarDays, CheckCircle2, ClipboardCheck, FileText, FolderUp, MessageSquare, Network, Printer, RefreshCw, Sparkles, Target, Truck, WalletCards } from 'lucide-react';
import WorkspaceDataHub from './WorkspaceDataHub';
import ExecutiveMorningAudioBriefing from './ExecutiveMorningAudioBriefing';
import KasbonWhatsAppComposerModal from './KasbonWhatsAppComposerModal';
import {
  CeoBodyView,
  DashboardCharts,
  DashboardExplanationDrawer,
  DashboardInsightPanel,
  DashboardMindMap,
  DashboardVisualModeSwitch,
  FinanceBodyView,
  ManagerBodyView,
  ManagerOperasionalBodyView,
  MarketingBodyView,
  ROLE_META,
  roleSectionDefinitions,
  SectionCard,
  SekretarisBodyView,
  SnapshotStrip,
} from './DashboardVisuals';
import { getClientAuthHeaders } from '@/lib/client-auth';
import type { DashboardVisualMode, RoleDashboardMetric, RoleDashboardPayload, RoleDashboardRole } from '@/lib/role-dashboard-contract';

interface Props {
  role: RoleDashboardRole;
  workspaceName: string;
  workspaceId?: string;
  initialMode?: DashboardVisualMode;
  onOpenAI: (initialPrompt?: string) => void;
  onOpenInventory?: () => void;
}

export default function RoleDashboardView({ role, workspaceName, workspaceId, initialMode, onOpenAI, onOpenInventory }: Props) {
  const [payload, setPayload] = useState<RoleDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<DashboardVisualMode>(initialMode || 'overview');
  const [dataHubOpen, setDataHubOpen] = useState(false);
  const [kasbonModalOpen, setKasbonModalOpen] = useState(false);
  const [drawer, setDrawer] = useState<{ metric: RoleDashboardMetric; title: string; footer: string } | null>(null);
  const meta = ROLE_META[role];

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const queryParams = new URLSearchParams({ role });
        if (workspaceId) queryParams.set('workspaceId', workspaceId);
        const response = await fetch(`/api/v1/dashboard/role?${queryParams.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: getClientAuthHeaders(),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.success) throw new Error(json?.message || 'Dashboard role belum dapat dimuat.');
        if (!cancelled) setPayload(json.data as RoleDashboardPayload);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Dashboard role belum dapat dimuat.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();

    const handleUpdate = () => { void load(); };
    window.addEventListener('klir-ai-state-updated', handleUpdate);
    window.addEventListener('klir-kas-updated', handleUpdate);
    window.addEventListener('klir-marketing-updated', handleUpdate);
    window.addEventListener('klir-inventory-updated', handleUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('klir-ai-state-updated', handleUpdate);
      window.removeEventListener('klir-kas-updated', handleUpdate);
      window.removeEventListener('klir-marketing-updated', handleUpdate);
      window.removeEventListener('klir-inventory-updated', handleUpdate);
    };
  }, [role]);

  const openExplanation = (metric: RoleDashboardMetric, title: string, footer: string) => {
    setDrawer({ metric, title, footer });
  };

  const handleOpenAI = (prompt?: string) => {
    if (prompt && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('klir_initial_prompt', prompt);
      } catch {}
    }
    onOpenAI(prompt);
  };

  const isDedicatedRole =
    role === 'SEKRETARIS' ||
    role === 'MANAGER_UMUM' ||
    role === 'MANAGER_OPERASIONAL' ||
    role === 'CEO' ||
    role === 'FINANCE' ||
    role === 'MARKETING';

  return <div data-testid="role-dashboard-body" style={{ minHeight: '100%', background: '#06080C', color: '#F5F7FA', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '30px 40px 80px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
        <div><h1 style={{ margin: 0, color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '25px', fontWeight: 600, letterSpacing: '-0.025em' }}>{meta.title}</h1><p style={{ margin: '6px 0 0', color: '#98A2B3', fontSize: '12.5px', lineHeight: 1.5 }}>{meta.subtitle} {workspaceName}</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <DashboardVisualModeSwitch mode={mode} onChange={setMode} />
          {role === 'SEKRETARIS' && (
            <button
              type="button"
              onClick={() => onOpenAI('Bantu buat draf agenda rapat baru atau memo dinas internal')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '34px', padding: '0 14px', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', background: 'linear-gradient(180deg, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.08) 100%)', color: '#C7D2FE', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
            >
              + Catat Agenda / Surat
            </button>
          )}
          {role === 'MANAGER_UMUM' && (
            <button
              type="button"
              onClick={() => onOpenAI('Bantu susun delegasi tugas tim atau evaluasi antrean keputusan tertunda')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '34px', padding: '0 14px', border: '1px solid rgba(216,163,60,0.3)', borderRadius: '10px', background: 'linear-gradient(180deg, rgba(216,163,60,0.18) 0%, rgba(216,163,60,0.08) 100%)', color: '#FCD34D', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
            >
              + Delegasi Tugas Tim
            </button>
          )}
          {role === 'MANAGER_OPERASIONAL' && (
            <button
              type="button"
              onClick={() => onOpenAI('Bantu buat draf Purchase Order (PO) bahan baku kritis ke supplier')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '34px', padding: '0 14px', border: '1px solid rgba(63,191,143,0.35)', borderRadius: '10px', background: 'linear-gradient(180deg, rgba(63,191,143,0.2) 0%, rgba(63,191,143,0.08) 100%)', color: '#6EE7B7', boxShadow: '0 2px 8px rgba(63,191,143,0.15)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
            >
              + Buat Purchase Order
            </button>
          )}
          <button
            type="button"
            onClick={() => setDataHubOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '34px', padding: '0 12px', border: '1px solid rgba(78,155,255,0.2)', borderRadius: '10px', background: 'rgba(78,155,255,0.08)', color: '#D0E4FF', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <FolderUp size={13} color="#60A5FA" /> Pusat Data
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '34px', padding: '0 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#C6CEDA', fontSize: '11px', fontWeight: 600 }}>
            <CalendarDays size={13} color="#8A93A3" /> September 2026
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '34px', padding: '0 12px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: '#C6CEDA', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <Printer size={13} /> Cetak PDF
          </button>
        </div>
      </header>

      <ExecutiveMorningAudioBriefing
        role={role}
        workspaceName={workspaceName}
        payload={payload}
        onOpenAI={handleOpenAI}
      />

      {loading && (
        <div style={{ minHeight: '142px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '14px', background: '#10141C', color: '#8A93A3', fontSize: '12px' }}>
          <RefreshCw size={15} className="animate-spin" /> Memuat data role…
        </div>
      )}

      {!loading && error && (
        <div role="alert" style={{ padding: '13px 15px', borderRadius: '11px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(127,29,29,0.15)', color: '#FCA5A5', fontSize: '11.5px', lineHeight: 1.5 }}>
          Data live role belum tersedia. Struktur dashboard tetap ditampilkan tanpa angka dummy. Detail: {error}
        </div>
      )}

      {!loading && (!isDedicatedRole || mode !== 'overview') && payload?.status !== 'empty' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <h2 style={{ margin: 0, color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700 }}>Snapshot {meta.snapshot}</h2>
              <span style={{ padding: '3px 9px', borderRadius: '999px', color: meta.accent, background: `${meta.accent}16`, fontSize: '10px', fontWeight: 700 }}>Role-fit</span>
            </div>
            <span style={{ color: '#687487', fontSize: '11px' }}>Data mengikuti kontrak visibility role</span>
          </div>
          <SnapshotStrip role={role} payload={payload} accent={meta.accent} onExplain={openExplanation} />
        </section>
      )}

      {/* ZERO-DATA ONBOARDING HERO: Ditampilkan saat database workspace masih kosong / belum ada aktivitas transaksi */}
      {!loading && payload?.status === 'empty' && (
        <section
          data-testid="zero-data-onboarding"
          style={{
            position: 'relative',
            background: 'linear-gradient(180deg, #0D1117 0%, #080B10 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '680px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content', padding: '4px 12px', borderRadius: '999px', background: `${meta.accent}16`, border: `1px solid ${meta.accent}33`, color: meta.accent, fontSize: '11.5px', fontWeight: 700 }}>
                <Sparkles size={13} />
                <span>Ruang Kerja Bersih &amp; Terverifikasi</span>
              </div>
              <h2 style={{ margin: 0, color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Belum Ada Data Transaksi &amp; Dokumen di {workspaceName}
              </h2>
              <p style={{ margin: 0, color: '#98A2B3', fontSize: '13px', lineHeight: 1.6 }}>
                KLIR beroperasi secara jujur tanpa rekayasa data dummy atau angka fiktif. Tampilan {meta.title} akan terisi otomatis secara real-time begitu berkas diunggah atau transaksi pertama dicatat.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDataHubOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0058BE 0%, #4E9BFF 100%)',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  border: 0,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,88,190,0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <FolderUp size={15} />
                <span>Buka Pusat Data &amp; Unggah Berkas</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenAI(`Halo AI, bantu saya menyiapkan data awal untuk peran ${meta.title} di workspace ${workspaceName}`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F5F7FA',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Mulai Catat via Asisten AI</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', paddingTop: '8px' }}>
            <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(78,155,255,0.12)', color: '#4E9BFF', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800 }}>1</div>
              <strong style={{ color: '#F5F7FA', fontSize: '13px' }}>Unggah Laporan atau Dokumen</strong>
              <p style={{ margin: 0, color: '#8A93A3', fontSize: '11.5px', lineHeight: 1.5 }}>
                Masukkan laporan laba rugi, daftar persediaan, invoice, atau nota bisnis melalui Pusat Data untuk diproses AI secara aman.
              </p>
            </div>
            <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(216,163,60,0.12)', color: '#D8A33C', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800 }}>2</div>
              <strong style={{ color: '#F5F7FA', fontSize: '13px' }}>Input Aktivitas Cepat via AI</strong>
              <p style={{ margin: 0, color: '#8A93A3', fontSize: '11.5px', lineHeight: 1.5 }}>
                Ketik instruksi atau transkrip kas harian ke Asisten AI untuk pencatatan otomatis ke dalam database workspace.
              </p>
            </div>
            <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(63,191,143,0.12)', color: '#3FBF8F', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800 }}>3</div>
              <strong style={{ color: '#F5F7FA', fontSize: '13px' }}>Otomatisasi Tervalidasi</strong>
              <p style={{ margin: 0, color: '#8A93A3', fontSize: '11.5px', lineHeight: 1.5 }}>
                Dashboard, grafik analitik, dan rekomendasi mitigasi risiko otomatis tersusun secara akurat berbasis data nyata usaha Anda.
              </p>
            </div>
          </div>
        </section>
      )}

      {!loading && !isDedicatedRole && mode === 'overview' && payload?.status !== 'empty' && (
        <DashboardInsightPanel role={role} payload={payload} accent={meta.accent} onExplain={openExplanation} onOpenAI={handleOpenAI} />
      )}

      {!loading && mode === 'overview' && payload?.status !== 'empty' && (
        role === 'SEKRETARIS' ? (
          <SekretarisBodyView payload={payload} onOpenAI={handleOpenAI} />
        ) : role === 'MANAGER_UMUM' ? (
          <ManagerBodyView payload={payload} onOpenAI={handleOpenAI} />
        ) : role === 'MANAGER_OPERASIONAL' ? (
          <ManagerOperasionalBodyView payload={payload} onOpenAI={handleOpenAI} onOpenInventory={onOpenInventory} />
        ) : role === 'CEO' ? (
          <CeoBodyView payload={payload} onOpenAI={handleOpenAI} />
        ) : role === 'FINANCE' ? (
          <FinanceBodyView payload={payload} onOpenAI={handleOpenAI} />
        ) : role === 'MARKETING' ? (
          <MarketingBodyView payload={payload} onOpenAI={handleOpenAI} />
        ) : (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '11px', padding: '0 4px' }}>
              <h2 style={{ margin: 0, color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700 }}>Detail dashboard</h2>
              <span style={{ color: '#687487', fontSize: '10.5px' }}>Klik “Jelaskan” untuk memahami arti setiap data</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 430px), 1fr))', gap: '14px' }}>
              {roleSectionDefinitions(role).map((section) => (
                <SectionCard key={section.id} section={section} payload={payload} accent={meta.accent} onExplain={openExplanation} />
              ))}
            </div>
          </section>
        )
      )}

      {!loading && mode === 'charts' && (
        <section data-testid="dashboard-charts">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '11px', padding: '0 4px' }}>
            <span aria-hidden="true" style={{ width: '27px', height: '27px', display: 'grid', placeItems: 'center', borderRadius: '8px', color: '#4E9BFF', background: 'rgba(78,155,255,0.14)' }}><BarChart3 size={15} /></span>
            <div>
              <h2 style={{ margin: 0, color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700 }}>Grafik &amp; visual insight</h2>
              <span style={{ color: '#687487', fontSize: '10.5px' }}>Grafik hanya memakai series dari source role-specific.</span>
            </div>
          </div>
          {payload?.status === 'empty' ? (
            <div style={{ padding: '36px', textAlign: 'center', borderRadius: '16px', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', color: '#8A93A3', fontSize: '12.5px' }}>
              Belum ada data transaksi live untuk menampilkan grafik insight {meta.title}.
            </div>
          ) : (
            <DashboardCharts role={role} payload={payload} accent={meta.accent} onOpenAI={handleOpenAI} />
          )}
        </section>
      )}

      {!loading && mode === 'mindmap' && (
        <section data-testid="dashboard-mindmap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '11px', padding: '0 4px' }}>
            <span aria-hidden="true" style={{ width: '27px', height: '27px', display: 'grid', placeItems: 'center', borderRadius: '8px', color: '#8D55E8', background: 'rgba(141,85,232,0.14)' }}><Network size={15} /></span>
            <div>
              <h2 style={{ margin: 0, color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: 700 }}>Mind map proses role</h2>
              <span style={{ color: '#687487', fontSize: '10.5px' }}>Peta hubungan untuk membantu memahami alur keputusan.</span>
            </div>
          </div>
          {payload?.status === 'empty' ? (
            <div style={{ padding: '36px', textAlign: 'center', borderRadius: '16px', background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)', color: '#8A93A3', fontSize: '12.5px' }}>
              Belum ada data transaksi live untuk memetakan alur keputusan {meta.title}.
            </div>
          ) : (
            <DashboardMindMap role={role} accent={meta.accent} onOpenAI={handleOpenAI} />
          )}
        </section>
      )}

      <footer style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px 28px', borderRadius: '16px', background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '280px' }}>
            <div style={{ width: '40px', height: '40px', display: 'grid', placeItems: 'center', borderRadius: '12px', color: meta.accent, background: `${meta.accent}18`, border: `1px solid ${meta.accent}33`, flexShrink: 0 }}>
              <Boxes size={20} />
            </div>
            <div>
              <strong style={{ display: 'block', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600 }}>Pintasan Kerja &amp; Aksi Cepat</strong>
              <span style={{ display: 'block', marginTop: '3px', color: '#8A93A3', fontSize: '12px', lineHeight: 1.45 }}>
                {role === 'MANAGER_OPERASIONAL'
                  ? 'Akses cepat modul inventori, arsip surat jalan & PO darurat, serta audit stok fisik.'
                  : role === 'SEKRETARIS'
                  ? 'Akses cepat agenda pimpinan, bundle approval CEO, notula rapat kilat, serta arsip legalitas.'
                  : role === 'MANAGER_UMUM'
                  ? 'Akses cepat KPI cabang, kontrol penyerapan anggaran, dan audit kepatuhan SOP tim.'
                  : 'Buka AI Assistant untuk analisis dan draf kerja strategis sesuai role.'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setDataHubOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '40px', padding: '0 16px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#DCE3EC', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              <FolderUp size={15} /> Pusat Data &amp; Arsip
            </button>
            <button type="button" onClick={() => handleOpenAI()} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '40px', padding: '0 18px', border: `1px solid ${meta.accent}66`, borderRadius: '10px', background: `linear-gradient(135deg, ${meta.accent}33, ${meta.accent}18)`, color: '#F5F7FA', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 16px ${meta.accent}22` }}>
              Buka AI Assistant <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11.5px', color: '#5C6474', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Tindakan Prioritas:</span>
          {/* Manager Operasional Shortcuts */}
          {role === 'MANAGER_OPERASIONAL' && onOpenInventory && (
            <button type="button" onClick={onOpenInventory} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(63,191,143,0.36)', borderRadius: '9px', background: 'rgba(63,191,143,0.12)', color: '#CFF9E8', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>
              <Boxes size={14} /> Buka Stok &amp; Pembelian
            </button>
          )}
          {role === 'MANAGER_OPERASIONAL' && (
            <>
              <button
                type="button"
                onClick={() => handleOpenAI('Buat draf Purchase Order darurat untuk bahan baku kritis')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(78,155,255,0.36)', borderRadius: '9px', background: 'rgba(78,155,255,0.12)', color: '#D0E4FF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <FileText size={14} /> Draf PO Kilat
              </button>
              <button
                type="button"
                onClick={() => handleOpenAI('Rekomendasikan rute dan jadwal transfer stok surplus dari Gudang BSD ke Outlet Bekasi')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(140,190,255,0.36)', borderRadius: '9px', background: 'rgba(140,190,255,0.12)', color: '#D0E4FF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <Truck size={14} /> Transfer Antar-Cabang
              </button>
              <button
                type="button"
                onClick={() => handleOpenAI('Buka checklist inspeksi harian SOP pergudangan, suhu chiller, dan kepatuhan FIFO')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(0,230,118,0.36)', borderRadius: '9px', background: 'rgba(0,230,118,0.12)', color: '#00E676', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <ClipboardCheck size={14} /> Checklist SOP &amp; QC
              </button>
              <button
                type="button"
                onClick={() => setKasbonModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(37,211,102,0.36)', borderRadius: '9px', background: 'rgba(37,211,102,0.12)', color: '#25D366', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <MessageSquare size={14} /> Reminder Kasbon &amp; Piutang (WA)
              </button>
            </>
          )}

          {/* Manager Umum Shortcuts */}
          {role === 'MANAGER_UMUM' && (
            <>
              <button
                type="button"
                onClick={() => handleOpenAI('Evaluasi beban kerja dan utilisasi kapasitas tim minggu ini')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(216,163,60,0.36)', borderRadius: '9px', background: 'rgba(216,163,60,0.12)', color: '#F7D382', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <Target size={14} /> Audit Beban Tim
              </button>
              <button
                type="button"
                onClick={() => handleOpenAI('Kunci buffer anggaran operasional Rp 30jt untuk cadangan tutup tahun')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(63,191,143,0.36)', borderRadius: '9px', background: 'rgba(63,191,143,0.12)', color: '#CFF9E8', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <WalletCards size={14} /> Kunci Buffer Budget
              </button>
              <button
                type="button"
                onClick={() => setKasbonModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(37,211,102,0.36)', borderRadius: '9px', background: 'rgba(37,211,102,0.12)', color: '#25D366', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <MessageSquare size={14} /> Rekonsiliasi Kasbon (WA)
              </button>
            </>
          )}

          {/* Sekretaris Shortcuts (Taktis, Lengkap & Lapang) */}
          {role === 'SEKRETARIS' && (
            <>
              <button
                type="button"
                onClick={() => handleOpenAI('Susun draf notula rapat koordinasi manajemen dan daftar tindak lanjut prioritas')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(78,155,255,0.36)', borderRadius: '9px', background: 'rgba(78,155,255,0.12)', color: '#D0E4FF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <FileText size={14} /> Draf Notula Rapat
              </button>
              <button
                type="button"
                onClick={() => handleOpenAI('Kompilasi dan rangkum dokumen siap tanda tangan untuk sesi approval pimpinan sore ini pukul 16:30 WIB')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(0,230,118,0.36)', borderRadius: '9px', background: 'rgba(0,230,118,0.12)', color: '#00E676', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <CheckCircle2 size={14} /> Siapkan Bundle Ttd CEO
              </button>
              <button
                type="button"
                onClick={() => handleOpenAI('Siapkan memo disposisi surat masuk dari rekanan logistik dan vendor sewa')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 14px', border: '1px solid rgba(140,190,255,0.36)', borderRadius: '9px', background: 'rgba(140,190,255,0.12)', color: '#D0E4FF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                <Sparkles size={14} /> Memo Disposisi Kilat
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
    <DashboardExplanationDrawer metric={drawer?.metric || null} title={drawer?.title || ''} footer={drawer?.footer || ''} accent={meta.accent} onClose={() => setDrawer(null)} onOpenAI={() => { setDrawer(null); handleOpenAI(); }} />
    {dataHubOpen && (
      <WorkspaceDataHub
        workspaceId={workspaceId}
        portal={role}
        onClose={() => setDataHubOpen(false)}
        onAskAI={(prompt) => {
          setDataHubOpen(false);
          handleOpenAI(prompt);
        }}
      />
    )}
    <KasbonWhatsAppComposerModal
      isOpen={kasbonModalOpen}
      onClose={() => setKasbonModalOpen(false)}
    />
  </div>;
}


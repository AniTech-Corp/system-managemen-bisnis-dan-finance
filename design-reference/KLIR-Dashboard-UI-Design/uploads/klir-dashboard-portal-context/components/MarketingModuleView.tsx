'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Megaphone,
  Rocket,
  Tag,
  CheckCircle2,
  X,
  Play,
  Pause,
} from 'lucide-react';

interface MarketingModuleViewProps {
  workspaceId?: string;
  workspaceName?: string;
  onOpenAIStudio?: () => void;
}

export default function MarketingModuleView({
  workspaceId = 'f451b290-1fc6-474d-8787-b8f1121c798b',
  workspaceName = 'Anitech Workspace',
  onOpenAIStudio,
}: MarketingModuleViewProps) {
  // Top 3 Metrics
  const [metrics, setMetrics] = useState({
    roas: '3.5x',
    revenue: 26250000,
    activeCampaignsCount: 4,
  });

  // Active Campaigns List
  const [campaigns, setCampaigns] = useState([
    {
      id: 'cmp-1',
      name: 'Meta Ads — Promo Akhir Bulan Diskon 30%',
      platform: 'Meta Ads',
      dailyBudget: 300000,
      roas: '3.8x',
      leads: 142,
      status: 'ACTIVE',
      creativeType: 'AI Image (1:1 Feed)',
    },
    {
      id: 'cmp-2',
      name: 'TikTok Video — Naskah Edukasi Kas Bocor',
      platform: 'TikTok Ads',
      dailyBudget: 200000,
      roas: '3.5x',
      leads: 98,
      status: 'ACTIVE',
      creativeType: 'AI Video (9:16 Reels)',
    },
    {
      id: 'cmp-3',
      name: 'Google Search — AI Business Operating System',
      platform: 'Google Ads',
      dailyBudget: 150000,
      roas: '2.8x',
      leads: 24,
      status: 'ACTIVE',
      creativeType: 'Search Copy',
    },
    {
      id: 'cmp-4',
      name: 'Meta Retargeting — Pengunjung Web 30 Hari',
      platform: 'Meta Ads',
      dailyBudget: 100000,
      roas: '4.1x',
      leads: 45,
      status: 'ACTIVE',
      creativeType: 'AI Image (1:1 Feed)',
    },
  ]);

  // Promo Vouchers State
  const [activePromos, setActivePromos] = useState([
    { code: 'GROWTH30', discount: '30%', limit: '100 Klaim', used: 42, status: 'ACTIVE' },
    { code: 'ANITECHVIP', discount: 'Rp 250.000', limit: '50 Klaim', used: 48, status: 'HAMPIR HABIS' },
  ]);

  // Sync initial state from localStorage
  const syncWithLocalStorage = () => {
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.marketing) {
          setMetrics((prev) => ({
            ...prev,
            roas: `${parsed.marketing.blendedRoas || 3.5}x`,
            revenue: parsed.marketing.adSpendBudget ? Math.round(parsed.marketing.adSpendBudget * (parsed.marketing.blendedRoas || 3.5)) : prev.revenue,
          }));
        }
      }
    } catch (e) {
      console.warn('Sync error:', e);
    }
  };

  React.useEffect(() => {
    syncWithLocalStorage();
    const handleSync = () => syncWithLocalStorage();
    window.addEventListener('klir-ai-state-updated', handleSync);
    window.addEventListener('klir-mkt-updated', handleSync);
    return () => {
      window.removeEventListener('klir-ai-state-updated', handleSync);
      window.removeEventListener('klir-mkt-updated', handleSync);
    };
  }, []);

  // Quick Launch Form State
  const [quickCampName, setQuickCampName] = useState('');
  const [quickPlatform, setQuickPlatform] = useState<'Meta Ads' | 'TikTok Ads' | 'Google Ads'>('Meta Ads');
  const [quickBudget, setQuickBudget] = useState('250000');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Handle Quick Campaign Launch
  const handleQuickLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    const budgetNum = parseInt(quickBudget) || 250000;
    const newCamp = {
      id: `cmp-${Date.now()}`,
      name: quickCampName.trim() || `${quickPlatform} — Kampanye Promosi`,
      platform: quickPlatform,
      dailyBudget: budgetNum,
      roas: '3.5x (Target)',
      leads: 0,
      status: 'ACTIVE',
      creativeType: 'Standard Creative',
    };

    setCampaigns([newCamp, ...campaigns]);
    setMetrics((prev) => ({ ...prev, activeCampaignsCount: prev.activeCampaignsCount + 1 }));
    setQuickCampName('');
    setToastMsg(`🚀 Kampanye "${newCamp.name}" berhasil diluncurkan.`);
    setTimeout(() => setToastMsg(null), 4000);

    // Dispatch event to sync with CEO dashboard
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      let current = saved ? JSON.parse(saved) : {};
      if (!current.marketing) current.marketing = {};
      current.marketing.adSpendBudget = (current.marketing.adSpendBudget || 5200000) + budgetNum;
      localStorage.setItem('klir_live_company_state', JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('klir-mkt-updated'));
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
    } catch (err) {
      console.warn('Storage dispatch error:', err);
    }
  };

  // Handle Toggle Campaign Status
  const handleToggleStatus = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : c
      )
    );
  };

  return (
    <div className="space-y-6 text-[#F5F7FA] font-sans pb-12 w-full max-w-[1280px] mx-auto animate-fadeIn">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (CLEAN & MINIMAL) */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white">
              Dashboard Marketing
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[11px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>Real-Time Marketing</span>
            </span>
          </div>
          <p className="text-xs text-[#8A93A3] mt-0.5">
            Ringkasan data performa iklan, efisiensi ROAS, dan manajemen kampanye aktif
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3.5 bg-[#10B981]/15 border border-[#10B981]/40 text-[#D1FAE5] rounded-xl text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span className="font-semibold">{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-[#8A93A3] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOP 3 KPI CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0E121A] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-1">
          <span className="text-xs text-[#8A93A3] font-medium block">Blended ROAS Iklan</span>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-[#10B981] font-mono">
            {metrics.roas}
          </div>
          <span className="text-[11px] text-[#10B981] font-semibold block">
            ↑ +0.4x di atas target baseline (3.0x)
          </span>
        </div>

        <div className="bg-[#0E121A] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-1">
          <span className="text-xs text-[#8A93A3] font-medium block">Omset Teratribusi Iklan</span>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-white font-mono">
            Rp {metrics.revenue.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-[#10B981] font-semibold block">
            ↑ +34.2% MoM (245 Total Leads)
          </span>
        </div>

        <div className="bg-[#0E121A] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-1">
          <span className="text-xs text-[#8A93A3] font-medium block">Kampanye Berjalan</span>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-white font-mono">
            {metrics.activeCampaignsCount} Kampanye
          </div>
          <span className="text-[11px] text-[#8A93A3] font-semibold block">
            Budget Harian: Rp {campaigns.reduce((a, c) => a + c.dailyBudget, 0).toLocaleString('id-ID')}/hari
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ACTIVE CAMPAIGNS LIST */}
      {/* ========================================================================= */}
      <div className="bg-[#0E121A] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#3B82F6]/20 text-[#60A5FA]">
              <Megaphone className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-sm text-white">
              Daftar Kampanye Iklan Berjalan
            </h3>
          </div>
          <span className="text-[11px] text-[#8A93A3]">{campaigns.length} Kampanye Terdaftar</span>
        </div>

        <div className="space-y-2.5">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="p-4 bg-[#141820] hover:bg-[#181E29] border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all text-xs"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    c.status === 'ACTIVE' ? 'bg-[#10B981] animate-pulse' : 'bg-[#64748B]'
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{c.name}</span>
                    <span className="px-2 py-0.5 bg-white/5 text-[#A5B4FC] rounded text-[10px] font-mono">
                      {c.creativeType}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8A93A3] mt-0.5 block">
                    Platform: <strong>{c.platform}</strong> • Budget: <strong>Rp {c.dailyBudget.toLocaleString('id-ID')}/hari</strong> • Leads: <strong>{c.leads || 0}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] text-[#8A93A3] block">Performa ROAS</span>
                  <span className="text-sm font-mono font-bold text-[#10B981]">{c.roas}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(c.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                    c.status === 'ACTIVE'
                      ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/25'
                      : 'bg-white/5 text-[#8A93A3] border border-white/10 hover:text-white'
                  }`}
                >
                  {c.status === 'ACTIVE' ? '● Aktif' : '⏸ Dijeda'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM ROW: SETUP KAMPANYE BARU & KODE PROMO */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Setup Campaign */}
        <div className="lg:col-span-7 bg-[#0E121A] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-1">
            <span className="p-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981]">
              <Rocket className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-sm text-white">
              Setup & Tambah Kampanye Baru
            </h3>
          </div>

          <form onSubmit={handleQuickLaunch} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[#8A93A3] font-semibold text-[11px]">Nama Kampanye Iklan</label>
              <input
                type="text"
                value={quickCampName}
                onChange={(e) => setQuickCampName(e.target.value)}
                placeholder="Contoh: Meta Ads — Promo Retainer Klien Baru"
                required
                className="w-full bg-[#141820] border border-white/10 focus:border-[#6366F1] rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[#8A93A3] font-semibold text-[11px]">Platform</label>
                <select
                  value={quickPlatform}
                  onChange={(e: any) => setQuickPlatform(e.target.value)}
                  className="w-full bg-[#141820] border border-white/10 focus:border-[#6366F1] rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none cursor-pointer"
                >
                  <option value="Meta Ads">Meta Ads (Instagram & FB)</option>
                  <option value="TikTok Ads">TikTok Ads</option>
                  <option value="Google Ads">Google Search / PMax</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#8A93A3] font-semibold text-[11px]">Budget Harian (Rp)</label>
                <input
                  type="number"
                  value={quickBudget}
                  onChange={(e) => setQuickBudget(e.target.value)}
                  className="w-full bg-[#141820] border border-white/10 focus:border-[#6366F1] rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 mt-2"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Luncurkan Kampanye Sekarang</span>
            </button>
          </form>
        </div>

        {/* Right: Active Vouchers */}
        <div className="lg:col-span-5 bg-[#0E121A] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#F59E0B]/20 text-[#FBBF24]">
                <Tag className="w-4 h-4" />
              </span>
              <h3 className="font-heading font-bold text-sm text-white">
                Kode Promo & Voucher
              </h3>
            </div>
            <span className="text-[11px] text-[#8A93A3]">{activePromos.length} Voucher</span>
          </div>

          <div className="space-y-2.5">
            {activePromos.map((p, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#141820] border border-white/5 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-white text-sm block">{p.code}</span>
                  <span className="text-[10px] text-[#8A93A3]">
                    Diskon: {p.discount} • Terpakai: {p.used}/{p.limit}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded-md text-[10px] font-bold">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, Brain, Bell, Shield, Check, Save } from 'lucide-react';

interface CEOSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  workspaceName?: string;
}

export function CEOSettingsModal({
  isOpen,
  onClose,
  workspaceId = 'default',
  workspaceName = 'Perusahaan Anda',
}: CEOSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'alerts' | 'privacy'>('profile');
  const storageKey = `klir_settings_ceo_${workspaceId}`;

  // Tab 1: Profil Perusahaan
  const [companyName, setCompanyName] = useState(workspaceName);
  const [industry, setIndustry] = useState('Software & Tech Agency');
  const [businessModel, setBusinessModel] = useState('B2B Retainer');
  const [description, setDescription] = useState('Pengembang platform cerdas KLIR OS dan solusi software digital.');
  const [nib, setNib] = useState('9120008123901');

  // Tab 2: AI Brain Preference
  const [aiModel, setAiModel] = useState<'deepseek' | 'gemini' | 'fast'>('deepseek');
  const [aiTone, setAiTone] = useState<'consultant' | 'concise' | 'partner'>('consultant');
  const [autoDocumentDraft, setAutoDocumentDraft] = useState(true);

  // Tab 3: Ambang Batas Peringatan (Alerts)
  const [minRunwayMonths, setMinRunwayMonths] = useState(3);
  const [minNetMarginPercent, setMinNetMarginPercent] = useState(20);
  const [maxTeamLoadPercent, setMaxTeamLoadPercent] = useState(85);

  // Tab 4: Tata Kelola & Akses
  const [workspaceMode, setWorkspaceMode] = useState<'isolated' | 'collaborative'>('isolated');
  const [hideSensitiveFinance, setHideSensitiveFinance] = useState(true);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Load saved settings
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.companyName) setCompanyName(parsed.companyName);
        if (parsed.industry) setIndustry(parsed.industry);
        if (parsed.businessModel) setBusinessModel(parsed.businessModel);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.nib) setNib(parsed.nib);
        if (parsed.aiModel) setAiModel(parsed.aiModel);
        if (parsed.aiTone) setAiTone(parsed.aiTone);
        if (parsed.autoDocumentDraft !== undefined) setAutoDocumentDraft(parsed.autoDocumentDraft);
        if (parsed.minRunwayMonths) setMinRunwayMonths(parsed.minRunwayMonths);
        if (parsed.minNetMarginPercent) setMinNetMarginPercent(parsed.minNetMarginPercent);
        if (parsed.maxTeamLoadPercent) setMaxTeamLoadPercent(parsed.maxTeamLoadPercent);
        if (parsed.workspaceMode) setWorkspaceMode(parsed.workspaceMode);
        if (parsed.hideSensitiveFinance !== undefined) setHideSensitiveFinance(parsed.hideSensitiveFinance);
      }
    } catch (e) {}

    // Juga ambil profil live dari API
    fetch(`/api/v1/workspaces/${workspaceId}/profile`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.name) setCompanyName(res.data.name);
        if (res.data?.industry && res.data.industry !== 'Belum ditentukan') setIndustry(res.data.industry);
        if (res.data?.description && res.data.description !== 'Belum ada deskripsi profil') setDescription(res.data.description);
        // 8 Sep 2026 (temuan F2, kontrak B5): businessModel & nib sekarang genuinely
        // disimpan server (lihat handleSave di bawah) -- dibaca balik di sini juga
        // supaya modal tidak menampilkan nilai localStorage basi kalau sudah pernah
        // disimpan dari device/browser lain.
        if (res.data?.businessModel && res.data.businessModel !== 'Belum ditentukan') setBusinessModel(res.data.businessModel);
        if (res.data?.nib && res.data.nib !== '-') setNib(res.data.nib);
      })
      .catch(() => {});
  }, [isOpen, storageKey, workspaceId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const payload = {
      companyName,
      industry,
      businessModel,
      description,
      nib,
      aiModel,
      aiTone,
      autoDocumentDraft,
      minRunwayMonths,
      minNetMarginPercent,
      maxTeamLoadPercent,
      workspaceMode,
      hideSensitiveFinance,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));

      // Simpan juga ke API profil workspace agar AI Brain tersinkronisasi.
      // 8 Sep 2026 (temuan F2 audit): businessModel & nib dulu HANYA masuk localStorage
      // -- endpoint sudah diperluas B5 (workspaces/[workspaceId]/profile/route.ts baris
      // 142-143,164-165,181) untuk menerima & menyimpan keduanya, jadi sekarang ikut
      // dikirim juga.
      await fetch(`/api/v1/workspaces/${workspaceId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          industry,
          description,
          businessModel,
          nib,
          source: 'Pengaturan CEO',
        }),
      });

      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      window.dispatchEvent(new CustomEvent('klir-settings-updated'));

      // 8 Sep 2026 (temuan F2 audit): dulu toast sukses SAMA untuk semua tab, walau
      // Tab Ambang Batas & Privasi murni localStorage tanpa efek sistem apapun (lihat
      // disclaimer di 2 tab itu). Toast sekarang jujur mengikuti tab yang aktif saat
      // Simpan diklik.
      const honestToast =
        activeTab === 'alerts' || activeTab === 'privacy'
          ? 'Preferensi tersimpan di browser ini (belum mempengaruhi sistem alert/akses).'
          : activeTab === 'ai'
          ? 'Pengaturan AI Brain tersimpan & langsung dipakai untuk chat berikutnya.'
          : 'Profil usaha tersimpan & disinkronkan ke AI Brain.';
      setToastMsg(honestToast);
      setTimeout(() => {
        setToastMsg(null);
        onClose();
      }, 700);
    } catch (e) {
      console.warn('Gagal menyimpan settings:', e);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(7px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'klirFade 150ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: '#0B0E14',
          border: 0,
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(78,155,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Outfit', sans-serif",
          color: '#F5F7FA',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(78,155,255,0.15)', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4E9BFF', fontSize: '18px' }}>
              👑
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#F5F7FA' }}>
                Pengaturan Eksekutif &amp; Bisnis
              </h2>
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>
                Tata kelola profil bisnis, kecerdasan AI Brain, dan batas kewaspadaan.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 0, color: '#8A93A3', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: 0, background: '#080A0F', padding: '0 16px' }}>
          {[
            { key: 'profile', label: 'Profil Usaha', icon: <Building2 size={15} /> },
            { key: 'ai', label: 'AI Brain', icon: <Brain size={15} /> },
            { key: 'alerts', label: 'Ambang Batas', icon: <Bell size={15} /> },
            { key: 'privacy', label: 'Privasi & Akses', icon: <Shield size={15} /> },
          ].map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 0,
                  borderBottom: active ? '2px solid #4E9BFF' : '2px solid transparent',
                  color: active ? '#4E9BFF' : '#8A93A3',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* TAB 1: PROFIL USAHA */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Nama Entitas Bisnis / Perusahaan
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Contoh: PT Anitech Digital Solusindo"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                    Bidang Usaha / Industri
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Contoh: Software & Tech Agency"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                    Model Bisnis Utama
                  </label>
                  <select
                    value={businessModel}
                    onChange={(e) => setBusinessModel(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="B2B Retainer">B2B Retainer / Agensi Jasa</option>
                    <option value="B2B Project">B2B Project-based</option>
                    <option value="B2C Retail">B2C Retail &amp; E-commerce</option>
                    <option value="F&B Culinary">F&amp;B / Kuliner</option>
                    <option value="Manufaktur">Manufaktur / Konveksi</option>
                    <option value="Distribusi">Distributor &amp; Logistik</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Deskripsi &amp; Value Proposition
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ringkas apa yang bisnis Anda jual dan target pasarnya..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Nomor Induk Berusaha (NIB) / Legalitas
                </label>
                <input
                  type="text"
                  value={nib}
                  onChange={(e) => setNib(e.target.value)}
                  placeholder="Contoh: 9120008123901"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: AI BRAIN */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '8px' }}>
                  Model Kecerdasan Utama AI Brain
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'deepseek', name: 'DeepSeek R1 · OpenRouter', desc: 'Penalaran strategis bisnis terdalam' },
                    { id: 'gemini', name: 'Gemini 2.5 Flash · Gemini', desc: 'Respon cepat & analisis multimodal' },
                    { id: 'fast', name: 'Groq Fast', desc: 'Jawaban singkat, cepat, dan hemat latency' },
                  ].map((m) => {
                    const selected = aiModel === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setAiModel(m.id as any)}
                        style={{
                          padding: '12px',
                          borderRadius: '12px',
                          background: selected ? 'rgba(78,155,255,0.16)' : '#10141C',
                          border: 0,
                          boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                        }}
                      >
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: selected ? '#4E9BFF' : '#F5F7FA' }}>
                          {m.name}
                        </span>
                        <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#8A93A3', lineHeight: 1.4 }}>
                          {m.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '8px' }}>
                  Gaya Komunikasi AI Assistant
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { id: 'consultant', label: 'Konsultan Bisnis Senior', note: 'Berwibawa, analitis, menyertakan dasar data dan proyeksi resiko.' },
                    { id: 'concise', label: 'Tegas & Eksekutif (To The Point)', note: 'Ringkas, prioritaskan bullet points dan langkah aksi konkret.' },
                    { id: 'partner', label: 'Diskusi Santai Mitra Kerja', note: 'Kolaboratif, ramah, dan solutif layaknya co-founder.' },
                  ].map((t) => {
                    const checked = aiTone === t.id;
                    return (
                      <label
                        key={t.id}
                        onClick={() => setAiTone(t.id as any)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          padding: '12px 14px',
                          borderRadius: '10px',
                          background: checked ? 'rgba(78,155,255,0.12)' : '#10141C',
                          border: 0,
                          boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name="aiTone"
                          checked={checked}
                          onChange={() => setAiTone(t.id as any)}
                          style={{ marginTop: '2px', accentColor: '#4E9BFF' }}
                        />
                        <div>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: checked ? '#4E9BFF' : '#F5F7FA' }}>
                            {t.label}
                          </span>
                          <span style={{ display: 'block', marginTop: '2px', fontSize: '11.5px', color: '#8A93A3' }}>
                            {t.note}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Otomatis Buatkan Draf Dokumen Nyata
                  </span>
                  <span style={{ display: 'block', marginTop: '2px', fontSize: '11.5px', color: '#8A93A3' }}>
                    AI otomatis menawarkan pembuatan file Word (.docx), Excel (.xlsx), atau PPT jika relevan.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoDocumentDraft}
                  onChange={(e) => setAutoDocumentDraft(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#4E9BFF', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: AMBANG BATAS & ALERTS */}
          {activeTab === 'alerts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 8 Sep 2026 (temuan F2 audit, kategori HONEST-DISABLE): 3 slider di tab ini
                  murni localStorage -- grep menyeluruh (minRunwayMonths/minNetMarginPercent/
                  maxTeamLoadPercent) 0 hasil di luar file ini, tidak ada dashboard/alert
                  manapun yang membacanya. Disclaimer jujur dipasang di sini alih-alih diam-diam
                  membiarkan slider terlihat fungsional. */}
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(242,168,59,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)', fontSize: '11.5px', color: '#F2A83B', lineHeight: 1.5 }}>
                Preferensi tampilan saja -- tersimpan di browser ini, BELUM mempengaruhi ambang peringatan dashboard atau notifikasi AI manapun.
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Peringatan Runway Kas Kritis
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#3FBF8F', fontWeight: 600 }}>
                    &lt; {minRunwayMonths} Bulan
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="1"
                  value={minRunwayMonths}
                  onChange={(e) => setMinRunwayMonths(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3FBF8F' }}
                />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#8A93A3' }}>
                  AI dan dashboard akan memicu peringatan merah jika cadangan kas operasional turun di bawah ambang ini.
                </span>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Target Margin Laba Bersih Minimum
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4E9BFF', fontWeight: 600 }}>
                    {minNetMarginPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={minNetMarginPercent}
                  onChange={(e) => setMinNetMarginPercent(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#4E9BFF' }}
                />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#8A93A3' }}>
                  AI akan menandai anomali biaya jika margin keuntungan bulanan berada di bawah target ini.
                </span>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Batas Beban Kerja Tim Maksimal (Utilisasi)
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#F2A83B', fontWeight: 600 }}>
                    {maxTeamLoadPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={maxTeamLoadPercent}
                  onChange={(e) => setMaxTeamLoadPercent(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#F2A83B' }}
                />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#8A93A3' }}>
                  AI menyarankan pembukaan rekrutmen staf baru saat beban divisi mencapai ambang batas ini.
                </span>
              </div>
            </div>
          )}

          {/* TAB 4: PRIVASI & AKSES */}
          {activeTab === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 8 Sep 2026 (temuan F2 audit, kategori HONEST-DISABLE): workspaceMode &
                  hideSensitiveFinance juga murni localStorage -- grep 0 hasil di luar file
                  ini, tidak ada guard akses lintas-divisi manapun yang membacanya. */}
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(242,168,59,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)', fontSize: '11.5px', color: '#F2A83B', lineHeight: 1.5 }}>
                Preferensi tampilan saja -- tersimpan di browser ini, BELUM benar-benar membatasi akses data antar divisi atau menyembunyikan apapun dari portal lain.
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA', marginBottom: '4px' }}>
                  Mode Ruang Kerja Divisi
                </span>
                <span style={{ display: 'block', fontSize: '11.5px', color: '#8A93A3', marginBottom: '12px' }}>
                  Tentukan bagaimana data dan kemampuan AI dibagikan antar divisi.
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setWorkspaceMode('isolated')}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: workspaceMode === 'isolated' ? 'rgba(78,155,255,0.16)' : '#080A0F',
                      border: 0,
                      boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: workspaceMode === 'isolated' ? '#4E9BFF' : '#F5F7FA' }}>
                      🔒 Terisolasi per Divisi
                    </span>
                    <span style={{ display: 'block', marginTop: '3px', fontSize: '11px', color: '#8A93A3', lineHeight: 1.4 }}>
                      Finance hanya melihat kas, Marketing hanya melihat ads, CEO memiliki akses penuh.
                    </span>
                  </div>

                  <div
                    onClick={() => setWorkspaceMode('collaborative')}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: workspaceMode === 'collaborative' ? 'rgba(63,191,143,0.16)' : '#080A0F',
                      border: 0,
                      boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: workspaceMode === 'collaborative' ? '#3FBF8F' : '#F5F7FA' }}>
                      🤝 Terbuka &amp; Kolaboratif
                    </span>
                    <span style={{ display: 'block', marginTop: '3px', fontSize: '11px', color: '#8A93A3', lineHeight: 1.4 }}>
                      Semua divisi dapat melihat metrik ringkasan lintas departemen untuk koordinasi cepat.
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Sembunyikan Saldo Kas Sensitif dari Marketing
                  </span>
                  <span style={{ display: 'block', marginTop: '2px', fontSize: '11.5px', color: '#8A93A3' }}>
                    Portal marketing hanya melihat anggaran spend iklan tanpa saldo rekening koran perusahaan.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hideSensitiveFinance}
                  onChange={(e) => setHideSensitiveFinance(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#4E9BFF', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: 0, background: '#080A0F' }}>
          <span style={{ fontSize: '12px', color: '#3FBF8F' }}>
            {toastMsg || ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: 0, color: '#C6CEDA', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px', background: '#0058BE', border: 0, color: '#FFFFFF', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Save size={14} />
              <span>Simpan Pengaturan CEO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CEOSettingsModal;

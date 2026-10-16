'use client';

import React, { useState, useEffect } from 'react';
import { X, Target, PenTool, Share2, Tag, Save, Check } from 'lucide-react';

export type MarketingSettingsTab = 'metrics' | 'copy' | 'channels' | 'promos';

interface MarketingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  workspaceName?: string;
  /** Tab yang dibuka saat modal muncul. Default 'metrics'. Dipakai tombol
   *  "Integrasi Meta Ads & TikTok Pixel" di sidebar Marketing agar langsung ke 'channels'. */
  initialTab?: MarketingSettingsTab;
}

export function MarketingSettingsModal({
  isOpen,
  onClose,
  workspaceId = 'default',
  workspaceName = 'Perusahaan Anda',
  initialTab = 'metrics',
}: MarketingSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<MarketingSettingsTab>(initialTab);
  // Reset tiap kali modal DIBUKA (bukan cuma saat mount) -- kalau tidak, klik kedua
  // dari tombol lain mendarat di tab terakhir yang dipakai, persis bug yang diperbaiki.
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);
  const storageKey = `klir_settings_mkt_${workspaceId}`;

  // Tab 1: Target Metrik
  const [targetRoas, setTargetRoas] = useState(3.5);
  const [maxCac, setMaxCac] = useState(50000);
  const [budgetBurnAlertPercent, setBudgetBurnAlertPercent] = useState(25);

  // Tab 2: Persona Copywriting AI
  const [copyStyle, setCopyStyle] = useState<'storytelling' | 'hardsell' | 'educative' | 'fomo'>('storytelling');
  const [languageTone, setLanguageTone] = useState<'casual' | 'formal' | 'trendy'>('casual');
  const [primaryUsp, setPrimaryUsp] = useState('Platform bisnis all-in-one termudah untuk pemilik usaha.');

  // Tab 3: Kanal & Tracking
  const [metaAdsEnabled, setMetaAdsEnabled] = useState(true);
  const [tiktokAdsEnabled, setTiktokAdsEnabled] = useState(true);
  const [googleAdsEnabled, setGoogleAdsEnabled] = useState(false);
  const [attributionModel, setAttributionModel] = useState<'blended' | 'last_click' | 'first_click'>('blended');

  // Tab 4: Kupon & Promo
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(30);
  const [defaultCouponDurationDays, setDefaultCouponDurationDays] = useState(7);
  const [couponPrefix, setCouponPrefix] = useState('KLIR');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Load saved settings
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetRoas) setTargetRoas(parsed.targetRoas);
        if (parsed.maxCac) setMaxCac(parsed.maxCac);
        if (parsed.budgetBurnAlertPercent) setBudgetBurnAlertPercent(parsed.budgetBurnAlertPercent);
        if (parsed.copyStyle) setCopyStyle(parsed.copyStyle);
        if (parsed.languageTone) setLanguageTone(parsed.languageTone);
        if (parsed.primaryUsp) setPrimaryUsp(parsed.primaryUsp);
        if (parsed.metaAdsEnabled !== undefined) setMetaAdsEnabled(parsed.metaAdsEnabled);
        if (parsed.tiktokAdsEnabled !== undefined) setTiktokAdsEnabled(parsed.tiktokAdsEnabled);
        if (parsed.googleAdsEnabled !== undefined) setGoogleAdsEnabled(parsed.googleAdsEnabled);
        if (parsed.attributionModel) setAttributionModel(parsed.attributionModel);
        if (parsed.maxDiscountPercent) setMaxDiscountPercent(parsed.maxDiscountPercent);
        if (parsed.defaultCouponDurationDays) setDefaultCouponDurationDays(parsed.defaultCouponDurationDays);
        if (parsed.couponPrefix) setCouponPrefix(parsed.couponPrefix);
      }
    } catch (e) {}
  }, [isOpen, storageKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    const payload = {
      targetRoas,
      maxCac,
      budgetBurnAlertPercent,
      copyStyle,
      languageTone,
      primaryUsp,
      metaAdsEnabled,
      tiktokAdsEnabled,
      googleAdsEnabled,
      attributionModel,
      maxDiscountPercent,
      defaultCouponDurationDays,
      couponPrefix,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('klir-settings-updated'));
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));

      // FIX (8 Sep 2026, MKT-02): toast lama "berhasil disimpan!" menyiratkan pengaturan
      // ini mengubah perilaku sistem -- padahal cuma localStorage, nol pembaca lain di
      // codebase. Toast sekarang jujur soal cakupannya.
      setToastMsg('Tersimpan di perangkat ini (localStorage) -- belum mempengaruhi AI Assistant atau kampanye manapun.');
      setTimeout(() => {
        setToastMsg(null);
        onClose();
      }, 700);
    } catch (e) {
      console.warn('Gagal menyimpan settings marketing:', e);
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
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(242,168,59,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Outfit', sans-serif",
          color: '#F5F7FA',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(242,168,59,0.15)', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F2A83B', fontSize: '18px' }}>
              📣
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#F5F7FA' }}>
                Pengaturan Pemasaran &amp; Pertumbuhan
              </h2>
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>
                Target ROAS/CAC, persona copywriting AI, integrasi ads, dan batasan promo.
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
            { key: 'metrics', label: 'Target Metrik', icon: <Target size={15} /> },
            { key: 'copy', label: 'Copywriting AI', icon: <PenTool size={15} /> },
            { key: 'channels', label: 'Kanal Iklan', icon: <Share2 size={15} /> },
            { key: 'promos', label: 'Kupon & Promo', icon: <Tag size={15} /> },
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
                  borderBottom: active ? '2px solid #F2A83B' : '2px solid transparent',
                  color: active ? '#F2A83B' : '#8A93A3',
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

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* FIX (8 Sep 2026, MKT-02): banner jujur -- grep menyeluruh (targetRoas, maxCac,
              budgetBurnAlertPercent, copyStyle, languageTone, primaryUsp, metaAdsEnabled,
              tiktokAdsEnabled, googleAdsEnabled, attributionModel, maxDiscountPercent,
              defaultCouponDurationDays, couponPrefix) di seluruh src/ = 0 hasil di luar
              file ini sendiri. Nilai-nilai ini TIDAK dibaca AI Assistant, tidak dibaca
              endpoint promo/campaign manapun -- murni tersimpan di localStorage browser
              ini saja. Banner ini menggantikan kesan "pengaturan aktif" yang salah.
              CARA MEMBATALKAN: hapus blok div banner ini. */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(242,168,59,0.12)',
              border: 0,
              boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)',
              fontSize: '11.5px',
              color: '#D8B77A',
              lineHeight: 1.5,
            }}
          >
            Preferensi di modal ini tersimpan di perangkat ini saja (localStorage) dan belum
            dibaca oleh AI Assistant atau sistem kampanye manapun di KLIR.
          </div>
          {/* TAB 1: TARGET METRIK */}
          {activeTab === 'metrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Target Blended ROAS Minimum
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#F2A83B', fontWeight: 600 }}>
                    {targetRoas.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="6.0"
                  step="0.1"
                  value={targetRoas}
                  onChange={(e) => setTargetRoas(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#F2A83B' }}
                />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#8A93A3' }}>
                  Catatan: preferensi ini belum dibaca AI Assistant manapun di KLIR (tersimpan lokal saja).
                </span>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Batas Maksimum CAC (Customer Acquisition Cost)
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4E9BFF', fontWeight: 600 }}>
                    Rp {maxCac.toLocaleString('id-ID')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="200000"
                  step="5000"
                  value={maxCac}
                  onChange={(e) => setMaxCac(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#4E9BFF' }}
                />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#8A93A3' }}>
                  Catatan: belum ada sistem peringatan CAC di KLIR yang membaca angka ini (tersimpan lokal saja).
                </span>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Peringatan Lonjakan Budget (Burn Alert)
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#EF4444', fontWeight: 600 }}>
                    &gt; {budgetBurnAlertPercent}% Lonjakan
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={budgetBurnAlertPercent}
                  onChange={(e) => setBudgetBurnAlertPercent(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#EF4444' }}
                />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#8A93A3' }}>
                  Catatan: belum ada sistem peringatan burn-rate di KLIR yang membaca angka ini (tersimpan lokal saja).
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: COPYWRITING AI */}
          {activeTab === 'copy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '8px' }}>
                  Gaya Penulisan Promosi AI Utama
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { id: 'storytelling', label: 'Storytelling Solutif', desc: 'Bercerita masalah nyata yang dihadapi calon pelanggan lalu memberikan jalan keluar.' },
                    { id: 'hardsell', label: 'Direct Response', desc: 'Fokus ke penawaran kuat, benefit instan, dan ajakan aksi (Call-to-Action) tegas.' },
                    { id: 'educative', label: 'Edukatif & Otoritas', desc: 'Membagikan wawasan/tips industri yang membuktikan keahlian brand Anda.' },
                    { id: 'fomo', label: 'FOMO / Promo Kilat', desc: 'Menekankan kelangkaan kuota, batas waktu promo, dan diskon terbatas.' },
                  ].map((c) => {
                    const selected = copyStyle === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setCopyStyle(c.id as any)}
                        style={{
                          padding: '12px',
                          borderRadius: '12px',
                          background: selected ? 'rgba(242,168,59,0.16)' : '#10141C',
                          border: 0,
                          boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: selected ? '#F2A83B' : '#F5F7FA' }}>
                          {c.label}
                        </span>
                        <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#8A93A3', lineHeight: 1.4 }}>
                          {c.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Nada Bahasa Sasaran Audiens
                </label>
                <select
                  value={languageTone}
                  onChange={(e) => setLanguageTone(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="casual">Bahasa Indonesia Santai &amp; Akrab (Instagram / TikTok)</option>
                  <option value="formal">Bahasa Bisnis Formal &amp; Profesional (B2B / LinkedIn)</option>
                  <option value="trendy">Trend &amp; Catchy (Gen-Z &amp; Young Adults)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Unique Selling Proposition (USP) Produk Anda
                </label>
                <input
                  type="text"
                  value={primaryUsp}
                  onChange={(e) => setPrimaryUsp(e.target.value)}
                  placeholder="Contoh: Platform integrasi keuangan dan marketing nomor 1 untuk bisnis Anda."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#8A93A3' }}>
                  Catatan: teks ini belum dibaca oleh generator naskah iklan/copywriting manapun di KLIR (tersimpan lokal saja).
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: KANAL IKLAN */}
          {activeTab === 'channels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA', marginBottom: '4px' }}>
                  Koneksi Integrasi Pelacakan Iklan (Pixel &amp; Conversion API)
                </span>
                <span style={{ display: 'block', fontSize: '11.5px', color: '#8A93A3', marginBottom: '14px' }}>
                  Pilih kanal iklan berbayar yang aktif dipantau oleh KLIR Marketing Engine.
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#080A0F', border: 0, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>🌐</span>
                      <div>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Meta Ads (Facebook &amp; Instagram)</span>
                        {/* FIX (8 Sep 2026, MKT-01): dulu label ini bilang "Terhubung" hijau padahal
                            KLIR tidak punya integrasi API ke Meta Ads sama sekali (grep 0 hasil di
                            seluruh src/). Checkbox di bawah tetap bisa dicentang (preferensi lokal),
                            tapi klaim koneksinya sekarang jujur. CARA MEMBATALKAN: kembalikan teks
                            "Terhubung • Tracking Blended ROAS" warna #3FBF8F. */}
                        <span style={{ display: 'block', fontSize: '11px', color: '#8A93A3' }}>Belum terhubung -- KLIR belum ada integrasi API ke Meta Ads</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={metaAdsEnabled}
                      onChange={(e) => setMetaAdsEnabled(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#F2A83B' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#080A0F', border: 0, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>🎵</span>
                      <div>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>TikTok Ads Engine</span>
                        {/* FIX (8 Sep 2026, MKT-01): sama seperti Meta Ads di atas -- nol integrasi
                            API ke TikTok Ads di codebase KLIR, klaim "Terhubung" tidak benar. */}
                        <span style={{ display: 'block', fontSize: '11px', color: '#8A93A3' }}>Belum terhubung -- KLIR belum ada integrasi API ke TikTok Ads</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={tiktokAdsEnabled}
                      onChange={(e) => setTiktokAdsEnabled(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#F2A83B' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#080A0F', border: 0, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>🔍</span>
                      <div>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Google Ads (Search &amp; YouTube)</span>
                        <span style={{ display: 'block', fontSize: '11px', color: '#8A93A3' }}>Siap dikonfigurasi</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={googleAdsEnabled}
                      onChange={(e) => setGoogleAdsEnabled(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#F2A83B' }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Model Atribusi Pendapatan Penjualan
                </label>
                <select
                  value={attributionModel}
                  onChange={(e) => setAttributionModel(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="blended">Blended Attributed (Rekomendasi - Total Omset / Total Spend)</option>
                  <option value="last_click">Last-Click Attribution (Sentuhan Terakhir)</option>
                  <option value="first_click">First-Click Attribution (Sentuhan Pertama)</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 4: KUPON & PROMO */}
          {activeTab === 'promos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Batas Maksimal Diskon yang Diizinkan
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#F2A83B', fontWeight: 600 }}>
                    Maks. {maxDiscountPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="70"
                  step="5"
                  value={maxDiscountPercent}
                  onChange={(e) => setMaxDiscountPercent(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#F2A83B' }}
                />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#8A93A3' }}>
                  Catatan: batas ini belum ditegakkan otomatis saat membuat kupon (tersimpan lokal saja, bukan validasi server).
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                    Masa Berlaku Default Kupon Promo
                  </label>
                  <select
                    value={defaultCouponDurationDays}
                    onChange={(e) => setDefaultCouponDurationDays(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value={3}>3 Hari (Promo Flash Sale)</option>
                    <option value={7}>7 Hari (Standar 1 Pekan)</option>
                    <option value={14}>14 Hari (2 Pekan)</option>
                    <option value={30}>30 Hari (Promo Bulanan)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                    Awalan Kode Kupon Otomatis
                  </label>
                  <input
                    type="text"
                    value={couponPrefix}
                    onChange={(e) => setCouponPrefix(e.target.value.toUpperCase())}
                    placeholder="Contoh: KLIR"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: 0, background: '#080A0F' }}>
          <span style={{ fontSize: '12px', color: '#F2A83B' }}>
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
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px', background: '#F2A83B', border: 0, color: '#080B10', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
            >
              <Save size={14} />
              <span>Simpan Pengaturan Marketing</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketingSettingsModal;

'use client';

import React, { useState, useEffect } from 'react';
import { X, Wallet, Receipt, BellRing, FileSpreadsheet, Save, Check, LockKeyhole } from 'lucide-react';
import TaxFeatureLock from '../TaxFeatureLock';
import { TAX_FEATURE_LOCKED, TAX_FEATURE_LOCK_MESSAGE } from '@/lib/tax-feature';

interface FinanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  workspaceName?: string;
  initialTab?: 'cashflow' | 'tax' | 'invoices' | 'export';
}

export function FinanceSettingsModal({
  isOpen,
  onClose,
  workspaceId = 'default',
  workspaceName = 'Perusahaan Anda',
  initialTab,
}: FinanceSettingsModalProps) {
  // FIX (audit role-fit 7 Sep): initialTab baru -- dulu modal ini SELALU buka ke tab
  // 'cashflow' apapun link yang diklik, termasuk link "Integrasi Akuntansi & Pajak" di
  // FinanceAIAssistantView.tsx yang seharusnya langsung ke tab Pajak.
  const [activeTab, setActiveTab] = useState<'cashflow' | 'tax' | 'invoices' | 'export'>(initialTab || 'cashflow');
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab || 'cashflow');
  }, [isOpen, initialTab]);
  const storageKey = `klir_settings_fin_${workspaceId}`;

  // Tab 1: Buku Kas & Operasional
  const [emergencyReserveMonths, setEmergencyReserveMonths] = useState(3);
  const [defaultExpenseType, setDefaultExpenseType] = useState<'OPEX' | 'CAPEX'>('OPEX');
  const [currencyDisplayFormat, setCurrencyDisplayFormat] = useState<'full' | 'compact'>('full');

  // Tab 2: Pajak & Kepatuhan
  const [taxScheme, setTaxScheme] = useState<'UMKM_05' | 'CORPORATE_22'>('UMKM_05');
  const [vatRate, setVatRate] = useState(11);
  const [taxReminderEnabled, setTaxReminderEnabled] = useState(true);

  // Tab 3: Piutang & Invoice Reminder
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(14);
  const [autoReminderHMinus3, setAutoReminderHMinus3] = useState(true);
  const [autoReminderDueDay, setAutoReminderDueDay] = useState(true);
  const [autoReminderHPlus3, setAutoReminderHPlus3] = useState(true);
  const [reminderTone, setReminderTone] = useState<'polite' | 'assertive' | 'legal'>('assertive');

  // Tab 4: Ekspor & Bank
  const [defaultBankParser, setDefaultBankParser] = useState('BCA');
  const [signOffTitle, setSignOffTitle] = useState(`Finance Controller - ${workspaceName}`);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Load saved settings
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.emergencyReserveMonths) setEmergencyReserveMonths(parsed.emergencyReserveMonths);
        if (parsed.defaultExpenseType) setDefaultExpenseType(parsed.defaultExpenseType);
        if (parsed.currencyDisplayFormat) setCurrencyDisplayFormat(parsed.currencyDisplayFormat);
        if (parsed.taxScheme) setTaxScheme(parsed.taxScheme);
        if (parsed.vatRate) setVatRate(parsed.vatRate);
        if (parsed.taxReminderEnabled !== undefined) setTaxReminderEnabled(parsed.taxReminderEnabled);
        if (parsed.defaultPaymentTermsDays) setDefaultPaymentTermsDays(parsed.defaultPaymentTermsDays);
        if (parsed.autoReminderHMinus3 !== undefined) setAutoReminderHMinus3(parsed.autoReminderHMinus3);
        if (parsed.autoReminderDueDay !== undefined) setAutoReminderDueDay(parsed.autoReminderDueDay);
        if (parsed.autoReminderHPlus3 !== undefined) setAutoReminderHPlus3(parsed.autoReminderHPlus3);
        if (parsed.reminderTone) setReminderTone(parsed.reminderTone);
        if (parsed.defaultBankParser) setDefaultBankParser(parsed.defaultBankParser);
        if (parsed.signOffTitle) setSignOffTitle(parsed.signOffTitle);
      }
    } catch (e) {}
  }, [isOpen, storageKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    const payload = {
      emergencyReserveMonths,
      defaultExpenseType,
      currencyDisplayFormat,
      taxScheme,
      vatRate,
      taxReminderEnabled,
      defaultPaymentTermsDays,
      autoReminderHMinus3,
      autoReminderDueDay,
      autoReminderHPlus3,
      reminderTone,
      defaultBankParser,
      signOffTitle,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('klir-settings-updated'));
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));

      // FIX FIN-03 (8 Sep 2026, temuan scan finance) -- toast dulu bilang "berhasil
      // disimpan" tanpa kualifikasi, padahal grep 'klir_settings_fin_' di seluruh src/
      // menghasilkan NOL pembaca lain di luar file ini -- 13 field di 4 tab modal ini
      // TIDAK PERNAH mempengaruhi perhitungan/tampilan di manapun lagi (dashboard Finance
      // tetap pakai rumusnya sendiri, widget pajak sekarang malah panggil
      // kas/tax-calculator langsung, lihat FIN-05 di FinanceModuleView.tsx). Toast sekarang
      // jujur soal cakupan penyimpanan ini.
      setToastMsg('Tersimpan di perangkat ini saja (localStorage) -- belum mempengaruhi perhitungan atau tampilan Finance di manapun.');
      setTimeout(() => {
        setToastMsg(null);
        onClose();
      }, 2400);
    } catch (e) {
      console.warn('Gagal menyimpan settings finance:', e);
    }
  };

  // FIX FIN-03 (8 Sep 2026) -- disclaimer jujur per tab, dipasang di atas isi tiap tab
  // (bukan toast generik doang) supaya kelihatan SEBELUM user sempat isi form, bukan
  // cuma sesudah klik simpan. Grep dikonfirmasi 0 pembaca lain per field, lihat komentar
  // di handleSave di atas.
  const honestDisclaimerByTab: Record<'cashflow' | 'tax' | 'invoices' | 'export', string> = {
    cashflow: 'Preferensi tampilan -- tersimpan di perangkat ini saja, belum dibaca oleh perhitungan kas/beban manapun di KLIR.',
    tax: 'Fitur perpajakan belum tersedia saat ini. Kalkulasi, reminder, dan penyimpanan pajak belum aktif.',
    invoices: 'Preferensi tampilan -- tersimpan di perangkat ini saja. Belum ada pengiriman reminder otomatis sungguhan di KLIR (H-3/H0/H+3 di sini murni catatan preferensi, bukan jadwal terjadwal yang jalan).',
    export: 'Preferensi tampilan -- tersimpan di perangkat ini saja, belum dibaca oleh fitur ekspor Excel/PDF yang sudah ada.',
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
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(63,191,143,0.1)',
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
            <span style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(63,191,143,0.15)', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3FBF8F', fontSize: '18px' }}>
              💰
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#F5F7FA' }}>
                Pengaturan Keuangan &amp; Kas
              </h2>
              <span style={{ fontSize: '12px', color: '#8A93A3' }}>
                Aturan pembukuan kas, skema pajak, pengingat piutang, dan template laporan.
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
            { key: 'cashflow', label: 'Buku Kas', icon: <Wallet size={15} /> },
            { key: 'tax', label: 'Pajak & Tax', icon: <Receipt size={15} /> },
            { key: 'invoices', label: 'Invoice & Piutang', icon: <BellRing size={15} /> },
            { key: 'export', label: 'Laporan & Bank', icon: <FileSpreadsheet size={15} /> },
          ].map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => t.key === 'tax' && TAX_FEATURE_LOCKED ? setToastMsg(TAX_FEATURE_LOCK_MESSAGE) : setActiveTab(t.key as any)}
                aria-disabled={t.key === 'tax' && TAX_FEATURE_LOCKED ? 'true' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 0,
                  borderBottom: active ? '2px solid #3FBF8F' : '2px solid transparent',
                  color: active ? '#3FBF8F' : '#8A93A3',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  cursor: t.key === 'tax' && TAX_FEATURE_LOCKED ? 'not-allowed' : 'pointer',
                  opacity: t.key === 'tax' && TAX_FEATURE_LOCKED ? 0.62 : 1,
                  transition: 'all 150ms ease',
                }}
              >
                {t.key === 'tax' && TAX_FEATURE_LOCKED ? <LockKeyhole size={15} /> : t.icon}
                <span>{t.label}</span>
                {t.key === 'tax' && TAX_FEATURE_LOCKED && <span style={{ fontSize: '10px' }}>Belum tersedia</span>}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* FIX FIN-03 (8 Sep 2026) -- disclaimer jujur, tampil sebelum user isi form */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '10px 13px', borderRadius: '10px', background: 'rgba(242,168,59,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)' }}>
            <span style={{ fontSize: '13px', flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: '11.5px', lineHeight: 1.5, color: '#C9A66B' }}>{honestDisclaimerByTab[activeTab]}</span>
          </div>
          {/* TAB 1: BUKU KAS */}
          {activeTab === 'cashflow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                    Target Cadangan Kas Darurat (Emergency Reserve)
                  </label>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#3FBF8F', fontWeight: 600 }}>
                    {emergencyReserveMonths} Bulan Biaya Operasional
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="12"
                  step="1"
                  value={emergencyReserveMonths}
                  onChange={(e) => setEmergencyReserveMonths(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3FBF8F' }}
                />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: '#8A93A3' }}>
                  Sistem menandai kas likuid "Aman" jika dapat menutupi burn rate selama periode target ini.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                    Klasifikasi Beban Baru Default
                  </label>
                  <select
                    value={defaultExpenseType}
                    onChange={(e) => setDefaultExpenseType(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="OPEX">OpEx (Operasional Rutin)</option>
                    <option value="CAPEX">CapEx (Belanja Modal / Aset)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                    Format Tampilan Angka Keuangan
                  </label>
                  <select
                    value={currencyDisplayFormat}
                    onChange={(e) => setCurrencyDisplayFormat(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="full">Rupiah Penuh (Rp 25.500.000)</option>
                    <option value="compact">Ringkas (Rp 25,5 jt / Rp 1,2 M)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAJAK & TAX */}
          {activeTab === 'tax' && TAX_FEATURE_LOCKED && (
            <TaxFeatureLock />
          )}
          {activeTab === 'tax' && !TAX_FEATURE_LOCKED && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '8px' }}>
                  Skema Pajak Penghasilan (PPh) Aktif
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setTaxScheme('UMKM_05')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: taxScheme === 'UMKM_05' ? 'rgba(63,191,143,0.16)' : '#10141C',
                      border: 0,
                      boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: taxScheme === 'UMKM_05' ? '#3FBF8F' : '#F5F7FA' }}>
                      PPh Final UMKM 0,5%
                    </span>
                    <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#8A93A3', lineHeight: 1.4 }}>
                      Sesuai PP 55/2022 untuk omset bruto di bawah Rp 4,8 Miliar per tahun.
                    </span>
                  </div>

                  <div
                    onClick={() => setTaxScheme('CORPORATE_22')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: taxScheme === 'CORPORATE_22' ? 'rgba(63,191,143,0.16)' : '#10141C',
                      border: 0,
                      boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: taxScheme === 'CORPORATE_22' ? '#3FBF8F' : '#F5F7FA' }}>
                      PPh Badan Tarif Normal 22%
                    </span>
                    <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#8A93A3', lineHeight: 1.4 }}>
                      Dihitung berdasarkan Penghasilan Kena Pajak (Laba Bersih Fiskal).
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                    Tarif PPN (Pajak Pertambahan Nilai)
                  </label>
                  <select
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value={11}>11% (Tarif Standar Saat Ini)</option>
                    <option value={12}>12% (Kenaikan Tarif Bertahap)</option>
                    <option value={0}>0% (Non-PKP / Bebas PPN)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '18px' }}>
                    <input
                      type="checkbox"
                      checked={taxReminderEnabled}
                      onChange={(e) => setTaxReminderEnabled(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#3FBF8F' }}
                    />
                    <span style={{ fontSize: '12.5px', color: '#F5F7FA' }}>
                      Peringatan Jatuh Tempo Pajak (Tgl 10 &amp; 15)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVOICE & PIUTANG */}
          {activeTab === 'invoices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Tenggat Pembayaran Standar Invoice Baru
                </label>
                <select
                  value={defaultPaymentTermsDays}
                  onChange={(e) => setDefaultPaymentTermsDays(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value={7}>Net 7 Hari</option>
                  <option value={14}>Net 14 Hari (Standar)</option>
                  <option value={30}>Net 30 Hari</option>
                  <option value={45}>Net 45 Hari</option>
                </select>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 14px -4px rgba(0,0,0,0.35)' }}>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#F5F7FA', marginBottom: '6px' }}>
                  Jadwal Otomasi Pengingat Faktur Klien (Reminder)
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px', color: '#C6CEDA' }}>
                    <input
                      type="checkbox"
                      checked={autoReminderHMinus3}
                      onChange={(e) => setAutoReminderHMinus3(e.target.checked)}
                      style={{ accentColor: '#3FBF8F' }}
                    />
                    <span>Kirim draf reminder H-3 sebelum invoice jatuh tempo</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px', color: '#C6CEDA' }}>
                    <input
                      type="checkbox"
                      checked={autoReminderDueDay}
                      onChange={(e) => setAutoReminderDueDay(e.target.checked)}
                      style={{ accentColor: '#3FBF8F' }}
                    />
                    <span>Kirim konfirmasi pembayaran pada Hari H jatuh tempo</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px', color: '#C6CEDA' }}>
                    <input
                      type="checkbox"
                      checked={autoReminderHPlus3}
                      onChange={(e) => setAutoReminderHPlus3(e.target.checked)}
                      style={{ accentColor: '#3FBF8F' }}
                    />
                    <span>Kirim peringatan penagihan tegas H+3 jika belum lunas</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Nada Template Surat Penagihan
                </label>
                <select
                  value={reminderTone}
                  onChange={(e) => setReminderTone(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="polite">Sopan Santun &amp; Menghargai Kerjasama</option>
                  <option value="assertive">Tegas Profesional &amp; Meminta Konfirmasi Tanggal (Rekomendasi)</option>
                  <option value="legal">Pemberitahuan Resmi Berlandaskan Kontrak Kerjasama</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 4: LAPORAN & BANK */}
          {activeTab === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Parser Rekening Koran Bank Otomatis
                </label>
                <select
                  value={defaultBankParser}
                  onChange={(e) => setDefaultBankParser(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="BCA">Bank Central Asia (BCA KlikBisnis / e-Statement)</option>
                  <option value="MANDIRI">Bank Mandiri (Kopra / MCM)</option>
                  <option value="BNI">Bank Negara Indonesia (BNI Direct)</option>
                  <option value="BRI">Bank Rakyat Indonesia (Cash Management)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#98A2B3', marginBottom: '6px' }}>
                  Label Penandatangan Dokumen Ekspor Laporan
                </label>
                <input
                  type="text"
                  value={signOffTitle}
                  onChange={(e) => setSignOffTitle(e.target.value)}
                  placeholder="Contoh: Finance Controller - PT Anitech Digital Solusindo"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', color: '#F5F7FA', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: '#8A93A3' }}>
                  Teks ini dicantumkan pada footer dokumen PDF audit dan ekspor Excel resmi.
                </span>
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
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px', background: '#3FBF8F', border: 0, color: '#080B10', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
            >
              <Save size={14} />
              <span>Simpan Pengaturan Finance</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinanceSettingsModal;

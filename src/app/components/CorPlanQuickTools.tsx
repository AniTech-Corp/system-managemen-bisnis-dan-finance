'use client';

import { useState } from 'react';
import { Calculator, Landmark, AlertTriangle } from 'lucide-react';
// Import langsung dari modul kalkulasinya (BUKAN barrel '@/lib/ai-brain') supaya
// bundle client tidak ikut menyeret modul server-only lain yang di-export barrel
// yang sama (mis. context-engine.ts yang bicara ke Prisma). calculateHPP() dan
// calculateKUR() sendiri murni fungsi matematika tanpa dependency server --
// dipakai persis sama seperti yang dipanggil brain/chat/route.ts, supaya widget
// ini dan AI chat SELALU menghasilkan angka yang identik.
import { calculateHPP } from '@/lib/ai-brain/hpp-calculator';
import { calculateKUR } from '@/lib/ai-brain/kur-calculator';

type ToolTab = 'hpp' | 'kur';

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const TAB_BTN = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  padding: '8px 13px',
  borderRadius: '9px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: 0,
  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: active ? '#F5F7FA' : '#98A2B3',
});

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '36px',
  padding: '0 12px',
  background: '#10141C',
  border: 0,
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
  borderRadius: '9px',
  color: '#F5F7FA',
  fontSize: '12.5px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: '#98A2B3',
  marginBottom: '5px',
};

function ResultRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span style={{ display: 'flex', justifyContent: 'space-between', color: '#98A2B3', fontSize: '11.5px' }}>
      {label}
      <span style={{ color: tone || '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </span>
  );
}

function AIDisclaimer({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '11px 13px', borderRadius: '9px', background: 'rgba(239,68,68,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)' }}>
      <AlertTriangle size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ fontSize: '11px', lineHeight: 1.5, color: '#F5B8B8' }}>{text}</span>
    </div>
  );
}

/**
 * CorPlanQuickTools -- kalkulator HPP + simulasi KUR langsung di dashboard, tanpa
 * perlu buka AI chat dulu. Logic kalkulasinya SAMA PERSIS dengan yang dipakai
 * brain/chat/route.ts (calculateHPP/calculateKUR di lib/ai-brain) -- dua entry
 * point (widget ini + chat AI), satu sumber kebenaran matematika, jadi angkanya
 * tidak pernah beda-beda antara keduanya.
 */
export default function CorPlanQuickTools() {
  const [tab, setTab] = useState<ToolTab>('hpp');

  // --- Tab 1: Kalkulator HPP ---
  const [rawMaterialCost, setRawMaterialCost] = useState<number | ''>('');
  const [laborCost, setLaborCost] = useState<number | ''>('');
  const [overheadCost, setOverheadCost] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [monthlyVolume, setMonthlyVolume] = useState<number | ''>('');

  const hppResult = calculateHPP({
    rawMaterialCost: Number(rawMaterialCost) || 0,
    laborCost: Number(laborCost) || 0,
    overheadCost: Number(overheadCost) || 0,
    sellingPrice: Number(sellingPrice) || 0,
    monthlyVolume: monthlyVolume === '' ? 1 : Number(monthlyVolume),
  });
  const hppHasInput = rawMaterialCost !== '' || laborCost !== '' || overheadCost !== '' || sellingPrice !== '';

  // --- Tab 2: Simulasi KUR ---
  const [loanAmount, setLoanAmount] = useState<number | ''>(100000000);
  const [tenorMonths, setTenorMonths] = useState<number | ''>(24);
  const [annualInterestRate, setAnnualInterestRate] = useState<number | ''>(6);

  const kurResult = calculateKUR({
    loanAmount: Number(loanAmount) || 0,
    tenorMonths: tenorMonths === '' ? 1 : Number(tenorMonths),
    annualInterestRate: annualInterestRate === '' ? 6 : Number(annualInterestRate),
  });

  return (
    <div style={{ gridColumn: '1 / -1', marginTop: '18px', borderTop: 0, paddingTop: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
            Alat cepat CorPlan
          </h4>
          <span style={{ fontSize: '11px', color: '#7C8698' }}>Kalkulator HPP dan simulasi KUR, langsung di sini tanpa buka chat AI</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTab('hpp')} style={TAB_BTN(tab === 'hpp')}>
            <Calculator size={13} /> Kalkulator HPP
          </button>
          <button type="button" onClick={() => setTab('kur')} style={TAB_BTN(tab === 'kur')}>
            <Landmark size={13} /> Simulasi KUR
          </button>
        </div>
      </div>

      {tab === 'hpp' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Biaya bahan baku / unit (Rp)</label>
                <input style={INPUT_STYLE} type="number" min={0} value={rawMaterialCost} onChange={(e) => setRawMaterialCost(e.target.value === '' ? '' : Number(e.target.value))} placeholder="5000" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Biaya tenaga kerja / unit (Rp)</label>
                <input style={INPUT_STYLE} type="number" min={0} value={laborCost} onChange={(e) => setLaborCost(e.target.value === '' ? '' : Number(e.target.value))} placeholder="2000" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Biaya overhead / unit (Rp)</label>
                <input style={INPUT_STYLE} type="number" min={0} value={overheadCost} onChange={(e) => setOverheadCost(e.target.value === '' ? '' : Number(e.target.value))} placeholder="1000" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Harga jual / unit (Rp)</label>
                <input style={INPUT_STYLE} type="number" min={0} value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="15000" />
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>Perkiraan volume jual / bulan (unit)</label>
              <input style={INPUT_STYLE} type="number" min={1} value={monthlyVolume} onChange={(e) => setMonthlyVolume(e.target.value === '' ? '' : Number(e.target.value))} placeholder="100" />
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {hppHasInput ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: 0 }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Hasil Kalkulasi HPP</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <ResultRow label="Total HPP per unit" value={rp(hppResult.totalHPPPerUnit)} />
                  <ResultRow label="Harga jual per unit" value={rp(hppResult.sellingPrice)} />
                  <ResultRow
                    label={`Laba kotor per unit (margin ${hppResult.marginPercentage.toFixed(1)}%)`}
                    value={rp(hppResult.grossProfitPerUnit)}
                    tone={hppResult.grossProfitPerUnit >= 0 ? '#3FBF8F' : '#EF4444'}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: 0 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>Laba kotor / bulan</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: hppResult.totalMonthlyGrossProfit >= 0 ? '#3FBF8F' : '#EF4444', fontFamily: "'JetBrains Mono', monospace" }}>
                    {rp(hppResult.totalMonthlyGrossProfit)}
                  </span>
                </div>
                {hppResult.grossProfitPerUnit <= 0 && (
                  <AIDisclaimer text="Harga jual saat ini belum menutup biaya produksi. Pertimbangkan menaikkan harga jual atau mengefisienkan biaya." />
                )}
              </>
            ) : (
              <div style={{ flex: 1, minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <span style={{ fontSize: '11.5px', color: '#7C8698' }}>Isi form di kiri untuk lihat hasil kalkulasi HPP</span>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'kur' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={LABEL_STYLE}>Jumlah pinjaman (Rp)</label>
              <input style={INPUT_STYLE} type="number" min={0} value={loanAmount} onChange={(e) => setLoanAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="100000000" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Tenor (bulan)</label>
                <input style={INPUT_STYLE} type="number" min={1} value={tenorMonths} onChange={(e) => setTenorMonths(e.target.value === '' ? '' : Number(e.target.value))} placeholder="24" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Bunga per tahun (%)</label>
                <input style={INPUT_STYLE} type="number" min={0} step={0.1} value={annualInterestRate} onChange={(e) => setAnnualInterestRate(e.target.value === '' ? '' : Number(e.target.value))} placeholder="6" />
              </div>
            </div>
            <span style={{ fontSize: '10.5px', color: '#7C8698', lineHeight: 1.5 }}>Default 6%/tahun = skema bunga flat subsidi KUR pemerintah. Ubah kalau lembaga penyalur Anda beda.</span>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: 0 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Hasil Simulasi KUR</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <ResultRow label="Pokok per bulan" value={rp(kurResult.monthlyPrincipal)} />
              <ResultRow label="Bunga per bulan" value={rp(kurResult.monthlyInterest)} />
              <ResultRow label="Total bunga selama tenor" value={rp(kurResult.totalInterest)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>Cicilan per bulan</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#4E9BFF', fontFamily: "'JetBrains Mono', monospace" }}>
                {rp(kurResult.monthlyInstallment)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: '#98A2B3' }}>Total dibayar (pokok + bunga)</span>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>{rp(kurResult.totalRepayment)}</span>
            </div>
            <AIDisclaimer text="Simulasi indikatif berdasarkan bunga flat. Angka final (termasuk biaya provisi/asuransi bila ada) tetap ditentukan bank/lembaga penyalur KUR saat pengajuan." />
          </div>
        </div>
      )}
    </div>
  );
}

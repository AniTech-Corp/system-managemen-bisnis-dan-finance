'use client';

import { useState } from 'react';
import { Wallet, TrendingUp, ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  computeTaskCompletionStats,
  computeAttendanceStats,
  combinePromotionScore,
  buildPromotionTier,
  categoryHasAutoData,
  buildDisciplineTier,
  type TaskCompletionStats,
  type AttendanceStats,
  type PromotionScoreSource,
} from '@/lib/hr-advisor-transform';

type FetchState = 'idle' | 'loading' | 'loaded' | 'error';

const ATTENDANCE_WINDOW_NOTE = 'dari 30 presensi terakhir se-workspace, bukan histori penuh';

type HRTab = 'payroll' | 'promotion' | 'discipline';

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

function AIDisclaimer({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '11px 13px', borderRadius: '9px', background: 'rgba(239,68,68,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)' }}>
      <AlertTriangle size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ fontSize: '11px', lineHeight: 1.5, color: '#F5B8B8' }}>{text}</span>
    </div>
  );
}

export default function HRAdvisorPanel() {
  const [tab, setTab] = useState<HRTab>('payroll');

  // --- Tab 1: Slip Gaji (logic dipertahankan persis sama seperti kalkulator
  // KerjaModule.tsx milik Fatur, cuma dipindah tempat, bukan dibangun ulang) ---
  const [payName, setPayName] = useState('');
  const [payBase, setPayBase] = useState<number | ''>('');
  const [payAllowance, setPayAllowance] = useState<number | ''>('');
  const [payOvertimeHours, setPayOvertimeHours] = useState<number | ''>('');
  const [payDeductions, setPayDeductions] = useState<number | ''>('');
  const baseSal = Number(payBase) || 0;
  const allow = Number(payAllowance) || 0;
  const otHours = Number(payOvertimeHours) || 0;
  const otPay = otHours * 25000;
  const deduct = Number(payDeductions) || 0;
  const netSalary = Math.max(0, baseSal + allow + otPay - deduct);

  // --- Tab 2: Rekomendasi Promosi ---
  // Skor kinerja SEKARANG ditarik dari data ASLI backend kerja/* (tugas +
  // presensi per nama karyawan), bukan lagi 3 angka "skor tahun ke-1/2/3"
  // yang diketik manual -- datanya memang tidak pernah ada di sistem
  // (tidak ada model histori skor tahunan di schema.prisma). Kalau
  // belum ada data tugas/presensi utk nama ybs, fallback ke 1 skor manual
  // (jujur soal sumbernya, lihat hr-advisor-transform.ts).
  const [promoName, setPromoName] = useState('');
  const [promoTenureYears, setPromoTenureYears] = useState<number | ''>('');
  const [promoManualScore, setPromoManualScore] = useState<number | ''>('');
  const [promoFetchState, setPromoFetchState] = useState<FetchState>('idle');
  const [promoFetchError, setPromoFetchError] = useState('');
  const [promoTaskStats, setPromoTaskStats] = useState<TaskCompletionStats | null>(null);
  const [promoAttendanceStats, setPromoAttendanceStats] = useState<AttendanceStats | null>(null);
  const [promoResult, setPromoResult] = useState<{ name: string; avgScore: number; source: PromotionScoreSource; tier: string; tierColor: string; note: string } | null>(null);

  const fetchPromotionData = async () => {
    const name = promoName.trim();
    if (!name) return;
    setPromoFetchState('loading');
    setPromoFetchError('');
    try {
      const [tasksRes, attRes] = await Promise.all([
        fetch('/api/v1/kerja/tasks', { credentials: 'include' }),
        fetch('/api/v1/kerja/attendance', { credentials: 'include' }),
      ]);
      if (!tasksRes.ok || !attRes.ok) {
        throw new Error('Gagal mengambil data tugas/presensi dari server.');
      }
      const tasksJson = await tasksRes.json();
      const attJson = await attRes.json();
      setPromoTaskStats(computeTaskCompletionStats(tasksJson.allTasks || [], name));
      setPromoAttendanceStats(computeAttendanceStats(attJson.records || [], name));
      setPromoFetchState('loaded');
    } catch (err: any) {
      setPromoFetchState('error');
      setPromoFetchError(err?.message || 'Gagal mengambil data dari server.');
    }
  };

  const runPromotionCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoName.trim()) return;
    const manual = promoManualScore === '' ? null : Number(promoManualScore);
    const { avgScore, source } = combinePromotionScore(promoTaskStats, promoAttendanceStats, manual);
    const tenure = Number(promoTenureYears) || 0;
    const { tier, tierColor, note } = buildPromotionTier(avgScore, tenure, source);
    setPromoResult({ name: promoName.trim(), avgScore, source, tier, tierColor, note });
  };

  // --- Tab 3: Rekomendasi Tindak Lanjut Disiplin ---
  const DISCIPLINE_CATEGORIES = [
    'Keterlambatan berulang',
    'Ketidakhadiran tanpa keterangan',
    'Pelanggaran prosedur / SOP kerja',
    'Perilaku tidak profesional',
    'Lainnya',
  ];
  const [discName, setDiscName] = useState('');
  const [discCategory, setDiscCategory] = useState(DISCIPLINE_CATEGORIES[0]);
  const [discPriorIncidents, setDiscPriorIncidents] = useState<number | ''>('');
  const [discDescription, setDiscDescription] = useState('');
  const [discFetchState, setDiscFetchState] = useState<FetchState>('idle');
  const [discFetchError, setDiscFetchError] = useState('');
  const [discAttendanceStats, setDiscAttendanceStats] = useState<AttendanceStats | null>(null);
  const [discResult, setDiscResult] = useState<{ name: string; tier: string; tierColor: string; steps: string[] } | null>(null);

  // Cuma kategori "Keterlambatan berulang" yang punya sumber data otomatis
  // (dari AttendanceRecord.status TERLAMBAT). Kategori lain belum ada model
  // pencatatan pelanggaran di schema.prisma -- tetap input manual, jujur.
  const discCategoryHasAutoData = categoryHasAutoData(discCategory);

  const fetchDisciplineAttendance = async () => {
    const name = discName.trim();
    if (!name) return;
    setDiscFetchState('loading');
    setDiscFetchError('');
    try {
      const res = await fetch('/api/v1/kerja/attendance', { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal mengambil data presensi dari server.');
      const json = await res.json();
      const stats = computeAttendanceStats(json.records || [], name);
      setDiscAttendanceStats(stats);
      if (stats.totalRecords > 0) {
        setDiscPriorIncidents(stats.lateCount);
      }
      setDiscFetchState('loaded');
    } catch (err: any) {
      setDiscFetchState('error');
      setDiscFetchError(err?.message || 'Gagal mengambil data dari server.');
    }
  };

  const runDisciplineCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discName.trim() || !discDescription.trim()) return;
    const prior = Number(discPriorIncidents) || 0;
    const autoSourceNote =
      discCategoryHasAutoData && discAttendanceStats && discAttendanceStats.totalRecords > 0
        ? `data presensi sistem, ${ATTENDANCE_WINDOW_NOTE}`
        : null;
    const { tier, tierColor, steps } = buildDisciplineTier(prior, autoSourceNote);
    setDiscResult({ name: discName.trim(), tier, tierColor, steps });
  };

  return (
    <div style={{ marginTop: '18px', borderTop: 0, paddingTop: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
            Alat bantu manajemen SDM
          </h4>
          <span style={{ fontSize: '11px', color: '#7C8698' }}>Slip gaji, rekomendasi promosi, dan rekomendasi tindak lanjut disiplin</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTab('payroll')} style={TAB_BTN(tab === 'payroll')}>
            <Wallet size={13} /> Slip gaji
          </button>
          <button type="button" onClick={() => setTab('promotion')} style={TAB_BTN(tab === 'promotion')}>
            <TrendingUp size={13} /> Rekomendasi promosi
          </button>
          <button type="button" onClick={() => setTab('discipline')} style={TAB_BTN(tab === 'discipline')}>
            <ShieldAlert size={13} /> Rekomendasi disiplin
          </button>
        </div>
      </div>

      {tab === 'payroll' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={LABEL_STYLE}>Nama karyawan</label>
              <input style={INPUT_STYLE} type="text" value={payName} onChange={(e) => setPayName(e.target.value)} placeholder="mis. Budi Santoso" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Gaji pokok (Rp)</label>
                <input style={INPUT_STYLE} type="number" value={payBase} onChange={(e) => setPayBase(e.target.value === '' ? '' : Number(e.target.value))} placeholder="3500000" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Tunjangan (Rp)</label>
                <input style={INPUT_STYLE} type="number" value={payAllowance} onChange={(e) => setPayAllowance(e.target.value === '' ? '' : Number(e.target.value))} placeholder="500000" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Jam lembur</label>
                <input style={INPUT_STYLE} type="number" value={payOvertimeHours} onChange={(e) => setPayOvertimeHours(e.target.value === '' ? '' : Number(e.target.value))} placeholder="10" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Potongan / kasbon (Rp)</label>
                <input style={INPUT_STYLE} type="number" value={payDeductions} onChange={(e) => setPayDeductions(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{payName || 'Nama karyawan'}</span>
              <span style={{ fontSize: '10px', color: '#4E9BFF', fontWeight: 600 }}>SLIP GAJI</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', color: '#98A2B3' }}>Gaji pokok <span style={{ color: '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>Rp {baseSal.toLocaleString('id-ID')}</span></span>
              <span style={{ display: 'flex', justifyContent: 'space-between', color: '#98A2B3' }}>Tunjangan <span style={{ color: '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>Rp {allow.toLocaleString('id-ID')}</span></span>
              <span style={{ display: 'flex', justifyContent: 'space-between', color: '#98A2B3' }}>Lembur ({otHours} jam) <span style={{ color: '#3FBF8F', fontFamily: "'JetBrains Mono', monospace" }}>Rp {otPay.toLocaleString('id-ID')}</span></span>
              <span style={{ display: 'flex', justifyContent: 'space-between', color: '#98A2B3' }}>Potongan <span style={{ color: '#EF4444', fontFamily: "'JetBrains Mono', monospace" }}>-Rp {deduct.toLocaleString('id-ID')}</span></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>Gaji bersih</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#4E9BFF', fontFamily: "'JetBrains Mono', monospace" }}>Rp {netSalary.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'promotion' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
          <form onSubmit={runPromotionCheck} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={LABEL_STYLE}>Nama karyawan</label>
              <input style={INPUT_STYLE} type="text" required value={promoName} onChange={(e) => setPromoName(e.target.value)} placeholder="mis. Siti Aminah" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Lama bekerja (tahun)</label>
              <input style={INPUT_STYLE} type="number" min={0} value={promoTenureYears} onChange={(e) => setPromoTenureYears(e.target.value === '' ? '' : Number(e.target.value))} placeholder="2" />
            </div>
            <div style={{ padding: '11px 12px', borderRadius: '9px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#98A2B3' }}>Data kinerja dari sistem (tugas + presensi)</span>
                <button
                  type="button"
                  onClick={fetchPromotionData}
                  disabled={!promoName.trim() || promoFetchState === 'loading'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: 0, background: 'rgba(78,155,255,0.15)', color: '#4E9BFF', fontFamily: 'inherit', fontSize: '10.5px', fontWeight: 600, cursor: promoName.trim() ? 'pointer' : 'not-allowed', opacity: promoName.trim() ? 1 : 0.5 }}
                >
                  <RefreshCw size={11} /> {promoFetchState === 'loading' ? 'Mengambil...' : 'Ambil data'}
                </button>
              </div>
              {promoFetchState === 'error' && (
                <span style={{ fontSize: '10.5px', color: '#EF4444' }}>{promoFetchError}</span>
              )}
              {promoFetchState === 'loaded' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10.5px', color: '#CBD3DF' }}>
                  <span>
                    Tugas: {promoTaskStats && promoTaskStats.totalAssigned > 0
                      ? `${promoTaskStats.doneCount}/${promoTaskStats.totalAssigned} selesai (${promoTaskStats.completionRate}%)`
                      : 'belum ada tugas tercatat untuk nama ini'}
                  </span>
                  <span>
                    Presensi: {promoAttendanceStats && promoAttendanceStats.totalRecords > 0
                      ? `${promoAttendanceStats.onTimeCount}/${promoAttendanceStats.totalRecords} tepat waktu (${promoAttendanceStats.punctualityRate}%, ${ATTENDANCE_WINDOW_NOTE})`
                      : 'belum ada presensi tercatat untuk nama ini'}
                  </span>
                </div>
              )}
              <div>
                <label style={LABEL_STYLE}>Skor manual (opsional -- dipakai HANYA kalau data sistem di atas kosong)</label>
                <input style={INPUT_STYLE} type="number" min={0} max={100} value={promoManualScore} onChange={(e) => setPromoManualScore(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0-100" />
              </div>
            </div>
            <button type="submit" style={{ marginTop: '2px', height: '36px', borderRadius: '9px', background: '#3FBF8F', border: 0, color: '#06080C', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Cek rekomendasi
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {promoResult ? (
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{promoResult.name}</span>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: promoResult.tierColor }}>{promoResult.avgScore}/100 ({promoResult.source === 'real' ? 'data sistem' : promoResult.source === 'manual' ? 'skor manual' : 'tanpa data'})</span>
                </div>
                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: `${promoResult.tierColor}1F`, color: promoResult.tierColor }}>
                  {promoResult.tier}
                </span>
                <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: '#CBD3DF' }}>{promoResult.note}</p>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.015)' }}>
                <span style={{ fontSize: '11.5px', color: '#7C8698', textAlign: 'center' }}>Isi form di kiri untuk lihat rekomendasi</span>
              </div>
            )}
            <AIDisclaimer text="Ini rekomendasi otomatis berdasarkan angka yang diinput, bukan keputusan final. Tetap perlu review kualitatif dari manajer/HR sebelum promosi diputuskan." />
          </div>
        </div>
      )}

      {tab === 'discipline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
          <form onSubmit={runDisciplineCheck} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={LABEL_STYLE}>Nama karyawan</label>
              <input style={INPUT_STYLE} type="text" required value={discName} onChange={(e) => setDiscName(e.target.value)} placeholder="mis. Andi Wijaya" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Kategori pelanggaran</label>
              <select style={INPUT_STYLE} value={discCategory} onChange={(e) => setDiscCategory(e.target.value)}>
                {DISCIPLINE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Jumlah kejadian serupa sebelumnya</label>
              <input style={INPUT_STYLE} type="number" min={0} value={discPriorIncidents} onChange={(e) => setDiscPriorIncidents(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              {discCategoryHasAutoData ? (
                <div style={{ marginTop: '7px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <button
                    type="button"
                    onClick={fetchDisciplineAttendance}
                    disabled={!discName.trim() || discFetchState === 'loading'}
                    style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: 0, background: 'rgba(78,155,255,0.15)', color: '#4E9BFF', fontFamily: 'inherit', fontSize: '10.5px', fontWeight: 600, cursor: discName.trim() ? 'pointer' : 'not-allowed', opacity: discName.trim() ? 1 : 0.5 }}
                  >
                    <RefreshCw size={11} /> {discFetchState === 'loading' ? 'Mengambil...' : 'Cek riwayat keterlambatan'}
                  </button>
                  {discFetchState === 'error' && <span style={{ fontSize: '10.5px', color: '#EF4444' }}>{discFetchError}</span>}
                  {discFetchState === 'loaded' && (
                    <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>
                      {discAttendanceStats && discAttendanceStats.totalRecords > 0
                        ? `${discAttendanceStats.lateCount} kali keterlambatan tercatat (${ATTENDANCE_WINDOW_NOTE}) -- angka di atas sudah diisi otomatis, boleh disesuaikan.`
                        : 'Belum ada presensi tercatat untuk nama ini -- isi manual di atas.'}
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ display: 'block', marginTop: '7px', fontSize: '10.5px', color: '#7C8698' }}>
                  Kategori ini belum ada sumber data otomatis di sistem (belum ada modul pencatatan pelanggaran) -- isi berdasarkan catatan HR manual.
                </span>
              )}
            </div>
            <div>
              <label style={LABEL_STYLE}>Deskripsi singkat kejadian</label>
              <textarea
                required
                rows={3}
                value={discDescription}
                onChange={(e) => setDiscDescription(e.target.value)}
                placeholder="Jelaskan kejadian secara singkat dan faktual..."
                style={{ ...INPUT_STYLE, height: 'auto', padding: '9px 12px', resize: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <button type="submit" style={{ marginTop: '2px', height: '36px', borderRadius: '9px', background: '#D8A33C', border: 0, color: '#06080C', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Buat draf rekomendasi
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {discResult ? (
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{discResult.name}</span>
                </div>
                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: `${discResult.tierColor}1F`, color: discResult.tierColor }}>
                  Saran tingkat: {discResult.tier}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {discResult.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '99px', background: discResult.tierColor, flexShrink: 0, marginTop: '6px' }} />
                      <span style={{ fontSize: '11.5px', lineHeight: 1.5, color: '#CBD3DF' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.015)' }}>
                <span style={{ fontSize: '11.5px', color: '#7C8698', textAlign: 'center' }}>Isi form di kiri untuk lihat draf rekomendasi</span>
              </div>
            )}
            <AIDisclaimer text="Ini draf rekomendasi umum berdasarkan kategori & riwayat kejadian, BUKAN nasihat hukum atau keputusan resmi. Sesuaikan dengan pasal peraturan perusahaan dan ketentuan ketenagakerjaan yang berlaku, dan WAJIB direview HR/manajemen sebelum diterapkan ke karyawan manapun." />
          </div>
        </div>
      )}
    </div>
  );
}

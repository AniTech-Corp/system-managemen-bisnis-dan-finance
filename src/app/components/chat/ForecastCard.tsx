'use client';

// RISET WEB + PREDIKSI FORECAST + LOKASI (8 Sep 2026, wave B5-chat-wiring-ui) --
// kartu presentasi murni untuk data.forecast (brain/chat + POST /api/v1/brain/
// forecast, field milik B2). KOMPONEN INI TIDAK PERNAH menghitung ulang forecast
// sendiri -- murni render `data: BlendedForecastResult` dan (opsional) meneruskan
// input tambahan pengguna lewat `onRefine`, parent (3x *AIAssistantView.tsx) yang
// urus fetch ulang ke endpoint.
//
// WAJIB (HASIL KRITIK "bantah" P1#4, dipatuhi eksplisit): externalSignalsUsed
// (label/effectPct/confidence/source) DIRENDER SELALU, bukan opsional -- supaya
// angka pada tabel tidak tampil "polos" seolah pasti padahal sebagian berasal
// dari tebakan regex atas teks riset (confidence low/medium, TIDAK PERNAH high).
//
// Kalimat assumptions[] yang diawali "PERHATIAN:" (konvensi B2 -- lihat
// kontrak_untuk_agent_lain laporan B2, deteksi konflik arah tren internal vs
// riset publik, permintaan verbatim Mecca "kadang data publik enggak sesuai
// data privat") DIRENDER sebagai badge terpisah, BUKAN assumption biasa.
import { useState } from 'react';
import { TrendingUp, AlertTriangle, Info, Plus } from 'lucide-react';
import type { BlendedForecastResult, ForecastExtraData } from '@/lib/research-types';

export interface ForecastCardProps {
  data: BlendedForecastResult;
  onRefine?: (extraData: ForecastExtraData) => void;
}

/** Diekspor supaya dites langsung tanpa render React -- lihat tests/chat-cards-b5.test.ts. */
export function formatRupiah(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}Rp ${abs.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'keyakinan rendah',
  medium: 'keyakinan sedang',
};

/** Bentuk ForecastExtraData dari 5 field form "Tambah data saya" -- MURNI, dites
 * langsung tanpa render React. Field kosong/tidak valid diabaikan (tidak error),
 * sama seperti perilaku form di dalam ForecastCard. Cermin batas zod di
 * brain/forecast/route.ts (priceChangePct/costChangePct akan ditolak server
 * kalau di luar -100..500, notes dipotong 500 karakter di sini duluan supaya
 * form tidak diam-diam kirim string lebih panjang dari yang ditampilkan). */
export function buildForecastExtraData(input: {
  targetRevenue: string;
  priceChangePct: string;
  newBranch: boolean;
  costChangePct: string;
  notes: string;
}): ForecastExtraData {
  const extraData: ForecastExtraData = {};
  const rev = Number(input.targetRevenue);
  if (input.targetRevenue.trim() && isFinite(rev) && rev > 0) extraData.targetRevenue = rev;
  const price = Number(input.priceChangePct);
  if (input.priceChangePct.trim() && isFinite(price)) extraData.priceChangePct = price;
  if (input.newBranch) extraData.newBranch = true;
  const cost = Number(input.costChangePct);
  if (input.costChangePct.trim() && isFinite(cost)) extraData.costChangePct = cost;
  if (input.notes.trim()) extraData.notes = input.notes.trim().slice(0, 500);
  return extraData;
}

export default function ForecastCard({ data, onRefine }: ForecastCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [targetRevenue, setTargetRevenue] = useState('');
  const [priceChangePct, setPriceChangePct] = useState('');
  const [newBranch, setNewBranch] = useState(false);
  const [costChangePct, setCostChangePct] = useState('');
  const [notes, setNotes] = useState('');

  // Pisahkan kalimat "PERHATIAN: ..." (konflik tren internal vs publik) dari
  // asumsi biasa -- konvensi B2, lihat komentar kepala file.
  const attentionNotes = data.assumptions.filter((a) => a.startsWith('PERHATIAN:'));
  const regularAssumptions = data.assumptions.filter((a) => !a.startsWith('PERHATIAN:'));

  const submitRefine = () => {
    if (!onRefine) return;
    onRefine(buildForecastExtraData({ targetRevenue, priceChangePct, newBranch, costChangePct, notes }));
    setFormOpen(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '11px',
        padding: '13px 14px',
        border: 0,
        borderRadius: '13px',
        background: 'rgba(201,166,107,0.08)',
        boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)',
        maxWidth: '540px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TrendingUp size={15} color="#C9A66B" strokeWidth={1.9} style={{ flexShrink: 0 }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 700, color: '#C9A66B' }}>
          Prediksi {data.horizonMonths} bulan ke depan
        </span>
      </div>

      {!data.dataSufficiency.ok && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '8px 10px', borderRadius: '9px', background: 'rgba(216,163,60,0.14)', border: 0 }}>
          <AlertTriangle size={13} color="#D8A33C" strokeWidth={1.9} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '11px', color: '#D8A33C', lineHeight: 1.45 }}>
            Data historis belum cukup, hasil ini indikatif. {data.dataSufficiency.reason}
          </span>
        </div>
      )}

      {attentionNotes.map((a, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '8px 10px', borderRadius: '9px', background: 'rgba(239,68,68,0.12)', border: 0 }}>
          <AlertTriangle size={13} color="#EF4444" strokeWidth={1.9} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '11px', color: '#F5A3A3', lineHeight: 1.45 }}>{a.replace(/^PERHATIAN:\s*/, '')}</span>
        </div>
      ))}

      {/* Tabel per bulan: pesimis / dasar / optimis */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '360px' }}>
          <thead>
            <tr>
              {['Bulan', 'Pesimis', 'Dasar', 'Optimis'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === 'Bulan' ? 'left' : 'right',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#8A93A3',
                    padding: '4px 6px',
                    borderBottom: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.table.map((row) => (
              <tr key={row.month}>
                <td style={{ fontSize: '11px', color: '#C6CEDA', padding: '5px 6px', whiteSpace: 'nowrap' }}>{row.month}</td>
                <td style={{ fontSize: '11px', color: '#D8A33C', padding: '5px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRupiah(row.pessimistic)}</td>
                <td style={{ fontSize: '11px', color: '#F5F7FA', fontWeight: 600, padding: '5px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRupiah(row.baseline)}</td>
                <td style={{ fontSize: '11px', color: '#3FBF8F', padding: '5px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRupiah(row.optimistic)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {regularAssumptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#8A93A3', letterSpacing: '0.02em' }}>ASUMSI</span>
          <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {regularAssumptions.map((a, idx) => (
              <li key={idx} style={{ fontSize: '10.5px', color: '#8A93A3', lineHeight: 1.5 }}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* WAJIB (kritik P1#4): sinyal eksternal SELALU ditampilkan kalau ada, bukan
          disembunyikan -- badge low/medium confidence + sumber per sinyal. */}
      {data.externalSignalsUsed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#8A93A3', letterSpacing: '0.02em' }}>SINYAL DARI RISET PUBLIK (estimasi, bukan fakta pasti)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {data.externalSignalsUsed.map((sig, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '6px 9px', borderRadius: '8px', background: 'rgba(78,155,255,0.10)', border: 0 }}>
                <Info size={11} color="#4E9BFF" strokeWidth={1.9} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span style={{ fontSize: '10.5px', color: '#C6CEDA', lineHeight: 1.4 }}>
                    {sig.label} ({sig.effectPct > 0 ? '+' : ''}{sig.effectPct}%)
                  </span>
                  <span style={{ fontSize: '9.5px', color: '#5C6474' }}>
                    {CONFIDENCE_LABEL[sig.confidence] || sig.confidence} &middot; sumber: {sig.source}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {onRefine && (
        <div>
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 11px', border: 0, borderRadius: '9px', background: 'rgba(201,166,107,0.15)', color: '#C9A66B', fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={12} strokeWidth={2} />
              Tambah data saya
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: 0 }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#C6CEDA' }}>Data tambahan (opsional, isi yang relevan saja)</span>
              <input
                type="number"
                placeholder="Target omset (Rp)"
                value={targetRevenue}
                onChange={(e) => setTargetRevenue(e.target.value)}
                style={{ height: '30px', padding: '0 9px', borderRadius: '7px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11px' }}
              />
              <input
                type="number"
                placeholder="Perubahan harga jual (%, boleh minus)"
                value={priceChangePct}
                onChange={(e) => setPriceChangePct(e.target.value)}
                style={{ height: '30px', padding: '0 9px', borderRadius: '7px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11px' }}
              />
              <input
                type="number"
                placeholder="Perubahan biaya operasional (%, boleh minus)"
                value={costChangePct}
                onChange={(e) => setCostChangePct(e.target.value)}
                style={{ height: '30px', padding: '0 9px', borderRadius: '7px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11px' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: '#C6CEDA' }}>
                <input type="checkbox" checked={newBranch} onChange={(e) => setNewBranch(e.target.checked)} />
                Rencana buka cabang baru
              </label>
              <textarea
                placeholder="Catatan tambahan (maks 500 karakter)"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                rows={2}
                style={{ padding: '7px 9px', borderRadius: '7px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11px', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: '7px' }}>
                <button
                  type="button"
                  onClick={submitRefine}
                  style={{ padding: '7px 12px', borderRadius: '8px', background: '#0058BE', border: 0, color: '#FFFFFF', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Perbarui prediksi
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  style={{ padding: '7px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: 0, color: '#8A93A3', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

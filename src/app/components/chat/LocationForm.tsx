'use client';

// RISET WEB + PREDIKSI FORECAST + LOKASI (8 Sep 2026, wave B5-chat-wiring-ui) --
// form input analisis lokasi (nama bisnis/kategori/area/radius/tujuan) + render
// hasil POST /api/v1/brain/location (data milik B3, LocationAnalysisResult). Fetch
// SUNGGUHAN dilakukan PARENT (3x *AIAssistantView.tsx) lewat prop onSubmit --
// komponen ini sendiri tidak pernah panggil fetch.
//
// Bahasa UI awam (kritik "terlewat" RENDAH-SEDANG: badge lama "Google Maps belum
// dikonfigurasi" diganti kalimat manusia biasa) + 1 baris disclosure privasi
// (kritik "terlewat" SEDANG#4: nama usaha & lokasi dikirim ke internet/Google
// lewat riset web -- WAJIB diberitahu, bukan diam-diam).
import { useState } from 'react';
import { MapPin, AlertTriangle, Info } from 'lucide-react';
import type { LocationAnalysisInput, LocationAnalysisResult, LocationPurpose } from '@/lib/research-types';

export interface LocationFormProps {
  onSubmit: (input: LocationAnalysisInput) => void;
  result?: LocationAnalysisResult;
  pending?: boolean;
}

const VERDICT_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  cocok: { color: '#3FBF8F', bg: 'rgba(63,191,143,0.14)', label: 'Cocok' },
  'hati-hati': { color: '#D8A33C', bg: 'rgba(216,163,60,0.14)', label: 'Perlu hati-hati' },
  'kurang cocok': { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Kurang cocok' },
  'tidak cukup data': { color: '#8A93A3', bg: 'rgba(138,147,163,0.10)', label: 'Data belum cukup' },
};

/** true kalau 3 field wajib (nama usaha/kategori/area) sudah diisi -- MURNI,
 * dites langsung tanpa render React. Cermin syarat min(1) di zod schema
 * brain/location/route.ts (businessName/category/area). */
export function isLocationInputValid(input: { businessName: string; category: string; area: string }): boolean {
  return input.businessName.trim().length > 0 && input.category.trim().length > 0 && input.area.trim().length > 0;
}

/** Bentuk LocationAnalysisInput siap-kirim dari field form mentah -- MURNI, dites
 * langsung tanpa render React. Return null kalau field wajib belum lengkap
 * (pemanggil TIDAK boleh kirim ke server). radiusKm non-angka/<=0 -> undefined
 * (server pakai default 2, lihat research-types.ts). */
export function buildLocationInput(input: {
  businessName: string;
  category: string;
  area: string;
  radiusKm: string;
  purpose: LocationPurpose;
}): LocationAnalysisInput | null {
  if (!isLocationInputValid(input)) return null;
  const radius = Number(input.radiusKm);
  return {
    businessName: input.businessName.trim(),
    category: input.category.trim(),
    area: input.area.trim(),
    radiusKm: isFinite(radius) && radius > 0 ? radius : undefined,
    purpose: input.purpose,
  };
}

export default function LocationForm({ onSubmit, result, pending }: LocationFormProps) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [area, setArea] = useState('');
  const [radiusKm, setRadiusKm] = useState('2');
  const [purpose, setPurpose] = useState<LocationPurpose>('sekitar_kantor');
  const [touched, setTouched] = useState(false);

  const valid = isLocationInputValid({ businessName, category, area });

  const submit = () => {
    setTouched(true);
    const built = buildLocationInput({ businessName, category, area, radiusKm, purpose });
    if (!built) return;
    onSubmit(built);
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
        background: 'rgba(78,155,255,0.10)',
        boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)',
        maxWidth: '480px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MapPin size={15} color="#4E9BFF" strokeWidth={1.9} style={{ flexShrink: 0 }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 700, color: '#4E9BFF' }}>
          Analisis lokasi bisnis
        </span>
      </div>

      {!result && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <input
              type="text"
              placeholder="Nama usaha"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11.5px' }}
            />
            <input
              type="text"
              placeholder="Kategori usaha (mis. kedai kopi, laundry)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11.5px' }}
            />
            <input
              type="text"
              placeholder="Alamat / lokasi (bebas teks)"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={{ height: '32px', padding: '0 10px', borderRadius: '8px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11.5px' }}
            />
            <div style={{ display: 'flex', gap: '7px' }}>
              <input
                type="number"
                placeholder="Radius (km)"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                style={{ flex: 1, height: '32px', padding: '0 10px', borderRadius: '8px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11.5px' }}
              />
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as LocationPurpose)}
                style={{ flex: 1, height: '32px', padding: '0 8px', borderRadius: '8px', border: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', background: '#10141C', color: '#F5F7FA', fontSize: '11.5px' }}
              >
                <option value="sekitar_kantor">Cek sekitar lokasi saat ini</option>
                <option value="cabang_baru">Mau buka cabang baru</option>
              </select>
            </div>
            {touched && !valid && (
              <span style={{ fontSize: '10.5px', color: '#EF4444' }}>Nama usaha, kategori, dan lokasi wajib diisi.</span>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                height: '34px',
                borderRadius: '9px',
                background: pending ? '#5A6472' : '#0058BE',
                border: 0,
                color: '#FFFFFF',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '12px',
                fontWeight: 600,
                cursor: pending ? 'default' : 'pointer',
              }}
            >
              {pending ? 'Menganalisis...' : 'Analisis lokasi'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <Info size={11} color="#5C6474" strokeWidth={1.9} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '10px', color: '#5C6474', lineHeight: 1.45 }}>
              Nama usaha dan lokasi yang kamu masukkan akan dicari lewat internet untuk riset ini --
              jangan masukkan data pribadi yang tidak perlu.
            </span>
          </div>
        </>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {result.providerUsed === 'web' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '7px 9px', borderRadius: '8px', background: 'rgba(138,147,163,0.10)', border: 0 }}>
              <Info size={11} color="#8A93A3" strokeWidth={1.9} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '10.5px', color: '#8A93A3', lineHeight: 1.45 }}>
                Kami belum pakai Google Maps, jadi info di bawah ini dicari lewat internet dulu.
              </span>
            </div>
          )}

          {(() => {
            const style = VERDICT_STYLE[result.verdict] || VERDICT_STYLE['tidak cukup data'];
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 11px', borderRadius: '9px', background: style.bg, border: 0 }}>
                {result.verdict === 'kurang cocok' || result.verdict === 'tidak cukup data' ? (
                  <AlertTriangle size={13} color={style.color} strokeWidth={1.9} />
                ) : (
                  <MapPin size={13} color={style.color} strokeWidth={1.9} />
                )}
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: style.color }}>{style.label}</span>
              </div>
            );
          })()}

          {result.summary && <p style={{ margin: 0, fontSize: '11.5px', color: '#C6CEDA', lineHeight: 1.55 }}>{result.summary}</p>}

          {result.reasons.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {result.reasons.map((r, idx) => (
                <li key={idx} style={{ fontSize: '10.5px', color: '#8A93A3', lineHeight: 1.5 }}>{r}</li>
              ))}
            </ul>
          )}

          {result.competitors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#8A93A3', letterSpacing: '0.02em' }}>KOMPETITOR DI SEKITAR</span>
              <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {result.competitors.map((c, idx) => (
                  <li key={idx} style={{ fontSize: '10.5px', color: '#C6CEDA', lineHeight: 1.5 }}>
                    {c.name}
                    {c.category ? ` (${c.category})` : ''}
                    {c.note ? ` -- ${c.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.sources.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#8A93A3', letterSpacing: '0.02em' }}>SUMBER</span>
              {result.sources.map((s, idx) => (
                <a
                  key={`${s.url}-${idx}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '10.5px', color: '#8CBEFF', textDecoration: 'none' }}
                >
                  {s.title || s.url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { GLOSSARY, type GlossaryCategory } from './glossary-data';

const CATEGORY_ORDER: GlossaryCategory[] = ['Keuangan & Kas', 'Marketing & Iklan', 'Administrasi & Tim', 'Operasional & Rantai Pasok', 'Umum'];

const CATEGORY_COLOR: Record<GlossaryCategory, string> = {
  'Keuangan & Kas': '#3FBF8F',
  'Marketing & Iklan': '#D8A33C',
  'Administrasi & Tim': '#4E9BFF',
  'Operasional & Rantai Pasok': '#3FBF8F',
  Umum: '#4E9BFF',
};

export default function JargonGlossary() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.filter(
      (item) => item.term.toLowerCase().includes(q) || item.plain.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: filtered.filter((item) => item.category === cat),
    })).filter((group) => group.items.length > 0);
  }, [filtered]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka kamus istilah"
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-[#10141C]/95 px-4 py-2.5 text-[12.5px] font-medium text-[#C3CBD8] shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm transition hover:border-[#4E9BFF]/40 hover:text-[#F5F7FA]"
      >
        <BookOpen size={15} className="text-[#4E9BFF]" />
        Kamus istilah
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-fadeIn flex max-h-[82vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border-0 bg-[#0D1017] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-0 px-6 py-5">
              <div>
                <h2 className="text-[16px] font-semibold text-[#F5F7FA]">Kamus istilah KLIR</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-[#8A93A3]">
                  Istilah dashboard dan AI Assistant dijelaskan pakai bahasa sehari-hari.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup kamus istilah"
                className="shrink-0 rounded-lg p-1.5 text-[#8A93A3] transition hover:bg-white/5 hover:text-[#F5F7FA]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-0 px-6 py-3">
              <div className="flex items-center gap-2 rounded-lg border-0 bg-[#10141C] px-3 py-2">
                <Search size={14} className="text-[#8A93A3]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari istilah, misal: ROAS, runway, PPh..."
                  className="w-full bg-transparent text-[13px] text-[#F5F7FA] placeholder:text-[#5A6472] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {grouped.length === 0 && (
                <p className="py-8 text-center text-[12.5px] text-[#8A93A3]">
                  Istilah &quot;{query}&quot; belum ada di kamus ini.
                </p>
              )}

              {grouped.map((group) => (
                <div key={group.category} className="mb-5 last:mb-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: CATEGORY_COLOR[group.category] }}
                    />
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8A93A3]">
                      {group.category}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <div
                        key={item.term}
                        className="rounded-xl border-0 bg-white/[0.04] px-4 py-3"
                      >
                        <div className="text-[13px] font-semibold text-[#F5F7FA]">{item.term}</div>
                        <p className="mt-1 text-[12px] leading-relaxed text-[#A9B1BE]">{item.plain}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

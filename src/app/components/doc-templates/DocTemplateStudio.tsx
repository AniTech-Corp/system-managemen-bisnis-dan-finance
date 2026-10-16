'use client';

import { useEffect, useState } from 'react';
import type {
  DocTemplate,
  DocTemplateCategory,
  DocTemplateGenerateResult,
} from './types';
import {
  CATEGORY_OPTIONS,
  filterTemplates,
  validateGenerateInput,
  buildGenerateRequestBody,
  fetchDocTemplates,
  generateDocFromTemplate,
  DocTemplateApiError,
} from './doc-template-client';
import DocTemplateResult from './DocTemplateResult';
import { TONE_PRESETS } from '@/lib/tone-presets';
import styles from '../marketing-media/studio.module.css';

interface DocTemplateStudioProps {
  initialBrief?: string;
  onClose?: () => void;
  embedded?: boolean;
  /**
   * Role pengguna yang membuka studio ini (dioper oleh AI Assistant View).
   *
   * CATATAN JUJUR (temuan verifikasi, bukan asumsi): daftar template yang dirender di sini
   * (`templates`, dari GET /api/v1/documents/from-template -> listDocTemplates() di
   * src/lib/doc-templates/index.ts) TIDAK punya field `role` sama sekali di 19 entrinya
   * (financial-report x5, invoice x5, deck x5, video-brief x4 -- lihat definisi DocTemplate
   * di ./types.ts baris 6-13). Satu-satunya `role` yang ADA di codebase ini hidup di
   * src/lib/template-library.ts (DOCUMENT_TEMPLATES, hanya 6 entri: ceo/marketing/finance x
   * ppt|word|excel, TIDAK cover video-plan) dan dipakai backend HANYA untuk menyisipkan
   * struktur section ke prompt AI Brain (generation-engine.ts:35 buildTemplateInstruction ->
   * findTemplate(req.role, req.type)) -- bukan untuk menandai template mana milik role mana
   * di dropdown ini. Dua sistem ini terpisah total, tidak ada mapping template-id -> role
   * di mana pun.
   *
   * Karena itu prop ini SENGAJA BELUM memfilter daftar template (memfilter dengan mapping
   * karangan sendiri = data palsu). Prop tetap diterima + dipakai (diteruskan ke permintaan
   * generate lewat `role` pada buildGenerateRequestBody, field yang sudah didukung backend)
   * supaya AI Brain tetap dapat sinyal role untuk gaya struktur dokumennya. Filter daftar
   * template per role baru bisa jujur diimplementasikan kalau role ditambahkan sebagai field
   * asli ke 19 entri di src/lib/doc-templates/*.ts (keputusan produk, di luar scope edit ini).
   *
   * UPDATE (fase build gap-fix, 7 Sep): prop ini dulu diterima tapi TIDAK PERNAH diisi oleh
   * pemanggil manapun (dead wiring, findTemplate() di generation-engine.ts selalu null lewat
   * jalur ini) -- sekarang MediaStudio.tsx menerima+meneruskan `role`, dan portal pemanggil
   * mengisinya saat merender <MediaStudio role="..." />. Role
   * vocabulary juga sudah disamakan: template-library.ts DOCUMENT_TEMPLATES dulu pakai 'ceo',
   * sekarang 'executive' (selaras dengan tipe prop ini + zod schema media/generate) supaya
   * findTemplate('executive', outputType) genuinely match untuk portal Executive/CEO.
   */
  role?: 'executive' | 'finance' | 'marketing' | 'sekretaris' | 'manager' | 'manager-ops';
}

export default function DocTemplateStudio({ initialBrief = '', onClose, embedded = false, role }: DocTemplateStudioProps) {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState('');

  const [category, setCategory] = useState<DocTemplateCategory>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [brief, setBrief] = useState<string>(initialBrief);
  const [fileNameHint, setFileNameHint] = useState<string>('');
  // FIX (temuan gap-fix 7 Sep): dulu 4 opsi hardcode ('formal'/'santai'/'persuasif'/'ringkas')
  // yang TIDAK COCOK dengan satu pun id di TONE_PRESETS (tone-presets.ts) -- getToneInstruction()
  // exact-match by id, jadi keempat pilihan selalu menghasilkan instruksi kosong, dropdown ini
  // tampak berfungsi tapi diam-diam tidak berbuat apa-apa. Sekarang value dropdown DITARIK
  // LANGSUNG dari TONE_PRESETS (bukan hardcode terpisah) supaya dua sisi tidak pernah lagi
  // divergen -- default ke preset pertama yang ada.
  const [tone, setTone] = useState<string>(TONE_PRESETS[0]?.id || '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DocTemplateGenerateResult | null>(null);

  // Ambil daftar template dinamis dari endpoint GET /api/v1/documents/from-template
  useEffect(() => {
    const controller = new AbortController();
    setLoadingTemplates(true);
    setTemplatesError('');

    fetchDocTemplates(undefined, controller.signal)
      .then((data) => {
        setTemplates(data || []);
        if (data && data.length > 0) {
          setSelectedTemplateId((prev) => prev || data[0].id);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setTemplatesError(
            err instanceof Error ? err.message : 'Gagal memuat daftar template dari server.'
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingTemplates(false);
        }
      });

    return () => controller.abort();
  }, []);

  const filtered = filterTemplates(templates, category, role);

  // Jika template terpilih tidak ada di kategori yang sedang aktif, sesuaikan
  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(filtered[0].id);
    }
  }, [category, filtered, selectedTemplateId]);

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleSubmit = async () => {
    const validation = validateGenerateInput({ templateId: selectedTemplateId, brief });
    if (!validation.valid) {
      setError(validation.error || 'Input belum lengkap.');
      return;
    }

    setError('');
    setBusy(true);

    try {
      const payload = buildGenerateRequestBody({
        templateId: selectedTemplateId,
        brief,
        fileNameHint,
        tone,
        role,
      });
      const res = await generateDocFromTemplate(payload);
      setResult(res);
    } catch (err) {
      if (err instanceof DocTemplateApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kendala saat memproses dokumen. Silakan coba kembali.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return <DocTemplateResult result={result} onReset={() => setResult(null)} />;
  }

  return (
    <div className={embedded ? undefined : styles.panel} style={embedded ? { display: 'flex', flexDirection: 'column', gap: 14 } : undefined} data-testid="doc-template-studio">
      {!embedded && (
        <div className={styles.between}>
          <div>
            <h2 className={styles.title}>Template Dokumen</h2>
            <p className={styles.muted}>
              Pilih template, tentukan brief kebutuhan, dan buat dokumen bisnis siap pakai.
            </p>
          </div>
          {onClose && (
            <button type="button" className={styles.button} aria-label="Tutup panel template" onClick={onClose}>
              Tutup
            </button>
          )}
        </div>
      )}
      {embedded && (
        <p className={styles.muted}>
          Pilih template dokumen, tentukan brief kebutuhan, dan buat berkas bisnis siap pakai.
        </p>
      )}

      {templatesError && (
        <div role="alert" className={styles.error}>
          {templatesError}
        </div>
      )}

      {/* Filter Kategori Keluaran */}
      <div>
        <label className={styles.label}>Kategori Format Dokumen</label>
        <div className={styles.toolbar} role="tablist" aria-label="Kategori format dokumen">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={category === opt.value}
              className={`${styles.button} ${category === opt.value ? styles.selected : ''}`}
              disabled={busy || loadingTemplates}
              onClick={() => setCategory(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pemilihan Template */}
      <label className={styles.label}>
        Pilihan Template ({filtered.length} tersedia)
        <select
          className={styles.input}
          aria-label="Pilihan template"
          data-testid="template-select"
          value={selectedTemplateId}
          disabled={busy || loadingTemplates || filtered.length === 0}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          {loadingTemplates && <option value="">Memuat daftar template...</option>}
          {!loadingTemplates && filtered.length === 0 && (
            <option value="">Tidak ada template pada kategori ini</option>
          )}
          {filtered.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} [{item.outputType.toUpperCase()}]
            </option>
          ))}
        </select>
      </label>

      {/* Tinjauan Deskripsi Template Terpilih */}
      {activeTemplate && (
        <div className={styles.card} style={{ padding: 12 }}>
          <div className={styles.between} style={{ marginBottom: 4 }}>
            <strong>{activeTemplate.label}</strong>
            <span className={styles.badge}>Format: {activeTemplate.outputType.toUpperCase()}</span>
          </div>
          <p className={styles.muted}>{activeTemplate.description}</p>
        </div>
      )}

      {/* Formulir Brief */}
      <label className={styles.label}>
        Brief Kebutuhan Dokumen (Wajib)
        <textarea
          className={styles.input}
          data-testid="template-brief"
          rows={4}
          value={brief}
          disabled={busy}
          placeholder="Contoh: Buatkan laporan keuangan bulanan untuk usaha kopi retail bulan Agustus 2026, sertakan rincian penjualan dan beban operasional..."
          onChange={(e) => setBrief(e.target.value)}
        />
      </label>
      <div className={styles.between}>
        <span className={styles.muted}>{brief.trim().length} karakter</span>
      </div>

      {/* Opsi Tambahan (Nama File dan Nada) */}
      <div className={styles.row}>
        <label className={styles.label} style={{ flex: 2 }}>
          Petunjuk Nama Berkas (Opsional)
          <input
            type="text"
            className={styles.input}
            data-testid="template-filename"
            value={fileNameHint}
            disabled={busy}
            placeholder="Contoh: Laporan_Agustus_2026"
            onChange={(e) => setFileNameHint(e.target.value)}
          />
        </label>
        <label className={styles.label} style={{ flex: 1 }}>
          Nada Dokumen
          <select
            className={styles.input}
            value={tone}
            disabled={busy}
            onChange={(e) => setTone(e.target.value)}
          >
            {TONE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          data-testid="template-submit"
          disabled={busy || loadingTemplates || !brief.trim() || !selectedTemplateId}
          onClick={handleSubmit}
        >
          {busy ? 'Sedang memproses dokumen...' : 'Buat dokumen'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { apiRequest, ApiRequestError, defaultImageRatio, detectStudioIntent, INDUSTRY_OPTIONS, NOTEBOOK_COUNT_LABELS, NOTEBOOK_COUNT_RANGES, NOTEBOOK_KIND_OPTIONS, supportedImageRatios, type ModelCatalog, type StudioKind, type StudioSubmission } from './client';
import type { NotebookKind } from '@/lib/notebook-types';
import VoiceRecorder from './VoiceRecorder';
import DocTemplateStudio from '../doc-templates/DocTemplateStudio';
import styles from './studio.module.css';

// Item 4.6 (7 Sep): label 'video' dulu hardcode '· Segera' -- sekarang generik,
// status render sungguhan vs belum tersedia ditentukan `enabled` (capability asli)
// dan ditampilkan di badge dalam body studio, bukan di judul dialog.
const TITLES: Record<StudioKind, string> = { image: 'Buat gambar', audio: 'Buat audio / voiceover', video: 'Buat video', quiz: 'Buat kuis', flashcard: 'Buat flashcard', transcription: 'Rekam suara & transcript' };
interface Props {
  kind: StudioKind;
  initialText: string;
  sourceText: string;
  brand: { workspaceName: string; palette?: string; hasLogo: boolean };
  onClose: () => void;
  onSubmit: (submission: StudioSubmission) => Promise<void>;
  onTranscript: (text: string) => void;
  // FIX (temuan gap-fix 7 Sep, reachability 19-template): dulu studioMode SELALU mulai
  // di 'media' -- satu-satunya jalan ke tab "Template Dokumen" adalah buka studio media
  // dulu (lewat kind gambar/audio/video/kuis/flashcard yang tidak berkaitan dokumen bisnis
  // sama sekali) lalu klik tab kedua secara manual. Prop opsional ini memungkinkan pemanggil
  // (tombol sidebar "Template Dokumen" baru di ketiga portal) membuka studio LANGSUNG di
  // tab Template Dokumen. Default tetap 'media' -- TIDAK mengubah perilaku existing caller manapun.
  initialStudioMode?: 'media' | 'template';
  // FIX (temuan gap-fix 7 Sep, role dead-wiring): dulu tidak ada prop role sama sekali di
  // sini, jadi <DocTemplateStudio role={role}/> di bawah selalu menerima undefined apapun
  // portal pemanggilnya -- findTemplate() di generation-engine.ts selalu null lewat jalur
  // Template Dokumen. Diteruskan dari portal yang me-render komponen ini, termasuk tiga role
  // baru; ini hanya sinyal identity/style UI, bukan enum backend baru.
  role?: 'executive' | 'finance' | 'marketing' | 'sekretaris' | 'manager' | 'manager-ops';
  allowVideo?: boolean;
}

export default function MediaStudio({ kind, initialText, sourceText, brand, onClose, onSubmit, onTranscript, initialStudioMode, role, allowVideo }: Props) {
  // The UI identity for new roles is intentionally mapped to the existing
  // backend presentation enum. This keeps the old media API contract intact.
  const backendMediaRole: 'marketing' | 'executive' | 'finance' = role === 'marketing'
    ? 'marketing'
    : role === 'executive'
      ? 'executive'
      : 'finance';
  const isVideoAllowed = allowVideo !== undefined ? allowVideo : (role === 'executive' || role === 'marketing');
  const effectiveKind: StudioKind = (kind === 'video' && !isVideoAllowed) ? 'image' : kind;
  const [studioMode, setStudioMode] = useState<'media' | 'template'>(initialStudioMode || 'media');
  const [text, setText] = useState(effectiveKind === 'quiz' || effectiveKind === 'flashcard' ? sourceText || initialText : initialText);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [revision, setRevision] = useState(0);
  const [model, setModel] = useState('');
  const [aspect, setAspect] = useState('');
  const [quality, setQuality] = useState('');
  const [resolution, setResolution] = useState('');
  const [voice, setVoice] = useState('');
  const [speed, setSpeed] = useState('1');
  const [audioMode, setAudioMode] = useState<'script' | 'brief'>(detectStudioIntent(initialText) === 'audio' ? 'brief' : 'script');
  const [count, setCount] = useState(kind === 'quiz' ? 5 : 8);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  // Studio dibuka dari tombol kuis/flashcard, tapi backend mendukung 9 jenis kartu.
  // Jenis dipilih di dalam studio supaya komponen pemanggil tidak perlu diubah.
  const [notebookKind, setNotebookKind] = useState<NotebookKind>(kind === 'flashcard' ? 'flashcard' : 'quiz');
  // Vertikal industri untuk gambar. Kosong = perilaku lama, prompt tidak di-enrich.
  const [industry, setIndustry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const alive = useRef(true);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { alive.current = false; previous?.focus(); };
  }, []);

  const [duration, setDuration] = useState<number | ''>('');

  useEffect(() => {
    const abort = new AbortController();
    // Item 4.6 (7 Sep): video sekarang punya katalog model sungguhan juga (dulu
    // selalu jatuh ke 'image' karena video selalu planned, tidak butuh model).
    const queryKind = effectiveKind === 'audio' || effectiveKind === 'transcription' || effectiveKind === 'video' ? effectiveKind : 'image';
    apiRequest<ModelCatalog>(`/api/v1/media/models?kind=${queryKind}`, { signal: abort.signal })
      .then(result => {
        setCatalog(result); setCatalogError('');
        const configured = result.data[0];
        setModel(configured?.id || '');
        setVoice(configured?.capabilities.voices?.[0] || '');
        setAspect(defaultImageRatio(configured));
        setDuration(configured?.capabilities.durations?.[0] ?? '');
      })
      .catch(err => { if (!abort.signal.aborted) setCatalogError(err instanceof Error ? err.message : 'Katalog model tidak dapat dimuat.'); });
    return () => abort.abort();
  }, [effectiveKind, revision]);

  const selected = catalog?.data.find(item => item.id === model);
  const supported = selected?.capabilities;
  const aspectRatios = supportedImageRatios(selected);
  // Item 4.6 (7 Sep): video dulu HARDCODE true (selalu "enabled" karena cuma
  // return planned() apapun capability-nya) -- sekarang ikut capability asli
  // seperti kind lain, supaya UI jujur soal apakah render sungguhan tersedia.
  const enabled = !!catalog?.capabilities[effectiveKind === 'quiz' || effectiveKind === 'flashcard' ? 'notebook' : effectiveKind];
  const submit = async (storyboard = false) => {
    if (busyRef.current) return;
    // Item 4.6 (7 Sep): video dulu boleh submit brief kosong (selalu return planned()
    // apapun isinya) -- sekarang generateVideoMedia() butuh prompt asli, jadi brief
    // wajib diisi juga untuk video (storyboard tetap punya validasi sendiri di bawah).
    if (!text.trim()) { setError('Isi brief atau materi terlebih dahulu.'); return; }
    if (effectiveKind === 'audio' && audioMode === 'script' && text.trim().length > 6000) { setError('Script voiceover maksimal 6000 karakter. Pendekkan script sebelum mencoba kembali.'); return; }
    if ((effectiveKind === 'quiz' || effectiveKind === 'flashcard') && text.trim().length < 10) { setError('Materi sumber minimal 10 karakter.'); return; }
    let submission: StudioSubmission;
    if (storyboard) {
      if (!isVideoAllowed) { setError('Fitur storyboard video hanya tersedia untuk peran CEO dan Marketing.'); return; }
      submission = { type: 'storyboard', request: { type: 'video-plan', brief: text.trim(), role: backendMediaRole } };
    } else if (effectiveKind === 'quiz' || effectiveKind === 'flashcard') {
      const range = NOTEBOOK_COUNT_RANGES[notebookKind];
      const safeCount = Math.max(range.min, Math.min(range.max, count));
      submission = { type: 'notebook', request: { kind: notebookKind, sourceText: text.trim(), count: safeCount, difficulty, role: backendMediaRole } };
    } else if (effectiveKind === 'image' || effectiveKind === 'audio' || (effectiveKind === 'video' && isVideoAllowed)) {
      submission = { type: 'media', request: {
        kind: effectiveKind, role: backendMediaRole, brandContext: industry ? { ...brand, industry } : brand,
        ...(effectiveKind === 'image' ? {
          prompt: text.trim(), model: model || undefined, aspectRatio: aspectRatios.includes(aspect) ? aspect : undefined,
          quality: quality || undefined, resolution: resolution || undefined,
          outputFormat: supported?.outputFormats?.includes('png') ? 'png' : undefined,
        } : effectiveKind === 'audio' ? {
          ...(audioMode === 'script' ? { script: text.trim() } : { prompt: text.trim() }),
          model: model || undefined, voice: voice || undefined,
          speed: supported?.supportsSpeed ? Number(speed) : undefined, outputFormat: 'mp3',
        } : {
          // Item 4.6 (7 Sep): video dulu cuma { prompt } (server selalu return
          // planned() apapun isinya) -- sekarang model/aspect/duration genuinely
          // dipakai memilih provider+parameter render.
          prompt: text.trim(), model: model || undefined,
          aspectRatio: aspectRatios.includes(aspect) ? aspect : undefined,
          resolution: resolution || undefined,
          durationSeconds: duration !== '' ? Number(duration) : undefined,
        }),
      } };
    } else {
      setError('Aksi ini tidak diizinkan untuk peran Anda.');
      return;
    }
    setError(''); setBusy(true); busyRef.current = true;
    try {
      await onSubmit(submission);
      if (alive.current) onClose();
    } catch (err) {
      if (alive.current) {
        const scriptReady = err instanceof ApiRequestError && err.data && typeof err.data === 'object'
          && (err.data as { kind?: string; status?: string; script?: string }).kind === 'audio'
          && (err.data as { status?: string }).status === 'script-ready'
          && typeof (err.data as { script?: unknown }).script === 'string'
          ? (err.data as { script: string }).script.trim() : '';
        if (scriptReady) { setText(scriptReady); setAudioMode('script'); }
        setError(`${err instanceof Error ? err.message : 'Permintaan gagal. Coba kembali.'}${scriptReady ? ' Draft script berhasil dibuat dan siap dicoba ulang tanpa regenerasi.' : ''}`);
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return <div className={styles.overlay}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="marketing-studio-title" data-testid={`studio-${kind}`} className={`${styles.panel} ${styles.dialog}`} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([hidden]), textarea:not(:disabled), select:not(:disabled), a[href]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <div className={styles.between}>
        <h2 id="marketing-studio-title" className={styles.title}>{studioMode === 'template' ? 'Template Dokumen' : TITLES[effectiveKind]}</h2>
        <button type="button" className={styles.button} aria-label="Tutup studio media" onClick={onClose}>Tutup</button>
      </div>
      <div className={styles.toolbar} role="tablist" aria-label="Pilihan mode studio">
        <button
          type="button"
          role="tab"
          aria-selected={studioMode === 'media'}
          className={`${styles.button} ${studioMode === 'media' ? styles.selected : ''}`}
          data-testid="studio-tab-media"
          onClick={() => setStudioMode('media')}
        >
          Studio Media & Catatan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={studioMode === 'template'}
          className={`${styles.button} ${studioMode === 'template' ? styles.selected : ''}`}
          data-testid="studio-tab-template"
          onClick={() => setStudioMode('template')}
        >
          Template Dokumen
        </button>
      </div>
      {studioMode === 'template' ? (
        <DocTemplateStudio embedded initialBrief={text} onClose={onClose} role={role} />
      ) : (
        <>
          <p className={styles.muted}>Hasil masuk ke chat tempat panel ini dibuka, termasuk jika Anda beralih chat. Menutup panel saat generasi berlangsung tidak membatalkan proses server.</p>
      {catalogError && <div role="alert" className={styles.error}>{catalogError} <button type="button" className={styles.button} onClick={() => { setCatalogError(''); setRevision(value => value + 1); }}>Muat ulang katalog</button></div>}
      {catalog?.note && <p className={styles.muted}>{catalog.note}</p>}
      {effectiveKind === 'transcription' ? <VoiceRecorder enabled={enabled} onSend={onTranscript} /> : <>
        {effectiveKind === 'image' && <>
          <p className={styles.muted}>Brand: {brand.workspaceName} · Palet: {brand.palette || 'belum dipilih'}. Logo hanya metadata; tidak ada file logo atau foto referensi yang dikirim.</p>
          <details>
            <summary>Pengaturan lanjutan</summary>
            <label className={styles.label}>Model gambar
              <select className={styles.input} aria-label="Model gambar" value={model} disabled={busy || !catalog?.data.length} onChange={event => {
                setModel(event.target.value); setQuality(''); setResolution('');
                setAspect(defaultImageRatio(catalog?.data.find(item => item.id === event.target.value)));
              }}>
                {!catalog?.data.length && <option value="">{catalog ? 'Tidak ada model tersedia' : 'Memuat model…'}</option>}
                {catalog?.data.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.pricing?.costUsd !== undefined ? ` · $${item.pricing.costUsd}${item.pricing.unit ? '/' + item.pricing.unit : ''}` : ''}{item.verified === false ? ' · default, belum diverifikasi' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.row}>
              <label className={styles.label}>Rasio gambar<select className={styles.input} value={aspect} onChange={event => setAspect(event.target.value)} disabled={busy || !aspectRatios.length}>{!aspectRatios.length && <option value="">Default model</option>}{aspectRatios.map(value => <option key={value}>{value}</option>)}</select></label>
              {!!supported?.qualities?.length && <label className={styles.label}>Kualitas<select className={styles.input} value={quality} onChange={event => setQuality(event.target.value)} disabled={busy}><option value="">Default model</option>{supported.qualities.map(value => <option key={value}>{value}</option>)}</select></label>}
              {!!supported?.resolutions?.length && <label className={styles.label}>Resolusi<select className={styles.input} value={resolution} onChange={event => setResolution(event.target.value)} disabled={busy}><option value="">Default model</option>{supported.resolutions.map(value => <option key={value}>{value}</option>)}</select></label>}
            </div>
            <label className={styles.label}>Jenis usaha
              <select className={styles.input} aria-label="Jenis usaha" data-testid="studio-industry" value={industry} disabled={busy} onChange={event => setIndustry(event.target.value)}>
                <option value="">Tanpa gaya khusus</option>
                {INDUSTRY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <p className={styles.muted}>{industry ? 'Prompt ditambahi gaya visual, komposisi, dan larangan yang cocok buat jenis usaha ini.' : 'Kosongkan kalau tidak ingin gaya khusus jenis usaha ditambahkan ke prompt.'}</p>
          </details>
        </>}
        {effectiveKind === 'audio' && <>
          <label className={styles.label}>Sumber voiceover<select className={styles.input} value={audioMode} onChange={event => setAudioMode(event.target.value as 'script' | 'brief')} disabled={busy}><option value="script">Saya punya script — bacakan persis</option><option value="brief">Saya punya brief — buat script lalu audio</option></select></label>
          <p className={styles.muted}>{audioMode === 'brief' ? 'Server menyusun script dari brief. Script hasilnya tampil bersama audio.' : 'Script Anda dikirim apa adanya.'}</p>
          <div className={styles.row}>
            <label className={styles.label}>Voice<select className={styles.input} aria-label="Voice" value={voice} onChange={event => setVoice(event.target.value)} disabled={busy || !supported?.voices?.length}>
              {!supported?.voices?.length && <option value="">Voice default server</option>}
              {supported?.voices?.map(value => <option key={value}>{value}</option>)}
            </select></label>
            {supported?.supportsSpeed && <label className={styles.label}>Kecepatan<select className={styles.input} value={speed} disabled={busy} onChange={event => setSpeed(event.target.value)}>{['0.75', '1', '1.25', '1.5'].map(value => <option value={value} key={value}>{value}×</option>)}</select></label>}
          </div>
        </>}
        {effectiveKind === 'video' && isVideoAllowed && <>
          {enabled ? (
            <>
              <p className={styles.muted}>Render video sungguhan lewat OpenRouter (Seedance/Veo/dst) -- proses bisa makan waktu s/d 2 menit. Anda juga bisa membuat storyboard DOCX sekaligus atau sebagai gantinya.</p>
              <label className={styles.label}>Model video
                <select className={styles.input} aria-label="Model video" value={model} disabled={busy || !catalog?.data.length} onChange={event => {
                  const next = catalog?.data.find(item => item.id === event.target.value);
                  setModel(event.target.value);
                  setAspect(defaultImageRatio(next));
                  setResolution('');
                  setDuration(next?.capabilities.durations?.[0] ?? '');
                }}>
                  {!catalog?.data.length && <option value="">{catalog ? 'Tidak ada model tersedia' : 'Memuat model…'}</option>}
                  {catalog?.data.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.pricing?.costUsd !== undefined ? ` · $${item.pricing.costUsd}${item.pricing.unit ? '/' + item.pricing.unit : ''}` : ''}{item.verified === false ? ' · default, belum diverifikasi' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.row}>
                <label className={styles.label}>Rasio video<select className={styles.input} value={aspect} onChange={event => setAspect(event.target.value)} disabled={busy || !aspectRatios.length}>{!aspectRatios.length && <option value="">Default model</option>}{aspectRatios.map(value => <option key={value}>{value}</option>)}</select></label>
                {!!supported?.resolutions?.length && <label className={styles.label}>Resolusi<select className={styles.input} value={resolution} onChange={event => setResolution(event.target.value)} disabled={busy}><option value="">Default model</option>{supported.resolutions.map(value => <option key={value}>{value}</option>)}</select></label>}
                {!!supported?.durations?.length && <label className={styles.label}>Durasi<select className={styles.input} value={duration} onChange={event => setDuration(Number(event.target.value))} disabled={busy}>{supported.durations.map(value => <option key={value} value={value}>{value} detik</option>)}</select></label>}
              </div>
            </>
          ) : (
            <p>Render video otomatis: <span className={styles.badge}>Segera</span>. Sekarang Anda dapat membuat storyboard DOCX berisi scene, naskah voiceover, teks layar, dan CTA.</p>
          )}
        </>}
        {(effectiveKind === 'quiz' || effectiveKind === 'flashcard') && <div className={styles.row}>
          <label className={styles.label}>Jenis catatan
            <select className={styles.input} aria-label="Jenis catatan" data-testid="studio-notebook-kind" value={notebookKind} disabled={busy} onChange={event => {
              const next = event.target.value as NotebookKind;
              setNotebookKind(next);
              setCount(NOTEBOOK_COUNT_RANGES[next].default);
            }}>
              {NOTEBOOK_KIND_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className={styles.label}>Jumlah {NOTEBOOK_COUNT_LABELS[notebookKind]}<input className={styles.input} type="number" min={NOTEBOOK_COUNT_RANGES[notebookKind].min} max={NOTEBOOK_COUNT_RANGES[notebookKind].max} value={count} disabled={busy} onChange={event => setCount(Math.max(NOTEBOOK_COUNT_RANGES[notebookKind].min, Math.min(NOTEBOOK_COUNT_RANGES[notebookKind].max, Number(event.target.value) || NOTEBOOK_COUNT_RANGES[notebookKind].min)))} /></label>
          <label className={styles.label}>Kesulitan<select className={styles.input} value={difficulty} disabled={busy} onChange={event => setDifficulty(event.target.value as typeof difficulty)}><option value="easy">Mudah</option><option value="medium">Sedang</option><option value="hard">Sulit</option></select></label>
        </div>}
        <label className={styles.label}>{effectiveKind === 'quiz' || effectiveKind === 'flashcard' ? 'Materi sumber (teks attachment / chat / transcript)' : effectiveKind === 'audio' && audioMode === 'script' ? 'Script voiceover' : 'Brief'}
          <textarea autoFocus className={styles.input} data-testid="studio-prompt" value={text} maxLength={effectiveKind === 'audio' && audioMode === 'script' ? 6000 : 12000} disabled={busy} onChange={event => setText(event.target.value)} placeholder={effectiveKind === 'image' ? 'Poster promosi kopi lokal, headline Diskon Akhir Pekan…' : 'Tulis materi atau brief Anda di sini…'} />
        </label>
        <p className={styles.muted}>{text.length.toLocaleString('id-ID')} karakter</p>
        {error && <p role="alert" className={styles.error}>{error} Input Anda tetap tersimpan; Anda dapat mencoba kembali.</p>}
        {!enabled && !catalogError && <p role="status" className={styles.muted}>{catalog ? 'Fitur ini belum tersedia pada server saat ini.' : 'Memeriksa ketersediaan…'}</p>}
        <div className={styles.row}>
          <button type="button" className={`${styles.button} ${styles.primary}`} data-testid="studio-generate" disabled={busy || !enabled || !text.trim()} onClick={() => void submit()}>{busy ? 'Memproses…' : error ? 'Coba kembali' : effectiveKind === 'image' ? 'Generate gambar' : effectiveKind === 'audio' ? 'Generate voiceover' : (effectiveKind === 'video' && isVideoAllowed) ? 'Generate video' : `Buat ${(NOTEBOOK_KIND_OPTIONS.find(option => option.value === notebookKind)?.label || 'catatan').toLowerCase()}`}</button>
          {effectiveKind === 'video' && isVideoAllowed && <button type="button" className={styles.button} data-testid="storyboard-generate" disabled={busy || !text.trim()} onClick={() => void submit(true)}>Buat storyboard DOCX</button>}
        </div>
      </>}
    </>)}
    </div>
  </div>;
}

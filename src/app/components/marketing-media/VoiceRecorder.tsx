'use client';

import { useEffect, useRef, useState } from 'react';
import { apiRequest, MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, validateAudio } from './client';
import styles from './studio.module.css';
import { encodeWav } from './wav';

interface TranscriptResult {
  text: string; language: string; provider: string; modelUsed: string;
  durationSeconds?: number; latencyMs?: number;
}

// `model` (9 Sep 2026, gap-fix audio-catalog-search): id model transkripsi eksplisit
// dari panel pencarian model di ComposerToolbar.tsx (undefined = Auto, backend pakai
// jalur default lama -- lihat resolveSttModelParam di ComposerToolbar.tsx untuk
// aturan lengkap kapan ini undefined vs terisi). POST /api/v1/media/transcribe
// SUDAH menerima field `model` opsional sejak awal (lihat route.ts + transcribeAudio
// di media-provider.ts) -- gap-nya murni di sisi client yang belum pernah mengirimnya.
export default function VoiceRecorder({ enabled, model, onSend }: { enabled: boolean; model?: string; onSend: (text: string) => void }) {
  const [state, setState] = useState<'idle' | 'permission' | 'recording' | 'reading' | 'preview' | 'transcribing' | 'transcript'>('idle');
  const [audio, setAudio] = useState<{ blob: Blob; url: string; name: string; duration: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [metadata, setMetadata] = useState<TranscriptResult | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrl = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const decoder = useRef<AudioContext | null>(null);
  const version = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const stopHardware = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };

  const release = () => {
    version.current += 1;
    controller.current?.abort();
    controller.current = null;
    if (recorder.current) {
      recorder.current.ondataavailable = null;
      recorder.current.onstop = null;
      recorder.current.onerror = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
      recorder.current = null;
    }
    stopHardware();
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null;
    if (decoder.current && decoder.current.state !== 'closed') void decoder.current.close().catch(() => {});
    decoder.current = null;
  };

  // Closing the parent unmounts this component, including late microphone permission requests.
  useEffect(() => () => release(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const discard = () => {
    release(); setAudio(null); setText(''); setMetadata(null); setSeconds(0); setError(''); setState('idle');
  };
  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stopHardware();
  };
  const acceptAudio = (blob: Blob, name: string, duration: number) => {
    validateAudio(blob, duration);
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    const url = URL.createObjectURL(blob);
    blobUrl.current = url;
    setAudio({ blob, url, name, duration }); setSeconds(duration); setState('preview');
  };

  const start = async () => {
    discard();
    const token = version.current;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Browser tidak mendukung rekaman mikrofon. Unggah audio MP3/WAV atau ketik manual.'); return;
    }
    setState('permission');
    try {
      const tracks = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== version.current) { tracks.getTracks().forEach(track => track.stop()); return; }
      stream.current = tracks;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(tracks, mime ? { mimeType: mime } : undefined);
      recorder.current = recording;
      const chunks: Blob[] = [];
      let bytes = 0;
      let oversized = false;
      const started = performance.now();
      recording.ondataavailable = event => {
        if (token !== version.current || !event.data.size) return;
        bytes += event.data.size;
        if (bytes > MAX_AUDIO_BYTES) { oversized = true; stop(); return; }
        chunks.push(event.data);
      };
      recording.onerror = () => {
        release(); setState('idle'); setError('Rekaman terhenti karena kesalahan mikrofon. Rekam ulang atau unggah audio.');
      };
      recording.onstop = () => {
        stopHardware();
        if (token !== version.current) return;
        try {
          if (oversized) throw new Error('Audio melebihi 25 MB. Rekam ulang dengan durasi lebih pendek.');
          const duration = Math.min(MAX_AUDIO_SECONDS, (performance.now() - started) / 1000);
          const type = recording.mimeType || chunks[0]?.type || 'audio/webm';
          const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
          acceptAudio(new Blob(chunks, { type }), `rekaman.${ext}`, duration);
        } catch (err) { setState('idle'); setError(err instanceof Error ? err.message : 'Rekaman gagal.'); }
      };
      recording.start(250);
      setState('recording');
      timer.current = setInterval(() => {
        const elapsed = (performance.now() - started) / 1000;
        setSeconds(Math.min(MAX_AUDIO_SECONDS, Math.floor(elapsed)));
        if (elapsed >= MAX_AUDIO_SECONDS) stop();
      }, 200);
    } catch (err) {
      if (token !== version.current) return;
      release(); setState('idle');
      setError(err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Izin mikrofon ditolak. Izinkan melalui pengaturan browser atau unggah file audio.'
        : 'Mikrofon tidak tersedia. Periksa perangkat atau unggah file audio.');
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    discard();
    const token = version.current;
    setState('reading');
    try {
      if (!file.size || file.size > MAX_AUDIO_BYTES) throw new Error('File audio harus berisi data dan maksimal 25 MB.');
      if (!/^audio\//.test(file.type) && !/\.(mp3|wav|webm|m4a|mp4|ogg|flac)$/i.test(file.name)) throw new Error('Pilih file audio MP3, WAV, WebM, M4A, OGG, atau FLAC.');
      const context = new AudioContext();
      decoder.current = context;
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      const duration = decoded.duration;
      if (context.state !== 'closed') await context.close();
      if (token !== version.current) return;
      decoder.current = null;
      acceptAudio(file, file.name, duration);
    } catch (err) {
      if (token !== version.current) return;
      release(); setState('idle');
      setError(err instanceof Error ? `Audio tidak dapat digunakan: ${err.message}` : 'Format audio tidak dapat dibaca.');
    }
  };

  const transcribe = async () => {
    if (!audio || state === 'transcribing') return;
    const token = version.current;
    setError(''); setState('transcribing');
    const abort = new AbortController(); controller.current = abort;
    try {
      validateAudio(audio.blob, audio.duration);
      // MediaRecorder WebM often has no duration header. Normalize complete audio to
      // mono WAV before upload, so backend duration validation does not trust a form value.
      const context = new AudioContext({ sampleRate: 16000 });
      decoder.current = context;
      const decoded = await context.decodeAudioData(await audio.blob.arrayBuffer());
      if (context.state !== 'closed') await context.close();
      if (token !== version.current) return;
      decoder.current = null;
      if (decoded.duration > MAX_AUDIO_SECONDS + 0.5) throw new Error('Audio melebihi 120 detik. Potong audio atau rekam ulang.');
      const length = Math.min(decoded.length, MAX_AUDIO_SECONDS * decoded.sampleRate);
      const mono = new Float32Array(length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const samples = decoded.getChannelData(channel);
        for (let i = 0; i < length; i++) mono[i] += samples[i] / decoded.numberOfChannels;
      }
      const wav = new Blob([encodeWav(mono, decoded.sampleRate)], { type: 'audio/wav' });
      const duration = length / decoded.sampleRate;
      validateAudio(wav, duration);
      const form = new FormData();
      form.set('audio', wav, 'klir-transcript.wav'); form.set('language', 'id');
      form.set('durationSeconds', String(duration));
      if (model) form.set('model', model);
      const result = await apiRequest<{ success: true; data: TranscriptResult }>('/api/v1/media/transcribe', {
        method: 'POST', body: form, signal: abort.signal,
      });
      if (token !== version.current) return;
      if (!result.data?.text?.trim()) throw new Error('Tidak ada ucapan yang terbaca. Rekam ulang dengan suara lebih jelas.');
      setText(result.data.text); setMetadata(result.data); setState('transcript');
    } catch (err) {
      if (token !== version.current) return;
      if (decoder.current && decoder.current.state !== 'closed') void decoder.current.close().catch(() => {});
      decoder.current = null;
      setError(err instanceof Error ? err.message : 'Transkripsi gagal. Coba lagi.'); setState('preview');
    }
  };

  const busy = ['permission', 'recording', 'reading', 'transcribing'].includes(state);
  return <div className={styles.panel} data-testid="voice-recorder">
    <p className={styles.muted}>Maksimal 120 detik / 25 MB. Audio dikirim ke provider hanya saat Anda memilih Transkripsikan. Hasil selalu bisa diedit sebelum dikirim ke chat.</p>
    <div role="status" aria-live="polite">{state === 'recording' ? `Merekam ${Math.floor(seconds)} / 120 detik` : state === 'permission' ? 'Menunggu izin mikrofon…' : state === 'reading' ? 'Memeriksa audio…' : state === 'transcribing' ? 'Mengubah suara menjadi teks…' : audio ? `${audio.name} · ${seconds.toFixed(1)} detik` : 'Belum ada rekaman'}</div>
    <div className={styles.row}>
      <button type="button" className={styles.button} onClick={start} disabled={busy || !enabled} data-testid="record-start">{audio ? 'Rekam ulang' : 'Mulai rekaman'}</button>
      {state === 'recording' && <button type="button" className={`${styles.button} ${styles.primary}`} onClick={stop}>Hentikan rekaman</button>}
      <button type="button" className={styles.button} onClick={() => input.current?.click()} disabled={busy}>Unggah audio</button>
      {state !== 'idle' && <button type="button" className={styles.button} onClick={discard}>Buang / batalkan</button>}
      <input hidden ref={input} type="file" accept="audio/*,.webm,.m4a" aria-label="Pilih file audio" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
    {audio && <audio controls preload="metadata" src={audio.url} className={styles.audio} aria-label="Pratinjau rekaman" />}
    {audio && <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy || !enabled} onClick={transcribe}>Transkripsikan{metadata ? ' ulang' : ''}</button>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!enabled && <p className={styles.muted}>Transkripsi belum tersedia pada server. Anda tetap bisa mengetik teks secara manual.</p>}
    <label className={styles.label}>Transcript / input manual
      <textarea className={styles.input} data-testid="transcript-draft" value={text} onChange={event => setText(event.target.value)} maxLength={12000} placeholder="Transcript muncul di sini. Periksa dan edit sebelum mengirim." />
    </label>
    {metadata && <p className={styles.muted}>{metadata.provider} · {metadata.modelUsed}</p>}
    <button type="button" className={`${styles.button} ${styles.primary}`} data-testid="transcript-send" disabled={!text.trim() || busy} onClick={() => onSend(text.trim())}>Kirim transcript ke chat asal</button>
  </div>;
}

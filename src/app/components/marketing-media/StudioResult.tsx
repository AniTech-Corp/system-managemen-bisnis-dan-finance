'use client';

import { useEffect, useState } from 'react';
import type {
  AudioOverviewScriptPayload, DeckPayload, FlashcardPayload, InfographicPayload,
  MindmapPayload, NotebookResult, QuizPayload, SummaryReportPayload, TablePayload,
  VideoStoryboardPayload,
} from '@/lib/notebook-types';
import { buildRetrySubmission, type StudioMessage, type StudioSubmission, validMediaResult } from './client';
import styles from './studio.module.css';

function CopyText({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [status, setStatus] = useState('');
  return <div className={styles.row}><button type="button" className={styles.button} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setStatus('Tersalin'); }
    catch { setStatus('Tidak bisa menyalin. Izinkan clipboard pada browser.'); }
  }}>{label}</button>{status && <span role="status" className={styles.muted}>{status}</span>}</div>;
}

function Quiz({ payload }: { payload: QuizPayload }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [complete, setComplete] = useState(false);
  if (!payload.questions?.length) return <p role="alert">Kuis tidak memiliki pertanyaan.</p>;
  const question = payload.questions[index];
  const answered = answers[question.id] !== undefined;
  const score = payload.questions.filter(item => answers[item.id] === item.correctIndex).length;
  const summary = payload.questions.map((item, i) => `${i + 1}. ${item.question}\nJawaban Anda: ${item.options[answers[item.id]] || 'Belum dijawab'}\nJawaban benar: ${item.options[item.correctIndex]}\n${item.explanation}`).join('\n\n');
  return <div className={styles.panel} data-testid="quiz-card">
    <h3 className={styles.title}>{payload.title}</h3><p className={styles.muted}>{payload.instructions}</p>
    {complete ? <>
      <p role="status" data-testid="quiz-score">Skor: {score} / {payload.questions.length}</p>
      {payload.questions.map(item => <div key={item.id}><strong>{item.question}</strong><p>Jawaban: {item.options[item.correctIndex]}</p><p className={styles.muted}>{item.explanation}</p></div>)}
      <CopyText text={`Skor: ${score}/${payload.questions.length}\n\n${summary}`} label="Salin hasil kuis" />
      <button type="button" className={styles.button} onClick={() => { setIndex(0); setAnswers({}); setComplete(false); }}>Ulangi kuis</button>
    </> : <>
      <span className={styles.muted}>Pertanyaan {index + 1} / {payload.questions.length}</span>
      <p>{question.question}</p>
      {question.options.map((option, optionIndex) => <button type="button" key={optionIndex} className={`${styles.button} ${answers[question.id] === optionIndex ? styles.selected : ''}`} disabled={answered} onClick={() => setAnswers(previous => ({ ...previous, [question.id]: optionIndex }))}>{option}</button>)}
      {answered && <p role="status">{answers[question.id] === question.correctIndex ? 'Benar.' : `Jawaban benar: ${question.options[question.correctIndex]}.`} {question.explanation}</p>}
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!answered} onClick={() => index === payload.questions.length - 1 ? setComplete(true) : setIndex(index + 1)}>{index === payload.questions.length - 1 ? 'Lihat skor' : 'Pertanyaan berikutnya'}</button>
    </>}
  </div>;
}

function Flashcards({ payload }: { payload: FlashcardPayload }) {
  const [index, setIndex] = useState(0);
  const [back, setBack] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  if (!payload.cards?.length) return <p role="alert">Flashcard tidak memiliki kartu.</p>;
  const card = payload.cards[index];
  const text = `${payload.title}\n\n${payload.cards.map((item, i) => `${i + 1}. ${item.front}\n${item.back}`).join('\n\n')}`;
  return <div className={styles.panel} data-testid="flashcard-deck">
    <h3 className={styles.title}>{payload.title}</h3>
    <p className={styles.muted}>Kartu {index + 1} / {payload.cards.length} · Sudah paham: {Object.values(known).filter(Boolean).length} · Perlu diulang: {Object.values(known).filter(value => !value).length}</p>
    <button type="button" className={`${styles.button} ${styles.card}`} data-testid="flashcard-flip" aria-label={back ? 'Lihat pertanyaan' : 'Lihat jawaban'} aria-pressed={back} onClick={() => setBack(value => !value)}>{back ? card.back : card.front}</button>
    <p className={styles.muted}>{back ? 'Jawaban · klik untuk kembali' : 'Pertanyaan · klik untuk membuka jawaban'}{!back && card.hint ? ` · Petunjuk: ${card.hint}` : ''}</p>
    <div className={styles.row}>
      <button type="button" className={`${styles.button} ${known[card.id] === true ? styles.selected : ''}`} aria-pressed={known[card.id] === true} onClick={() => setKnown(previous => ({ ...previous, [card.id]: true }))}>Sudah paham</button>
      <button type="button" className={`${styles.button} ${known[card.id] === false ? styles.selected : ''}`} aria-pressed={known[card.id] === false} onClick={() => setKnown(previous => ({ ...previous, [card.id]: false }))}>Perlu diulang</button>
    </div>
    <div className={styles.row}>
      <button type="button" className={styles.button} disabled={index === 0} onClick={() => { setIndex(index - 1); setBack(false); }}>Sebelumnya</button>
      <button type="button" className={styles.button} disabled={index === payload.cards.length - 1} onClick={() => { setIndex(index + 1); setBack(false); }}>Berikutnya</button>
      <button type="button" className={styles.button} onClick={() => { setIndex(0); setBack(false); setKnown({}); }}>Mulai ulang deck</button>
    </div>
    <CopyText text={text} label="Salin semua kartu" />
    <button type="button" className={styles.button} onClick={() => {
      let url: string | undefined;
      try {
        url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'klir-flashcards.txt'; link.click();
      } catch { setError('Ekspor gagal. Gunakan Salin semua kartu.'); }
      finally { if (url) { const created = url; setTimeout(() => URL.revokeObjectURL(created), 1000); } }
    }}>Unduh teks flashcard</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}

function SummaryReport({ payload }: { payload: SummaryReportPayload }) {
  const text = `${payload.title}\n\n${payload.summary}\n\n${payload.sections.map(item => `${item.heading}\n${item.body}`).join('\n\n')}`;
  return <div className={styles.panel} data-testid="summary-report-card">
    <h3 className={styles.title}>{payload.title}</h3>
    <p>{payload.summary}</p>
    {payload.sections.map(item => <div key={item.id}><strong>{item.heading}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p></div>)}
    <CopyText text={text} label="Salin ringkasan" />
  </div>;
}

function Mindmap({ payload }: { payload: MindmapPayload }) {
  const text = `${payload.title}\n\n${payload.root.label}\n${payload.children.map(branch => `- ${branch.label}${(branch.children || []).map(leaf => `\n  - ${leaf.label}`).join('')}`).join('\n')}`;
  return <div className={styles.panel} data-testid="mindmap-card">
    <h3 className={styles.title}>{payload.title}</h3>
    <p><strong>{payload.root.label}</strong></p>
    <ul>{payload.children.map(branch => <li key={branch.id}>{branch.label}
      {!!branch.children?.length && <ul>{branch.children.map(leaf => <li key={leaf.id}>{leaf.label}</li>)}</ul>}
    </li>)}</ul>
    <CopyText text={text} label="Salin peta pikiran" />
  </div>;
}

function FactTable({ payload }: { payload: TablePayload }) {
  const text = `${payload.title}\n\n${payload.columns.join(' | ')}\n${payload.rows.map(row => row.join(' | ')).join('\n')}`;
  return <div className={styles.panel} data-testid="table-card">
    <h3 className={styles.title}>{payload.title}</h3>
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr>{payload.columns.map((column, index) => <th key={index} style={{ textAlign: 'left', padding: '4px 8px' }}>{column}</th>)}</tr></thead>
        <tbody>{payload.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: '4px 8px' }}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <CopyText text={text} label="Salin tabel" />
  </div>;
}

function Infographic({ payload }: { payload: InfographicPayload }) {
  const text = `${payload.title}\n${payload.caption}\n\n${payload.stats.map(stat => `${stat.value} -- ${stat.label}${stat.note ? ` (${stat.note})` : ''}`).join('\n')}`;
  return <div className={styles.panel} data-testid="infographic-card">
    <h3 className={styles.title}>{payload.title}</h3>
    <p className={styles.muted}>{payload.caption}</p>
    <div className={styles.row}>{payload.stats.map(stat => <div key={stat.id} className={styles.card}>
      <strong>{stat.value}</strong>
      <p>{stat.label}</p>
      {stat.note && <p className={styles.muted}>{stat.note}</p>}
    </div>)}</div>
    <CopyText text={text} label="Salin angka infografis" />
  </div>;
}

function Deck({ payload }: { payload: DeckPayload }) {
  const text = `${payload.title}\n\n${payload.slides.map((slide, index) => `Slide ${index + 1}: ${slide.heading}\n${slide.bullets.map(bullet => `- ${bullet}`).join('\n')}`).join('\n\n')}`;
  return <div className={styles.panel} data-testid="deck-card">
    <h3 className={styles.title}>{payload.title}</h3>
    {payload.slides.map((slide, index) => <div key={slide.id}>
      <strong>Slide {index + 1}: {slide.heading}</strong>
      <ul>{slide.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul>
    </div>)}
    <CopyText text={text} label="Salin kerangka slide" />
  </div>;
}

function AudioOverviewScript({ payload }: { payload: AudioOverviewScriptPayload }) {
  const speakerName = (speaker: 'A' | 'B') => speaker === 'A' ? payload.speakers[0] : payload.speakers[1];
  const text = `${payload.title}\n\n${payload.lines.map(line => `${speakerName(line.speaker)}: ${line.text}`).join('\n')}`;
  return <div className={styles.panel} data-testid="audio-script-card">
    <h3 className={styles.title}>{payload.title}</h3>
    <p className={styles.muted}>{payload.speakers[0]} dan {payload.speakers[1]}</p>
    {payload.lines.map(line => <p key={line.id}><strong>{speakerName(line.speaker)}:</strong> {line.text}</p>)}
    <CopyText text={text} label="Salin naskah dialog" />
  </div>;
}

function VideoStoryboard({ payload }: { payload: VideoStoryboardPayload }) {
  const text = `${payload.title}\n\n${payload.scenes.map(scene => `Scene ${scene.sceneNumber}: ${scene.description}${scene.onScreenText ? `\nTeks layar: ${scene.onScreenText}` : ''}`).join('\n\n')}`;
  return <div className={styles.panel} data-testid="storyboard-card">
    <h3 className={styles.title}>{payload.title}</h3>
    {payload.scenes.map(scene => <div key={scene.id}>
      <strong>Scene {scene.sceneNumber}</strong>
      <p>{scene.description}</p>
      {scene.onScreenText && <p className={styles.muted}>Teks layar: {scene.onScreenText}</p>}
    </div>)}
    <CopyText text={text} label="Salin storyboard" />
  </div>;
}

/** Dispatch 9 jenis kartu notebook. Tiap cabang menyempitkan tipe union
 * NotebookResult, jadi kalau backend menambah kind baru tanpa renderer di sini,
 * tsc yang menangkap lebih dulu lewat cabang default. */
function Notebook({ result }: { result: NotebookResult }) {
  let body: React.ReactNode;
  switch (result.kind) {
    case 'quiz': body = <Quiz payload={result.payload} />; break;
    case 'flashcard': body = <Flashcards payload={result.payload} />; break;
    case 'summary-report': body = <SummaryReport payload={result.payload} />; break;
    case 'mindmap': body = <Mindmap payload={result.payload} />; break;
    case 'table': body = <FactTable payload={result.payload} />; break;
    case 'infographic': body = <Infographic payload={result.payload} />; break;
    case 'deck': body = <Deck payload={result.payload} />; break;
    case 'audio-overview-script': body = <AudioOverviewScript payload={result.payload} />; break;
    case 'video-storyboard': body = <VideoStoryboard payload={result.payload} />; break;
    default: body = <p className={styles.muted}>Jenis catatan ini belum punya tampilan khusus di studio.</p>;
  }
  return <>{body}<p className={styles.muted}>{result.provider} · {result.modelUsed}</p></>;
}

// video-003 (7 Sep, gap-fix video UX): render video normal makan 90-150 detik (bukti
// sesi lalu: render asli 93 detik), sementara gambar/audio biasanya selesai dalam
// hitungan detik. Sebelum fix ini, pesan "pending" SAMA PERSIS untuk ketiga kind --
// user yang tidak sempat baca teks durasi di form (yang hilang begitu submit) akan
// mengira sistem hang di detik ke-20-30, padahal itu wajar untuk video. Elapsed-seconds
// counter murni client-side (setInterval), tidak butuh perubahan backend/skema apapun.
function PendingStatus({ isVideo }: { isVideo: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isVideo) return;
    const timer = setInterval(() => setElapsed(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [isVideo]);
  if (!isVideo) return <div className={styles.panel} role="status">Sedang memproses permintaan. Hasil akan masuk ke chat ini.</div>;
  return <div className={styles.panel} role="status">
    <p>Render video biasanya makan waktu 1-3 menit -- ini normal, bukan macet. Jangan tutup tab; hasil tetap masuk ke chat ini walau panel studio ditutup.</p>
    <p className={styles.muted}>Sudah berjalan {elapsed} detik…</p>
  </div>;
}

export default function StudioResult({ message, onRetry }: { message: StudioMessage; onRetry: (submission: StudioSubmission) => void }) {
  const [previewError, setPreviewError] = useState('');
  if (message.pending) return <PendingStatus isVideo={message.submission?.type === 'media' && message.submission.request.kind === 'video'} />;
  const media = message.media;
  const valid = media && validMediaResult(media);
  return <div className={styles.panel} data-testid="studio-result">
    {message.failed && <p className={styles.error}>Permintaan belum berhasil. Anda bisa mencoba kembali.</p>}
    {message.draftScript && <><details open><summary>Draft script berhasil disimpan</summary><p style={{ whiteSpace: 'pre-wrap' }}>{message.draftScript}</p></details><CopyText text={message.draftScript} label="Salin draft script" /></>}
    {media && !valid && <p className={styles.error} role="alert">Server tidak mengembalikan media valid.</p>}
    {valid && media.kind === 'image' && <>
      {/* Generated base64 media is already served by the authenticated route. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.preview} src={media.dataUrl} alt={media.prompt || 'Hasil gambar Marketing'} onError={() => setPreviewError('Gambar gagal ditampilkan. Unduh file atau coba generate ulang.')} />
      <p className={styles.muted}>{media.prompt}</p>
    </>}
    {valid && media.kind === 'audio' && <>
      <audio className={styles.audio} controls src={media.dataUrl} aria-label="Hasil voiceover" onError={() => setPreviewError('Audio tidak dapat diputar di browser ini. Unduh MP3 atau coba generate ulang.')} />
      {media.script && <><details><summary>Script voiceover</summary><p style={{ whiteSpace: 'pre-wrap' }}>{media.script}</p></details><CopyText text={media.script} label="Salin script" /></>}
    </>}
    {valid && media.kind === 'video' && media.status === 'ready' && <>
      {/* Item 4.6 (7 Sep): tautan dari provider, bisa kedaluwarsa -- disebutkan di media.note. */}
      <video className={styles.preview} controls src={media.url} aria-label={media.prompt || 'Hasil video Marketing'} onError={() => setPreviewError('Video tidak dapat diputar di browser ini. Unduh file atau coba generate ulang.')} />
      <p className={styles.muted}>{media.prompt}</p>
      {media.note && <p className={styles.muted}>{media.note}</p>}
      <details>
        <summary>Detail teknis</summary>
        <p className={styles.muted}>{media.provider} · {media.modelUsed}{media.latencyMs !== undefined ? ` · ${(media.latencyMs / 1000).toFixed(1)} detik` : ''}{media.usage?.costUsd !== undefined ? ` · biaya nyata $${media.usage.costUsd}` : ''}</p>
      </details>
      {media.url && <a className={`${styles.button} ${styles.primary}`} href={media.url} target="_blank" rel="noopener noreferrer">Buka / unduh video</a>}
      <button type="button" className={styles.button} onClick={() => onRetry({ type: 'storyboard', request: { type: 'video-plan', role: 'marketing', brief: media.prompt || (message.submission?.type === 'media' ? message.submission.request.prompt : '') || '' } })}>Buat storyboard DOCX juga</button>
    </>}
    {valid && media.kind === 'video' && media.status === 'planned' && <>
      {/* video-005: badge dulu SELALU "Segera" (kesan coming-soon) walau job SUDAH genuinely
          dicoba ke provider dan gagal/timeout (video-001) -- membingungkan user yang mengira
          fiturnya belum pernah dibangun padahal cuma gagal kali ini. media.attempted (server,
          media-provider.ts) membedakan keduanya secara jujur. */}
      <span className={styles.badge}>{media.attempted ? 'Render video · Gagal, coba lagi' : 'Render video · Segera'}</span><p>{media.note || 'Render video live belum tersedia.'}</p>
      <button type="button" className={styles.button} onClick={() => onRetry({ type: 'storyboard', request: { type: 'video-plan', role: 'marketing', brief: media.prompt || (message.submission?.type === 'media' ? message.submission.request.prompt : '') || '' } })}>Buat storyboard DOCX</button>
    </>}
    {valid && media.kind !== 'video' && <>
      <details>
        <summary>Detail teknis</summary>
        <p className={styles.muted}>{media.provider || 'Provider tidak dilaporkan'} · {media.modelUsed || 'Model tidak dilaporkan'}{media.latencyMs !== undefined ? ` · ${(media.latencyMs / 1000).toFixed(1)} detik` : ''}{media.usage?.costUsd !== undefined ? ` · biaya nyata $${media.usage.costUsd}` : ''}</p>
      </details>
      {media.note && <p className={styles.muted}>{media.note}</p>}
      <a className={`${styles.button} ${styles.primary}`} href={media.dataUrl} download={media.fileName || `klir-media.${media.mimeType === 'audio/wav' ? 'wav' : media.mimeType === 'audio/mpeg' ? 'mp3' : media.mimeType === 'image/jpeg' ? 'jpg' : media.mimeType === 'image/webp' ? 'webp' : 'png'}`}>Unduh {media.kind === 'audio' ? 'audio' : 'gambar'} ({media.mimeType})</a>
    </>}
    {previewError && <p role="alert" className={styles.error}>{previewError}</p>}
    {message.notebook && <Notebook result={message.notebook} />}
    {message.submission && media?.kind !== 'video' && <button type="button" className={styles.button} onClick={() => onRetry(buildRetrySubmission(message.submission!, message.draftScript))}>{message.failed ? 'Coba kembali' : 'Buat ulang (request baru)'}</button>}
  </div>;
}

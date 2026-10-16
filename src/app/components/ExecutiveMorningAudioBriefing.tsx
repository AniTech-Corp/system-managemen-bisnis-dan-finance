'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { RoleDashboardPayload, RoleDashboardRole } from '@/lib/role-dashboard-contract';

interface ExecutiveMorningAudioBriefingProps {
  role: RoleDashboardRole;
  workspaceName: string;
  payload: RoleDashboardPayload | null;
  onOpenAI?: (prompt?: string) => void;
}

export default function ExecutiveMorningAudioBriefing({
  role,
  workspaceName,
  payload,
  onOpenAI,
}: ExecutiveMorningAudioBriefingProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate Executive Briefing Script based on actual payload
  const script = useMemo(() => {
    const today = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (!payload || payload.status === 'empty') {
      return `Selamat pagi pimpinan. Hari ini ${today}, pada ruang kerja ${workspaceName}. Sistem KLIR mendeteksi bahwa pembukuan baru saja disiapkan atau belum ada transaksi tercatat. Langkah pertama Anda hari ini: lakukan import rekening koran atau input saldo kas awal melalui Pusat Data. KLIR siap mengawal akselerasi bisnis Anda.`;
    }

    const metricsList = payload.snapshot && payload.snapshot.length > 0 ? payload.snapshot : payload.cards || [];
    const metricTexts = metricsList
      .slice(0, 3)
      .map((m: { label: string; value: number | null; detail?: string }) => {
        const valStr = m.value !== null ? new Intl.NumberFormat('id-ID').format(m.value) : (m.detail || 'tersedia');
        return `${m.label}: ${valStr}`;
      })
      .join('. ');

    let roleIntro = '';
    switch (role) {
      case 'CEO':
        roleIntro = `Berikut ringkasan kesehatan finansial dan pertumbuhan strategis untuk CEO.`;
        break;
      case 'FINANCE':
        roleIntro = `Berikut audit arus kas masuk, pengeluaran harian, serta mitigasi risiko likuiditas.`;
        break;
      case 'MANAGER_OPERASIONAL':
        roleIntro = `Berikut pantauan operasional gudang, efisiensi rantai pasok, dan pengadaan barang.`;
        break;
      case 'MANAGER_UMUM':
        roleIntro = `Berikut monitoring efisiensi tim, alokasi anggaran, dan tindak lanjut tugas tertunda.`;
        break;
      case 'SEKRETARIS':
        roleIntro = `Berikut agenda pimpinan, rekap surat kedinasan, dan tata kelola administrasi hari ini.`;
        break;
      default:
        roleIntro = `Berikut ringkasan indikator performa utama bisnis Anda.`;
    }

    return `Selamat pagi. Ini adalah executive morning audio briefing untuk ${workspaceName}, edisi ${today}. ${roleIntro} Indikator utama: ${metricTexts}. Disarankan untuk meninjau detail anomali atau membuka asisten AI KLIR untuk rekomendasi lanjutan hari ini. Selamat beraktivitas dan semoga target tercapai.`;
  }, [payload, role, workspaceName]);

  // Check speech synthesis support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSupported(true);
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const stopAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
  };

  const startAudio = () => {
    if (!speechSupported) {
      // Simulation mode if browser speech not supported
      setIsPlaying(true);
      setIsPaused(false);
      setProgress(0);
      const startTime = Date.now();
      const durationMs = 30000;
      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const currentProgress = Math.min(100, Math.round((elapsed / durationMs) * 100));
        setProgress(currentProgress);
        if (currentProgress >= 100) {
          stopAudio();
        }
      }, 500);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = 'id-ID';
    utterance.rate = 1.02; // natural cadence
    utterance.pitch = 1.0;

    // Try finding Indonesian voice
    const indonesianVoice = availableVoices.find(
      (v) => v.lang === 'id-ID' || v.lang.startsWith('id') || v.name.toLowerCase().includes('indonesia')
    );
    if (indonesianVoice) {
      utterance.voice = indonesianVoice;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      const estimatedDuration = Math.max(15, script.split(' ').length / 2.5); // ~2.5 words per sec
      const startTimestamp = Date.now();
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimestamp) / 1000;
        const p = Math.min(99, Math.round((elapsed / estimatedDuration) * 100));
        setProgress(p);
      }, 300);
    };

    utterance.onend = () => {
      stopAudio();
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    };

    utterance.onerror = () => {
      stopAudio();
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsPaused(false);
        } else {
          window.speechSynthesis.pause();
          setIsPaused(true);
        }
      } else {
        setIsPaused(!isPaused);
      }
    } else {
      startAudio();
    }
  };

  return (
    <div
      data-testid="executive-audio-briefing"
      style={{
        background: 'linear-gradient(90deg, rgba(20,27,45,0.85) 0%, rgba(13,17,28,0.92) 100%)',
        border: '1px solid rgba(99,102,241,0.22)',
        borderRadius: '14px',
        padding: '12px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
        {/* Left: Indicator & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: isPlaying && !isPaused
                ? 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)'
                : 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isPlaying && !isPaused ? '#FFFFFF' : '#A5B4FC',
              transition: 'all 0.2s ease',
            }}
          >
            {isPlaying && !isPaused ? <Volume2 size={18} className="animate-pulse" /> : <VolumeX size={18} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                Executive Morning Briefing
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  padding: '1.5px 6px',
                  borderRadius: '999px',
                  background: 'rgba(99,102,241,0.2)',
                  color: '#C7D2FE',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
              >
                AUDIO AI
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>
              {isPlaying
                ? isPaused
                  ? 'Audio terjeda'
                  : 'Memutar ringkasan eksekutif harian…'
                : 'Dengarkan ringkasan status bisnis Anda dalam 60 detik'}
            </p>
          </div>
        </div>

        {/* Center: Audio Waveform Animation (when active) */}
        {isPlaying && !isPaused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '20px' }}>
            {[40, 80, 55, 95, 70, 45, 85, 60, 90, 50].map((h, i) => (
              <span
                key={i}
                style={{
                  width: '2.5px',
                  height: `${h}%`,
                  background: 'linear-gradient(180deg, #818CF8 0%, #4F46E5 100%)',
                  borderRadius: '999px',
                  animation: `pulse ${(i % 3) * 0.2 + 0.6}s infinite ease-in-out alternate`,
                }}
              />
            ))}
          </div>
        )}

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={togglePlay}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid rgba(99,102,241,0.4)',
              background: isPlaying && !isPaused
                ? 'rgba(99,102,241,0.25)'
                : 'linear-gradient(180deg, rgba(99,102,241,0.3) 0%, rgba(99,102,241,0.15) 100%)',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isPlaying && !isPaused ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
            {isPlaying && !isPaused ? 'Jeda' : isPaused ? 'Lanjutkan' : 'Dengarkan Briefing'}
          </button>

          {isPlaying && (
            <button
              type="button"
              onClick={stopAudio}
              title="Reset Audio"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#94A3B8',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              height: '32px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: '#CBD5E1',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {showTranscript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Naskah
          </button>

          {onOpenAI && (
            <button
              type="button"
              onClick={() => onOpenAI('Analisis lebih lanjut temuan dari Executive Morning Briefing hari ini')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid rgba(245,158,11,0.3)',
                background: 'rgba(245,158,11,0.1)',
                color: '#FCD34D',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Sparkles size={12} />
              Tanya AI
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar when active */}
      {isPlaying && (
        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #6366F1 0%, #A855F7 100%)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Collapsible Transcript Drawer */}
      {showTranscript && (
        <div
          data-testid="audio-briefing-transcript"
          style={{
            marginTop: '4px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '12px',
            lineHeight: 1.6,
            color: '#CBD5E1',
            fontStyle: 'italic',
          }}
        >
          <span style={{ fontWeight: 600, color: '#A5B4FC', display: 'block', marginBottom: '4px', fontStyle: 'normal' }}>
            Transkrip Briefing Suara:
          </span>
          &ldquo;{script}&rdquo;
        </div>
      )}
    </div>
  );
}

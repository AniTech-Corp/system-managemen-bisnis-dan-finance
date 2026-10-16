'use client';

import React, { useState, useMemo } from 'react';
import { X, Send, Copy, Check, MessageSquare, AlertCircle, Smile, FileText, AlertTriangle } from 'lucide-react';

export type KasbonTone = 'RAMAH' | 'PROFESIONAL' | 'TEGAS';

interface KasbonWhatsAppComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRecipientName?: string;
  defaultPhone?: string;
  defaultAmount?: number;
  defaultReason?: string;
  defaultDueDate?: string;
}

export default function KasbonWhatsAppComposerModal({
  isOpen,
  onClose,
  defaultRecipientName = 'Rian Setiawan',
  defaultPhone = '081234567890',
  defaultAmount = 1500000,
  defaultReason = 'Operasional Lapangan & Kasbon Interim',
  defaultDueDate = '25 September 2026',
}: KasbonWhatsAppComposerModalProps) {
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [phone, setPhone] = useState(defaultPhone);
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [reason, setReason] = useState(defaultReason);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [tone, setTone] = useState<KasbonTone>('PROFESIONAL');
  const [copied, setCopied] = useState(false);

  const formattedAmount = useMemo(() => {
    const num = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }, [amount]);

  const generatedMessage = useMemo(() => {
    const name = recipientName.trim() || 'Rekan';
    const nominal = formattedAmount;
    const desc = reason.trim() || 'kebutuhan operasional';
    const due = dueDate.trim() || 'segera';

    if (tone === 'RAMAH') {
      return `Halo Mas/Mba *${name}*, semoga harinya menyenangkan! 🙏\n\nSekadar mengingatkan santai terkait pencatatan kasbon/piutang sementara untuk *${desc}* sebesar *${nominal}* yang tercatat jatuh tempo pada *${due}*.\n\nJika sudah ada waktu luang atau bukti penyelesaiannya siap, boleh dikabari atau dikirimkan ke tim keuangan ya. Terima kasih banyak atas kerja samanya! ✨`;
    }

    if (tone === 'TEGAS') {
      return `*PEMBERITAHUAN PENYELESAIAN TUNGGAKAN KASBON / PIUTANG*\nKepada Yth: *${name}*\n\nBerdasarkan audit buku kas internal per hari ini, kami mendapati kewajiban kasbon/piutang operasional untuk *${desc}* sebesar *${nominal}* telah melewati batas toleransi jatuh tempo (*${due}*).\n\nMohon segera melakukan konfirmasi dan pelunasan atau penyelesaian nota pertanggungjawaban dalam kurun waktu 1x24 jam kerja. Kegagalan tindak lanjut akan berdampak pada pembekuan fasilitas kasbon operasional berikutnya.\n\nHarap hubungi bagian keuangan/manajemen segera. Terima kasih.`;
    }

    // Default: PROFESIONAL
    return `Selamat siang Rekan *${name}*,\n\nMelalui pesan ini, kami dari bagian administrasi & keuangan ingin mengonfirmasi status pencatatan kasbon/piutang untuk *${desc}* sejumlah *${nominal}* yang dijadwalkan selesai pada tanggal *${due}*.\n\nMohon bantuannya untuk mengirimkan bukti transfer pelunasan atau kelengkapan kuitansi/nota riil sebelum batas tanggal tersebut agar rekonsiliasi buku kas akhir bulan tetap tertib dan seimbang.\n\nAtas perhatian dan kerja samanya kami ucapkan terima kasih.`;
  }, [recipientName, formattedAmount, reason, dueDate, tone]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSendWhatsApp = () => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }
    const encoded = encodeURIComponent(generatedMessage);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      data-testid="kasbon-wa-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(2, 6, 12, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        data-testid="kasbon-wa-modal"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#0D111A',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '18px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(37,211,102,0.12) 0%, rgba(20,27,45,0.4) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(37,211,102,0.2)',
                border: '1px solid rgba(37,211,102,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#25D366',
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                WhatsApp Reminder Kasbon &amp; Piutang
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>
                Generator pesan penagihan &amp; rekonsiliasi kasbon otomatis dengan 3 pilihan nada
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '6px',
              color: '#94A3B8',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '72vh', overflowY: 'auto' }}>
          {/* Tone Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#CBD5E1', marginBottom: '8px' }}>
              PILIH NADA PESAN (TONE):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setTone('RAMAH')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: tone === 'RAMAH' ? '1.5px solid #25D366' : '1px solid rgba(255,255,255,0.08)',
                  background: tone === 'RAMAH' ? 'rgba(37,211,102,0.15)' : 'rgba(255,255,255,0.02)',
                  color: tone === 'RAMAH' ? '#4ADE80' : '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}>
                  <Smile size={14} /> Ramah (H-3)
                </div>
                <span style={{ fontSize: '10px', color: '#64748B' }}>Pengingat santun sebelum jatuh tempo</span>
              </button>

              <button
                type="button"
                onClick={() => setTone('PROFESIONAL')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: tone === 'PROFESIONAL' ? '1.5px solid #60A5FA' : '1px solid rgba(255,255,255,0.08)',
                  background: tone === 'PROFESIONAL' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)',
                  color: tone === 'PROFESIONAL' ? '#93C5FD' : '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}>
                  <FileText size={14} /> Profesional (Hari H)
                </div>
                <span style={{ fontSize: '10px', color: '#64748B' }}>Formal rekonsiliasi pembukuan</span>
              </button>

              <button
                type="button"
                onClick={() => setTone('TEGAS')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: tone === 'TEGAS' ? '1.5px solid #F87171' : '1px solid rgba(255,255,255,0.08)',
                  background: tone === 'TEGAS' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.02)',
                  color: tone === 'TEGAS' ? '#FCA5A5' : '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}>
                  <AlertTriangle size={14} /> Tegas (&gt;14 Hari)
                </div>
                <span style={{ fontSize: '10px', color: '#64748B' }}>Audit ketat &amp; limitasi fasilitas</span>
              </button>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Nama Penerima / Karyawan</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Nomor WhatsApp (Contoh: 0812xxxx)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Nominal Kasbon / Piutang (Rp)</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Estimasi Jatuh Tempo</label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Deskripsi / Keperluan Kasbon</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#F8FAFC',
                fontSize: '12px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Live Preview Box */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#CBD5E1' }}>
                PRATINJAU FORMAT PESAN WHATSAPP:
              </label>
              <span style={{ fontSize: '10.5px', color: '#64748B' }}>Dapat langsung disalin atau dikirim</span>
            </div>
            <div
              style={{
                background: '#071610',
                border: '1px solid rgba(37,211,102,0.25)',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '12px',
                lineHeight: 1.6,
                color: '#E2E8F0',
                whiteSpace: 'pre-wrap',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {generatedMessage}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 22px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '11px' }}>
            <AlertCircle size={13} color="#25D366" />
            Nomor tujuan: <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{phone || '(Belum diisi)'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                color: copied ? '#4ADE80' : '#E2E8F0',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Tersalin!' : 'Salin Pesan'}
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                height: '36px',
                padding: '0 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#25D366',
                color: '#032612',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(37,211,102,0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <Send size={14} />
              Buka di WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

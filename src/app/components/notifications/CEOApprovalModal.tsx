'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  Wallet,
  Megaphone,
  User,
  Loader2,
  Check,
  Trash2,
} from 'lucide-react';
import { ApprovalRequest } from '@/lib/security-guardrail';

interface CEOApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  approvals: ApprovalRequest[];
  isLoading: boolean;
  onRefresh: () => void;
}

export default function CEOApprovalModal({
  isOpen,
  onClose,
  workspaceId,
  approvals,
  isLoading,
  onRefresh,
}: CEOApprovalModalProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleDecision = async (request: ApprovalRequest, decision: 'APPROVED' | 'REJECTED') => {
    setProcessingId(request.id);
    setFeedback(null);

    try {
      const res = await fetch('/api/v1/security/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          workspaceId,
          decision,
          resolvedBy: 'Owner / CEO',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          id: request.id,
          type: 'success',
          message:
            decision === 'APPROVED'
              ? `Permintaan #${request.ticketNumber} disetujui dan berhasil dieksekusi.`
              : `Permintaan #${request.ticketNumber} telah ditolak.`,
        });

        // Trigger global state updates
        if (decision === 'APPROVED') {
          window.dispatchEvent(new Event('klir-kas-updated'));
          // 8 Sep 2026: dulu blok ini menol-kan cache kas untuk SEMUA actionType approval
          // (termasuk DELETE_PROFILE & PURGE_INVOICES yang tidak menyentuh kas sama sekali) --
          // temuan F5 audit 8 Sep. Digate ke PURGE_FINANCE saja supaya dashboard Finance/CEO
          // tidak salah tampil Rp 0 saat yang disetujui cuma hapus profil/invoice.
          if (request.actionType === 'PURGE_FINANCE') {
            try {
              const saved = localStorage.getItem('klir_live_company_state');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.financials) {
                  parsed.financials.cleanCashBalance = 0;
                  parsed.financials.netCashBalance = 0;
                  parsed.financials.revenue30d = 0;
                  parsed.financials.expense30d = 0;
                  localStorage.setItem('klir_live_company_state', JSON.stringify(parsed));
                  window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
                }
              }
            } catch (e) {}
          }
        }
        window.dispatchEvent(new Event('klir-approval-updated'));

        setTimeout(() => {
          onRefresh();
          setFeedback(null);
        }, 1200);
      } else {
        setFeedback({
          id: request.id,
          type: 'error',
          message: data.message || 'Gagal memproses keputusan otorisasi.',
        });
      }
    } catch (err: any) {
      setFeedback({
        id: request.id,
        type: 'error',
        message: err.message || 'Koneksi bermasalah saat memproses otorisasi.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const r = role.toUpperCase();
    if (r.includes('FIN')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'rgba(63, 191, 143, 0.15)',
            border: 0,
            color: '#3FBF8F',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <Wallet className="w-3 h-3" />
          Finance Controller
        </span>
      );
    }
    if (r.includes('MKT') || r.includes('MARKET')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'rgba(242, 168, 59, 0.15)',
            border: 0,
            color: '#F2A83B',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <Megaphone className="w-3 h-3" />
          Marketing Lead
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 8px',
          borderRadius: '6px',
          background: 'rgba(78, 155, 255, 0.15)',
          border: 0,
          color: '#4E9BFF',
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        <User className="w-3 h-3" />
        {role}
      </span>
    );
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch (e) {
      return 'Baru saja';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(3, 5, 8, 0.78)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sap-fiori-tile"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(141, 85, 232, 0.2)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header ala SAP My Inbox */}
        <div
          style={{
            padding: '18px 22px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
                boxShadow: '0 0 16px rgba(239, 68, 68, 0.2)',
              }}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 700,
                    fontFamily: "'Outfit', sans-serif",
                    color: '#F5F7FA',
                    letterSpacing: '0.02em',
                  }}
                >
                  My Inbox: Workflow Otorisasi CEO
                </h3>
                <span className={approvals.length > 0 ? 'sap-status-pill sap-status-pill-danger' : 'sap-status-pill sap-status-pill-safe'}>
                  <span className="sap-pulse-dot" style={{ background: approvals.length > 0 ? '#EF4444' : '#00E676' }} />
                  <span>{approvals.length} Tiket Pending</span>
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '11.5px', color: '#8A93A3' }}>
                Single point of truth untuk verifikasi dan otorisasi tindakan berisiko tinggi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.09)',
              border: 0,
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8A93A3',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '20px 22px',
            overflowY: 'auto',
            maxHeight: 'calc(88vh - 130px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px' }}>
              <Loader2 className="w-6 h-6 animate-spin text-[#4E9BFF]" />
              <span style={{ fontSize: '12.5px', color: '#8A93A3' }}>Memeriksa tiket otorisasi...</span>
            </div>
          ) : approvals.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(63, 191, 143, 0.16)',
                  border: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3FBF8F',
                }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#F5F7FA' }}>
                  Semua Sistem Aman & Terkendali
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#8A93A3', maxWidth: '380px' }}>
                  Tidak ada permintaan otorisasi penghapusan atau tindakan berisiko tinggi yang tertunda saat ini.
                </p>
              </div>
            </div>
          ) : (
            approvals.map((req) => (
              <div
                key={req.id}
                style={{
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: 0,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getRoleBadge(req.requesterRole)}
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: '#8A93A3',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      #{req.ticketNumber}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#8A93A3' }}>
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(req.createdAt)}</span>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle className="w-4 h-4 text-[#F87171]" />
                    {req.title}
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#B9C2CF', lineHeight: 1.4 }}>
                    {req.description}
                  </p>
                </div>

                {/* Original Prompt from AI Chat */}
                {req.originalPrompt && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '11.5px',
                      color: '#9FC6FF',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <span style={{ color: '#8A93A3', fontSize: '10.5px', display: 'block', marginBottom: '2px' }}>
                      Pesan Asli ke AI Asisten:
                    </span>
                    &ldquo;{req.originalPrompt}&rdquo;
                  </div>
                )}

                {/* Warning Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: 0,
                    fontSize: '11px',
                    color: '#FCA5A5',
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 flex-shrink-0 text-[#EF4444]" />
                  <span>
                    Jika disetujui, tindakan ini akan <strong>menghapus data secara permanen</strong> dari basis data dan tidak dapat dipulihkan.
                  </span>
                </div>

                {/* Feedback Message if any */}
                {feedback && feedback.id === req.id && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 500,
                      background: feedback.type === 'success' ? 'rgba(63, 191, 143, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: 0,
                      color: feedback.type === 'success' ? '#3FBF8F' : '#F87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>{feedback.message}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                  <button
                    type="button"
                    disabled={processingId === req.id}
                    onClick={() => handleDecision(req, 'REJECTED')}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 0,
                      color: '#F87171',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: processingId === req.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                    Tolak Permintaan
                  </button>

                  <button
                    type="button"
                    disabled={processingId === req.id}
                    onClick={() => handleDecision(req, 'APPROVED')}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #059669, #10B981)',
                      border: 0,
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 600,
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                      cursor: processingId === req.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {processingId === req.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Mengeksekusi...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Setujui &amp; Eksekusi
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

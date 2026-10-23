'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, Clock, User, FileText, Eye, AlertTriangle, Loader2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Role, ExpenseRequestStatus, ExpenseApprovalStatus, ExpenseDecision } from '@prisma/client';
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_COLORS, EXPENSE_CATEGORY_LABELS, hasMinRole } from '@/lib/expense-approval-engine';
import { formatRupiah } from '@/lib/utils';
import { ExpenseRequest, ExpenseRequestItem, ExpenseApproval } from '@/lib/expense-approval-types';

interface ExpenseRequestDetailProps {
  request: ExpenseRequest;
  userRole: Role;
  userId: string;
  onClose: () => void;
  onApprove?: (requestId: string, level: number, reason: string) => Promise<void>;
  onReject?: (requestId: string, level: number, reason: string) => Promise<void>;
  onFinanceReview?: (requestId: string, decision: 'APPROVE_TO_NEXT' | 'REJECT' | 'REQUEST_REVISION', notes: string) => Promise<void>;
  onCancel?: (requestId: string) => Promise<void>;
  isLoading?: boolean;
}

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

const getStatusBadge = (status: ExpenseRequestStatus) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 600,
      background: `${EXPENSE_STATUS_COLORS[status]}20`,
      color: EXPENSE_STATUS_COLORS[status],
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 9999,
        background: EXPENSE_STATUS_COLORS[status],
      }}
    />
    {EXPENSE_STATUS_LABELS[status]}
  </span>
);

const getApprovalStatusBadge = (status: ExpenseApprovalStatus, decision?: ExpenseDecision) => {
  if (status === 'DECIDED') {
    return decision === 'APPROVED' ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
        <CheckCircle2 className="w-3 h-3" /> Disetujui
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
        <XCircle className="w-3 h-3" /> Ditolak
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded animate-pulse">
        <Clock className="w-3 h-3" /> Menunggu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded">
      Dilewati
    </span>
  );
};

export default function ExpenseRequestDetail({
  request,
  userRole,
  userId,
  onClose,
  onApprove,
  onReject,
  onFinanceReview,
  onCancel,
  isLoading = false,
}: ExpenseRequestDetailProps) {
  const [showReason, setShowReason] = useState<{ approve: boolean; reject: boolean }>({ approve: false, reject: false });
  const [reason, setReason] = useState({ approve: '', reject: '' });
  const [financeDecision, setFinanceDecision] = useState<'APPROVE_TO_NEXT' | 'REJECT' | 'REQUEST_REVISION'>('APPROVE_TO_NEXT');
  const [financeNotes, setFinanceNotes] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const isRequester = request.requester?.id === userId;
  const isFinance = ['FINANCE', 'ADMIN', 'OWNER'].includes(userRole);
  const isApprover = request.status === 'PENDING_APPROVAL' && 
    request.approvals[request.currentLevel - 1]?.requiredRole &&
    hasMinRole(userRole, request.approvals[request.currentLevel - 1].requiredRole);

  const handleApprove = async () => {
    if (!reason.approve.trim()) return;
    const currentLevel = request.currentLevel;
    setProcessingAction('approve');
    try {
      await onApprove?.(request.id, currentLevel, reason.approve.trim());
      setShowReason(prev => ({ ...prev, approve: false }));
      setReason(prev => ({ ...prev, approve: '' }));
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async () => {
    if (!reason.reject.trim()) return;
    const currentLevel = request.currentLevel;
    setProcessingAction('reject');
    try {
      await onReject?.(request.id, currentLevel, reason.reject.trim());
      setShowReason(prev => ({ ...prev, reject: false }));
      setReason(prev => ({ ...prev, reject: '' }));
    } finally {
      setProcessingAction(null);
    }
  };

  const handleFinanceReview = async () => {
    if (financeDecision !== 'APPROVE_TO_NEXT' && !financeNotes.trim()) return;
    setProcessingAction('finance');
    try {
      await onFinanceReview?.(request.id, financeDecision, financeNotes.trim());
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Yakin ingin membatalkan pengajuan ini?')) return;
    setProcessingAction('cancel');
    try {
      await onCancel?.(request.id);
    } finally {
      setProcessingAction(null);
    }
  };

  const currentApproval = request.approvals[request.currentLevel - 1];
  const isLastLevel = request.currentLevel === request.approvals.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">{request.requestNumber}</span>
              <h2 className="text-lg font-semibold text-slate-900">{request.title}</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">{request.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(request.status)}
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Header Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Kategori</p>
              <p className="text-sm font-medium text-slate-900 mt-1">{EXPENSE_CATEGORY_LABELS[request.category]}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Amount</p>
              <p className="text-xl font-bold font-mono text-emerald-700 mt-1">{formatRupiah(request.totalAmount)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pengaju</p>
              <div className="mt-1 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-900">{request.requester?.fullName || 'Tidak diketahui'}</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dibuat</p>
              <p className="text-sm font-medium text-slate-900 mt-1">{formatDateTime(request.createdAt)}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Detail Item</h3>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Deskripsi</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Harga Satuan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Subtotal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Akun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {request.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.description}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-slate-700">{item.quantity.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-slate-700">{formatRupiah(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono font-semibold text-slate-900">{formatRupiah(item.totalPrice)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono">{item.accountCode || '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm">Total</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-emerald-700">{formatRupiah(request.totalAmount)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Receipts */}
          {request.receiptUrls.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Bukti Transaksi</h3>
              <div className="flex flex-wrap gap-3">
                {request.receiptUrls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative w-28 h-28 rounded-lg overflow-hidden border border-slate-200"
                  >
                    {url.startsWith('data:image') ? (
                      <img src={url} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <FileText className="w-10 h-10 text-slate-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Timeline</h3>
            <div className="relative pl-6 border-l border-slate-200">
              {[
                { label: 'Draft dibuat', date: request.createdAt, icon: FileText, color: 'text-slate-400' },
                { label: 'Diajukan', date: request.submittedAt, icon: FileText, color: 'text-blue-500', condition: request.submittedAt },
                { label: 'Finance Review', date: request.financeReviewedAt, icon: AlertTriangle, color: 'text-amber-500', condition: request.financeReviewedAt },
                { label: 'Disetujui', date: request.approvedAt, icon: CheckCircle2, color: 'text-emerald-500', condition: request.approvedAt },
                { label: 'Ditolak', date: request.rejectedAt, icon: XCircle, color: 'text-red-500', condition: request.rejectedAt },
              ].map((event, idx) => (
                event.condition && (
                  <div key={event.label} className="relative pb-6 last:pb-0">
                    <div className="absolute left-[-22px] top-1 w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: event.color.replace('text-', 'bg-') }}>
                      <event.icon className="w-2.5 h-2.5 text-white mx-auto my-0.5" />
                    </div>
                    <p className="text-xs font-medium text-slate-700">{event.label}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(event.date)}</p>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Approval Chain */}
          {request.requiredLevels > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Rantai Persetujuan</h3>
              <div className="space-y-3">
                {request.approvals.map((approval, idx) => {
                  const isCurrent = request.status === 'PENDING_APPROVAL' && request.currentLevel === approval.level;
                  const isDone = approval.status === 'DECIDED' && approval.decision === 'APPROVED';
                  const isRejected = approval.status === 'DECIDED' && approval.decision === 'REJECTED';
                  const isPending = approval.status === 'PENDING';
                  const isSkipped = approval.status === 'SKIPPED';

                  return (
                    <div
                      key={approval.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition ${
                        isCurrent ? 'bg-emerald-50 border-emerald-200' :
                        isDone ? 'bg-green-50 border-green-200' :
                        isRejected ? 'bg-red-50 border-red-200' :
                        isSkipped ? 'bg-slate-50 border-slate-200' :
                        'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        isCurrent ? 'bg-emerald-100 text-emerald-700 animate-pulse' :
                        isDone ? 'bg-green-100 text-green-700' :
                        isRejected ? 'bg-red-100 text-red-700' :
                        isSkipped ? 'bg-slate-100 text-slate-400' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : isRejected ? <XCircle className="w-5 h-5" /> : approval.level}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">Level {approval.level}: {approval.requiredRole}</span>
                          {getApprovalStatusBadge(approval.status, approval.decision)}
                        </div>
                        {approval.approver && (
                          <div className="text-xs text-slate-500 mt-1">
                            {approval.decision === 'APPROVED' ? 'Disetujui oleh' : 
                             approval.decision === 'REJECTED' ? 'Ditolak oleh' : 
                             'Menunggu'} <span className="font-medium">{approval.approver.fullName}</span>
                            {approval.decidedAt && <span className="ml-2">• {formatDateTime(approval.decidedAt)}</span>}
                          </div>
                        )}
                        {approval.reason && (
                          <div className="text-xs text-slate-600 mt-1 italic">
                            Alasan: {approval.reason}
                          </div>
                        )}
                      </div>

                      {/* Action buttons for current approver */}
                      {isCurrent && isApprover && (
                        <div className="flex items-center gap-2">
                          {!showReason.approve && !showReason.reject && (
                            <>
                              <button
                                onClick={() => setShowReason(prev => ({ ...prev, approve: true }))}
                                disabled={processingAction === 'approve'}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                {processingAction === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Setujui'}
                              </button>
                              <button
                                onClick={() => setShowReason(prev => ({ ...prev, reject: true }))}
                                disabled={processingAction === 'reject'}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition disabled:opacity-50"
                              >
                                Tolak
                              </button>
                            </>
                          )}

                          {showReason.approve && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Alasan persetujuan (wajib)"
                                value={reason.approve}
                                onChange={e => setReason(prev => ({ ...prev, approve: e.target.value }))}
                                className="px-3 py-1.5 text-xs border border-slate-300 rounded w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                onKeyDown={e => e.key === 'Enter' && handleApprove()}
                              />
                              <button
                                onClick={handleApprove}
                                disabled={processingAction === 'approve' || !reason.approve.trim()}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                {processingAction === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Kirim'}
                              </button>
                              <button
                                onClick={() => setShowReason(prev => ({ ...prev, approve: false }))}
                                className="p-1.5 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {showReason.reject && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Alasan penolakan (wajib)"
                                value={reason.reject}
                                onChange={e => setReason(prev => ({ ...prev, reject: e.target.value }))}
                                className="px-3 py-1.5 text-xs border border-slate-300 rounded w-48 focus:outline-none focus:ring-2 focus:ring-red-500"
                                onKeyDown={e => e.key === 'Enter' && handleReject()}
                              />
                              <button
                                onClick={handleReject}
                                disabled={processingAction === 'reject' || !reason.reject.trim()}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition disabled:opacity-50"
                              >
                                {processingAction === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Kirim'}
                              </button>
                              <button
                                onClick={() => setShowReason(prev => ({ ...prev, reject: false }))}
                                className="p-1.5 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Finance Review Section */}
          {request.status === 'FINANCE_REVIEW' && isFinance && (
            <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Finance Review Required
              </h3>
              <p className="text-sm text-amber-700">Sebagai Finance, silakan review pengajuan ini sebelum diteruskan ke approval berjenjang.</p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Keputusan</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'APPROVE_TO_NEXT', label: 'Lanjut ke Approval', color: 'bg-emerald-600' },
                      { value: 'REJECT', label: 'Tolak', color: 'bg-red-600' },
                      { value: 'REQUEST_REVISION', label: 'Minta Revisi', color: 'bg-blue-600' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFinanceDecision(opt.value as any)}
                        className={`px-4 py-2 text-sm font-medium rounded transition ${
                          financeDecision === opt.value
                            ? `${opt.color} text-white`
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(financeDecision !== 'APPROVE_TO_NEXT') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Catatan (Wajib untuk Tolak/Revisi)</label>
                    <textarea
                      value={financeNotes}
                      onChange={e => setFinanceNotes(e.target.value)}
                      rows={3}
                      placeholder="Jelaskan alasan penolakan atau revisi yang diminta..."
                      className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <button
                  onClick={handleFinanceReview}
                  disabled={processingAction === 'finance' || (financeDecision !== 'APPROVE_TO_NEXT' && !financeNotes.trim())}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingAction === 'finance' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim Review'}
                </button>
              </div>
            </div>
          )}

          {/* Finance Notes Display */}
          {request.financeNotes && request.status !== 'FINANCE_REVIEW' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Catatan Finance
              </h4>
              <p className="text-sm text-blue-700 mt-1">{request.financeNotes}</p>
              {request.financeReviewer && (
                <p className="text-xs text-blue-600 mt-1">Oleh: {request.financeReviewer.fullName} • {formatDateTime(request.financeReviewedAt)}</p>
              )}
            </div>
          )}

          {/* Action Buttons for Requester */}
          {isRequester && ['DRAFT'].includes(request.status) && (
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={handleCancel}
                disabled={processingAction === 'cancel'}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition disabled:opacity-50 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Batalkan Pengajuan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
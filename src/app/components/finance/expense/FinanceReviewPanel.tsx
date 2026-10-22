'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, MessageSquare, Loader2, FileText, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Role } from '@prisma/client';
import { EXPENSE_CATEGORY_LABELS, hasMinRole } from '@/lib/expense-approval-engine';
import { formatRupiah } from '@/lib/utils';
import { ExpenseRequest } from '@/lib/expense-approval-types';

interface FinanceReviewPanelProps {
  request: ExpenseRequest;
  userRole: Role;
  userId: string;
  onReview: (requestId: string, decision: 'APPROVE_TO_NEXT' | 'REJECT' | 'REQUEST_REVISION', notes: string) => Promise<void>;
  isLoading?: boolean;
}

export default function FinanceReviewPanel({ request, userRole, userId, onReview, isLoading = false }: FinanceReviewPanelProps) {
  const [decision, setDecision] = useState<'APPROVE_TO_NEXT' | 'REJECT' | 'REQUEST_REVISION'>('APPROVE_TO_NEXT');
  const [notes, setNotes] = useState('');
  const [showReason, setShowReason] = useState(false);

  const isFinance = ['FINANCE', 'ADMIN', 'OWNER'].includes(userRole);

  if (!isFinance) return null;

  const handleSubmit = async () => {
    if ((decision !== 'APPROVE_TO_NEXT' && !notes.trim()) || isLoading) return;
    await onReview(request.id, decision, notes.trim());
    setNotes('');
    setShowReason(false);
  };

  const currentApproval = request.approvals[request.currentLevel - 1];
  const isLastLevel = request.currentLevel === request.approvals.length;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-amber-100 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-amber-900">Finance Review Required</h3>
          <p className="text-sm text-amber-700 mt-1">
            Sebagai tim Finance, silakan review pengajuan ini sebelum diteruskan ke persetujuan berjenjang.
            {request.requiredLevels > 0 && (
              <span className="ml-2">Akan lanjut ke {request.approvals.length} level approval: {request.approvals.map(a => a.requiredRole).join(' → ')}</span>
            )}
          </p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-amber-200">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Kategori</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{EXPENSE_CATEGORY_LABELS[request.category]}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Amount</p>
          <p className="text-lg font-bold font-mono text-emerald-700 mt-1">{formatRupiah(request.totalAmount)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pengaju</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{request.requester.fullName}</p>
        </div>
      </div>

      {/* Decision Buttons */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Keputusan Review</label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'APPROVE_TO_NEXT' as const, label: 'Lanjut ke Approval', icon: CheckCircle2, color: 'bg-emerald-600 hover:bg-emerald-700', desc: 'Lolos review, lanjut ke level approval berikutnya' },
            { value: 'REJECT' as const, label: 'Tolak', icon: XCircle, color: 'bg-red-600 hover:bg-red-700', desc: 'Tolak pengajuan ini sepenuhnya' },
            { value: 'REQUEST_REVISION' as const, label: 'Minta Revisi', icon: MessageSquare, color: 'bg-blue-600 hover:bg-blue-700', desc: 'Kembalikan ke pengaju untuk perbaikan' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setDecision(opt.value); setShowReason(true); }}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                decision === opt.value
                  ? `${opt.color} text-white border-transparent`
                  : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
              }`}
            >
              <opt.icon className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs opacity-80">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Notes Required for Reject/Revision */}
      {(decision !== 'APPROVE_TO_NEXT') && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Catatan / Alasan <span className="text-red-500">*</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder={decision === 'REJECT' 
              ? 'Jelaskan alasan penolakan pengajuan ini...' 
              : 'Jelaskan revisi apa yang diminta dari pengaju...'}
            className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            disabled={isLoading}
          />
          <p className="text-xs text-slate-500">Catatan wajib diisi untuk keputusan Tolak atau Minta Revisi</p>
        </div>
      )}

      {/* Approve Notes Optional */}
      {decision === 'APPROVE_TO_NEXT' && showReason && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Catatan Persetujuan (Opsional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Tambahkan catatan untuk approver level selanjutnya (opsional)..."
            className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            disabled={isLoading}
          />
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || (decision !== 'APPROVE_TO_NEXT' && !notes.trim())}
        className="w-full px-6 py-3 text-base font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Memproses...
          </>
        ) : (
          <>
            {decision === 'APPROVE_TO_NEXT' ? <CheckCircle2 className="w-5 h-5" /> : decision === 'REJECT' ? <XCircle className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            {decision === 'APPROVE_TO_NEXT' ? 'Lanjut ke Approval' : decision === 'REJECT' ? 'Tolak Pengajuan' : 'Minta Revisi'}
          </>
        )}
      </button>

      {/* Preview Next Steps */}
      {decision === 'APPROVE_TO_NEXT' && request.requiredLevels > 0 && (
        <div className="pt-4 border-t border-amber-200">
          <h4 className="text-sm font-medium text-amber-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Langkah Selanjutnya
          </h4>
          <div className="space-y-2">
            {request.approvals.map((approval, idx) => {
              const lvl = idx + 1;
              const isCurrent = request.currentLevel === lvl;
              const isDone = approval.status === 'DECIDED' && approval.decision === 'APPROVED';
              const isRejected = approval.status === 'DECIDED' && approval.decision === 'REJECTED';
              
              return (
                <div 
                  key={approval.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isCurrent ? 'bg-emerald-50 border border-emerald-200' :
                    isDone ? 'bg-green-50' :
                    isRejected ? 'bg-red-50' :
                    'bg-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCurrent ? 'bg-emerald-100 text-emerald-700 animate-pulse' :
                    isDone ? 'bg-green-100 text-green-700' :
                    isRejected ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : isRejected ? <XCircle className="w-4 h-4" /> : lvl}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">Level {lvl}: {approval.requiredRole}</p>
                    <p className="text-xs text-slate-500">
                      {isCurrent ? 'Sedang menunggu persetujuan' :
                       isDone ? `Disetujui oleh ${approval.approver?.fullName || 'N/A'}` :
                       isRejected ? `Ditolak oleh ${approval.approver?.fullName || 'N/A'}` :
                       'Menunggu level sebelumnya'}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                      Berikutnya
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, AlertTriangle, CheckCircle2, XCircle, User, FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Role, ExpenseRequestStatus } from '@prisma/client';
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_COLORS, EXPENSE_CATEGORY_LABELS, hasMinRole } from '@/lib/expense-approval-engine';
import { formatRupiah } from '@/lib/utils';
import { ExpenseRequest, ExpenseRequestItem, ExpenseApproval } from '@/lib/expense-approval-types';
import ExpenseRequestDetail from './ExpenseRequestDetail';

interface MyApprovalsDashboardProps {
  workspaceId: string;
  userRole: Role;
  userId: string;
  onApprove: (requestId: string, level: number, reason: string) => Promise<void>;
  onReject: (requestId: string, level: number, reason: string) => Promise<void>;
  onRefresh?: () => void;
}

export default function MyApprovalsDashboard({
  workspaceId,
  userRole,
  userId,
  onApprove,
  onReject,
  onRefresh,
}: MyApprovalsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [pendingRequests, setPendingRequests] = useState<ExpenseRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ExpenseRequest | null>(null);
  const [page, setPage] = useState({ pending: 1, history: 1 });
  const [totalPages, setTotalPages] = useState({ pending: 1, history: 1 });

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/expense-requests/pending?tab=pending&page=${page.pending}&limit=10`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setPendingRequests(data.data.pending);
        setTotalPages(prev => ({ ...prev, pending: data.pagination.totalPages }));
      }
    } catch (err) {
      console.error('Failed to fetch pending:', err);
    }
  }, [page.pending]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/expense-requests/pending?tab=history&page=${page.history}&limit=10`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setHistoryRequests(data.data.history);
        setTotalPages(prev => ({ ...prev, history: data.pagination.totalPages }));
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, [page.history]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPending(), fetchHistory()]).finally(() => setLoading(false));
  }, [fetchPending, fetchHistory]);

  const getStatusBadge = (status: ExpenseRequestStatus) => (
    <Badge 
      variant="outline" 
      className="text-xs"
      style={{ 
        background: `${EXPENSE_STATUS_COLORS[status]}20`, 
        color: EXPENSE_STATUS_COLORS[status],
        borderColor: EXPENSE_STATUS_COLORS[status]
      }}
    >
      {EXPENSE_STATUS_LABELS[status]}
    </Badge>
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '-'; }
  };

  const renderRequestCard = (req: ExpenseRequest, isPending: boolean) => {
    const currentApproval = req.approvals[req.currentLevel - 1];
    const isMyTurn = isPending && currentApproval && hasMinRole(userRole, currentApproval.requiredRole);
    const isLastLevel = req.currentLevel === req.approvals.length;

    return (
      <div 
        key={req.id} 
        className={`rounded-xl border p-4 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/20 ${isPending ? 'bg-white' : 'bg-slate-50/70'}`}
        onClick={() => setSelectedRequest(req)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-medium text-slate-600">{req.requestNumber}</span>
              <h4 className="font-medium text-slate-900 truncate">{req.title}</h4>
              <span 
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{ background: `${EXPENSE_STATUS_COLORS[req.category]}20`, color: EXPENSE_STATUS_COLORS[req.category] }}
              >
                {EXPENSE_CATEGORY_LABELS[req.category]}
              </span>
              {getStatusBadge(req.status)}
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{req.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                {req.requester.fullName}
              </span>
              <span className="flex items-center gap-1 font-mono font-semibold tabular-nums text-emerald-800">
                {formatRupiah(req.totalAmount)}
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(req.submittedAt || req.createdAt)}
              </span>
            </div>
          </div>

          {isPending && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                Level {req.currentLevel} / {req.requiredLevels}
              </div>
              {isMyTurn && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Giliran Anda
                </span>
              )}
            </div>
          )}

          {!isPending && (
            <div className="flex flex-col items-end gap-2">
              <div className="text-xs text-slate-500">
                {req.status === 'APPROVED' ? 'Disetujui' : req.status === 'REJECTED' ? 'Ditolak' : 'Dibatalkan'}
              </div>
              <span className="text-xs text-slate-400">{formatDate(req.approvedAt || req.rejectedAt || req.updatedAt)}</span>
            </div>
          )}
        </div>

        {/* Approval progress indicator */}
        {req.requiredLevels > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              {req.approvals.map((approval, idx) => {
                const lvl = idx + 1;
                const isDone = approval.status === 'DECIDED' && approval.decision === 'APPROVED';
                const isRejected = approval.status === 'DECIDED' && approval.decision === 'REJECTED';
                const isCurrent = req.status === 'PENDING_APPROVAL' && req.currentLevel === lvl;
                const isSkipped = approval.status === 'SKIPPED';
                
                return (
                  <div key={approval.id} className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      isCurrent ? 'bg-emerald-100 text-emerald-700 animate-pulse' :
                      isDone ? 'bg-green-100 text-green-700' :
                      isRejected ? 'bg-red-100 text-red-700' :
                      isSkipped ? 'bg-slate-100 text-slate-400' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : isRejected ? <XCircle className="w-4 h-4" /> : lvl}
                    </div>
                    <span className="text-[10px] text-slate-500 text-center whitespace-nowrap">{approval.requiredRole}</span>
                    {lvl < req.approvals.length && (
                      <div className={`flex-1 h-0.5 mx-1 ${
                        isDone || isCurrent ? 'bg-emerald-300' : 
                        isRejected ? 'bg-red-300' : 
                        'bg-slate-200'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Persetujuan Pengeluaran</h2>
          <p className="mt-0.5 text-xs text-slate-500">Kelola persetujuan pengajuan dana menurut kewenangan Anda</p>
        </div>
        <button
          onClick={() => { fetchPending(); fetchHistory(); onRefresh?.(); }}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')} className="w-full">
        <TabsList className="flex h-auto w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <TabsTrigger value="pending" className="min-h-10 min-w-max flex-1 gap-1.5 rounded-lg px-2 text-xs sm:px-3">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Menunggu Saya ({pendingRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-10 min-w-max flex-1 gap-1.5 rounded-lg px-2 text-xs sm:px-3">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Riwayat Saya ({historyRequests.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-3">
          {loading && activeTab === 'pending' ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
              <span>Memuat...</span>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800">Tidak ada persetujuan menunggu</p>
              <p className="mt-1 text-xs">Semua pengajuan sudah diproses</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pendingRequests.map(req => renderRequestCard(req, true))}
              </div>
              {totalPages.pending > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(p => ({ ...p, pending: Math.max(1, p.pending - 1) }))}
                    disabled={page.pending === 1}
                    aria-label="Halaman sebelumnya"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="text-xs text-slate-500">Halaman {page.pending} / {totalPages.pending}</span>
                  <button
                    onClick={() => setPage(p => ({ ...p, pending: Math.min(totalPages.pending, p.pending + 1) }))}
                    disabled={page.pending === totalPages.pending}
                    aria-label="Halaman berikutnya"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-3">
          {loading && activeTab === 'history' ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
              <span>Memuat...</span>
            </div>
          ) : historyRequests.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
              <FileText className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800">Belum ada riwayat persetujuan</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {historyRequests.map(req => renderRequestCard(req, false))}
              </div>
              {totalPages.history > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(p => ({ ...p, history: Math.max(1, p.history - 1) }))}
                    disabled={page.history === 1}
                    aria-label="Halaman sebelumnya"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="text-xs text-slate-500">Halaman {page.history} / {totalPages.history}</span>
                  <button
                    onClick={() => setPage(p => ({ ...p, history: Math.min(totalPages.history, p.history + 1) }))}
                    disabled={page.history === totalPages.history}
                    aria-label="Halaman berikutnya"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
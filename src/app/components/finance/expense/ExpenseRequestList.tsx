'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Role, ExpenseRequestStatus, ExpenseCategory } from '@prisma/client';
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_COLORS, EXPENSE_CATEGORY_LABELS } from '@/lib/expense-approval-engine';
import { formatRupiah } from '@/lib/utils';
import { ExpenseRequest, ExpenseRequestItem, ExpenseApproval } from '@/lib/expense-approval-types';

interface ExpenseRequestListProps {
  workspaceId: string;
  userRole: Role;
  userId: string;
  onViewDetail?: (request: ExpenseRequest) => void;
  onEditDraft?: (request: ExpenseRequest) => void;
  onSubmitDraft?: (request: ExpenseRequest) => void;
  onCancel?: (requestId: string) => void;
  initialTab?: 'all' | 'my' | 'pending';
}

const STATUS_OPTIONS: { value: ExpenseRequestStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Diajukan' },
  { value: 'FINANCE_REVIEW', label: 'Review Finance' },
  { value: 'PENDING_APPROVAL', label: 'Menunggu Persetujuan' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
];

const CATEGORY_OPTIONS: { value: ExpenseCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Semua Kategori' },
  ...Object.values(ExpenseCategory).map(c => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] })),
];

export default function ExpenseRequestList({
  workspaceId,
  userRole,
  userId,
  onViewDetail,
  onEditDraft,
  onSubmitDraft,
  onCancel,
  initialTab = 'all',
}: ExpenseRequestListProps) {
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    status: 'ALL' as ExpenseRequestStatus | 'ALL',
    category: 'ALL' as ExpenseCategory | 'ALL',
    search: '',
    dateFrom: '',
    dateTo: '',
    tab: initialTab,
  });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
      });
      if (filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.tab === 'my') params.append('requesterId', userId);
      if (filters.tab === 'pending') {
        // For pending, we'll use a different endpoint or filter client-side
        params.append('status', 'PENDING_APPROVAL');
      }

      const res = await fetch(`/api/v1/expense-requests?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.expenseRequests);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch expense requests:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters, sortBy, sortOrder, userId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getStatusBadge = (status: ExpenseRequestStatus) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        background: `${EXPENSE_STATUS_COLORS[status]}20`,
        color: EXPENSE_STATUS_COLORS[status],
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: EXPENSE_STATUS_COLORS[status],
        }}
      />
      {EXPENSE_STATUS_LABELS[status]}
    </span>
  );

  const getCategoryBadge = (category: ExpenseCategory) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 500,
        background: '#F1F5F9',
        color: '#475569',
      }}
    >
      {EXPENSE_CATEGORY_LABELS[category]}
    </span>
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
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

  const canEdit = (req: ExpenseRequest) => req.status === 'DRAFT' && req.requester.id === userId;
  const canSubmit = (req: ExpenseRequest) => req.status === 'DRAFT' && req.requester.id === userId;
  const canCancel = (req: ExpenseRequest) => 
    (req.requester.id === userId || ['ADMIN', 'OWNER'].includes(userRole)) &&
    !['APPROVED', 'REJECTED', 'CANCELLED'].includes(req.status);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Cari judul, nomor, pengaju..."
            aria-label="Cari pengajuan"
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex">
          <select
            value={filters.tab}
            aria-label="Filter pemilik pengajuan"
            onChange={e => handleFilterChange('tab', e.target.value)}
            className="h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <option value="all">Semua</option>
            <option value="my">Pengajuan Saya</option>
            <option value="pending">Menunggu Persetujuan</option>
          </select>

          <select
            value={filters.status}
            aria-label="Filter status"
            onChange={e => handleFilterChange('status', e.target.value)}
            className="h-10 min-w-40 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.category}
            aria-label="Filter kategori"
            onChange={e => handleFilterChange('category', e.target.value)}
            className="h-10 min-w-40 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => handleFilterChange('dateFrom', e.target.value)}
              aria-label="Tanggal dari"
              className="h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              title="Dari tanggal"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => handleFilterChange('dateTo', e.target.value)}
              aria-label="Tanggal sampai"
              className="h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              title="Sampai tanggal"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
            <span>Memuat pengajuan...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-500">
            <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-700">Tidak ada pengajuan pengeluaran</p>
            <p className="mt-1 text-xs">Coba ubah filter atau buat pengajuan baru.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70">
                  <tr>
                    {[
                      { key: 'requestNumber', label: 'Nomor' },
                      { key: 'title', label: 'Judul' },
                      { key: 'category', label: 'Kategori' },
                      { key: 'requester', label: 'Pengaju' },
                      { key: 'totalAmount', label: 'Total' },
                      { key: 'status', label: 'Status' },
                      { key: 'currentLevel', label: 'Level' },
                      { key: 'createdAt', label: 'Dibuat' },
                      { key: 'actions', label: 'Aksi' },
                    ].map(col => (
                      <th
                        key={col.key}
                        className="cursor-pointer px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
                        onClick={() => handleSort(col.key)}
                        style={{ userSelect: 'none' }}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortBy === col.key && (
                            sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map(req => (
                    <React.Fragment key={req.id}>
                      <tr
                        className={`cursor-pointer transition-colors ${expandedRow === req.id ? 'bg-emerald-50/70' : 'hover:bg-slate-50/70'}`}
                        onClick={() => setExpandedRow(prev => prev === req.id ? null : req.id)}
                      >
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="font-mono text-xs font-medium text-slate-600">{req.requestNumber}</span>
                        </td>
                        <td className="max-w-xs px-3 py-3">
                          <div className="font-medium text-slate-900 truncate max-w-xs">{req.title}</div>
                          <div className="text-xs text-slate-500 truncate max-w-xs">{req.description}</div>
                        </td>
                        <td className="px-3 py-3">{getCategoryBadge(req.category)}</td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-slate-900">{req.requester.fullName}</div>
                          <div className="text-xs text-slate-500">{req.requester.email}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                          {formatRupiah(req.totalAmount)}
                        </td>
                        <td className="px-3 py-3">{getStatusBadge(req.status)}</td>
                        <td className="px-3 py-3 text-center">
                          {req.requiredLevels > 0 && (
                            <div className="flex justify-center gap-1">
                              {Array.from({ length: req.requiredLevels }, (_, i) => i + 1).map(lvl => {
                                const approval = req.approvals.find(a => a.level === lvl);
                                const isCurrent = req.currentLevel === lvl && req.status === 'PENDING_APPROVAL';
                                const isDone = approval?.status === 'DECIDED' && approval?.decision === 'APPROVED';
                                const isRejected = approval?.status === 'DECIDED' && approval?.decision === 'REJECTED';
                                return (
                                  <div
                                    key={lvl}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                      isCurrent ? 'bg-emerald-100 text-emerald-700 animate-pulse' :
                                      isDone ? 'bg-green-100 text-green-700' :
                                      isRejected ? 'bg-red-100 text-red-700' :
                                      'bg-slate-100 text-slate-400'
                                    }`}
                                    title={approval ? `${approval.requiredRole}: ${approval.status}` : `Level ${lvl}`}
                                  >
                                    {isDone ? <CheckCircle2 className="w-3 h-3" /> : isRejected ? <XCircle className="w-3 h-3" /> : lvl}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                          {formatDate(req.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); onViewDetail?.(req); }}
                              aria-label="Lihat detail"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              title="Lihat detail"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {canEdit(req) && onEditDraft && (
                              <button
                                onClick={e => { e.stopPropagation(); onEditDraft(req); }}
                                aria-label="Edit draft"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                title="Edit draft"
                              >
                                <Edit className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            {canSubmit(req) && onSubmitDraft && (
                              <button
                                onClick={e => { e.stopPropagation(); onSubmitDraft(req); }}
                                aria-label="Ajukan draft"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                title="Ajukan"
                              >
                                <FileText className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            {canCancel(req) && onCancel && (
                              <button
                                onClick={e => { e.stopPropagation(); onCancel(req.id); }}
                                aria-label="Batalkan pengajuan"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                title="Batalkan"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {expandedRow === req.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-slate-700">Detail Items</h4>
                                <div className="space-y-1">
                                  {req.items.map((item, idx) => (
                                    <div key={item.id} className="flex justify-between text-xs">
                                      <span className="text-slate-600">{idx + 1}. {item.description}</span>
                                      <span className="font-mono text-slate-900">
                                        {item.quantity} x {formatRupiah(item.unitPrice)} = {formatRupiah(item.totalPrice)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="font-semibold text-slate-700">Approval Chain</h4>
                                <div className="space-y-1">
                                  {req.approvals.map(app => (
                                    <div key={app.id} className="flex items-center justify-between text-xs p-2 bg-white rounded border">
                                      <span className="font-medium">{app.requiredRole} (Lv.{app.level})</span>
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        app.status === 'DECIDED' && app.decision === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                        app.status === 'DECIDED' && app.decision === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                        app.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-slate-100 text-slate-500'
                                      }`}>
                                        {app.status === 'DECIDED' ? app.decision : app.status}
                                      </span>
                                    </div>
                                  ))}
                                  {req.approvals.length === 0 && (
                                    <span className="text-slate-400 text-xs">Tidak perlu approval (di bawah ambang)</span>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="font-semibold text-slate-700">Info Tambahan</h4>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between"><span className="text-slate-500">Dibuat:</span> <span>{formatDate(req.createdAt)}</span></div>
                                  {req.submittedAt && <div className="flex justify-between"><span className="text-slate-500">Diajukan:</span> <span>{formatDate(req.submittedAt)}</span></div>}
                                  {req.financeReviewedAt && <div className="flex justify-between"><span className="text-slate-500">Finance Review:</span> <span>{formatDate(req.financeReviewedAt)}</span></div>}
                                  {req.approvedAt && <div className="flex justify-between"><span className="text-slate-500">Disetujui:</span> <span>{formatDate(req.approvedAt)}</span></div>}
                                  {req.rejectedAt && <div className="flex justify-between"><span className="text-slate-500">Ditolak:</span> <span>{formatDate(req.rejectedAt)}</span></div>}
                                  {req.financeNotes && <div className="text-slate-500 text-xs italic">Catatan Finance: {req.financeNotes}</div>}
                                  {req.receiptUrls.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {req.receiptUrls.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">
                                          Bukti {i + 1}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Menampilkan {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} dari {total}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 rounded border border-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded text-sm font-medium ${
                          page === pageNum
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 rounded border border-slate-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, RefreshCw, CheckCircle, FileText } from 'lucide-react';
import { formatIDR } from '@/lib/accounting/money';
import { UploadModal } from './UploadModal';
import { DetailView } from './DetailView';
import { ReportView } from './ReportView';

interface BankStatement {
  id: string;
  fileName: string;
  statementDate: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  currency: string;
  status: string;
  cashAccount: {
    id: string;
    code: string;
    name: string;
    bankName: string | null;
    accountNumber: string | null;
  };
  _count: {
    lines: number;
    matchedLines: number;
  };
  lines: BankStatementLine[];
}

interface BankStatementLine {
  id: string;
  rowNumber: number;
  transactionDate: string;
  valueDate: string | null;
  description: string;
  referenceNumber: string | null;
  debitAmount: number | null;
  creditAmount: number | null;
  balance: number | null;
  direction: 'MASUK' | 'KELUAR';
  rawData: Record<string, any>;
  isValid: boolean;
  matchedLine?: {
    id: string;
    status: string;
    matchScore: number | null;
    dateDiffDays: number | null;
    amountDiff: number | null;
    cashTransaction?: {
      id: string;
      transactionDate: string;
      description: string;
      amount: number;
      type: string;
      category: string;
    } | null;
  } | null;
}

interface CashAccount {
  id: string;
  code: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  isActive: boolean;
}

export function BankReconciliationView({ workspaceId }: { workspaceId: string }) {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'report'>('list');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ status: '', cashAccountId: '', search: '' });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspaceId,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.cashAccountId && { cashAccountId: filters.cashAccountId }),
      });
      const res = await fetch(`/api/bank-statements?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStatements(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      }
    } catch (error) {
      console.error('Error fetching statements:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, pagination.page, pagination.limit, filters]);

  const fetchCashAccounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/cash-accounts?workspaceId=${workspaceId}&isActive=true`);
      if (res.ok) {
        const data = await res.json();
        setCashAccounts(data.data);
      }
    } catch (error) {
      console.error('Error fetching cash accounts:', error);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStatements();
    fetchCashAccounts();
  }, [fetchStatements, fetchCashAccounts]);

  const handleUploadComplete = (statement: BankStatement) => {
    setUploadOpen(false);
    fetchStatements();
    setSelectedStatement(statement);
    setViewMode('detail');
  };

  const handleReconcile = async (statementId: string) => {
    try {
      const res = await fetch(`/api/bank-statements/${statementId}/reconcile`, { method: 'POST' });
      if (res.ok) {
        fetchStatements();
        // Refresh selected statement
        const detailRes = await fetch(`/api/bank-statements/${statementId}`);
        if (detailRes.ok) {
          const data = await detailRes.json();
          setSelectedStatement(data.data);
        }
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to reconcile');
      }
    } catch (error) {
      console.error('Error reconciling:', error);
      alert('Failed to reconcile');
    }
  };

  const handleFinalize = async (statementId: string) => {
    if (!confirm('Finalize this reconciliation? This will update the cash account balance and lock the statement.')) return;
    try {
      const res = await fetch(`/api/bank-statements/${statementId}/finalize`, { method: 'POST' });
      if (res.ok) {
        fetchStatements();
        setSelectedStatement(null);
        setViewMode('list');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to finalize');
      }
    } catch (error) {
      console.error('Error finalizing:', error);
      alert('Failed to finalize');
    }
  };

  const handleViewReport = (statement: BankStatement) => {
    setSelectedStatement(statement);
    setReportOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      UPLOADED: 'outline',
      PARSING: 'secondary',
      PARSED: 'default',
      PARSE_FAILED: 'destructive',
      RECONCILING: 'secondary',
      RECONCILED: 'default',
      ARCHIVED: 'secondary',
    };
    const colors: Record<string, string> = {
      UPLOADED: 'border-slate-200 bg-slate-50 text-slate-700',
      PARSING: 'border-amber-200 bg-amber-50 text-amber-800',
      PARSED: 'border-blue-200 bg-blue-50 text-blue-700',
      PARSE_FAILED: 'border-red-200 bg-red-50 text-red-700',
      RECONCILING: 'border-amber-200 bg-amber-50 text-amber-800',
      RECONCILED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      ARCHIVED: 'border-slate-200 bg-slate-50 text-slate-600',
    };
    return (
      <Badge
        variant={variants[status] || 'outline'}
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${colors[status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}
      >
        {status.toLowerCase().replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Rekonsiliasi Bank</h2>
          <p className="mt-0.5 text-xs text-slate-500">Kelola rekonsiliasi rekening bank dengan transaksi kas</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-10 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
              <Upload className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Upload Statement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Bank Statement</DialogTitle>
            </DialogHeader>
            <UploadModal
              workspaceId={workspaceId}
              cashAccounts={cashAccounts}
              onComplete={handleUploadComplete}
              onCancel={() => setUploadOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <Input
                placeholder="Cari nama file..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                aria-label="Cari nama file"
                className="h-10 rounded-lg border-slate-300 text-xs placeholder:text-slate-400 focus-visible:ring-emerald-600 lg:max-w-sm"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              className="h-10 w-full rounded-lg border-slate-300 text-xs text-slate-700 focus-visible:ring-emerald-600 lg:w-44"
              placeholder="Semua Status"
            >
              <option value="">Semua Status</option>
              <option value="UPLOADED">Uploaded</option>
              <option value="PARSED">Parsed</option>
              <option value="RECONCILING">Reconciling</option>
              <option value="RECONCILED">Reconciled</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
            <Select
              value={filters.cashAccountId}
              onValueChange={(v) => setFilters((f) => ({ ...f, cashAccountId: v }))}
              className="h-10 w-full rounded-lg border-slate-300 text-xs text-slate-700 focus-visible:ring-emerald-600 lg:w-56"
              placeholder="Semua Rekening"
            >
              <option value="">Semua Rekening</option>
              {cashAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name} ({acc.bankName} - {acc.accountNumber})
                </option>
              ))}
            </Select>
            <Button
            variant="outline"
            onClick={fetchStatements}
            disabled={loading}
            className="min-h-10 rounded-lg border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Muat ulang
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statements Table */}
      <Card className={viewMode === 'list' ? 'rounded-xl border-slate-200 shadow-sm' : undefined}>
        <CardContent className={viewMode === 'list' ? 'p-3 sm:p-4' : 'pt-0'}>
          {viewMode === 'list' && (
            <Table className="min-w-[960px] text-xs">
              <TableHeader className="[&_tr]:border-slate-200">
                <TableRow>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">File</TableHead>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rekening</TableHead>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Periode</TableHead>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Saldo Awal</TableHead>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Saldo Akhir</TableHead>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Baris</TableHead>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Terrekon</TableHead>
                  <TableHead className="h-10 bg-slate-50/60 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-3 py-10 text-center text-xs text-slate-500">
                      Belum ada bank statement. Klik "Upload Statement" untuk memulai.
                    </TableCell>
                  </TableRow>
                ) : (
                  statements.map((stmt) => (
                    <TableRow key={stmt.id} className="cursor-pointer border-slate-100 hover:bg-emerald-50/30" onClick={() => { setSelectedStatement(stmt); setViewMode('detail'); }}>
                      <TableCell className="px-3 py-3">
                        <div className="font-medium text-slate-800">{stmt.fileName}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">Upload: {new Date(stmt.statementDate).toLocaleDateString('id-ID')}</div>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="font-medium text-slate-800">{stmt.cashAccount.code} - {stmt.cashAccount.name}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">{stmt.cashAccount.bankName} - {stmt.cashAccount.accountNumber}</div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-slate-600">
                        {new Date(stmt.startDate).toLocaleDateString('id-ID')} - {new Date(stmt.endDate).toLocaleDateString('id-ID')}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">{formatIDR(stmt.openingBalance)}</TableCell>
                      <TableCell className="px-3 py-3 text-right font-mono tabular-nums font-medium text-slate-900">{formatIDR(stmt.closingBalance)}</TableCell>
                      <TableCell className="px-3 py-3">{getStatusBadge(stmt.status)}</TableCell>
                      <TableCell className="px-3 py-3 tabular-nums text-slate-600">{stmt._count.lines}</TableCell>
                      <TableCell className="px-3 py-3 tabular-nums text-slate-600">{stmt._count.matchedLines}</TableCell>
                      <TableCell className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" aria-label="Lihat laporan" title="Lihat laporan" onClick={(e) => { e.stopPropagation(); handleViewReport(stmt); }}>
                            <FileText className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          {stmt.status === 'PARSED' && (
                            <Button variant="ghost" size="icon" aria-label="Jalankan rekonsiliasi" title="Jalankan rekonsiliasi" onClick={(e) => { e.stopPropagation(); handleReconcile(stmt.id); }}>
                              <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {stmt.status === 'RECONCILED' && (
                            <Button variant="ghost" size="icon" aria-label="Finalisasi rekonsiliasi" title="Finalisasi rekonsiliasi" onClick={(e) => { e.stopPropagation(); handleFinalize(stmt.id); }} className="text-amber-600 hover:text-amber-700">
                              <CheckCircle className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {viewMode === 'detail' && selectedStatement && (
            <DetailView
              statement={selectedStatement}
              workspaceId={workspaceId}
              onBack={() => { setSelectedStatement(null); setViewMode('list'); }}
              onRefresh={fetchStatements}
            />
          )}

          {viewMode === 'report' && selectedStatement && (
            <ReportView
              statement={selectedStatement}
              workspaceId={workspaceId}
              onBack={() => { setSelectedStatement(null); setViewMode('list'); setReportOpen(false); }}
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {viewMode === 'list' && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Halaman {pagination.page} dari {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg border-slate-300 text-xs" onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg border-slate-300 text-xs" onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.totalPages}>
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Laporan Rekonsiliasi</DialogTitle>
          </DialogHeader>
          {selectedStatement && (
            <ReportView
              statement={selectedStatement}
              workspaceId={workspaceId}
              onBack={() => setReportOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
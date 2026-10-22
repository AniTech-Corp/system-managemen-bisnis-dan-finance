'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Search, Filter, CheckCircle, XCircle, AlertCircle, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { formatIDR } from '@/lib/accounting/money';

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
  lines: BankStatementLine[];
}

interface DetailViewProps {
  statement: BankStatement;
  workspaceId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function DetailView({ statement, workspaceId, onBack, onRefresh }: DetailViewProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCreateTx, setShowCreateTx] = useState<string | null>(null);
  const [newTxData, setNewTxData] = useState<Record<string, any>>({});
  const [creatingTx, setCreatingTx] = useState(false);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);

  // Fetch cash accounts for creating new transactions
  useEffect(() => {
    fetch(`/api/cash-accounts?workspaceId=${workspaceId}&isActive=true`)
      .then((res) => res.json())
      .then((data) => setCashAccounts(data.data));
  }, [workspaceId]);

  const filteredLines = statement.lines.filter((line) => {
    if (activeTab === 'matched') return !!line.matchedLine?.cashTransaction?.id;
    if (activeTab === 'unmatched') return !line.matchedLine?.cashTransaction?.id || line.matchedLine?.status === 'UNMATCHED_BANK' || line.matchedLine?.status === 'IGNORED';
    return true;
  }).filter((line) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return line.description.toLowerCase().includes(s) ||
      line.referenceNumber?.toLowerCase().includes(s) ||
      line.matchedLine?.cashTransaction?.description.toLowerCase().includes(s) ||
      line.matchedLine?.cashTransaction?.description?.toLowerCase().includes(s);
  });

  const getMatchStatusBadge = (status: string | undefined) => {
    if (!status) return <Badge variant="outline">Unmatched</Badge>;
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success'> = {
      AUTO_MATCHED: 'default',
      MANUAL_MATCHED: 'success',
      UNMATCHED_BANK: 'outline',
      UNMATCHED_CASH: 'outline',
      IGNORED: 'secondary',
      DISPUTED: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.toLowerCase().replace('_', ' ')}
      </Badge>
    );
  };

  const handleMatchAction = async (matchedLineId: string, action: string, cashTransactionId?: string, notes?: string, newTransaction?: any) => {
    try {
      const res = await fetch(`/api/bank-matched-lines/${matchedLineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, cashTransactionId, notes, newTransaction }),
      });

      if (res.ok) {
        onRefresh();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update match');
      }
    } catch (error) {
      console.error('Error updating match:', error);
      alert('Failed to update match');
    }
  };

  const handleCreateTransaction = async (line: BankStatementLine) => {
    const { accountId, type, amount, description, reference, transactionDate, partnerId } = newTxData[line.id] || {};
    
    if (!accountId || !type || !amount) {
      alert('Lengkapi semua field yang diperlukan');
      return;
    }

    setCreatingTx(true);
    try {
      const res = await fetch(`/api/bank-matched-lines/${line.matchedLine?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_TRANSACTION',
          newTransaction: { accountId, type, amount: parseFloat(amount), description, reference, transactionDate, partnerId },
        }),
      });

      if (res.ok) {
        setShowCreateTx(null);
        setNewTxData({});
        onRefresh();
      } else {
        const error = await res.json();
        alert(error.error || 'Gagal membuat transaksi');
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Gagal membuat transaksi');
    } finally {
      setCreatingTx(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <h2 className="text-xl font-bold">{statement.fileName}</h2>
          <p className="text-sm text-muted-foreground">
            {statement.cashAccount.code} - {statement.cashAccount.name} | {new Date(statement.startDate).toLocaleDateString('id-ID')} - {new Date(statement.endDate).toLocaleDateString('id-ID')}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{statement.status}</Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{statement.lines.length}</div>
            <div className="text-sm text-muted-foreground">Total Baris Bank</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {statement.lines.filter(l => l.matchedLine?.cashTransaction?.id && l.matchedLine?.status !== 'IGNORED' && l.matchedLine?.status !== 'DISPUTED').length}
            </div>
            <div className="text-sm text-muted-foreground">Terrekon</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">
              {statement.lines.filter(l => !l.matchedLine?.cashTransaction?.id || l.matchedLine?.status === 'UNMATCHED_BANK' || l.matchedLine?.status === 'IGNORED').length}
            </div>
            <div className="text-sm text-muted-foreground">Belum Terrekon</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatIDR(statement.closingBalance)}</div>
            <div className="text-sm text-muted-foreground">Saldo Bank Statement</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Semua ({statement.lines.length})</TabsTrigger>
          <TabsTrigger value="matched">
            Terrekon ({statement.lines.filter(l => l.matchedLine?.cashTransaction?.id && l.matchedLine?.status !== 'IGNORED' && l.matchedLine?.status !== 'DISPUTED').length})
          </TabsTrigger>
          <TabsTrigger value="unmatched">
            Belum Terrekon ({statement.lines.filter(l => !l.matchedLine?.cashTransaction?.id || l.matchedLine?.status === 'UNMATCHED_BANK' || l.matchedLine?.status === 'IGNORED').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.rowNumber}</TableCell>
                    <TableCell>{new Date(line.transactionDate).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{line.description}</TableCell>
                    <TableCell>{line.referenceNumber || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.direction === 'MASUK' ? (
                        <span className="text-green-600">+ {formatIDR(line.creditAmount || 0)}</span>
                      ) : (
                        <span className="text-red-600">- {formatIDR(line.debitAmount || 0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{line.balance !== null ? formatIDR(line.balance) : '-'}</TableCell>
                    <TableCell>{getMatchStatusBadge(line.matchedLine?.status)}</TableCell>
                    <TableCell>
                      {line.matchedLine?.cashTransaction ? (
                        <div className="text-sm">
                          <div>{line.matchedLine.cashTransaction.description}</div>
                          <div className="text-muted-foreground">{formatIDR(line.matchedLine.cashTransaction.amount)} • {line.matchedLine.cashTransaction.type}</div>
                          {line.matchedLine.matchScore !== null && (
                            <div className="text-xs text-muted-foreground">Score: {(line.matchedLine.matchScore * 100).toFixed(0)}%</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {!line.matchedLine?.cashTransaction?.id && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setShowCreateTx(line.id)} title="Buat transaksi baru">
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleMatchAction(line.matchedLine!.id, 'IGNORE')} title="Abaikan">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {line.matchedLine?.cashTransaction?.id && line.matchedLine?.status !== 'IGNORED' && line.matchedLine?.status !== 'DISPUTED' && (
                          <Button variant="ghost" size="icon" onClick={() => handleMatchAction(line.matchedLine!.id, 'UNMATCH')} title="Batalkan match">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {line.matchedLine?.status === 'IGNORED' && (
                          <Button variant="ghost" size="icon" onClick={() => handleMatchAction(line.matchedLine!.id, 'UNMATCH')} title="Batalkan ignore">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="matched" className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Tanggal Bank</TableHead>
                  <TableHead>Deskripsi Bank</TableHead>
                  <TableHead className="text-right">Jumlah Bank</TableHead>
                  <TableHead>Tanggal Kas</TableHead>
                  <TableHead>Deskripsi Kas</TableHead>
                  <TableHead className="text-right">Jumlah Kas</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Selisih Hari</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.rowNumber}</TableCell>
                    <TableCell>{new Date(line.transactionDate).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{line.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.direction === 'MASUK' ? (
                        <span className="text-green-600">+ {formatIDR(line.creditAmount || 0)}</span>
                      ) : (
                        <span className="text-red-600">- {formatIDR(line.debitAmount || 0)}</span>
                      )}
                    </TableCell>
                    <TableCell>{line.matchedLine?.cashTransaction ? new Date(line.matchedLine.cashTransaction.transactionDate).toLocaleDateString('id-ID') : '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{line.matchedLine?.cashTransaction?.description || '-'}</TableCell>
                    <TableCell className="text-right font-mono">{line.matchedLine?.cashTransaction ? formatIDR(line.matchedLine.cashTransaction.amount) : '-'}</TableCell>
                    <TableCell>{line.matchedLine?.matchScore !== null && line.matchedLine?.matchScore !== undefined ? `${(line.matchedLine.matchScore * 100).toFixed(0)}%` : '-'}</TableCell>
                    <TableCell>{line.matchedLine?.dateDiffDays !== null && line.matchedLine?.dateDiffDays !== undefined ? line.matchedLine.dateDiffDays : '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleMatchAction(line.matchedLine!.id, 'UNMATCH')} title="Batalkan match">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="unmatched" className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.rowNumber}</TableCell>
                    <TableCell>{new Date(line.transactionDate).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{line.description}</TableCell>
                    <TableCell>{line.referenceNumber || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.direction === 'MASUK' ? (
                        <span className="text-green-600">+ {formatIDR(line.creditAmount || 0)}</span>
                      ) : (
                        <span className="text-red-600">- {formatIDR(line.debitAmount || 0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{line.balance !== null ? formatIDR(line.balance) : '-'}</TableCell>
                    <TableCell>{getMatchStatusBadge(line.matchedLine?.status || 'UNMATCHED_BANK')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {showCreateTx === line.id ? (
                          <CreateTransactionForm
                            line={line}
                            cashAccounts={cashAccounts}
                            newTxData={newTxData[line.id] || {}}
                            onChange={(data: Record<string, any>) => setNewTxData((prev) => ({ ...prev, [line.id]: data }))}
                            onSubmit={() => handleCreateTransaction(line)}
                            onCancel={() => setShowCreateTx(null)}
                            creating={creatingTx}
                          />
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setShowCreateTx(line.id)} title="Buat transaksi baru">
                              <Plus className="h-4 w-4" />
                            </Button>
                            {line.matchedLine?.status === 'IGNORED' && (
                              <Button variant="ghost" size="icon" onClick={() => handleMatchAction(line.matchedLine!.id, 'UNMATCH')} title="Batalkan ignore">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {line.matchedLine?.status === 'UNMATCHED_BANK' && !line.matchedLine?.cashTransaction?.id && (
                              <Button variant="ghost" size="icon" onClick={() => handleMatchAction(line.matchedLine!.id, 'IGNORE')} title="Abaikan">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateTransactionForm({ line, cashAccounts, newTxData, onChange, onSubmit, onCancel, creating }: any) {
  const [formData, setFormData] = useState({
    accountId: '',
    type: line.direction === 'MASUK' ? 'INCOME' : 'EXPENSE',
    amount: line.direction === 'MASUK' ? line.creditAmount : line.debitAmount,
    description: line.description,
    reference: line.referenceNumber || '',
    transactionDate: line.transactionDate.split('T')[0],
    partnerId: '',
  });

  useEffect(() => {
    setFormData((prev) => ({ ...prev, ...newTxData }));
  }, [newTxData]);

  const handleChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onChange(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Buat Transaksi Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Rekening Kas *</label>
            <Select
              value={formData.accountId}
              onValueChange={(v) => handleChange('accountId', v)}
              placeholder="Pilih rekening kas"
            >
              {cashAccounts.map((acc: any) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipe *</label>
            <Select
              value={formData.type}
              onValueChange={(v) => handleChange('type', v)}
              placeholder="Pilih tipe"
            >
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Jumlah *</label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Deskripsi *</label>
            <Input
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Deskripsi transaksi"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Referensi</label>
            <Input
              value={formData.reference}
              onChange={(e) => handleChange('reference', e.target.value)}
              placeholder="Nomor referensi"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tanggal *</label>
            <Input
              type="date"
              value={formData.transactionDate}
              onChange={(e) => handleChange('transactionDate', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onCancel} disabled={creating}>
              Batal
            </Button>
            <Button onClick={onSubmit} disabled={creating || !formData.accountId || !formData.amount}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buat Transaksi'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </div>
  );
}
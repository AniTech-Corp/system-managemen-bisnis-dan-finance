'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, AlertCircle, CheckCircle, XCircle, Info, FileText } from 'lucide-react';
import { formatIDR } from '@/lib/accounting/money';

interface ReportViewProps {
  statement: any;
  workspaceId: string;
  onBack: () => void;
}

export function ReportView({ statement, workspaceId, onBack }: ReportViewProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/bank-statements/${statement.id}/report`);
        if (res.ok) {
          const data = await res.json();
          setReport(data.data);
        }
      } catch (error) {
        console.error('Error fetching report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [statement.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Gagal memuat laporan rekonsiliasi</AlertDescription>
      </Alert>
    );
  }

  const { balances, summary, details } = report;

  const getDiffColor = (diff: number) => {
    if (diff === 0) return 'text-green-600';
    if (diff > 0) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Laporan Rekonsiliasi</h2>
          <p className="text-sm text-muted-foreground">{statement.fileName}</p>
        </div>
        <Button variant="outline" onClick={() => {
          // TODO: Implement PDF/Excel export
          alert('Export feature coming soon');
        }}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Balance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Perbandingan Saldo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-muted-foreground">Saldo Awal Bank</div>
              <div className="text-2xl font-bold font-mono">{formatIDR(balances.bankOpeningBalance)}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-muted-foreground">Saldo Akhir Bank (Statement)</div>
              <div className="text-2xl font-bold font-mono">{formatIDR(balances.bankClosingBalance)}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-muted-foreground">Saldo Bank (Terhitung)</div>
              <div className="text-2xl font-bold font-mono">{formatIDR(balances.calculatedBankBalance)}</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-muted-foreground">Saldo Buku (Terhitung)</div>
              <div className="text-2xl font-bold font-mono">{formatIDR(balances.calculatedBookBalance)}</div>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: balances.difference === 0 ? 'rgb(34 197 94 / 0.1)' : balances.difference > 0 ? 'rgb(245 158 11 / 0.1)' : 'rgb(239 68 68 / 0.1)' }}>
            <div className="flex items-center justify-between">
              <span className="font-medium">Selisih (Bank - Buku)</span>
              <span className={`text-2xl font-bold font-mono ${getDiffColor(balances.difference)}`}>
                {balances.difference >= 0 ? '+' : ''}{formatIDR(balances.difference)}
              </span>
            </div>
            {balances.difference !== 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {balances.difference > 0
                  ? 'Saldo bank lebih besar dari buku. Periksa transaksi bank yang belum terekon atau biaya admin.'
                  : 'Saldo buku lebih besar dari bank. Periksa transaksi kas yang belum terekon.'}
              </p>
            )}
            {balances.difference === 0 && (
              <p className="mt-2 text-sm text-green-600">
                <CheckCircle className="inline h-4 w-4 mr-1" /> Saldo bank dan buku sesuai (reconciled).
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Rekonsiliasi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold">{summary.totalBankLines}</div>
              <div className="text-sm text-muted-foreground">Total Baris Bank</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{summary.matchedLines}</div>
              <div className="text-sm text-muted-foreground">Terrekon</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="text-3xl font-bold text-amber-600">{summary.unmatchedBankLines}</div>
              <div className="text-sm text-muted-foreground">Bank Belum Terrekon</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{summary.unmatchedCashLines}</div>
              <div className="text-sm text-muted-foreground">Kas Belum Terrekon</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold">{summary.autoMatched}</div>
              <div className="text-sm text-muted-foreground">Auto Matched</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.manualMatched}</div>
              <div className="text-sm text-muted-foreground">Manual Matched</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{summary.ignored}</div>
              <div className="text-sm text-muted-foreground">Diabaikan</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.disputed}</div>
              <div className="text-sm text-muted-foreground">Disput</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {(details.potentialFees.length > 0 || details.duplicates.length > 0) && (
        <Card className="border-amber-200">
          <CardHeader className="bg-amber-50">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Peringatan & Saran
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {details.potentialFees.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{details.potentialFees.length} potensi biaya admin</strong> terdeteksi di bank statement.
                  {' '}Transaksi kecil ({'<' } Rp 50.000) dengan kata "admin" dalam deskripsi.
                  <div className="mt-2 space-y-1">
                    {details.potentialFees.slice(0, 5).map((fee: any) => (
                      <div key={fee.id} className="text-sm font-mono text-muted-foreground">
                        {new Date(fee.date).toLocaleDateString('id-ID')} - {fee.description} - {formatIDR(fee.amount)}
                      </div>
                    ))}
                    {details.potentialFees.length > 5 && <div className="text-sm text-muted-foreground">... dan {details.potentialFees.length - 5} lagi</div>}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {details.duplicates.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{details.duplicates.length} duplikat transaksi</strong> terdeteksi (tanggal & jumlah sama).
                  <div className="mt-2 space-y-1">
                    {details.duplicates.slice(0, 3).map((d: any) => (
                      <div key={d.original.id} className="text-sm font-mono text-muted-foreground">
                        Baris {d.original.rowNumber} & {d.duplicates.map((dup: any) => dup.rowNumber).join(', ')} - {formatIDR(d.original.amount)}
                      </div>
                    ))}
                    {details.duplicates.length > 3 && <div className="text-sm text-muted-foreground">... dan {details.duplicates.length - 3} lagi</div>}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Tabs */}
      <Tabs defaultValue="matched" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matched">Terrekon ({details.matchedLines.length})</TabsTrigger>
          <TabsTrigger value="unmatched-bank">Bank Belum Terrekon ({details.unmatchedBankLines.length})</TabsTrigger>
          <TabsTrigger value="unmatched-cash">Kas Belum Terrekon ({details.unmatchedCashLines.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="matched">
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
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.matchedLines.map((line: any) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.rowNumber}</TableCell>
                    <TableCell>{new Date(line.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{line.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.direction === 'MASUK' ? (
                        <span className="text-green-600">+ {formatIDR(line.amount)}</span>
                      ) : (
                        <span className="text-red-600">- {formatIDR(line.amount)}</span>
                      )}
                    </TableCell>
                    <TableCell>{line.matchedTransaction ? new Date(line.matchedTransaction.date).toLocaleDateString('id-ID') : '-'}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{line.matchedTransaction?.description || '-'}</TableCell>
                    <TableCell className="text-right font-mono">{line.matchedTransaction ? formatIDR(line.matchedTransaction.amount) : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={line.matchStatus === 'AUTO_MATCHED' ? 'default' : 'success'}>
                        {line.matchStatus?.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{line.matchScore !== null ? `${(line.matchScore * 100).toFixed(0)}%` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="unmatched-bank">
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
                  <TableHead>Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.unmatchedBankLines.map((line: any) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.rowNumber}</TableCell>
                    <TableCell>{new Date(line.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{line.description}</TableCell>
                    <TableCell>{line.referenceNumber || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.direction === 'MASUK' ? (
                        <span className="text-green-600">+ {formatIDR(line.amount)}</span>
                      ) : (
                        <span className="text-red-600">- {formatIDR(line.amount)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{line.balance !== null ? formatIDR(line.balance) : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={line.matchStatus === 'IGNORED' ? 'secondary' : 'outline'}>
                        {line.matchStatus?.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {line.isPotentialFee && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Potensi Biaya Admin
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="unmatched-cash">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Referensi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.unmatchedCashLines.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{tx.description}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === 'INCOME' ? 'success' : 'destructive'}>{tx.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatIDR(tx.amount)}</TableCell>
                    <TableCell>{tx.reference || '-'}</TableCell>
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
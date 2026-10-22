'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

interface CashAccount {
  id: string;
  code: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  isActive: boolean;
}

interface UploadModalProps {
  workspaceId: string;
  cashAccounts: CashAccount[];
  onComplete: (statement: any) => void;
  onCancel: () => void;
}

export function UploadModal({ workspaceId, cashAccounts, onComplete, onCancel }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [cashAccountId, setCashAccountId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf'];
      const validExtensions = ['.csv', '.xls', '.xlsx', '.pdf'];
      const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(ext)) {
        setError('Format file tidak didukung. Gunakan CSV, Excel (.xlsx/.xls), atau PDF.');
        return;
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('Ukuran file terlalu besar. Maksimal 10MB.');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
      setParseErrors([]);
    }
  };

  const handleUpload = async () => {
    if (!file || !cashAccountId) {
      setError('Pilih file dan rekening kas terlebih dahulu');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);
      formData.append('cashAccountId', cashAccountId);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 100);

      const res = await fetch('/api/bank-statements', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError(data.error || 'File sudah pernah diupload');
        } else {
          setError(data.error || 'Gagal mengupload file');
        }
        if (data.details) {
          setParseErrors(data.details);
        }
        setUploading(false);
        return;
      }

      onComplete(data.data);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Terjadi kesalahan saat mengupload');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Bank Statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">File Bank Statement</Label>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center transition-colors hover:border-primary/50"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary'); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary');
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) {
                  const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf'];
                  const validExtensions = ['.csv', '.xls', '.xlsx', '.pdf'];
                  const ext = '.' + droppedFile.name.split('.').pop()?.toLowerCase();
                  if (validTypes.includes(droppedFile.type) || validExtensions.includes(ext)) {
                    setFile(droppedFile);
                    setError(null);
                  }
                }
              }}
            >
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".csv,.xls,.xlsx,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm">
                {file ? (
                  <>
                    <FileText className="inline h-4 w-4 mr-1" />
                    {file.name} ({formatFileSize(file.size)})
                  </>
                ) : (
                  'Klik atau drag & drop file CSV, Excel, atau PDF'
                )}
              </p>
              <p className="text-xs text-muted-foreground">Maksimal 10MB. Format: CSV, XLS, XLSX, PDF</p>
            </div>
            {file && (
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X className="mr-1 h-4 w-4" />
                Hapus file
              </Button>
            )}
          </div>

          {/* Cash Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="cashAccount">Rekening Kas</Label>
            <Select
              value={cashAccountId}
              onValueChange={setCashAccountId}
              id="cashAccount"
              placeholder="Pilih rekening kas"
            >
              {cashAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name} ({acc.bankName} - {acc.accountNumber})
                </option>
              ))}
            </Select>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Mengupload dan memparsing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Errors */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {parseErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div>Beberapa baris gagal diparsing:</div>
                <ul className="mt-1 list-disc list-inside text-sm max-h-32 overflow-y-auto">
                  {parseErrors.slice(0, 5).map((e, i) => (
                    <li key={i}>Baris {e.rowNumber}: {e.message}</li>
                  ))}
                  {parseErrors.length > 5 && <li>... dan {parseErrors.length - 5} error lainnya</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onCancel} disabled={uploading}>
              Batal
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file || !cashAccountId}>
              {uploading ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Parse
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
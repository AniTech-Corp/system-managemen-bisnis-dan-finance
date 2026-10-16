'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Trash2, Upload, Wallet, X, Megaphone, Utensils, Package, Users } from 'lucide-react';
// V4c, 8 Sep 2026 (badge + panel kualitas data di Pusat Data): SSOT ekstraksi
// teks blok "[PEMERIKSAAN DATA]" -- JANGAN tulis regex sendiri di sini, ambil
// dari modul yang sama dipakai CompanyDataDashboard.tsx.
import { extractDqBlockText } from '@/lib/workspace-file-dataquality-shared'; // 8 Sep: modul aman-browser (bukan yang menyeret sharp)

// Roadmap 7 Sep, item 4.1/5 -- Pusat/Hub Upload Data, fitur BARU prioritas #1
// versi Mecca ("tempat upload data-nya selain dari AI-nya langsung ada tempat
// wadahnya"). Backend: prisma/schema.prisma model WorkspaceFile + endpoint
// /api/v1/workspace-files. Panel ini dipasang sebagai MODAL (pola sama seperti
// "File hasil AI" yang sudah ada di 3 AI Assistant View), BUKAN halaman/route
// baru -- src/app/page.tsx ada di zona merah, tidak boleh disentuh untuk nambah
// tab navigasi baru. Dipasang di sidebar ketiga portal sebagai item baru.

interface WorkspaceFileRow {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  extractedSummary: string | null;
  /** true kalau extractedSummary di daftar ini dipotong (1200 char) -- isi penuh
   * diambil via GET /api/v1/workspace-files/[id] saat file dibuka (7 Sep malam). */
  summaryTruncated?: boolean;
  linkedRecordIds: string[];
  status: 'PROCESSING' | 'PROCESSED' | 'FAILED';
  createdAt: string;
  uploader?: { fullName: string } | null;
  /** V4b/V4c, 8 Sep 2026 -- diparse server dari header blok "[PEMERIKSAAN DATA]"
   * di extractedSummary (workspace-file-dataquality.ts), TANPA kolom Prisma baru.
   * Absen/0 berarti file bersih (atau belum genuinely dicek -- lihat catatan
   * batasan format tabular di modul itu). */
  dataQualityCount?: number;
  dataQualityWorst?: 'critical' | 'warning' | 'info' | null;
  /** 11 Sep 2026 (auto-ingest "USB"): jenis + jumlah record turunan hasil impor OTOMATIS
   * (ledger-klasik/ledger-generik/produk/payroll/tugas-usulan), dari [INGEST_LOG] server. */
  ingestKind?: string | null;
  ingestCount?: number;
  /** 11 Sep 2026 sore (filter divisi): kelompok file hasil klasifikasi server
   * (KEUANGAN/SDM/MARKETING/UMUM) + label manusiawinya. */
  divisi?: 'KEUANGAN' | 'SDM' | 'MARKETING' | 'UMUM';
  divisiLabel?: string;
}

const FILE_DIVISION_COLOR: Record<string, string> = {
  KEUANGAN: '#3FBF8F',
  SDM: '#F59E0B',
  MARKETING: '#60A5FA',
  UMUM: '#9CA3AF',
};

/** Label manusiawi untuk kind impor otomatis (11 Sep 2026). */
const INGEST_KIND_LABEL: Record<string, string> = {
  'ledger-klasik': 'Buku Kas',
  'ledger-generik': 'Buku Kas',
  produk: 'Stok/Produk',
  payroll: 'Payroll',
  marketing: 'Kampanye Iklan',
  'tugas-usulan': 'Tugas usulan',
  'sudah-diimpor': 'Buku Kas (sudah ada)',
};

export function detectFileDomain(
  fileName: string,
  extractedSummary: string | null = null,
  ingestKind?: string | null
): 'marketing' | 'menu' | 'inventory' | 'payroll' | 'ledger' | 'other' {
  const name = (fileName || '').toLowerCase();
  const summary = (extractedSummary || '').toLowerCase();
  if (
    ingestKind === 'marketing' ||
    /marketing|kampanye|campaign|ads|iklan|roas/i.test(name) ||
    /kampanye\s+pemasaran|blended\s+roas|budget\s+iklan/i.test(summary)
  ) {
    return 'marketing';
  }
  if (
    ingestKind === 'menu' ||
    /menu|katalog|makanan|minuman|resto|kuliner|f&b|cafe|price-?list|daftar-?harga/i.test(name) ||
    /daftar\s+menu|makanan\s+utama|minuman|snack\s*&|kombo\s+hemat/i.test(summary)
  ) {
    return 'menu';
  }
  if (
    ingestKind === 'produk' ||
    /stok|inventori|inventory|gudang|sku|bahan\s+baku/i.test(name) ||
    /daftar\s+bahan|stok\s+tersedia/i.test(summary)
  ) {
    return 'inventory';
  }
  if (
    ingestKind === 'payroll' ||
    /payroll|gaji|salary|karyawan|slip/i.test(name) ||
    /slip\s+gaji|take\s+home\s+pay/i.test(summary)
  ) {
    return 'payroll';
  }
  if (/\.(xlsx|xls|csv)$/i.test(name)) {
    return 'ledger';
  }
  return 'other';
}

/** 11 Sep 2026 sore: info filter divisi dari server (siapa pembaca + berapa file disembunyikan). */
type VisibilityInfo = { division: 'CEO' | 'FINANCE' | 'MARKETING' | 'LAIN'; hiddenCount: number; totalFiles?: number };

const DIVISION_READER_LABEL: Record<VisibilityInfo['division'], string> = {
  CEO: 'CEO / Owner (semua file)',
  FINANCE: 'Finance (keuangan, SDM, umum)',
  MARKETING: 'Marketing (marketing, umum)',
  LAIN: 'Anggota (file umum)',
};

const DIVISI_BADGE_COLOR: Record<NonNullable<WorkspaceFileRow['divisi']>, string> = {
  KEUANGAN: '#F2A83B',
  SDM: '#C084FC',
  MARKETING: '#60A5FA',
  UMUM: '#9CA3AF',
};

// FASE B4 (7 Sep 2026 malam) -- bentuk respons genericMapping dari GET
// /api/v1/workspace-files/[id]/import-ledger, dipakai untuk tabel transaksi yang TIDAK
// dikenali sebagai ledger klasik (chart-of-accounts) tapi terdeteksi lewat heuristik
// kolom (lihat src/lib/ai-brain/generic-table-ledger.ts). Field ini OPSIONAL di
// response -- absen berarti tidak ada kandidat generik sama sekali (bukan error).
interface GenericColumnMapping {
  sheetName: string | null;
  headerRowIdx: number;
  date: number;
  amount: number | null;
  description: number | null;
  type: number | null;
  category: number | null;
  debit: number | null;
  credit: number | null;
  headerLabels: (string | null)[];
}

interface GenericSampleRow {
  rowNo: number;
  raw: unknown[];
  mapped: {
    tanggal: string | null;
    jumlah: number | null;
    keterangan: string | null;
    jenis: 'INCOME' | 'EXPENSE' | null;
    kategori: string | null;
  };
}

interface GenericMappingPreview {
  mapping: GenericColumnMapping;
  confidence: number;
  sample: GenericSampleRow[];
  warnings: string[];
  mappingHash: string;
  importableTransactionCount: number;
  totalIncome: number;
  totalExpense: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_LABEL: Record<WorkspaceFileRow['status'], { text: string; color: string }> = {
  PROCESSING: { text: 'Memproses…', color: '#F2A83B' },
  PROCESSED: { text: 'Diproses', color: '#3FBF8F' },
  FAILED: { text: 'Gagal diproses', color: '#EF4444' },
};

export default function WorkspaceDataHub({
  onClose,
  onAskAI,
  workspaceId: propWorkspaceId,
  portal: propPortal,
}: {
  onClose: () => void;
  /** Opsional: kalau parent (AI Assistant view) mau nyambungin "Tanya AI soal
   * file ini" langsung ke composer chat-nya sendiri. Kalau tidak diberikan,
   * tombol itu tidak ditampilkan (bukan simulasi/aksi kosong). */
  onAskAI?: (prompt: string) => void;
  workspaceId?: string;
  portal?: string;
}) {
  const [files, setFiles] = useState<WorkspaceFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Isi ekstraksi PENUH per file (sampai 24000 char) -- daftar dari GET list cuma bawa
  // 1200 char pertama (summaryTruncated). Dimuat saat "Lihat isi" dibuka, dipakai juga
  // oleh tombol "Tanya AI" supaya AI dapat isi utuh, bukan potongan.
  const [fullSummaries, setFullSummaries] = useState<Record<string, string>>({});
  const [importingId, setImportingId] = useState<string | null>(null);
  // 11 Sep 2026 (auto-ingest): kabar hasil impor otomatis per upload + tombol batalkan.
  const [ingestNotices, setIngestNotices] = useState<string[]>([]);
  // 11 Sep 2026 sore (filter divisi): siapa pembaca menurut server + jumlah file tersembunyi.
  const [visibility, setVisibility] = useState<VisibilityInfo | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  // FASE B4 (7 Sep 2026 malam) -- panel pratinjau ledger GENERIK (bukan chart-of-
  // accounts klasik): genericPreviewFor = fileId yang lagi ditampilkan panelnya,
  // genericPreview = data pratinjau itu sendiri, genericChecked = centang wajib
  // "saya sudah cek kolom di atas benar" sebelum tombol konfirmasi impor aktif --
  // friction SENGAJA lebih besar dari impor klasik karena ini hasil HEURISTIK
  // (tebakan program), bukan deterministik penuh (lihat generic-table-ledger.ts).
  const [genericPreviewFor, setGenericPreviewFor] = useState<string | null>(null);
  const [genericPreview, setGenericPreview] = useState<GenericMappingPreview | null>(null);
  const [genericChecked, setGenericChecked] = useState(false);
  const [genericSubmitting, setGenericSubmitting] = useState(false);
  // T1 multi-upload (8 Sep 2026) -- progres per file selama batch upload
  // berurutan (maks 12 file, lihat handleUploadBatch). null = tidak sedang
  // batch (upload 1-file lama tidak memakai state ini sama sekali).
  const [batchProgress, setBatchProgress] = useState<
    { name: string; status: 'pending' | 'uploading' | 'done' | 'failed' }[] | null
  >(null);
  const [batchSummary, setBatchSummary] = useState('');
  // KONTRAK MODUL 6 (11 Sep 2026, Fable) -- "AI sedang mempelajari file ini"
  // banner: reset BERSAMAAN dengan setBatchSummary('') di awal handleUploadBatch
  // (baris di bawah) supaya keduanya punya lifetime identik -- RISIKO yang
  // dicatat CONTEXT PACK ("batchSummary tidak auto-clear, banner terpisah
  // bisa menumpuk/terasa basi") dihindari dengan menyamakan titik reset,
  // BUKAN nambah setTimeout terpisah yang bisa nyasar timing-nya.
  const [lastUploadSuccessCount, setLastUploadSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);

  // Auth helper: baca token dari localStorage jika ada, kombinasikan dengan credentials include
  const ensureValidToken = async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    let token = localStorage.getItem('klir_token');
    if (token) return token;
    try {
      const meRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.tokens?.accessToken) {
          localStorage.setItem('klir_token', meData.tokens.accessToken);
          return meData.tokens.accessToken;
        }
      }
    } catch (e) {
      console.warn('[WorkspaceDataHub] ensureValidToken non-fatal:', e);
    }
    return null;
  };

  const getActiveWorkspaceId = (): string | null => {
    if (propWorkspaceId) return propWorkspaceId;
    if (typeof window === 'undefined') return null;
    try {
      const savedAuth = localStorage.getItem('klir_persistent_auth') || sessionStorage.getItem('klir_session_auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        return parsed?.workspace?.id || null;
      }
    } catch {
      // non-fatal
    }
    return null;
  };

  const getAuthHeaders = (extraHeaders?: Record<string, string>): Record<string, string> => {
    const headers: Record<string, string> = { ...(extraHeaders || {}) };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('klir_token');
      if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const wsId = getActiveWorkspaceId();
      if (wsId && !headers['x-workspace-id']) {
        headers['x-workspace-id'] = wsId;
      }
    }
    return headers;
  };

  const load = async () => {
    try {
      await ensureValidToken();
      const wsId = getActiveWorkspaceId();
      const savedPortal = propPortal || (typeof window !== 'undefined' ? localStorage.getItem('klir_active_portal') || 'CEO' : 'CEO');
      const queryParams = new URLSearchParams();
      if (savedPortal) queryParams.set('portal', savedPortal);
      if (wsId) queryParams.set('workspaceId', wsId);

      const url = `/api/v1/workspace-files${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const res = await fetch(url, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Gagal memuat daftar file.');
      const data = await res.json();
      if (alive.current) {
        setFiles(Array.isArray(data.files) ? data.files : []);
        setVisibility(data.visibility && typeof data.visibility === 'object' ? data.visibility : null);
      }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : 'Gagal memuat daftar file.');
    } finally {
      if (alive.current) setLoading(false);
    }
  };

  useEffect(() => {
    alive.current = true;
    load();
    const handleStateUpdate = () => {
      if (alive.current) void load();
    };
    window.addEventListener('klir-ai-state-updated', handleStateUpdate);
    return () => {
      alive.current = false;
      window.removeEventListener('klir-ai-state-updated', handleStateUpdate);
    };
  }, [propWorkspaceId, propPortal]);

  const ensureFullSummary = async (f: WorkspaceFileRow) => {
    if (!f.summaryTruncated || fullSummaries[f.id]) return;
    try {
      const wsId = getActiveWorkspaceId();
      const detailUrl = wsId ? `/api/v1/workspace-files/${f.id}?workspaceId=${encodeURIComponent(wsId)}` : `/api/v1/workspace-files/${f.id}`;
      const res = await fetch(detailUrl, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return; // tetap tampilkan potongan 1200 char, bukan error keras
      const data = await res.json();
      const full = data?.file?.extractedSummary;
      if (typeof full === 'string' && alive.current) setFullSummaries((prev) => ({ ...prev, [f.id]: full }));
    } catch { /* non-fatal: potongan tetap tampil */ }
  };
  const summaryOf = (f: WorkspaceFileRow) => fullSummaries[f.id] ?? f.extractedSummary ?? '';

  // Batas upload file maksimal 100 MB per arahan Mecca
  const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

  // T1 multi-upload (8 Sep 2026): tambah parameter opsional { silent } supaya
  // fungsi 1-file ini bisa dipanggil BERULANG di dalam loop handleUploadBatch
  // di bawah TANPA memicu reload/clear-error/reset-input per file (itu tugas
  // caller batch, dijalankan SEKALI di akhir -- lihat kriteria "tidak memicu
  // 12x reload/toast/dispatch"). Perilaku default (dipanggil tanpa opts, dari
  // tombol upload lama) TIDAK berubah sama sekali dari sebelumnya.
  const handleUpload = async (file: File, opts?: { silent?: boolean }): Promise<boolean> => {
    setUploading(true);
    if (!opts?.silent) setError('');
    try {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimum 100 MB.`);
      }
      await ensureValidToken();
      const wsId = getActiveWorkspaceId();
      const formData = new FormData();
      formData.append('file', file);
      if (wsId) {
        formData.append('workspaceId', wsId);
      }
      const uploadUrl = wsId ? `/api/v1/workspace-files?workspaceId=${encodeURIComponent(wsId)}` : '/api/v1/workspace-files';
      const res = await fetch(uploadUrl, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Gagal mengunggah file.');
      // 11 Sep 2026: tampilkan hasil impor otomatis ("USB") -- jujur per file.
      const notices: string[] = [];
      if (data?.ingest && (data.ingest.created > 0 || data.ingest.kind === 'butuh-konfirmasi' || data.ingest.kind === 'sudah-diimpor')) notices.push(`${file.name}: ${data.ingest.label}`);
      if (Array.isArray(data?.zipSummary?.ingest)) {
        for (const it of data.zipSummary.ingest) if (it?.created > 0 || it?.kind === 'butuh-konfirmasi') notices.push(`${it.fileName}: ${it.label}`);
      }
      if (notices.length) setIngestNotices((prev) => [...prev.slice(-11), ...notices]);
      if (!opts?.silent) {
        await load();
        window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
        window.dispatchEvent(new CustomEvent('klir-kas-updated'));
        window.dispatchEvent(new CustomEvent('klir-inventory-updated'));
      }
      return true;
    } catch (err) {
      if (!opts?.silent) setError(err instanceof Error ? err.message : 'Gagal mengunggah file.');
      return false;
    } finally {
      setUploading(false);
      if (!opts?.silent && fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // T1 multi-upload (8 Sep 2026) -- upload BERURUTAN (sequential, bukan
  // paralel) maks 12 file/batch. REUSE handleUpload(silent:true) per file
  // supaya request/endpoint/format PERSIS sama dengan upload 1-file yang sudah
  // ada; reload daftar file + dispatch event T4 ('klir-ai-state-updated', SUDAH
  // didengar CompanyDataDashboard/Finance/Marketing) cuma dipanggil SEKALI di
  // akhir batch -- bukan per file -- supaya 12 file tidak memicu 12x refetch/
  // toast/dispatch (badge "N file bisa diimpor" di bawah ikut kebaruan yang
  // sama karena dihitung dari state `files` hasil load() ini).
  const MAX_BATCH_FILES = 24;
  const handleUploadBatch = async (fileList: FileList) => {
    const picked = Array.from(fileList);
    const files = picked.slice(0, MAX_BATCH_FILES);
    const truncated = picked.length - files.length;
    if (files.length === 0) return;

    setError('');
    setBatchSummary('');
    setLastUploadSuccessCount(0);
    setBatchProgress(files.map((f) => ({ name: f.name, status: 'pending' as const })));

    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < files.length; i++) {
      setBatchProgress((prev) => prev?.map((p, idx) => (idx === i ? { ...p, status: 'uploading' as const } : p)) ?? prev);
      const ok = await handleUpload(files[i], { silent: true });
      if (ok) successCount++; else failCount++;
      const nextStatus: 'done' | 'failed' = ok ? 'done' : 'failed';
      setBatchProgress((prev) => prev?.map((p, idx) => (idx === i ? { ...p, status: nextStatus } : p)) ?? prev);
    }

    await load();
    window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
    window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    window.dispatchEvent(new CustomEvent('klir-inventory-updated'));
    if (fileInputRef.current) fileInputRef.current.value = '';

    const parts: string[] = [];
    if (successCount > 0) parts.push(`${successCount} file berhasil diunggah`);
    if (failCount > 0) parts.push(`${failCount} gagal diunggah`);
    if (truncated > 0) parts.push(`${truncated} file dilewati (batas ${MAX_BATCH_FILES} file/batch)`);
    setBatchSummary(parts.length ? `${parts.join(', ')}.` : '');
    setLastUploadSuccessCount(successCount);
    setTimeout(() => setBatchProgress(null), failCount > 0 ? 7000 : 3000);
  };

  // integrasi-02 (KRITIS) -- "Impor ke Buku Kas": GET dulu untuk preview (jumlah
  // transaksi, total masuk/keluar, diskrepansi) TANPA menulis apapun, tampilkan lewat
  // window.confirm (pola konfirmasi yang sama dengan handleDelete di atas), baru POST
  // kalau user setuju. integrasi-03 (jujur): parser cuma kenal SATU template buku kas
  // -- kalau file tidak dikenali, tampilkan alasannya apa adanya, bukan gagal diam-diam.
  //
  // FASE B4 (7 Sep 2026 malam): kalau file BUKAN ledger klasik tapi server mengirim
  // `genericMapping` (heuristik kolom), JANGAN langsung window.alert reject -- buka
  // panel pratinjau inline (bukan window.confirm generik) supaya user genuinely bisa
  // memeriksa kolom yang terdeteksi + sampel + peringatan sebelum konfirmasi.
  // 11 Sep 2026 (auto-ingest): batalkan impor otomatis satu file -- hapus record turunan
  // yang tercatat di log file itu saja (lihat undo-ingest route + auto-ingest.ts).
  const handleUndoIngest = async (f: WorkspaceFileRow) => {
    if (!window.confirm(`Batalkan impor otomatis dari "${f.fileName}"? ${f.ingestCount ?? 0} record turunan (${INGEST_KIND_LABEL[f.ingestKind || ''] || f.ingestKind}) akan dihapus. File-nya sendiri tetap tersimpan.`)) return;
    setUndoingId(f.id);
    setError('');
    try {
      const wsId = getActiveWorkspaceId();
      const undoUrl = wsId ? `/api/v1/workspace-files/${f.id}/undo-ingest?workspaceId=${encodeURIComponent(wsId)}` : `/api/v1/workspace-files/${f.id}/undo-ingest`;
      const res = await fetch(undoUrl, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Gagal membatalkan impor otomatis.');
      setIngestNotices((prev) => [...prev.slice(-11), `${f.fileName}: ${data.message}`]);
      await load();
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
      window.dispatchEvent(new CustomEvent('klir-inventory-updated'));
      window.dispatchEvent(new CustomEvent('klir-marketing-updated'));
      window.dispatchEvent(new CustomEvent('klir-mkt-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan impor otomatis.');
    } finally {
      setUndoingId(null);
    }
  };

  const handleReingest = async (f: WorkspaceFileRow, domain: string) => {
    setImportingId(f.id);
    setError('');
    try {
      await ensureValidToken();
      const wsId = getActiveWorkspaceId();
      const reingestUrl = wsId ? `/api/v1/workspace-files/${f.id}/reingest?workspaceId=${encodeURIComponent(wsId)}` : `/api/v1/workspace-files/${f.id}/reingest`;
      const res = await fetch(reingestUrl, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Gagal mengimpor file.');
      }

      if (domain === 'marketing') {
        window.dispatchEvent(new CustomEvent('klir-marketing-updated'));
        window.dispatchEvent(new CustomEvent('klir-mkt-updated'));
      } else if (domain === 'menu' || domain === 'inventory') {
        window.dispatchEvent(new CustomEvent('klir-inventory-updated'));
      }
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));

      await load();
      window.alert(result.message || 'Data berhasil diimpor ke modul terkait.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengimpor file.');
    } finally {
      setImportingId(null);
    }
  };

  const handleImportLedger = async (f: WorkspaceFileRow) => {
    setImportingId(f.id);
    setError('');
    setGenericPreviewFor(null);
    setGenericPreview(null);
    setGenericChecked(false);
    try {
      const wsId = getActiveWorkspaceId();
      const previewUrl = wsId ? `/api/v1/workspace-files/${f.id}/import-ledger?workspaceId=${encodeURIComponent(wsId)}` : `/api/v1/workspace-files/${f.id}/import-ledger`;
      const previewRes = await fetch(previewUrl, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const preview = await previewRes.json().catch(() => ({}));

      if (!preview.recognized) {
        if (preview.genericMapping) {
          setGenericPreviewFor(f.id);
          setGenericPreview(preview.genericMapping as GenericMappingPreview);
          return;
        }
        window.alert(preview.message || `File "${f.fileName}" tidak dikenali sebagai buku kas.`);
        return;
      }
      if (preview.alreadyImported) {
        window.alert(`File ini sudah pernah diimpor sebelumnya (${preview.previouslyImportedCount} transaksi tercatat di Buku Kas). Hapus transaksi lama dulu di halaman Buku Kas kalau ingin impor ulang.`);
        return;
      }

      const totalIncome = Number(preview.totalIncome || 0).toLocaleString('id-ID');
      const totalExpense = Number(preview.totalExpense || 0).toLocaleString('id-ID');
      const discrepancyCount = preview.discrepancies?.discrepancies?.length || 0;
      const confirmMsg =
        `Impor ${preview.importableTransactionCount} transaksi dari "${f.fileName}" ke Buku Kas?\n\n` +
        `Total pemasukan: Rp ${totalIncome}\n` +
        `Total pengeluaran: Rp ${totalExpense}\n` +
        (discrepancyCount > 0
          ? `\nPERHATIAN: sistem menemukan ${discrepancyCount} diskrepansi (selisih angka tertulis vs hitung ulang) di dokumen ini -- transaksi tetap bisa diimpor apa adanya, cek detail di halaman Buku Kas setelah impor.\n`
          : '\nTidak ada diskrepansi terdeteksi.\n') +
        `\nTindakan ini akan mencatat transaksi baru di Buku Kas workspace ini.`;

      if (!window.confirm(confirmMsg)) return;

      const importRes = await fetch(previewUrl, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const result = await importRes.json().catch(() => ({}));
      if (!importRes.ok) throw new Error(result.message || 'Gagal mengimpor ke Buku Kas.');

      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
      await load();
      window.alert(result.message || `${result.importedCount} transaksi berhasil diimpor.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengimpor ke Buku Kas.');
    } finally {
      setImportingId(null);
    }
  };

  // FASE B4 (7 Sep 2026 malam) -- tombol "Konfirmasi & Impor" di panel pratinjau
  // generik: kirim {confirm:true, mappingHash} yang didapat dari GET tadi. Server
  // hitung ULANG mapping+hash dari isi file SAAT INI (bukan percaya kiriman ini) --
  // kalau file berubah/pratinjau basi, server balas 409 dan kita minta user muat
  // ulang pratinjau (bukan diam-diam retry).
  const handleConfirmGenericImport = async (f: WorkspaceFileRow) => {
    if (!genericPreview || !genericChecked) return;
    setGenericSubmitting(true);
    setError('');
    try {
      const wsId = getActiveWorkspaceId();
      const importUrl = wsId ? `/api/v1/workspace-files/${f.id}/import-ledger?workspaceId=${encodeURIComponent(wsId)}` : `/api/v1/workspace-files/${f.id}/import-ledger`;
      const importRes = await fetch(importUrl, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ confirm: true, mappingHash: genericPreview.mappingHash }),
      });
      const result = await importRes.json().catch(() => ({}));
      if (!importRes.ok) {
        if (importRes.status === 409) {
          window.alert(`${result.message || 'Pratinjau kedaluwarsa.'} Muat ulang pratinjau lalu coba lagi.`);
          setGenericPreviewFor(null);
          setGenericPreview(null);
          setGenericChecked(false);
          return;
        }
        throw new Error(result.message || 'Gagal mengimpor ke Buku Kas.');
      }

      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
      setGenericPreviewFor(null);
      setGenericPreview(null);
      setGenericChecked(false);
      await load();
      window.alert(result.message || `${result.importedCount} transaksi berhasil diimpor.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengimpor ke Buku Kas.');
    } finally {
      setGenericSubmitting(false);
    }
  };

  const handleDelete = async (id: string, fileName: string, linkedRecordCount = 0) => {
    if (!window.confirm(`Yakin hapus "${fileName}"? Berkas, hasil ekstraksi, dan ingatan AI terkait file ini akan dibersihkan permanen.`)) return;
    setDeletingId(id);
    try {
      const wsId = getActiveWorkspaceId();
      const delUrl = wsId ? `/api/v1/workspace-files?id=${id}&workspaceId=${encodeURIComponent(wsId)}` : `/api/v1/workspace-files?id=${id}`;
      const res = await fetch(delUrl, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Gagal menghapus file.');
      setFiles((prev) => prev.filter((f) => f.id !== id));
      // T4 & Sesi 18 Sep 2026 -- dashboard, kas, dan AI Brain yang sedang terbuka ikut refresh
      // begitu file dihapus (event didengar CompanyDataDashboard, RoleDashboard, Finance, dll).
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus file.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    const total = visibility?.totalFiles ?? files.length;
    if (total === 0) return;
    if (
      !window.confirm(
        `Yakin ingin menghapus SEMUA (${total}) file di Pusat Data workspace ini?\n\nSemua berkas, hasil ekstraksi, ingatan AI (company knowledge & brief), serta data turunan auto-ingest akan dibersihkan permanen.`
      )
    )
      return;
    setDeletingAll(true);
    setError('');
    try {
      await ensureValidToken();
      const wsId = getActiveWorkspaceId();
      const delAllUrl = wsId ? `/api/v1/workspace-files?all=true&workspaceId=${encodeURIComponent(wsId)}` : '/api/v1/workspace-files?all=true';
      const res = await fetch(delAllUrl, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Gagal menghapus semua file.');
      }
      setFiles([]);
      setVisibility((prev) => (prev ? { ...prev, totalFiles: 0, hiddenCount: 0 } : null));

      // Bersihkan cache lokal browser agar tidak ada residu angka basi
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('klir_finance_summary');
          localStorage.removeItem('klir_cached_metrics');
          localStorage.removeItem('klir_active_portal');
          localStorage.removeItem('klir_ceo_nav');
          localStorage.removeItem('klir_finance_nav');
          localStorage.removeItem('klir_marketing_nav');
          sessionStorage.removeItem('klir_initial_prompt');
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      window.dispatchEvent(new CustomEvent('klir-kas-updated'));
      window.dispatchEvent(new CustomEvent('klir-inventory-updated'));
      window.dispatchEvent(new CustomEvent('klir-marketing-updated'));
      window.dispatchEvent(new CustomEvent('klir-mkt-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus semua file.');
    } finally {
      setDeletingAll(false);
    }
  };

  // T4 (8 Sep 2026) & Update 18 Sep 2026: hitung file yang bisa diimpor (spreadsheet & teks menu katalog)
  const importableCount = files.filter(
    (f) =>
      f.status === 'PROCESSED' &&
      f.linkedRecordIds.length === 0 &&
      (/\.(xlsx|xls|csv)$/i.test(f.fileName) || detectFileDomain(f.fileName, f.extractedSummary, f.ingestKind) === 'menu')
  ).length;

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '680px', maxHeight: '100%', border: 0, borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.62)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: 0, flexShrink: 0 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>Pusat Data</span>
              {importableCount > 0 && (
                <span title="File Excel/CSV yang belum diimpor ke Buku Kas" style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(63,191,143,0.14)', border: '1px solid rgba(63,191,143,0.3)', color: '#3FBF8F', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {importableCount} file bisa diimpor
                </span>
              )}
            </span>
            <span style={{ fontSize: '11.5px', color: '#5C6474' }}>
              {loading
                ? 'Memuat…'
                : (visibility?.totalFiles ?? files.length)
                  ? `${visibility?.totalFiles ?? files.length} file tersimpan di workspace ini`
                  : 'Belum ada file diunggah'}
              {!loading && visibility && (
                <span style={{ display: 'block', marginTop: '2px', fontSize: '10.5px', color: '#8B93A5' }}>
                  Tampilan divisi: {DIVISION_READER_LABEL[visibility.division]} ({files.length} file dapat diakses)
                  {visibility.hiddenCount > 0 ? ` -- ${visibility.hiddenCount} file divisi lain disembunyikan` : ''}
                </span>
              )}
            </span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(visibility?.totalFiles ?? files.length) > 0 && (
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={deletingAll || uploading}
                title="Hapus semua berkas di workspace ini"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  background: 'rgba(239,68,68,0.1)',
                  color: '#EF4444',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: deletingAll ? 'default' : 'pointer',
                  opacity: deletingAll ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <Trash2 size={12} />
                <span>{deletingAll ? 'Menghapus…' : 'Hapus Semua'}</span>
              </button>
            )}
            <button type="button" onClick={onClose} title="Tutup" style={{ display: 'flex', flexShrink: 0, padding: '5px', border: 0, borderRadius: '8px', background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}>
              <X size={16} strokeWidth={1.9} />
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 18px 0' }}>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.zip,.csv,.tsv,.txt,.md,.json,.log,.png,.jpg,.jpeg,.webp,.bmp"
            onChange={(e) => { const list = e.target.files; if (list && list.length > 0) void handleUploadBatch(list); }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', border: 0, borderRadius: '12px', background: 'rgba(78,155,255,0.08)', color: '#4E9BFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}
          >
            <Upload size={15} />
            {/* T1 (8 Sep 2026): label diperjelas -- input sekarang `multiple`,
                maks 12 file/batch (lihat handleUploadBatch), termasuk .zip
                (setiap entri didukung di dalamnya jadi file Pusat Data sendiri). */}
            <span>{uploading ? 'Mengunggah…' : 'Unggah file (bisa pilih beberapa sekaligus, maks 12) -- PDF, Excel, Word, PPT, ZIP, gambar'}</span>
          </button>
          {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#EF4444' }}>{error}</p>}
          {ingestNotices.length > 0 && (
            <div style={{ margin: '8px 0 0', padding: '8px 10px', borderRadius: '10px', background: 'rgba(63,191,143,0.08)', border: '1px solid rgba(63,191,143,0.25)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#3FBF8F', marginBottom: '4px' }}>Impor otomatis (data langsung masuk sistem)</div>
              {ingestNotices.slice(-6).map((n, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#C6CEDA' }}>{n}</div>
              ))}
              <div style={{ fontSize: '10px', color: '#5C6474', marginTop: '4px' }}>Angka dari tabel dibaca parser (bukan AI). Salah masuk? Pakai tombol "Batalkan impor otomatis" di file terkait.</div>
            </div>
          )}
          {/* T1 (8 Sep 2026) -- progres per file selama batch upload berurutan,
              hanya tampil kalau memang lagi/baru batch (>1 file). Upload 1 file
              tunggal tetap pakai indikator "Mengunggah…" di tombol seperti biasa. */}
          {batchProgress && batchProgress.length > 1 && (
            <div style={{ marginTop: '9px', display: 'flex', flexDirection: 'column', gap: '4px', padding: '9px 11px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', maxHeight: '140px', overflowY: 'auto' }}>
              {batchProgress.map((p, i) => (
                <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                  <span style={{ flexShrink: 0, width: '14px', display: 'flex', justifyContent: 'center' }}>
                    {p.status === 'pending' && <span style={{ color: '#5C6474' }}>&middot;</span>}
                    {p.status === 'uploading' && <span style={{ color: '#F2A83B' }}>…</span>}
                    {p.status === 'done' && <CheckCircle2 size={12} color="#3FBF8F" />}
                    {p.status === 'failed' && <span style={{ color: '#EF4444', fontWeight: 700 }}>&times;</span>}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: p.status === 'failed' ? '#EF4444' : '#C6CEDA' }}>{p.name}</span>
                </div>
              ))}
            </div>
          )}
          {batchSummary && <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#8A93A3' }}>{batchSummary}</p>}
          {/* KONTRAK MODUL 6 (11 Sep 2026, Fable) -- akar B poin 2 di CONTEXT PACK:
              Mecca upload file tapi tidak tahu AI genuinely memprosesnya untuk
              dashboard (auto-company-profile debounce 5 detik + company-brief
              debounce 8 detik, keduanya proses SERVER-SIDE yang sudah jalan,
              lihat wiring agent B3). Banner ini MURNI penjelasan -- TIDAK ada
              fetch baru, tidak ada polling status brief (di luar scope B5).
              Tombol "Lihat ringkasan AI" menutup modal (onClose) supaya Mecca
              balik ke Dashboard yang ada di baliknya -- komponen ini tidak
              punya prop navigasi lain (page.tsx lane Fatur, di luar scope). */}
          {batchSummary && lastUploadSuccessCount > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '9px 11px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)' }}>
              <span style={{ fontSize: '11px', color: '#A5B4FC', lineHeight: 1.5 }}>
                AI sedang mempelajari file ini (profil &amp; brief perusahaan diperbarui otomatis ~10 detik).
              </span>
              <button
                type="button"
                onClick={onClose}
                style={{ flexShrink: 0, padding: '5px 11px', border: 0, borderRadius: '8px', background: 'rgba(99,102,241,0.16)', color: '#C7D2FE', fontFamily: "'Outfit', sans-serif", fontSize: '10.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Lihat ringkasan AI di Dashboard
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 14px 16px' }}>
          {files.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {files.map((f) => {
                const st = STATUS_LABEL[f.status];
                const expanded = expandedId === f.id;
                return (
                  <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '11px 12px', border: 0, borderRadius: '13px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <FileText size={18} color="#4E9BFF" strokeWidth={1.6} />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
                          {/* V4c, 8 Sep 2026 -- badge kualitas data. KEPUTUSAN PRODUK
                              (lihat catatan_jujur laporan build): worst 'info' SAJA
                              (tanpa critical/warning) pakai indikator NETRAL, BUKAN
                              merah/kuning -- typo-candidate/duplicate-row info-level
                              rawan false-positive (JSDoc document-checker.ts), jadi
                              disamaratakan ke merah/kuning berisiko "menangis serigala"
                              untuk file yang sebenarnya sehat-sehat saja. */}
                          {(f.dataQualityCount ?? 0) > 0 && f.dataQualityWorst === 'critical' && (
                            <span title={`${f.dataQualityCount} temuan kesalahan data (kritis)`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, padding: '2px 7px', borderRadius: '999px', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              <AlertTriangle size={10} strokeWidth={2.2} />
                              {f.dataQualityCount} temuan
                            </span>
                          )}
                          {(f.dataQualityCount ?? 0) > 0 && f.dataQualityWorst === 'warning' && (
                            <span title={`${f.dataQualityCount} temuan kesalahan data (perlu ditinjau)`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, padding: '2px 7px', borderRadius: '999px', background: 'rgba(216,163,60,0.14)', border: '1px solid rgba(216,163,60,0.35)', color: '#D8A33C', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              <AlertTriangle size={10} strokeWidth={2.2} />
                              {f.dataQualityCount} temuan
                            </span>
                          )}
                          {(f.dataQualityCount ?? 0) > 0 && f.dataQualityWorst === 'info' && (
                            <span title={`${f.dataQualityCount} catatan kecil (info) -- kemungkinan false-positif, cek kalau sempat`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0, color: '#5C6474', fontSize: '10px', whiteSpace: 'nowrap' }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '99px', background: '#5C6474', flexShrink: 0 }} />
                              {f.dataQualityCount} catatan
                            </span>
                          )}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5C6474', flexWrap: 'wrap' }}>
                          <span style={{ color: st.color }}>{st.text}</span>
                          <span>&middot;</span>
                          <span>{new Date(f.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span>&middot;</span>
                          <span>{formatSize(f.sizeBytes)}</span>
                          {f.divisi && (
                            <>
                              <span>&middot;</span>
                              <span title="Kelompok divisi hasil klasifikasi otomatis (menentukan siapa yang bisa melihat file ini)" style={{ color: DIVISI_BADGE_COLOR[f.divisi], fontWeight: 600 }}>
                                {f.divisiLabel || f.divisi}
                              </span>
                            </>
                          )}
                          <span>&middot;</span>
                          <span>
                            {f.ingestKind && (f.ingestCount ?? 0) > 0 ? (
                              <span style={{ color: '#3FBF8F', fontWeight: 600 }}>
                                ✓ Terintegrasi Modul {INGEST_KIND_LABEL[f.ingestKind] || f.ingestKind} ({f.ingestCount} record tersimpan)
                              </span>
                            ) : f.linkedRecordIds.length > 0 ? (
                              <span style={{ color: '#3FBF8F', fontWeight: 600 }}>
                                ✓ Terintegrasi Modul ({f.linkedRecordIds.length} data turunan)
                              </span>
                            ) : f.status === 'PROCESSED' ? (
                              /\.(xlsx|xls|csv)$/i.test(f.fileName) ? (
                                <span style={{ color: '#F59E0B' }}>⚡ Siap diimpor ke Buku Kas</span>
                              ) : (
                                <span style={{ color: '#60A5FA' }}>🧠 Pengetahuan AI: Terhubung ke AI Brain (Konteks &amp; Tanya Jawab)</span>
                              )
                            ) : (
                              <span>{st.text}</span>
                            )}
                          </span>
                          {f.ingestKind && (f.ingestCount ?? 0) > 0 && (
                            <button type="button" onClick={() => handleUndoIngest(f)} disabled={undoingId === f.id} title="Hapus record hasil impor otomatis dari file ini" style={{ border: 0, background: 'transparent', color: '#F5A3A3', fontSize: '10.5px', cursor: undoingId === f.id ? 'default' : 'pointer', padding: 0, textDecoration: 'underline' }}>
                              {undoingId === f.id ? 'Membatalkan…' : 'Batalkan impor otomatis'}
                            </button>
                          )}
                        </span>
                      </span>
                      {/* FASE B4 (7 Sep 2026 malam): regex diperluas +csv -- sebelumnya
                          CSV TIDAK PERNAH dapat tombol ini sama sekali walau backend
                          suatu saat mendukungnya (gate ganda: backend ekstensi DAN UI
                          ini harus dibuka bersamaan, lihat temuan C4 laporan scan). */}
                      {/* Update 18 Sep 2026: Tombol Impor Kontekstual Multi-Domain */}
                      {f.status === 'PROCESSED' && f.linkedRecordIds.length === 0 && (() => {
                        const domain = detectFileDomain(f.fileName, f.extractedSummary, f.ingestKind);
                        const isSpreadsheet = /\.(xlsx|xls|csv)$/i.test(f.fileName);
                        
                        if (domain === 'marketing' && (!f.ingestKind || (f.ingestCount ?? 0) === 0)) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleReingest(f, 'marketing')}
                              disabled={importingId === f.id}
                              title="Impor data kampanye iklan ke modul Marketing"
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(236,72,153,0.12)', color: '#EC4899', fontSize: '11px', fontWeight: 600, cursor: importingId === f.id ? 'default' : 'pointer', opacity: importingId === f.id ? 0.5 : 1 }}
                            >
                              <Megaphone size={13} strokeWidth={1.9} />
                              {importingId === f.id ? 'Memproses…' : 'Impor Kampanye Iklan'}
                            </button>
                          );
                        }

                        if (domain === 'menu') {
                          return (
                            <button
                              type="button"
                              onClick={() => handleReingest(f, 'menu')}
                              disabled={importingId === f.id}
                              title="Impor daftar menu & harga ke katalog produk/F&B"
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontSize: '11px', fontWeight: 600, cursor: importingId === f.id ? 'default' : 'pointer', opacity: importingId === f.id ? 0.5 : 1 }}
                            >
                              <Utensils size={13} strokeWidth={1.9} />
                              {importingId === f.id ? 'Memproses…' : 'Impor ke Katalog Menu'}
                            </button>
                          );
                        }

                        if (domain === 'inventory' && isSpreadsheet) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleReingest(f, 'inventory')}
                              disabled={importingId === f.id}
                              title="Impor inventori & stok ke modul Produk"
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(59,130,246,0.12)', color: '#3B82F6', fontSize: '11px', fontWeight: 600, cursor: importingId === f.id ? 'default' : 'pointer', opacity: importingId === f.id ? 0.5 : 1 }}
                            >
                              <Package size={13} strokeWidth={1.9} />
                              {importingId === f.id ? 'Memproses…' : 'Impor ke Stok Produk'}
                            </button>
                          );
                        }

                        if (domain === 'payroll' && isSpreadsheet) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleReingest(f, 'payroll')}
                              disabled={importingId === f.id}
                              title="Impor data gaji ke modul Payroll"
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', fontSize: '11px', fontWeight: 600, cursor: importingId === f.id ? 'default' : 'pointer', opacity: importingId === f.id ? 0.5 : 1 }}
                            >
                              <Users size={13} strokeWidth={1.9} />
                              {importingId === f.id ? 'Memproses…' : 'Impor ke Payroll'}
                            </button>
                          );
                        }

                        if (isSpreadsheet) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleImportLedger(f)}
                              disabled={importingId === f.id}
                              title="Coba impor isi buku kas file ini ke Buku Kas workspace"
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(63,191,143,0.12)', color: '#3FBF8F', fontSize: '11px', fontWeight: 600, cursor: importingId === f.id ? 'default' : 'pointer', opacity: importingId === f.id ? 0.5 : 1 }}
                            >
                              <Wallet size={13} strokeWidth={1.9} />
                              {importingId === f.id ? 'Memproses…' : 'Impor ke Buku Kas'}
                            </button>
                          );
                        }

                        return null;
                      })()}
                      {f.status === 'PROCESSED' && f.extractedSummary && (
                        <button type="button" onClick={() => { if (!expanded) void ensureFullSummary(f); setExpandedId(expanded ? null : f.id); }} title="Lihat hasil ekstraksi" style={{ flexShrink: 0, padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: '#C6CEDA', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                          {expanded ? 'Sembunyikan' : 'Lihat isi'}
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(f.id, f.fileName, f.linkedRecordIds.length)} disabled={deletingId === f.id} title="Hapus file" style={{ display: 'flex', flexShrink: 0, padding: '7px', border: 0, borderRadius: '10px', background: 'transparent', color: '#EF4444', cursor: deletingId === f.id ? 'default' : 'pointer', opacity: deletingId === f.id ? 0.4 : 1 }}>
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                    {/* V4c, 8 Sep 2026 -- panel temuan kualitas data. SELALU tampil
                        kalau count>0 (TIDAK digembok di balik "Lihat isi") -- ini
                        sinyal peringatan, bukan konten biasa yang orang pilih untuk
                        dibuka. Isi = extractDqBlockText(f.extractedSummary), SUDAH
                        tersedia dari respons GET list (gist 1200 char, blok dijamin
                        di posisi awal -- lihat workspace-file-dataquality.ts), TIDAK
                        perlu fetch tambahan. */}
                    {(f.dataQualityCount ?? 0) > 0 && extractDqBlockText(f.extractedSummary) && (
                      <div style={{ padding: '9px 12px', border: `1px solid ${f.dataQualityWorst === 'critical' ? 'rgba(239,68,68,0.3)' : f.dataQualityWorst === 'warning' ? 'rgba(216,163,60,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', background: f.dataQualityWorst === 'critical' ? 'rgba(239,68,68,0.06)' : f.dataQualityWorst === 'warning' ? 'rgba(216,163,60,0.06)' : 'rgba(255,255,255,0.02)' }}>
                        <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', lineHeight: 1.6, color: '#C6CEDA', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{extractDqBlockText(f.extractedSummary)}</pre>
                      </div>
                    )}
                    {expanded && f.extractedSummary && (
                      <div style={{ padding: '10px 12px', border: 0, borderRadius: '10px', background: 'rgba(0,0,0,0.35)' }}>
                        <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.6, color: '#C6CEDA', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>{summaryOf(f)}</p>
                        {f.summaryTruncated && !fullSummaries[f.id] && (
                          <p style={{ margin: '6px 0 0', fontSize: '10.5px', color: '#8A93A3' }}>Memuat isi lengkap…</p>
                        )}
                        {onAskAI && (
                          <button
                            type="button"
                            onClick={() => { onAskAI(`Tolong jelaskan isi file "${f.fileName}" ini dan apa yang bisa saya lakukan dengan datanya:\n\n${summaryOf(f)}`); onClose(); }}
                            style={{ marginTop: '9px', padding: '7px 12px', border: 0, borderRadius: '9px', background: '#0058BE', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Tanya AI soal file ini
                          </button>
                        )}
                      </div>
                    )}
                    {/* FASE B4 (7 Sep 2026 malam) -- panel pratinjau ledger GENERIK.
                        Ini hasil HEURISTIK (tebakan program berbasis nama+isi kolom),
                        BUKAN parser deterministik seperti template klasik -- makanya
                        friction lebih besar: badge confidence + tabel mapping + sampel
                        + peringatan APA ADANYA (tidak dihaluskan, ini data finansial) +
                        checkbox wajib sebelum tombol konfirmasi aktif. */}
                    {genericPreviewFor === f.id && genericPreview && (
                      <GenericLedgerPreviewPanel
                        fileName={f.fileName}
                        preview={genericPreview}
                        checked={genericChecked}
                        onCheckedChange={setGenericChecked}
                        submitting={genericSubmitting}
                        onCancel={() => { setGenericPreviewFor(null); setGenericPreview(null); setGenericChecked(false); }}
                        onConfirm={() => handleConfirmGenericImport(f)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : !loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', padding: '44px 20px' }}>
              <FileText size={26} color="#8A93A3" strokeWidth={1.4} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#C6CEDA' }}>Belum ada file</span>
              <span style={{ fontSize: '11.5px', color: '#8A93A3', textAlign: 'center' }}>Unggah dokumen bisnis (laporan, invoice, nota) langsung dari sini — tidak perlu lewat chat.</span>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 18px', borderTop: 0, flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: '#5C6474' }}>File tersimpan permanen di server, bisa dihapus kapan saja.</span>
          <button type="button" onClick={onClose} style={{ flexShrink: 0, padding: '9px 18px', border: 0, borderRadius: '11px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FASE B4 (7 Sep 2026 malam) -- panel pratinjau ledger GENERIK.
// ---------------------------------------------------------------------------

const ROLE_LABELS: Array<{ key: keyof GenericColumnMapping; label: string }> = [
  { key: 'date', label: 'Tanggal' },
  { key: 'amount', label: 'Jumlah' },
  { key: 'debit', label: 'Debet' },
  { key: 'credit', label: 'Kredit' },
  { key: 'description', label: 'Keterangan' },
  { key: 'category', label: 'Kategori' },
  { key: 'type', label: 'Jenis (pemasukan/pengeluaran)' },
];

function confidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.8) return '#3FBF8F';
  if (confidence >= 0.5) return '#F2A83B';
  return '#EF4444';
}

function columnHeaderLabel(mapping: GenericColumnMapping, colIdx: number | null): string {
  if (colIdx === null) return '-- tidak ditemukan --';
  const raw = mapping.headerLabels[colIdx];
  return raw ? `"${raw}" (kolom ke-${colIdx + 1})` : `kolom ke-${colIdx + 1}`;
}

function GenericLedgerPreviewPanel({
  fileName,
  preview,
  checked,
  onCheckedChange,
  submitting,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  preview: GenericMappingPreview;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const badgeColor = confidenceBadgeColor(preview.confidence);
  const totalIncomeText = Number(preview.totalIncome || 0).toLocaleString('id-ID');
  const totalExpenseText = Number(preview.totalExpense || 0).toLocaleString('id-ID');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 13px', border: `1px solid ${badgeColor}55`, borderRadius: '11px', background: 'rgba(0,0,0,0.28)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>
          Deteksi otomatis (bukan template buku kas baku) -- "{fileName}"
        </span>
        <span style={{ padding: '3px 9px', borderRadius: '999px', background: `${badgeColor}22`, color: badgeColor, fontSize: '10.5px', fontWeight: 700 }}>
          Confidence {Math.round(preview.confidence * 100)}%
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <tbody>
            {ROLE_LABELS.map(({ key, label }) => (
              <tr key={key}>
                <td style={{ padding: '3px 8px 3px 0', color: '#8A93A3', whiteSpace: 'nowrap' }}>{label}</td>
                <td style={{ padding: '3px 0', color: '#C6CEDA' }}>{columnHeaderLabel(preview.mapping, preview.mapping[key] as number | null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#C6CEDA', flexWrap: 'wrap' }}>
        <span>{preview.importableTransactionCount} transaksi bisa diimpor</span>
        <span>Pemasukan: Rp {totalIncomeText}</span>
        <span>Pengeluaran: Rp {totalExpenseText}</span>
      </div>

      {preview.warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px 10px', border: '1px solid rgba(242,168,59,0.3)', borderRadius: '9px', background: 'rgba(242,168,59,0.07)' }}>
          {preview.warnings.map((w, i) => (
            <p key={i} style={{ margin: 0, fontSize: '10.5px', lineHeight: 1.5, color: '#F2A83B' }}>{w}</p>
          ))}
        </div>
      )}

      {preview.sample.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
            <thead>
              <tr style={{ color: '#5C6474', textAlign: 'left' }}>
                <th style={{ padding: '3px 8px 3px 0', fontWeight: 500 }}>Baris</th>
                <th style={{ padding: '3px 8px', fontWeight: 500 }}>Tanggal</th>
                <th style={{ padding: '3px 8px', fontWeight: 500 }}>Jumlah</th>
                <th style={{ padding: '3px 8px', fontWeight: 500 }}>Keterangan</th>
                <th style={{ padding: '3px 8px', fontWeight: 500 }}>Jenis</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row) => (
                <tr key={row.rowNo} style={{ color: '#C6CEDA' }}>
                  <td style={{ padding: '3px 8px 3px 0' }}>{row.rowNo}</td>
                  <td style={{ padding: '3px 8px' }}>{row.mapped.tanggal ?? '-- gagal parse --'}</td>
                  <td style={{ padding: '3px 8px' }}>{row.mapped.jumlah !== null ? row.mapped.jumlah.toLocaleString('id-ID') : '-- gagal parse --'}</td>
                  <td style={{ padding: '3px 8px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.mapped.keterangan ?? '--'}</td>
                  <td style={{ padding: '3px 8px' }}>{row.mapped.jenis ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#C6CEDA', cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} style={{ marginTop: '2px' }} />
        <span>Saya sudah cek kolom di atas benar -- ini hasil deteksi OTOMATIS (bukan template buku kas baku), tanggung jawab verifikasi ada di saya sebelum data ini masuk Buku Kas.</span>
      </label>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} disabled={submitting} style={{ padding: '7px 12px', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '9px', background: 'transparent', color: '#C6CEDA', fontSize: '11px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer' }}>
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!checked || submitting}
          style={{ padding: '7px 14px', border: 0, borderRadius: '9px', background: checked ? '#3FBF8F' : 'rgba(63,191,143,0.25)', color: checked ? '#04120C' : '#5C6474', fontSize: '11px', fontWeight: 700, cursor: !checked || submitting ? 'default' : 'pointer' }}
        >
          {submitting ? 'Mengimpor…' : 'Konfirmasi & Impor'}
        </button>
      </div>
    </div>
  );
}

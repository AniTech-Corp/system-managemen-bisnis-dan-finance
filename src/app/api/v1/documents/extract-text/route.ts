import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { checkUploadRateLimit, uploadRateLimitResponse } from '@/lib/upload-rate-limit';
import { withTenantGuard } from '@/lib/tenant-guard';
import {
  extractTextFromBuffer,
  tryParseStructuredLedgerForExtractText,
  buildVerifiedNumbersBlock,
} from '@/lib/document-text-extractor';

/**
 * POST /api/v1/documents/extract-text
 * Mengekstrak teks & struktur data dari dokumen (PDF, Excel, Word, CSV, Gambar OCR).
 * Dibungkus withTenantGuard (minRole MEMBER, sama seperti versi lama 57bcf65 dan
 * pola /documents/analyze) -- endpoint ini membaca isi dokumen bisnis milik tenant,
 * jadi wajib user yang sudah terautentikasi & jadi anggota workspace-nya.
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  // 8 Sep (temuan verifikator TINGGI): rate-limit ekstraksi lampiran chat -- multi-file (6/pesan) + OCR berbayar.
  { const rl = checkUploadRateLimit(req, { max: 40, windowMs: 60 * 1000 }); if (!rl.allowed) return uploadRateLimitResponse(rl.resetTime); }
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, message: 'Kirim file via multipart/form-data dengan field "file".' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, message: 'File tidak ditemukan dalam form data.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'dokumen';
    // FIX (7 Sep 2026): batas ukuran DICEK dari file.size SEBELUM arrayBuffer() -- kalau
    // dicek setelahnya, memori sudah terlanjur dialokasikan dan batasnya tidak berguna.
    const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Ukuran file melebihi batas 15 MB. Kecilkan file atau pecah menjadi beberapa bagian.' },
        { status: 413 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    let content: string;
    try {
      content = await extractTextFromBuffer(fileName, buffer);
      // Pagar byte NUL untuk jalur lampiran chat (7 Sep malam) -- jalur Pusat Data sudah
      // punya guard ini (workspace-file-extraction.ts); hasil endpoint ini dikirim ke
      // LLM dan bisa disimpan konsumen lain ke Postgres (error 22021 kalau ada NUL).
      if (content.includes('\u0000')) content = content.replace(/\u0000+/g, '');
    } catch (extractErr: any) {
      return NextResponse.json(
        {
          success: false,
          message: `Gagal membaca isi "${fileName}" (${extractErr?.message || 'format tidak didukung'}). Coba unggah ulang atau konversi ke format PDF/XLSX/CSV.`,
        },
        { status: 422 }
      );
    }

    const trimmed = (content || '').trim();
    if (!trimmed) {
      return NextResponse.json(
        {
          success: false,
          message: `Dokumen "${fileName}" terbaca tetapi tidak ada teks atau data yang terdeteksi.`,
        },
        { status: 422 }
      );
    }

    // KELOMPOK 4 wiring -- kalau berkas ini xlsx/xls DAN dikenali sebagai
    // ledger bookkeeping, hitung ANGKA TERVERIFIKASI deterministik dan
    // sisipkan sebagai blok di AWAL `content`.
    const ledgerResult = tryParseStructuredLedgerForExtractText(fileName, buffer);
    const finalContent = ledgerResult
      ? `${buildVerifiedNumbersBlock(ledgerResult.structuredLedger, ledgerResult.discrepancies)}\n\n${trimmed}`
      : trimmed;

    // Batas karakter aman untuk context AI
    const MAX_CHARS = 32000;
    const truncated = finalContent.length > MAX_CHARS;

    return NextResponse.json({
      success: true,
      fileName,
      content: truncated ? finalContent.slice(0, MAX_CHARS) : finalContent,
      truncated,
      totalChars: finalContent.length,
      // B1 BACKEND, 8 Sep 2026 (T3 lampiran chat -> Pusat Data, kontrak dgn B2) --
      // field ADDITIF: teks ekstraksi MURNI (sebelum blok ANGKA TERVERIFIKASI,
      // sebelum truncation MAX_CHARS)
      rawContent: trimmed,
      ...(ledgerResult
        ? { structuredLedger: ledgerResult.structuredLedger, discrepancies: ledgerResult.discrepancies }
        : {}),
    });
  } catch (err: any) {
    console.error('[extract-text] Internal error:', err);
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal memproses dan mengekstrak dokumen.') },
      { status: 500 }
    );
  }
}, { minRole: 'MEMBER' });

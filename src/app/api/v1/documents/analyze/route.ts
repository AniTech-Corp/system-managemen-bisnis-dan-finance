import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { checkUploadRateLimit, uploadRateLimitResponse } from '@/lib/upload-rate-limit';
import { withTenantGuard } from '@/lib/tenant-guard';
import { analyzeCompanyDocument } from '@/lib/document-ai';
import { recordCompanyKnowledge } from '@/lib/ai-brain/company-memory';
import { parseLedgerWorkbook, validateLedger, type DiscrepancyReport } from '@/lib/ai-brain';
import { checkDocumentText, type DocumentCheckReport } from '@/lib/ai-brain/document-checker';
import { checkTabularText, type TabularCheckReport } from '@/lib/ai-brain/tabular-checker';
import { prisma } from '@/lib/prisma';

// Dynamic imports untuk parser PDF/DOCX (hindari bundle di serverless kalau tidak dipakai)
// eslint-disable-next-line @typescript-eslint/no-var-requires

async function extractTextFromFile(fileName: string, buffer: Buffer): Promise<string> {
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  try {
    if (ext === 'txt' || ext === 'md' || ext === 'csv') {
      return buffer.toString('utf8');
    }

    if (ext === 'pdf') {
      const pdfModule: any = await import('pdf-parse');
      const pdfParse = pdfModule.default || pdfModule;
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (ext === 'docx') {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
      const xlsxModule: any = await import('xlsx');
      const XLSX = xlsxModule.default || xlsxModule;
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
      }
      return sheets.join('\n\n') || buffer.toString('utf8');
    }

    // Fallback: coba baca sebagai teks biasa
    return buffer.toString('utf8');
  } catch (err: any) {
    console.warn(`[Documents] Gagal ekstraksi ${ext}:`, err.message);
    return buffer.toString('utf8');
  }
}

// ---------------------------------------------------------------------------
// FASE 4 wiring (roadmap anti-halusinasi 2026-09-06-roadmap-analisis-data-
// enterprise-anti-halusinasi.md): kalau file upload dikenali sebagai ledger
// bookkeeping, parse + validasi DETERMINISTIK (parseLedgerWorkbook +
// validateLedger, TIDAK PERNAH memanggil LLM) lalu ringkas jadi
// structuredLedger untuk dikirim balik ke client -- yang nantinya diteruskan
// ke brain/chat sebagai "ANGKA TERVERIFIKASI" (lihat brain/chat/route.ts),
// menggantikan jalur lama "tempel teks dokumen mentah ke prompt LLM" yang
// jadi root cause kasus 37 juta vs 3 M (demo ke calon klien pertama, 5 Sep 2026).
// ---------------------------------------------------------------------------

interface StructuredLedgerSummary {
  periode: { mulai: string | null; akhir: string | null };
  sheetPrimer: string | null;
  jumlahTransaksi: number;
  totalPerKode: Array<{ kode: number; namaAkun: string | null; debit: number; credit: number }>;
  /** `null` (bukan 0) kalau sheet laba-rugi tidak ditemukan di dokumen -- lihat
   *  JSDoc DiscrepancyReport.computed di ledger-validator.ts. */
  totalPendapatan: number | null;
  totalBiaya: number | null;
  labaOperasional: number | null;
  zakat: number | null;
  labaBersih: number | null;
  saldoAkhir: number | null;
}

/**
 * Coba parse+validasi buffer file sebagai ledger bookkeeping. Return null (non-fatal)
 * kalau: ekstensi bukan xlsx/xls, workbook tidak dikenali sebagai ledger (chart of
 * accounts "kode posting" atau sheet transaksi "kas" tidak ketemu), atau parsing
 * melempar error apapun -- jalur analisis LLM lama di caller HARUS tetap jalan
 * terlepas dari hasil fungsi ini.
 */
function tryParseStructuredLedger(
  fileName: string,
  buffer: Buffer
): { structuredLedger: StructuredLedgerSummary; discrepancies: DiscrepancyReport } | null {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') return null;

  try {
    const parsed = parseLedgerWorkbook(buffer);
    const isRecognizedLedger = parsed.chartOfAccounts.size > 0 && Object.keys(parsed.transactionsBySheet).length > 0;
    if (!isRecognizedLedger) return null;

    const report = validateLedger(parsed);
    const primarySheet = report.computed.primarySheet;
    const primaryTx = primarySheet ? parsed.transactionsBySheet[primarySheet] || [] : [];
    const periodeMulai = primaryTx.length > 0 ? primaryTx[0].dateIso : null;
    const periodeAkhir = primaryTx.length > 0 ? primaryTx[primaryTx.length - 1].dateIso : null;

    const totalPerKode = Object.entries(report.computed.kodeAggregates).map(([kodeStr, agg]) => {
      const kode = Number(kodeStr);
      return {
        kode,
        namaAkun: parsed.chartOfAccounts.get(kode) ?? null,
        debit: agg.debit,
        credit: agg.credit,
      };
    });

    const structuredLedger: StructuredLedgerSummary = {
      periode: { mulai: periodeMulai, akhir: periodeAkhir },
      sheetPrimer: primarySheet,
      jumlahTransaksi: report.computed.transactionCount,
      totalPerKode,
      totalPendapatan: report.computed.totalPendapatan,
      totalBiaya: report.computed.totalBiaya,
      labaOperasional: report.computed.labaOperasional,
      zakat: report.computed.zakat,
      labaBersih: report.computed.labaBersih,
      saldoAkhir: report.computed.saldoAkhir,
    };

    return { structuredLedger, discrepancies: report };
  } catch (err) {
    console.warn('[Documents] parseLedgerWorkbook/validateLedger gagal (non-fatal, lanjut jalur analisis LLM lama):', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// BUILD 3.4 wiring (roadmap anti-halusinasi 2026-09-06 Bagian 3.4): generalisasi
// "upload dokumen -> cek data lama/baru, typo, konsistensi" ke LUAR ledger --
// berlaku untuk SEMUA ekstensi (bukan cuma xlsx/xls), murni tambahan field
// response opsional `documentCheck`, jalur lama TIDAK diubah. Kalau file
// tabular (xlsx/xls/csv), delegasikan ke checkTabularText (akses struktur
// kolom); selain itu delegasikan ke checkDocumentText (teks bebas). NOL
// panggilan LLM di kedua fungsi itu.
// ---------------------------------------------------------------------------

const TABULAR_EXTENSIONS = new Set(['xlsx', 'xls', 'xlsm', 'csv']);

/**
 * Coba jalankan document-check deterministik atas `content` (teks hasil
 * ekstraksi, sudah tersedia terlepas dari apakah request multipart atau JSON).
 * Non-fatal try/catch -- mengikuti pola tryParseStructuredLedger di atas,
 * kegagalan di sini TIDAK boleh menggagalkan jalur analisis LLM lama.
 */
function tryCheckDocument(fileName: string, content: string): DocumentCheckReport | TabularCheckReport | null {
  try {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (TABULAR_EXTENSIONS.has(ext)) {
      return checkTabularText(content, { fileName });
    }
    return checkDocumentText(content, { fileName });
  } catch (err) {
    console.warn('[Documents] document-checker/tabular-checker gagal (non-fatal, lanjut jalur analisis LLM lama):', err);
    return null;
  }
}

/**
 * Ringkasan naratif compact (bukan raw dump) dipakai sebagai isi
 * recordCompanyKnowledge saat file dikenali sebagai ledger -- fungsi/tag
 * penyimpanan TETAP recordCompanyKnowledge/[COMPANY_KNOWLEDGE] yang sudah ada
 * (tidak bikin jalur/tag baru), hanya isinya diprioritaskan ke angka
 * terverifikasi + diskrepansi alih-alih JSON hasil analisis LLM biasa.
 * recordCompanyKnowledge sendiri sudah memotong ke 1500 char -- ringkasan di
 * sini ditulis padat supaya bagian terpenting (angka + diskrepansi) tidak
 * kepotong duluan.
 */
function buildLedgerKnowledgeSummary(structuredLedger: StructuredLedgerSummary, report: DiscrepancyReport): string {
  const periodeText =
    structuredLedger.periode.mulai && structuredLedger.periode.akhir
      ? `${structuredLedger.periode.mulai} s.d. ${structuredLedger.periode.akhir}`
      : 'tidak diketahui';
  const topKode = structuredLedger.totalPerKode
    .slice(0, 8)
    .map((k) => `${k.namaAkun ?? `kode ${k.kode}`}: debit ${k.debit}, kredit ${k.credit}`)
    .join('; ');
  const discrepancyText =
    report.discrepancies.length > 0
      ? `DISKREPANSI DITEMUKAN (${report.discrepancies.length}): ${report.discrepancies
          .slice(0, 3)
          .map((d) => d.explanation)
          .join(' | ')}`
      : 'Tidak ada diskrepansi antara hasil hitung ulang sistem dan angka tertulis di dokumen.';
  // labaOperasional/labaBersih bisa null (sheet laba-rugi tidak ditemukan) -- tulis
  // "tidak diketahui" eksplisit, JANGAN biarkan interpolasi string menampilkan "null"
  // begitu saja atau (lebih parah) diam-diam terlihat seperti 0 yang valid.
  const laOpText = structuredLedger.labaOperasional !== null ? String(structuredLedger.labaOperasional) : 'tidak diketahui (sheet laba-rugi tidak ditemukan)';
  const laBersihText = structuredLedger.labaBersih !== null ? String(structuredLedger.labaBersih) : 'tidak diketahui (sheet laba-rugi tidak ditemukan)';
  return (
    `Ledger bookkeeping periode ${periodeText}, ${structuredLedger.jumlahTransaksi} transaksi (sheet "${structuredLedger.sheetPrimer ?? '-'}"). ` +
    `Laba operasional (hitung ulang)=${laOpText}, Laba bersih=${laBersihText}, Saldo akhir=${structuredLedger.saldoAkhir}. ` +
    `Ringkasan per kode: ${topKode}. ${discrepancyText}`
  );
}

/**
 * POST /documents/analyze
 * Menerima file (multipart) ATAU teks mentah (JSON), lalu AI mengekstrak profil perusahaan.
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    // 8 Sep (temuan verifikator TINGGI): rate-limit upload/ekstraksi per pemanggil -- multi-upload 12 file + zip per-entri butuh pagar.
    { const rl = checkUploadRateLimit(req, { max: 40, windowMs: 60 * 1000 }); if (!rl.allowed) return uploadRateLimitResponse(rl.resetTime); }
    try {
      const contentType = req.headers.get('content-type') || '';
      let fileName = 'dokumen.txt';
      let content = '';
      let fileBuffer: Buffer | null = null;

      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
          return NextResponse.json({ message: 'File tidak ditemukan. Kirim field "file".' }, { status: 400 });
        }

        fileName = file.name || 'dokumen.txt';
        // FIX (7 Sep 2026): cek file.size SEBELUM arrayBuffer() (lihat catatan serupa di
        // documents/extract-text). 15 MB = batas yang sama supaya perilaku dua endpoint konsisten.
        const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
        if (file.size > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            { message: 'Ukuran file melebihi batas 15 MB. Kecilkan file atau pecah menjadi beberapa bagian.' },
            { status: 413 }
          );
        }
        fileBuffer = Buffer.from(await file.arrayBuffer());
        content = await extractTextFromFile(fileName, fileBuffer);
      } else {
        const body = await req.json().catch(() => ({}));
        fileName = body.fileName || 'dokumen.txt';
        content = body.content || '';
      }

      if (!content || content.trim().length < 20) {
        return NextResponse.json(
          {
            message: 'Isi dokumen terlalu pendek / tidak terbaca. Pastikan file berisi teks (PDF/DOCX/TXT), atau kirim teks via field "content".',
          },
          { status: 400 }
        );
      }

      const result = await analyzeCompanyDocument(auth.workspace.id, content, fileName);

      // FASE 4 wiring — kalau file upload beneran adalah ledger bookkeeping
      // (xlsx/xls + struktur dikenali), hitung ANGKA TERVERIFIKASI + diskrepansi
      // deterministik DI SAMPING hasil analisis LLM di atas -- jalur lama sama
      // sekali tidak dihapus/diubah, ini murni tambahan. null kalau bukan
      // ledger atau file bukan xlsx/xls.
      const ledgerResult = fileBuffer ? tryParseStructuredLedger(fileName, fileBuffer) : null;

      // BUILD 3.4 wiring -- generalisasi document-check ke luar ledger, jalan
      // untuk SEMUA ekstensi (dipanggil dengan `content` yang sudah diekstrak,
      // BUKAN fileBuffer, supaya jalan juga untuk request JSON tanpa
      // fileBuffer). null kalau gagal (non-fatal).
      const documentCheckResult = tryCheckDocument(fileName, content);

      // COMPANY MEMORY (fire-and-forget, non-fatal) — supaya dokumen yang
      // diupload GENUINELY "diinget" lintas-sesi (bukan cuma teks sekali
      // pakai). Sengaja tidak di-await/blocking: kegagalan di sini TIDAK
      // boleh menunda atau menggagalkan response ke client. Kalau file ini
      // ledger, ringkasan yang disimpan diprioritaskan ke angka terverifikasi
      // + diskrepansi (bukan JSON hasil analisis LLM biasa) -- lihat
      // buildLedgerKnowledgeSummary di atas. Baris ini SENGAJA dipertahankan
      // identik dengan sebelum BUILD 3.4 (tidak ikut bercabang ke
      // documentCheckResult) -- company memory untuk kasus non-ledger tetap
      // JSON.stringify(result), byte-identik jalur lama. Anomali documentCheck
      // sudah tersedia terpisah lewat field response `documentCheck` di bawah;
      // menyimpannya juga ke company memory adalah keputusan produk baru yang
      // mengubah perilaku existing, jadi BUKAN cakupan additive sesi ini --
      // kalau dibutuhkan, itu proposal terpisah ke Fatur, bukan diam-diam
      // dipasang di sini.
      const knowledgeSummary = ledgerResult
        ? buildLedgerKnowledgeSummary(ledgerResult.structuredLedger, ledgerResult.discrepancies)
        : JSON.stringify(result);
      recordCompanyKnowledge(auth.workspace.id, fileName, knowledgeSummary).catch((err) => {
        console.warn('[Documents] gagal mencatat company knowledge ke memory (non-fatal):', err);
      });

      // Otomatis sinkronkan hasil ekstraksi profil dokumen ke data perusahaan & AI Memory jika ada nama/industri valid
      if (result.analysis?.name && result.analysis.name.trim() && result.analysis.name !== 'Perusahaan Anda') {
        const companyName = result.analysis.name.trim();
        const industry = result.analysis.industry || '-';
        const targetMarket = result.analysis.targetMarket || '-';
        const description = result.analysis.description || '-';
        const primaryProduct = result.analysis.primaryProduct || '-';

        // 8 Sep (bug F4, temuan sintesis): dulu SELALU menimpa profil + nama workspace. Sekarang lewat
        // kalau profil yang ada sudah terisi (industri bukan '-') atau bersumber MANUAL -- pola merge yang
        // sama dengan auto-company-profile.ts. Field kosong tetap boleh diisi lewat jalur itu.
        const existingProfile = await prisma.memoryItem.findFirst({
          where: { workspaceId: auth.workspace.id, scope: 'WORKSPACE', content: { startsWith: '[COMPANY_PROFILE]' } },
          orderBy: { createdAt: 'desc' }, select: { content: true },
        }).catch(() => null);
        const existingFilled = !!existingProfile && (/Sumber:\s*MANUAL/i.test(existingProfile.content) || !/Industri:\s*-\s*\|/.test(existingProfile.content));
        if (existingFilled) {
          console.warn('[Documents] profil perusahaan sudah terisi/manual -- ekstraksi dokumen TIDAK menimpa (F4 guard).');
        } else try {
          await prisma.workspace.update({
            where: { id: auth.workspace.id },
            data: { name: companyName },
          });

          await prisma.memoryItem.create({
            data: {
              workspaceId: auth.workspace.id,
              userId: auth.user.id,
              scope: 'WORKSPACE',
              content: `[COMPANY_PROFILE] Nama: ${companyName} | Industri: ${industry} | Target Pasar: ${targetMarket} | Deskripsi: ${description} | Produk: ${primaryProduct} | Sumber: Dokumen "${fileName}"`,
            },
          });

          const { invalidateContextCache } = await import('@/lib/ai-brain/context-engine');
          invalidateContextCache(auth.workspace.id);
        } catch (syncErr) {
          console.warn('[Documents] Gagal menyimpan ekstraksi profil ke DB:', syncErr);
        }
      }

      return NextResponse.json({
        success: true,
        fileName,
        contentLength: content.length,
        provider: result.provider,
        modelUsed: result.modelUsed,
        latencyMs: result.latencyMs,
        analysis: result.analysis,
        ...(ledgerResult
          ? { structuredLedger: ledgerResult.structuredLedger, discrepancies: ledgerResult.discrepancies }
          : {}),
        ...(documentCheckResult ? { documentCheck: documentCheckResult } : {}),
      });
    } catch (err: any) {
      console.error('[Documents] analyze error:', err);
      return NextResponse.json({ message: publicApiError('Gagal menganalisis dokumen.') }, { status: 500 });
    }
  },
  { minRole: 'MEMBER' }
);

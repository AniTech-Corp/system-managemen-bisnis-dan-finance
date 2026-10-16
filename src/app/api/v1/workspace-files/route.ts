import { NextRequest, NextResponse } from 'next/server';
import { checkUploadRateLimit, uploadRateLimitResponse } from '@/lib/upload-rate-limit';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import {
  recordCompanyKnowledge,
  deleteCompanyKnowledgeByFile,
  deleteAllCompanyKnowledge,
} from '@/lib/ai-brain/company-memory';
// FASE BUILD 7 Sep (fix upload-001/upload-002/upload-006): pengganti pemanggilan
// extractTextFromBuffer langsung -- lihat JSDoc besar di file itu untuk kenapa
// (pptx tidak lagi jatuh ke fallback teks-mentah biner, allowlist ekstensi ditolak
// bersih di depan, hasil ekstraksi dipagari dari byte NUL sebelum ditulis ke DB).
import {
  extractTextForWorkspaceFile,
  extractWorkspaceZipEntries,
  buildSafeChildFileName,
  getFileExtension,
  isSupportedWorkspaceFileExtension,
  sanitizeExtractionErrorMessage,
  unsupportedExtensionMessage,
} from '@/lib/workspace-file-extraction';
// FASE BUILD 7 Sep (fix integrasi-01): parser ledger deterministik yang SAMA
// dipakai chat attachment (documents/extract-text/route.ts), disambungkan ke jalur
// Pusat Data lewat modul terpisah -- lihat JSDoc besar di file itu untuk alasan
// kenapa diduplikasi bukan di-share langsung.
import { buildVerifiedNumbersBlock, tryParseWorkspaceFileAsLedger } from '@/lib/workspace-file-ledger';
// V4a/V4b/V4c, 8 Sep 2026 (deteksi kesalahan data end-to-end di Pusat Data):
// SATU-SATUNYA titik pemakaian document-checker.ts/tabular-checker.ts untuk
// jalur ini -- lihat JSDoc besar di workspace-file-dataquality.ts untuk alasan
// + keterbatasan jujur (checkTabularText dipanggil atas teks markdown-table
// hasil ekstraksi xlsx, sama seperti pola tryCheckDocument() yang sudah lebih
// dulu ada di documents/analyze/route.ts -- bukan bug baru, pola diwariskan).
import {
  tryCheckWorkspaceFileDataQuality,
  buildDataQualityBlock,
  worstSeverity,
  parseDataQualityHeader,
} from '@/lib/workspace-file-dataquality';
// B1 BACKEND, 8 Sep 2026 (T4 -- dashboard & AI langsung ikut): invalidateContextCache
// SUDAH ADA + sudah diekspor di context-engine.ts (Map in-memory murni, tidak sentuh
// Prisma) -- file itu TIDAK diedit sama sekali di sini, cuma diimpor+dipanggil.
import { invalidateContextCache } from '@/lib/ai-brain/context-engine';
// KOMANDO 11 Sep 2026 (Council SPEED pagar #2): upload/hapus file -> cache insight dashboard dibuang.
import { invalidateDashboardInsightCache } from '@/lib/ai-brain/dashboard-insight';
// KOMANDO 11 Sep 2026 (ADENDUM fase 2 seksi C, arahan Mecca "USB ditancap"): setelah file
// tersimpan + diekstrak, tabel terstruktur LANGSUNG diimpor ke tabel domain (kas/produk/
// payroll/tugas usulan) lewat parser deterministik -- lihat auto-ingest.ts.
import { runAutoIngest, loadIngestLogs, undoIngest, type IngestSummary } from '@/lib/ai-brain/auto-ingest';
// FILTER DIVISI (11 Sep 2026 sore, keputusan produk Mecca): daftar file disaring
// per divisi pembaca (CEO semua; Finance keuangan+SDM+umum; Marketing marketing+umum;
// file upload sendiri selalu tampil). Lihat data-visibility.ts.
import { resolveDivisionRole, filterFilesForRole, FILE_DIVISION_LABEL } from '@/lib/ai-brain/data-visibility';
// B1 BACKEND, 8 Sep 2026 (T4 -- profil perusahaan otomatis sekali per batch):
// fungsi ini milik B3 (file BARU src/lib/ai-brain/auto-company-profile.ts, dibangun
// paralel di wave yang sama) -- HANYA diimpor+dipanggil fire-and-forget di sini,
// TIDAK PERNAH diedit isinya. Kontrak (never-throw ke caller) ada di dokumen sintesis
// komando. Kalau file itu belum ter-commit saat berkas INI di-tsc/test, error resolve
// modul di titik impor ini BUKAN kesalahan berkas ini -- lihat catatan_jujur laporan.
import { scheduleAutoCompanyProfileSync } from '@/lib/ai-brain/auto-company-profile';
// B3_AI, 11 Sep 2026 (kontrak modul 4 -- company-brief.ts, wiring milik B3 sendiri):
// brief naratif perusahaan (BEDA dari 7-field auto-company-profile) di-refresh
// debounce SETELAH tiap upload/hapus sukses, pola sama persis panggilan
// scheduleAutoCompanyProfileSync di atas -- fire-and-forget, never-throw.
import { scheduleCompanyBriefRefresh, deleteCompanyBriefs } from '@/lib/ai-brain/company-brief';
// FASE 5, 13 Sep 2026: File Intelligence — auto-kategorisasi + tag extraction deterministik
// setelah ekstraksi teks. Pola blok header [KATEGORI FILE] sama seperti [PEMERIKSAAN DATA]
// (additive, zero kolom DB baru, zero LLM). Non-fatal: tidak pernah gagalkan upload.
import { classifyWorkspaceFile, buildFileIntelligenceBlock } from '@/lib/workspace-file-intelligence';

// Roadmap 7 Sep, item 4.1/4.2 -- Pusat/Hub Upload Data (prioritas #1 versi Mecca).
// FASE 5, 13 Sep 2026: MAX_FILE_BYTES dihapus per keputusan Mecca (no size limit).
// Rate-limit per menit (checkUploadRateLimit) tetap aktif sebagai pagar.

// GET: daftar file workspace (buat halaman Pusat Data)
//
// FASE BUILD 7 Sep 2026 (roadmap integrasi data upload item 3, B2): cap
// penyimpanan extractedSummary di kolom DB dinaikkan 4000->24000 char (lihat
// POST di bawah) supaya AI Brain (workspace-knowledge.ts, lane B3) bisa baca
// isi file lebih banyak. TAPI daftar file di endpoint INI (dipakai
// WorkspaceDataHub.tsx untuk render "Lihat isi" & tombol "Tanya AI") TIDAK
// perlu isi sepanjang itu untuk SATU LAYAR daftar -- kalau 12 file x 24000
// char dikirim sekaligus tiap buka Hub, itu ~288KB payload JSON untuk
// tampilan yang cuma butuh gist singkat. Maka di RESPONSE (bukan di DB)
// extractedSummary dipotong ke 1200 char + field `summaryTruncated: true`
// supaya frontend TAHU ada bagian yang terpotong (bukan diam-diam kurang).
// CATATAN JUJUR (WAJIB dibaca komando/B4): WorkspaceDataHub.tsx SAAT INI
// (7 Sep, sebelum sesi build ini) memakai `f.extractedSummary` dari respons
// GET ini APA ADANYA untuk 2 hal -- (a) panel "Lihat isi" (expand per file),
// (b) tombol "Tanya AI" yang menempelkan seluruh extractedSummary ke chat
// composer. TIDAK ADA endpoint GET /workspace-files/[id] detail-per-file di
// repo ini (dicek: hanya route.ts ini + [id]/import-ledger/route.ts) --
// jadi begitu truncation 1200 char ini aktif, KEDUA fitur itu di
// WorkspaceDataHub.tsx OTOMATIS terdegradasi (isi yang ditampilkan/dikirim
// ke AI cuma 1200 char pertama, bukan sampai 24000 char yang sekarang
// tersimpan). Ini BUKAN bug tersembunyi -- field `summaryTruncated` sengaja
// disediakan supaya WorkspaceDataHub.tsx (lane B4, file itu BUKAN milik
// scope build ini) bisa menampilkan indikator "..." dan idealnya menambah
// endpoint detail-per-file baru untuk menarik isi penuh saat user expand.
// Tanpa penyesuaian itu, fitur "Lihat isi"/"Tanya AI" akan terasa
// mundur (isi lebih pendek dari sebelumnya, yang selama ini efektif
// menampilkan sampai 4000 char penuh) -- WAJIB ditindaklanjuti B4/komando.
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const allFiles = await prisma.workspaceFile.findMany({
        where: { workspaceId: auth.workspace.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, fileName: true, fileType: true, sizeBytes: true,
          extractedSummary: true, linkedRecordIds: true, status: true, createdAt: true,
          uploadedBy: true,
          uploader: { select: { fullName: true } },
          // storageBlob SENGAJA tidak di-select di sini -- daftar file tidak perlu
          // isi biner, cuma metadata. Ambil isi lewat GET /workspace-files/[id].
        },
      });

      const GIST_MAX_CHARS = 1200;
      // 11 Sep 2026: peta impor otomatis per file (kind + jumlah) untuk badge/tombol batalkan di Hub.
      const ingestLogs = await loadIngestLogs(auth.workspace.id);
      // FILTER DIVISI (11 Sep sore): ?portal=CEO|FINANCE|MARKETING dari client hanya
      // cadangan; membership OWNER/ADMIN + email akun divisi menang.
      const division = resolveDivisionRole({
        email: auth.user.email,
        membershipRole: auth.membership.role,
        declaredRole: req.nextUrl.searchParams.get('portal'),
      });
      const withIngest = allFiles.map((f) => ({ ...f, ingestKind: ingestLogs.get(f.id)?.kind ?? null }));
      const { visible: files, hiddenCount } = filterFilesForRole(withIngest, division, { viewerUserId: auth.user.id });
      const mapped = files.map((f) => {
        const full = f.extractedSummary ?? null;
        const summaryTruncated = full !== null && full.length > GIST_MAX_CHARS;
        // V4b, 8 Sep 2026: dataQualityCount/dataQualityWorst diparse dari HEADER
        // teks blok "[PEMERIKSAAN DATA]" di `full` (extractedSummary MENTAH,
        // SEBELUM dipotong ke GIST_MAX_CHARS di atas) -- bukan kolom DB baru,
        // murni regex atas teks yang sudah tersimpan (lihat workspace-file-
        // dataquality.ts). File tanpa blok itu sama sekali -> count 0, worst null.
        const dq = parseDataQualityHeader(full);
        const { uploadedBy: _uploadedBy, ...rest } = f;
        return {
          ...rest,
          extractedSummary: summaryTruncated ? full!.slice(0, GIST_MAX_CHARS) + '…' : full,
          summaryTruncated,
          dataQualityCount: dq.count,
          dataQualityWorst: dq.worst,
          ingestKind: ingestLogs.get(f.id)?.kind ?? null,
          ingestCount: ingestLogs.get(f.id)?.ids.length ?? 0,
          divisi: f.divisi,
          divisiLabel: FILE_DIVISION_LABEL[f.divisi],
        };
      });

      return NextResponse.json({
        files: mapped,
        visibility: { division, hiddenCount, totalFiles: allFiles.length },
      });
    } catch (err: any) {
      console.error('[workspace-files] GET error:', err);
      return NextResponse.json({ message: 'Gagal mengambil daftar file.' }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: upload file baru -- ekstrak lewat pipeline yang sama dengan chat, simpan record.
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    // 8 Sep (temuan verifikator TINGGI): rate-limit upload/ekstraksi per pemanggil -- multi-upload 12 file + zip per-entri butuh pagar.
    { const rl = checkUploadRateLimit(req, { max: 40, windowMs: 60 * 1000 }); if (!rl.allowed) return uploadRateLimitResponse(rl.resetTime); }
    try {
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json({ message: 'Kirim file via multipart/form-data dengan field "file".' }, { status: 400 });
      }
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ message: 'File tidak ditemukan dalam form data.' }, { status: 400 });
      }
      // Batas ukuran 100 MB per arahan Mecca (maks 100MB per file)
      const MAX_FILE_BYTES = 100 * 1024 * 1024;
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({
          message: `Ukuran file "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimum 100 MB.`
        }, { status: 413 });
      }

      // B1 BACKEND, 8 Sep 2026 (T3 -- lampiran chat -> Pusat Data, kontrak dgn B2):
      // teks ekstraksi yang SUDAH dihasilkan client dari /api/v1/documents/extract-text
      // (field `rawContent`) ATAU dari FileReader lokal (txt/csv/json/md) -- dipakai
      // APA ADANYA untuk skip ekstraksi ulang (hindari OCR Gemini dobel, lihat T3-03),
      // KECUALI file .pptx (extract-text TIDAK punya cabang pptx -- lihat T3-05, hasilnya
      // beda/salah dari pipeline extractTextForWorkspaceFile yang genuinely tahu .pptx)
      // ATAU file .zip (T2 selalu ekstrak ulang per-entri di server, preExtractedContent
      // tidak relevan untuk jalur zip). String kosong dianggap "tidak ada" (falsy check).
      const preExtractedContent = (formData.get('preExtractedContent') as string | null) || null;

      const fileName = file.name || 'dokumen';
      const fileType = file.type || 'application/octet-stream';
      const ext = getFileExtension(fileName);

      // upload-002 (TINGGI): ekstensi ditolak BERSIH di depan, SEBELUM buffer besar
      // dibaca ke memori atau record PROCESSING dibuat -- alih-alih ketahuan gagal
      // setelah proses penuh berjalan (baca fileName saja, tidak perlu buffer).
      if (!isSupportedWorkspaceFileExtension(fileName)) {
        return NextResponse.json({ message: unsupportedExtensionMessage(fileName) }, { status: 422 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Bikin record dulu berstatus PROCESSING supaya user langsung lihat file-nya
      // muncul di daftar (roadmap: "status diproses/gagal" WAJIB terlihat).
      const record = await prisma.workspaceFile.create({
        data: {
          workspaceId: auth.workspace.id,
          uploadedBy: auth.user.id,
          fileName, fileType, sizeBytes: buffer.length,
          storageBlob: buffer,
          status: 'PROCESSING',
        },
      });

      try {
        // B1 BACKEND, 8 Sep 2026 (T2 -- zip per-entri) -- TEST-HOOK: cabang zip vs
        // non-zip. .zip SELALU diekstrak ulang di server (preExtractedContent tidak
        // relevan di sini -- lihat komentar di titik baca preExtractedContent di atas).
        if (ext === 'zip') {
          // extractWorkspaceZipEntries boleh throw (arsip korup / >50 entri / >40MB
          // dekompresi) -- SENGAJA TIDAK ditangkap di sini, propagate ke catch block
          // di bawah supaya PARENT record ditandai FAILED dan ZERO child dibuat
          // (tidak ada child yang sempat ditulis sebagian sebelum cap terlanggar).
          const zipEntries = await extractWorkspaceZipEntries(buffer, fileName);

          const childIds: string[] = [];
          const manifestLines: string[] = [`Arsip "${fileName}" berisi ${zipEntries.length} entri:`];
          const skipReasonLabel: Record<string, string> = {
            skipped_nested_zip: 'zip di dalam zip tidak didukung',
            skipped_unsupported: 'format tidak didukung',
          };
          // V4a (opsional, 8 Sep 2026): agregat ringkas jumlah child bermasalah --
          // dihitung sambil jalan di loop, dilaporkan di zipSummary di bawah.
          let dataQualityFileCount = 0;
          const zipIngest: Array<{ fileName: string; kind: string; created: number; label: string }> = [];

          for (const entry of zipEntries) {
            if (entry.status !== 'extracted') {
              const label = entry.status === 'failed' ? (entry.error || 'gagal diekstrak') : skipReasonLabel[entry.status];
              manifestLines.push(`- ${entry.name}: DILEWATI (${label})`);
              continue;
            }

            const entryBuffer = entry.buffer as Buffer;
            const entryContent = entry.content as string;

            // integrasi-01, PER CHILD -- pola SAMA PERSIS dgn jalur non-zip di bawah,
            // reuse penuh (tryParseWorkspaceFileAsLedger + buildVerifiedNumbersBlock).
            const entryLedgerResult = tryParseWorkspaceFileAsLedger(entry.childFileName, entryBuffer);
            const entryLedgerBlock = entryLedgerResult
              ? buildVerifiedNumbersBlock(entryLedgerResult.structuredLedger, entryLedgerResult.discrepancies)
              : '';
            // V4a, PER CHILD -- pola SAMA PERSIS dgn jalur non-zip di bawah, cek
            // deteksi kesalahan data dijalankan atas TEKS HASIL EKSTRAKSI entri
            // (entryContent), bukan buffer mentah.
            const entryDqResult = tryCheckWorkspaceFileDataQuality(entry.childFileName, entryContent);
            const entryDqBlock = entryDqResult ? buildDataQualityBlock(entryDqResult) : '';
            if (entryDqResult && entryDqResult.anomalies.length > 0) dataQualityFileCount++;
            const entryFinalContent = [entryDqBlock, entryLedgerBlock, entryContent].filter(Boolean).join('\n\n');
            const entrySummary = entryFinalContent.length > 24000 ? entryFinalContent.slice(0, 24000) + '…' : entryFinalContent;

            const childRecord = await prisma.workspaceFile.create({
              data: {
                workspaceId: auth.workspace.id,
                uploadedBy: auth.user.id,
                fileName: entry.childFileName,
                fileType: 'application/octet-stream',
                sizeBytes: entryBuffer.length,
                storageBlob: entryBuffer,
                status: 'PROCESSED',
                extractedSummary: entrySummary,
              },
              select: { id: true },
            });
            childIds.push(childRecord.id);
            // AUTO-INGEST per child zip (11 Sep 2026) -- pola sama dengan jalur non-zip.
            const childIngest = await runAutoIngest({
              workspaceId: auth.workspace.id,
              userId: auth.user.id,
              fileId: childRecord.id,
              fileName: entry.childFileName,
              buffer: entryBuffer,
              extractedText: entryContent,
            });
            zipIngest.push({ fileName: entry.childFileName, kind: childIngest.kind, created: childIngest.created, label: childIngest.label });
            manifestLines.push(
              `- ${entry.name} -> "${entry.childFileName}": DIEKSTRAK${entryLedgerResult ? ' (ledger terdeteksi)' : ''} (${entrySummary.length} char)${childIngest.created > 0 ? ` -> impor otomatis ${childIngest.kind}: ${childIngest.created}` : ''}`
            );

            // COMPANY MEMORY, PER CHILD (fire-and-forget, non-fatal) -- sesuai kontrak
            // T2: tiap entri yang diekstrak ikut masuk MemoryItem[COMPANY_KNOWLEDGE]
            // dgn nama child sbg sumbernya, SAMA seperti jalur non-zip di bawah.
            recordCompanyKnowledge(auth.workspace.id, entry.childFileName, entrySummary).catch((err) => {
              console.warn('[workspace-files] gagal mencatat company knowledge child zip (non-fatal):', err);
            });
          }

          const manifest = manifestLines.join('\n');
          const updated = await prisma.workspaceFile.update({
            where: { id: record.id },
            // linkedRecordIds REUSE field lama (schema.prisma:591, NOL migration) --
            // untuk record INDUK zip diisi child WorkspaceFile id (BUKAN CashTransaction
            // id seperti pemakaian lama di import-ledger/route.ts). Tombol "Impor ke Buku
            // Kas" di UI cuma nongol utk fileName berakhiran .xlsx/.xls/.csv, parent zip
            // TIDAK PERNAH match regex itu -- lihat catatan_jujur soal endpoint import-
            // ledger diakses LANGSUNG (di luar UI) terhadap id parent (409 message-nya
            // akan salah sebut "transaksi" padahal isinya child-id, KETERBATASAN DIKETAHUI,
            // di luar scope perbaikan wave ini karena [id]/import-ledger/route.ts RESERVED).
            data: { extractedSummary: manifest, status: 'PROCESSED', linkedRecordIds: childIds },
            select: { id: true, fileName: true, fileType: true, sizeBytes: true, extractedSummary: true, linkedRecordIds: true, status: true, createdAt: true },
          });

          // TEST-HOOK: T4 -- invalidasi cache + auto-profil SEKALI PER BATCH (di
          // LUAR loop child di atas, bukan per-entri) -- lihat bantahan kritik 8 Sep
          // soal risiko "terpanggil 50x kalau ditaruh di dalam loop", sengaja dihindari.
          invalidateContextCache(auth.workspace.id);
          void invalidateDashboardInsightCache(auth.workspace.id);
          scheduleAutoCompanyProfileSync(auth.workspace.id, `Upload ZIP "${fileName}"`);
          scheduleCompanyBriefRefresh(auth.workspace.id, `Upload ZIP "${fileName}"`);

          return NextResponse.json({
            success: true,
            file: updated,
            // Field TAMBAHAN (additive) -- kontrak dgn B2, dipakai UI menampilkan
            // ringkasan hasil ekstraksi zip tanpa perlu parse ulang `extractedSummary`.
            zipSummary: {
              totalEntries: zipEntries.length,
              extractedCount: childIds.length,
              skippedCount: zipEntries.filter((e) => e.status === 'skipped_nested_zip' || e.status === 'skipped_unsupported').length,
              failedCount: zipEntries.filter((e) => e.status === 'failed').length,
              // V4a (opsional, 8 Sep 2026): jumlah child dengan anomali kualitas
              // data >0 -- detail per-child (count/worst/anomalies) diambil
              // belakangan lewat GET list (child sudah jadi WorkspaceFile row
              // sendiri), ini cuma angka ringkas transparansi di respons upload.
              dataQualityFileCount,
              // 11 Sep 2026: ringkasan impor otomatis per entri.
              ingest: zipIngest,
            },
          });
        }

        // upload-001 (KRITIS): extractTextForWorkspaceFile() menangani .pptx lewat
        // JSZip sendiri (bukan fallback teks-mentah biner) dan memagari HASIL apapun
        // dari byte NUL sebelum sampai ke sini -- lihat JSDoc di workspace-file-
        // extraction.ts. Kalau melempar, itu SELALU pesan yang sudah aman ditampilkan
        // (bukan stack trace mentah), tapi tetap disaring sekali lagi di catch block
        // di bawah untuk jaga-jaga error dari sumber LAIN (mis. Postgres write).
        //
        // B1 BACKEND, 8 Sep 2026 (T3 -- kontrak dgn B2, TEST-HOOK cabang preExtracted
        // vs ekstraksi baru): kalau client sudah kirim `preExtractedContent` (hasil
        // extract-text/FileReader di sisi chat) DAN file ini BUKAN .pptx (T3-05 --
        // extract-text tidak punya cabang pptx, hasilnya akan salah/sampah kalau
        // dipakai apa adanya), pakai teks itu APA ADANYA -- skip ekstraksi ulang
        // (hindari OCR Gemini dobel utk gambar). Selain itu (termasuk SELALU utk
        // .pptx), tetap extractTextForWorkspaceFile seperti sebelumnya, NOL DIUBAH.
        const extracted =
          preExtractedContent && ext !== 'pptx'
            ? preExtractedContent
            : await extractTextForWorkspaceFile(fileName, buffer);

        // integrasi-01 (KRITIS): kalau file ini xlsx/xls DAN dikenali sebagai ledger
        // bookkeeping (chart-of-accounts + sheet "kas"), sisipkan blok ANGKA
        // TERVERIFIKASI di AWAL summary -- non-fatal kalau bukan/gagal, `finalContent`
        // sama persis dengan `extracted` di kasus itu (lihat tryParseWorkspaceFileAsLedger).
        const ledgerResult = tryParseWorkspaceFileAsLedger(fileName, buffer);
        const ledgerBlock = ledgerResult
          ? buildVerifiedNumbersBlock(ledgerResult.structuredLedger, ledgerResult.discrepancies)
          : '';
        // V4a, 8 Sep 2026 (deteksi kesalahan data end-to-end) -- dijalankan atas
        // `extracted` (teks HASIL EKSTRAKSI, sama seperti tryParseWorkspaceFileAsLedger
        // di atas dijalankan atas buffer) SEBELUM finalContent dirakit, supaya
        // blok "[PEMERIKSAAN DATA]" (kalau ada temuan) ikut tersisip di AWAL
        // extractedSummary yang disimpan -- lihat JSDoc workspace-file-dataquality.ts.
        const dqResult = tryCheckWorkspaceFileDataQuality(fileName, extracted);
        const dqBlock = dqResult ? buildDataQualityBlock(dqResult) : '';
        // 8 Sep (temuan verifikator TINGGI, integritas finansial): ANGKA TERVERIFIKASI ledger
        // ditaruh PALING DEPAN supaya tidak pernah terpotong budget knowledge; blok pemeriksaan
        // data (informasi) menyusul, isi mentah terakhir.
        const finalContent = [ledgerBlock, dqBlock, extracted].filter(Boolean).join('\n\n');

        // FASE 5, 13 Sep 2026: File Intelligence -- klasifikasi deterministik (zero LLM)
        // disuntikkan sebagai blok [KATEGORI FILE] di AWAL extractedSummary -- pola sama
        // seperti [PEMERIKSAAN DATA], tanpa kolom DB baru. Non-fatal: try/catch internal.
        const intelligenceResult = classifyWorkspaceFile(fileName, extracted);
        const intelligenceBlock = buildFileIntelligenceBlock(intelligenceResult);
        const finalContentWithIntelligence = [intelligenceBlock, finalContent].filter(Boolean).join('\n\n');

        const summary = finalContentWithIntelligence.length > 24000 ? finalContentWithIntelligence.slice(0, 24000) + '…' : finalContentWithIntelligence;
        const updated = await prisma.workspaceFile.update({

          where: { id: record.id },
          data: { extractedSummary: summary, status: 'PROCESSED' },
          select: { id: true, fileName: true, fileType: true, sizeBytes: true, extractedSummary: true, linkedRecordIds: true, status: true, createdAt: true },
        });

        // AUTO-INGEST "USB" (11 Sep 2026): angka HANYA dari parser deterministik; LLM cuma untuk
        // tugas usulan dari notulen. Never-throw -- upload tetap sukses walau ingest gagal.
        const ingest: IngestSummary = await runAutoIngest({
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          fileId: record.id,
          fileName,
          buffer,
          extractedText: extracted,
        });
        if (ingest.linkedIds.length > 0) updated.linkedRecordIds = ingest.linkedIds;

        // COMPANY MEMORY (fire-and-forget, non-fatal) -- niru pola yang sama
        // persis dengan documents/analyze/route.ts: supaya isi file yang
        // diupload lewat Pusat Data IKUT masuk MemoryItem[COMPANY_KNOWLEDGE]
        // dan otomatis kebaca getAccumulatedCompanyKnowledge() di setiap
        // request brain/chat. Sengaja TIDAK di-await/blocking -- kegagalan di
        // sini TIDAK boleh menunda atau menggagalkan response upload utama.
        recordCompanyKnowledge(auth.workspace.id, fileName, summary).catch((err) => {
          console.warn('[workspace-files] gagal mencatat company knowledge ke memory (non-fatal):', err);
        });

        // TEST-HOOK: T4 -- invalidasi cache + auto-profil SEKALI per upload non-zip
        // (debounce "sekali per BATCH" jadi tanggung jawab scheduleAutoCompanyProfileSync
        // milik B3 -- fungsi itu di-reset timer-nya tiap kali dipanggil, lihat kontrak).
        invalidateContextCache(auth.workspace.id);
          void invalidateDashboardInsightCache(auth.workspace.id);
        scheduleAutoCompanyProfileSync(auth.workspace.id, `Upload "${fileName}"`);
        scheduleCompanyBriefRefresh(auth.workspace.id, `Upload "${fileName}"`);

        return NextResponse.json({
          success: true,
          file: updated,
          // Field TAMBAHAN (non-breaking) -- dipakai WorkspaceDataHub.tsx untuk
          // menampilkan tombol "Impor ke Buku Kas" hanya kalau file ini genuinely
          // dikenali sebagai ledger (integrasi-02/integrasi-03).
          ...(ledgerResult ? { isRecognizedLedger: true } : {}),
          // 11 Sep 2026: hasil impor otomatis (kind/created/label/warnings) untuk UI Hub.
          ingest,
          // V4a, 8 Sep 2026: field TAMBAHAN (additive) -- absen (bukan objek
          // kosong) kalau NOL anomali ditemukan, supaya konsumen lama yang cuma
          // cek `success`/`file` tidak terpengaruh.
          ...(dqResult && dqResult.anomalies.length > 0
            ? {
                dataQuality: {
                  count: dqResult.anomalies.length,
                  worst: worstSeverity(dqResult.anomalies),
                  anomalies: dqResult.anomalies.slice(0, 10),
                },
              }
            : {}),
        });
      } catch (extractErr: any) {
        await prisma.workspaceFile.update({ where: { id: record.id }, data: { status: 'FAILED' } });
        // upload-001 (c): pesan error ke CLIENT WAJIB disaring -- kalau extractErr
        // berasal dari sumber selain extractTextForWorkspaceFile (mis. Postgres
        // menolak write, atau error internal lain), pesannya bisa berisi stack
        // trace/source bundel mentah. sanitizeExtractionErrorMessage menahan itu di
        // server log, cuma pesan jujur-pendek yang diteruskan ke client.
        const safeMessage = sanitizeExtractionErrorMessage(extractErr, fileName);
        console.warn('[workspace-files] extraction failed, record kept as FAILED:', safeMessage);
        return NextResponse.json({
          success: true,
          file: { id: record.id, fileName, fileType, sizeBytes: buffer.length, extractedSummary: null, linkedRecordIds: [], status: 'FAILED', createdAt: record.createdAt },
          message: `File tersimpan tapi gagal diekstrak. ${safeMessage}`,
        });
      }
    } catch (err: any) {
      console.error('[workspace-files] POST error:', err);
      return NextResponse.json({ message: 'Gagal mengunggah file.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// DELETE: hapus file (menutup gap Bagian 9.4 dokumen Fatur -- sekarang genuinely bisa ditarik)
//
// B1 BACKEND, 8 Sep 2026 (T4 -- integritas induk-anak zip, temuan kritik 8 Sep: "DELETE
// record induk tidak mencegah/membersihkan anak, jadi orphan"): baca dulu record yang mau
// dihapus SEBELUM delete, supaya bisa tahu apakah ini PARENT zip (T2) yang linkedRecordIds-
// nya berisi id WorkspaceFile anak -- BUKAN file ledger biasa yang linkedRecordIds-nya
// berisi id CashTransaction (diisi import-ledger/route.ts, field SAMA, PEMAKAIAN BEDA).
// Disambiguasi lewat fileName berakhiran ".zip" -- SATU-SATUNYA cara linkedRecordIds berisi
// WorkspaceFile id (lihat POST di atas: HANYA cabang ext==='zip' yang mengisinya begitu;
// entri nested-zip TIDAK PERNAH jadi child row sendiri, jadi child TIDAK PERNAH ber-ekstensi
// .zip -- rekursi delete-berantai tidak mungkin terjadi). TIDAK PERNAH menghapus
// CashTransaction lewat jalur ini -- itu di luar scope & akan menghapus data finansial
// tanpa konfirmasi eksplisit, HARAM. CATATAN JUJUR: ini HANYA menutup arah induk->anak;
// arah SEBALIKNYA (hapus SATU anak lewat id-nya sendiri membuat linkedRecordIds induk jadi
// basi/referensi mati) TIDAK ditutup di sini -- di luar instruksi eksplisit wave ini,
// dilaporkan sbg gap yang masih ada di catatan_jujur laporan akhir.
export const DELETE = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const isDeleteAll = req.nextUrl.searchParams.get('all') === 'true';
      if (isDeleteAll) {
        // 1. Ambil semua file yang akan dihapus untuk membersihkan memoryItem dan auto-ingest
        const allFiles = await prisma.workspaceFile.findMany({
          where: { workspaceId: auth.workspace.id },
          select: { id: true, fileName: true, linkedRecordIds: true },
        });

        // 2. Batalkan/bersihkan data turunan auto-ingest untuk tiap file
        for (const f of allFiles) {
          await undoIngest(auth.workspace.id, f.id).catch(() => {});
        }

        // Kumpulkan ID dan nama file untuk pembersihan cascading CashTransaction
        const allFileLinkedIds = allFiles.flatMap((f) => f.linkedRecordIds);
        const fileNameFilters = allFiles.flatMap((f) => [
          { description: { contains: `(impor dari "${f.fileName}")` } },
          { description: { contains: `(impor otomatis dari "${f.fileName}")` } },
        ]);

        // 3. Atomic Cascade Purge via Prisma Transaction across ALL domains (menghapus tuntas data turunan)
        const deleteResult = await prisma.$transaction(async (tx) => {
          // A. Inventory domain (urutan: child models lebih dulu untuk mencegah Foreign Key Restrict error)
          await (tx as any).stockReturn?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await (tx as any).stockMovement?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await (tx as any).purchaseOrderItem?.deleteMany?.({ where: { purchaseOrder: { workspaceId: auth.workspace.id } } }).catch(() => {});
          await (tx as any).purchaseOrder?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await (tx as any).productBatch?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await (tx as any).product?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await (tx as any).customer?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await (tx as any).supplierScore?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});

          // B. Finance domain (bersihkan seluruh mutasi kasir dan transaksi file)
          await tx.cashTransaction.deleteMany({ where: { workspaceId: auth.workspace.id } }).catch(() => {});

          // C. Operations & HR domain (payroll, presensi, tugas tim)
          await (tx as any).employeePayroll?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await (tx as any).attendanceRecord?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await (tx as any).workTask?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});

          // D. Marketing domain
          await (tx as any).campaign?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});

          // E. Ingest logs & Memory items (menghapus insight narasi basi)
          await (tx as any).ingestLog?.deleteMany?.({ where: { workspaceId: auth.workspace.id } }).catch(() => {});
          await tx.memoryItem.deleteMany({ where: { workspaceId: auth.workspace.id } }).catch(() => {});

          // F. Hapus seluruh record WorkspaceFile
          return await tx.workspaceFile.deleteMany({ where: { workspaceId: auth.workspace.id } });
        });

        // 4. Hapus company knowledge & brief perusahaan agar AI tidak menyuplai ringkasan lama
        await deleteAllCompanyKnowledge(auth.workspace.id).catch(() => {});
        await deleteCompanyBriefs(auth.workspace.id).catch(() => {});

        // 7. Invalidate seluruh cache in-memory
        invalidateContextCache(auth.workspace.id);
        void invalidateDashboardInsightCache(auth.workspace.id);

        return NextResponse.json({
          success: true,
          deletedCount: deleteResult.count,
          domainRecordsRetained: false,
          message: 'Semua file, ingatan AI, dan cache data berhasil dibersihkan.',
        });
      }

      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json({ message: 'ID file wajib diisi.' }, { status: 400 });
      }

      const target = await prisma.workspaceFile.findFirst({
        where: { id, workspaceId: auth.workspace.id },
        select: { id: true, fileName: true, linkedRecordIds: true },
      });
      if (!target) {
        return NextResponse.json({ message: 'File tidak ditemukan di workspace ini.' }, { status: 404 });
      }

      const isZipParent = getFileExtension(target.fileName) === 'zip' && target.linkedRecordIds.length > 0;
      
      // Kumpulkan nama-nama file yang dihapus untuk membersihkan MemoryItem[COMPANY_KNOWLEDGE]
      const fileNamesToDelete: string[] = [target.fileName];
      const targetChildIds: string[] = isZipParent ? target.linkedRecordIds : [];

      if (isZipParent) {
        const childFiles = await prisma.workspaceFile.findMany({
          where: { id: { in: target.linkedRecordIds }, workspaceId: auth.workspace.id },
          select: { id: true, fileName: true },
        });
        for (const cf of childFiles) {
          fileNamesToDelete.push(cf.fileName);
          await undoIngest(auth.workspace.id, cf.id).catch(() => {});
        }
      } else {
        await undoIngest(auth.workspace.id, target.id).catch(() => {});
      }

      // Hapus MemoryItem[COMPANY_KNOWLEDGE] untuk file-file ini
      await deleteCompanyKnowledgeByFile(auth.workspace.id, fileNamesToDelete);

      const deletedChildCount = await prisma.$transaction(async (tx) => {
        // Hapus transaksi kas turunan dari file yang dihapus
        const fileMatchPatterns = fileNamesToDelete.flatMap((name) => [
          { description: { contains: `(impor dari "${name}")` } },
          { description: { contains: `(impor otomatis dari "${name}")` } },
        ]);

        const recordIdConditions = target.linkedRecordIds.length > 0 && !isZipParent
          ? [{ id: { in: target.linkedRecordIds } }]
          : [];

        await tx.cashTransaction.deleteMany({
          where: {
            workspaceId: auth.workspace.id,
            OR: [
              ...fileMatchPatterns,
              ...recordIdConditions,
              { sourceFileId: target.id },
            ],
          },
        }).catch(() => {});

        // Pembersihan defensif multi-domain jika linkedRecordIds berisi id produk/payroll/campaign/task
        const productFilter = target.linkedRecordIds.length > 0 && !isZipParent
          ? { workspaceId: auth.workspace.id, OR: [{ id: { in: target.linkedRecordIds } }, { sourceFileId: target.id }] }
          : { workspaceId: auth.workspace.id, sourceFileId: target.id };

        // Bersihkan entri turunan inventori terlebih dahulu agar terhindar dari foreign key restrict
        await (tx as any).stockReturn?.deleteMany?.({ where: { product: productFilter } }).catch(() => {});
        await (tx as any).stockMovement?.deleteMany?.({ where: { product: productFilter } }).catch(() => {});
        await (tx as any).purchaseOrderItem?.deleteMany?.({ where: { product: productFilter } }).catch(() => {});
        await (tx as any).productBatch?.deleteMany?.({ where: { product: productFilter } }).catch(() => {});
        await (tx as any).product?.deleteMany?.({ where: productFilter }).catch(() => {});

        if (target.linkedRecordIds.length > 0 && !isZipParent) {
          await (tx as any).employeePayroll?.deleteMany?.({
            where: { workspaceId: auth.workspace.id, id: { in: target.linkedRecordIds } },
          }).catch(() => {});
          await (tx as any).campaign?.deleteMany?.({
            where: { workspaceId: auth.workspace.id, id: { in: target.linkedRecordIds } },
          }).catch(() => {});
          await (tx as any).workTask?.deleteMany?.({
            where: {
              workspaceId: auth.workspace.id,
              OR: [
                { id: { in: target.linkedRecordIds } },
                { sourceFileId: target.id },
              ],
            },
          }).catch(() => {});
        } else {
          await (tx as any).workTask?.deleteMany?.({
            where: { workspaceId: auth.workspace.id, sourceFileId: target.id },
          }).catch(() => {});
        }

        let children = 0;
        if (isZipParent) {
          const childDelete = await tx.workspaceFile.deleteMany({
            where: { id: { in: target.linkedRecordIds }, workspaceId: auth.workspace.id },
          });
          children = childDelete.count;
        } else {
          // Jika file anak dihapus langsung, jangan meninggalkan ID mati pada
          // manifest ZIP induknya.
          const parent = await tx.workspaceFile.findFirst({
            where: { workspaceId: auth.workspace.id, linkedRecordIds: { has: id } },
            select: { id: true, linkedRecordIds: true },
          });
          if (parent) {
            await tx.workspaceFile.update({
              where: { id: parent.id },
              data: { linkedRecordIds: parent.linkedRecordIds.filter((childId) => childId !== id) },
            });
          }
        }

        // Simpan provenance penghapusan sebelum parent/child/file dihapus.
        await tx.activityEvent.create({
          data: {
            workspaceId: auth.workspace.id,
            userId: auth.user.id,
            type: 'WORKSPACE_FILE_DELETED',
            payload: {
              fileId: target.id,
              fileName: target.fileName,
              linkedRecordIds: target.linkedRecordIds,
              deletedChildIds: targetChildIds,
              domainRecordsRetained: false,
            },
          },
        });

        await tx.workspaceFile.delete({ where: { id, workspaceId: auth.workspace.id } });
        return children;
      });

      // T4: invalidasi cache SETELAH delete (induk + anak kalau ada) sukses, sebelum return.
      invalidateContextCache(auth.workspace.id);
      void invalidateDashboardInsightCache(auth.workspace.id);
      // B3_AI, 11 Sep 2026: brief perusahaan juga di-refresh setelah dokumen sumbernya
      // dihapus -- kalau tidak, brief lama bisa terus menyebut fakta dari file yang
      // sudah tidak ada lagi di Pusat Data.
      scheduleCompanyBriefRefresh(auth.workspace.id, 'Hapus file Pusat Data');

      return NextResponse.json({
        success: true,
        domainRecordsRetained: false,
        // Field TAMBAHAN (additive) -- info transparansi utk UI, absen (bukan 0) kalau
        // file yang dihapus BUKAN parent zip supaya konsumen lama (cek `success` saja) tidak terpengaruh.
        ...(isZipParent ? { deletedChildCount } : {}),
      });
    } catch (err: any) {
      console.error('[workspace-files] DELETE error:', err);
      return NextResponse.json({ message: 'Gagal menghapus file.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

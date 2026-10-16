import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TransactionType } from '@prisma/client';
import {
  buildCashTransactionDraftsFromLedger,
  tryParseWorkspaceFileAsLedger,
  tryDetectGenericLedgerForWorkspaceFile,
} from '@/lib/workspace-file-ledger';
import type { GenericColumnMapping } from '@/lib/ai-brain/generic-table-ledger';
// B1 BACKEND, 8 Sep 2026 (T4 -- dashboard & AI langsung ikut): endpoint ini SAAT INI
// (verified grep 8 Sep) 0 panggilan invalidateContextCache walau menulis CashTransaction
// baru -- dashboard bisa baca snapshot BASI sampai TTL cache habis. Fungsi ini Map
// in-memory murni (context-engine.ts TIDAK diedit sama sekali, cuma diimpor+dipanggil).
import { invalidateContextCache } from '@/lib/ai-brain/context-engine';
// KOMANDO 11 Sep 2026: impor ke Buku Kas -> cache insight dashboard dibuang (Council pagar #2).
import { invalidateDashboardInsightCache } from '@/lib/ai-brain/dashboard-insight';
// V2A 11 Sep (SEDANG): linkedRecordIds sekarang bisa berisi id Product/EmployeePayroll/WorkTask
// (auto-ingest) -- 409 "sudah diimpor ke Buku Kas" HANYA kalau log ingest bilang kind ledger
// (atau tidak ada log = impor manual lama).
import { loadIngestLogs } from '@/lib/ai-brain/auto-ingest';

// FASE BUILD 7 Sep 2026 -- fix integrasi-02 (KRITIS) + integrasi-04 (SEDANG).
//
// integrasi-02: sebelum endpoint ini, NOL jalur di seluruh codebase menulis dari upload
// dokumen ke prisma.cashTransaction (dibuktikan lewat grep 'cashTransaction.create' --
// hanya 6 file, semuanya dipicu aksi user/AI langsung di modul kas itu sendiri, bukan
// dari dokumen yang diupload). Ini akar langsung kenapa dashboard tetap "Belum ada data
// kas" walau user sudah upload laporan keuangan lewat Pusat Data (keluhan Mecca #6).
// Endpoint ini "Impor ke Buku Kas": GET = preview (parse saja, TIDAK menulis apapun),
// POST = eksekusi nyata (tulis baris CashTransaction, atomik lewat prisma.$transaction).
//
// integrasi-04: WorkspaceFile.linkedRecordIds SUDAH ADA di schema sejak awal (dengan
// komentar eksplisit "dipakai Hub Upload buat nunjukin file ini menghasilkan apa") tapi
// TIDAK PERNAH ditulis di manapun sebelum fix ini. POST di sini mengisinya dengan id
// CashTransaction hasil impor -- TIDAK butuh migration baru.
//
// KETERBATASAN JUJUR (integrasi-03, lihat laporan agent untuk detail lengkap):
// parseLedgerWorkbook (src/lib/ai-brain/ledger-parser.ts) cuma mengenali SATU template
// spesifik (sheet "kode posting" + sheet ber-nama "kas" berkolom TARIKH/URAIAN/KODE/
// DEBET/KREDIT/SALDO), diuji ke fixture 1 calon klien pertama. Dijalankan LANGSUNG
// terhadap 4 fixture nyata PT Makan Mania Mantap (laporan-penjualan-bulanan.xlsx,
// laporan-keuangan-laba-rugi.xlsx, dll -- format POS/rekap/P&L umum) -> SEMUA
// chartOfAccounts.size=0, TIDAK dikenali. Endpoint ini akan balas 422 jujur untuk file
// semacam itu ("tidak dikenali sebagai buku kas"), BUKAN diam-diam gagal/mengarang.
// Memperluas cakupan format adalah scope pengembangan terpisah yang butuh keputusan
// manusia (heuristik kolom generik baru, bukan reuse parser existing) -- TIDAK
// dikerjakan di sini.
//
// UPDATE (build B4, 7 Sep 2026 malam) -- integrasi-03 sekarang punya JALUR KEDUA:
// kalau file BUKAN ledger klasik, GET mencoba tryDetectGenericLedgerForWorkspaceFile()
// (heuristik kolom tanggal/jumlah/keterangan/jenis/kategori, lihat generic-table-
// ledger.ts) dan menyertakan hasilnya sebagai field TAMBAHAN `genericMapping` di
// response (ADDITIVE -- field `recognized`/`message` existing TIDAK berubah bentuk).
// POST untuk jalur generik WAJIB baca body {confirm:true, mappingHash} (BEDA dari
// jalur klasik yang deterministik program, tidak butuh persetujuan manusia) --
// mappingHash dihitung ULANG server-side dari isi file SAAT INI (bukan percaya
// kiriman client) supaya pratinjau basi/dipalsukan tidak bisa dipakai untuk menulis
// data finansial. Jalur klasik di atas TIDAK diubah perilakunya sama sekali.

/** Ambang minimum confidence supaya genericMapping ditampilkan sebagai kandidat sama
 *  sekali -- di bawah ini dianggap terlalu tidak berarti untuk ditawarkan ke user
 *  (lihat generic-table-ledger.ts untuk rincian komponen confidence). */
const GENERIC_MIN_CONFIDENCE = 0.3;

class ImportClaimConflict extends Error {
  constructor() {
    super('IMPORT_CLAIM_CONFLICT');
    this.name = 'ImportClaimConflict';
  }
}

/**
 * Hash deterministik {fileId, mapping, sizeBytes} -- dipakai untuk memvalidasi bahwa
 * body POST {mappingHash} genuinely berasal dari pratinjau (GET) TERBARU file ini,
 * bukan hash lama/dipalsukan. Server SELALU menghitung ulang mapping dari isi file
 * SAAT INI (bukan percaya mapping kiriman client) sebelum membandingkan hash --
 * fungsi ini murni alat bandingnya, BUKAN sumber kebenaran mapping itu sendiri.
 */
function computeGenericMappingHash(fileId: string, mapping: GenericColumnMapping, sizeBytes: number): string {
  const canonical = JSON.stringify({ fileId, sizeBytes, mapping });
  return createHash('sha256').update(canonical).digest('hex');
}

async function loadWorkspaceFileRecord(id: string, workspaceId: string) {
  return prisma.workspaceFile.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      storageBlob: true,
      linkedRecordIds: true,
      status: true,
    },
  });
}

/**
 * GET: preview "apa yang AKAN terjadi kalau diimpor" -- dipakai frontend untuk modal
 * konfirmasi (jumlah baris, total masuk/keluar, diskrepansi) SEBELUM user menekan
 * konfirmasi. TIDAK menulis apapun ke database.
 */
export const GET = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    const record = await loadWorkspaceFileRecord(id, auth.workspace.id);
    if (!record) {
      return NextResponse.json({ message: 'File tidak ditemukan di workspace ini.' }, { status: 404 });
    }
    if (record.fileName.toLowerCase().endsWith('.zip')) {
      // 8 Sep: record induk arsip -- linkedRecordIds berisi id file anak, bukan transaksi.
      return NextResponse.json({ message: 'File ini adalah arsip .zip (induk). Impor Buku Kas dilakukan dari file anak hasil ekstraksi, bukan dari arsipnya.' }, { status: 422 });
    }

    const buffer = Buffer.from(record.storageBlob as unknown as Uint8Array);
    const ledgerResult = tryParseWorkspaceFileAsLedger(record.fileName, buffer);
    if (!ledgerResult) {
      // Jalur klasik tidak kenal -- coba jalur KEDUA (heuristik kolom generik) sebagai
      // fallback SEBELUM menyerah total. Additive: kalau generic juga tidak kenal,
      // pesan yang dibalas TETAP mengandung frasa lama supaya konsumen lama tidak pecah.
      const generic = tryDetectGenericLedgerForWorkspaceFile(record.fileName, buffer);
      if (generic && generic.recognized && generic.mapping && generic.confidence >= GENERIC_MIN_CONFIDENCE) {
        const mappingHash = computeGenericMappingHash(record.id, generic.mapping, buffer.length);
        const genericTotalIncome = generic.drafts.filter((d) => d.type === 'INCOME').reduce((sum, d) => sum + d.amount, 0);
        const genericTotalExpense = generic.drafts.filter((d) => d.type === 'EXPENSE').reduce((sum, d) => sum + d.amount, 0);
        return NextResponse.json({
          recognized: false,
          message: `File "${record.fileName}" tidak dikenali sebagai buku kas klasik (chart-of-accounts + sheet "kas"), tapi TERDETEKSI kemungkinan tabel transaksi lewat deteksi kolom otomatis (confidence ${Math.round(generic.confidence * 100)}%) -- lihat "genericMapping" untuk detail sebelum memutuskan impor. Verifikasi manual tetap wajib.`,
          genericMapping: {
            mapping: generic.mapping,
            confidence: generic.confidence,
            sample: generic.sample,
            warnings: generic.warnings,
            mappingHash,
            importableTransactionCount: generic.drafts.length,
            totalIncome: genericTotalIncome,
            totalExpense: genericTotalExpense,
          },
        });
      }
      return NextResponse.json({
        recognized: false,
        message: `File "${record.fileName}" tidak dikenali sebagai buku kas (dicari: chart-of-accounts + sheet "kas" berkolom TARIKH/URAIAN/KODE/DEBET/KREDIT/SALDO) ATAUPUN sebagai tabel transaksi generik (dicari: kolom tanggal + kolom jumlah/debet-kredit). ${generic?.rejectReason ?? 'Format laporan penjualan/rekap/laba-rugi umum belum didukung untuk impor otomatis ke Buku Kas.'}`,
      });
    }

    const primarySheet = ledgerResult.discrepancies.computed.primarySheet;
    const drafts = buildCashTransactionDraftsFromLedger(ledgerResult.parsed, primarySheet);

    return NextResponse.json({
      recognized: true,
      alreadyImported: record.linkedRecordIds.length > 0,
      previouslyImportedCount: record.linkedRecordIds.length,
      structuredLedger: ledgerResult.structuredLedger,
      discrepancies: ledgerResult.discrepancies,
      importableTransactionCount: drafts.length,
      totalIncome: drafts.filter((d) => d.type === 'INCOME').reduce((sum, d) => sum + d.amount, 0),
      totalExpense: drafts.filter((d) => d.type === 'EXPENSE').reduce((sum, d) => sum + d.amount, 0),
    });
  },
  { minRole: 'VIEWER' }
);

/**
 * POST: eksekusi nyata. Menolak (409) kalau file ini sudah pernah diimpor sebelumnya
 * (linkedRecordIds tidak kosong) supaya tidak dobel-hitung tanpa sengaja -- user yang
 * genuinely mau impor ulang harus hapus transaksi lama dulu (bisa lewat DELETE
 * /api/v1/kas/transactions?id=... yang sudah ada, per id dari linkedRecordIds).
 *
 * DUA JALUR (build B4, 7 Sep 2026): (a) ledger KLASIK -- deterministik program, TIDAK
 * butuh body sama sekali (perilaku SAMA PERSIS seperti sebelum fix ini, nol perubahan).
 * (b) ledger GENERIK -- hasil HEURISTIK (bukan deterministik penuh), jadi WAJIB baca
 * body {confirm:true, mappingHash} sebagai persetujuan eksplisit manusia SEBELUM
 * menulis data finansial apapun. mappingHash dihitung ULANG dari isi file SAAT INI
 * (server tidak pernah percaya mapping/drafts kiriman client) -- mismatch (file
 * berubah sejak preview, atau hash lama/dipalsukan) ditolak 409, pola sama dengan
 * 409 anti-dobel-impor yang sudah ada di bawah.
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    const record = await loadWorkspaceFileRecord(id, auth.workspace.id);
    if (!record) {
      return NextResponse.json({ message: 'File tidak ditemukan di workspace ini.' }, { status: 404 });
    }
    if (record.fileName.toLowerCase().endsWith('.zip')) {
      // 8 Sep: record induk arsip -- linkedRecordIds berisi id file anak, bukan transaksi.
      return NextResponse.json({ message: 'File ini adalah arsip .zip (induk). Impor Buku Kas dilakukan dari file anak hasil ekstraksi, bukan dari arsipnya.' }, { status: 422 });
    }

    if (record.linkedRecordIds.length > 0) {
      const ingestLog = (await loadIngestLogs(auth.workspace.id)).get(record.id);
      const isLedgerLinkage = !ingestLog || ingestLog.kind === 'ledger-klasik' || ingestLog.kind === 'ledger-generik';
      if (isLedgerLinkage) {
        return NextResponse.json(
          {
            message: `File ini sudah pernah diimpor sebelumnya (${record.linkedRecordIds.length} transaksi tercatat di Buku Kas). Hapus transaksi lama dulu kalau ingin impor ulang, supaya tidak dobel-hitung.`,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: `File ini sudah diimpor otomatis sebagai ${ingestLog.kind} (${record.linkedRecordIds.length} record), bukan sebagai Buku Kas. Batalkan impor otomatis dulu di Pusat Data kalau ingin memprosesnya sebagai transaksi.` },
        { status: 409 }
      );
    }

    const buffer = Buffer.from(record.storageBlob as unknown as Uint8Array);
    const ledgerResult = tryParseWorkspaceFileAsLedger(record.fileName, buffer);

    // `drafts` diisi dari SALAH SATU jalur (klasik ATAU generik) -- sisa fungsi
    // (penulisan atomik ke prisma.cashTransaction + linkedRecordIds) SAMA PERSIS
    // untuk keduanya, reuse penuh (tidak ada cabang if/else per-sumber di bawah ini).
    let drafts: ReturnType<typeof buildCashTransactionDraftsFromLedger>;
    let responseDiscrepancies: unknown;

    if (ledgerResult) {
      // --- Jalur KLASIK: TIDAK DIUBAH sama sekali dari perilaku sebelum fix ini. ---
      const primarySheet = ledgerResult.discrepancies.computed.primarySheet;
      drafts = buildCashTransactionDraftsFromLedger(ledgerResult.parsed, primarySheet);
      if (drafts.length === 0) {
        return NextResponse.json(
          {
            message: `File "${record.fileName}" dikenali sebagai buku kas, tapi tidak ada baris transaksi bernilai (>0) yang bisa diimpor.`,
          },
          { status: 422 }
        );
      }
      responseDiscrepancies = ledgerResult.discrepancies;
    } else {
      // --- Jalur GENERIK: BARU (B4, 7 Sep 2026) -- WAJIB confirm+mappingHash. ---
      const generic = tryDetectGenericLedgerForWorkspaceFile(record.fileName, buffer);
      if (!generic || !generic.recognized || !generic.mapping || generic.confidence < GENERIC_MIN_CONFIDENCE) {
        return NextResponse.json(
          {
            message: `File "${record.fileName}" tidak dikenali sebagai buku kas klasik maupun tabel transaksi generik -- lihat pratinjau (GET) untuk detail kenapa. ${generic?.rejectReason ?? ''}`.trim(),
          },
          { status: 422 }
        );
      }

      let body: { confirm?: unknown; mappingHash?: unknown } = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      if (body.confirm !== true || typeof body.mappingHash !== 'string' || !body.mappingHash) {
        return NextResponse.json(
          {
            message:
              'Impor tabel generik butuh konfirmasi eksplisit -- kirim {confirm:true, mappingHash} dari hasil pratinjau (GET) TERBARU sebelum menulis data finansial apapun.',
          },
          { status: 400 }
        );
      }

      // Server HITUNG ULANG mapping+hash dari isi file SAAT INI -- TIDAK PERNAH
      // percaya mapping/drafts kiriman client (anti-manipulasi + anti-preview-basi).
      const recomputedHash = computeGenericMappingHash(record.id, generic.mapping, buffer.length);
      if (recomputedHash !== body.mappingHash) {
        return NextResponse.json(
          {
            message: 'Pratinjau kedaluwarsa atau mapping tidak valid -- muat ulang pratinjau (GET) sebelum konfirmasi impor lagi.',
          },
          { status: 409 }
        );
      }

      drafts = generic.drafts;
      if (drafts.length === 0) {
        return NextResponse.json(
          {
            message: `File "${record.fileName}" terdeteksi sebagai tabel transaksi generik, tapi tidak ada baris transaksi bernilai (>0) yang bisa diimpor.`,
          },
          { status: 422 }
        );
      }
    }

    // Atomik: prisma.$transaction bentuk-array menjalankan SEMUA create dalam satu
    // transaksi DB -- kalau ada satu yang gagal, SEMUANYA di-rollback (tidak ada
    // "separuh baris masuk, separuh tidak"). CATATAN OPERASIONAL (jujur, bukan
    // diverifikasi lewat load-test): bentuk-array `$transaction([...])` di versi
    // Prisma Client ini (6.3.1) TIDAK menerima opsi `timeout` (type-checked --
    // opsi itu cuma ada untuk bentuk callback interaktif `$transaction(async tx =>
    // ...)`), jadi tidak ada default 5-detik Prisma yang berlaku di sini. Fixture
    // nyata yang jadi motivasi ledger-parser.ts (PT Tujuh Mata Air) punya 583
    // transaksi -- ratusan create sekuensial tetap punya risiko durasi terhadap
    // default nginx `proxy_read_timeout` 60 detik di VPS (lihat brief) untuk
    // ledger yang SANGAT besar. Belum di-load-test dengan volume sebesar itu di
    // sesi ini -- kalau nanti terbukti jadi masalah nyata, rekomendasi konkret:
    // ganti ke bentuk callback interaktif dengan `{ timeout: 30000 }`, ATAU naikkan
    // `proxy_read_timeout`/`proxy_send_timeout` di nginx (rekomendasiInfraUntukKomando).
    // ANTI-DOBEL ATOMIK (7 Sep malam, temuan refuter: race TOCTOU) -- claim dan
    // seluruh domain writes sekarang berada di SATU interactive transaction.
    // updateMany hanya mengubah file yang linkedRecordIds-nya masih kosong;
    // request konkuren menunggu row lock lalu mendapat count 0. Jika process
    // mati atau salah satu create gagal, claim ikut rollback—tidak ada marker
    // yatim yang membuat file stuck permanen.
    const CLAIM_MARKER = `__mengimpor__${auth.user.id}`;

    let created: Array<{ id: string }>;
    try {
      created = await prisma.$transaction(async (tx) => {
        const claim = await tx.workspaceFile.updateMany({
          where: { id: record.id, workspaceId: auth.workspace.id, linkedRecordIds: { isEmpty: true } },
          data: { linkedRecordIds: [CLAIM_MARKER] },
        });
        if (claim.count === 0) throw new ImportClaimConflict();

        const CHUNK_SIZE = 2000;
        const allCreatedIds: string[] = [];

        for (let i = 0; i < drafts.length; i += CHUNK_SIZE) {
          const chunk = drafts.slice(i, i + CHUNK_SIZE);
          const chunkRows = await (tx.cashTransaction as any).createManyAndReturn({
            data: chunk.map((d) => ({
              workspaceId: auth.workspace.id,
              userId: auth.user.id,
              sourceFileId: record.id,
              type: d.type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE,
              category: d.category,
              amount: d.amount,
              description: `${d.description} (impor dari "${record.fileName}")`,
              paymentMethod: 'TRANSFER_BANK',
              transactionDate: d.transactionDate,
            })),
            select: { id: true },
          });
          for (const row of chunkRows) {
            allCreatedIds.push(row.id);
          }
        }

        // File linkage ikut berada dalam transaction yang sama dengan domain
        // writes. Tidak ada lagi keadaan "transaksi sudah masuk tetapi file
        // masih terlihat belum diimpor" setelah request sukses.
        await tx.workspaceFile.update({
          where: { id: record.id },
          data: { linkedRecordIds: allCreatedIds },
        });
        return allCreatedIds.map((id) => ({ id }));
      }, { timeout: 60000, maxWait: 15000 });
    } catch (txErr) {
      if (txErr instanceof ImportClaimConflict) {
        return NextResponse.json(
          { message: 'File ini sedang/sudah diimpor oleh permintaan lain. Muat ulang daftar file untuk melihat statusnya.' },
          { status: 409 }
        );
      }
      throw txErr;
    }

    const createdIds = created.map((c) => c.id);

    // TEST-HOOK: T4 -- invalidasi cache SETELAH tulis CashTransaction+linkedRecordIds
    // sukses, SEBELUM return sukses (endpoint ini sebelumnya 0 panggilan, lihat impor di atas).
    invalidateContextCache(auth.workspace.id);
    void invalidateDashboardInsightCache(auth.workspace.id);

    return NextResponse.json({
      success: true,
      message: `${createdIds.length} transaksi berhasil diimpor ke Buku Kas dari "${record.fileName}".`,
      importedCount: createdIds.length,
      linkedRecordIds: createdIds,
      discrepancies: responseDiscrepancies,
    });
  },
  { minRole: 'MEMBER' }
);

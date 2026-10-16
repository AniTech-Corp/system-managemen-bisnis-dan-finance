// tests/auto-ingest.test.ts -- 11 Sep 2026 (komando, ADENDUM fase 2 seksi C).
// Menguji bagian DETERMINISTIK auto-ingest terhadap 5 fixture dummy PT Makan Mania Mantap
// (file yang sama persis dengan yang diupload Mecca ke Pusat Data). Bagian Prisma/LLM
// (runAutoIngest/undoIngest) tidak diuji di sini -- never-throw dan diverifikasi lewat
// smoke; detektor kolom adalah inti keputusan "boleh masuk tabel apa".
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  detectProductTable,
  detectPayrollTable,
  detectMarketingCampaignTable,
  detectMarketingCampaignFromText,
  detectMenuCatalog,
  extractMonthYear,
  looksLikeMeetingNotes,
  parseIngestLog,
  INGEST_LOG_TAG,
  AUTO_LEDGER_MIN_CONFIDENCE,
} from '../src/lib/ai-brain/auto-ingest';
import { CampaignPlatform, CampaignStatus } from '@prisma/client';
import { tryDetectGenericLedgerForWorkspaceFile } from '../src/lib/workspace-file-ledger';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'pt-makan-mania-mantap');
const read = (name: string) => fs.readFileSync(path.join(FIXTURE_DIR, name));

describe('auto-ingest: detectProductTable', () => {
  test('data-inventori-stok.xlsx -> dikenali, 90 baris per cabang digabung per kode bahan', () => {
    const det = detectProductTable(read('data-inventori-stok.xlsx'), 'data-inventori-stok.xlsx');
    assert.equal(det.recognized, true);
    assert.equal(det.sheetName, 'Detail per Cabang');
    assert.ok(det.rows.length > 0 && det.rows.length < 90, `baris per cabang harus digabung per kode (dapat ${det.rows.length})`);
    const beras = det.rows.find((r) => r.sku === 'BB-01');
    assert.ok(beras, 'kode BB-01 (Beras Premium) harus ada');
    assert.equal(beras!.name, 'Beras Premium');
    assert.equal(beras!.unit, 'kg');
    assert.ok(beras!.currentStock > 47, 'stok BB-01 harus hasil jumlah lintas cabang (> 47 dari cabang pertama)');
    assert.equal(beras!.costPrice, 13500);
    assert.ok(det.warnings.some((w) => /digabung/.test(w)));
  });

  test('data-karyawan-payroll.xlsx -> BUKAN tabel produk (tidak ada kolom stok)', () => {
    const det = detectProductTable(read('data-karyawan-payroll.xlsx'), 'data-karyawan-payroll.xlsx');
    assert.equal(det.recognized, false);
  });

  test('laporan-penjualan-bulanan.xlsx -> BUKAN tabel produk (ada kolom tanggal = transaksi)', () => {
    const det = detectProductTable(read('laporan-penjualan-bulanan.xlsx'), 'laporan-penjualan-bulanan.xlsx');
    assert.equal(det.recognized, false);
  });

  test('csv -> ditolak (bukan xlsx/xls)', () => {
    const det = detectProductTable(read('daftar-transaksi-mentah.csv'), 'daftar-transaksi-mentah.csv');
    assert.equal(det.recognized, false);
  });
});

describe('auto-ingest: detectPayrollTable', () => {
  test('data-karyawan-payroll.xlsx -> dikenali, periode Agustus 2026 dari judul sheet', () => {
    const det = detectPayrollTable(read('data-karyawan-payroll.xlsx'), 'data-karyawan-payroll.xlsx', new Date(2026, 8, 11));
    assert.equal(det.recognized, true);
    assert.equal(det.sheetName, 'Payroll');
    assert.equal(det.monthYear, 'Agustus 2026');
    assert.ok(det.rows.length >= 40, `payroll fixture ~45 karyawan (dapat ${det.rows.length})`);
    const budi = det.rows.find((r) => r.employeeName === 'Budi Santoso');
    assert.ok(budi);
    assert.equal(budi!.role, 'Direktur Utama');
    assert.equal(budi!.basicSalary, 25000000);
    assert.equal(budi!.allowance, 5000000);
    assert.equal(budi!.netSalary, 30000000);
    assert.equal(det.warnings.some((w) => /bulan upload/.test(w)), false, 'periode tertulis di file, tidak boleh pakai fallback bulan upload');
  });

  test('data-inventori-stok.xlsx -> BUKAN payroll', () => {
    const det = detectPayrollTable(read('data-inventori-stok.xlsx'), 'data-inventori-stok.xlsx');
    assert.equal(det.recognized, false);
  });

  test('extractMonthYear: teks Indonesia + ISO', () => {
    assert.equal(extractMonthYear('periode Agustus 2026 (fiktif)'), 'Agustus 2026');
    assert.equal(extractMonthYear('payroll-2026-07.xlsx'), 'Juli 2026');
    assert.equal(extractMonthYear('tanpa periode'), null);
  });
});

describe('auto-ingest: ambang ledger generik untuk impor otomatis', () => {
  test('daftar-transaksi-mentah.csv confidence >= 0.70 -> boleh auto; laporan-penjualan-bulanan.xlsx < 0.70 -> butuh konfirmasi', () => {
    const csv = tryDetectGenericLedgerForWorkspaceFile('daftar-transaksi-mentah.csv', read('daftar-transaksi-mentah.csv'));
    assert.ok(csv && csv.recognized);
    assert.ok(csv!.confidence >= AUTO_LEDGER_MIN_CONFIDENCE, `csv confidence ${csv!.confidence}`);
    const rekap = tryDetectGenericLedgerForWorkspaceFile('laporan-penjualan-bulanan.xlsx', read('laporan-penjualan-bulanan.xlsx'));
    assert.ok(rekap && rekap.recognized);
    assert.ok(rekap!.confidence < AUTO_LEDGER_MIN_CONFIDENCE, `rekap harian confidence ${rekap!.confidence} harus di bawah ambang (risiko dobel-hitung)`);
  });
});

describe('auto-ingest: notulen + log', () => {
  test('looksLikeMeetingNotes: nama file atau isi', () => {
    assert.equal(looksLikeMeetingNotes('notulen-rapat-bulanan.docx', ''), true);
    assert.equal(looksLikeMeetingNotes('catatan.docx', 'Peserta rapat: A, B. Tindak lanjut: ...'), true);
    assert.equal(looksLikeMeetingNotes('proposal-kerjasama-supplier.docx', 'Proposal kerja sama pasokan bahan baku'), false);
  });

  test('parseIngestLog: bolak-balik JSON, tag salah -> null', () => {
    const entry = { fileId: 'f1', kind: 'produk' as const, ids: ['a', 'b'], createdAt: '2026-09-11T00:00:00.000Z' };
    const parsed = parseIngestLog(`${INGEST_LOG_TAG} ${JSON.stringify(entry)}`);
    assert.deepEqual(parsed, entry);
    assert.equal(parseIngestLog('[COMPANY_PROFILE] Nama: X'), null);
    assert.equal(parseIngestLog(`${INGEST_LOG_TAG} bukan-json`), null);
  });
});

// V2A 11 Sep (TINGGI): rincian penjualan per-item TANPA kolom tanggal tidak boleh dianggap
// snapshot stok -- kolom Qty = jumlah terjual, dan ada penanda transaksi (No Invoice).
describe('auto-ingest: detectProductTable menolak rincian penjualan (V2A)', () => {
  test('sheet [No Invoice, Nama Produk, Qty, Catatan] -> recognized false', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Rincian Penjualan'],
      [],
      ['No Invoice', 'Nama Produk', 'Qty', 'Catatan'],
      ['INV-001', 'Rendang Rice Bowl', 12, ''],
      ['INV-002', 'Es Teh', 30, ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rincian Penjualan');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const det = detectProductTable(buf, 'rincian-penjualan.xlsx');
    assert.equal(det.recognized, false);
  });

  test('sheet [Nama Produk, Stok, Harga Beli] tanpa penanda transaksi -> recognized true', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nama Produk', 'Stok', 'Harga Beli', 'Satuan'],
      ['Beras', 50, 13000, 'kg'],
      ['Gula', 20, 15000, 'kg'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stok');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const det = detectProductTable(buf, 'stok.xlsx');
    assert.equal(det.recognized, true);
    assert.equal(det.rows.length, 2);
    assert.equal(det.rows[0].currentStock, 50);
  });
});

describe('auto-ingest: detectMarketingCampaignTable', () => {
  test('laporan-kampanye-marketing-agustus.xlsx -> dikenali, 9 platform terpetakan, ROAS & budget normal', () => {
    const det = detectMarketingCampaignTable(read('laporan-kampanye-marketing-agustus.xlsx'), 'laporan-kampanye-marketing-agustus.xlsx');
    assert.equal(det.recognized, true);
    assert.ok(det.rows.length >= 8, `minimal 8 kampanye terdeteksi (dapat ${det.rows.length})`);
    
    // Pastikan platform populer terpetakan dengan benar
    const meta = det.rows.find((r) => r.platform === CampaignPlatform.META_ADS);
    assert.ok(meta, 'Platform META_ADS (Facebook/Instagram Ads) harus terdeteksi');
    assert.ok(meta!.dailyBudget > 0, 'Daily budget META harus terisi');
    assert.ok(meta!.roas !== null && meta!.roas > 0, 'ROAS META harus valid');
    assert.equal(meta!.status, CampaignStatus.ACTIVE);

    const tiktok = det.rows.find((r) => r.platform === CampaignPlatform.TIKTOK_ADS);
    assert.ok(tiktok, 'Platform TIKTOK_ADS harus terdeteksi');
    assert.ok(tiktok!.roas !== null && tiktok!.roas > 0, 'ROAS TikTok harus valid');

    const google = det.rows.find((r) => r.platform === CampaignPlatform.GOOGLE_ADS);
    assert.ok(google, 'Platform GOOGLE_ADS harus terdeteksi');

    // Periode bulan terdeteksi
    assert.ok(det.monthYear === 'Agustus 2026' || /agustus/i.test(det.monthYear || ''));
  });

  test('data-inventori-stok.xlsx -> BUKAN tabel marketing (tanpa kolom platform/roas)', () => {
    const det = detectMarketingCampaignTable(read('data-inventori-stok.xlsx'), 'data-inventori-stok.xlsx');
    assert.equal(det.recognized, false);
  });

  test('daftar-transaksi-mentah.csv -> BUKAN tabel marketing', () => {
    const det = detectMarketingCampaignTable(read('daftar-transaksi-mentah.csv'), 'daftar-transaksi-mentah.csv');
    assert.equal(det.recognized, false);
  });
});

describe('auto-ingest: detectMenuCatalog', () => {
  test('daftar-menu-dan-harga.txt -> dikenali, 25 item menu F&B, stok on-demand 999, unit porsi', () => {
    const det = detectMenuCatalog(read('daftar-menu-dan-harga.txt'), 'daftar-menu-dan-harga.txt');
    assert.equal(det.recognized, true);
    assert.equal(det.rows.length, 25, `Katalog menu F&B harus tepat 25 item (dapat ${det.rows.length})`);

    // Periksa salah satu makanan utama
    const nasiGoreng = det.rows.find((r) => /nasi goreng/i.test(r.name));
    assert.ok(nasiGoreng, 'Nasi Goreng harus ada di daftar menu');
    assert.equal(nasiGoreng!.unit, 'porsi');
    assert.equal(nasiGoreng!.currentStock, 999, 'Stok default menu F&B harus 999 (on-demand MTO)');
    assert.ok(nasiGoreng!.sellPrice > 0, 'Harga jual menu harus > 0');
    assert.ok(nasiGoreng!.category, 'Kategori menu harus terisi');

    // Periksa salah satu minuman
    const esTeh = det.rows.find((r) => /es teh/i.test(r.name));
    assert.ok(esTeh, 'Es Teh Manis harus ada di daftar menu');
    assert.equal(esTeh!.unit, 'porsi');
    assert.equal(esTeh!.currentStock, 999);
    assert.ok(esTeh!.sellPrice > 0);
  });

  test('file teks non-menu (catatan memo singkat tanpa harga) -> BUKAN katalog menu', () => {
    const memoBuffer = Buffer.from('Memo Internal: Rapat koordinasi besok jam 10 pagi di ruang meeting.');
    const det = detectMenuCatalog(memoBuffer, 'memo-internal.txt');
    assert.equal(det.recognized, false);
  });
});

describe('auto-ingest: detectMarketingCampaignFromText', () => {
  test('brief-kampanye-media-sosial-september.docx teks -> terdeteksi 4 kanal iklan dengan budget', () => {
    const sampleText = `
      BRIEF STRATEGI KAMPANYE MEDIA SOSIAL
      September 2026 — PT Makan Mania Mantap
      
      4. RENCANA ALOKASI BUDGET SEPTEMBER 2026 (usulan)
      Instagram Ads: Rp 32.775.000
      TikTok Ads: Rp 25.200.000
      Meta Ads (Facebook): Rp 12.000.000
      GoFood/GrabFood Ads Boost: Rp 8.000.000
    `;
    const det = detectMarketingCampaignFromText('brief-kampanye-media-sosial-september.docx', sampleText);
    assert.equal(det.recognized, true);
    assert.equal(det.rows.length, 4);
    assert.equal(det.monthYear, 'September 2026');
    
    const ig = det.rows.find((r) => r.name.includes('Instagram'));
    assert.ok(ig, 'Instagram Ads harus terdeteksi');
    assert.equal(ig!.platform, CampaignPlatform.META_ADS);
    assert.ok(ig!.dailyBudget > 0);

    const tiktok = det.rows.find((r) => r.name.includes('TikTok'));
    assert.ok(tiktok, 'TikTok Ads harus terdeteksi');
    assert.equal(tiktok!.platform, CampaignPlatform.TIKTOK_ADS);
  });

  test('dokumen non-marketing -> recognized false', () => {
    const det = detectMarketingCampaignFromText('laporan-inventori.txt', 'Daftar stok bahan baku gudang pusat');
    assert.equal(det.recognized, false);
  });
});


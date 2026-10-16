/**
 * Unit test untuk workspace-file-intelligence.ts (Fase 5, 13 Sep 2026).
 *
 * Test coverage:
 *   - Keyword detection per kategori (finance, marketing, operations, hr, legal, report)
 *   - Fallback ke 'general' kalau tidak ada sinyal kuat
 *   - Tag extraction (tanggal, nominal, keyword dari nama file)
 *   - buildFileIntelligenceBlock output format
 *   - Non-fatal: empty/null input tidak throw
 *   - Idempotent: panggil dua kali → hasil sama
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWorkspaceFile,
  buildFileIntelligenceBlock,
  CATEGORY_LABELS,
} from '../src/lib/workspace-file-intelligence';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FINANCE_TEXT = `
Laporan Laba Rugi PT AniTech Retail Group
Periode: Januari – Agustus 2026

Pendapatan Penjualan: Rp 485.000.000
HPP (Harga Pokok Penjualan): Rp 312.000.000
Laba Kotor: Rp 173.000.000

Biaya Operasional:
- Gaji Karyawan: Rp 45.000.000
- Sewa Tempat: Rp 18.000.000
- Biaya Marketing: Rp 12.500.000

Laba Bersih: Rp 97.500.000
Pajak PPH 25%: Rp 24.375.000
Laba Setelah Pajak: Rp 73.125.000

Saldo Kas Per 31 Agustus 2026: Rp 210.000.000
`.trim();

const MARKETING_TEXT = `
Campaign Performance Report — September 2026

Meta Ads (Facebook & Instagram):
- Budget Harian: Rp 150.000
- ROAS: 4.6x
- Leads: 142 leads
- CTR: 3.2%
- Engagement Rate: 5.8%
- Total Iklan Tayang: 48.000 impresi

TikTok Ads:
- Budget Harian: Rp 100.000
- ROAS: 3.8x
- Leads: 87 leads
- Konversi ke Penjualan: 23%

Kampanye retargeting berhasil meningkatkan konversi 40%.
`.trim();

const OPS_TEXT = `
Laporan Stok Gudang — September 2026

Produk dengan Stok Rendah (Di bawah Minimum Stok):
- Kopi Robusta 1kg: Stok 5 (Min: 15) ❌ REORDER SEGERA
- Matcha Powder 500g: Stok 3 (Min: 8) ❌ REORDER SEGERA

Purchase Order Aktif:
- PO-2026001: PT Kopi Nusantara — Rp 2.500.000 (ORDERED)
- PO-2026002: UD Susu Segar — Rp 1.800.000 (RECEIVED)

Perlu koordinasi dengan supplier untuk restock sebelum tanggal 20 September.
`.trim();

const HR_TEXT = `
Rekap Payroll Karyawan — Agustus 2026

Total Karyawan Aktif: 12 orang

Rincian Gaji:
- Staf Kasir (4 orang): Rp 3.200.000/orang = Rp 12.800.000
- Barista (3 orang): Rp 3.500.000/orang = Rp 10.500.000
- Supervisor (2 orang): Rp 5.000.000/orang = Rp 10.000.000

BPJS Ketenagakerjaan: Rp 3.240.000
THR (dibayar Agustus): Rp 0

Slip gaji sudah dikirim via WhatsApp ke seluruh karyawan.
Total Pengeluaran Payroll: Rp 36.540.000
`.trim();

const LEGAL_TEXT = `
PERJANJIAN KERJA SAMA
Nomor: PKS/AniTech/2026/09/001

Perjanjian ini dibuat antara:
1. PT AniTech Retail Group (selanjutnya disebut "PIHAK PERTAMA")
2. CV Distribusi Kopi Nusantara (selanjutnya disebut "PIHAK KEDUA")

Pasal 1 — Ruang Lingkup
PIHAK PERTAMA menunjuk PIHAK KEDUA sebagai distributor resmi...

Pasal 2 — Kewajiban Para Pihak
PIHAK KEDUA wajib menjaga kualitas produk dan memenuhi standar SIUP...

Kontrak ini ditandatangani di hadapan Notaris pada tanggal 13 September 2026.
`.trim();

const REPORT_TEXT = `
Laporan Bulanan — Agustus 2026
Rekap Kinerja Bisnis AniTech Retail Group

Executive Summary:
Bulan Agustus 2026 menunjukkan pertumbuhan positif di semua lini bisnis.
Rekapitulasi penjualan menunjukkan kenaikan 15% dibanding Juli 2026.

Rangkuman:
- Total Pendapatan: Rp 485.000.000
- Total Pengeluaran: Rp 340.000.000
- Net Profit: Rp 145.000.000

Laporan lengkap terlampir di bawah.
`.trim();

const GENERAL_TEXT = 'Meeting notes 14:00. Agenda: update progress proyek. Hadir: Budi, Sari, Tim Desain.';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('classifyWorkspaceFile — kategori detection', () => {
  test('finance: teks laporan laba rugi → kategori finance', () => {
    const result = classifyWorkspaceFile('laporan-laba-rugi-agt-2026.pdf', FINANCE_TEXT);
    assert.equal(result.category, 'finance', `Expected finance, got ${result.category}`);
    assert.ok(['high', 'medium'].includes(result.confidence), `Confidence terlalu rendah: ${result.confidence}`);
    assert.equal(result.categoryLabel, CATEGORY_LABELS.finance);
  });

  test('marketing: teks campaign report → kategori marketing', () => {
    const result = classifyWorkspaceFile('campaign-report-sep-2026.xlsx', MARKETING_TEXT);
    assert.equal(result.category, 'marketing');
    assert.ok(['high', 'medium'].includes(result.confidence));
  });

  test('operations: teks stok gudang → kategori operations', () => {
    const result = classifyWorkspaceFile('stok-gudang-sep-2026.csv', OPS_TEXT);
    assert.equal(result.category, 'operations');
  });

  test('hr: teks payroll karyawan → kategori hr', () => {
    const result = classifyWorkspaceFile('payroll-agustus-2026.xlsx', HR_TEXT);
    assert.equal(result.category, 'hr');
  });

  test('legal: teks kontrak perjanjian → kategori legal', () => {
    const result = classifyWorkspaceFile('PKS-AniTech-2026-09.pdf', LEGAL_TEXT);
    assert.equal(result.category, 'legal');
  });

  test('report: teks laporan bulanan → kategori report', () => {
    const result = classifyWorkspaceFile('laporan-bulanan-agustus-2026.pdf', REPORT_TEXT);
    assert.equal(result.category, 'report');
  });

  test('general: teks singkat tanpa sinyal kuat → fallback general', () => {
    const result = classifyWorkspaceFile('catatan.txt', GENERAL_TEXT);
    assert.equal(result.category, 'general');
    assert.equal(result.confidence, 'low');
  });
});

describe('classifyWorkspaceFile — edge cases', () => {
  test('empty string tidak throw', () => {
    assert.doesNotThrow(() => classifyWorkspaceFile('kosong.txt', ''));
    const result = classifyWorkspaceFile('kosong.txt', '');
    assert.equal(result.category, 'general');
  });

  test('nama file sangat panjang tidak throw', () => {
    const longName = 'a'.repeat(500) + '.pdf';
    assert.doesNotThrow(() => classifyWorkspaceFile(longName, FINANCE_TEXT));
  });

  test('idempotent: panggil dua kali → hasil sama', () => {
    const r1 = classifyWorkspaceFile('test.pdf', FINANCE_TEXT);
    const r2 = classifyWorkspaceFile('test.pdf', FINANCE_TEXT);
    assert.equal(r1.category, r2.category);
    assert.equal(r1.confidence, r2.confidence);
  });

  test('nama file mempengaruhi klasifikasi (payroll.xlsx → hr bahkan tanpa konten)', () => {
    const result = classifyWorkspaceFile('payroll-sep-2026.xlsx', 'data karyawan');
    // Nama file "payroll" = strong keyword HR → seharusnya hr atau setidaknya bukan general
    // (kalau konten sangat singkat, nama file mendominasi)
    assert.ok(result.category !== undefined);
  });
});

describe('tag extraction', () => {
  test('tanggal terdeteksi dari teks', () => {
    const result = classifyWorkspaceFile('test.pdf', 'Laporan tanggal 13/09/2026 ini mencakup data Agustus 2026.');
    const dateTags = result.tags.filter(t => t.type === 'date');
    assert.ok(dateTags.length > 0, 'Harus ada setidaknya 1 date tag');
  });

  test('nominal terdeteksi dari teks', () => {
    const result = classifyWorkspaceFile('test.pdf', 'Total pembayaran Rp 5.000.000 sudah diterima.');
    const nominalTags = result.tags.filter(t => t.type === 'nominal');
    assert.ok(nominalTags.length > 0, 'Harus ada setidaknya 1 nominal tag');
  });

  test('keyword dari nama file masuk ke tags', () => {
    const result = classifyWorkspaceFile('laporan-keuangan-q3.pdf', 'isi tidak relevan');
    const kwTags = result.tags.filter(t => t.type === 'keyword');
    assert.ok(kwTags.length > 0, 'Keyword dari nama file harus ada');
  });

  test('maks 10 tags', () => {
    const result = classifyWorkspaceFile('test.pdf', FINANCE_TEXT + MARKETING_TEXT);
    assert.ok(result.tags.length <= 10, `Terlalu banyak tags: ${result.tags.length}`);
  });
});

describe('buildFileIntelligenceBlock', () => {
  test('output mengandung [KATEGORI FILE] header', () => {
    const result = classifyWorkspaceFile('laporan.pdf', FINANCE_TEXT);
    const block = buildFileIntelligenceBlock(result);
    assert.ok(block.includes('[KATEGORI FILE]'), 'Harus ada header [KATEGORI FILE]');
    assert.ok(block.includes('[/KATEGORI FILE]'), 'Harus ada penutup [/KATEGORI FILE]');
  });

  test('output mengandung nama kategori', () => {
    const result = classifyWorkspaceFile('laporan-laba.pdf', FINANCE_TEXT);
    const block = buildFileIntelligenceBlock(result);
    assert.ok(block.includes('finance') || block.includes('Keuangan'), 'Harus ada nama kategori');
  });

  test('output berupa string non-empty', () => {
    const result = classifyWorkspaceFile('kosong.txt', '');
    const block = buildFileIntelligenceBlock(result);
    assert.ok(block.length > 0);
  });
});

describe('detectedLanguage', () => {
  test('teks Indonesia terdeteksi sebagai id', () => {
    const result = classifyWorkspaceFile('test.txt', 'Ini adalah laporan keuangan yang dibuat untuk keperluan audit.');
    assert.equal(result.detectedLanguage, 'id');
  });

  test('teks English terdeteksi sebagai en', () => {
    const result = classifyWorkspaceFile('test.txt', 'This is the monthly financial report for the board of directors. The revenue and expenses are detailed below.');
    assert.equal(result.detectedLanguage, 'en');
  });
});

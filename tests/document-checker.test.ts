import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkDocumentText } from '../src/lib/ai-brain/document-checker';

// Unit test murni (tanpa Prisma/JWT mock, mengikuti pola tests/ledger-parser.test.ts
// yang menguji fungsi pure langsung) untuk checkDocumentText() -- generalisasi
// document-check di luar ledger (roadmap 2026-09-06 Bagian 3.4). Teks sintetis
// (CV, kontrak, tabel karyawan sebagai teks) dibangun inline, bukan file asli.

describe('checkDocumentText', () => {
  test('CV sintetis: ekstrak NIK, email, HP, tanggal, nama dengan benar', () => {
    const text = `
CURRICULUM VITAE
Nama: Budi Santoso
NIK: 3201012345678901
Email: budi.santoso@example.com
No. HP: 081234567890
Tanggal Lahir: 12 Januari 1995
`;
    const report = checkDocumentText(text, { fileName: 'cv-budi.txt' });

    const nik = report.entities.find((e) => e.type === 'nik');
    assert.ok(nik, 'NIK harus terdeteksi');
    assert.equal(nik!.raw, '3201012345678901');

    const email = report.entities.find((e) => e.type === 'email');
    assert.ok(email, 'email harus terdeteksi');
    assert.equal(email!.normalized, 'budi.santoso@example.com');

    const hp = report.entities.find((e) => e.type === 'hp');
    assert.ok(hp, 'nomor HP harus terdeteksi');

    const nama = report.entities.find((e) => e.type === 'nama' && e.raw === 'Budi Santoso');
    assert.ok(nama, 'nama "Budi Santoso" harus terdeteksi sebagai entitas nama');
  });

  test('NIK bukan 16 digit -> anomaly nik-invalid-length', () => {
    const text = 'Data pegawai. NIK: 12345 (data belum lengkap).';
    const report = checkDocumentText(text, { fileName: 'data-pegawai.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'nik-invalid-length');
    assert.ok(anomaly, 'NIK yang bukan 16 digit harus ditandai nik-invalid-length');
    assert.equal(anomaly!.severity, 'critical');
  });

  test('kontrak sintetis: tanggal akhir sebelum tanggal mulai -> date-range-invalid', () => {
    const text = `
SURAT PERJANJIAN KERJA
Tanggal mulai: 01/03/2025
Tanggal berakhir: 01/01/2025
`;
    const report = checkDocumentText(text, { fileName: 'kontrak.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'date-range-invalid');
    assert.ok(anomaly, 'tanggal akhir sebelum tanggal mulai harus terdeteksi');
    assert.equal(anomaly!.severity, 'critical');
  });

  test('kontrak dengan interval tanggal valid -> TIDAK ada date-range-invalid', () => {
    const text = `
SURAT PERJANJIAN KERJA
Tanggal mulai: 01/01/2025
Tanggal berakhir: 01/03/2025
`;
    const report = checkDocumentText(text, { fileName: 'kontrak-valid.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'date-range-invalid');
    assert.equal(anomaly, undefined, 'interval tanggal valid tidak boleh ditandai anomali');
  });

  test('tanggal mustahil (31 Februari) -> impossible-date', () => {
    const text = 'Tanggal transaksi: 31/02/2024. Data lain menyusul.';
    const report = checkDocumentText(text, { fileName: 'transaksi.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'impossible-date');
    assert.ok(anomaly, '31 Februari harus ditandai impossible-date');
  });

  test('dua nama beda 1 karakter (typo) -> typo-candidate', () => {
    const text = `
Daftar hadir rapat.
Peserta: Siti Aminah hadir tepat waktu.
Peserta: Siti Aminah bertanya soal budget (lihat catatan berikut).
Peserta kedua: Siti Amina absen di sesi kedua.
`;
    const report = checkDocumentText(text, { fileName: 'absensi.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'typo-candidate');
    assert.ok(anomaly, '"Siti Aminah" vs "Siti Amina" (beda 1 karakter) harus ditandai typo-candidate');
    assert.equal(anomaly!.severity, 'info');
  });

  test('nama identik tidak ditandai typo-candidate (distance 0)', () => {
    const text = 'Budi Santoso datang. Budi Santoso pulang lebih awal dari yang lain.';
    const report = checkDocumentText(text, { fileName: 'catatan.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'typo-candidate');
    assert.equal(anomaly, undefined, 'nama yang identik persis tidak boleh dianggap typo');
  });

  test('nominal ditulis 2x beda pada baris yang sama -> nominal-mismatch', () => {
    const text = 'Total pembayaran: Rp 1.000.000 (satu koma lima juta / Rp1.500.000)';
    const report = checkDocumentText(text, { fileName: 'invoice.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'nominal-mismatch');
    assert.ok(anomaly, 'dua nominal berbeda pada baris yang sama harus ditandai nominal-mismatch');
  });

  test('baris duplikat persis -> duplicate-row', () => {
    const text = [
      'Baris data pertama yang cukup panjang untuk lolos ambang minimum.',
      'Baris data kedua berbeda dari yang lain di dokumen ini.',
      'Baris data pertama yang cukup panjang untuk lolos ambang minimum.',
    ].join('\n');
    const report = checkDocumentText(text, { fileName: 'catatan-rapat.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'duplicate-row');
    assert.ok(anomaly, 'baris identik yang berulang harus ditandai duplicate-row');
  });

  test('dokumen bersih (tanpa anomali) -> anomalies kosong, summary jujur', () => {
    const text = 'Ini dokumen deskripsi singkat perusahaan tanpa data sensitif apapun.';
    const report = checkDocumentText(text, { fileName: 'deskripsi.txt' });
    assert.equal(report.anomalies.length, 0);
    assert.match(report.summary, /Tidak ada anomali terdeteksi/);
  });

  test('NOL panggilan LLM -- checkDocumentText adalah fungsi sinkron murni', () => {
    // Kalau fungsi ini pernah memanggil LLM/network, ia harus async (Promise).
    // Assert sinkron membuktikan tidak ada jalur await ke luar di dalamnya.
    const result = checkDocumentText('teks apa saja', { fileName: 'x.txt' });
    assert.equal(result instanceof Promise, false, 'checkDocumentText harus sinkron (nol LLM/network call)');
  });

  // ---------------------------------------------------------------------------
  // PENGERASAN pola messiness #3 (riset database HR enterprise babak 2, 2026-09-06):
  // "konsep sama, representasi beda" -- NIK 16-digit kadang ditulis tersegmentasi
  // (dash/titik antar kelompok) alih-alih rapat. SEBELUM perbaikan, regex label NIK
  // berhenti di pemisah pertama dan cuma menangkap kelompok pertama -- NIK yang
  // SEBENARNYA VALID (16 digit setelah pemisah dibuang) salah ditandai invalid-length.
  // ---------------------------------------------------------------------------
  test('NIK ditulis tersegmentasi (dash antar kelompok 4 digit) yang SEBENARNYA 16 digit -> TIDAK ditandai invalid-length', () => {
    const text = 'Data pegawai. NIK: 3201-0123-4567-8901 (dokumen lengkap).';
    const report = checkDocumentText(text, { fileName: 'data-pegawai-segmented.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'nik-invalid-length');
    assert.equal(anomaly, undefined, 'NIK 16 digit yang cuma dipisah dash TIDAK boleh dianggap salah panjang');
  });

  test('NIK tersegmentasi yang MEMANG bukan 16 digit -> tetap ditandai invalid-length (bukan lolos begitu saja)', () => {
    const text = 'Data pegawai. NIK: 320-123 (belum lengkap).';
    const report = checkDocumentText(text, { fileName: 'data-pegawai-segmented-invalid.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'nik-invalid-length');
    assert.ok(anomaly, 'NIK tersegmentasi yang totalnya bukan 16 digit tetap harus ditandai');
    assert.equal((anomaly!.evidence as { length: number }).length, 6);
  });

  test('regresi: NIK berdempetan (contiguous, tanpa pemisah) tetap terdeteksi persis seperti sebelumnya', () => {
    const text = 'NIK: 12345 (data belum lengkap).';
    const report = checkDocumentText(text, { fileName: 'data-pegawai.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'nik-invalid-length');
    assert.ok(anomaly);
    assert.equal((anomaly!.evidence as { length: number }).length, 5);
  });

  // ---------------------------------------------------------------------------
  // PENGERASAN pola messiness #6 (riset database HR enterprise babak 2, 2026-09-06):
  // "pergeseran penamaan label antar berkas untuk konsep yang sama" -- label field
  // tanggal mulai/akhir kontrak tidak selalu diawali kata "tanggal"/"tgl". SEBELUM
  // perbaikan, "Mulai Kerja:"/"Berakhir Kerja:" (tanpa "tanggal"/"tgl") LOLOS TOTAL
  // dari deteksi interval tanggal terbalik.
  // ---------------------------------------------------------------------------
  test('label sinonim "Mulai Kerja"/"Berakhir Kerja" (tanpa kata "tanggal") -> interval terbalik tetap terdeteksi', () => {
    const text = `
SURAT PERJANJIAN KERJA
Mulai Kerja: 01/03/2025
Berakhir Kerja: 01/01/2025
`;
    const report = checkDocumentText(text, { fileName: 'kontrak-sinonim.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'date-range-invalid');
    assert.ok(anomaly, 'label sinonim tanpa "tanggal"/"tgl" tetap harus terdeteksi sebagai field tanggal mulai/akhir');
  });

  test('label sinonim dengan interval VALID -> TIDAK ada false-positive date-range-invalid', () => {
    const text = `
SURAT PERJANJIAN KERJA
Mulai Kontrak: 01/01/2025
Selesai Kontrak: 01/03/2025
`;
    const report = checkDocumentText(text, { fileName: 'kontrak-sinonim-valid.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'date-range-invalid');
    assert.equal(anomaly, undefined);
  });

  test('regresi: kata "mulai"/"berakhir" dalam prosa BEBAS (bukan label field) TIDAK memicu deteksi palsu', () => {
    const text = 'Kegiatan akan mulai tahun depan dan diharapkan berakhir sebelum musim hujan.';
    const report = checkDocumentText(text, { fileName: 'prosa-bebas.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'date-range-invalid');
    assert.equal(anomaly, undefined, 'kata "mulai"/"berakhir" tanpa kualifier field (tanggal/tgl/kerja/kontrak) bukan label tanggal');
  });

  test('regresi: label lama "Tanggal mulai"/"Tanggal berakhir" masih berfungsi persis seperti sebelumnya', () => {
    const text = `
SURAT PERJANJIAN KERJA
Tanggal mulai: 01/03/2025
Tanggal berakhir: 01/01/2025
`;
    const report = checkDocumentText(text, { fileName: 'kontrak-lama.txt' });
    const anomaly = report.anomalies.find((a) => a.kind === 'date-range-invalid');
    assert.ok(anomaly, 'label lama "Tanggal mulai/berakhir" tidak boleh regresi');
  });
});

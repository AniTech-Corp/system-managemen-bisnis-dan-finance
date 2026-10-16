import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as XLSX from 'xlsx';
import { parseLedgerWorkbook } from '../src/lib/ai-brain/ledger-parser';

// Pengerasan ledger-parser.ts terhadap 6 pola "messiness" data enterprise nyata, dari
// riset 2026-09-06-riset-enterprise-hr-ops-trakindo-babak2-database-video-pola-data.md
// (bagian "Pola messiness database" + "Sintesis untuk parser/validator KLIR"). Setiap
// describe di bawah = satu pola. Workbook SINTETIS di memori, TIDAK menyentuh data asli
// klien manapun. Setiap test dirancang supaya GAGAL kalau pengerasan terkait dilepas
// (dijelaskan per test lewat komentar "sebelum perbaikan").

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

function buildWorkbook(sheets: Array<[string, unknown[][]]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ---------------------------------------------------------------------------
// Pola #1 -- sentinel kosong ganda (spasi tunggal ' ' dan literal 'NULL' dipakai
// campur sebagai penanda "kosong" di kolom yang sama)
// ---------------------------------------------------------------------------
describe('pola #1: sentinel kosong ganda (spasi vs literal NULL) di kolom TARIKH', () => {
  function bukuKasRows(tarikhFooterValue: unknown): unknown[][] {
    return [
      ['BUKU KAS / BESAR'],
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Penjualan', 25, 500000, null, 500000],
      // baris footer/subtotal -- kolom TARIKH pakai SENTINEL, bukan benar-benar kosong
      // secara JS null/undefined/'' (ini yang dulu bikin baris ini SALAH dianggap
      // "percobaan tanggal yang gagal diparse").
      [null, tarikhFooterValue, null, null, 500000, null, null],
    ];
  }

  test('TARIKH footer = spasi tunggal (\' \') -> TIDAK dianggap percobaan transaksi gagal', () => {
    const buf = buildWorkbook([['buku kas', bukuKasRows(' ')]]);
    const parsed = parseLedgerWorkbook(buf);
    const invalid = parsed.invalidRows['buku kas'] ?? [];
    assert.equal(invalid.length, 0, 'baris dengan TARIKH=" " (sentinel kosong) tidak boleh masuk invalidRows');
    assert.equal(parsed.transactionsBySheet['buku kas'].length, 2, 'cuma 2 transaksi asli, footer tidak ikut kehitung sebagai apapun');
    assert.ok(
      !parsed.warnings.some((w) => w.includes('tidak bisa diparse sebagai tanggal valid')),
      'tidak boleh ada warning "impossible-date" palsu untuk sentinel spasi',
    );
  });

  test('TARIKH footer = literal teks "NULL" -> TIDAK dianggap percobaan transaksi gagal', () => {
    const buf = buildWorkbook([['buku kas', bukuKasRows('NULL')]]);
    const parsed = parseLedgerWorkbook(buf);
    const invalid = parsed.invalidRows['buku kas'] ?? [];
    assert.equal(invalid.length, 0, 'baris dengan TARIKH="NULL" (sentinel kosong bergaya database) tidak boleh masuk invalidRows');
    assert.ok(
      !parsed.warnings.some((w) => w.includes('tidak bisa diparse sebagai tanggal valid')),
      'tidak boleh ada warning "impossible-date" palsu untuk sentinel "NULL"',
    );
  });

  test('regresi: TARIKH berisi tanggal MUSTAHIL sungguhan ("31/02/2024") TETAP dilaporkan (bukan diam-diam disamakan dengan sentinel kosong)', () => {
    const buf = buildWorkbook([['buku kas', bukuKasRows('31/02/2024')]]);
    const parsed = parseLedgerWorkbook(buf);
    const invalid = parsed.invalidRows['buku kas'] ?? [];
    assert.equal(invalid.length, 1, 'tanggal mustahil sungguhan TETAP harus masuk invalidRows, bukan ikut lolos sebagai "sentinel kosong"');
    assert.equal(invalid[0].dateRaw, '31/02/2024');
    assert.ok(parsed.warnings.some((w) => w.includes('tidak bisa diparse sebagai tanggal valid')));
  });
});

// ---------------------------------------------------------------------------
// Pola #3 -- konsep sama, tipe data beda antar baris (kolom KODE kadang angka,
// kadang teks -- baris/aset dengan KODE bertipe teks TIDAK BOLEH senyap hilang)
// ---------------------------------------------------------------------------
describe('pola #3: kolom KODE bertipe teks (bukan angka) di sebagian baris/sheet', () => {
  test('ledger: transaksi dengan KODE sebagai TEKS ("61") tetap ikut agregasi, bukan senyap ter-null-kan', () => {
    const rows: unknown[][] = [
      ['BUKU KAS / BESAR'],
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Bayar Konsumsi (kode angka)', 61, null, 50000, -50000],
      [2, d(2024, 1, 2), 'Bayar Konsumsi (kode TEKS)', '61', null, 50000, -100000],
    ];
    const buf = buildWorkbook([['buku kas', rows]]);
    const parsed = parseLedgerWorkbook(buf);
    const txs = parsed.transactionsBySheet['buku kas'];
    assert.equal(txs.length, 2);
    // Sebelum perbaikan: `typeof kodeRaw === 'number' ? kodeRaw : null` membuat baris
    // ke-2 (KODE string "61") punya kode:null -- ikut lolos jadi transaksi TAPI hilang
    // dari agregasi per-kode ledger-validator.ts (bisa menyembunyikan discrepancy asli).
    assert.equal(txs[0].kode, 61);
    assert.equal(txs[1].kode, 61, 'KODE bertipe teks harus dikonversi ke angka yang SAMA, bukan null');
    assert.ok(
      parsed.warnings.some((w) => w.includes('kolom KODE berisi kode dalam bentuk TEKS')),
      'harus ada warning transparansi soal tipe data KODE yang tidak seragam',
    );
  });

  test('depresiasi: aset dengan KODE sebagai TEKS tidak boleh dibuang total dari items[]', () => {
    const rows: unknown[][] = [
      ['JADWAL DEPRESIASI'],
      ['KODE', 'NAMA BARANG', 'BIAYA', 'TEMPO (BULAN)', 'NILAI PER BULAN'],
      [null, null, null, null, null, "Jan`14", "Feb`14"],
      [1, 'Mesin Jahit', 6000000, 24, 250000, 250000, 250000],
      // Aset ke-2: KODE ditulis sebagai TEKS "2" (mis. kolom Excel berformat Text) --
      // SEBELUM perbaikan, `typeof kodeVal !== 'number' -> continue` membuang baris
      // ini TOTAL dari items[], padahal ini aset valid, cuma tipe kolomnya beda.
      ['2', 'Kompresor', 4000000, 20, 200000, 200000, 200000],
      [null, 'JUMLAH', 10000000, null, null, 450000, 450000],
    ];
    const buf = buildWorkbook([['depresiasi', rows]]);
    const parsed = parseLedgerWorkbook(buf);
    const schedule = parsed.depreciationSchedules['depresiasi'];
    assert.ok(schedule);
    assert.equal(schedule.items.length, 2, 'aset dengan KODE bertipe teks TIDAK boleh hilang dari items[]');
    const kompresor = schedule.items.find((i) => i.nama === 'Kompresor');
    assert.ok(kompresor, 'aset "Kompresor" (KODE teks "2") harus tetap tercatat');
    assert.equal(kompresor!.kode, 2);
    assert.ok(parsed.warnings.some((w) => w.includes('kolom KODE berisi kode dalam bentuk TEKS')));
  });
});

// ---------------------------------------------------------------------------
// Pola #4 -- wadah bernama jelas ternyata kosong (header lengkap, nol baris data);
// harus dibedakan secara eksplisit dari "tidak cocok pola manapun"
// ---------------------------------------------------------------------------
describe('pola #4: wadah/sheet bernama jelas tapi nol baris data (header ada, isi kosong)', () => {
  test('sheet ledger ("kas") dengan header lengkap tapi NOL transaksi -> warning spesifik, bukan cuma senyap', () => {
    const rows: unknown[][] = [
      ['BUKU KAS BULAN INI'],
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      // Sengaja TIDAK ada baris transaksi sama sekali di bawah header.
    ];
    const buf = buildWorkbook([['buku kas kosong', rows]]);
    const parsed = parseLedgerWorkbook(buf);
    assert.deepEqual(parsed.transactionsBySheet['buku kas kosong'], []);
    assert.ok(
      parsed.warnings.some((w) => w.includes('buku kas kosong') && w.includes('NOL baris transaksi valid')),
      `harus ada warning eksplisit soal sheet ledger kosong: ${JSON.stringify(parsed.warnings)}`,
    );
  });

  test('sheet statement (URAIAN+JUMLAH) dengan header lengkap tapi NOL baris -> tetap diklasifikasi sebagai statement (kosong), BUKAN "tidak cocok pola manapun"', () => {
    const rows: unknown[][] = [
      ['LABA RUGI'],
      [null, 'URAIAN', null, 'KODE', 'JUMLAH (Rp.)'],
      // Nol baris data setelah header.
    ];
    const buf = buildWorkbook([['laba-rugi kosong', rows]]);
    const parsed = parseLedgerWorkbook(buf);
    assert.ok(
      Object.prototype.hasOwnProperty.call(parsed.statementSheets, 'laba-rugi kosong'),
      'sheet statement kosong tetap harus tercatat sebagai statementSheets (array kosong), bukan hilang sama sekali',
    );
    assert.deepEqual(parsed.statementSheets['laba-rugi kosong'], []);
    assert.ok(
      parsed.warnings.some((w) => w.includes('laba-rugi kosong') && w.includes('NOL baris data')),
      `harus ada warning spesifik "header ditemukan tapi kosong": ${JSON.stringify(parsed.warnings)}`,
    );
    // Cek frasa PERSIS milik warning fallback generik (bukan sekadar substring
    // "tidak cocok pola manapun" -- pesan spesifik di atas SENGAJA menyebut frasa itu
    // untuk menegaskan negasinya, jadi butuh penanda yang cuma dipakai warning generik).
    assert.ok(
      !parsed.warnings.some((w) => w.includes('laba-rugi kosong') && w.includes('cash flow/statement) -- dilewati.')),
      'TIDAK boleh jatuh ke warning fallback generik -- itu menyembunyikan sinyal wadah-dekoi',
    );
  });

  test('regresi: sheet yang genuinely tidak cocok pola manapun tetap dapat warning generik seperti sebelumnya', () => {
    const rows: unknown[][] = [['Cuma teks bebas, bukan tabel apapun'], ['Baris kedua juga bukan tabel']];
    const buf = buildWorkbook([['catatan bebas', rows]]);
    const parsed = parseLedgerWorkbook(buf);
    assert.ok(parsed.warnings.some((w) => w.includes('catatan bebas') && w.includes('tidak cocok pola manapun')));
  });
});

// ---------------------------------------------------------------------------
// Pola #5 -- sheet kembar/duplikat (pola khas salinan Excel default "Sheet1 (2)")
// ---------------------------------------------------------------------------
describe('pola #5: sheet kembar/duplikat (pola penamaan salinan "(N)" + isi identik)', () => {
  function chronologicalKasRows(): unknown[][] {
    return [
      ['BUKU KAS / BESAR'],
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Penjualan', 25, 500000, null, 500000],
      [3, d(2024, 1, 3), 'Bayar Sewa', 60, null, 100000, 400000],
    ];
  }

  test('sheet "buku kas" dan "buku kas (2)" berisi transaksi PERSIS SAMA -> ditandai duplikat (nama DAN isi)', () => {
    const buf = buildWorkbook([
      ['buku kas', chronologicalKasRows()],
      ['buku kas (2)', chronologicalKasRows()],
    ]);
    const parsed = parseLedgerWorkbook(buf);
    assert.ok(
      parsed.warnings.some((w) => w.includes('pola penamaan salinan default') && w.includes('buku kas (2)')),
      'sinyal NAMA (pola "(N)") harus terdeteksi',
    );
    assert.ok(
      parsed.warnings.some((w) => w.includes('berisi transaksi yang PERSIS SAMA')),
      'sinyal ISI (fingerprint transaksi identik) harus terdeteksi',
    );
  });

  test('regresi: dua sheet "kas" dengan isi BERBEDA (bukan duplikat) TIDAK ditandai sebagai isi identik', () => {
    const rowsB: unknown[][] = [
      ['BUKU KAS PIVOT'],
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 2, 1), 'Transaksi bulan lain', 25, 999000, null, 999000],
    ];
    const buf = buildWorkbook([
      ['buku kas', chronologicalKasRows()],
      ['buku kas rekap', rowsB],
    ]);
    const parsed = parseLedgerWorkbook(buf);
    assert.ok(
      !parsed.warnings.some((w) => w.includes('berisi transaksi yang PERSIS SAMA')),
      'dua sheet kas dengan isi genuinely berbeda tidak boleh dituduh duplikat isi',
    );
    // Nama "buku kas rekap" tidak match pola "(N)" jadi juga tidak boleh kena sinyal nama.
    assert.ok(!parsed.warnings.some((w) => w.includes('pola penamaan salinan default')));
  });
});

// ---------------------------------------------------------------------------
// Pola #6 -- pergeseran penamaan kolom antar berkas untuk konsep yang sama
// (header ledger pakai "TANGGAL"/"KETERANGAN"/"DEBIT" alih-alih "TARIKH"/"URAIAN"/"DEBET")
// ---------------------------------------------------------------------------
describe('pola #6: sinonim header kolom ("TANGGAL" utk TARIKH, "KETERANGAN" utk URAIAN, dst)', () => {
  test('sheet ledger dengan header sinonim penuh ("TANGGAL"/"KETERANGAN"/"DEBIT") tetap terklasifikasi & terparse benar', () => {
    const rows: unknown[][] = [
      ['BUKU KAS / BESAR'],
      ['NO.', 'TANGGAL', 'KETERANGAN', 'KODE', 'DEBIT', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Penjualan Barang Umum', 25, 500000, null, 500000],
    ];
    const buf = buildWorkbook([['buku kas', rows]]);
    const parsed = parseLedgerWorkbook(buf);
    const txs = parsed.transactionsBySheet['buku kas'];
    assert.equal(txs.length, 2, 'header sinonim TIDAK boleh membuat sheet gagal dikenali sebagai ledger sama sekali');
    assert.equal(txs[1].description, 'Penjualan Barang Umum');
    assert.equal(txs[1].debit, 500000);
    assert.ok(
      parsed.warnings.some((w) => w.includes('label kolom non-standar') && w.includes('TANGGAL')),
      'harus ada warning transparansi soal label kolom non-standar yang dikenali sebagai sinonim',
    );
  });

  test('sheet statement dengan header sinonim ("KETERANGAN" utk URAIAN) tetap terklasifikasi sebagai statement', () => {
    const rows: unknown[][] = [
      ['LABA RUGI'],
      [null, 'KETERANGAN', null, 'KODE', 'JUMLAH (Rp.)'],
      [null, '-', 'Penjualan Barang Umum', 25, 700000],
    ];
    const buf = buildWorkbook([['laba-rugi', rows]]);
    const parsed = parseLedgerWorkbook(buf);
    assert.ok(parsed.statementSheets['laba-rugi']);
    assert.equal(parsed.statementSheets['laba-rugi'].length, 1);
    assert.equal(parsed.statementSheets['laba-rugi'][0].kode, 25);
    assert.ok(parsed.warnings.some((w) => w.includes('header statement memakai label kolom non-standar')));
  });

  test('regresi: header ASLI ("TARIKH"/"URAIAN"/"DEBET") TIDAK memicu warning sinonim (tidak ada noise baru)', () => {
    const rows: unknown[][] = [
      ['BUKU KAS / BESAR'],
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Penjualan', 25, 500000, null, 500000],
    ];
    const buf = buildWorkbook([['buku kas', rows]]);
    const parsed = parseLedgerWorkbook(buf);
    assert.equal(parsed.transactionsBySheet['buku kas'].length, 2);
    assert.ok(!parsed.warnings.some((w) => w.includes('label kolom non-standar')), 'header asli tidak boleh dianggap sinonim');
  });
});

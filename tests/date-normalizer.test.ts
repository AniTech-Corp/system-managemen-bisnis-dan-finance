import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, test } from 'node:test';
import {
  detectDateAnomalies,
  parseIndonesianDate,
  parseReportPeriod,
  type DateAnomalyInput,
} from '../src/lib/ai-brain/date-normalizer';

// Fixture ASLI milik calon klien -- path absolut, TIDAK di-commit ke
// repo (privasi). Test integrasi di bawah SKIP (bukan fail) kalau file ini tidak ada di
// mesin yang menjalankan test, sesuai instruksi tugas. Unit test lain di file ini semua
// pakai fixture SINTETIS yang ditulis langsung di dalam file ini.
const REAL_FIXTURE_PATH =
  'C:/Users/mausx/OneDrive/Nime/OneDrive/Documents/Claude Code Asistent/KLIR/05-DOKUMEN/aktif/2026-09-06-roadmap-analisis-data-enterprise-anti-halusinasi-test-fixtures/PT-Tujuh-Mata-Air_jan14-okt15.xlsx';
const realFixtureExists = fs.existsSync(REAL_FIXTURE_PATH);

describe('parseIndonesianDate', () => {
  describe('format ISO (YYYY-MM-DD)', () => {
    test('parse tanggal valid', () => {
      const r = parseIndonesianDate('2015-10-15');
      assert.equal(r.iso, '2015-10-15');
      assert.equal(r.confidence, 1);
      assert.equal(r.sourceFormat, 'iso');
      assert.deepEqual(r.warnings, []);
    });

    test('tanggal mustahil (31 Feb) -> iso null + warning', () => {
      const r = parseIndonesianDate('2014-02-31');
      assert.equal(r.iso, null);
      assert.equal(r.confidence, 0);
      assert.match(r.warnings[0], /mustahil/i);
    });
  });

  describe('objek JS Date', () => {
    test('Date valid -> iso sesuai komponen kalender lokal', () => {
      const d = new Date(2014, 0, 2); // 2 Januari 2014, lokal
      const r = parseIndonesianDate(d);
      assert.equal(r.iso, '2014-01-02');
      assert.equal(r.confidence, 1);
      assert.equal(r.sourceFormat, 'js-date');
    });

    test('Invalid Date -> iso null', () => {
      const r = parseIndonesianDate(new Date(NaN));
      assert.equal(r.iso, null);
      assert.equal(r.confidence, 0);
    });
  });

  describe('Excel serial number', () => {
    // Oracle independen: 1899-12-30 adalah epoch internal sistem tanggal Excel (fakta
    // terdokumentasi dari format file itu sendiri, bukan angka yang dihafal dari
    // implementasi modul ini) -- serial number = jumlah hari sejak epoch itu. Dihitung
    // di sini murni via aritmatika UTC, independen dari konstanta 25569 yang dipakai
    // implementasi date-normalizer.ts, supaya test benar-benar bisa menangkap bug off-by-one.
    const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
    function expectedSerialFor(y: number, m: number, d: number): number {
      return Math.round((Date.UTC(y, m - 1, d) - EXCEL_EPOCH_UTC) / 86400000);
    }

    test('serial number valid (rentang ledger 2014-2015) -> iso benar', () => {
      const serial = expectedSerialFor(2014, 1, 2);
      const r = parseIndonesianDate(serial);
      assert.equal(r.iso, '2014-01-02');
      assert.equal(r.sourceFormat, 'excel-serial');
      assert.ok(r.confidence > 0.5);
    });

    test('serial number lain (akhir periode, Okt 2015)', () => {
      const serial = expectedSerialFor(2015, 10, 31);
      const r = parseIndonesianDate(serial);
      assert.equal(r.iso, '2015-10-31');
    });

    test('serial negatif/tidak valid -> iso null', () => {
      const r = parseIndonesianDate(-5);
      assert.equal(r.iso, null);
      assert.equal(r.confidence, 0);
    });
  });

  describe('dd/mm/yyyy', () => {
    test('15/10/2015 -> 2015-10-15 (hari>12, tidak ambigu)', () => {
      const r = parseIndonesianDate('15/10/2015');
      assert.equal(r.iso, '2015-10-15');
      assert.equal(r.sourceFormat, 'dd/mm/yyyy');
      assert.deepEqual(r.warnings, []);
    });

    test('02/01/2014 -> 2014-01-02 (hari<=12, ambigu, tetap diasumsikan dd/mm + warning)', () => {
      const r = parseIndonesianDate('02/01/2014');
      assert.equal(r.iso, '2014-01-02');
      assert.match(r.warnings.join(' '), /ambigu/i);
    });

    test('31/02/2014 (tanggal mustahil) -> iso null', () => {
      const r = parseIndonesianDate('31/02/2014');
      assert.equal(r.iso, null);
      assert.match(r.warnings[0], /mustahil/i);
    });
  });

  describe('dd + nama bulan + yyyy', () => {
    test('"15 Oktober 2015" -> 2015-10-15', () => {
      const r = parseIndonesianDate('15 Oktober 2015');
      assert.equal(r.iso, '2015-10-15');
      assert.equal(r.sourceFormat, 'dd-monthname-yyyy');
      assert.equal(r.confidence, 0.95);
    });

    test('"1 Jan 2014" (singkatan) -> 2014-01-01', () => {
      const r = parseIndonesianDate('1 Jan 2014');
      assert.equal(r.iso, '2014-01-01');
    });

    test('"31 Februari 2014" (mustahil) -> iso null', () => {
      const r = parseIndonesianDate('31 Februari 2014');
      assert.equal(r.iso, null);
      assert.match(r.warnings[0], /mustahil/i);
    });

    test('nama bulan tidak dikenali -> iso null + warning spesifik', () => {
      const r = parseIndonesianDate('15 Blah 2015');
      assert.equal(r.iso, null);
      assert.match(r.warnings[0], /tidak dikenali/i);
    });
  });

  describe('bulan+tahun ringkas: backtick / apostrof / spasi / titik', () => {
    test('"Jan`14" (backtick asli dari fixture) -> 2014-01-01, tahun 2-digit', () => {
      const r = parseIndonesianDate('Jan`14');
      assert.equal(r.iso, '2014-01-01');
      assert.equal(r.sourceFormat, 'month-year-2digit');
      assert.match(r.warnings.join(' '), /tahun 2 digit/i);
      assert.match(r.warnings.join(' '), /tanggal 1/i);
    });

    test('"Jan\'14" (apostrof) -> 2014-01-01', () => {
      const r = parseIndonesianDate("Jan'14");
      assert.equal(r.iso, '2014-01-01');
    });

    test('"Jan 14" (spasi) -> 2014-01-01', () => {
      const r = parseIndonesianDate('Jan 14');
      assert.equal(r.iso, '2014-01-01');
    });

    test('"JAN.2014" (titik, tahun 4 digit) -> 2014-01-01, TANPA warning tahun-2-digit', () => {
      const r = parseIndonesianDate('JAN.2014');
      assert.equal(r.iso, '2014-01-01');
      assert.equal(r.sourceFormat, 'month-year-4digit');
      assert.equal(r.warnings.some((w) => /tahun 2 digit/i.test(w)), false);
    });

    test('"Juni`14" dan "Juli`14" (nama PENUH dalam format ringkas, verified dari fixture asli sheet depresiasi)', () => {
      assert.equal(parseIndonesianDate('Juni`14').iso, '2014-06-01');
      assert.equal(parseIndonesianDate('Juli`14').iso, '2014-07-01');
    });

    test('"Ags`15" (singkatan Agustus dipakai fixture asli) -> 2015-08-01', () => {
      assert.equal(parseIndonesianDate('Ags`15').iso, '2015-08-01');
    });

    test('"Okt`15" -> 2015-10-01', () => {
      assert.equal(parseIndonesianDate('Okt`15').iso, '2015-10-01');
    });
  });

  describe('aturan tahun 2-digit (00-69 -> 20xx, 70-99 -> 19xx)', () => {
    const cases: Array<[string, string]> = [
      ['Jan`00', '2000-01-01'],
      ['Jan`69', '2069-01-01'],
      ['Jan`70', '1970-01-01'],
      ['Jan`99', '1999-01-01'],
      ['Jan`14', '2014-01-01'],
    ];
    for (const [input, expectedIso] of cases) {
      test(`"${input}" -> ${expectedIso}`, () => {
        assert.equal(parseIndonesianDate(input).iso, expectedIso);
      });
    }
  });

  describe('cakupan penuh nama bulan Indonesia (penuh + singkatan)', () => {
    const fullNames: Array<[string, number]> = [
      ['Januari', 1], ['Februari', 2], ['Maret', 3], ['April', 4], ['Mei', 5], ['Juni', 6],
      ['Juli', 7], ['Agustus', 8], ['September', 9], ['Oktober', 10], ['November', 11], ['Desember', 12],
    ];
    for (const [name, num] of fullNames) {
      test(`"${name} 2014" -> bulan ${num}`, () => {
        const r = parseIndonesianDate(`${name} 2014`);
        assert.equal(r.iso, `2014-${String(num).padStart(2, '0')}-01`);
      });
    }

    const abbrevs: Array<[string, number]> = [
      ['Jan', 1], ['Feb', 2], ['Mar', 3], ['Apr', 4], ['Mei', 5], ['Jun', 6], ['Jul', 7],
      ['Agu', 8], ['Ags', 8], ['Sep', 9], ['Sept', 9], ['Okt', 10], ['Nov', 11], ['Des', 12],
    ];
    for (const [abbrev, num] of abbrevs) {
      test(`singkatan "${abbrev}.2014" -> bulan ${num}`, () => {
        const r = parseIndonesianDate(`${abbrev}.2014`);
        assert.equal(r.iso, `2014-${String(num).padStart(2, '0')}-01`);
      });
    }
  });

  describe('format tidak dikenali / input tidak valid', () => {
    test('string acak -> iso null, sourceFormat unknown', () => {
      const r = parseIndonesianDate('bukan tanggal sama sekali');
      assert.equal(r.iso, null);
      assert.equal(r.confidence, 0);
      assert.equal(r.sourceFormat, 'unknown');
    });

    test('string kosong -> iso null', () => {
      assert.equal(parseIndonesianDate('').iso, null);
      assert.equal(parseIndonesianDate('   ').iso, null);
    });

    test('null/undefined -> iso null, tidak melempar exception', () => {
      assert.equal(parseIndonesianDate(null).iso, null);
      assert.equal(parseIndonesianDate(undefined).iso, null);
    });

    test('tipe objek lain (bukan Date) -> iso null', () => {
      assert.equal(parseIndonesianDate({ foo: 'bar' }).iso, null);
    });
  });

  // ---------------------------------------------------------------------------
  // PENGERASAN pola messiness #2 (riset database HR enterprise babak 2, 2026-09-06):
  // "presisi tanggal tidak konsisten dalam satu berkas" -- tanggal biografis selalu
  // jam 00:00:00, tapi tanggal transaksional bawa timestamp sampai milidetik dari jam
  // sistem batch. SEBELUM perbaikan, string bertimestamp gagal total (anchor `$` di
  // RE_ISO/RE_DDMMYYYY menolak karakter sisa) walau bagian tanggalnya sendiri jelas.
  // ---------------------------------------------------------------------------
  describe('pola messiness #2: presisi tanggal campur (timestamp jam:menit:detik)', () => {
    test('ISO + jam:menit:detik.milidetik -> tanggal tetap terbaca, jam dibuang', () => {
      const r = parseIndonesianDate('2015-10-15 14:23:05.123');
      assert.equal(r.iso, '2015-10-15');
      assert.equal(r.sourceFormat, 'iso');
      assert.equal(r.confidence, 1, 'tanggal itu sendiri tidak ambigu -- confidence TIDAK boleh turun cuma karena ada jam');
      assert.match(r.warnings.join(' '), /jam/i);
    });

    test('ISO gaya "T" + Z (format timestamp sistem batch umum) -> tanggal terbaca benar', () => {
      const r = parseIndonesianDate('2015-10-15T09:00:00Z');
      assert.equal(r.iso, '2015-10-15');
    });

    test('dd/mm/yyyy + jam:menit:detik -> tanggal tetap terbaca, jam dibuang', () => {
      const r = parseIndonesianDate('31/12/2014 23:59:59');
      assert.equal(r.iso, '2014-12-31');
      assert.equal(r.sourceFormat, 'dd/mm/yyyy');
      assert.match(r.warnings.join(' '), /jam/i);
    });

    test('presisi campur DALAM SATU deret: tanggal biografis (tanpa jam) vs transaksional (dengan jam) hasil sama', () => {
      const biografis = parseIndonesianDate('2014-01-02'); // mis. tanggal lahir/join
      const transaksional = parseIndonesianDate('2014-01-02 08:15:33.500'); // mis. timestamp batch payroll
      assert.equal(biografis.iso, transaksional.iso, 'keduanya harus resolve ke tanggal kalender yang sama, terlepas dari presisi sumbernya');
      assert.equal(transaksional.iso, '2014-01-02');
    });

    test('tanggal mustahil + jam tetap ditolak jujur (jam bukan alasan untuk menebak tanggal)', () => {
      const r = parseIndonesianDate('2014-02-31 10:00:00');
      assert.equal(r.iso, null);
      assert.match(r.warnings[0], /mustahil/i);
    });

    test('regresi: input tanpa komponen jam TIDAK kena warning "jam" (tidak ada noise baru)', () => {
      assert.deepEqual(parseIndonesianDate('2015-10-15').warnings, []);
      assert.deepEqual(parseIndonesianDate('15/10/2015').warnings, []);
    });
  });
});

describe('detectDateAnomalies', () => {
  function row(r: number, iso: string | null, raw: unknown = iso, dayName?: string): DateAnomalyInput {
    return { row: r, iso, raw, dayName };
  }

  test('(a) non-monotonic: tanggal mundur dibanding baris sebelumnya', () => {
    const dates = [
      row(1, '2014-01-01'),
      row(2, '2014-01-05'),
      row(3, '2014-01-03'), // mundur dibanding baris 2
      row(4, '2014-01-10'),
    ];
    const anomalies = detectDateAnomalies(dates);
    const found = anomalies.filter((a) => a.kind === 'non-monotonic');
    assert.equal(found.length, 1);
    assert.equal(found[0].row, 3);
  });

  test('(b) day-name-mismatch: nama hari salah (persis contoh dari spesifikasi tugas: 3 Jan 2014 = Jumat, bukan Senin)', () => {
    // Verifikasi independen dulu, jangan cuma percaya klaim di spesifikasi:
    const actualDow = new Date(Date.UTC(2014, 0, 3)).getUTCDay();
    assert.equal(actualDow, 5, 'sanity check: 3 Jan 2014 harus Jumat (index 5) di kalender Gregorian proleptic UTC');

    const dates = [row(1, '2014-01-03', '3 Jan 2014 (Senin)', 'Senin')];
    const anomalies = detectDateAnomalies(dates);
    const found = anomalies.filter((a) => a.kind === 'day-name-mismatch');
    assert.equal(found.length, 1);
    assert.match(found[0].suggestion ?? '', /Jumat/);
  });

  test('(b) day-name cocok -> tidak ada anomali', () => {
    const dates = [row(1, '2014-01-03', '3 Jan 2014 (Jumat)', 'Jumat')];
    assert.equal(detectDateAnomalies(dates).filter((a) => a.kind === 'day-name-mismatch').length, 0);
  });

  test('(c) impossible-date: iso null tapi raw ada isinya', () => {
    const dates = [
      row(1, null, '31 Februari 2014'),
      row(2, null, ''), // sel kosong, BUKAN anomali
      row(3, null, undefined), // sel kosong, BUKAN anomali
    ];
    const found = detectDateAnomalies(dates).filter((a) => a.kind === 'impossible-date');
    assert.equal(found.length, 1);
    assert.equal(found[0].row, 1);
  });

  test('(d) suspicious-year-jump: 2014 -> 2104 -> 2014 (salah ketik digit tertukar)', () => {
    const dates = [
      row(1, '2014-01-01'),
      row(2, '2014-01-02'),
      row(3, '2104-01-03'), // typo transposisi digit dari 2014
      row(4, '2014-01-04'),
      row(5, '2014-01-05'),
    ];
    const anomalies = detectDateAnomalies(dates);
    const found = anomalies.filter((a) => a.kind === 'suspicious-year-jump');
    assert.equal(found.length, 1);
    assert.equal(found[0].row, 3);
    assert.match(found[0].suggestion ?? '', /2014/);
  });

  test('(d) tidak false-positive untuk transisi tahun wajar (Des 2014 -> Jan 2015)', () => {
    const dates = [
      row(1, '2014-12-29'),
      row(2, '2014-12-30'),
      row(3, '2014-12-31'),
      row(4, '2015-01-01'),
      row(5, '2015-01-02'),
    ];
    assert.equal(detectDateAnomalies(dates).filter((a) => a.kind === 'suspicious-year-jump').length, 0);
  });

  test('(e) duplicate: iso + raw identik persis pada baris berbeda', () => {
    const dates = [
      row(1, '2014-01-05', 'Setoran Modal awal|300000000'),
      row(2, '2014-01-06', 'Transaksi lain'),
      row(3, '2014-01-05', 'Setoran Modal awal|300000000'), // duplikat persis dari baris 1
    ];
    const found = detectDateAnomalies(dates).filter((a) => a.kind === 'duplicate');
    assert.equal(found.length, 1);
    assert.equal(found[0].row, 3);
    assert.match(found[0].suggestion ?? '', /baris 1/);
  });

  test('(e) tanggal sama tapi raw BEDA -> bukan duplikat', () => {
    const dates = [
      row(1, '2014-01-05', 'Transaksi A'),
      row(2, '2014-01-05', 'Transaksi B'),
    ];
    assert.equal(detectDateAnomalies(dates).filter((a) => a.kind === 'duplicate').length, 0);
  });

  test('(f) out-of-period: tanggal di luar rentang periode laporan yang dideklarasikan', () => {
    const dates = [
      row(1, '2014-01-01'),
      row(2, '2016-01-01'), // di luar periode Jan2014-Okt2015
    ];
    const period = { startIso: '2014-01-01', endIso: '2015-10-31' };
    const found = detectDateAnomalies(dates, period).filter((a) => a.kind === 'out-of-period');
    assert.equal(found.length, 1);
    assert.equal(found[0].row, 2);
  });

  test('(f) tanpa period diberikan -> tidak ada pengecekan out-of-period', () => {
    const dates = [row(1, '2099-01-01')];
    assert.equal(detectDateAnomalies(dates).filter((a) => a.kind === 'out-of-period').length, 0);
  });

  test('deret bersih tanpa anomali -> array kosong', () => {
    const dates = [
      row(1, '2014-01-01', 'a', 'Rabu'),
      row(2, '2014-01-02', 'b', 'Kamis'),
      row(3, '2014-01-03', 'c', 'Jumat'),
    ];
    assert.deepEqual(detectDateAnomalies(dates), []);
  });
});

describe('parseReportPeriod', () => {
  test('"BULAN JAN.2014 - OKT.2015" -> awal bulan Jan, akhir bulan (hari terakhir) Okt', () => {
    const r = parseReportPeriod('BULAN JAN.2014 - OKT.2015');
    assert.equal(r.startIso, '2014-01-01');
    assert.equal(r.endIso, '2015-10-31'); // hari terakhir Oktober, bukan tanggal 1
  });

  test('"JANUARI 2014 s.d. OKTOBER 2015" (nama bulan penuh) -> hasil sama', () => {
    const r = parseReportPeriod('JANUARI 2014 s.d. OKTOBER 2015');
    assert.equal(r.startIso, '2014-01-01');
    assert.equal(r.endIso, '2015-10-31');
  });

  test('header tidak bisa dipisah -> null + warning, tidak melempar exception', () => {
    const r = parseReportPeriod('bukan header periode');
    assert.equal(r.startIso, null);
    assert.equal(r.endIso, null);
    assert.ok(r.warnings.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Integrasi terhadap file ASLI calon klien (di-skip, bukan fail, kalau file tidak ada
// di mesin yang menjalankan test -- privasi, lihat catatan header di atas).
// ---------------------------------------------------------------------------
describe('integrasi fixture asli milik calon klien', () => {
  test(
    'sheet depresiasi baris 6 (22 kolom bulan "Jan`14".."Okt`15") -> semua ke-parse, monoton, tanpa anomali',
    { skip: realFixtureExists ? false : 'fixture asli tidak ditemukan di mesin ini (privasi) -- lihat REAL_FIXTURE_PATH' },
    async () => {
      const xlsxModule: any = await import('xlsx');
      const XLSX = xlsxModule.default || xlsxModule;
      const wb = XLSX.readFile(REAL_FIXTURE_PATH, { cellDates: false });
      const sheet = wb.Sheets['depresiasi'];
      assert.ok(sheet, 'sheet "depresiasi" harus ada di workbook asli');

      // Kolom H..AC row 6 = 22 header bulan (verified langsung dari fixture 2026-09-06).
      const cols = ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'];
      const headerValues = cols.map((c) => sheet[`${c}6`]?.v).filter((v) => v !== undefined);
      assert.equal(headerValues.length, 22, 'harus ada tepat 22 kolom bulan terisi (Jan`14..Okt`15)');

      const parsed = headerValues.map((raw, idx) => ({ raw, parsed: parseIndonesianDate(raw) }));
      const failures = parsed.filter((p) => p.parsed.iso === null);
      assert.deepEqual(
        failures.map((f) => f.raw),
        [],
        `semua 22 header bulan harus berhasil di-parse, yang gagal: ${JSON.stringify(failures.map((f) => f.raw))}`
      );

      // Harus persis Jan 2014 s.d. Okt 2015 berurutan tanpa lompatan.
      // index 0=Jan`14 .. 11=Des`14 (12 bulan tahun 2014), 12=Jan`15 .. 21=Okt`15 (10 bulan tahun 2015).
      assert.equal(parsed[0].parsed.iso, '2014-01-01');
      assert.equal(parsed[11].parsed.iso, '2014-12-01');
      assert.equal(parsed[12].parsed.iso, '2015-01-01');
      assert.equal(parsed[21].parsed.iso, '2015-10-01');

      const anomalyRows: DateAnomalyInput[] = parsed.map((p, i) => ({ row: i + 1, iso: p.parsed.iso, raw: p.raw }));
      const anomalies = detectDateAnomalies(anomalyRows);
      assert.deepEqual(anomalies, [], `header bulan asli harusnya tanpa anomali, ditemukan: ${JSON.stringify(anomalies)}`);
    }
  );
});

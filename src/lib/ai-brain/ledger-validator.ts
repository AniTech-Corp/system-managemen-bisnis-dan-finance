/**
 * Deterministic reconciliation/validation layer di atas ledger-parser.ts.
 *
 * FASE 3 dari roadmap anti-halusinasi (2026-09-06-roadmap-analisis-data-enterprise-anti-halusinasi.md).
 * Semua fungsi di sini murni (pure), tanpa LLM -- mengikuti pola calculateHPP() di
 * hpp-calculator.ts: hitung ulang dari data mentah (buku kas + jadwal non-kas), lalu
 * bandingkan hasilnya terhadap angka yang TERTULIS di sheet turunan (laba-rugi/neraca).
 * Kalau beda, itu WAJIB jadi Discrepancy eksplisit -- persis supaya kasus "37 juta vs 3 M"
 * (demo ke calon klien pertama, 5 Sep 2026) ketahuan SEBELUM dikirim ke user, bukan sesudah.
 */

import type { DepreciationSchedule, LabelValueEntry, ParsedLedger, Transaction } from './ledger-parser';
import { detectDateAnomalies, type DateAnomaly, type DateAnomalyInput } from './date-normalizer';

// ---------------------------------------------------------------------------
// Tipe publik
// ---------------------------------------------------------------------------

export type DiscrepancySeverity = 'info' | 'warning' | 'critical';

export type DiscrepancyKind =
  | 'kode-total-mismatch'
  | 'running-balance-mismatch'
  | 'statement-vs-recomputed-mismatch'
  | 'label-vs-computed-mismatch'
  | 'date-anomaly'
  | 'duplicate-transaction';

export interface Discrepancy {
  kind: DiscrepancyKind;
  expected: number | string;
  actual: number | string;
  where: string;
  severity: DiscrepancySeverity;
  explanation: string;
}

export interface ReconciledNote {
  description: string;
  detail: string;
}

export interface DiscrepancyReport {
  discrepancies: Discrepancy[];
  /** Hal-hal yang SUDAH dicek dan cocok -- termasuk item non-kas (depresiasi/amortisasi)
   *  yang memang tidak ada di buku kas dan direkonsiliasi lewat jadwalnya sendiri. */
  reconciled: ReconciledNote[];
  computed: {
    primarySheet: string | null;
    transactionCount: number;
    saldoAkhir: number | null;
    kodeAggregates: Record<number, { debit: number; credit: number }>;
    /** `null` (BUKAN 0) kalau sheet laba-rugi tidak ditemukan -- "tidak bisa dihitung"
     *  harus dibedakan dari "hasilnya nol", karena buku kas bisa saja tetap berisi
     *  transaksi walau tidak ada laporan turunan untuk dibandingkan (bug ditemukan
     *  Codex 2026-09-06). Kalau tidak null, nilainya SELALU hasil agregasi ulang dari
     *  transaksi/jadwal mentah (bukan disalin dari angka sheet yang sedang diaudit). */
    totalPendapatan: number | null;
    totalBiaya: number | null;
    labaOperasional: number | null;
    zakat: number | null;
    labaBersih: number | null;
  };
  /** Sinyal data-basi (template lama dipakai ulang) -- teks manusia-terbaca, bukan enum,
   *  karena tugasnya cuma menandai untuk manusia/LLM-narasi, bukan dipakai untuk cabang logika. */
  staleDataSignals: string[];
  /** Anomali tanggal pada ledger utama (typo tahun, tanggal mundur, duplikat, tanggal
   *  mustahil, nama hari tidak cocok) dari detectDateAnomalies() -- FASE 2 roadmap.
   *  Setiap item di sini JUGA dimasukkan ke `discrepancies` (kind 'date-anomaly') supaya
   *  jalur wiring/prompt yang sudah ada otomatis menampilkannya tanpa perubahan. */
  dateAnomalies: DateAnomaly[];
  /** Diteruskan dari ParsedLedger.warnings + catatan tambahan validator sendiri
   *  (mis. sheet laba-rugi/neraca tidak ditemukan). */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const TOLERANCE = 0.01;

/**
 * Duplikat di level TRANSAKSI PENUH: tanggal + uraian (dinormalisasi) + kode + debet +
 * kredit identik pada dua baris berbeda. Dua transaksi di hari yang sama dengan uraian/
 * nominal beda BUKAN duplikat (itu normal). Baris tanpa tanggal valid dilewati.
 */
function findDuplicateTransactions(txs: Transaction[]): { rowNo: number; firstRow: number; key: string }[] {
  const seen = new Map<string, number>();
  const out: { rowNo: number; firstRow: number; key: string }[] = [];
  for (const tx of txs) {
    if (!tx.dateIso) continue;
    const desc = tx.description.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!desc || /^saldo awal$/i.test(desc)) continue;
    const key = `${tx.dateIso}|${desc}|${tx.kode ?? ''}|${tx.debit ?? 0}|${tx.credit ?? 0}`;
    const first = seen.get(key);
    if (first !== undefined) out.push({ rowNo: tx.rowNo, firstRow: first, key });
    else seen.set(key, tx.rowNo);
  }
  return out;
}

function closeEnough(a: number, b: number, tol = TOLERANCE): boolean {
  return Math.abs(a - b) <= tol;
}

// Kode akun "Penjualan Barang ..." (section "2. Pendapatan" di sheet kode posting, kode
// 20-27) diposting sebagai DEBET di buku kas (kas/piutang bertambah saat penjualan
// dicatat). Semua kode lain yang tampil sebagai item biaya di laba-rugi diposting sebagai
// KREDIT. Aturan ini diverifikasi langsung dari fixture asli (income_recording_convention).
const REVENUE_KODE_MIN = 20;
const REVENUE_KODE_MAX = 27;
function isRevenueKode(kode: number): boolean {
  return kode >= REVENUE_KODE_MIN && kode <= REVENUE_KODE_MAX;
}

function collapseUpper(s: string): string {
  return s.toUpperCase().replace(/\s+/g, '');
}

function aggregateByKode(transactions: Transaction[]): Record<number, { debit: number; credit: number }> {
  const agg: Record<number, { debit: number; credit: number }> = {};
  for (const tx of transactions) {
    if (tx.kode === null) continue;
    if (!agg[tx.kode]) agg[tx.kode] = { debit: 0, credit: 0 };
    agg[tx.kode].debit += tx.debit ?? 0;
    agg[tx.kode].credit += tx.credit ?? 0;
  }
  return agg;
}

/** Pilih sheet ledger "utama" di antara semua sheet yang namanya mengandung "kas" --
 *  diprioritaskan yang punya kolom SALDO terisi (indikasi ledger kronologis lengkap),
 *  supaya sheet pivot/rekap ("buku kas (2)") yang merepresentasikan data SAMA tidak
 *  ikut dobel-hitung sebagai sumber agregasi. */
function pickPrimaryLedgerSheet(parsed: ParsedLedger): { name: string | null; transactions: Transaction[] } {
  let bestName: string | null = null;
  let bestTx: Transaction[] = [];
  let bestScore = -1;
  for (const [name, txs] of Object.entries(parsed.transactionsBySheet)) {
    const withSaldo = txs.filter((t) => t.runningBalance !== null).length;
    const score = withSaldo * 100000 + txs.length;
    if (score > bestScore) {
      bestScore = score;
      bestName = name;
      bestTx = txs;
    }
  }
  return { name: bestName, transactions: bestTx };
}

function findStatementSheet(
  parsed: ParsedLedger,
  predicate: (entries: LabelValueEntry[]) => boolean,
): { name: string | null; entries: LabelValueEntry[] } {
  for (const [name, entries] of Object.entries(parsed.statementSheets)) {
    if (predicate(entries)) return { name, entries };
  }
  return { name: null, entries: [] };
}

function findEntryByKode(entries: LabelValueEntry[], kode: number): LabelValueEntry | undefined {
  return entries.find((e) => e.kode === kode && e.value !== null);
}

function findEntryByLabelIncludes(entries: LabelValueEntry[], needle: string): LabelValueEntry | undefined {
  const upper = collapseUpper(needle);
  return entries.find((e) => collapseUpper(e.label).includes(upper) && e.value !== null);
}

/** Sama seperti findEntryByLabelIncludes, tapi mensyaratkan SEMUA substring cocok --
 *  perlu untuk label seperti "BERSIH" yang juga muncul sebagai substring kata biasa
 *  ("Belanja Alat Ke-BERSIH-an", kode 75) dan bukan baris subtotal "LABA / RUGI BERSIH"
 *  yang dimaksud (bug nyata ditemukan langsung lewat real-fixture test: tanpa syarat
 *  'LABA' sekaligus, .find() mengambil baris Kebersihan duluan karena urutannya lebih
 *  awal di sheet). */
function findEntryByLabelIncludesAll(entries: LabelValueEntry[], needles: string[]): LabelValueEntry | undefined {
  const uppers = needles.map(collapseUpper);
  return entries.find((e) => {
    const label = collapseUpper(e.label);
    return uppers.every((u) => label.includes(u)) && e.value !== null;
  });
}

function findDepreciationSchedule(parsed: ParsedLedger, keyword: string): DepreciationSchedule | undefined {
  return Object.values(parsed.depreciationSchedules).find((s) => s.sheet.toUpperCase().includes(keyword));
}

function scheduleRecognizedTotal(schedule: DepreciationSchedule): number {
  return schedule.totalPerBulan.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// validateLedger
// ---------------------------------------------------------------------------

export function validateLedger(parsed: ParsedLedger): DiscrepancyReport {
  const discrepancies: Discrepancy[] = [];
  const reconciled: ReconciledNote[] = [];
  const staleDataSignals: string[] = [];
  const warnings = [...parsed.warnings];

  // --- (1) pilih sheet ledger utama + agregasi debit/kredit per kode ---------------
  const { name: primarySheetName, transactions: primaryTx } = pickPrimaryLedgerSheet(parsed);
  const kodeAggregates = aggregateByKode(primaryTx);
  const saldoAkhir = primaryTx.length > 0 ? primaryTx[primaryTx.length - 1].runningBalance : null;

  const otherKasSheets = Object.keys(parsed.transactionsBySheet).filter((n) => n !== primarySheetName);
  if (otherKasSheets.length > 0) {
    warnings.push(
      `Sheet "kas" lain ditemukan (${otherKasSheets.join(', ')}) tapi TIDAK ikut diagregasi (kemungkinan pivot/rekap dari data sama seperti "${primarySheetName}") -- hindari dobel-hitung. Dipakai hanya sebagai cross-check kualitatif kalau perlu.`,
    );
  }

  // --- (3) validasi saldo berjalan baris-per-baris ---------------------------------
  let runningCalc = 0;
  let balanceMismatchCount = 0;
  for (const tx of primaryTx) {
    runningCalc += (tx.debit ?? 0) - (tx.credit ?? 0);
    if (tx.runningBalance !== null && !closeEnough(runningCalc, tx.runningBalance)) {
      balanceMismatchCount++;
      discrepancies.push({
        kind: 'running-balance-mismatch',
        expected: runningCalc,
        actual: tx.runningBalance,
        where: `${tx.sheet} baris ${tx.rowNo}`,
        severity: 'critical',
        explanation: `Saldo berjalan hasil hitung ulang (${runningCalc}) tidak sama dengan SALDO tertulis (${tx.runningBalance}) pada baris "${tx.description}".`,
      });
    }
  }
  if (primaryTx.length > 0 && balanceMismatchCount === 0) {
    reconciled.push({
      description: 'Saldo berjalan buku kas',
      detail: `Semua ${primaryTx.length} baris transaksi pada sheet "${primarySheetName}" cocok antara saldo tertulis dan hasil hitung ulang debit-kredit kumulatif.`,
    });
  }

  // --- cari sheet laba-rugi (kode 25 = Penjualan Barang Umum) & neraca (label TOTAL AKTIVA) ---
  const labaRugi = findStatementSheet(parsed, (entries) => entries.some((e) => e.kode === 25));
  const neraca = findStatementSheet(parsed, (entries) => findEntryByLabelIncludes(entries, 'TOTAL AKTIVA') !== undefined);

  // --- (2)+(4) hitung ulang pendapatan & biaya per kode dari agregasi ledger -------
  // `totalPendapatan`/`totalBiaya` diinisialisasi `null` (BUKAN 0): keduanya cuma
  // punya arti kalau ada sheet laba-rugi untuk dibandingkan -- lihat komentar di
  // cabang `else` di bawah dan JSDoc `DiscrepancyReport.computed`.
  let totalPendapatan: number | null = null;
  let totalBiaya: number | null = null;

  if (labaRugi.name) {
    totalPendapatan = 0;
    totalBiaya = 0;
    for (const entry of labaRugi.entries) {
      if (entry.kode === null || entry.value === null) continue;
      if (entry.kode === 84) continue; // Zakat = formula (2.5% x laba operasional), bukan agregasi ledger
      if (entry.kode === 691 || entry.kode === 692) continue; // non-kas, direkonsiliasi lewat jadwal di bawah

      const agg = kodeAggregates[entry.kode];
      const expected = isRevenueKode(entry.kode) ? agg?.debit ?? 0 : agg?.credit ?? 0;

      // BUG ditemukan Codex 2026-09-06: baris ini sebelumnya menambahkan `entry.value`
      // (angka MENTAH dari sheet laba-rugi yang SEDANG DIAUDIT), bukan `expected`
      // (hasil hitung ulang dari buku kas). Akibatnya kalau sheet laba-rugi salah
      // tulis, `computed.totalBiaya`/`labaOperasional` diam-diam ikut salah walau
      // validator sudah benar mendeteksi discrepancy-nya secara terpisah -- "angka
      // terverifikasi" jadi tidak lagi independen dari angka yang sedang diperiksa.
      // WAJIB selalu pakai `expected` (recomputed), TIDAK PERNAH `entry.value` (raw).
      if (isRevenueKode(entry.kode)) totalPendapatan += expected;
      else totalBiaya += expected;

      if (!closeEnough(expected, entry.value)) {
        discrepancies.push({
          kind: 'kode-total-mismatch',
          expected,
          actual: entry.value,
          where: `${labaRugi.name} baris ${entry.rowNo} (kode ${entry.kode}, "${entry.label}")`,
          severity: 'critical',
          explanation: `Angka di laba-rugi untuk kode ${entry.kode} ("${entry.label}") = ${entry.value}, tapi hasil hitung ulang dari buku kas ("${primarySheetName}") = ${expected}.`,
        });
      } else {
        reconciled.push({
          description: `Kode ${entry.kode} (${entry.label})`,
          detail: `Cocok: laba-rugi=${entry.value}, hitung ulang dari buku kas=${expected}.`,
        });
      }
    }

    // --- item non-kas: depresiasi (kode 691) & amortisasi (kode 692) ---------------
    for (const [kode, keyword] of [
      [691, 'DEPRESIASI'],
      [692, 'AMORTISASI'],
    ] as [number, string][]) {
      const entry = findEntryByKode(labaRugi.entries, kode);
      if (!entry || entry.value === null) continue;
      const schedule = findDepreciationSchedule(parsed, keyword);
      if (!schedule) {
        // Tidak ada jadwal depresiasi/amortisasi untuk direkonsiliasi -- tidak ada
        // sumber independen lain untuk kode non-kas ini, jadi terpaksa pakai angka
        // tertulis apa adanya (BEDA dari kasus utama di atas yang selalu punya
        // kodeAggregates sebagai sumber independen). Didokumentasikan eksplisit di
        // warning supaya tidak diam-diam dianggap "terverifikasi" sama seperti kode lain.
        warnings.push(
          `Kode ${kode} ada di laba-rugi tapi tidak ditemukan jadwal ${keyword.toLowerCase()} untuk direkonsiliasi -- totalBiaya memakai angka tertulis apa adanya untuk kode ini karena tidak ada sumber independen lain.`,
        );
        totalBiaya += entry.value;
        continue;
      }
      // BUG ditemukan Codex 2026-09-06 (sama seperti loop utama di atas): pakai
      // `expectedFromSchedule` (hasil SUM jadwal, recomputed) bukan `entry.value` (raw).
      const expectedFromSchedule = scheduleRecognizedTotal(schedule);
      totalBiaya += expectedFromSchedule;
      if (closeEnough(expectedFromSchedule, entry.value)) {
        reconciled.push({
          description: `Kode ${kode} (${entry.label}) -- item NON-KAS`,
          detail: `Tidak ada di buku kas (memang seharusnya, karena non-kas) -- direkonsiliasi lewat jadwal "${schedule.sheet}": SUM(nilai per bulan)=${expectedFromSchedule} cocok dengan laba-rugi=${entry.value}.`,
        });
      } else {
        discrepancies.push({
          kind: 'kode-total-mismatch',
          expected: expectedFromSchedule,
          actual: entry.value,
          where: `${labaRugi.name} baris ${entry.rowNo} (kode ${kode}, "${entry.label}") vs jadwal "${schedule.sheet}"`,
          severity: 'critical',
          explanation: `Beban non-kas kode ${kode} di laba-rugi = ${entry.value}, tapi SUM(nilai per bulan) dari jadwal "${schedule.sheet}" = ${expectedFromSchedule}.`,
        });
      }
    }
  } else {
    // BUG ditemukan Codex 2026-09-06: sebelumnya totalPendapatan/totalBiaya tetap 0
    // di jalur ini (nilai awalnya), jadi laporan menampilkan "laba = 0" yang KELIHATAN
    // sah padahal artinya sebenarnya "tidak bisa dihitung" -- buku kas bisa saja tetap
    // berisi transaksi (lihat computed.kodeAggregates), cuma tidak ada laporan turunan
    // untuk dibandingkan. Sekarang tetap null (diinisialisasi di atas), supaya
    // "tidak ada laporan" dan "hasilnya nol" tidak lagi ambigu bagi konsumen di hilir.
    warnings.push(
      'Tidak ditemukan sheet laba-rugi (dicari via kode 25 = Penjualan Barang Umum) -- totalPendapatan/totalBiaya/labaOperasional/zakat/labaBersih TIDAK BISA dihitung (null, BUKAN nol) karena tidak ada laporan turunan untuk direkonsiliasi. Buku kas mungkin tetap berisi transaksi -- lihat computed.kodeAggregates.',
    );
  }

  const labaOperasional = totalPendapatan !== null && totalBiaya !== null ? totalPendapatan - totalBiaya : null;
  const zakat = labaOperasional !== null ? labaOperasional * 0.025 : null;
  const labaBersih = labaOperasional !== null && zakat !== null ? labaOperasional - zakat : null;

  // --- cross-check subtotal literal di laba-rugi (OPERASIONAL/Zakat/BERSIH) -------
  if (labaRugi.name) {
    const operasionalEntry = findEntryByLabelIncludesAll(labaRugi.entries, ['LABA', 'OPERASIONAL']);
    if (operasionalEntry?.value !== undefined && operasionalEntry.value !== null && labaOperasional !== null) {
      if (!closeEnough(labaOperasional, operasionalEntry.value)) {
        discrepancies.push({
          kind: 'statement-vs-recomputed-mismatch',
          expected: labaOperasional,
          actual: operasionalEntry.value,
          where: `${labaRugi.name} baris ${operasionalEntry.rowNo}`,
          severity: 'critical',
          explanation: `Laba operasional hitung ulang (pendapatan ${totalPendapatan} - biaya ${totalBiaya} = ${labaOperasional}) tidak sama dengan angka tertulis (${operasionalEntry.value}).`,
        });
      } else {
        reconciled.push({
          description: 'Laba operasional',
          detail: `Hitung ulang (${labaOperasional}) cocok dengan angka tertulis (${operasionalEntry.value}).`,
        });
      }
    }

    const zakatEntry = findEntryByKode(labaRugi.entries, 84);
    if (zakatEntry?.value !== undefined && zakatEntry.value !== null && zakat !== null) {
      if (!closeEnough(zakat, zakatEntry.value)) {
        discrepancies.push({
          kind: 'statement-vs-recomputed-mismatch',
          expected: zakat,
          actual: zakatEntry.value,
          where: `${labaRugi.name} baris ${zakatEntry.rowNo}`,
          severity: 'warning',
          explanation: `Zakat 2.5% x laba operasional hitung ulang = ${zakat}, tertulis = ${zakatEntry.value}.`,
        });
      } else {
        reconciled.push({
          description: 'Zakat usaha (2.5% x laba operasional)',
          detail: `Hitung ulang (${zakat}) cocok dengan angka tertulis (${zakatEntry.value}).`,
        });
      }
    }

    const bersihEntry = findEntryByLabelIncludesAll(labaRugi.entries, ['LABA', 'BERSIH']);
    if (bersihEntry?.value !== undefined && bersihEntry.value !== null && labaBersih !== null) {
      if (!closeEnough(labaBersih, bersihEntry.value)) {
        discrepancies.push({
          kind: 'statement-vs-recomputed-mismatch',
          expected: labaBersih,
          actual: bersihEntry.value,
          where: `${labaRugi.name} baris ${bersihEntry.rowNo}`,
          severity: 'critical',
          explanation: `Laba bersih hitung ulang (${labaOperasional} - zakat ${zakat} = ${labaBersih}) tidak sama dengan angka tertulis (${bersihEntry.value}).`,
        });
      } else {
        reconciled.push({
          description: 'Laba bersih',
          detail: `Hitung ulang (${labaBersih}) cocok dengan angka tertulis (${bersihEntry.value}).`,
        });
      }
    }
  }

  // --- (4)+(6) neraca: Piutang, Kas dan Bank, Total Aktiva=Passiva, TA-TP ----------
  if (neraca.name) {
    const piutangEntry = findEntryByLabelIncludes(neraca.entries, 'PIUTANG KEPADA PELANGGAN');
    const kasEntry = findEntryByLabelIncludes(neraca.entries, 'KAS DAN BANK');
    const totalAktivaEntry = findEntryByLabelIncludes(neraca.entries, 'TOTAL AKTIVA');
    const totalPassivaEntry = findEntryByLabelIncludes(neraca.entries, 'TOTAL PASSIVA');
    const taTpEntry = neraca.entries.find((e) => collapseUpper(e.label) === 'TATP' && e.value !== null);

    // Piutang kepada Pelanggan = total penjualan (kode pendapatan, debet) dikurangi
    // total yang SUDAH ditagih (kode 18 "Hutang-piutang Pelanggan", sisi debet -- lihat
    // income_recording_convention: kode 25 debet + kode 18 kredit adalah pasangan kontra
    // penjualan-kredit, kode 18 debet = pembayaran diterima).
    const kode18 = kodeAggregates[18];
    // totalPendapatan bisa null (tidak ada sheet laba-rugi) -- piutang tidak bisa
    // dihitung ulang tanpa itu, jadi cross-check ini dilewati (bukan diam-diam
    // memakai 0 sebagai pengganti null).
    const expectedPiutang = totalPendapatan !== null ? totalPendapatan - (kode18?.debit ?? 0) : null;
    if (piutangEntry?.value !== undefined && piutangEntry.value !== null && expectedPiutang !== null) {
      if (!closeEnough(expectedPiutang, piutangEntry.value)) {
        discrepancies.push({
          kind: 'statement-vs-recomputed-mismatch',
          expected: expectedPiutang,
          actual: piutangEntry.value,
          where: `${neraca.name} baris ${piutangEntry.rowNo}`,
          severity: 'critical',
          explanation: `Piutang kepada Pelanggan hitung ulang (penjualan ${totalPendapatan} - kode 18 debet ${kode18?.debit ?? 0} = ${expectedPiutang}) tidak sama dengan neraca (${piutangEntry.value}).`,
        });
      } else {
        reconciled.push({
          description: 'Piutang kepada Pelanggan',
          detail: `Hitung ulang (${expectedPiutang}) cocok dengan neraca (${piutangEntry.value}).`,
        });
      }
    }

    if (kasEntry?.value !== undefined && kasEntry.value !== null && saldoAkhir !== null) {
      // Kas dan Bank di neraca = dana tunai (saldo akhir buku kas) + saldo bank. Sub-ledger
      // "Rek Bank" TIDAK diparse pada FASE ini (di luar scope tugas -- lihat open question
      // di laporan agent), jadi validator hanya memastikan dana tunai <= Kas dan Bank
      // (tidak bisa memverifikasi komponen saldo bank secara independen).
      if (saldoAkhir > kasEntry.value + TOLERANCE) {
        discrepancies.push({
          kind: 'statement-vs-recomputed-mismatch',
          expected: saldoAkhir,
          actual: kasEntry.value,
          where: `${neraca.name} baris ${kasEntry.rowNo}`,
          severity: 'warning',
          explanation: `Saldo akhir dana tunai dari buku kas (${saldoAkhir}) melebihi angka "Kas dan Bank" di neraca (${kasEntry.value}) -- seharusnya dana tunai adalah bagian dari Kas dan Bank (dana tunai + saldo bank).`,
        });
      } else {
        reconciled.push({
          description: 'Kas dan Bank (komponen dana tunai)',
          detail: `Saldo akhir dana tunai dari buku kas (${saldoAkhir}) konsisten sebagai komponen "Kas dan Bank" di neraca (${kasEntry.value}); komponen saldo bank tidak diverifikasi terpisah pada FASE ini (sub-ledger "Rek Bank" di luar scope, lihat open question).`,
        });
      }
    }

    if (
      totalAktivaEntry?.value !== undefined &&
      totalAktivaEntry.value !== null &&
      totalPassivaEntry?.value !== undefined &&
      totalPassivaEntry.value !== null
    ) {
      if (!closeEnough(totalAktivaEntry.value, totalPassivaEntry.value)) {
        discrepancies.push({
          kind: 'statement-vs-recomputed-mismatch',
          expected: totalAktivaEntry.value,
          actual: totalPassivaEntry.value,
          where: neraca.name,
          severity: 'critical',
          explanation: `Total Aktiva (${totalAktivaEntry.value}) tidak sama dengan Total Passiva (${totalPassivaEntry.value}) -- neraca tidak balance.`,
        });
      } else {
        reconciled.push({
          description: 'Total Aktiva = Total Passiva',
          detail: `Keduanya ${totalAktivaEntry.value} -- neraca balance.`,
        });
      }
    }
    if (taTpEntry?.value !== undefined && taTpEntry.value !== null && !closeEnough(taTpEntry.value, 0)) {
      discrepancies.push({
        kind: 'statement-vs-recomputed-mismatch',
        expected: 0,
        actual: taTpEntry.value,
        where: `${neraca.name} baris ${taTpEntry.rowNo}`,
        severity: 'critical',
        explanation: `Baris "TA - TP" seharusnya 0, tertulis ${taTpEntry.value}.`,
      });
    } else if (taTpEntry) {
      reconciled.push({ description: 'TA - TP', detail: 'Bernilai 0 sesuai seharusnya.' });
    }

    // --- (5) label vs hitungan: "(N bulan)" vs jumlah kolom bulan terisi di jadwal ---
    for (const keyword of ['DEPRESIASI', 'AMORTISASI']) {
      const label = neraca.entries.find(
        (e) => collapseUpper(e.label).includes('AKUMULASI') && collapseUpper(e.label).includes(keyword),
      );
      if (!label) continue;
      const bulanMatch = label.label.match(/\(\s*(\d+)\s*bulan\s*\)/i);
      if (!bulanMatch) continue;
      const statedMonths = Number(bulanMatch[1]);
      const schedule = findDepreciationSchedule(parsed, keyword);
      if (!schedule) continue;
      const actualMonths = schedule.totalPerBulan.filter((v) => Math.abs(v) > TOLERANCE).length;
      if (statedMonths !== actualMonths) {
        discrepancies.push({
          kind: 'label-vs-computed-mismatch',
          expected: actualMonths,
          actual: statedMonths,
          where: `${neraca.name} baris ${label.rowNo} ("${label.label}")`,
          severity: 'info',
          explanation: `Label menulis "(${statedMonths} bulan)" tapi jadwal "${schedule.sheet}" punya ${actualMonths} kolom bulan terisi (nilai rupiahnya tetap benar -- ini typo label di dokumen sumber, BUKAN kesalahan hitung).`,
        });
      } else {
        reconciled.push({
          description: `Label "(${statedMonths} bulan)" untuk ${keyword.toLowerCase()}`,
          detail: `Cocok dengan ${actualMonths} kolom bulan terisi di jadwal "${schedule.sheet}".`,
        });
      }
    }
  } else {
    warnings.push('Tidak ditemukan sheet neraca (dicari via label "TOTAL AKTIVA") -- lewati validasi neraca.');
  }

  // --- (6) sinyal data-basi: nama entitas/tanggal template lama vs laporan aktual ---
  detectStaleDataSignals(parsed, staleDataSignals);

  // --- (7) FASE 2: anomali tanggal pada ledger utama -------------------------------
  // Sebelumnya detectDateAnomalies() sudah ada + teruji tapi TIDAK PERNAH dipanggil di
  // jalur produksi (temuan verifier adversarial 2026-09-06). Sekarang dipasang di sini.
  // `period` (cek out-of-period) sengaja belum diisi: header periode ("BULAN JAN.2014 -
  // OKT.2015") belum ditangkap parser ke metadata -- follow-up kecil, dicatat di
  // warnings supaya tidak diam-diam terlewat. Anomali TIDAK mengubah data; tiap item
  // juga dicerminkan ke `discrepancies` supaya wiring/prompt yang sudah ada langsung
  // menampilkannya tanpa perubahan lain.
  // BUG ditemukan Codex 2026-09-06: baris dengan tanggal mustahil (mis. "31/02/2024")
  // sebelumnya DIBUANG TOTAL oleh ledger-parser.ts sebelum sempat sampai ke sini --
  // dateInputs cuma berisi transaksi yang SUDAH lolos parse tanggal, jadi kelas
  // 'impossible-date' (yang detectDateAnomalies() sebenarnya sudah punya) tidak pernah
  // ke-trigger untuk kasus ini. Sekarang parser mempertahankan baris begitu sebagai
  // InvalidTransactionRow (parsed.invalidRows) -- digabung ke sini SUPAYA anomalinya
  // terlaporkan, TAPI baris ini TIDAK PERNAH masuk primaryTx/kodeAggregates, jadi tidak
  // ikut agregasi finansial mana pun (angkanya tidak lenyap tanpa jejak, tapi juga tidak
  // ikut dihitung sebagai transaksi sah).
  const primaryInvalidRows = primarySheetName ? parsed.invalidRows[primarySheetName] ?? [] : [];
  const dateInputs: DateAnomalyInput[] = [
    ...primaryTx.map((tx) => ({ row: tx.rowNo, iso: tx.dateIso, raw: tx.dateRaw })),
    ...primaryInvalidRows.map((r) => ({ row: r.rowNo, iso: null, raw: r.dateRaw })),
  ].sort((a, b) => a.row - b.row); // urutan baris WAJIB dipertahankan untuk cek non-monotonic/year-jump
  // Kelas 'duplicate' dari detektor tanggal SENGAJA DIBUANG di sini: detektor itu cuma
  // lihat tanggal, jadi dua transaksi berbeda di hari yang sama (hal paling normal di
  // buku kas -- fixture asli punya 334 kasus begini) ikut dicap "duplikat". Terbukti
  // salah saat dijalankan ke file asli calon klien 2026-09-06 (334 false positive
  // menenggelamkan 1 temuan asli). Duplikat yang BENAR-BENAR mencurigakan dicek di
  // level transaksi penuh di bawah (findDuplicateTransactions).
  const dateAnomalies: DateAnomaly[] =
    dateInputs.length > 0 ? detectDateAnomalies(dateInputs).filter((a) => a.kind !== 'duplicate') : [];
  for (const dup of findDuplicateTransactions(primaryTx)) {
    discrepancies.push({
      kind: 'duplicate-transaction',
      expected: `1 baris untuk ${dup.key}`,
      actual: `baris ${dup.firstRow} dan baris ${dup.rowNo}`,
      where: `${primarySheetName ?? 'buku kas'} baris ${dup.rowNo}`,
      severity: 'warning',
      explanation: `Baris ${dup.rowNo} identik persis (tanggal, uraian, kode, debet, kredit) dengan baris ${dup.firstRow} -- kemungkinan tercatat dua kali. Nilai tidak diubah; periksa manual.`,
    });
  }
  const severityMap: Record<DateAnomaly['severity'], DiscrepancySeverity> = {
    high: 'critical',
    medium: 'warning',
    low: 'info',
  };
  for (const a of dateAnomalies) {
    discrepancies.push({
      kind: 'date-anomaly',
      expected: 'tanggal valid, kronologis, tahun wajar',
      actual: typeof a.raw === 'string' || typeof a.raw === 'number' ? String(a.raw) : JSON.stringify(a.raw),
      where: `${primarySheetName ?? 'buku kas'} baris ${a.row}`,
      severity: severityMap[a.severity],
      explanation: `[${a.kind}] ${a.suggestion ?? 'Anomali tanggal terdeteksi -- periksa manual.'}`,
    });
  }
  if (primaryTx.length > 0 && dateAnomalies.length === 0) {
    reconciled.push({
      description: 'Urutan & validitas tanggal buku kas',
      detail: `Semua ${primaryTx.length} tanggal transaksi pada "${primarySheetName}" kronologis, tahun wajar, tanpa duplikat persis.`,
    });
  }
  warnings.push(
    'Cek tanggal di luar periode laporan (out-of-period) belum aktif: header periode ("BULAN ... - ...") belum ditangkap parser -- follow-up kecil di ledger-parser.ts.',
  );

  return {
    discrepancies,
    reconciled,
    dateAnomalies,
    computed: {
      primarySheet: primarySheetName,
      transactionCount: primaryTx.length,
      saldoAkhir,
      kodeAggregates,
      totalPendapatan,
      totalBiaya,
      labaOperasional,
      zakat,
      labaBersih,
    },
    staleDataSignals,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Deteksi sinyal data-basi
// ---------------------------------------------------------------------------

function detectStaleDataSignals(parsed: ParsedLedger, out: string[]): void {
  const { staleCompanyNameCandidates, canonicalCompanyNameCandidates, kodePostingDateSignatures, reportDateSignatures } =
    parsed.metadata;

  if (staleCompanyNameCandidates.length > 0 && canonicalCompanyNameCandidates.length > 0) {
    const stale = staleCompanyNameCandidates[0];
    const canonical = canonicalCompanyNameCandidates[0];
    const staleNorm = stale.toUpperCase().replace(/[^A-Z]/g, '');
    const canonicalNorm = canonical.toUpperCase().replace(/[^A-Z]/g, '');
    if (staleNorm && canonicalNorm && !canonicalNorm.includes(staleNorm) && !staleNorm.includes(canonicalNorm)) {
      out.push(
        `Sheet "kode posting" (bagan akun) memakai nama entitas "${stale}" yang berbeda dari nama perusahaan pada laporan ("${canonical}") -- kemungkinan template bagan akun lama dipakai ulang, bukan dibuat khusus untuk laporan ini.`,
      );
    }
  }

  if (kodePostingDateSignatures.length > 0 && reportDateSignatures.length > 0) {
    const kodeYearMatch = kodePostingDateSignatures[0].match(/(\d{4})\s*$/);
    const reportYearMatch = reportDateSignatures[0].match(/(\d{4})\s*$/);
    if (kodeYearMatch && reportYearMatch) {
      const kodeYear = Number(kodeYearMatch[1]);
      const reportYear = Number(reportYearMatch[1]);
      if (Math.abs(reportYear - kodeYear) >= 2) {
        out.push(
          `Tanggal di sheet "kode posting" ("${kodePostingDateSignatures[0]}", tahun ${kodeYear}) jauh lebih lama dibanding tanggal laporan ("${reportDateSignatures[0]}", tahun ${reportYear}) -- sinyal template bagan akun lama (bukan dibuat ulang untuk periode laporan ini).`,
        );
      }
    }
  }
}

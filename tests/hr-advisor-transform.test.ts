import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  computeTaskCompletionStats,
  computeAttendanceStats,
  combinePromotionScore,
  buildPromotionTier,
  categoryHasAutoData,
  buildDisciplineTier,
} from '../src/lib/hr-advisor-transform';

// Test logic fetch+transform yang dipakai HRAdvisorPanel.tsx (tab Rekomendasi
// Promosi + Rekomendasi Disiplin) buat nyambungin ke data ASLI backend
// kerja/tasks + kerja/attendance, gantiin kalkulasi lokal murni yang lama.
// Belum ada test komponen React di project ini (belum ada
// @testing-library/react di package.json) -- jadi yang ditest adalah logic
// murninya, pola sama seperti corplan-quick-tools-calc.test.ts.

describe('computeTaskCompletionStats', () => {
  test('filter per nama (case-insensitive, trim) + hitung rate selesai', () => {
    const tasks = [
      { assigneeName: 'Siti Aminah', status: 'DONE' },
      { assigneeName: ' siti aminah ', status: 'DONE' },
      { assigneeName: 'Siti Aminah', status: 'IN_PROGRESS' },
      { assigneeName: 'Budi Santoso', status: 'DONE' },
    ];
    const r = computeTaskCompletionStats(tasks, 'Siti Aminah');
    assert.equal(r.totalAssigned, 3);
    assert.equal(r.doneCount, 2);
    assert.equal(r.completionRate, 67); // Math.round(2/3*100)
  });

  test('tidak ada tugas cocok -> completionRate null (bukan 0)', () => {
    const r = computeTaskCompletionStats([{ assigneeName: 'Budi', status: 'DONE' }], 'Siti Aminah');
    assert.equal(r.totalAssigned, 0);
    assert.equal(r.completionRate, null);
  });

  test('nama kosong -> null, tidak crash', () => {
    const r = computeTaskCompletionStats([{ assigneeName: 'Budi', status: 'DONE' }], '   ');
    assert.equal(r.completionRate, null);
  });
});

describe('computeAttendanceStats', () => {
  test('hitung onTimeCount, lateCount, punctualityRate per nama', () => {
    const records = [
      { employeeName: 'Andi Wijaya', status: 'HADIR_TEPAT_WAKTU' },
      { employeeName: 'Andi Wijaya', status: 'TERLAMBAT' },
      { employeeName: 'Andi Wijaya', status: 'TERLAMBAT' },
      { employeeName: 'Andi Wijaya', status: 'HADIR_TEPAT_WAKTU' },
      { employeeName: 'Orang Lain', status: 'TERLAMBAT' },
    ];
    const r = computeAttendanceStats(records, 'andi wijaya');
    assert.equal(r.totalRecords, 4);
    assert.equal(r.onTimeCount, 2);
    assert.equal(r.lateCount, 2);
    assert.equal(r.punctualityRate, 50);
  });

  test('tidak ada presensi cocok -> punctualityRate null', () => {
    const r = computeAttendanceStats([{ employeeName: 'Budi', status: 'TERLAMBAT' }], 'Siti');
    assert.equal(r.totalRecords, 0);
    assert.equal(r.punctualityRate, null);
  });
});

describe('combinePromotionScore', () => {
  test('dua-duanya ada data ASLI -> rata-rata, source=real', () => {
    const r = combinePromotionScore(
      { totalAssigned: 4, doneCount: 4, completionRate: 100 },
      { totalRecords: 10, onTimeCount: 5, lateCount: 5, punctualityRate: 50 },
      null
    );
    assert.equal(r.avgScore, 75); // (100+50)/2
    assert.equal(r.source, 'real');
  });

  test('cuma tugas ada data, presensi kosong -> pakai yang ada aja, tetap source=real', () => {
    const r = combinePromotionScore(
      { totalAssigned: 2, doneCount: 1, completionRate: 50 },
      { totalRecords: 0, onTimeCount: 0, lateCount: 0, punctualityRate: null },
      99 // manual diabaikan karena ada data asli
    );
    assert.equal(r.avgScore, 50);
    assert.equal(r.source, 'real');
  });

  test('dua-duanya kosong tapi ada skor manual -> fallback manual, source=manual', () => {
    const r = combinePromotionScore(
      { totalAssigned: 0, doneCount: 0, completionRate: null },
      { totalRecords: 0, onTimeCount: 0, lateCount: 0, punctualityRate: null },
      80
    );
    assert.equal(r.avgScore, 80);
    assert.equal(r.source, 'manual');
  });

  test('manual score di luar 0-100 di-clamp', () => {
    const r = combinePromotionScore(null, null, 150);
    assert.equal(r.avgScore, 100);
    const r2 = combinePromotionScore(null, null, -20);
    assert.equal(r2.avgScore, 0);
  });

  test('tidak ada data sama sekali (manual pun kosong) -> avgScore 0, source=none', () => {
    const r = combinePromotionScore(null, null, null);
    assert.equal(r.avgScore, 0);
    assert.equal(r.source, 'none');
  });
});

describe('buildPromotionTier', () => {
  test('avgScore>=85 dan tenure>=2 -> Sangat layak', () => {
    const r = buildPromotionTier(90, 3, 'real');
    assert.equal(r.tier, 'Sangat layak dipertimbangkan');
    assert.equal(r.tierColor, '#3FBF8F');
    assert.ok(r.note.includes('90/100'));
    assert.ok(r.note.includes('data tugas & presensi yang tercatat di sistem'));
  });

  test('avgScore>=85 tapi tenure<2 -> turun ke Layak dengan catatan', () => {
    const r = buildPromotionTier(90, 1, 'real');
    assert.equal(r.tier, 'Layak dipertimbangkan, dengan catatan');
    assert.ok(r.note.includes('masa kerja masih di bawah 2 tahun'));
  });

  test('avgScore 70-84 -> Layak dengan catatan', () => {
    const r = buildPromotionTier(75, 5, 'real');
    assert.equal(r.tier, 'Layak dipertimbangkan, dengan catatan');
    assert.equal(r.tierColor, '#D8A33C');
  });

  test('avgScore<70 -> Belum waktunya', () => {
    const r = buildPromotionTier(40, 5, 'real');
    assert.equal(r.tier, 'Belum waktunya, perlu peningkatan dulu');
    assert.equal(r.tierColor, '#EF4444');
  });

  test('source=manual -> note sebut skor manual, bukan data sistem', () => {
    const r = buildPromotionTier(90, 3, 'manual');
    assert.ok(r.note.includes('skor manual yang diinput'));
    assert.ok(!r.note.includes('data tugas & presensi'));
  });

  test('source=none -> note sebut tanpa data', () => {
    const r = buildPromotionTier(0, 0, 'none');
    assert.ok(r.note.includes('TANPA data'));
  });
});

describe('categoryHasAutoData', () => {
  test('"Keterlambatan berulang" -> true', () => {
    assert.equal(categoryHasAutoData('Keterlambatan berulang'), true);
  });
  test('kategori lain -> false (belum ada model pelanggaran di schema)', () => {
    assert.equal(categoryHasAutoData('Ketidakhadiran tanpa keterangan'), false);
    assert.equal(categoryHasAutoData('Pelanggaran prosedur / SOP kerja'), false);
    assert.equal(categoryHasAutoData('Perilaku tidak profesional'), false);
    assert.equal(categoryHasAutoData('Lainnya'), false);
  });
});

describe('buildDisciplineTier', () => {
  test('prior=0 -> Teguran lisan', () => {
    const r = buildDisciplineTier(0, null);
    assert.equal(r.tier, 'Teguran lisan');
    assert.equal(r.tierColor, '#4E9BFF');
    assert.equal(r.steps.length, 3);
  });

  test('prior=1 atau 2 -> SP ke-1, sebut jumlah kejadian di step', () => {
    const r = buildDisciplineTier(2, null);
    assert.equal(r.tier, 'Peringatan tertulis (SP ke-1)');
    assert.ok(r.steps[0].includes('riwayat 2 kejadian serupa'));
  });

  test('prior=3+ -> eskalasi HR senior, sebut (prior+1) kejadian', () => {
    const r = buildDisciplineTier(3, null);
    assert.equal(r.tier, 'Peringatan keras / eskalasi ke HR-manajemen senior');
    assert.ok(r.steps[0].includes('4 kejadian tercatat'));
  });

  test('autoSourceNote terpasang -> muncul di step sebagai sumber data', () => {
    const r = buildDisciplineTier(3, 'data presensi sistem, dari 30 presensi terakhir');
    assert.ok(r.steps[0].includes('(data presensi sistem, dari 30 presensi terakhir)'));
  });

  test('priorIncidents negatif/pecahan di-normalisasi (clamp 0, dibulatkan)', () => {
    const r = buildDisciplineTier(-5, null);
    assert.equal(r.tier, 'Teguran lisan');
    const r2 = buildDisciplineTier(1.6, null);
    assert.ok(r2.steps[0].includes('riwayat 2 kejadian serupa'));
  });
});

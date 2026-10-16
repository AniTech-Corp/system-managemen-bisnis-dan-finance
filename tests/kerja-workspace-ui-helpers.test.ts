import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  taskPriorityMeta,
  attendanceStatusMeta,
  kpiGradeColor,
  formatDueDateBadge,
  scoreSopQuiz,
  isValidTaskDraft,
  isValidAttendanceDraft,
} from '../src/lib/kerja-workspace-ui-helpers';

// Test logic murni yang dipakai KlirWorkspaceView.tsx (tab-workspace: Kanban
// Tugas, Presensi, KPI, SOP-AI). Backend (src/app/api/v1/kerja/*) TIDAK
// di-test ulang di sini -- itu endpoint existing yang direuse apa adanya.
// Yang di-test cuma turunan tampilan + skor kuis SOP yang memang murni
// client-side (belum ada endpoint simpan hasil kuis karyawan).

describe('taskPriorityMeta', () => {
  test('LOW/MEDIUM/HIGH/URGENT masing-masing punya label+warna beda', () => {
    const labels = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => taskPriorityMeta(p).label);
    assert.equal(new Set(labels).size, 4, 'keempat label harus unik');
  });
  test('URGENT -> warna merah (paling mendesak)', () => {
    assert.equal(taskPriorityMeta('URGENT').color, '#EF4444');
  });
  test('nilai tak dikenal/null -> fallback aman, bukan crash', () => {
    assert.equal(taskPriorityMeta('SOMETHING_ELSE').label, 'Tidak diketahui');
    assert.equal(taskPriorityMeta(null).label, 'Tidak diketahui');
    assert.equal(taskPriorityMeta(undefined).label, 'Tidak diketahui');
  });
});

describe('attendanceStatusMeta', () => {
  test('HADIR_TEPAT_WAKTU -> hijau (positif)', () => {
    assert.equal(attendanceStatusMeta('HADIR_TEPAT_WAKTU').color, '#3FBF8F');
  });
  test('TERLAMBAT -> warna beda dari HADIR_TEPAT_WAKTU', () => {
    assert.notEqual(attendanceStatusMeta('TERLAMBAT').color, attendanceStatusMeta('HADIR_TEPAT_WAKTU').color);
  });
  test('4 status enum Prisma semua terpetakan (bukan fallback)', () => {
    for (const s of ['HADIR_TEPAT_WAKTU', 'TERLAMBAT', 'IZIN', 'CUTI']) {
      assert.notEqual(attendanceStatusMeta(s).label, 'Tidak diketahui');
    }
  });
  test('status tak dikenal -> fallback aman', () => {
    assert.equal(attendanceStatusMeta('ALIEN_STATUS').label, 'Tidak diketahui');
  });
});

describe('kpiGradeColor', () => {
  test('A > B > C > D urutannya beda warna semua (bukan re-hitung skor, cuma warna)', () => {
    const colors = ['A', 'B', 'C', 'D'].map(kpiGradeColor);
    assert.equal(new Set(colors).size, 4);
  });
  test('A = hijau (paling baik), D = merah (paling perlu evaluasi)', () => {
    assert.equal(kpiGradeColor('A'), '#3FBF8F');
    assert.equal(kpiGradeColor('D'), '#EF4444');
  });
  test('grade tak dikenal -> abu-abu netral, bukan crash', () => {
    assert.equal(kpiGradeColor('Z'), '#98A2B3');
    assert.equal(kpiGradeColor(undefined), '#98A2B3');
  });
});

describe('formatDueDateBadge', () => {
  const now = new Date(2026, 8, 9); // 9 Sep 2026, cocok "hari ini" sesi ini

  test('dueDate null/undefined -> null (tidak ada badge)', () => {
    assert.equal(formatDueDateBadge(null, now), null);
    assert.equal(formatDueDateBadge(undefined, now), null);
  });

  test('dueDate string tidak valid -> null, bukan NaN/crash', () => {
    assert.equal(formatDueDateBadge('bukan-tanggal', now), null);
  });

  test('dueDate = hari ini -> "Jatuh tempo hari ini", tone today', () => {
    const badge = formatDueDateBadge(new Date(2026, 8, 9).toISOString(), now);
    assert.equal(badge?.label, 'Jatuh tempo hari ini');
    assert.equal(badge?.tone, 'today');
  });

  test('dueDate 2 hari lagi -> tone soon, label "2 hari lagi"', () => {
    const badge = formatDueDateBadge(new Date(2026, 8, 11).toISOString(), now);
    assert.equal(badge?.label, '2 hari lagi');
    assert.equal(badge?.tone, 'soon');
  });

  test('dueDate 10 hari lagi -> tone normal (belum mendesak)', () => {
    const badge = formatDueDateBadge(new Date(2026, 8, 19).toISOString(), now);
    assert.equal(badge?.tone, 'normal');
    assert.equal(badge?.label, '10 hari lagi');
  });

  test('dueDate 3 hari lalu -> "Terlambat 3 hari", tone overdue, merah', () => {
    const badge = formatDueDateBadge(new Date(2026, 8, 6).toISOString(), now);
    assert.equal(badge?.label, 'Terlambat 3 hari');
    assert.equal(badge?.tone, 'overdue');
    assert.equal(badge?.color, '#EF4444');
  });

  test('dueDate kemarin (1 hari lalu) -> "Terlambat 1 hari" (bukan "hari")', () => {
    const badge = formatDueDateBadge(new Date(2026, 8, 8).toISOString(), now);
    assert.equal(badge?.label, 'Terlambat 1 hari');
  });
});

describe('scoreSopQuiz', () => {
  const quiz = [
    { pertanyaan: 'Q1', pilihan: ['A. x', 'B. y', 'C. z', 'D. w'], jawabanBenar: 'A' },
    { pertanyaan: 'Q2', pilihan: ['A. x', 'B. y', 'C. z', 'D. w'], jawabanBenar: 'B' },
    { pertanyaan: 'Q3', pilihan: ['A. x', 'B. y', 'C. z', 'D. w'], jawabanBenar: 'C' },
  ];

  test('quiz kosong/null -> total 0, tidak lulus, tidak crash', () => {
    assert.deepEqual(scoreSopQuiz(null, []), { correct: 0, total: 0, allAnswered: false, passed: false });
    assert.deepEqual(scoreSopQuiz(undefined, []), { correct: 0, total: 0, allAnswered: false, passed: false });
    assert.deepEqual(scoreSopQuiz([], []), { correct: 0, total: 0, allAnswered: false, passed: false });
  });

  test('semua jawaban benar (huruf polos "A") -> correct 3, passed true', () => {
    const r = scoreSopQuiz(quiz, ['A', 'B', 'C']);
    assert.equal(r.correct, 3);
    assert.equal(r.total, 3);
    assert.equal(r.allAnswered, true);
    assert.equal(r.passed, true);
  });

  test('jawaban full string "A. x" (bukan cuma huruf) tetap cocok -- ambil karakter pertama', () => {
    const r = scoreSopQuiz(quiz, ['A. x', 'B. y', 'C. z']);
    assert.equal(r.correct, 3);
  });

  test('2 dari 3 benar (67%) -> passed true (ambang >=67%)', () => {
    const r = scoreSopQuiz(quiz, ['A', 'B', 'D']); // Q3 salah
    assert.equal(r.correct, 2);
    assert.equal(r.passed, true);
  });

  test('1 dari 3 benar (33%) -> passed false', () => {
    const r = scoreSopQuiz(quiz, ['A', 'D', 'D']);
    assert.equal(r.correct, 1);
    assert.equal(r.passed, false);
  });

  test('belum semua terjawab (null di tengah) -> allAnswered false, passed false walau sisanya benar', () => {
    const r = scoreSopQuiz(quiz, ['A', null, 'C']);
    assert.equal(r.allAnswered, false);
    assert.equal(r.passed, false);
    assert.equal(r.correct, 2, 'yang terjawab & benar tetap dihitung correct meski belum lulus');
  });

  test('lowercase jawaban tetap dinormalisasi ("a" == "A")', () => {
    const r = scoreSopQuiz(quiz, ['a', 'b', 'c']);
    assert.equal(r.correct, 3);
  });
});

describe('isValidTaskDraft', () => {
  test('judul kosong/whitespace saja -> tidak valid', () => {
    assert.equal(isValidTaskDraft(''), false);
    assert.equal(isValidTaskDraft('   '), false);
  });
  test('judul ada isinya -> valid', () => {
    assert.equal(isValidTaskDraft('Setor kas ke bank'), true);
  });
});

describe('isValidAttendanceDraft', () => {
  test('nama kosong/whitespace saja -> tidak valid', () => {
    assert.equal(isValidAttendanceDraft(''), false);
    assert.equal(isValidAttendanceDraft('  '), false);
  });
  test('nama ada isinya -> valid', () => {
    assert.equal(isValidAttendanceDraft('Budi Santoso'), true);
  });
});

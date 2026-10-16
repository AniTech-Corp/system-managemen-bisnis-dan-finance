/**
 * Logic murni (bukan komponen React, tidak sentuh Prisma/DB) yang dipakai
 * KlirWorkspaceView.tsx (tab Kanban Tugas, Presensi, KPI, SOP-AI).
 *
 * Dipisah dari komponen supaya bisa di-test tanpa perlu render React
 * (project ini belum punya @testing-library/react -- pola sama seperti
 * hpp-calculator.ts / kur-calculator.ts yang dites lewat
 * corplan-quick-tools-calc.test.ts).
 *
 * SEMUA data sumber (daftar tugas, presensi, hasil evaluasi KPI, SOP hasil AI)
 * datang dari endpoint yang SUDAH ADA di src/app/api/v1/kerja/* -- file ini
 * TIDAK menghitung ulang keputusan bisnis milik backend (mis. total skor KPI
 * atau grade A/B/C/D dihitung server, bukan di sini). Yang di sini murni
 * logic tampilan turunan: badge/warna, hitung mundur due date, dan skor kuis
 * SOP yang memang cuma ada di sisi client (user pilih jawaban di browser).
 */

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type AttendanceStatus = 'HADIR_TEPAT_WAKTU' | 'TERLAMBAT' | 'IZIN' | 'CUTI';

export interface BadgeMeta {
  label: string;
  color: string;
}

const UNKNOWN_BADGE: BadgeMeta = { label: 'Tidak diketahui', color: '#98A2B3' };

/** Badge label + warna untuk prioritas tugas Kanban. */
export function taskPriorityMeta(priority: string | null | undefined): BadgeMeta {
  switch (priority) {
    case 'LOW':
      return { label: 'Rendah', color: '#98A2B3' };
    case 'MEDIUM':
      return { label: 'Sedang', color: '#4E9BFF' };
    case 'HIGH':
      return { label: 'Tinggi', color: '#D8A33C' };
    case 'URGENT':
      return { label: 'Mendesak', color: '#EF4444' };
    default:
      return UNKNOWN_BADGE;
  }
}

/** Badge label + warna untuk status presensi. */
export function attendanceStatusMeta(status: string | null | undefined): BadgeMeta {
  switch (status) {
    case 'HADIR_TEPAT_WAKTU':
      return { label: 'Tepat waktu', color: '#3FBF8F' };
    case 'TERLAMBAT':
      return { label: 'Terlambat', color: '#D8A33C' };
    case 'IZIN':
      return { label: 'Izin', color: '#4E9BFF' };
    case 'CUTI':
      return { label: 'Cuti', color: '#98A2B3' };
    default:
      return UNKNOWN_BADGE;
  }
}

/**
 * Badge warna untuk grade KPI (A/B/C/D). Label lengkap (gradeLabel) dan angka
 * skor tetap dari backend (src/app/api/v1/kerja/kpi/route.ts) -- fungsi ini
 * cuma memetakan huruf grade ke warna badge, tidak menghitung ulang skornya.
 */
export function kpiGradeColor(grade: string | null | undefined): string {
  switch (grade) {
    case 'A':
      return '#3FBF8F';
    case 'B':
      return '#4E9BFF';
    case 'C':
      return '#D8A33C';
    case 'D':
      return '#EF4444';
    default:
      return '#98A2B3';
  }
}

export interface DueDateBadge {
  label: string;
  tone: 'overdue' | 'today' | 'soon' | 'normal';
  color: string;
}

/**
 * Hitung badge "jatuh tempo" tugas Kanban dari dueDate (ISO string atau null).
 * Dipisah dari komponen supaya batas hari (overdue/hari ini/besok) bisa
 * ditest tanpa mock Date global di komponen React.
 */
export function formatDueDateBadge(
  dueDate: string | null | undefined,
  now: Date = new Date()
): DueDateBadge | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(due) - startOfDay(now)) / 86400000);

  if (dayDiff < 0) {
    const n = Math.abs(dayDiff);
    return { label: `Terlambat ${n} hari`, tone: 'overdue', color: '#EF4444' };
  }
  if (dayDiff === 0) {
    return { label: 'Jatuh tempo hari ini', tone: 'today', color: '#D8A33C' };
  }
  if (dayDiff <= 3) {
    return { label: `${dayDiff} hari lagi`, tone: 'soon', color: '#D8A33C' };
  }
  return { label: `${dayDiff} hari lagi`, tone: 'normal', color: '#98A2B3' };
}

export interface SopQuizQuestion {
  pertanyaan: string;
  pilihan: string[];
  jawabanBenar: string;
}

export interface SopQuizScore {
  correct: number;
  total: number;
  allAnswered: boolean;
  passed: boolean;
}

/**
 * Skor kuis pemahaman SOP hasil AI (kerja/sop endpoint mengembalikan 3 soal
 * pilihan ganda + jawabanBenar). Jawaban user murni client-side (belum ada
 * endpoint untuk simpan hasil kuis karyawan) -- skor dihitung di sini.
 * "Lulus" dipatok >= 2 dari 3 benar (>=67%), supaya tidak butuh 100% sempurna
 * tapi tetap wajib paham mayoritas SOP.
 */
export function scoreSopQuiz(
  quiz: SopQuizQuestion[] | null | undefined,
  answers: (string | null)[]
): SopQuizScore {
  const total = quiz?.length ?? 0;
  if (total === 0) {
    return { correct: 0, total: 0, allAnswered: false, passed: false };
  }
  let correct = 0;
  let answeredCount = 0;
  for (let i = 0; i < total; i++) {
    const answer = answers[i];
    if (answer) answeredCount++;
    // Bandingkan huruf pilihan (mis. "A", "B") -- backend mengirim jawabanBenar
    // sebagai huruf tunggal, dan pilihan diformat "A. teks..." di sisi AI --
    // ambil karakter pertama jawaban user supaya tetap cocok walau user
    // menyimpan seluruh string pilihan, bukan cuma hurufnya.
    const normalizedAnswer = answer ? answer.trim().charAt(0).toUpperCase() : '';
    const normalizedCorrect = quiz![i].jawabanBenar.trim().charAt(0).toUpperCase();
    if (normalizedAnswer && normalizedAnswer === normalizedCorrect) correct++;
  }
  const allAnswered = answeredCount === total;
  // Bandingkan sebagai pecahan (correct/total >= 2/3), BUKAN correct/total >= 0.67 --
  // 2/3 = 0.6666... yang secara floating-point < 0.67, jadi ambang desimal salah
  // menolak kasus "2 dari 3 benar" yang justru harusnya lulus. correct*3 >= total*2
  // menghindari pembagian/float sama sekali.
  const passed = allAnswered && correct * 3 >= total * 2;
  return { correct, total, allAnswered, passed };
}

/** Validasi ringan draf tugas baru sebelum POST -- cermin validasi backend (title wajib diisi). */
export function isValidTaskDraft(title: string): boolean {
  return title.trim().length > 0;
}

/** Validasi ringan draf presensi baru sebelum POST -- cermin validasi backend (nama wajib diisi). */
export function isValidAttendanceDraft(employeeName: string): boolean {
  return employeeName.trim().length > 0;
}

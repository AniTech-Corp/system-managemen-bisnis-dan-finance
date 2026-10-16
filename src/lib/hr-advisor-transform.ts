/**
 * Logic murni (bukan komponen React, tidak sentuh Prisma/DB) yang dipakai
 * HRAdvisorPanel.tsx -- tab "Rekomendasi Promosi" dan "Rekomendasi Disiplin".
 * (Tab "Slip Gaji" TIDAK dipakai file ini -- tetap kalkulator lokal murni
 * seperti sebelumnya, sengaja tidak disentuh.)
 *
 * Sumber data ASLI-nya endpoint yang SUDAH ADA:
 *   - GET /api/v1/kerja/tasks       -> allTasks[] { assigneeName, status }
 *   - GET /api/v1/kerja/attendance  -> records[] { employeeName, status }
 * Fetch-nya dilakukan di komponen (perlu cookie/credentials), file ini cuma
 * mengolah hasilnya (filter per nama karyawan + hitung rate) supaya bisa
 * ditest tanpa render React -- project belum punya @testing-library/react,
 * pola sama seperti hpp-calculator.ts / kerja-workspace-ui-helpers.ts
 * (lihat komentar di kerja-workspace-ui-helpers.ts).
 *
 * JUJUR soal batas data (baca sebelum ubah threshold apapun di bawah):
 *   - GET /kerja/attendance cuma balikin 30 presensi TERAKHIR SE-WORKSPACE
 *     (bukan per-karyawan, bukan histori lengkap) -- lihat
 *     src/app/api/v1/kerja/attendance/route.ts `take: 30`. Jadi punctuality
 *     rate & lateCount di sini adalah dari jendela itu, BUKAN histori penuh
 *     karyawan ybs. Wajib ditampilkan apa adanya di UI (bukan dislap jadi
 *     angka final), lihat pemakaian `windowSize` di komponen.
 *   - Tidak ada model "skor kinerja 3 tahun" ataupun "log pelanggaran/
 *     disiplin" di prisma/schema.prisma pada saat file ini ditulis --
 *     jadi 2 hal itu TETAP fallback manual yang jujur, bukan dipaksa
 *     "data asli" yang sebenarnya belum ada di sistem.
 */

export type WorkTaskLite = { assigneeName: string; status: string };
export type AttendanceRecordLite = { employeeName: string; status: string };

function sameEmployee(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface TaskCompletionStats {
  totalAssigned: number;
  doneCount: number;
  /** null = belum ada tugas tercatat di sistem untuk nama ini. */
  completionRate: number | null;
}

/** Hitung rate penyelesaian tugas milik satu karyawan dari daftar tugas workspace. */
export function computeTaskCompletionStats(tasks: WorkTaskLite[], employeeName: string): TaskCompletionStats {
  const name = employeeName.trim();
  if (!name) return { totalAssigned: 0, doneCount: 0, completionRate: null };
  const mine = tasks.filter((t) => sameEmployee(t.assigneeName, name));
  const doneCount = mine.filter((t) => t.status === 'DONE').length;
  return {
    totalAssigned: mine.length,
    doneCount,
    completionRate: mine.length > 0 ? Math.round((doneCount / mine.length) * 100) : null,
  };
}

export interface AttendanceStats {
  totalRecords: number;
  onTimeCount: number;
  lateCount: number;
  /** null = belum ada presensi tercatat (dalam jendela 30 terakhir) untuk nama ini. */
  punctualityRate: number | null;
}

/** Hitung rate ketepatan waktu + jumlah keterlambatan satu karyawan dari daftar presensi workspace. */
export function computeAttendanceStats(records: AttendanceRecordLite[], employeeName: string): AttendanceStats {
  const name = employeeName.trim();
  if (!name) return { totalRecords: 0, onTimeCount: 0, lateCount: 0, punctualityRate: null };
  const mine = records.filter((r) => sameEmployee(r.employeeName, name));
  const onTimeCount = mine.filter((r) => r.status === 'HADIR_TEPAT_WAKTU').length;
  const lateCount = mine.filter((r) => r.status === 'TERLAMBAT').length;
  return {
    totalRecords: mine.length,
    onTimeCount,
    lateCount,
    punctualityRate: mine.length > 0 ? Math.round((onTimeCount / mine.length) * 100) : null,
  };
}

export type PromotionScoreSource = 'real' | 'manual' | 'none';

export interface PromotionScoreResult {
  avgScore: number;
  source: PromotionScoreSource;
}

/**
 * Gabung rate tugas + presensi jadi 1 skor 0-100 buat rekomendasi promosi.
 * Prioritas: data ASLI (tugas dan/atau presensi) kalau minimal satu ada;
 * kalau dua-duanya kosong, baru pakai skor manual (fallback jujur -- bukan
 * dipaksa 0 yang seolah-olah menjatuhkan karyawan yang justru belum punya
 * data tercatat di sistem).
 */
export function combinePromotionScore(
  taskStats: TaskCompletionStats | null,
  attendanceStats: AttendanceStats | null,
  manualScore: number | null
): PromotionScoreResult {
  const rates: number[] = [];
  if (taskStats && taskStats.completionRate !== null) rates.push(taskStats.completionRate);
  if (attendanceStats && attendanceStats.punctualityRate !== null) rates.push(attendanceStats.punctualityRate);
  if (rates.length > 0) {
    const avg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
    return { avgScore: avg, source: 'real' };
  }
  if (manualScore !== null && Number.isFinite(manualScore)) {
    return { avgScore: Math.round(Math.min(Math.max(manualScore, 0), 100)), source: 'manual' };
  }
  return { avgScore: 0, source: 'none' };
}

export interface PromotionTier {
  tier: string;
  tierColor: string;
  note: string;
}

/**
 * Threshold PERSIS sama dengan versi lama HRAdvisorPanel (avgScore>=85 &&
 * tenure>=2 / avgScore>=70 / sisanya) -- yang berubah cuma SUMBER avgScore
 * (dulu rata-rata 3 angka yang diketik manual "skor tahun ke-1/2/3" yang
 * datanya tidak pernah ada di sistem, sekarang dari combinePromotionScore
 * di atas, atau fallback manual yang jujur).
 */
export function buildPromotionTier(avgScore: number, tenureYears: number, source: PromotionScoreSource): PromotionTier {
  const sourceNote =
    source === 'real'
      ? 'berdasarkan data tugas & presensi yang tercatat di sistem'
      : source === 'manual'
      ? 'berdasarkan skor manual yang diinput -- belum ada data tugas/presensi tercatat di sistem untuk nama ini'
      : 'TANPA data (belum ada data sistem maupun input manual)';

  if (avgScore >= 85 && tenureYears >= 2) {
    return {
      tier: 'Sangat layak dipertimbangkan',
      tierColor: '#3FBF8F',
      note: `Skor kinerja ${avgScore}/100 (${sourceNote}) konsisten tinggi dan masa kerja (${tenureYears} tahun) sudah memenuhi ambang wajar untuk kenaikan jabatan. Kandidat kuat untuk dibahas di sesi evaluasi promosi berikutnya.`,
    };
  }
  if (avgScore >= 70) {
    return {
      tier: 'Layak dipertimbangkan, dengan catatan',
      tierColor: '#D8A33C',
      note: `Skor kinerja ${avgScore}/100 (${sourceNote}) cukup baik, tapi ${tenureYears < 2 ? 'masa kerja masih di bawah 2 tahun -- ' : ''}pastikan ada evaluasi kualitatif tambahan (kepemimpinan, kesiapan tanggung jawab baru) sebelum diputuskan.`,
    };
  }
  return {
    tier: 'Belum waktunya, perlu peningkatan dulu',
    tierColor: '#EF4444',
    note: `Skor kinerja ${avgScore}/100 (${sourceNote}) masih di bawah standar yang wajar untuk promosi. Disarankan diskusi rencana pengembangan (coaching/target perbaikan) sebelum dipertimbangkan ulang.`,
  };
}

/**
 * Kategori pelanggaran yang PUNYA sumber data otomatis dari presensi.
 * Saat ini cuma "Keterlambatan berulang" (dari AttendanceStatus.TERLAMBAT).
 * "Ketidakhadiran tanpa keterangan" SENGAJA tidak dimasukkan -- di
 * AttendanceStatus cuma ada IZIN/CUTI (keduanya "dengan keterangan", makna
 * kebalikan dari "tanpa keterangan"), jadi tidak ada status yang benar-benar
 * cocok. Kategori lain (SOP, perilaku, lainnya) memang belum ada model
 * pencatatan pelanggaran di schema.prisma sama sekali.
 */
export function categoryHasAutoData(category: string): boolean {
  return category === 'Keterlambatan berulang';
}

export interface DisciplineTier {
  tier: string;
  tierColor: string;
  steps: string[];
}

/**
 * Threshold PERSIS sama dengan versi lama HRAdvisorPanel (prior===0 / <=2 /
 * lainnya). `autoSourceNote` opsional -- diisi kalau priorIncidents diambil
 * (atau dikonfirmasi) dari data presensi asli, supaya draf surat menyebut
 * sumber datanya secara jujur, bukan seolah manual belaka.
 */
export function buildDisciplineTier(priorIncidents: number, autoSourceNote: string | null): DisciplineTier {
  const prior = Math.max(0, Math.round(priorIncidents));
  const sourceSuffix = autoSourceNote ? ` (${autoSourceNote})` : '';

  if (prior === 0) {
    return {
      tier: 'Teguran lisan',
      tierColor: '#4E9BFF',
      steps: [
        'Sampaikan teguran lisan secara privat, jelaskan dampak kejadian ke tim/operasional.',
        'Catat ringkasan kejadian secara tertulis untuk arsip internal (tanggal, kategori, deskripsi singkat).',
        'Tidak perlu eskalasi formal untuk kejadian pertama, kecuali kategori pelanggarannya tergolong berat.',
      ],
    };
  }
  if (prior <= 2) {
    return {
      tier: 'Peringatan tertulis (SP ke-1)',
      tierColor: '#D8A33C',
      steps: [
        `Terbitkan surat peringatan tertulis resmi, sebutkan kejadian ini dan riwayat ${prior} kejadian serupa sebelumnya${sourceSuffix}.`,
        'Beri kesempatan karyawan menjelaskan versi mereka sebelum surat difinalisasi.',
        'Sepakati rencana perbaikan konkret dengan tenggat waktu yang jelas.',
      ],
    };
  }
  return {
    tier: 'Peringatan keras / eskalasi ke HR-manajemen senior',
    tierColor: '#EF4444',
    steps: [
      `Pola berulang (${prior + 1} kejadian tercatat${sourceSuffix}) -- eskalasikan ke HR/manajemen senior sebelum mengambil tindakan lanjutan.`,
      'Dokumentasikan seluruh riwayat kejadian secara kronologis sebagai dasar keputusan.',
      'Pertimbangkan opsi lanjutan (SP ke-2/3, mutasi, atau proses lain) sesuai jenjang yang berlaku di perusahaan.',
    ],
  };
}

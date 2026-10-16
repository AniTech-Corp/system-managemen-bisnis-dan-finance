import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { employeeName, punctualityScore = 25, taskCompletionScore = 28, qualityScore = 24, teamworkScore = 18, notes } = await req.json();

      if (!employeeName || !employeeName.trim()) {
        return NextResponse.json({ message: 'Nama staf wajib diisi.' }, { status: 400 });
      }

      const pScore = Math.min(Math.max(Number(punctualityScore) || 0, 0), 25);
      const tScore = Math.min(Math.max(Number(taskCompletionScore) || 0, 0), 30);
      const qScore = Math.min(Math.max(Number(qualityScore) || 0, 0), 25);
      const wScore = Math.min(Math.max(Number(teamworkScore) || 0, 0), 20);

      const totalScore = pScore + tScore + qScore + wScore;

      let grade = 'A';
      let gradeLabel = 'SANGAT BAIK / TOP PERFORMER';
      let recommendation = 'Karyawan menunjukkan dedikasi tinggi, konsistensi kerja luar biasa, dan layak dipertimbangkan untuk bonus performa atau jenjang promosi.';

      if (totalScore < 60) {
        grade = 'D';
        gradeLabel = 'PERLU EVALUASI & COACHING';
        recommendation = 'Perlu pendampingan intensif (coaching) dari team lead untuk meningkatkan ketepatan waktu dan pemahaman tugas kerja harian.';
      } else if (totalScore < 75) {
        grade = 'C';
        gradeLabel = 'CUKUP / PERLU DITINGKATKAN';
        recommendation = 'Kinerja standar terpenuhi, namun perlu dorongan ekstra dalam inisiatif kerja dan ketelitian hasil tugas.';
      } else if (totalScore < 90) {
        grade = 'B';
        gradeLabel = 'BAIK & KONSISTEN';
        recommendation = 'Karyawan konsisten menyelesaikan tanggung jawab dengan baik dan dapat diandalkan dalam tim.';
      }

      return NextResponse.json({
        success: true,
        kpiEvaluation: {
          employeeName: employeeName.trim(),
          evaluatedBy: auth.user.fullName,
          totalScore,
          grade,
          gradeLabel,
          recommendation,
          notes: notes || 'Evaluasi kinerja rutin operasional tim.',
          breakdown: [
            { indicator: 'Disiplin Kehadiran & Jam Kerja', score: pScore, max: 25 },
            { indicator: 'Ketepatan Waktu Penyelesaian Tugas', score: tScore, max: 30 },
            { indicator: 'Kualitas & Ketelitian Hasil Kerja', score: qScore, max: 25 },
            { indicator: 'Inisiatif & Kerjasama Antar Tim', score: wScore, max: 20 },
          ],
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat KPI kerja.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

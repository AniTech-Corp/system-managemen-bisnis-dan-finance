import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';
import { withAtomicCredit } from '@/lib/credit';
import { executeAIRequest } from '@/lib/ai-gateway';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { sopTitle, rawInstructions } = await req.json();

      if (!sopTitle || !rawInstructions) {
        return NextResponse.json({ message: 'Judul SOP dan instruksi kerja wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      const result = await withAtomicCredit(
        {
          workspaceId,
          featureKey: 'kerja.sop_generator',
          userId: auth.user.id,
          customCost: 20,
          metadata: { sopTitle },
        },
        async () => {
          const prompt = `Ubah instruksi kerja berikut menjadi Dokumen SOP Profesional dan Kuis Pemahaman 3 Soal untuk Karyawan Baru:
Judul SOP: "${sopTitle}".
Instruksi Mentah / Suara: "${rawInstructions}".

Format output WAJIB JSON persis:
{
  "sopTitle": "${sopTitle}",
  "tujuan": "...",
  "penanggungJawab": "Staf Operasional / Tim Terkait",
  "langkahKerja": [
    { "step": 1, "action": "...", "standard": "..." },
    { "step": 2, "action": "...", "standard": "..." },
    { "step": 3, "action": "...", "standard": "..." },
    { "step": 4, "action": "...", "standard": "..." }
  ],
  "kuisPemahaman": [
    {
      "pertanyaan": "...",
      "pilihan": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "jawabanBenar": "A"
    },
    {
      "pertanyaan": "...",
      "pilihan": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "jawabanBenar": "B"
    },
    {
      "pertanyaan": "...",
      "pilihan": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "jawabanBenar": "C"
    }
  ]
}`;

          const aiRes = await executeAIRequest({
            workspaceId,
            prompt,
            jsonMode: true,
            temperature: 0.5,
          });

          const sopData = (aiRes.json && aiRes.json.langkahKerja)
            ? aiRes.json
            : {
                sopTitle: `SOP Resmi: ${sopTitle}`,
                tujuan: `Memastikan seluruh proses operasional ${sopTitle} berjalan standar, aman, dan konsisten tanpa deviasi.`,
                penanggungJawab: 'Staf Operasional & Supervisor Toko',
                langkahKerja: [
                  { step: 1, action: 'Persiapan awal & pengecekan area kerja', standard: 'Area kerja bersih dan peralatan siap pakai 15 menit sebelum operasional.' },
                  { step: 2, action: 'Eksekusi tahapan kerja sesuai panduan', standard: 'Melaksanakan prosedur dengan cermat sesuai rincian instruksi kerja.' },
                  { step: 3, action: 'Verifikasi kualitas output dan pencatatan log', standard: 'Seluruh checklist terverifikasi dan tercatat pada sistem KLIR.' },
                  { step: 4, action: 'Pembersihan & serah terima shift', standard: 'Area kerja ditinggalkan dalam kondisi steril dan siap pakai untuk shift berikutnya.' },
                ],
                kuisPemahaman: [
                  {
                    pertanyaan: `Kapan staf wajib memulai persiapan awal untuk ${sopTitle}?`,
                    pilihan: ['A. Tepat saat jam buka', 'B. 15 menit sebelum operasional dimulai', 'C. Setelah pelanggan datang', 'D. Kapan saja bebas'],
                    jawabanBenar: 'B',
                  },
                  {
                    pertanyaan: 'Apa yang harus dilakukan setelah menyelesaikan tahapan kerja?',
                    pilihan: ['A. Langsung pulang', 'B. Membiarkan peralatan kotor', 'C. Verifikasi checklist dan catat log', 'D. Menunggu perintah baru'],
                    jawabanBenar: 'C',
                  },
                  {
                    pertanyaan: 'Bagaimana standar penyerahan area kerja ke shift berikutnya?',
                    pilihan: ['A. Steril, bersih, dan siap pakai', 'B. Cukup dimatikan lampunya', 'C. Diserahkan apa adanya', 'D. Ditutup tanpa lapor'],
                    jawabanBenar: 'A',
                  },
                ],
              };

          return {
            sop: sopData,
            generatedBy: auth.user.fullName,
            provider: aiRes.provider,
          };
        }
      );

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('SOP gagal diproses.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

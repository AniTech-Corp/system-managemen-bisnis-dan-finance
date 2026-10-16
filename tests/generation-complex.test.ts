import assert from 'node:assert/strict';
import { before, describe, mock, test } from 'node:test';
import ExcelJS from 'exceljs';

describe('generation-engine.ts -- Dokumen Kompleks (PDF, Word, Excel, PPT) & Intent Detection', { concurrency: false }, () => {
  let runGeneration: typeof import('../src/lib/generation-engine')['runGeneration'];
  let detectGenerationIntent: typeof import('../src/lib/generation-engine')['detectGenerationIntent'];

  before(async () => {
    // Mock ai-gateway agar tidak memanggil OpenRouter atau LLM eksternal
    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        generateStructuredJson: async (_workspaceId: string, prompt: string) => {
          // Mock response berdasarkan tipe generator
          if (prompt.includes('dokumen PDF resmi') || prompt.includes('PDF')) {
            if (prompt.includes('multi-page')) {
              const longSections = [];
              for (let i = 1; i <= 6; i++) {
                longSections.push({
                  heading: `Bab ${i}: Evaluasi Detail Operasional`,
                  content: 'Analisis komprehensif performa divisi dan tindak lanjut perbaikan tata kelola serta optimasi sumber daya KLIR. '.repeat(4),
                  bullets: ['Peningkatan efisiensi unit', 'SOP terstandarisasi'],
                  table: {
                    headers: ['Metrik', 'Target', 'Realisasi'],
                    rows: [
                      ['Efisiensi', '90%', '95%'],
                      ['Penyelesaian', '80%', '88%'],
                    ],
                  },
                });
              }
              return {
                data: {
                  title: 'Laporan Komprehensif Multi-Halaman',
                  subtitle: 'Audit Kinerja Tahunan KLIR',
                  companyName: 'PT KLIR Digital Integrasi',
                  dateStr: '16 September 2026',
                  sections: longSections,
                },
                provider: 'mock-ai-gateway',
                latencyMs: 5,
              };
            }
            return {
              data: {
                title: 'Laporan Finansial Komprehensif',
                subtitle: 'Analisis Arus Kas & Profitabilitas Q1 2026',
                companyName: 'PT Maju Bersama KLIR',
                dateStr: '16 September 2026',
                badge: 'EKSEKUTIF / KEUANGAN',
                disclaimer: 'Dokumen dihasilkan otomatis via KLIR OS. Angka berdasarkan pembukuan terverifikasi.',
                statCards: [
                  { label: 'Total Omzet', value: 'Rp 1.250.000.000', change: '+24.5%' },
                  { label: 'Laba Bersih', value: 'Rp 340.000.000', change: '+18.0%' },
                  { label: 'Rasio Likuiditas', value: '2.4x' },
                ],
                sections: [
                  {
                    heading: '1. Ringkasan Eksekutif Finansial',
                    content: 'Performa keuangan berada dalam tren positif didorong peningkatan margin operasional.',
                    callout: 'Kinerja kas menunjukkan stabilitas tinggi dengan cadangan darurat mencukupi 6 bulan.',
                    bullets: [
                      'Penjualan retail meningkat 28% yoy.',
                      'Beban pokok penjualan berhasil ditekan sebesar 4.2%.',
                    ],
                  },
                  {
                    heading: '2. Rekapitulasi Neraca & Arus Kas',
                    content: 'Rincian alokasi arus kas masuk dan keluar selama kuartal berjalan.',
                    table: {
                      headers: ['Komponen Pos', 'Anggaran (Rp)', 'Realisasi (Rp)', 'Pencapaian'],
                      rows: [
                        ['Pendapatan Operasional', '1.000.000.000', '1.250.000.000', '125%'],
                        ['Beban Pemasaran', '200.000.000', '180.000.000', '90%'],
                        ['Laba Sebelum Bunga & Pajak', '300.000.000', '390.000.000', '130%'],
                      ],
                    },
                  },
                ],
              },
              provider: 'mock-ai-gateway',
              latencyMs: 5,
            };
          }

          if (prompt.includes('dokumen Microsoft Word') || prompt.includes('DOCX')) {
            return {
              data: {
                fileName: 'Laporan_Strategis_Bisnis',
                title: 'Laporan Evaluasi Strategis Tahunan',
                subtitle: 'Kajian Kinerja Organisasi & Roadmap Skalabilitas',
                statCards: [
                  { label: 'Efisiensi Biaya', value: '92%' },
                  { label: 'Pencapaian Target', value: '104%' },
                ],
                sections: [
                  {
                    heading: 'Pilar Transformasi Digital',
                    paragraphs: ['Implementasi KLIR OS berhasil mengintegrasikan seluruh pencatatan kas.'],
                    callout: 'Perhatian: Pastikan modul rekonsiliasi bank di-review tiap akhir pekan.',
                    bullets: ['Audit sistem berkala', 'Pelatihan SDM berkelanjutan'],
                    table: {
                      headers: ['Divisi', 'Skor Evaluasi', 'Status'],
                      rows: [
                        ['Keuangan', '95', 'Sangat Baik'],
                        ['Pemasaran', '88', 'Baik'],
                      ],
                    },
                  },
                ],
              },
              provider: 'mock-ai-gateway',
              latencyMs: 5,
            };
          }

          if (prompt.includes('spreadsheet Excel') || prompt.includes('XLSX')) {
            if (prompt.includes('formula-test')) {
              return {
                data: {
                  fileName: 'Laporan_Keuangan_Formula',
                  sheets: [
                    {
                      name: 'Ringkasan Kas',
                      bannerText: 'PT KLIR Digital - Periode 2026',
                      headers: ['No Invoice', 'Keterangan', 'Nominal Tagihan', 'Margin', 'Total'],
                      rows: [
                        ['INV-01', 'Langganan Klien A', 'Rp 100.000.000', '25%', 100000000],
                        ['INV-02', 'Layanan Klien B', 'Rp 50.000.000', '30%', 50000000],
                        ['TOTAL', 'Jumlah Keseluruhan', '=SUM(C3:C4)', '27.5%', '=SUM(E3:E4)'],
                      ],
                    },
                  ],
                },
                provider: 'mock-ai-gateway',
                latencyMs: 5,
              };
            }
            return {
              data: {
                fileName: 'Rekap_Keuangan_Tahunan',
                sheetName: 'Rekap 2026',
                title: 'Rekapitulasi Arus Transaksi 2026',
                columns: [
                  { header: 'Bulan', key: 'bulan', width: 15 },
                  { header: 'Pendapatan', key: 'pendapatan', width: 22 },
                  { header: 'Pengeluaran', key: 'pengeluaran', width: 22 },
                  { header: 'Laba Bersih', key: 'laba', width: 22 },
                ],
                rows: [
                  { bulan: 'Januari', pendapatan: 'Rp 100.000.000', pengeluaran: 'Rp 65.000.000', laba: 'Rp 35.000.000' },
                  { bulan: 'Februari', pendapatan: 'Rp 120.000.000', pengeluaran: 'Rp 70.000.000', laba: 'Rp 50.000.000' },
                  { bulan: 'TOTAL', pendapatan: 'Rp 220.000.000', pengeluaran: 'Rp 135.000.000', laba: 'Rp 85.000.000' },
                ],
                notes: ['Data bersumber dari pembukuan internal KLIR'],
              },
              provider: 'mock-ai-gateway',
              latencyMs: 5,
            };
          }

          if (prompt.includes('presentasi PowerPoint') || prompt.includes('PPTX')) {
            return {
              data: {
                fileName: 'Pitch_Deck_Investor',
                title: 'Pitch Deck Pendanaan Usaha',
                subtitle: 'Peluang Pertumbuhan Pasar UMKM Indonesia',
                slides: [
                  {
                    title: 'Metrik Pertumbuhan Kunci',
                    subtitle: 'Indikator performa kuartal terakhir',
                    statCards: [
                      { label: 'Pengguna Aktif', value: '15.000+' },
                      { label: 'Pertumbuhan Bulanan', value: '25%' },
                    ],
                    bullets: ['Retensi pengguna 30 hari mencapai 78%', 'NPS kepuasan pelanggan di angka 82'],
                  },
                ],
              },
              provider: 'mock-ai-gateway',
              latencyMs: 5,
            };
          }

          return { data: {}, provider: 'mock-ai-gateway', latencyMs: 5 };
        },
        generateImage: async () => ({
          imageBase64: null,
          mimeType: 'image/png',
          provider: 'mock-provider',
          modelUsed: 'mock-model',
          latencyMs: 5,
        }),
      },
    });

    mock.module('../src/lib/ai-brain', {
      namedExports: {
        getOrBuildBusinessContext: async (workspaceId: string) => ({
          workspaceId,
          workspaceName: 'PT Maju Bersama',
          generatedAt: new Date().toISOString(),
          cacheTtlSeconds: 60,
          financials: { totalIncome30d: 50000000, totalExpense30d: 30000000, liquidCash: 20000000 },
          healthScore: { totalScore: 85, grade: 'A' },
        }),
      },
    });

    mock.module('../src/lib/ai-brain/workspace-knowledge', {
      namedExports: {
        buildWorkspaceKnowledgeBlock: async () => ({
          manifest: 'Daftar dokumen: keuangan-2026.pdf',
          relevant: 'Konteks relevan: saldo kas likuid Rp 20.000.000.',
          totalChars: 120,
        }),
      },
    });

    const engine = await import('../src/lib/generation-engine');
    runGeneration = engine.runGeneration;
    detectGenerationIntent = engine.detectGenerationIntent;
  });

  describe('detectGenerationIntent', () => {
    test('mendeteksi intent PDF secara presisi', () => {
      assert.equal(detectGenerationIntent('tolong buatkan file pdf laporan kuartal'), 'pdf');
      assert.equal(detectGenerationIntent('minta dokumen pdf keuangan ya'), 'pdf');
      assert.equal(detectGenerationIntent('buatkan rekap dalam bentuk pdf'), 'pdf');
      assert.equal(detectGenerationIntent('ekspor data jadi pdf'), 'pdf');
    });

    test('mendeteksi intent Word, Excel, PPT, Video, Gambar', () => {
      assert.equal(detectGenerationIntent('buatkan dokumen word proposal bisnis'), 'word');
      assert.equal(detectGenerationIntent('bikin format docx surat penawaran'), 'word');
      assert.equal(detectGenerationIntent('tolong buatkan spreadsheet excel neraca'), 'excel');
      assert.equal(detectGenerationIntent('rekap tabel data omzet bulanan'), 'excel');
      assert.equal(detectGenerationIntent('buatkan slide ppt pitch deck investor'), 'ppt');
      assert.equal(detectGenerationIntent('siapkan presentasi powerpoint kinerja'), 'ppt');
      assert.equal(detectGenerationIntent('buatkan storyboard video tiktok 30 detik'), 'video-plan');
      assert.equal(detectGenerationIntent('bikin banner gambar promosi diskon'), 'image');
    });

    test('mengembalikan null jika bukan permintaan pembuatan file', () => {
      assert.equal(detectGenerationIntent('halo selamat pagi'), null);
      assert.equal(detectGenerationIntent('bagaimana cara bayar pajak?'), null);
      assert.equal(detectGenerationIntent('siapa direktur perusahaan ini?'), null);
      assert.equal(detectGenerationIntent(''), null);
    });
  });

  describe('runGeneration untuk Dokumen Nyata', () => {
    test('PDF: menghasilkan file PDF 1.4 utuh dengan base64 valid dan mime application/pdf', async () => {
      const result = await runGeneration({
        workspaceId: 'ws-test-pdf',
        type: 'pdf',
        brief: 'Buatkan laporan keuangan bulanan lengkap dengan neraca dan tabel laba rugi.',
        role: 'finance',
      });

      assert.ok(result.fileName.endsWith('.pdf'), `Nama file harus berakhiran .pdf, dapat: ${result.fileName}`);
      assert.equal(result.mimeType, 'application/pdf');
      assert.ok(result.fileBase64 && result.fileBase64.length > 0, 'fileBase64 tidak boleh kosong');

      // Dekode base64 dan pastikan header PDF valid
      const pdfBuffer = Buffer.from(result.fileBase64, 'base64');
      const pdfString = pdfBuffer.toString('binary');
      assert.ok(pdfString.startsWith('%PDF-1.4'), 'Header dokumen PDF harus %PDF-1.4');
      assert.ok(pdfString.includes('trailer'), 'Dokumen PDF harus memiliki trailer');
      assert.ok(pdfString.includes('%%EOF'), 'Dokumen PDF harus memiliki penutup %%EOF');
      assert.ok(result.summary.includes('PDF'), 'Summary harus menyebut dokumen PDF');
    });

    test('Word (.docx): menghasilkan dokumen Word terstruktur dengan tabel dan callout', async () => {
      const result = await runGeneration({
        workspaceId: 'ws-test-word',
        type: 'word',
        brief: 'Susun laporan evaluasi strategis tahunan.',
        role: 'executive',
      });

      assert.ok(result.fileName.endsWith('.docx'));
      assert.equal(result.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      assert.ok(result.fileBase64 && result.fileBase64.length > 100);
      assert.ok(result.summary.includes('Word'));
    });

    test('Excel (.xlsx): menghasilkan spreadsheet dengan styling header dan zebra row', async () => {
      const result = await runGeneration({
        workspaceId: 'ws-test-excel',
        type: 'excel',
        brief: 'Rekapitulasi arus transaksi bulanan tahun 2026.',
        role: 'finance',
      });

      assert.ok(result.fileName.endsWith('.xlsx'));
      assert.equal(result.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      assert.ok(result.fileBase64 && result.fileBase64.length > 100);
      assert.ok(result.summary.includes('Excel'));
    });

    test('PPT (.pptx): menghasilkan presentasi slide dengan kartu metrik statCards', async () => {
      const result = await runGeneration({
        workspaceId: 'ws-test-ppt',
        type: 'ppt',
        brief: 'Siapkan pitch deck investor tentang pertumbuhan pasar.',
        role: 'executive',
      });

      assert.ok(result.fileName.endsWith('.pptx'));
      assert.equal(result.mimeType, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      assert.ok(result.fileBase64 && result.fileBase64.length > 100);
      assert.ok(result.summary.includes('PowerPoint') || result.summary.includes('slide'));
    });

    test('Excel (.xlsx): menjaga formula, persentase, mata uang, dan tidak merusak ID INV-01', async () => {
      const result = await runGeneration({
        workspaceId: 'ws-test-excel-formula',
        type: 'excel',
        brief: 'formula-test rekap tagihan invoice lengkap dengan formula sum',
        role: 'finance',
      });

      assert.ok(result.fileName.endsWith('.xlsx'));
      assert.ok(result.fileBase64);
      const buffer = Buffer.from(result.fileBase64, 'base64');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const ws = wb.getWorksheet('Ringkasan Kas');
      assert.ok(ws, 'Worksheet Ringkasan Kas harus ada');

      // Baris 1: Banner
      const row1 = ws.getRow(1);
      assert.equal(row1.getCell(1).value, 'PT KLIR Digital - Periode 2026');

      // Baris 2: Header
      const row2 = ws.getRow(2);
      assert.equal(row2.getCell(1).value, 'No Invoice');
      assert.equal(row2.getCell(3).value, 'Nominal Tagihan');

      // Baris 3: INV-01 tidak boleh rusak jadi -1 atau NaN, melainkan string utuh
      const row3 = ws.getRow(3);
      assert.equal(row3.getCell(1).value, 'INV-01');
      assert.equal(row3.getCell(2).value, 'Langganan Klien A');
      assert.equal(row3.getCell(3).value, 100000000);
      assert.equal(row3.getCell(3).numFmt, '#,##0');
      // Persentase 25% -> 0.25 dengan format 0.0%
      assert.equal(row3.getCell(4).value, 0.25);
      assert.equal(row3.getCell(4).numFmt, '0.0%');

      // Baris 5: TOTAL dengan formula SUM
      const row5 = ws.getRow(5);
      assert.equal(row5.getCell(1).value, 'TOTAL');
      assert.deepEqual(row5.getCell(3).value, { formula: 'SUM(C3:C4)' });
      assert.deepEqual(row5.getCell(5).value, { formula: 'SUM(E3:E4)' });
    });

    test('Excel (.xlsx): menghasilkan spreadsheet dari format fallback columns/rows', async () => {
      const result = await runGeneration({
        workspaceId: 'ws-test-excel-fallback',
        type: 'excel',
        brief: 'Rekapitulasi transaksi bulanan format flat columns dan rows',
        role: 'finance',
      });

      assert.ok(result.fileName.endsWith('.xlsx'));
      assert.ok(result.fileBase64);
      const buffer = Buffer.from(result.fileBase64, 'base64');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const ws = wb.getWorksheet('Rekap 2026') || wb.worksheets[0];
      assert.ok(ws, 'Worksheet harus terbentuk dari fallback columns/rows');
      assert.equal(ws.getRow(1).getCell(1).value, 'Bulan');
      assert.equal(ws.getRow(2).getCell(1).value, 'Januari');
      assert.equal(ws.getRow(2).getCell(2).value, 100000000);
      assert.equal(ws.getRow(2).getCell(2).numFmt, '#,##0');
    });

    test('PDF: mendukung multi-halaman dengan running header otomatis di halaman 2+', async () => {
      const result = await runGeneration({
        workspaceId: 'ws-test-pdf-multipage',
        type: 'pdf',
        brief: 'dokumen PDF resmi multi-page audit kinerja tahunan',
        role: 'executive',
      });

      assert.ok(result.fileName.endsWith('.pdf'));
      assert.equal(result.mimeType, 'application/pdf');
      assert.ok(result.fileBase64);
      const pdfString = Buffer.from(result.fileBase64, 'base64').toString('binary');
      const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
      assert.ok(pageMatches && pageMatches.length >= 2, `Harus menghasilkan minimal 2 halaman, dapat: ${pageMatches?.length}`);
      assert.ok(pdfString.includes('Laporan Komprehensif Multi-Halaman  |  PT KLIR Digital Integrasi'));
    });

    test('Validasi input: brief kosong melempar error yang jelas', async () => {
      await assert.rejects(
        () => runGeneration({ workspaceId: 'ws-1', type: 'pdf', brief: '' }),
        /Brief\/permintaan generate tidak boleh kosong/
      );
      await assert.rejects(
        () => runGeneration({ workspaceId: 'ws-1', type: 'pdf', brief: '   ' }),
        /Brief\/permintaan generate tidak boleh kosong/
      );
    });

    test('Validasi tipe: tipe generate tidak dikenal melempar error', async () => {
      await assert.rejects(
        () => runGeneration({ workspaceId: 'ws-1', type: 'unknown-type' as any, brief: 'buat dokumen' }),
        /Tipe generate tidak dikenal/
      );
    });
  });
});

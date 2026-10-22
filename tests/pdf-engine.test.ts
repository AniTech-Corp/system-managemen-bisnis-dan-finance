import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generatePdfBuffer, PdfDocumentInput } from '../src/lib/pdf-engine';
import { extractTextFromBuffer } from '../src/lib/document-text-extractor';

describe('pdf-engine.ts -- generatePdfBuffer', () => {
  test('menghasilkan buffer PDF 1.4 yang valid dengan header dan trailer standar', () => {
    const doc: PdfDocumentInput = {
      title: 'Laporan Keuangan Eksekutif',
      subtitle: 'Periode Q1 2026 - PT Digital Maju',
      companyName: 'PT Digital Maju',
      sections: [
        {
          heading: 'Ringkasan Eksekutif',
          content: 'Kinerja keuangan kuartal ini melampaui target dengan margin laba sebesar 28%.',
        },
      ],
    };

    const buffer = generatePdfBuffer(doc);
    assert.ok(Buffer.isBuffer(buffer), 'Output harus berupa Buffer');
    assert.ok(buffer.length > 500, 'Panjang PDF harus minimal 500 bytes');

    const pdfString = buffer.toString('binary');
    assert.ok(pdfString.startsWith('%PDF-1.4'), 'Header harus %PDF-1.4');
    assert.ok(pdfString.includes('trailer'), 'PDF harus memuat trailer');
    assert.ok(pdfString.includes('%%EOF'), 'PDF harus diakhiri %%EOF');
    assert.ok(pdfString.includes('/Type /Catalog'), 'PDF harus memuat Catalog');
    assert.ok(pdfString.includes('/Type /Pages'), 'PDF harus memuat Pages tree');
  });

  test('dokumen lengkap: statCards, sections, table, dan bullets dapat diekstrak teksnya', async () => {
    const doc: PdfDocumentInput = {
      title: 'Laporan Finansial dan Arus Kas',
      subtitle: 'Analisis Komprehensif Semester I 2026',
      companyName: 'PT Finansial Unggul',
      disclaimer: 'Dokumen ini dihasilkan secara otomatis oleh KLIR OS',
      statCards: [
        { label: 'Total Pendapatan', value: 'Rp 450.000.000', change: '+18.5%' },
        { label: 'Laba Bersih', value: 'Rp 112.500.000', change: '+12.0%' },
        { label: 'Kas Likuid', value: 'Rp 85.000.000' },
      ],
      sections: [
        {
          heading: 'Tinjauan Kinerja Operasional',
          content: 'Pertumbuhan pendapatan didorong oleh ekspansi lini produk utama dan efisiensi rantai pasok.',
          bullets: [
            'Peningkatan penjualan retail sebesar 22% dibandingkan kuartal sebelumnya.',
            'Pengurangan biaya operasional logistik sebesar 8.5% berkat optimasi rute.',
            'Tingkat retensi pelanggan korporat mencapai 94%.',
          ],
        },
        {
          heading: 'Tabel Rekapitulasi Arus Kas',
          table: {
            headers: ['Kategori Pos', 'Target Anggaran', 'Realisasi Berjalan', 'Deviasi'],
            rows: [
              ['Pendapatan Usaha', 'Rp 400.000.000', 'Rp 450.000.000', '+12.5%'],
              ['Beban Operasional', 'Rp 280.000.000', 'Rp 260.000.000', '-7.1%'],
              ['Laba Sebelum Pajak', 'Rp 120.000.000', 'Rp 190.000.000', '+58.3%'],
            ],
          },
        },
      ],
    };

    const buffer = generatePdfBuffer(doc);
    assert.ok(buffer.length > 1000, 'Dokumen lengkap harus > 1000 bytes');

    // Ekstraksi teks menggunakan parser PDF asli yang ada di KLIR
    const extractedText = await extractTextFromBuffer('laporan-finansial.pdf', buffer);
    assert.ok(extractedText.length > 100, 'Teks hasil ekstraksi tidak boleh kosong');

    // Verifikasi semua teks kunci berhasil di-render dan terbaca
    assert.ok(extractedText.includes('Laporan Finansial dan Arus Kas'), 'Judul harus ada di teks');
    assert.ok(extractedText.includes('Total Pendapatan'), 'Label statCard harus ada');
    assert.ok(extractedText.includes('Rp 450.000.000'), 'Nilai statCard harus ada');
    assert.ok(extractedText.includes('Tinjauan Kinerja Operasional'), 'Judul section harus ada');
    assert.ok(extractedText.includes('Peningkatan penjualan retail'), 'Bullet point harus ada');
    assert.ok(extractedText.includes('Tabel Rekapitulasi Arus Kas'), 'Judul section tabel harus ada');
    assert.ok(extractedText.includes('Pendapatan Usaha'), 'Baris tabel harus ada');
    assert.ok(extractedText.includes('Beban Operasional'), 'Baris tabel kedua harus ada');
    assert.ok(extractedText.includes('KLIR OS'), 'Footer/disclaimer harus ada');
  });

  test('multi-halaman: dokumen panjang otomatis membuat beberapa halaman dengan header dan footer berjalan', () => {
    const longSections = [];
    for (let i = 1; i <= 8; i++) {
      longSections.push({
        heading: `Bab ${i}: Pembahasan Mendalam Bagian Ke-${i}`,
        content: `Paragraf detail analisis operasional bagian ${i}. Tim telah melakukan serangkaian optimasi proses bisnis, audit kepatuhan internal, dan penyelarasan alur kerja lintas departemen untuk memastikan target efisiensi tercapai secara optimal tanpa mengorbankan kualitas layanan pelanggan.`.repeat(3),
        bullets: [
          `Poin evaluasi ${i}.1 mengenai implementasi SOP terbaru`,
          `Poin evaluasi ${i}.2 perbaikan tata kelola arsip`,
          `Poin evaluasi ${i}.3 integrasi sistem data transaksi`,
        ],
        table: {
          headers: ['Metrik', 'Q1', 'Q2', 'Q3', 'Q4'],
          rows: [
            [`Indikator Kinerja ${i}A`, '85%', '88%', '91%', '94%'],
            [`Indikator Kinerja ${i}B`, 'Rp 10M', 'Rp 12M', 'Rp 15M', 'Rp 18M'],
          ],
        },
      });
    }

    const doc: PdfDocumentInput = {
      title: 'Laporan Akuntabilitas Tahunan',
      subtitle: 'Audit Komprehensif dan Evaluasi Multi-Divisi',
      companyName: 'PT Nusantara Holding',
      sections: longSections,
    };

    const buffer = generatePdfBuffer(doc);
    const pdfString = buffer.toString('binary');

    // Menghitung jumlah objek Page dalam PDF
    const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
    assert.ok(pageMatches && pageMatches.length >= 2, `Harus menghasilkan minimal 2 halaman, dapat: ${pageMatches?.length}`);
  });

  test('edge cases: dokumen minimalis dan data kosong ditangani tanpa error', () => {
    const minimalDoc: PdfDocumentInput = {
      title: 'Dokumen Kosong Minimal',
      sections: [],
    };

    const buffer = generatePdfBuffer(minimalDoc);
    assert.ok(buffer.length > 300, 'Minimal PDF harus berhasil terbentuk');
    assert.ok(buffer.toString('binary').startsWith('%PDF-1.4'));

    const edgeDoc: PdfDocumentInput = {
      title: 'Dokumen Uji Karakter Khusus & Format Kosong',
      subtitle: 'Uji (kurung) dan \\ backslash serta tanda kutip "quotes"',
      statCards: [
        { label: '', value: '' },
      ],
      sections: [
        {
          heading: '',
          content: '',
          bullets: [],
          table: {
            headers: [],
            rows: [],
          },
        },
      ],
    };

    const bufferEdge = generatePdfBuffer(edgeDoc);
    assert.ok(bufferEdge.length > 300);
    assert.ok(bufferEdge.toString('binary').startsWith('%PDF-1.4'));
  });

  test('formatting escaping: karakter kurung buka-tutup dan backslash di-escape dengan benar', () => {
    const doc: PdfDocumentInput = {
      title: 'Testing (Escaped) & [Brackets] \\ Paths',
      sections: [
        {
          heading: 'Special Chars (Section 1.0)',
          content: 'Line with (parentheses) and backslashes C:\\temp\\file.txt without corrupting stream.',
        },
      ],
    };

    const buffer = generatePdfBuffer(doc);
    assert.ok(buffer.toString('binary').includes('Testing \\(Escaped\\)'));
  });
});

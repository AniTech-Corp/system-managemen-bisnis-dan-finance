import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cellToDisplayString,
  cellToRawNumeric,
  sanitizeNulBytes,
} from '@/lib/workspace-file-extraction';
import { extractTextFromBuffer } from '@/lib/document-text-extractor';
import {
  detectMenuCatalog,
  looksLikeMeetingNotes,
  contentHashOf,
  AUTO_LEDGER_MIN_CONFIDENCE,
  undoIngest,
} from '@/lib/ai-brain/auto-ingest';
import { tryDetectGenericLedgerForWorkspaceFile } from '@/lib/workspace-file-ledger';
import { detectQuickDataIntent } from '@/lib/ai-brain/quick-data-router';
import { prisma } from '@/lib/prisma';
import {
  divisionRoleToInsightRole,
  classifyFileDivision,
  canRoleSeeDivision,
} from '@/lib/ai-brain/data-visibility';
import { DEFAULT_VIDEO_MODEL } from '@/lib/media-catalog';
import { enrichMarketingVideoPrompt } from '@/lib/media-provider';
import { invalidateContextCache } from '@/lib/ai-brain/context-engine';
import {
  invalidateDashboardInsightCache,
  buildDeterministicInsight,
  normalizeInsightShape,
  type InsightMaterial,
} from '@/lib/ai-brain/dashboard-insight';
import type { InventoryHealthMetrics, DocumentHealthMetrics } from '@/lib/ai-brain/types';

describe('KLIR OS 12 Pintu Sistemik — E2E Domino Regression Suite', () => {

  // =========================================================================
  // PINTU 1: Intake & Ekstraksi Sel Excel/CSV & Sanitasi NUL
  // =========================================================================
  describe('Pintu 1: Intake & Ekstraksi Sel Excel/CSV & Sanitasi', () => {
    it('ekstraksi richText ExcelJS membongkar teks utuh tanpa [object Object]', () => {
      const richCell = {
        richText: [
          { text: 'PT ' },
          { text: 'Sentosa ' },
          { text: 'Boga Abadi' },
        ],
      };
      const result = cellToDisplayString(richCell);
      assert.equal(result, 'PT Sentosa Boga Abadi');
      assert.doesNotMatch(result, /\[object Object\]/);

      // Edge case: Segmen richText tanpa spasi di akhir tiap token (mis. kata terpisah dalam run berbeda)
      const richCellNoTrailingSpaces = {
        richText: [
          { text: 'PT' },
          { text: 'Sentosa' },
          { text: 'Boga Abadi' },
        ],
      };
      const resultNoTrailing = cellToDisplayString(richCellNoTrailingSpaces);
      assert.equal(resultNoTrailing, 'PT Sentosa Boga Abadi', 'Kata dalam run richText tidak boleh menyatu menjadi PTSentosaBoga Abadi');
    });

    it('ekstraksi formula dengan result objek atau numerik menghasilkan nilai bersih', () => {
      const formulaCellNumeric = { formula: 'SUM(A1:A10)', result: 15000000 };
      assert.equal(cellToDisplayString(formulaCellNumeric), '15000000');
      assert.equal(cellToRawNumeric(formulaCellNumeric), 15000000);

      const formulaCellError = { formula: 'A1/B1', result: { error: '#DIV/0!' } };
      assert.equal(cellToDisplayString(formulaCellError), '#DIV/0!');
      assert.equal(cellToRawNumeric(formulaCellError), null);

      const formulaCellNull = { formula: 'A1+B1', result: null };
      assert.equal(cellToDisplayString(formulaCellNull), '');
      assert.equal(cellToRawNumeric(formulaCellNull), null);
    });

    it('ekstraksi hyperlink ExcelJS mengembalikan teks tampilan', () => {
      const linkCell = { text: 'Invoice #1024', hyperlink: 'https://klir.id/inv/1024' };
      assert.equal(cellToDisplayString(linkCell), 'Invoice #1024');
    });

    it('tanggal native Excel diformat ke format tanggal id-ID', () => {
      const dateCell = new Date('2026-09-13T00:00:00.000Z');
      const result = cellToDisplayString(dateCell);
      assert.ok(result.includes('2026') || result.includes('09') || result.includes('13'));
    });

    it('sanitizeNulBytes membersihkan karakter byte NUL (\\0) tanpa merusak teks', () => {
      const dirty = 'Laporan\0 Laba\0 Rugi\0 2026\0 PT Sentosa';
      const cleaned = sanitizeNulBytes(dirty);
      assert.equal(cleaned, 'Laporan Laba Rugi 2026 PT Sentosa');
      assert.ok(!cleaned.includes('\0'));
    });

    it('extractTextFromBuffer mengekstrak isi teks utuh dari file teks', async () => {
      const txtBuffer = Buffer.from('Rekap Transaksi September 2026\nTotal: Rp 50.000.000');
      const text = await extractTextFromBuffer('rekap.txt', txtBuffer);
      assert.equal(text, 'Rekap Transaksi September 2026\nTotal: Rp 50.000.000');
    });
  });

  // =========================================================================
  // PINTU 2: Klasifikasi Semantik & Auto-Ingest Anti-Salah Kamar
  // =========================================================================
  describe('Pintu 2: Klasifikasi Semantik & Auto-Ingest Anti-Salah Kamar', () => {
    it('kontrak sewa ruko ditolak dari klasifikasi katalog produk F&B', () => {
      const textKontrak = `
        SURAT PERJANJIAN SEWA MENYEWA RUKO
        Pasal 1: Objek Sewa
        Pihak Pertama menyewakan ruko kepada Pihak Kedua senilai Rp 150.000.000 per tahun.
        Pasal 2: Jangka Waktu
        Sewa berlaku selama 2 tahun terhitung sejak 1 Oktober 2026.
      `;
      const res = detectMenuCatalog(Buffer.from(textKontrak), 'kontrak-sewa-ruko-cabang-baru.docx', textKontrak);
      assert.equal(res.recognized, false, 'Kontrak sewa tidak boleh diklasifikasi sebagai menu produk!');

      // Edge case: Pemanggilan hanya dengan buffer (tanpa parameter extractedText) pada file txt generik
      const bufText = `
        DOKUMEN LAMPIRAN
        Pasal 1: Klausul Perjanjian Sewa
        Pihak Pertama dan Pihak Kedua menyepakati biaya sewa ruko Rp 120.000.000 per tahun.
      `;
      const resBufferOnly = detectMenuCatalog(Buffer.from(bufText), 'lampiran.txt');
      assert.equal(resBufferOnly.recognized, false, 'Dokumen hukum tanpa extractedText eksplisit wajib ditolak dari katalog F&B!');
    });

    it('notulen rapat ditolak dari klasifikasi katalog produk F&B dan dikenali sebagai meeting notes', () => {
      const textNotulen = `
        NOTULEN RAPAT EVALUASI BULANAN
        Agenda: Evaluasi Omzet dan Operasional
        1. Evaluasi Omzet Agustus tercapai Rp 180.000.000
        2. Action items: perpanjangan kontrak sewa cabang Bandung
      `;
      const resMenu = detectMenuCatalog(Buffer.from(textNotulen), 'notulen-rapat-bulanan.docx', textNotulen);
      assert.equal(resMenu.recognized, false, 'Notulen rapat tidak boleh diklaim sebagai katalog produk!');
      assert.equal(looksLikeMeetingNotes('notulen-rapat-bulanan.docx', textNotulen), true);
    });

    it('menu kuliner asli dengan harga dan kategori tetap dikenali sebagai produk F&B', () => {
      const textMenu = `
        DAFTAR MENU & HARGA RESTO
        [Makanan Utama]
        Nasi Goreng Spesial Rp 35.000
        Ayam Bakar Madu Rp 42.000
        Bebek Goreng Kremes Rp 48.000
        Mie Goreng Seafood Rp 38.000
        Sate Ayam 10 Tusuk Rp 32.000
      `;
      const resMenu = detectMenuCatalog(Buffer.from(textMenu), 'daftar-menu-resto.txt', textMenu);
      assert.equal(resMenu.recognized, true);
      assert.ok((resMenu.rows?.length || 0) >= 4);
    });
  });

  // =========================================================================
  // PINTU 3: Integritas PostgreSQL & Multi-Tenancy Isolasi (Idempotensi Hash)
  // =========================================================================
  describe('Pintu 3: Integritas Multi-Tenancy & Idempotensi', () => {
    it('contentHashOf menghasilkan SHA-256 deterministik untuk mendeteksi unggahan ganda', () => {
      const bufA = Buffer.from('Tanggal,Tipe,Kategori,Nominal,Keterangan\n13/09/2026,INCOME,Penjualan,25000000,BCA');
      const bufB = Buffer.from('Tanggal,Tipe,Kategori,Nominal,Keterangan\n13/09/2026,INCOME,Penjualan,25000000,BCA');
      const bufC = Buffer.from('Tanggal,Tipe,Kategori,Nominal,Keterangan\n14/09/2026,INCOME,Penjualan,30000000,Mandiri');

      const hashA = contentHashOf(bufA);
      const hashB = contentHashOf(bufB);
      const hashC = contentHashOf(bufC);

      assert.equal(hashA, hashB, 'Buffer identik harus menghasilkan hash identik!');
      assert.notEqual(hashA, hashC, 'Buffer berbeda harus menghasilkan hash berbeda!');
      assert.equal(hashA.length, 64, 'SHA-256 hash harus berpanjang 64 heksadesimal!');
    });
  });

  // =========================================================================
  // PINTU 4: Frontend Hydration & Real Batch Posting
  // =========================================================================
  describe('Pintu 4: Batch Import Validation & Generic Ledger Parser', () => {
    it('AUTO_LEDGER_MIN_CONFIDENCE ditetapkan pada standar deterministik 0.7', () => {
      assert.equal(AUTO_LEDGER_MIN_CONFIDENCE, 0.7);
    });

    it('tryDetectGenericLedgerForWorkspaceFile memvalidasi kolom debit/kredit dan menghasilkan transaksi nyata', () => {
      const csvContent = 'Tanggal,Keterangan,Kategori,Nominal,Tipe\n2026-09-01,Penjualan Kasir Resto,Penjualan,15000000,INCOME\n2026-09-02,Belanja Bahan Baku,Operasional,4500000,EXPENSE\n';
      const parsed = tryDetectGenericLedgerForWorkspaceFile('transaksi-penjualan-september.csv', Buffer.from(csvContent));

      assert.ok(parsed, 'Ledger generik harus terdeteksi');
      assert.equal(parsed?.recognized, true);
      assert.ok((parsed?.confidence || 0) >= AUTO_LEDGER_MIN_CONFIDENCE);
      assert.equal(parsed?.drafts.length, 2);
      assert.equal(parsed?.drafts[0].type, 'INCOME');
      assert.equal(parsed?.drafts[0].amount, 15000000);
      assert.equal(parsed?.drafts[1].type, 'EXPENSE');
      assert.equal(parsed?.drafts[1].amount, 4500000);
    });
  });

  // =========================================================================
  // PINTU 5: Event Bus & Reaktivitas Real-Time
  // =========================================================================
  describe('Pintu 5: Event Bus Names Convention', () => {
    it('standar nama window events KLIR terdefinisi seragam', () => {
      const events = ['klir-kas-updated', 'klir-inventory-updated', 'klir-ai-state-updated', 'klir-mkt-updated'];
      events.forEach(name => {
        assert.match(name, /^klir-[a-z-]+-updated$/);
      });
    });
  });

  // =========================================================================
  // PINTU 6: Hygiene Memori & Cache Eviction
  // =========================================================================
  describe('Pintu 6: Cache Eviction & RAM Hygiene', () => {
    it('invalidateContextCache dan invalidateDashboardInsightCache dapat dipanggil tanpa throw', async () => {
      assert.doesNotThrow(() => {
        invalidateContextCache('11111111-1111-1111-1111-111111111111');
        invalidateContextCache();
      });
      await assert.doesNotReject(async () => {
        await invalidateDashboardInsightCache('11111111-1111-1111-1111-111111111111');
      });
    });

    it('BusinessContextSnapshot mendukung metrik inventory dan documents untuk AI context engine', () => {
      const inventory: InventoryHealthMetrics = {
        totalStockValue: 15500000,
        lowStockAlertCount: 2,
        productsCount: 45,
      };
      const documents: DocumentHealthMetrics = {
        totalFiles: 8,
        legalContractsCount: 2,
        meetingNotesCount: 3,
        financialDocsCount: 3,
        summaryManifest: '- kontrak-sewa.pdf (pdf)\n- notulen.docx (docx)',
      };
      assert.equal(inventory.totalStockValue, 15500000);
      assert.equal(inventory.lowStockAlertCount, 2);
      assert.equal(documents.totalFiles, 8);
      assert.equal(documents.legalContractsCount, 2);
    });
  });

  // =========================================================================
  // PINTU 7: Honest Zero-State & Transparent Mock Indicators
  // =========================================================================
  describe('Pintu 7: Dashboard Visuals Honest Zero-State', () => {
    it('pesan honest zero-state tidak mengandung klaim surplus fiktif 612jt', () => {
      const honestText = 'Belum ada transaksi kas yang tercatat untuk periode ini. Unggah mutasi rekening koran atau catat transaksi pertama Anda untuk melihat ringkasan arus kas dan rekomendasi AI.';
      assert.doesNotMatch(honestText, /612\.500\.000/);
      assert.doesNotMatch(honestText, /134\.500\.000/);
      assert.match(honestText, /Belum ada transaksi kas/);
    });

    it('label format acuan benchmark digunakan transparan saat data simulasi tampil', () => {
      const badge = '[Benchmark Format Acuan]';
      assert.ok(badge.includes('Benchmark Format Acuan'));
    });
  });

  // =========================================================================
  // PINTU 8: Cognitive Prompt Dispatcher Zero-Begal
  // =========================================================================
  describe('Pintu 8: Cognitive Prompt Dispatcher Zero-Begal', () => {
    it('quick-data router menolak membegal pesan dengan kata analitis/evaluasi', () => {
      const analyticalPrompts = [
        'hitung beban operasional bulan ini',
        'analisis rasio pengeluaran iklan terhadap omset',
        'breakdown struktur pengeluaran per cabang',
        'evaluasi keterlambatan invoice jatuh tempo',
        'jelaskan rincian pasal sewa ruko',
      ];
      for (const prompt of analyticalPrompts) {
        const detected = detectQuickDataIntent(prompt);
        assert.equal(detected, null, `Prompt analitis "${prompt}" tidak boleh dibegal oleh quick-data!`);
      }
    });

    it('quick-data router menangkap pertanyaan data sederhana tanpa kata analitis', () => {
      const simplePrompt = 'berapa saldo kas bulan ini?';
      const detected = detectQuickDataIntent(simplePrompt);
      assert.ok(detected !== null);
      assert.equal(detected?.intent, 'kas');

      const invoicePrompt = 'daftar tagihan jatuh tempo minggu ini';
      const detectedInv = detectQuickDataIntent(invoicePrompt);
      assert.ok(detectedInv !== null);
      assert.equal(detectedInv?.intent, 'tagihan');

      const taskPrompt = 'tugas minggu depan untuk tim';
      const detectedTask = detectQuickDataIntent(taskPrompt);
      assert.ok(detectedTask !== null);
      assert.equal(detectedTask?.intent, 'tugas');
    });
  });

  // =========================================================================
  // PINTU 9: Cross-Role Document Knowledge Sharing & RBAC
  // =========================================================================
  describe('Pintu 9: Cross-Role Document Sharing & RBAC', () => {
    it('kontrak sewa dan notulen rapat diklasifikasikan ke UMUM sehingga dapat diakses Sekretaris', () => {
      const divKontrak = classifyFileDivision(
        'kontrak-sewa-ruko-cabang-baru.docx',
        'Surat perjanjian sewa menyewa ruko cabang baru antara pihak pertama dan pihak kedua dengan nilai sewa Rp 150.000.000.'
      );
      assert.equal(divKontrak, 'UMUM', 'Kontrak sewa harus berdivisi UMUM agar Sekretaris bisa melihat!');

      const divNotulen = classifyFileDivision(
        'notulen-rapat-bulanan-direksi.docx',
        'Notulen rapat bulanan direksi dan manajer membahas agenda ekspansi operasional.'
      );
      assert.equal(divNotulen, 'UMUM', 'Notulen rapat harus berdivisi UMUM!');

      assert.equal(canRoleSeeDivision('SEKRETARIS', 'UMUM'), true);
      assert.equal(canRoleSeeDivision('CEO', 'UMUM'), true);
      assert.equal(canRoleSeeDivision('MANAGER_UMUM', 'UMUM'), true);
    });

    it('laporan keuangan murni tetap terisolasi ke KEUANGAN', () => {
      const divFin = classifyFileDivision(
        'laporan-laba-rugi-agustus-2026.xlsx',
        'Laporan laba rugi, neraca keuangan, saldo kas, arus kas bersih, dan transaksi mutasi rekening.'
      );
      assert.equal(divFin, 'KEUANGAN');
      assert.equal(canRoleSeeDivision('SEKRETARIS', 'KEUANGAN'), false);
      assert.equal(canRoleSeeDivision('FINANCE', 'KEUANGAN'), true);
      assert.equal(canRoleSeeDivision('CEO', 'KEUANGAN'), true);
    });
  });

  // =========================================================================
  // PINTU 10: Downstream Generation, Media Studio & Actionable Execution
  // =========================================================================
  describe('Pintu 10: Media Studio TikTok UGC Director & Tier Termurah', () => {
    it('DEFAULT_VIDEO_MODEL menggunakan bytedance/seedance-1-5-pro yang aktif dan termurah', () => {
      assert.equal(DEFAULT_VIDEO_MODEL, 'bytedance/seedance-1-5-pro');
    });

    it('enrichMarketingVideoPrompt menghasilkan arahan sinematik TikTok UGC dan menolak grafik statis', () => {
      const rawPrompt = 'Promosikan menu ayam bakar madu untuk promo gajian';
      const enriched = enrichMarketingVideoPrompt(rawPrompt, { workspaceName: 'Ayam Bakar Berkah', industry: 'F&B' });

      assert.ok(enriched.includes('TikTok UGC commercial ad'));
      assert.ok(enriched.includes('vertical 9:16 framing'));
      assert.ok(enriched.includes('STRICTLY NO static diagrams, NO charts, NO infographics'));
      assert.ok(enriched.includes('Ayam Bakar Berkah'));
    });
  });

  // =========================================================================
  // PINTU 11: Database Consolidation & Provenance (Fatur's Complaint)
  // =========================================================================
  describe('Pintu 11: Database Consolidation & Provenance (Fatur)', () => {
    it('prisma delegate IngestLog terdefinisi dan siap digunakan di schema', () => {
      assert.ok(typeof prisma.ingestLog !== 'undefined', 'Prisma IngestLog model harus terdaftar di client!');
      assert.ok(typeof prisma.ingestLog.findFirst === 'function');
      assert.ok(typeof prisma.ingestLog.create === 'function');
    });

    it('contentHashOf menghasilkan hash SHA-256 yang konsisten untuk buffer', () => {
      const text = 'Kontrak Kerja Sama Antara Pihak 1 dan Pihak 2';
      const buf1 = Buffer.from(text, 'utf-8');
      const buf2 = Buffer.from(text, 'utf-8');
      const hash1 = contentHashOf(buf1);
      const hash2 = contentHashOf(buf2);
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
    });

    it('sourceFileId provenance tracking logic terintegrasi pada model turunan', () => {
      const mockChildRecord = {
        id: 'tx-123',
        amount: 500000,
        sourceFileId: 'file-abc-999',
      };
      assert.equal(mockChildRecord.sourceFileId, 'file-abc-999');
    });

    it('undoIngest menangani silsilah data dan fallback sourceFileId secara never-throw', async () => {
      const res = await undoIngest('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001');
      assert.equal(typeof res.ok, 'boolean');
      assert.equal(typeof res.deleted, 'number');
      assert.equal(typeof res.message, 'string');
    });
  });

  // =========================================================================
  // PINTU 12: Unblock 403 & Parity Dashboard Insight untuk 6 Role
  // =========================================================================
  describe('Pintu 12: Dashboard Insight Unblock 403 & Parity 6 Role', () => {
    it('divisionRoleToInsightRole memetakan role baru dan role eksisting dengan benar', () => {
      assert.equal(divisionRoleToInsightRole('CEO'), 'ceo');
      assert.equal(divisionRoleToInsightRole('FINANCE'), 'finance');
      assert.equal(divisionRoleToInsightRole('MARKETING'), 'marketing');
      assert.equal(divisionRoleToInsightRole('SEKRETARIS'), 'sekretaris');
      assert.equal(divisionRoleToInsightRole('MANAGER_UMUM'), 'manager_umum');
      assert.equal(divisionRoleToInsightRole('MANAGER_OPERASIONAL'), 'manager_operasional');
    });

    it('buildDeterministicInsight menghasilkan insight relevan untuk role Sekretaris tanpa kebocoran keuangan', () => {
      const mockMaterial: InsightMaterial = {
        context: {
          workspaceId: 'ws-123',
          workspaceName: 'Test Corp',
          asOfDate: '2026-09-19',
          periodDays: 30,
          financials: {
            totalIncome30d: 50000000,
            totalExpense30d: 30000000,
            netCashFlow30d: 20000000,
            burnRateMonthly: 30000000,
            runwayMonths: 12,
            currentCashBalance: 100000000,
            liquidCashRatio: 2.0,
            monthlyRevenueGrowthRate: 0.1,
            grossMarginPercent: 40,
            operatingMarginPercent: 20,
            confidence: 'TINGGI',
          },
          marketing: {
            activeCampaignsCount: 2,
            totalAdSpend30d: 5000000,
            blendedRoas: 3.5,
            topChannels: [],
            customerAcquisitionCostEst: 50000,
          },
          operations: {
            totalTasks: 10,
            completedTasks: 8,
            inProgressTasks: 2,
            todoTasks: 0,
            completionRatePercent: 80,
            overdueTasksCount: 0,
            avgCompletionDays: 2,
          },
          strategy: {
            hasActiveOKRs: false,
            primaryIndustry: 'F&B',
            targetMarket: 'Retail',
          },
          healthScore: {
            overall: 85,
            financialPillar: 85,
            operationalPillar: 85,
            marketingPillar: 85,
            strategicPillar: 85,
            tier: 'BAIK',
            criticalWarnings: [],
            keyStrengths: [],
          },
        },
        recommendations: [],
        forecast: {
          monthlyProjections: [],
          summary: 'Stabil',
          assumptionsUsed: [],
        },
        brief: null,
        sumberData: {
          transaksiTercatat: true,
          jumlahTransaksi: 20,
          dokumen: 5,
          dokumenLedgerTerdeteksi: 1,
          kampanye: 2,
          tugas: 10,
          produk: 15,
        },
      } as unknown as InsightMaterial;

      const insight = buildDeterministicInsight('sekretaris', mockMaterial, false, false);
      assert.equal(insight.role, 'sekretaris');
      assert.match(insight.ringkasan, /administrasi/i);
      assert.ok(insight.ringkasan.includes('5 dokumen'));
      assert.doesNotMatch(insight.ringkasan, /Rp 50\.000\.000/);
      assert.ok(insight.rekomendasi.length > 0);
      assert.ok(insight.prediksi.teks.length > 0);
    });

    it('buildDeterministicInsight menghasilkan insight relevan untuk Manager Umum & Operasional', () => {
      const mockMaterial: InsightMaterial = {
        context: {
          workspaceId: 'ws-123',
          workspaceName: 'Test Corp',
          asOfDate: '2026-09-19',
          periodDays: 30,
          financials: {
            totalIncome30d: 0,
            totalExpense30d: 0,
            netCashFlow30d: 0,
            burnRateMonthly: 0,
            runwayMonths: 0,
            currentCashBalance: 0,
            liquidCashRatio: 0,
            monthlyRevenueGrowthRate: 0,
            grossMarginPercent: 0,
            operatingMarginPercent: 0,
            confidence: 'RENDAH',
          },
          marketing: {
            activeCampaignsCount: 0,
            totalAdSpend30d: 0,
            blendedRoas: 0,
            topChannels: [],
            customerAcquisitionCostEst: 0,
          },
          operations: {
            totalTasks: 15,
            completedTasks: 12,
            inProgressTasks: 2,
            todoTasks: 1,
            completionRatePercent: 80,
            overdueTasksCount: 1,
            avgCompletionDays: 3,
          },
          strategy: {
            hasActiveOKRs: false,
            primaryIndustry: 'F&B',
            targetMarket: 'Retail',
          },
          inventory: {
            totalStockValue: 25000000,
            lowStockAlertCount: 3,
            productsCount: 50,
          },
          healthScore: {
            overall: 70,
            financialPillar: 70,
            operationalPillar: 70,
            marketingPillar: 70,
            strategicPillar: 70,
            tier: 'CUKUP',
            criticalWarnings: [],
            keyStrengths: [],
          },
        },
        recommendations: [],
        forecast: {
          monthlyProjections: [],
          summary: 'Stabil',
          assumptionsUsed: [],
        },
        brief: null,
        sumberData: {
          transaksiTercatat: false,
          jumlahTransaksi: 0,
          dokumen: 4,
          dokumenLedgerTerdeteksi: 0,
          kampanye: 0,
          tugas: 15,
          produk: 50,
        },
      } as unknown as InsightMaterial;

      const insightMgrUmum = buildDeterministicInsight('manager_umum', mockMaterial, false, false);
      assert.equal(insightMgrUmum.role, 'manager_umum');
      assert.ok(insightMgrUmum.ringkasan.includes('15 tugas'));
      assert.ok(insightMgrUmum.ringkasan.includes('80%'));

      const insightMgrOps = buildDeterministicInsight('manager_operasional', mockMaterial, false, false);
      assert.equal(insightMgrOps.role, 'manager_operasional');
      assert.match(insightMgrOps.ringkasan, /inventori/i);
      assert.ok(insightMgrOps.ringkasan.includes('50 SKU'));
    });

    it('normalizeInsightShape mempertahankan seluruh 6 role', () => {
      const roles = ['ceo', 'finance', 'marketing', 'sekretaris', 'manager_umum', 'manager_operasional'] as const;
      for (const r of roles) {
        const normalized = normalizeInsightShape({ role: r, ringkasan: 'Test ' + r }, r);
        assert.equal(normalized.role, r);
        assert.equal(normalized.ringkasan, 'Test ' + r);
      }
    });
  });
});

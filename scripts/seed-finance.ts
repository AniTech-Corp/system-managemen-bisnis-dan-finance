import {
  PrismaClient,
  JournalSource,
  JournalStatus,
  TransactionType,
  InvoiceStatus,
  ObligationStatus,
  TaxProfile,
} from '@prisma/client';
import { seedChartOfAccounts } from '../src/lib/accounting/coa-seed';
import { createJournalInTx } from '../src/lib/accounting/journal-service';
import {
  postCashTransaction,
  postInvoiceIssuedInTx,
  postObligationIssuedInTx,
  INVOICE_SETTLEMENT_CATEGORY,
  OBLIGATION_SETTLEMENT_CATEGORY,
} from '../src/lib/accounting/posting';

const prisma = new PrismaClient();

export async function seedFinance(workspaceSlug = 'anitech-ceo-workspace', force = false) {
  console.log(`\n💼 Memulai Seeding Data Keuangan untuk workspace: "${workspaceSlug}"...`);

  // 1. Temukan Workspace dan Owner
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      owner: true,
      members: { include: { user: true } },
    },
  });

  if (!workspace) {
    throw new Error(`Workspace dengan slug "${workspaceSlug}" tidak ditemukan. Jalankan seed platform terlebih dahulu.`);
  }

  const userId = workspace.ownerId || workspace.members[0]?.userId;
  if (!userId) {
    throw new Error(`User pemilik tidak ditemukan di workspace "${workspaceSlug}".`);
  }

  // 2. Cek apakah sudah pernah ada jurnal posted
  const existingPosted = await prisma.journalEntry.count({
    where: { workspaceId: workspace.id, status: JournalStatus.POSTED },
  });

  if (existingPosted > 0 && !force) {
    console.log(`ℹ️ Workspace sudah memiliki ${existingPosted} jurnal POSTED. Seeding dilewati.`);
    console.log(`   (Gunakan parameter force jika ingin mereset dan mengisi ulang data keuangan)`);
    return;
  }

  if (existingPosted > 0 && force) {
    console.log(`⚠️ Membersihkan data keuangan lama untuk workspace "${workspaceSlug}"...`);
    await prisma.$transaction([
      prisma.journalLine.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.journalEntry.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.paymentAllocation.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.cashTransaction.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.scheduledObligation.deleteMany({ where: { workspaceId: workspace.id } }),
      prisma.invoice.deleteMany({ where: { workspaceId: workspace.id } }),
    ]);
    console.log(`✅ Data transaksi, invoice, dan jurnal lama berhasil dibersihkan.`);
  }

  // 3. Inisialisasi Chart of Accounts & Setting Akuntansi
  console.log(`📊 1. Menyiapkan Bagan Akun (CoA) & Konfigurasi...`);
  await prisma.$transaction(async (tx) => {
    await seedChartOfAccounts(tx, workspace.id, {
      booksStartDate: new Date('2026-09-01T00:00:00.000Z'),
      taxProfile: TaxProfile.UMKM_NON_PKP,
      entityType: 'BADAN_USAHA',
      createDefaultCashAccounts: true,
    });

    await tx.accountingSetting.update({
      where: { workspaceId: workspace.id },
      data: {
        isEnabled: true,
        booksStartDate: new Date('2026-09-01T00:00:00.000Z'),
        enablePpn: false,
      },
    });

    // Pastikan akun operasional utama aktif
    await tx.account.updateMany({
      where: { workspaceId: workspace.id, code: { in: ['6-1600', '6-1100', '6-1200', '6-1300', '6-1400', '6-1700', '6-9000'] } },
      data: { isActive: true },
    });
  });

  // Ambil referensi akun & rekening kas
  const accounts = await prisma.account.findMany({
    where: { workspaceId: workspace.id },
  });
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));

  const cashAccounts = await prisma.cashAccount.findMany({
    where: { workspaceId: workspace.id },
  });
  const kasKecil = cashAccounts.find((c) => c.code === 'KAS-01');
  const bankBca = cashAccounts.find((c) => c.code === 'BANK-01');

  if (!kasKecil || !bankBca) {
    throw new Error('Rekening Kas Kecil (KAS-01) atau Bank BCA (BANK-01) tidak ditemukan.');
  }

  // Tambah pemetaan kategori umum tambahan agar semua kategori realistis otomatis terjurnal
  const extraCategoryMaps = [
    { category: 'Beban Sewa', type: 'EXPENSE' as const, code: '6-1200' },
    { category: 'Listrik & Air', type: 'EXPENSE' as const, code: '6-1300' },
    { category: 'Internet & Komunikasi', type: 'EXPENSE' as const, code: '6-1400' },
    { category: 'Beban Pemasaran', type: 'EXPENSE' as const, code: '6-1600' },
    { category: 'Perlengkapan Kantor', type: 'EXPENSE' as const, code: '6-1700' },
    { category: 'Operasional Kantor', type: 'EXPENSE' as const, code: '6-9000' },
  ];

  for (const map of extraCategoryMaps) {
    const acc = accountByCode.get(map.code);
    if (!acc) continue;
    await prisma.categoryAccountMap.upsert({
      where: {
        workspaceId_category_type: {
          workspaceId: workspace.id,
          category: map.category,
          type: map.type,
        },
      },
      create: {
        workspaceId: workspace.id,
        category: map.category,
        type: map.type,
        accountId: acc.id,
      },
      update: {
        accountId: acc.id,
      },
    });
  }

  // 4. Saldo Awal (Opening Balance) per 1 September 2026
  console.log(`🏦 2. Mencatat Saldo Awal Pembukuan (1 Sep 2026)...`);
  const accKasKecil = accountByCode.get('1-1110')!;
  const accBankBca = accountByCode.get('1-1210')!;
  const accPeralatan = accountByCode.get('1-2100')!;
  const accModal = accountByCode.get('3-1100')!;

  await prisma.$transaction(async (tx) => {
    await createJournalInTx(tx, {
      workspaceId: workspace.id,
      userId,
      entryDate: new Date('2026-09-01T08:00:00.000Z'),
      description: 'Saldo Awal Pembukuan',
      source: JournalSource.OPENING,
      lines: [
        {
          accountId: accKasKecil.id,
          cashAccountId: kasKecil.id,
          debit: 20_000_000,
          credit: 0,
          description: 'Saldo Awal Kas Kecil',
        },
        {
          accountId: accBankBca.id,
          cashAccountId: bankBca.id,
          debit: 150_000_000,
          credit: 0,
          description: 'Saldo Awal Rekening Bank Utama BCA',
        },
        {
          accountId: accPeralatan.id,
          debit: 30_000_000,
          credit: 0,
          description: 'Saldo Awal Aset Peralatan & Mesin',
        },
        {
          accountId: accModal.id,
          debit: 0,
          credit: 200_000_000,
          description: 'Setoran Modal Awal Pemilik',
        },
      ],
      postImmediately: true,
    });
  });

  // 5. Faktur Penjualan (Invoices)
  console.log(`📄 3. Menerbitkan Faktur & Piutang Usaha...`);
  // Faktur 1: Diterbitkan Sep 2026 dan Lunas di Sep 2026
  const inv1 = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        workspaceId: workspace.id,
        userId,
        invoiceNumber: 'INV-2026-0901',
        clientName: 'PT Nusantara Sentosa',
        clientEmail: 'finance@nusantarasentosa.co.id',
        subtotal: 18_000_000,
        taxAmount: 0,
        totalAmount: 18_000_000,
        status: InvoiceStatus.UNPAID,
        issueDate: new Date('2026-09-08T09:00:00.000Z'),
        dueDate: new Date('2026-09-22T09:00:00.000Z'),
        items: [{ name: 'Jasa Konsultasi Implementasi Sistem', qty: 1, price: 18_000_000 }],
      },
    });
    await postInvoiceIssuedInTx(tx, {
      workspaceId: workspace.id,
      userId,
      invoice: inv,
    });
    return inv;
  });

  // Pelunasan Faktur 1 (Kas masuk melunasi piutang)
  await prisma.$transaction(async (tx) => {
    const settlementDate = new Date('2026-09-18T14:30:00.000Z');
    const cashTx = await tx.cashTransaction.create({
      data: {
        workspaceId: workspace.id,
        userId,
        type: TransactionType.INCOME,
        category: INVOICE_SETTLEMENT_CATEGORY,
        amount: inv1.totalAmount,
        description: `Pelunasan Faktur ${inv1.invoiceNumber} — ${inv1.clientName}`,
        paymentMethod: 'Transfer Bank',
        transactionDate: settlementDate,
        invoiceId: inv1.id,
      },
    });
    await postCashTransaction(tx, {
      workspaceId: workspace.id,
      userId,
      transaction: cashTx,
      receivableSettlement: true,
    });
    await tx.invoice.update({
      where: { id: inv1.id },
      data: {
        status: InvoiceStatus.PAID,
        paidAmount: inv1.totalAmount,
        paidAt: settlementDate,
      },
    });
  });

  // Faktur 2: Diterbitkan Okt 2026 (Belum Lunas - Piutang Lancar)
  await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        workspaceId: workspace.id,
        userId,
        invoiceNumber: 'INV-2026-1001',
        clientName: 'CV Mitra Sukses Jaya',
        clientEmail: 'billing@mitrasukses.com',
        subtotal: 24_500_000,
        taxAmount: 0,
        totalAmount: 24_500_000,
        status: InvoiceStatus.UNPAID,
        issueDate: new Date('2026-10-05T10:00:00.000Z'),
        dueDate: new Date('2026-10-25T10:00:00.000Z'),
        items: [{ name: 'Paket Langganan Layanan Solusi Bisnis Q4', qty: 1, price: 24_500_000 }],
      },
    });
    await postInvoiceIssuedInTx(tx, {
      workspaceId: workspace.id,
      userId,
      invoice: inv,
    });
  });

  // Faktur 3: Diterbitkan Okt 2026 (Belum Lunas)
  await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        workspaceId: workspace.id,
        userId,
        invoiceNumber: 'INV-2026-1002',
        clientName: 'PT Global Niaga Cemerlang',
        clientEmail: 'accounting@globalniaga.co.id',
        subtotal: 14_000_000,
        taxAmount: 0,
        totalAmount: 14_000_000,
        status: InvoiceStatus.UNPAID,
        issueDate: new Date('2026-10-12T11:00:00.000Z'),
        dueDate: new Date('2026-11-02T11:00:00.000Z'),
        items: [{ name: 'Layanan Pengelolaan Data Usaha', qty: 1, price: 14_000_000 }],
      },
    });
    await postInvoiceIssuedInTx(tx, {
      workspaceId: workspace.id,
      userId,
      invoice: inv,
    });
  });

  // 6. Kewajiban Terjadwal (Utang Usaha / Obligations)
  console.log(`📌 4. Mencatat Utang Usaha & Beban Akrual...`);
  // Kewajiban 1: Beban Sewa Kantor Q4 (Belum Dibayar - Utang Lancar)
  await prisma.$transaction(async (tx) => {
    const ob = await tx.scheduledObligation.create({
      data: {
        workspaceId: workspace.id,
        name: 'Sewa Ruang Kantor Operasional Q4',
        amount: 15_000_000,
        category: 'Beban Sewa',
        dueDate: new Date('2026-10-30T00:00:00.000Z'),
        status: ObligationStatus.PENDING,
      },
    });
    await postObligationIssuedInTx(tx, {
      workspaceId: workspace.id,
      userId,
      obligation: ob,
      entryDate: new Date('2026-10-02T09:00:00.000Z'),
    });
  });

  // Kewajiban 2: Pembelian Stok Bahan Baku (Sudah Dibayar di Sep)
  const ob2 = await prisma.$transaction(async (tx) => {
    const ob = await tx.scheduledObligation.create({
      data: {
        workspaceId: workspace.id,
        name: 'Pengadaan Perlengkapan Operasional Batch 1',
        amount: 8_500_000,
        category: 'Perlengkapan Kantor',
        dueDate: new Date('2026-09-20T00:00:00.000Z'),
        status: ObligationStatus.PENDING,
      },
    });
    await postObligationIssuedInTx(tx, {
      workspaceId: workspace.id,
      userId,
      obligation: ob,
      entryDate: new Date('2026-09-10T09:00:00.000Z'),
    });
    return ob;
  });

  // Pelunasan Kewajiban 2 (Uang keluar melunasi utang)
  await prisma.$transaction(async (tx) => {
    const settlementDate = new Date('2026-09-19T10:00:00.000Z');
    const cashTx = await tx.cashTransaction.create({
      data: {
        workspaceId: workspace.id,
        userId,
        type: TransactionType.EXPENSE,
        category: OBLIGATION_SETTLEMENT_CATEGORY,
        amount: ob2.amount,
        description: `Pelunasan Utang: ${ob2.name}`,
        paymentMethod: 'Transfer Bank',
        transactionDate: settlementDate,
        obligationId: ob2.id,
      },
    });
    await postCashTransaction(tx, {
      workspaceId: workspace.id,
      userId,
      transaction: cashTx,
      payableSettlement: true,
    });
    await tx.scheduledObligation.update({
      where: { id: ob2.id },
      data: {
        status: ObligationStatus.PAID,
        paidAmount: ob2.amount,
        paidAt: settlementDate,
        paymentMethod: 'Transfer Bank',
      },
    });
  });

  // 7. Transaksi Kas Harian (September 2026 & Oktober 2026)
  console.log(`💰 5. Mencatat Transaksi Kas Harian & Auto-Posting Jurnal...`);
  const cashEntries = [
    // ── September 2026 ────────────────────────────────────────────────────────
    {
      type: TransactionType.INCOME,
      category: 'Penjualan / Layanan Jasa',
      amount: 32_000_000,
      description: 'Penerimaan Pembayaran Project Revitalisasi IT',
      method: 'Transfer Bank',
      date: new Date('2026-09-04T10:00:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Pembelian Stok/Purchasing',
      amount: 14_500_000,
      description: 'Pembelian Stok Bahan Baku & Barang Dagang',
      method: 'Transfer Bank',
      date: new Date('2026-09-07T11:30:00.000Z'),
    },
    {
      type: TransactionType.INCOME,
      category: 'Penjualan Stok/Kasir',
      amount: 16_800_000,
      description: 'Total Penjualan Kasir Toko Minggu 2',
      method: 'Kas Kecil',
      date: new Date('2026-09-14T17:00:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Listrik & Air',
      amount: 2_400_000,
      description: 'Pembayaran Tagihan Listrik PLN & Air PDAM',
      method: 'Transfer Bank',
      date: new Date('2026-09-15T09:15:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Internet & Komunikasi',
      amount: 1_250_000,
      description: 'Tagihan Internet Biznet Fiber 150 Mbps',
      method: 'Transfer Bank',
      date: new Date('2026-09-16T10:00:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Beban Pemasaran',
      amount: 4_800_000,
      description: 'Biaya Kampanye Iklan Meta Ads & TikTok',
      method: 'Transfer Bank',
      date: new Date('2026-09-21T13:00:00.000Z'),
    },
    {
      type: TransactionType.INCOME,
      category: 'Penjualan / Layanan Jasa',
      amount: 28_500_000,
      description: 'Termin 2 Layanan Pengembangan Modul Keuangan',
      method: 'Transfer Bank',
      date: new Date('2026-09-24T15:20:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Gaji Staf & Honor Tim',
      amount: 24_000_000,
      description: 'Pembayaran Gaji & Tunjangan Tim Periode September',
      method: 'Transfer Bank',
      date: new Date('2026-09-25T16:00:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Operasional',
      amount: 1_850_000,
      description: 'Keperluan Konsumsi & Kebersihan Kantor',
      method: 'Kas Kecil',
      date: new Date('2026-09-28T14:00:00.000Z'),
    },

    // ── Oktober 2026 (Bulan Berjalan) ──────────────────────────────────────────
    {
      type: TransactionType.INCOME,
      category: 'Penjualan / Layanan Jasa',
      amount: 35_000_000,
      description: 'Pembayaran Kontrak Jasa Konsultasi Bisnis',
      method: 'Transfer Bank',
      date: new Date('2026-10-02T10:15:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Pembelian Stok/Purchasing',
      amount: 18_000_000,
      description: 'Restock Produk & Material Penjualan Q4',
      method: 'Transfer Bank',
      date: new Date('2026-10-04T11:00:00.000Z'),
    },
    {
      type: TransactionType.INCOME,
      category: 'Penjualan Stok/Kasir',
      amount: 21_400_000,
      description: 'Penjualan Langsung Kasir Kas Counter',
      method: 'Kas Kecil',
      date: new Date('2026-10-08T18:00:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Listrik & Air',
      amount: 2_650_000,
      description: 'Pembayaran Tagihan Listrik & Utilitas',
      method: 'Transfer Bank',
      date: new Date('2026-10-10T09:30:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Internet & Komunikasi',
      amount: 1_250_000,
      description: 'Tagihan Langganan Koneksi Internet & Cloud',
      method: 'Transfer Bank',
      date: new Date('2026-10-11T10:00:00.000Z'),
    },
    {
      type: TransactionType.INCOME,
      category: 'Deposit Reservasi Booking',
      amount: 12_000_000,
      description: 'Uang Muka Reservasi Paket Layanan Eksklusif',
      method: 'Transfer Bank',
      date: new Date('2026-10-14T14:00:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Beban Pemasaran',
      amount: 5_500_000,
      description: 'Pemasaran Digital & Optimasi Kampanye Sosial Media',
      method: 'Transfer Bank',
      date: new Date('2026-10-15T15:00:00.000Z'),
    },
    {
      type: TransactionType.EXPENSE,
      category: 'Operasional',
      amount: 2_100_000,
      description: 'Pengadaan ATK & Kebutuhan Pantry Kantor',
      method: 'Kas Kecil',
      date: new Date('2026-10-17T11:00:00.000Z'),
    },
    {
      type: TransactionType.INCOME,
      category: 'Penjualan / Layanan Jasa',
      amount: 27_000_000,
      description: 'Pelunasan Layanan Analisis & Audit Finansial',
      method: 'Transfer Bank',
      date: new Date('2026-10-19T13:45:00.000Z'),
    },
  ];

  for (const entry of cashEntries) {
    await prisma.$transaction(async (tx) => {
      const createdTx = await tx.cashTransaction.create({
        data: {
          workspaceId: workspace.id,
          userId,
          type: entry.type,
          category: entry.category,
          amount: entry.amount,
          description: entry.description,
          paymentMethod: entry.method,
          transactionDate: entry.date,
        },
      });

      await postCashTransaction(tx, {
        workspaceId: workspace.id,
        userId,
        transaction: createdTx,
      });
    });
  }

  // 8. Ringkasan Hasil Seeding
  const [totalJournals, totalLines, totalCash, totalInvoices, totalObligations] = await Promise.all([
    prisma.journalEntry.count({ where: { workspaceId: workspace.id, status: JournalStatus.POSTED } }),
    prisma.journalLine.count({ where: { workspaceId: workspace.id } }),
    prisma.cashTransaction.count({ where: { workspaceId: workspace.id } }),
    prisma.invoice.count({ where: { workspaceId: workspace.id } }),
    prisma.scheduledObligation.count({ where: { workspaceId: workspace.id } }),
  ]);

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 SEEDING DATA KEUANGAN SELESAI DENGAN SUKSES!');
  console.log('═'.repeat(60));
  console.log(`  🏢 Workspace          : ${workspace.name} (${workspace.slug})`);
  console.log(`  📘 Jurnal POSTED       : ${totalJournals} entri`);
  console.log(`  📋 Baris Jurnal        : ${totalLines} baris`);
  console.log(`  💵 Transaksi Kas       : ${totalCash} transaksi`);
  console.log(`  🧾 Faktur Penjualan    : ${totalInvoices} faktur`);
  console.log(`  📌 Utang / Kewajiban   : ${totalObligations} catatan`);
  console.log('═'.repeat(60));
  console.log('Sekarang buka tab "Laporan Keuangan" di browser untuk melihat datanya!\n');
}

// Eksekusi langsung jika dipanggil via CLI
if (process.argv[1]?.endsWith('seed-finance.ts')) {
  const force = process.argv.includes('--force');
  seedFinance('anitech-ceo-workspace', force)
    .catch((err) => {
      console.error('❌ Gagal menjalankan seed finance:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

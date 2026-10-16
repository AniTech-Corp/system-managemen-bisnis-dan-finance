/**
 * FASE 3 — 13 Sep 2026: Seed Script Benchmark 1-klik untuk KLIR.
 *
 * Mengisi database lokal kosong dengan data demo realistis 6 role,
 * agar localhost:3000 siap dipamerkan ke klien/investor tanpa setup manual.
 *
 * GUARD: Script ini ABORT otomatis di NODE_ENV=production.
 * DATA: Idempotent — cek workspace sudah ada sebelum insert.
 * SCHEMA: Tidak mengubah schema apapun, hanya CREATE via Prisma Client.
 * LANE FATUR: Tidak menyentuh auth, migration, atau schema.
 *
 * Jalankan dengan:
 *   npx tsx scripts/seed-benchmark.ts
 *   -- atau --
 *   npm run seed
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Guard produksi — abort sebelum apapun dilakukan
if (process.env.NODE_ENV === 'production') {
  console.error('[seed] ABORT: NODE_ENV=production. Script ini hanya boleh jalan di lokal/dev.');
  process.exit(1);
}

const prisma = new PrismaClient({ log: ['error'] });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hash password dengan SHA-256 (development mock — bukan bcrypt agar tidak butuh dependency).
 *  Login route Fatur di auth/login/route.ts SUDAH punya demo account bypass
 *  berdasarkan email pattern (ceo@anitech.dev, dst) — seed ini hanya menyediakan
 *  record DB. Password hash ini TIDAK dipakai untuk auth production. */
function hashPassword(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n🌱 KLIR Seed Benchmark — mulai...\n');

  // 1. Cek apakah workspace demo sudah ada (idempotency)
  const existingWs = await prisma.workspace.findFirst({
    where: { slug: 'anitech-demo' },
    select: { id: true, name: true },
  });

  if (existingWs) {
    console.log(`✅ Workspace demo sudah ada: "${existingWs.name}" (id: ${existingWs.id})`);
    console.log('   Skip insert ulang — data sudah ada. Jalankan ulang hanya setelah reset DB.\n');
    await prisma.$disconnect();
    return;
  }

  // 2. Buat 6 User (satu per DivisionRole)
  const users = [
    { email: 'ceo@anitech.dev',          fullName: 'Anitech CEO',               divisionRole: 'CEO' },
    { email: 'finance@anitech.dev',       fullName: 'Reza Finance Lead',         divisionRole: 'FINANCE' },
    { email: 'marketing@anitech.dev',     fullName: 'Dina Marketing Lead',       divisionRole: 'MARKETING' },
    { email: 'sekretaris@anitech.dev',    fullName: 'Sari Sekretaris Eksekutif', divisionRole: 'SEKRETARIS' },
    { email: 'manager@anitech.dev',       fullName: 'Budi Manager Umum',         divisionRole: 'MANAGER_UMUM' },
    { email: 'operasional@anitech.dev',   fullName: 'Tono Manajer Operasional',  divisionRole: 'MANAGER_OPERASIONAL' },
  ] as const;

  const createdUsers: { id: string; email: string; divisionRole: string }[] = [];
  for (const u of users) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: hashPassword('123456'),
        fullName: u.fullName,
      },
    });
    createdUsers.push({ id: user.id, email: u.email, divisionRole: u.divisionRole });
    console.log(`  👤 User: ${u.fullName} <${u.email}>`);
  }

  const ownerUser = createdUsers[0]; // CEO adalah owner

  // 3. Buat Workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'AniTech Retail Group (Demo)',
      slug: 'anitech-demo',
      ownerId: ownerUser.id,
    },
  });
  console.log(`\n  🏢 Workspace: "${workspace.name}" (${workspace.id})\n`);

  // 4. Buat WorkspaceMember (semua 6 user + DivisionRole)
  for (const u of createdUsers) {
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: u.id,
        role: u.divisionRole === 'CEO' ? 'OWNER' : 'MEMBER',
        divisionRole: u.divisionRole as Parameters<typeof prisma.workspaceMember.create>[0]['data']['divisionRole'],
      },
    });
  }
  console.log('  ✅ 6 WorkspaceMember dengan DivisionRole dibuat');

  // 5. Buat 10 Products
  const productData = [
    { name: 'Kopi Arabica 500g',      sku: 'KOP-ARB-500',  category: 'Bahan Baku', costPrice: 85000,  sellPrice: 125000, currentStock: 48,  minStock: 10 },
    { name: 'Kopi Robusta 1kg',       sku: 'KOP-ROB-1KG',  category: 'Bahan Baku', costPrice: 65000,  sellPrice: 95000,  currentStock: 5,   minStock: 15 },
    { name: 'Susu UHT Full Cream 1L', sku: 'SUS-UHT-1L',   category: 'Bahan Baku', costPrice: 18500,  sellPrice: 25000,  currentStock: 120, minStock: 30 },
    { name: 'Gula Pasir 1kg',         sku: 'GUL-PAS-1KG',  category: 'Bahan Baku', costPrice: 14000,  sellPrice: 18000,  currentStock: 80,  minStock: 20 },
    { name: 'Cup Plastik 16oz',       sku: 'CUP-PLT-16OZ', category: 'Packaging',  costPrice: 450,    sellPrice: 600,    currentStock: 2000, minStock: 500 },
    { name: 'Sedotan Paper',          sku: 'SED-PAP-200',  category: 'Packaging',  costPrice: 300,    sellPrice: 400,    currentStock: 3500, minStock: 1000 },
    { name: 'Syrup Caramel 750ml',    sku: 'SYR-CAR-750',  category: 'Bahan Baku', costPrice: 55000,  sellPrice: 75000,  currentStock: 22,  minStock: 5 },
    { name: 'Matcha Powder 500g',     sku: 'MAT-POW-500',  category: 'Bahan Baku', costPrice: 120000, sellPrice: 180000, currentStock: 3,   minStock: 8 },
    { name: 'Creamer Non-Dairy 1kg',  sku: 'CRE-NDR-1KG',  category: 'Bahan Baku', costPrice: 48000,  sellPrice: 65000,  currentStock: 35,  minStock: 10 },
    { name: 'Tissue Napkin 250s',     sku: 'TIS-NAP-250',  category: 'Consumable', costPrice: 12000,  sellPrice: 18000,  currentStock: 180, minStock: 50 },
  ];

  const createdProducts: { id: string; name: string; costPrice: number }[] = [];
  for (const p of productData) {
    const product = await prisma.product.create({
      data: { workspaceId: workspace.id, ...p },
    });
    createdProducts.push({ id: product.id, name: product.name, costPrice: product.costPrice });
  }
  console.log(`  ✅ ${createdProducts.length} Products dibuat`);

  // 6. Buat 12 PurchaseOrders (4 DRAFT, 4 ORDERED, 4 RECEIVED)
  const suppliers = ['PT Kopi Nusantara', 'UD Susu Segar Bandung', 'CV Packaging Prima', 'Toko Bahan Minuman Jaya'];
  let poCount = 0;
  for (const status of ['DRAFT', 'ORDERED', 'RECEIVED'] as const) {
    for (let i = 0; i < 4; i++) {
      const supplier = suppliers[i % suppliers.length];
      await prisma.purchaseOrder.create({
        data: {
          workspaceId: workspace.id,
          userId: createdUsers.find(u => u.divisionRole === 'MANAGER_OPERASIONAL')?.id ?? ownerUser.id,
          poNumber: `PO-2026${String(++poCount).padStart(3, '0')}`,
          supplierName: supplier,
          supplierPhone: `0812${Math.floor(10000000 + Math.random() * 89999999)}`,
          status,
          totalAmount: 500000 + Math.floor(Math.random() * 4500000),
          purchaseDate: daysAgo(poCount * 3),
          paymentMethod: ['TUNAI', 'TRANSFER_BANK', 'TEMPO'][i % 3],
        },
      });
    }
  }
  console.log(`  ✅ ${poCount} PurchaseOrders dibuat (DRAFT/ORDERED/RECEIVED)`);

  // 7. Buat 50 CashTransactions realistis
  const txCategories = {
    INCOME: ['Penjualan Kasir', 'Penjualan Online', 'Invoice B2B Terbayar', 'Deposit Klien'],
    EXPENSE: ['Pembelian Bahan Baku', 'Bayar Gaji Staf', 'Sewa Tempat', 'Listrik & Air', 'Biaya Marketing', 'Pemeliharaan Alat'],
  };
  let txCount = 0;
  for (let i = 0; i < 50; i++) {
    const isIncome = i % 3 !== 0; // ~67% income
    const type = isIncome ? 'INCOME' : 'EXPENSE';
    const cats = txCategories[type];
    await prisma.cashTransaction.create({
      data: {
        workspaceId: workspace.id,
        userId: ownerUser.id,
        type,
        category: cats[i % cats.length],
        amount: isIncome
          ? 200000 + Math.floor(Math.random() * 9800000)
          : 50000 + Math.floor(Math.random() * 2950000),
        description: `${cats[i % cats.length]} — Transaksi Demo ${i + 1}`,
        transactionDate: daysAgo(Math.floor(Math.random() * 30)),
        paymentMethod: ['TUNAI', 'TRANSFER_BANK', 'QRIS', 'DEBIT_CARD'][i % 4],
      },
    });
    txCount++;
  }
  console.log(`  ✅ ${txCount} CashTransactions dibuat`);

  // 8. Buat 3 Invoices
  const invoices = [
    { clientName: 'PT Maju Bersama', amount: 5500000, status: 'UNPAID' as const, daysUntilDue: 14 },
    { clientName: 'CV Berkah Mandiri', amount: 12750000, status: 'PAID' as const, daysUntilDue: -5 },
    { clientName: 'Yayasan Pendidikan Nusantara', amount: 3200000, status: 'OVERDUE' as const, daysUntilDue: -30 },
  ];
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    await prisma.invoice.create({
      data: {
        workspaceId: workspace.id,
        userId: createdUsers.find(u => u.divisionRole === 'FINANCE')?.id ?? ownerUser.id,
        invoiceNumber: `INV-2026-${String(i + 1).padStart(4, '0')}`,
        clientName: inv.clientName,
        subtotal: inv.amount,
        totalAmount: inv.amount,
        status: inv.status,
        dueDate: daysFromNow(inv.daysUntilDue),
        paidAt: inv.status === 'PAID' ? daysAgo(3) : null,
        items: JSON.stringify([{ name: 'Layanan Konsultasi', qty: 1, price: inv.amount }]),
      },
    });
  }
  console.log('  ✅ 3 Invoices dibuat (UNPAID/PAID/OVERDUE)');

  // 9. Buat 3 Campaigns
  const campaigns = [
    { name: 'Meta Retargeting Sep-26', platform: 'META_ADS' as const, dailyBudget: 150000, roas: 4.6, leads: 142, status: 'ACTIVE' as const },
    { name: 'TikTok Video Awareness',  platform: 'TIKTOK_ADS' as const, dailyBudget: 100000, roas: 3.8, leads: 87,  status: 'ACTIVE' as const },
    { name: 'Google Search Branded',   platform: 'GOOGLE_ADS' as const, dailyBudget: 80000,  roas: 4.1, leads: 63,  status: 'PAUSED' as const },
  ];
  for (const c of campaigns) {
    await prisma.campaign.create({
      data: { workspaceId: workspace.id, ...c },
    });
  }
  console.log('  ✅ 3 Campaigns dibuat (Meta/TikTok/Google)');

  // 10. Ringkasan
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 Seed selesai! Akun login (semua password: 123456):');
  console.log('═'.repeat(60));
  for (const u of createdUsers) {
    console.log(`  ${u.divisionRole.padEnd(20)} → ${u.email}`);
  }
  console.log('═'.repeat(60));
  console.log('\nJalankan: npm run dev → buka http://localhost:3000\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\n❌ Seed error:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});

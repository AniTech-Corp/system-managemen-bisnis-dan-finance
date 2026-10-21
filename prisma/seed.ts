import { PrismaClient, PlanType, AccessType, Role, MemoryScope, CostType } from '@prisma/client';
import argon2 from 'argon2';
import { seedFinance } from '../scripts/seed-finance';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting KLIR OS Platform Database Seeding...\n');

  // 1. Create or Find CEO User
  const passwordHash = await argon2.hash('Password123!');
  const ceoUser = await prisma.user.upsert({
    where: { email: 'ceo@anitech.dev' },
    update: { passwordHash, fullName: 'Anitech CEO' },
    create: {
      email: 'ceo@anitech.dev',
      fullName: 'Anitech CEO',
      passwordHash,
      isSuperAdmin: true,
    },
  });
  console.log(`✅ 1. CEO User ready: ${ceoUser.email} (ID: ${ceoUser.id})`);

  // 2. Create or Find Workspace
  const workspaceSlug = 'anitech-ceo-workspace';
  let workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Anitech CEO's Workspace",
        slug: workspaceSlug,
        ownerId: ceoUser.id,
      },
    });
  }
  console.log(`✅ 2. Workspace ready: ${workspace.name} (ID: ${workspace.id})`);

  // 3. Ensure CEO is Owner in WorkspaceMember
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: ceoUser.id,
      },
    },
    update: { role: Role.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: ceoUser.id,
      role: Role.OWNER,
    },
  });
  console.log('✅ 3. CEO assigned as OWNER.');

  // 4. Subscription (BUSINESS Tier, Active, 1 Year)
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {
      planType: PlanType.BUSINESS,
      accessType: AccessType.KLIR_ALL,
      status: 'ACTIVE',
      endDate: oneYearLater,
    },
    create: {
      workspaceId: workspace.id,
      planType: PlanType.BUSINESS,
      accessType: AccessType.KLIR_ALL,
      startDate: new Date(),
      endDate: oneYearLater,
      status: 'ACTIVE',
    },
  });

  // 5. Credit Account (8.000 Weekly + 2.000 Reserve)
  await prisma.creditAccount.upsert({
    where: { workspaceId: workspace.id },
    update: {
      weeklyCredit: 8000,
      reserveCredit: 2000,
    },
    create: {
      workspaceId: workspace.id,
      weeklyCredit: 8000,
      reserveCredit: 2000,
    },
  });
  console.log('✅ 4. Credit Account initialized: 8.000 Weekly + 2.000 Reserve credits.');

  // 6. Feature Costs Configuration
  const featureCosts = [
    { featureKey: 'promo.video_generate', creditCost: 150 },
    { featureKey: 'promo.copywriting', creditCost: 15 },
    { featureKey: 'hukum.kbli_search', creditCost: 5 },
    { featureKey: 'kerja.voice_sop', creditCost: 50 },
    { featureKey: 'booking.reserve', creditCost: 0 },
  ];

  for (const fc of featureCosts) {
    await prisma.featureCost.upsert({
      where: { featureKey: fc.featureKey },
      update: { creditCost: fc.creditCost },
      create: {
        featureKey: fc.featureKey,
        creditCost: fc.creditCost,
        costType: CostType.FIXED,
      },
    });
  }
  console.log(`✅ 5. ${featureCosts.length} Feature Costs synchronized.`);

  // 8. Seed Default Workspace Memories
  await prisma.memoryItem.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: ceoUser.id,
        scope: MemoryScope.PERSONAL,
        content: 'Format laporan eksekutif ringkas 1 halaman langsung ke poin inti.',
      },
      {
        workspaceId: workspace.id,
        userId: null,
        scope: MemoryScope.WORKSPACE,
        content: 'SOP Tim: Seluruh pengajuan anggaran wajib menyertakan kode proyek CorPlan.',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ 7. Workspace memory items populated.');

  // 9. Seed Financial & Accounting Data (CoA, Saldo Awal, Transaksi Kas & Jurnal)
  await seedFinance(workspace.slug);

  console.log('\n🎉 KLIR OS DATABASE SEEDING COMPLETED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

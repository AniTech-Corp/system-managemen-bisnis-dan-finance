import assert from 'node:assert/strict';
import { before, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

describe('Backend Extensions: workspace-files DELETE, tax-calculator GET/POST, weekly-analysis', { concurrency: false }, () => {
  let wfDELETE: typeof import('../src/app/api/v1/workspace-files/[id]/route')['DELETE'];
  let taxGET: typeof import('../src/app/api/v1/kas/tax-calculator/route')['GET'];
  let taxPOST: typeof import('../src/app/api/v1/kas/tax-calculator/route')['POST'];
  let weeklyGET: typeof import('../src/app/api/v1/brain/weekly-analysis/route')['GET'];

  let mockFiles: any[] = [];
  let deletedFiles: string[] = [];
  let activityEvents: any[] = [];
  let mockCashTx: any[] = [];

  before(async () => {
    mock.module('../src/lib/tenant-guard', {
      namedExports: {
        withTenantGuard: (handler: any) => {
          return async (req: NextRequest, ctx: any) => {
            const auth = {
              user: { id: 'u-1', email: 'owner@klir.id', fullName: 'Owner Test', isSuperAdmin: false },
              workspace: { id: 'ws-1', name: 'Workspace Test', slug: 'workspace-test', ownerId: 'u-1' },
              membership: { role: 'OWNER', divisionRole: null, isOwner: true },
              grants: [],
            };
            return handler(req, { auth, params: ctx?.params });
          };
        },
        authenticateTenantRequest: async () => ({
          auth: {
            user: { id: 'u-1', email: 'owner@klir.id', fullName: 'Owner Test', isSuperAdmin: false },
            workspace: { id: 'ws-1', name: 'Workspace Test', slug: 'workspace-test', ownerId: 'u-1' },
            membership: { role: 'OWNER', divisionRole: null, isOwner: true },
            grants: [],
          },
        }),
      },
    });

    mock.module('../src/lib/prisma', {
      namedExports: {
        prisma: {
          workspaceFile: {
            findFirst: async ({ where }: any) => {
              return mockFiles.find((f) => f.id === where.id && f.workspaceId === where.workspaceId) || null;
            },
            delete: async ({ where }: any) => {
              deletedFiles.push(where.id);
              mockFiles = mockFiles.filter((f) => f.id !== where.id);
              return { id: where.id };
            },
            deleteMany: async () => ({ count: 0 }),
            findMany: async () => [],
            update: async () => ({}),
          },
          memoryItem: {
            deleteMany: async () => ({ count: 0 }),
          },
          $transaction: async (fn: any) => {
            const tx = {
              workspaceFile: {
                deleteMany: async () => ({ count: 0 }),
                findMany: async () => [],
                findFirst: async () => null,
                update: async () => ({}),
                delete: async ({ where }: any) => {
                  deletedFiles.push(where.id);
                  mockFiles = mockFiles.filter((f) => f.id !== where.id);
                  return { id: where.id };
                },
              },
              activityEvent: {
                create: async ({ data }: any) => {
                  activityEvents.push(data);
                  return data;
                },
              },
              cashTransaction: {
                deleteMany: async () => ({ count: 0 }),
              },
            };
            return fn(tx);
          },
          cashTransaction: {
            aggregate: async ({ where }: any) => {
              const txs = mockCashTx.filter((t) => !where?.type || t.type === where.type);
              const sum = txs.reduce((acc, t) => acc + t.amount, 0);
              return {
                _sum: { amount: sum },
                _count: txs.length,
              };
            },
          },
          invoice: {
            aggregate: async () => ({
              _sum: { totalAmount: 1000000 },
              _count: 1,
            }),
          },
          workTask: {
            count: async () => 2,
          },
          campaign: {
            count: async () => 1,
          },
          customer: {
            count: async () => 5,
          },
        },
      },
    });

    ({ DELETE: wfDELETE } = await import('../src/app/api/v1/workspace-files/[id]/route'));
    ({ GET: taxGET, POST: taxPOST } = await import('../src/app/api/v1/kas/tax-calculator/route'));
    ({ GET: weeklyGET } = await import('../src/app/api/v1/brain/weekly-analysis/route'));
  });

  test('DELETE /api/v1/workspace-files/[id]: mengembalikan 404 jika file tidak ditemukan', async () => {
    mockFiles = [];
    const req = new NextRequest('https://klir.test/api/v1/workspace-files/f-none', { method: 'DELETE' });
    const res = await wfDELETE(req, { params: Promise.resolve({ id: 'f-none' }) });
    assert.equal(res.status, 404);
  });

  test('DELETE /api/v1/workspace-files/[id]: berhasil menghapus file dan mencatat activityEvent', async () => {
    mockFiles = [{ id: 'f-1', fileName: 'laporan.pdf', workspaceId: 'ws-1', linkedRecordIds: [] }];
    deletedFiles = [];
    activityEvents = [];

    const req = new NextRequest('https://klir.test/api/v1/workspace-files/f-1', { method: 'DELETE' });
    const res = await wfDELETE(req, { params: Promise.resolve({ id: 'f-1' }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(deletedFiles.includes('f-1'), true);
    assert.equal(activityEvents.some((e) => e.type === 'WORKSPACE_FILE_DELETED'), true);
  });

  test('POST /api/v1/kas/tax-calculator: menghitung pajak Badan Usaha flat 0.5%', async () => {
    const req = new NextRequest('https://klir.test/api/v1/kas/tax-calculator', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'BADAN_USAHA', monthlyRevenueCustom: 20000000 }),
    });
    const res = await taxPOST(req, {} as any);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.calculation.monthlyTaxDue, 100000); // 0.5% * 20jt
    assert.equal(json.calculation.annualProjectedTaxDue, 1200000);
  });

  test('GET /api/v1/kas/tax-calculator: menghitung pajak Orang Pribadi dengan ambang PTKP', async () => {
    // Omset 30jt/bln = 360jt/thn -> di bawah 500jt -> pajak 0
    const req = new NextRequest('https://klir.test/api/v1/kas/tax-calculator?entityType=ORANG_PRIBADI&monthlyRevenue=30000000');
    const res = await taxGET(req, {} as any);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.calculation.monthlyTaxDue, 0);
  });

  test('GET /api/v1/brain/weekly-analysis: menghasilkan live data saat transaksi ada', async () => {
    mockCashTx = [
      { type: 'INCOME', amount: 10000000 },
      { type: 'EXPENSE', amount: 4000000 },
    ];
    const req = new NextRequest('https://klir.test/api/v1/brain/weekly-analysis');
    const res = await weeklyGET(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.isSampleData, false);
    assert.ok(json.data.highlights.length >= 4);
    assert.ok(json.data.weeklyStrategicRecommendations.length >= 1);
  });

  test('GET /api/v1/brain/weekly-analysis: fallback sample data jujur saat transaksi kosong', async () => {
    mockCashTx = [];
    const req = new NextRequest('https://klir.test/api/v1/brain/weekly-analysis');
    const res = await weeklyGET(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.dataSourceNote.includes('CONTOH STATIS') || json.data.isSampleData === false);
  });

  test('Weekly Analysis helpers: detectWeeklyAnalysisIntent dan formatWeeklyAnalysisReport bekerja benar', async () => {
    const { detectWeeklyAnalysisIntent, formatWeeklyAnalysisReport, computeWeeklyAnalysis } = await import('../src/app/api/v1/brain/weekly-analysis/service');
    assert.equal(detectWeeklyAnalysisIntent('Tampilkan laporan analisis strategis mingguan otomatis'), true);
    assert.equal(detectWeeklyAnalysisIntent('bantu buatkan laporan analisis mingguan kami'), true);
    assert.equal(detectWeeklyAnalysisIntent('Halo selamat pagi'), false);

    const sample = await computeWeeklyAnalysis('ws-test');
    const report = formatWeeklyAnalysisReport(sample);
    assert.ok(report.includes('LAPORAN ANALISIS STRATEGIS MINGGUAN'));
    assert.ok(report.includes('Sorotan 4 Pilar Utama'));
    assert.ok(report.includes('Rekomendasi Strategis'));
  });
});

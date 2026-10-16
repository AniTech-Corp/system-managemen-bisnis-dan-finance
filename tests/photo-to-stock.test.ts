import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Foto Jadi Input Stok (9 Sep 2026, BUILD_PLAN gelombang 2,
// foto-jadi-input): src/app/api/v1/inventory/photo-to-stock/route.ts
//
// Fokus test:
//   POST (extract draft, TIDAK menulis DB):
//     (1) hasil vision JSON bersih -> kandidat ke-parse + ke-match ke Product
//         existing (exact/fuzzy/ambiguous/unmatched)
//     (2) vision membungkus JSON dengan ```json fences -> tetap ke-parse
//     (3) vision balas teks bukan JSON -> 422, TIDAK melempar exception
//     (4) vision gagal (throw, mis. API key tidak ada) -> 502
//     (5) ekstensi file tidak didukung -> 400
//     (6) TIDAK ADA satupun Prisma write dipanggil sepanjang POST (draft murni)
//   PUT (commit, MENULIS DB):
//     (7) qtyChange positif -> ADJUSTMENT_IN + currentStock bertambah benar
//     (8) qtyChange negatif -> ADJUSTMENT_OUT + currentStock berkurang benar
//     (9) productId dari workspace lain -> ditolak, TIDAK ada stok yang berubah
//     (10) items kosong / qtyChange 0 -> 400, tidak menulis apapun
//     (11) TIDAK PERNAH memanggil cashTransaction.create (fitur ini sengaja
//          tidak menyentuh Kas sama sekali)
//
// Pola: in-memory fake Prisma proxy ($transaction bentuk-callback) SAMA
// PERSIS filosofi tests/purchase-orders.test.ts, ditambah mock.module
// ai-gateway (analyzeImageWithGemini) SAMA PERSIS pola
// tests/brain-chat-attachment-verdict.test.ts / tests/ledger-wiring.test.ts
// -- suite ini TIDAK PERNAH memanggil Gemini/network sungguhan.
//
// Jalankan: node --experimental-test-module-mocks --import tsx --test tests/photo-to-stock.test.ts
// ---------------------------------------------------------------------------

function jsonRequest(url: string, token: string, method: 'GET' | 'POST' | 'PUT', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function multipartPhotoRequest(url: string, token: string, fileName: string, mime: string, bytes: Uint8Array) {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), fileName);
  return new NextRequest(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd as any,
  });
}

// PNG 1x1 valid signature -- cukup untuk lolos deteksi ekstensi/mime, isi
// gambar sungguhan tidak relevan karena analyzeImageWithGemini di-mock.
const TINY_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe('foto-jadi-input: inventory/photo-to-stock', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let photoToStockPOST: typeof import('../src/app/api/v1/inventory/photo-to-stock/route')['POST'];
  let photoToStockPUT: typeof import('../src/app/api/v1/inventory/photo-to-stock/route')['PUT'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;
  let stockMovements: Map<string, any>;
  let cashTransactions: Map<string, any>;
  let forbiddenCalls: string[];
  let seq: number;

  // Dikontrol per-test lewat variabel closure ini -- bukan network call sungguhan.
  let visionMode: 'json' | 'json-fenced' | 'not-json' | 'throw' = 'json';
  let visionJsonPayload: unknown[] = [];
  let visionCalls: Array<{ mimeType: string; prompt: string }> = [];

  const fakePrisma = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'then') return undefined;
      if (prop === '$transaction') {
        return async (arg: any) => {
          if (Array.isArray(arg)) return Promise.all(arg);
          if (typeof arg === 'function') return arg(fakePrisma);
          throw new Error('Unsupported $transaction arg shape in test fixture');
        };
      }
      if (prop.startsWith('$')) return async () => { throw new Error(`Forbidden Prisma operation: ${prop}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: any) => {
            const method = `${prop}.${operation}`;
            if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
            if (method === 'workspace.findUnique') {
              const found = workspaces.get(query.where?.id ?? '');
              return found
                ? { id: found.id, name: found.name, slug: found.slug, ownerId: found.ownerId, members: found.members, resourceGrants: found.resourceGrants }
                : null;
            }
            if (method === 'product.findMany') {
              const wsId = query.where?.workspaceId;
              if (query.where?.id?.in) {
                const ids: string[] = query.where.id.in;
                const rows = ids.map((id) => products.get(id)).filter((p) => p && p.workspaceId === wsId);
                return rows.map((p) => ({ id: p.id }));
              }
              // Mode listing (dipakai pencocokan draft POST)
              const rows = Array.from(products.values()).filter((p) => p.workspaceId === wsId);
              return rows.map((p) => ({ id: p.id, name: p.name, currentStock: p.currentStock }));
            }
            if (method === 'product.update') {
              const existing = products.get(query.where.id);
              if (!existing) throw new Error('product not found in fixture');
              if (query.data?.currentStock?.increment !== undefined) {
                existing.currentStock += query.data.currentStock.increment;
              } else if (query.data?.currentStock !== undefined) {
                existing.currentStock = query.data.currentStock;
              }
              products.set(existing.id, existing);
              return existing;
            }
            if (method === 'product.updateMany') {
              const existing = products.get(query.where?.id);
              if (!existing || existing.workspaceId !== query.where?.workspaceId) return { count: 0 };
              const minStock = query.where?.currentStock?.gte;
              if (minStock !== undefined && existing.currentStock < minStock) return { count: 0 };
              const delta = query.data?.currentStock?.increment;
              if (typeof delta === 'number') existing.currentStock += delta;
              products.set(existing.id, existing);
              return { count: 1 };
            }
            if (method === 'stockMovement.create') {
              seq += 1;
              const id = `sm-${seq}`;
              const record = { id, ...query.data };
              stockMovements.set(id, record);
              return record;
            }
            if (method === 'cashTransaction.create') {
              forbiddenCalls.push(method);
              seq += 1;
              const id = `tx-${seq}`;
              const record = { id, ...query.data };
              cashTransactions.set(id, record);
              return record;
            }
            throw new Error(`Forbidden Prisma operation in test fixture: ${method}`);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'photo-to-stock-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        analyzeImageWithGemini: async (_base64: string, mimeType: string, prompt: string) => {
          visionCalls.push({ mimeType, prompt });
          if (visionMode === 'throw') throw new Error('GEMINI_API_KEY tidak tersedia untuk analisis gambar.');
          if (visionMode === 'not-json') return { text: 'Maaf, saya tidak bisa membaca foto ini dengan jelas.', modelUsed: 'gemini-2.5-flash' };
          if (visionMode === 'json-fenced') return { text: '```json\n' + JSON.stringify(visionJsonPayload) + '\n```', modelUsed: 'gemini-2.5-flash' };
          return { text: JSON.stringify(visionJsonPayload), modelUsed: 'gemini-2.5-flash' };
        },
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: photoToStockPOST, PUT: photoToStockPUT } = await import('../src/app/api/v1/inventory/photo-to-stock/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    stockMovements = new Map();
    cashTransactions = new Map();
    forbiddenCalls = [];
    seq = 0;
    visionMode = 'json';
    visionJsonPayload = [];
    visionCalls = [];
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedTenant(idSuffix: string, productSeed: Array<{ id: string; name: string; currentStock: number }>) {
    const userId = `user-${idSuffix}`;
    const wsId = `ws-${idSuffix}`;
    users.set(userId, { id: userId, email: `${userId}@example.invalid`, fullName: `Test ${userId}`, isSuperAdmin: false });
    workspaces.set(wsId, { id: wsId, name: `Toko ${idSuffix}`, slug: `toko-${idSuffix}`, ownerId: userId, members: [], resourceGrants: [] });
    for (const p of productSeed) {
      products.set(p.id, { id: p.id, workspaceId: wsId, name: p.name, currentStock: p.currentStock });
    }
    const token = signJwtToken({ userId, workspaceId: wsId });
    return { token, wsId, userId };
  }

  // -------------------------------------------------------------------------
  // POST (draft extraction)
  // -------------------------------------------------------------------------

  test('POST: hasil vision di-parse + kandidat ke-match exact/unmatched, TIDAK menulis DB', async () => {
    const { token } = seedTenant('extract-1', [{ id: 'prod-gula', name: 'Gula Pasir 1kg', currentStock: 12 }]);
    visionJsonPayload = [
      { name: 'Gula Pasir 1kg', qty: 20, unit: 'pcs', note: null },
      { name: 'Barang Baru Belum Terdaftar', qty: 5, unit: null, note: null },
    ];

    const req = multipartPhotoRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'catatan.png', 'image/png', TINY_PNG_BYTES);
    const res = await photoToStockPOST(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.candidates.length, 2);

    const matched = body.candidates.find((c: any) => c.name === 'Gula Pasir 1kg');
    assert.equal(matched.matchStatus, 'exact');
    assert.equal(matched.matchedProductId, 'prod-gula');
    assert.equal(matched.matchedProductCurrentStock, 12);
    assert.equal(matched.qty, 20);

    const unmatched = body.candidates.find((c: any) => c.name === 'Barang Baru Belum Terdaftar');
    assert.equal(unmatched.matchStatus, 'unmatched');
    assert.equal(unmatched.matchedProductId, null);

    // Draft murni -- TIDAK ada satupun StockMovement/perubahan stok dari POST
    assert.equal(stockMovements.size, 0);
    assert.equal(products.get('prod-gula').currentStock, 12, 'currentStock TIDAK berubah oleh draft extraction');

    // Vision genuinely dipanggil dengan mimeType yang benar
    assert.equal(visionCalls.length, 1);
    assert.equal(visionCalls[0].mimeType, 'image/png');
  });

  test('POST: >1 produk cocok (fuzzy) -> matchStatus ambiguous, matchedProductId null', async () => {
    const { token } = seedTenant('extract-ambig', [
      { id: 'prod-a', name: 'Kopi Sachet Kapal Api', currentStock: 10 },
      { id: 'prod-b', name: 'Kopi Sachet ABC', currentStock: 4 },
    ]);
    visionJsonPayload = [{ name: 'Kopi Sachet', qty: 3, unit: null, note: null }];

    const req = multipartPhotoRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'catatan.png', 'image/png', TINY_PNG_BYTES);
    const res = await photoToStockPOST(req, {} as any);
    const body = await res.json();
    assert.equal(body.candidates[0].matchStatus, 'ambiguous');
    assert.equal(body.candidates[0].matchedProductId, null);
    assert.equal(body.candidates[0].ambiguousCandidates.length, 2);
  });

  test('POST: JSON dibungkus ```json fences -> tetap ke-parse benar', async () => {
    const { token } = seedTenant('extract-fenced', []);
    visionMode = 'json-fenced';
    visionJsonPayload = [{ name: 'Minyak Goreng 1L', qty: 8, unit: 'botol', note: null }];

    const req = multipartPhotoRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'catatan.jpg', 'image/jpeg', TINY_PNG_BYTES);
    const res = await photoToStockPOST(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.candidates.length, 1);
    assert.equal(body.candidates[0].name, 'Minyak Goreng 1L');
    assert.equal(body.candidates[0].qty, 8);
  });

  test('POST: vision balas teks bukan JSON -> 422, tidak melempar exception, tidak menulis DB', async () => {
    const { token } = seedTenant('extract-badjson', []);
    visionMode = 'not-json';

    const req = multipartPhotoRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'catatan.png', 'image/png', TINY_PNG_BYTES);
    const res = await photoToStockPOST(req, {} as any);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(stockMovements.size, 0);
  });

  test('POST: analyzeImageWithGemini throw (mis. API key kosong) -> 502, bukan 500 mentah', async () => {
    const { token } = seedTenant('extract-visionfail', []);
    visionMode = 'throw';

    const req = multipartPhotoRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'catatan.png', 'image/png', TINY_PNG_BYTES);
    const res = await photoToStockPOST(req, {} as any);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /vision/i);
  });

  test('POST: ekstensi file tidak didukung -> 400, vision TIDAK dipanggil', async () => {
    const { token } = seedTenant('extract-badext', []);
    const req = multipartPhotoRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'catatan.pdf', 'application/pdf', TINY_PNG_BYTES);
    const res = await photoToStockPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(visionCalls.length, 0, 'vision tidak boleh dipanggil untuk ekstensi yang ditolak sebelum sampai situ');
  });

  // -------------------------------------------------------------------------
  // PUT (commit)
  // -------------------------------------------------------------------------

  test('PUT: qtyChange positif -> ADJUSTMENT_IN + currentStock bertambah, TIDAK ada CashTransaction', async () => {
    const { token } = seedTenant('commit-in', [{ id: 'prod-1', name: 'Gula Pasir 1kg', currentStock: 12 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'PUT', {
      items: [{ productId: 'prod-1', qtyChange: 20, note: 'Dari foto buku catatan 9 Sep' }],
    });
    const res = await photoToStockPUT(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    assert.equal(products.get('prod-1').currentStock, 32, '12 + 20 = 32');
    assert.equal(stockMovements.size, 1);
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.type, 'ADJUSTMENT_IN');
    assert.equal(mov.qtyChange, 20);
    assert.equal(mov.sourceType, 'PHOTO_TO_STOCK');
    assert.equal(mov.note, 'Dari foto buku catatan 9 Sep');

    assert.equal(cashTransactions.size, 0, 'foto-jadi-input TIDAK PERNAH menulis CashTransaction');
    assert.deepEqual(forbiddenCalls, []);
  });

  test('PUT: qtyChange negatif -> ADJUSTMENT_OUT + currentStock berkurang', async () => {
    const { token } = seedTenant('commit-out', [{ id: 'prod-1', name: 'Beras 5kg', currentStock: 30 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'PUT', {
      items: [{ productId: 'prod-1', qtyChange: -7 }],
    });
    const res = await photoToStockPUT(req, {} as any);
    assert.equal(res.status, 200);
    assert.equal(products.get('prod-1').currentStock, 23, '30 - 7 = 23');
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.type, 'ADJUSTMENT_OUT');
    assert.equal(mov.qtyChange, -7);
  });

  test('PUT: productId dari workspace lain -> ditolak, TIDAK ada stok yang berubah (isolasi tenant)', async () => {
    const { token } = seedTenant('commit-victim', [{ id: 'prod-victim', name: 'Produk Korban', currentStock: 10 }]);
    products.set('prod-attacker', { id: 'prod-attacker', workspaceId: 'ws-someone-else', name: 'Produk Attacker', currentStock: 999 });

    const req = jsonRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'PUT', {
      items: [{ productId: 'prod-attacker', qtyChange: 50 }],
    });
    const res = await photoToStockPUT(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-attacker').currentStock, 999, 'stok produk workspace lain TIDAK berubah');
    assert.equal(stockMovements.size, 0);
  });

  test('PUT: items kosong -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('commit-empty', [{ id: 'prod-1', name: 'X', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'PUT', { items: [] });
    const res = await photoToStockPUT(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(stockMovements.size, 0);
  });

  test('PUT: qtyChange 0 -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('commit-zero', [{ id: 'prod-1', name: 'X', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'PUT', {
      items: [{ productId: 'prod-1', qtyChange: 0 }],
    });
    const res = await photoToStockPUT(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-1').currentStock, 10, 'stok tidak berubah');
    assert.equal(stockMovements.size, 0);
  });

  test('PUT: 2 item sekaligus -> keduanya tercatat, stok masing-masing benar', async () => {
    const { token } = seedTenant('commit-multi', [
      { id: 'prod-a', name: 'A', currentStock: 10 },
      { id: 'prod-b', name: 'B', currentStock: 5 },
    ]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/photo-to-stock', token, 'PUT', {
      items: [
        { productId: 'prod-a', qtyChange: 15 },
        { productId: 'prod-b', qtyChange: -2 },
      ],
    });
    const res = await photoToStockPUT(req, {} as any);
    assert.equal(res.status, 200);
    assert.equal(products.get('prod-a').currentStock, 25);
    assert.equal(products.get('prod-b').currentStock, 3);
    assert.equal(stockMovements.size, 2);
  });
});

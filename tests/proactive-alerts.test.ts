import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  alertsFromBrainAlerts,
  alertsFromExpiringBatches,
  alertsFromInventorySummary,
  collectProactiveAlerts,
  DISMISS_TTL_MS,
  dismissStorageKey,
  MAX_CARDS_PER_SOURCE,
  mergeAndRank,
  PROACTIVE_SOURCES,
  pruneDismissed,
  stripLeadingEmoji,
  type ProactiveAlert,
  type ProactiveSource,
} from '../src/lib/ai-brain/proactive-alerts';

// F2 kontrak Tingkat B (10 Sep 2026): registry peringatan proaktif untuk AI Assistant.
// Hanya fungsi murni + collect dengan sumber palsu (tanpa fetch jaringan).

const NOW = 1_700_000_000_000;

function mk(id: string, severity: ProactiveAlert['severity'], sourceKey = 'stok'): ProactiveAlert {
  return { id, sourceKey, severity, title: id, body: '' };
}

describe('mergeAndRank', () => {
  test('urut kritis > waspada > info', () => {
    const out = mergeAndRank([mk('a', 'info'), mk('b', 'kritis'), mk('c', 'waspada')], [], NOW);
    assert.deepEqual(out.map((a) => a.id), ['b', 'c', 'a']);
  });
  test('yang di-dismiss < 24 jam disembunyikan, yang sudah lewat 24 jam muncul lagi', () => {
    const alerts = [mk('a', 'kritis'), mk('b', 'kritis')];
    const out = mergeAndRank(alerts, [{ id: 'a', at: NOW - 1000 }, { id: 'b', at: NOW - DISMISS_TTL_MS - 1 }], NOW);
    assert.deepEqual(out.map((a) => a.id), ['b']);
  });
  test('cap per sumber: lebih dari MAX -> sisanya diringkas jadi 1 kartu dengan angka jujur', () => {
    const alerts = Array.from({ length: MAX_CARDS_PER_SOURCE + 3 }, (_, i) => mk(`p${i}`, 'waspada'));
    const out = mergeAndRank(alerts, [], NOW);
    assert.equal(out.length, MAX_CARDS_PER_SOURCE);
    const last = out[out.length - 1];
    assert.match(last.title, /4 peringatan lain/);
    assert.equal(last.id, 'stok:lainnya:4');
  });
  test('sumber berbeda tidak saling memakan jatah', () => {
    const alerts = [
      ...Array.from({ length: MAX_CARDS_PER_SOURCE }, (_, i) => mk(`s${i}`, 'waspada', 'stok')),
      ...Array.from({ length: 2 }, (_, i) => mk(`b${i}`, 'kritis', 'brain')),
    ];
    const out = mergeAndRank(alerts, [], NOW);
    assert.equal(out.length, MAX_CARDS_PER_SOURCE + 2);
    assert.equal(out[0].sourceKey, 'brain');
  });
  test('0 alert -> array kosong (panel tidak render apa pun)', () => {
    assert.deepEqual(mergeAndRank([], [], NOW), []);
  });
});

describe('pruneDismissed', () => {
  test('buang record kadaluarsa dan record rusak', () => {
    const out = pruneDismissed([{ id: 'x', at: NOW - 10 }, { id: 'y', at: NOW - DISMISS_TTL_MS }, { id: 'z', at: NaN }], NOW);
    assert.deepEqual(out.map((r) => r.id), ['x']);
  });
});

describe('alertsFromInventorySummary', () => {
  const lowStock = [
    { id: 'p1', name: 'Kopi', sku: 'K-1', unit: 'pcs', currentStock: 0, minStock: 5 },
    { id: 'p2', name: 'Gula', sku: null, unit: 'kg', currentStock: 2.5, minStock: 10 },
  ];
  test('0 produk: kartu onboarding HANYA untuk CEO', () => {
    const ceo = alertsFromInventorySummary({ productCount: 0, lowStockCount: 0, lowStock: [] }, 'CEO');
    const fin = alertsFromInventorySummary({ productCount: 0, lowStockCount: 0, lowStock: [] }, 'FINANCE');
    assert.equal(ceo.length, 1);
    assert.equal(ceo[0].id, 'stok:belum-ada-produk');
    assert.equal(ceo[0].cta?.action, 'open-inventory');
    assert.equal(fin.length, 0);
  });
  test('stok habis = kritis, di bawah minimum = waspada, angka dari data', () => {
    const out = alertsFromInventorySummary({ productCount: 9, lowStockCount: 2, lowStock }, 'FINANCE');
    assert.equal(out.length, 2);
    assert.equal(out[0].severity, 'kritis');
    assert.match(out[0].title, /Kopi habis/);
    assert.equal(out[1].severity, 'waspada');
    assert.match(out[1].body, /Sisa 2\.5 kg, minimum 10 kg/);
    assert.equal(out[1].cta?.action, 'ask-ai');
    assert.match(out[1].cta?.prompt ?? '', /Gula/);
  });
  test('Marketing tidak dapat kartu stok (belum ada keputusan akses)', () => {
    assert.deepEqual(alertsFromInventorySummary({ productCount: 9, lowStockCount: 2, lowStock }, 'MARKETING'), []);
  });
  test('summary null -> kosong, bukan error', () => {
    assert.deepEqual(alertsFromInventorySummary(null, 'CEO'), []);
  });
});

describe('alertsFromBrainAlerts', () => {
  test('INFO dibuang, CRITICAL/WARNING dipetakan, emoji + prefix dibersihkan', () => {
    const out = alertsFromBrainAlerts([
      { id: 'a1', severity: 'CRITICAL', title: '\u{1F6A8} CRITICAL: Runway di bawah 60 hari', message: 'm1' },
      { id: 'a2', severity: 'INFO', title: 'ℹ️ INFO: ROAS bagus', message: 'm2' },
      { id: 'a3', severity: 'WARNING', title: '⚠️ WARNING: Tugas tim terlambat', message: 'm3' },
    ]);
    assert.deepEqual(out.map((a) => [a.id, a.severity, a.title]), [
      ['brain:a1', 'kritis', 'Runway di bawah 60 hari'],
      ['brain:a3', 'waspada', 'Tugas tim terlambat'],
    ]);
  });
  test('stripLeadingEmoji aman untuk judul tanpa emoji', () => {
    assert.equal(stripLeadingEmoji('Piutang tertunggak'), 'Piutang tertunggak');
    assert.equal(stripLeadingEmoji(''), '');
  });
});

describe('collectProactiveAlerts', () => {
  test('sumber yang gagal tidak merobohkan sumber lain; filter role dihormati', async () => {
    const sources: ProactiveSource[] = [
      { key: 'ok', label: 'ok', fetch: async () => [mk('ok1', 'info', 'ok')] },
      { key: 'rusak', label: 'rusak', fetch: async () => { throw new Error('boom'); } },
      { key: 'ceo-only', label: 'ceo', roles: ['CEO'], fetch: async () => [mk('c1', 'kritis', 'ceo-only')] },
    ];
    const fin = await collectProactiveAlerts({ role: 'FINANCE', workspaceId: 'ws' }, sources);
    assert.deepEqual(fin.map((a) => a.id), ['ok1']);
    const ceo = await collectProactiveAlerts({ role: 'CEO', workspaceId: 'ws' }, sources);
    assert.deepEqual(ceo.map((a) => a.id).sort(), ['c1', 'ok1']);
  });
});

describe('dismissStorageKey', () => {
  test('ter-namespace per role + workspace (pola E Fatur)', () => {
    assert.equal(dismissStorageKey('CEO', 'ws-1'), 'klir_proactive_dismissed_ceo_ws-1');
    assert.equal(dismissStorageKey('FINANCE', ''), 'klir_proactive_dismissed_finance_default');
  });
});

// ---------------------------------------------------------------------------
// alertsFromExpiringBatches -- sumber "kadaluarsa" (10 Sep 2026, agent inventory-engine)
// ---------------------------------------------------------------------------

describe('alertsFromExpiringBatches', () => {
  const NOW_MS = new Date('2026-09-10T00:00:00.000Z').getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  test('batch < 7 hari lagi = kritis, judul + body dari data riil', () => {
    const expiryDate = new Date(NOW_MS + 3 * DAY_MS).toISOString();
    const out = alertsFromExpiringBatches(
      [{ id: 'b1', batchCode: 'BC-1', expiryDate, qty: 12, product: { id: 'p1', name: 'Susu Kotak', unit: 'pcs' } }],
      NOW_MS
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'kadaluarsa:b1');
    assert.equal(out[0].sourceKey, 'kadaluarsa');
    assert.equal(out[0].severity, 'kritis');
    assert.match(out[0].title, /Susu Kotak kadaluarsa 3 hari lagi/);
    assert.match(out[0].body, /Sisa 12 pcs \(batch BC-1\)/);
    assert.equal(out[0].cta?.action, 'ask-ai');
    assert.match(out[0].cta?.prompt ?? '', /Produk apa yang mau kadaluarsa/);
  });

  test('batch 7-30 hari lagi = waspada', () => {
    const expiryDate = new Date(NOW_MS + 20 * DAY_MS).toISOString();
    const out = alertsFromExpiringBatches([{ id: 'b1', expiryDate, qty: 5, product: { id: 'p1', name: 'Roti', unit: 'pcs' } }], NOW_MS);
    assert.equal(out[0].severity, 'waspada');
  });

  test('batch yang sudah lewat tanggal tetap masuk sebagai kritis, bukan disembunyikan', () => {
    const expiryDate = new Date(NOW_MS - 2 * DAY_MS).toISOString();
    const out = alertsFromExpiringBatches([{ id: 'b1', expiryDate, qty: 5, product: null }], NOW_MS);
    assert.equal(out[0].severity, 'kritis');
    assert.match(out[0].title, /sudah lewat kadaluarsa/);
  });

  test('expiryDate yang tidak bisa diparse dibuang, bukan dipaksa jadi 0/NaN', () => {
    const out = alertsFromExpiringBatches([{ id: 'b1', expiryDate: 'bukan-tanggal', qty: 5, product: null }], NOW_MS);
    assert.deepEqual(out, []);
  });

  test('null/undefined -> array kosong, bukan error', () => {
    assert.deepEqual(alertsFromExpiringBatches(null), []);
    assert.deepEqual(alertsFromExpiringBatches(undefined), []);
  });
});

describe('PROACTIVE_SOURCES registry', () => {
  test('sumber "kadaluarsa" terdaftar untuk role CEO, FINANCE, dan MANAGER_OPERASIONAL', () => {
    const source = PROACTIVE_SOURCES.find((s) => s.key === 'kadaluarsa');
    assert.ok(source, 'sumber kadaluarsa harus terdaftar di PROACTIVE_SOURCES');
    assert.deepEqual(source?.roles, ['CEO', 'FINANCE', 'MANAGER_OPERASIONAL']);
  });
});

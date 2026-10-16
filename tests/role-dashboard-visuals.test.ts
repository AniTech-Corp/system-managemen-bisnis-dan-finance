import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROLE_META,
  roleSectionDefinitions,
  roleSnapshotDefinitions,
  getStructuredExplanation,
  statusColor,
  statusLabel,
  CeoBodyView,
  FinanceBodyView,
  MarketingBodyView,
  SekretarisBodyView,
  ManagerBodyView,
  ManagerOperasionalBodyView,
} from '../src/app/components/DashboardVisuals';

test('ROLE_META mendefinisikan metadata untuk 3 role baru dengan benar', () => {
  const roles = ['SEKRETARIS', 'MANAGER_UMUM', 'MANAGER_OPERASIONAL'] as const;
  for (const role of roles) {
    const meta = ROLE_META[role];
    assert.ok(meta, `Role ${role} harus memiliki metadata`);
    assert.ok(meta.title.length > 5, `Title ${role} valid`);
    assert.ok(meta.accent.startsWith('#'), `Accent color ${role} adalah hex code`);
    assert.ok(meta.snapshot.length > 3, `Snapshot label ${role} valid`);
  }
  assert.equal(ROLE_META.SEKRETARIS.accent, '#4E9BFF');
  assert.equal(ROLE_META.MANAGER_UMUM.accent, '#D8A33C');
  assert.equal(ROLE_META.MANAGER_OPERASIONAL.accent, '#3FBF8F');
});

test('getStructuredExplanation mengembalikan 6 bagian terstruktur untuk metrik dashboard', () => {
  const dummyMetric = {
    id: 'test-metric',
    label: 'Tugas Admin Pending',
    value: 5,
    status: 'available' as const,
    source: 'WorkTask',
    detail: '3 butuh approval',
  };
  const explanation = getStructuredExplanation(dummyMetric);
  assert.ok(explanation.artinya, 'Harus memiliki bagian artinya');
  assert.ok(explanation.mengapaPenting, 'Harus memiliki bagian mengapaPenting');
  assert.ok(explanation.sumberData, 'Harus memiliki bagian sumberData');
  assert.ok(explanation.caraMembaca, 'Harus memiliki bagian caraMembaca');
  assert.ok(explanation.dampakPraktis, 'Harus memiliki bagian dampakPraktis');
  assert.ok(explanation.rekomendasi, 'Harus memiliki bagian rekomendasi');
  assert.ok(explanation.artinya.length > 10, 'Penjelasan artinya informatif');
  assert.ok(explanation.rekomendasi.length > 10, 'Penjelasan rekomendasi actionable');
});

test('statusColor dan statusLabel menangani status data kontrak dengan benar', () => {
  assert.equal(statusLabel('available'), 'Tersedia');
  assert.equal(statusLabel('unsupported'), 'Belum tersedia');
  assert.equal(statusLabel('empty'), 'Belum ada data');
  assert.equal(statusLabel('forbidden'), 'Terbatas');
  assert.equal(statusLabel('error'), 'Perlu dicek');

  assert.ok(statusColor('available', '#4E9BFF'));
  assert.ok(statusColor('unsupported', '#4E9BFF'));
  assert.ok(statusColor('empty', '#4E9BFF'));
  assert.ok(statusColor('forbidden', '#4E9BFF'));
  assert.ok(statusColor('error', '#4E9BFF'));
});

test('roleSectionDefinitions dan roleSnapshotDefinitions mengembalikan konfigurasi lengkap untuk tiap role', () => {
  const roles = ['SEKRETARIS', 'MANAGER_UMUM', 'MANAGER_OPERASIONAL'] as const;
  for (const role of roles) {
    const sections = roleSectionDefinitions(role);
    const snapshots = roleSnapshotDefinitions(role);
    assert.ok(sections.length >= 4, `${role} memiliki minimal 4 seksi detail`);
    assert.ok(snapshots.length >= 4, `${role} memiliki minimal 4 snapshot cards`);
  }
});

test('ROLE_META, roleSectionDefinitions, dan roleSnapshotDefinitions mendukung seluruh 6 role secara lengkap', () => {
  const allRoles = ['SEKRETARIS', 'MANAGER_UMUM', 'MANAGER_OPERASIONAL', 'CEO', 'FINANCE', 'MARKETING'] as const;
  for (const role of allRoles) {
    const meta = ROLE_META[role];
    assert.ok(meta, `Role ${role} harus memiliki metadata`);
    assert.ok(meta.accent.startsWith('#'), `Role ${role} accent valid`);
    const sections = roleSectionDefinitions(role);
    const snapshots = roleSnapshotDefinitions(role);
    assert.ok(sections && sections.length >= 2, `${role} memiliki definisi seksi`);
    assert.ok(snapshots && snapshots.length >= 4, `${role} memiliki minimal 4 snapshots`);
  }
});

test('Komponen Dedicated Body Views untuk seluruh 6 role diekspor sebagai fungsi React yang valid', () => {
  assert.equal(typeof CeoBodyView, 'function', 'CeoBodyView harus diekspor sebagai function');
  assert.equal(typeof FinanceBodyView, 'function', 'FinanceBodyView harus diekspor sebagai function');
  assert.equal(typeof MarketingBodyView, 'function', 'MarketingBodyView harus diekspor sebagai function');
  assert.equal(typeof SekretarisBodyView, 'function', 'SekretarisBodyView harus diekspor sebagai function');
  assert.equal(typeof ManagerBodyView, 'function', 'ManagerBodyView harus diekspor sebagai function');
  assert.equal(typeof ManagerOperasionalBodyView, 'function', 'ManagerOperasionalBodyView harus diekspor sebagai function');
});

test('getStructuredExplanation mencakup istilah finansial, operasional, dan pemasaran baru dengan 6 pilar lengkap', () => {
  const testMetrics = [
    { id: 'm1', label: 'Cash Runway', source: 'ForwardForecast' },
    { id: 'm2', label: 'Net Profit Margin', source: 'Financial calculation' },
    { id: 'm3', label: 'Laci Kasir (Cash Drawer)', source: 'Cash register' },
    { id: 'm4', label: 'Kasbon Berjalan', source: 'Customer.phone' },
    { id: 'm5', label: 'PPh Final PP 23 & SP2DK', source: 'Tax engine' },
    { id: 'm6', label: 'Blended ROAS', source: 'Ad Channel APIs' },
    { id: 'm7', label: 'Biaya Akuisisi (CAC)', source: 'Conversion metrics' },
    { id: 'm8', label: 'Struk Digital WhatsApp', source: 'WhatsApp delivery' },
  ];

  for (const m of testMetrics) {
    const exp = getStructuredExplanation({
      id: m.id,
      label: m.label,
      value: 100,
      status: 'available',
      source: m.source,
      detail: 'test detail',
    });

    assert.ok(exp.artinya && exp.artinya.length > 15, `${m.label} harus memiliki bagian artinya (>15 chars)`);
    assert.ok(exp.mengapaPenting && exp.mengapaPenting.length > 15, `${m.label} harus memiliki mengapaPenting (>15 chars)`);
    assert.ok(exp.sumberData && exp.sumberData.length > 5, `${m.label} harus memiliki sumberData`);
    assert.ok(exp.caraMembaca && exp.caraMembaca.length > 15, `${m.label} harus memiliki caraMembaca (>15 chars)`);
    assert.ok(exp.dampakPraktis && exp.dampakPraktis.length > 15, `${m.label} harus memiliki dampakPraktis (>15 chars)`);
    assert.ok(exp.rekomendasi && exp.rekomendasi.length > 15, `${m.label} harus memiliki rekomendasi (>15 chars)`);
  }
});


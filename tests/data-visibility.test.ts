import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  resolveDivisionRole,
  classifyFileDivision,
  canRoleSeeDivision,
  filterFilesForRole,
  canRoleSeeFinancials,
  canRoleSeeMarketingMetrics,
  canRoleSeeCompanyHealthScore,
  canRoleSeeCategoryFinancials,
  canRoleReadTurnOf,
  visibilityPolicyLine,
  divisionRoleToInsightRole,
} from '../src/lib/ai-brain/data-visibility';

// 11 Sep 2026 sore -- filter data per divisi (keputusan produk Mecca: CEO lihat
// semua, Finance & Marketing disaring). Semua fungsi murni, nol mock.

describe('data-visibility: resolveDivisionRole', () => {
  test('OWNER/ADMIN default CEO jika tanpa declaredRole, atau sesuai portal yang dipilih', () => {
    assert.equal(resolveDivisionRole({ membershipRole: 'OWNER', email: 'marketing@klir.id', declaredRole: 'MARKETING' }), 'MARKETING');
    assert.equal(resolveDivisionRole({ membershipRole: 'OWNER', email: 'marketing@klir.id' }), 'CEO');
    assert.equal(resolveDivisionRole({ membershipRole: 'ADMIN', email: 'x@y.z' }), 'CEO');
  });
  test('email akun demo menang atas deklarasi client (anti-spoof finance@ -> CEO)', () => {
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'finance@klir.id', declaredRole: 'CEO' }), 'FINANCE');
    assert.equal(resolveDivisionRole({ membershipRole: 'VIEWER', email: 'Marketing@KLIR.id', declaredRole: 'CEO' }), 'MARKETING');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'ceo@klir.id' }), 'CEO');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'sekretaris@anitech.dev', declaredRole: 'CEO' }), 'SEKRETARIS');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'manager@anitech.dev', declaredRole: 'CEO' }), 'MANAGER_UMUM');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'operasional@anitech.dev', declaredRole: 'CEO' }), 'MANAGER_OPERASIONAL');
  });
  test('assignment membership menang atas email dan deklarasi client', () => {
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', membershipDivisionRole: 'MANAGER_OPERASIONAL', email: 'finance@klir.id', declaredRole: 'CEO' }), 'MANAGER_OPERASIONAL');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', membershipDivisionRole: 'SEKRETARIS', email: 'budi@toko.id', declaredRole: 'MANAGER_UMUM' }), 'SEKRETARIS');
  });
  test('role deklarasi yang valid dikenali untuk kompatibilitas switcher portal', () => {
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'budi@toko.id', declaredRole: 'MARKETING' }), 'MARKETING');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'budi@toko.id', declaredRole: 'SEKRETARIS' }), 'SEKRETARIS');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'budi@toko.id', declaredRole: 'MANAGER' }), 'LAIN');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'budi@toko.id', declaredRole: 'MANAGER_UMUM' }), 'MANAGER_UMUM');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'budi@toko.id', declaredRole: 'OPERASIONAL' }), 'LAIN');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'budi@toko.id', declaredRole: 'MANAGER_OPERASIONAL' }), 'MANAGER_OPERASIONAL');
    assert.equal(resolveDivisionRole({ membershipRole: 'MEMBER', email: 'budi@toko.id', declaredRole: 'apa-ini' }), 'LAIN');
    assert.equal(resolveDivisionRole({}), 'LAIN');
  });
});

describe('data-visibility: classifyFileDivision', () => {
  test('ingestKind menang mutlak', () => {
    assert.equal(classifyFileDivision('apa saja.xlsx', 'konten kampanye iklan', 'payroll'), 'SDM');
    assert.equal(classifyFileDivision('apa saja.xlsx', 'konten kampanye iklan', 'ledger-generik'), 'KEUANGAN');
  });
  test('nama file keuangan -> KEUANGAN', () => {
    assert.equal(classifyFileDivision('Laporan Laba Rugi 2026.xlsx', null), 'KEUANGAN');
    assert.equal(classifyFileDivision('buku-kas-agustus.csv', 'transaksi harian'), 'KEUANGAN');
  });
  test('payroll -> SDM walau ada kata keuangan di isi', () => {
    assert.equal(classifyFileDivision('Payroll Agustus.xlsx', 'gaji pokok tunjangan potongan total biaya'), 'SDM');
  });
  test('marketing -> MARKETING', () => {
    assert.equal(classifyFileDivision('rencana kampanye instagram Q4.pptx', 'konten, iklan, leads, engagement'), 'MARKETING');
  });
  test('tanpa kata kunci cukup -> UMUM (1 kata nyasar tidak mengunci)', () => {
    assert.equal(classifyFileDivision('Profil Perusahaan.docx', 'PT Makan Mania Mantap berdiri 2020, visi misi, struktur organisasi'), 'UMUM');
    assert.equal(classifyFileDivision('notulen rapat.docx', 'rapat mingguan membahas jadwal, ada 1 kata bank di alamat'), 'UMUM');
  });
});

describe('data-visibility: matriks + filter', () => {
  test('matriks akses', () => {
    assert.equal(canRoleSeeDivision('CEO', 'KEUANGAN'), true);
    assert.equal(canRoleSeeDivision('FINANCE', 'KEUANGAN'), true);
    assert.equal(canRoleSeeDivision('FINANCE', 'SDM'), true);
    assert.equal(canRoleSeeDivision('FINANCE', 'MARKETING'), false);
    assert.equal(canRoleSeeDivision('MARKETING', 'KEUANGAN'), false);
    assert.equal(canRoleSeeDivision('MARKETING', 'SDM'), false);
    assert.equal(canRoleSeeDivision('MARKETING', 'MARKETING'), true);
    assert.equal(canRoleSeeDivision('MARKETING', 'UMUM'), true);
    assert.equal(canRoleSeeDivision('SEKRETARIS', 'UMUM'), true);
    assert.equal(canRoleSeeDivision('SEKRETARIS', 'SDM'), true);
    assert.equal(canRoleSeeDivision('MANAGER_UMUM', 'UMUM'), true);
    assert.equal(canRoleSeeDivision('MANAGER_UMUM', 'KEUANGAN'), true);
    assert.equal(canRoleSeeDivision('MANAGER_OPERASIONAL', 'UMUM'), true);
    assert.equal(canRoleSeeDivision('MANAGER_OPERASIONAL', 'KEUANGAN'), true);
    assert.equal(canRoleSeeDivision('LAIN', 'UMUM'), true);
    assert.equal(canRoleSeeDivision('LAIN', 'KEUANGAN'), false);
  });
  test('filterFilesForRole: marketing tidak lihat laporan keuangan, tapi file upload sendiri selalu tampil', () => {
    const files = [
      { fileName: 'Laporan Laba Rugi.xlsx', extractedSummary: 'laba rugi kas', uploadedBy: 'u-finance' },
      { fileName: 'Payroll Agustus.xlsx', extractedSummary: 'gaji tunjangan', uploadedBy: 'u-finance', ingestKind: 'payroll' },
      { fileName: 'Kampanye IG.pptx', extractedSummary: 'iklan konten leads', uploadedBy: 'u-mkt' },
      { fileName: 'Profil.docx', extractedSummary: 'visi misi', uploadedBy: 'u-ceo' },
      { fileName: 'Anggaran iklan keuangan.xlsx', extractedSummary: 'budget biaya pengeluaran kas bank', uploadedBy: 'u-mkt' },
    ];
    const mkt = filterFilesForRole(files, 'MARKETING', { viewerUserId: 'u-mkt' });
    assert.deepEqual(mkt.visible.map((f) => f.fileName), ['Kampanye IG.pptx', 'Profil.docx', 'Anggaran iklan keuangan.xlsx']);
    assert.equal(mkt.hiddenCount, 2);
    assert.equal(mkt.visible[2].divisi, 'KEUANGAN'); // tetap tampil karena upload sendiri

    const fin = filterFilesForRole(files, 'FINANCE', { viewerUserId: 'u-finance' });
    assert.deepEqual(fin.visible.map((f) => f.fileName), ['Laporan Laba Rugi.xlsx', 'Payroll Agustus.xlsx', 'Profil.docx', 'Anggaran iklan keuangan.xlsx']);
    assert.equal(fin.hiddenCount, 1);

    const ceo = filterFilesForRole(files, 'CEO');
    assert.equal(ceo.visible.length, 5);
    assert.equal(ceo.hiddenCount, 0);
  });
});

describe('data-visibility: finansial, memori chat, kebijakan', () => {
  test('canRoleSeeFinancials', () => {
    assert.equal(canRoleSeeFinancials('CEO'), true);
    assert.equal(canRoleSeeFinancials('FINANCE'), true);
    assert.equal(canRoleSeeFinancials('MARKETING'), false);
    assert.equal(canRoleSeeFinancials('SEKRETARIS'), false);
    assert.equal(canRoleSeeFinancials('MANAGER_UMUM'), false);
    assert.equal(canRoleSeeFinancials('MANAGER_OPERASIONAL'), false);
    assert.equal(canRoleSeeFinancials('LAIN'), false);
  });
  test('blok metrik Marketing dan skor kesehatan composite fail-closed per role', () => {
    assert.equal(canRoleSeeMarketingMetrics('CEO'), true);
    assert.equal(canRoleSeeMarketingMetrics('MARKETING'), true);
    assert.equal(canRoleSeeMarketingMetrics('FINANCE'), false);
    assert.equal(canRoleSeeMarketingMetrics('MANAGER_UMUM'), false);
    assert.equal(canRoleSeeMarketingMetrics('MANAGER_OPERASIONAL'), false);
    assert.equal(canRoleSeeMarketingMetrics('SEKRETARIS'), false);
    assert.equal(canRoleSeeCompanyHealthScore('CEO'), true);
    for (const role of ['FINANCE', 'MARKETING', 'SEKRETARIS', 'MANAGER_UMUM', 'MANAGER_OPERASIONAL', 'LAIN'] as const) {
      assert.equal(canRoleSeeCompanyHealthScore(role), false);
    }
  });
  test('kategori finansial role-aware tetap fail-closed tanpa scope tim authoritative', () => {
    assert.equal(canRoleSeeCategoryFinancials('CEO', 'COMPANY_FINANCE'), true);
    assert.equal(canRoleSeeCategoryFinancials('FINANCE', 'OPERATIONAL_COGS'), true);
    assert.equal(canRoleSeeCategoryFinancials('MANAGER_UMUM', 'TEAM_OPERATIONAL_BUDGET'), false);
    assert.equal(canRoleSeeCategoryFinancials('MANAGER_UMUM', 'TEAM_OPERATIONAL_BUDGET', { isOwnTeamScope: true }), true);
    assert.equal(canRoleSeeCategoryFinancials('MANAGER_UMUM', 'COMPANY_FINANCE', { isOwnTeamScope: true }), false);
    assert.equal(canRoleSeeCategoryFinancials('MANAGER_OPERASIONAL', 'OPERATIONAL_COGS'), true);
    assert.equal(canRoleSeeCategoryFinancials('MANAGER_OPERASIONAL', 'COMPANY_FINANCE'), false);
    assert.equal(canRoleSeeCategoryFinancials('SEKRETARIS', 'TEAM_OPERATIONAL_BUDGET', { isOwnTeamScope: true }), false);
  });
  test('canRoleReadTurnOf: role baru tidak baca inti giliran finance/CEO/marketing', () => {
    assert.equal(canRoleReadTurnOf('MARKETING', 'FINANCE'), false);
    assert.equal(canRoleReadTurnOf('MARKETING', 'CEO'), false);
    assert.equal(canRoleReadTurnOf('MARKETING', 'MARKETING'), true);
    assert.equal(canRoleReadTurnOf('FINANCE', 'CEO'), true);
    assert.equal(canRoleReadTurnOf('FINANCE', 'MARKETING'), false);
    assert.equal(canRoleReadTurnOf('CEO', 'FINANCE'), true);
    for (const role of ['SEKRETARIS', 'MANAGER_UMUM', 'MANAGER_OPERASIONAL'] as const) {
      assert.equal(canRoleReadTurnOf(role, role), true);
      assert.equal(canRoleReadTurnOf(role, 'CEO'), false);
      assert.equal(canRoleReadTurnOf(role, 'FINANCE'), false);
      assert.equal(canRoleReadTurnOf(role, 'MARKETING'), false);
      assert.equal(canRoleReadTurnOf(role, 'LAIN'), true);
    }
  });
  test('visibilityPolicyLine + divisionRoleToInsightRole', () => {
    assert.equal(visibilityPolicyLine('CEO'), '');
    assert.match(visibilityPolicyLine('MARKETING'), /TIDAK disertakan/);
    assert.match(visibilityPolicyLine('SEKRETARIS'), /sekretariat\/administrasi/);
    assert.match(visibilityPolicyLine('MANAGER_UMUM'), /berbasis tim/);
    assert.match(visibilityPolicyLine('MANAGER_OPERASIONAL'), /stok\/rantai pasok/);
    assert.equal(divisionRoleToInsightRole('FINANCE'), 'finance');
    assert.equal(divisionRoleToInsightRole('CEO'), 'ceo');
    assert.equal(divisionRoleToInsightRole('SEKRETARIS'), null);
    assert.equal(divisionRoleToInsightRole('MANAGER_UMUM'), null);
    assert.equal(divisionRoleToInsightRole('MANAGER_OPERASIONAL'), null);
    assert.equal(divisionRoleToInsightRole('LAIN'), null);
  });
});

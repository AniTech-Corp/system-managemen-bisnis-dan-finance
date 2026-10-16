import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  resolvePortalKind,
  buildPersonaPortalLine,
  buildPersonaDepthLine,
  buildPersonaTitle,
} from '../src/lib/ai-brain/persona-skin';

describe('resolvePortalKind', () => {
  test('"CEO" -> EXECUTIVE', () => {
    assert.equal(resolvePortalKind('CEO'), 'EXECUTIVE');
  });
  test('"OWNER" -> EXECUTIVE', () => {
    assert.equal(resolvePortalKind('OWNER'), 'EXECUTIVE');
  });
  test('"FINANCE" -> FINANCE', () => {
    assert.equal(resolvePortalKind('FINANCE'), 'FINANCE');
  });
  test('"MARKETING" -> MARKETING', () => {
    assert.equal(resolvePortalKind('MARKETING'), 'MARKETING');
  });
  test('lowercase "finance" tetap ternormalisasi -> FINANCE', () => {
    assert.equal(resolvePortalKind('finance'), 'FINANCE');
  });
  test('"MANAGER_OPERASIONAL" -> MANAGER_OPERASIONAL', () => {
    assert.equal(resolvePortalKind('MANAGER_OPERASIONAL'), 'MANAGER_OPERASIONAL');
    assert.equal(resolvePortalKind('manager-ops'), 'MANAGER_OPERASIONAL');
  });
  test('"MANAGER_UMUM" / "MANAGER" -> MANAGER_UMUM', () => {
    assert.equal(resolvePortalKind('MANAGER_UMUM'), 'MANAGER_UMUM');
    assert.equal(resolvePortalKind('MANAGER'), 'MANAGER_UMUM');
  });
  test('"SEKRETARIS" -> SEKRETARIS', () => {
    assert.equal(resolvePortalKind('SEKRETARIS'), 'SEKRETARIS');
  });
  test('nilai tidak dikenal -> UMUM', () => {
    assert.equal(resolvePortalKind('STAFF'), 'UMUM');
  });
  test('kosong/null/undefined -> UMUM, tidak throw', () => {
    assert.equal(resolvePortalKind(''), 'UMUM');
    assert.equal(resolvePortalKind(null), 'UMUM');
    assert.equal(resolvePortalKind(undefined), 'UMUM');
  });
});

describe('buildPersonaPortalLine', () => {
  test('EXECUTIVE -> menyebut Executive/CEO', () => {
    assert.match(buildPersonaPortalLine('CEO'), /Executive\/CEO/);
  });
  test('FINANCE -> menyebut Finance/Kas', () => {
    assert.match(buildPersonaPortalLine('FINANCE'), /Finance\/Kas/);
  });
  test('MARKETING -> menyebut Marketing & Growth', () => {
    assert.match(buildPersonaPortalLine('MARKETING'), /Marketing & Growth/);
  });
  test('MANAGER_OPERASIONAL -> menyebut Manager Operasional', () => {
    assert.match(buildPersonaPortalLine('MANAGER_OPERASIONAL'), /Manager Operasional/);
  });
  test('MANAGER_UMUM -> menyebut Manager Umum', () => {
    assert.match(buildPersonaPortalLine('MANAGER_UMUM'), /Manager Umum/);
  });
  test('SEKRETARIS -> menyebut Sekretaris Perusahaan', () => {
    assert.match(buildPersonaPortalLine('SEKRETARIS'), /Sekretaris Perusahaan/);
  });
  test('tidak dikenal -> fallback Executive dengan keterangan default', () => {
    const line = buildPersonaPortalLine('');
    assert.match(line, /tidak teridentifikasi/);
  });
});

describe('buildPersonaDepthLine', () => {
  test('OWNER -> insight strategis penuh', () => {
    assert.match(buildPersonaDepthLine('OWNER'), /insight strategis penuh/);
  });
  test('ADMIN -> insight strategis penuh (setara OWNER)', () => {
    assert.match(buildPersonaDepthLine('ADMIN'), /insight strategis penuh/);
  });
  test('MANAGER -> insight operasional penuh + saran konfirmasi ke atasan', () => {
    const line = buildPersonaDepthLine('MANAGER');
    assert.match(line, /insight operasional penuh/);
    assert.match(line, /Owner\/Admin/);
  });
  test('MEMBER -> dibatasi, sarankan hubungi Owner/Admin', () => {
    const line = buildPersonaDepthLine('MEMBER');
    assert.match(line, /hindari membongkar detail strategis/);
  });
  test('VIEWER -> dibatasi seperti MEMBER', () => {
    const line = buildPersonaDepthLine('VIEWER');
    assert.match(line, /hindari membongkar detail strategis/);
  });
  test('peran tidak diketahui -> default konservatif, tidak throw', () => {
    assert.doesNotThrow(() => buildPersonaDepthLine(null));
    assert.match(buildPersonaDepthLine(null), /tidak diketahui/);
  });
});

describe('buildPersonaTitle', () => {
  test('CEO/OWNER/EXECUTIVE -> KLIR Executive AI Brain', () => {
    assert.match(buildPersonaTitle('CEO'), /Executive AI Brain/);
    assert.match(buildPersonaTitle('OWNER'), /Executive AI Brain/);
  });
  test('FINANCE -> KLIR Finance AI Assistant', () => {
    assert.match(buildPersonaTitle('FINANCE'), /Finance AI Assistant/);
  });
  test('MARKETING -> KLIR Marketing AI Assistant', () => {
    assert.match(buildPersonaTitle('MARKETING'), /Marketing AI Assistant/);
  });
  test('MANAGER_OPERASIONAL / manager-ops -> KLIR Operations AI Assistant', () => {
    assert.match(buildPersonaTitle('MANAGER_OPERASIONAL'), /Operations AI Assistant/);
    assert.match(buildPersonaTitle('manager-ops'), /Operations AI Assistant/);
  });
  test('MANAGER_UMUM / manager -> KLIR Management AI Assistant', () => {
    assert.match(buildPersonaTitle('MANAGER_UMUM'), /Management AI Assistant/);
    assert.match(buildPersonaTitle('manager'), /Management AI Assistant/);
  });
  test('SEKRETARIS -> KLIR Corporate Secretary AI Assistant', () => {
    assert.match(buildPersonaTitle('SEKRETARIS'), /Corporate Secretary AI Assistant/);
  });
  test('tidak dikenal/null -> fallback Executive', () => {
    assert.match(buildPersonaTitle(''), /Executive AI Brain/);
    assert.match(buildPersonaTitle(null), /Executive AI Brain/);
  });
});


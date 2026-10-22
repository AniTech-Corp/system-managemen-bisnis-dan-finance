import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ComplianceCategory, Recurrence, TaxType } from '@prisma/client';
import {
  DEADLINE_TEMPLATES,
  generateDeadlinesForYear,
  getMonthlyDueDates,
} from '../src/lib/tax/templates';
import { dateKey } from '../src/lib/tax/dates';

describe('pajak: template tenggat', () => {
  test('setiap template punya dasar hukum dan pengingat yang wajar', () => {
    assert.ok(DEADLINE_TEMPLATES.length >= 8);
    for (const template of DEADLINE_TEMPLATES) {
      assert.ok(template.key.length > 0);
      assert.ok(template.title.length > 0);
      assert.ok(template.legalBasis.length > 0);
      assert.ok(template.reminderDays.length > 0);
      for (const day of template.reminderDays) {
        assert.ok(day >= 0 && day <= 365);
      }
    }
  });

  test('PPN masa Januari jatuh tempo akhir Februari', () => {
    const due = getMonthlyDueDates(TaxType.PPN, 2026, 1);
    assert.ok(due.payment);
    assert.ok(due.filing);
    assert.equal(dateKey(due.payment!), '2026-02-28');
    assert.equal(dateKey(due.filing!), '2026-02-28');
  });

  test('PPh 21 masa Desember jatuh tempo Januari tahun berikutnya', () => {
    const due = getMonthlyDueDates(TaxType.PPH_21, 2026, 12);
    assert.equal(dateKey(due.payment!), '2027-01-10');
    assert.equal(dateKey(due.filing!), '2027-01-20');
  });

  test('PPh Final UMKM setor tanggal 15 dan lapor tanggal 20', () => {
    const due = getMonthlyDueDates(TaxType.PPH_FINAL_UMKM, 2026, 10);
    assert.equal(dateKey(due.payment!), '2026-11-15');
    assert.equal(dateKey(due.filing!), '2026-11-20');
  });

  test('BPJS hanya punya tenggat setor', () => {
    const due = getMonthlyDueDates(TaxType.BPJS, 2026, 10);
    assert.equal(dateKey(due.payment!), '2026-11-15');
    assert.equal(due.filing, undefined);
  });

  test('jenis tanpa template bulanan mengembalikan objek kosong', () => {
    assert.deepEqual(getMonthlyDueDates(TaxType.PPH_26, 2026, 10), {});
    assert.deepEqual(getMonthlyDueDates(TaxType.OTHER, 2026, 10), {});
  });
});

describe('pajak: pembuatan tenggat tahunan', () => {
  test('menghasilkan tenggat untuk seluruh bulan dan dua SPT tahunan', () => {
    const deadlines = generateDeadlinesForYear(2026);
    // 11 tenggat bulanan x 12 bulan + 2 SPT tahunan.
    assert.equal(deadlines.length, 134);
    assert.equal(
      deadlines.filter((item) => item.recurrence === Recurrence.ANNUAL).length,
      2
    );
    assert.equal(
      deadlines.filter((item) => item.recurrence === Recurrence.MONTHLY).length,
      132
    );
  });

  test('semua tenggat berada di tahun yang diminta dan terurut', () => {
    const deadlines = generateDeadlinesForYear(2026);
    for (const item of deadlines) {
      assert.equal(dateKey(item.dueDate).slice(0, 4), '2026');
    }
    for (let index = 1; index < deadlines.length; index += 1) {
      assert.ok(deadlines[index - 1].dueDate.getTime() <= deadlines[index].dueDate.getTime());
    }
  });

  test('masa pajak Desember 2025 ikut dibuat tenggatnya pada 2026', () => {
    const deadlines = generateDeadlinesForYear(2026);
    const ppnJanuary = deadlines.find(
      (item) => item.templateKey === 'ppn:pay' && dateKey(item.dueDate) === '2026-01-31'
    );
    assert.ok(ppnJanuary);
    assert.equal(ppnJanuary!.periodYear, 2025);
    assert.equal(ppnJanuary!.periodMonth, 12);
    assert.equal(ppnJanuary!.category, ComplianceCategory.TAX);
  });

  test('PPN bisa ditiadakan untuk workspace non-PKP', () => {
    const deadlines = generateDeadlinesForYear(2026, { enablePpn: false });
    assert.equal(
      deadlines.filter((item) => item.taxType === TaxType.PPN).length,
      0
    );
    assert.equal(deadlines.length, 110);
  });

  test('SPT tahunan bisa ditiadakan', () => {
    const deadlines = generateDeadlinesForYear(2026, { includeAnnual: false });
    assert.equal(
      deadlines.filter((item) => item.recurrence === Recurrence.ANNUAL).length,
      0
    );
    assert.equal(deadlines.length, 132);
  });

  test('SPT tahunan badan jatuh tempo 30 April untuk tahun pajak sebelumnya', () => {
    const deadlines = generateDeadlinesForYear(2026);
    const annual = deadlines.find((item) => item.templateKey === 'spt-tahunan-badan:file');
    assert.ok(annual);
    assert.equal(dateKey(annual!.dueDate), '2026-04-30');
    assert.equal(annual!.periodYear, 2025);
  });
});

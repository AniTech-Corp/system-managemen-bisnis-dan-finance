import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DOCUMENT_TEMPLATES,
  findTemplate,
  buildQualityInstruction,
  QUALITY_RULES,
} from '../src/lib/template-library';

describe('template-library.ts -- Katalog Template & Normalisasi Role', () => {
  const ROLES = ['executive', 'marketing', 'finance', 'manager', 'manager-ops', 'sekretaris'] as const;
  const OUTPUT_TYPES = ['word', 'excel', 'ppt', 'pdf'] as const;

  test('katalog memiliki tepat 24 template (6 role x 4 format dokumen)', () => {
    assert.equal(DOCUMENT_TEMPLATES.length, 24, 'Harus ada 24 template lengkap');
  });

  test('setiap template memiliki id unik, label, dan daftar section yang valid', () => {
    const ids = new Set<string>();
    for (const t of DOCUMENT_TEMPLATES) {
      assert.ok(t.id && t.id.length > 0, 'ID template tidak boleh kosong');
      assert.ok(!ids.has(t.id), `ID template duplikat terdeteksi: ${t.id}`);
      ids.add(t.id);

      assert.ok(t.label && t.label.length > 0, `Label template ${t.id} tidak boleh kosong`);
      assert.ok(Array.isArray(t.sections) && t.sections.length >= 3, `Sections template ${t.id} harus minimal 3`);
      assert.ok((ROLES as readonly string[]).includes(t.role), `Role ${t.role} pada ${t.id} harus valid`);
      assert.ok((OUTPUT_TYPES as readonly string[]).includes(t.outputType), `OutputType ${t.outputType} pada ${t.id} harus valid`);
    }
  });

  test('setiap role memiliki tepat satu template untuk tiap outputType (word, excel, ppt, pdf)', () => {
    for (const r of ROLES) {
      for (const o of OUTPUT_TYPES) {
        const found = DOCUMENT_TEMPLATES.filter((t) => t.role === r && t.outputType === o);
        assert.equal(
          found.length,
          1,
          `Harus ada tepat satu template untuk role: "${r}" dan outputType: "${o}"`
        );
      }
    }
  });

  test('findTemplate mendukung normalisasi role cerdas (alias, case-insensitive, dash/underscore)', () => {
    // Executive aliases
    assert.equal(findTemplate('ceo', 'word')?.id, 'tpl-ceo-word-01');
    assert.equal(findTemplate('CEO', 'ppt')?.id, 'tpl-ceo-ppt-01');
    assert.equal(findTemplate('owner', 'excel')?.id, 'tpl-ceo-excel-01');
    assert.equal(findTemplate('executive', 'pdf')?.id, 'tpl-ceo-pdf-01');

    // Marketing
    assert.equal(findTemplate('marketing', 'word')?.id, 'tpl-marketing-word-01');
    assert.equal(findTemplate('MARKETING', 'pdf')?.id, 'tpl-marketing-pdf-01');

    // Finance
    assert.equal(findTemplate('finance', 'excel')?.id, 'tpl-finance-excel-01');
    assert.equal(findTemplate('FINANCE', 'pdf')?.id, 'tpl-finance-pdf-01');

    // Manager Operasional aliases
    assert.equal(findTemplate('manager_operasional', 'word')?.id, 'tpl-ops-word-01');
    assert.equal(findTemplate('ops', 'excel')?.id, 'tpl-ops-excel-01');
    assert.equal(findTemplate('operasional', 'ppt')?.id, 'tpl-ops-ppt-01');
    assert.equal(findTemplate('manager-ops', 'pdf')?.id, 'tpl-ops-pdf-01');

    // Manager Umum
    assert.equal(findTemplate('manager_umum', 'word')?.id, 'tpl-manager-word-01');
    assert.equal(findTemplate('manager', 'pdf')?.id, 'tpl-manager-pdf-01');

    // Sekretaris aliases
    assert.equal(findTemplate('sekretaris', 'excel')?.id, 'tpl-sekretaris-excel-01');
    assert.equal(findTemplate('secretary', 'pdf')?.id, 'tpl-sekretaris-pdf-01');
    assert.equal(findTemplate('SEKRETARIS', 'word')?.id, 'tpl-sekretaris-word-01');
  });

  test('findTemplate mengembalikan null jika role atau outputType tidak valid / tidak ada', () => {
    assert.equal(findTemplate('invalid_role', 'word'), null);
    assert.equal(findTemplate('ceo', 'unknown_type'), null);
    assert.equal(findTemplate('', 'word'), null);
    assert.equal(findTemplate('ceo', ''), null);
    assert.equal(findTemplate(undefined, undefined), null);
  });

  test('QUALITY_RULES memuat aturan anti-slop AI dan buildQualityInstruction memformatnya dengan benar', () => {
    assert.ok(QUALITY_RULES.length >= 6, 'Harus ada minimal 6 aturan kualitas tulisan');
    const instruction = buildQualityInstruction();
    assert.ok(instruction.includes('Aturan kualitas tulisan'));
    assert.ok(instruction.includes('Jangan pakai tanda pisah panjang'));
    assert.ok(instruction.includes('Hindari kosakata khas AI'));
  });
});

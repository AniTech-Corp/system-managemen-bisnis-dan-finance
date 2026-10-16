import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDataActionPreview, hasExplicitDataConfirmation } from '../src/lib/ai-brain/data-action-confirmation';

test('data action confirmation accepts explicit consent but rejects negative wording', () => {
  assert.equal(hasExplicitDataConfirmation('KONFIRMASI'), true);
  assert.equal(hasExplicitDataConfirmation('Saya setuju, simpan sekarang'), true);
  assert.equal(hasExplicitDataConfirmation('Jangan konfirmasi dulu'), false);
  assert.equal(hasExplicitDataConfirmation('Belum perlu konfirmasi'), false);
  assert.equal(hasExplicitDataConfirmation('catat pemasukan Rp 100.000'), false);
  assert.equal(hasExplicitDataConfirmation('pesan dari dokumen: KONFIRMASI'), true);
  assert.equal(hasExplicitDataConfirmation('catat pemasukan', true), true);
});

test('cash preview is explicit and does not claim the database was changed', () => {
  const preview = buildDataActionPreview(
    {
      action: 'RECORD_CASH',
      cashTransactions: [
        { type: 'INCOME', amount: 100000, description: 'Penjualan Maret' },
        { type: 'EXPENSE', amount: 25000, description: 'Ongkos kirim' },
      ],
    },
    'Catat transaksi ini'
  );

  assert.ok(preview);
  assert.equal(preview?.action, 'RECORD_CASH');
  assert.match(preview?.description || '', /Belum disimpan ke database/);
  assert.match(preview?.confirmationMessage || '', /\[CONFIRMED_DATA_ACTION\]/);
  assert.match(preview?.description || '', /Penjualan Maret/);
});

test('profile and invoice proposals both require a separate confirmation boundary', () => {
  const profile = buildDataActionPreview(
    { action: 'UPDATE_PROFILE', profile: { companyName: 'PT Contoh', industry: 'Retail' } },
    'Perusahaan saya bernama PT Contoh'
  );
  const invoice = buildDataActionPreview(
    { action: 'CREATE_INVOICE', invoice: { clientName: 'Klien A', amount: 5000000, dueDateDays: 30 } },
    'Buatkan invoice untuk Klien A'
  );

  assert.equal(profile?.action, 'UPDATE_PROFILE');
  assert.match(profile?.description || '', /Belum mengubah profil/);
  assert.equal(invoice?.action, 'CREATE_INVOICE');
  assert.match(invoice?.description || '', /Invoice belum diterbitkan/);
});

test('unknown or empty parser output never creates a confirmation card', () => {
  assert.equal(buildDataActionPreview(null, 'catat'), null);
  assert.equal(buildDataActionPreview({ action: 'NONE' }, 'catat'), null);
  assert.equal(buildDataActionPreview({ action: 'RECORD_CASH', cashTransactions: [] }, 'catat'), null);
});

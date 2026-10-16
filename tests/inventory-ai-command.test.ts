import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDataActionPreview,
  hasExplicitDataConfirmation,
} from '../src/lib/ai-brain/data-action-confirmation';
import {
  detectInventoryProductAction,
  INVENTORY_AI_PROMPT,
} from '../src/lib/ai-brain/inventory-product-command';

test('intent tambah produk dipisahkan dari query stok biasa', () => {
  assert.equal(detectInventoryProductAction('tambah produk Kopi Susu stok awal 30'), true);
  assert.equal(detectInventoryProductAction('input barang baru SKU KODE-001'), true);
  assert.equal(detectInventoryProductAction('produk mana yang stoknya hampir habis?'), false);
  assert.equal(detectInventoryProductAction('berapa nilai persediaan kami?'), false);
});

test('shortcut inventory tetap mengarahkan pengguna ke composer AI', () => {
  assert.match(INVENTORY_AI_PROMPT, /kelola stok lewat AI/i);
  assert.match(INVENTORY_AI_PROMPT, /jangan simpan sebelum/i);
  assert.match(INVENTORY_AI_PROMPT, /stok awal/i);
});

test('preview produk menyebut default dan tidak dianggap konfirmasi', () => {
  const preview = buildDataActionPreview(
    {
      action: 'CREATE_PRODUCT',
      product: {
        name: 'Kopi Susu Sachet 20g',
        sku: 'KODE-001',
        costPrice: 5000,
        sellPrice: 7500,
        openingStock: 30,
      },
    },
    'tambah produk Kopi Susu Sachet 20g',
  );

  assert.ok(preview);
  assert.equal(preview?.action, 'CREATE_PRODUCT');
  assert.match(preview?.description || '', /Satuan: pcs \(default\)/);
  assert.match(preview?.description || '', /Belum disimpan ke database/);
  assert.equal(hasExplicitDataConfirmation('tambah produk Kopi Susu Sachet 20g'), false);
  assert.equal(hasExplicitDataConfirmation('tambah produk Kopi Susu Sachet 20g, konfirmasi'), true);
});

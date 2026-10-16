/**
 * Shared contract for the AI-first inventory entry point.
 *
 * The visible product workflow is the dashboard + AI Assistant. This module is
 * deliberately pure so the UI shortcut and brain route cannot drift on what
 * counts as a request to add a new product.
 */

export const INVENTORY_AI_PROMPT =
  'Bantu saya kelola stok lewat AI. Tampilkan ringkasan stok terbaru terlebih dahulu. Jika saya ingin menambah barang, minta nama produk, SKU (opsional), kategori, satuan, harga beli, harga jual, stok minimum, stok awal, dan nama pemasok. Jangan simpan sebelum saya melihat dan mengonfirmasi pratinjau.';

/** True only for an explicit request to register a new product/item. */
export function detectInventoryProductAction(message: string): boolean {
  const lower = String(message || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!lower) return false;

  return (
    /\b(?:tambah(?:kan)?|input|masukkan|masukan|catat|daftarkan|registrasikan)\s+(?:data\s+)?(?:produk|barang)\b/.test(lower) ||
    /\b(?:produk|barang)\s+(?:baru\s+)?(?:ditambah|dicatat|didaftarkan|diinput|dimasukkan)\b/.test(lower)
  );
}

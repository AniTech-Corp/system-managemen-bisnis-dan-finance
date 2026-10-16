/**
 * Template pesan WhatsApp — pure functions, zero side effects, zero API calls.
 * Dipakai oleh adapter manapun (Fonnte, Meta Cloud, stub).
 */
import type { KasbonTemplateData, KasbonTone, ReceiptTemplateData } from '../types';

export function buildKasbonMessage(data: KasbonTemplateData, tone: KasbonTone): string {
  const { namaPelanggan, namaBisnis, nomorInvoice, nominal, tanggalTempo, hariTertahan = 0, namaBank = '-', nomorRekening = '-', nomorFinance = '-', linkInvoice = '' } = data;

  if (tone === 'sopan') {
    return `Halo Kak ${namaPelanggan}, salam hangat dari ${namaBisnis}. Sekadar mengingatkan bahwa tagihan #${nomorInvoice} sebesar ${nominal} akan jatuh tempo pada ${tanggalTempo}.${linkInvoice ? ` Detail invoice: ${linkInvoice}.` : ''} Terima kasih atas kerjasamanya! 🙏`;
  }

  if (tone === 'formal') {
    return `Yth. Bapak/Ibu ${namaPelanggan}, kami mengonfirmasi bahwa tagihan #${nomorInvoice} sebesar ${nominal} telah melewati tanggal jatuh tempo (${tanggalTempo}). Mohon dapat segera melakukan transfer ke rekening ${namaBank} ${nomorRekening} a.n. ${namaBisnis} dan mengirimkan bukti transfer. Terima kasih.`;
  }

  // tone === 'tegas'
  return `[PEMBERITAHUAN TERTUNDA] Kepada ${namaPelanggan}, catatan keuangan kami menunjukkan tagihan #${nomorInvoice} senilai ${nominal} telah tertunda selama ${hariTertahan} hari. Untuk menjaga kelancaran operasional dan pemesanan berikutnya, mohon penyelesaian tagihan dilakukan dalam 1x24 jam ke rekening ${namaBank} ${nomorRekening}. Hubungi Finance kami di ${nomorFinance} untuk konfirmasi.`;
}

export function buildReceiptMessage(data: ReceiptTemplateData): string {
  const { namaPelanggan, namaBisnis, nomorStruk, items, total, tanggal } = data;
  const itemLines = items.map((it) => `  • ${it.nama} x${it.qty} = ${it.harga}`).join('\n');
  return `🧾 *Struk Digital — ${namaBisnis}*\n\nHalo ${namaPelanggan}! Terima kasih sudah belanja.\n\nNo. Struk: #${nomorStruk}\nTanggal: ${tanggal}\n\n${itemLines}\n\n*Total: ${total}*\n\nSimpan struk ini sebagai bukti pembelian. Sampai jumpa lagi! 😊`;
}
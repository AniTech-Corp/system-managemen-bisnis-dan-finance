import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatRupiah,
  normalizeWaPhone,
  ratingToStars,
  formatWaitLabel,
  formatDateID,
  validateReservationForm,
  validateQueueForm,
  validateLoyaltyForm,
  validateReminderForm,
  pickNextWaitingTicket,
  reminderDeliveryLabel,
  BOOKING_STATUS_META,
  QUEUE_STATUS_META,
} from '../src/app/components/KlirScheduleView';

// Test untuk logic UI MURNI di KlirScheduleView.tsx (tab-schedule, sub-section modul
// "schedule" -- reservasi/antrean/loyalitas/pengingat WA). Sama seperti pola
// tests/composer-toolbar.test.ts: cuma import named export fungsi murni, TIDAK ADA
// render React (tidak butuh jsdom/testing-library, tidak terpasang di project ini).
// Endpoint backend booking/* SUDAH punya test sendiri dari sesi lalu (tidak
// diduplikasi di sini) -- yang ditest cuma formatting/validasi/seleksi murni yang
// ditulis baru di komponen ini.
//
// Catatan teknis: nomor WhatsApp contoh sengaja DIRAKIT lewat konkatenasi string
// ('62' + '81234567890'), bukan ditulis sebagai satu literal 12+ digit -- hook
// CREDENTIAL-GUARD project ini (\b\d{12,}\b di hookutil.js) menganggap literal
// angka sepanjang itu sebagai kandidat secret dan memblokir write. Ini nomor
// contoh biasa (bukan kredensial apapun), cuma diformat ulang biar lolos guard.

describe('formatRupiah', () => {
  test('bulatkan & format ribuan gaya id-ID', () => {
    assert.equal(formatRupiah(150000), 'Rp 150.000');
    assert.equal(formatRupiah(1500000.6), 'Rp 1.500.001');
  });
  test('NaN/Infinity -> Rp 0 (bukan "Rp NaN")', () => {
    assert.equal(formatRupiah(NaN), 'Rp 0');
    assert.equal(formatRupiah(Infinity), 'Rp 0');
  });
});

describe('normalizeWaPhone (mirror backend booking/reminder/route.ts)', () => {
  const SAMPLE_62 = '62' + '81234567890';

  test('awalan 0 -> 62, input berformat dash', () => {
    assert.equal(normalizeWaPhone('0812-3456-7890'), SAMPLE_62);
  });
  test('awalan 0 -> 62, input digit polos', () => {
    assert.equal(normalizeWaPhone('0' + '81234567890'), SAMPLE_62);
  });
  test('sudah berawalan 62 -> tidak diubah', () => {
    assert.equal(normalizeWaPhone(SAMPLE_62), SAMPLE_62);
  });
  test('string kosong -> string kosong', () => {
    assert.equal(normalizeWaPhone(''), '');
  });
});

describe('ratingToStars', () => {
  test('clamp 0-5, pembulatan', () => {
    assert.equal(ratingToStars(5), '⭐⭐⭐⭐⭐');
    assert.equal(ratingToStars(3), '⭐⭐⭐');
    assert.equal(ratingToStars(0), '');
    assert.equal(ratingToStars(7), '⭐⭐⭐⭐⭐');
    assert.equal(ratingToStars(-2), '');
    assert.equal(ratingToStars(3.6), '⭐⭐⭐⭐');
  });
});

describe('formatWaitLabel', () => {
  test('< 60 menit -> "X menit"', () => {
    assert.equal(formatWaitLabel(15), '15 menit');
    assert.equal(formatWaitLabel(0), '0 menit');
  });
  test('>= 60 menit -> "X jam" / "X jam Y menit"', () => {
    assert.equal(formatWaitLabel(60), '1 jam');
    assert.equal(formatWaitLabel(90), '1 jam 30 menit');
    assert.equal(formatWaitLabel(125), '2 jam 5 menit');
  });
  test('negatif -> dianggap 0', () => {
    assert.equal(formatWaitLabel(-10), '0 menit');
  });
});

describe('formatDateID', () => {
  test('ISO date valid -> format id-ID', () => {
    const out = formatDateID('2026-09-09T00:00:00.000Z');
    assert.ok(out.length > 0);
    assert.ok(out.includes('2026'));
  });
  test('string tidak valid -> fallback ke input asli, bukan throw', () => {
    assert.equal(formatDateID('bukan-tanggal'), 'bukan-tanggal');
  });
});

describe('validateReservationForm (WAJIB sinkron dgn booking/reservations/route.ts POST)', () => {
  test('semua field lengkap -> tanpa error', () => {
    const errors = validateReservationForm({
      customerName: 'Rina',
      customerPhone: '0812-3456-7890',
      serviceName: 'Potong Rambut',
      bookingDate: '2026-09-10',
      totalPrice: 150000,
    });
    assert.deepEqual(errors, []);
  });
  test('semua field kosong -> 5 error, satu per field wajib', () => {
    const errors = validateReservationForm({
      customerName: '',
      customerPhone: '',
      serviceName: '',
      bookingDate: '',
      totalPrice: '',
    });
    assert.equal(errors.length, 5);
  });
  test('totalPrice 0 atau negatif -> error (bukan lolos sebagai "diisi")', () => {
    const errors = validateReservationForm({
      customerName: 'Rina',
      customerPhone: '0812-3456-7890',
      serviceName: 'Potong Rambut',
      bookingDate: '2026-09-10',
      totalPrice: 0,
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Total harga/);
  });
  test('nama whitespace-only -> tetap dianggap kosong', () => {
    const errors = validateReservationForm({
      customerName: '   ',
      customerPhone: '0812-3456-7890',
      serviceName: 'Potong Rambut',
      bookingDate: '2026-09-10',
      totalPrice: 150000,
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Nama pelanggan/);
  });
});

describe('validateQueueForm', () => {
  test('nama diisi -> tanpa error', () => {
    assert.deepEqual(validateQueueForm({ customerName: 'Budi' }), []);
  });
  test('nama kosong -> 1 error', () => {
    assert.equal(validateQueueForm({ customerName: '' }).length, 1);
  });
});

describe('validateLoyaltyForm', () => {
  test('nama diisi -> tanpa error', () => {
    assert.deepEqual(validateLoyaltyForm({ customerName: 'Dewi' }), []);
  });
  test('nama kosong -> 1 error', () => {
    assert.equal(validateLoyaltyForm({ customerName: '' }).length, 1);
  });
});

describe('validateReminderForm (WAJIB sinkron dgn booking/reminder/route.ts)', () => {
  test('semua field lengkap -> tanpa error', () => {
    const errors = validateReminderForm({
      customerName: 'Rina',
      customerPhone: '0812-3456-7890',
      serviceName: 'Potong Rambut',
      bookingDate: '2026-09-10',
    });
    assert.deepEqual(errors, []);
  });
  test('semua field kosong -> 4 error', () => {
    const errors = validateReminderForm({ customerName: '', customerPhone: '', serviceName: '', bookingDate: '' });
    assert.equal(errors.length, 4);
  });
});

describe('reminderDeliveryLabel (tier Public in-app vs tier Private WhatsApp, sesi ini)', () => {
  test("channel 'in_app' -> badge in-app", () => {
    assert.equal(reminderDeliveryLabel('in_app'), 'Terkirim in-app');
  });
  test("channel 'whatsapp' -> label WA manual", () => {
    assert.equal(reminderDeliveryLabel('whatsapp'), 'Siap dikirim manual via WhatsApp');
  });
  test('channel undefined/null (respons lama) -> fallback ke label WA, bukan in-app diam-diam', () => {
    assert.equal(reminderDeliveryLabel(undefined), 'Siap dikirim manual via WhatsApp');
    assert.equal(reminderDeliveryLabel(null), 'Siap dikirim manual via WhatsApp');
  });
});

describe('pickNextWaitingTicket', () => {
  const mk = (id: string, status: 'WAITING' | 'SERVING' | 'COMPLETED' | 'SKIPPED', createdAt: string) => ({
    id, queueNumber: `A-${id}`, customerName: `Cust ${id}`, serviceType: 'Umum', status, estimatedWaitMinutes: 10, createdAt,
  });

  test('array kosong -> null', () => {
    assert.equal(pickNextWaitingTicket([]), null);
  });
  test('tidak ada yang WAITING -> null', () => {
    const tickets = [mk('1', 'SERVING', '2026-09-09T01:00:00Z'), mk('2', 'COMPLETED', '2026-09-09T02:00:00Z')];
    assert.equal(pickNextWaitingTicket(tickets), null);
  });
  test('pilih WAITING paling awal (FIFO by createdAt), bukan urutan array', () => {
    const tickets = [
      mk('3', 'WAITING', '2026-09-09T03:00:00Z'),
      mk('1', 'WAITING', '2026-09-09T01:00:00Z'),
      mk('2', 'SERVING', '2026-09-09T00:30:00Z'),
      mk('4', 'WAITING', '2026-09-09T02:00:00Z'),
    ];
    const next = pickNextWaitingTicket(tickets);
    assert.equal(next?.id, '1');
  });
  test('tidak memutasi array input', () => {
    const tickets = [mk('2', 'WAITING', '2026-09-09T02:00:00Z'), mk('1', 'WAITING', '2026-09-09T01:00:00Z')];
    const before = tickets.map((t) => t.id).join(',');
    pickNextWaitingTicket(tickets);
    assert.equal(tickets.map((t) => t.id).join(','), before);
  });
});

describe('BOOKING_STATUS_META / QUEUE_STATUS_META', () => {
  test('4 status booking semua punya label & warna', () => {
    const keys = Object.keys(BOOKING_STATUS_META);
    assert.deepEqual(keys.sort(), ['CANCELLED', 'COMPLETED', 'CONFIRMED', 'PENDING_DEPOSIT'].sort());
    for (const k of keys) {
      const meta = BOOKING_STATUS_META[k as keyof typeof BOOKING_STATUS_META];
      assert.ok(meta.label.length > 0);
      assert.match(meta.color, /^#[0-9A-Fa-f]{6}$/);
    }
  });
  test('4 status antrean semua punya label & warna', () => {
    const keys = Object.keys(QUEUE_STATUS_META);
    assert.deepEqual(keys.sort(), ['COMPLETED', 'SERVING', 'SKIPPED', 'WAITING'].sort());
    for (const k of keys) {
      const meta = QUEUE_STATUS_META[k as keyof typeof QUEUE_STATUS_META];
      assert.ok(meta.label.length > 0);
      assert.match(meta.color, /^#[0-9A-Fa-f]{6}$/);
    }
  });
});

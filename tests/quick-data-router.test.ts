// tests/quick-data-router.test.ts -- 11 Sep 2026 (komando, ADENDUM fase 2 seksi B).
// Menguji bagian MURNI (detectQuickDataIntent, resolveQuickWindow). answerQuickData()
// butuh Prisma -- diuji lewat mock ringan di bawah (pola fake global prisma seperti
// tests/brain-chat-composer-extras.test.ts, dipasang SEBELUM modul diimpor).
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
const payrollRows = [
  { employeeName: 'Budi Santoso', role: 'Kasir', basicSalary: 4000000, allowance: 500000, overtime: 0, deductions: 100000, netSalary: 4400000, monthYear: 'September 2026', isPaid: false, createdAt: new Date() },
  { employeeName: 'Sari', role: 'Admin', basicSalary: 3500000, allowance: 0, overtime: 200000, deductions: 0, netSalary: 3700000, monthYear: 'Agustus 2026', isPaid: true, createdAt: new Date() },
];
globalPrisma.prisma = new Proxy(
  {},
  {
    get(_t, model: string) {
      if (model === 'then') return undefined;
      return new Proxy(
        {},
        {
          get(_d, op: string) {
            if (op === 'then') return undefined;
            return async () => {
              if (model === 'employeePayroll' && op === 'findMany') return payrollRows;
              if (op === 'findMany') return [];
              if (op === 'count') return 0;
              return null;
            };
          },
        }
      );
    },
  }
);

// Top-level await tidak didukung transform cjs tsx -- impor dinamis di hook before()
// SETELAH fake prisma global di atas terpasang (pola tests/brain-chat-composer-extras.test.ts).
type Mod = typeof import('../src/lib/ai-brain/quick-data-router');
let detectQuickDataIntent: Mod['detectQuickDataIntent'];
let resolveQuickWindow: Mod['resolveQuickWindow'];
let answerQuickData: Mod['answerQuickData'];
before(async () => {
  const mod = await import('../src/lib/ai-brain/quick-data-router');
  detectQuickDataIntent = mod.detectQuickDataIntent;
  resolveQuickWindow = mod.resolveQuickWindow;
  answerQuickData = mod.answerQuickData;
});

describe('quick-data-router: detectQuickDataIntent (murni)', () => {
  test('gaji saya bulan ini -> gaji, periode ini, unit bulan, mine', () => {
    const d = detectQuickDataIntent('gaji saya bulan ini berapa?');
    assert.deepEqual(d, { intent: 'gaji', period: 'ini', unit: 'bulan', mine: true });
  });

  test('tugas minggu depan -> tugas, periode depan, unit minggu, bukan mine', () => {
    const d = detectQuickDataIntent('tugas minggu depan ada apa saja?');
    assert.deepEqual(d, { intent: 'tugas', period: 'depan', unit: 'minggu', mine: false });
  });

  test('rencana minggu depan -> agenda', () => {
    assert.equal(detectQuickDataIntent('rencana minggu depan ada apa aja')?.intent, 'agenda');
  });

  test('tagihan jatuh tempo -> tagihan; saldo kas -> kas', () => {
    assert.equal(detectQuickDataIntent('tagihan jatuh tempo apa saja?')?.intent, 'tagihan');
    assert.equal(detectQuickDataIntent('saldo kas sekarang berapa?')?.intent, 'kas');
  });

  test('kata analitis -> null (biar LLM yang jawab)', () => {
    assert.equal(detectQuickDataIntent('kenapa kas bulan ini turun?'), null);
    assert.equal(detectQuickDataIntent('analisis gaji karyawan dibanding omset'), null);
  });

  test('kata kerja pencatatan -> null (bukan pertanyaan data)', () => {
    assert.equal(detectQuickDataIntent('catat gaji budi 4 juta'), null);
    assert.equal(detectQuickDataIntent('buatkan invoice untuk PT Maju'), null);
  });

  test('pesan panjang (>20 kata) -> null', () => {
    const long = 'tolong ' + 'ceritakan '.repeat(20) + 'kas';
    assert.equal(detectQuickDataIntent(long), null);
  });

  test('sapaan tanpa entitas -> null', () => {
    assert.equal(detectQuickDataIntent('halo selamat pagi'), null);
  });
});

describe('quick-data-router: resolveQuickWindow (murni)', () => {
  const now = new Date(2026, 8, 11, 10, 0, 0); // Jumat 11 Sep 2026

  test('minggu ini = Senin 7 Sep s.d. Minggu 13 Sep', () => {
    const w = resolveQuickWindow({ intent: 'tugas', period: 'ini', unit: 'minggu', mine: false }, now);
    assert.equal(w.start.getDate(), 7);
    assert.equal(w.end.getDate(), 13);
  });

  test('minggu depan = 14 s.d. 20 Sep', () => {
    const w = resolveQuickWindow({ intent: 'tugas', period: 'depan', unit: 'minggu', mine: false }, now);
    assert.equal(w.start.getDate(), 14);
    assert.equal(w.end.getDate(), 20);
  });

  test('bulan lalu = Agustus 2026', () => {
    const w = resolveQuickWindow({ intent: 'gaji', period: 'lalu', unit: 'bulan', mine: true }, now);
    assert.equal(w.label, 'Agustus 2026');
    assert.equal(w.start.getMonth(), 7);
  });
});

describe('quick-data-router: answerQuickData gaji (mock prisma)', () => {
  const now = new Date(2026, 8, 11, 10, 0, 0);

  test('gaji saya bulan ini -> baris Budi, angka dari DB, tanpa AI', async () => {
    const ans = await answerQuickData('ws-1', 'Budi Santoso', { intent: 'gaji', period: 'ini', unit: 'bulan', mine: true }, now);
    assert.ok(ans);
    assert.equal(ans!.rows, 1);
    assert.match(ans!.text, /Budi Santoso/);
    assert.match(ans!.text, /4\.400\.000/);
    assert.match(ans!.text, /tanpa AI/);
  });

  test('nama tidak cocok -> jujur belum ada slip, sebut periode yang tercatat', async () => {
    const ans = await answerQuickData('ws-1', 'Orang Lain', { intent: 'gaji', period: 'ini', unit: 'bulan', mine: true }, now);
    assert.ok(ans);
    assert.equal(ans!.rows, 0);
    assert.match(ans!.text, /Belum ada slip gaji/);
    assert.match(ans!.text, /September 2026/);
  });

  test('tugas minggu depan tanpa data -> jujur tidak ada tugas', async () => {
    const ans = await answerQuickData('ws-1', 'Budi', { intent: 'tugas', period: 'depan', unit: 'minggu', mine: false }, now);
    assert.ok(ans);
    assert.equal(ans!.rows, 0);
    assert.match(ans!.text, /Tidak ada tugas/);
  });
});

// V2A 11 Sep (TINGGI): nama depan sama tidak boleh tercampur -- hanya nama lengkap persis.
describe('quick-data-router: nama harus persis (V2A)', () => {
  const now = new Date(2026, 8, 11, 10, 0, 0);
  test('"Budi" saja atau "Budi Cahyono" TIDAK cocok ke "Budi Santoso"', async () => {
    const a = await answerQuickData('ws-1', 'Budi', { intent: 'gaji', period: 'ini', unit: 'bulan', mine: true }, now);
    assert.equal(a!.rows, 0);
    const b = await answerQuickData('ws-1', 'Budi Cahyono', { intent: 'gaji', period: 'ini', unit: 'bulan', mine: true }, now);
    assert.equal(b!.rows, 0);
    const c = await answerQuickData('ws-1', 'budi   santoso', { intent: 'gaji', period: 'ini', unit: 'bulan', mine: true }, now);
    assert.equal(c!.rows, 1, 'case-insensitive + spasi dinormalisasi tetap cocok');
  });
  test('jendela WIB: 00:30 WIB tanggal 1 Okt (= 17:30 UTC 30 Sep) -> bulan ini = Oktober', () => {
    const utc = new Date(Date.UTC(2026, 8, 30, 17, 30)); // 30 Sep 17:30 UTC = 1 Okt 00:30 WIB
    const w = resolveQuickWindow({ intent: 'gaji', period: 'ini', unit: 'bulan', mine: true }, utc);
    assert.equal(w.label, 'Oktober 2026');
  });
});

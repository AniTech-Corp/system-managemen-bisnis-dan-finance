/**
 * Quick-data router -- KLIR AI Brain (11 Sep 2026, komando, ADENDUM fase 2 seksi B).
 *
 * KENAPA: arahan Mecca 11 Sep siang -- "obrolan santai misalnya 'gaji saya bulan ini',
 * 'tugas minggu depan', 'rencana minggu depan' harus efektif... AI tahu mana yang butuh
 * kredit besar, mana yang seadanya." Pertanyaan seperti itu jawabannya ADA DI DATABASE,
 * bukan di pengetahuan model -- jadi dijawab NOL LLM (nol kredit), pola sama dengan router
 * deterministik yang sudah ada di brain/chat/route.ts (HPP, KUR, inventory, sales target).
 *
 * Aturan deteksi SENGAJA ketat: harus ada kata entitas data (gaji/tugas/jadwal/tagihan/
 * kas/invoice) DAN tidak ada kata analitis (kenapa/analisis/strategi/prediksi/bandingkan/
 * rekomendasi/evaluasi). Kalau ada kata analitis, pesan dilewatkan ke LLM (butuh nalar).
 *
 * Semua fungsi baca-saja (findMany/aggregate), never-throw ke pemanggil: kegagalan query ->
 * null -> route jatuh ke alur biasa. Tidak pernah menulis ke DB.
 */

import { prisma } from '@/lib/prisma';
import { resolveDateRange } from '@/lib/time-series-engine';
import { canRoleSeeFinancials, type DivisionRole } from './data-visibility';

export type QuickDataIntent = 'gaji' | 'tugas' | 'agenda' | 'tagihan' | 'kas';

export interface QuickDataDetection {
  intent: QuickDataIntent;
  /** 'ini' = periode berjalan, 'depan' = periode berikutnya, 'lalu' = periode sebelumnya. */
  period: 'ini' | 'depan' | 'lalu';
  /** 'minggu' | 'bulan' -- satuan periode yang disebut pengguna (default per intent). */
  unit: 'minggu' | 'bulan';
  /** true kalau pengguna bilang "saya/aku/gue" (bukan "tim"/"semua"). */
  mine: boolean;
}

export interface QuickDataAnswer {
  text: string;
  intent: QuickDataIntent;
  /** Jumlah baris data yang dipakai (0 = jujur "belum ada catatan"). */
  rows: number;
}

const ANALYTICAL = /\b(kenapa|mengapa|analisis|analisa|strategi|prediksi|proyeksi|bandingkan|rekomendasi|evaluasi|dampak|risiko|simulasi|kelayakan|saran|hitung|rasio|breakdown|kuartal|persentase|perbandingan|identifikasi|pasal|klausul|tinjau|bedah|detail|rincian|jelaskan|terangkan|uraikan)\b/i;

const INTENT_PATTERNS: Array<{ intent: QuickDataIntent; re: RegExp; unit: 'minggu' | 'bulan' }> = [
  { intent: 'gaji', re: /\b(gaji|payroll|slip gaji|upah)\b/i, unit: 'bulan' },
  { intent: 'tugas', re: /\b(tugas|kerjaan|to-?do|pekerjaan)\b/i, unit: 'minggu' },
  { intent: 'agenda', re: /\b(rencana|agenda|jadwal|reservasi|booking|acara)\b/i, unit: 'minggu' },
  { intent: 'tagihan', re: /\b(tagihan|kewajiban|jatuh tempo|invoice belum|piutang|cicilan)\b/i, unit: 'minggu' },
  { intent: 'kas', re: /\b(saldo|kas|uang kas|cash)\b/i, unit: 'bulan' },
];

/** Deteksi murni (nol I/O) -- diuji terpisah. */
export function detectQuickDataIntent(message: string): QuickDataDetection | null {
  const text = (message || '').trim();
  if (!text || text.split(/\s+/).length > 20) return null;
  if (ANALYTICAL.test(text)) return null;
  // Kata kerja pencatatan/pembuatan = aksi tulis, bukan pertanyaan data -- biarkan router lain.
  if (/\b(catat|tambah(kan)?|masukkan|input|buat(kan)?|hapus|ubah|edit|kirim|terbitkan)\b/i.test(text)) return null;

  const match = INTENT_PATTERNS.find((p) => p.re.test(text));
  if (!match) return null;

  const period: QuickDataDetection['period'] = /\b(depan|berikutnya|mendatang|besok)\b/i.test(text)
    ? 'depan'
    : /\b(lalu|kemarin|sebelumnya)\b/i.test(text)
      ? 'lalu'
      : 'ini';
  const unit: QuickDataDetection['unit'] = /\bbulan\b/i.test(text) ? 'bulan' : /\bminggu\b/i.test(text) ? 'minggu' : match.unit;
  const mine = /\b(saya|aku|gue|gua|ku)\b/i.test(text) && !/\b(tim|semua|seluruh|karyawan)\b/i.test(text);
  return { intent: match.intent, period, unit, mine };
}

function formatRp(n: number): string {
  return `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Jendela tanggal minggu/bulan ini/depan/lalu dihitung di WIB EKSPLISIT (pola sama dengan
 * time-series-engine.ts WIB_OFFSET_MS), bukan zona waktu proses server -- VPS bisa UTC,
 * jam 00:00-07:00 WIB "bulan ini" akan salah sehari kalau pakai getDate() lokal (V2A 11 Sep). */
export function resolveQuickWindow(detection: QuickDataDetection, now: Date = new Date()): { start: Date; end: Date; label: string } {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS); // komponen via getUTC* = jam WIB
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const d = wib.getUTCDate();
  const wibDate = (yy: number, mm: number, dd: number, endOfDay = false) =>
    new Date(Date.UTC(yy, mm, dd, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0) - WIB_OFFSET_MS);
  const wibParts = (date: Date) => {
    const t = new Date(date.getTime() + WIB_OFFSET_MS);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
  };
  const fmtWib = (date: Date) => {
    const pz = wibParts(date);
    return `${pz.d} ${MONTHS_ID[pz.m].slice(0, 3)} ${pz.y}`;
  };
  if (detection.unit === 'bulan') {
    const shift = detection.period === 'depan' ? 1 : detection.period === 'lalu' ? -1 : 0;
    const start = wibDate(y, m + shift, 1);
    const end = wibDate(y, m + shift + 1, 0, true);
    const sp = wibParts(start);
    return { start, end, label: `${MONTHS_ID[sp.m]} ${sp.y}` };
  }
  const day = wib.getUTCDay(); // 0 = Minggu (WIB)
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const shift = detection.period === 'depan' ? 7 : detection.period === 'lalu' ? -7 : 0;
  const start = wibDate(y, m, d + mondayOffset + shift);
  const end = wibDate(y, m, d + mondayOffset + shift + 6, true);
  const labelPeriod = detection.period === 'depan' ? 'minggu depan' : detection.period === 'lalu' ? 'minggu lalu' : 'minggu ini';
  return { start, end, label: `${labelPeriod} (${fmtWib(start)} - ${fmtWib(end)})` };
}

/** V2A 11 Sep (TINGGI): pencocokan nama WAJIB nama LENGKAP persis (case-insensitive, spasi
 * dinormalisasi) -- bukan substring nama depan ("Budi" bisa cocok ke 3 orang, gaji orang lain
 * tampil sebagai "Gaji Anda"). Belum ada relasi EmployeePayroll<->User di schema, jadi ini
 * pagar paling ketat yang mungkin tanpa migrasi. */
function nameMatches(rowName: string, userName: string): boolean {
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();
  const a = norm(rowName);
  const b = norm(userName);
  return !!a && !!b && a === b;
}

/**
 * Jawab dari DB. `userName` = nama terverifikasi dari auth (bukan body) untuk mencocokkan
 * payroll "gaji saya". Return null kalau query gagal -> pemanggil lanjut ke LLM.
 */
export async function answerQuickData(
  workspaceId: string,
  userName: string,
  detection: QuickDataDetection,
  now: Date = new Date(),
  // FILTER DIVISI (11 Sep 2026 sore, keputusan Mecca): tanpa opsi = perilaku lama
  // (pemanggil/test lama). Dengan viewerRole: saldo kas, tagihan, dan gaji TIM
  // hanya CEO + FINANCE; "gaji saya" dan tugas/agenda tetap untuk semua.
  options: { viewerRole?: DivisionRole } = {}
): Promise<QuickDataAnswer | null> {
  try {
    const win = resolveQuickWindow(detection, now);
    const viewerRole = options.viewerRole;
    const financialIntent = detection.intent === 'kas' || detection.intent === 'tagihan' || (detection.intent === 'gaji' && !detection.mine);
    if (viewerRole && financialIntent && !canRoleSeeFinancials(viewerRole)) {
      const apa = detection.intent === 'gaji' ? 'gaji tim' : detection.intent === 'kas' ? 'saldo kas' : 'tagihan perusahaan';
      return {
        text: `Data ${apa} hanya bisa dilihat oleh CEO/Owner dan tim Finance. Divisi Anda (${viewerRole === 'MARKETING' ? 'Marketing' : 'di luar Finance'}) tidak punya akses ke data ini -- silakan minta ke tim Finance.${detection.intent === 'gaji' ? ' Kalau yang dimaksud gaji Anda sendiri, tanya "gaji saya bulan ini".' : ''}`,
        intent: detection.intent,
        rows: 0,
      };
    }

    if (detection.intent === 'gaji') {
      const rows = await prisma.employeePayroll.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 200 });
      const monthLabel = win.label; // "September 2026"
      const inMonth = rows.filter((r) => r.monthYear.toLowerCase().includes(monthLabel.toLowerCase()));
      const pool = inMonth.length > 0 ? inMonth : [];
      const mineRows = detection.mine ? pool.filter((r) => nameMatches(r.employeeName, userName)) : pool;
      if (mineRows.length === 0) {
        const hint = rows.length === 0
          ? 'Belum ada data payroll sama sekali di workspace ini. Catat di modul Kerja > Payroll, nanti saya bisa jawab langsung.'
          : detection.mine
            ? `Belum ada slip gaji atas nama **${userName}** untuk periode ${monthLabel}. Periode yang tercatat: ${Array.from(new Set(rows.map((r) => r.monthYear))).slice(0, 5).join(', ')}.`
            : `Belum ada payroll tercatat untuk ${monthLabel}. Periode yang tercatat: ${Array.from(new Set(rows.map((r) => r.monthYear))).slice(0, 5).join(', ')}.`;
        return { text: hint, intent: 'gaji', rows: 0 };
      }
      const lines = mineRows.map((r) => `- **${r.employeeName}** (${r.role}): gaji pokok ${formatRp(r.basicSalary)} + tunjangan ${formatRp(r.allowance)} + lembur ${formatRp(r.overtime)} - potongan ${formatRp(r.deductions)} = **${formatRp(r.netSalary)}** ${r.isPaid ? '(sudah dibayar)' : '(belum dibayar)'}`);
      const total = mineRows.reduce((s, r) => s + r.netSalary, 0);
      return {
        text: `**Gaji ${detection.mine ? 'Anda' : 'tim'} periode ${monthLabel}** (dibaca langsung dari data payroll, tanpa AI):\n\n${lines.join('\n')}${mineRows.length > 1 ? `\n\nTotal bersih: **${formatRp(total)}**` : ''}`,
        intent: 'gaji',
        rows: mineRows.length,
      };
    }

    if (detection.intent === 'tugas') {
      const tasks = await prisma.workTask.findMany({
        where: { workspaceId, status: { not: 'DONE' }, dueDate: { gte: win.start, lte: win.end } },
        orderBy: { dueDate: 'asc' },
        take: 50,
      });
      const mine = detection.mine ? tasks.filter((t) => nameMatches(t.assigneeName, userName)) : tasks;
      if (mine.length === 0) {
        const noDue = await prisma.workTask.count({ where: { workspaceId, status: { not: 'DONE' }, dueDate: null } });
        return {
          text: `Tidak ada tugas ${detection.mine ? 'atas nama Anda ' : ''}yang jatuh tempo ${win.label}.${noDue > 0 ? ` Ada ${noDue} tugas terbuka tanpa tenggat -- cek modul Kerja untuk mengatur tenggatnya.` : ''}`,
          intent: 'tugas',
          rows: 0,
        };
      }
      const lines = mine.map((t) => `- ${fmtDate(t.dueDate)} -- **${t.title}** (${t.assigneeName}, ${t.priority.toLowerCase()}, ${t.status === 'IN_PROGRESS' ? 'berjalan' : 'antre'})`);
      return { text: `**Tugas ${win.label}** (${mine.length} tugas, dibaca langsung dari papan kerja):\n\n${lines.join('\n')}`, intent: 'tugas', rows: mine.length };
    }

    if (detection.intent === 'agenda') {
      const [tasks, obligations, bookings] = await Promise.all([
        prisma.workTask.findMany({ where: { workspaceId, status: { not: 'DONE' }, dueDate: { gte: win.start, lte: win.end } }, orderBy: { dueDate: 'asc' }, take: 30 }),
        prisma.scheduledObligation.findMany({ where: { workspaceId, status: 'PENDING', dueDate: { gte: win.start, lte: win.end } }, orderBy: { dueDate: 'asc' }, take: 30 }),
        prisma.bookingReservation.findMany({ where: { workspaceId, status: { not: 'CANCELLED' }, bookingDate: { gte: win.start, lte: win.end } }, orderBy: { bookingDate: 'asc' }, take: 30 }).catch(() => []),
      ]);
      const total = tasks.length + obligations.length + bookings.length;
      if (total === 0) return { text: `Belum ada agenda tercatat untuk ${win.label} -- tidak ada tugas bertenggat, kewajiban jatuh tempo, maupun reservasi.`, intent: 'agenda', rows: 0 };
      const parts: string[] = [`**Agenda ${win.label}** (dibaca langsung dari data, tanpa AI):`];
      if (tasks.length) parts.push(`\n**Tugas (${tasks.length})**\n${tasks.map((t) => `- ${fmtDate(t.dueDate)} -- ${t.title} (${t.assigneeName})`).join('\n')}`);
      if (obligations.length) parts.push(`\n**Kewajiban jatuh tempo (${obligations.length})**\n${obligations.map((o) => `- ${fmtDate(o.dueDate)} -- ${o.name}: ${formatRp(o.amount)}`).join('\n')}`);
      if (bookings.length) parts.push(`\n**Reservasi (${bookings.length})**\n${bookings.map((b) => `- ${fmtDate(b.bookingDate)} ${b.bookingTime} -- ${b.customerName}: ${b.serviceName}`).join('\n')}`);
      return { text: parts.join('\n'), intent: 'agenda', rows: total };
    }

    if (detection.intent === 'tagihan') {
      const horizonEnd = detection.period === 'ini' ? new Date(now.getTime() + 14 * 86400000) : win.end;
      const [obligations, invoices] = await Promise.all([
        prisma.scheduledObligation.findMany({ where: { workspaceId, status: 'PENDING', dueDate: { lte: horizonEnd } }, orderBy: { dueDate: 'asc' }, take: 30 }),
        prisma.invoice.findMany({ where: { workspaceId, status: { in: ['UNPAID', 'OVERDUE'] } }, orderBy: { dueDate: 'asc' }, take: 30, select: { clientName: true, invoiceNumber: true, totalAmount: true, dueDate: true, status: true } }),
      ]);
      if (obligations.length + invoices.length === 0) return { text: 'Tidak ada tagihan/kewajiban yang jatuh tempo dalam 14 hari ke depan, dan tidak ada invoice yang belum dibayar.', intent: 'tagihan', rows: 0 };
      const parts: string[] = ['**Tagihan & kewajiban** (dibaca langsung dari data, tanpa AI):'];
      if (obligations.length) parts.push(`\n**Harus dibayar (${obligations.length})**\n${obligations.map((o) => `- ${fmtDate(o.dueDate)} -- ${o.name}: **${formatRp(o.amount)}**${o.dueDate < now ? ' (LEWAT tempo)' : ''}`).join('\n')}\nTotal: **${formatRp(obligations.reduce((s, o) => s + o.amount, 0))}**`);
      if (invoices.length) parts.push(`\n**Piutang belum dibayar klien (${invoices.length})**\n${invoices.map((i) => `- ${i.invoiceNumber} ${i.clientName}: **${formatRp(i.totalAmount)}**, jatuh tempo ${fmtDate(i.dueDate)}${i.dueDate < now ? ' (TERLAMBAT)' : ''}`).join('\n')}\nTotal piutang: **${formatRp(invoices.reduce((s, i) => s + i.totalAmount, 0))}**`);
      return { text: parts.join('\n'), intent: 'tagihan', rows: obligations.length + invoices.length };
    }

    // kas
    const range = resolveDateRange({ range: detection.period === 'lalu' ? 'last_month' : 'this_month', nowDate: now });
    const [periodRows, allRows] = await Promise.all([
      prisma.cashTransaction.findMany({ where: { workspaceId, transactionDate: { gte: range.startDate, lte: range.endDate } }, select: { type: true, amount: true } }),
      prisma.cashTransaction.findMany({ where: { workspaceId }, select: { type: true, amount: true } }),
    ]);
    const sum = (rows: Array<{ type: string; amount: number }>, type: string) => rows.filter((r) => r.type === type).reduce((s, r) => s + r.amount, 0);
    const cumulative = sum(allRows, 'INCOME') - sum(allRows, 'EXPENSE');
    if (allRows.length === 0) return { text: 'Belum ada transaksi kas yang tercatat. Anda dapat mengunggah mutasi rekening koran (CSV/Excel) di modul Finance / Pusat Data, atau ketik "catat pemasukan 500rb dari penjualan".', intent: 'kas', rows: 0 };
    const inc = sum(periodRows, 'INCOME');
    const exp = sum(periodRows, 'EXPENSE');
    return {
      text: `**Kas ${range.periodLabel}** (dibaca langsung dari Buku Kas, tanpa AI):\n\n- Pemasukan: ${formatRp(inc)}\n- Pengeluaran: ${formatRp(exp)}\n- Arus kas bersih periode: **${formatRp(inc - exp)}** (${periodRows.length} transaksi)\n- Saldo kas kumulatif saat ini: **${formatRp(cumulative)}** (${allRows.length} transaksi total)`,
      intent: 'kas',
      rows: periodRows.length,
    };
  } catch (err) {
    console.warn('[QuickData] query gagal (non-fatal, lanjut ke LLM):', err);
    return null;
  }
}

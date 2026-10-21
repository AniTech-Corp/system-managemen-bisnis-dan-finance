/**
 * Smoke test end-to-end modul Laporan Keuangan — 237 pemeriksaan.
 *
 * PRASYARAT (jangan dijalankan di database produksi):
 *   1. Server dev/produksi berjalan di http://localhost:3000
 *   2. Tabel akuntansi sudah dikosongkan, mis.:
 *        docker exec klir-db psql -U klir -d klir -c \
 *          "TRUNCATE journal_lines, journal_entries, fiscal_periods, document_sequences, \
 *           category_account_maps, partners, cash_accounts, accounts, accounting_settings, \
 *           cash_transactions, invoices, scheduled_obligations CASCADE;"
 *   3. User seed ada: ceo@anitech.dev / Password123!
 *
 * Jalankan: node scripts/accounting-smoke.mjs
 *
 * Skrip ini mengubah database: membuat CoA, saldo awal, transaksi kas, dan jurnal.
 */
const BASE = 'http://localhost:3000';
let token = '';
let failures = 0;

function ok(label, condition, extra = '') {
  const mark = condition ? '✅' : '❌';
  if (!condition) failures += 1;
  console.log(`${mark} ${label}${extra ? ` — ${extra}` : ''}`);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

/* 1. login */
const login = await api('/api/v1/auth/login', {
  method: 'POST',
  body: { email: 'ceo@anitech.dev', password: 'Password123!' },
});
token = login.json?.tokens?.accessToken ?? '';
ok('login menghasilkan access token', Boolean(token));

/* 2. permissions */
const perms = await api('/api/v1/accounting/permissions');
ok('permissions OWNER', perms.json?.data?.permissions?.post === true, `role=${perms.json?.data?.role}`);

/* 2b. setup bagan akun */
const setup = await api('/api/v1/accounting/setup', {
  method: 'POST',
  body: { booksStartDate: '2026-11-01', entityType: 'BADAN_USAHA', taxProfile: 'UMKM_NON_PKP' },
});
ok('inisialisasi bagan akun', setup.status === 200 && setup.json?.data?.accountsCreated >= 55,
  `dibuat=${setup.json?.data?.accountsCreated} rekening=${setup.json?.data?.cashAccountsCreated}`);
ok('modul akuntansi aktif setelah setup', setup.json?.data?.setting?.isEnabled === true);

/* 3. accounts */
const accountsRes = await api('/api/v1/accounting/accounts');
const accounts = accountsRes.json?.data ?? [];
const byCode = Object.fromEntries(accounts.map((a) => [a.code, a]));
ok('bagan akun terisi', accounts.length >= 55, `${accounts.length} akun`);
ok('akun sistem tersedia (3-3000)', Boolean(byCode['3-3000']));

/* 4. cash accounts */
const cashRes = await api('/api/v1/accounting/cash-accounts');
const cashAccounts = cashRes.json?.data ?? [];
const kas = cashAccounts.find((c) => c.code === 'KAS-01');
const bank = cashAccounts.find((c) => c.code === 'BANK-01');
ok('dua rekening kas default', Boolean(kas && bank), cashAccounts.map((c) => c.name).join(', '));

/* 4b. hierarki bagan akun (induk–anak) */
const childAccount = await api('/api/v1/accounting/accounts', {
  method: 'POST',
  body: {
    code: '6-9500',
    name: 'Beban Uji Hierarki',
    type: 'EXPENSE',
    normalBalance: 'DEBIT',
    parentId: byCode['6-1400'].id,
  },
});
const childId = childAccount.json?.data?.id;
ok(
  'akun anak dibuat dengan induk',
  childAccount.status === 201 && childAccount.json?.data?.parentId === byCode['6-1400'].id,
  childAccount.json?.message
);

const treeRes = await api('/api/v1/accounting/accounts');
const childRow = (treeRes.json?.data ?? []).find((a) => a.id === childId);
ok('daftar akun mengembalikan parentId anak', childRow?.parentId === byCode['6-1400'].id);

const crossType = await api('/api/v1/accounting/accounts', {
  method: 'POST',
  body: {
    code: '6-9600',
    name: 'Salah Tipe',
    type: 'EXPENSE',
    normalBalance: 'DEBIT',
    parentId: byCode['1-1000'].id,
  },
});
ok('induk beda tipe ditolak', crossType.status === 400, crossType.json?.message?.slice(0, 80));

const cycle = await api(`/api/v1/accounting/accounts/${byCode['6-1400'].id}`, {
  method: 'PATCH',
  body: { parentId: childId },
});
ok('siklus hierarki ditolak', cycle.status === 400, cycle.json?.message?.slice(0, 80));

const deleteParent = await api(`/api/v1/accounting/accounts/${byCode['6-1400'].id}`, { method: 'DELETE' });
ok(
  'akun induk yang punya sub-akun tidak bisa dihapus',
  deleteParent.status === 400,
  deleteParent.json?.message?.slice(0, 70)
);

const reparent = await api(`/api/v1/accounting/accounts/${childId}`, {
  method: 'PATCH',
  body: { parentId: byCode['6-9000'].id },
});
ok(
  'akun anak bisa dipindah induk',
  reparent.status === 200 && reparent.json?.data?.parentId === byCode['6-9000'].id
);

const rename = await api(`/api/v1/accounting/accounts/${childId}`, {
  method: 'PATCH',
  body: { name: 'Beban Uji Hierarki (ubah)' },
});
ok('nama akun bisa diubah', rename.status === 200 && rename.json?.data?.name === 'Beban Uji Hierarki (ubah)');

const deleteChild = await api(`/api/v1/accounting/accounts/${childId}`, { method: 'DELETE' });
ok('akun tanpa jurnal & tanpa anak bisa dihapus', deleteChild.status === 200);

/* 5. pemetaan kategori */
const mapping = await api('/api/v1/accounting/category-mapping', {
  method: 'PUT',
  body: {
    mappings: [
      { category: 'Penjualan Jasa', type: 'INCOME', accountId: byCode['4-1100'].id },
      { category: 'Operasional Kantor', type: 'EXPENSE', accountId: byCode['6-1400'].id },
    ],
  },
});
ok('pemetaan kategori tersimpan', mapping.status === 200, mapping.json?.message);

/* 6. saldo awal */
const opening = await api('/api/v1/accounting/opening-balance', {
  method: 'POST',
  body: {
    date: '2026-11-01',
    lines: [
      { accountId: byCode['1-1110'].id, debit: 10_000_000, credit: 0, cashAccountId: kas.id, description: 'Saldo kas kecil' },
      { accountId: byCode['1-1210'].id, debit: 50_000_000, credit: 0, cashAccountId: bank.id, description: 'Saldo bank' },
      { accountId: byCode['3-1100'].id, debit: 0, credit: 60_000_000, description: 'Modal disetor' },
    ],
  },
});
ok('saldo awal tersimpan', opening.status === 201, opening.json?.data?.entryNumber);
ok('saldo awal source OPENING', opening.json?.data?.source === 'OPENING');

const openingAgain = await api('/api/v1/accounting/opening-balance', {
  method: 'POST',
  body: { date: '2026-11-01', lines: [{ accountId: byCode['1-1110'].id, debit: 1, credit: 0 }, { accountId: byCode['3-1100'].id, debit: 0, credit: 1 }] },
});
ok('saldo awal ganda ditolak', openingAgain.status === 400, openingAgain.json?.message);

/* 7. transaksi kas -> jurnal otomatis */
const income = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Penjualan Jasa',
    amount: 5_000_000,
    description: 'Invoice jasa konsultasi',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-05',
  },
});
ok('transaksi kas pemasukan tersimpan', income.status === 200, income.json?.message);

const expense = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'EXPENSE',
    category: 'Operasional Kantor',
    amount: 1_500_000,
    description: 'Tagihan internet',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-06',
  },
});
ok('transaksi kas pengeluaran tersimpan', expense.status === 200, expense.json?.message);

const unmapped = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'EXPENSE',
    category: 'Kategori Belum Dipetakan',
    amount: 100_000,
    description: 'uji tolak',
    paymentMethod: 'Kas',
    transactionDate: '2026-11-06',
  },
});
ok('kategori tanpa pemetaan ditolak', unmapped.status === 400, unmapped.json?.message?.slice(0, 80));

/* 8. jurnal otomatis tercipta */
const journals = await api('/api/v1/accounting/journals?period=2026-11&limit=100');
const list = journals.json?.data ?? [];
const cashTxJournals = list.filter((j) => j.source === 'CASH_TX');
ok('dua jurnal otomatis dari transaksi kas', cashTxJournals.length === 2, `total jurnal: ${list.length}`);
ok('jurnal otomatis langsung POSTED', cashTxJournals.every((j) => j.status === 'POSTED'));
const incomeJournal = cashTxJournals.find((j) => Number(j.totalDebit) === 5_000_000);
ok('jurnal pemasukan menghubungkan kas bank', Boolean(incomeJournal?.lines?.some((l) => l.account.code === '1-1210')));

/* 9. saldo awal tidak balance -> penyeimbang saldo laba */
const unbalanced = await api('/api/v1/accounting/journals', {
  method: 'POST',
  body: {
    entryDate: '2026-11-07',
    description: 'Uji jurnal tidak balance harus ditolak',
    lines: [
      { accountId: byCode['6-1400'].id, debit: 100_000, credit: 0 },
      { accountId: byCode['1-1110'].id, debit: 0, credit: 90_000 },
    ],
  },
});
ok('jurnal tidak balance ditolak', unbalanced.status === 400, unbalanced.json?.message?.slice(0, 70));

/* 10. jurnal manual + posting + pembalikan */
const manual = await api('/api/v1/accounting/journals', {
  method: 'POST',
  body: {
    entryDate: '2026-11-30',
    description: 'Penyusutan peralatan November',
    lines: [
      { accountId: byCode['6-1800'].id, debit: 500_000, credit: 0 },
      { accountId: byCode['1-2400'].id, debit: 0, credit: 500_000 },
    ],
  },
});
ok('jurnal manual draft tersimpan', manual.status === 201, manual.json?.data?.entryNumber);
ok('jurnal manual berstatus DRAFT', manual.json?.data?.status === 'DRAFT');
const manualId = manual.json?.data?.id;

const posted = await api(`/api/v1/accounting/journals/${manualId}/post`, { method: 'POST' });
ok('jurnal manual berhasil diposting', posted.status === 200 && posted.json?.data?.status === 'POSTED');

const doublePost = await api(`/api/v1/accounting/journals/${manualId}/post`, { method: 'POST' });
ok('posting ganda ditolak', doublePost.status === 400, doublePost.json?.message);

const reversal = await api(`/api/v1/accounting/journals/${manualId}/reverse`, {
  method: 'POST',
  body: { reason: 'Salah nominal penyusutan' },
});
ok('jurnal pembalik dibuat', reversal.status === 200, reversal.json?.data?.entryNumber);
ok('pembalik menukar debit/kredit', reversal.json?.data?.lines?.[0]?.credit !== undefined && Number(reversal.json.data.lines[0].credit) === 500_000);

/* 11. laporan */
const incomeStmt = await api('/api/v1/accounting/reports/income-statement?period=2026-11&comparative=prev_month');
const t = incomeStmt.json?.data?.current?.totals;
ok('laba rugi: pendapatan 5.000.000', Number(t?.revenue) === 5_000_000, `revenue=${t?.revenue}`);
ok('laba rugi: beban operasional 1.500.000', Number(t?.operatingExpenses) === 1_500_000, `opex=${t?.operatingExpenses}`);
ok('laba rugi: laba bersih 3.500.000', Number(t?.netIncome) === 3_500_000, `net=${t?.netIncome}`);
ok('laba rugi: pembanding bulan lalu kosong', incomeStmt.json?.data?.comparison?.totals?.revenue === '0.00',
  `prev=${incomeStmt.json?.data?.comparison?.totals?.revenue}`);

const bs = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
const bsTotals = bs.json?.data?.current?.totals;
ok('neraca balance (selisih 0)', Number(bsTotals?.difference) === 0,
  `aset=${bsTotals?.assets} liab+ekuitas=${bsTotals?.liabilitiesAndEquity}`);
ok('neraca: aset 63.500.000', Number(bsTotals?.assets) === 63_500_000, `aset=${bsTotals?.assets}`);
ok('neraca: laba tahun berjalan 3.500.000', Number(bsTotals?.currentYearProfit) === 3_500_000, `cyp=${bsTotals?.currentYearProfit}`);

const cf = await api('/api/v1/accounting/reports/cash-flow?period=2026-11');
const cfTotals = cf.json?.data?.current?.totals;
ok('arus kas cocok dengan saldo rekening', Number(cfTotals?.difference) === 0,
  `closing=${cfTotals?.closingCash} actual=${cfTotals?.actualCashBalance}`);
ok('arus kas: kas awal 60.000.000', Number(cf.json?.data?.current?.openingCash) === 60_000_000);
ok('arus kas: kas akhir 63.500.000', Number(cfTotals?.closingCash) === 63_500_000, `closing=${cfTotals?.closingCash}`);

const eq = await api('/api/v1/accounting/reports/equity?period=2026-11');
const eqTotals = eq.json?.data?.current?.totals;
ok('ekuitas: ekuitas awal 60.000.000', Number(eq.json?.data?.current?.openingEquity) === 60_000_000);
ok('ekuitas akhir = ekuitas neraca', Number(eqTotals?.closingEquity) === Number(bsTotals?.equity),
  `ekuitas=${eqTotals?.closingEquity} neraca=${bsTotals?.equity}`);

const tb = await api('/api/v1/accounting/reports/trial-balance?period=2026-11');
ok('neraca saldo debit == kredit', Number(tb.json?.data?.current?.totals?.difference) === 0,
  `debit=${tb.json?.data?.current?.totals?.debit} kredit=${tb.json?.data?.current?.totals?.credit}`);

const ledger = await api(`/api/v1/accounting/reports/ledger?period=2026-11&accountId=${byCode['1-1210'].id}`);
ok('buku besar bank saldo akhir 53.500.000', Number(ledger.json?.data?.current?.closingBalance) === 53_500_000,
  `saldo=${ledger.json?.data?.current?.closingBalance}`);

const summary = await api('/api/v1/accounting/reports/summary?period=2026-11');
ok('ringkasan: rasio margin bersih 70%', summary.json?.data?.ratios?.netMarginPct === '70.00',
  `margin=${summary.json?.data?.ratios?.netMarginPct}`);

/* 12. ekspor excel */
const exportRes = await fetch(`${BASE}/api/v1/accounting/reports/export?period=2026-11`, {
  headers: { Authorization: `Bearer ${token}` },
});
const buffer = Buffer.from(await exportRes.arrayBuffer());
ok('ekspor xlsx berhasil', exportRes.status === 200 && buffer.length > 5000 && buffer.toString('hex', 0, 2) === '504b',
  `${buffer.length} bytes`);

/* 13. tutup buku */
const periods = await api('/api/v1/accounting/periods');
const nov = (periods.json?.data ?? []).find((p) => p.year === 2026 && p.month === 11);
ok('periode 2026-11 terdaftar', Boolean(nov), `status=${nov?.status}`);

const close = await api(`/api/v1/accounting/periods/${nov.id}/close`, { method: 'POST' });
ok('tutup buku berhasil', close.status === 200 && close.json?.data?.status === 'CLOSED', close.json?.data?.status ?? close.json?.message);

const draftJournal = await api('/api/v1/accounting/journals', {
  method: 'POST',
  body: {
    entryDate: '2026-11-28',
    description: 'Jurnal setelah tutup buku',
    lines: [
      { accountId: byCode['6-1400'].id, debit: 10_000, credit: 0 },
      { accountId: byCode['1-1110'].id, debit: 0, credit: 10_000 },
    ],
  },
});
ok('jurnal di periode tertutup ditolak', draftJournal.status === 400, draftJournal.json?.message?.slice(0, 70));

const lock = await api(`/api/v1/accounting/periods/${nov.id}/lock`, { method: 'POST' });
ok('kunci periode berhasil', lock.status === 200 && lock.json?.data?.status === 'LOCKED');

const reopen = await api(`/api/v1/accounting/periods/${nov.id}/reopen`, { method: 'POST', body: { reason: 'Ada koreksi dari auditor' } });
ok('buka kembali periode berhasil', reopen.status === 200 && reopen.json?.data?.status === 'OPEN');

/* 14. idempotensi setup */
const setupAgain = await api('/api/v1/accounting/setup', { method: 'POST', body: {} });
ok('setup ulang tidak menggandakan akun', setupAgain.json?.data?.accountsCreated === 0,
  `created=${setupAgain.json?.data?.accountsCreated} existing=${setupAgain.json?.data?.accountsExisting}`);

/* 15. pilihan rekening kas/bank mengikuti metode pembayaran */
const kasExpense = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'EXPENSE',
    category: 'Operasional Kantor',
    amount: 100_000,
    description: 'Beli ATK dari kas kecil',
    paymentMethod: 'Kas Kecil',
    transactionDate: '2026-11-20',
  },
});
ok('transaksi dengan metode "Kas Kecil" tersimpan', kasExpense.status === 200);

const journalsAfterKas = await api('/api/v1/accounting/journals?period=2026-11&limit=100');
const kasJournal = (journalsAfterKas.json?.data ?? []).find(
  (j) => j.source === 'CASH_TX' && Number(j.totalDebit) === 100_000
);
ok(
  'metode "Kas Kecil" dijurnal ke rekening kas kecil (1-1110)',
  Boolean(kasJournal?.lines?.some((l) => l.account.code === '1-1110')),
  kasJournal?.lines?.map((l) => l.account.code).join(' + ')
);
ok(
  'metode "Kas Kecil" bukan ke rekening bank default (1-1210)',
  !kasJournal?.lines?.some((l) => l.account.code === '1-1210')
);

/* 16. akun kontra (Akumulasi Penyusutan) harus MENGURANGI aset */
const depr = await api('/api/v1/accounting/journals', {
  method: 'POST',
  body: {
    entryDate: '2026-11-30',
    description: 'Penyusutan peralatan (permanen, tanpa pembalik)',
    lines: [
      { accountId: byCode['6-1800'].id, debit: 2_000_000, credit: 0 },
      { accountId: byCode['1-2400'].id, debit: 0, credit: 2_000_000 },
    ],
  },
});
await api(`/api/v1/accounting/journals/${depr.json?.data?.id}/post`, { method: 'POST' });

const bsContra = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
const contraTotals = bsContra.json?.data?.current?.totals;
const akumulasi = (bsContra.json?.data?.current?.assets ?? []).find((a) => a.code === '1-2400');
ok(
  'akumulasi penyusutan bertanda negatif di aset',
  Number(akumulasi?.amount) === -2_000_000,
  `1-2400 = ${akumulasi?.amount}`
);
ok(
  'neraca tetap balance setelah akun kontra bersaldo',
  Number(contraTotals?.difference) === 0,
  `selisih=${contraTotals?.difference}`
);

const tbContra = await api('/api/v1/accounting/reports/trial-balance?period=2026-11');
ok(
  'neraca saldo tetap balance setelah akun kontra bersaldo',
  Number(tbContra.json?.data?.current?.totals?.difference) === 0
);

const eqContra = await api('/api/v1/accounting/reports/equity?period=2026-11');
ok(
  'ekuitas akhir = total ekuitas di neraca',
  Number(eqContra.json?.data?.current?.totals?.closingEquity) === Number(contraTotals?.equity),
  `ekuitas=${eqContra.json?.data?.current?.totals?.closingEquity} neraca=${contraTotals?.equity}`
);

const cfContra = await api('/api/v1/accounting/reports/cash-flow?period=2026-11');
ok(
  'penyusutan tidak mengubah arus kas',
  Number(cfContra.json?.data?.current?.totals?.difference) === 0,
  `selisih=${cfContra.json?.data?.current?.totals?.difference}`
);

/* 17. hapus transaksi kas -> jurnal otomatis dibalik */
const expenseTxId = expense.json?.transaction?.id;
const del = await api(`/api/v1/kas/transactions?id=${expenseTxId}`, { method: 'DELETE' });
ok('hapus transaksi kas berhasil', del.status === 200, del.json?.message);
ok('penghapusan menyebut jurnal dibalik', /dibalik/.test(del.json?.message ?? ''), del.json?.message);

const novJournalsAfter = await api('/api/v1/accounting/journals?period=2026-11&limit=100');
const reversalEntries = (novJournalsAfter.json?.data ?? []).filter((j) => j.source === 'REVERSAL');
ok('jurnal pembalik penghapusan tercatat', reversalEntries.length === 2, `${reversalEntries.length} entri REVERSAL di Nov 2026`);

const deletedJournal = (novJournalsAfter.json?.data ?? []).find(
  (j) => j.source === 'CASH_TX' && Number(j.totalDebit) === 1_500_000
);
ok('jurnal transaksi yang dihapus ditandai reversedBy', Boolean(deletedJournal?.reversedBy), `reversedBy=${deletedJournal?.reversedBy ?? 'null'}`);

const novTx = await api('/api/v1/kas/transactions?limit=50');
const stillThere = (novTx.json?.transactions ?? []).some((t) => t.id === expenseTxId);
ok('baris kas benar-benar terhapus', stillThere === false);

/* 18. FAKTUR (AR) - basis akrual */

// Faktur diterbitkan: pendapatan harus diakui SEKARANG, walau uang belum masuk.
const invoice = await api('/api/v1/kas/invoices', {
  method: 'POST',
  body: {
    clientName: 'PT Klien Uji',
    items: [{ name: 'Jasa Konsultasi', price: 12_000_000, qty: 1 }],
    taxRate: 0,
    issueDate: '2026-11-05',
    dueDate: '2026-11-30',
  },
});
const invoiceId = invoice.json?.invoice?.id;
ok('faktur diterbitkan', Boolean(invoiceId), invoice.json?.invoice?.invoiceNumber);

const arJournals = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const invoiceJournal = (arJournals.json?.data ?? []).find((j) => j.source === 'INVOICE' && j.sourceId === invoiceId);
ok('faktur otomatis dijurnal (source INVOICE)', Boolean(invoiceJournal), invoiceJournal?.entryNumber);
ok(
  'jurnal faktur: Dr Piutang / Cr Pendapatan',
  Number(invoiceJournal?.lines?.find((l) => l.account.code === '1-1300')?.debit) === 12_000_000 &&
    Number(invoiceJournal?.lines?.find((l) => l.account.code === '4-1100')?.credit) === 12_000_000,
  (invoiceJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

// Inti basis akrual: pendapatan naik sebelum uangnya diterima.
const incomeBefore = await api('/api/v1/accounting/reports/income-statement?period=2026-11');
const revenueBefore = Number(incomeBefore.json?.data?.current?.totals?.revenue);
const cashBefore = await api('/api/v1/accounting/reports/cash-flow?period=2026-11');
const closingCashBefore = Number(cashBefore.json?.data?.current?.totals?.closingCash);
ok('pendapatan sudah diakui walau faktur belum dibayar', revenueBefore === 5_000_000 + 12_000_000, `revenue=${revenueBefore}`);

const bsUnpaid = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
ok(
  'piutang usaha masuk neraca',
  Number((bsUnpaid.json?.data?.current?.assets ?? []).find((a) => a.code === '1-1300')?.amount) === 12_000_000
);
ok('neraca tetap balance saat ada piutang', Number(bsUnpaid.json?.data?.current?.totals?.difference) === 0);

// Faktur dilunasi: uang masuk TIDAK menambah pendapatan lagi, tapi melunasi piutang.
const paid = await api('/api/v1/kas/invoices', {
  method: 'PUT',
  body: { invoiceId, status: 'PAID', paidAt: '2026-11-20' },
});
ok('faktur ditandai lunas', paid.status === 200, paid.json?.message);

const afterPaid = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const settlement = (afterPaid.json?.data ?? []).find(
  (j) => j.source === 'CASH_TX' && Number(j.totalDebit) === 12_000_000
);
ok('pelunasan faktur dijurnal ke kas', Boolean(settlement), settlement?.entryNumber);
ok(
  'pelunasan faktur: Dr Kas / Cr Piutang (bukan pendapatan)',
  Number(settlement?.lines?.find((l) => l.account.code === '1-1210')?.debit) === 12_000_000 &&
    Number(settlement?.lines?.find((l) => l.account.code === '1-1300')?.credit) === 12_000_000 &&
    !settlement?.lines?.some((l) => l.account.code.startsWith('4-')),
  (settlement?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const incomeAfter = await api('/api/v1/accounting/reports/income-statement?period=2026-11');
ok(
  'pendapatan TIDAK bertambah saat pelunasan (tanpa hitung ganda)',
  Number(incomeAfter.json?.data?.current?.totals?.revenue) === revenueBefore,
  `sebelum=${revenueBefore} sesudah=${incomeAfter.json?.data?.current?.totals?.revenue}`
);

const bsPaid = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
ok(
  'piutang kembali nol setelah lunas',
  !((bsPaid.json?.data?.current?.assets ?? []).find((a) => a.code === '1-1300'))
);const cashAfter = await api('/api/v1/accounting/reports/cash-flow?period=2026-11');
ok(
  'kas bertambah saat pelunasan',
  Number(cashAfter.json?.data?.current?.totals?.closingCash) === closingCashBefore + 12_000_000,
  `sebelum=${closingCashBefore} sesudah=${cashAfter.json?.data?.current?.totals?.closingCash}`
);
ok('neraca tetap balance setelah pelunasan', Number(bsPaid.json?.data?.current?.totals?.difference) === 0);
ok(
  'arus kas: operasional bertambah dari pelunasan piutang',
  Number(cashAfter.json?.data?.current?.totals?.operating) ===
    Number(cashBefore.json?.data?.current?.totals?.operating) + 12_000_000
);

// Faktur dibatalkan: piutang dan pendapatannya harus ikut batal.
const invoice2 = await api('/api/v1/kas/invoices', {
  method: 'POST',
  body: {
    clientName: 'PT Batal Uji',
    items: [{ name: 'Jasa Batal', price: 3_000_000, qty: 2 }],
    taxRate: 0,
    issueDate: '2026-11-06',
    dueDate: '2026-11-30',
  },
});
const invoice2Id = invoice2.json?.invoice?.id;
const incomeWithInvoice2 = await api('/api/v1/accounting/reports/income-statement?period=2026-11');
const revenueWithInvoice2 = Number(incomeWithInvoice2.json?.data?.current?.totals?.revenue);
ok('faktur kedua menambah pendapatan 6.000.000', revenueWithInvoice2 === revenueBefore + 6_000_000, `revenue=${revenueWithInvoice2}`);

const cancelled = await api('/api/v1/kas/invoices', { method: 'PUT', body: { invoiceId: invoice2Id, status: 'CANCELLED' } });
ok('faktur dibatalkan', cancelled.status === 200);

const afterCancel = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const cancelReversal = (afterCancel.json?.data ?? []).find(
  (j) => j.source === 'REVERSAL' && Number(j.totalDebit) === 6_000_000
);
ok('pembatalan faktur membuat jurnal pembalik', Boolean(cancelReversal), cancelReversal?.entryNumber);
ok(
  'jurnal pembalik faktur menukar sisi piutang & pendapatan',
  Number(cancelReversal?.lines?.find((l) => l.account.code === '1-1300')?.credit) === 6_000_000 &&
    Number(cancelReversal?.lines?.find((l) => l.account.code === '4-1100')?.debit) === 6_000_000,
  (cancelReversal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const incomeAfterCancel = await api('/api/v1/accounting/reports/income-statement?period=2026-11');
ok(
  'pendapatan kembali setelah faktur dibatalkan',
  Number(incomeAfterCancel.json?.data?.current?.totals?.revenue) === revenueBefore,
  `revenue=${incomeAfterCancel.json?.data?.current?.totals?.revenue}`
);

const bsAfterCancel = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
ok('neraca tetap balance setelah pembatalan', Number(bsAfterCancel.json?.data?.current?.totals?.difference) === 0);
ok(
  'piutang tetap nol setelah pembatalan',
  !((bsAfterCancel.json?.data?.current?.assets ?? []).find((a) => a.code === '1-1300'))
);const eqAfterCancel = await api('/api/v1/accounting/reports/equity?period=2026-11');
ok(
  'ekuitas akhir = total ekuitas di neraca (setelah semua alur faktur)',
  Number(eqAfterCancel.json?.data?.current?.totals?.closingEquity) ===
    Number(bsAfterCancel.json?.data?.current?.totals?.equity),
  `ekuitas=${eqAfterCancel.json?.data?.current?.totals?.closingEquity} neraca=${bsAfterCancel.json?.data?.current?.totals?.equity}`
);

const tbFinal = await api('/api/v1/accounting/reports/trial-balance?period=2026-11');
ok('neraca saldo tetap balance di akhir semua skenario', Number(tbFinal.json?.data?.current?.totals?.difference) === 0);

/* 18b. TAUTAN MANUAL transaksi kas -> faktur (tanpa ubah status lewat endpoint faktur) */

const invoice3 = await api('/api/v1/kas/invoices', {
  method: 'POST',
  body: {
    clientName: 'PT Manual Uji',
    items: [{ name: 'Jasa Manual', price: 4_000_000, qty: 1 }],
    taxRate: 0,
    issueDate: '2026-11-07',
    dueDate: '2026-11-30',
  },
});
const invoice3Id = invoice3.json?.invoice?.id;
ok('faktur ketiga diterbitkan (belum dibayar)', invoice3.json?.invoice?.status === 'UNPAID', invoice3.json?.invoice?.invoiceNumber);

// Sejak Fase 3.2 pembayaran sebagian DIIZINKAN; yang tetap ditolak adalah
// kelebihan bayar dari sisa tagihan (belum ada akun uang muka pelanggan).
const wrongAmount = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Penjualan Jasa',
    amount: 5_000_000,
    description: 'Pelunasan melebihi tagihan',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-25',
    invoiceId: invoice3Id,
  },
});
ok('pelunasan melebihi sisa faktur ditolak', wrongAmount.status === 400, wrongAmount.json?.message?.slice(0, 90));

const wrongType = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'EXPENSE',
    category: 'Operasional Kantor',
    amount: 4_000_000,
    description: 'Pengeluaran ditautkan ke faktur',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-25',
    invoiceId: invoice3Id,
  },
});
ok('pengeluaran tidak bisa ditautkan ke faktur', wrongType.status === 400, wrongType.json?.message?.slice(0, 80));

const manualSettle = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 4_000_000,
    description: 'Pelunasan faktur manual',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-25',
    invoiceId: invoice3Id,
  },
});
const manualTxId = manualSettle.json?.transaction?.id;
ok('transaksi manual dengan tautan faktur tersimpan', manualSettle.status === 200, manualSettle.json?.message);

const invoicesAfterManual = await api('/api/v1/kas/invoices');
const invoice3After = (invoicesAfterManual.json?.invoices ?? []).find((i) => i.id === invoice3Id);
ok('faktur otomatis jadi PAID setelah pelunasan manual', invoice3After?.status === 'PAID', `status=${invoice3After?.status}`);

const novAfterManual = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const manualJournal = (novAfterManual.json?.data ?? []).find(
  (j) => j.source === 'CASH_TX' && j.sourceId === manualTxId
);
ok(
  'jurnal pelunasan manual: Dr Kas / Cr Piutang (bukan pendapatan)',
  Number(manualJournal?.lines?.find((l) => l.account.code === '1-1210')?.debit) === 4_000_000 &&
    Number(manualJournal?.lines?.find((l) => l.account.code === '1-1300')?.credit) === 4_000_000 &&
    !manualJournal?.lines?.some((l) => l.account.code.startsWith('4-')),
  (manualJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const delManual = await api(`/api/v1/kas/transactions?id=${manualTxId}`, { method: 'DELETE' });
ok('hapus pelunasan manual berhasil', delManual.status === 200, delManual.json?.message);
const invoicesAfterDel = await api('/api/v1/kas/invoices');
const invoice3Reverted = (invoicesAfterDel.json?.invoices ?? []).find((i) => i.id === invoice3Id);
ok('faktur kembali UNPAID setelah pelunasan dihapus', invoice3Reverted?.status === 'UNPAID', `status=${invoice3Reverted?.status}`);

/* 18c. KEWAJIBAN (AP) - basis akrual: beban saat dicatat, utang saat dibayar */

const opexBeforeAp = Number(
  (await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.operatingExpenses
);
const cashBeforeAp = Number(
  (await api('/api/v1/accounting/reports/cash-flow?period=2026-11')).json?.data?.current?.totals?.closingCash
);

const obligation = await api('/api/v1/kas/obligations', {
  method: 'POST',
  body: {
    name: 'Sewa Server November',
    dueDate: '2026-11-30',
    amount: 3_000_000,
    category: 'Operasional Kantor',
    accrualDate: '2026-11-08',
  },
});
const obligationId = obligation.json?.obligation?.id;
ok('kewajiban tercatat', Boolean(obligationId), obligation.json?.journalNumber ?? obligation.json?.message);
ok('kewajiban otomatis dijurnal (source OBLIGATION)', Boolean(obligation.json?.journalNumber), obligation.json?.journalNumber);

const novAfterOblig = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const obligationJournal = (novAfterOblig.json?.data ?? []).find(
  (j) => j.source === 'OBLIGATION' && j.sourceId === obligationId
);
ok(
  'jurnal kewajiban: Dr Beban / Cr Utang Usaha',
  Number(obligationJournal?.lines?.find((l) => l.account.code === '6-1400')?.debit) === 3_000_000 &&
    Number(obligationJournal?.lines?.find((l) => l.account.code === '2-1100')?.credit) === 3_000_000,
  (obligationJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const incomeAfterOblig = await api('/api/v1/accounting/reports/income-statement?period=2026-11');
ok(
  'beban sudah diakui saat kewajiban dicatat',
  Number(incomeAfterOblig.json?.data?.current?.totals?.operatingExpenses) === opexBeforeAp + 3_000_000,
  `opex=${incomeAfterOblig.json?.data?.current?.totals?.operatingExpenses}`
);
const bsAfterOblig = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
ok(
  'utang usaha muncul di neraca',
  Number((bsAfterOblig.json?.data?.current?.liabilities ?? []).find((a) => a.code === '2-1100')?.amount) === 3_000_000,
  `2-1100=${(bsAfterOblig.json?.data?.current?.liabilities ?? []).find((a) => a.code === '2-1100')?.amount}`
);
ok('neraca balance setelah kewajiban dicatat', Number(bsAfterOblig.json?.data?.current?.totals?.difference) === 0);
ok(
  'arus kas belum terpengaruh (belum ada uang keluar)',
  Number((await api('/api/v1/accounting/reports/cash-flow?period=2026-11')).json?.data?.current?.totals?.closingCash) === cashBeforeAp
);

const payOblig = await api('/api/v1/kas/obligations', {
  method: 'PATCH',
  body: { id: obligationId, status: 'PAID', paidAt: '2026-11-28', paymentMethod: 'Transfer Bank' },
});
ok('kewajiban ditandai lunas', payOblig.status === 200 && payOblig.json?.obligation?.status === 'PAID');

const novAfterPay = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const obligationSettlement = (novAfterPay.json?.data ?? []).find(
  (j) => j.source === 'CASH_TX' && Number(j.totalDebit) === 3_000_000 && j.lines?.some((l) => l.account.code === '2-1100')
);
ok(
  'pelunasan kewajiban: Dr Utang / Cr Kas',
  Number(obligationSettlement?.lines?.find((l) => l.account.code === '2-1100')?.debit) === 3_000_000 &&
    Number(obligationSettlement?.lines?.find((l) => l.account.code === '1-1210')?.credit) === 3_000_000,
  (obligationSettlement?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const incomeAfterPay = await api('/api/v1/accounting/reports/income-statement?period=2026-11');
ok(
  'pelunasan TIDAK menambah beban (tanpa hitung ganda)',
  Number(incomeAfterPay.json?.data?.current?.totals?.operatingExpenses) === opexBeforeAp + 3_000_000,
  `opex=${incomeAfterPay.json?.data?.current?.totals?.operatingExpenses}`
);
const cashAfterPay = await api('/api/v1/accounting/reports/cash-flow?period=2026-11');
ok(
  'kas berkurang saat kewajiban dibayar',
  Number(cashAfterPay.json?.data?.current?.totals?.closingCash) === cashBeforeAp - 3_000_000,
  `sebelum=${cashBeforeAp} sesudah=${cashAfterPay.json?.data?.current?.totals?.closingCash}`
);
const bsAfterPay = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
ok(
  'utang kembali nol setelah dibayar',
  !((bsAfterPay.json?.data?.current?.liabilities ?? []).find((a) => a.code === '2-1100'))
);
ok('neraca balance setelah pelunasan kewajiban', Number(bsAfterPay.json?.data?.current?.totals?.difference) === 0);

const cancelPaid = await api('/api/v1/kas/obligations', {
  method: 'PATCH',
  body: { id: obligationId, status: 'CANCELLED' },
});
ok('kewajiban lunas tidak bisa langsung dibatalkan', cancelPaid.status === 400, cancelPaid.json?.message?.slice(0, 80));

const unpay = await api('/api/v1/kas/obligations', {
  method: 'PATCH',
  body: { id: obligationId, status: 'PENDING' },
});
ok('pelunasan kewajiban bisa ditarik kembali', unpay.status === 200 && unpay.json?.obligation?.status === 'PENDING');

const novAfterUnpay = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const settlementAfterUnpay = (novAfterUnpay.json?.data ?? []).find((j) => j.id === obligationSettlement?.id);
ok('jurnal pelunasan kewajiban dibalik saat ditarik', Boolean(settlementAfterUnpay?.reversedBy));

const bsAfterUnpay = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
ok(
  'utang kembali muncul setelah pelunasan ditarik',
  Number((bsAfterUnpay.json?.data?.current?.liabilities ?? []).find((a) => a.code === '2-1100')?.amount) === 3_000_000
);

const cancelOblig = await api('/api/v1/kas/obligations', {
  method: 'PATCH',
  body: { id: obligationId, status: 'CANCELLED' },
});
ok('kewajiban bisa dibatalkan saat masih pending', cancelOblig.status === 200 && cancelOblig.json?.obligation?.status === 'CANCELLED');

const novAfterCancelOblig = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const obligationJournalAfter = (novAfterCancelOblig.json?.data ?? []).find((j) => j.id === obligationJournal?.id);
ok('jurnal akrual kewajiban dibalik saat dibatalkan', Boolean(obligationJournalAfter?.reversedBy));

const incomeAfterCancelOblig = await api('/api/v1/accounting/reports/income-statement?period=2026-11');
ok(
  'beban kembali setelah kewajiban dibatalkan',
  Number(incomeAfterCancelOblig.json?.data?.current?.totals?.operatingExpenses) === opexBeforeAp,
  `opex=${incomeAfterCancelOblig.json?.data?.current?.totals?.operatingExpenses}`
);

const delOblig = await api(`/api/v1/kas/obligations?id=${obligationId}`, { method: 'DELETE' });
ok('kewajiban batal bisa dihapus', delOblig.status === 200, delOblig.json?.message);

const bsFinalAp = await api('/api/v1/accounting/reports/balance-sheet?period=2026-11');
ok('neraca balance setelah seluruh alur kewajiban', Number(bsFinalAp.json?.data?.current?.totals?.difference) === 0);

/* 18d. PAYROLL - akrual saat slip dibuat, pelunasan saat gaji dibayarkan */

const opexBeforePayroll = Number(
  (await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.operatingExpenses
);
const cashBeforePayroll = Number(
  (await api('/api/v1/accounting/reports/cash-flow?period=2026-11')).json?.data?.current?.totals?.closingCash
);

const payroll = await api('/api/v1/kerja/payroll', {
  method: 'POST',
  body: {
    employeeName: 'Staf Uji Payroll',
    role: 'Staf Operasional',
    basicSalary: 6_000_000,
    allowance: 500_000,
    deductions: 0,
    monthYear: 'November 2026',
    accrualDate: '2026-11-10',
  },
});
const payrollId = payroll.json?.payroll?.id;
ok('slip gaji dibuat', payroll.status === 200 && Boolean(payrollId), payroll.json?.message?.slice(0, 70));
ok('slip gaji otomatis dijurnal (source PAYROLL)', Boolean(payroll.json?.journalNumber), payroll.json?.journalNumber);

const novAfterPayroll = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const payrollJournal = (novAfterPayroll.json?.data ?? []).find(
  (j) => j.source === 'PAYROLL' && j.sourceId === payrollId
);
ok(
  'jurnal gaji: Dr Beban Gaji / Cr Utang Gaji',
  Number(payrollJournal?.lines?.find((l) => l.account.code === '6-1100')?.debit) === 6_500_000 &&
    Number(payrollJournal?.lines?.find((l) => l.account.code === '2-1200')?.credit) === 6_500_000,
  (payrollJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);
ok(
  'beban gaji diakui saat slip dibuat',
  Number((await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.operatingExpenses) ===
    opexBeforePayroll + 6_500_000
);
ok(
  'utang gaji muncul di neraca',
  Number(
    ((await api('/api/v1/accounting/reports/balance-sheet?period=2026-11')).json?.data?.current?.liabilities ?? []).find(
      (a) => a.code === '2-1200'
    )?.amount
  ) === 6_500_000
);
ok(
  'arus kas belum berubah (gaji belum dibayar)',
  Number((await api('/api/v1/accounting/reports/cash-flow?period=2026-11')).json?.data?.current?.totals?.closingCash) ===
    cashBeforePayroll
);

const paidPayroll = await api('/api/v1/kerja/payroll', { method: 'PUT', body: { payrollId, paymentDate: '2026-11-28' } });
ok('gaji dibayarkan', paidPayroll.status === 200 && paidPayroll.json?.payroll?.isPaid === true);

const novAfterPayrollPay = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const payrollSettlement = (novAfterPayrollPay.json?.data ?? []).find(
  (j) => j.source === 'CASH_TX' && j.lines?.some((l) => l.account.code === '2-1200') && Number(j.totalDebit) === 6_500_000
);
ok(
  'pembayaran gaji: Dr Utang Gaji / Cr Kas',
  Number(payrollSettlement?.lines?.find((l) => l.account.code === '2-1200')?.debit) === 6_500_000 &&
    Number(payrollSettlement?.lines?.find((l) => l.account.code === '1-1210')?.credit) === 6_500_000,
  (payrollSettlement?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);
ok(
  'pembayaran gaji TIDAK menambah beban (tanpa hitung ganda)',
  Number((await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.operatingExpenses) ===
    opexBeforePayroll + 6_500_000
);
ok(
  'kas berkurang saat gaji dibayar',
  Number((await api('/api/v1/accounting/reports/cash-flow?period=2026-11')).json?.data?.current?.totals?.closingCash) ===
    cashBeforePayroll - 6_500_000
);
ok(
  'utang gaji nol setelah dibayar',
  !(((await api('/api/v1/accounting/reports/balance-sheet?period=2026-11')).json?.data?.current?.liabilities ?? []).find(
    (a) => a.code === '2-1200'
  ))
);

const paidPayrollAgain = await api('/api/v1/kerja/payroll', { method: 'PUT', body: { payrollId } });
ok('pembayaran gaji ganda ditolak', paidPayrollAgain.status === 400, paidPayrollAgain.json?.message?.slice(0, 70));

/* 18d-2. PAYROLL: PPh 21 & BPJS (input manual) + setoran kewajiban */

const payroll2 = await api('/api/v1/kerja/payroll', {
  method: 'POST',
  body: {
    employeeName: 'Staf Uji Pajak',
    role: 'Staf Operasional',
    basicSalary: 8_000_000,
    allowance: 1_000_000,
    overtime: 500_000,
    pph21: 250_000,
    bpjsEmployee: 190_000,
    bpjsEmployer: 380_000,
    otherDeductions: 60_000,
    monthYear: 'November 2026',
    accrualDate: '2026-11-20',
  },
});
const payroll2Id = payroll2.json?.payroll?.id;
ok(
  'slip gaji dengan PPh 21 & BPJS dibuat',
  payroll2.status === 200 && Boolean(payroll2Id) && Boolean(payroll2.json?.journalNumber),
  `${payroll2.json?.journalNumber ?? payroll2.json?.message?.slice(0, 60)}`
);
ok(
  'gaji bersih = bruto - PPh 21 - BPJS karyawan - potongan lain (9.000.000)',
  Number(payroll2.json?.payroll?.netSalary) === 9_000_000 &&
    Number(payroll2.json?.payroll?.deductions) === 500_000,
  `net=${payroll2.json?.payroll?.netSalary}`
);

const novPayrollTax = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const payrollTaxJournal = (novPayrollTax.json?.data ?? []).find(
  (j) => j.source === 'PAYROLL' && j.sourceId === payroll2Id
);
const taxLine = (code) => payrollTaxJournal?.lines?.find((l) => l.account.code === code);
ok(
  'jurnal gaji: Dr Beban Gaji = bruto + BPJS pemberi kerja (9.880.000)',
  Number(taxLine('6-1100')?.debit) === 9_880_000,
  `debit=${taxLine('6-1100')?.debit}`
);
ok(
  'jurnal gaji: Cr Utang Gaji 9.000.000 + Cr PPh 21 250.000',
  Number(taxLine('2-1200')?.credit) === 9_000_000 && Number(taxLine('2-1320')?.credit) === 250_000
);
ok(
  'jurnal gaji: Cr Utang BPJS 570.000 + Cr potongan lain 60.000',
  Number(taxLine('2-1340')?.credit) === 570_000 && Number(taxLine('2-1350')?.credit) === 60_000,
  (payrollTaxJournal?.lines ?? []).map((l) => `${l.account.code} K${l.credit}`).join(' | ')
);
ok(
  'BPJS pemberi kerja menambah beban tanpa mengurangi gaji bersih',
  Number((await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.operatingExpenses) ===
    opexBeforePayroll + 6_500_000 + 9_880_000
);

const taxDue = await api('/api/v1/kerja/payroll/taxes');
ok(
  'kewajiban PPh 21 & BPJS terbaca dari buku besar',
  Number(taxDue.json?.data?.pph21?.outstanding) === 250_000 &&
    Number(taxDue.json?.data?.bpjs?.outstanding) === 570_000 &&
    Number(taxDue.json?.data?.other?.outstanding) === 60_000,
  `PPh=${taxDue.json?.data?.pph21?.outstanding} BPJS=${taxDue.json?.data?.bpjs?.outstanding}`
);

const overRemit = await api('/api/v1/kerja/payroll/taxes', {
  method: 'POST',
  body: { type: 'BPJS', amount: 1_000_000, paymentDate: '2026-11-30' },
});
ok('setoran melebihi kewajiban ditolak', overRemit.status === 400, overRemit.json?.message?.slice(0, 80));

const remitPph = await api('/api/v1/kerja/payroll/taxes', {
  method: 'POST',
  body: { type: 'PPH21', paymentDate: '2026-11-30' },
});
ok('setoran PPh 21 tercatat', remitPph.status === 200 && Boolean(remitPph.json?.journalNumber), remitPph.json?.message?.slice(0, 70));

const novAfterRemit = await api('/api/v1/accounting/journals?period=2026-11&limit=200');
const remitJournal = (novAfterRemit.json?.data ?? []).find(
  (j) => j.source === 'CASH_TX' && Number(j.totalDebit) === 250_000 && j.lines?.some((l) => l.account.code === '2-1320')
);
ok(
  'jurnal setoran PPh 21: Dr PPh 21 / Cr Kas',
  Number(remitJournal?.lines?.find((l) => l.account.code === '2-1320')?.debit) === 250_000 &&
    Number(remitJournal?.lines?.find((l) => l.account.code === '1-1210')?.credit) === 250_000,
  (remitJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const remitBpjs = await api('/api/v1/kerja/payroll/taxes', {
  method: 'POST',
  body: { type: 'BPJS', paymentDate: '2026-11-30' },
});
ok('setoran BPJS tercatat', remitBpjs.status === 200 && Boolean(remitBpjs.json?.journalNumber));

const taxAfter = await api('/api/v1/kerja/payroll/taxes');
ok(
  'kewajiban PPh 21 & BPJS nol setelah disetor',
  Number(taxAfter.json?.data?.pph21?.outstanding) === 0 && Number(taxAfter.json?.data?.bpjs?.outstanding) === 0,
  `PPh=${taxAfter.json?.data?.pph21?.outstanding} BPJS=${taxAfter.json?.data?.bpjs?.outstanding}`
);
ok(
  'setoran pajak TIDAK menambah beban baru',
  Number((await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.operatingExpenses) ===
    opexBeforePayroll + 6_500_000 + 9_880_000
);

const invalidPayroll = await api('/api/v1/kerja/payroll', {
  method: 'POST',
  body: {
    employeeName: 'Staf Salah Input',
    basicSalary: 1_000_000,
    pph21: 2_000_000,
    monthYear: 'November 2026',
    accrualDate: '2026-11-20',
  },
});
ok('potongan melebihi gaji bruto ditolak', invalidPayroll.status === 400, invalidPayroll.json?.message?.slice(0, 80));

/* 18e. UMUR PIUTANG/UTANG + RINGKASAN PPN */

// Faktur ketiga sengaja masih UNPAID (pelunasan manualnya dihapus di 18b).
// Per 10 Desember faktur itu terlambat 10 hari.
const agingAr = await api('/api/v1/accounting/reports/aging?type=AR&asOf=2026-12-10');
const agingArData = agingAr.json?.data?.current;
ok(
  'umur piutang: faktur terbuka terdaftar',
  agingAr.status === 200 && (agingArData?.rows ?? []).some((r) => r.id === invoice3Id),
  `${agingArData?.rows?.length ?? 0} dokumen`
);
ok(
  'umur piutang: total cocok dengan saldo buku besar',
  Number(agingArData?.difference) === 0,
  `dokumen=${agingArData?.total} buku=${agingArData?.ledgerBalance} selisih=${agingArData?.difference}`
);
ok(
  'umur piutang: faktur 10 hari terlambat masuk kelompok 1-30 hari',
  (agingArData?.buckets ?? []).find((b) => b.key === 'd1_30')?.count === 1 &&
    Number((agingArData?.buckets ?? []).find((b) => b.key === 'd1_30')?.amount) === 4_000_000,
  (agingArData?.buckets ?? []).map((b) => `${b.key}=${b.amount}`).join(' ')
);

const agingObligation = await api('/api/v1/kas/obligations', {
  method: 'POST',
  body: {
    name: 'Utang Uji Umur',
    dueDate: '2026-11-25',
    amount: 2_000_000,
    category: 'Operasional Kantor',
    accrualDate: '2026-11-15',
  },
});
const agingObligationId = agingObligation.json?.obligation?.id;
ok('kewajiban uji umur tercatat', Boolean(agingObligationId), agingObligation.json?.journalNumber ?? agingObligation.json?.message);

const agingAp = await api('/api/v1/accounting/reports/aging?type=AP&asOf=2026-12-10');
const agingApData = agingAp.json?.data?.current;
ok(
  'umur utang: kewajiban terbuka terdaftar',
  agingAp.status === 200 && (agingApData?.rows ?? []).some((r) => r.id === agingObligationId),
  `${agingApData?.rows?.length ?? 0} dokumen`
);
ok(
  'umur utang: total cocok dengan saldo buku besar',
  Number(agingApData?.difference) === 0,
  `dokumen=${agingApData?.total} buku=${agingApData?.ledgerBalance} selisih=${agingApData?.difference}`
);
ok(
  'umur utang: kewajiban 15 hari terlambat masuk kelompok 1-30 hari',
  (agingApData?.buckets ?? []).find((b) => b.key === 'd1_30')?.count === 1,
  (agingApData?.buckets ?? []).map((b) => `${b.key}=${b.amount}`).join(' ')
);

const taxReport = await api('/api/v1/accounting/reports/tax?period=2026-11');
const taxData = taxReport.json?.data?.current;
ok(
  'ringkasan PPN: non-PKP tanpa transaksi PPN',
  taxReport.status === 200 && taxData?.isPkp === false && Number(taxData?.outputTax) === 0 && Number(taxData?.netPayable) === 0,
  `pkp=${taxData?.isPkp} keluaran=${taxData?.outputTax}`
);

/* 18f. KONSINYASI -> UTANG USAHA (kas tidak berkurang saat barang laku) */

const consProduct = await api('/api/v1/inventory/products', {
  method: 'POST',
  body: {
    name: 'Kaos Konsinyasi Uji',
    sku: 'KONS-UJI-1',
    costPrice: 40_000,
    sellPrice: 75_000,
    openingStock: 10,
    supplierName: 'CV Titip Jual',
  },
});
const consProductId = consProduct.json?.product?.id;
ok('produk konsinyasi dibuat', Boolean(consProductId), consProduct.json?.message?.slice(0, 60));

const consTag = await api('/api/v1/inventory/consignment', {
  method: 'PATCH',
  body: { productId: consProductId, ownershipType: 'CONSIGNED' },
});
ok(
  'produk ditandai CONSIGNED',
  consTag.status === 200 && consTag.json?.product?.ownershipType === 'CONSIGNED',
  `ownershipType=${consTag.json?.product?.ownershipType}`
);

const cashBeforeCons = Number(
  (await api('/api/v1/accounting/reports/cash-flow?period=2026-11')).json?.data?.current?.totals?.closingCash
);
const apBeforeCons = Number(
  ((await api('/api/v1/accounting/reports/balance-sheet?period=2026-11')).json?.data?.current?.liabilities ?? []).find(
    (a) => a.code === '2-1100'
  )?.amount ?? 0
);

const consSale = await api('/api/v1/inventory/sales', {
  method: 'POST',
  body: {
    items: [{ productId: consProductId, qty: 2, unitPrice: 75_000 }],
    paymentMethod: 'TUNAI',
    customerName: 'Pembeli Konsinyasi',
    transactionDate: '2026-11-18',
  },
});
const consObligationId = consSale.json?.sale?.consignmentLiability?.obligationIds?.[0];
ok(
  'penjualan konsinyasi mencatat kewajiban 80.000 (2 x 40.000)',
  consSale.status === 201 &&
    Number(consSale.json?.sale?.consignmentLiability?.amount) === 80_000 &&
    Boolean(consObligationId),
  `amount=${consSale.json?.sale?.consignmentLiability?.amount}`
);

const obligationsAfterCons = await api('/api/v1/kas/obligations');
const consObligation = (obligationsAfterCons.json?.all ?? []).find((o) => o.id === consObligationId);
ok(
  'kewajiban konsinyasi berstatus PENDING (utang usaha)',
  consObligation?.status === 'PENDING' && Number(consObligation?.amount) === 80_000,
  `status=${consObligation?.status}`
);

const novCons = await api('/api/v1/accounting/journals?period=2026-11&limit=300');
const consJournal = (novCons.json?.data ?? []).find(
  (j) => j.source === 'OBLIGATION' && j.sourceId === consObligationId
);
ok(
  'jurnal konsinyasi: Dr HPP / Cr Utang Usaha',
  Number(consJournal?.lines?.find((l) => l.account.code === '5-1100')?.debit) === 80_000 &&
    Number(consJournal?.lines?.find((l) => l.account.code === '2-1100')?.credit) === 80_000,
  (consJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const cashAfterCons = Number(
  (await api('/api/v1/accounting/reports/cash-flow?period=2026-11')).json?.data?.current?.totals?.closingCash
);
ok(
  'kas hanya bertambah harga jual (tidak dipotong HPP konsinyasi)',
  cashAfterCons === cashBeforeCons + 150_000,
  `sebelum=${cashBeforeCons} sesudah=${cashAfterCons}`
);

const apAfterCons = Number(
  ((await api('/api/v1/accounting/reports/balance-sheet?period=2026-11')).json?.data?.current?.liabilities ?? []).find(
    (a) => a.code === '2-1100'
  )?.amount ?? 0
);
ok(
  'utang usaha di neraca bertambah 80.000',
  apAfterCons === apBeforeCons + 80_000,
  `sebelum=${apBeforeCons} sesudah=${apAfterCons}`
);

/* 18f-2. PERSEDIAAN & HPP (rata-rata bergerak) */

// Helper: jurnal berdasarkan sumber dokumen (tanpa bergantung bulan berjalan),
// karena pembelian/retur/penyesuaian bertanggal "sekarang" (bulan riil hari ini).
const journalsBySource = async (source) => {
  const res = await api(`/api/v1/accounting/journals?source=${source}&limit=200`);
  return res.json?.data ?? [];
};
const lineOf = (journal, code) => journal?.lines?.find((l) => l.account.code === code);
const inventoryValueOf = async (productId, period = '2026-12') => {
  const res = await api(`/api/v1/accounting/reports/inventory?period=${period}`);
  const item = (res.json?.data?.current?.items ?? []).find((row) => row.productId === productId);
  return { report: res.json?.data?.current, item };
};

// Produk uji dibuat TANPA stok awal supaya nilai buku sepenuhnya berasal dari
// alur yang diuji di bawah (pembelian -> penjualan -> koreksi -> retur).
const invProduct = await api('/api/v1/inventory/products', {
  method: 'POST',
  body: { name: 'Kopi Uji Persediaan', sku: 'INV-UJI-1', costPrice: 0, sellPrice: 25_000, unit: 'pcs' },
});
const invProductId = invProduct.json?.product?.id;
ok('produk persediaan dibuat tanpa stok awal', Boolean(invProductId), invProduct.json?.message?.slice(0, 60));

// Saldo persediaan awal diambil SEBELUM pembelian pertama; laporan Neraca
// dibuat per 2026-12 (akhir tahun buku) supaya tidak bergantung bulan riil saat
// pembelian dicatat.
const invAssetBefore = Number(
  ((await api('/api/v1/accounting/reports/balance-sheet?period=2026-12')).json?.data?.current?.assets ?? []).find(
    (a) => a.code === '1-1400'
  )?.amount ?? 0
);

const po1 = await api('/api/v1/inventory/purchase-orders', {
  method: 'POST',
  body: { supplierName: 'Supplier Uji', paymentMethod: 'TUNAI', items: [{ productId: invProductId, qty: 10, unitCost: 10_000 }] },
});
ok('pembelian stok pertama tercatat', po1.status === 200 && Boolean(po1.json?.purchaseOrder?.poNumber), po1.json?.message?.slice(0, 70));

const cashJournalsAfterPo = await journalsBySource('CASH_TX');
const poJournal = cashJournalsAfterPo.find((j) => Number(lineOf(j, '1-1400')?.debit) === 100_000);
ok(
  'jurnal pembelian stok: Dr 1-1400 Persediaan / Cr Kas (bukan beban)',
  Number(lineOf(poJournal, '1-1400')?.debit) === 100_000 &&
    Number(poJournal?.totalCredit) === 100_000 &&
    !lineOf(poJournal, '5-1100') &&
    !lineOf(poJournal, '6-9000'),
  (poJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const po2 = await api('/api/v1/inventory/purchase-orders', {
  method: 'POST',
  body: { supplierName: 'Supplier Uji', paymentMethod: 'TUNAI', items: [{ productId: invProductId, qty: 10, unitCost: 14_000 }] },
});
ok('pembelian stok kedua tercatat', po2.status === 200, po2.json?.message?.slice(0, 70));

const invProductRow = ((await api('/api/v1/inventory/products?q=INV-UJI-1')).json?.products ?? []).find(
  (p) => p.sku === 'INV-UJI-1'
);
ok(
  'rata-rata bergerak: 20 unit senilai 240.000 -> 12.000/unit',
  Number(invProductRow?.currentStock) === 20 && Number(invProductRow?.costPrice) === 12_000,
  `stok=${invProductRow?.currentStock} rata=${invProductRow?.costPrice}`
);

const opexBeforeInvSale = Number(
  (await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.operatingExpenses
);
const incomeBeforeInvSale = (await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current
  ?.totals;
const invSale = await api('/api/v1/inventory/sales', {
  method: 'POST',
  body: {
    items: [{ productId: invProductId, qty: 4, unitPrice: 25_000 }],
    paymentMethod: 'TUNAI',
    customerName: 'Pembeli Uji',
    transactionDate: '2026-11-25',
  },
});
ok(
  'penjualan barang memakai HPP rata-rata (4 x 12.000 = 48.000)',
  invSale.status === 201 && Number(invSale.json?.sale?.cogs?.total) === 48_000,
  `hpp=${invSale.json?.sale?.cogs?.total}`
);

const inventoryJournals = await journalsBySource('INVENTORY');
const cogsJournal = inventoryJournals.find(
  (j) => j.sourceId === invSale.json?.sale?.cashTransactionId
);
ok(
  'jurnal HPP penjualan: Dr 5-1100 / Cr 1-1400',
  Number(lineOf(cogsJournal, '5-1100')?.debit) === 48_000 && Number(lineOf(cogsJournal, '1-1400')?.credit) === 48_000,
  (cogsJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const incomeAfterInvSale = (await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current
  ?.totals;
ok(
  'laba kotor naik 52.000 (pendapatan 100.000 - HPP 48.000)',
  Number(incomeAfterInvSale?.revenue) - Number(incomeBeforeInvSale?.revenue) === 100_000 &&
    Number(incomeAfterInvSale?.cogs) - Number(incomeBeforeInvSale?.cogs) === 48_000 &&
    Number(incomeAfterInvSale?.grossProfit) - Number(incomeBeforeInvSale?.grossProfit) === 52_000,
  `revenue=${incomeAfterInvSale?.revenue} cogs=${incomeAfterInvSale?.cogs}`
);
ok(
  'penjualan barang TIDAK menambah beban operasional',
  Number(incomeAfterInvSale?.operatingExpenses) === opexBeforeInvSale
);

const invAssetAfterSale = Number(
  ((await api('/api/v1/accounting/reports/balance-sheet?period=2026-12')).json?.data?.current?.assets ?? []).find(
    (a) => a.code === '1-1400'
  )?.amount ?? 0
);
ok(
  'persediaan di neraca naik 240.000 lalu turun 48.000 (nilai 192.000)',
  invAssetAfterSale === invAssetBefore + 240_000 - 48_000,
  `sebelum=${invAssetBefore} sesudah=${invAssetAfterSale}`
);

// Koreksi stok (opname): keluar & masuk, dinilai pada rata-rata berjalan.
const adjOut = await api('/api/v1/inventory/stock-adjustments', {
  method: 'POST',
  body: { productId: invProductId, qtyChange: -1, reason: 'Barang rusak saat uji' },
});
ok('penyesuaian stok kurang tercatat', adjOut.status === 201, adjOut.json?.message?.slice(0, 60));

const inventoryJournalsAfterAdj = await journalsBySource('INVENTORY');
const adjOutJournal = inventoryJournalsAfterAdj.find(
  (j) => Number(lineOf(j, '6-9100')?.debit) === 12_000 && Number(lineOf(j, '1-1400')?.credit) === 12_000
);
ok(
  'jurnal stok kurang: Dr 6-9100 Selisih Persediaan / Cr 1-1400',
  Boolean(adjOutJournal),
  (adjOutJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const adjIn = await api('/api/v1/inventory/stock-adjustments', {
  method: 'POST',
  body: { productId: invProductId, qtyChange: 1, reason: 'Ketemu stok kelewat catat' },
});
const inventoryJournalsAfterAdjIn = await journalsBySource('INVENTORY');
const adjInJournal = inventoryJournalsAfterAdjIn.find(
  (j) => Number(lineOf(j, '1-1400')?.debit) === 12_000 && Number(lineOf(j, '6-9100')?.credit) === 12_000
);
ok(
  'jurnal stok lebih: Dr 1-1400 / Cr 6-9100',
  adjIn.status === 201 && Boolean(adjInJournal),
  (adjInJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

// Retur: dari pelanggan mengembalikan HPP; ke supplier mengurangi persediaan.
const retIn = await api('/api/v1/inventory/returns', {
  method: 'POST',
  body: { productId: invProductId, direction: 'FROM_CUSTOMER', qty: 1, reason: 'Komplain pembeli' },
});
const inventoryJournalsAfterRetIn = await journalsBySource('INVENTORY');
const retInJournal = inventoryJournalsAfterRetIn.find(
  (j) => j.sourceId === retIn.json?.stockReturn?.id && Number(lineOf(j, '1-1400')?.debit) === 12_000
);
ok(
  'retur dari pelanggan: Dr 1-1400 / Cr 5-1100 (HPP dikembalikan)',
  retIn.status === 200 && Number(lineOf(retInJournal, '5-1100')?.credit) === 12_000,
  (retInJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const retOut = await api('/api/v1/inventory/returns', {
  method: 'POST',
  body: { productId: invProductId, direction: 'TO_SUPPLIER', qty: 1, reason: 'Salah kirim supplier' },
});
const inventoryJournalsAfterRetOut = await journalsBySource('INVENTORY');
const retOutJournal = inventoryJournalsAfterRetOut.find(
  (j) => j.sourceId === retOut.json?.stockReturn?.id && Number(lineOf(j, '1-1400')?.credit) === 12_000
);
ok(
  'retur ke supplier: Dr 6-9100 / Cr 1-1400',
  retOut.status === 200 && Number(lineOf(retOutJournal, '6-9100')?.debit) === 12_000,
  (retOutJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const invFinal = await inventoryValueOf(invProductId);
ok(
  'nilai persediaan akhir = 16 unit x 12.000 = 192.000',
  Number(invFinal.item?.qty) === 16 && Number(invFinal.item?.value) === 192_000,
  `qty=${invFinal.item?.qty} nilai=${invFinal.item?.value}`
);
ok(
  'laporan nilai persediaan cocok dengan saldo akun 1-1400 (selisih 0)',
  Number(invFinal.report?.totals?.difference) === 0 &&
    Number(invFinal.report?.totals?.ledgerValue) === Number(invFinal.report?.totals?.value),
  `buku=${invFinal.report?.totals?.ledgerValue} kartu=${invFinal.report?.totals?.value} selisih=${invFinal.report?.totals?.difference}`
);
ok(
  'tidak ada peringatan nilai persediaan pada alur normal',
  (invFinal.report?.warnings ?? []).length === 0,
  (invFinal.report?.warnings ?? []).join(' | ')
);

// Kartu stok memakai tanggal StockMovement (createdAt = hari pencatatan), bukan
// transactionDate dokumen kas, jadi periode yang dipakai adalah bulan berjalan.
const currentMonthPeriod = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();
const stockCard = await api(
  `/api/v1/accounting/reports/inventory?period=${currentMonthPeriod}&productId=${invProductId}`
);
const cardMovements = stockCard.json?.data?.card?.movements ?? [];
ok(
  'kartu stok: saldo berjalan berakhir = stok produk',
  stockCard.status === 200 &&
    Number(stockCard.json?.data?.card?.closingQty) === 16 &&
    Number(stockCard.json?.data?.card?.product?.qty) === 16 &&
    cardMovements.length >= 5 &&
    cardMovements.every((m) => Number.isFinite(Number(m.balanceQty))),
  `saldo=${stockCard.json?.data?.card?.closingQty} stok=${stockCard.json?.data?.card?.product?.qty} mutasi=${cardMovements.length}`
);

ok(
  'penjualan barang titip jual tidak membuat jurnal HPP persediaan',
  !inventoryJournalsAfterRetOut.some((j) => j.sourceId === consSale.json?.sale?.cashTransactionId),
  consSale.json?.sale?.cashTransactionId
);

const bsAfterInventory = await api('/api/v1/accounting/reports/balance-sheet?period=2026-12');
ok(
  'neraca tetap balance setelah pembelian, penjualan, koreksi, dan retur',
  Number(bsAfterInventory.json?.data?.current?.totals?.difference) === 0,
  `selisih=${bsAfterInventory.json?.data?.current?.totals?.difference}`
);

/* 18f-3. PEMBAYARAN SEBAGIAN & ALOKASI DOKUMEN (Fase 3.2) */

const invoiceById = async (id) => {
  const list = await api('/api/v1/kas/invoices');
  return (list.json?.invoices ?? []).find((row) => row.id === id);
};
const cashJournalsAll = async () => journalsBySource('CASH_TX');
const findSettlementJournal = (journals, amount, accountCode) =>
  journals.find(
    (j) => Number(j.totalDebit) === amount && Number(lineOf(j, accountCode)?.credit) === amount
  );

// Faktur 10 juta: dibayar 3 kali (4 + 3 + 3) supaya status PARTIAL -> PAID teruji.
const invPartial = await api('/api/v1/kas/invoices', {
  method: 'POST',
  body: {
    clientName: 'PT Angsuran Uji',
    items: [{ name: 'Jasa Bertahap', price: 10_000_000, qty: 1 }],
    taxRate: 0,
    issueDate: '2026-11-03',
    dueDate: '2026-11-30',
  },
});
const invPartialId = invPartial.json?.invoice?.id;
ok('faktur angsuran diterbitkan', Boolean(invPartialId), invPartial.json?.invoice?.invoiceNumber);

const arBeforePartial = Number(
  ((await api('/api/v1/accounting/reports/balance-sheet?period=2026-12')).json?.data?.current?.assets ?? []).find(
    (a) => a.code === '1-1300'
  )?.amount ?? 0
);
const revenueBeforePartial = Number(
  (await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.revenue
);

const pay1 = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 4_000_000,
    description: 'Angsuran 1 faktur uji',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-15',
    invoiceId: invPartialId,
  },
});
const invPartialAfter1 = await invoiceById(invPartialId);
ok(
  'bayar sebagian 4 juta -> status PARTIAL, sisa 6 juta',
  pay1.status === 200 &&
    invPartialAfter1?.status === 'PARTIAL' &&
    Number(invPartialAfter1?.paidAmount) === 4_000_000 &&
    Math.abs(Number(invPartialAfter1?.totalAmount) - Number(invPartialAfter1?.paidAmount) - 6_000_000) < 0.005,
  `status=${invPartialAfter1?.status} paid=${invPartialAfter1?.paidAmount}`
);

const cashJournalsPartial = await cashJournalsAll();
const partialJournal = findSettlementJournal(cashJournalsPartial, 4_000_000, '1-1300');
ok(
  'jurnal angsuran: Dr Kas 4 juta / Cr Piutang 4 juta (bukan pendapatan)',
  Boolean(partialJournal) && !(partialJournal?.lines ?? []).some((l) => l.account.code.startsWith('4-')),
  (partialJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const revenueAfterPartial = Number(
  (await api('/api/v1/accounting/reports/income-statement?period=2026-11')).json?.data?.current?.totals?.revenue
);
ok(
  'angsuran tidak menambah pendapatan (tanpa hitung ganda)',
  revenueAfterPartial === revenueBeforePartial,
  `sebelum=${revenueBeforePartial} sesudah=${revenueAfterPartial}`
);

const arAfterPartial = Number(
  ((await api('/api/v1/accounting/reports/balance-sheet?period=2026-12')).json?.data?.current?.assets ?? []).find(
    (a) => a.code === '1-1300'
  )?.amount ?? 0
);
ok(
  'piutang di neraca turun tepat 4 juta',
  arAfterPartial === arBeforePartial - 4_000_000,
  `sebelum=${arBeforePartial} sesudah=${arAfterPartial}`
);

const pay2 = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 3_000_000,
    description: 'Angsuran 2 faktur uji',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-20',
    invoiceId: invPartialId,
  },
});
const invPartialAfter2 = await invoiceById(invPartialId);
ok(
  'angsuran kedua 3 juta -> masih PARTIAL (sisa 3 juta)',
  pay2.status === 200 && invPartialAfter2?.status === 'PARTIAL' && Number(invPartialAfter2?.paidAmount) === 7_000_000,
  `status=${invPartialAfter2?.status} paid=${invPartialAfter2?.paidAmount}`
);

const pay3 = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 3_000_000,
    description: 'Angsuran 3 faktur uji',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-25',
    invoiceId: invPartialId,
  },
});
const invPartialAfter3 = await invoiceById(invPartialId);
ok(
  'angsuran terakhir menutup sisa -> PAID tepat di 10 juta',
  pay3.status === 200 && invPartialAfter3?.status === 'PAID' && Number(invPartialAfter3?.paidAmount) === 10_000_000,
  `status=${invPartialAfter3?.status} paid=${invPartialAfter3?.paidAmount}`
);

// Kelebihan bayar ditolak (belum ada akun uang muka pelanggan).
const invOver = await api('/api/v1/kas/invoices', {
  method: 'POST',
  body: {
    clientName: 'PT Lebih Bayar',
    items: [{ name: 'Jasa Kecil', price: 2_000_000, qty: 1 }],
    taxRate: 0,
    issueDate: '2026-11-04',
    dueDate: '2026-11-30',
  },
});
const invOverId = invOver.json?.invoice?.id;
const overpay = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 3_000_000,
    description: 'Coba lebih bayar',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-16',
    invoiceId: invOverId,
  },
});
ok('kelebihan bayar dari sisa tagihan ditolak', overpay.status === 400, overpay.json?.message?.slice(0, 70));

const paidAgain = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 1_000_000,
    description: 'Bayar lagi faktur yang sudah lunas',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-26',
    invoiceId: invPartialId,
  },
});
ok('membayar faktur yang sudah lunas ditolak', paidAgain.status === 400, paidAgain.json?.message?.slice(0, 70));

// Split payment: satu transfer 4 juta menutup dua faktur @2 juta.
const invSplitA = await api('/api/v1/kas/invoices', { method: 'POST', body: { clientName: 'PT Split A', items: [{ name: 'Jasa A', price: 2_000_000, qty: 1 }], taxRate: 0, issueDate: '2026-11-05', dueDate: '2026-11-30' } });
const invSplitB = await api('/api/v1/kas/invoices', { method: 'POST', body: { clientName: 'PT Split B', items: [{ name: 'Jasa B', price: 2_000_000, qty: 1 }], taxRate: 0, issueDate: '2026-11-05', dueDate: '2026-11-30' } });
const invSplitAId = invSplitA.json?.invoice?.id;
const invSplitBId = invSplitB.json?.invoice?.id;

const splitPay = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 4_000_000,
    description: 'Split payment dua faktur',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-18',
    allocations: [
      { invoiceId: invSplitAId, amount: 2_000_000 },
      { invoiceId: invSplitBId, amount: 2_000_000 },
    ],
  },
});
const splitAAfter = await invoiceById(invSplitAId);
const splitBAfter = await invoiceById(invSplitBId);
ok(
  'split payment: satu transfer melunasi dua faktur',
  splitPay.status === 200 && splitAAfter?.status === 'PAID' && splitBAfter?.status === 'PAID',
  `A=${splitAAfter?.status} B=${splitBAfter?.status}`
);

const splitJournal = (await cashJournalsAll()).find((j) => Number(j.totalDebit) === 4_000_000 && Number(lineOf(j, '1-1300')?.credit) === 4_000_000);
ok(
  'split payment: satu jurnal Dr Kas 4 juta / Cr Piutang 4 juta',
  Boolean(splitJournal),
  (splitJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const badSplit = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 4_000_000,
    description: 'Alokasi tidak cocok nominal',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-19',
    allocations: [{ invoiceId: invSplitAId, amount: 3_000_000 }],
  },
});
ok('jumlah alokasi harus sama dengan nominal transaksi', badSplit.status === 400, badSplit.json?.message?.slice(0, 70));

// Hapus baris kas angsuran -> dokumen kembali belum lunas.
const invDelete = await api('/api/v1/kas/invoices', { method: 'POST', body: { clientName: 'PT Hapus Angsuran', items: [{ name: 'Jasa Hapus', price: 5_000_000, qty: 1 }], taxRate: 0, issueDate: '2026-11-06', dueDate: '2026-11-30' } });
const invDeleteId = invDelete.json?.invoice?.id;
const delPay = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Pelunasan Piutang Invoice',
    amount: 2_000_000,
    description: 'Angsuran yang akan dihapus',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-11-17',
    invoiceId: invDeleteId,
  },
});
const invDeleteAfterPay = await invoiceById(invDeleteId);
const delRes = await api(`/api/v1/kas/transactions?id=${delPay.json?.transaction?.id}`, { method: 'DELETE' });
const invDeleteAfterDel = await invoiceById(invDeleteId);
ok(
  'hapus baris kas angsuran mengembalikan faktur ke UNPAID',
  delRes.status === 200 && invDeleteAfterPay?.status === 'PARTIAL' && invDeleteAfterDel?.status === 'UNPAID' && Number(invDeleteAfterDel?.paidAmount) === 0,
  `hapus=${delRes.status} setelah=${invDeleteAfterDel?.status} paid=${invDeleteAfterDel?.paidAmount}`
);

const arAfterDelete = Number(
  ((await api('/api/v1/accounting/reports/balance-sheet?period=2026-12')).json?.data?.current?.assets ?? []).find(
    (a) => a.code === '1-1300'
  )?.amount ?? 0
);
ok(
  'neraca tetap balance setelah hapus angsuran',
  Number((await api('/api/v1/accounting/reports/balance-sheet?period=2026-12')).json?.data?.current?.totals?.difference) === 0,
  `piutang=${arAfterDelete}`
);

// AP: kewajiban 2 juta dibayar 1 juta -> PARTIAL, lalu sisa 1 juta -> PAID.
const obPart = await api('/api/v1/kas/obligations', {
  method: 'POST',
  body: { name: 'Utang Angsuran Uji', dueDate: '2026-11-28', amount: 2_000_000, category: 'Operasional Kantor', accrualDate: '2026-11-10' },
});
const obPartId = obPart.json?.obligation?.id;
const obPay1 = await api('/api/v1/kas/obligations', {
  method: 'PATCH',
  body: { id: obPartId, status: 'PAID', amount: 1_000_000, paidAt: '2026-11-21', paymentMethod: 'Transfer Bank' },
});
ok(
  'bayar sebagian kewajiban 1 juta -> PARTIAL, sisa 1 juta',
  obPay1.status === 200 &&
    obPay1.json?.obligation?.status === 'PARTIAL' &&
    Math.abs(Number(obPay1.json?.obligation?.amount) - Number(obPay1.json?.obligation?.paidAmount) - 1_000_000) < 0.005,
  `status=${obPay1.json?.obligation?.status} paid=${obPay1.json?.obligation?.paidAmount}`
);

const apPartial = await api('/api/v1/accounting/reports/aging?type=AP&asOf=2026-12-10');
const apPartialRow = (apPartial.json?.data?.current?.rows ?? []).find((r) => r.id === obPartId);
ok(
  'umur utang menampilkan SISA 1 juta (bukan 2 juta)',
  Boolean(apPartialRow) && Number(apPartialRow?.amount) === 1_000_000 && Number(apPartialRow?.paidAmount) === 1_000_000,
  `sisa=${apPartialRow?.amount} dibayar=${apPartialRow?.paidAmount}`
);

const apJournal = (await cashJournalsAll()).find((j) => Number(j.totalDebit) === 1_000_000 && Number(lineOf(j, '2-1100')?.debit) === 1_000_000);
ok(
  'jurnal angsuran utang: Dr Utang Usaha 1 juta / Cr Kas',
  Boolean(apJournal),
  (apJournal?.lines ?? []).map((l) => `${l.account.code} D${l.debit} K${l.credit}`).join(' | ')
);

const obPay2 = await api('/api/v1/kas/obligations', {
  method: 'PATCH',
  body: { id: obPartId, status: 'PAID', amount: 1_000_000, paidAt: '2026-11-29', paymentMethod: 'Transfer Bank' },
});
ok(
  'sisa kewajiban dibayar -> PAID',
  obPay2.status === 200 && obPay2.json?.obligation?.status === 'PAID' && Number(obPay2.json?.obligation?.paidAmount) === 2_000_000,
  `status=${obPay2.json?.obligation?.status} paid=${obPay2.json?.obligation?.paidAmount}`
);

const apAfterPartial = await api('/api/v1/accounting/reports/aging?type=AP&asOf=2026-12-10');
ok(
  'umur utang: kewajiban lunas tidak lagi terdaftar',
  !(apAfterPartial.json?.data?.current?.rows ?? []).some((r) => r.id === obPartId)
);

const bsAfterPartial = await api('/api/v1/accounting/reports/balance-sheet?period=2026-12');
ok(
  'neraca tetap balance setelah seluruh alur angsuran',
  Number(bsAfterPartial.json?.data?.current?.totals?.difference) === 0,
  `selisih=${bsAfterPartial.json?.data?.current?.totals?.difference}`
);

/* 18g. ANGGARAN (rencana, tidak membuat jurnal) */

const budgetAccounts = await api('/api/v1/accounting/budgets?year=2026');
ok(
  'daftar akun anggaran tersedia (pendapatan & beban)',
  budgetAccounts.status === 200 &&
    (budgetAccounts.json?.data?.accounts ?? []).some((a) => a.code === '4-1100') &&
    (budgetAccounts.json?.data?.accounts ?? []).some((a) => a.code === '6-1400'),
  `${budgetAccounts.json?.data?.accounts?.length ?? 0} akun`
);

const journalsBeforeBudget = (await api('/api/v1/accounting/journals?period=2026-11&limit=300')).json?.data?.length ?? 0;
const saveBudget = await api('/api/v1/accounting/budgets', {
  method: 'PUT',
  body: {
    year: 2026,
    items: [
      {
        accountId: byCode['4-1100'].id,
        monthly: Array.from({ length: 12 }, () => 1_000_000),
      },
      {
        accountId: byCode['6-1400'].id,
        monthly: Array.from({ length: 12 }, () => 500_000),
      },
    ],
  },
});
ok('anggaran 2 akun tersimpan', saveBudget.status === 200 && saveBudget.json?.data?.saved === 2, saveBudget.json?.message);

const budgetAfterSave = await api('/api/v1/accounting/budgets?year=2026');
const budgetItems = budgetAfterSave.json?.data?.items ?? [];
const budgetRevenue = budgetItems.find((b) => b.code === '4-1100');
ok(
  'anggaran terbaca dengan total setahun benar',
  budgetItems.length === 2 && Number(budgetRevenue?.total) === 12_000_000,
  `items=${budgetItems.length} total=${budgetRevenue?.total}`
);

const journalsAfterBudget = (await api('/api/v1/accounting/journals?period=2026-11&limit=300')).json?.data?.length ?? 0;
ok('menyimpan anggaran TIDAK membuat jurnal', journalsAfterBudget === journalsBeforeBudget, `sebelum=${journalsBeforeBudget} sesudah=${journalsAfterBudget}`);

const budgetReport = await api('/api/v1/accounting/reports/budget?period=2026-11');
const budgetReportCur = budgetReport.json?.data?.current;
const revenueRow = (budgetReportCur?.rows ?? []).find((r) => r.code === '4-1100');
ok(
  'laporan anggaran: anggaran bulan 1.000.000 dan YTD 11.000.000',
  Number(revenueRow?.budgetMonth) === 1_000_000 && Number(revenueRow?.budgetYtd) === 11_000_000,
  `bulan=${revenueRow?.budgetMonth} ytd=${revenueRow?.budgetYtd}`
);

const ytdIncome = await api('/api/v1/accounting/reports/income-statement?period=2026-11&comparative=ytd');
const ytdRevenue = Number(
  (ytdIncome.json?.data?.comparison?.revenue ?? []).find((l) => l.code === '4-1100')?.amount ?? 0
);
ok(
  'laporan anggaran: realisasi YTD = angka Laba Rugi YTD',
  Number(revenueRow?.actualYtd) === ytdRevenue,
  `anggaran=${revenueRow?.actualYtd} laba-rugi=${ytdRevenue}`
);
ok(
  'laporan anggaran: selisih YTD = realisasi - anggaran',
  Number(revenueRow?.varianceYtd) === ytdRevenue - 11_000_000,
  `selisih=${revenueRow?.varianceYtd}`
);

const invalidBudget = await api('/api/v1/accounting/budgets', {
  method: 'PUT',
  body: {
    year: 2026,
    items: [{ accountId: byCode['1-1210'].id, monthly: Array.from({ length: 12 }, () => 100_000) }],
  },
});
ok('akun neraca tidak bisa dianggarkan', invalidBudget.status === 400, invalidBudget.json?.message?.slice(0, 70));

const clearBudget = await api('/api/v1/accounting/budgets', {
  method: 'PUT',
  body: {
    year: 2026,
    items: [{ accountId: byCode['6-1400'].id, monthly: Array.from({ length: 12 }, () => 0) }],
  },
});
const budgetAfterClear = await api('/api/v1/accounting/budgets?year=2026');
ok(
  'mengosongkan anggaran menghapus barisnya',
  clearBudget.status === 200 &&
    clearBudget.json?.data?.deleted === 1 &&
    (budgetAfterClear.json?.data?.items ?? []).length === 1,
  `deleted=${clearBudget.json?.data?.deleted} sisa=${budgetAfterClear.json?.data?.items?.length}`
);

/* 19. TUTUP TAHUN BUKU (jurnal penutup) */

// Transaksi Desember: supaya periode 2026-12 terbentuk dan tahun buku punya isi.
const decIncome = await api('/api/v1/kas/transactions', {
  method: 'POST',
  body: {
    type: 'INCOME',
    category: 'Penjualan Jasa',
    amount: 2_000_000,
    description: 'Jasa Desember',
    paymentMethod: 'Transfer Bank',
    transactionDate: '2026-12-10',
  },
});
ok('transaksi Desember tersimpan', decIncome.status === 200);

const periodsDec = await api('/api/v1/accounting/periods');
const dec = (periodsDec.json?.data ?? []).find((p) => p.year === 2026 && p.month === 12);
ok('periode 2026-12 terdaftar', Boolean(dec), `status=${dec?.status}`);
ok('bulan terakhir tahun buku dikenali (Desember)', dec?.fiscalYearEndMonth === 12);
ok('tahun buku 2026 belum ditutup', dec?.fiscalYearClosed === false);

// Kondisi sebelum tutup tahun.
const bsBeforeClose = await api('/api/v1/accounting/reports/balance-sheet?period=2026-12');
const beforeTotals = bsBeforeClose.json?.data?.current?.totals;
const cypBefore = Number(beforeTotals?.currentYearProfit);
const equityBefore = Number(beforeTotals?.equity);
const assetsBefore = Number(beforeTotals?.assets);
ok('sebelum tutup tahun: laba tahun berjalan > 0', cypBefore > 0, `cyp=${cypBefore}`);
ok('sebelum tutup tahun: neraca balance', Number(beforeTotals?.difference) === 0);
const retainedBefore = Number(
  ((bsBeforeClose.json?.data?.current?.equityAccounts ?? []).find((a) => a.code === '3-2000') ?? {}).amount ?? 0
);
ok('sebelum tutup tahun: saldo laba masih kosong', retainedBefore === 0, `3-2000=${retainedBefore}`);

// Jalankan tutup tahun.
const closeYear = await api(`/api/v1/accounting/periods/${dec.id}/close-year`, { method: 'POST' });
ok('tutup tahun buku berhasil', closeYear.status === 200, closeYear.json?.data?.entryNumber ?? closeYear.json?.message);
ok(
  'laba yang dipindah = laba tahun berjalan sebelum tutup',
  Number(closeYear.json?.data?.profit) === cypBefore,
  `profit=${closeYear.json?.data?.profit} cyp=${cypBefore}`
);

const decJournals = await api('/api/v1/accounting/journals?period=2026-12&limit=200');
const closingJournal = (decJournals.json?.data ?? []).find((j) => j.source === 'CLOSING');
ok('jurnal penutup tercatat dengan source CLOSING', Boolean(closingJournal), closingJournal?.entryNumber);
ok(
  'jurnal penutup mengkredit Saldo Laba (3-2000)',
  Number(closingJournal?.lines?.find((l) => l.account.code === '3-2000')?.credit) === cypBefore,
  `3-2000 K=${closingJournal?.lines?.find((l) => l.account.code === '3-2000')?.credit}`
);
ok(
  'jurnal penutup menolkan pendapatan (4-1100 didebit)',
  Number(closingJournal?.lines?.find((l) => l.account.code === '4-1100')?.debit) > 0,
  `4-1100 D=${closingJournal?.lines?.find((l) => l.account.code === '4-1100')?.debit}`
);
ok(
  'jurnal penutup tidak menyentuh akun neraca (aset/liabilitas)',
  !(closingJournal?.lines ?? []).some((l) => l.account.code.startsWith('1-') || l.account.code.startsWith('2-'))
);
ok(
  'jurnal penutup balance (debit = kredit)',
  Number(closingJournal?.totalDebit) === Number(closingJournal?.totalCredit)
);

// Kondisi sesudah tutup tahun.
const bsAfterClose = await api('/api/v1/accounting/reports/balance-sheet?period=2026-12');
const afterTotals = bsAfterClose.json?.data?.current?.totals;
ok(
  'sesudah tutup tahun: laba tahun berjalan = 0',
  Number(afterTotals?.currentYearProfit) === 0,
  `cyp=${afterTotals?.currentYearProfit}`
);
const retainedAfter = Number(
  ((bsAfterClose.json?.data?.current?.equityAccounts ?? []).find((a) => a.code === '3-2000') ?? {}).amount ?? 0
);
ok('sesudah tutup tahun: saldo laba berisi laba tahun buku', retainedAfter === cypBefore, `3-2000=${retainedAfter}`);
ok('sesudah tutup tahun: total ekuitas tidak berubah', Number(afterTotals?.equity) === equityBefore,
  `sebelum=${equityBefore} sesudah=${afterTotals?.equity}`);
ok('sesudah tutup tahun: total aset tidak berubah', Number(afterTotals?.assets) === assetsBefore);
ok('sesudah tutup tahun: neraca tetap balance', Number(afterTotals?.difference) === 0, `selisih=${afterTotals?.difference}`);

// Laporan laba rugi tahun berjalan tetap menampilkan angka (CLOSING dikecualikan).
const decIncomeStmt = await api('/api/v1/accounting/reports/income-statement?period=2026-12');
ok(
  'laba rugi Desember tetap 2.000.000 (jurnal penutup dikecualikan)',
  Number(decIncomeStmt.json?.data?.current?.totals?.revenue) === 2_000_000,
  `revenue=${decIncomeStmt.json?.data?.current?.totals?.revenue}`
);

const tbClose = await api('/api/v1/accounting/reports/trial-balance?period=2026-12');
ok('neraca saldo tetap balance setelah tutup tahun', Number(tbClose.json?.data?.current?.totals?.difference) === 0);

// Periode bulan terakhir ikut tertutup, dan tutup tahun tidak bisa diulang.
const periodsAfterClose = await api('/api/v1/accounting/periods');
const decAfter = (periodsAfterClose.json?.data ?? []).find((p) => p.year === 2026 && p.month === 12);
ok('periode Desember tertutup setelah tutup tahun', decAfter?.status === 'CLOSED', `status=${decAfter?.status}`);
ok('periode Desember ditandai tahun buku sudah ditutup', decAfter?.fiscalYearClosed === true);
ok('nomor jurnal penutup terlihat di daftar periode', Boolean(decAfter?.closingEntryNumber), decAfter?.closingEntryNumber);

const closeAgain = await api(`/api/v1/accounting/periods/${dec.id}/close-year`, { method: 'POST' });
ok('tutup tahun ganda ditolak', closeAgain.status === 400, closeAgain.json?.message?.slice(0, 90));

// Jurnal biasa di periode yang sudah ditutup tetap ditolak.
const afterCloseJournal = await api('/api/v1/accounting/journals', {
  method: 'POST',
  body: {
    entryDate: '2026-12-28',
    description: 'Jurnal setelah tutup tahun',
    lines: [
      { accountId: byCode['6-1400'].id, debit: 10_000, credit: 0 },
      { accountId: byCode['1-1110'].id, debit: 0, credit: 10_000 },
    ],
  },
});
ok('jurnal baru setelah tutup tahun ditolak', afterCloseJournal.status === 400, afterCloseJournal.json?.message?.slice(0, 70));

console.log(`\n${failures === 0 ? '🎉 SEMUA PEMERIKSAAN LULUS' : `⚠️  ${failures} pemeriksaan gagal`}`);
process.exit(failures === 0 ? 0 : 1);

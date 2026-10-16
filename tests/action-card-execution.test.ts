import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mapActionCardTypeToExecutionActionType,
  executeActionCardOnServer,
} from '../src/lib/ai-brain/action-card-execution';
import { aiTextIndicatesMissingData } from '../src/lib/ai-brain/action-card-data-gate';

// ---------------------------------------------------------------------------
// Gap kemampuan-001 (audit 7 Sep 2026): handleCardExecution di ExecutiveAI/
// FinanceAI/MarketingAIAssistantView.tsx dulu TIDAK PERNAH memanggil backend --
// cuma menulis angka hardcode ke localStorage. Modul ini (action-card-execution.ts)
// adalah jembatan baru yang benar-benar dipanggil ketiga view itu. Test di bawah
// memverifikasi pemetaan actionCard.type -> actionType ExecutionEngine, dan bahwa
// fetch dipanggil dengan payload yang benar + hasil sukses/gagal dinormalisasi
// dengan jujur (pesan ASLI dari server, bukan dikarang ulang di client).
// ---------------------------------------------------------------------------

test('mapActionCardTypeToExecutionActionType memetakan semua tipe actionCard ketiga portal', () => {
  assert.equal(mapActionCardTypeToExecutionActionType('SCALE_ADS'), 'SCALE_MARKETING');
  assert.equal(mapActionCardTypeToExecutionActionType('SCALE_BUDGET'), 'SCALE_MARKETING');
  assert.equal(mapActionCardTypeToExecutionActionType('LAUNCH_ADS'), 'SCALE_MARKETING');
  assert.equal(mapActionCardTypeToExecutionActionType('HIRE_STAFF'), 'APPROVE_HIRING');
  assert.equal(mapActionCardTypeToExecutionActionType('RESOLVE_INVOICE'), 'COLLECT_INVOICES');
  assert.equal(mapActionCardTypeToExecutionActionType('OPTIMIZE_EXPENSES'), 'AUDIT_OPEX');
  assert.equal(mapActionCardTypeToExecutionActionType('WEEKLY_REC'), 'AUDIT_OPEX');
});

test('tipe actionCard yang tidak dikenal diteruskan apa adanya (ExecutionEngine punya default branch jujur)', () => {
  assert.equal(mapActionCardTypeToExecutionActionType('SOME_FUTURE_TYPE'), 'SOME_FUTURE_TYPE');
});

test('executeActionCardOnServer memanggil POST /api/v1/brain/execute dengan actionType hasil mapping', async () => {
  const calls: Array<{ url: string; init: any }> = [];
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, init: any) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          message: 'Kupon promo baru SCALE20_X82H berhasil dibuat.',
          details: { couponCode: 'SCALE20_X82H' },
          actionId: 'act-123',
        },
      }),
    } as any;
  };

  try {
    const result = await executeActionCardOnServer({
      cardType: 'SCALE_ADS',
      cardTitle: 'Evaluasi & Scale Kampanye Iklan Aktif',
      recommendationId: 'rec-mkt-scale-growth',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/v1/brain/execute');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.actionType, 'SCALE_MARKETING');
    assert.equal(body.recommendationId, 'rec-mkt-scale-growth');
    assert.match(calls[0].init.headers['Idempotency-Key'], /^.{16,}$/);
    assert.match(body.userNotes, /Evaluasi & Scale Kampanye Iklan Aktif/);

    assert.equal(result.ok, true);
    // Pesan yang dikembalikan HARUS pesan asli dari server, bukan dikarang ulang.
    assert.equal(result.message, 'Kupon promo baru SCALE20_X82H berhasil dibuat.');
    assert.equal(result.actionId, 'act-123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('executeActionCardOnServer melaporkan kegagalan server dengan jujur (bukan sukses palsu)', async () => {
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ success: false, message: 'Peran Anda tidak diizinkan mengeksekusi aksi ini.' }),
  } as any);

  try {
    const result = await executeActionCardOnServer({ cardType: 'HIRE_STAFF', cardTitle: 'Tangani Tugas Terlambat', recommendationId: 'rec-ops-execution-boost' });
    assert.equal(result.ok, false);
    assert.equal(result.message, 'Peran Anda tidak diizinkan mengeksekusi aksi ini.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('executeActionCardOnServer melaporkan kegagalan jaringan dengan jujur', async () => {
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => {
    throw new Error('network down');
  };

  try {
    const result = await executeActionCardOnServer({ cardType: 'RESOLVE_INVOICE', cardTitle: 'Kirim Reminder Invoice', recommendationId: 'rec-fin-overdue-invoices' });
    assert.equal(result.ok, false);
    assert.match(result.message, /network down/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Gap kemampuan-003: actionCard tidak boleh dipasang kalau jawaban AI sendiri
// sudah jujur bilang datanya tidak ada.
// ---------------------------------------------------------------------------

test('aiTextIndicatesMissingData mendeteksi frasa "tidak ada data" dari jawaban AI', () => {
  assert.equal(
    aiTextIndicatesMissingData('Maaf, tidak ada nilai budget iklan TikTok yang tercatat di sistem.'),
    true
  );
  assert.equal(aiTextIndicatesMissingData('Data pengeluaran bulan ini belum tercatat di sistem.'), true);
  assert.equal(aiTextIndicatesMissingData('TIDAK ADA DATA transaksi ditemukan untuk periode ini.'), true);
});

test('aiTextIndicatesMissingData tidak salah-positif untuk jawaban yang punya data nyata', () => {
  assert.equal(
    aiTextIndicatesMissingData('Kampanye TikTok Anda saat ini punya ROAS 3.2x dengan budget Rp 2.000.000.'),
    false
  );
  assert.equal(aiTextIndicatesMissingData(''), false);
  assert.equal(aiTextIndicatesMissingData(null as any), false);
  assert.equal(aiTextIndicatesMissingData(undefined as any), false);
});

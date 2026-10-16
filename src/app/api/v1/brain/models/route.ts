import { NextResponse } from 'next/server';
import { withMediaGuard } from '@/lib/media-http';
import { discoverTextModels } from '@/lib/text-model-catalog';
export const runtime = 'nodejs';

// GET /api/v1/brain/models?q=&limit= -- katalog model teks untuk dropdown
// "Setelan jawaban" di ComposerToolbar. Dibuat 8 Sep 2026.
//
// BENTUK RESPONS (revisi wajib per kritik "terlewat" 8 Sep, temuan KRITIS
// pertama): {success:true, data:{models:[...]}}, BUKAN {models} polos seperti
// draf awal -- apiRequest() di marketing-media/client.ts (WAJIB dipakai B2
// untuk semua fetch) memeriksa `!json?.success` dan melempar error kalau
// field itu tidak ada, walau HTTP status 200. Bentuk ini disamakan persis
// dengan pola GET /api/v1/media/models/route.ts yang sudah ada.
//
// Guard: pakai withMediaGuard yang sudah ada (JWT + keanggotaan workspace +
// rate-limit baca), TIDAK bikin guard baru -- sesuai batasan tugas B1.
export const GET = withMediaGuard(async req => {
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  const limitParam = Number.parseInt(req.nextUrl.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;
  const all = await discoverTextModels();
  const filtered = q
    ? all.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    : all;
  const models = filtered.slice(0, limit);
  return NextResponse.json({ success: true, data: { models } }, { headers: { 'Cache-Control': 'no-store' } });
});

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateContextCache } from '@/lib/ai-brain/context-engine';
// Guard tenant dikembalikan (M-temuan audit keamanan 6 Sep) -- GET/POST/PUT di
// berkas ini sebelumnya polos, terbukti di produksi: GET dengan id ngawur balik
// 500 berisi galat Prisma mentah, dan tanpa guard endpoint ini bisa baca DAN
// TULIS profil usaha tenant lain. Pola withTenantGuard + auth.workspace.id
// ditiru dari src/app/api/v1/workspaces/[workspaceId]/grants/route.ts (baris
// 9-27) dan .../members/route.ts (baris 9-54) -- keduanya dynamic route
// [workspaceId] yang sama, dan sama-sama TIDAK memakai segmen path workspaceId
// untuk otorisasi, murni mengandalkan auth.workspace.id hasil guard (dari
// cookie klir_token / header x-workspace-id). Segmen path di sini pun
// dibiarkan tidak dipakai untuk otorisasi, demi konsisten dengan pola yang
// sudah berjalan di seluruh /workspaces/[workspaceId]/* -- bukan lupa.
import { withTenantGuard } from '@/lib/tenant-guard';

/**
 * GET /api/v1/workspaces/[workspaceId]/profile
 * Ambil profil perusahaan (nama, industri, target pasar, dst) milik workspace
 * milik user yang terautentikasi (auth.workspace.id), BUKAN workspace apapun
 * yang diminta di path. Fallback lama "kalau id tidak ketemu, ambil workspace
 * TERBARU DI SELURUH DATABASE" dihapus -- itu sendiri lubang lintas-tenant:
 * siapapun yang kirim id ngawur otomatis dilempar ke data tenant lain.
 */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  try {
    const targetWsId = auth.workspace.id;
    const ws = await prisma.workspace.findUnique({ where: { id: targetWsId } });

    if (!ws) {
      // Praktis tidak akan pernah kena -- guard sudah memvalidasi workspace ini
      // ada sebelum handler ini jalan. Dibiarkan sebagai jaga-jaga saja.
      return NextResponse.json({ success: false, message: 'Workspace tidak ditemukan' }, { status: 404 });
    }

    const latestMemory = await prisma.memoryItem.findFirst({
      where: {
        workspaceId: targetWsId,
        scope: 'WORKSPACE',
        content: { startsWith: '[COMPANY_PROFILE]' },
      },
      orderBy: { createdAt: 'desc' },
    });

    let companyName = ws.name;
    let industry: string | null = null;
    let targetMarket: string | null = null;
    let description: string | null = null;
    let primaryProduct: string | null = null;
    let businessModel: string | null = null;
    let nib: string | null = null;
    let source: string = 'UNSET';

    if (latestMemory?.content) {
      const nameMatch = latestMemory.content.match(/Nama:\s*([^|]+)/i);
      if (nameMatch && nameMatch[1].trim() && nameMatch[1].trim() !== '-') {
        companyName = nameMatch[1].trim();
      }
      const indMatch = latestMemory.content.match(/Industri:\s*([^|]+)/i);
      if (indMatch && indMatch[1].trim() && indMatch[1].trim() !== '-') {
        industry = indMatch[1].trim();
      }
      const targetMatch = latestMemory.content.match(/Target Pasar:\s*([^|]+)/i);
      if (targetMatch && targetMatch[1].trim() && targetMatch[1].trim() !== '-') {
        targetMarket = targetMatch[1].trim();
      }
      const descMatch = latestMemory.content.match(/Deskripsi:\s*([^|]+)/i);
      if (descMatch && descMatch[1].trim() && descMatch[1].trim() !== '-') {
        description = descMatch[1].trim();
      }
      const prodMatch = latestMemory.content.match(/Produk:\s*([^|]+)/i);
      if (prodMatch && prodMatch[1].trim() && prodMatch[1].trim() !== '-') {
        primaryProduct = prodMatch[1].trim();
      }
      // 8 Sep 2026 -- full-scan pajangan F2(exec): CEOSettingsModal Tab 1 punya
      // field NIB & Model Bisnis yang sebelumnya CUMA localStorage (tidak pernah
      // dikirim ke server). Extend regex string [COMPANY_PROFILE] yang sama,
      // pola identik dengan field lain di atas -- NOL perubahan schema.prisma
      // (tetap 1 kolom Text `content`). Kontrak diumumkan ke B1 (CEOSettingsModal).
      const bmMatch = latestMemory.content.match(/Model Bisnis:\s*([^|]+)/i);
      if (bmMatch && bmMatch[1].trim() && bmMatch[1].trim() !== '-') {
        businessModel = bmMatch[1].trim();
      }
      const nibMatch = latestMemory.content.match(/NIB:\s*([^|]+)/i);
      if (nibMatch && nibMatch[1].trim() && nibMatch[1].trim() !== '-') {
        nib = nibMatch[1].trim();
      }
      const srcMatch = latestMemory.content.match(/Sumber:\s*([^|]+)/i);
      if (srcMatch && srcMatch[1].trim()) {
        source = srcMatch[1].trim();
      } else {
        source = 'AI_RECORDED';
      }
    }

    const isConfigured = !!(latestMemory || (companyName && !companyName.toLowerCase().includes('workspace')));

    return NextResponse.json({
      success: true,
      data: {
        workspaceId: targetWsId,
        name: companyName,
        industry: industry || 'Belum ditentukan',
        targetMarket: targetMarket || 'Belum ditentukan',
        description: description || 'Belum ada deskripsi profil',
        primaryProduct: primaryProduct || 'Belum ditentukan',
        businessModel: businessModel || 'Belum ditentukan',
        nib: nib || '-',
        source,
        isConfigured,
        updatedAt: latestMemory?.createdAt || ws.updatedAt,
      },
    });
  } catch (err: any) {
    // Pesan mentah err.message (bisa berisi detail internal Prisma) TIDAK lagi
    // dikirim ke pemanggil -- cukup log lengkap di server, klien cuma dapat
    // pesan umum. (Temuan audit: endpoint ini pernah balas 500 dengan galat
    // Prisma mentah ke client yang belum login.)
    console.error('[WorkspaceProfile] GET error:', err);
    return NextResponse.json({ success: false, message: 'Gagal mengambil profil perusahaan' }, { status: 500 });
  }
}, { minRole: 'VIEWER' });

/**
 * POST /api/v1/workspaces/[workspaceId]/profile
 * Simpan/perbarui profil perusahaan. workspaceId dari auth.workspace.id, sama
 * seperti GET -- fallback lintas-tenant "workspace terbaru di seluruh DB" ikut
 * dihapus di sini juga (sebelumnya bisa dipakai buat NULIS ke workspace tenant
 * lain kalau id yang dikirim tidak ketemu).
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  try {
    const targetWsId = auth.workspace.id;
    const body = await req.json().catch(() => ({}));

    const {
      name,
      industry,
      targetMarket,
      description,
      primaryProduct,
      businessModel,
      nib,
      source = 'MANUAL',
    } = body;

    const ws = await prisma.workspace.findUnique({ where: { id: targetWsId } });

    if (!ws) {
      // Sama seperti GET: praktis tidak akan pernah kena, guard sudah pastikan
      // workspace ini ada. Dibiarkan sebagai jaga-jaga saja.
      return NextResponse.json({ success: false, message: 'Workspace tidak ditemukan' }, { status: 404 });
    }

    const newName = (name || '').trim() || ws.name;
    const newIndustry = (industry || '').trim() || '-';
    const newTarget = (targetMarket || '').trim() || '-';
    const newDesc = (description || '').trim() || '-';
    const newProd = (primaryProduct || '').trim() || '-';
    // 8 Sep 2026 -- full-scan pajangan F2(exec)/B5 kontrak: 2 field baru dari
    // Tab "Profil Usaha" CEOSettingsModal (NIB & Model Bisnis) yang sebelumnya
    // ditulis ke localStorage saja dan tidak pernah sampai ke server. Ditambahkan
    // ke string [COMPANY_PROFILE] yang sama, pola persis field lain di atas.
    const newBusinessModel = (businessModel || '').trim() || '-';
    const newNib = (nib || '').trim() || '-';

    // 1. Update nama workspace jika diberikan
    if (name && name.trim()) {
      await prisma.workspace.update({
        where: { id: targetWsId },
        data: { name: newName },
      });
    }

    // 2. Catat ke memory item [COMPANY_PROFILE]
    const memoryRecord = await prisma.memoryItem.create({
      data: {
        workspaceId: targetWsId,
        userId: null,
        scope: 'WORKSPACE',
        content: `[COMPANY_PROFILE] Nama: ${newName} | Industri: ${newIndustry} | Target Pasar: ${newTarget} | Deskripsi: ${newDesc} | Produk: ${newProd} | Model Bisnis: ${newBusinessModel} | NIB: ${newNib} | Sumber: ${source}`,
      },
    });

    // 3. Invalidasi cache AI Brain
    invalidateContextCache(targetWsId);

    return NextResponse.json({
      success: true,
      message: 'Profil perusahaan berhasil disimpan dan disinkronkan ke AI.',
      data: {
        workspaceId: targetWsId,
        name: newName,
        industry: newIndustry !== '-' ? newIndustry : 'Belum ditentukan',
        targetMarket: newTarget !== '-' ? newTarget : 'Belum ditentukan',
        description: newDesc !== '-' ? newDesc : 'Belum ada deskripsi profil',
        primaryProduct: newProd !== '-' ? newProd : 'Belum ditentukan',
        businessModel: newBusinessModel !== '-' ? newBusinessModel : 'Belum ditentukan',
        nib: newNib,
        source,
        isConfigured: true,
        updatedAt: memoryRecord.createdAt,
      },
    });
  } catch (err: any) {
    // Sama seperti GET: err.message mentah tidak lagi dikirim ke klien.
    console.error('[WorkspaceProfile] POST error:', err);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan profil perusahaan' }, { status: 500 });
  }
}, { minRole: 'MEMBER' });

/**
 * PUT /api/v1/workspaces/[workspaceId]/profile
 * Alias dari POST (perilaku lama). Reuse handler yang sudah dibungkus guard
 * di atas -- tidak wrap withTenantGuard dua kali.
 */
export const PUT = POST;

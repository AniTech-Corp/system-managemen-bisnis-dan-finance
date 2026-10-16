import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateTenantRequest, extractTokenFromRequest } from '@/lib/tenant-guard';
import { analyzeLocation } from '@/lib/location-research';
import { publicApiError } from '@/lib/api-error';
import { resolveDivisionRole } from '@/lib/ai-brain/data-visibility';
import { isNewDivisionRole } from '@/lib/ai-brain/role-policy';

// POST /api/v1/brain/location -- analisis lokasi bisnis (kompetitor sekitar +
// verdict kasar, wadah Google Maps + fallback riset web). Dibangun 8 Sep 2026
// (wave B3-location-research), permintaan Mecca 8 Sep sore.
//
// SECURITY (Multi-Tenant Isolation): pola guard SAMA seperti
// recommendations/route.ts dan simulate/route.ts -- authenticateTenantRequest
// dulu sebelum apapun lain. Logic analyzeLocation() sendiri TIDAK baca data
// workspace apapun (murni riset publik), tapi guard tetap WAJIB supaya
// endpoint yang memicu panggilan Gemini grounding (biaya + kuota bersama,
// lihat context pack) tidak bisa dipanggil bebas oleh siapa saja tanpa sesi.
export const runtime = 'nodejs';

const locationInputSchema = z.object({
  businessName: z.string().trim().min(1, 'Nama usaha wajib diisi').max(200),
  category: z.string().trim().min(1, 'Kategori usaha wajib diisi').max(100),
  area: z.string().trim().min(1, 'Lokasi/alamat wajib diisi').max(300),
  radiusKm: z.number().finite().min(0.5).max(20).optional(),
  purpose: z.enum(['cabang_baru', 'sekitar_kantor']),
});

export async function POST(req: NextRequest) {
  try {
    // SECURITY (Zero-Auth Bypass Guard, 8 Sep sore, pola chat/route.ts): tanpa token sama sekali
    // tenant-guard dev-mode fallback ke user pertama -- tolak di sini dulu.
    if (!extractTokenFromRequest(req)) {
      return NextResponse.json({ success: false, code: 'UNAUTHENTICATED', message: 'Autentikasi diperlukan.' }, { status: 401 });
    }
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }
    const divisionRole = resolveDivisionRole({ email: guard.auth.user.email, membershipRole: guard.auth.membership.role, membershipDivisionRole: guard.auth.membership.divisionRole });
    if (isNewDivisionRole(divisionRole)) {
      return NextResponse.json({ success: false, code: 'ROLE_CAPABILITY_UNSUPPORTED', message: divisionRole === 'MANAGER_UMUM' ? 'Analisis lokasi Manager membutuhkan scope tim authoritative; branch/company-wide fallback tidak digunakan.' : 'Analisis lokasi belum tersedia untuk role ini.' }, { status: divisionRole === 'MANAGER_UMUM' ? 409 : 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Body permintaan bukan JSON yang valid' },
        { status: 400 }
      );
    }

    const parsed = locationInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Input analisis lokasi tidak valid',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await analyzeLocation(parsed.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[AI Brain Location API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicApiError('Analisis lokasi gagal dijalankan.'),
      },
      { status: 500 }
    );
  }
}

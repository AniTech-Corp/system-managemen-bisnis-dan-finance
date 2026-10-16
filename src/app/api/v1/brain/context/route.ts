import { NextRequest, NextResponse } from 'next/server';
import { getOrBuildBusinessContext } from '@/lib/ai-brain';
import { authenticateTenantRequest } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    // SECURITY (Multi-Tenant Isolation): resolve workspace HANYA dari sesi
    // pemanggil yang terautentikasi -- bukan dari searchParams/header yang
    // dikontrol pemanggil. Tanpa requiredWorkspaceId: fungsi otomatis resolve
    // ke workspace milik user (lihat tenant-guard.ts baris 119-136).
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const forceFresh = searchParams.get('fresh') === 'true';
    const month = searchParams.get('month');

    // SECURITY: workspaceId SELALU dari guard (sesi terautentikasi), TIDAK PERNAH
    // fallback ke workspace pertama di DB / searchParams pemanggil -- itu pola lama
    // yang sudah diperbaiki di P0 auth-guard fix (commit 055eeb4), jangan diregresi
    // oleh merge ini. `month` (fitur baru dari push Fatur) tetap diteruskan.
    const context = await getOrBuildBusinessContext(guard.auth.workspace.id, forceFresh, month, { includeCompanyKnowledge: true });

    return NextResponse.json({
      success: true,
      data: context,
    });
  } catch (error: any) {
    console.error('[AI Brain Context API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicApiError('Gagal memuat konteks bisnis workspace.'),
      },
      { status: 500 }
    );
  }
}

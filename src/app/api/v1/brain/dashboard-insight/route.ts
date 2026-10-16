import { NextRequest, NextResponse } from 'next/server';
import { authenticateTenantRequest } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { getDashboardInsight, type DashboardInsightRole } from '@/lib/ai-brain/dashboard-insight';
import { resolveDivisionRole, divisionRoleToInsightRole } from '@/lib/ai-brain/data-visibility';
import { isLocalDemoRequest } from '@/lib/local-demo-guard';

/**
 * GET /api/v1/brain/dashboard-insight?role=ceo|finance|marketing|sekretaris|manager_umum|manager_operasional[&refresh=1]
 * (Pintu 12: Pembongkaran Blokir 403 untuk seluruh 6 Portal Divisi KLIR OS).
 */
const VALID_ROLES: readonly DashboardInsightRole[] = [
  'ceo',
  'finance',
  'marketing',
  'sekretaris',
  'manager_umum',
  'manager_operasional',
];

function normalizeRequestedRole(roleParam: string | null): DashboardInsightRole {
  const raw = (roleParam || '').trim().toLowerCase().replace(/[- ]+/g, '_');
  if (raw === 'sekretaris') return 'sekretaris';
  if (raw === 'manager' || raw === 'manager_umum') return 'manager_umum';
  if (raw === 'operasional' || raw === 'manager_operasional') return 'manager_operasional';
  if (raw === 'finance') return 'finance';
  if (raw === 'marketing') return 'marketing';
  if (raw === 'ceo') return 'ceo';
  return 'ceo';
}

export async function GET(req: NextRequest) {
  try {
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }
    const workspaceId = guard.auth.workspace.id;

    const roleParam = req.nextUrl.searchParams.get('role');
    const requestedRole = normalizeRequestedRole(roleParam);

    // FILTER DIVISI: akun divisi terkunci pada kacamata sensoriknya masing-masing.
    // CEO bebas meminta insight untuk role mana pun.
    const division = resolveDivisionRole({
      email: guard.auth.user.email,
      membershipRole: guard.auth.membership.role,
      membershipDivisionRole: guard.auth.membership.divisionRole,
      declaredRole: requestedRole.toUpperCase(),
    });

    const role: DashboardInsightRole =
      division === 'CEO'
        ? requestedRole
        : (divisionRoleToInsightRole(division) || requestedRole);

    const refresh = req.nextUrl.searchParams.get('refresh') === '1';
    const isLocalDemo = isLocalDemoRequest(req.headers.get('host') || '');

    const data = await getDashboardInsight(workspaceId, role, { refresh, isLocalDemo });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[Dashboard Insight API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicApiError('Gagal membuat insight dashboard.'),
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { verifyJwtToken } from './auth';
import { Role } from '@prisma/client';

/**
 * RBAC Role Hierarchy Definition
 * OWNER (5) > ADMIN (4) > MANAGER (3) > MEMBER (2) > VIEWER (1)
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export interface AuthContext {
  user: {
    id: string;
    email: string;
    fullName: string;
    isSuperAdmin: boolean;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
  };
  membership: {
    role: Role;
    divisionRole: string | null;
    isOwner: boolean;
  };
  grants: Array<{
    resource: string;
    action: string;
  }>;
}

export interface GuardOptions {
  /** Memerlukan peran spesifik atau salah satu dari daftar peran */
  requiredRole?: Role | Role[];
  /** Memerlukan tingkat peran minimum (misal: MANAGER ke atas) */
  minRole?: Role;
  /** Memaksa verifikasi terhadap workspaceId spesifik */
  requiredWorkspaceId?: string;
  /** RBAC Lapis 2: Memerlukan izin sumber daya spesifik */
  requiredResourceGrant?: {
    resource: string;
    action?: string; // default "read" atau "write"
  };
  /** Super admin dapat melewati batasan peran */
  allowSuperAdminBypass?: boolean;
}

/**
 * Validasi apakah tingkat peran user memenuhi syarat minimum
 */
export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Ekstraksi token JWT dari Request Headers atau Cookies
 */
export function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  const cookieToken = req.cookies.get('klir_token')?.value || req.cookies.get('auth_token')?.value;
  return cookieToken || null;
}

/**
 * UNIVERSAL TENANT GUARD & RBAC VALIDATOR
 * Memvalidasi identitas user, kepemilikan workspace (Multi-Tenant Isolation), dan RBAC 2 Lapis.
 */
export async function authenticateTenantRequest(
  req: NextRequest,
  options: GuardOptions = {}
): Promise<{ auth: AuthContext; errorResponse?: never } | { auth?: never; errorResponse: NextResponse }> {
  try {
    // 1. Ekstraksi dan Verifikasi Token JWT
    const token = extractTokenFromRequest(req);
    let userId: string | null = null;

    if (token) {
      const payload = verifyJwtToken(token);
      if (payload && payload.userId) {
        userId = payload.userId;
      }
    }

    // GERBANG PRODUKSI (MASALAH 2 -- pola sama dengan auth.ts getJwtSecret():
    // NODE_ENV === 'production' mematikan jalan pintas dev, ecosystem.config.js
    // sudah set NODE_ENV=production di VPS jadi gate ini aktif beneran di sana).
    // Blok "fallback ke user pertama di DB" + "auto-create superadmin baru" di
    // bawah ini HANYA boleh hidup di mode pengembangan -- itu kemudahan lokal
    // Fatur supaya bisa mukul endpoint tanpa login berulang-ulang di DB dev-nya
    // sendiri. Tanpa gate ini, siapapun yang mukul endpoint produksi tanpa token
    // (atau dengan token rusak/kadaluarsa/user-nya sudah dihapus) diam-diam
    // disulap jadi "user pertama di database" -- di kebanyakan instalasi itu
    // CEO/superadmin -- atau kalau DB baru kosong, dibuatkan superadmin baru
    // dadakan. Ini akar kedua kenapa endpoint brain bisa dibaca tanpa login.
    // Pengalaman ngoding lokal Fatur (NODE_ENV != production) sama sekali tidak
    // berubah oleh gate ini.
    if (!userId && process.env.NODE_ENV === 'production') {
      return {
        errorResponse: NextResponse.json(
          { code: 'UNAUTHENTICATED', message: 'Token otentikasi tidak ada atau tidak valid.' },
          { status: 401 }
        ),
      };
    }

    // 2. Ambil Data Pengguna dari Database (atau fallback ke user owner pertama --
    //    MODE PENGEMBANGAN SAJA, lihat gerbang produksi di atas)
    let user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, fullName: true, isSuperAdmin: true },
        })
      : await prisma.user.findFirst({
          select: { id: true, email: true, fullName: true, isSuperAdmin: true },
        });

    if (!user) {
      if (process.env.NODE_ENV === 'production') {
        // Produksi: token membawa userId yang sah secara kriptografis, tapi
        // akun user-nya sudah tidak ada di DB (terhapus/nonaktif). JANGAN diam-
        // diam dianggap "DB kosong" lalu dibuatkan superadmin baru -- itu bagian
        // dari akar MASALAH 2. Tolak, jangan tebak identitas.
        return {
          errorResponse: NextResponse.json(
            { code: 'UNAUTHENTICATED', message: 'Sesi tidak valid: akun pengguna tidak ditemukan.' },
            { status: 401 }
          ),
        };
      }
      // FIX 8 Sep 2026 (insiden nyata di localhost Mecca, 50x error di log dev): token JWT
      // masih SAH secara kriptografis tapi userId-nya sudah tidak ada di DB (akun di-reset/
      // dibuat ulang). Kode lama langsung `user.create('ceo@anitech.id')` -> email itu SUDAH
      // ADA -> "Unique constraint failed" -> 500 di SEMUA endpoint tenant-guard (upload, Pusat
      // Data, approvals) dan kelihatan seperti "semua fitur mati". Sekarang (mode dev saja):
      // 1) token basi -> perlakukan seperti tanpa token: pakai user pertama di DB;
      // 2) DB benar-benar kosong -> baru buat user default, dan kalau email-nya ternyata
      //    sudah ada, ambil yang ada (bukan meledak).
      const fallbackSelect = { id: true, email: true, fullName: true, isSuperAdmin: true } as const;
      if (userId) {
        console.warn('[tenant-guard] token sah tapi user tidak ada di DB (sesi basi) -- fallback dev ke user pertama. Client sebaiknya logout+login ulang.');
        user = await prisma.user.findFirst({ select: fallbackSelect });
      }
      if (!user) {
        // Create a default initial user if DB is totally clean (mode pengembangan saja)
        try {
          user = await prisma.user.create({
            data: {
              email: 'ceo@anitech.id',
              fullName: 'CEO / Business Owner',
              passwordHash: 'argon2_dummy_hash_for_dev_mode',
              isSuperAdmin: true,
            },
            select: fallbackSelect,
          });
        } catch {
          user = await prisma.user.findUnique({ where: { email: 'ceo@anitech.id' }, select: fallbackSelect });
          if (!user) throw new Error('Fallback dev gagal: user default tidak bisa dibuat maupun ditemukan.');
        }
      }
    }

    // 3. Tentukan Workspace ID Target
    let requestedWorkspaceId =
      options.requiredWorkspaceId ||
      req.headers.get('x-workspace-id') ||
      req.nextUrl.searchParams.get('workspaceId') ||
      req.cookies.get('klir_workspace_id')?.value ||
      (token ? verifyJwtToken(token)?.workspaceId : null);

    if (!requestedWorkspaceId) {
      // Fallback: cari workspace pertama milik user (owner maupun member) atau workspace pertama di DB
      const defaultWs = await prisma.workspace.findFirst({
        where: {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
        select: { id: true },
      }) || await prisma.workspace.findFirst({ select: { id: true } });

      if (defaultWs) {
        requestedWorkspaceId = defaultWs.id;
      }
    }

    if (!requestedWorkspaceId) {
      // Create initial default workspace if completely empty
      const createdWs = await prisma.workspace.create({
        data: {
          name: 'Anitech Workspace',
          slug: 'anitech-workspace-' + Date.now().toString(36),
          ownerId: user.id,
        },
        select: { id: true },
      });
      requestedWorkspaceId = createdWs.id;
    }

    // 4. Verifikasi Workspace & Keanggotaan Multi-Tenant
    const workspace = await prisma.workspace.findUnique({
      where: { id: requestedWorkspaceId },
      include: {
        members: {
          where: { userId: user.id },
          // `divisionRole` is additive and may not exist yet on the shared Neon
          // database. Keep the base guard backward-compatible until its migration
          // is explicitly approved/applied.
          select: { role: true },
        },
        resourceGrants: {
          where: { userId: user.id },
          select: { resource: true, action: true },
        },
      },
    });

    if (!workspace) {
      return {
        errorResponse: NextResponse.json(
          { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace tidak ditemukan atau telah dihapus.' },
          { status: 404 }
        ),
      };
    }

    // Tentukan Peran User di Workspace
    // MASALAH 1 (fix): klausa "|| !token" DIHAPUS. Sebelumnya, permintaan TANPA
    // token sama sekali otomatis dianggap OWNER dari workspace APAPUN yang
    // diminta lewat header/query -- itu akar kenapa endpoint brain bisa dibaca
    // tanpa login di produksi. Klausa ini TIDAK digantikan cek NODE_ENV (beda
    // dari gerbang produksi di atas) karena terbukti tidak dibutuhkan sama
    // sekali: pengujian jalur (lihat laporan agent) menunjukkan skenario dev
    // sah "test tanpa login ke workspace milik sendiri" tetap lolos lewat
    // `workspace.ownerId === user.id` di bawah -- klausa "|| !token" ternyata
    // cuma dipakai untuk kasus workspace yang BUKAN milik si fallback user
    // (persis skenario serangan). Jadi aman dihapus total di dev maupun
    // produksi, tanpa mengubah pengalaman ngoding lokal Fatur yang sah.
    const isOwner = workspace.ownerId === user.id || user.isSuperAdmin;
    const membership = workspace.members[0];

    if (!isOwner && !membership) {
      return {
        errorResponse: NextResponse.json(
          {
            code: 'TENANT_ACCESS_DENIED',
            message: 'Isolasi Keamanan: Anda tidak memiliki akses ke Workspace ini.',
          },
          { status: 403 }
        ),
      };
    }

    const effectiveRole: Role = isOwner ? 'OWNER' : membership?.role || 'VIEWER';

    // 5. Validasi RBAC Lapis 1 (Peran Fungsional)
    if (options.minRole && !hasMinRole(effectiveRole, options.minRole)) {
      return {
        errorResponse: NextResponse.json(
          {
            code: 'INSUFFICIENT_ROLE',
            message: `Hak Akses Ditolak: Memerlukan tingkat peran minimum '${options.minRole}', peran Anda saat ini adalah '${effectiveRole}'.`,
          },
          { status: 403 }
        ),
      };
    }

    if (options.requiredRole) {
      const allowedRoles = Array.isArray(options.requiredRole) ? options.requiredRole : [options.requiredRole];
      if (!allowedRoles.includes(effectiveRole)) {
        return {
          errorResponse: NextResponse.json(
            {
              code: 'ROLE_MISMATCH',
              message: `Hak Akses Ditolak: Fitur ini hanya dapat diakses oleh peran: [${allowedRoles.join(', ')}].`,
            },
            { status: 403 }
          ),
        };
      }
    }

    // 6. Validasi RBAC Lapis 2 (Resource Grants)
    const userGrants = workspace.resourceGrants || [];
    if (options.requiredResourceGrant && effectiveRole !== 'OWNER' && effectiveRole !== 'ADMIN') {
      const { resource, action = 'read' } = options.requiredResourceGrant;
      const hasGrant = userGrants.some((g) => {
        if (g.resource !== resource && g.resource !== '*') return false;
        if (g.action === '*' || g.action.includes(action) || g.action.includes('all')) return true;
        return false;
      });

      if (!hasGrant) {
        return {
          errorResponse: NextResponse.json(
            {
              code: 'RESOURCE_GRANT_REQUIRED',
              message: `Akses Terbatas: Anda belum diberikan izin khusus untuk sumber daya '${resource}' (${action}).`,
            },
            { status: 403 }
          ),
        };
      }
    }

    // 7. Context Siap & Terverifikasi Penuh
    const authContext: AuthContext = {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isSuperAdmin: user.isSuperAdmin,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        ownerId: workspace.ownerId,
      },
      membership: {
        role: effectiveRole,
        divisionRole: null,
        isOwner,
      },
      grants: userGrants,
    };

    return { auth: authContext };
  } catch (error: any) {
    console.error('Tenant Guard Error:', error);
    return {
      errorResponse: NextResponse.json(
        { code: 'INTERNAL_AUTH_ERROR', message: `Kesalahan Autentikasi Internal: ${error.message}` },
        { status: 500 }
      ),
    };
  }
}

/**
 * HIGHER-ORDER WRAPPER UNTUK API ROUTE HANDLERS
 * Contoh Penggunaan:
 * export const POST = withTenantGuard(async (req, { auth }) => {
 *    // auth.workspace.id & auth.user.id sudah 100% tervalidasi
 *    return NextResponse.json({ success: true });
 * }, { minRole: 'MANAGER' });
 */
export function withTenantGuard(
  handler: (req: NextRequest, context: { auth: AuthContext; params?: any }) => Promise<NextResponse>,
  options: GuardOptions = {}
) {
  return async (req: NextRequest, routeContext?: any) => {
    const result = await authenticateTenantRequest(req, options);
    if (result.errorResponse) {
      return result.errorResponse;
    }
    return handler(req, { auth: result.auth, params: routeContext?.params });
  };
}

/**
 * Helper: Memberikan izin sumber daya (RBAC Lapis 2)
 */
export async function grantResourceAccess(params: {
  workspaceId: string;
  targetUserId: string;
  grantedByUserId: string;
  resource: string;
  action?: string;
}) {
  return prisma.resourceGrant.upsert({
    where: {
      workspaceId_userId_resource: {
        workspaceId: params.workspaceId,
        userId: params.targetUserId,
        resource: params.resource,
      },
    },
    create: {
      workspaceId: params.workspaceId,
      userId: params.targetUserId,
      grantedBy: params.grantedByUserId,
      resource: params.resource,
      action: params.action || 'read,write',
    },
    update: {
      action: params.action || 'read,write',
      grantedBy: params.grantedByUserId,
    },
  });
}

/**
 * Helper: Mencabut izin sumber daya
 */
export async function revokeResourceAccess(params: {
  workspaceId: string;
  targetUserId: string;
  resource: string;
}) {
  return prisma.resourceGrant.deleteMany({
    where: {
      workspaceId: params.workspaceId,
      userId: params.targetUserId,
      resource: params.resource,
    },
  });
}

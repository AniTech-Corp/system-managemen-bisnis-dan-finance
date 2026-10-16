import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from './auth';
import { extractTokenFromRequest, hasMinRole, type AuthContext } from './tenant-guard';
import { prisma } from './prisma';
import { MediaError } from './media-errors';

export function mediaErrorResponse(error: unknown) {
  const e = error instanceof MediaError ? error : new MediaError('PROVIDER_ERROR', 'Permintaan belum berhasil. Silakan coba lagi.', 502, true);
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (error instanceof MediaRateLimitError) headers['Retry-After'] = String(error.retryAfterSeconds);
  return NextResponse.json({ success: false, error: { code: e.code, message: e.message, retryable: e.retryable } }, { status: e.status, headers });
}

// ---------------------------------------------------------------------------
// INTERIM in-memory guards (P8): idempotency coalescing + sliding-window rate limit.
// Status: guarded-but-not-billing-ready. The real credit/billing decision (credit
// ledger, plan tiers, persistence) belongs to Fatur's lane and is NOT implemented here.
// All state lives in per-process Maps: it is NOT shared across instances/replicas and
// resets on restart. Good enough to stop duplicate provider calls and abuse bursts on a
// single instance; do not treat it as a billing boundary.
// ---------------------------------------------------------------------------
export class MediaRateLimitError extends MediaError {
  constructor(message: string, public retryAfterSeconds: number) {
    super('RATE_LIMITED', message, 429, true);
  }
}
export type MediaGuardOptions = {
  /** Injectable clock (ms since epoch) so tests can drive TTL/window without real waits. */
  now?: () => number;
  /**
   * Workspace yang diminta eksplisit oleh pemanggil (misal body.workspaceId dari UI
   * multi-workspace switcher milik Fatur). Kalau diisi, jadi kandidat utama SEBELUM
   * header/query/JWT -- tapi tetap lewat verifikasi keanggotaan di bawah (isOwner/
   * membership), jadi permintaan ke workspace yang bukan milik pemanggil tetap
   * ditolak 403, bukan diloloskan begitu saja. Nama field disamakan dengan
   * GuardOptions.requiredWorkspaceId di tenant-guard.ts biar satu bahasa.
   */
  requiredWorkspaceId?: string;
};
type StoredResponse = { status: number; headers: Array<[string, string]>; body: Uint8Array | null; expiresAt: number };
const IDEMPOTENCY_HEADER = 'idempotency-key';
const IDEMPOTENCY_KEY_MAX_LENGTH = 200;
const REPLAY_HEADERS = ['content-type', 'cache-control', 'content-disposition'];
const RATE_WINDOW_MS = 60_000;
const RATE_SCOPE_CAP = 5_000;
const idempotencyInflight = new Map<string, Promise<StoredResponse>>();
const idempotencyStore = new Map<string, StoredResponse>();
const rateWindows = new Map<string, number[]>();

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function idempotencyConfig() {
  return {
    ttlMs: envInt('MEDIA_IDEMPOTENCY_TTL_MS', 5 * 60_000),
    maxEntries: envInt('MEDIA_IDEMPOTENCY_MAX_ENTRIES', 200),
    maxBodyBytes: envInt('MEDIA_IDEMPOTENCY_MAX_BODY_BYTES', 8 * 1024 * 1024),
  };
}
/** Test-only helper: clears all interim guard state in this process. */
export function resetMediaGuardState() {
  idempotencyInflight.clear(); idempotencyStore.clear(); rateWindows.clear();
}
function idempotencyKeyFor(req: NextRequest, scope: string) {
  if (req.method !== 'POST') return null;
  const raw = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (!raw || raw.length > IDEMPOTENCY_KEY_MAX_LENGTH) return null;
  return `${scope}|${req.method} ${req.nextUrl.pathname}|${raw}`;
}
function enforceRateLimit(scope: string, now: number, limit = envInt('MEDIA_RATE_LIMIT_PER_MIN', 30)) {
  if (limit === 0) return;
  const cutoff = now - RATE_WINDOW_MS;
  const hits = (rateWindows.get(scope) ?? []).filter(at => at > cutoff);
  if (hits.length >= limit) {
    rateWindows.set(scope, hits);
    const retryAfterSeconds = Math.max(1, Math.ceil((hits[0] + RATE_WINDOW_MS - now) / 1000));
    throw new MediaRateLimitError('Terlalu banyak permintaan media. Coba lagi sebentar.', retryAfterSeconds);
  }
  hits.push(now);
  rateWindows.delete(scope); rateWindows.set(scope, hits);
  if (rateWindows.size > RATE_SCOPE_CAP) rateWindows.delete(rateWindows.keys().next().value as string);
}
/** Rate-limit ringan untuk request BACA (GET video-status/video-content/models) -- temuan
 * verifikator 7 Sep malam: GET dulu lolos tanpa batas apa pun, padahal tiap poll
 * video-status = 1 fetch keluar ke provider. Default 120/menit per user+workspace =
 * cukup untuk 2 render paralel yang di-poll tiap 4 detik (2 x 15 = 30/menit) plus
 * pemuatan katalog, tapi menahan loop liar/brute-force id. Scope dipisah dari POST
 * supaya poll status tidak menghabiskan kuota generate yang membakar kredit. */
function enforceReadRateLimit(scope: string, now: number) {
  enforceRateLimit(`read|${scope}`, now, envInt('MEDIA_READ_RATE_LIMIT_PER_MIN', 120));
}
async function snapshotResponse(response: NextResponse, now: number, ttlMs: number): Promise<StoredResponse> {
  // A Response body can only be read once: read the clone, hand the original back to the caller.
  const body = response.body ? new Uint8Array(await response.clone().arrayBuffer()) : null;
  const headers: Array<[string, string]> = [];
  for (const name of REPLAY_HEADERS) { const value = response.headers.get(name); if (value) headers.push([name, value]); }
  return { status: response.status, headers, body, expiresAt: now + ttlMs };
}
function rebuildResponse(stored: StoredResponse, kind: 'coalesced' | 'replayed') {
  const headers = new Headers(stored.headers);
  headers.set('Idempotency-Replayed', kind);
  return new NextResponse(stored.body ? stored.body.slice() as BodyInit : null, { status: stored.status, headers });
}
function storeIdempotent(key: string, stored: StoredResponse, now: number, maxEntries: number, maxBodyBytes: number) {
  if (maxEntries === 0 || stored.status < 200 || stored.status >= 300) return;
  if ((stored.body?.byteLength ?? 0) > maxBodyBytes) return;
  for (const [k, v] of idempotencyStore) if (v.expiresAt <= now) idempotencyStore.delete(k);
  while (idempotencyStore.size >= maxEntries) idempotencyStore.delete(idempotencyStore.keys().next().value as string);
  idempotencyStore.set(key, stored);
}
async function runIdempotent(key: string, now: number, execute: () => Promise<NextResponse>) {
  const stored = idempotencyStore.get(key);
  if (stored && stored.expiresAt > now) return rebuildResponse(stored, 'replayed');
  if (stored) idempotencyStore.delete(key);
  const inflight = idempotencyInflight.get(key);
  if (inflight) return rebuildResponse(await inflight, 'coalesced');
  const { ttlMs, maxEntries, maxBodyBytes } = idempotencyConfig();
  let original: NextResponse | undefined;
  const run = (async () => {
    original = await execute();
    const snapshot = await snapshotResponse(original, now, ttlMs);
    storeIdempotent(key, snapshot, now, maxEntries, maxBodyBytes);
    return snapshot;
  })();
  // Registered synchronously (no await between the lookup above and this set), so concurrent
  // callers that passed auth in the same tick share this promise and the handler runs once.
  idempotencyInflight.set(key, run);
  try { await run; return original as NextResponse; }
  finally { idempotencyInflight.delete(key); }
}

/** Read-only session guard: reuse JWT/RBAC, never enter legacy anonymous bootstrap paths. */
export function withMediaGuard(handler: (req: NextRequest, context: { auth: AuthContext }) => Promise<NextResponse>, options: MediaGuardOptions = {}) {
  const now = options.now ?? Date.now;
  return async (req: NextRequest) => {
    try {
      const token = extractTokenFromRequest(req);
      const claims = token ? verifyJwtToken(token) : null;
      if (!claims || typeof claims.userId !== 'string') throw new MediaError('AUTH_REQUIRED', 'Silakan masuk ke KLIR terlebih dahulu.', 401);
      // FIX (7 Sep -- bug produksi ditemukan Mecca): dulu dibandingkan ke req.nextUrl.origin,
      // yang di deployment self-hosted di belakang reverse proxy (nginx+Traefik, TLS
      // di-terminate SEBELUM Next.js) SELALU balik "http://localhost:3000" apapun header yang
      // dikirim -- terverifikasi via curl langsung ke proses Next.js dengan macam-macam
      // kombinasi Host/X-Forwarded-Proto/X-Forwarded-Host, semuanya tetap ke-reject KECUALI
      // Origin yang persis "http://localhost:3000" (nilai bawaan itu sendiri). Akibatnya
      // SEMUA request browser asli (Origin: https://klir.laserstory1.id) di production PASTI
      // ditolak 403 -- generate gambar/video/dokumen 100% mati di production, padahal di
      // localhost dev kebetulan selalu cocok (origin dev juga http://localhost:3000). Diganti
      // bandingkan HOST origin vs header Host request (yang diteruskan nginx dengan benar,
      // `proxy_set_header Host $host;`) -- proxy-agnostic, tidak bergantung komputasi
      // nextUrl.origin milik Next.js yang tidak proxy-aware di setup ini.
      const origin = req.headers.get('origin');
      if (origin) {
        let originHost: string | null = null;
        try { originHost = new URL(origin).host; } catch { originHost = null; }
        const requestHost = req.headers.get('host');
        if (!originHost || originHost !== requestHost) throw new MediaError('ACCESS_DENIED', 'Asal permintaan tidak diizinkan.', 403);
      }
      const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { id: true, email: true, fullName: true, isSuperAdmin: true } });
      // 8 Sep 2026: pesan diperjelas -- kasus nyata: token sah tapi akun sudah dibuat ulang di
      // DB, user melihat "generate gambar/video/dokumen mati semua" tanpa tahu sebabnya sesi.
      if (!user) throw new MediaError('AUTH_REQUIRED', 'Sesi login kedaluwarsa (akun berubah di server). Klik "Keluar Akun" lalu masuk lagi, semua fitur generate akan aktif kembali.', 401);
      const requested = options.requiredWorkspaceId || req.headers.get('x-workspace-id') || req.nextUrl.searchParams.get('workspaceId') || claims.workspaceId;
      const workspace = requested
        ? await prisma.workspace.findUnique({ where: { id: requested }, select: { id: true } })
        : await prisma.workspace.findFirst({ where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] }, select: { id: true } });
      if (!workspace) throw new MediaError('WORKSPACE_NOT_FOUND', 'Workspace belum tersedia untuk sesi ini.', 403);
      const verified = await prisma.workspace.findUnique({
        where: { id: workspace.id },
        include: { members: { where: { userId: user.id }, select: { role: true } }, resourceGrants: { where: { userId: user.id }, select: { resource: true, action: true } } },
      });
      if (!verified) throw new MediaError('WORKSPACE_NOT_FOUND', 'Workspace tidak tersedia.', 403);
      const isOwner = verified.ownerId === user.id || user.isSuperAdmin;
      const membership = verified.members[0];
      if (!isOwner && !membership) throw new MediaError('ACCESS_DENIED', 'Akses workspace ditolak.', 403);
      const role = isOwner ? 'OWNER' : membership.role;
      if (!hasMinRole(role, 'MEMBER')) throw new MediaError('ACCESS_DENIED', 'Peran Anda belum dapat membuat media.', 403);
      const auth: AuthContext = { user, workspace: { id: verified.id, name: verified.name, slug: verified.slug, ownerId: verified.ownerId }, membership: { role, divisionRole: null, isOwner }, grants: verified.resourceGrants };
      const scope = `${user.id}|${verified.id}`;
      if (req.method !== 'POST') { enforceReadRateLimit(scope, now()); return await handler(req, { auth }); }
      // Interim guards (see block above): only POST spends provider budget. Rate limit counts
      // real handler executions, so idempotent replays/coalesced waits are free.
      const execute = () => { enforceRateLimit(scope, now()); return handler(req, { auth }); };
      const idempotencyKey = idempotencyKeyFor(req, scope);
      return idempotencyKey ? await runIdempotent(idempotencyKey, now(), execute) : await execute();
    } catch (error) { return mediaErrorResponse(error); }
  };
}
export async function readMediaJson(req: NextRequest): Promise<unknown> {
  if (!(req.headers.get('content-type') || '').includes('application/json')) throw new MediaError('INVALID_INPUT', 'Kirim JSON yang valid.', 415);
  const bytes = await readLimitedBody(req, 80_000);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new MediaError('INVALID_INPUT', 'JSON tidak valid.'); }
}
export async function readLimitedBody(req: Request, max: number) {
  if (Number(req.headers.get('content-length')) > max) throw new MediaError('FILE_TOO_LARGE', 'Ukuran permintaan terlalu besar.', 413);
  const reader = req.body?.getReader();
  if (!reader) throw new MediaError('INVALID_INPUT', 'Body permintaan kosong.');
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel(); throw new MediaError('FILE_TOO_LARGE', 'Ukuran permintaan terlalu besar.', 413); }
    chunks.push(value);
  }
  const body = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}

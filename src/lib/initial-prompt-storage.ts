import type { RoleDashboardRole } from './role-dashboard-contract';

export const INITIAL_PROMPT_STORAGE_KEY = 'klir_initial_prompt';
export const INITIAL_PROMPT_TTL_MS = 10 * 60 * 1000;

export interface InitialPromptEnvelope {
  targetRole: RoleDashboardRole;
  prompt: string;
  createdAt: number;
  nonce: string;
}

const VALID_ROLES: ReadonlySet<RoleDashboardRole> = new Set([
  'SEKRETARIS',
  'MANAGER_UMUM',
  'MANAGER_OPERASIONAL',
  'CEO',
  'FINANCE',
  'MARKETING',
]);

function isRole(value: unknown): value is RoleDashboardRole {
  return typeof value === 'string' && VALID_ROLES.has(value as RoleDashboardRole);
}

function makeNonce(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // sessionStorage itself is best-effort; a deterministic fallback is enough
    // for this UX handoff because the nonce is not an authentication token.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function writeInitialPrompt(targetRole: RoleDashboardRole, prompt: string, now = Date.now()): boolean {
  const normalizedPrompt = prompt.trim();
  if (!isRole(targetRole) || !normalizedPrompt || !Number.isFinite(now)) return false;

  try {
    const envelope: InitialPromptEnvelope = {
      targetRole,
      prompt: normalizedPrompt,
      createdAt: now,
      nonce: makeNonce(),
    };
    window.sessionStorage.setItem(INITIAL_PROMPT_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

function isEnvelope(value: unknown): value is InitialPromptEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<InitialPromptEnvelope>;
  return (
    isRole(candidate.targetRole) &&
    typeof candidate.prompt === 'string' &&
    candidate.prompt.trim().length > 0 &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt) &&
    typeof candidate.nonce === 'string' &&
    candidate.nonce.length > 0
  );
}

export function consumeInitialPrompt(targetRole: RoleDashboardRole, now = Date.now()): string | null {
  if (!isRole(targetRole) || !Number.isFinite(now)) return null;

  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(INITIAL_PROMPT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      window.sessionStorage.removeItem(INITIAL_PROMPT_STORAGE_KEY);
    } catch {}
    return null;
  }

  if (!isEnvelope(parsed)) {
    try {
      window.sessionStorage.removeItem(INITIAL_PROMPT_STORAGE_KEY);
    } catch {}
    return null;
  }

  // A prompt intended for another portal is not consumed here. This matters
  // when React briefly mounts a previous portal during a role transition.
  if (parsed.targetRole !== targetRole) return null;

  if (now - parsed.createdAt > INITIAL_PROMPT_TTL_MS || now < parsed.createdAt - 60_000) {
    try {
      window.sessionStorage.removeItem(INITIAL_PROMPT_STORAGE_KEY);
    } catch {}
    return null;
  }

  try {
    window.sessionStorage.removeItem(INITIAL_PROMPT_STORAGE_KEY);
  } catch {}
  return parsed.prompt.trim();
}

export function clearInitialPrompt(): void {
  try {
    window.sessionStorage.removeItem(INITIAL_PROMPT_STORAGE_KEY);
  } catch {}
}

/**
 * KLIR Universal Client Auth Helper
 * Menyediakan pembacaan token yang konsisten dari localStorage/cookies
 * dan penyuntikan header Authorization: Bearer untuk semua request client-side.
 */

export function getClientToken(): string | null {
  if (typeof window === 'undefined') return null;
  const local = localStorage.getItem('klir_token');
  if (local) return local;
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)(?:klir_token|auth_token)=([^;]*)/);
    if (match && match[1]) {
      const val = decodeURIComponent(match[1]);
      try { localStorage.setItem('klir_token', val); } catch {}
      return val;
    }
  }
  return null;
}

export function getActiveClientWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const active = localStorage.getItem('klir_active_workspace_id');
    if (active) return active;
    const saved = localStorage.getItem('klir_persistent_auth') || sessionStorage.getItem('klir_session_auth');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed?.workspace?.id || null;
    }
  } catch {}
  return null;
}

export function getClientAuthHeaders(extraHeaders?: Record<string, string>, explicitWorkspaceId?: string): Record<string, string> {
  const headers: Record<string, string> = { ...(extraHeaders || {}) };
  const token = getClientToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const wsId = explicitWorkspaceId || getActiveClientWorkspaceId();
  if (wsId && !headers['x-workspace-id']) {
    headers['x-workspace-id'] = wsId;
  }
  return headers;
}

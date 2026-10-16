/**
 * Remove fields from the browser-side AI cache that do not have an
 * authoritative writer in the current backend.
 *
 * The cache is shared by the three role assistants, so stale mockup values can
 * otherwise survive a role switch and look like real company data. Keep this
 * helper deliberately narrow: financials, campaigns, health, and directives
 * remain intact; only the currently unsourced team/AR projections are removed.
 */
export function sanitizeLiveCompanyState(
  state: Record<string, any> | null | undefined
): Record<string, any> | null | undefined {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;

  const next = { ...state };
  if (next.teamOps && typeof next.teamOps === 'object' && !Array.isArray(next.teamOps)) {
    const teamOps = { ...next.teamOps };
    delete teamOps.divisions;
    delete teamOps.teamUtilizationPercent;
    next.teamOps = teamOps;
  }
  if (next.financials && typeof next.financials === 'object' && !Array.isArray(next.financials)) {
    const financials = { ...next.financials };
    delete financials.arOverdue;
    next.financials = financials;
  }

  return next;
}

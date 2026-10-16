export type RoleDashboardRole = 'SEKRETARIS' | 'MANAGER_UMUM' | 'MANAGER_OPERASIONAL' | 'CEO' | 'FINANCE' | 'MARKETING';

export type DashboardDataStatus = 'available' | 'empty' | 'unsupported' | 'forbidden' | 'error';
export type DashboardVisualMode = 'overview' | 'charts' | 'mindmap';

export interface RoleDashboardCard {
  id: string;
  label: string;
  value: number | null;
  status: DashboardDataStatus;
  detail: string;
  source: string;
}

export interface RoleDashboardMetric {
  id: string;
  label: string;
  value: number | null;
  status: DashboardDataStatus;
  detail: string;
  source: string;
}

export interface RoleDashboardSeries {
  id: string;
  label: string;
  labels: string[];
  values: Array<number | null>;
  status: DashboardDataStatus;
  source: string;
}

export interface RoleDashboardInsightRecommendation {
  title: string;
  reason: string;
  action: string;
  risk?: string;
}

export interface RoleDashboardInsight {
  status: DashboardDataStatus;
  summary: string;
  explanation: string;
  recommendations: RoleDashboardInsightRecommendation[];
  sources: string[];
}

export interface RoleDashboardPayload {
  role: RoleDashboardRole;
  status: DashboardDataStatus;
  generatedAt: string;
  cards: RoleDashboardCard[];
  snapshot?: RoleDashboardMetric[];
  series?: RoleDashboardSeries[];
  insight?: RoleDashboardInsight;
  notice?: string;
}

export type RoleDashboardParseResult =
  | { ok: true; data: RoleDashboardPayload }
  | { ok: false; error: string };

const DASHBOARD_STATUSES: ReadonlySet<DashboardDataStatus> = new Set([
  'available',
  'empty',
  'unsupported',
  'forbidden',
  'error',
]);

const DASHBOARD_ROLES: ReadonlySet<RoleDashboardRole> = new Set([
  'SEKRETARIS',
  'MANAGER_UMUM',
  'MANAGER_OPERASIONAL',
  'CEO',
  'FINANCE',
  'MARKETING',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function isDashboardDataStatus(value: unknown): value is DashboardDataStatus {
  return typeof value === 'string' && DASHBOARD_STATUSES.has(value as DashboardDataStatus);
}

export function isRoleDashboardRole(value: unknown): value is RoleDashboardRole {
  return typeof value === 'string' && DASHBOARD_ROLES.has(value as RoleDashboardRole);
}

function parseCard(value: unknown): RoleDashboardCard | null {
  if (!isRecord(value)) return null;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.label) ||
    !isNullableFiniteNumber(value.value) ||
    !isDashboardDataStatus(value.status) ||
    typeof value.detail !== 'string' ||
    !isNonEmptyString(value.source)
  ) {
    return null;
  }
  return {
    id: value.id,
    label: value.label,
    value: value.value,
    status: value.status,
    detail: value.detail,
    source: value.source,
  };
}

function parseSeries(value: unknown): RoleDashboardSeries | null {
  if (!isRecord(value) || !Array.isArray(value.labels) || !Array.isArray(value.values)) return null;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.label) ||
    !value.labels.every((label) => typeof label === 'string') ||
    !value.values.every((item) => isNullableFiniteNumber(item)) ||
    !isDashboardDataStatus(value.status) ||
    !isNonEmptyString(value.source)
  ) {
    return null;
  }
  return {
    id: value.id,
    label: value.label,
    labels: value.labels,
    values: value.values,
    status: value.status,
    source: value.source,
  };
}

function parseInsight(value: unknown): RoleDashboardInsight | null {
  if (!isRecord(value) || !Array.isArray(value.recommendations) || !Array.isArray(value.sources)) return null;
  if (!isDashboardDataStatus(value.status) || typeof value.summary !== 'string' || typeof value.explanation !== 'string') return null;
  const recommendations: RoleDashboardInsightRecommendation[] = [];
  for (const recommendation of value.recommendations) {
    if (!isRecord(recommendation)) return null;
    if (
      !isNonEmptyString(recommendation.title) ||
      typeof recommendation.reason !== 'string' ||
      typeof recommendation.action !== 'string' ||
      (recommendation.risk !== undefined && typeof recommendation.risk !== 'string')
    ) {
      return null;
    }
    recommendations.push({
      title: recommendation.title,
      reason: recommendation.reason,
      action: recommendation.action,
      ...(recommendation.risk !== undefined ? { risk: recommendation.risk } : {}),
    });
  }
  if (!value.sources.every((source) => typeof source === 'string')) return null;
  return {
    status: value.status,
    summary: value.summary,
    explanation: value.explanation,
    recommendations,
    sources: value.sources,
  };
}

export function parseRoleDashboardPayload(input: unknown, expectedRole?: RoleDashboardRole): RoleDashboardParseResult {
  if (!isRecord(input)) return { ok: false, error: 'Respons dashboard bukan object.' };
  if (!isRoleDashboardRole(input.role)) return { ok: false, error: 'Role dashboard tidak valid.' };
  if (expectedRole && input.role !== expectedRole) return { ok: false, error: 'Role dashboard tidak sesuai dengan permintaan.' };
  if (!isDashboardDataStatus(input.status)) return { ok: false, error: 'Status dashboard tidak valid.' };
  if (!isNonEmptyString(input.generatedAt)) return { ok: false, error: 'Waktu pembuatan dashboard tidak valid.' };
  if (!Array.isArray(input.cards)) return { ok: false, error: 'Daftar kartu dashboard tidak valid.' };

  const cards: RoleDashboardCard[] = [];
  for (let index = 0; index < input.cards.length; index += 1) {
    const card = parseCard(input.cards[index]);
    if (!card) return { ok: false, error: `Kartu dashboard ${index + 1} tidak valid.` };
    cards.push(card);
  }

  let snapshot: RoleDashboardMetric[] | undefined;
  if (input.snapshot !== undefined) {
    if (!Array.isArray(input.snapshot)) return { ok: false, error: 'Snapshot dashboard tidak valid.' };
    snapshot = [];
    for (let index = 0; index < input.snapshot.length; index += 1) {
      const metric = parseCard(input.snapshot[index]);
      if (!metric) return { ok: false, error: `Snapshot dashboard ${index + 1} tidak valid.` };
      snapshot.push(metric);
    }
  }

  let series: RoleDashboardSeries[] | undefined;
  if (input.series !== undefined) {
    if (!Array.isArray(input.series)) return { ok: false, error: 'Series dashboard tidak valid.' };
    series = [];
    for (let index = 0; index < input.series.length; index += 1) {
      const item = parseSeries(input.series[index]);
      if (!item) return { ok: false, error: `Series dashboard ${index + 1} tidak valid.` };
      series.push(item);
    }
  }

  let insight: RoleDashboardInsight | undefined;
  if (input.insight !== undefined) {
    const parsedInsight = parseInsight(input.insight);
    if (!parsedInsight) return { ok: false, error: 'Insight dashboard tidak valid.' };
    insight = parsedInsight;
  }

  if (input.notice !== undefined && typeof input.notice !== 'string') {
    return { ok: false, error: 'Notice dashboard tidak valid.' };
  }

  return {
    ok: true,
    data: {
      role: input.role,
      status: input.status,
      generatedAt: input.generatedAt,
      cards,
      ...(snapshot ? { snapshot } : {}),
      ...(series ? { series } : {}),
      ...(insight ? { insight } : {}),
      ...(input.notice !== undefined ? { notice: input.notice } : {}),
    },
  };
}


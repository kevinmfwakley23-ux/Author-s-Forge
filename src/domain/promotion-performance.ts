export const PROMOTION_PERFORMANCE_FORMAT_VERSION = 1 as const;
export const PROMOTION_PERFORMANCE_SOURCES = ["amazon-ads", "bookbub-ads", "email", "social", "author-site", "retailer", "press", "reader-community", "other"] as const;
export type PromotionPerformanceSource = typeof PROMOTION_PERFORMANCE_SOURCES[number];

export interface PromotionPerformanceMetrics {
  readonly impressions?: number;
  readonly clicks?: number;
  readonly spend?: number;
  readonly attributedOrders?: number;
  readonly attributedUnits?: number;
  readonly attributedRevenue?: number;
  readonly delivered?: number;
  readonly opens?: number;
}

export interface PromotionPerformanceSnapshot {
  readonly formatVersion: typeof PROMOTION_PERFORMANCE_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly campaignId: string;
  readonly assetId?: string;
  readonly source: PromotionPerformanceSource;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly observedAt: string;
  readonly currency?: string;
  readonly sourceReference: string;
  readonly sourceUrl?: string;
  readonly notes?: string;
  readonly metrics: PromotionPerformanceMetrics;
}

export interface PromotionPerformanceDerivedMetrics {
  readonly ctrPercent?: number;
  readonly costPerClick?: number;
  readonly costPerThousandImpressions?: number;
  readonly attributedConversionPercent?: number;
  readonly costPerAttributedOrder?: number;
  readonly acosPercent?: number;
  readonly roas?: number;
  readonly emailOpenRatePercent?: number;
}

export interface PromotionPerformanceInsight {
  readonly id: string;
  readonly kind: "observation" | "data-gap" | "next-test";
  readonly message: string;
  readonly snapshotIds: readonly string[];
}

export interface PromotionPerformanceSummary {
  readonly snapshots: readonly { readonly snapshot: PromotionPerformanceSnapshot; readonly derived: PromotionPerformanceDerivedMetrics }[];
  readonly insights: readonly PromotionPerformanceInsight[];
}

export function createPromotionPerformanceSnapshot(input: Omit<PromotionPerformanceSnapshot, "formatVersion">): PromotionPerformanceSnapshot {
  return validatePromotionPerformanceSnapshot({ ...input, formatVersion: PROMOTION_PERFORMANCE_FORMAT_VERSION });
}

export function validatePromotionPerformanceSnapshot(value: PromotionPerformanceSnapshot): PromotionPerformanceSnapshot {
  if (!value || typeof value !== "object" || value.formatVersion !== PROMOTION_PERFORMANCE_FORMAT_VERSION) throw new Error("Unsupported promotion performance format version.");
  const id = text(value.id, "Performance snapshot id");
  const projectId = text(value.projectId, "Performance project id");
  const bookId = text(value.bookId, "Performance book id");
  const campaignId = text(value.campaignId, "Performance campaign id");
  const assetId = optionalText(value.assetId);
  if (!PROMOTION_PERFORMANCE_SOURCES.includes(value.source)) throw new Error(`Unsupported promotion performance source ${String(value.source)}.`);
  const periodStart = timestamp(value.periodStart, "Performance period start");
  const periodEnd = timestamp(value.periodEnd, "Performance period end");
  const observedAt = timestamp(value.observedAt, "Performance observedAt");
  if (Date.parse(periodEnd) < Date.parse(periodStart)) throw new Error("Performance period end cannot precede period start.");
  if (Date.parse(periodEnd) > Date.parse(observedAt)) throw new Error("Observed performance cannot claim a period ending after the observation time.");
  const metrics = validateMetrics(value.metrics);
  if (!Object.values(metrics).some((metric) => metric !== undefined)) throw new Error("Performance snapshot requires at least one observed metric.");
  const hasMoney = metrics.spend !== undefined || metrics.attributedRevenue !== undefined;
  const currency = optionalText(value.currency)?.toUpperCase();
  if (hasMoney && !currency) throw new Error("Performance currency is required when money metrics are recorded.");
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Error("Performance currency must be a three-letter code such as USD.");
  const sourceReference = text(value.sourceReference, "Performance source reference");
  const sourceUrl = optionalUrl(value.sourceUrl);
  const notes = optionalText(value.notes);
  return clone({
    ...value,
    formatVersion: PROMOTION_PERFORMANCE_FORMAT_VERSION,
    id,
    projectId,
    bookId,
    campaignId,
    ...(assetId ? { assetId } : {}),
    source: value.source,
    periodStart,
    periodEnd,
    observedAt,
    ...(currency ? { currency } : {}),
    sourceReference,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(notes ? { notes } : {}),
    metrics,
  });
}

export function derivePromotionPerformanceMetrics(snapshotInput: PromotionPerformanceSnapshot): PromotionPerformanceDerivedMetrics {
  const snapshot = validatePromotionPerformanceSnapshot(snapshotInput);
  const m = snapshot.metrics;
  return compact({
    ctrPercent: ratioPercent(m.clicks, m.impressions),
    costPerClick: ratio(m.spend, m.clicks),
    costPerThousandImpressions: m.spend !== undefined && m.impressions !== undefined && m.impressions > 0 ? round((m.spend / m.impressions) * 1000) : undefined,
    attributedConversionPercent: ratioPercent(m.attributedOrders, m.clicks),
    costPerAttributedOrder: ratio(m.spend, m.attributedOrders),
    acosPercent: ratioPercent(m.spend, m.attributedRevenue),
    roas: ratio(m.attributedRevenue, m.spend),
    emailOpenRatePercent: ratioPercent(m.opens, m.delivered),
  });
}

export function summarizePromotionPerformance(values: readonly PromotionPerformanceSnapshot[]): PromotionPerformanceSummary {
  const snapshots = values.map(validatePromotionPerformanceSnapshot)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt) || b.periodEnd.localeCompare(a.periodEnd) || b.id.localeCompare(a.id))
    .map((snapshot) => ({ snapshot, derived: derivePromotionPerformanceMetrics(snapshot) }));
  const insights: PromotionPerformanceInsight[] = [];

  for (const item of snapshots) {
    const m = item.snapshot.metrics;
    if (m.spend !== undefined && m.attributedRevenue === undefined) {
      insights.push({ id: `revenue-gap:${item.snapshot.id}`, kind: "data-gap", message: `Spend is recorded for ${item.snapshot.source}, but attributed revenue is not. Forge will not calculate ROAS or ACOS from unrelated retailer sales.`, snapshotIds: [item.snapshot.id] });
    }
    if (m.clicks !== undefined && m.attributedOrders === undefined) {
      insights.push({ id: `conversion-gap:${item.snapshot.id}`, kind: "data-gap", message: `Clicks are recorded for ${item.snapshot.source}, but attributed orders are not. Conversion rate remains unknown instead of being inferred.`, snapshotIds: [item.snapshot.id] });
    }
  }

  const comparable = snapshots.filter((item) => item.snapshot.assetId && item.derived.ctrPercent !== undefined);
  const groups = new Map<string, typeof comparable>();
  for (const item of comparable) {
    const key = `${item.snapshot.source}|${item.snapshot.periodStart}|${item.snapshot.periodEnd}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => (b.derived.ctrPercent ?? -1) - (a.derived.ctrPercent ?? -1));
    const best = ordered[0];
    const next = ordered[1];
    if ((best.derived.ctrPercent ?? 0) <= (next.derived.ctrPercent ?? 0)) continue;
    insights.push({
      id: `ctr-test:${best.snapshot.id}:${next.snapshot.id}`,
      kind: "next-test",
      message: `${best.snapshot.assetId} has the higher observed CTR (${formatPercent(best.derived.ctrPercent)}) versus ${next.snapshot.assetId} (${formatPercent(next.derived.ctrPercent)}) for the same source and period. Consider another controlled creative/targeting test before reallocating budget.`,
      snapshotIds: [best.snapshot.id, next.snapshot.id],
    });
  }

  return { snapshots, insights };
}

function validateMetrics(value: PromotionPerformanceMetrics): PromotionPerformanceMetrics {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Performance metrics must be an object.");
  return compact({
    impressions: count(value.impressions, "Performance impressions"),
    clicks: count(value.clicks, "Performance clicks"),
    spend: money(value.spend, "Performance spend"),
    attributedOrders: count(value.attributedOrders, "Performance attributed orders"),
    attributedUnits: count(value.attributedUnits, "Performance attributed units"),
    attributedRevenue: money(value.attributedRevenue, "Performance attributed revenue"),
    delivered: count(value.delivered, "Performance delivered count"),
    opens: count(value.opens, "Performance opens"),
  });
}

function ratio(numerator?: number, denominator?: number): number | undefined {
  return numerator !== undefined && denominator !== undefined && denominator > 0 ? round(numerator / denominator) : undefined;
}
function ratioPercent(numerator?: number, denominator?: number): number | undefined {
  const value = ratio(numerator, denominator);
  return value === undefined ? undefined : round(value * 100);
}
function count(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value as number;
}
function money(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number.`);
  return round(value);
}
function timestamp(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(Date.parse(normalized)).toISOString();
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function optionalUrl(value: unknown): string | undefined {
  const normalized = optionalText(value);
  if (!normalized) return undefined;
  const url = new URL(normalized);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Performance source URL must use HTTP or HTTPS.");
  return url.toString();
}
function round(value: number): number { return Math.round((value + Number.EPSILON) * 10000) / 10000; }
function formatPercent(value?: number): string { return value === undefined ? "unknown" : `${value.toFixed(2)}%`; }
function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

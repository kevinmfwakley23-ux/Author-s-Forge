export const DELIVERY_AUDIT_FORMAT_VERSION = 1 as const;

export const DELIVERY_AUDIT_CATEGORIES = Object.freeze([
  "canon",
  "continuity",
  "timeline",
  "character",
  "pov",
  "style",
  "grammar",
  "formatting",
  "research",
  "artwork",
  "cover",
  "metadata",
  "publishing",
] as const);
export type DeliveryAuditCategory = (typeof DELIVERY_AUDIT_CATEGORIES)[number];

export const DELIVERY_AUDIT_SEVERITIES = Object.freeze(["critical", "warning", "info"] as const);
export type DeliveryAuditSeverity = (typeof DELIVERY_AUDIT_SEVERITIES)[number];

export interface DeliveryAuditCheck {
  readonly id: string;
  readonly category: DeliveryAuditCategory;
  readonly passed: boolean;
  readonly severity: DeliveryAuditSeverity;
  readonly message: string;
  readonly remediation?: string;
}

export interface DeliveryAuditReport {
  readonly formatVersion: typeof DELIVERY_AUDIT_FORMAT_VERSION;
  readonly projectId: string;
  readonly generatedAt: string;
  readonly checks: readonly DeliveryAuditCheck[];
  readonly status: "ready-for-author-approval" | "attention" | "blocked";
  readonly passedCount: number;
  readonly attentionCount: number;
}

export interface CreateDeliveryAuditReportInput {
  readonly projectId: string;
  readonly checks: readonly DeliveryAuditCheck[];
  readonly generatedAt?: string;
}

export function createDeliveryAuditReport(input: CreateDeliveryAuditReportInput): DeliveryAuditReport {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Delivery audit input object is required.");
  }

  const raw = input as unknown as Record<string, unknown>;
  const projectId = requiredString(raw.projectId, "Delivery audit project id");
  if (!Array.isArray(raw.checks)) throw new Error("Delivery audit checks must be an array.");

  const ids = new Set<string>();
  const normalizedChecks = raw.checks.map((check) => {
    const normalized = normalizeCheck(check);
    if (ids.has(normalized.id)) throw new Error(`Duplicate audit check id "${normalized.id}".`);
    ids.add(normalized.id);
    return normalized;
  });

  const generatedAt = raw.generatedAt === undefined
    ? new Date().toISOString()
    : validTimestamp(raw.generatedAt, "Delivery audit generatedAt");
  const checks = Object.freeze(normalizedChecks);
  const failed = checks.filter((check) => !check.passed);
  const critical = failed.some((check) => check.severity === "critical");

  return Object.freeze({
    formatVersion: DELIVERY_AUDIT_FORMAT_VERSION,
    projectId,
    generatedAt,
    checks,
    passedCount: checks.filter((check) => check.passed).length,
    attentionCount: failed.length,
    status: critical ? "blocked" : failed.length ? "attention" : "ready-for-author-approval",
  });
}

export function validateDeliveryAuditReport(report: DeliveryAuditReport): DeliveryAuditReport {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("Delivery audit report is required.");
  }

  const raw = report as unknown as Record<string, unknown>;
  if (raw.formatVersion !== DELIVERY_AUDIT_FORMAT_VERSION) {
    throw new Error(`Unsupported delivery audit format version "${String(raw.formatVersion)}".`);
  }

  const rebuilt = createDeliveryAuditReport({
    projectId: raw.projectId as string,
    checks: raw.checks as readonly DeliveryAuditCheck[],
    generatedAt: raw.generatedAt as string,
  });

  if (raw.passedCount !== rebuilt.passedCount || raw.attentionCount !== rebuilt.attentionCount || raw.status !== rebuilt.status) {
    throw new Error("Delivery audit summary is inconsistent.");
  }
  return rebuilt;
}

export function isDeliveryAuditCategory(value: unknown): value is DeliveryAuditCategory {
  return typeof value === "string" && (DELIVERY_AUDIT_CATEGORIES as readonly string[]).includes(value);
}

export function isDeliveryAuditSeverity(value: unknown): value is DeliveryAuditSeverity {
  return typeof value === "string" && (DELIVERY_AUDIT_SEVERITIES as readonly string[]).includes(value);
}

function normalizeCheck(check: unknown): DeliveryAuditCheck {
  if (!check || typeof check !== "object" || Array.isArray(check)) {
    throw new Error("Delivery audit check must be an object.");
  }

  const raw = check as Record<string, unknown>;
  const id = requiredString(raw.id, "Audit check id");
  if (!isDeliveryAuditCategory(raw.category)) {
    throw new Error(`Unsupported audit category "${String(raw.category)}".`);
  }
  if (typeof raw.passed !== "boolean") throw new Error("Audit check passed must be a boolean.");
  if (!isDeliveryAuditSeverity(raw.severity)) {
    throw new Error(`Unsupported audit severity "${String(raw.severity)}".`);
  }
  const message = requiredString(raw.message, "Audit check message");
  const remediation = optionalString(raw.remediation, "Audit check remediation");

  return Object.freeze({
    id,
    category: raw.category,
    passed: raw.passed,
    severity: raw.severity,
    message,
    ...(remediation ? { remediation } : {}),
  });
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  return normalized || undefined;
}

function validTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid timestamp.`);
  }
  return value;
}

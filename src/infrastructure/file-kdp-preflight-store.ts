import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { KdpPreflightReport } from "../domain/kdp-preflight";

export const KDP_PREFLIGHT_STORE_FORMAT_VERSION = 1 as const;

interface PersistedKdpPreflightState {
  readonly formatVersion: typeof KDP_PREFLIGHT_STORE_FORMAT_VERSION;
  readonly reports: readonly KdpPreflightReport[];
}

/** Durable, project-scoped history for KDP production preflight reports. */
export class FileKdpPreflightStore {
  private reports: KdpPreflightReport[] = [];
  private loaded = false;

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("KDP preflight store path is required.");
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.reports = validateState(JSON.parse(raw)).reports.map(cloneReport);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
  }

  async list(projectId: string): Promise<readonly KdpPreflightReport[]> {
    await this.load();
    const normalized = projectId.trim();
    if (!normalized) throw new Error("Project id is required.");
    return this.reports
      .filter((report) => report.projectId === normalized)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(cloneReport);
  }

  async latest(projectId: string): Promise<KdpPreflightReport | undefined> {
    return (await this.list(projectId))[0];
  }

  async append(report: KdpPreflightReport): Promise<KdpPreflightReport> {
    await this.load();
    const validated = validateReport(report);
    if (this.reports.some((item) => item.id === validated.id)) {
      throw new Error(`Duplicate KDP preflight report id \"${validated.id}\".`);
    }
    this.reports.push(cloneReport(validated));
    await this.save();
    return cloneReport(validated);
  }

  private async save(): Promise<void> {
    const state: PersistedKdpPreflightState = {
      formatVersion: KDP_PREFLIGHT_STORE_FORMAT_VERSION,
      reports: this.reports.map(cloneReport),
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

function validateState(value: unknown): PersistedKdpPreflightState {
  if (!value || typeof value !== "object") throw new Error("Invalid KDP preflight store.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== KDP_PREFLIGHT_STORE_FORMAT_VERSION || !Array.isArray(candidate.reports)) {
    throw new Error("Unsupported or corrupt KDP preflight store.");
  }
  const ids = new Set<string>();
  const reports = candidate.reports.map((value) => {
    const report = validateReport(value);
    if (ids.has(report.id)) throw new Error(`Duplicate KDP preflight report id \"${report.id}\".`);
    ids.add(report.id);
    return report;
  });
  return { formatVersion: KDP_PREFLIGHT_STORE_FORMAT_VERSION, reports };
}

function validateReport(value: unknown): KdpPreflightReport {
  if (!value || typeof value !== "object") throw new Error("Invalid KDP preflight report.");
  const report = value as KdpPreflightReport;
  if (report.formatVersion !== 1) throw new Error("Unsupported KDP preflight report format.");
  if (!report.id?.trim() || !report.projectId?.trim() || !report.createdAt?.trim()) throw new Error("KDP preflight report identity is incomplete.");
  if (report.status !== "ready" && report.status !== "blocked") throw new Error(`KDP preflight report \"${report.id}\" has invalid status.`);
  if (!Array.isArray(report.findings)) throw new Error(`KDP preflight report \"${report.id}\" has invalid findings.`);
  if (!Number.isInteger(report.errorCount) || report.errorCount < 0 || !Number.isInteger(report.warningCount) || report.warningCount < 0) {
    throw new Error(`KDP preflight report \"${report.id}\" has invalid finding counts.`);
  }
  const errors = report.findings.filter((finding) => finding?.severity === "error").length;
  const warnings = report.findings.filter((finding) => finding?.severity === "warning").length;
  if (errors !== report.errorCount || warnings !== report.warningCount) throw new Error(`KDP preflight report \"${report.id}\" finding counts do not match findings.`);
  if ((errors > 0 ? "blocked" : "ready") !== report.status) throw new Error(`KDP preflight report \"${report.id}\" status does not match findings.`);
  if (!Number.isFinite(report.expectedInteriorPageWidthInches) || report.expectedInteriorPageWidthInches <= 0 || !Number.isFinite(report.expectedInteriorPageHeightInches) || report.expectedInteriorPageHeightInches <= 0) {
    throw new Error(`KDP preflight report \"${report.id}\" has invalid expected interior geometry.`);
  }
  return cloneReport(report);
}

function cloneReport(report: KdpPreflightReport): KdpPreflightReport {
  return {
    ...report,
    findings: report.findings.map((finding) => ({ ...finding })),
  };
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

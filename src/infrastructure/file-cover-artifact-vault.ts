import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createCoverArtifactEvidence,
  validateCoverArtifactEvidence,
  type CoverArtifactEvidence,
  type CoverArtifactFileFormat,
  type CoverArtifactVerification,
} from "../domain/cover-artifact-evidence";
import type { BookCoverPlan } from "../domain/book-cover-studio";

export interface SaveCoverArtifactInput {
  readonly artifactId: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly plan: BookCoverPlan;
  readonly sourceAssetId: string;
  readonly sourceAssetSha256: string;
  readonly fileFormat: CoverArtifactFileFormat;
  readonly fileName: string;
  readonly bytes: Buffer;
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly widthInches: number;
  readonly heightInches: number;
  readonly dpi: number;
  readonly generatedAt: string;
}

export class FileCoverArtifactVault {
  constructor(private readonly rootDirectory: string) {}

  async save(input: SaveCoverArtifactInput): Promise<CoverArtifactEvidence> {
    const projectId = safeId(input.projectId);
    const bookId = safeId(input.bookId);
    if (input.plan.projectId !== projectId || input.plan.bookId !== bookId) throw new Error("Cover artifact plan scope does not match the requested project/book.");
    if (!Buffer.isBuffer(input.bytes) || input.bytes.length === 0) throw new Error("Cover artifact bytes are required.");
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const extension = input.fileFormat === "jpeg" ? ".jpg" : ".pdf";
    const instanceId = randomUUID();
    const storageFileName = `${safeId(input.artifactId)}-${instanceId}${extension}`;
    const evidence = createCoverArtifactEvidence({
      artifactId: input.artifactId,
      projectId,
      bookId,
      plan: input.plan,
      sourceAssetId: input.sourceAssetId,
      sourceAssetSha256: input.sourceAssetSha256,
      fileFormat: input.fileFormat,
      fileName: input.fileName,
      storageFileName,
      byteLength: input.bytes.length,
      sha256,
      widthPixels: input.widthPixels,
      heightPixels: input.heightPixels,
      widthInches: input.widthInches,
      heightInches: input.heightInches,
      dpi: input.dpi,
      generatedAt: input.generatedAt,
    });
    const directory = this.coverDirectory(projectId);
    await mkdir(directory, { recursive: true });
    const artifactPath = join(directory, storageFileName);
    const manifestPath = this.manifestPath(projectId, storageFileName);
    await writeAtomically(artifactPath, input.bytes);
    try {
      await writeAtomically(manifestPath, `${JSON.stringify(evidence, null, 2)}\n`);
    } catch (error) {
      await rm(artifactPath, { force: true }).catch(() => undefined);
      throw error;
    }
    return evidence;
  }

  async list(projectId: string, options: { readonly bookId?: string; readonly planId?: string } = {}): Promise<readonly CoverArtifactEvidence[]> {
    const id = safeId(projectId);
    let entries;
    try {
      entries = await readdir(this.coverDirectory(id), { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const records: CoverArtifactEvidence[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".manifest.json")) continue;
      const raw = await readFile(join(this.coverDirectory(id), entry.name), "utf8");
      const evidence = validateCoverArtifactEvidence(JSON.parse(raw));
      if (evidence.projectId !== id) throw new Error(`Cover artifact manifest ${entry.name} belongs to another project.`);
      if (options.bookId && evidence.bookId !== options.bookId) continue;
      if (options.planId && evidence.planId !== options.planId) continue;
      records.push(evidence);
    }
    return records.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.storageFileName.localeCompare(a.storageFileName));
  }

  async verify(evidence: CoverArtifactEvidence): Promise<CoverArtifactVerification> {
    const record = validateCoverArtifactEvidence(evidence);
    const issues: string[] = [];
    try {
      const bytes = await readFile(join(this.coverDirectory(record.projectId), record.storageFileName));
      if (bytes.length !== record.byteLength) issues.push("Stored cover artifact byte length does not match its manifest.");
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (sha256 !== record.sha256) issues.push("Stored cover artifact SHA-256 does not match its manifest.");
      if (record.fileFormat === "jpeg") {
        if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) issues.push("Stored eBook cover is not a valid JPEG byte stream.");
      } else {
        if (bytes.length < 8 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-" || !bytes.subarray(Math.max(0, bytes.length - 32)).toString("latin1").includes("%%EOF")) issues.push("Stored print cover is not a complete PDF byte stream.");
      }
    } catch (error) {
      if (isMissing(error)) issues.push("Stored cover artifact file is missing.");
      else throw error;
    }
    return Object.freeze({ evidence: record, valid: issues.length === 0, issues: Object.freeze(issues) });
  }

  async read(evidence: CoverArtifactEvidence): Promise<Buffer> {
    const verification = await this.verify(evidence);
    if (!verification.valid) throw new Error(`Cover artifact failed verification: ${verification.issues.join(" ")}`);
    return readFile(join(this.coverDirectory(verification.evidence.projectId), verification.evidence.storageFileName));
  }

  async latestVerified(projectId: string, bookId: string, planId: string): Promise<CoverArtifactVerification | undefined> {
    const records = await this.list(projectId, { bookId, planId });
    for (const record of records) {
      const verified = await this.verify(record);
      if (verified.valid) return verified;
    }
    return undefined;
  }

  private coverDirectory(projectId: string): string {
    return join(this.rootDirectory, "projects", safeId(projectId), "covers");
  }

  private manifestPath(projectId: string, storageFileName: string): string {
    if (!/^[A-Za-z0-9_.-]+$/.test(storageFileName) || storageFileName.includes("..")) throw new Error("Cover artifact storage filename is unsafe.");
    return join(this.coverDirectory(projectId), `${storageFileName}.manifest.json`);
  }
}

async function writeAtomically(path: string, content: string | Buffer): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, path);
    await syncDirectory(directory);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function syncDirectory(directory: string): Promise<void> {
  if (process.platform === "win32") return;
  const handle = await open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

function safeId(value: string): string {
  if (!value || value !== value.trim() || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Cover artifact identifier contains unsupported path characters.");
  return value;
}
function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

import { createHash } from "node:crypto";
import { assertJsonValue } from "./json-value";

export const PROJECT_PACKAGE_FORMAT_VERSION = 2 as const;
export const PROJECT_PACKAGE_NAME = "AUTHOR'S FORGE PROJECT" as const;
export type ProjectPackageEncoding = "utf8" | "base64";

export interface ProjectPackageManifest {
  readonly formatVersion: typeof PROJECT_PACKAGE_FORMAT_VERSION;
  readonly packageName: typeof PROJECT_PACKAGE_NAME;
  readonly projectId: string;
  readonly exportedAt: string;
  readonly paths: readonly string[];
}

export interface ForgeProjectPackage {
  readonly manifest: ProjectPackageManifest;
  readonly projectState: unknown;
  readonly files: readonly ProjectPackageFile[];
}

export interface ProjectPackageFile {
  readonly path: string;
  readonly content: string;
  readonly encoding: ProjectPackageEncoding;
  readonly mediaType: string;
  readonly sha256: string;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function validateStateIdentity(projectId: string, projectState: unknown): void {
  assertJsonValue(projectState, "Project package projectState");
  if (!projectState || typeof projectState !== "object" || Array.isArray(projectState)) throw new Error("Project package projectState must be an object.");
  const metadata = (projectState as Record<string, unknown>).metadata;
  if (metadata === undefined) return;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Project package metadata must be an object.");
  const id = (metadata as Record<string, unknown>).id;
  if (id !== undefined && id !== projectId) throw new Error("Project package projectState metadata id does not match the manifest project id.");
}

export function createProjectPackage(input: {
  projectId: string;
  projectState: unknown;
  files?: readonly ProjectPackageFile[];
  exportedAt?: string;
}): ForgeProjectPackage {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Project package input must be an object.");
  const projectId = text(input.projectId, "Project id");
  validateStateIdentity(projectId, input.projectState);
  if (input.files !== undefined && !Array.isArray(input.files)) throw new Error("Project package files must be an array.");
  const files = (input.files ?? []).map((file) => validatePackageFile(file));
  assertUniquePaths(files.map((file) => file.path));
  validateStateFileBinding(input.projectState, files);
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  if (typeof exportedAt !== "string" || Number.isNaN(Date.parse(exportedAt))) throw new Error("Package exportedAt must be an ISO timestamp.");
  return {
    manifest: {
      formatVersion: PROJECT_PACKAGE_FORMAT_VERSION,
      packageName: PROJECT_PACKAGE_NAME,
      projectId,
      exportedAt,
      paths: files.map((file) => file.path),
    },
    projectState: cloneJson(input.projectState),
    files: files.map((file) => ({ ...file })),
  };
}

export function validateProjectPackage(pkg: ForgeProjectPackage): ForgeProjectPackage {
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) throw new Error("Project package must be an object.");
  if (!pkg.manifest || typeof pkg.manifest !== "object" || Array.isArray(pkg.manifest)) throw new Error("Project package manifest must be an object.");
  if (pkg.manifest.formatVersion !== PROJECT_PACKAGE_FORMAT_VERSION) throw new Error("Unsupported project package format version.");
  if (pkg.manifest.packageName !== PROJECT_PACKAGE_NAME) throw new Error("Unsupported project package name.");
  const projectId = text(pkg.manifest.projectId, "Package project id");
  if (typeof pkg.manifest.exportedAt !== "string" || !Number.isFinite(Date.parse(pkg.manifest.exportedAt))) throw new Error("Package exportedAt must be an ISO timestamp.");
  validateStateIdentity(projectId, pkg.projectState);
  if (!Array.isArray(pkg.manifest.paths) || !Array.isArray(pkg.files)) throw new Error("Project package manifest and files must be arrays.");

  const validated = pkg.files.map((file) => validatePackageFile(file));
  const paths = validated.map((file) => file.path);
  assertUniquePaths(paths);
  const manifestPaths = pkg.manifest.paths.map((path) => validatePackagePath(text(path, "Package manifest path")));
  assertUniquePaths(manifestPaths);
  if (JSON.stringify(paths) !== JSON.stringify(manifestPaths)) throw new Error("Package manifest paths do not match package files.");
  validateStateFileBinding(pkg.projectState, validated);

  return cloneJson({
    ...pkg,
    manifest: { ...pkg.manifest, projectId, paths },
    files: validated,
  }) as ForgeProjectPackage;
}

function validateStateFileBinding(projectState: unknown, files: readonly ProjectPackageFile[]): void {
  const stateFile = files.find((file) => file.path === "project-state.json");
  if (!stateFile) return;
  if (stateFile.encoding !== "utf8") throw new Error("Package project-state.json must use UTF-8 encoding so it can be bound to projectState.");
  const mediaType = stateFile.mediaType.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error("Package project-state.json must use application/json media type.");
  if (stateFile.content !== canonicalJson(projectState)) throw new Error("Package project-state.json does not match projectState.");
}

function assertUniquePaths(paths: readonly string[]): void {
  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) throw new Error(`Duplicate package path "${path}".`);
    seen.add(path);
  }
}

function validatePackagePath(path: string): string {
  const segments = path.split("/");
  if (path.startsWith("/") || path.includes("\\") || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("Package file paths must be relative, normalized, and traversal-safe.");
  }
  return path;
}

function validatePackageFile(value: unknown): ProjectPackageFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Package file must be an object.");
  const file = value as ProjectPackageFile;
  const path = validatePackagePath(text(file.path, "Package file path"));
  if (typeof file.content !== "string") throw new Error("Package file content is required.");
  if (file.encoding !== "utf8" && file.encoding !== "base64") throw new Error("Package file encoding must be utf8 or base64.");

  let bytes: Buffer;
  if (file.encoding === "base64") {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)) throw new Error(`Package file "${path}" contains invalid base64 content.`);
    bytes = Buffer.from(file.content, "base64");
  } else {
    bytes = Buffer.from(file.content, "utf8");
  }

  const sha256 = text(file.sha256, "Package file sha256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Package file "${path}" sha256 must be a 64-character hexadecimal digest.`);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) throw new Error(`Package file "${path}" sha256 does not match its content.`);

  return {
    path,
    content: file.content,
    encoding: file.encoding,
    mediaType: text(file.mediaType, "Package media type"),
    sha256,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function serializeProjectPackage(pkg: ForgeProjectPackage): string {
  return JSON.stringify(validateProjectPackage(pkg), null, 2);
}

export function deserializeProjectPackage(serialized: string): ForgeProjectPackage {
  if (typeof serialized !== "string" || !serialized.trim()) throw new Error("Invalid Forge project package: serialized package must be a non-empty string.");
  try {
    return validateProjectPackage(JSON.parse(serialized) as ForgeProjectPackage);
  } catch (error) {
    throw new Error(`Invalid Forge project package: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

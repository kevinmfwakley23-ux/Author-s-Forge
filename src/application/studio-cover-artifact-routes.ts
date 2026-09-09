import type { IncomingMessage, ServerResponse } from "node:http";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { FileCoverArtifactVault } from "../infrastructure/file-cover-artifact-vault";
import { StudioCoverArtifactService } from "./studio-cover-artifact";

export type StudioCoverArtifactRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioCoverArtifactRoutes(store: FileProjectStore, vault: FileCoverArtifactVault): StudioCoverArtifactRouteHandler {
  const service = new StudioCoverArtifactService(store, vault);

  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/cover/artifacts`;

    if (url.pathname === root && req.method === "GET") {
      const bookId = optionalText(url.searchParams.get("bookId"));
      const planId = optionalText(url.searchParams.get("planId"));
      const records = await vault.list(projectId, {
        ...(bookId ? { bookId } : {}),
        ...(planId ? { planId } : {}),
      });
      const artifacts = [];
      for (const evidence of records) artifacts.push(await vault.verify(evidence));
      json(res, 200, { projectId, bookId, planId, artifacts });
      return true;
    }

    if (url.pathname === root && req.method === "POST") {
      const input = await body(req);
      const result = await service.render({
        projectId,
        bookId: requiredText(input.bookId, "Book id"),
        planId: requiredText(input.planId, "Cover plan id"),
        assetId: requiredText(input.assetId, "Cover artwork asset id"),
        authorApproved: input.authorApproved === true,
      });
      json(res, 201, {
        evidence: result.evidence,
        downloadPath: result.downloadPath,
        contentBase64: result.contentBase64,
      });
      return true;
    }

    const fileMatch = url.pathname.match(new RegExp(`^${escapeRegex(root)}/([^/]+)/file$`));
    if (fileMatch && req.method === "GET") {
      const artifactId = decodeURIComponent(fileMatch[1]);
      const records = await vault.list(projectId);
      const evidence = records.find((candidate) => candidate.artifactId === artifactId);
      if (!evidence) throw new Error(`Cover artifact "${artifactId}" was not found.`);
      const bytes = await vault.read(evidence);
      res.writeHead(200, {
        "content-type": evidence.mimeType,
        "content-length": String(bytes.length),
        "content-disposition": `attachment; filename="${safeDownloadName(evidence.fileName)}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(bytes);
      return true;
    }

    return false;
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 1024 * 1024) throw new Error("Cover artifact request exceeds the 1 MiB limit.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object body required.");
  return parsed as Record<string, unknown>;
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function safeDownloadName(value: string): string {
  const name = value.replace(/[\r\n\"\\/]/g, "-").trim();
  return name || "cover-artifact";
}
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

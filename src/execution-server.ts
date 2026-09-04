import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createForgeStudioRuntime } from "./infrastructure/forge-studio-runtime";
import type { ForgeExecutionCommand, ForgeExecutionPlan, ForgeExecutionProviderKind } from "./application/forge-execution-fabric";

const port = Number(process.env.EXECUTION_PORT ?? 4573);
const host = process.env.HOST ?? "127.0.0.1";
const dataRoot = process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data");
const publicRoot = join(process.cwd(), "public");
const runtime = createForgeStudioRuntime(dataRoot);
const execution = runtime.execution;

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("EXECUTION_PORT must be an integer from 1 to 65535.");

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 1024 * 1024) throw new Error("Execution request body exceeds 1 MiB.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object body required.");
  return parsed as Record<string, unknown>;
}

function projectPath(pathname: string): { projectId: string; suffix: string } | null {
  const match = pathname.match(/^\/api\/projects\/([A-Za-z0-9_-]+)\/execution(\/.*)?$/);
  return match ? { projectId: match[1], suffix: match[2] ?? "" } : null;
}

async function requireProject(projectId: string): Promise<void> {
  if (!(await runtime.core.projectExists(projectId))) throw new Error(`Project ${projectId} does not exist.`);
}

async function requireOwnedJob(projectId: string, jobId: string) {
  const job = await execution.get(jobId);
  if (!job || job.projectId !== projectId) throw new Error(`Execution job ${jobId} does not exist in project ${projectId}.`);
  return job;
}

function parsePlan(input: unknown): ForgeExecutionPlan {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Execution plan object is required.");
  const value = input as Record<string, unknown>;
  const provider = String(value.provider ?? "") as ForgeExecutionProviderKind;
  const purpose = String(value.purpose ?? "");
  if (!Array.isArray(value.commands)) throw new Error("Execution commands must be an array.");
  const commands = value.commands.map((raw, index): ForgeExecutionCommand => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Execution command ${index + 1} must be an object.`);
    const command = raw as Record<string, unknown>;
    if (command.args !== undefined && !Array.isArray(command.args)) throw new Error(`Execution command ${index + 1} args must be an array.`);
    return {
      program: String(command.program ?? ""),
      ...(command.args ? { args: command.args.map(String) } : {}),
      ...(command.cwd !== undefined ? { cwd: String(command.cwd) } : {}),
      ...(command.timeoutSeconds !== undefined ? { timeoutSeconds: Number(command.timeoutSeconds) } : {}),
    };
  });
  if (value.networkDomains !== undefined && !Array.isArray(value.networkDomains)) throw new Error("networkDomains must be an array.");
  return {
    provider,
    purpose,
    commands,
    ...(value.networkDomains ? { networkDomains: value.networkDomains.map(String) } : {}),
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (url.pathname === "/api/health" && req.method === "GET") {
    json(res, 200, { ok: true, service: "authors-forge-execution", providers: execution.providerStatus() });
    return true;
  }
  const route = projectPath(url.pathname);
  if (!route) return false;
  await requireProject(route.projectId);

  if (route.suffix === "" && req.method === "GET") {
    json(res, 200, { providers: execution.providerStatus(), jobs: await execution.list(route.projectId) });
    return true;
  }
  if (route.suffix === "/proposals" && req.method === "POST") {
    const input = await body(req);
    const requestedBy = input.requestedBy === "ai" ? "ai" : "author";
    const job = await execution.propose({
      projectId: route.projectId,
      title: String(input.title ?? "Execution proposal"),
      requestedBy,
      plan: parsePlan(input.plan),
    });
    json(res, 201, job);
    return true;
  }

  const jobMatch = route.suffix.match(/^\/([^/]+)$/);
  if (jobMatch && req.method === "GET") {
    json(res, 200, await requireOwnedJob(route.projectId, decodeURIComponent(jobMatch[1])));
    return true;
  }
  const actionMatch = route.suffix.match(/^\/([^/]+)\/(approve|reject|run)$/);
  if (actionMatch && req.method === "POST") {
    const jobId = decodeURIComponent(actionMatch[1]);
    await requireOwnedJob(route.projectId, jobId);
    if (actionMatch[2] === "approve") {
      json(res, 200, await execution.approve(jobId, "author"));
      return true;
    }
    if (actionMatch[2] === "reject") {
      const input = await body(req);
      json(res, 200, await execution.reject(jobId, String(input.reason ?? "Rejected by author.")));
      return true;
    }
    json(res, 200, await execution.execute(jobId));
    return true;
  }
  return false;
}

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const target = pathname === "/" ? "/execution.html" : pathname;
  const normalized = normalize(target).replace(/^(\.\.[/\\])+/, "");
  const relative = normalized.replace(/^[/\\]+/, "");
  if (!relative || relative.includes("..")) {
    json(res, 404, { error: "Not found." });
    return;
  }
  const allowed = new Set(["execution.html", "forge-execution.js", "styles.css", "forge-royal-hardening.css", "icon.svg"]);
  if (!allowed.has(relative)) {
    json(res, 404, { error: "Not found." });
    return;
  }
  try {
    const bytes = await readFile(join(publicRoot, relative));
    res.writeHead(200, {
      "content-type": contentTypes[extname(relative)] ?? "application/octet-stream",
      "cache-control": relative.endsWith(".html") ? "no-store" : "public, max-age=300",
      "x-content-type-options": "nosniff",
    });
    res.end(bytes);
  } catch {
    json(res, 404, { error: "Not found." });
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${host}:${port}`);
    if (url.pathname.startsWith("/api/")) {
      if (!(await handleApi(req, res, url))) json(res, 404, { error: "API route not found." });
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.on("clientError", (_error, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.listen(port, host, () => {
  console.log(`Author's Forge Execution Workplace listening on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

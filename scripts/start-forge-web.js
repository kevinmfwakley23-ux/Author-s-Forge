#!/usr/bin/env node
const { spawn } = require("node:child_process");
const { createReadStream, promises: fs } = require("node:fs");
const { createServer, request } = require("node:http");
const { extname, join } = require("node:path");
const net = require("node:net");
const {
  authorizeLanRequest,
  createAccessToken,
  isLoopbackHost,
  safeTokenEqual,
  securityHeaders,
} = require("./forge-network-security");
const {
  isHttpsRequest,
  requestProtocol,
  resolveHostedRoute,
  rewriteHostedHtml,
} = require("./forge-web-gateway");

const publicHost = String(process.env.FORGE_WEB_HOST || process.env.HOST || "0.0.0.0").trim();
const publicPort = Number(process.env.FORGE_WEB_PORT || process.env.PORT || 4173);
const requireHttps = /^(1|true|yes)$/i.test(String(process.env.FORGE_REQUIRE_HTTPS || ""));
const forceSecureCookie = /^(1|true|yes)$/i.test(String(process.env.FORGE_SECURE_COOKIE || ""));
const configuredToken = String(process.env.FORGE_ACCESS_TOKEN || "").trim();
const publicRoot = join(process.cwd(), "public");

if (!publicHost) throw new Error("FORGE_WEB_HOST cannot be blank.");
if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535) throw new Error("Forge web port must be an integer from 1 to 65535.");
if (configuredToken && configuredToken.length < 24) throw new Error("FORGE_ACCESS_TOKEN must contain at least 24 characters.");
if (!configuredToken && !isLoopbackHost(publicHost)) {
  throw new Error("FORGE_ACCESS_TOKEN is required when the hosted Forge gateway is exposed beyond loopback.");
}
const accessToken = configuredToken || createAccessToken();

const serviceDefinitions = [
  { id: "studio", name: "Studio", entry: "dist/studio-server.js", portKey: "PORT" },
  { id: "journal", name: "Guided Journal", entry: "dist/guided-journal-server.js", portKey: "JOURNAL_PORT" },
  { id: "workbooks", name: "Educational Workbooks", entry: "dist/educational-workbook-server.js", portKey: "WORKBOOK_PORT" },
  { id: "specialized", name: "Specialized Creation", entry: "dist/specialized-creation-server.js", portKey: "SPECIALIZED_PORT" },
];

const children = [];
const internalPorts = new Map();
let gateway = null;
let shuttingDown = false;
let exitCode = 0;
let forceTimer = null;

function stopped(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function waitForPort(port, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started >= timeoutMs) return reject(new Error(`Forge internal service on port ${port} did not become ready.`));
        setTimeout(tryConnect, 100);
      });
    };
    tryConnect();
  });
}

function launch(service, port) {
  const env = { ...process.env, HOST: "127.0.0.1", [service.portKey]: String(port) };
  delete env.FORGE_ACCESS_TOKEN;
  delete env.FORGE_WEB_HOST;
  delete env.FORGE_WEB_PORT;
  const child = spawn(process.execPath, [service.entry], { env, stdio: "inherit" });
  children.push(child);
  internalPorts.set(service.id, port);
  child.on("error", (error) => {
    console.error(`[Forge Web] ${service.name} failed to start: ${error.message}`);
    exitCode = 1;
    stopAll();
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      const detail = signal ? `signal ${signal}` : `code ${code}`;
      console.error(`[Forge Web] ${service.name} exited unexpectedly (${detail}).`);
      exitCode = code && code !== 0 ? code : 1;
      stopAll();
    }
  });
}

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  try { gateway?.close(); } catch {}
  for (const child of children) if (!stopped(child)) child.kill(signal);
  forceTimer = setTimeout(() => {
    for (const child of children) if (!stopped(child)) child.kill("SIGKILL");
  }, 3000);
  forceTimer.unref?.();
}

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function secureForRequest(req) {
  return isHttpsRequest(req.headers, forceSecureCookie);
}

function commonHeaders(req) {
  return {
    ...securityHeaders(),
    ...(secureForRequest(req) ? { "strict-transport-security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

function unauthorized(req, res, message = "Enter the Forge access token configured on the host.") {
  const wantsJson = String(req.headers.accept || "").includes("application/json") || String(req.url || "").includes("/api/");
  if (wantsJson) {
    res.writeHead(401, { ...commonHeaders(req), "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Author's Forge access required." }));
    return;
  }
  res.writeHead(401, { ...commonHeaders(req), "cache-control": "no-store", "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Author's Forge Access</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f0e7;color:#17140f;font:16px system-ui,sans-serif}.card{width:min(92vw,520px);padding:28px;border:1px solid #a58a49;border-radius:18px;background:white;box-shadow:0 18px 60px #0002}h1{margin-top:0}label{display:block;font-weight:700;margin:18px 0 8px}input,button{box-sizing:border-box;width:100%;min-height:48px;font:inherit;border-radius:10px}input{padding:10px 12px;border:1px solid #8d826e}button{margin-top:14px;border:0;background:#17140f;color:white;font-weight:800}p{line-height:1.5}</style></head><body><main class="card"><h1>Author's Forge</h1><p>${htmlEscape(message)}</p><form method="post" action="/__forge/login"><label for="token">Access token</label><input id="token" name="token" type="password" autocomplete="current-password" required><button type="submit">Open the Forge</button></form></main></body></html>`);
}

function readFormBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Login request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleLogin(req, res) {
  if (req.method !== "POST") {
    res.writeHead(303, { ...commonHeaders(req), location: "/" });
    res.end();
    return;
  }
  try {
    const form = new URLSearchParams(await readFormBody(req));
    const submitted = form.get("token") || "";
    if (!safeTokenEqual(submitted, accessToken)) return unauthorized(req, res, "That access token was not accepted. Check the hosted Forge secret and try again.");
    const auth = authorizeLanRequest({ requestUrl: `/?access=${encodeURIComponent(submitted)}`, cookieHeader: "", token: accessToken, secureCookie: secureForRequest(req) });
    res.writeHead(303, { ...commonHeaders(req), "cache-control": "no-store", location: "/", "set-cookie": auth.setCookie });
    res.end();
  } catch (error) {
    res.writeHead(400, { ...commonHeaders(req), "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
}

const assetTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
});

async function serveHostedAsset(req, res, pathname) {
  const allowed = new Set(["/forge-hosted-client.js", "/forge-hosted-client.css"]);
  if (!allowed.has(pathname)) return false;
  const filePath = join(publicRoot, pathname.slice(1));
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("not a file");
    res.writeHead(200, { ...commonHeaders(req), "cache-control": "public, max-age=300", "content-type": assetTypes[extname(filePath)] || "application/octet-stream", "content-length": stat.size });
    if (req.method === "HEAD") return res.end();
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { ...commonHeaders(req), "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" });
    res.end("Not found.");
  }
  return true;
}

function proxyRequest(req, res, route) {
  const port = internalPorts.get(route.serviceId);
  const headers = { ...req.headers };
  delete headers.connection;
  delete headers["proxy-connection"];
  headers.host = `127.0.0.1:${port}`;
  headers["x-forwarded-host"] = req.headers["x-forwarded-host"] || req.headers.host || "";
  headers["x-forwarded-proto"] = requestProtocol(req.headers, "http");
  headers["x-forwarded-prefix"] = route.prefix;

  const upstream = request({
    host: "127.0.0.1",
    port,
    method: req.method,
    path: route.upstreamPath,
    headers,
  }, (upstreamRes) => {
    const contentType = String(upstreamRes.headers["content-type"] || "").toLowerCase();
    const shouldRewriteHtml = contentType.includes("text/html");
    if (!shouldRewriteHtml) {
      const responseHeaders = { ...upstreamRes.headers, ...commonHeaders(req) };
      res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
      if (req.method === "HEAD") return res.end();
      upstreamRes.pipe(res);
      return;
    }

    const chunks = [];
    let total = 0;
    upstreamRes.on("data", (chunk) => {
      total += chunk.length;
      if (total > 8 * 1024 * 1024) {
        upstreamRes.destroy(new Error("Forge HTML response exceeded the hosted gateway limit."));
        return;
      }
      chunks.push(chunk);
    });
    upstreamRes.on("end", () => {
      if (res.headersSent) return;
      const rewritten = Buffer.from(rewriteHostedHtml(Buffer.concat(chunks).toString("utf8"), route.prefix));
      const responseHeaders = { ...upstreamRes.headers, ...commonHeaders(req), "content-length": rewritten.length };
      delete responseHeaders["content-encoding"];
      delete responseHeaders["transfer-encoding"];
      res.writeHead(upstreamRes.statusCode || 200, responseHeaders);
      if (req.method === "HEAD") return res.end();
      res.end(rewritten);
    });
  });

  upstream.on("error", (error) => {
    if (res.headersSent) return res.end();
    res.writeHead(502, { ...commonHeaders(req), "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: `Forge office is not ready: ${error.message}` }));
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
}

async function handleRequest(req, res) {
  const parsed = new URL(req.url || "/", "http://forge.local");
  if (parsed.pathname === "/healthz") {
    res.writeHead(200, { ...commonHeaders(req), "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, services: serviceDefinitions.map((service) => service.id) }));
    return;
  }

  if (requireHttps && requestProtocol(req.headers) !== "https") {
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    if (host) {
      res.writeHead(308, { ...securityHeaders(), location: `https://${host}${req.url || "/"}` });
      res.end();
      return;
    }
  }

  if (parsed.pathname === "/__forge/login") return handleLogin(req, res);

  const auth = authorizeLanRequest({
    requestUrl: req.url,
    cookieHeader: req.headers.cookie,
    token: accessToken,
    secureCookie: secureForRequest(req),
  });
  if (auth.bootstrap) {
    res.writeHead(303, { ...commonHeaders(req), "cache-control": "no-store", location: auth.redirectPath || "/", "set-cookie": auth.setCookie });
    res.end();
    return;
  }
  if (!auth.authorized) return unauthorized(req, res);

  if (await serveHostedAsset(req, res, parsed.pathname)) return;

  const route = resolveHostedRoute(req.url);
  if (route.redirectPath) {
    res.writeHead(308, { ...commonHeaders(req), location: route.redirectPath });
    res.end();
    return;
  }
  proxyRequest(req, res, route);
}

async function main() {
  const reservations = await Promise.all(serviceDefinitions.map(() => reserveLoopbackPort()));
  serviceDefinitions.forEach((service, index) => launch(service, reservations[index]));
  await Promise.all(reservations.map((port) => waitForPort(port)));

  gateway = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error(error);
      if (res.headersSent) return res.end();
      res.writeHead(500, { ...securityHeaders(), "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Hosted Forge gateway failure." }));
    });
  });
  gateway.on("clientError", (_error, socket) => {
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });
  gateway.on("error", (error) => {
    console.error(`[Forge Web] Gateway failed: ${error.message}`);
    exitCode = 1;
    stopAll();
  });
  gateway.listen(publicPort, publicHost, () => {
    console.log(`[Forge Web] Author's Forge is listening on ${publicHost}:${publicPort}`);
    console.log("[Forge Web] One origin serves Studio /, Guided Journal /journal/, Workbooks /workbooks/, and Specialized Creation /specialized/.");
    console.log("[Forge Web] Persistent state directory:", process.env.FORGE_DATA_DIR || join(process.cwd(), ".forge-data"));
    if (isLoopbackHost(publicHost) && !configuredToken) console.log(`[Forge Web] Local bootstrap: http://${publicHost}:${publicPort}/?access=${encodeURIComponent(accessToken)}`);
    else console.log("[Forge Web] Open the hosted URL and enter the configured FORGE_ACCESS_TOKEN once per browser session.");
  });
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
process.on("uncaughtException", (error) => {
  console.error(error);
  exitCode = 1;
  stopAll();
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  exitCode = 1;
  stopAll();
});

main().catch((error) => {
  console.error(error);
  exitCode = 1;
  stopAll();
});

const interval = setInterval(() => {
  if (!shuttingDown) return;
  if (children.every(stopped)) {
    clearInterval(interval);
    if (forceTimer) clearTimeout(forceTimer);
    process.exit(exitCode);
  }
}, 50);

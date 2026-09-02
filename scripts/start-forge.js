#!/usr/bin/env node
const { spawn } = require("node:child_process");
const { createServer, request } = require("node:http");
const net = require("node:net");
const {
  authorizeLanRequest,
  createAccessToken,
  isLoopbackHost,
  securityHeaders,
} = require("./forge-network-security");

const hostArg = process.argv.find((arg) => arg.startsWith("--host="));
const host = hostArg ? hostArg.slice("--host=".length).trim() : (process.env.HOST || "127.0.0.1");
if (!host) throw new Error("Forge launcher host cannot be blank.");

const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).trim().toLowerCase() : "";
const allServices = [
  { id: "studio", name: "Studio", entry: "dist/studio-server.js", portKey: "PORT", port: process.env.PORT || "4173" },
  { id: "journal", name: "Guided Journal", entry: "dist/guided-journal-server.js", portKey: "JOURNAL_PORT", port: process.env.JOURNAL_PORT || "4273" },
  { id: "workbooks", name: "Educational Workbooks", entry: "dist/educational-workbook-server.js", portKey: "WORKBOOK_PORT", port: process.env.WORKBOOK_PORT || "4373" },
  { id: "specialized", name: "Specialized Creation", entry: "dist/specialized-creation-server.js", portKey: "SPECIALIZED_PORT", port: process.env.SPECIALIZED_PORT || "4473" },
];
const services = only ? allServices.filter((service) => service.id === only) : allServices;
if (only && services.length !== 1) throw new Error(`Unknown Forge office "${only}". Use studio, journal, workbooks, or specialized.`);

const seen = new Set();
for (const service of services) {
  const port = Number(service.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${service.name} port must be an integer from 1 to 65535.`);
  if (seen.has(port)) throw new Error(`Forge launcher port collision detected at ${port}. Configure distinct service ports.`);
  seen.add(port);
  service.port = String(port);
}

const protectedLanMode = !isLoopbackHost(host);
const configuredAccessToken = String(process.env.FORGE_ACCESS_TOKEN || "").trim();
if (protectedLanMode && configuredAccessToken && configuredAccessToken.length < 24) {
  throw new Error("FORGE_ACCESS_TOKEN must contain at least 24 characters when Forge is exposed beyond loopback.");
}
const accessToken = protectedLanMode ? (configuredAccessToken || createAccessToken()) : "";

const children = [];
const proxyServers = [];
const reservedInternalPorts = new Set();
let shuttingDown = false;
let exitCode = 0;
let forceTimer = null;

function stopped(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function closeProxies() {
  for (const server of proxyServers) {
    try { server.close(); } catch {}
  }
}

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  closeProxies();
  for (const child of children) {
    if (!stopped(child)) child.kill(signal);
  }
  forceTimer = setTimeout(() => {
    for (const child of children) {
      if (!stopped(child)) child.kill("SIGKILL");
    }
  }, 2500);
  forceTimer.unref?.();
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => {
        if (error) return reject(error);
        if (!port || reservedInternalPorts.has(port)) return resolve(reserveLoopbackPort());
        reservedInternalPorts.add(port);
        resolve(port);
      });
    });
  });
}

function launch(service, bindHost, bindPort) {
  const env = { ...process.env, HOST: bindHost, [service.portKey]: String(bindPort) };
  const child = spawn(process.execPath, [service.entry], { env, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[Forge] ${service.name} failed to start: ${error.message}`);
    exitCode = 1;
    stopAll();
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      const detail = signal ? `signal ${signal}` : `code ${code}`;
      console.error(`[Forge] ${service.name} exited unexpectedly (${detail}).`);
      exitCode = code && code !== 0 ? code : 1;
      stopAll();
    }
  });
  return child;
}

function unauthorized(res) {
  const headers = {
    ...securityHeaders(),
    "content-type": "text/html; charset=utf-8",
  };
  res.writeHead(401, headers);
  res.end("<!doctype html><html><body><h1>Author's Forge access required</h1><p>Open Forge using the protected access URL printed by the launcher.</p></body></html>");
}

function proxyRequest(req, res, service, internalPort) {
  const auth = authorizeLanRequest({
    requestUrl: req.url,
    cookieHeader: req.headers.cookie,
    token: accessToken,
  });
  if (auth.bootstrap) {
    res.writeHead(303, {
      ...securityHeaders(),
      location: auth.redirectPath || "/",
      "set-cookie": auth.setCookie,
    });
    res.end();
    return;
  }
  if (!auth.authorized) {
    unauthorized(res);
    return;
  }

  const headers = { ...req.headers };
  delete headers.connection;
  delete headers["proxy-connection"];
  headers.host = `127.0.0.1:${internalPort}`;
  headers["x-forwarded-host"] = req.headers.host || "";
  headers["x-forwarded-proto"] = "http";

  const upstream = request({
    host: "127.0.0.1",
    port: internalPort,
    method: req.method,
    path: req.url,
    headers,
  }, (upstreamRes) => {
    const responseHeaders = { ...upstreamRes.headers, ...securityHeaders() };
    res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
    upstreamRes.pipe(res);
  });
  upstream.on("error", (error) => {
    if (res.headersSent) return res.end();
    res.writeHead(502, { ...securityHeaders(), "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: `${service.name} is not ready: ${error.message}` }));
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
}

function startProtectedProxy(service, internalPort) {
  const proxy = createServer((req, res) => proxyRequest(req, res, service, internalPort));
  proxy.on("clientError", (_error, socket) => {
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });
  proxy.on("error", (error) => {
    console.error(`[Forge] ${service.name} protected LAN proxy failed: ${error.message}`);
    exitCode = 1;
    stopAll();
  });
  proxy.listen(Number(service.port), host);
  proxyServers.push(proxy);
}

function displayHost() {
  return host === "0.0.0.0" || host === "::" ? "<device-ip>" : host;
}

async function main() {
  if (protectedLanMode) {
    for (const service of services) {
      const internalPort = await reserveLoopbackPort();
      launch(service, "127.0.0.1", internalPort);
      startProtectedProxy(service, internalPort);
      console.log(`[Forge] ${service.name}: http://${displayHost()}:${service.port}`);
    }
    console.log("[Forge] Protected LAN mode is active. Office processes are bound to loopback and exposed only through the access-gated launcher proxy.");
    console.log(`[Forge] Open this URL first on your device: http://${displayHost()}:${services[0].port}/?access=${encodeURIComponent(accessToken)}`);
    console.log("[Forge] The access cookie is HttpOnly/SameSite=Strict and applies to the same host across Forge office ports. Use only on a network you trust.");
  } else {
    for (const service of services) {
      launch(service, host, Number(service.port));
      console.log(`[Forge] ${service.name}: http://${host}:${service.port}`);
    }
  }
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

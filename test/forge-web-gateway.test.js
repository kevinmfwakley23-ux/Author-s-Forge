const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const net = require("node:net");
const { authorizeLanRequest } = require("../scripts/forge-network-security");
const { resolveHostedRoute, rewriteHostedHtml } = require("../scripts/forge-web-gateway");

function reservePort() {
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

async function waitFor(url, timeoutMs = 20000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

test("hosted route resolver keeps all Forge offices on one public origin", () => {
  assert.deepEqual(resolveHostedRoute("/?project=book-1"), {
    serviceId: "studio",
    prefix: "",
    redirectPath: null,
    upstreamPath: "/?project=book-1",
  });
  assert.deepEqual(resolveHostedRoute("/journal?project=book-1"), {
    serviceId: "journal",
    prefix: "/journal",
    redirectPath: "/journal/?project=book-1",
    upstreamPath: null,
  });
  assert.deepEqual(resolveHostedRoute("/journal/api/projects/book-1/journal/library?x=1"), {
    serviceId: "journal",
    prefix: "/journal",
    redirectPath: null,
    upstreamPath: "/api/projects/book-1/journal/library?x=1",
  });
  assert.equal(resolveHostedRoute("/workbooks/api/projects/book-1").serviceId, "workbooks");
  assert.equal(resolveHostedRoute("/specialized/api/projects/book-1").serviceId, "specialized");
});

test("hosted HTML rewriting keeps office assets under their path and installs the browser bridge", () => {
  const source = '<html><head><link rel="stylesheet" href="/guided-journal.css"><link rel="preconnect" href="https://example.com"></head><body><script src="/guided-journal.js"></script></body></html>';
  const rewritten = rewriteHostedHtml(source, "/journal");
  assert.match(rewritten, /href="\/journal\/guided-journal\.css"/);
  assert.match(rewritten, /src="\/journal\/guided-journal\.js"/);
  assert.match(rewritten, /href="https:\/\/example\.com"/);
  assert.match(rewritten, /forge-hosted-client\.css/);
  assert.match(rewritten, /forge-hosted-client\.js/);
});

test("access bootstrap can issue a Secure cookie behind HTTPS", () => {
  const token = "12345678901234567890123456789012";
  const result = authorizeLanRequest({
    requestUrl: `/?access=${token}`,
    cookieHeader: "",
    token,
    secureCookie: true,
  });
  assert.equal(result.bootstrap, true);
  assert.equal(result.redirectPath, "/");
  assert.match(result.setCookie, /HttpOnly/);
  assert.match(result.setCookie, /SameSite=Strict/);
  assert.match(result.setCookie, /Secure/);
});

test("hosted Forge gateway performs real login and serves Studio plus prefixed offices", { timeout: 45000 }, async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-web-"));
  const port = await reservePort();
  const token = "forge-web-integration-token-1234567890";
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["scripts/start-forge-web.js"], {
    env: {
      ...process.env,
      FORGE_WEB_HOST: "127.0.0.1",
      FORGE_WEB_PORT: String(port),
      FORGE_ACCESS_TOKEN: token,
      FORGE_DATA_DIR: dataDir,
      FORGE_REQUIRE_HTTPS: "0",
      FORGE_SECURE_COOKIE: "0",
      OPENAI_API_KEY: "",
      OLLAMA_BASE_URL: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
      KINGS_AI_ENDPOINT: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(resolve, 5000).unref?.();
    });
    await rm(dataDir, { recursive: true, force: true });
  });

  await waitFor(`${base}/healthz`).catch((error) => {
    throw new Error(`${error.message}\nHosted gateway stderr:\n${stderr}`);
  });

  const denied = await fetch(`${base}/`, { redirect: "manual" });
  assert.equal(denied.status, 401);
  assert.match(await denied.text(), /Author's Forge/);

  const login = await fetch(`${base}/__forge/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  assert.equal(login.status, 303);
  const cookie = login.headers.get("set-cookie");
  assert.ok(cookie, "login must set the access cookie");
  const cookieHeader = cookie.split(";")[0];

  const studio = await fetch(`${base}/`, { headers: { cookie: cookieHeader } });
  assert.equal(studio.status, 200);
  const studioHtml = await studio.text();
  assert.match(studioHtml, /forge-hosted-client\.js/);

  const journal = await fetch(`${base}/journal/`, { headers: { cookie: cookieHeader } });
  assert.equal(journal.status, 200);
  const journalHtml = await journal.text();
  assert.match(journalHtml, /\/journal\/guided-journal\.css/);
  assert.match(journalHtml, /forge-hosted-client\.js/);

  const journalCss = await fetch(`${base}/journal/guided-journal.css`, { headers: { cookie: cookieHeader } });
  assert.equal(journalCss.status, 200);
  assert.match(String(journalCss.headers.get("content-type")), /text\/css/);

  const workbooks = await fetch(`${base}/workbooks/`, { headers: { cookie: cookieHeader } });
  assert.equal(workbooks.status, 200);

  const specialized = await fetch(`${base}/specialized/`, { headers: { cookie: cookieHeader } });
  assert.equal(specialized.status, 200);

  const consoleBridge = await fetch(`${base}/forge-hosted-client.js`, { headers: { cookie: cookieHeader } });
  assert.equal(consoleBridge.status, 200);
  assert.match(await consoleBridge.text(), /PlayStation 5/);
});

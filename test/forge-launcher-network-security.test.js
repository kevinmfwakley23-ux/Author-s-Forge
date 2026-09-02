const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");
const test = require("node:test");

const {
  authorizeLanRequest,
  createAccessToken,
  isLoopbackHost,
  parseCookies,
  safeTokenEqual,
} = require("../scripts/forge-network-security");

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

async function uniquePorts(count) {
  const ports = new Set();
  while (ports.size < count) ports.add(await reservePort());
  return [...ports];
}

async function eventually(operation, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { return await operation(); }
    catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw lastError || new Error("Timed out waiting for Forge launcher.");
}

test("LAN policy uses strong tokens and strips bootstrap credentials from redirects", () => {
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("[::1]"), true);
  assert.equal(isLoopbackHost("0.0.0.0"), false);
  assert.equal(isLoopbackHost("192.168.1.20"), false);

  const token = createAccessToken();
  assert.ok(token.length >= 40);
  assert.equal(safeTokenEqual(token, token), true);
  assert.equal(safeTokenEqual(token, `${token}x`), false);

  const bootstrap = authorizeLanRequest({
    requestUrl: `/?project=forge-studio&access=${encodeURIComponent(token)}`,
    cookieHeader: "",
    token,
  });
  assert.equal(bootstrap.authorized, true);
  assert.equal(bootstrap.bootstrap, true);
  assert.equal(bootstrap.redirectPath, "/?project=forge-studio");
  assert.ok(bootstrap.setCookie.includes("HttpOnly"));
  assert.ok(bootstrap.setCookie.includes("SameSite=Strict"));
  assert.equal(parseCookies(bootstrap.setCookie).forge_access, token);

  const cookieAccess = authorizeLanRequest({ requestUrl: "/api/health", cookieHeader: bootstrap.setCookie, token });
  assert.equal(cookieAccess.authorized, true);
  const rejected = authorizeLanRequest({ requestUrl: "/api/health", cookieHeader: "forge_access=wrong", token });
  assert.equal(rejected.authorized, false);
});

test("forge:android launcher denies anonymous LAN access and gates all offices behind one host cookie", { timeout: 45000 }, async () => {
  const [studioPort, journalPort, workbookPort, specializedPort] = await uniquePorts(4);
  const root = await mkdtemp(join(tmpdir(), "authors-forge-lan-security-"));
  const accessToken = "forge-test-access-token-1234567890";
  let output = "";
  const child = spawn(process.execPath, ["scripts/start-forge.js", "--host=0.0.0.0"], {
    cwd: join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(studioPort),
      JOURNAL_PORT: String(journalPort),
      WORKBOOK_PORT: String(workbookPort),
      SPECIALIZED_PORT: String(specializedPort),
      FORGE_ACCESS_TOKEN: accessToken,
      FORGE_DATA_DIR: join(root, "data"),
      FORGE_BACKUP_DIR: join(root, "backups"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });

  try {
    const studioBase = `http://127.0.0.1:${studioPort}`;
    const journalBase = `http://127.0.0.1:${journalPort}`;

    const anonymous = await eventually(async () => {
      const response = await fetch(`${studioBase}/api/health`, { redirect: "manual" });
      assert.equal(response.status, 401);
      return response;
    });
    assert.equal(anonymous.headers.get("x-frame-options"), "DENY");
    assert.equal(anonymous.headers.get("referrer-policy"), "no-referrer");
    assert.doesNotMatch(await anonymous.text(), new RegExp(accessToken));

    const wrong = await fetch(`${studioBase}/?access=definitely-wrong`, { redirect: "manual" });
    assert.equal(wrong.status, 401);

    const bootstrap = await fetch(`${studioBase}/?project=forge-studio&access=${encodeURIComponent(accessToken)}`, { redirect: "manual" });
    assert.equal(bootstrap.status, 303);
    assert.equal(bootstrap.headers.get("location"), "/?project=forge-studio");
    const setCookie = bootstrap.headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("forge_access="));
    assert.ok(setCookie.includes("HttpOnly"));
    assert.ok(setCookie.includes("SameSite=Strict"));
    assert.doesNotMatch(bootstrap.headers.get("location") || "", /access=/);
    const cookie = setCookie.split(";", 1)[0];

    const studioHealth = await eventually(async () => {
      const response = await fetch(`${studioBase}/api/health`, { headers: { cookie } });
      assert.equal(response.status, 200);
      return response.json();
    });
    assert.equal(studioHealth.ok, true);
    assert.equal(studioHealth.service, "authors-forge-studio");

    const journalHealth = await eventually(async () => {
      const response = await fetch(`${journalBase}/api/health`, { headers: { cookie } });
      assert.equal(response.status, 200);
      return response.json();
    });
    assert.equal(journalHealth.ok, true);
    assert.equal(journalHealth.service, "authors-forge-guided-journal-office");

    assert.match(output, /Protected LAN mode is active/);
    assert.match(output, /Open this URL first on your device/);
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); resolve(); }, 5000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
    await rm(root, { recursive: true, force: true });
  }
});

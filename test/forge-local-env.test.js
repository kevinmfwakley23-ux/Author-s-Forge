const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

const root = resolve(__dirname, "..");
const wrapper = join(root, "scripts", "run-with-forge-env.js");

async function tempRuntime(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  const target = join(directory, "target.cjs");
  await writeFile(target, `
    process.stdout.write(JSON.stringify({
      fromFile: process.env.FORGE_ENV_FROM_FILE || null,
      override: process.env.FORGE_ENV_OVERRIDE || null,
      secretAvailable: process.env.FORGE_ENV_SECRET_TEST === 'local-secret-value'
    }));
  `);
  return { directory, target };
}

test("Forge runtime wrapper loads local .env before executing the real entrypoint", async () => {
  const fixture = await tempRuntime("forge-env-load-");
  try {
    await writeFile(join(fixture.directory, ".env"), [
      "FORGE_ENV_FROM_FILE=loaded-from-dotenv",
      "FORGE_ENV_OVERRIDE=file-value",
      "FORGE_ENV_SECRET_TEST=local-secret-value",
      "",
    ].join("\n"));

    const result = spawnSync(process.execPath, [wrapper, fixture.target], {
      cwd: fixture.directory,
      env: {
        ...process.env,
        FORGE_ENV_OVERRIDE: "shell-value",
        FORGE_ENV_QUIET: "1",
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.fromFile, "loaded-from-dotenv");
    assert.equal(payload.override, "shell-value", "already-exported shell values must win over .env");
    assert.equal(payload.secretAvailable, true);
    assert.doesNotMatch(result.stdout, /local-secret-value/);
    assert.doesNotMatch(result.stderr, /local-secret-value/);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("Forge runtime wrapper works when .env is absent", async () => {
  const fixture = await tempRuntime("forge-env-absent-");
  try {
    const result = spawnSync(process.execPath, [wrapper, fixture.target], {
      cwd: fixture.directory,
      env: {
        ...process.env,
        FORGE_ENV_FROM_FILE: "shell-only",
        FORGE_ENV_OVERRIDE: "shell-value",
        FORGE_ENV_QUIET: "1",
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.fromFile, "shell-only");
    assert.equal(payload.override, "shell-value");
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("Forge repository ignores local dotenv credentials but keeps example templates trackable", async () => {
  const ignore = await readFile(join(root, ".gitignore"), "utf8");
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);

  const example = await readFile(join(root, ".env.example"), "utf8");
  assert.match(example, /^OPENAI_API_KEY=$/m);
  assert.match(example, /^OMNIROUTE_API_KEY=$/m);
  assert.match(example, /^ROUTER9_API_KEY=$/m);
  assert.doesNotMatch(example, /(?:sk-|secret-|Bearer\s+)[A-Za-z0-9_-]{8,}/i);
});

test("normal Forge and live-certification npm entrypoints use the dotenv runtime wrapper", async () => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  for (const name of [
    "forge",
    "forge:android",
    "forge:web",
    "studio",
    "forge:doctor",
    "test:ai:live:omniroute",
    "test:ai:live:9router",
    "test:ai:live:openai",
    "test:ai:live:groq",
    "test:ai:live:mistral",
    "test:ai:live:gemini",
    "test:ai:live:anthropic",
    "test:ai:live:openrouter",
  ]) {
    assert.match(pkg.scripts[name], /scripts\/run-with-forge-env\.js/, `${name} must load local Forge environment`);
  }
});

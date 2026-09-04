const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, symlink, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { ForgeExecutionFabric } = require('../dist/application/forge-execution-fabric.js');
const { FileForgeExecutionStore } = require('../dist/infrastructure/file-forge-execution-store.js');
const { LocalLinuxExecutionProvider } = require('../dist/infrastructure/local-linux-execution-provider.js');
const { DaytonaExecutionProvider } = require('../dist/infrastructure/daytona-execution-provider.js');

function fakeProvider() {
  return {
    kind: 'local-linux',
    available: true,
    async execute(job) {
      return {
        provider: 'local-linux',
        commands: job.plan.commands.map((command) => ({
          program: command.program,
          args: [...(command.args || [])],
          ...(command.cwd ? { cwd: command.cwd } : {}),
          exitCode: 0,
          stdout: 'verified',
          stderr: '',
          startedAt: '2026-09-04T12:00:00.000Z',
          finishedAt: '2026-09-04T12:00:01.000Z',
        })),
      };
    },
  };
}

test('execution fabric requires author approval and persists exact-plan evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-execution-ledger-'));
  try {
    const file = join(root, 'execution', 'jobs.json');
    const store = new FileForgeExecutionStore(file);
    const fabric = new ForgeExecutionFabric(store, [fakeProvider()]);
    const proposed = await fabric.propose({
      id: 'job-1',
      projectId: 'book-1',
      title: 'Validate EPUB',
      requestedBy: 'ai',
      now: '2026-09-04T12:00:00Z',
      plan: {
        provider: 'local-linux',
        purpose: 'Run a real EPUB validation command after author review.',
        commands: [{ program: 'epubcheck', args: ['output/book.epub'], timeoutSeconds: 60 }],
      },
    });
    assert.equal(proposed.status, 'pending');
    await assert.rejects(() => fabric.execute(proposed.id), /explicit author approval/);
    await assert.rejects(() => fabric.approve(proposed.id, 'ai'), /Only the author/);

    const approved = await fabric.approve(proposed.id, 'author', '2026-09-04T12:01:00Z');
    assert.equal(approved.status, 'approved');
    assert.equal(approved.approvedBy, 'author');
    const completed = await fabric.execute(proposed.id);
    assert.equal(completed.status, 'succeeded');
    assert.equal(completed.evidence.approvedPlanDigest, proposed.planDigest);
    assert.equal(completed.evidence.commands[0].stdout, 'verified');

    const reloaded = new ForgeExecutionFabric(new FileForgeExecutionStore(file));
    const durable = await reloaded.get(proposed.id);
    assert.equal(durable.status, 'succeeded');
    assert.equal(durable.planDigest, proposed.planDigest);
    assert.equal(durable.evidence.approvedPlanDigest, proposed.planDigest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejected execution jobs cannot run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-execution-reject-'));
  try {
    const fabric = new ForgeExecutionFabric(new FileForgeExecutionStore(join(root, 'jobs.json')), [fakeProvider()]);
    const job = await fabric.propose({ projectId: 'p', title: 'No', requestedBy: 'ai', plan: { provider: 'local-linux', purpose: 'Unsafe idea rejected by author.', commands: [{ program: 'node', args: ['-v'] }] } });
    const rejected = await fabric.reject(job.id, 'Author did not approve this tool operation.');
    assert.equal(rejected.status, 'rejected');
    await assert.rejects(() => fabric.execute(job.id), /explicit author approval/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('local Linux provider uses an executable allowlist, no shell, and workspace containment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-local-exec-'));
  const outside = await mkdtemp(join(tmpdir(), 'forge-local-outside-'));
  try {
    await mkdir(join(root, 'work'), { recursive: true });
    const provider = new LocalLinuxExecutionProvider({ rootDirectory: root, allowedExecutables: [process.execPath], enabled: true });
    const baseJob = {
      formatVersion: 1,
      id: 'local-1',
      projectId: 'p',
      title: 'Node verification',
      requestedBy: 'author',
      requestedAt: new Date().toISOString(),
      status: 'approved',
      planDigest: 'unused-by-provider',
      approvedBy: 'author',
      approvedAt: new Date().toISOString(),
      plan: { provider: 'local-linux', purpose: 'Verify local isolated vector execution.', commands: [{ program: process.execPath, args: ['-e', 'process.stdout.write("LOCAL_OK")'], cwd: 'work', timeoutSeconds: 15 }] },
    };
    const result = await provider.execute(baseJob);
    assert.equal(result.commands[0].exitCode, 0);
    assert.equal(result.commands[0].stdout, 'LOCAL_OK');

    await assert.rejects(() => provider.execute({ ...baseJob, plan: { ...baseJob.plan, commands: [{ program: 'sh', args: ['-c', 'echo bad'] }] } }), /not allowed/);
    await symlink(outside, join(root, 'escape'));
    await assert.rejects(() => provider.execute({ ...baseJob, plan: { ...baseJob.plan, commands: [{ program: process.execPath, args: ['-v'], cwd: 'escape' }] } }), /escapes the configured workspace root/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('Daytona provider creates a TTL sandbox with restricted network, executes, and deletes it', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined, authorization: init.headers?.Authorization });
    if (String(url).endsWith('/sandbox') && init.method === 'POST') return new Response(JSON.stringify({ id: 'sandbox-123' }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (String(url).includes('/process/execute')) return new Response(JSON.stringify({ result: 'REMOTE_OK', exitCode: 0 }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (String(url).endsWith('/sandbox/sandbox-123') && init.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response('not found', { status: 404 });
  };
  const provider = new DaytonaExecutionProvider({ apiKey: 'test-key', fetchImpl, ttlMinutes: 20 });
  const job = {
    formatVersion: 1,
    id: 'remote-1', projectId: 'p', title: 'Remote build', requestedBy: 'author', requestedAt: new Date().toISOString(), status: 'approved', planDigest: 'unused-by-provider', approvedBy: 'author', approvedAt: new Date().toISOString(),
    plan: { provider: 'daytona', purpose: 'Run a build in a remote sandbox.', networkDomains: ['github.com', 'registry.npmjs.org'], commands: [{ program: 'npm', args: ['test'], cwd: 'workspace', timeoutSeconds: 90 }] },
  };
  const result = await provider.execute(job);
  assert.equal(result.sandboxId, 'sandbox-123');
  assert.equal(result.commands[0].stdout, 'REMOTE_OK');
  assert.equal(calls[0].body.ttlMinutes, 20);
  assert.equal(calls[0].body.domainAllowList, 'github.com,registry.npmjs.org');
  assert.equal(calls[0].body.networkBlockAll, undefined);
  assert.equal(calls[1].body.command, 'npm test');
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.ok(calls.every((call) => call.authorization === 'Bearer test-key'));
});

test('Daytona provider blocks outbound network by default', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    if (String(url).endsWith('/sandbox') && init.method === 'POST') return new Response(JSON.stringify({ id: 'sandbox-offline' }), { status: 200 });
    if (String(url).includes('/process/execute')) return new Response(JSON.stringify({ result: 'ok', exitCode: 0 }), { status: 200 });
    return new Response(null, { status: 204 });
  };
  const provider = new DaytonaExecutionProvider({ apiKey: 'test-key', fetchImpl });
  await provider.execute({ formatVersion: 1, id: 'offline', projectId: 'p', title: 'Offline', requestedBy: 'author', requestedAt: new Date().toISOString(), status: 'approved', planDigest: 'x', approvedBy: 'author', approvedAt: new Date().toISOString(), plan: { provider: 'daytona', purpose: 'No internet required.', commands: [{ program: 'node', args: ['-v'] }] } });
  assert.equal(calls[0].body.networkBlockAll, true);
  assert.equal(calls[0].body.domainAllowList, undefined);
});

test('Daytona cleanup failure is reported instead of hidden', async () => {
  const fetchImpl = async (url, init = {}) => {
    if (String(url).endsWith('/sandbox') && init.method === 'POST') return new Response(JSON.stringify({ id: 'sandbox-cleanup' }), { status: 200 });
    if (String(url).includes('/process/execute')) return new Response(JSON.stringify({ result: 'ok', exitCode: 0 }), { status: 200 });
    return new Response('delete failed', { status: 503 });
  };
  const provider = new DaytonaExecutionProvider({ apiKey: 'test-key', fetchImpl });
  await assert.rejects(
    () => provider.execute({ formatVersion: 1, id: 'cleanup', projectId: 'p', title: 'Cleanup', requestedBy: 'author', requestedAt: new Date().toISOString(), status: 'approved', planDigest: 'x', approvedBy: 'author', approvedAt: new Date().toISOString(), plan: { provider: 'daytona', purpose: 'Verify sandbox cleanup errors remain visible.', commands: [{ program: 'node', args: ['-v'] }] } }),
    /Unable to delete Daytona sandbox/,
  );
});

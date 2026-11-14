/** Exercise the held workflow's tag step without publishing or calling GitHub. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('revert proof fails clearly before mutation when its baseline is absent', () => {
  for (const args of [[], ['refs/heads/synthetic-unavailable-baseline']]) {
    const result = spawnSync(process.execPath, ['scripts/revert-proof.ts', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, args.length === 0 ? /Usage: node scripts\/revert-proof.ts <baseline-ref>/u : /Mark baseline unavailable:.*Fetch the baseline history/u);
    assert.doesNotMatch(result.stdout, /Caught/u);
  }
});

test('identity workflow selects a dispatch-safe pin and documents all eight safeguard reverts', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.ok(workflow.includes("github.event.pull_request.base.sha || (github.event_name == 'push' && github.sha) || ''"));
  const proof = readFileSync('scripts/identity-revert-proof.ts', 'utf8');
  assert.equal(proof.match(/checks.push\(/gu)?.length, 8);
  assert.match(readFileSync('README.md', 'utf8'), /for eight independent behavioral reverts/u);
});

test('identity proof restores the exact original after SIGINT and SIGTERM during a mutant test', () => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const root = mkdtempSync(join(tmpdir(), 'brand-signal-'));
    const original = readFileSync('scripts/identity.ts', 'utf8');
    try {
      mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'test'));
      writeFileSync(join(root, 'scripts/identity.ts'), original);
      writeFileSync(join(root, 'scripts/identity-revert-proof.ts'), readFileSync('scripts/identity-revert-proof.ts', 'utf8').replace('of checks) {', 'of checks.slice(0, 1)) {').replace("    writeFileSync(path, mutant);", "    writeFileSync('proof.pid', String(process.pid));\n    writeFileSync(path, mutant);"));
      // One installed mutant per signal exercises cleanup; the separate proof covers all eight safeguards.
      writeFileSync(join(root, 'test/identity.test.ts'), `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('absent trusted controls', () => {
    process.kill(Number(readFileSync('proof.pid', 'utf8')), '${signal}');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    assert.fail('synthetic regression catches mutant');
});
`);
      const result = spawnSync(process.execPath, ['scripts/identity-revert-proof.ts'], { cwd: root, encoding: 'utf8', timeout: 60000, env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
      assert.equal(result.error, undefined);
      assert.equal(readFileSync(join(root, 'scripts/identity.ts'), 'utf8'), original, `${signal} must restore the mutant`);
      assert.equal(result.signal, null);
      assert.ok(result.status === 0 || result.status === (signal === 'SIGINT' ? 130 : 143), result.stdout + result.stderr);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

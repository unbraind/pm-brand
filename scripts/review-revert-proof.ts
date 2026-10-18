/** Prove round-four findings in disposable copies without mutating the package worktree. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'brand-review-proof-'));
const cases = [
  ['empty dispatch pin', 'scripts/identity.ts', ' || undefined', '', 'manual dispatch', 'test/identity.test.ts'],
  ['workflow dispatch pin', '.github/workflows/ci.yml', "(github.event_name == 'push' && github.sha) || ''", 'github.sha', 'dispatch-safe pin', 'test/workflows.test.ts'],
  ['README count', 'README.md', 'for eight independent', 'for six independent', 'dispatch-safe pin', 'test/workflows.test.ts'],
  ['trusted gate source', '.github/workflows/identity.yml', '$IDENTITY_BASE_SHA:scripts/identity.ts', '$PROPOSED_SHA:scripts/identity.ts', 'trusted workflow rejects', 'test/identity.test.ts'],
  ['trusted baseline ancestry', 'scripts/identity.ts', "    git('merge-base', '--is-ancestor', baseline, base);", '', 'a trusted baseline', 'test/identity.test.ts'],
] as const;
try {
  for (const path of ['scripts', 'test', '.github']) cpSync(path, join(root, path), { recursive: true });
  for (const path of ['README.md', 'package.json']) cpSync(path, join(root, path));
  const proofPath = 'scripts/identity-revert-proof.ts';
  const proof = readFileSync(proofPath, 'utf8');
  const listeners = proof.slice(proof.indexOf("for (const signal of ['SIGINT'"), proof.indexOf('\ntry {'));
  for (const [name, path, from, to, pattern, test] of [...cases, ['signal cleanup', proofPath, listeners, '', 'identity proof restores', 'test/workflows.test.ts']]) {
    const target = join(root, path);
    const original = readFileSync(target, 'utf8');
    assert.ok(original.includes(from), `${name}: mutation must apply`);
    writeFileSync(target, original.replace(from, to));
    const result = spawnSync(process.execPath, ['--test', `--test-name-pattern=${pattern}`, test], { cwd: root, encoding: 'utf8' });
    writeFileSync(target, original);
    assert.equal(result.status, 1, `${name}: ${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /AssertionError/u);
    console.log(`Caught behavioral revert: ${name} (1 failing regression)`);
  }
} finally { rmSync(root, { recursive: true, force: true }); }

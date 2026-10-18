/** Prove either legacy copy value or disconnecting the generator fails an unchanged image regression. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'brand-copy-proof-'));
try {
  for (const path of ['scripts', 'test']) cpSync(path, join(root, path), { recursive: true });
  cpSync('package.json', join(root, 'package.json'));
  for (const path of ['dist', 'node_modules', 'logo']) symlinkSync(resolve(path), join(root, path), 'dir');
  const cases = [
    ['title', 'scripts/preview-copy.ts', 'Context for any agent and task', 'Work orders, in triplicate', 'test/images.test.ts'],
    ['eyebrow', 'scripts/preview-copy.ts', 'Context management', 'Project management', 'test/images.test.ts'],
    ['generator connection', 'scripts/previews.ts', '...OG_PREVIEW_COPY', "title: 'Work orders, in triplicate', eyebrow: 'Project management'", 'test/previews.test.ts'],
  ];
  for (const [name, path, from, to, test] of cases) {
    const target = join(root, path);
    const original = readFileSync(target, 'utf8');
    assert.ok(original.includes(from));
    writeFileSync(target, original.replace(from, to));
    const result = spawnSync(process.execPath, ['--test', test], { cwd: root, encoding: 'utf8' });
    writeFileSync(target, original);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /AssertionError/u);
    console.log(`Caught preview ${name} revert (1 failing regression)`);
  }
} finally { rmSync(root, { recursive: true, force: true }); }

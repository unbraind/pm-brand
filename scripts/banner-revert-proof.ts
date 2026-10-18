/** Prove the collision regression rejects the generator with only its filename guard removed. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'brand-banner-proof-'));
try {
  for (const path of ['scripts', 'test']) cpSync(path, join(root, path), { recursive: true });
  cpSync('package.json', join(root, 'package.json'));
  symlinkSync(resolve('dist'), join(root, 'dist'), 'dir');
  const target = join(root, 'scripts/banners.ts');
  const original = readFileSync(target, 'utf8');
  const guard = '    if (files.has(name)) throw new Error(`Banner filename collision: ${name}`);';
  assert.ok(original.includes(guard));
  writeFileSync(target, original.replace(guard, ''));
  const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=banner filename collisions', 'test/package-banners.test.ts'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Missing expected exception/u);
  console.log('Caught collision-guard revert (1 failing regression)');
} finally { rmSync(root, { recursive: true, force: true }); }

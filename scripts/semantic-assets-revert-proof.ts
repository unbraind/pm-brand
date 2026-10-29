/** Catch independent behavioral reverts in disposable copies without modifying the package checkout. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'brand-semantic-revert-'));
try {
  for (const path of ['src', 'test', 'scripts', 'icons', 'tsconfig.json', 'package.json']) cpSync(path, join(scratch, path), { recursive: true });
  symlinkSync(resolve('node_modules'), join(scratch, 'node_modules'), 'dir');
  const probes = [
    { file: 'semantic-assets.ts', name: 'ignore paint changes', from: "a.fields[field] ?? null, b.fields[field] ?? null", to: "field === 'fill' ? null : a.fields[field] ?? null, field === 'fill' ? null : b.fields[field] ?? null", pattern: 'changed status color' },
    { file: 'semantic-assets.ts', name: 'ignore visible text', from: "if (JSON.stringify(a) !== JSON.stringify(b))", to: "if (field !== 'text' && JSON.stringify(a) !== JSON.stringify(b))", pattern: 'changed status color' },
    { file: 'static-svg.ts', name: 'ignore attribute values', from: 'fields[attr[1]] = attribute(attr[1], decode(attr[2] ?? attr[3], true));', to: "fields[attr[1]] = attr[1] === 'fill' ? '#ffffff' : attribute(attr[1], decode(attr[2] ?? attr[3], true));", pattern: 'changed status color' },
    { file: 'static-svg.ts', name: 'retain numeric spelling noise', from: "return values.join(' ');", to: 'return value;', pattern: 'attribute reordering' },
  ];
  for (const probe of probes) {
    const path = join(scratch, 'src', probe.file), original = readFileSync(path, 'utf8');
    try {
      assert.ok(original.includes(probe.from)); writeFileSync(path, original.replace(probe.from, probe.to));
      execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
      const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', `--test-name-pattern=${probe.pattern}`, 'test/semantic-assets.test.ts'], {
        cwd: scratch, encoding: 'utf8', timeout: 30000,
      });
      assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout, /AssertionError/u);
      console.log(`Caught behavioral revert: ${probe.name}`);
    } finally { writeFileSync(path, original); }
  }
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
  execFileSync(process.execPath, ['--test', '--test-concurrency=2', '--test-name-pattern=attribute reordering|changed status color', 'test/semantic-assets.test.ts'], { cwd: scratch, stdio: 'pipe' });
  console.log('4/4 behavioral reverts caught; restored implementation passes 2/2 unchanged regressions');
} finally { rmSync(scratch, { recursive: true, force: true }); }

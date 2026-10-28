/** Prove feature regressions in disposable source copies, leaving the package checkout untouched. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'brand-font-revert-'));
try {
  for (const path of ['src', 'test', 'tsconfig.json', 'package.json']) cpSync(path, join(scratch, path), { recursive: true });
  symlinkSync(resolve('node_modules'), join(scratch, 'node_modules'), 'dir');
  const original = readFileSync(join(scratch, 'src/font-coverage.ts'), 'utf8');
  const probes = [
    { name: 'ignore missing glyphs', from: '!supportsGlyph(point, label.role)', to: 'false', pattern: 'Latin, combining marks' },
    { name: 'ignore the XML rejection route', from: 'try { escapeXml(point); }', to: 'try { void point; }', pattern: 'Latin, combining marks' },
    { name: 'include passing labels by default', from: 'issues.length > 0 || request.include_all', to: 'true', pattern: 'a batch of 100 labels' },
    { name: 'drop the code point input cap', from: '[...label.text].length > MAX_TEXT_CODE_POINTS', to: 'false', pattern: 'a batch of 100 labels' },
  ];
  for (const probe of probes) {
    assert.ok(original.includes(probe.from));
    writeFileSync(join(scratch, 'src/font-coverage.ts'), original.replace(probe.from, probe.to));
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
    const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', `--test-name-pattern=${probe.pattern}`, 'test/font-coverage.test.ts'], {
      cwd: scratch, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /AssertionError/u);
    console.log(`Caught behavioral revert: ${probe.name}`);
  }
  console.log('4/4 behavioral reverts caught in disposable copies');
} finally { rmSync(scratch, { recursive: true, force: true }); }

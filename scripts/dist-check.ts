/** Verify committed compiled modules against a clean build for script-free Git consumers. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const scratch = mkdtempSync(join(tmpdir(), 'pm-brand-build-'));
try {
  execFileSync('node_modules/.bin/tsc', ['--outDir', scratch]);
  const expected = readdirSync(scratch).sort();
  assert.deepEqual(readdirSync('dist').sort(), expected, 'Missing or surplus compiled files');
  const tracked = execFileSync('git', ['ls-files', 'dist'], { encoding: 'utf8' }).trim().split('\n').map(file => file.slice(5)).sort();
  assert.deepEqual(tracked, expected, 'Compiled files must be committed for Git dependencies');
  for (const file of expected) assert.ok(readFileSync(`dist/${file}`).equals(readFileSync(join(scratch, file))), `Compiled output drift: ${file}`);
  execFileSync('git', ['diff', '--exit-code', '--', 'dist']);
  console.log(`${expected.length} committed compiled files match a clean build`);
} finally { rmSync(scratch, { recursive: true, force: true }); }

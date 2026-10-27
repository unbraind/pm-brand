/** Revert individual behaviors only in disposable copies, never in the package checkout. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'brand-accessibility-reverts-'));
const mutations = [
  { name: 'consumer measurements', file: 'accessibility.js', from: 'const ratio = contrast(pair.foreground.color, pair.background.color);',
    to: "const ratio = contrast('#000000', '#FFFFFF');", test: 'consumer fixtures' },
  { name: 'decorative classification', file: 'accessibility.js', from: "if (pair.rule === 'decorative')", to: 'if (false)', test: 'consumer fixtures' },
  { name: 'exact fault locator', file: 'accessibility.js', from: 'failures.push({ index, locator: pair.locator,', to: "failures.push({ index, locator: 'unknown',", test: 'consumer fixtures' },
  { name: 'unrounded threshold', file: 'accessibility.js', from: 'if (ratio >= minimum)', to: 'if (Math.round(ratio * 10) / 10 >= minimum)', test: 'WCAG decisions' },
  { name: 'strict dense arrays', file: 'accessibility.js', from: 'if (Reflect.ownKeys(data.pairs).length !== data.pairs.length + 1)', to: 'if (false)', test: 'one strict schema' },
  { name: 'requested output budget', file: 'accessibility-report.js', from: 'if (required <= (parsed.budget ?? 1600))', to: 'if (true)', test: 'JSON and TOON budgets' },
];
try {
  mkdirSync(join(root, 'test'));
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  cpSync('test/accessibility.test.ts', join(root, 'test/accessibility.test.ts'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  for (const mutation of mutations) {
    cpSync('dist', join(root, 'dist'), { recursive: true });
    const file = join(root, 'dist', mutation.file);
    const original = readFileSync(file, 'utf8');
    assert.ok(original.includes(mutation.from), `Mutation anchor missing: ${mutation.name}`);
    writeFileSync(file, original.replace(mutation.from, mutation.to));
    const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', `--test-name-pattern=${mutation.test}`, 'test/accessibility.test.ts'], {
      cwd: root, encoding: 'utf8', timeout: 30_000,
    });
    assert.equal(result.error, undefined, mutation.name);
    assert.equal(result.status, 1, `Regression did not catch ${mutation.name}`);
    console.log(`Caught behavioral revert: ${mutation.name}`);
  }
  console.log(`${mutations.length}/${mutations.length} behavioral reverts caught in disposable copies`);
} finally { rmSync(root, { recursive: true, force: true }); }

/** Prove round-three performance, input bounds and tag mismatch regressions independently. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const baseline = process.argv[2];
if (!baseline) throw new Error('Usage: node scripts/text-revert-proof.ts <pre-fix-ref>');
const oldSource = execFileSync('git', ['show', `${baseline}:src/text.ts`], { encoding: 'utf8' });
const oldStart = oldSource.indexOf('export function ellipsize(');
const oldEnd = oldSource.indexOf('/** Wrap whole words');
assert.ok(oldStart >= 0 && oldEnd > oldStart, 'Baseline must contain the pre-fix ellipsize function');
// Only inject the counter into the old algorithm; its measurement work stays unchanged.
const oldEllipsize = oldSource.slice(oldStart, oldEnd)
  .replace('width: number): string', 'width: number, measure = glyphAdvance): string')
  .replaceAll('role, size)', 'role, size, measure)');

const source = readFileSync('src/text.ts', 'utf8');
const start = source.indexOf('export function ellipsize(');
const end = source.indexOf('/** Wrap whole words');
const probes = [
  { name: 'old ellipsize exceeds the 513-call measurement budget', source: source.slice(0, start) + oldEllipsize + source.slice(end), pattern: 'strict glyph measurement budget', message: 'glyph measurement budget exceeded' },
  { name: 'old quadratic loop still exceeds the budget with the new input cap', source: source.slice(0, start) + oldEllipsize.replace('  escapeXml(text);', '  text = boundText(text);\n  escapeXml(text);') + source.slice(end), pattern: 'strict glyph measurement budget', message: 'glyph measurement budget exceeded' },
  { name: 'removing the input cap fails the exact and one-over boundary regression', source: source.replace('  const points: string[] = [];', '  return text;\n  const points: string[] = [];'), pattern: 'input cap retains', message: 'AssertionError' },
];
try {
  for (const probe of probes) {
    writeFileSync('src/text.ts', probe.source);
    execFileSync('node_modules/.bin/tsc', [], { stdio: 'pipe' });
    const result = spawnSync(process.execPath, ['--test', `--test-name-pattern=${probe.pattern}`, 'test/text.test.ts'], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stdout.includes(probe.message), result.stdout + result.stderr);
    console.log(`Caught: ${probe.name}`);
  }
} finally {
  writeFileSync('src/text.ts', source);
  execFileSync('node_modules/.bin/tsc', [], { stdio: 'pipe' });
}

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
const tagCheck = '[[ "$existing" == "$VERIFIED_COMMIT" ]]';
assert.ok(workflow.includes(tagCheck));
try {
  writeFileSync('.github/workflows/release.yml', workflow.replace(tagCheck, 'true'));
  const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=tag step refuses', 'test/workflows.test.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.stdout.includes('AssertionError'), result.stdout + result.stderr);
  console.log('Caught: removing existing-tag mismatch refusal');
} finally {
  writeFileSync('.github/workflows/release.yml', workflow);
}
console.log('4/4 behavioral regressions caught; sources and compiled modules restored');

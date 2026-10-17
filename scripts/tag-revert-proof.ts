/** Prove annotated-tag peeling, commit-only targets and bounded traversal independently. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const baseline = process.argv[2];
if (!baseline) throw new Error('Usage: node scripts/tag-revert-proof.ts <pre-fix-ref>');
const path = '.github/workflows/release.yml';
const workflow = readFileSync(path, 'utf8');
const oldWorkflow = execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' });
const marker = '      - name: Tag tested commit and create release';
assert.ok(workflow.includes(marker) && oldWorkflow.includes(marker));
const loopStart = workflow.indexOf('            for ((depth = 0;');
const loopEnd = workflow.indexOf('            done\n', loopStart) + '            done\n'.length;
assert.ok(loopStart >= 0 && loopEnd > loopStart);
const typeGuard = '"$existing_type" != commit || -z "$existing"';
assert.ok(workflow.includes(typeGuard) && workflow.includes('depth < 16'));
const probes = [
  { name: 'pre-fix tag step refuses a matching annotated tag', source: workflow.slice(0, workflow.indexOf(marker)) + oldWorkflow.slice(oldWorkflow.indexOf(marker)), pattern: ': annotated tag$' },
  { name: 'removing only tag peeling refuses a matching nested tag', source: workflow.slice(0, loopStart) + workflow.slice(loopEnd), pattern: ': nested annotated tag$' },
  { name: 'removing only the type guard accepts a non-commit target', source: workflow.replace(typeGuard, '-z "$existing"'), pattern: ': tree target$' },
  { name: 'allowing a seventeenth tag violates the traversal bound', source: workflow.replace('depth < 16', 'depth < 17'), pattern: ': 17 annotated tags$' },
];
try {
  for (const probe of probes) {
    assert.notEqual(probe.source, workflow);
    writeFileSync(path, probe.source);
    const result = spawnSync(process.execPath, ['--test', `--test-name-pattern=${probe.pattern}`, 'test/workflows.test.ts'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /AssertionError/u);
    console.log(`Caught: ${probe.name}`);
  }
} finally {
  writeFileSync(path, workflow);
}
console.log('4/4 behavioral regressions caught; workflow restored');

/** Exercise the held workflow's tag step without publishing or calling GitHub. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tagCases = [
  { name: 'absent tag', hasTag: false, depth: 0, type: 'commit', commit: 'tested', accepts: true },
  { name: 'lightweight tag', depth: 0, type: 'commit', commit: 'tested', accepts: true },
  { name: 'mismatching lightweight tag', depth: 0, type: 'commit', commit: 'different', accepts: false },
  { name: 'annotated tag', depth: 1, type: 'commit', commit: 'tested', accepts: true },
  { name: 'mismatching annotated tag', depth: 1, type: 'commit', commit: 'different', accepts: false },
  { name: 'nested annotated tag', depth: 2, type: 'commit', commit: 'tested', accepts: true },
  { name: 'mismatching nested annotated tag', depth: 2, type: 'commit', commit: 'different', accepts: false },
  { name: '16 annotated tags', depth: 16, type: 'commit', commit: 'tested', accepts: true },
  { name: '17 annotated tags', depth: 17, type: 'commit', commit: 'tested', accepts: false },
  { name: 'cyclic tag', depth: 1, cycle: true, type: 'commit', commit: 'tested', accepts: false },
  { name: 'tree target', depth: 0, type: 'tree', commit: 'tested', accepts: false },
  { name: 'blob target', depth: 0, type: 'blob', commit: 'tested', accepts: false },
  { name: 'annotated tree target', depth: 1, type: 'tree', commit: 'tested', accepts: false },
  { name: 'nested annotated blob target', depth: 2, type: 'blob', commit: 'tested', accepts: false },
  { name: 'unknown target type', depth: 1, type: 'unknown', commit: 'tested', accepts: false },
  { name: 'missing commit SHA', depth: 1, type: 'commit', commit: '', accepts: false },
  { name: 'failed tag lookup', depth: 1, lookupFails: true, type: 'commit', commit: 'tested', accepts: false },
];

for (const fixture of tagCases) {
  test(`tag step refuses unsafe refs and accepts verified commits: ${fixture.name}`, () => {
    const source = readFileSync('.github/workflows/release.yml', 'utf8');
    const step = source.split('      - name: Tag tested commit and create release')[1];
    const script = step.split('        run: |\n')[1].replace(/^          /gmu, '');
    const directory = mkdtempSync(join(tmpdir(), 'brand-workflow-'));
    const calls = join(directory, 'calls');
    const stub = `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" >> "$GH_CALLS"
case "$*" in
  *git/ref/heads/main*) echo "$MAIN_TIP"; exit 0 ;;
  *git/ref/tags/*)
    [[ "$HAS_TAG" == yes ]] || exit 1
    type="$TAG_TYPE"; sha="$TAG_COMMIT"
    if (( TAG_DEPTH > 0 )); then type=tag; sha=tag-1; fi ;;
  *git/tags/tag-*)
    [[ "$LOOKUP_FAILS" == no ]] || exit 1
    level="\${2##*/tag-}"
    if [[ "$CYCLE" == yes ]]; then type=tag; sha=tag-1
    elif (( level < TAG_DEPTH )); then type=tag; sha="tag-$((level + 1))"
    else type="$TAG_TYPE"; sha="$TAG_COMMIT"; fi ;;
  *--method*POST*) echo TAG_CREATED; exit 0 ;;
  *releases/tags/*) exit 1 ;;
  release*) echo RELEASE_CREATED; exit 0 ;;
  *) exit 2 ;;
esac
case "\${4-}" in
  .object.sha) printf '%s\\n' "$sha" ;;
  '.object | [.type, .sha] | @tsv') printf '%s\\t%s\\n' "$type" "$sha" ;;
  *) exit 2 ;;
esac
`;
    try {
      writeFileSync(join(directory, 'gh'), stub, { mode: 0o755 });
      for (const tip of ['tested', 'advanced']) {
        writeFileSync(calls, '');
        const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script], {
          encoding: 'utf8', timeout: 5000,
          env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, GH_CALLS: calls,
            MAIN_TIP: tip, HAS_TAG: fixture.hasTag === false ? 'no' : 'yes',
            TAG_DEPTH: String(fixture.depth), TAG_TYPE: fixture.type, TAG_COMMIT: fixture.commit,
            CYCLE: fixture.cycle ? 'yes' : 'no', LOOKUP_FAILS: fixture.lookupFails ? 'yes' : 'no',
            VERIFIED_COMMIT: 'tested', VERSION: '2026.10.17', GITHUB_REPOSITORY: 'example/brand' },
        });
        const refuses = tip === 'advanced' || !fixture.accepts;
        assert.equal(result.error, undefined);
        assert.equal(result.status, refuses ? 1 : 0, `${fixture.name}: ${result.stderr}`);
        if (tip === 'advanced') assert.match(result.stderr, /Main advanced after publication; refusing tag\/release/u);
        const requests = readFileSync(calls, 'utf8');
        const lookups = requests.match(/git\/tags\/tag-/gu)?.length ?? 0;
        assert.equal(lookups, tip === 'advanced' ? 0 : fixture.cycle ? 16 : Math.min(fixture.depth, 16));
        if (refuses) {
          assert.doesNotMatch(result.stdout, /TAG_CREATED|RELEASE_CREATED/u);
          assert.doesNotMatch(requests, /--method POST|releases\/tags|release create/u);
        } else {
          assert.match(result.stdout, /RELEASE_CREATED/u);
          assert.equal(result.stdout.includes('TAG_CREATED'), fixture.hasTag === false);
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

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


test('daily release decision skips unchanged source and avoids bootstrap version collisions', () => {
  const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
  const step = workflow.split('      - name: Decide daily release\n')[1].split('      - run: npm ci\n')[0];
  const script = step.split('        run: |\n')[1].replace(/^          /gmu, '');
  for (const fixture of [
    { latest: '', unchanged: false, existing: '', expected: '2026.10.26' },
    { latest: 'v2026.10.25', unchanged: true, existing: '', expected: undefined },
    { latest: 'v2026.10.25', unchanged: false, existing: '2026.10.26', expected: '2026.10.26-1' },
    { latest: 'v2026.10.25', unchanged: false, existing: '2026.10.26 2026.10.26-1', expected: '2026.10.26-2' },
  ]) {
    const root = mkdtempSync(join(tmpdir(), 'brand-release-decision-'));
    try {
      writeFileSync(join(root, 'git'), `#!/bin/bash
case "$1" in
  tag) printf '%s\\n' "$LATEST" ;;
  diff) [[ "$UNCHANGED" == yes ]] ;;
  rev-parse) exit 1 ;;
  *) exit 2 ;;
esac
`, { mode: 0o755 });
      writeFileSync(join(root, 'date'), '#!/bin/bash\necho 2026.10.26\n', { mode: 0o755 });
      writeFileSync(join(root, 'npm'), `#!/bin/bash
[[ "$1" == view ]] || exit 2
version="\${2#pm-brand@}"
[[ " $EXISTING " == *" $version "* ]]
`, { mode: 0o755 });
      const output = join(root, 'output');
      const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script], {
        encoding: 'utf8', timeout: 5000,
        env: { ...process.env, PATH: `${root}:${process.env.PATH}`, GITHUB_OUTPUT: output,
          LATEST: fixture.latest, UNCHANGED: fixture.unchanged ? 'yes' : 'no', EXISTING: fixture.existing },
      });
      assert.equal(result.status, 0, result.stderr);
      const decisions = readFileSync(output, 'utf8');
      assert.match(decisions, new RegExp(`should_release=${!fixture.unchanged}`));
      if (fixture.expected !== undefined) assert.ok(decisions.includes(`version=${fixture.expected}\n`), decisions);
      else assert.doesNotMatch(decisions, /^version=/mu);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

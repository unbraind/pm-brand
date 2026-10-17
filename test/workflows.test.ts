/** Exercise the held workflow's tag step without publishing or calling GitHub. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

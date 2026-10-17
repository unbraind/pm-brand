/** Exercise the held workflow's tag step without publishing or calling GitHub. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('tag step refuses advanced main tips and existing tags pointing to another commit', () => {
  const source = readFileSync('.github/workflows/release.yml', 'utf8');
  const step = source.split('      - name: Tag tested commit and create release')[1];
  const script = step.split('        run: |\n')[1].replace(/^          /gmu, '');
  const stub = `
gh() {
  case "$*" in
    *git/ref/heads/main*) echo "$MAIN_TIP" ;;
    *git/ref/tags/*) if [[ "$HAS_TAG" == yes ]]; then echo "$TAG_COMMIT"; else return 1; fi ;;
    *--method*POST*) echo TAG_CREATED ;;
    *releases/tags/*) return 1 ;;
    release*) echo RELEASE_CREATED ;;
    *) return 2 ;;
  esac
}
`;
  const cases = [
    { hasTag: 'no', tagCommit: 'tested' },
    { hasTag: 'yes', tagCommit: 'tested' },
    { hasTag: 'yes', tagCommit: 'different' },
  ];
  for (const { hasTag, tagCommit } of cases) {
    for (const tip of ['tested', 'advanced']) {
      const result = spawnSync('bash', ['-c', stub + script], {
        encoding: 'utf8', env: { ...process.env, MAIN_TIP: tip, HAS_TAG: hasTag, TAG_COMMIT: tagCommit, VERIFIED_COMMIT: 'tested', VERSION: '2026.10.17', GITHUB_REPOSITORY: 'example/brand' },
      });
      const refuses = tip === 'advanced' || tagCommit === 'different';
      assert.equal(result.status, refuses ? 1 : 0, result.stderr);
      if (tip === 'advanced') assert.match(result.stderr, /Main advanced after publication; refusing tag\/release/u);
      if (refuses) {
        assert.doesNotMatch(result.stdout, /TAG_CREATED|RELEASE_CREATED/u);
      } else {
        assert.match(result.stdout, /RELEASE_CREATED/u);
        assert.equal(result.stdout.includes('TAG_CREATED'), hasTag === 'no');
      }
    }
  }
});

test('revert proof fails clearly before mutation when its baseline is absent', () => {
  for (const args of [[], ['refs/heads/synthetic-unavailable-baseline']]) {
    const result = spawnSync(process.execPath, ['scripts/revert-proof.ts', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, args.length === 0 ? /Usage: node scripts\/revert-proof.ts <baseline-ref>/u : /Mark baseline unavailable:.*Fetch the baseline history/u);
    assert.doesNotMatch(result.stdout, /Caught/u);
  }
});

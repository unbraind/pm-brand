/** Exercise the same tarball through local, global and runner installs without touching operator installations. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { decode } from '@toon-format/toon';
import { packageManagerEnv } from './environment.ts';
import { packedSemanticReviewCases, renderedColorReviewRequest } from './semantic-review-fixtures.ts';
import type { SemanticReviewCase } from './semantic-review-fixtures.ts';

/** Assert diagnostic behavior and exact complete counts through both supported wire encodings. */
function checkCommand(command: string, prefix: string[], cwd: string, childEnv: NodeJS.ProcessEnv, fixture: string, fontFixture: string, semanticFixture: string, reviewFixtures: readonly { file: string; expected: SemanticReviewCase['expected'] }[], colorFixture: string): void {
  for (const format of ['json', 'toon']) {
    const result = spawnSync(command, [...prefix, 'diagnose', fixture, '--format', format, '--budget', '512'], {
      cwd, env: childEnv, encoding: 'utf8', timeout: 180_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stderr);
    const report = format === 'json' ? JSON.parse(result.stdout) as Record<string, unknown> : decode(result.stdout);
    assert.ok(report && typeof report === 'object' && !Array.isArray(report));
    const data = report as Record<string, unknown>;
    assert.equal(data.ok, true);
    assert.deepEqual(data.summary, { total: 3, evaluated: 2, decorative: 1, failed: 2, text_failed: 1, focus_failed: 1 });
    assert.equal((data.failures as unknown[]).length, 2);
    const fonts = spawnSync(command, [...prefix, 'font-coverage', fontFixture, '--format', format, '--budget', '512'], {
      cwd, env: childEnv, encoding: 'utf8', timeout: 180_000,
    });
    assert.equal(fonts.error, undefined);
    assert.equal(fonts.status, 1, fonts.stderr);
    const coverage = (format === 'json' ? JSON.parse(fonts.stdout) : decode(fonts.stdout)) as Record<string, unknown>;
    assert.equal(coverage.ok, true);
    assert.deepEqual(coverage.summary, { labels: 4, failed: 3, code_points: 19, supported: 14, unsupported: 5, invalid: 0 });
    assert.equal((coverage.labels as unknown[]).length, 3);
    const semantic = spawnSync(command, [...prefix, 'semantic-diff', semanticFixture, '--format', format, '--budget', '512'], {
      cwd, env: childEnv, encoding: 'utf8', timeout: 180_000,
    });
    assert.equal(semantic.error, undefined);
    assert.equal(semantic.status, 1, semantic.stderr);
    const changes = (format === 'json' ? JSON.parse(semantic.stdout) : decode(semantic.stdout)) as Record<string, unknown>;
    assert.equal(changes.ok, true);
    assert.deepEqual(changes.summary, { before_nodes: 3, after_nodes: 3, changes: 2 });
    assert.equal((changes.findings as unknown[]).length, 2);
    for (const row of reviewFixtures) {
      const review = spawnSync(command, [...prefix, 'semantic-diff', row.file, '--format', format, '--budget', '1000000'], {
        cwd, env: childEnv, encoding: 'utf8', timeout: 180_000,
      });
      assert.equal(review.error, undefined);
      assert.equal(review.status, row.expected === 'unsupported_svg' ? 2 : row.expected === 'unchanged' ? 0 : 1, review.stderr);
      const value = (format === 'json' ? JSON.parse(review.stdout) : decode(review.stdout)) as Record<string, unknown>;
      if (row.expected === 'unsupported_svg') { assert.equal(value.ok, false); assert.equal(value.code, 'unsupported_svg'); }
      else {
        assert.equal(value.ok, true);
        const findings = value.findings as { field: string }[];
        if (row.expected === 'unchanged') assert.equal(findings.length, 0);
        else assert.ok(findings.some(finding => finding.field === row.expected));
      }
    }
    const color = spawnSync(command, [...prefix, 'diagnose', colorFixture, '--format', format], { cwd, env: childEnv, encoding: 'utf8', timeout: 180_000 });
    assert.equal(color.error, undefined); assert.equal(color.status, 2, color.stderr); assert.equal(JSON.parse(color.stdout).code, 'invalid_color');
  }
}

/** Install and run the captured artifact in every supported CLI acquisition mode. */
export function acceptAccessibilityInstalls(tarball: string, scratch: string): void {
  const childEnv = { ...packageManagerEnv(), GIT_CEILING_DIRECTORIES: scratch };
  const fixture = join(scratch, 'components.json');
  writeFileSync(fixture, readFileSync('examples/accessibility.json'));
  const fontFixture = join(scratch, 'font-coverage.json');
  writeFileSync(fontFixture, readFileSync('examples/font-coverage.json'));
  const semanticFixture = join(scratch, 'semantic-assets.json');
  writeFileSync(semanticFixture, readFileSync('examples/semantic-assets.json'));
  const reviewFixtures = packedSemanticReviewCases().map(row => {
    const file = join(scratch, `${row.name}.json`);
    writeFileSync(file, JSON.stringify(row.request));
    return { file, expected: row.expected };
  });
  const colorFixture = join(scratch, 'color-review.json');
  writeFileSync(colorFixture, JSON.stringify(renderedColorReviewRequest()));
  const artifact = resolve(tarball);
  const digest = createHash('sha256').update(readFileSync(artifact)).digest('hex');
  for (const installer of ['npm', 'bun']) {
    const root = join(scratch, installer);
    const cli = join(root, 'node_modules/.bin/pm-brand');
    checkCommand(process.execPath, [cli], root, childEnv, fixture, fontFixture, semanticFixture, reviewFixtures, colorFixture);
    console.log(`Packed CLI ${installer} project-local: 2/2 formats passed`);
  }
  const npmRoot = join(scratch, 'npm-global');
  const npmInstall = spawnSync('npm', ['install', '--global', '--prefix', npmRoot, '--ignore-scripts', '--no-audit', '--no-fund', artifact, '@unbrained/pm-cli@2026.10.23'], {
    cwd: scratch, env: childEnv, encoding: 'utf8', timeout: 180_000,
  });
  assert.equal(npmInstall.status, 0, npmInstall.stderr);
  // Invoke the real global symlinks, including the globally installed host SDK.
  checkCommand(process.execPath, [join(npmRoot, 'bin/pm-brand')], scratch, childEnv, fixture, fontFixture, semanticFixture, reviewFixtures, colorFixture);
  const pm = spawnSync(process.execPath, [join(npmRoot, 'bin/pm'), '--version'], { cwd: scratch, env: childEnv, encoding: 'utf8' });
  assert.equal(pm.status, 0, pm.stderr);
  assert.match(pm.stdout, /2026\.10\.23/u);
  console.log('Packed CLI npm global: 2/2 formats passed');

  const bunRoot = join(scratch, 'bun-global');
  mkdirSync(bunRoot);
  const bunBin = join(bunRoot, 'bin');
  const bunPackages = join(bunRoot, 'install/global');
  mkdirSync(bunPackages, { recursive: true });
  writeFileSync(join(bunPackages, 'package.json'), '{"private":true}');
  const bunEnv = { ...childEnv, BUN_INSTALL: bunRoot, BUN_INSTALL_CACHE_DIR: join(bunRoot, 'cache') };
  const binProbe = spawnSync('bun', ['pm', 'bin', '--global'], { cwd: bunRoot, env: bunEnv, encoding: 'utf8' });
  assert.equal(binProbe.status, 0, binProbe.stderr);
  assert.equal(binProbe.stdout.trim(), bunBin, 'Verify isolated Bun global destination before installing');
  const bunInstall = spawnSync('bun', ['add', '--global', '--ignore-scripts', artifact], { cwd: bunRoot, env: bunEnv, encoding: 'utf8', timeout: 180_000 });
  assert.equal(bunInstall.status, 0, bunInstall.stderr);
  checkCommand(process.execPath, [join(bunBin, 'pm-brand')], bunRoot, bunEnv, fixture, fontFixture, semanticFixture, reviewFixtures, colorFixture);
  console.log('Packed CLI bun global: 2/2 formats passed');

  const runnerRoot = join(scratch, 'runners');
  mkdirSync(runnerRoot);
  const runnerEnv = { ...childEnv, npm_config_cache: join(runnerRoot, 'npm-cache'), NPM_CONFIG_CACHE: join(runnerRoot, 'npm-cache'),
    BUN_INSTALL: join(runnerRoot, 'bun'), BUN_INSTALL_CACHE_DIR: join(runnerRoot, 'bun-cache') };
  checkCommand('npx', ['--yes', '--package', artifact, '--', 'pm-brand'], runnerRoot, runnerEnv, fixture, fontFixture, semanticFixture, reviewFixtures, colorFixture);
  console.log('Packed CLI npx: 2/2 formats passed');
  checkCommand('bun', ['x', '--package', artifact, 'pm-brand'], runnerRoot, runnerEnv, fixture, fontFixture, semanticFixture, reviewFixtures, colorFixture);
  console.log('Packed CLI bunx: 2/2 formats passed');
  assert.equal(createHash('sha256').update(readFileSync(artifact)).digest('hex'), digest, 'Every mode consumed the captured artifact');
  console.log(`Packed CLI 6 install modes, 204/204 command-format scenarios (168 semantic comparisons, including 156 review regressions; 12 color refusals); sha256 ${digest}`);
}

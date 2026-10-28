/** Exercise the same tarball through local, global and runner installs without touching operator installations. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { decode } from '@toon-format/toon';
import { packageManagerEnv } from './environment.ts';

/** Assert diagnostic behavior and exact complete counts through both supported wire encodings. */
function checkCommand(command: string, prefix: string[], cwd: string, childEnv: NodeJS.ProcessEnv, fixture: string, fontFixture: string): void {
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
  }
}

/** Install and run the captured artifact in every supported CLI acquisition mode. */
export function acceptAccessibilityInstalls(tarball: string, scratch: string): void {
  const childEnv = { ...packageManagerEnv(), GIT_CEILING_DIRECTORIES: scratch };
  const fixture = join(scratch, 'components.json');
  writeFileSync(fixture, readFileSync('examples/accessibility.json'));
  const fontFixture = join(scratch, 'font-coverage.json');
  writeFileSync(fontFixture, readFileSync('examples/font-coverage.json'));
  const artifact = resolve(tarball);
  const digest = createHash('sha256').update(readFileSync(artifact)).digest('hex');
  for (const installer of ['npm', 'bun']) {
    const root = join(scratch, installer);
    const cli = join(root, 'node_modules/.bin/pm-brand');
    checkCommand(process.execPath, [cli], root, childEnv, fixture, fontFixture);
    console.log(`Packed CLI ${installer} project-local: 2/2 formats passed`);
  }
  const npmRoot = join(scratch, 'npm-global');
  const npmInstall = spawnSync('npm', ['install', '--global', '--prefix', npmRoot, '--ignore-scripts', '--no-audit', '--no-fund', artifact, '@unbrained/pm-cli@2026.10.23'], {
    cwd: scratch, env: childEnv, encoding: 'utf8', timeout: 180_000,
  });
  assert.equal(npmInstall.status, 0, npmInstall.stderr);
  // Invoke the real global symlinks, including the globally installed host SDK.
  checkCommand(process.execPath, [join(npmRoot, 'bin/pm-brand')], scratch, childEnv, fixture, fontFixture);
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
  checkCommand(process.execPath, [join(bunBin, 'pm-brand')], bunRoot, bunEnv, fixture, fontFixture);
  console.log('Packed CLI bun global: 2/2 formats passed');

  const runnerRoot = join(scratch, 'runners');
  mkdirSync(runnerRoot);
  const runnerEnv = { ...childEnv, npm_config_cache: join(runnerRoot, 'npm-cache'), NPM_CONFIG_CACHE: join(runnerRoot, 'npm-cache'),
    BUN_INSTALL: join(runnerRoot, 'bun'), BUN_INSTALL_CACHE_DIR: join(runnerRoot, 'bun-cache') };
  checkCommand('npx', ['--yes', '--package', artifact, '--', 'pm-brand'], runnerRoot, runnerEnv, fixture, fontFixture);
  console.log('Packed CLI npx: 2/2 formats passed');
  checkCommand('bun', ['x', '--package', artifact, 'pm-brand'], runnerRoot, runnerEnv, fixture, fontFixture);
  console.log('Packed CLI bunx: 2/2 formats passed');
  assert.equal(createHash('sha256').update(readFileSync(artifact)).digest('hex'), digest, 'Every mode consumed the captured artifact');
  console.log(`Packed CLI 6 install modes, 24/24 command-format scenarios (12 font coverage); sha256 ${digest}`);
}

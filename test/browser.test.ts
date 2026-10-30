/** Additive compatibility with main is the contract; main's existing browser limitations are not removed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as root from 'pm-brand';
import { renderFontCoverageReport as fontReport } from 'pm-brand/font-coverage';
import { compareSemanticAssets } from 'pm-brand/svg-compare';
import { renderFontCoverageReport as aliasReport } from 'pm-brand/font-coverage-report';
import * as sdk from '@unbrained/pm-cli/sdk';
import { assertBrowserEntryPoints, mainBaseline } from '../scripts/browser-acceptance.ts';
import { mainApiBaseline, recordedApiBaseline } from '../scripts/main-api-baseline.ts';
import { assertBrowserCompatibility, assertPublicApiCompatibility, inventoryPublicApi } from '../scripts/public-api-compatibility.ts';

let liveMain: ReturnType<typeof mainApiBaseline> | undefined;
/** Current main, regenerated once per test file. */
const liveMainBaseline = () => liveMain ??= mainApiBaseline();

test('main baseline regenerates from its recorded main commit and every existing API signature is preserved', async () => {
  // The fixture records an ancestor of main, so a later merge cannot turn main red before the fixture is refreshed.
  execFileSync('git', ['merge-base', '--is-ancestor', mainBaseline.source_ref, 'origin/main']);
  assert.deepEqual(JSON.parse(JSON.stringify(await recordedApiBaseline(mainBaseline.source_ref))), mainBaseline);
  assertPublicApiCompatibility(process.cwd(), mainBaseline);
  // Current main is the live contract, so APIs merged after the recorded commit are preserved too.
  assertPublicApiCompatibility(process.cwd(), await liveMainBaseline());
  // The branch inventories like main will after merge, so an entry without a runtime condition fails here.
  assert.equal((await inventoryPublicApi(process.cwd(), 'branch')).source_ref, 'branch');
});

test('an unloadable recorded baseline names the commit and the fixture refresh', async () => {
  await assert.rejects(recordedApiBaseline('0'.repeat(40)), /Recorded API baseline 0{40} cannot be regenerated .*node scripts\/main-api-baseline\.ts/s);
});

test('root browser graph gains no Node edge or dependency relative to main', async () => {
  await assertBrowserEntryPoints(process.cwd(), await liveMainBaseline());
  const consumer = mkdtempSync(join(tmpdir(), 'brand-api-consumer-'));
  try {
    writeFileSync(join(consumer, 'package.json'), '{\"private\":true,\"type\":\"module\"}');
    mkdirSync(join(consumer, 'node_modules'));
    symlinkSync(process.cwd(), join(consumer, 'node_modules/pm-brand'), 'dir');
    await assertBrowserEntryPoints(consumer, await liveMainBaseline());
  } finally { rmSync(consumer, { recursive: true, force: true }); }
});

test('existing report imports retain behavior and new comparison stays off the root', async () => {
  assert.equal('compareSemanticAssets' in root, false); assert.equal('renderSemanticAssetReport' in root, false);
  assert.equal(root.renderFontCoverageReport, fontReport); assert.equal(aliasReport, fontReport);
  for (const format of ['json', 'toon'] as const) {
    const request = { version: 1, labels: [{ locator: '#title', role: 'display', text: 'Ship 🚀' }], format };
    assert.deepEqual(await root.renderFontCoverageReport(request, sdk), await fontReport(request, sdk));
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  assert.equal(compareSemanticAssets({ version: 1, before: svg, after: svg }).summary?.changes, 0);
});

test('main compatibility catches removed exports and changed signatures plus new root Node imports', async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'brand-api-revert-'));
  try {
    for (const path of ['src', 'package.json', 'tsconfig.json', 'tokens.css', 'fonts.css', 'fonts', 'logo', 'icons', 'CONTRACT.md']) cpSync(path, join(scratch, path), { recursive: true });
    symlinkSync(resolve('node_modules'), join(scratch, 'node_modules'), 'dir');
    for (const [file, from, to, kind] of [
      ['index.ts', 'preflightFontCoverage, renderFontCoverageReport', 'preflightFontCoverage', 'api'],
      ['font-coverage.ts', 'export async function renderFontCoverageReport', 'async function renderFontCoverageReport', 'api'],
      ['font-coverage.ts', 'renderFontCoverageReport(input: unknown', 'renderFontCoverageReport(input: number', 'api'],
      ['index.ts', '', "export { compareSemanticAssets } from './svg-compare.js';", 'browser'],
    ]) {
      const path = join(scratch, 'src', file), original = readFileSync(path, 'utf8');
      try {
        assert.ok(!from || original.includes(from));
        const signatureOnly = to.includes('input: number');
        writeFileSync(path, signatureOnly ? original : from ? original.replace(from, to) : `${original}\n${to}\n`);
        // The font subpath deletion also breaks the root re-export: remove its
        // reference in the disposable copy so the behavioral declaration gate runs.
        const indexPath = join(scratch, 'src/index.ts'), index = readFileSync(indexPath, 'utf8');
        if (file === 'font-coverage.ts' && kind === 'api' && to.startsWith('async')) {
          writeFileSync(indexPath, index.replace('preflightFontCoverage, renderFontCoverageReport', 'preflightFontCoverage'));
          writeFileSync(join(scratch, 'src/font-coverage-report.ts'), "export {};\n");
          writeFileSync(join(scratch, 'src/cli.ts'), "export {};\n");
        }
        try {
          execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
          if (signatureOnly) {
            const declaration = join(scratch, 'dist/font-coverage.d.ts');
            writeFileSync(declaration, readFileSync(declaration, 'utf8').replace('renderFontCoverageReport(input: unknown', 'renderFontCoverageReport(input: number'));
          }
          if (kind === 'api') assert.throws(() => assertPublicApiCompatibility(scratch, mainBaseline), /Removed export|changed type signature|Changed main declaration/u);
          else await assert.rejects(assertBrowserCompatibility(scratch, mainBaseline), /New browser/u);
        } finally {
          if (file === 'font-coverage.ts') {
            writeFileSync(indexPath, readFileSync('src/index.ts'));
            for (const extra of ['font-coverage-report.ts', 'cli.ts']) writeFileSync(join(scratch, 'src', extra), readFileSync(join('src', extra)));
          }
        }
      } finally { writeFileSync(path, original); }
    }
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
    assertPublicApiCompatibility(scratch, mainBaseline); await assertBrowserCompatibility(scratch, mainBaseline);
    console.log('Main compatibility: 4/4 behavioral reverts caught; restored API signatures and browser graph pass');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

/** The package browser boundary must hold before and after packing, even for unused root exports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as root from 'pm-brand';
import { compareSemanticAssets } from 'pm-brand/svg-compare';
import { compareSemanticAssets as legacyCompare } from 'pm-brand/semantic-assets';
import { renderFontCoverageReport } from 'pm-brand/font-coverage-report';
import * as sdk from '@unbrained/pm-cli/sdk';
import { assertBrowserEntryPoints } from '../scripts/browser-acceptance.ts';

test('browser bundles root tokens and all pure subpaths without Node dependencies or globals', async () => {
  await assertBrowserEntryPoints(process.cwd());
});

test('Node-only comparison and reports retain their typed runtime behavior outside the root', async () => {
  assert.equal('compareSemanticAssets' in root, false);
  assert.equal('renderSemanticAssetReport' in root, false);
  assert.equal('renderFontCoverageReport' in root, false);
  assert.equal(typeof root.preflightFontCoverage, 'function');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  assert.deepEqual(compareSemanticAssets({ version: 1, before: svg, after: svg }), legacyCompare({ version: 1, before: svg, after: svg }));
  assert.equal(compareSemanticAssets({ version: 1, before: svg, after: svg }).summary?.changes, 0);
  assert.equal((await renderFontCoverageReport({ version: 1, labels: [] }, sdk)).result.ok, true);
});

test('browser boundary catches reverted native and SDK exports across root and pure subpaths', async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'brand-browser-revert-'));
  try {
    for (const path of ['src', 'package.json', 'tsconfig.json', 'tokens.css', 'fonts.css', 'fonts']) cpSync(path, join(scratch, path), { recursive: true });
    symlinkSync(resolve('node_modules'), join(scratch, 'node_modules'), 'dir');
    for (const [file, added] of [
      ['index.ts', "export { compareSemanticAssets } from './semantic-assets.js';"],
      ['index.ts', "export { renderFontCoverageReport } from './font-coverage-report.js';"],
      ['banner.ts', "export { renderPng } from './og.js';"],
    ]) {
      const path = join(scratch, 'src', file), original = readFileSync(path, 'utf8');
      try {
        writeFileSync(path, `${original}\n${added}\n`);
        execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
        await assert.rejects(assertBrowserEntryPoints(scratch), /node:|Could not resolve/u);
      } finally { writeFileSync(path, original); }
    }
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
    await assertBrowserEntryPoints(scratch);
    console.log('Browser boundary: 3/3 behavioral reverts caught; restored 8 browser bundles and 5 Node-only refusals pass');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

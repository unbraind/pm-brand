/** Compare the existing browser limitations with main and keep truly pure subpaths browser-compatible. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { assertBrowserCompatibility, assertPublicApiCompatibility } from './public-api-compatibility.ts';
import type { PublicApiBaseline } from './public-api-compatibility.ts';

/** Recorded contract is generated and independently regenerated from origin/main by source tests. */
export const mainBaseline: PublicApiBaseline = JSON.parse(readFileSync(new URL('../test/fixtures/public-api-main.json', import.meta.url), 'utf8'));

/** Preserve main's API and browser graph for source, npm/Bun tarballs and non-git Git consumers alike. */
export async function assertBrowserEntryPoints(root: string): Promise<void> {
  assertPublicApiCompatibility(root, mainBaseline);
  await assertBrowserCompatibility(root, mainBaseline);
  for (const name of ['pm-brand/banner', 'pm-brand/contrast', 'pm-brand/accessibility']) {
    const result = await build({ absWorkingDir: root, stdin: { contents: `import * as api from '${name}'; globalThis.brand = api;`, resolveDir: root }, bundle: true,
      platform: 'browser', format: 'iife', write: false, metafile: true, logLevel: 'silent', treeShaking: false });
    for (const [path, input] of Object.entries(result.metafile.inputs)) {
      assert.doesNotMatch(path, /node:|@unbrained\/pm-cli|@resvg|\.node$/u, name);
      assert.equal(input.imports.some(entry => entry.external), false, name);
    }
    const context: { brand?: unknown } = {};
    runInNewContext(result.outputFiles[0].text, context, { timeout: 10000 }); assert.ok(context.brand, name);
  }
  for (const entry of ['pm-brand/tokens.css', 'pm-brand/fonts.css']) {
    const result = await build({ absWorkingDir: root, stdin: { contents: `@import '${entry}';`, resolveDir: root, loader: 'css' },
      loader: { '.woff2': 'dataurl' }, bundle: true, platform: 'browser', write: false, logLevel: 'silent' });
    assert.ok(result.outputFiles[0].text.includes('--pm-') || result.outputFiles[0].text.includes('@font-face'));
  }
  for (const entry of ['pm-brand/svg-compare', 'pm-brand/semantic-assets', 'pm-brand/font-coverage-report']) {
    await assert.rejects(build({ absWorkingDir: root, stdin: { contents: `import * as api from '${entry}'; globalThis.brand = api;`, resolveDir: root },
      bundle: true, platform: 'browser', write: false, logLevel: 'silent' }), /not exported|Could not resolve/u);
  }
}

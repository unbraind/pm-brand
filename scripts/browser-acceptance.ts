/** Exercise public browser entry points without externals, Node shims or dependency aliases. */
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

/** Resolve the installed package from the consumer, bundle it for browsers and execute its module initializers. */
export async function assertBrowserEntryPoints(root: string): Promise<void> {
  const entries = [
    ['root-tokens', "import { tokens } from 'pm-brand'; globalThis.brand = tokens;"],
    ...['pm-brand', 'pm-brand/banner', 'pm-brand/contrast', 'pm-brand/accessibility', 'pm-brand/font-coverage']
      .map(entry => [entry, `import * as api from '${entry}'; globalThis.brand = api;`]),
  ];
  for (const [name, contents] of entries) {
    const result = await build({ absWorkingDir: root, stdin: { contents, resolveDir: root }, bundle: true,
      platform: 'browser', format: 'iife', write: false, metafile: true, logLevel: 'silent', treeShaking: false });
    for (const [path, input] of Object.entries(result.metafile.inputs)) {
      assert.doesNotMatch(path, /node:|@unbrained\/pm-cli|@resvg|\.node$/u, name);
      assert.equal(input.imports.some(entry => entry.external), false, name);
    }
    const context: { brand?: unknown } = {};
    runInNewContext(result.outputFiles[0].text, context, { timeout: 10000 });
    assert.ok(context.brand, name);
  }
  for (const entry of ['pm-brand/tokens.css', 'pm-brand/fonts.css']) {
    const result = await build({ absWorkingDir: root, stdin: { contents: `@import '${entry}';`, resolveDir: root, loader: 'css' },
      loader: { '.woff2': 'dataurl' }, bundle: true, platform: 'browser', write: false, logLevel: 'silent' });
    assert.ok(result.outputFiles[0].text.includes('--pm-') || result.outputFiles[0].text.includes('@font-face'));
  }
  for (const entry of ['pm-brand/svg-compare', 'pm-brand/semantic-assets', 'pm-brand/font-coverage-report', 'pm-brand/accessibility-report', 'pm-brand/og']) {
    await assert.rejects(build({ absWorkingDir: root, stdin: { contents: `import * as api from '${entry}'; globalThis.brand = api;`, resolveDir: root },
      bundle: true, platform: 'browser', write: false, logLevel: 'silent' }), /not exported|Could not resolve/u);
  }
}

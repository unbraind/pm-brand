/** Compare every review lockup PNG to its fixed-theme SVG on matching paper. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { tokenColor } from '../dist/contrast.js';

test('review previews render all 24 fixed lockups on the correct theme paper', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'pm-brand-previews-'));
  try {
    symlinkSync(resolve('logo'), join(scratch, 'logo'), 'dir');
    execFileSync(process.execPath, [resolve('scripts/previews.ts')], { cwd: scratch });
    const output = join(scratch, '.cache/previews');
    assert.equal(readdirSync(output).filter(file => file.startsWith('lockup-')).length, 24);
    for (const product of ['pm', 'web', 'gpt', 'mcp', 'search', 'swarm']) {
      for (const family of ['lockup', 'lockup-mark']) {
        for (const theme of ['light', 'dark'] as const) {
          const name = `${family}-${product}-${theme}`;
          const paper = tokenColor(theme, 'paper');
          const source = readFileSync(`logo/${name}.svg`, 'utf8');
          const expected = new Resvg(source, { background: paper }).render();
          const actual = readFileSync(join(output, `${name}.png`));
          assert.ok(actual.equals(expected.asPng()), `${name}: fixed source and paper`);
          const png = actual.toString('base64');
          const rendered = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${expected.width}" height="${expected.height}"><image width="${expected.width}" height="${expected.height}" href="data:image/png;base64,${png}"/></svg>`).render();
          const paperBytes = [1, 3, 5].map(index => parseInt(paper.slice(index, index + 2), 16));
          assert.deepEqual([...rendered.pixels.subarray(0, 4)], [...paperBytes, 255], `${name}: opaque paper pixel`);
        }
      }
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

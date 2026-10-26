/** Verify the delivered vector/raster asset contract, including the maskable safe circle. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { contrast, tokenColor } from '../dist/contrast.js';
import { Resvg } from '@resvg/resvg-js';

test('mark variants and every product lockup use paths without font dependencies', () => {
  for (const name of ['mark', 'mark-light', 'mark-dark', 'mark-mono']) {
    const svg = readFileSync(`logo/${name}.svg`, 'utf8');
    assert.equal([...svg.replace(/<defs>.*?<\/defs>/su, '').matchAll(/<rect /g)].length, 3);
    assert.match(svg, /<path/);
    assert.doesNotMatch(svg, /<text|font-family|href=|url\((?!#)/);
  }
  assert.match(readFileSync('logo/mark-mono.svg', 'utf8'), /currentColor/);
  assert.match(readFileSync('logo/mark-dark.svg', 'utf8'), /#1C1C1C/);
  for (const product of ['pm', 'web', 'gpt', 'mcp', 'search', 'swarm']) for (const family of ['lockup', 'lockup-mark']) {
    const svg = readFileSync(`logo/${family}-${product}.svg`, 'utf8');
    assert.match(svg, /<path/);
    assert.doesNotMatch(svg, /<text|font-family/);
    assert.ok(new Resvg(svg).render().asPng().length > 100);
  }
});

test('raster icons have their declared dimensions and the maskable foreground stays in its safe circle', () => {
  for (const [name, size] of [['favicon-32', 32], ['apple-touch-icon-180', 180], ['icon-192', 192], ['icon-512', 512], ['icon-maskable-512', 512]] as const) {
    const png = readFileSync(`icons/${name}.png`);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const png = readFileSync('icons/icon-maskable-512.png').toString('base64');
  const rendered = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image width="512" height="512" href="data:image/png;base64,${png}"/></svg>`).render();
  const pixels = rendered.pixels;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    if (Math.hypot(x + .5 - 256, y + .5 - 256) <= 204.8) continue;
    const index = (y * 512 + x) * 4;
    assert.equal(pixels[index], 245);
    assert.equal(pixels[index + 1], 245);
    assert.equal(pixels[index + 2], 245);
    assert.equal(pixels[index + 3], 255);
  }
});

test('monochrome copies are occluded by the top sheet and inherit currentColor', () => {
  const svg = readFileSync('logo/mark-mono.svg', 'utf8').replace('<svg ', '<svg style="color:#116699" ');
  const pixels = new Resvg(svg, { background: '#FFFFFF' }).render().pixels;
  for (const [x, y] of [[34, 60], [54, 80]]) {
    const index = (y * 248 + x) * 4;
    assert.deepEqual([...pixels.subarray(index, index + 4)], [255, 255, 255, 255]);
  }
  const index = (40 * 248 + 14) * 4;
  assert.deepEqual([...pixels.subarray(index, index + 4)], [17, 102, 153, 255]);
});


test('adaptive SVG CSS specifies both schemes and matches each fixed geometry', () => {
  const adaptive = readdirSync('logo').filter(file => !/-(light|dark|mono)\.svg$/u.test(file));
  assert.equal(adaptive.length, 13);
  for (const file of adaptive) {
    const source = readFileSync(`logo/${file}`, 'utf8');
    const style = /<style>(.*?)<\/style>/su.exec(source)![1];
    assert.match(style, /^\.pm-brand-auto\{color:var\(--pm-carbon,#171717\)\}/u);
    assert.match(style, /@media \(prefers-color-scheme: dark\)\{\.pm-brand-auto\{color:var\(--pm-carbon,#F5F5F5\)\}/u);
    assert.match(style, /\.pm-top\{fill:var\(--pm-sheet,#FFFFFF\)\}/u);
    assert.match(style, /\.pm-top\{fill:var\(--pm-sheet,#1C1C1C\)\}/u);
    assert.match(style, /\.pm-canary\{fill:var\(--pm-copy-secondary,#505050\)\}/u);
    assert.match(style, /\.pm-rose\{fill:var\(--pm-copy-tertiary,#FF7A88\)\}/u);
    const body = source.replace(/<style>.*?<\/style>/su, '');
    assert.match(body, /fill="currentColor"/u);
    assert.doesNotMatch(body, /(?:stroke|fill)="#(?:1B2340|E7EAF3)"/u);
    // resvg does not evaluate media queries or CSS variables. Verify the style
    // contract above, then compare the fixed source to its resolved appearance.
    for (const theme of ['light', 'dark'] as const) {
      let resolved = body.replace('class="pm-brand-auto"', `style="color:${tokenColor(theme, 'carbon')}"`);
      if (theme === 'dark') resolved = resolved.replaceAll('#FFFFFF', '#1C1C1C').replaceAll('#B51F32', '#FF7A88').replaceAll('#D6D6D6', '#505050');
      const fixed = readFileSync(`logo/${file.replace('.svg', `-${theme}.svg`)}`, 'utf8');
      assert.equal(resolved, fixed, `${file}: ${theme} geometry`);
      assert.ok(new Resvg(fixed).render().asPng().length > 100);
    }
  }
});

test('every fixed SVG has visible 4.5:1 ink on paper; captions are transparent', () => {
  for (const theme of ['light', 'dark'] as const) {
    const ink = tokenColor(theme, 'carbon');
    const paper = tokenColor(theme, 'paper');
    assert.ok(contrast(ink, paper) >= 4.5);
    assert.ok(contrast(ink, tokenColor(theme, 'sheet')) >= 4.5);
    const inkBytes = [1, 3, 5].map(index => parseInt(ink.slice(index, index + 2), 16));
    const files = readdirSync('logo').filter(file => file.endsWith(`-${theme}.svg`));
    assert.equal(files.length, 13);
    for (const file of [...files, 'mark-mono.svg']) {
      let source = readFileSync(`logo/${file}`, 'utf8');
      if (file === 'mark-mono.svg') source = source.replace('<svg ', `<svg style="color:${ink}" `);
      assert.doesNotMatch(source, /<style>/u);
      const transparent = new Resvg(source).render();
      const rendered = new Resvg(source, { background: paper }).render();
      const pixels = rendered.pixels;
      let fullInkPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (inkBytes.every((value, channel) => pixels[index + channel] === value)) fullInkPixels++;
      }
      assert.ok(fullInkPixels > 100, `${file}: visible ${ink} ink on ${paper}`);
      if (file.startsWith('lockup-')) {
        const box = /<rect x="(\d+)" y="(\d+)"[^>]*fill="none" stroke="currentColor"/u.exec(source);
        if (!file.startsWith('lockup-pm-')) assert.ok(box, `${file}: transparent caption outline`);
        if (!file.startsWith('lockup-mark-')) {
          const gapX = box ? Number(box[1]) - 8 : transparent.width - 4;
          const alpha = transparent.pixels;
          for (let y = 0; y < transparent.height; y++) assert.equal(alpha[(y * transparent.width + gapX) * 4 + 3], 0, `${file}: clear wordmark spacing`);
        }
        if (box) {
          const index = ((Number(box[2]) + 8) * rendered.width + Number(box[1]) + 8) * 4;
          assert.equal(transparent.pixels[index + 3], 0, `${file}: caption interior alpha`);
        }
      }
    }
  }
});

test('compact lockups contain exactly the mark lettering and product caption', () => {
  const mark = readFileSync('logo/mark-light.svg', 'utf8');
  const markPaths = [...mark.matchAll(/<path /gu)].length;
  for (const product of ['pm', 'web', 'gpt', 'mcp', 'search', 'swarm']) {
    const source = readFileSync(`logo/lockup-mark-${product}-light.svg`, 'utf8');
    assert.equal([...source.matchAll(/<rect /gu)].length, 4);
    assert.equal([...source.matchAll(/<path /gu)].length, markPaths + product.length);
  }
});

/** Verify the delivered vector/raster asset contract, including the maskable safe circle. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

test('mark variants and every product lockup use paths without font dependencies', () => {
  for (const name of ['mark', 'mark-dark', 'mark-mono']) {
    const svg = readFileSync(`logo/${name}.svg`, 'utf8');
    assert.equal([...svg.replace(/<defs>.*?<\/defs>/su, '').matchAll(/<rect /g)].length, 3);
    assert.match(svg, /<path/);
    assert.doesNotMatch(svg, /<text|font-family|href=|url\((?!#)/);
  }
  assert.match(readFileSync('logo/mark-mono.svg', 'utf8'), /currentColor/);
  assert.match(readFileSync('logo/mark-dark.svg', 'utf8'), /#171F37/);
  for (const product of ['pm', 'web', 'gpt', 'mcp', 'search', 'swarm']) {
    const svg = readFileSync(`logo/lockup-${product}.svg`, 'utf8');
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
    assert.equal(pixels[index], 243);
    assert.equal(pixels[index + 1], 245);
    assert.equal(pixels[index + 2], 248);
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

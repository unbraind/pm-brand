/** Behavioural coverage for portable images, untrusted content and measured layout. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { banner } from '../dist/banner.js';
import { ogImage, renderPng } from '../dist/og.js';
import { escapeXml, ellipsize, wrapTitle, textWidth, textPaths } from '../dist/text.js';
import { OG_PREVIEW_COPY } from '../scripts/preview-copy.ts';

test('XML syntax is escaped and controls, noncharacters and lone surrogates are rejected', () => {
  assert.equal(escapeXml('<&"\'>'), '&lt;&amp;&quot;&apos;&gt;');
  for (const value of ['\0', '\n', '\t', '\u007f', '\u009f', '\ufffe', '\uffff', '\ud800', '\udc00']) {
    assert.throws(() => escapeXml(value), /control characters/);
    assert.throws(() => banner({ name: value, tagline: 'Safe' }));
    assert.throws(() => banner({ name: 'pm', tagline: value }));
    for (const field of ['title', 'eyebrow', 'product']) assert.throws(() => ogImage({ title: 'Safe', eyebrow: 'Safe', product: 'pm', [field]: value }));
  }
  assert.equal(escapeXml('Hello 🦉'), 'Hello 🦉');
});

test('path layout measures glyph advances, substitutes missing glyphs and preserves whitespace', () => {
  assert.equal(textWidth('', 'body', 24), 0);
  assert.ok(textWidth('pm', 'display', 64) > textWidth('p', 'display', 64));
  assert.equal(textWidth('🦉', 'body', 24), textWidth('?', 'body', 24));
  assert.match(textPaths('pm 🦉', 'display', 0, 80, 64), /<path/);
  assert.equal(textPaths('', 'body', 0, 0, 12), '');
});

test('long titles wrap at measured word boundaries and ellipsize at the last line', () => {
  assert.deepEqual(wrapTitle('  Hello   world  ', 1040, 64, 3), ['Hello world']);
  assert.deepEqual(wrapTitle('', 1040, 64, 3), ['']);
  const title = 'Context management that keeps every agent on the same page across any task and workflow';
  const lines = wrapTitle(title, 640, 64, 3);
  assert.equal(lines.length, 3);
  assert.ok(lines.at(-1)?.endsWith('…'));
  for (const line of lines) assert.ok(textWidth(line, 'display', 64) <= 640);
  assert.deepEqual(wrapTitle('X'.repeat(300), 640, 64, 3), [ellipsize('X'.repeat(300), 'display', 64, 640)]);
  assert.equal(ellipsize('Hello', 'body', 24, 300), 'Hello');
  assert.equal(ellipsize('Hello', 'body', 24, 1), '…');
  const one = wrapTitle('A short title with an additional enormouslylongword'.repeat(5), 400, 64, 1);
  assert.equal(one.length, 1);
  assert.ok(one[0].endsWith('…'));
});

test('both themes have stable, font-free SVG structure and expected PNG dimensions', () => {
  const snapshots = JSON.parse(readFileSync('test/image-snapshots.json', 'utf8')) as Record<string, string>;
  for (const theme of ['light', 'dark'] as const) {
    const variants = { banner: banner({ name: 'pm-web', tagline: 'Keep every agent on the same page.', theme }), og: ogImage({ ...OG_PREVIEW_COPY, product: 'pm-web', theme }) };
    for (const [name, svg] of Object.entries(variants)) {
      assert.equal(createHash('sha256').update(svg).digest('hex'), snapshots[`${theme}-${name}`]);
      assert.match(svg, /role="img"/);
      assert.doesNotMatch(svg, /<text|@font-face|href=|url\(/);
      const png = Buffer.from(renderPng(svg));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), name === 'banner' ? 1280 : 1200);
      assert.equal(png.readUInt32BE(20), name === 'banner' ? 320 : 630);
    }
  }
  assert.equal(banner({ name: 'pm', tagline: 'A' }), banner({ name: 'pm', tagline: 'A', theme: 'light' }));
  assert.equal(ogImage({ title: 'A', eyebrow: 'B', product: 'pm' }), ogImage({ title: 'A', eyebrow: 'B', product: 'pm', theme: 'light' }));
});

test('all dynamic fields escape XML syntax and fit long content in both themes', () => {
  const text = '<&"\'>';
  for (const theme of ['light', 'dark'] as const) {
    for (const svg of [banner({ name: text, tagline: text, theme }), ogImage({ title: text, eyebrow: text, product: text, theme }), banner({ name: 'n'.repeat(1000), tagline: 't'.repeat(1000), theme }), ogImage({ title: 'a long heading '.repeat(100), eyebrow: 'field '.repeat(100), product: 'pm-'.repeat(100), theme })]) {
      assert.ok(svg.includes('<path'));
      assert.doesNotMatch(svg, /<script/);
      assert.ok(renderPng(svg).length > 1000);
    }
    assert.ok(banner({ name: text, tagline: text, theme }).includes('&lt;&amp;&quot;&apos;&gt;'));
    assert.ok(ogImage({ title: text, eyebrow: text, product: text, theme }).includes('&lt;&amp;&quot;&apos;&gt;'));
  }
  assert.throws(() => renderPng('<invalid>'));
});

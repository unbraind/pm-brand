/** Bound untrusted image fields and prove linear, grapheme-safe truncation. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { banner } from '../dist/banner.js';
import { ogImage } from '../dist/og.js';
import { boundText, ellipsize, glyphAdvance, MAX_TEXT_CODE_POINTS, textWidth, wrapTitle } from '../dist/text.js';

test('100000-character fields obey a strict glyph measurement budget', () => {
  for (const text of ['X'.repeat(100_000), '👩‍💻'.repeat(20_000), `a${'\u0301'.repeat(100_000)}`]) {
    let calls = 0;
    const result = ellipsize(text, 'display', 64, 880, (char, role, size) => {
      assert.ok(++calls <= MAX_TEXT_CODE_POINTS + 1, 'glyph measurement budget exceeded');
      return glyphAdvance(char, role, size);
    });
    assert.ok(textWidth(result, 'display', 64) <= 880);
    assert.equal(calls, [...boundText(text)].length + (result.endsWith('…') ? 1 : 0));
  }
});

test('input cap retains only complete emoji and combining graphemes at exact and one-over boundaries', () => {
  assert.equal(boundText(''), '');
  assert.equal(boundText('x'.repeat(512)), 'x'.repeat(512));
  assert.equal(boundText('x'.repeat(513)), 'x'.repeat(512));
  for (const cluster of ['👩‍💻', 'e\u0301', '🇦🇹', '👍🏽']) {
    const points = [...cluster].length;
    const exact = 'x'.repeat(512 - points) + cluster;
    assert.equal(boundText(exact), exact);
    assert.equal(boundText(exact + 'z'), exact);
    const crossing = 'x'.repeat(513 - points);
    assert.equal(boundText(crossing + cluster + 'z'), crossing);
  }
  assert.equal(boundText(`a${'\u0301'.repeat(100_000)}`), '');
  assert.equal(boundText('👩‍'.repeat(100_000)), '');
});

test('ellipsize preserves exact fits and chooses the longest complete fitting prefix', () => {
  const measure = () => 1;
  assert.equal(ellipsize('', 'body', 24, 0, measure), '');
  assert.equal(ellipsize('abcd', 'body', 24, 4, measure), 'abcd');
  assert.equal(ellipsize('abcde', 'body', 24, 4, measure), 'abc…');
  assert.equal(ellipsize('abcde', 'body', 24, 3, measure), 'ab…');
  assert.equal(ellipsize('a xyz', 'body', 24, 3, measure), 'a…');
  assert.equal(ellipsize('abc', 'body', 24, 0, measure), '…');
  for (const cluster of ['👩‍💻', 'e\u0301']) {
    const width = [...cluster].length + 1;
    assert.equal(ellipsize(cluster + 'xyz', 'body', 24, width, measure), cluster + '…');
    assert.equal(ellipsize(cluster + 'xyz', 'body', 24, width - 1, measure), '…');
  }
  const width = textWidth('Hello', 'body', 24);
  assert.equal(ellipsize('Hello', 'body', 24, width), 'Hello');
  const fitted = ellipsize('Hello!', 'body', 24, width);
  assert.ok(fitted.endsWith('…'));
  assert.ok(textWidth(fitted, 'body', 24) <= width);
  assert.ok(textWidth(fitted.slice(0, -1) + 'o…', 'body', 24) > width);
});

test('every generator field is bounded before validation, metadata, wrapping and uppercase conversion', () => {
  const bounded = 'a'.repeat(512);
  const long = bounded + 'z'.repeat(100_000) + '\0';
  for (const field of ['name', 'tagline']) {
    const base = { name: 'pm', tagline: 'Safe' };
    assert.equal(banner({ ...base, [field]: long }), banner({ ...base, [field]: bounded }));
  }
  for (const field of ['title', 'eyebrow', 'product']) {
    const base = { title: 'Safe', eyebrow: 'Safe', product: 'pm' };
    assert.equal(ogImage({ ...base, [field]: long }), ogImage({ ...base, [field]: bounded }));
  }
  assert.deepEqual(wrapTitle(long, 1040, 64, 3), wrapTitle(bounded, 1040, 64, 3));
  const expanded = ogImage({ title: 'Safe', eyebrow: 'ß'.repeat(100_000), product: 'pm' });
  assert.equal(expanded, ogImage({ title: 'Safe', eyebrow: 'ß'.repeat(512), product: 'pm' }));
  assert.ok(expanded.includes('ß'.repeat(512)));
  for (const cluster of ['👩‍💻', 'e\u0301']) {
    const prefix = 'x'.repeat(513 - [...cluster].length);
    assert.equal(banner({ name: prefix + cluster, tagline: 'Safe' }), banner({ name: prefix, tagline: 'Safe' }));
    assert.equal(ogImage({ title: prefix + cluster, eyebrow: 'Safe', product: 'pm' }), ogImage({ title: prefix, eyebrow: 'Safe', product: 'pm' }));
  }
});

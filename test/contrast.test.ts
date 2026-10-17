/** Contract audit: text and focus must pass; chip borders are decorative. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, luminance, composite, contrast, contrastAudit, tokenColor } from '../dist/contrast.js';

test('rgba accepts integer and decimal alpha in range; percentages remain unsupported', () => {
  for (const [alpha, expected] of [['0', 0], ['.5', .5], ['0.5', .5], ['1', 1], ['1.0', 1]] as const) {
    assert.deepEqual(parseColor(`rgba(0, 0, 0, ${alpha})`), [0, 0, 0, expected], alpha);
  }
  for (const alpha of ['1.5', '-0.1', '50%']) assert.throws(() => parseColor(`rgba(0, 0, 0, ${alpha})`), TypeError, alpha);
});

test('WCAG reference values, alpha compositing and sRGB transfer curve', () => {
  assert.equal(contrast('#000000', '#FFFFFF'), 21);
  assert.equal(contrast('#FFFFFF', '#000000'), 21);
  assert.equal(contrast('#FFFFFF', '#FFFFFF'), 1);
  assert.ok(Math.abs(contrast('#FF0000', '#FFFFFF') - 3.9984767707539985) < 1e-10);
  assert.equal(luminance([0, 0, 0, 1]), 0);
  assert.equal(luminance([1, 1, 1, 1]), 1);
  assert.ok(Math.abs(luminance([.04045, .04045, .04045, 1]) - .04045 / 12.92) < 1e-15);
  assert.deepEqual(parseColor('transparent'), [0, 0, 0, 0]);
  assert.deepEqual(parseColor('rgba(255, 0, 127, .5)'), [1, 0, 127 / 255, .5]);
  assert.deepEqual(composite([1, 0, 0, .5], [0, 0, 1, 1]), [.5, 0, .5, 1]);
  assert.equal(contrast('transparent', '#FFFFFF'), 1);
  assert.ok(Math.abs(contrast('rgba(0, 0, 0, .5)', '#FFFFFF') - 3.976653024912438) < 1e-10);
  for (const invalid of ['red', '#FFF', 'rgba(256, 0, 0, 1)', 'rgba(0, 0, 0, 2)']) assert.throws(() => parseColor(invalid));
  assert.throws(() => contrast('#FFFFFF', 'transparent'), /opaque/);
});

test('all 68 contract pairs are classified; every text and focus pair passes AA', () => {
  const rows = contrastAudit();
  assert.equal(rows.length, 68);
  assert.equal(rows.filter(row => row.classification === 'text').length, 36);
  assert.equal(rows.filter(row => row.classification === 'focus').length, 4);
  assert.equal(rows.filter(row => row.classification === 'decorative').length, 28);
  for (const row of rows) {
    if (row.classification === 'decorative') {
      assert.match(row.pair, /status-.*-border \/ /);
      assert.equal(row.minimum, null);
    } else {
      assert.equal(row.minimum, row.classification === 'text' ? 4.5 : 3);
      assert.ok(row.ratio >= row.minimum!, `${row.theme} ${row.pair}: ${row.ratio}`);
    }
  }
  // These are measured decorative comparisons below a 3:1 reference, not failed gates.
  assert.equal(rows.filter(row => row.classification === 'decorative' && row.ratio < 3).length, 10);
  assert.equal(tokenColor('light', 'status-open-fg'), '#1B2340');
  assert.equal(tokenColor('dark', 'status-open-fg'), '#E7EAF3');
  for (const theme of ['light', 'dark'] as const) {
    assert.equal(tokenColor(theme, 'status-in_progress-border'), tokenColor(theme, 'canary'));
    assert.equal(tokenColor(theme, 'status-blocked-border'), tokenColor(theme, 'rose'));
    assert.equal(tokenColor(theme, 'status-canceled-border'), tokenColor(theme, 'rule'));
  }
});

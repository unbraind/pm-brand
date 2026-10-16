/** Contract audit: text/focus must pass, and only the explicit owner-decision border exceptions remain. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, luminance, composite, contrast, contrastAudit, tokenColor } from '../dist/contrast.js';

/** Existing contract failures; removing, adding or masking a failure changes this evidence. */
const expectedFailures = [
  'light:status-in_progress-border / status-in_progress-bg',
  'light:status-in_progress-border / paper',
  'light:status-in_progress-border / sheet',
  'light:status-blocked-border / status-blocked-bg',
  'light:status-blocked-border / paper',
  'light:status-blocked-border / sheet',
  'light:status-canceled-border / paper',
  'light:status-canceled-border / sheet',
  'dark:status-canceled-border / paper',
  'dark:status-canceled-border / sheet',
];

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

test('all 68 contract pairs are measured; all text and focus pairs pass AA', () => {
  const rows = contrastAudit();
  assert.equal(rows.length, 68);
  const actualFailures = rows.filter(row => row.ratio < row.minimum).map(row => `${row.theme}:${row.pair}`);
  assert.deepEqual(actualFailures, expectedFailures, 'Contract border exceptions need an owner decision; see docs/contrast.md');
  for (const row of rows) if (!expectedFailures.includes(`${row.theme}:${row.pair}`)) assert.ok(row.ratio >= row.minimum, `${row.theme} ${row.pair}: ${row.ratio}`);
  assert.equal(tokenColor('light', 'status-open-fg'), '#1B2340');
  assert.equal(tokenColor('dark', 'status-open-fg'), '#E7EAF3');
});

test('the proposed border-only changes meet 3:1 without altering base text or action colours', () => {
  for (const [proposed, wash] of [['#A28928', 'canary-wash'], ['#B96A82', 'rose-wash']] as const) {
    for (const bg of ['paper', 'sheet', wash] as const) assert.ok(contrast(proposed, tokenColor('light', bg)) >= 3);
  }
  for (const theme of ['light', 'dark'] as const) for (const bg of ['paper', 'sheet'] as const) assert.ok(contrast(tokenColor(theme, 'graphite'), tokenColor(theme, bg)) >= 3);
});

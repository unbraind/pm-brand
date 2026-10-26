/** Palette regressions: neutral/red identity, separated error semantics, readable states and complete candidate evidence. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tokens } from '../dist/tokens.js';
import { baseline, candidates, reviewAudit, reviewColor } from '../scripts/palette-candidates.ts';

test('Signal keeps neutral core surfaces and red copy/accent separate from amber errors', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const key of ['paper', 'sheet', 'carbon', 'graphite'] as const) {
      const color = tokens[theme][key];
      assert.equal(color.slice(1, 3), color.slice(3, 5), `${theme} ${key}: neutral`);
      assert.equal(color.slice(3, 5), color.slice(5, 7), `${theme} ${key}: neutral`);
    }
    const red = tokens[theme].stamp;
    assert.ok(parseInt(red.slice(1, 3), 16) > parseInt(red.slice(3, 5), 16) * 1.5);
    const error = tokens[theme].danger;
    assert.ok(parseInt(error.slice(3, 5), 16) > parseInt(error.slice(5, 7), 16) * 1.5);
    assert.notEqual(red, error);
    assert.equal(tokens[theme]['copy-tertiary'], red);
    assert.equal(tokens[theme]['status-closed-fg'], 'var(--pm-carbon)');
    assert.equal(tokens[theme]['status-blocked-border'], 'var(--pm-danger)');
  }
});

test('both complete candidates pass every contract text/focus pair and the three additional focus surfaces', () => {
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {
    const rows = reviewAudit(candidate);
    assert.equal(rows.length, 74);
    assert.equal(rows.filter(row => row.classification === 'text').length, 36);
    assert.equal(rows.filter(row => row.classification === 'focus').length, 10);
    for (const row of rows) if (row.minimum !== null) assert.ok(row.ratio >= row.minimum, `${candidate.id} ${row.theme} ${row.pair}: ${row.ratio}`);
    for (const theme of ['light', 'dark'] as const) for (const status of ['open', 'in_progress', 'blocked', 'closed', 'canceled']) {
      assert.ok(reviewColor(candidate.themes[theme], `status-${status}-fg`));
      assert.ok(reviewColor(candidate.themes[theme], `status-${status}-bg`));
      assert.ok(reviewColor(candidate.themes[theme], `status-${status}-border`));
    }
  }
});

test('legacy copy names remain working aliases; the review fixture carries status and error meaning in text', () => {
  for (const theme of ['light', 'dark'] as const) for (const [alias, semantic] of [['canary', 'copy-secondary'], ['rose', 'copy-tertiary'], ['canary-wash', 'progress-wash'], ['rose-wash', 'blocked-wash']] as const) {
    assert.equal(tokens[theme][alias], `var(--pm-${semantic})`);
    assert.equal(reviewColor(tokens[theme], alias), tokens[theme][semantic]);
  }
  const sample = readFileSync('docs/samples/app.html', 'utf8');
  for (const label of ['Open', 'In progress', 'Blocked', 'Closed', 'Canceled', 'Error: choose a file']) assert.ok(sample.includes(label));
  assert.ok(sample.includes('text-decoration: line-through'));
  assert.ok(sample.includes('outline: var(--pm-focus)'));
});

test('committed PNG matrix matches measured theme colours at every viewport and retains loaded fonts', () => {
  const receipts = JSON.parse(readFileSync('docs/palette-previews/render-receipts.json', 'utf8')) as { candidate: string; theme: 'light' | 'dark'; asset: string; width: number; file: string; sha256: string }[];
  const checks = JSON.parse(readFileSync('docs/palette-previews/browser-checks.json', 'utf8')) as { captures: { file: string; overflow: boolean; external: boolean; loadedFaces: string[]; colors: Record<string, string> }[] };
  assert.equal(receipts.length, 54);
  assert.equal(checks.captures.length, 54);
  for (const candidate of [baseline, ...candidates]) for (const theme of ['light', 'dark'] as const) for (const asset of ['app', 'banner', 'og']) for (const width of [1440, 768, 390]) {
    const receipt = receipts.find(row => row.candidate === candidate.id && row.theme === theme && row.asset === asset && row.width === width)!;
    assert.ok(receipt, `${candidate.id} ${theme} ${asset} ${width}`);
    const png = readFileSync(`docs/palette-previews/${receipt.file}`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(createHash('sha256').update(png).digest('hex'), receipt.sha256);
    const check = checks.captures.find(row => row.file === receipt.file)!;
    assert.equal(check.overflow, false);
    assert.equal(check.external, false);
    if (asset === 'app') {
      for (const key of ['paper', 'sheet', 'carbon', 'graphite', 'stamp', 'danger']) assert.equal(check.colors[key], reviewColor(candidate.themes[theme], key));
      for (const family of ['Archivo', 'Public Sans', 'Martian Mono']) assert.ok(check.loadedFaces.includes(family));
    }
  }
});

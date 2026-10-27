/** Read a public tracker copy through the SDK and measure synthetic component diagnostics without mutations. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PmClient, attachOutputTokenAccounting } from '@unbrained/pm-cli/sdk';
import { diagnoseAccessibility } from '../dist/accessibility.js';
import type { RenderedAccessibilityPair } from '../dist/accessibility.js';
import { renderAccessibilityReport } from '../dist/accessibility-report.js';
import { tokenColor } from '../dist/contrast.js';

const tracker = process.argv[2];
if (!tracker) throw new Error('Usage: node scripts/accessibility-real-data.ts <read-only-tracker-root>');
const client = new PmClient({ pmRoot: resolve(tracker), noExtensions: true });
const before = await client.listAllComplete({ includeBody: true });
const pairs: RenderedAccessibilityPair[] = [];
for (const item of before.items) {
  for (const theme of ['light', 'dark'] as const) {
    for (const rule of ['text', 'focus', 'decorative'] as const) {
      const foreground = rule === 'text' ? 'carbon' : rule === 'focus' ? 'stamp' : 'rule';
      pairs.push({ locator: `${item.id}#${rule}`, theme, rule,
        foreground: { token: foreground, color: tokenColor(theme, foreground) }, background: { token: 'sheet', color: tokenColor(theme, 'sheet') } });
    }
  }
}
const baseline = diagnoseAccessibility({ version: 1, pairs });
assert.ok(baseline.ok);
assert.equal(baseline.summary.failed, 0);
// Controlled consumer overrides, not claims about an application's existing rendered CSS.
const faulty = pairs.map(pair => pair.rule === 'decorative' ? pair : { ...pair, foreground: { ...pair.foreground, color: pair.background.color } });
const diagnosis = diagnoseAccessibility({ version: 1, pairs: faulty });
assert.ok(diagnosis.ok);
const reports = [];
for (const format of ['json', 'toon'] as const) {
  for (const budget of [512, 1_000_000]) {
    const report = await renderAccessibilityReport({ version: 1, pairs: faulty, format, budget });
    const measured = attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
    assert.ok(measured <= budget);
    assert.deepEqual(report.result.summary, diagnosis.summary);
    reports.push({ format, budget, estimated_tokens: measured, bytes: Buffer.byteLength(report.text),
      outcome: report.result.ok ? 'complete' : report.result.code });
  }
}
const after = await client.listAllComplete({ includeBody: true });
assert.deepEqual(after.items, before.items);
console.log(JSON.stringify({ items: before.items.length, complete_list: before.complete_list,
  native_state_sha256: createHash('sha256').update(JSON.stringify(before.items)).digest('hex'),
  baseline: baseline.summary, controlled_faults: diagnosis.summary, reports, sdk_state_unchanged: true }, null, 2));

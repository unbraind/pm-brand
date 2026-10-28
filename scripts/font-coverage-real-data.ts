/** Measure exact public tracker titles through the SDK on a read-only, non-git copy. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PmClient, attachOutputTokenAccounting } from '@unbrained/pm-cli/sdk';
import { preflightFontCoverage, renderFontCoverageReport } from '../dist/font-coverage.js';
import type { FontCoverageLabel } from '../dist/font-coverage.js';

/** Hash all copied tracker bytes, independent of SDK read-back normalization. */
function digest(root: string): string {
  const hash = createHash('sha256');
  /** Include sorted relative names and every file's bytes, without changing modes. */
  function visit(directory: string, relative: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(join(directory, entry.name), name);
      else { hash.update(name); hash.update(readFileSync(join(directory, entry.name))); }
    }
  }
  visit(root, '');
  return hash.digest('hex');
}

const tracker = process.argv[2];
if (!tracker) throw new Error('Usage: node scripts/font-coverage-real-data.ts <read-only-tracker-root>');
const root = resolve(tracker);
const beforeDigest = digest(root);
const client = new PmClient({ pmRoot: root, noExtensions: true });
const before = await client.listAllComplete({ includeBody: true });
const totals = { items: before.items.length, labels: 0, failed: 0, code_points: 0, supported: 0, unsupported: 0, invalid: 0, batches: 0 };
const reports: { format: string; estimated_tokens: number; bytes: number; outcome: string }[] = [];
const labels: FontCoverageLabel[] = before.items.map(item => ({ locator: item.id, text: item.title, role: 'display' }));
for (let start = 0; start < labels.length; start += 100) {
  const batch = labels.slice(start, start + 100);
  const result = preflightFontCoverage({ version: 1, labels: batch });
  assert.ok(result.ok, 'Public titles must fit the documented input domain without normalization or truncation');
  for (const key of ['labels', 'failed', 'code_points', 'supported', 'unsupported', 'invalid'] as const) totals[key] += result.summary[key];
  totals.batches += 1;
  for (const format of ['json', 'toon'] as const) {
    const report = await renderFontCoverageReport({ version: 1, labels: batch, format });
    assert.deepEqual(report.result.summary, result.summary);
    const estimated = attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
    assert.ok(estimated <= 1600);
    reports.push({ format, estimated_tokens: estimated, bytes: Buffer.byteLength(report.text),
      outcome: report.result.ok ? 'diagnosed' : report.result.code });
  }
}
assert.deepEqual((await client.listAllComplete({ includeBody: true })).items, before.items);
assert.equal(digest(root), beforeDigest);
assert.equal(totals.code_points, totals.supported + totals.unsupported + totals.invalid);
console.log(JSON.stringify({ source: process.argv[3] ?? 'public fleet tracker titles', totals, reports,
  tracker_bytes_sha256: beforeDigest, sdk_read_back_unchanged: true, tracker_bytes_unchanged: true }, null, 2));

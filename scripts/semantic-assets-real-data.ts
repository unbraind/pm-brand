/** Measure public tracker-derived SVGs on an immutable non-git copy, publishing aggregate evidence only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PmClient, attachOutputTokenAccounting } from '@unbrained/pm-cli/sdk';
import { compareSemanticAssets, renderSemanticAssetReport } from '../dist/semantic-assets.js';
import { banner } from '../dist/banner.js';
import { escapeXml } from '../dist/text.js';

/** Hash sorted relative names and bytes while checking the copy really is read-only. */
function digest(root: string): string {
  const hash = createHash('sha256');
  /** Traverse only the explicitly supplied public tracker copy. */
  function visit(directory: string, relative: string): void {
    assert.equal(statSync(directory).mode & 0o222, 0, 'Tracker directories must be read-only');
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name), name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(path, name);
      else { assert.ok(entry.isFile()); assert.equal(statSync(path).mode & 0o222, 0); hash.update(name); hash.update(readFileSync(path)); }
    }
  }
  visit(root, '');
  return hash.digest('hex');
}

/** Reorder generated attributes and vary XML quotes/line endings without changing semantic data. */
function noise(svg: string): string {
  return svg.replace(/<([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"]*")*)\s*(\/?)>/gu, (_whole, tag: string, attrs: string, close: string) => {
    const fields = [...attrs.matchAll(/([a-zA-Z:-]+)="([^"]*)"/gu)].reverse().map(match => `${match[1]}='${match[2]}'`);
    return `<${tag}${fields.length ? ` ${fields.join(' ')}` : ''}${close}>`;
  }).replaceAll('><', '>\r\n<!--serialization--><');
}

const tracker = process.argv[2];
if (!tracker) throw new Error('Usage: node scripts/semantic-assets-real-data.ts <read-only-tracker-root> [public-source-ref]');
const root = resolve(tracker), beforeDigest = digest(root);
const client = new PmClient({ pmRoot: root, noExtensions: true });
const before = await client.listAllComplete({ includeBody: true });
const totals = { items: before.items.length, generated_assets: 0, identity_comparisons: 0, noise_comparisons: 0, changed_comparisons: 0,
  identity_changes: 0, noise_changes: 0, localized_changes: 0, wire_reports: 0, budget_refusals: 0, max_estimated_tokens: 0, max_report_bytes: 0 };
const review = { parent_comparisons: 0, parent_findings: 0, arc_refusals: 0, wire_reports: 0, max_estimated_tokens: 0, max_report_bytes: 0 };
const metadata = { title_comparisons: 0, desc_comparisons: 0, findings: 0, wire_reports: 0, max_estimated_tokens: 0, max_report_bytes: 0 };
const documentBoundary = { comparisons: 0, refusals: 0, wire_reports: 0, max_estimated_tokens: 0, max_report_bytes: 0 };
const xml = { comparisons: 0, findings: 0, wire_reports: 0, max_estimated_tokens: 0, max_report_bytes: 0 };
const namespaceReview = { comparisons: 0, refusals: 0, unchanged: 0, wire_reports: 0, max_estimated_tokens: 0, max_report_bytes: 0 };
for (const item of before.items) {
  const svg = banner({ name: item.title, tagline: item.id });
  const beforeSvg = `<svg><rect id="status" fill="#fff"/><text id="label">${escapeXml(item.title)}</text></svg>`;
  const afterSvg = `<svg><rect id="status" fill="#f00"/><text id="label">${escapeXml([...item.title].slice(0, 8).join(''))}…</text></svg>`;
  totals.generated_assets += 3;
  for (const [scenario, left, right] of [['identity', svg, svg], ['noise', svg, noise(svg)], ['changed', beforeSvg, afterSvg]] as const) {
    const result = compareSemanticAssets({ version: 1, before: left, after: right }); assert.ok(result.ok);
    if (scenario === 'identity') { totals.identity_comparisons++; totals.identity_changes += result.summary.changes; assert.equal(result.summary.changes, 0); }
    if (scenario === 'noise') { totals.noise_comparisons++; totals.noise_changes += result.summary.changes; assert.equal(result.summary.changes, 0); }
    if (scenario === 'changed') { totals.changed_comparisons++; totals.localized_changes += result.summary.changes; assert.equal(result.summary.changes, 2); }
    for (const format of ['json', 'toon'] as const) {
      const report = await renderSemanticAssetReport({ version: 1, before: left, after: right, format, budget: 512 });
      assert.ok(report.result.ok); assert.deepEqual(report.result, result);
      totals.wire_reports++;
      const estimated = attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
      assert.ok(estimated <= 512);
      totals.max_estimated_tokens = Math.max(totals.max_estimated_tokens, estimated);
      totals.max_report_bytes = Math.max(totals.max_report_bytes, Buffer.byteLength(report.text));
    }
  }
  const rect = '<rect id="status" width="10" height="10"/>';
  const label = `aria-label="${escapeXml(item.title)}"`;
  const moveBefore = `<svg ${label}><g id="plain">${rect}</g><g id="shift" transform="translate(100 20)"/></svg>`;
  const moveAfter = `<svg ${label}><g id="plain"/><g id="shift" transform="translate(100 20)">${rect}</g></svg>`;
  const arcBefore = `<svg ${label}><path d="M0 0A20 20 0 0 1 40 40"/></svg>`;
  const arcAfter = arcBefore.replace('A20 20 0 0 1', 'A20 20 0 0.0 1');
  for (const [scenario, left, right] of [['parent', moveBefore, moveAfter], ['arc', arcBefore, arcAfter]] as const) {
    const result = compareSemanticAssets({ version: 1, before: left, after: right });
    if (scenario === 'parent') {
      assert.ok(result.ok); assert.equal(result.summary.changes, 1); assert.equal(result.findings[0].field, 'parent');
      review.parent_comparisons++; review.parent_findings += result.summary.changes;
    } else { assert.ok(!result.ok); assert.equal(result.code, 'unsupported_semantics'); review.arc_refusals++; }
    for (const format of ['json', 'toon'] as const) {
      const report = await renderSemanticAssetReport({ version: 1, before: left, after: right, format, budget: 512 });
      assert.deepEqual(report.result, result); assert.equal(report.format, format);
      const estimated = attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
      assert.ok(estimated <= 512); review.wire_reports++;
      review.max_estimated_tokens = Math.max(review.max_estimated_tokens, estimated);
      review.max_report_bytes = Math.max(review.max_report_bytes, Buffer.byteLength(report.text));
    }
  }
  for (const malformed of [`&#32;${svg}`, `${svg}<!--boundary-->&#x20;`]) {
    const request = { version: 1, before: svg, after: malformed };
    const result = compareSemanticAssets(request);
    assert.ok(!result.ok); assert.equal(result.code, 'unsupported_svg');
    documentBoundary.comparisons++; documentBoundary.refusals++;
    for (const format of ['json', 'toon'] as const) {
      const report = await renderSemanticAssetReport({ ...request, format, budget: 512 });
      assert.deepEqual(report.result, result); assert.equal(report.format, format);
      const estimated = attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
      assert.ok(estimated <= 512); documentBoundary.wire_reports++;
      documentBoundary.max_estimated_tokens = Math.max(documentBoundary.max_estimated_tokens, estimated);
      documentBoundary.max_report_bytes = Math.max(documentBoundary.max_report_bytes, Buffer.byteLength(report.text));
    }
  }
  const rawLabel = `${item.title} A]]>B`, escapedLabel = escapeXml(rawLabel);
  const xmlBefore = `<svg aria-label="${escapedLabel}"><title>${escapeXml(item.title)}</title></svg>`;
  const xmlAfter = `\ufeff<?xml version="1.0"?>\r\n<s:svg xmlns:s="http://www.w3.org/2000/svg" aria-label="${escapedLabel.replaceAll('&gt;', '>')}"><!--serialization--><?agent review?><s:title><![CDATA[${item.title.replaceAll(']]>', ']]]]><![CDATA[>')}]]></s:title></s:svg>`;
  const xmlResult = compareSemanticAssets({ version: 1, before: xmlBefore, after: xmlAfter });
  assert.ok(xmlResult.ok); assert.equal(xmlResult.summary.changes, 0); xml.comparisons++; xml.findings += xmlResult.summary.changes;
  for (const format of ['json', 'toon'] as const) {
    const report = await renderSemanticAssetReport({ version: 1, before: xmlBefore, after: xmlAfter, format, budget: 512 });
    assert.deepEqual(report.result, xmlResult);
    const estimated = attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
    assert.ok(estimated <= 512); xml.wire_reports++;
    xml.max_estimated_tokens = Math.max(xml.max_estimated_tokens, estimated);
    xml.max_report_bytes = Math.max(xml.max_report_bytes, Buffer.byteLength(report.text));
  }
  const namespaceBefore = `<svg xmlns="http://www.w3.org/2000/svg" ${label}>${rect}</svg>`;
  for (const [scenario, namespaceAfter] of [
    ['reset', namespaceBefore.replace('<rect ', '<rect xmlns="" ')],
    ['missing', `<s:svg xmlns:s="http://www.w3.org/2000/svg" ${label}>${rect}</s:svg>`],
    ['qualified', `<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg" ${label}>${rect.replace('<rect ', '<s:rect xmlns="" ')}</svg>`],
  ] as const) {
    const request = { version: 1, before: namespaceBefore, after: namespaceAfter };
    const result = compareSemanticAssets(request); namespaceReview.comparisons++;
    if (scenario === 'qualified') { assert.ok(result.ok); assert.equal(result.summary.changes, 0); namespaceReview.unchanged++; }
    else { assert.ok(!result.ok); assert.equal(result.code, 'unsupported_semantics'); namespaceReview.refusals++; }
    for (const format of ['json', 'toon'] as const) {
      const report = await renderSemanticAssetReport({ ...request, format, budget: 512 });
      assert.deepEqual(report.result, result); assert.equal(report.format, format);
      const estimated = attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
      assert.ok(estimated <= 512); namespaceReview.wire_reports++;
      namespaceReview.max_estimated_tokens = Math.max(namespaceReview.max_estimated_tokens, estimated);
      namespaceReview.max_report_bytes = Math.max(namespaceReview.max_report_bytes, Buffer.byteLength(report.text));
    }
  }
  for (const tag of ['title', 'desc'] as const) {
    const alpha = `<${tag} id="alpha">${escapeXml(item.title)} Alpha</${tag}>`, beta = `<${tag} id="beta">${escapeXml(item.title)} Beta</${tag}>`;
    const left = `<svg role="img">${alpha}${beta}<rect width="10" height="10"/></svg>`;
    const right = `<svg role="img">${beta}${alpha}<rect width="10" height="10"/></svg>`;
    const result = compareSemanticAssets({ version: 1, before: left, after: right });
    assert.ok(result.ok); assert.equal(result.summary.changes, 1);
    assert.equal(result.findings[0].kind, 'accessibility'); assert.equal(result.findings[0].field, `aria-${tag}-order`);
    metadata[tag === 'title' ? 'title_comparisons' : 'desc_comparisons']++; metadata.findings++;
    for (const format of ['json', 'toon'] as const) {
      const report = await renderSemanticAssetReport({ version: 1, before: left, after: right, format, budget: 512 });
      assert.deepEqual(report.result, result);
      const estimated = attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
      assert.ok(estimated <= 512); metadata.wire_reports++;
      metadata.max_estimated_tokens = Math.max(metadata.max_estimated_tokens, estimated);
      metadata.max_report_bytes = Math.max(metadata.max_report_bytes, Buffer.byteLength(report.text));
    }
  }
}
assert.deepEqual((await client.listAllComplete({ includeBody: true })).items, before.items);
assert.equal(digest(root), beforeDigest);
console.log(JSON.stringify({ source: process.argv[3] ?? 'public fleet tracker', totals, review, metadata, document_boundary: documentBoundary, xml, namespace_review: namespaceReview, tracker_bytes_sha256: beforeDigest,
  sdk_read_back_unchanged: true, tracker_bytes_unchanged: true, raster_calls: 0, network_calls: 0 }, null, 2));

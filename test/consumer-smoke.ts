/** Public-export smoke scenario copied into isolated packed consumers. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tokens, cssVar, preflightFontCoverage } from 'pm-brand';
import { banner } from 'pm-brand/banner';
import { ogImage, renderPng } from 'pm-brand/og';
import { contrast } from 'pm-brand/contrast';
import { diagnoseAccessibility } from 'pm-brand/accessibility';
import { renderAccessibilityReport } from 'pm-brand/accessibility-report';
import { renderFontCoverageReport } from 'pm-brand/font-coverage-report';
import { compareSemanticAssets, renderSemanticAssetReport } from 'pm-brand/svg-compare';
import type { SemanticAssetRequest } from 'pm-brand/svg-compare';
import { decode } from '@toon-format/toon';
import type { AccessibilityRequest } from 'pm-brand/accessibility';
assert.equal(tokens.light.paper, '#F3F5F8');
assert.equal(cssVar('--pm-paper'), 'var(--pm-paper)');
assert.equal(contrast('#000000', '#FFFFFF'), 21);
assert.deepEqual(diagnoseAccessibility({ version: 1, pairs: [] }), { ok: true, summary: { total: 0, evaluated: 0, decorative: 0, failed: 0, text_failed: 0, focus_failed: 0 }, failures: [] });
assert.equal((await renderAccessibilityReport({ version: 1, pairs: [], format: 'json', budget: 512 })).result.ok, true);
const fontRequest = { version: 1, labels: [{ locator: '#title', role: 'display', text: 'Ship 🚀' }] };
assert.equal(preflightFontCoverage(fontRequest).summary?.failed, 1);
assert.equal((await renderFontCoverageReport(fontRequest)).result.summary?.unsupported, 1);
const semanticRequest = { version: 1, before: '<svg xmlns="http://www.w3.org/2000/svg"><text>Ready</text></svg>', after: '<svg xmlns="http://www.w3.org/2000/svg"><text>Re…</text></svg>' };
assert.equal(compareSemanticAssets(semanticRequest).summary?.changes, 1);
assert.equal((await renderSemanticAssetReport(semanticRequest)).result.summary?.changes, 1);
const reviewCases = JSON.parse(readFileSync('semantic-review-cases.json', 'utf8')) as { semantic: { request: SemanticAssetRequest; expected: string }[]; color: AccessibilityRequest };
for (const row of reviewCases.semantic) {
  const result = compareSemanticAssets(row.request);
  if (row.expected.startsWith('unsupported_')) { assert.ok(!result.ok); assert.equal(result.code, row.expected); }
  else { assert.ok(result.ok); if (row.expected === 'unchanged') assert.equal(result.findings.length, 0); else assert.ok(result.findings.some(finding => finding.field === row.expected)); }
  for (const format of ['json', 'toon'] as const) {
    const report = await renderSemanticAssetReport({ ...row.request, format, budget: 1000000 });
    assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
  }
}
const invalidColor = diagnoseAccessibility(reviewCases.color);
assert.ok(!invalidColor.ok); assert.equal(invalidColor.code, 'invalid_color');
for (const format of ['json', 'toon'] as const) {
  const report = await renderAccessibilityReport({ ...reviewCases.color, format });
  assert.deepEqual(report.format === 'json' ? JSON.parse(report.text) : decode(report.text), invalidColor);
}
assert.match(banner({ name: 'pm-web', tagline: 'One identity' }), /width="1280"/);
const png = Buffer.from(renderPng(ogImage({ title: 'One identity', eyebrow: 'Triplicate', product: 'pm-web', theme: 'dark' })));
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
for (const asset of ['tokens.css', 'fonts.css', 'fonts/archivo-latin.woff2', 'fonts/OFL.txt', 'logo/mark.svg', 'logo/mark-light.svg', 'logo/mark-dark.svg', 'logo/lockup-search.svg', 'logo/lockup-search-light.svg', 'logo/lockup-search-dark.svg', 'logo/lockup-mark-search.svg', 'logo/lockup-mark-search-light.svg', 'logo/lockup-mark-search-dark.svg', 'icons/icon-512.png', 'CONTRACT.md', 'package.json']) assert.ok(readFileSync(new URL(import.meta.resolve(`pm-brand/${asset}`))).length > 0);
console.log('Public exports, relative fonts, portable SVG and native PNG accepted');

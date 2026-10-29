/** Direct Bun runtime acceptance complements the Node coverage suite. */
import { test, expect } from 'bun:test';
import { tokens, cssVar, preflightFontCoverage, renderFontCoverageReport } from '../dist/index.js';
import { banner } from '../dist/banner.js';
import { ogImage, renderPng } from '../dist/og.js';
import { compareSemanticAssets, renderSemanticAssetReport } from '../dist/semantic-assets.js';
import { packedSemanticReviewCases, renderedColorReviewRequest } from '../scripts/semantic-review-fixtures.ts';
import { diagnoseAccessibility } from '../dist/accessibility.js';
import { decode } from '@toon-format/toon';

test('Bun consumes typed tokens and portable banners', () => {
  expect(tokens.dark.paper).toBe('#0F1528');
  expect(cssVar('paper')).toBe('var(--pm-paper)');
  expect(banner({ name: 'pm-web', tagline: 'In triplicate' })).toContain('width="1280"');
});

test('Bun renders a dark OG PNG with the optional native peer', () => {
  const png = Buffer.from(renderPng(ogImage({ title: 'In triplicate', eyebrow: 'pm', product: 'pm-web', theme: 'dark' })));
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test('Bun diagnoses every missing font point and loads the public report SDK', async () => {
  const request = { version: 1, labels: [{ locator: '#title', role: 'display', text: 'e\u0301 🚀' }] };
  expect(preflightFontCoverage(request).summary?.unsupported).toBe(2);
  expect((await renderFontCoverageReport(request)).result.summary?.failed).toBe(1);
});

test('Bun compares semantic asset changes and loads the public report SDK', async () => {
  const request = { version: 1, before: '<svg><text>Ready</text></svg>', after: '<svg><text>Re…</text></svg>' };
  expect(compareSemanticAssets(request).summary?.changes).toBe(1);
  expect((await renderSemanticAssetReport(request)).result.summary?.changes).toBe(1);
});

test('Bun preserves topology and refuses invalid lexical domains in both wire formats', async () => {
  for (const row of packedSemanticReviewCases()) {
    const result = compareSemanticAssets(row.request);
    if ((row.expected === 'unsupported_svg' || row.expected === 'unsupported_semantics')) { expect(result.ok).toBe(false); if (!result.ok) expect(result.code).toBe(row.expected); }
    else { expect(result.ok).toBe(true); if (result.ok) expect(row.expected === 'unchanged' ? result.findings.length === 0 : result.findings.some(finding => finding.field === row.expected)).toBe(true); }
    for (const format of ['json', 'toon'] as const) {
      const report = await renderSemanticAssetReport({ ...row.request, format, budget: 1000000 });
      expect(format === 'json' ? JSON.parse(report.text) : decode(report.text)).toEqual(result);
    }
  }
  const color = diagnoseAccessibility(renderedColorReviewRequest());
  expect(color.ok).toBe(false); if (!color.ok) expect(color.code).toBe('invalid_color');
});

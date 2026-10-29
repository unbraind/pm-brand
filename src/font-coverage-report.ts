/** Node-only font report encoding and supported lazy SDK acquisition. */
import { encode } from '@toon-format/toon';
import { loadAccessibilityOutputSdk } from './accessibility-report.js';
import type { AccessibilityOutputSdk } from './accessibility-report.js';
import { createFontCoverageRefusal, evaluateFontCoverageRequest, parseFontCoverageRequest } from './font-coverage.js';
import type { FontCoverageReport } from './font-coverage.js';
export type { FontCoverageReport } from './font-coverage.js';

/** Encode using the same serializer for core accounting and emitted bytes. */
function serialize(result: unknown, format: FontCoverageReport['format']): string {
  return `${format === 'json' ? JSON.stringify(result) : encode(result)}\n`;
}

/** Render complete failures or a typed budget refusal; reuse the supported lazy host loader. */
export async function renderFontCoverageReport(input: unknown, sdk?: AccessibilityOutputSdk): Promise<FontCoverageReport> {
  const parsed = parseFontCoverageRequest(input);
  if ('ok' in parsed) return { result: parsed, text: serialize(parsed, 'json'), format: 'json' };
  const format = parsed.format ?? 'toon';
  const diagnosis = evaluateFontCoverageRequest(parsed);
  let host: AccessibilityOutputSdk;
  try {
    host = sdk ?? await loadAccessibilityOutputSdk();
    if (typeof host.attachOutputTokenAccounting !== 'function') throw new TypeError('Unsupported SDK');
  } catch {
    const result = { ...createFontCoverageRefusal('sdk_unavailable', '$', 'Install @unbrained/pm-cli >=2026.10.23 beside pm-brand, or inject its public output SDK.'), summary: diagnosis.summary };
    return { result, text: serialize(result, format), format };
  }
  const text = serialize(diagnosis, format);
  const required = host.attachOutputTokenAccounting(diagnosis, value => serialize(value, format)).token_accounting.total_estimated_tokens;
  if (!Number.isSafeInteger(required) || required < 0 || required > 1_000_000_000) {
    const result = createFontCoverageRefusal('numeric_result', '$.required_budget', 'Use a host SDK that returns a finite non-negative integer token estimate.');
    return { result, text: serialize(result, format), format };
  }
  if (required <= (parsed.budget ?? 1600)) return { result: diagnosis, text, format };
  const result = { ...createFontCoverageRefusal('budget_exceeded', '$.budget', 'Increase budget to required_budget or split labels into smaller batches; no failures were truncated.'),
    summary: diagnosis.summary, required_budget: required };
  return { result, text: serialize(result, format), format };
}

/** Agent-sized encoding uses the pm host's public accounting capability, loaded only on demand. */
import { encode } from '@toon-format/toon';
import type { attachOutputTokenAccounting } from '@unbrained/pm-cli/sdk';
import { createAccessibilityRefusal, evaluateAccessibilityRequest, parseAccessibilityRequest } from './accessibility.js';
import type { AccessibilityRefusal, AccessibilityResult } from './accessibility.js';

/** Hosts can inject the real SDK capability instead of loading a second host instance. */
export interface AccessibilityOutputSdk {
  /** Core owns the canonical byte/token estimator and renderer accounting. */
  readonly attachOutputTokenAccounting: typeof attachOutputTokenAccounting;
}

/** Encoded report and typed value; only text is the budgeted wire payload. */
export interface AccessibilityReport {
  /** Complete diagnosis or explicit refusal, never shortened fault coordinates. */
  readonly result: AccessibilityResult;
  /** Exact CLI bytes, including the final newline. */
  readonly text: string;
  /** Actual chosen encoding; invalid requests are refused as JSON. */
  readonly format: 'json' | 'toon';
}

/** Obtain the SDK through its supported public module entry point, independent of argv and symlinks. */
export async function loadAccessibilityOutputSdk(): Promise<AccessibilityOutputSdk> {
  return import('@unbrained/pm-cli/sdk');
}

/** Encode without custom TOON escaping, table logic or hand-written token estimates. */
function serialize(value: unknown, format: AccessibilityReport['format']): string {
  return `${format === 'json' ? JSON.stringify(value) : encode(value)}\n`;
}

/** Produce a complete report or a budget refusal retaining every failure count. */
export async function renderAccessibilityReport(input: unknown, sdk?: AccessibilityOutputSdk): Promise<AccessibilityReport> {
  const parsed = parseAccessibilityRequest(input);
  if ('ok' in parsed) return { result: parsed, text: serialize(parsed, 'json'), format: 'json' };
  const format = parsed.format ?? 'toon';
  const diagnosis = evaluateAccessibilityRequest(parsed);
  let host: AccessibilityOutputSdk;
  try {
    host = sdk ?? await loadAccessibilityOutputSdk();
    if (typeof host.attachOutputTokenAccounting !== 'function') throw new TypeError('Unsupported SDK');
  } catch {
    const result = createAccessibilityRefusal('sdk_unavailable', '$',
      'Install @unbrained/pm-cli >=2026.10.23 beside pm-brand, or inject its public output SDK.', diagnosis.summary);
    return { result, text: serialize(result, format), format };
  }
  const text = serialize(diagnosis, format);
  const required = host.attachOutputTokenAccounting(diagnosis, value => serialize(value, format)).token_accounting.total_estimated_tokens;
  if (required <= (parsed.budget ?? 1600)) return { result: diagnosis, text, format };
  const result: AccessibilityRefusal = { ...createAccessibilityRefusal('budget_exceeded', '$.budget',
    'Increase budget to required_budget, or split the input by component.', diagnosis.summary), required_budget: required };
  return { result, text: serialize(result, format), format };
}

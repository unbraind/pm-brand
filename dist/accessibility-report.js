/** Agent-sized encoding uses the pm host's public accounting capability, loaded only on demand. */
import { encode } from '@toon-format/toon';
import { createAccessibilityRefusal, evaluateAccessibilityRequest, parseAccessibilityRequest } from './accessibility.js';
/** Obtain the SDK through its supported public module entry point, independent of argv and symlinks. */
export async function loadAccessibilityOutputSdk() {
    return import('@unbrained/pm-cli/sdk');
}
/** Encode without custom TOON escaping, table logic or hand-written token estimates. */
function serialize(value, format) {
    return `${format === 'json' ? JSON.stringify(value) : encode(value)}\n`;
}
/** Produce a complete report or a budget refusal retaining every failure count. */
export async function renderAccessibilityReport(input, sdk) {
    const parsed = parseAccessibilityRequest(input);
    if ('ok' in parsed)
        return { result: parsed, text: serialize(parsed, 'json'), format: 'json' };
    const format = parsed.format ?? 'toon';
    const diagnosis = evaluateAccessibilityRequest(parsed);
    let host;
    try {
        host = sdk ?? await loadAccessibilityOutputSdk();
        if (typeof host.attachOutputTokenAccounting !== 'function')
            throw new TypeError('Unsupported SDK');
    }
    catch {
        const result = createAccessibilityRefusal('sdk_unavailable', '$', 'Install @unbrained/pm-cli >=2026.10.23 beside pm-brand, or inject its public output SDK.', diagnosis.summary);
        return { result, text: serialize(result, format), format };
    }
    const text = serialize(diagnosis, format);
    const required = host.attachOutputTokenAccounting(diagnosis, value => serialize(value, format)).token_accounting.total_estimated_tokens;
    if (required <= (parsed.budget ?? 1600))
        return { result: diagnosis, text, format };
    const result = { ...createAccessibilityRefusal('budget_exceeded', '$.budget', 'Increase budget to required_budget, or split the input by component.', diagnosis.summary), required_budget: required };
    return { result, text: serialize(result, format), format };
}

/** Diagnose resolved consumer compositions without loading a tracker or the pm host. */
import { contrast, parseColor } from './contrast.js';
import { tokens } from './tokens.js';
/** Construct serializable refusals, omitting unavailable counts instead of emitting undefined fields. */
export function createAccessibilityRefusal(code, path, remedy, summary) {
    return { ok: false, code, path, remedy, ...(summary === undefined ? {} : { summary }) };
}
/** Internal control flow carries only a public, sanitized refusal. */
class BoundaryError extends Error {
    /** Typed public payload used by both entry points. */
    refusal;
    /** Keep the typed payload separate from Error serialization. */
    constructor(refusal) { super(refusal.code); this.refusal = refusal; }
}
/** Stop boundary parsing without including user-controlled values in error messages. */
function refuse(code, path, remedy) {
    throw new BoundaryError(createAccessibilityRefusal(code, path, remedy));
}
/** Accept only plain data objects with exactly the declared keys and data properties. */
function record(value, keys, path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
        refuse('invalid_input', path, 'Supply a plain object matching AccessibilityRequest version 1.');
    }
    const data = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !keys.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) {
            refuse('invalid_input', path, 'Remove unknown fields, symbols and accessors; use the documented schema.');
        }
        data[key] = Object.getOwnPropertyDescriptor(value, key).value;
    }
    return data;
}
/** Validate a computed role once, retaining exact values for repair evidence. */
function role(value, path, theme, background) {
    const data = record(value, ['token', 'color'], path);
    if (typeof data.token !== 'string' || !Object.hasOwn(tokens[theme], data.token)) {
        refuse('invalid_input', `${path}.token`, 'Use a colour token suffix from pm-brand (for example carbon or sheet).');
    }
    const token = data.token;
    // The contract owns token colour classification, including reference-valued status roles.
    if (!/^(?:#|rgba\(|transparent$|var\(--pm-)/u.test(tokens[theme][token])) {
        refuse('invalid_input', `${path}.token`, 'Use a colour token; font, scale, focus shorthand and motion tokens are not colours.');
    }
    if (typeof data.color !== 'string' || data.color.length > 80) {
        refuse('invalid_color', `${path}.color`, 'Supply a computed #RRGGBB, rgba(r,g,b,a), or transparent colour (at most 80 characters).');
    }
    let alpha;
    try {
        alpha = parseColor(data.color)[3];
    }
    catch {
        refuse('invalid_color', `${path}.color`, 'Resolve CSS variables and named colours to #RRGGBB, rgba(r,g,b,a), or transparent.');
    }
    if (background && alpha !== 1) {
        refuse('transparent_background', `${path}.color`, 'Composite the background through its ancestors to an opaque colour before diagnosing.');
    }
    return { token: token, color: data.color };
}
/** Parse the only input schema; SDK objects and decoded CLI JSON use this same boundary. */
export function parseAccessibilityRequest(value) {
    try {
        const data = record(value, ['version', 'pairs', 'format', 'budget'], '$');
        if (data.version !== 1 || !Array.isArray(data.pairs) || data.pairs.length > 4096) {
            refuse('invalid_input', '$', 'Supply version: 1 and a dense pairs array containing at most 4096 comparisons.');
        }
        if (data.format !== undefined && data.format !== 'json' && data.format !== 'toon') {
            refuse('invalid_input', '$.format', 'Choose json or toon.');
        }
        if (data.budget !== undefined && (typeof data.budget !== 'number' || !Number.isSafeInteger(data.budget) || data.budget < 512 || data.budget > 1_000_000)) {
            refuse('invalid_input', '$.budget', 'Choose an integer budget from 512 to 1000000 estimated tokens.');
        }
        // Reject sparse arrays, accessors and extra array properties without reading a getter.
        if (Reflect.ownKeys(data.pairs).length !== data.pairs.length + 1) {
            refuse('invalid_input', '$.pairs', 'Supply a dense array with no extra properties.');
        }
        const pairs = [];
        for (let index = 0; index < data.pairs.length; index += 1) {
            const path = `$.pairs[${index}]`;
            const descriptor = Object.getOwnPropertyDescriptor(data.pairs, index);
            if (!descriptor || !Object.hasOwn(descriptor, 'value'))
                refuse('invalid_input', path, 'Supply a dense array of data objects, without accessors.');
            const pair = record(descriptor.value, ['locator', 'theme', 'rule', 'textSize', 'foreground', 'background'], path);
            if (typeof pair.locator !== 'string' || pair.locator.trim().length === 0 || pair.locator.length > 256 || /[\p{Cc}\p{Cs}]/u.test(pair.locator)) {
                refuse('invalid_input', `${path}.locator`, 'Supply a nonblank component locator of at most 256 characters, without controls or unpaired surrogates.');
            }
            if (pair.theme !== 'light' && pair.theme !== 'dark')
                refuse('invalid_input', `${path}.theme`, 'Choose an explicit light or dark theme.');
            if (pair.rule !== 'text' && pair.rule !== 'focus' && pair.rule !== 'decorative')
                refuse('invalid_input', `${path}.rule`, 'Choose text, focus or decorative based on the rendered use.');
            if (pair.textSize !== undefined && (pair.rule !== 'text' || (pair.textSize !== 'normal' && pair.textSize !== 'large'))) {
                refuse('invalid_input', `${path}.textSize`, 'Use normal or large for text only; large means at least 18pt, or 14pt bold.');
            }
            pairs.push({ locator: pair.locator, theme: pair.theme, rule: pair.rule,
                ...(pair.textSize === undefined ? {} : { textSize: pair.textSize }),
                foreground: role(pair.foreground, `${path}.foreground`, pair.theme, false),
                background: role(pair.background, `${path}.background`, pair.theme, true) });
        }
        return { version: 1, pairs, ...(data.format === undefined ? {} : { format: data.format }),
            ...(data.budget === undefined ? {} : { budget: data.budget }) };
    }
    catch (error) {
        if (error instanceof BoundaryError)
            return error.refusal;
        return createAccessibilityRefusal('invalid_input', '$', 'Supply plain data matching AccessibilityRequest; object inspection failed.');
    }
}
/** Evaluate validated request data, sharing the exact path between SDK and report producers. */
export function evaluateAccessibilityRequest(request) {
    let decorative = 0;
    let textFailed = 0;
    let focusFailed = 0;
    const failures = [];
    for (const [index, pair] of request.pairs.entries()) {
        const ratio = contrast(pair.foreground.color, pair.background.color);
        if (pair.rule === 'decorative') {
            decorative += 1;
            continue;
        }
        const minimum = pair.rule === 'focus' || pair.textSize === 'large' ? 3 : 4.5;
        // WCAG uses the unrounded luminance-derived ratio, never a display-rounded value.
        if (ratio >= minimum)
            continue;
        if (pair.rule === 'text')
            textFailed += 1;
        else
            focusFailed += 1;
        failures.push({ index, locator: pair.locator, theme: pair.theme, rule: pair.rule,
            foreground_token: pair.foreground.token, background_token: pair.background.token,
            foreground_color: pair.foreground.color, background_color: pair.background.color, ratio, minimum });
    }
    return validateAccessibilityNumbers({ ok: true, summary: { total: request.pairs.length, evaluated: request.pairs.length - decorative,
            decorative, failed: failures.length, text_failed: textFailed, focus_failed: focusFailed }, failures });
}
/** Check every emitted number and count invariant; encoders use this same producer guard. */
export function validateAccessibilityNumbers(diagnosis) {
    const { summary, failures } = diagnosis;
    if (Object.values(summary).some(count => !Number.isSafeInteger(count) || count < 0 || count > 4096)
        || summary.total !== summary.evaluated + summary.decorative || summary.failed !== failures.length
        || summary.failed !== summary.text_failed + summary.focus_failed || summary.failed > summary.evaluated
        || failures.some(fault => !Number.isInteger(fault.index) || fault.index < 0 || fault.index >= summary.total
            || !Number.isFinite(fault.ratio) || fault.ratio < 1 || fault.ratio > 21
            || (fault.minimum !== 3 && fault.minimum !== 4.5))) {
        return { ok: false, code: 'numeric_result', path: '$', remedy: 'Supply finite sRGB measurements and consistent non-negative counts within the documented domains.' };
    }
    return diagnosis;
}
/** Validate untrusted component data once and return all failing repair coordinates. */
export function diagnoseAccessibility(input) {
    const parsed = parseAccessibilityRequest(input);
    return 'ok' in parsed ? parsed : evaluateAccessibilityRequest(parsed);
}

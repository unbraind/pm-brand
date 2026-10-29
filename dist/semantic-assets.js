/** Bounded static SVG comparison: no DOM, rasterizer, network or tracker mutation. */
import { encode } from '@toon-format/toon';
import { loadAccessibilityOutputSdk } from './accessibility-report.js';
import { parseStaticSvg } from './static-svg.js';
/** Construct a small refusal without echoing untrusted SVG. */
function refuse(code, path, remedy) {
    return { ok: false, code, path, remedy };
}
/** Copy known own data fields once, rejecting accessors and exotic prototypes. */
function parseRequest(input) {
    try {
        if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
            throw new Error();
        const data = Object.create(null);
        for (const key of Reflect.ownKeys(input)) {
            const descriptor = Object.getOwnPropertyDescriptor(input, key);
            if (typeof key !== 'string' || !['version', 'before', 'after', 'format', 'budget'].includes(key) || !Object.hasOwn(descriptor, 'value'))
                throw new Error();
            data[key] = descriptor.value;
        }
        if (data.version !== 1 || typeof data.before !== 'string' || typeof data.after !== 'string'
            || Buffer.byteLength(data.before) > 1048576 || Buffer.byteLength(data.after) > 1048576
            || (data.format !== undefined && data.format !== 'json' && data.format !== 'toon')
            || (data.budget !== undefined && (typeof data.budget !== 'number' || !Number.isSafeInteger(data.budget) || data.budget < 512 || data.budget > 1000000)))
            throw new Error();
        return data;
    }
    catch {
        return refuse('invalid_input', '$', 'Supply {version:1,before:svg,after:svg,format?:json|toon,budget?:512..1000000}; each SVG must be at most 1 MiB.');
    }
}
/** Classify fields without interpreting tracker status names. */
function kind(field) {
    if (field === 'text' || field === 'data-text')
        return 'text';
    if (field.startsWith('aria-') || field === 'role')
        return 'accessibility';
    return ['fill', 'stroke', 'color', 'data-role', 'data-token'].includes(field) ? 'token_role' : 'geometry';
}
/** Compare canonical nodes; text metadata never hides independent outline geometry changes. */
function compare(before, after) {
    const left = new Map(before.map(node => [node.locator, node]));
    const right = new Map(after.map(node => [node.locator, node]));
    const findings = [];
    /** Keep arbitrary text lossless and avoid TOON multiline/Unicode ambiguity. */
    const add = (locator, field, a, b) => {
        if (JSON.stringify(a) !== JSON.stringify(b))
            findings.push({ kind: kind(field), locator, field, before_json: JSON.stringify(a), after_json: JSON.stringify(b) });
    };
    for (const locator of new Set([...left.keys(), ...right.keys()])) {
        const a = left.get(locator), b = right.get(locator);
        if (!a || !b) {
            add(locator, 'element', a ? { tag: a.tag, parent: a.parent, fields: a.fields } : null, b ? { tag: b.tag, parent: b.parent, fields: b.fields } : null);
            continue;
        }
        add(locator, 'element', a.tag, b.tag);
        add(locator, 'parent', a.parent, b.parent);
        const changedText = a.fields['data-text'] !== b.fields['data-text'];
        if (changedText && (a.fields.outline || b.fields.outline))
            add(locator, 'data-text', { text: a.fields['data-text'] ?? null, outline: a.fields.outline ?? null }, { text: b.fields['data-text'] ?? null, outline: b.fields.outline ?? null });
        for (const field of [...new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])].sort()) {
            if (changedText && (a.fields.outline || b.fields.outline) && ['data-text', 'outline'].includes(field))
                continue;
            add(locator, field === 'text' && ['title', 'desc'].includes(a.tag) ? `aria-${a.tag}` : field, a.fields[field] ?? null, b.fields[field] ?? null);
        }
        const nextChildren = new Set(b.children);
        const common = new Set(a.children.filter(child => nextChildren.has(child)));
        /** Derive each semantic order from the same retained source sequence. */
        const ordered = (node, map, tag) => node.children.filter(child => common.has(child) && (tag === 'paint' ? !['title', 'desc'].includes(map.get(child).tag) : map.get(child).tag === tag));
        for (const [field, tag] of [['paint_order', 'paint'], ['aria-title-order', 'title'], ['aria-desc-order', 'desc']]) {
            add(locator, field, ordered(a, left, tag), ordered(b, right, tag));
        }
    }
    return { ok: true, summary: { before_nodes: before.length, after_nodes: after.length, changes: findings.length }, findings };
}
/** Guard all emitted counts before declaring success. */
export function validateSemanticAssetNumbers(result) {
    const { before_nodes, after_nodes, changes } = result.summary;
    if (![before_nodes, after_nodes].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 4096)
        || !Number.isSafeInteger(changes) || changes < 0 || changes > 300000 || changes !== result.findings.length) {
        return refuse('numeric_result', '$', 'Reduce asset complexity and retry; report invalid producer counts to the package maintainer.');
    }
    return result;
}
/** Evaluate the one input schema and strict static-SVG grammar before any SDK acquisition. */
function evaluate(input) {
    const request = parseRequest(input);
    if ('ok' in request)
        return request;
    const before = parseStaticSvg(request.before), after = parseStaticSvg(request.after);
    if (!Array.isArray(before) || !Array.isArray(after))
        return { request, result: refuse('unsupported_svg', !Array.isArray(before) ? '$.before' : '$.after', 'Supply a well-formed static SVG using svg/g/path/rect/circle/ellipse/line/polyline/polygon/text/title/desc, supported attributes and finite coordinates within ±1e9; use exact arc flags 0/1 and XML whitespace; remove CSS, references, scripts and external resources. See docs/semantic-assets.md.') };
    return { request, result: validateSemanticAssetNumbers(compare(before, after)) };
}
/** Compare two bounded generated SVG assets without loading the pm runtime. */
export function compareSemanticAssets(input) {
    const evaluated = evaluate(input);
    return 'request' in evaluated ? evaluated.result : evaluated;
}
/** Encode complete findings or refuse the budget with full counts; never silently truncate. */
export async function renderSemanticAssetReport(input, sdk) {
    const evaluated = evaluate(input);
    const format = 'request' in evaluated ? evaluated.request.format ?? 'toon' : 'json';
    const budget = 'request' in evaluated ? evaluated.request.budget ?? 1600 : 1600;
    let result = 'request' in evaluated ? evaluated.result : evaluated;
    /** Official encoders own all escaping and table layout. */
    const serialize = (value) => `${format === 'json' ? JSON.stringify(value) : encode(value)}\n`;
    if (result.ok) {
        let required;
        try {
            const host = sdk ?? await loadAccessibilityOutputSdk();
            required = host.attachOutputTokenAccounting(result, () => serialize(result)).token_accounting.total_estimated_tokens;
        }
        catch {
            result = { ...refuse('sdk_unavailable', '$', 'Install the supported pm SDK beside pm-brand or inject its public output accounting capability.'), summary: result.summary };
        }
        if (result.ok) {
            if (!Number.isSafeInteger(required) || required < 0)
                result = { ...refuse('numeric_result', '$', 'Use the supported pm SDK output accounting capability.'), summary: result.summary };
            else if (required > budget)
                result = {
                    ...refuse('budget_exceeded', '$.budget', 'Increase budget to required_budget or compare smaller assets; all changes are counted.'), summary: result.summary, required_budget: required,
                };
        }
    }
    return { result, text: serialize(result), format };
}

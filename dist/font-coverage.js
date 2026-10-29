/** Read-only coverage of the shipped outline renderer, with complete failure accounting. */
import { escapeXml, MAX_TEXT_CODE_POINTS, supportsGlyph } from './text.js';
/** Construct a small refusal without echoing user input. */
export function createFontCoverageRefusal(code, path, remedy) {
    return { ok: false, code, path, remedy };
}
/** Carry boundary errors without exposing arbitrary exception messages. */
class BoundaryError extends Error {
    /** Public schema coordinate. */
    path;
    /** Boundary inspection stops before accessors or invalid work are evaluated. */
    constructor(path) { super('invalid_input'); this.path = path; }
}
/** Refuse a malformed field at its schema coordinate. */
function invalid(path) { throw new BoundaryError(path); }
/** Copy only known own data properties, excluding prototypes, accessors and symbols. */
function record(value, keys, path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        invalid(path);
    const result = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !keys.includes(key) || !Object.hasOwn(descriptor, 'value'))
            invalid(path);
        result[key] = descriptor.value;
    }
    return result;
}
/** Parse once before evaluation, SDK loading or file output. */
export function parseFontCoverageRequest(input) {
    try {
        const data = record(input, ['version', 'labels', 'include_all', 'format', 'budget'], '$');
        if (data.version !== 1 || !Array.isArray(data.labels) || data.labels.length > 100)
            invalid('$.labels');
        if (data.include_all !== undefined && typeof data.include_all !== 'boolean')
            invalid('$.include_all');
        if (data.format !== undefined && data.format !== 'json' && data.format !== 'toon')
            invalid('$.format');
        if (data.budget !== undefined && (typeof data.budget !== 'number' || !Number.isSafeInteger(data.budget)
            || data.budget < 512 || data.budget > 1_000_000))
            invalid('$.budget');
        if (Reflect.ownKeys(data.labels).length !== data.labels.length + 1)
            invalid('$.labels');
        const labels = [];
        for (let index = 0; index < data.labels.length; index += 1) {
            const path = `$.labels[${index}]`;
            const descriptor = Object.getOwnPropertyDescriptor(data.labels, index);
            if (!descriptor || !Object.hasOwn(descriptor, 'value'))
                invalid(path);
            const label = record(descriptor.value, ['locator', 'text', 'role'], path);
            if (typeof label.locator !== 'string' || label.locator.trim().length === 0 || label.locator.length > 256
                || /[\p{Cc}\p{Cs}]/u.test(label.locator))
                invalid(`${path}.locator`);
            if (typeof label.text !== 'string' || label.text.length > MAX_TEXT_CODE_POINTS * 2
                || [...label.text].length > MAX_TEXT_CODE_POINTS)
                invalid(`${path}.text`);
            if (label.role !== 'mark' && label.role !== 'display' && label.role !== 'caption' && label.role !== 'body')
                invalid(`${path}.role`);
            labels.push({ locator: label.locator, text: label.text, role: label.role });
        }
        return { version: 1, labels, ...(data.include_all === undefined ? {} : { include_all: data.include_all }),
            ...(data.format === undefined ? {} : { format: data.format }),
            ...(data.budget === undefined ? {} : { budget: data.budget }) };
    }
    catch (error) {
        return createFontCoverageRefusal('invalid_input', error instanceof BoundaryError ? error.path : '$', 'Use FontCoverageRequest version 1: at most 100 dense labels, each with locator, text (up to 512 code points) and role; remove unknown fields/accessors. Use json|toon, a boolean include_all and an integer budget from 512 to 1000000.');
    }
}
/** Guard every emitted numeric field using integer domains; no floating-point decisions. */
export function validateFontCoverageNumbers(value) {
    const s = value.summary;
    /** Integers within inclusive documented bounds are exact. */
    const count = (number, max) => Number.isSafeInteger(number) && number >= 0 && number <= max;
    if (!count(s.labels, 100) || !count(s.failed, s.labels)
        || ![s.code_points, s.supported, s.unsupported, s.invalid].every(number => count(number, s.labels * 512))
        || s.code_points !== s.supported + s.unsupported + s.invalid
        || value.labels.length > s.labels || value.labels.filter(row => row.issues.length > 0).length !== s.failed
        || value.labels.some(row => !count(row.index, s.labels - 1) || !count(row.code_points, 512)
            || !count(row.supported, row.code_points) || row.supported + row.issues.length !== row.code_points
            || row.issues.some(issue => !count(issue.index, row.code_points - 1) || !count(issue.utf16_offset, row.code_points * 2 - 1)))) {
        return createFontCoverageRefusal('numeric_result', '$', 'Report a producer defect: all counts and positions must be finite integers in their documented domains.');
    }
    return value;
}
/** Evaluate validated data using the renderer's own XML validator and exact glyph lookup. */
export function evaluateFontCoverageRequest(request) {
    const rows = [];
    let codePoints = 0, supported = 0, unsupported = 0, invalidXml = 0, failed = 0;
    for (const [index, label] of request.labels.entries()) {
        const issues = [];
        let position = 0, offset = 0;
        for (const point of label.text) {
            let route;
            try {
                escapeXml(point);
            }
            catch {
                route = 'reject_xml';
            }
            if (route === 'reject_xml')
                invalidXml += 1;
            else if (!supportsGlyph(point, label.role)) {
                route = 'question_mark';
                unsupported += 1;
            }
            else
                supported += 1;
            if (route)
                issues.push({ index: position, utf16_offset: offset,
                    code_point: `U+${point.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`, route });
            position += 1;
            offset += point.length;
        }
        codePoints += position;
        if (issues.length > 0)
            failed += 1;
        if (issues.length > 0 || request.include_all)
            rows.push({ locator: label.locator, role: label.role, text_json: JSON.stringify(label.text), index,
                font: label.role === 'body' ? 'Public Sans' : 'Archivo', code_points: position, supported: position - issues.length, issues });
    }
    return validateFontCoverageNumbers({ ok: true, summary: { labels: request.labels.length, failed,
            code_points: codePoints, supported, unsupported, invalid: invalidXml }, labels: rows });
}
/** Diagnose a batch without loading the host, touching a tracker or replacing input text. */
export function preflightFontCoverage(input) {
    const parsed = parseFontCoverageRequest(input);
    return 'ok' in parsed ? parsed : evaluateFontCoverageRequest(parsed);
}

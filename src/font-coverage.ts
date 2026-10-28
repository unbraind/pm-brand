/** Read-only coverage of the shipped outline renderer, with complete failure accounting. */
import { encode } from '@toon-format/toon';
import { escapeXml, MAX_TEXT_CODE_POINTS, supportsGlyph } from './text.js';
import type { FontRole } from './text.js';
import { loadAccessibilityOutputSdk } from './accessibility-report.js';
import type { AccessibilityOutputSdk } from './accessibility-report.js';

/** Proposed text is preserved verbatim: normalization and replacements are caller decisions. */
export interface FontCoverageLabel {
  /** Caller-owned repair location, 1–256 UTF-16 units without controls. */
  readonly locator: string;
  /** Up to 512 code points; empty strings are valid. */
  readonly text: string;
  /** Exact pinned outline instance, not an operating-system font guess. */
  readonly role: FontRole;
}

/** One strict input schema shared by the SDK and command. */
export interface FontCoverageRequest {
  /** Explicit contract version. */
  readonly version: 1;
  /** Dense array of at most 100 proposed labels. */
  readonly labels: readonly FontCoverageLabel[];
  /** Include passing labels when true; failures only by default. */
  readonly include_all?: boolean;
  /** Wire encoding, default TOON. */
  readonly format?: 'json' | 'toon';
  /** Core estimated-token ceiling, 512–1,000,000; default 1,600. */
  readonly budget?: number;
}

/** Counts cover the entire batch even if a report exceeds its budget. */
export interface FontCoverageSummary {
  /** Number of input labels, 0–100. */
  readonly labels: number;
  /** Labels requiring explicit replacement before rendering, 0–100. */
  readonly failed: number;
  /** All input code points, including invalid XML, 0–51,200. */
  readonly code_points: number;
  /** Code points resolved directly in the selected font, 0–51,200. */
  readonly supported: number;
  /** Valid XML code points rendered as question marks, 0–51,200. */
  readonly unsupported: number;
  /** Code points rejected by the renderer's XML boundary, 0–51,200. */
  readonly invalid: number;
}

/** One explicit repair coordinate; repeated missing characters remain distinct. */
export interface FontCoverageIssue {
  /** Zero-based code point position, 0–511. */
  readonly index: number;
  /** Zero-based UTF-16 position for source edits, 0–1023. */
  readonly utf16_offset: number;
  /** Uppercase U+ notation, including unpaired surrogates. */
  readonly code_point: string;
  /** Current renderer behavior; neither route certifies browser fallback. */
  readonly route: 'question_mark' | 'reject_xml';
}

/** A string needing a decision; supported positions use the selected font directly. */
export interface FontCoverageRow extends Omit<FontCoverageLabel, 'text'> {
  /** Lossless JSON string literal, including quotes; safe even for unpaired surrogates in TOON. */
  readonly text_json: string;
  /** Zero-based batch position, disambiguating repeated locators, 0–99. */
  readonly index: number;
  /** Selected shipped font family. */
  readonly font: 'Archivo' | 'Public Sans';
  /** Number of original code points, 0–512. */
  readonly code_points: number;
  /** Directly supported positions, 0–512. */
  readonly supported: number;
  /** Every unsupported or invalid position, in input order. */
  readonly issues: readonly FontCoverageIssue[];
}

/** Completed diagnosis; ok indicates evaluation, not glyph coverage. */
export interface FontCoverageDiagnosis {
  /** Input and output domains were checked. */
  readonly ok: true;
  /** Complete batch counts independent of filtering. */
  readonly summary: FontCoverageSummary;
  /** Failing labels by default, or all labels when requested. */
  readonly labels: readonly FontCoverageRow[];
}

/** Expected refusals are sanitized values with a concrete next action. */
export interface FontCoverageRefusal {
  /** Discriminant for unsuccessful evaluation or encoding. */
  readonly ok: false;
  /** Stable refusal category. */
  readonly code: 'invalid_input' | 'numeric_result' | 'sdk_unavailable' | 'budget_exceeded' | 'input_unreadable' | 'usage';
  /** Schema coordinate, never a raw parser error. */
  readonly path: string;
  /** Action the caller can take. */
  readonly remedy: string;
  /** Complete counts if diagnosis finished. */
  readonly summary?: FontCoverageSummary;
  /** Core estimate needed to return every failure. */
  readonly required_budget?: number;
}

/** Public result shared by both SDK producers. */
export type FontCoverageResult = FontCoverageDiagnosis | FontCoverageRefusal;

/** Exact budgeted wire bytes and their typed value. */
export interface FontCoverageReport {
  /** Complete diagnosis or explicit refusal. */
  readonly result: FontCoverageResult;
  /** Encoded result including the terminating newline. */
  readonly text: string;
  /** Invalid input is always refused as JSON. */
  readonly format: 'json' | 'toon';
}

/** Construct a small refusal without echoing user input. */
function refusal(code: FontCoverageRefusal['code'], path: string, remedy: string): FontCoverageRefusal {
  return { ok: false, code, path, remedy };
}

/** Carry boundary errors without exposing arbitrary exception messages. */
class BoundaryError extends Error {
  /** Public schema coordinate. */
  readonly path: string;
  /** Boundary inspection stops before accessors or invalid work are evaluated. */
  constructor(path: string) { super('invalid_input'); this.path = path; }
}

/** Refuse a malformed field at its schema coordinate. */
function invalid(path: string): never { throw new BoundaryError(path); }

/** Copy only known own data properties, excluding prototypes, accessors and symbols. */
function record(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(path);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !keys.includes(key) || !Object.hasOwn(descriptor, 'value')) invalid(path);
    result[key] = descriptor.value;
  }
  return result;
}

/** Parse once before evaluation, SDK loading or file output. */
export function parseFontCoverageRequest(input: unknown): FontCoverageRequest | FontCoverageRefusal {
  try {
    const data = record(input, ['version', 'labels', 'include_all', 'format', 'budget'], '$');
    if (data.version !== 1 || !Array.isArray(data.labels) || data.labels.length > 100) invalid('$.labels');
    if (data.include_all !== undefined && typeof data.include_all !== 'boolean') invalid('$.include_all');
    if (data.format !== undefined && data.format !== 'json' && data.format !== 'toon') invalid('$.format');
    if (data.budget !== undefined && (typeof data.budget !== 'number' || !Number.isSafeInteger(data.budget)
      || data.budget < 512 || data.budget > 1_000_000)) invalid('$.budget');
    if (Reflect.ownKeys(data.labels).length !== data.labels.length + 1) invalid('$.labels');
    const labels: FontCoverageLabel[] = [];
    for (let index = 0; index < data.labels.length; index += 1) {
      const path = `$.labels[${index}]`;
      const descriptor = Object.getOwnPropertyDescriptor(data.labels, index);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid(path);
      const label = record(descriptor.value, ['locator', 'text', 'role'], path);
      if (typeof label.locator !== 'string' || label.locator.trim().length === 0 || label.locator.length > 256
        || /[\p{Cc}\p{Cs}]/u.test(label.locator)) invalid(`${path}.locator`);
      if (typeof label.text !== 'string' || label.text.length > MAX_TEXT_CODE_POINTS * 2
        || [...label.text].length > MAX_TEXT_CODE_POINTS) invalid(`${path}.text`);
      if (label.role !== 'mark' && label.role !== 'display' && label.role !== 'caption' && label.role !== 'body') invalid(`${path}.role`);
      labels.push({ locator: label.locator, text: label.text, role: label.role });
    }
    return { version: 1, labels, ...(data.include_all === undefined ? {} : { include_all: data.include_all as boolean }),
      ...(data.format === undefined ? {} : { format: data.format as 'json' | 'toon' }),
      ...(data.budget === undefined ? {} : { budget: data.budget as number }) };
  } catch (error) {
    return refusal('invalid_input', error instanceof BoundaryError ? error.path : '$',
      'Use FontCoverageRequest version 1: at most 100 dense labels, each with locator, text (up to 512 code points) and role; remove unknown fields/accessors. Use json|toon, a boolean include_all and an integer budget from 512 to 1000000.');
  }
}

/** Guard every emitted numeric field using integer domains; no floating-point decisions. */
export function validateFontCoverageNumbers(value: FontCoverageDiagnosis): FontCoverageResult {
  const s = value.summary;
  /** Integers within inclusive documented bounds are exact. */
  const count = (number: number, max: number) => Number.isSafeInteger(number) && number >= 0 && number <= max;
  if (!count(s.labels, 100) || !count(s.failed, s.labels)
    || ![s.code_points, s.supported, s.unsupported, s.invalid].every(number => count(number, s.labels * 512))
    || s.code_points !== s.supported + s.unsupported + s.invalid
    || value.labels.length > s.labels || value.labels.filter(row => row.issues.length > 0).length !== s.failed
    || value.labels.some(row => !count(row.index, s.labels - 1) || !count(row.code_points, 512)
      || !count(row.supported, row.code_points) || row.supported + row.issues.length !== row.code_points
      || row.issues.some(issue => !count(issue.index, row.code_points - 1) || !count(issue.utf16_offset, row.code_points * 2 - 1)))) {
    return refusal('numeric_result', '$', 'Report a producer defect: all counts and positions must be finite integers in their documented domains.');
  }
  return value;
}

/** Evaluate validated data using the renderer's own XML validator and exact glyph lookup. */
function evaluate(request: FontCoverageRequest): FontCoverageResult {
  const rows: FontCoverageRow[] = [];
  let codePoints = 0, supported = 0, unsupported = 0, invalidXml = 0, failed = 0;
  for (const [index, label] of request.labels.entries()) {
    const issues: FontCoverageIssue[] = [];
    let position = 0, offset = 0;
    for (const point of label.text) {
      let route: FontCoverageIssue['route'] | undefined;
      try { escapeXml(point); } catch { route = 'reject_xml'; }
      if (route === 'reject_xml') invalidXml += 1;
      else if (!supportsGlyph(point, label.role)) { route = 'question_mark'; unsupported += 1; }
      else supported += 1;
      if (route) issues.push({ index: position, utf16_offset: offset,
        code_point: `U+${point.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`, route });
      position += 1; offset += point.length;
    }
    codePoints += position;
    if (issues.length > 0) failed += 1;
    if (issues.length > 0 || request.include_all) rows.push({ locator: label.locator, role: label.role, text_json: JSON.stringify(label.text), index,
      font: label.role === 'body' ? 'Public Sans' : 'Archivo', code_points: position, supported: position - issues.length, issues });
  }
  return validateFontCoverageNumbers({ ok: true, summary: { labels: request.labels.length, failed,
    code_points: codePoints, supported, unsupported, invalid: invalidXml }, labels: rows });
}

/** Diagnose a batch without loading the host, touching a tracker or replacing input text. */
export function preflightFontCoverage(input: unknown): FontCoverageResult {
  const parsed = parseFontCoverageRequest(input);
  return 'ok' in parsed ? parsed : evaluate(parsed);
}

/** Encode using the same serializer for core accounting and emitted bytes. */
function serialize(result: unknown, format: FontCoverageReport['format']): string {
  return `${format === 'json' ? JSON.stringify(result) : encode(result)}\n`;
}

/** Render complete failures or a typed budget refusal; reuse the supported lazy host loader. */
export async function renderFontCoverageReport(input: unknown, sdk?: AccessibilityOutputSdk): Promise<FontCoverageReport> {
  const parsed = parseFontCoverageRequest(input);
  if ('ok' in parsed) return { result: parsed, text: serialize(parsed, 'json'), format: 'json' };
  const format = parsed.format ?? 'toon';
  const diagnosis = evaluate(parsed);
  let host: AccessibilityOutputSdk;
  try {
    host = sdk ?? await loadAccessibilityOutputSdk();
    if (typeof host.attachOutputTokenAccounting !== 'function') throw new TypeError('Unsupported SDK');
  } catch {
    const result = { ...refusal('sdk_unavailable', '$', 'Install @unbrained/pm-cli >=2026.10.23 beside pm-brand, or inject its public output SDK.'), summary: diagnosis.summary };
    return { result, text: serialize(result, format), format };
  }
  const text = serialize(diagnosis, format);
  const required = host.attachOutputTokenAccounting(diagnosis, value => serialize(value, format)).token_accounting.total_estimated_tokens;
  if (!Number.isSafeInteger(required) || required < 0 || required > 1_000_000_000) {
    const result = refusal('numeric_result', '$.required_budget', 'Use a host SDK that returns a finite non-negative integer token estimate.');
    return { result, text: serialize(result, format), format };
  }
  if (required <= (parsed.budget ?? 1600)) return { result: diagnosis, text, format };
  const result = { ...refusal('budget_exceeded', '$.budget', 'Increase budget to required_budget or split labels into smaller batches; no failures were truncated.'),
    summary: diagnosis.summary, required_budget: required };
  return { result, text: serialize(result, format), format };
}

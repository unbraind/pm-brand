/** Bounded static SVG comparison: no raster generation, network or tracker mutation. */
import { encode } from '@toon-format/toon';
import { loadAccessibilityOutputSdk } from './accessibility-report.js';
import type { AccessibilityOutputSdk } from './accessibility-report.js';
import { parseStaticSvg } from './static-svg.js';
import type { StaticSvgNode, StaticSvgRefusal } from './static-svg.js';

/** Strict versioned request shared by the SDK and CLI. */
export interface SemanticAssetRequest {
  /** Explicit schema version. */
  readonly version: 1;
  /** Generated static SVG, at most 1 MiB of UTF-8. */
  readonly before: string;
  /** Generated static SVG, at most 1 MiB of UTF-8. */
  readonly after: string;
  /** Default TOON. */
  readonly format?: 'json' | 'toon';
  /** SDK estimated tokens, 512–1,000,000; default 1,600. */
  readonly budget?: number;
}

/** One repair location; values are lossless JSON literals in both encodings. */
export interface SemanticAssetFinding {
  /** Meaning of the changed field. */
  readonly kind: 'text' | 'token_role' | 'geometry' | 'accessibility';
  /** Stable XML id when supplied, otherwise element-index path. */
  readonly locator: string;
  /** Attribute, text, parent, paint_order, aria-title-order, aria-desc-order or element. */
  readonly field: string;
  /** Previous value as a JSON literal; null means absent. */
  readonly before_json: string;
  /** Next value as a JSON literal; null means absent. */
  readonly after_json: string;
}

/** Complete counts, retained even on budget refusal. */
export interface SemanticAssetSummary {
  /** Parsed nodes, 1–4096. */
  readonly before_nodes: number;
  /** Parsed nodes, 1–4096. */
  readonly after_nodes: number;
  /** Complete findings, 0–300000. */
  readonly changes: number;
}

/** Completed comparison; ok certifies comparison, not visual equivalence. */
export interface SemanticAssetDiagnosis {
  /** Successful evaluation. */
  readonly ok: true;
  /** Counts for both complete inputs. */
  readonly summary: SemanticAssetSummary;
  /** Deterministic localized differences. */
  readonly findings: readonly SemanticAssetFinding[];
}

/** Sanitized, actionable boundary or output refusal. */
export interface SemanticAssetRefusal {
  /** Unsuccessful evaluation. */
  readonly ok: false;
  /** Stable machine-readable reason. */
  readonly code: 'invalid_input' | 'unsupported_svg' | 'unsupported_semantics' | 'numeric_result' | 'sdk_unavailable' | 'budget_exceeded';
  /** Request side or field; no supplied file paths. */
  readonly path: string;
  /** Bounded Resvg diagnostic when the renderer rejects the original document. */
  readonly reason?: string;
  /** Next action for the caller. */
  readonly remedy: string;
  /** Complete counts when comparison finished. */
  readonly summary?: SemanticAssetSummary;
  /** SDK estimate for the complete report. */
  readonly required_budget?: number;
}

/** Pure result, including expected refusals. */
export type SemanticAssetResult = SemanticAssetDiagnosis | SemanticAssetRefusal;

/** Exact budgeted wire payload and its typed value. */
export interface SemanticAssetReport {
  /** Complete comparison or refusal. */
  readonly result: SemanticAssetResult;
  /** Includes final newline. */
  readonly text: string;
  /** Schema-invalid requests use JSON; SVG refusals retain validated format options. */
  readonly format: 'json' | 'toon';
}

/** Construct a small refusal without echoing untrusted SVG. */
function refuse(code: SemanticAssetRefusal['code'], path: string, remedy: string): SemanticAssetRefusal {
  return { ok: false, code, path, remedy };
}

/** Copy known own data fields once, rejecting accessors and exotic prototypes. */
function parseRequest(input: unknown): SemanticAssetRequest | SemanticAssetRefusal {
  try {
    if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error();
    const data: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
      if (typeof key !== 'string' || !['version', 'before', 'after', 'format', 'budget'].includes(key) || !Object.hasOwn(descriptor, 'value')) throw new Error();
      data[key] = descriptor.value;
    }
    if (data.version !== 1 || typeof data.before !== 'string' || typeof data.after !== 'string'
      || Buffer.byteLength(data.before) > 1048576 || Buffer.byteLength(data.after) > 1048576
      || (data.format !== undefined && data.format !== 'json' && data.format !== 'toon')
      || (data.budget !== undefined && (typeof data.budget !== 'number' || !Number.isSafeInteger(data.budget) || data.budget < 512 || data.budget > 1000000))) throw new Error();
    return data as unknown as SemanticAssetRequest;
  } catch { return refuse('invalid_input', '$', 'Supply {version:1,before:svg,after:svg,format?:json|toon,budget?:512..1000000}; each SVG must be at most 1 MiB.'); }
}

/** Classify fields without interpreting tracker status names. */
function kind(field: string): SemanticAssetFinding['kind'] {
  if (field === 'text' || field === 'data-text') return 'text';
  if (field.startsWith('aria-') || field === 'role') return 'accessibility';
  return ['fill', 'stroke', 'color', 'data-role', 'data-token'].includes(field) ? 'token_role' : 'geometry';
}

/** Compare canonical nodes; text metadata never hides independent outline geometry changes. */
function compare(before: readonly StaticSvgNode[], after: readonly StaticSvgNode[]): SemanticAssetDiagnosis {
  const left = new Map(before.map(node => [node.locator, node]));
  const right = new Map(after.map(node => [node.locator, node]));
  const findings: SemanticAssetFinding[] = [];
  /** Keep arbitrary text lossless and avoid TOON multiline/Unicode ambiguity. */
  const add = (locator: string, field: string, a: unknown, b: unknown): void => {
    if (JSON.stringify(a) !== JSON.stringify(b)) findings.push({ kind: kind(field), locator, field, before_json: JSON.stringify(a), after_json: JSON.stringify(b) });
  };
  for (const locator of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(locator), b = right.get(locator);
    if (!a || !b) { add(locator, 'element', a ? { tag: a.tag, parent: a.parent, fields: a.fields } : null, b ? { tag: b.tag, parent: b.parent, fields: b.fields } : null); continue; }
    add(locator, 'element', a.tag, b.tag);
    add(locator, 'parent', a.parent, b.parent);
    const changedText = a.fields['data-text'] !== b.fields['data-text'];
    if (changedText && (a.fields.outline || b.fields.outline)) add(locator, 'data-text',
      { text: a.fields['data-text'] ?? null, outline: a.fields.outline ?? null }, { text: b.fields['data-text'] ?? null, outline: b.fields.outline ?? null });
    for (const field of [...new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])].sort()) {
      if (changedText && (a.fields.outline || b.fields.outline) && ['data-text', 'outline'].includes(field)) continue;
      add(locator, field === 'text' && ['title', 'desc'].includes(a.tag) ? `aria-${a.tag}` : field, a.fields[field] ?? null, b.fields[field] ?? null);
    }
    const nextChildren = new Set(b.children);
    const common = new Set(a.children.filter(child => nextChildren.has(child)));
    /** Derive each semantic order from the same retained source sequence. */
    const ordered = (node: StaticSvgNode, map: ReadonlyMap<string, StaticSvgNode>, tag: 'paint' | 'title' | 'desc'): string[] => node.children.filter(child =>
      common.has(child) && (tag === 'paint' ? !['title', 'desc'].includes(map.get(child)!.tag) : map.get(child)!.tag === tag));
    for (const [field, tag] of [['paint_order', 'paint'], ['aria-title-order', 'title'], ['aria-desc-order', 'desc']] as const) {
      add(locator, field, ordered(a, left, tag), ordered(b, right, tag));
    }
  }
  return { ok: true, summary: { before_nodes: before.length, after_nodes: after.length, changes: findings.length }, findings };
}

/** Guard all emitted counts before declaring success. */
export function validateSemanticAssetNumbers(result: SemanticAssetDiagnosis): SemanticAssetResult {
  const { before_nodes, after_nodes, changes } = result.summary;
  if (![before_nodes, after_nodes].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 4096)
    || !Number.isSafeInteger(changes) || changes < 0 || changes > 300000 || changes !== result.findings.length) {
    return refuse('numeric_result', '$', 'Reduce asset complexity and retry; report invalid producer counts to the package maintainer.');
  }
  return result;
}

/** Evaluate the one input schema and strict static-SVG grammar before any SDK acquisition. */
function evaluate(input: unknown): { request: SemanticAssetRequest; result: SemanticAssetResult } | SemanticAssetRefusal {
  const request = parseRequest(input);
  if ('ok' in request) return request;
  const before = parseStaticSvg(request.before), after = parseStaticSvg(request.after);
  const failures = [{ value: before, path: '$.before' }, { value: after, path: '$.after' }]
    .filter((entry): entry is { value: StaticSvgRefusal; path: string } => !Array.isArray(entry.value));
  if (failures.length) {
    const { value: failed, path } = failures.find(entry => entry.value.code === 'unsupported_svg') ?? failures[0];
    return { request, result: { ...refuse(failed.code, path, failed.code === 'unsupported_svg'
      ? 'Supply SVG accepted by Resvg with an SVG-namespaced root, within 1 MiB, 4096 elements, depth 32, 32 attributes per element and 32768 geometry lexemes; see docs/semantic-assets.md.'
      : 'Use the documented static SVG subset with finite coordinates within ±1e9 and exact arc flags 0/1; preserve SVG namespace bindings; remove DTDs, CSS, scripts and resource references. See docs/semantic-assets.md.'), ...(failed.reason === undefined ? {} : { reason: failed.reason }) } };
  }
  return { request, result: validateSemanticAssetNumbers(compare(before as StaticSvgNode[], after as StaticSvgNode[])) };
}

/** Compare two bounded generated SVG assets without loading the pm runtime. */
export function compareSemanticAssets(input: unknown): SemanticAssetResult {
  const evaluated = evaluate(input);
  return 'request' in evaluated ? evaluated.result : evaluated;
}

/** Encode complete findings or refuse the budget with full counts; never silently truncate. */
export async function renderSemanticAssetReport(input: unknown, sdk?: AccessibilityOutputSdk): Promise<SemanticAssetReport> {
  const evaluated = evaluate(input);
  const format = 'request' in evaluated ? evaluated.request.format ?? 'toon' : 'json';
  const budget = 'request' in evaluated ? evaluated.request.budget ?? 1600 : 1600;
  let result = 'request' in evaluated ? evaluated.result : evaluated;
  /** Official encoders own all escaping and table layout. */
  const serialize = (value: SemanticAssetResult): string => `${format === 'json' ? JSON.stringify(value) : encode(value)}\n`;
  if (result.ok) {
    let required: number;
    try {
      const host = sdk ?? await loadAccessibilityOutputSdk();
      required = host.attachOutputTokenAccounting(result, () => serialize(result)).token_accounting.total_estimated_tokens;
    } catch { result = { ...refuse('sdk_unavailable', '$', 'Install the supported pm SDK beside pm-brand or inject its public output accounting capability.'), summary: result.summary }; }
    if (result.ok) {
      if (!Number.isSafeInteger(required!) || required! < 0) result = { ...refuse('numeric_result', '$', 'Use the supported pm SDK output accounting capability.'), summary: result.summary };
      else if (required! > budget) result = {
        ...refuse('budget_exceeded', '$.budget', 'Increase budget to required_budget or compare smaller assets; all changes are counted.'), summary: result.summary, required_budget: required!,
      };
    }
  }
  return { result, text: serialize(result), format };
}

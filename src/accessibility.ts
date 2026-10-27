/** Diagnose resolved consumer compositions without loading a tracker or the pm host. */
import { contrast, parseColor } from './contrast.js';
import { tokens } from './tokens.js';
import type { Theme, TokenName } from './tokens.js';

/** Colour token suffixes derived from the kit itself, excluding typography, geometry and motion. */
export type BrandColorTokenName = {
  [Name in TokenName]: typeof tokens.light[Name] extends `#${string}` | `rgba(${string}` | `var(--pm-${string})` | 'transparent' ? Name : never;
}[TokenName];

/** A rendered role retains the source token even when a component overrides its value. */
export interface ResolvedBrandRole {
  /** Contract token suffix; non-colour tokens are refused. */
  readonly token: BrandColorTokenName;
  /** Computed six-digit hex, rgba or transparent colour; backgrounds must be opaque. */
  readonly color: string;
}

/** One rendered comparison; provide both adjacent backgrounds as separate focus pairs. */
export interface RenderedAccessibilityPair {
  /** Component selector, source coordinate or other caller-owned repair location (1–256 characters). */
  readonly locator: string;
  /** Explicit theme of the rendered component. */
  readonly theme: Theme;
  /** Semantic use, independently of the token's usual purpose. */
  readonly rule: 'text' | 'focus' | 'decorative';
  /** Large text is an explicit caller assertion: at least 18pt, or 14pt bold. Text only. */
  readonly textSize?: 'normal' | 'large';
  /** Computed ink, focus ring or decorative border and its token reference. */
  readonly foreground: ResolvedBrandRole;
  /** Computed opaque adjacent surface and its token reference. */
  readonly background: ResolvedBrandRole;
}

/** The single strict boundary schema shared by SDK and CLI, limited to 4,096 comparisons. */
export interface AccessibilityRequest {
  /** Explicit input contract version. */
  readonly version: 1;
  /** Dense, ordered comparisons; empty arrays are valid. */
  readonly pairs: readonly RenderedAccessibilityPair[];
  /** Requested encoding, defaulting to TOON. */
  readonly format?: 'json' | 'toon';
  /** Canonical pm estimated-token ceiling (512–1,000,000), defaulting to 1,600. */
  readonly budget?: number;
}

/** Stable full-population counts survive an insufficient report budget. */
export interface AccessibilitySummary {
  /** All comparisons, including decoration. */
  readonly total: number;
  /** Comparisons enforcing text or focus thresholds. */
  readonly evaluated: number;
  /** Decorative comparisons measured but exempt from thresholds. */
  readonly decorative: number;
  /** All failed comparisons. */
  readonly failed: number;
  /** Failed text comparisons. */
  readonly text_failed: number;
  /** Failed focus comparisons. */
  readonly focus_failed: number;
}

/** A complete repair coordinate, retaining measured colours and original token references. */
export interface AccessibilityFault {
  /** Zero-based source comparison, disambiguating repeated locators. */
  readonly index: number;
  /** Exact caller-supplied repair location. */
  readonly locator: string;
  /** Explicit rendered theme. */
  readonly theme: Theme;
  /** Failing semantic threshold. */
  readonly rule: 'text' | 'focus';
  /** Foreground contract token suffix. */
  readonly foreground_token: BrandColorTokenName;
  /** Background contract token suffix. */
  readonly background_token: BrandColorTokenName;
  /** Resolved foreground colour, including alpha. */
  readonly foreground_color: string;
  /** Resolved opaque background colour. */
  readonly background_color: string;
  /** Unrounded WCAG 2.x contrast ratio, finite and in [1, 21]. */
  readonly ratio: number;
  /** Inclusive required ratio (3 or 4.5). */
  readonly minimum: number;
}

/** Successful evaluation can contain accessibility failures; inspect summary.failed. */
export interface AccessibilityDiagnosis {
  /** Input and numeric checks completed successfully. */
  readonly ok: true;
  /** Counts of the entire input, independent of output size. */
  readonly summary: AccessibilitySummary;
  /** Every failing pair, in source order; no passing palette is emitted. */
  readonly failures: readonly AccessibilityFault[];
}

/** Expected input, dependency and budget failures are values with actionable remedies. */
export interface AccessibilityRefusal {
  /** Discriminates expected refusals from completed diagnoses. */
  readonly ok: false;
  /** Stable refusal category. */
  readonly code: 'invalid_input' | 'invalid_color' | 'transparent_background' | 'numeric_result' | 'sdk_unavailable' | 'budget_exceeded' | 'input_unreadable' | 'usage';
  /** Schema coordinate rather than an echo of untrusted content. */
  readonly path: string;
  /** Concrete next action. */
  readonly remedy: string;
  /** Full counts when evaluation completed before refusal. */
  readonly summary?: AccessibilitySummary;
  /** Budget needed for the complete report, using the core estimator. */
  readonly required_budget?: number;
}

/** Diagnosis and typed refusal share one discriminant on every entry point. */
export type AccessibilityResult = AccessibilityDiagnosis | AccessibilityRefusal;

/** Construct serializable refusals, omitting unavailable counts instead of emitting undefined fields. */
export function createAccessibilityRefusal(code: AccessibilityRefusal['code'], path: string, remedy: string, summary?: AccessibilitySummary): AccessibilityRefusal {
  return { ok: false, code, path, remedy, ...(summary === undefined ? {} : { summary }) };
}

/** Internal control flow carries only a public, sanitized refusal. */
class BoundaryError extends Error {
  /** Typed public payload used by both entry points. */
  readonly refusal: AccessibilityRefusal;
  /** Keep the typed payload separate from Error serialization. */
  constructor(refusal: AccessibilityRefusal) { super(refusal.code); this.refusal = refusal; }
}

/** Stop boundary parsing without including user-controlled values in error messages. */
function refuse(code: AccessibilityRefusal['code'], path: string, remedy: string): never {
  throw new BoundaryError(createAccessibilityRefusal(code, path, remedy));
}

/** Accept only plain data objects with exactly the declared keys and data properties. */
function record(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    refuse('invalid_input', path, 'Supply a plain object matching AccessibilityRequest version 1.');
  }
  const data: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')) {
      refuse('invalid_input', path, 'Remove unknown fields, symbols and accessors; use the documented schema.');
    }
    data[key] = Object.getOwnPropertyDescriptor(value, key)!.value;
  }
  return data;
}

/** Validate a computed role once, retaining exact values for repair evidence. */
function role(value: unknown, path: string, theme: Theme, background: boolean): ResolvedBrandRole {
  const data = record(value, ['token', 'color'], path);
  if (typeof data.token !== 'string' || !Object.hasOwn(tokens[theme], data.token)) {
    refuse('invalid_input', `${path}.token`, 'Use a colour token suffix from pm-brand (for example carbon or sheet).');
  }
  const token = data.token as TokenName;
  // The contract owns token colour classification, including reference-valued status roles.
  if (!/^(?:#|rgba\(|transparent$|var\(--pm-)/u.test(tokens[theme][token])) {
    refuse('invalid_input', `${path}.token`, 'Use a colour token; font, scale, focus shorthand and motion tokens are not colours.');
  }
  if (typeof data.color !== 'string' || data.color.length > 80) {
    refuse('invalid_color', `${path}.color`, 'Supply a computed #RRGGBB, rgba(r,g,b,a), or transparent colour (at most 80 characters).');
  }
  let alpha: number;
  try { alpha = parseColor(data.color)[3]; } catch {
    refuse('invalid_color', `${path}.color`, 'Resolve CSS variables and named colours to #RRGGBB, rgba(r,g,b,a), or transparent.');
  }
  if (background && alpha !== 1) {
    refuse('transparent_background', `${path}.color`, 'Composite the background through its ancestors to an opaque colour before diagnosing.');
  }
  return { token: token as BrandColorTokenName, color: data.color };
}

/** Parse the only input schema; SDK objects and decoded CLI JSON use this same boundary. */
export function parseAccessibilityRequest(value: unknown): AccessibilityRequest | AccessibilityRefusal {
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
    const pairs: RenderedAccessibilityPair[] = [];
    for (let index = 0; index < data.pairs.length; index += 1) {
      const path = `$.pairs[${index}]`;
      const descriptor = Object.getOwnPropertyDescriptor(data.pairs, index);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse('invalid_input', path, 'Supply a dense array of data objects, without accessors.');
      const pair = record(descriptor.value, ['locator', 'theme', 'rule', 'textSize', 'foreground', 'background'], path);
      if (typeof pair.locator !== 'string' || pair.locator.trim().length === 0 || pair.locator.length > 256 || /[\p{Cc}\p{Cs}]/u.test(pair.locator)) {
        refuse('invalid_input', `${path}.locator`, 'Supply a nonblank component locator of at most 256 characters, without controls or unpaired surrogates.');
      }
      if (pair.theme !== 'light' && pair.theme !== 'dark') refuse('invalid_input', `${path}.theme`, 'Choose an explicit light or dark theme.');
      if (pair.rule !== 'text' && pair.rule !== 'focus' && pair.rule !== 'decorative') refuse('invalid_input', `${path}.rule`, 'Choose text, focus or decorative based on the rendered use.');
      if (pair.textSize !== undefined && (pair.rule !== 'text' || (pair.textSize !== 'normal' && pair.textSize !== 'large'))) {
        refuse('invalid_input', `${path}.textSize`, 'Use normal or large for text only; large means at least 18pt, or 14pt bold.');
      }
      pairs.push({ locator: pair.locator, theme: pair.theme, rule: pair.rule,
        ...(pair.textSize === undefined ? {} : { textSize: pair.textSize as 'normal' | 'large' }),
        foreground: role(pair.foreground, `${path}.foreground`, pair.theme, false),
        background: role(pair.background, `${path}.background`, pair.theme, true) });
    }
    return { version: 1, pairs, ...(data.format === undefined ? {} : { format: data.format as 'json' | 'toon' }),
      ...(data.budget === undefined ? {} : { budget: data.budget as number }) };
  } catch (error) {
    if (error instanceof BoundaryError) return error.refusal;
    return createAccessibilityRefusal('invalid_input', '$', 'Supply plain data matching AccessibilityRequest; object inspection failed.');
  }
}

/** Evaluate validated request data, sharing the exact path between SDK and report producers. */
export function evaluateAccessibilityRequest(request: AccessibilityRequest): AccessibilityResult {
  let decorative = 0;
  let textFailed = 0;
  let focusFailed = 0;
  const failures: AccessibilityFault[] = [];
  for (const [index, pair] of request.pairs.entries()) {
    const ratio = contrast(pair.foreground.color, pair.background.color);
    if (pair.rule === 'decorative') { decorative += 1; continue; }
    const minimum = pair.rule === 'focus' || pair.textSize === 'large' ? 3 : 4.5;
    // WCAG uses the unrounded luminance-derived ratio, never a display-rounded value.
    if (ratio >= minimum) continue;
    if (pair.rule === 'text') textFailed += 1; else focusFailed += 1;
    failures.push({ index, locator: pair.locator, theme: pair.theme, rule: pair.rule,
      foreground_token: pair.foreground.token, background_token: pair.background.token,
      foreground_color: pair.foreground.color, background_color: pair.background.color, ratio, minimum });
  }
  return validateAccessibilityNumbers({ ok: true, summary: { total: request.pairs.length, evaluated: request.pairs.length - decorative,
    decorative, failed: failures.length, text_failed: textFailed, focus_failed: focusFailed }, failures });
}

/** Check every emitted number and count invariant; encoders use this same producer guard. */
export function validateAccessibilityNumbers(diagnosis: AccessibilityDiagnosis): AccessibilityResult {
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
export function diagnoseAccessibility(input: unknown): AccessibilityResult {
  const parsed = parseAccessibilityRequest(input);
  return 'ok' in parsed ? parsed : evaluateAccessibilityRequest(parsed);
}

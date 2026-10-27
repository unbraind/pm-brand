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
export declare function createAccessibilityRefusal(code: AccessibilityRefusal['code'], path: string, remedy: string, summary?: AccessibilitySummary): AccessibilityRefusal;
/** Parse the only input schema; SDK objects and decoded CLI JSON use this same boundary. */
export declare function parseAccessibilityRequest(value: unknown): AccessibilityRequest | AccessibilityRefusal;
/** Evaluate validated request data, sharing the exact path between SDK and report producers. */
export declare function evaluateAccessibilityRequest(request: AccessibilityRequest): AccessibilityResult;
/** Check every emitted number and count invariant; encoders use this same producer guard. */
export declare function validateAccessibilityNumbers(diagnosis: AccessibilityDiagnosis): AccessibilityResult;
/** Validate untrusted component data once and return all failing repair coordinates. */
export declare function diagnoseAccessibility(input: unknown): AccessibilityResult;

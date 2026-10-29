import type { AccessibilityOutputSdk } from './accessibility-report.js';
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
/** Guard all emitted counts before declaring success. */
export declare function validateSemanticAssetNumbers(result: SemanticAssetDiagnosis): SemanticAssetResult;
/** Compare two bounded generated SVG assets without loading the pm runtime. */
export declare function compareSemanticAssets(input: unknown): SemanticAssetResult;
/** Encode complete findings or refuse the budget with full counts; never silently truncate. */
export declare function renderSemanticAssetReport(input: unknown, sdk?: AccessibilityOutputSdk): Promise<SemanticAssetReport>;

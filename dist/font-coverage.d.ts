import type { FontRole } from './text.js';
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
/** Parse once before evaluation, SDK loading or file output. */
export declare function parseFontCoverageRequest(input: unknown): FontCoverageRequest | FontCoverageRefusal;
/** Guard every emitted numeric field using integer domains; no floating-point decisions. */
export declare function validateFontCoverageNumbers(value: FontCoverageDiagnosis): FontCoverageResult;
/** Diagnose a batch without loading the host, touching a tracker or replacing input text. */
export declare function preflightFontCoverage(input: unknown): FontCoverageResult;
/** Render complete failures or a typed budget refusal; reuse the supported lazy host loader. */
export declare function renderFontCoverageReport(input: unknown, sdk?: AccessibilityOutputSdk): Promise<FontCoverageReport>;

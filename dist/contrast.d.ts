import type { Theme, TokenName } from './tokens.js';
/** One normalized sRGB colour with optional transparency. */
export type Rgba = readonly [number, number, number, number];
/** Parse the contract's six-digit hex, rgba, and transparent colour values. */
export declare function parseColor(value: string): Rgba;
/** Composite a translucent foreground on an opaque background in sRGB. */
export declare function composite(foreground: Rgba, background: Rgba): Rgba;
/** WCAG 2.x relative luminance, applying the standard sRGB transfer curve. */
export declare function luminance(color: Rgba): number;
/** Contrast ratio for opaque text, or translucent ink composited onto its background. */
export declare function contrast(foreground: string, background: string): number;
/** Resolve a theme colour reference, retaining alpha for rule borders. */
export declare function tokenColor(theme: Theme, name: TokenName): string;
/** One independently auditable contrast pair and its required threshold. */
export interface ContrastPair {
    /** Colour theme evaluated. */
    readonly theme: Theme;
    /** Descriptive foreground/background names. */
    readonly pair: string;
    /** Actual WCAG ratio. */
    readonly ratio: number;
    /** AA text or non-text threshold. */
    readonly minimum: number;
}
/** Audit all allowed text pairs, status fills/borders and keyboard focus backgrounds. */
export declare function contrastAudit(): ContrastPair[];

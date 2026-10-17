import type { Theme } from './tokens.js';
/** Plain-text content for a 1200 × 630 Open Graph card. */
export interface OgOptions {
    /** Heading capped at 512 code points at grapheme boundaries, wrapping to at most three lines. */
    readonly title: string;
    /** Label capped at 512 code points at grapheme boundaries, also after uppercase conversion. */
    readonly eyebrow: string;
    /** Product name capped at 512 code points without splitting graphemes. */
    readonly product: string;
    /** Explicit palette; defaults to light. */
    readonly theme?: Theme;
}
/** Generate a portable OG image; user text is validated and XML escaped in metadata. */
export declare function ogImage({ title, eyebrow, product, theme }: OgOptions): string;
/** Rasterize an SVG to PNG with no system fonts, remote fetches or font fallback. */
export declare function renderPng(svg: string): Uint8Array;

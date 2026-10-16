import type { Theme } from './tokens.js';
/** Plain-text content for a 1200 × 630 Open Graph card. */
export interface OgOptions {
    /** Primary heading; measured wrapping is capped at three lines. */
    readonly title: string;
    /** Condensed label above the heading. */
    readonly eyebrow: string;
    /** Product or package name beside the mark. */
    readonly product: string;
    /** Explicit palette; defaults to light. */
    readonly theme?: Theme;
}
/** Generate a portable OG image; user text is validated and XML escaped in metadata. */
export declare function ogImage({ title, eyebrow, product, theme }: OgOptions): string;
/** Rasterize an SVG to PNG with no system fonts, remote fetches or font fallback. */
export declare function renderPng(svg: string): Uint8Array;

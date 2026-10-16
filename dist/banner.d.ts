/** README banner generator, using path outlines from the brand fonts. */
import type { Theme } from './tokens.js';
/** Content accepted by the 1280 × 320 README banner. */
export interface BannerOptions {
    /** Lowercase package name, such as pm-web. */
    readonly name: string;
    /** Plain-language package description. */
    readonly tagline: string;
    /** Explicit palette; defaults to light. */
    readonly theme?: Theme;
}
/** Generate a portable, accessible README banner with no external resources. */
export declare function banner({ name, tagline, theme }: BannerOptions): string;

/** README banner generator, using path outlines from the brand fonts. */
import type { Theme } from './tokens.js';
/** Content accepted by the 1280 × 320 README banner. */
export interface BannerOptions {
    /** Lowercase package name, such as pm-web; capped at 512 code points without splitting graphemes. */
    readonly name: string;
    /** Plain-language description; capped at 512 code points without splitting graphemes. */
    readonly tagline: string;
    /** Explicit palette; defaults to light. */
    readonly theme?: Theme;
}
/** Generate a portable, accessible README banner with no external resources. */
export declare function banner({ name, tagline, theme }: BannerOptions): string;

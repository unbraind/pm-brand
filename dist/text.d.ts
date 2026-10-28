/** Deterministic font geometry and safe SVG text handling. */
import { fontData } from './font-data.js';
/** Supported font roles; all outlines come from the pinned OFL sources. */
export type FontRole = keyof typeof fontData;
/** Maximum code points per image field, keeping only complete graphemes. */
export declare const MAX_TEXT_CODE_POINTS = 512;
/** Bound work before validation or measurement, with one code point of boundary lookahead. */
export declare function boundText(text: string): string;
/** Validate XML text and escape every syntax-bearing character before interpolation. */
export declare function escapeXml(value: string): string;
/** Test the exact shipped repertoire used by measurement, rendering and preflight. */
export declare function supportsGlyph(char: string, role: FontRole): boolean;
/** Measure one glyph; injectable into layout helpers for deterministic work budgets. */
export declare function glyphAdvance(char: string, role: FontRole, size: number): number;
/** Measure the same advances that textPaths uses, in SVG pixels. */
export declare function textWidth(text: string, role: FontRole, size: number, measure?: typeof glyphAdvance): number;
/** Draw a complete run as paths; no fonts, platform text shaping or network requests are needed. */
export declare function textPaths(text: string, role: FontRole, x: number, y: number, size: number): string;
/** Fit bounded text in linear time using cumulative advances at complete grapheme boundaries. */
export declare function ellipsize(text: string, role: FontRole, size: number, width: number, measure?: typeof glyphAdvance): string;
/** Wrap whole words to a measured width, then ellipsize excess content on the final line. */
export declare function wrapTitle(text: string, width: number, size: number, maxLines: number): string[];

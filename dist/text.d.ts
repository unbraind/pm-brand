/** Deterministic font geometry and safe SVG text handling. */
import { fontData } from './font-data.js';
/** Supported font roles; all outlines come from the pinned OFL sources. */
export type FontRole = keyof typeof fontData;
/** Validate XML text and escape every syntax-bearing character before interpolation. */
export declare function escapeXml(value: string): string;
/** Measure the same advances that textPaths uses, in SVG pixels. */
export declare function textWidth(text: string, role: FontRole, size: number): number;
/** Draw a complete run as paths; no fonts, platform text shaping or network requests are needed. */
export declare function textPaths(text: string, role: FontRole, x: number, y: number, size: number): string;
/** Fit one line by Unicode code point, adding an ellipsis when necessary. */
export declare function ellipsize(text: string, role: FontRole, size: number, width: number): string;
/** Wrap whole words to a measured width, then ellipsize excess content on the final line. */
export declare function wrapTitle(text: string, width: number, size: number, maxLines: number): string[];

import type { Theme } from './tokens.js';
/** Embed the canonical generated mark at an explicit position and size. */
export declare function imageMark(theme: Theme, x: number, y: number, size: number): string;
/** Frame a banner or OG card with paper, a sheet and safely escaped accessible text. */
export declare function imageSvg(width: number, height: number, theme: Theme, description: string, body: string): string;

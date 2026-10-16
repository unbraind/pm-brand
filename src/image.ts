/** Shared static image frame and accessible metadata. */
import { tokens } from './tokens.js';
import type { Theme } from './tokens.js';
import { marks } from './mark-data.js';
import { escapeXml } from './text.js';

/** Embed the canonical generated mark at an explicit position and size. */
export function imageMark(theme: Theme, x: number, y: number, size: number): string {
  return `<g transform="translate(${x} ${y}) scale(${size / 248})">${marks[theme]}</g>`;
}

/** Frame a banner or OG card with paper, a sheet and safely escaped accessible text. */
export function imageSvg(width: number, height: number, theme: Theme, description: string, body: string): string {
  const palette = tokens[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(description)}"><title>${escapeXml(description)}</title><rect width="${width}" height="${height}" fill="${palette.paper}"/><rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="6" fill="${palette.sheet}" stroke="${palette.carbon}" stroke-opacity=".14"/><g fill="${palette.carbon}">${body}</g></svg>`;
}

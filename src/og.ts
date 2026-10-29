/** Open Graph card generation and optional server-side raster rendering. */
import { Resvg } from '@resvg/resvg-js';
import { tokens } from './tokens.js';
import type { Theme } from './tokens.js';
import { boundText, ellipsize, escapeXml, textPaths, wrapTitle } from './text.js';
import { imageSvg, imageMark } from './image.js';

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
export function ogImage({ title, eyebrow, product, theme = 'light' }: OgOptions): string {
  title = boundText(title);
  eyebrow = boundText(eyebrow);
  product = boundText(product);
  for (const text of [title, eyebrow, product]) escapeXml(text);
  const lines = wrapTitle(title, 1040, 64, 3);
  const label = ellipsize(eyebrow.toUpperCase(), 'caption', 24, 1010);
  const name = ellipsize(product, 'display', 32, 850);
  return imageSvg(1200, 630, theme, `${product} — ${eyebrow}: ${title}`, `<g data-role="eyebrow" data-text="${escapeXml(label)}" fill="${tokens[theme].graphite}">${textPaths(label, 'caption', 64, 104, 24)}</g><g data-role="title" data-lines="${lines.length}">${lines.map((line, index) => `<g aria-label="${escapeXml(line)}" data-text="${escapeXml(line)}">${textPaths(line, 'display', 64, 204 + index * 82, 64)}</g>`).join('')}</g>${imageMark(theme, 64, 474, 96)}<g data-role="product" data-text="${escapeXml(name)}">${textPaths(name, 'display', 190, 537, 32)}</g>`);
}

/** Rasterize an SVG to PNG with no system fonts, remote fetches or font fallback. */
export function renderPng(svg: string): Uint8Array {
  return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
}

/** Open Graph card generation and optional server-side raster rendering. */
import { Resvg } from '@resvg/resvg-js';
import { tokens } from './tokens.js';
import { boundText, ellipsize, escapeXml, textPaths, wrapTitle } from './text.js';
import { imageSvg, imageMark } from './image.js';
/** Generate a portable OG image; user text is validated and XML escaped in metadata. */
export function ogImage({ title, eyebrow, product, theme = 'light' }) {
    title = boundText(title);
    eyebrow = boundText(eyebrow);
    product = boundText(product);
    for (const text of [title, eyebrow, product])
        escapeXml(text);
    const lines = wrapTitle(title, 1040, 64, 3);
    const label = ellipsize(eyebrow.toUpperCase(), 'caption', 24, 1010);
    const name = ellipsize(product, 'display', 32, 850);
    return imageSvg(1200, 630, theme, `${product} — ${eyebrow}: ${title}`, `<g data-role="eyebrow" data-text="${escapeXml(label)}" fill="${tokens[theme].graphite}">${textPaths(label, 'caption', 64, 104, 24)}</g><g data-role="title" data-lines="${lines.length}">${lines.map((line, index) => `<g aria-label="${escapeXml(line)}" data-text="${escapeXml(line)}">${textPaths(line, 'display', 64, 204 + index * 82, 64)}</g>`).join('')}</g>${imageMark(theme, 64, 474, 96)}<g data-role="product" data-text="${escapeXml(name)}">${textPaths(name, 'display', 190, 537, 32)}</g>`);
}
/** Rasterize an SVG to PNG with no system fonts, remote fetches or font fallback. */
export function renderPng(svg) {
    return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
}

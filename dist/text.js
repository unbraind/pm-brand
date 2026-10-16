/** Deterministic font geometry and safe SVG text handling. */
import { fontData } from './font-data.js';
/** Validate XML text and escape every syntax-bearing character before interpolation. */
export function escapeXml(value) {
    if (/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(value))
        throw new TypeError('Text contains XML control characters');
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
/** Resolve a glyph in the subset, substituting a visible question mark for missing characters. */
function glyphFor(face, char) {
    return face.glyphs[char] ?? face.glyphs['?'];
}
/** Measure the same advances that textPaths uses, in SVG pixels. */
export function textWidth(text, role, size) {
    const face = fontData[role];
    return [...text].reduce((width, char) => width + glyphFor(face, char).advance * size / face.em, 0);
}
/** Draw a complete run as paths; no fonts, platform text shaping or network requests are needed. */
export function textPaths(text, role, x, y, size) {
    escapeXml(text);
    const face = fontData[role];
    let cursor = x;
    return [...text].map(char => {
        const glyph = glyphFor(face, char);
        const path = `<path transform="translate(${cursor.toFixed(3)} ${y}) scale(${size / face.em} ${-size / face.em})" d="${glyph.d}"/>`;
        cursor += glyph.advance * size / face.em;
        return path;
    }).join('');
}
/** Fit one line by Unicode code point, adding an ellipsis when necessary. */
export function ellipsize(text, role, size, width) {
    escapeXml(text);
    if (textWidth(text, role, size) <= width)
        return text;
    const chars = [...text];
    while (chars.length > 0 && textWidth(`${chars.join('')}…`, role, size) > width)
        chars.pop();
    return `${chars.join('').trimEnd()}…`;
}
/** Wrap whole words to a measured width, then ellipsize excess content on the final line. */
export function wrapTitle(text, width, size, maxLines) {
    escapeXml(text);
    const words = text.trim().split(/\s+/u);
    const lines = [];
    let current = '';
    for (let index = 0; index < words.length; index++) {
        const candidate = current ? `${current} ${words[index]}` : words[index];
        if (textWidth(candidate, 'display', size) <= width) {
            current = candidate;
        }
        else if (lines.length === maxLines - 1 || !current) {
            lines.push(ellipsize([current, ...words.slice(index)].filter(Boolean).join(' '), 'display', size, width));
            return lines;
        }
        else {
            lines.push(current);
            current = words[index];
        }
    }
    lines.push(ellipsize(current, 'display', size, width));
    return lines;
}

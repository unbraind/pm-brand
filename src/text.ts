/** Deterministic font geometry and safe SVG text handling. */
import { fontData } from './font-data.js';
/** Supported font roles; all outlines come from the pinned OFL sources. */
export type FontRole = keyof typeof fontData;
/** An outline with an advance measured in font units. */
interface Glyph { readonly d: string; readonly advance: number }
/** A single static instance of a brand font. */
interface Face { readonly em: number; readonly glyphs: Readonly<Record<string, Glyph>> }

/** Maximum code points per image field, keeping only complete graphemes. */
export const MAX_TEXT_CODE_POINTS = 512;
/** Unicode grapheme boundaries shared by input bounds and measured truncation. */
const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** Bound work before validation or measurement, with one code point of boundary lookahead. */
export function boundText(text: string): string {
  const points: string[] = [];
  for (const point of text) {
    points.push(point);
    if (points.length > MAX_TEXT_CODE_POINTS) break;
  }
  const window = points.join('');
  if (points.length <= MAX_TEXT_CODE_POINTS) return window;
  let end = 0;
  let count = 0;
  for (const { segment, index } of graphemes.segment(window)) {
    count += [...segment].length;
    if (count > MAX_TEXT_CODE_POINTS) break;
    end = index + segment.length;
  }
  return window.slice(0, end);
}

/** Validate XML text and escape every syntax-bearing character before interpolation. */
export function escapeXml(value: string): string {
  if (/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(value)) throw new TypeError('Text contains XML control characters');
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** Resolve a glyph in the subset, substituting a visible question mark for missing characters. */
function glyphFor(face: Face, char: string): Glyph {
  return face.glyphs[char] ?? face.glyphs['?'];
}

/** Measure one glyph; injectable into layout helpers for deterministic work budgets. */
export function glyphAdvance(char: string, role: FontRole, size: number): number {
  const face: Face = fontData[role];
  return glyphFor(face, char).advance * size / face.em;
}

/** Measure the same advances that textPaths uses, in SVG pixels. */
export function textWidth(text: string, role: FontRole, size: number, measure = glyphAdvance): number {
  return [...text].reduce((width, char) => width + measure(char, role, size), 0);
}

/** Draw a complete run as paths; no fonts, platform text shaping or network requests are needed. */
export function textPaths(text: string, role: FontRole, x: number, y: number, size: number): string {
  escapeXml(text);
  const face: Face = fontData[role];
  let cursor = x;
  return [...text].map(char => {
    const glyph = glyphFor(face, char);
    const path = `<path transform="translate(${cursor.toFixed(3)} ${y}) scale(${size / face.em} ${-size / face.em})" d="${glyph.d}"/>`;
    cursor += glyph.advance * size / face.em;
    return path;
  }).join('');
}

/** Fit bounded text in linear time using cumulative advances at complete grapheme boundaries. */
export function ellipsize(text: string, role: FontRole, size: number, width: number, measure = glyphAdvance): string {
  text = boundText(text);
  escapeXml(text);
  const prefixes: { end: number; width: number }[] = [];
  let advance = 0;
  for (const { segment, index } of graphemes.segment(text)) {
    for (const char of segment) advance += measure(char, role, size);
    prefixes.push({ end: index + segment.length, width: advance });
  }
  if (advance <= width) return text;
  const ellipsis = measure('…', role, size);
  let end = 0;
  for (const prefix of prefixes) {
    if (prefix.width + ellipsis > width) break;
    end = prefix.end;
  }
  return `${text.slice(0, end).trimEnd()}…`;
}

/** Wrap whole words to a measured width, then ellipsize excess content on the final line. */
export function wrapTitle(text: string, width: number, size: number, maxLines: number): string[] {
  text = boundText(text);
  escapeXml(text);
  const words = text.trim().split(/\s+/u);
  const lines: string[] = [];
  let current = '';
  for (let index = 0; index < words.length; index++) {
    const candidate = current ? `${current} ${words[index]}` : words[index];
    if (textWidth(candidate, 'display', size) <= width) {
      current = candidate;
    } else if (lines.length === maxLines - 1 || !current) {
      lines.push(ellipsize([current, ...words.slice(index)].filter(Boolean).join(' '), 'display', size, width));
      return lines;
    } else {
      lines.push(current);
      current = words[index];
    }
  }
  lines.push(ellipsize(current, 'display', size, width));
  return lines;
}

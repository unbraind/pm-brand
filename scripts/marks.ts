/** Generate all mark variants, lockups and raster icons from shared sheet geometry. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fontData } from '../src/font-data.ts';
import { Resvg } from '@resvg/resvg-js';
/** One font glyph, measured in the upstream font's units. */
interface Glyph { d: string; advance: number }
/** A static instance's outline map. */
interface Face { em: number; glyphs: Record<string, Glyph> }
/** Pinned Archivo geometry produced by scripts/font-paths.ts. */
const faces: Readonly<Record<string, Face>> = fontData;
/** Build a text run entirely from paths, preserving advances and baselines. */
function textPaths(text: string, role: string, x: number, y: number, size: number): string {
  const face = faces[role];
  let cursor = x;
  return [...text].map(char => {
    const glyph = face.glyphs[char];
    const path = `<path transform="translate(${cursor.toFixed(3)} ${y}) scale(${size / face.em} ${-size / face.em})" d="${glyph.d}"/>`;
    cursor += glyph.advance * size / face.em;
    return path;
  }).join('');
}
/** Sheet dimensions and placements shared by colour fills and monochrome occlusion. */
const sheetGeometry = { width: 180, height: 174, radius: 6, back: [54, 58], middle: [34, 35], top: [14, 12] } as const;
/** Serialize one sheet using the same geometry for drawing and occlusion masks. */
function sheetRect(position: readonly [number, number], fill: string, attributes = ''): string {
  return `<rect${attributes} x="${position[0]}" y="${position[1]}" width="${sheetGeometry.width}" height="${sheetGeometry.height}" rx="${sheetGeometry.radius}" fill="${fill}"/>`;
}
/** Shared three-sheet silhouette; the top sheet and outlines adapt to the variant. */
function mark(variant: 'light' | 'dark' | 'mono', inheritInk = false): string {
  const ink = inheritInk || variant === 'mono' ? 'currentColor' : variant === 'dark' ? '#E7EAF3' : '#1B2340';
  const top = variant === 'mono' ? 'none' : variant === 'dark' ? '#171F37' : '#FFFFFF';
  const rose = variant === 'mono' ? 'none' : variant === 'dark' ? '#D07E97' : '#DE7F9C';
  const canary = variant === 'mono' ? 'none' : variant === 'dark' ? '#D7B53A' : '#E9C53A';
  const maskBase = '<rect width="248" height="248" fill="white"/>';
  const maskInk = ' stroke="black" stroke-width="5"';
  const masks = variant === 'mono' ? `<defs><mask id="pm-mono-back" maskUnits="userSpaceOnUse" x="0" y="0" width="248" height="248">${maskBase}${sheetRect(sheetGeometry.middle, 'black', maskInk)}</mask><mask id="pm-mono-middle" maskUnits="userSpaceOnUse" x="0" y="0" width="248" height="248">${maskBase}${sheetRect(sheetGeometry.top, 'black', maskInk)}</mask></defs>` : '';
  const backMask = variant === 'mono' ? ' mask="url(#pm-mono-back)"' : '';
  const middleMask = variant === 'mono' ? ' mask="url(#pm-mono-middle)"' : '';
  return `${masks}<g stroke="${ink}" stroke-width="5" stroke-linejoin="round">${sheetRect(sheetGeometry.back, rose, backMask)}${sheetRect(sheetGeometry.middle, canary, middleMask)}${sheetRect(sheetGeometry.top, top, inheritInk && variant !== 'mono' ? ' class="pm-top"' : '')}</g><g fill="${ink}">${textPaths('pm', 'mark', 31, 132, 78)}</g>`;
}
/** A standalone font-free SVG wrapper. */
function svg(body: string, width: number, height: number, title: string, appearance: 'auto' | 'light' | 'dark' | 'inherit' = 'inherit'): string {
  // Scope adaptive rules to the adaptive root so fixed inline variants cannot leak styles.
  const attributes = appearance === 'auto' ? ' class="pm-brand-auto"' : appearance === 'inherit' ? '' : ` style="color:${appearance === 'dark' ? '#E7EAF3' : '#1B2340'}"`;
  const style = appearance === 'auto' ? '<style>.pm-brand-auto{color:var(--pm-carbon,#1B2340)}.pm-brand-auto .pm-top{fill:var(--pm-sheet,#FFFFFF)}.pm-brand-auto .pm-canary{fill:var(--pm-canary,#E9C53A)}.pm-brand-auto .pm-rose{fill:var(--pm-rose,#DE7F9C)}@media (prefers-color-scheme: dark){.pm-brand-auto{color:var(--pm-carbon,#E7EAF3)}.pm-brand-auto .pm-top{fill:var(--pm-sheet,#171F37)}.pm-brand-auto .pm-canary{fill:var(--pm-canary,#D7B53A)}.pm-brand-auto .pm-rose{fill:var(--pm-rose,#D07E97)}}</style>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"${attributes}><title>${title}</title>${style}${body}</svg>\n`;
}
/** Write adaptive and fixed appearances, keeping all foreground ink inheritable. */
function variants(name: string, body: (theme: 'light' | 'dark') => string, width: number, height: number, title: string): void {
  writeFileSync(`logo/${name}.svg`, svg(body('light'), width, height, title, 'auto'));
  for (const theme of ['light', 'dark'] as const) writeFileSync(`logo/${name}-${theme}.svg`, svg(body(theme), width, height, title, theme));
}
/** Mark sheets gain classes only in adaptive/inline artwork; image-helper data stays stable. */
function inlineMark(theme: 'light' | 'dark'): string {
  return mark(theme, true).replace('x="54"', 'class="pm-rose" x="54"').replace('x="34"', 'class="pm-canary" x="34"');
}
/** Transparent caption outline and path lettering share the surrounding carbon ink. */
function caption(label: string, x: number, y: number, size: number, height: number, width: number): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><g fill="currentColor">${textPaths(label, 'caption', x + 16, y + height - 20, size)}</g>`;
}
mkdirSync('logo', { recursive: true });
mkdirSync('icons', { recursive: true });
variants('mark', inlineMark, 248, 248, 'pm: three sheets in triplicate');
writeFileSync('logo/mark-mono.svg', svg(mark('mono'), 248, 248, 'pm: three sheets in triplicate'));
for (const product of ['pm', 'web', 'gpt', 'mcp', 'search', 'swarm']) {
  const label = product === 'pm' ? '' : product.toUpperCase();
  const boxWidth = label.length * 28 + 34;
  const wordmark = `<g fill="currentColor">${textPaths('pm', 'mark', 8, 100, 112)}</g>`;
  variants(`lockup-${product}`, () => `${wordmark}${label ? caption(label, 242, 34, 42, 70, boxWidth) : ''}`, label ? 250 + boxWidth : 240, 140, label ? `pm ${label}` : 'pm');
  const markLabel = product.toUpperCase();
  const markBoxWidth = markLabel.length * 28 + 34;
  variants(`lockup-mark-${product}`, theme => `<g transform="translate(0 8) scale(.5)">${inlineMark(theme)}</g>${caption(markLabel, 138, 38, 42, 70, markBoxWidth)}`, 146 + markBoxWidth, 140, `pm mark ${markLabel}`);
}
writeFileSync('icons/favicon.svg', svg(mark('light'), 248, 248, 'pm'));
for (const [name, size] of [['favicon-32', 32], ['apple-touch-icon-180', 180], ['icon-192', 192], ['icon-512', 512], ['icon-maskable-512', 512]] as const) {
  const maskable = name.includes('maskable');
  // All foreground geometry is inside a centered r=0.4*size safe circle.
  const body = maskable ? `<rect width="248" height="248" fill="#F3F5F8"/><g transform="translate(56 56) scale(.55)">${mark('light')}</g>` : mark('light');
  writeFileSync(`icons/${name}.png`, new Resvg(svg(body, 248, 248, 'pm'), { fitTo: { mode: 'width', value: size } }).render().asPng());
}
writeFileSync('src/mark-data.ts', `/** Generated by scripts/marks.ts from shared sheet geometry. */\nexport const marks = ${JSON.stringify({ light: mark('light'), dark: mark('dark') })} as const;\n`);

/** Generate review pages and PNGs from the package sample, unchanged image generators and candidate tokens. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { tokens } from '../dist/tokens.js';
import type { Theme } from '../dist/tokens.js';
import { marks } from '../dist/mark-data.js';
import { banner } from '../dist/banner.js';
import { ogImage } from '../dist/og.js';
import { baseline, candidates, reviewAudit, reviewColor } from './palette-candidates.ts';
import type { PaletteCandidate } from './palette-candidates.ts';
import { capturePages } from './palette-browser.ts';
import type { Capture } from './palette-browser.ts';
import { OG_PREVIEW_COPY } from './preview-copy.ts';
/** Only replace palette fills; the mark paths, text paths and image geometry stay byte-identical. */
function recolor(svg: string, candidate: PaletteCandidate, theme: Theme): string {
  const keys = ['paper', 'sheet', 'carbon', 'graphite', 'copy-secondary', 'copy-tertiary'] as const;
  const mapping = new Map<string, string>(keys.map(key => [tokens[theme][key], reviewColor(candidate.themes[theme], key === 'copy-secondary' && candidate.id === 'before' ? 'canary' : key === 'copy-tertiary' && candidate.id === 'before' ? 'rose' : key)]));
  return svg.replace(/#[\dA-F]{6}/giu, color => mapping.get(color) ?? color);
}
/** Build one review-only sample with the full candidate token set and fixed mark. */
function sample(candidate: PaletteCandidate, theme: Theme): string {
  const css = Object.entries(candidate.themes[theme]).map(([key, value]) => `--pm-${key}:${value};`).join('');
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 248 248">${recolor(marks[theme], candidate, theme)}</svg>`;
  return readFileSync('docs/samples/app.html', 'utf8')
    .replace('data-theme="light"', `data-theme="${theme}"`)
    .replace('../../tokens.css', pathToFileURL(resolve('tokens.css')).href)
    .replace('../../fonts.css', pathToFileURL(resolve('fonts.css')).href)
    .replace('</head>', `<style>:root[data-theme="${theme}"]{${css}}</style></head>`)
    .replace('../../logo/mark-light.svg', `data:image/svg+xml;base64,${Buffer.from(mark).toString('base64')}`);
}
const directory = 'docs/palette-previews';
mkdirSync('.cache/palette-pages', { recursive: true });
/** Evidence rendered from the exact source pages, with font loading given a deterministic wait. */
const captures: Capture[] = [];
const receipts: { candidate: string; theme: Theme; asset: string; width: number; file: string }[] = [];
for (const candidate of [baseline, ...candidates]) {
  for (const theme of ['light', 'dark'] as const) {
    const sources = {
      app: sample(candidate, theme),
      banner: recolor(banner({ name: 'pm-brand', tagline: 'The Triplicate brand kit for pm', theme }), candidate, theme),
      og: recolor(ogImage({ ...OG_PREVIEW_COPY, product: 'pm-web', theme }), candidate, theme),
    };
    for (const [asset, source] of Object.entries(sources)) {
      const page = `.cache/palette-pages/${candidate.id}-${theme}-${asset}.html`;
      const html = asset === 'app' ? source : `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:${candidate.themes[theme].paper}}svg{display:block;width:100%;height:auto}</style>${source}</html>`;
      writeFileSync(page, html);
      for (const width of [1440, 768, 390]) {
        const file = `${candidate.id}-${theme}-${asset}-${width}.png`;
        captures.push({ url: pathToFileURL(resolve(page)).href, output: `${directory}/${file}`, width, colors: asset === 'app' ? Object.fromEntries(['paper', 'sheet', 'carbon', 'graphite', 'stamp', 'danger'].map(key => [key, reviewColor(candidate.themes[theme], key)])) : undefined, height: asset === 'app' ? 900 : asset === 'banner' ? Math.round(width / 4) : Math.round(width * 630 / 1200) });
        receipts.push({ candidate: candidate.id, theme, asset, width, file });
      }
    }
  }
}
await capturePages(captures);
for (const candidate of [baseline, ...candidates]) {
  for (const theme of ['light', 'dark'] as const) {
    // A single contact sheet makes both responsive layouts easy to inspect in the PR.
    const desktop = readFileSync(`${directory}/${candidate.id}-${theme}-app-1440.png`);
    const narrow = readFileSync(`${directory}/${candidate.id}-${theme}-app-390.png`);
    const desktopHeight = desktop.readUInt32BE(20);
    const narrowHeight = narrow.readUInt32BE(20);
    const bannerPng = readFileSync(`${directory}/${candidate.id}-${theme}-banner-1440.png`);
    const ogPng = readFileSync(`${directory}/${candidate.id}-${theme}-og-390.png`);
    const height = Math.max(Math.round(desktopHeight / 2) + 180, narrowHeight);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1110" height="${height}" viewBox="0 0 1110 ${height}"><rect width="1110" height="${height}" fill="${candidate.themes[theme].paper}"/><image width="720" height="${desktopHeight / 2}" href="data:image/png;base64,${desktop.toString('base64')}"/><image y="${desktopHeight / 2}" width="720" height="180" href="data:image/png;base64,${bannerPng.toString('base64')}"/><image x="720" width="390" height="${narrowHeight}" href="data:image/png;base64,${narrow.toString('base64')}"/><image y="${desktopHeight / 2 + 180}" width="390" height="205" href="data:image/png;base64,${ogPng.toString('base64')}"/></svg>`;
    writeFileSync(`${directory}/${candidate.id}-${theme}-overview.png`, new Resvg(svg).render().asPng());
  }
}
writeFileSync(`${directory}/render-receipts.json`, JSON.stringify(receipts.map(receipt => ({ ...receipt, sha256: createHash('sha256').update(readFileSync(`${directory}/${receipt.file}`)).digest('hex') })), null, 2) + '\n');
writeFileSync(`${directory}/contrast.json`, JSON.stringify(Object.fromEntries(candidates.map(candidate => [candidate.id, reviewAudit(candidate)])), null, 2) + '\n');
console.log(`${receipts.length} viewport PNGs and 6 overview sheets generated from package sources`);

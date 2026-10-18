/** Render review images from the exact generated SVG assets and image APIs. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { banner } from '../dist/banner.js';
import { ogImage, renderPng } from '../dist/og.js';
mkdirSync('.cache/previews', { recursive: true });
for (const theme of ['light', 'dark'] as const) {
  const background = theme === 'light' ? '#F3F5F8' : '#0F1528';
  const mark = readFileSync(`logo/mark${theme === 'dark' ? '-dark' : ''}.svg`, 'utf8');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="${background}"/><g transform="translate(36 36)">${mark}</g></svg>`;
  writeFileSync(`.cache/previews/mark-${theme}.png`, new Resvg(svg).render().asPng());
  writeFileSync(`.cache/previews/banner-${theme}.png`, renderPng(banner({ name: 'pm-web', tagline: 'Keep every agent on the same page.', theme })));
  writeFileSync(`.cache/previews/og-${theme}.png`, renderPng(ogImage({ title: 'Context for any agent and task', eyebrow: 'Context management', product: 'pm-web', theme })));
}
for (const product of ['pm', 'web', 'gpt', 'mcp', 'search', 'swarm']) {
  for (const family of ['lockup', 'lockup-mark']) {
    for (const theme of ['light', 'dark'] as const) {
      const background = theme === 'light' ? '#F3F5F8' : '#0F1528';
      writeFileSync(`.cache/previews/${family}-${product}-${theme}.png`, new Resvg(readFileSync(`logo/${family}-${product}-${theme}.svg`, 'utf8'), { background }).render().asPng());
    }
  }
}
for (const theme of ['light', 'dark'] as const) {
  const background = theme === 'light' ? '#F3F5F8' : '#0F1528';
  const color = theme === 'light' ? '#1B2340' : '#E7EAF3';
  const mark = readFileSync('logo/mark-mono.svg', 'utf8');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" style="color:${color}"><rect width="320" height="320" fill="${background}"/><g transform="translate(36 36)">${mark}</g></svg>`;
  writeFileSync(`.cache/previews/mark-mono-${theme}.png`, new Resvg(svg).render().asPng());
}

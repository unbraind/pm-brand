/** Direct Bun runtime acceptance complements the Node coverage suite. */
import { test, expect } from 'bun:test';
import { tokens, cssVar } from '../dist/index.js';
import { banner } from '../dist/banner.js';
import { ogImage, renderPng } from '../dist/og.js';

test('Bun consumes typed tokens and portable banners', () => {
  expect(tokens.dark.paper).toBe('#0F1528');
  expect(cssVar('paper')).toBe('var(--pm-paper)');
  expect(banner({ name: 'pm-web', tagline: 'In triplicate' })).toContain('width="1280"');
});

test('Bun renders a dark OG PNG with the optional native peer', () => {
  const png = Buffer.from(renderPng(ogImage({ title: 'In triplicate', eyebrow: 'pm', product: 'pm-web', theme: 'dark' })));
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

/** Public-export smoke scenario copied into isolated packed consumers. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tokens, cssVar } from 'pm-brand';
import { banner } from 'pm-brand/banner';
import { ogImage, renderPng } from 'pm-brand/og';
import { contrast } from 'pm-brand/contrast';
assert.equal(tokens.light.paper, '#F3F5F8');
assert.equal(cssVar('--pm-paper'), 'var(--pm-paper)');
assert.equal(contrast('#000000', '#FFFFFF'), 21);
assert.match(banner({ name: 'pm-web', tagline: 'One identity' }), /width="1280"/);
const png = Buffer.from(renderPng(ogImage({ title: 'One identity', eyebrow: 'Triplicate', product: 'pm-web', theme: 'dark' })));
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
for (const asset of ['tokens.css', 'fonts.css', 'fonts/archivo-latin.woff2', 'fonts/OFL.txt', 'logo/mark.svg', 'icons/icon-512.png', 'CONTRACT.md', 'package.json']) assert.ok(readFileSync(new URL(import.meta.resolve(`pm-brand/${asset}`))).length > 0);
console.log('Public exports, relative fonts, portable SVG and native PNG accepted');

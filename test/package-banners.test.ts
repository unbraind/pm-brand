/** Validate generated assets with real filesystem corruption, independently of the catalog generator. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateBanners, readCatalog } from '../scripts/banners.ts';

test('the public fleet catalog includes all 26 packages and real descriptions in accessible SVG metadata', () => {
  const catalog = readCatalog('banners/packages.json');
  assert.equal(catalog.length, 26);
  assert.ok(catalog.some(item => item.repository === 'pm-brand'));
  assert.equal(catalog.find(item => item.repository === 'pm-web')?.name, '@unbrained/pm-web');
  assert.equal(generateBanners(process.cwd(), true), 52);
  for (const item of catalog) for (const suffix of ['', '-dark']) {
    const svg = readFileSync(`banners/${item.repository}${suffix}.svg`, 'utf8');
    assert.ok(svg.includes(item.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')));
    assert.match(svg, /<path /u);
    assert.doesNotMatch(svg, /<text|<image|@font-face|https?:\/\/(?!www\.w3\.org)/u);
  }
});

test('the stale gate rejects changed, missing and surplus assets and a metadata change requires rebuilding', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-banners-'));
  try {
    mkdirSync(join(root, 'banners'));
    const catalog = [{ name: 'pm-brand', repository: 'pm-brand', description: 'Public package description' }];
    const path = join(root, 'banners/packages.json');
    writeFileSync(path, JSON.stringify(catalog));
    assert.equal(generateBanners(root, false), 2);
    assert.equal(generateBanners(root, true), 2);
    const original = readFileSync(join(root, 'banners/pm-brand.svg'));
    writeFileSync(join(root, 'banners/pm-brand.svg'), 'stale');
    assert.throws(() => generateBanners(root, true), /Stale banner pm-brand.svg/u);
    generateBanners(root, false);
    assert.deepEqual(readFileSync(join(root, 'banners/pm-brand.svg')), original);
    rmSync(join(root, 'banners/pm-brand-dark.svg'));
    assert.throws(() => generateBanners(root, true), /ENOENT/u);
    generateBanners(root, false);
    catalog[0].description = 'Changed package description';
    writeFileSync(path, JSON.stringify(catalog));
    assert.throws(() => generateBanners(root, true), /Stale banner/u);
    generateBanners(root, false);
    writeFileSync(join(root, 'banners/retired.svg'), 'surplus');
    assert.throws(() => generateBanners(root, true), /Surplus banners/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('catalog validation refuses traversal, duplicate names, the excluded host, empty descriptions and malformed data', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-catalog-'));
  const path = join(root, 'catalog.json');
  const item = { name: 'pm-brand', description: 'Brand kit', repository: 'pm-brand' };
  try {
    for (const data of [[], {}, [null], [item, item], [{...item, repository: '../escape'}], [{...item, repository: 'pm-cli'}], [{...item, description: ''}], [{...item, description: 'two\nlines'}], [{...item, name: 1}]]) {
      writeFileSync(path, JSON.stringify(data));
      assert.throws(() => readCatalog(path));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/** Generate the committed public fleet banner set from its reviewed package metadata snapshot. */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { banner } from '../dist/banner.js';

/** One public fleet package; repository is the immutable asset filename stem. */
export interface FleetPackage {
  /** Exact npm package name, including a scope when present. */
  readonly name: string;
  /** Real one-line package.json description, retained in accessible SVG metadata. */
  readonly description: string;
  /** Public repository basename, also used for scoped package banner filenames. */
  readonly repository: string;
}

/** Validate the standalone metadata snapshot without requiring sibling checkouts or network access. */
export function readCatalog(path: string): FleetPackage[] {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Expected a nonempty package catalog');
  const seen = new Set<string>();
  return raw.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid package metadata');
    const item = entry as Record<string, unknown>;
    if (typeof item.name !== 'string' || !item.name || typeof item.description !== 'string' || !item.description.trim() || /[\r\n]/u.test(item.description) ||
        typeof item.repository !== 'string' || !/^pm-[a-z0-9-]+$/u.test(item.repository) || item.repository === 'pm-cli' || seen.has(item.repository)) throw new Error('Invalid or duplicate public package metadata');
    seen.add(item.repository);
    return { name: item.name, description: item.description, repository: item.repository };
  });
}

/** Render fixed light/dark path-based SVGs, or fail on missing, stale or surplus generated assets. */
export function generateBanners(root: string, check: boolean): number {
  const directory = resolve(root, 'banners');
  const packages = readCatalog(resolve(directory, 'packages.json'));
  const files = new Map<string, string>();
  for (const item of packages) for (const theme of ['light', 'dark'] as const) {
    const name = `${item.repository}${theme === 'dark' ? '-dark' : ''}.svg`;
    if (files.has(name)) throw new Error(`Banner filename collision: ${name}`);
    files.set(name, banner({ name: item.name.replace(/^@[^/]+\//u, ''), tagline: item.description, theme }));
  }
  mkdirSync(directory, { recursive: true });
  const surplus = readdirSync(directory).filter(name => /\.(?:svg|png)$/u.test(name) && !files.has(name));
  if (surplus.length > 0) throw new Error(`Surplus banners: ${surplus.join(', ')}`);
  for (const [name, content] of files) {
    const path = resolve(directory, name);
    if (check) {
      if (readFileSync(path, 'utf8') !== content) throw new Error(`Stale banner ${name}; run npm run banners:build`);
    } else writeFileSync(path, content);
  }
  return files.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`${generateBanners(process.cwd(), process.argv.includes('--check'))} deterministic package banners verified`);
}

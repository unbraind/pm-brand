# pm-brand · Triplicate

One shared identity for pm-cli.unbrained.dev, pm-web, pm-gpt, pm-mcp and pm-search:
cool form paper, carbon-blue ink, canary and rose copies, and violet stamp ink.
[CONTRACT.md](CONTRACT.md) defines the visual grammar and every public token.

**Release held: depend on an exact commit until the first release.**

```json
{ "dependencies": { "pm-brand": "github:unbraind/pm-brand#<40-character-commit>" } }
```

![Three sheets in triplicate](logo/mark.svg)

## CSS

```css
@import "pm-brand/tokens.css";
@import "pm-brand/fonts.css";

body {
  background: var(--pm-paper);
  color: var(--pm-carbon);
  font-family: var(--pm-font-body);
}
h1 {
  font-family: var(--pm-font-display);
  font-stretch: 125%;
  font-weight: 800;
}
```

Set `data-theme="light"` or `data-theme="dark"` on the root for an explicit
choice. Otherwise `prefers-color-scheme` applies. Reduced motion sets `--pm-dur`
to zero. Focus uses `--pm-focus` with `--pm-focus-offset` on interactive elements.

## Palette

| Token suffix | Light | Dark | Role |
|---|---|---|---|
| paper | #F3F5F8 | #0F1528 | Page |
| sheet | #FFFFFF | #171F37 | Items, panels, forms |
| carbon | #1B2340 | #E7EAF3 | Text, outlines |
| graphite | #535B70 | #A2A9BD | Secondary text |
| rule | rgba(27,35,64,.14) | rgba(231,234,243,.14) | Hairlines |
| canary | #E9C53A | #D7B53A | In progress, second copy |
| canary-wash | #FBF1C6 | #3A331C | In-progress chip fill |
| rose | #DE7F9C | #D07E97 | Blocked, third copy |
| rose-wash | #F9DDE5 | #3D2432 | Blocked chip fill |
| stamp | #5B3FC4 | #A894FF | Actions, links, focus, closed |
| stamp-wash | #ECE7FB | #2A2450 | Selection and hover |
| on-stamp | #FFFFFF | #0F1528 | Text on stamp |
| danger | #B42E3A | #F07A84 | Errors and destructive actions |

Status tokens are `--pm-status-<open|in_progress|blocked|closed|canceled>-<fg|bg|border>`.
Shape, fill and line-through convey state alongside colour. The contract's
canary/rose borders in light mode and canceled borders in both modes currently
fail 3:1. [All 68 comparisons and proposed fixes](docs/contrast.md) are recorded;
those border exceptions require an owner decision. Text and focus comparisons pass.

## Type

| Role | Family | Setting |
|---|---|---|
| Display | Archivo | 125% width, weight 800; mark weight 900 |
| Caption | Archivo | 75% width, weight 600, uppercase, .09em tracking |
| Body | Public Sans | Weights 400–700 |
| Data | Martian Mono | Weights 400–700, widths 75–112.5% |

Self-hosted normal Latin WOFF2 files use `font-display: swap` and relative URLs.
Fallback overrides are calculated from shipped font metrics and pinned measured
Arial/Courier New metrics. No Google Fonts or third-party CDN requests are needed.
Every requested encoded character available upstream is retained; optional
unencoded alternates/ligatures are omitted. [Exact sources and metrics](fonts/SOURCES.md).

| Font | Bytes |
|---|---:|
| Archivo | 71,544 |
| Public Sans | 20,756 |
| Martian Mono | 24,252 |
| **Total / maximum** | **116,552 / 120,000** |

Code is MIT; fonts and their derived outline data are SIL OFL 1.1. Each family's
copyright and complete licence are bundled in [fonts/OFL.txt](fonts/OFL.txt).

## TypeScript

```ts
import { tokens, cssVar } from 'pm-brand';

const paper = tokens.light.paper;              // #F3F5F8
const body = tokens.dark['font-body'];         // complete font stack
const outline = cssVar('status-open-border'); // var(--pm-status-open-border)
const focus = cssVar('--pm-focus');
```

`tokens.light` and `tokens.dark` contain every contract suffix, including colour,
status, font, scale, radius, focus and motion tokens. Reference-valued tokens
remain CSS references. `cssVar` accepts only known suffixes or full `--pm-` names.
A parity test parses the independent stylesheet in both dark selectors and light
mode; changing one side alone fails the gate.

## README banners and Open Graph cards

```ts
import { writeFile } from 'node:fs/promises';
import { banner } from 'pm-brand/banner';
import { ogImage, renderPng } from 'pm-brand/og';

await writeFile('banner.svg', banner({
  name: 'pm-web', tagline: 'Keep every agent on the same page.', theme: 'light',
}));
await writeFile('og.png', renderPng(ogImage({
  title: 'Work orders, in triplicate', eyebrow: 'Project management',
  product: 'pm-web', theme: 'dark',
})));
```

Banners are 1280×320; OG cards are 1200×630. The generators use pinned Archivo
and Public Sans glyph paths, so their SVGs need no external font or platform text
renderer. Names and taglines ellipsize; OG titles wrap to at most three measured
lines. XML syntax is escaped, controls are rejected, and unsupported characters
render as a question mark while accessible metadata retains the original text.

`pm-brand/banner` works without native dependencies. `pm-brand/og` and its
`renderPng` require the optional peer `@resvg/resvg-js` (`npm install @resvg/resvg-js`).
The root token export never imports the native renderer and is suitable for web
bundlers. Rendering helpers are intended for build tools and server environments.

## Exports and assets

| Export | Contents |
|---|---|
| `pm-brand` | `tokens`, `cssVar`, `Theme`, `TokenName` |
| `pm-brand/banner` | `banner`, `BannerOptions` |
| `pm-brand/og` | `ogImage`, `renderPng`, `OgOptions` |
| `pm-brand/contrast` | WCAG colour parsing, luminance, contrast and complete audit |
| `pm-brand/tokens.css` | All custom properties and theme/motion selectors |
| `pm-brand/fonts.css` | Brand faces and measured fallback faces |
| `pm-brand/fonts/*` | Three WOFF2 subsets, OFL licences, source receipts |
| `pm-brand/logo/*` | Light, dark, currentColor marks; PM/WEB/GPT/MCP/SEARCH/SWARM lockups |
| `pm-brand/icons/*` | SVG favicon; 32, 180, 192, 512 PNGs and maskable 512 PNG |
| `pm-brand/CONTRACT.md` | Shared visual contract |
| `pm-brand/package.json` | Package metadata |

All mark lettering is Archivo width 125 / weight 900 as paths; condensed lockup
captions are also paths. A single TypeScript generator owns the geometry. The
maskable icon keeps its foreground inside the central safe circle.

## Development

```sh
npm ci
npm run release:check
bun run release:check
bun test ./test/bun.acceptance.ts
```

The gates check strict erasable TypeScript, ESLint, documented declarations,
100/100/100/100 coverage of **all `src/` files**, fonts, public paths and identities,
tracker health, production dependencies, packed exports, and generated changelog.
Packed npm and Bun consumers exercise tokens, CSS/assets, banners and native PNGs.
The contrast gate permits only the ten documented seed-contract border failures;
it fails on any new exception. It does not certify every border as AA.

To regenerate fonts, install fontTools 4.65.0 and brotli 1.2.0, then run
`npm run fonts:build` and `npm run assets:build`. Font sources are pinned and every
path-based asset is derived from them. Rebuild image snapshots only after reviewing
an intentional design change.

`npm run changelog:full` uses pm-changelog's `--no-pending-release`, keeping entries
under **Unreleased**. The release workflow is dormant unless the owner explicitly
enables `PM_BRAND_RELEASE_ENABLED`; local publishing is blocked. Dependabot
scheduling is configured, but auto-merge has its own dormant opt-in while branch
protection is absent. No release or repository policy changes are authorized by
these development commands.

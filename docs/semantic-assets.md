# Semantic asset change reports

`pm-brand semantic-diff examples/semantic-assets.json --format toon` compares two
generated SVG strings and returns exactly two findings: a status paint change at
`#status` and a truncated visible label at `#label`. Exit codes are **0** for no
changes, **1** for a completed comparison with changes, and **2** for a refusal.

```ts
import { readFileSync } from 'node:fs';
import { compareSemanticAssets, renderSemanticAssetReport } from 'pm-brand';

const request = {
  version: 1,
  before: readFileSync('before.svg', 'utf8'),
  after: readFileSync('after.svg', 'utf8'),
  format: 'json',
  budget: 1600,
} as const;
const result = compareSemanticAssets(request); // pure, synchronous; no pm runtime
const report = await renderSemanticAssetReport(request); // lazy supported pm SDK
process.stdout.write(report.text);
```

The same exports are available from `pm-brand/semantic-assets`. Hosts may pass
their real `AccessibilityOutputSdk` as the second renderer argument. The existing
supported SDK loader handles standalone, global, project-local and runner
installations; it never searches argv or executable symlinks. Runtime comparison
needs no git, network, rasterizer, system fonts, tracker or writable directory.
The package's optional raster renderer is not imported on this path.

The **one strict request schema** accepts only `version: 1`, `before`, `after`,
optional `format` (`json` or `toon`, default TOON), and optional integer `budget`
(512–1,000,000, default 1,600). Both SVGs are limited to 1 MiB UTF-8, 4,096 parsed
elements, 32 levels and 32 attributes per element. CLI request files are regular
UTF-8 JSON files limited to 4 MiB. Extra fields, exotic objects and accessors are
refused. Unknown SVG constructs are refused before SDK loading. No input is
persisted, imported, exported into a tracker, synchronized or applied.

## What is compared

| Finding | Fields |
| --- | --- |
| `text` | Native text content; annotated visible outline runs |
| `token_role` | `fill`, `stroke`, `color`, `data-role`, `data-token` |
| `geometry` | Coordinates, transforms, paths, shape attributes, structure, paint order |
| `accessibility` | `role`, `aria-label`, references, hidden state, title and description text |

Locators use a unique XML id (`#status`) when available, otherwise a deterministic
per-element-type sibling path (`svg[1]/g[2]/path[1]`). Attribute reordering,
single/double quotes, comments, element indentation, UTF-8 BOM, CRLF, equivalent XML entities,
self-closing syntax, decimal/exponent spelling, hex case/shorthand and the five
supported named color equivalents produce no findings. XML attribute whitespace
and [SVG 2 default text whitespace](https://www.w3.org/TR/SVG2/text.html#WhiteSpace)
are normalized by the parser. Non-breaking and other Unicode spaces are retained. Unicode text is
otherwise preserved. Numeric spelling is canonicalized without rounding.

New banners and OG cards annotate each visible outlined run with `data-text`.
Such a group may contain only direct path children with `d` and `transform`.
The parser hashes the complete, canonical, ordered outline geometry. Text changes
produce one localized finding containing **both the visible text and outline
digest**; independent outline edits with unchanged text produce a geometry
finding. This groups glyph details without hiding edited paths. Summary node
counts count comparison units after these runs are grouped. Old unannotated
outlines still compare as geometry; their original visible characters cannot be
recovered from arbitrary paths. Metadata describes the producer's declared text,
not OCR or verification of font shaping.

`before_json` and `after_json` are lossless JSON literals, also inside TOON; null
denotes absence. Reports are complete or refused. A budget refusal retains full
counts and `required_budget` from **pm's own output accounting**, with a remedy to
increase the budget or compare smaller assets. Nothing is silently truncated.
Every emitted count and estimate is a finite, bounded integer. CLI file/usage
errors also carry a stable code, schema coordinate and remedy.

## Supported static SVG grammar

Elements: `svg`, `g`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`,
`polygon`, `text`, `title`, `desc`. Only one SVG root is
accepted. Only svg/g may contain child elements. Mixed text/child content,
tspan shaping, nested SVGs and duplicate ids are refused.
Ids follow `[A-Za-z_][A-Za-z0-9_.:-]*` and are at most 256 characters. XML 1.0
declarations with optional UTF-8 encoding and standard/numeric entities work.
DTD, custom entities, CSS, classes, styles, references (`use`, href, url), images,
gradients, filters, animation, scripts and unknown elements/attributes refuse.
Use a resolved static producer or split the asset into supported components.

Supported attributes:

- `xmlns` (SVG namespace), `id`, `data-role`, `data-token`, `data-text`, `data-lines`.
- `role`: img, presentation, none, graphics-document, graphics-symbol;
  `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-hidden` (true/false).
- `fill`, `stroke`, `color`: 3/6/8-digit hex, black/white/red/green/blue,
  none/currentColor/transparent, or an explicit `var(--pm-...)` token from the kit.
- `x`, `y`, `x1`, `x2`, `y1`, `y2`, `cx`, `cy`, `width`, `height`, `rx`, `ry`, `r`,
  `viewBox`, `transform`, `d`, `points`, `opacity`, `fill-opacity`, `stroke-opacity`,
  `stroke-width`, `font-size`, `fill-rule`, `stroke-linecap`, `stroke-linejoin`,
  `text-anchor`.

Numbers must be finite and within ±1e9; sizes/radii/stroke widths/font sizes and
data-lines are nonnegative, opacities are 0–1. No units or percentages are
accepted. View boxes have four values with nonnegative sizes; point lists contain
at least two pairs. Path commands use SVG command arities and valid arc radii and
flags; at most 32,768 tokens per numeric attribute are accepted. Transform
functions are matrix/translate/scale/rotate/skewX/skewY with their SVG arities.

This is bounded static review evidence. It does not prove rendered equivalence,
resolve CSS inheritance or accessible-name references, compute contrast, equate
different path commands/matrices, or certify arbitrary SVG/browser behavior.
Moving anonymous siblings can change structural locators; supply stable ids for
structural edits. Added/removed nodes are localized as element findings. Existing
accessibility diagnostics remain responsible for contrast; pm-vcs owns versioned
bytes and generic diffs. Tracker roles are not interpreted by this feature.

## Validation

`node --test --test-concurrency=2 test/semantic-assets.test.ts` covers exact
acceptance cases, must-allow legacy assets, must-refuse constructs, extreme
numeric inputs/outputs and no-git CLI execution with no git executable. A seeded
model exercises 500 sequences / 6,000 transitions, older-input replays, JSON/TOON
round trips, CRLF and attribute whitespace. It compares findings to an independent
field model and reads the native tracker document back through the real SDK after
every sequence, including preserved relationships, linked evidence, annotations,
body and ambient focus. The product itself has no import/export/sync or mutable
state paths, so there are no target revisions, retry journals or leases to apply.

`node scripts/semantic-assets-real-data.ts <read-only-tracker-root>` reads a public
fleet tracker copy in a non-git scratch directory, renders title-derived SVGs and
measures identity/noise/change comparisons, both wire formats and SDK accounting.
It checks complete SDK read-back and byte hashes before and after. Only aggregate
counts and source provenance should be published.

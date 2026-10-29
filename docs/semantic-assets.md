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
| `geometry` | Coordinates, transforms, paths, shape attributes, parent context, retained-child paint order |
| `accessibility` | `role`, `aria-label`, references, hidden state, title and description text |

Locators use a unique XML id (`#status`) when available, otherwise a deterministic
per-element-type sibling path (`svg[1]/g[2]/path[1]`). Attribute reordering,
single/double quotes, comments, inert processing instructions, CDATA/text equivalents,
SVG namespace prefixes, element indentation, UTF-8 BOM, CRLF, equivalent XML entities,
self-closing syntax, decimal/exponent spelling, hex case/shorthand and the five
supported named color equivalents produce no findings. XML attribute whitespace
and [SVG 2 default text whitespace](https://www.w3.org/TR/SVG2/text.html#WhiteSpace)
are normalized by the XML parser and SVG projection respectively. Non-breaking and other Unicode spaces are retained. Unicode text is
otherwise preserved. Numeric spelling is canonicalized without rounding.

New banners and OG cards annotate each visible outlined run with `data-text`.
Such a group's geometry children must be direct paths with `d` and `transform`;
direct `title`/`desc` children retain their separate metadata order.
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
declarations with optional UTF-8 encoding and standard/numeric entities inside
elements and attributes work. A maintained, dependency-free XML 1.0 parser,
[@rgrove/parse-xml](https://github.com/rgrove/parse-xml), owns XML tokenization,
contextual decoding and line endings. No hand-written XML decoder remains.
Literal `]]>` is legal inside an attribute; in text use `]]&gt;` or split CDATA
sections. CDATA and ordinary text project to the same content, and comments/inert
processing instructions preserve surrounding text. Default and prefixed SVG
namespace bindings canonicalize by local element name and resolved SVG URI;
foreign namespaces and namespaced presentation attributes are outside the subset.
Legacy unprefixed SVG fragments, including a root with `xmlns=""`, retain their
existing compatibility behavior. This mode follows ancestry: once an element
resolves to the SVG namespace, its descendants must also resolve to that namespace.
An empty reset or absent default beneath a prefixed SVG parent returns
`unsupported_semantics`; it never becomes an SVG element by local-name matching.
A prefixed SVG element remains valid when its default namespace is empty, and a
descendant may explicitly restore the SVG default. Sibling branches keep their
own bindings and compatibility context.
Outside the root element, literal XML whitespace, comments and inert processing
instructions are accepted. Character/entity references in the prolog or epilog
refuse before decoding, even when they would expand to whitespace.
The XML parser never loads an external DTD or resolves custom entities; no
resolver is installed and the parser has no file or network I/O. Parsed DTDs
and stylesheet processing instructions are refused by semantic policy. The 1 MiB
byte bound is enforced before parsing; projection bounds are 4,096 elements,
32 levels, 32 attributes per element (including namespace declarations), and
32,768 geometry lexemes per attribute. Parser failures, including its resource
exhaustion rejection, are caught and sanitized.

`unsupported_svg` means XML parser rejection or an exceeded resource limit.
`unsupported_semantics` means well-formed XML outside the documented comparison
domain; both preserve the requested format, failing input side and remedy.
All previous must-refuse inputs remain refused under this more precise distinction.
DTD, custom entities, CSS, classes, styles, references (`use`, href, url), images,
gradients, filters, animation, scripts and unknown elements/attributes refuse.
Use a resolved static producer or split the asset into supported components.

Supported attributes:

- `xmlns` / `xmlns:prefix` (namespace bindings), `id`, `data-role`, `data-token`, `data-text`, `data-lines`.
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

An id anchors identity, not ancestry: retained nodes report a `parent` finding
when moved between groups, including groups with different transforms, inherited
paint or accessibility context. This also applies to labeled outline groups and
descriptive metadata. Retained siblings report relative paint-order changes even
when other children are inserted, removed or reparented in the same comparison.
Added/removed element snapshots include their parent; insertion alone remains one
element finding. The comparator reports the changed context without computing
world-space geometry or inherited CSS values.

Direct child order is retained even for non-painting metadata. Separate
`aria-title-order` and `aria-desc-order` accessibility findings report reordered
retained titles and descriptions, including alongside insertions/removals and
inside annotated outline groups. Outline grouping removes only grouped glyph
paths from that sequence and keeps the metadata. Moving a title across a
description without changing either type's own order produces no paint or
metadata-order noise. ARIA label/description reference-list order remains part of
the attribute value. These are source-order facts relevant to
[SVG name and description computation](https://www.w3.org/TR/svg-aam-1.0/), not a
claim to resolve the final accessible name, language selection or ARIA precedence.

The [SVG path grammar](https://www.w3.org/TR/SVG11/paths.html#PathDataBNF)
defines flags as exact `0`/`1` characters. Decimal, signed, exponent and padded
aliases are refused in both flag positions of every explicit or implicit arc
segment, before number normalization. Arc radii use unsigned number lexemes.
This bounded grammar requires arc flags to be separated into distinct numeric
tokens; compact flag/coordinate concatenations may require explicit separators.
Transform/view-box/point lists require actual XML whitespace or commas, and XML
markup accepts only XML whitespace. Unicode spaces remain content, never syntax.
Once the request schema validates, typed SVG refusals retain the requested JSON or
TOON format; schema-invalid requests are JSON. The shared contrast parser likewise
uses [CSS whitespace](https://www.w3.org/TR/css-syntax-3/#whitespace), so malformed
color syntax cannot be normalized into a valid consumer accessibility result.

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

`test/semantic-review.test.ts` adds 500 topology sequences / 4,000 transitions
against an independent ordered-membership model, 500 contextual arc-flag probes,
the complete shared topology/lexical corpus in both encodings, and actual CLI
execution on a non-git tracker. Representative cases are also run through all six
packed installation modes and packed/Git SDK consumers, using the same fixture
producer. Existing acceptance and replay regressions remain unchanged.

A further 500-sequence / 4,000-transition metadata model independently tracks title
and description ordering across root SVGs, groups and outline groups, including
older-input replays, reparenting and membership changes. Positive controls keep
paint order separate and retain harmless serialization changes.

A document-context model adds 500 sequences / 4,000 transitions with older-input
replays, decimal/hex whitespace references, both boundaries and both inputs. A
separate offline Resvg parser checks malformed references and legal controls without
raster generation or system font loading; product execution needs neither renderer
nor network. Shared fixtures carry those refusals and legal controls through every
supported consumer.

The XML conformance corpus adds 54 equivalent pairs spanning attribute delimiters,
escaping, decimal/hex references, CDATA, comments, processing instructions,
namespaces, BOM and CRLF. A further 500-sequence / 4,000-transition serialization
model replays random source values in equivalent namespace/escaping/CDATA forms;
every comparison must have zero findings in both complete wire encodings.

A namespace model adds 500 sequences / 4,000 transitions with older-input replays,
default resets, qualified names and inherited bindings. An independent Resvg
geometry oracle distinguishes retained rectangles from missing content without
raster generation or font loading. A shared 102-case namespace corpus covers every
supported element family and annotated glyph paths, both input sides, legacy
controls and valid qualified elements under empty defaults.

`node scripts/semantic-assets-real-data.ts <read-only-tracker-root>` reads a public
fleet tracker copy in a non-git scratch directory, renders title-derived SVGs and
measures identity/noise/change comparisons, both wire formats and SDK accounting.
It checks complete SDK read-back and byte hashes before and after. Only aggregate
counts and source provenance should be published.

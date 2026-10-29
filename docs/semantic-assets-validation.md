# Semantic asset validation evidence

Public source: `unbraind/pm-brand` main at
`26d209031410c40dee1ce2c4609db7fa1fedeacd`. The source repository was verified
public before copying only its committed `.agents/pm` tree to a non-git scratch
directory. All copied files and directories were read-only during evaluation;
git discovery was fenced at the scratch directory. Source data was never edited.

`scripts/semantic-assets-real-data.ts` read the complete tracker through
`PmClient.listAllComplete({includeBody:true})` and generated SVGs from its exact
native titles and ids. An identity pair and an attribute-reordered/CRLF pair used
real generated banners. A native text fixture per title changed one explicit paint
and shortened one visible label. Results:

| Measurement | Result |
| --- | ---: |
| Native items read | 16 |
| Generated source assets | 48 |
| Identity comparisons / semantic findings | 16 / 0 |
| Serialization-noise comparisons / findings | 16 / 0 |
| Edited comparisons / localized findings | 16 / 32 |
| JSON + TOON reports | 96 |
| Budget refusals at 512 estimated tokens | 0 |
| Largest report, SDK estimated tokens / UTF-8 bytes | 94 / 375 |
| Runtime raster / network calls | 0 / 0 |
| Complete SDK read-back | Unchanged |
| Tracker bytes | Unchanged |

Tracker byte SHA-256 before and after:
`e915fe74a3e229d567e0c4c1ce90ccf04dd849bd4727e21f3857373622f42e1e`.

The focused model test covers 500 seeded sequences, 6,000 transitions and 997
older-input replays. Each transition round-trips JSON/TOON and agrees with an
independent field model. Each sequence reads the complete seeded native document
through the actual SDK and checks relationships, linked evidence, annotations,
body and ambient focus remain intact. The feature touches no native field.
Focused source coverage measured 100% statements, branches, functions and lines
for both new modules, with unchanged repository coverage thresholds.

`node scripts/semantic-assets-revert-proof.ts` caught 30/30 independent behavioral
reverts in disposable copies. These cover the original paint/text/number/Unicode
regressions plus lost parent context, order hidden by changed membership, coerced
arc flags, signed radii, list separators, Unicode geometry/XML/CSS separators,
normalized invalid ids, and discarded refusal encoding. Metadata probes additionally
catch discarded non-painting order, sorted-away title/description precedence,
metadata lost during outline grouping, and paint-order misclassification. The XML
context probe restores entity expansion before the outside-root lexical check.
New probes reject valid attribute delimiters, discard decoded text, erase namespace
aliases and erase unknown entities before both validators. A complete behavioral replacement restores
the previous hand-written parser from Git into the disposable copy; the XML
conformance test must fail. No legacy decoder is kept in current source. Namespace probes additionally restore
unconditional absent-URI promotion, discard child namespace resets, and infer a
default namespace from qualified parents; all must fail the namespace tests. The
restored implementation passed all twelve selected acceptance regressions afterward.

Review round 1 added a second independent reference model: 500 topology sequences,
4,000 transitions and 802 older-input replays, with parent membership and retained
sibling order checked independently of the parser. A separate 500-probe lexical
property spans both arc commands, both flags and explicit/implicit segments. The
shared adversarial corpus now has 360 cases across shapes, metadata, annotated outlines
and contextual lexical boundaries. SDK, CLI, JSON/TOON, packed npm/Bun and Git
consumers share its representative fixtures. Packed CLI acceptance now executes
384 command-format scenarios across six installation modes, including 336 semantic
review regressions and 12 consumer color refusals.

Review round 2 adds an independent metadata model: 500 sequences, 4,000 transitions,
822 older-input replays and 756 order findings. It checks all six title/description
and root/group/outline domains, mixed membership/order changes and serialization
controls. Canonical children retain source order; paint, title and description
streams are derived independently. Annotated outlines remove only grouped paths
from the retained sequence. ARIA reference-list order also has explicit controls.

Review round 3 adds 80 malformed document-boundary cases and six must-allow
controls: every XML whitespace reference in decimal/hex form, leading zeroes,
prefix/suffix placement, intervening comments and both comparison sides. An
independent Resvg parser agrees without generating rasters or loading system fonts.
The document-context model covers 500 sequences, 4,000 transitions, 817 older-input
replays and 1,440 typed refusals, round-tripped through both complete encodings.
The maintained XML parser now enforces these document-boundary rules alongside
contextual attribute/text decoding; inside-root references retain their behavior.

Review round 4 replaces XML tokenization/decoding with `@rgrove/parse-xml` 5.0.0,
a maintained, pure JavaScript, dependency-free parser. It never loads DTDs or
resolves custom entities and is given no resolver. Package limits bound input
bytes before parsing and element/attribute/depth/geometry counts during projection.
`unsupported_svg` denotes parser failures, renderer rejection or limits; well-formed constructs
outside the semantic subset return `unsupported_semantics`. Every previous refusal
input remains tested with its exact side, code and remedy; no refusal is relaxed.

The conformance corpus adds 54 equivalent pairs across attribute/text escaping,
numeric/hex references, CDATA, comments, processing instructions, namespace aliases,
BOM and CRLF. Exact decoded-value assertions and changed-CDATA probes prevent a
lossy parser from satisfying equality by discarding both sides. A separate seeded
model re-serializes 500 random SVG sequences, 4,000 transitions and 808 older-input
replays with zero findings and complete JSON/TOON agreement. It also checks raw
accessible labels read from the canonical projection against its source-value model.

Review round 5 preserves resolved namespace identity. Round 6 supersedes its
bare-root compatibility with the renderer acceptance requirement: namespace-free
roots, including an empty root declaration, return `unsupported_svg`. Qualified
SVG names under an empty default and explicit SVG default restoration remain valid;
sibling scopes stay independent. Namespace loss within a renderer-accepted document
returns `unsupported_semantics` with a binding remedy.
The shared namespace corpus has 102 cases across every supported element family,
annotated glyph paths, both inputs, inherited resets and missing defaults. A new
500-sequence / 4,000-transition model agrees with independent Resvg geometry:
796 older-input replays, 2,362 accepted comparisons and 1,638 typed refusals.
No rasters or system fonts are used by that independent oracle.

The public read-only validation was repeated after these changes. Its original
16 items, 48 source assets, 48 comparisons, 32 localized findings and 96 reports
remain unchanged. Additional title-derived review probes produced:

| Review measurement | Result |
| --- | ---: |
| Reparenting comparisons / parent findings | 16 / 16 |
| Invalid arc flag refusals | 16 |
| Additional JSON/TOON reports | 64 |
| Largest review report, estimated tokens / bytes | 71 / 284 |

Additional round-2 probes on the same immutable copy yielded:

| Metadata measurement | Result |
| --- | ---: |
| Title-order comparisons | 16 |
| Description-order comparisons | 16 |
| Localized accessibility findings | 32 |
| Additional JSON/TOON reports | 64 |
| Largest metadata report, estimated tokens / bytes | 58 / 230 |

Round-3 prefix/suffix probes on the same immutable copy yielded:

| Document-boundary measurement | Result |
| --- | ---: |
| Comparisons / typed refusals | 32 / 32 |
| Additional JSON/TOON reports | 64 |
| Largest boundary report, estimated tokens / bytes | 62 / 246 |

Round-4 conformance probes on the same immutable copy yielded:

| XML conformance measurement | Result |
| --- | ---: |
| Equivalent title-derived comparisons / findings | 16 / 0 |
| Additional JSON/TOON reports | 32 |
| Largest XML report, estimated tokens / bytes | 21 / 83 |

Round-5 namespace probes on the same immutable copy yielded:

| Namespace measurement | Result |
| --- | ---: |
| Comparisons | 48 |
| Namespace-loss typed refusals | 32 |
| Qualified controls / findings | 16 / 0 |
| Additional JSON/TOON reports | 96 |
| Largest namespace report, estimated tokens / bytes | 71 / 284 |

Round-6 renderer validation probes on the same immutable copy yielded:

| Renderer measurement | Result |
| --- | ---: |
| Comparisons | 48 |
| Invalid namespace-prefix typed refusals | 32 |
| Accepted serialization controls / findings | 16 / 0 |
| Additional JSON/TOON reports | 96 |
| Largest renderer report, estimated tokens / bytes | 86 / 344 |

Both original strings must pass the pinned brand Resvg constructor before a
comparison succeeds. Its rejection yields `unsupported_svg` with the input side,
remedy and native diagnostic bounded to 512 characters. The maintained parsers
own namespace well-formedness; the projection only resolves semantic identity.
No additional hand-written prefix validation is introduced. Resource-bearing
constructs are refused before the constructor because the native binding can read
local images. System fonts are disabled, no resource resolver is installed and
`render()` is never called. The native binding loads lazily for comparison and is
a pinned runtime dependency; token-only imports do not load it.

Twenty-four shared renderer cases cover namespace declarations, prefixes, entities,
quoting and nesting on both input sides, including accepted controls. Six additional
packed representatives carry these checks through npm/Bun local/global installs,
npx/bunx, direct Bun, Git consumers and a non-git tracker. Every original regression
remains present. Valid synthetic semantic fixtures now declare the SVG namespace;
namespace-free originals remain explicitly tested as renderer refusals, as required
by round 6. The 500-sequence / 4,000-transition mutation property independently
checks Resvg rejection against both input sides and both complete encodings:
799 older-input replays, 4,290 native-rejected side checks, 3,592 accepted controls
and 118 stricter XML refusals. Parser-only refusals retain stricter Unicode-domain
validation. Exact native reasons and 512-character diagnostic bounds are tested,
including long unknown prefixes and refusal priority across the two input sides.

The existing parent/arc and boundary report maxima above reflect the more precise
XML versus semantic-policy remedies, including preservation of SVG namespace bindings.

Both complete SDK read-back and the tracker byte hash above stayed unchanged.
Runtime raster and network calls remained zero. Original tests were retained;
the round-1 coverage of three runtime modules and round-2 coverage of both changed
runtime modules measured
100% statements, branches, functions and lines at unchanged thresholds.

The 52 rebuilt committed SVG banners change only `data-text` metadata. SVG
snapshot hashes were refreshed for that serialization change; font outlines,
layout and palette are unchanged. Compiled JavaScript/declarations remain tracked
under the repository's script-free Git consumer contract. No raster or binary
artifact is added. Full release-gate results belong to the exact PR-head CI run.


## Browser and Node package boundaries

The package root re-exports only browser-safe code. Comparison and its report now
live at the typed Node-only `pm-brand/svg-compare` export; `semantic-assets` remains
a Node-only compatibility alias. Pure font preflight stays on the root and
`font-coverage`; its SDK-backed report moves to `font-coverage-report`. The existing
`og` and `accessibility-report` entries also use explicit `node` conditions. CLI,
SDK examples, npm/Bun consumers and Git consumers use these public Node entries.
The accepted SVG parser and comparison behavior is unchanged.

`node --test --test-concurrency=2 test/browser.test.ts` passed 3/3 tests. It bundles
root-token imports, the complete root, banner, contrast, accessibility and font
preflight plus both CSS entries with esbuild `platform: "browser"`, no externals,
aliases or shims. JavaScript bundles execute without Node globals; import metadata
must contain no Node built-ins, pm SDK or native renderer. Five Node-only subpaths
must refuse browser resolution. The same browser checks run against the captured
tarball after npm and Bun installs, with the comparison subpath exercised under
both Node and Bun. Git consumers run the same browser corpus.

The behavioral proof reintroduces only a root comparison export, a root SDK-backed
font-report export, or a renderer export on a pure subpath in disposable copies.
All 3/3 reverts fail browser bundling; restoring the source passes all eight browser
bundles and five Node-only refusals. Original SVG, wire, no-git and native-state
regressions remain in the full npm/Bun gates. No prior data validation is repeated
for this packaging-only change.

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

`node scripts/semantic-assets-revert-proof.ts` caught 21/21 independent behavioral
reverts in disposable copies. These cover the original paint/text/number/Unicode
regressions plus lost parent context, order hidden by changed membership, coerced
arc flags, signed radii, list separators, Unicode geometry/XML/CSS separators,
normalized invalid ids, and discarded refusal encoding. Metadata probes additionally
catch discarded non-painting order, sorted-away title/description precedence,
metadata lost during outline grouping, and paint-order misclassification. The XML
context probe restores entity expansion before the outside-root lexical check. The
restored implementation passed all eight selected acceptance regressions afterward.

Review round 1 added a second independent reference model: 500 topology sequences,
4,000 transitions and 802 older-input replays, with parent membership and retained
sibling order checked independently of the parser. A separate 500-probe lexical
property spans both arc commands, both flags and explicit/implicit segments. The
shared adversarial corpus now has 180 cases across shapes, metadata, annotated outlines
and contextual lexical boundaries. SDK, CLI, JSON/TOON, packed npm/Bun and Git
consumers share its representative fixtures. Packed CLI acceptance now executes
204 command-format scenarios across six installation modes, including 156 semantic
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
Runtime validation checks raw document whitespace before expanding entities;
inside-root text and attribute references retain their existing behavior.

The public read-only validation was repeated after these changes. Its original
16 items, 48 source assets, 48 comparisons, 32 localized findings and 96 reports
remain unchanged. Additional title-derived review probes produced:

| Review measurement | Result |
| --- | ---: |
| Reparenting comparisons / parent findings | 16 / 16 |
| Invalid arc flag refusals | 16 |
| Additional JSON/TOON reports | 64 |
| Largest review report, estimated tokens / bytes | 91 / 361 |

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
| Largest boundary report, estimated tokens / bytes | 91 / 361 |

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

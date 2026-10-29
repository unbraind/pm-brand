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

`node scripts/semantic-assets-revert-proof.ts` caught 4/4 independent behavioral
reverts: ignored paint, ignored visible text, ignored parsed paint values, and
retained numeric spelling noise. All reverts ran in disposable copies. The
restored implementation passed both unchanged acceptance regressions afterward.

The 52 rebuilt committed SVG banners change only `data-text` metadata. SVG
snapshot hashes were refreshed for that serialization change; font outlines,
layout and palette are unchanged. Compiled JavaScript/declarations remain tracked
under the repository's script-free Git consumer contract. No raster or binary
artifact is added. Full release-gate results belong to the exact PR-head CI run.

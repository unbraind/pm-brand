# Font coverage preflight

`preflightFontCoverage` checks proposed UI or banner labels against the exact
shipped outline repertoire used by `textPaths`. `renderFontCoverageReport` adds
budgeted TOON or JSON using the pm SDK's public token accounting. Pure preflight is available from the browser-safe `pm-brand` and
`pm-brand/font-coverage` entries. The SDK-backed report is Node-only and available
from `pm-brand/font-coverage-report`.

```ts
import { preflightFontCoverage } from 'pm-brand';
import { renderFontCoverageReport } from 'pm-brand/font-coverage-report';

const request = {
  version: 1,
  labels: [{ locator: '#title', role: 'display', text: 'Ship 🚀' }],
};
const diagnosis = preflightFontCoverage(request);
const report = await renderFontCoverageReport(request);
console.log(report.text);
```

```sh
pm-brand font-coverage examples/font-coverage.json
pm-brand font-coverage examples/font-coverage.json --format json --budget 1600
```

The example evaluates 4 labels and 19 code points: 14 supported, 5 unsupported,
3 failed labels. Only those 3 labels appear in the default report. A completed
diagnosis has `ok: true` even when coverage fails. CLI exit codes are 0 for full
coverage, 1 for a completed diagnosis with failing labels, and 2 for a refusal.

Every row preserves the exact locator and font role. `text_json` is a JSON
string literal (including its quotes): `JSON.parse(row.text_json)` recovers the
original text exactly. This representation lets TOON report malformed UTF-16
without throwing or changing a code point. `mark`, `display` and `caption`
select pinned Archivo outline instances; `body` selects Public Sans. Supported
positions use that font's glyph directly. Every issue reports its zero-based
code point index, UTF-16 offset, uppercase `U+` code and route:

- `question_mark`: valid XML but absent from the shipped table; the renderer
  currently substitutes `?`. Choose an explicit replacement or another renderer.
- `reject_xml`: the renderer rejects this code point, including controls and
  unpaired surrogates. Remove or explicitly replace it before rendering.

Combining marks, variation selectors and joiners are checked individually.
No normalization, transliteration, grapheme substitution or silent truncation
occurs. For example, precomposed `é` is supported while `e` followed by U+0301
requires an explicit decision. All original points satisfy
`code_points = supported + unsupported + invalid`. A failing label never
prevents evaluation of the other labels.

This checks outline coverage for proposed text. It does not certify CSS font
loading, browser/system fallback, emoji composition, shaping, layout fit or
post-layout ellipsizing. The CSS stack can choose platform fonts whose coverage
cannot be established from this package. `mono` is refused because the outline
renderer has no Martian Mono role.

The single strict request schema accepts `version: 1`, a dense `labels` array
of 0–100 plain objects, optional boolean `include_all`, `format: "json"|"toon"`
and integer `budget` from 512 to 1,000,000. Each label requires `locator` (1–256
UTF-16 units, nonblank, no controls or unpaired surrogates), exact `text` (0–512
code points) and a supported `role`. Unknown keys, accessors, symbols, sparse
arrays and non-finite numbers are refused. Empty labels and verbatim legacy text
remain valid; invalid XML text becomes a label-level diagnostic. The CLI reads
regular UTF-8 JSON files of at most 4 MiB. It accepts `--format` and `--budget`
once each; `include_all` belongs in the request file.

TOON and a 1,600 estimated-token ceiling are the report defaults. `include_all:
true` emits passing labels too. A budget refusal preserves the full summary and
`required_budget`; increase the budget to that exact value or split the batch.
No issue is omitted to fit a budget. Invalid schema, missing SDK and invalid
producer numbers return typed refusals with remedies. Invalid requests are
JSON; validated requests retain the selected encoding even on refusal.

The synchronous function has no host dependency at runtime. Reporting lazily
uses the existing supported `@unbrained/pm-cli/sdk` loader, or accepts a
host-injected public `attachOutputTokenAccounting` capability as its second
argument. SDK acquisition never depends on the executable's location.

## Without git

Both SDK functions and the CLI work in plain directories with no tracker and
with no `git` executable. They do not read or mutate tracker state. Tests also
use a real non-git SDK tracker to verify native fields and relationships remain
unchanged through repeated diagnostic and wire round trips.

## Public data validation

`scripts/font-coverage-real-data.ts` reads titles with `PmClient.listAllComplete`,
diagnoses them in batches of 100 and verifies SDK read-back plus a digest of all
copied tracker bytes. A read-only, non-git copy of the public
[pm-web tracker snapshot](https://github.com/unbraind/pm-web/tree/ef224a95f41558fbefb63c18c51a60ccb18e1896/.agents/pm)
contained 189 items and 13,657 title code points. Both batches (100 and 89 labels)
had full coverage: 13,657 supported, zero unsupported, zero invalid and zero
failing labels. No synthetic characters were inserted into these public titles.
JSON reports were 124/123 bytes and TOON reports were 123/122 bytes; each used
31 core-estimated tokens. The SDK read-back and tracker bytes were unchanged
(SHA-256 `7a5adee296c319749bfe149569c3c5b0d865575606224882089d958ea9da3d0c`).
The run used read-only file/directory permissions, an empty PATH and a Git ceiling
outside the scratch directory. Unicode failures are established separately by
the controlled fixtures and seeded model, rather than inferred from ASCII titles.

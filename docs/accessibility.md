# Rendered accessibility fault locations

`diagnoseAccessibility` evaluates a consumer's resolved colour roles. It complements
`contrastAudit()`, which certifies the brand kit's 68 predefined comparisons.
The diagnostic consumes local component data; it does not launch a browser,
inspect DOM/CSS, certify an application's accessibility or change tracker data.

```ts
import { diagnoseAccessibility } from 'pm-brand/accessibility';
import { renderAccessibilityReport } from 'pm-brand/accessibility-report';

const input = {
  version: 1,
  pairs: [{
    locator: 'components/Chip.tsx:24#label',
    theme: 'light',
    rule: 'text',
    foreground: { token: 'rose', color: '#DE7F9C' },
    background: { token: 'sheet', color: '#FFFFFF' },
  }],
  format: 'json',
  budget: 512,
};
const diagnosis = diagnoseAccessibility(input);
const report = await renderAccessibilityReport(input);
process.stdout.write(report.text);
```

`ok: true` means the input was evaluated. `summary.failed` determines whether
the supplied compositions pass. Each failure contains the exact locator,
zero-based input index, theme, rule, foreground/background token suffixes,
resolved colours, measured unrounded ratio and required minimum. Passing pairs
are counted without emitting the full palette. Multiple pairs may share a
locator, for example a focus ring's inside and outside adjacent surfaces.

## Input contract

One strict schema is shared by SDK and CLI. Unknown fields are refused. The
input has `version: 1`, a dense `pairs` array (0–4,096 entries), optional `format`
(`json` or `toon`, default `toon`) and optional integer `budget` (512–1,000,000,
default 1,600). Locators contain 1–256 characters, with no control characters
or unpaired surrogates; their original spacing and Unicode are retained.

Every pair has an explicit `light` or `dark` theme, `text`, `focus` or `decorative`
rule, and two roles. A role has a colour token suffix and its resolved `color`.
Values accept six-digit hex, `rgba(r,g,b,a)` with integer RGB channels in 0–255
and alpha in 0–1, or `transparent`, with at most 80 characters. CSS variables,
named colours, percentages, font/scale/motion tokens and focus shorthand are
refused. Reference-valued status colour tokens remain supported.

Resolve inherited styles, overrides and the background's ancestor layers before
submission. Backgrounds must be opaque. Foreground alpha is composited onto
that background with the existing WCAG sRGB implementation. The supplied colour
is authoritative: a local override may differ from the token's default value.
The token records the repair target; the API does not guess computed CSS.

Text requires 4.5:1; explicit `textSize: 'large'` requires 3:1. Large means at
least 18pt, or 14pt bold, and is the caller's assertion. `textSize` is accepted
only on text pairs. Focus requires 3:1 against each supplied adjacent surface.
Decoration is measured but has no required threshold. These are contrast rules,
not a focus area, visibility, geometry or full WCAG conformance audit. Decisions
use the unrounded luminance-derived ratio and inclusive thresholds.

## Budgets and refusals

The wire budget uses pm's canonical `ceil(UTF-8 bytes / 4)` estimator, supplied
by the public SDK's `attachOutputTokenAccounting`, including the final newline.
TOON uses the official TOON codec; JSON is compact. This estimate is not an LLM
tokenizer guarantee. `report.text` is the complete budgeted payload; the SDK
wrapper's `result` and `format` fields are for local callers.

All failure coordinates are emitted together. If they cannot fit, the result
has `ok: false`, `code: 'budget_exceeded'`, `required_budget`, an actionable
remedy and the **entire** `summary`, including text and focus failure counts.
It never silently shortens a locator, drops a failure or reports zero failures
because a row was withheld. Retry with `required_budget`, or split a large input
by component. The minimum supported budget accommodates every refusal envelope.

Expected refusals have `ok: false`, `code`, schema `path` and `remedy`:

| Code | Remedy |
| --- | --- |
| `invalid_input` | Correct the indicated schema field or size/domain limit. |
| `invalid_color` | Supply a resolved supported colour value. |
| `transparent_background` | Composite the ancestor background to an opaque value. |
| `numeric_result` | Supply finite measurements and consistent counts. |
| `sdk_unavailable` | Install a compatible pm SDK beside the package, or inject the host's real capability. |
| `budget_exceeded` | Increase the budget or split by component; failure counts remain visible. |
| `input_unreadable` | Supply a readable regular UTF-8 JSON file up to 4 MiB. |
| `usage` | Correct the CLI command/flags. |

Invalid requests are refused in JSON before loading the SDK. Other reports use
the requested format. Report generation loads `@unbrained/pm-cli/sdk` lazily
through normal public package resolution, independent of the executable path,
working directory, global symlinks or session focus. The SDK is a required peer
at version 2026.10.23 or newer; pure diagnosis never loads it. Hosts can supply
`renderAccessibilityReport(input, { attachOutputTokenAccounting })` from their
real injected SDK. No tracker, telemetry configuration or ambient state is read.

## CLI and non-git use

```sh
pm-brand diagnose examples/accessibility.json --format json --budget 512
npx --package pm-brand pm-brand diagnose components.json --format toon
bunx --package pm-brand pm-brand diagnose components.json --budget 1600
```

The standalone command is `pm-brand diagnose`; this library is not a pm
extension. Flags override the JSON request's corresponding fields and use the
same schema. Repeated, unknown, missing-value and unusable flags are refused.
Exit codes are 0 for no failures, 1 for measured failures, and 2 for a refusal.
The command reads only the named file. All diagnostics, rendering and CLI work
in ordinary directories with no git executable or tracker.

For reproducible public-tracker validation, export tracked public tracker files
to a scratch non-git directory, make that copy read-only, then run
`node scripts/accessibility-real-data.ts <tracker-root>`. The adapter reads all
native fields through `listAllComplete({ includeBody: true })`, projects each
row into synthetic component roles in both themes, checks deliberate consumer
faults, measures report budgets and verifies SDK read-back is unchanged. It
reports only aggregate numbers and hashes. This is a data-backed diagnostic
exercise, not a browser audit of the source application.

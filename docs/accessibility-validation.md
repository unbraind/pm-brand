# Accessibility diagnostic validation

Public source: `unbraind/pm-brand` main at
`69567f9ad7b75f6b25b4c79fa5875c298ae632e7` (tracked tracker files only).
The tracker was exported to a non-git scratch directory, all copied files and
directories made read-only, and `GIT_CEILING_DIRECTORIES` set to its parent.
No hosted or private data was used.

`node scripts/accessibility-real-data.ts <tracker-root>` used the pinned public
SDK's certified `listAllComplete({ includeBody: true })` before and after the
diagnostic. Its complete-list receipt certified **14 items**, all statuses,
complete native fields and bodies, no omissions and unbounded delivery.

Each item was projected into text, focus and decorative component roles in
both themes: **84 comparisons**, **56 evaluated**, **28 decorative**. The correct
kit roles had **0 failures**. Controlled foreground overrides matching their
backgrounds produced **56 failures**: **28 text**, **28 focus**. Decoration stayed
exempt. These are synthetic consumer compositions backed by real tracker rows;
they are not an audit of the source repository's application UI.

| Encoding | Budget | Wire bytes | Estimated tokens | Result |
| --- | ---: | ---: | ---: | --- |
| JSON | 512 | 260 | 65 | Typed refusal, all 56 failures counted |
| TOON | 512 | 252 | 63 | Typed refusal, all 56 failures counted |
| JSON | 1,000,000 | 12,171 | 3,043 | All 56 complete fault coordinates |
| TOON | 1,000,000 | 4,608 | 1,152 | All 56 complete fault coordinates |

Canonical SDK state SHA-256 before and after:
`1b257511707f73b3d347b5bbf4bc77dbde6780ddcf503eee4362d7b2ba6bc8c3`.
Copied tracker path/content SHA-256 before and after:
`e3a3d113170e3aa8b8c444467f6022092050bc9160db4c1683df3001c63cefd6`.

The focused Node suite passes **7/7** tests. It includes 500 seeded sequences
of 12 operations (6,000 operations), older-input replays, whitespace/CRLF
variants, JSON and TOON round trips, extreme input/output numbers, and native
SDK read-back after every sequence. Native fixture fields, body, parent and
dependency relationships remain equal to the SDK-read reference model; no
hand-written tracker normalizer is used. New source coverage measures
**100% statements, branches, functions and lines**, with unchanged thresholds.

`node scripts/accessibility-revert-proof.ts` catches **6/6** isolated behavioral
reverts: consumer measurement, decorative classification, exact locator,
unrounded threshold, dense arrays, requested budget. All mutations run in
disposable copies; the package checkout is never modified by the proof.

Packed acceptance passes all **6 acquisition modes** (npm/Bun project-local,
npm/Bun global, npx, bunx), with both JSON and TOON in each: **12/12 CLI
scenarios**. The npm global case also executes the real pinned host's global
`pm` symlink. Both existing packed public-export/native-render consumer smokes
pass. Each acceptance run captures one tarball and verifies its SHA-256 is
unchanged after all install modes.

Production diagnostics have no tracker import/export/sync, journal, retry,
claim, lease, outbox, status inference or mutation path. No persistent shared
state or idempotency key is introduced. The strict input boundary and typed
refusals apply to this new request schema; existing kit APIs and persisted
tracker data retain their contracts.

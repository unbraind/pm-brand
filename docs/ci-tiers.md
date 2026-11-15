# Fleet CI v2

Required checks remain `verify (22)`, `verify (26)` and `analyze`. PR CI and
manual dispatch use hosted Ubuntu, quick deterministic prefixes (50 of 500),
25-minute job limits, and cancellation of superseded PR runs. Unset depth is
full. Input alphabets and all per-case assertions are unchanged; replay and
success/refusal thresholds derive from the generated sequence count.

| Check | Code PR 22 | Code PR 26 | Docs/tracker PR, both | Deep 22 + 26 |
| --- | --- | --- | --- | --- |
| npm ci, prepare/build, merge drivers | yes | yes | yes | yes |
| Strict pm health, identity/path policy | via tests | gate | yes | npm + Bun |
| Changelog check | — | gate | yes | npm + Bun |
| Package file allowlist | — | gate | yes | npm + Bun |
| Identity, README/license and workflow contract tests | suite | suite | yes | npm + Bun |
| Build and complete test suite | quick | quick coverage | — | full npm + Bun |
| Typecheck, lint, compiled-output drift, docstrings | — | gate | — | npm + Bun |
| Font budget, generated assets, banner drift | — | gate | — | npm + Bun |
| Coverage: 100% statements/branches/functions/lines | — | quick | — | full npm + Bun |
| Production audit, packed install/browser/CLI acceptance | — | gate | — | npm + Bun |
| Bun package-graph install and native Bun acceptance | — | yes | — | yes |
| Git consumer acceptance | — | yes | — | yes |
| CodeQL `analyze` | separate workflow on all PRs | separate workflow | yes | main pushes and weekly scan |

The cheap path includes checks that read README, LICENSE, tracker data and
packed file lists. Executable tracker files select the code path. Prepare
already builds on npm ci; Node 22 adds no coverage, changelog or pack command.
Packed acceptance proves npm/Bun project and global installs, npx and `bun x`
tarball acquisition, so the Bun graph/native runtime smoke adds no second gate.

Deep runs on main pushes, dispatch and daily at 01:13 UTC, away from release
03:23 and hourly :41 reconciliation and weekly CodeQL Monday 02:31. It retains
both npm and Bun full release gates on Node 22/26 under distinct `deep` check
names. Jobs have a 120-minute limit and cancellation per ref. Local `pm-local`
runners use persistent npm caches and preinstalled Bun; `PM_LOCAL_DEEP=off`
selects hosted Ubuntu. Deep sets `PM_TEST_TIME_SCALE=3`. Scaled child watchdogs
validate finite positive factors and round up to integer milliseconds. Product
budgets and assertions stay unchanged. Coverage thresholds are unchanged.

Baseline main run 43679416505: verify (26) 15m05s created-to-completed, 7m00s
execution; verify (22) 22m21s including queue, 3m52s execution. Job logs rank
the CLI review case at 13.29s and topology/metadata/renderer/XML property cases
at 4.90–5.95s. Full depth is not run locally; deep CI certifies it after merge.
The owner fleet measurement was 39,929 runner-minutes/day and median PR wall
time 45–90 minutes, including about 28 minutes queueing.

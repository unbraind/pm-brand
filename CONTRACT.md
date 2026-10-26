# Triplicate: the pm brand token contract

Decisions, 2026-10-17:

1. Direction: **Triplicate**.
2. `pm-brand` is **built, release held**. No npm or GitHub release until the
   owner reviews the kit. Surfaces never copy its files; until the release is
   approved they depend on an exact commit of `unbraind/pm-brand`
   (`"pm-brand": "github:unbraind/pm-brand#<40-char sha>"`), then switch to the
   npm version.
3. All surfaces move **in parallel**: website, pm-web, pm-gpt + pm-mcp,
   pm-search. Package visuals (pm-gantt-chart, pm-graph, README banners) follow.

This file is the contract every agent builds against. `pm-brand` implements it
exactly; surfaces use only these names. If a surface needs a value that is not
here, add it to `pm-brand` first.

## The idea

Work orders used to be filled out in triplicate, so that everyone involved held
the same record: a white original with canary and pink carbon copies underneath.
pm is that record for agents: **context management for any agent and any task
or workflow**. An agent uses pm to manage its own context: goals, tasks,
decisions, evidence, files, tests, memory and history, kept as typed, stamped
items it reads in compact TOON and updates through one CLI and SDK. That holds
for coding, research and operations, for long-running workflows, for recursive
agents that call themselves (Recursive Language Models), and for the people
working alongside them. pm runs in a plain folder, in a hosted workspace
(pm-web, the remote MCP, ChatGPT) or synced with the tools a team already uses,
with or without git. Every change is stamped with who made it and from where.
The identity keeps that vocabulary with neutral paper, black/white carbon ink,
neutral and red copy sheets, and a red rubber-stamp ink for actions. Amber carries
blocked/error meaning, with explicit labels and warning symbols. Signal is the
recommended draft palette for issue #9; owner selection is still pending.
[Light/dark alternatives and measured evidence](docs/palette-previews/README.md)
and [consumer migration](docs/palette-migration.md) accompany this proposal.

**Owner rules (2026-10-18): project management IS context management for
agents, and the brand is never about git or merging.** The two are one idea:
headlines may lead with that equality ("project management = context
management") but never narrow pm to software projects or to coding agents
only. pm is for any agent, task and workflow. Brand-level copy, visuals and signatures
(hero, taglines, OG images, banners, product chrome) lead with agents managing
their own context, the stamped record, the CLI and SDK, and the package
ecosystem. They never use branch, merge, commit, merge-driver or
"git-native" framing. Git and merge drivers are one integration among many.
They are described only on the pages of the packages and docs that are about
them.

## Custom properties (`pm-brand/tokens.css`)

All names carry the `--pm-` prefix so they never collide with a host app.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--pm-paper` | `#F5F5F5` | `#101010` | Page background |
| `--pm-sheet` | `#FFFFFF` | `#1C1C1C` | Items, panels and forms |
| `--pm-carbon` | `#171717` | `#F5F5F5` | Text and outlines |
| `--pm-graphite` | `#555555` | `#B5B5B5` | Secondary text and captions |
| `--pm-rule` | `rgba(23, 23, 23, .14)` | `rgba(245, 245, 245, .14)` | Decorative hairlines |
| `--pm-copy-secondary` | `#D6D6D6` | `#505050` | Neutral second sheet |
| `--pm-copy-tertiary` | `#B51F32` | `#FF7A88` | Red third sheet |
| `--pm-progress-wash` | `#EFEFEF` | `#292929` | In-progress and changed-field fill |
| `--pm-blocked-wash` | `#FFF0D6` | `#382A16` | Blocked fill |
| `--pm-canary` | `var(--pm-copy-secondary)` | `var(--pm-copy-secondary)` | Compatibility alias: copy-secondary |
| `--pm-canary-wash` | `var(--pm-progress-wash)` | `var(--pm-progress-wash)` | Compatibility alias: progress-wash |
| `--pm-rose` | `var(--pm-copy-tertiary)` | `var(--pm-copy-tertiary)` | Compatibility alias: copy-tertiary |
| `--pm-rose-wash` | `var(--pm-blocked-wash)` | `var(--pm-blocked-wash)` | Compatibility alias: blocked-wash |
| `--pm-stamp` | `#B51F32` | `#FF7A88` | Actions, links and focus |
| `--pm-stamp-wash` | `#FCECEE` | `#381C21` | Selection/hover fill with carbon text |
| `--pm-on-stamp` | `#FFFFFF` | `#101010` | Text on a stamp-filled button |
| `--pm-danger` | `#805000` | `#FFC46B` | Amber errors/destructive actions; labeled |

Status mapping (label text, shape and fill carry the state, so it reads without colour):

| Status | Chip |
|---|---|
| open | carbon outline, sheet fill |
| in_progress | carbon text/border, progress-wash fill; labeled In progress |
| blocked | carbon text, amber danger border, blocked-wash fill; labeled Blocked |
| closed | carbon text and border, sheet fill; labeled Closed |
| canceled | graphite text, rule border, line-through |

The chip border is decorative; the label text carries the state and meets 4.5:1.

Tokens: `--pm-status-<status>-fg`, `-bg`, `-border` for those five statuses.

Theme switching: `@media (prefers-color-scheme: dark)` under
`:root:not([data-theme="light"])`, and `:root[data-theme="dark"]` for an
explicit choice. Both set `color-scheme`.

## Type

| Token | Value | Use |
|---|---|---|
| `--pm-font-display` | `"Archivo", "Arial Narrow", "Helvetica Neue", Arial, sans-serif` | Headlines (width 125, weight 800) and the wordmark only |
| `--pm-font-caption` | same family | Field labels: width 75, weight 600, uppercase, letter-spacing .09em |
| `--pm-font-body` | `"Public Sans", "Segoe UI", system-ui, -apple-system, sans-serif` | Body copy |
| `--pm-font-mono` | `"Martian Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace` | Data: ids, commands, TOON |

Scale: `--pm-step--1: .82rem`, `--pm-step-0: 1rem`, `--pm-step-1: 1.2rem`,
`--pm-step-2: 1.6rem`, `--pm-step-3: 2.3rem`, `--pm-step-4: clamp(2.4rem, 6vw, 4.1rem)`.

Fonts are self-hosted from `pm-brand/fonts.css` (Latin subset WOFF2,
`font-display: swap`, fallback metric overrides). Hosted apps make no request
to Google Fonts. All three families are OFL; the licence ships with the files.
Total font payload stays under 120 KB.

## Shape, focus, motion

- `--pm-radius: 6px` (sheets), `--pm-radius-sm: 3px` (chips, buttons 4px).
- `--pm-focus: 2px solid var(--pm-stamp)`, offset 3px, on every interactive element.
- `--pm-ease: cubic-bezier(.2,.7,.2,1)`, `--pm-dur: .7s`; everything respects
  `prefers-reduced-motion: reduce` by showing the end state without animation.

## Grammar (how screens are built)

- **Sheets mark objects.** An item, a panel or a form sits on a white top sheet
  with a 1px rule border. Page sections get no borders or shadows.
- **The strip is real data.** Every item sheet opens with its id, type and
  priority in mono, like a form number. No decorative numbering anywhere.
- **Inputs are underlined form fields** with condensed uppercase captions.
- **One red primary action per screen.** Secondary buttons: carbon outline.
  Quiet buttons: underlined text.
- **Tints mean records and state.** Neutral progress-wash identifies a participant’s
  copy or changed-field row; amber blocked-wash identifies blocked work. Stamp-wash
  is a selection/hover surface with carbon text. Never use these as decoration.
  Labels and warning symbols carry meaning alongside colour.
- **Copy is plain.** Buttons say what happens ("Link files"), results confirm
  it ("Files linked"), errors say what failed and how to fix it.

## The mark

Three stacked sheets (red at the back, neutral grey in the middle, white on top)
with "pm" in Archivo width 125 weight 900 on the top sheet. Product lockups put
the product as a condensed caption in a carbon-outlined box: `pm [WEB]`,
`pm [GPT]`, `pm [SEARCH]`, `pm [SWARM]`. Package names stay lowercase in text
(`pm-web`).

## The signature (used in exactly two places)

The live record: one item sheet whose fields are filled in by different
participants. Each change arrives as a tinted copy slip stamped with its author
and surface (for example `codex-agent · pm CLI`, `Morgan · pm-web`,
`ChatGPT · pm-gpt`). It settles into the sheet with the changed row carrying a
copy-secondary or copy-tertiary left border naming who changed it, and adds one line to the
item's history. There are no branches, no fan-out and no merge.

1. The website hero, driven by a real item and its real, stamped history from
   pm's own tracker.
2. pm-web, where an edit arriving live from another person, agent or surface
   slides in as a tinted copy before it settles.

Nowhere else. Reviews reject the motion or the tints anywhere else.

## Quality floor for every surface PR

- Before/after screenshots at 1440, 768 and 390 px, light and dark, attached
  to the PR.
- WCAG AA contrast for every text/background pair in both themes; visible
  keyboard focus; reduced motion honoured; no horizontal scroll at 390 px.
- No request to fonts.googleapis.com or any third-party CDN from hosted apps.

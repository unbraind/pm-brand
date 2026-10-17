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

Work orders used to be filled out in triplicate: a white original with canary
and pink carbon copies underneath. pm works the same way. Every agent edits its
own copy of an item on its own branch, and pm's merge drivers reconcile the
copies field by field. The identity uses that vocabulary: cool form paper,
carbon-blue ink, canary and rose for the copies, and a violet rubber-stamp ink
for actions and for anything that is done.

## Custom properties (`pm-brand/tokens.css`)

All names carry the `--pm-` prefix so they never collide with a host app.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--pm-paper` | `#F3F5F8` | `#0F1528` | Page background (form paper) |
| `--pm-sheet` | `#FFFFFF` | `#171F37` | Items, panels, forms (top sheet) |
| `--pm-carbon` | `#1B2340` | `#E7EAF3` | Text, rules, outlines (carbon ink) |
| `--pm-graphite` | `#535B70` | `#A2A9BD` | Secondary text, captions |
| `--pm-rule` | `rgba(27,35,64,.14)` | `rgba(231,234,243,.14)` | Hairlines |
| `--pm-canary` | `#E9C53A` | `#D7B53A` | Second copy; status in progress |
| `--pm-canary-wash` | `#FBF1C6` | `#3A331C` | Canary fill for chips and changed-field rows |
| `--pm-rose` | `#DE7F9C` | `#D07E97` | Third copy; status blocked |
| `--pm-rose-wash` | `#F9DDE5` | `#3D2432` | Rose fill |
| `--pm-stamp` | `#5B3FC4` | `#A894FF` | Actions, links, focus, closed |
| `--pm-stamp-wash` | `#ECE7FB` | `#2A2450` | Selected rows, hover fill |
| `--pm-on-stamp` | `#FFFFFF` | `#0F1528` | Text on a stamp-filled button |
| `--pm-danger` | `#B42E3A` | `#F07A84` | Destructive actions and errors only |

Status mapping (label text, shape and fill carry the state, so it reads without colour):

| Status | Chip |
|---|---|
| open | carbon outline, sheet fill |
| in_progress | canary border, canary-wash fill |
| blocked | rose border, rose-wash fill |
| closed | stamp text and border; on an item's own page only, the rotated stamp |
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
- **One violet primary action per screen.** Secondary buttons: carbon outline.
  Quiet buttons: underlined text.
- **Tints mean copies.** Canary and rose appear only for branch or collaborator
  copies, in-progress and blocked. Never as decoration. Text never sits on a
  tint alone except inside chips and changed-field rows.
- **Copy is plain.** Buttons say what happens ("Link files"), results confirm
  it ("Files linked"), errors say what failed and how to fix it.

## The mark

Three stacked sheets (rose at the back, canary in the middle, white on top)
with "pm" in Archivo width 125 weight 900 on the top sheet. Product lockups put
the product as a condensed caption in a carbon-outlined box: `pm [WEB]`,
`pm [GPT]`, `pm [SEARCH]`, `pm [SWARM]`. Package names stay lowercase in text
(`pm-web`).

## The signature (used in exactly two places)

The field-by-field merge: three copies of one item fan out on their branches,
then fold back into one sheet whose changed rows carry a canary or rose left
border naming the copy they came from.

1. The website hero, driven by a real item from pm's own tracker.
2. pm-web, where an edit arriving live from another person slides in as a
   tinted copy before it settles.

Nowhere else. Reviews reject the motion or the tints anywhere else.

## Quality floor for every surface PR

- Before/after screenshots at 1440, 768 and 390 px, light and dark, attached
  to the PR.
- WCAG AA contrast for every text/background pair in both themes; visible
  keyboard focus; reduced motion honoured; no horizontal scroll at 390 px.
- No request to fonts.googleapis.com or any third-party CDN from hosted apps.

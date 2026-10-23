# Consumer migration · draft palette choice for issue #9

Signal is the recommended candidate on this draft branch. Wait for the owner's
choice and a reviewed exact commit before updating consumers. Release remains held;
this proposal does not authorize deployment or activate an npm release.

Import `pm-brand/tokens.css` and `pm-brand/fonts.css` as before. TypeScript callers
continue using `tokens`, `cssVar`, `Theme` and `TokenName`. All values originate in
`src/tokens.ts`; `npm run tokens:build` derives CSS, and `tokens:check` checks drift.
Do not copy hex values into an app. Runtime reference-valued tokens stay references;
canvas/SVG consumers must resolve them against the selected theme before drawing.

No token is removed and no existing token name must be renamed immediately. Use
these new role-based names when touching old copy-colour consumers. The legacy
names remain exported in CSS and TypeScript as aliases for **at least one release**;
removal requires a separate reviewed change, not an automatic timer.

| Compatibility alias | Preferred name | Meaning after refinement |
|---|---|---|
| `canary` | `copy-secondary` | Neutral second sheet, not a status colour |
| `rose` | `copy-tertiary` | Red third sheet, not a blocked/error colour |
| `canary-wash` | `progress-wash` | Neutral in-progress / changed-field fill |
| `rose-wash` | `blocked-wash` | Amber blocked fill |

The old literal values change intentionally. In particular, resolve `canary`/`rose`
before passing them to native/canvas APIs: they are now CSS references. Select a
status through `status-<status>-fg/bg/border`, never by guessing from a copy name.
`in_progress` now uses carbon ink/border and a neutral fill; `blocked` uses carbon
text, amber fill and danger border; `closed` uses carbon text/border on sheet;
`open` and `canceled` retain their prior structural roles. All five keep visible
labels; add symbols where useful and retain canceled's line-through.

`stamp` is red action/link/focus ink, with `on-stamp` for filled button text.
`danger` is amber for errors/destructive actions, with a warning symbol and explicit
wording (“Error”, “Delete item”, recovery action). Do not treat every red element as
an error, and do not remove labels because the hues differ. Use carbon text on
wash fills. The focus outline remains 2 px, offset 3 px, and is audited against
paper, sheet and all three wash backgrounds. Do not place it against untested
custom backgrounds. Decorative chip borders carry no state by themselves.

| Consumer | Required work after owner selection |
|---|---|
| pm-web | Update its exact pm-brand pin; remove blue/violet overrides; use all three semantic status tokens for each chip; retain status labels, canceled line-through, warning icons/wording and keyboard focus. Review light/dark app views at 1440/768/390 px. |
| pm-gantt-chart | Update its exact pin; use status tokens for task labels and fills, with labels/symbols or patterns on bars. Resolve references for canvas/native SVG; do not map red stamp to an error or to closed work. Review both themes and crowded/narrow charts. |
| pm-graph | Update its exact pin; resolve semantic theme references for node labels, fills and borders, preserve labels/shapes and warning legends. Review both themes, focus and selection against actual graph backgrounds. |
| Website | Update its exact pin; import package CSS and existing fonts; remove local blue/violet literals; regenerate its own banner/OG through the same APIs. Keep existing composition, mark and live-record behaviour. Review both themes at 1440/768/390 px before deployment. |

Other package READMEs can consume regenerated fixed light/dark banner assets after
approval. `banner()` and `ogImage()` signatures and native dimensions are unchanged.
Marks, lockups, favicons and image helpers are regenerated from the existing geometry
with canonical colours; font bytes and text outlines remain unchanged. Consumers
must retain the release hold and choose fixed-theme assets for renderers without
CSS/media-query support. No downstream repository is changed by this proposal.

# Package description audit

Reviewed the 26 entries in `banners/packages.json` against each package's
`package.json` description and README introduction on 2026-10-17. Every catalog
description matches its package metadata exactly. The banner generator should
keep those descriptions until their package owners change them.

| Package | Stale or weak description | README evidence / follow-up |
| --- | --- | --- |
| pm-github | Calls the integration an Issues importer. | The introduction describes round-trip import, export, status sync, search and validation; command documentation also covers gated sync, closeout and projects. |
| pm-rl | Names environments, runs and compressed metrics, with a long implementation-led sentence. | The introduction now describes fail-closed evaluation lifecycles, recursive lineage, sweeps, transfer reports and bounded resumable recursive loops. |
| pm-web | Lists browse/create/update/search/manage only. | The first paragraph also names dedupe-audit and validation; the next paragraph describes authentication, sharing, groups and relationship graphs. |
| pm-gantt-chart | Leads with ASCII and an unspecified multi-format exporter. | The introduction names Mermaid, HTML, ASCII, CSV and JSON plus critical-path analysis and dependency-aware scheduling. |

These are editorial judgments about emphasis as well as stale scope; the
pm-gantt-chart description remains technically accurate. No other repository or
catalog description was changed in this PR. Follow-up: `pm-brand-description-followup`.

The other descriptions remain adequate summaries of their introductions:
pm-ado, pm-beads, pm-brand, pm-brief, pm-changelog, pm-context, pm-csv, pm-graph,
pm-jev, pm-jira, pm-linear, pm-lint, pm-ops, pm-presets, pm-review, pm-slack,
pm-slack-standup, pm-starter, pm-swarm, pm-todos, pm-ts-starter and pm-vcs.

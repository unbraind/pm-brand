# Dependency installs

`package-lock.json` is the committed dependency graph for both npm and Bun.
Dependabot maintains it through the npm ecosystem. CI runs `npm ci` and
`bun install --no-save`, followed by the existing npm and Bun release gates.
Do not commit `bun.lock` or `bun.lockb`: a second lockfile becomes stale when
Dependabot updates the npm manifests. Bun may generate a disposable ignored
lockfile while importing the npm lockfile.

This follows pm-csv, pm-web and pm-graph: no committed Bun lockfile, no Bun
Dependabot ecosystem, and `bun install --no-save` in CI. The trusted-base
identity policy and release thresholds are unchanged.

The original failure was reproduced using Dependabot PR #8's manifests and
main's Bun lockfile: frozen installation fails. Removing the Bun lockfile and
running the fleet install command succeeds, preserves the npm lockfile, and
installs all 11 direct development dependencies at their npm-locked versions.
PR #8 can be rebased after this fix merges; it does not need recreation.

# Contrast evidence

The seed contract is unchanged. 68 comparisons are measured with the
WCAG 2.x sRGB relative-luminance formula, including alpha-composited rule borders.
All text comparisons meet 4.5:1 and both focus-ring backgrounds meet 3:1.
**Ten border comparisons fail 3:1 and require an owner decision.**
The test asserts the exact known-failure set and rejects any new failure; it does
not certify those ten pairs as AA. No tests are skipped or marked todo.

## Smallest proposed contract changes

Change only these status border tokens, preserving all base palette values:

| Theme | Token | Proposed value | Reason |
|---|---|---|---|
| Light | --pm-status-in_progress-border | #A28928 | Darken canary only for the border |
| Light | --pm-status-blocked-border | #B96A82 | Darken rose only for the border |
| Light and dark | --pm-status-canceled-border | var(--pm-graphite) | Use the existing secondary ink for a perceptible boundary |

Canary and rose proposals use the first whole-byte blend toward black whose
contrast meets 3:1 against paper, sheet and their own wash. Graphite already
passes 4.5:1 against paper and sheet in both themes. No graphite, stamp, or
other base token needs adjustment. The owner must approve the resulting status
border exception to the seed's direct canary/rose/rule mapping before it is applied.

## Every allowed pair

| Pair | Minimum | Light | Dark | Result |
|---|---:|---:|---:|---|
| carbon / paper | 4.5 | 14.127 | 15.076 | Pass |
| carbon / sheet | 4.5 | 15.429 | 13.561 | Pass |
| graphite / paper | 4.5 | 6.206 | 7.724 | Pass |
| graphite / sheet | 4.5 | 6.778 | 6.948 | Pass |
| stamp / paper | 4.5 | 6.511 | 7.205 | Pass |
| stamp / sheet | 4.5 | 7.112 | 6.481 | Pass |
| danger / paper | 4.5 | 5.668 | 6.754 | Pass |
| danger / sheet | 4.5 | 6.190 | 6.075 | Pass |
| carbon / canary-wash | 4.5 | 13.592 | 10.454 | Pass |
| carbon / rose-wash | 4.5 | 12.124 | 11.665 | Pass |
| carbon / stamp-wash | 4.5 | 12.777 | 11.906 | Pass |
| on-stamp / stamp | 4.5 | 7.112 | 7.205 | Pass |
| status-open-fg / status-open-bg | 4.5 | 15.429 | 13.561 | Pass |
| status-open-border / status-open-bg | 3.0 | 15.429 | 13.561 | Pass |
| status-open-border / paper | 3.0 | 14.127 | 15.076 | Pass |
| status-open-border / sheet | 3.0 | 15.429 | 13.561 | Pass |
| status-in_progress-fg / status-in_progress-bg | 4.5 | 13.592 | 10.454 | Pass |
| status-in_progress-border / status-in_progress-bg | 3.0 | 1.478 | 6.323 | Owner decision |
| status-in_progress-border / paper | 3.0 | 1.537 | 9.118 | Owner decision |
| status-in_progress-border / sheet | 3.0 | 1.678 | 8.201 | Owner decision |
| status-blocked-fg / status-blocked-bg | 4.5 | 12.124 | 11.665 | Pass |
| status-blocked-border / status-blocked-bg | 3.0 | 2.165 | 4.752 | Owner decision |
| status-blocked-border / paper | 3.0 | 2.523 | 6.141 | Owner decision |
| status-blocked-border / sheet | 3.0 | 2.755 | 5.524 | Owner decision |
| status-closed-fg / status-closed-bg | 4.5 | 7.112 | 6.481 | Pass |
| status-closed-border / status-closed-bg | 3.0 | 7.112 | 6.481 | Pass |
| status-closed-border / paper | 3.0 | 6.511 | 7.205 | Pass |
| status-closed-border / sheet | 3.0 | 7.112 | 6.481 | Pass |
| status-canceled-fg / paper | 4.5 | 6.206 | 7.724 | Pass |
| status-canceled-border / paper | 3.0 | 1.311 | 1.440 | Owner decision |
| status-canceled-fg / sheet | 4.5 | 6.778 | 6.948 | Pass |
| status-canceled-border / sheet | 3.0 | 1.317 | 1.476 | Owner decision |
| stamp / paper | 3.0 | 6.511 | 7.205 | Pass |
| stamp / sheet | 3.0 | 7.112 | 6.481 | Pass |

Regenerate after building with `node scripts/contrast-report.ts`.

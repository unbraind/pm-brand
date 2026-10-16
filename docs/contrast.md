# Contrast evidence

68 comparisons use the WCAG 2.x sRGB relative-luminance formula,
including alpha-composited rule borders. All 36 text comparisons meet 4.5:1;
all four focus-ring comparisons meet 3:1. The gate fails below either threshold.

## Orchestrator decision: decorative chip borders

Chip state is conveyed by the text label and fill. All 28 chip-border comparisons
are classified **decorative**, with no required contrast minimum. Canary, rose and
rule tokens remain unchanged. The ten comparisons below the 3:1 reference are
listed here with their measured ratios; they are not known failures or waivers.
Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1.

| Theme | Decorative pair | Measured ratio | Reason |
|---|---|---:|---|
| light | status-in_progress-border / status-in_progress-bg | 1.478:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| light | status-in_progress-border / paper | 1.537:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| light | status-in_progress-border / sheet | 1.678:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| light | status-blocked-border / status-blocked-bg | 2.165:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| light | status-blocked-border / paper | 2.523:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| light | status-blocked-border / sheet | 2.755:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| light | status-canceled-border / paper | 1.311:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| light | status-canceled-border / sheet | 1.317:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| dark | status-canceled-border / paper | 1.440:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| dark | status-canceled-border / sheet | 1.476:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |

## Every allowed pair

| Pair | Classification | Minimum | Light | Dark | Result |
|---|---|---:|---:|---:|---|
| carbon / paper | text | 4.5 | 14.127 | 15.076 | Pass |
| carbon / sheet | text | 4.5 | 15.429 | 13.561 | Pass |
| graphite / paper | text | 4.5 | 6.206 | 7.724 | Pass |
| graphite / sheet | text | 4.5 | 6.778 | 6.948 | Pass |
| stamp / paper | text | 4.5 | 6.511 | 7.205 | Pass |
| stamp / sheet | text | 4.5 | 7.112 | 6.481 | Pass |
| danger / paper | text | 4.5 | 5.668 | 6.754 | Pass |
| danger / sheet | text | 4.5 | 6.190 | 6.075 | Pass |
| carbon / canary-wash | text | 4.5 | 13.592 | 10.454 | Pass |
| carbon / rose-wash | text | 4.5 | 12.124 | 11.665 | Pass |
| carbon / stamp-wash | text | 4.5 | 12.777 | 11.906 | Pass |
| on-stamp / stamp | text | 4.5 | 7.112 | 7.205 | Pass |
| status-open-fg / status-open-bg | text | 4.5 | 15.429 | 13.561 | Pass |
| status-open-border / status-open-bg | decorative | — | 15.429 | 13.561 | Decorative |
| status-open-border / paper | decorative | — | 14.127 | 15.076 | Decorative |
| status-open-border / sheet | decorative | — | 15.429 | 13.561 | Decorative |
| status-in_progress-fg / status-in_progress-bg | text | 4.5 | 13.592 | 10.454 | Pass |
| status-in_progress-border / status-in_progress-bg | decorative | — | 1.478 | 6.323 | Decorative |
| status-in_progress-border / paper | decorative | — | 1.537 | 9.118 | Decorative |
| status-in_progress-border / sheet | decorative | — | 1.678 | 8.201 | Decorative |
| status-blocked-fg / status-blocked-bg | text | 4.5 | 12.124 | 11.665 | Pass |
| status-blocked-border / status-blocked-bg | decorative | — | 2.165 | 4.752 | Decorative |
| status-blocked-border / paper | decorative | — | 2.523 | 6.141 | Decorative |
| status-blocked-border / sheet | decorative | — | 2.755 | 5.524 | Decorative |
| status-closed-fg / status-closed-bg | text | 4.5 | 7.112 | 6.481 | Pass |
| status-closed-border / status-closed-bg | decorative | — | 7.112 | 6.481 | Decorative |
| status-closed-border / paper | decorative | — | 6.511 | 7.205 | Decorative |
| status-closed-border / sheet | decorative | — | 7.112 | 6.481 | Decorative |
| status-canceled-fg / paper | text | 4.5 | 6.206 | 7.724 | Pass |
| status-canceled-border / paper | decorative | — | 1.311 | 1.440 | Decorative |
| status-canceled-fg / sheet | text | 4.5 | 6.778 | 6.948 | Pass |
| status-canceled-border / sheet | decorative | — | 1.317 | 1.476 | Decorative |
| stamp / paper | focus | 3.0 | 6.511 | 7.205 | Pass |
| stamp / sheet | focus | 3.0 | 7.112 | 6.481 | Pass |

Regenerate after building with `node scripts/contrast-report.ts`.

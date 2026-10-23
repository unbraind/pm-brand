# Contrast evidence

68 comparisons use the WCAG 2.x sRGB relative-luminance formula,
including alpha-composited rule borders. All 36 text comparisons meet 4.5:1;
all 4 focus-ring comparisons meet 3:1. The gate fails below either threshold.

## Orchestrator decision: decorative chip borders

Chip state is conveyed by the text label and fill. All 28 chip-border comparisons
are classified **decorative**, with no required contrast minimum. Copy and status tokens follow the palette candidate;
labels remain mandatory. The 4 comparisons below the 3:1 reference are
listed here with their measured ratios; they are not known failures or waivers.
Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1.

| Theme | Decorative pair | Measured ratio | Reason |
|---|---|---:|---|
| light | status-canceled-border / paper | 1.334:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| light | status-canceled-border / sheet | 1.339:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| dark | status-canceled-border / paper | 1.443:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |
| dark | status-canceled-border / sheet | 1.507:1 | Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1. |

## Every allowed pair

| Pair | Classification | Minimum | Light | Dark | Result |
|---|---|---:|---:|---:|---|
| carbon / paper | text | 4.5 | 16.444 | 17.453 | Pass |
| carbon / sheet | text | 4.5 | 17.928 | 15.632 | Pass |
| graphite / paper | text | 4.5 | 6.838 | 9.280 | Pass |
| graphite / sheet | text | 4.5 | 7.455 | 8.311 | Pass |
| stamp / paper | text | 4.5 | 6.007 | 7.603 | Pass |
| stamp / sheet | text | 4.5 | 6.549 | 6.810 | Pass |
| danger / paper | text | 4.5 | 6.284 | 12.106 | Pass |
| danger / sheet | text | 4.5 | 6.851 | 10.842 | Pass |
| carbon / canary-wash | text | 4.5 | 15.591 | 13.344 | Pass |
| carbon / rose-wash | text | 4.5 | 15.953 | 12.748 | Pass |
| carbon / stamp-wash | text | 4.5 | 15.684 | 14.203 | Pass |
| on-stamp / stamp | text | 4.5 | 6.549 | 7.603 | Pass |
| status-open-fg / status-open-bg | text | 4.5 | 17.928 | 15.632 | Pass |
| status-open-border / status-open-bg | decorative | — | 17.928 | 15.632 | Decorative |
| status-open-border / paper | decorative | — | 16.444 | 17.453 | Decorative |
| status-open-border / sheet | decorative | — | 17.928 | 15.632 | Decorative |
| status-in_progress-fg / status-in_progress-bg | text | 4.5 | 15.591 | 13.344 | Pass |
| status-in_progress-border / status-in_progress-bg | decorative | — | 15.591 | 13.344 | Decorative |
| status-in_progress-border / paper | decorative | — | 16.444 | 17.453 | Decorative |
| status-in_progress-border / sheet | decorative | — | 17.928 | 15.632 | Decorative |
| status-blocked-fg / status-blocked-bg | text | 4.5 | 15.953 | 12.748 | Pass |
| status-blocked-border / status-blocked-bg | decorative | — | 6.096 | 8.842 | Decorative |
| status-blocked-border / paper | decorative | — | 6.284 | 12.106 | Decorative |
| status-blocked-border / sheet | decorative | — | 6.851 | 10.842 | Decorative |
| status-closed-fg / status-closed-bg | text | 4.5 | 17.928 | 15.632 | Pass |
| status-closed-border / status-closed-bg | decorative | — | 17.928 | 15.632 | Decorative |
| status-closed-border / paper | decorative | — | 16.444 | 17.453 | Decorative |
| status-closed-border / sheet | decorative | — | 17.928 | 15.632 | Decorative |
| status-canceled-fg / paper | text | 4.5 | 6.838 | 9.280 | Pass |
| status-canceled-border / paper | decorative | — | 1.334 | 1.443 | Decorative |
| status-canceled-fg / sheet | text | 4.5 | 7.455 | 8.311 | Pass |
| status-canceled-border / sheet | decorative | — | 1.339 | 1.507 | Decorative |
| stamp / paper | focus | 3.0 | 6.007 | 7.603 | Pass |
| stamp / sheet | focus | 3.0 | 6.549 | 6.810 | Pass |

Regenerate after building with `node scripts/contrast-report.ts`.

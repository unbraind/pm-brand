# Font sources

All normal, upright fonts come from google/fonts at `47d54ca1ebb14fd864695f1d39dc734f39017c33`.
Rebuild with fontTools 4.65.0 and brotli 1.2.0: `node scripts/fonts.ts`.
No hosted app fetches these sources at runtime. The required axis ranges and all encoded glyphs in the requested repertoire are preserved; unencoded optional alternates and ligatures are omitted to meet the byte budget.

## Archivo

- Source: [Archivo[wdth,wght].ttf](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf)
- Licence: [OFL.txt](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/archivo/OFL.txt), reproduced in OFL.txt.
- Retained axes: wdth=75:100:125, wght=400:600:900.
- Subset: `U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD`; all applicable layout features retained; no unencoded alternate-glyph closure.
- Fallback: Arial, measured from @capsizecss/metrics 4.4.0 (scripts/fallback-metrics.ts).
- x-height / em: 526/1000; fallback 1062/2048.
- Size adjust 101.43578%; ascent 86.55723%; descent 20.70275%; gap 0.00000%.

## Public Sans

- Source: [PublicSans[wght].ttf](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/publicsans/PublicSans%5Bwght%5D.ttf)
- Licence: [OFL.txt](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/publicsans/OFL.txt), reproduced in OFL.txt.
- Retained axes: wght=400:400:700.
- Subset: `U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD`; all applicable layout features retained; no unencoded alternate-glyph closure.
- Fallback: Arial, measured from @capsizecss/metrics 4.4.0 (scripts/fallback-metrics.ts).
- x-height / em: 1034/2000; fallback 1062/2048.
- Size adjust 99.70019%; ascent 95.28568%; descent 22.56766%; gap 0.00000%.

## Martian Mono

- Source: [MartianMono[wdth,wght].ttf](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/martianmono/MartianMono%5Bwdth%2Cwght%5D.ttf)
- Licence: [OFL.txt](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/martianmono/OFL.txt), reproduced in OFL.txt.
- Retained axes: wdth=75:112.5:112.5, wght=400:400:700.
- Subset: `U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD`; all applicable layout features retained; no unencoded alternate-glyph closure.
- Fallback: Courier New, measured from @capsizecss/metrics 4.4.0 (scripts/fallback-metrics.ts).
- x-height / em: 600/1000; fallback 866/2048.
- Size adjust 141.89376%; ascent 70.47526%; descent 14.09505%; gap 0.00000%.

Axis defaults preserve upstream Archivo weight 600 and Martian Mono width 112.5 to avoid redundant variation deltas. CSS selects the requested positions within the retained ranges.

## Fallback measurement

Arial and Courier New metrics come from the pinned [Capsize 4.4.0 dataset](https://registry.npmjs.org/@capsizecss/metrics/-/metrics-4.4.0.tgz), entries entireMetricsCollection/{arial,courierNew}/regular/index.mjs. See scripts/fallback-metrics.ts. Target metrics are read from each shipped WOFF2 with fontTools.
Size adjust = target normalized x-height / fallback normalized x-height.
Each line override = target normalized line metric / size adjust.
Measurements use the default upright width and weight 400; variable width and weight
can change glyph advances, so these faces match baseline/line boxes at the regular
instance, not every possible variable setting. A local fallback must be installed.

/** Write the owner review index from the same candidate values and measured pairs as the PNG render. */
import { writeFileSync } from 'node:fs';
import { candidates, reviewAudit, reviewColor } from './palette-candidates.ts';
let body = `# Triplicate palette review · issue #9

**Draft: owner selection pending.** Signal is implemented on this branch for comparison;
no identity is final, no consumer has been rolled out, and release remains held.
The two candidates retain the three-sheet mark, font files, type scale, radii,
image generator APIs, path lettering and composition. Only palette values change.

The package had no app/homepage page. [The synthetic package sample](../samples/app.html)
uses the existing CONTRACT.md sheet, strip, field, copy-slip and action grammar.
Its composition is identical for before and both candidates; these are package
review fixtures, not screenshots or acceptance of downstream products.
The README banner and OG use the existing banner()/ogImage() output, recoloured
by exact palette substitution for alternatives. The Signal banner/OG use the
actual canonical output without substitutions. All content is synthetic.

## Recommendation

**Signal** puts neutral white, black and red at the centre of the family. Neutral
copy sheets preserve the Triplicate silhouette without retaining the old blue/violet
cast. Red identifies actions and the third copy; amber identifies errors and blocked
work. Closed is carbon ink, so completion does not look like an error or a red action.
Oxide offers a warmer paper and deeper red at the same contrast thresholds.
Neither option changes typography, mark geometry, layout or motion.

## Before / after

Overview sheets include desktop and 390 px app, desktop banner and 390 px OG.
Images below link to full-size files. The detailed gallery links every asset at
1440, 768 and 390 CSS px, device scale 1. Banner and OG preserve their native aspect
ratios and scale to viewport width: the 390 px views intentionally show their
real thumbnail size, rather than an invented mobile composition.

`;
for (const candidate of candidates) {
  body += `### ${candidate.name}\n\n${candidate.rationale}\n\n| Theme | Before | ${candidate.name} |\n|---|---|---|\n`;
  for (const theme of ['light', 'dark'] as const) body += `| ${theme} | ![Triplicate before ${theme}](before-${theme}-overview.png) | ![${candidate.id} ${theme}](${candidate.id}-${theme}-overview.png) |\n`;
  body += '\n| Theme / asset | 1440 px | 768 px | 390 px |\n|---|---|---|---|\n';
  for (const theme of ['light', 'dark'] as const) for (const asset of ['app', 'banner', 'og']) body += `| ${theme} ${asset} | ${[1440, 768, 390].map(width => `[before](before-${theme}-${asset}-${width}.png) · [after](${candidate.id}-${theme}-${asset}-${width}.png)`).join(' | ')} |\n`;
  body += '\n#### Semantic token values\n\nValues shown resolved; CSS/TypeScript status tokens keep their references. Fonts, scale,\nshape and motion are identical to the baseline.\n\n| Token | Light | Dark |\n|---|---|---|\n';
  for (const key of ['paper', 'sheet', 'carbon', 'graphite', 'rule', 'copy-secondary', 'copy-tertiary', 'stamp', 'stamp-wash', 'on-stamp', 'danger', 'progress-wash', 'blocked-wash', 'focus', 'focus-offset', ...['open', 'in_progress', 'blocked', 'closed', 'canceled'].flatMap(status => ['fg', 'bg', 'border'].map(role => `status-${status}-${role}`))]) {
    body += `| \`--pm-${key}\` | \`${reviewColor(candidate.themes.light, key)}\` | \`${reviewColor(candidate.themes.dark, key)}\` |\n`;
  }
  body += '\nFocus uses `2px solid var(--pm-stamp)` at a 3 px offset in both themes.\n\n#### Measured contrast\n\n36 text pairs ≥ 4.5:1; 10 focus pairs ≥ 3:1, including the three wash surfaces.\n28 decorative border pairs have no required minimum because every status has\na visible label and symbol; canceled also has a line-through. Ratios below are\nWCAG 2.x sRGB luminance ratios, rounded to three decimals only for presentation.\nNo rounded value is used for pass/fail.\n\n| Pair | Use / minimum | Light | Dark |\n|---|---|---:|---:|\n';
  const rows = reviewAudit(candidate);
  for (const row of rows.filter(row => row.theme === 'light')) {
    const dark = rows.find(other => other.theme === 'dark' && other.pair === row.pair && other.classification === row.classification)!;
    if (row.minimum !== null && (row.ratio < row.minimum || dark.ratio < row.minimum)) throw new Error(`Contrast failure: ${candidate.id} ${row.pair}`);
    body += `| ${row.pair} | ${row.classification} / ${row.minimum ?? '—'} | ${row.ratio.toFixed(3)} | ${dark.ratio.toFixed(3)} |\n`;
  }
  body += '\n';
}
body += `## Status and error reading without colour

The fixture labels all five states (Open, In progress, Blocked, Closed, Canceled)
and adds distinct symbols. Canceled is struck through. An outlined secondary
button visibly demonstrates keyboard focus. The primary button says “Link files”;
the amber alert begins with a warning symbol and “Error:” plus a recovery action.
Consumers must retain these labels, warning shapes and destructive action wording;
colour alone never communicates state, selection, error or danger. Amber is reserved
for blocked/destructive/error meaning, not a second brand accent. The contract's
existing stamp-wash remains a background for carbon text, never a stamp-text surface.

## Migration and compatibility

See [consumer migration notes](../palette-migration.md). No token or export is removed.
Four legacy copy names remain aliases for at least one release; status names and
banner/OG signatures are unchanged. CSS is generated from src/tokens.ts; do not fork
colours into a consuming app. Both automatic and explicit dark modes retain the
same tokens and reduced-motion behaviour.

## Reproduction and evidence

Run npm run build, npm run tokens:build, npm run assets:build, npm run banners:build,
then node scripts/palette-previews.ts and node scripts/palette-report.ts. The optional
review renderer requires an installed Playwright module and Chromium; select them
with PM_BRAND_PLAYWRIGHT_MODULE and PM_BRAND_CHROMIUM if they are outside the package.
No browser dependency ships to consumers. The renderer waits for document.fonts.ready,
rejects horizontal overflow and HTTP(S) resources, verifies all six core computed
app colours and three loaded brand font families, and captures device scale 1.
[Browser checks](browser-checks.json) record the Chromium version and all 54 captures;
[render receipts](render-receipts.json) index the source/theme/asset/viewport matrix.
[Raw contrast values](contrast.json) retain unrounded evidence for both candidates.
PNG files use the browser/resvg lossless compression; no lossy text compression.
Baseline token values are frozen in baseline-tokens.json for reproducibility.
The banner/OG snapshot hashes change intentionally with the reviewed palette;
geometry/path checks and clean-generation gates remain in force.

Owner review of the candidate remains outstanding. Technical checks and agent visual
inspection do not constitute the owner's design approval.
`;
writeFileSync('docs/palette-previews/README.md', body);
console.log('Two-candidate review index and all measured contrast pairs written');

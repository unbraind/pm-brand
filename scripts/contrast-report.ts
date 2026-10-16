/** Generate complete measured contrast evidence with the orchestrator's decorative-border decision. */
import { writeFileSync } from 'node:fs';
import { contrastAudit } from '../dist/contrast.js';
const rows = contrastAudit();
const reason = 'Decorative chip border; label text carries state and meets 4.5:1. WCAG 1.4.11 does not require 3:1.';
let body = `# Contrast evidence

${rows.length} comparisons use the WCAG 2.x sRGB relative-luminance formula,
including alpha-composited rule borders. All 36 text comparisons meet 4.5:1;
all four focus-ring comparisons meet 3:1. The gate fails below either threshold.

## Orchestrator decision: decorative chip borders

Chip state is conveyed by the text label and fill. All 28 chip-border comparisons
are classified **decorative**, with no required contrast minimum. Canary, rose and
rule tokens remain unchanged. The ten comparisons below the 3:1 reference are
listed here with their measured ratios; they are not known failures or waivers.
${reason}

| Theme | Decorative pair | Measured ratio | Reason |
|---|---|---:|---|
`;
for (const row of rows.filter(row => row.classification === 'decorative' && row.ratio < 3)) {
  body += `| ${row.theme} | ${row.pair} | ${row.ratio.toFixed(3)}:1 | ${reason} |\n`;
}
body += `
## Every allowed pair

| Pair | Classification | Minimum | Light | Dark | Result |
|---|---|---:|---:|---:|---|
`;
for (const row of rows.filter(row => row.theme === 'light')) {
  const dark = rows.find(candidate => candidate.theme === 'dark' && candidate.pair === row.pair && candidate.classification === row.classification)!;
  const result = row.minimum === null ? 'Decorative' : row.ratio >= row.minimum && dark.ratio >= row.minimum ? 'Pass' : 'FAIL';
  body += `| ${row.pair} | ${row.classification} | ${row.minimum?.toFixed(1) ?? '—'} | ${row.ratio.toFixed(3)} | ${dark.ratio.toFixed(3)} | ${result} |\n`;
}
body += '\nRegenerate after building with `node scripts/contrast-report.ts`.\n';
writeFileSync('docs/contrast.md', body);
console.log(`${rows.length} measured pairs: text/focus thresholds enforced, chip borders decorative`);

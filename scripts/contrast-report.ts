/** Generate the complete contrast evidence and minimal contract-change proposals. */
import { writeFileSync } from 'node:fs';
import { contrast, contrastAudit, tokenColor } from '../dist/contrast.js';
import type { TokenName } from '../dist/tokens.js';

/** Find the first whole-byte tint toward black that meets 3:1 against every adjacent colour. */
function borderProposal(name: TokenName, backgrounds: readonly TokenName[]): string {
  const source = tokenColor('light', name);
  const channels = [1, 3, 5].map(index => parseInt(source.slice(index, index + 2), 16));
  for (let step = 0; step <= 255; step++) {
    const hex = `#${channels.map(value => Math.round(value * (255 - step) / 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    if (backgrounds.every(bg => contrast(hex, tokenColor('light', bg)) >= 3)) return hex;
  }
  throw new Error('No border proposal found');
}
const canary = borderProposal('canary', ['paper', 'sheet', 'canary-wash']);
const rose = borderProposal('rose', ['paper', 'sheet', 'rose-wash']);
const rows = contrastAudit();
let body = `# Contrast evidence\n\nThe seed contract is unchanged. ${rows.length} comparisons are measured with the\nWCAG 2.x sRGB relative-luminance formula, including alpha-composited rule borders.\nAll text comparisons meet 4.5:1 and both focus-ring backgrounds meet 3:1.\n**Ten border comparisons fail 3:1 and require an owner decision.**\nThe test asserts the exact known-failure set and rejects any new failure; it does\nnot certify those ten pairs as AA. No tests are skipped or marked todo.\n\n## Smallest proposed contract changes\n\nChange only these status border tokens, preserving all base palette values:\n\n| Theme | Token | Proposed value | Reason |\n|---|---|---|---|\n| Light | --pm-status-in_progress-border | ${canary} | Darken canary only for the border |\n| Light | --pm-status-blocked-border | ${rose} | Darken rose only for the border |\n| Light and dark | --pm-status-canceled-border | var(--pm-graphite) | Use the existing secondary ink for a perceptible boundary |\n\nCanary and rose proposals use the first whole-byte blend toward black whose\ncontrast meets 3:1 against paper, sheet and their own wash. Graphite already\npasses 4.5:1 against paper and sheet in both themes. No graphite, stamp, or\nother base token needs adjustment. The owner must approve the resulting status\nborder exception to the seed's direct canary/rose/rule mapping before it is applied.\n\n## Every allowed pair\n\n| Pair | Minimum | Light | Dark | Result |\n|---|---:|---:|---:|---|\n`;
for (const row of rows.filter(row => row.theme === 'light')) {
  const dark = rows.find(candidate => candidate.theme === 'dark' && candidate.pair === row.pair && candidate.minimum === row.minimum)!;
  body += `| ${row.pair} | ${row.minimum.toFixed(1)} | ${row.ratio.toFixed(3)} | ${dark.ratio.toFixed(3)} | ${row.ratio >= row.minimum && dark.ratio >= dark.minimum ? 'Pass' : 'Owner decision'} |\n`;
}
body += '\nRegenerate after building with `node scripts/contrast-report.ts`.\n';
writeFileSync('docs/contrast.md', body);
console.log(`Proposed light border colours: canary ${canary}, rose ${rose}`);

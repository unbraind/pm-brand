/** Review-only palettes; Signal's canonical values live in src/tokens.ts. */
import { readFileSync } from 'node:fs';
import { tokens } from '../src/tokens.ts';
import type { Theme } from '../src/tokens.ts';
import { contrast, contrastAudit } from '../dist/contrast.js';
import type { ContrastPair } from '../dist/contrast.js';
/** A complete theme, including reference-valued semantic and compatibility tokens. */
export type ReviewTheme = Readonly<Record<string, string>>;
/** One complete light/dark proposal or the inspected baseline. */
export interface PaletteCandidate {
  /** Stable filename stem. */
  readonly id: string;
  /** Human-readable comparison name. */
  readonly name: string;
  /** Why the owner might prefer this option. */
  readonly rationale: string;
  /** Complete token sets with the original fonts, scale, shape and motion. */
  readonly themes: Readonly<Record<Theme, ReviewTheme>>;
}
/** Immutable pre-change values from the issue's inspected Triplicate baseline. */
export const baseline: PaletteCandidate = {
  id: 'before', name: 'Triplicate before', rationale: 'Inspected blue/violet baseline; comparison only.',
  themes: JSON.parse(readFileSync(new URL('../docs/palette-previews/baseline-tokens.json', import.meta.url), 'utf8')) as Record<Theme, ReviewTheme>,
};
/** Two restrained red, black and white candidates, with no layout or type variation. */
export const candidates: readonly PaletteCandidate[] = [
  { id: 'signal', name: 'Signal (recommended)', rationale: 'Neutral white/black surfaces and crisp red retain the form-paper character and give the clearest Unbrained family resemblance.', themes: tokens },
  { id: 'oxide', name: 'Oxide', rationale: 'Warmer white and charcoal with deeper red soften the paper while retaining the same mark, type and composition.', themes: {
    light: { ...tokens.light, paper: '#F7F3EF', sheet: '#FFFDFA', carbon: '#211B18', graphite: '#60554D', rule: 'rgba(33, 27, 24, .14)', stamp: '#A52A20', 'stamp-wash': '#FAEAE5', 'on-stamp': '#FFFFFF', danger: '#785000', 'copy-secondary': '#D7CFC7', 'copy-tertiary': '#A52A20', 'progress-wash': '#EEE8E2', 'blocked-wash': '#FFF0D6' },
    dark: { ...tokens.dark, paper: '#171311', sheet: '#241E1A', carbon: '#FFF8F0', graphite: '#C4B6AA', rule: 'rgba(255, 248, 240, .14)', stamp: '#FA8C78', 'stamp-wash': '#40251F', 'on-stamp': '#171311', danger: '#F5C06A', 'copy-secondary': '#65574D', 'copy-tertiary': '#FA8C78', 'progress-wash': '#322A24', 'blocked-wash': '#3B2D18' },
  } },
];
/** Resolve semantic aliases without mutating package tokens or generator state. */
export function reviewColor(theme: ReviewTheme, name: string): string {
  const value = theme[name];
  if (!value) throw new Error(`Missing review token: ${name}`);
  const reference = /^var\(--pm-([\w-]+)\)$/u.exec(value);
  return reference ? reviewColor(theme, reference[1]) : value;
}
/** Reuse all existing contract pairs and additionally audit the fixture's hover and focus surfaces. */
export function reviewAudit(candidate: PaletteCandidate): ContrastPair[] {
  const rows = contrastAudit().map(row => {
    const [fg, bg] = row.pair.split(' / ');
    return { ...row, ratio: contrast(reviewColor(candidate.themes[row.theme], fg), reviewColor(candidate.themes[row.theme], bg)) };
  });
  for (const theme of ['light', 'dark'] as const) {
    for (const bg of ['stamp-wash', 'canary-wash', 'rose-wash']) {
      rows.push({ theme, pair: `stamp / ${bg}`, ratio: contrast(reviewColor(candidate.themes[theme], 'stamp'), reviewColor(candidate.themes[theme], bg)), classification: 'focus', minimum: 3 });
    }
  }
  return rows;
}

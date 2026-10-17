/** README banner generator, using path outlines from the brand fonts. */
import type { Theme } from './tokens.js';
import { tokens } from './tokens.js';
import { boundText, ellipsize, escapeXml, textPaths } from './text.js';
import { imageSvg, imageMark } from './image.js';

/** Content accepted by the 1280 × 320 README banner. */
export interface BannerOptions {
  /** Lowercase package name, such as pm-web; capped at 512 code points without splitting graphemes. */
  readonly name: string;
  /** Plain-language description; capped at 512 code points without splitting graphemes. */
  readonly tagline: string;
  /** Explicit palette; defaults to light. */
  readonly theme?: Theme;
}

/** Generate a portable, accessible README banner with no external resources. */
export function banner({ name, tagline, theme = 'light' }: BannerOptions): string {
  name = boundText(name);
  tagline = boundText(tagline);
  escapeXml(name);
  escapeXml(tagline);
  const title = ellipsize(name, 'display', 64, 880);
  const subtitle = ellipsize(tagline, 'body', 27, 880);
  return imageSvg(1280, 320, theme, `${name}: ${tagline}`, `${imageMark(theme, 48, 58, 208)}<g data-role="name">${textPaths(title, 'display', 300, 153, 64)}</g><g data-role="tagline" fill="${tokens[theme].graphite}">${textPaths(subtitle, 'body', 302, 209, 27)}</g>`);
}

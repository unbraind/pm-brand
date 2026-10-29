import { tokens } from './tokens.js';
import { boundText, ellipsize, escapeXml, textPaths } from './text.js';
import { imageSvg, imageMark } from './image.js';
/** Generate a portable, accessible README banner with no external resources. */
export function banner({ name, tagline, theme = 'light' }) {
    name = boundText(name);
    tagline = boundText(tagline);
    escapeXml(name);
    escapeXml(tagline);
    const title = ellipsize(name, 'display', 64, 880);
    const subtitle = ellipsize(tagline, 'body', 27, 880);
    return imageSvg(1280, 320, theme, `${name}: ${tagline}`, `${imageMark(theme, 48, 58, 208)}<g data-role="name" data-text="${escapeXml(title)}">${textPaths(title, 'display', 300, 153, 64)}</g><g data-role="tagline" data-text="${escapeXml(subtitle)}" fill="${tokens[theme].graphite}">${textPaths(subtitle, 'body', 302, 209, 27)}</g>`);
}

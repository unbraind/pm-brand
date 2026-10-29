/** WCAG 2.x contrast with alpha compositing for the status border audit. */
import { tokens } from './tokens.js';
/** Parse the contract's six-digit hex, rgba, and transparent colour values. */
export function parseColor(value) {
    if (value === 'transparent')
        return [0, 0, 0, 0];
    if (/^#[\da-f]{6}$/iu.test(value))
        return [parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255, 1];
    const match = /^rgba\((\d+),[ \t\r\n\f]*(\d+),[ \t\r\n\f]*(\d+),[ \t\r\n\f]*(\d+(?:\.\d+)?|\.\d+)\)$/u.exec(value);
    if (!match)
        throw new TypeError(`Unsupported colour: ${value}`);
    const color = [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255, Number(match[4])];
    if (color.some(channel => channel < 0 || channel > 1))
        throw new TypeError('Colour channel outside sRGB');
    return color;
}
/** Composite a translucent foreground on an opaque background in sRGB. */
export function composite(foreground, background) {
    const [r, g, b, alpha] = foreground;
    return [r * alpha + background[0] * (1 - alpha), g * alpha + background[1] * (1 - alpha), b * alpha + background[2] * (1 - alpha), 1];
}
/** WCAG 2.x relative luminance, applying the standard sRGB transfer curve. */
export function luminance(color) {
    const channels = color.slice(0, 3).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
/** Contrast ratio for opaque text, or translucent ink composited onto its background. */
export function contrast(foreground, background) {
    const bg = parseColor(background);
    if (bg[3] !== 1)
        throw new TypeError('Contrast background must be opaque');
    const a = luminance(composite(parseColor(foreground), bg));
    const b = luminance(bg);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
/** Resolve a theme colour reference, retaining alpha for rule borders. */
export function tokenColor(theme, name) {
    const value = tokens[theme][name];
    const reference = /^var\(--pm-([\w-]+)\)$/u.exec(value);
    return reference ? tokenColor(theme, reference[1]) : value;
}
/** Audit all allowed text pairs, status fills/borders and keyboard focus backgrounds. */
export function contrastAudit() {
    const rows = [];
    for (const theme of ['light', 'dark']) {
        /** Record one pair using the theme's resolved contract values. */
        const add = (fg, bg, classification) => {
            const minimum = classification === 'decorative' ? null : classification === 'text' ? 4.5 : 3;
            rows.push({ theme, pair: `${fg} / ${bg}`, ratio: contrast(tokenColor(theme, fg), tokenColor(theme, bg)), classification, minimum });
        };
        for (const fg of ['carbon', 'graphite', 'stamp', 'danger']) {
            for (const bg of ['paper', 'sheet'])
                add(fg, bg, 'text');
        }
        for (const bg of ['canary-wash', 'rose-wash', 'stamp-wash'])
            add('carbon', bg, 'text');
        add('on-stamp', 'stamp', 'text');
        for (const status of ['open', 'in_progress', 'blocked', 'closed', 'canceled']) {
            const fg = `status-${status}-fg`;
            const border = `status-${status}-border`;
            const backgrounds = status === 'canceled' ? ['paper', 'sheet'] : [`status-${status}-bg`];
            for (const bg of backgrounds) {
                add(fg, bg, 'text');
                add(border, bg, 'decorative');
            }
            if (status !== 'canceled')
                for (const bg of ['paper', 'sheet'])
                    add(border, bg, 'decorative');
        }
        for (const bg of ['paper', 'sheet'])
            add('stamp', bg, 'focus');
    }
    return rows;
}

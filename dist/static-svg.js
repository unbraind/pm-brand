/** Deliberately bounded XML/SVG grammar; unsupported rendering constructs fail closed. */
import { tokens } from './tokens.js';
import { createHash } from 'node:crypto';
/** Stop at the first unsupported or malformed construct without exposing its content. */
function invalid() { throw new Error('unsupported_svg'); }
/** XML 1.0 character domain including paired supplementary code points. */
function validXml(text) {
    return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff\p{Cs}]/u.test(text);
}
/** Decode only standard XML entities; never resolve a DTD or external entity. */
function decode(text, attribute = false) {
    if (text.includes('<') || text.includes(']]>'))
        invalid();
    // XML line-end and attribute whitespace processing precedes entity expansion.
    text = text.replace(/\r\n?/gu, '\n');
    if (attribute)
        text = text.replace(/[\t\n]/gu, ' ');
    const entities = new Map([['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"]]);
    text = text.replace(/&([^;]*);|&/gu, (_match, entity) => {
        if (entity === undefined)
            return invalid();
        if (entities.has(entity))
            return entities.get(entity);
        if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/u.test(entity))
            return invalid();
        const point = entity.startsWith('#x') ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        if (point > 0x10ffff)
            return invalid();
        return String.fromCodePoint(point);
    });
    if (!validXml(text))
        invalid();
    return text;
}
/** Numeric lists require XML whitespace or a comma between complete number lexemes. */
const NUMBER_LIST = /^[ \t\r\n]*[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?(?:(?:[ \t\r\n]*,[ \t\r\n]*|[ \t\r\n]+)[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)*[ \t\r\n]*$/u;
/** Validate each contextual grammar before erasing numeric spelling or flag identity. */
function geometry(value, field) {
    if (/[^\x09\x0a\x0d\x20-\x7e]/u.test(value) || (field !== 'd' && field !== 'transform' && !NUMBER_LIST.test(value)))
        invalid();
    if (/,\s*,|^\s*,|,\s*$|\(\s*,|,\s*\)/u.test(value) || (field !== 'transform' && /[()]/u.test(value))
        || (field === 'd' && /[a-zA-Z]\s*,|,\s*[a-zA-Z]/u.test(value)))
        invalid();
    const parts = value.match(field === 'd' ? /[a-zA-Z]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/gu : /[a-zA-Z]+|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/gu) ?? [];
    if (value.replace(/[a-zA-Z]+|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|[\s,()]/gu, '') || parts.length > 32768)
        invalid();
    if (field === 'd') {
        const arities = new Map([['m', 2], ['l', 2], ['h', 1], ['v', 1], ['c', 6], ['s', 4], ['q', 4], ['t', 2], ['a', 7], ['z', 0]]);
        if (parts.length > 0 && !['M', 'm'].includes(parts[0]))
            invalid();
        let index = 0;
        while (index < parts.length) {
            const command = parts[index++];
            if (!arities.has(command.toLowerCase()))
                invalid();
            const arity = arities.get(command.toLowerCase());
            const start = index;
            while (index < parts.length && !/^[a-zA-Z]$/u.test(parts[index]))
                index++;
            const count = index - start;
            if (arity === 0 ? count !== 0 : count === 0 || count % arity !== 0)
                invalid();
            if (command.toLowerCase() === 'a')
                for (let n = start; n < index; n += 7) {
                    if (!['0', '1'].includes(parts[n + 3]) || !['0', '1'].includes(parts[n + 4]) || /^[+-]/u.test(parts[n]) || /^[+-]/u.test(parts[n + 1]))
                        invalid();
                }
        }
    }
    const values = parts.map(part => /^[a-zA-Z]+$/u.test(part) ? part : Number(part));
    if (values.some(part => typeof part === 'number' && (!Number.isFinite(part) || Math.abs(part) > 1e9)))
        invalid();
    if (field === 'transform') {
        const calls = [...value.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)/gu)];
        if (value.replace(/(matrix|translate|scale|rotate|skewX|skewY)\s*\([^()]*\)|[\s,]/gu, '') || calls.length === 0)
            invalid();
        const allowed = new Map([['matrix', [6]], ['translate', [1, 2]], ['scale', [1, 2]], ['rotate', [1, 3]], ['skewX', [1]], ['skewY', [1]]]);
        for (const call of calls) {
            const numbers = geometry(call[2], 'numbers').split(' ');
            if (!allowed.get(call[1]).includes(numbers.length))
                invalid();
        }
    }
    else if (field !== 'd') {
        // NUMBER_LIST already guarantees a nonempty stream of numeric lexemes.
        if (field !== 'numbers' && field !== 'points' && values.length !== (field === 'viewBox' ? 4 : 1))
            invalid();
        if (field === 'points' && (values.length < 4 || values.length % 2 !== 0))
            invalid();
        if (['width', 'height', 'r', 'rx', 'ry', 'stroke-width', 'font-size', 'data-lines'].includes(field) && Number(values[0]) < 0)
            invalid();
        if (field === 'viewBox' && (Number(values[2]) < 0 || Number(values[3]) < 0))
            invalid();
        if (field.endsWith('opacity') && (Number(values[0]) < 0 || Number(values[0]) > 1))
            invalid();
    }
    return values.join(' ');
}
/** Validate and normalize supported presentation attributes using one grammar. */
function attribute(field, value) {
    if (field === 'xmlns') {
        if (value !== 'http://www.w3.org/2000/svg')
            invalid();
        return value;
    }
    if (field === 'id') {
        if (!/^[a-zA-Z_][a-zA-Z0-9_.:-]{0,255}$/u.test(value))
            invalid();
        return value;
    }
    if (['data-role', 'data-token', 'aria-labelledby', 'aria-describedby'].includes(field)) {
        if (value.length === 0 || value.length > 256 || /[\p{Cc}]/u.test(value))
            invalid();
        return value.replace(/ +/gu, ' ').replace(/^ +| +$/gu, '');
    }
    if (['aria-label', 'data-text'].includes(field))
        return value;
    const enums = new Map([
        ['role', ['img', 'presentation', 'none', 'graphics-document', 'graphics-symbol']],
        ['aria-hidden', ['true', 'false']], ['fill-rule', ['nonzero', 'evenodd']],
        ['stroke-linecap', ['butt', 'round', 'square']], ['stroke-linejoin', ['miter', 'round', 'bevel']],
        ['text-anchor', ['start', 'middle', 'end']],
    ]);
    if (enums.has(field)) {
        if (!enums.get(field).includes(value))
            invalid();
        return value;
    }
    if (['fill', 'stroke', 'color'].includes(field)) {
        value = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/gu, '');
        if (/^#[0-9a-f]{3}$/iu.test(value))
            return `#${[...value.slice(1).toLowerCase()].map(c => c + c).join('')}`;
        if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(value))
            return value.toLowerCase();
        const named = new Map([['black', '#000000'], ['white', '#ffffff'], ['red', '#ff0000'], ['green', '#008000'], ['blue', '#0000ff']]);
        if (named.has(value.toLowerCase()))
            return named.get(value.toLowerCase());
        if (['none', 'currentColor', 'transparent'].includes(value))
            return value;
        const token = /^var\(--pm-([a-z_-]+)\)$/u.exec(value);
        if (token && Object.hasOwn(tokens.light, token[1]))
            return value;
        return invalid();
    }
    if (['x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'width', 'height', 'rx', 'ry', 'r', 'viewBox', 'transform', 'd', 'points', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'font-size', 'data-lines'].includes(field))
        return geometry(value, field);
    return invalid();
}
/** Read strict XML into at most 4096 nodes and 32 levels; no forgiving HTML parsing. */
export function parseStaticSvg(source) {
    try {
        source = source.replace(/^\ufeff/u, '');
        if (!validXml(source))
            invalid();
        const nodes = [], stack = [];
        const ids = new Set();
        let offset = 0, rootClosed = false;
        /** Finish text according to SVG default whitespace processing. */
        const finish = (frame) => {
            if (['text', 'title', 'desc'].includes(frame.node.tag))
                frame.node.fields.text = frame.text.replace(/[\t\n\r]/gu, ' ').replace(/ +/gu, ' ').replace(/^ +| +$/gu, '');
            else if (/[^\t\n\r ]/u.test(frame.text))
                invalid();
        };
        while (offset < source.length) {
            if (source.startsWith('<!--', offset)) {
                const end = source.indexOf('-->', offset + 4);
                if (end < 0 || source.slice(offset + 4, end).includes('--') || source[end - 1] === '-')
                    invalid();
                offset = end + 3;
                continue;
            }
            if (source.startsWith('<?xml ', offset) && offset === 0) {
                const declaration = /^<\?xml version=(?:"1\.0"|'1\.0')(?: encoding=(?:"UTF-8"|'UTF-8'))?[ \t\r\n]*\?>/u.exec(source);
                if (!declaration)
                    invalid();
                offset = declaration[0].length;
                continue;
            }
            if (source[offset] !== '<') {
                const next = source.indexOf('<', offset);
                const end = next === -1 ? source.length : next;
                const raw = source.slice(offset, end);
                // XML Misc outside the document element permits literal S, never references.
                // Validate that lexical context before expansion can erase illegal syntax.
                if (stack.length)
                    stack.at(-1).text += decode(raw);
                else if (/[^\t\n\r ]/u.test(raw))
                    invalid();
                offset = end;
                continue;
            }
            const close = /^<\/([a-zA-Z]+)[ \t\r\n]*>/u.exec(source.slice(offset));
            if (close) {
                const frame = stack.pop();
                if (!frame || frame.node.tag !== close[1])
                    invalid();
                finish(frame);
                if (stack.length === 0)
                    rootClosed = true;
                offset += close[0].length;
                continue;
            }
            const start = /^<([a-zA-Z]+)(?=[ \t\r\n/>])/u.exec(source.slice(offset));
            if (!start || !['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'title', 'desc'].includes(start[1]))
                invalid();
            const tag = start[1], parent = stack.at(-1);
            if ((!parent && (tag !== 'svg' || nodes.length > 0 || rootClosed)) || (parent && tag === 'svg') || stack.length >= 32 || nodes.length >= 4096)
                invalid();
            // Mixed text/tspan content needs shaping/context to compare faithfully; refuse it.
            if (parent && !['svg', 'g'].includes(parent.node.tag))
                invalid();
            offset += start[0].length;
            const fields = Object.create(null);
            while (!/^[ \t\r\n]*\/?>/u.test(source.slice(offset))) {
                const attr = /^[ \t\r\n]+([a-zA-Z][a-zA-Z0-9:-]*)[ \t\r\n]*=[ \t\r\n]*(?:"([^"<]*)"|'([^'<]*)')/u.exec(source.slice(offset));
                if (!attr || Object.hasOwn(fields, attr[1]) || Object.keys(fields).length >= 32)
                    invalid();
                fields[attr[1]] = attribute(attr[1], decode(attr[2] ?? attr[3], true));
                offset += attr[0].length;
            }
            const end = /^[ \t\r\n]*(\/?)>/u.exec(source.slice(offset));
            offset += end[0].length;
            if (fields.id) {
                if (ids.has(fields.id))
                    invalid();
                ids.add(fields.id);
            }
            const ordinal = (parent?.counts.get(tag) ?? 0) + 1;
            parent?.counts.set(tag, ordinal);
            const locator = fields.id ? `#${fields.id}` : `${parent ? `${parent.node.locator}/` : ''}${tag}[${ordinal}]`;
            const node = { locator, tag, parent: parent ? parent.node.locator : null, fields, children: [] };
            // XML ids and namespace serialization do not themselves affect pixels; references remain explicit fields.
            delete fields.id;
            delete fields.xmlns;
            nodes.push(node);
            if (parent)
                parent.node.children.push(locator);
            const frame = { node, counts: new Map(), text: '' };
            if (end[1]) {
                finish(frame);
                if (!parent)
                    rootClosed = true;
            }
            else
                stack.push(frame);
        }
        if (stack.length || !rootClosed)
            invalid();
        // Annotated outline runs are localized as one unit. Their canonical geometry
        // remains in a digest so edited outlines cannot disappear behind metadata.
        const byLocator = new Map(nodes.map(node => [node.locator, node]));
        const grouped = new Set();
        for (const node of nodes)
            if (Object.hasOwn(node.fields, 'data-text')) {
                if (node.tag !== 'g' || node.children.some(child => !['path', 'title', 'desc'].includes(byLocator.get(child).tag)))
                    invalid();
                const outlines = node.children.filter(child => byLocator.get(child).tag === 'path').map(child => {
                    const path = byLocator.get(child);
                    if (Object.keys(path.fields).some(key => !['d', 'transform'].includes(key)))
                        invalid();
                    grouped.add(child);
                    return Object.entries(path.fields).sort(([a], [b]) => a.localeCompare(b));
                });
                node.fields.outline = createHash('sha256').update(JSON.stringify(outlines)).digest('hex');
                node.children.splice(0, node.children.length, ...node.children.filter(child => byLocator.get(child).tag !== 'path'));
            }
        return nodes.filter(node => !grouped.has(node.locator));
    }
    catch {
        return null;
    }
}

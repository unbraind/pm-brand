/** Deliberately bounded XML/SVG grammar; unsupported rendering constructs fail closed. */
import { createRequire } from 'node:module';
import { tokens } from './tokens.js';
import { createHash } from 'node:crypto';
import { parseXml, XmlElement, XmlText } from '@rgrove/parse-xml';
/** Reject unsupported semantic interpretation without exposing supplied content. */
function invalid() { throw new Error('unsupported_semantics'); }
/** Stop at a documented parser/projection resource limit. */
function limit() { throw new Error('unsupported_svg'); }
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
    if (parts.length > 32768)
        limit();
    if (value.replace(/[a-zA-Z]+|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|[\s,()]/gu, ''))
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
/** Read XML 1.0 with a maintained parser, then project the bounded static SVG domain. */
export function parseStaticSvg(source) {
    try {
        if (Buffer.byteLength(source) > 1048576)
            limit();
        // No resolver is supplied. The parser never loads DTDs or expands custom entities.
        const document = parseXml(source, { ignoreUndefinedEntities: false, preserveDocumentType: true, preserveXmlDeclaration: true });
        const nodes = [];
        const ids = new Set();
        if (document.children.some(child => child.type === 'doctype'
            || (child.type === 'xmldecl' && 'version' in child && child.version !== '1.0')
            || (child.type === 'pi' && 'name' in child && child.name === 'xml-stylesheet')))
            invalid();
        // The binding can resolve local images. Reject resource-bearing constructs before
        // native parsing; never pass supplied file paths or font configuration to it.
        const pending = [{ element: document.root, depth: 1 }];
        let count = 0;
        while (pending.length) {
            const { element, depth } = pending.pop();
            if (depth > 32 || ++count > 4096 || Object.keys(element.attributes).length > 32)
                limit();
            if (!['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'title', 'desc'].includes(element.name.split(':').at(-1))
                || Object.entries(element.attributes).some(([name, value]) => ['href', 'src', 'style'].includes(name.split(':').at(-1)) || (['fill', 'stroke', 'filter', 'clip-path', 'mask', 'cursor'].includes(name) && /url\(/iu.test(value))))
                invalid();
            for (const child of element.children) {
                if (child instanceof XmlElement)
                    pending.push({ element: child, depth: depth + 1 });
                else if (child.type === 'pi' && 'name' in child && child.name === 'xml-stylesheet')
                    invalid();
            }
        }
        try {
            // Constructor only: validate the original bytes with the brand renderer,
            // without generating pixels, loading system fonts or resolving resources.
            const { Resvg } = createRequire(import.meta.url)('@resvg/resvg-js');
            new Resvg(source, { font: { loadSystemFonts: false }, logLevel: 'off' });
        }
        catch (error) {
            return { code: 'unsupported_svg', reason: String(error).replace(/[\p{Cc}]/gu, ' ').slice(0, 512) };
        }
        /** Project parsed names, text and attributes; XML tokenization/decoding stays in the dependency. */
        const visit = (element, parent, counts, inherited) => {
            const namespaces = new Map(inherited);
            for (const [name, value] of Object.entries(element.attributes)) {
                if (name === 'xmlns' || name.startsWith('xmlns:')) {
                    const prefix = name === 'xmlns' ? '' : name.slice(6);
                    namespaces.set(prefix, value);
                }
            }
            const parts = element.name.split(':');
            const tag = parts.at(-1);
            const uri = namespaces.get(parts.length === 2 ? parts[0] : '');
            if (uri !== 'http://www.w3.org/2000/svg')
                invalid();
            if (parent && (tag === 'svg' || !['svg', 'g'].includes(parent.tag)))
                invalid();
            const fields = Object.create(null);
            for (const [name, value] of Object.entries(element.attributes)) {
                if (name === 'xmlns' || name.startsWith('xmlns:'))
                    continue;
                fields[name] = attribute(name, value);
            }
            if (fields.id) {
                if (ids.has(fields.id))
                    invalid();
                ids.add(fields.id);
            }
            const ordinal = (counts.get(tag) ?? 0) + 1;
            counts.set(tag, ordinal);
            const locator = fields.id ? `#${fields.id}` : `${parent ? `${parent.locator}/` : ''}${tag}[${ordinal}]`;
            const node = { locator, tag, parent: parent ? parent.locator : null, fields, children: [] };
            delete fields.id;
            nodes.push(node);
            if (parent)
                parent.children.push(locator);
            const childCounts = new Map();
            let text = '';
            for (const child of element.children) {
                if (child instanceof XmlElement)
                    visit(child, node, childCounts, namespaces);
                else if (child instanceof XmlText)
                    text += child.text;
            }
            if (['text', 'title', 'desc'].includes(tag))
                fields.text = text.replace(/[\t\n\r]/gu, ' ').replace(/ +/gu, ' ').replace(/^ +| +$/gu, '');
            else if (/[^\t\n\r ]/u.test(text))
                invalid();
        };
        visit(document.root, null, new Map(), new Map());
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
    catch (error) {
        return { code: error instanceof Error && error.message === 'unsupported_semantics' ? 'unsupported_semantics' : 'unsupported_svg' };
    }
}

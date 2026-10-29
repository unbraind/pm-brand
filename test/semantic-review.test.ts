/** Review regressions: topology must survive anchoring, and grammar precedes normalization. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseStaticSvg } from '../dist/static-svg.js';
import { parseXml } from '@rgrove/parse-xml';
import { Resvg } from '@resvg/resvg-js';
import { decode } from '@toon-format/toon';
import * as sdk from '@unbrained/pm-cli/sdk';
import { compareSemanticAssets, renderSemanticAssetReport } from '../dist/semantic-assets.js';
import type { SemanticAssetDiagnosis, SemanticAssetResult } from '../dist/semantic-assets.js';
import { semanticReviewCases, packedSemanticReviewCases, renderedColorReviewRequest } from '../scripts/semantic-review-fixtures.ts';

/** Assert the independent oracle without depending on internal normalization. */
function check(result: SemanticAssetResult, expected: string): void {
  if (expected.startsWith('unsupported_')) { assert.ok(!result.ok); assert.equal(result.code, expected); return; }
  assert.ok(result.ok, JSON.stringify(result));
  if (expected === 'unchanged') assert.equal(result.summary.changes, 0);
  else assert.ok(result.findings.some(row => row.field === expected), `Missing ${expected}: ${JSON.stringify(result)}`);
}

test('review topology and lexical corpus agrees across SDK and both complete wire encodings', async () => {
  for (const row of semanticReviewCases()) {
    const result = compareSemanticAssets(row.request); check(result, row.expected);
    for (const format of ['json', 'toon'] as const) {
      const report = await renderSemanticAssetReport({ ...row.request, format, budget: 1000000 }, sdk);
      assert.deepEqual(report.result, result, row.name);
      assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result, row.name);
    }
  }
});

test('renderer acceptance gates every original document and retains bounded native reasons', async () => {
  const originalRender = Resvg.prototype.render;
  try {
    Resvg.prototype.render = function () { throw new Error('Semantic validation must never rasterize'); };
    for (const row of semanticReviewCases().filter(entry => entry.name.startsWith('renderer-'))) {
      const result = compareSemanticAssets(row.request); check(result, row.expected);
      for (const format of ['json', 'toon'] as const) {
        const report = await renderSemanticAssetReport({ ...row.request, format, budget: 1000000 }, sdk);
        assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
      }
    }
    for (const side of ['before', 'after'] as const) {
      const valid = '<svg xmlns="http://www.w3.org/2000/svg"/>';
      const malformed = valid.replace('xmlns=', 'xmlns:=');
      const mixed = compareSemanticAssets({ version: 1, before: valid + '', after: valid,
        [side]: malformed, [side === 'before' ? 'after' : 'before']: valid.replace('/>', ' class="unsupported"/>') });
      assert.ok(!mixed.ok); assert.equal(mixed.code, 'unsupported_svg'); assert.equal(mixed.path, `$.${side}`);
      for (const source of [valid.replace('xmlns=', 'xmlns:='), '<svg/>', '<svg xmlns=""/>', valid.replace('/>', `><${'p'.repeat(2048)}:rect/></svg>`)]) {
        let reason = '';
        try { new Resvg(source, { font: { loadSystemFonts: false }, logLevel: 'off' }); } catch (error) { reason = String(error); }
        assert.ok(reason);
        const result = compareSemanticAssets({ version: 1, before: valid, after: valid, [side]: source });
        assert.ok(!result.ok); assert.equal(result.code, 'unsupported_svg'); assert.equal(result.path, `$.${side}`);
        assert.ok(result.reason); assert.ok(result.reason.length <= 512);
        if (reason.length <= 512) assert.equal(result.reason, reason);
        else { assert.equal(result.reason.length, 512); assert.ok(reason.startsWith(result.reason)); }
        assert.ok(result.remedy.includes('Resvg'));
        for (const format of ['json', 'toon'] as const) {
          const report = await renderSemanticAssetReport({ version: 1, before: valid, after: valid, [side]: source, format, budget: 512 }, sdk);
          assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
        }
      }
    }
  } finally { Resvg.prototype.render = originalRender; }
});

test('renderer mutation model refuses all rejected namespace prefix entity quote and nesting variants', async () => {
  let seed = 0x6a7e, replays = 0, rejected = 0, accepted = 0, xmlRefusals = 0;
  const domains = new Set<number>();
  /** Reproducible mutations and replays of older original byte strings. */
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  for (let sequence = 0; sequence < 500; sequence++) {
    const valid = `<svg xmlns="http://www.w3.org/2000/svg" width="${1 + next() % 100}" height="20"><g><rect width="10" height="10"/></g><text>A&amp;B</text></svg>`;
    const history: { source: string; domain: number }[] = [{ source: valid, domain: 0 }];
    for (let step = 0; step < 8; step++) {
      const domain = next() % 5, variant = next() % 5;
      const alphabet = ['p', 's', '_', ':', '0', '-', '.', '名', '\u00a0'];
      const prefix = Array.from({ length: next() % 8 }, () => alphabet[next() % alphabet.length]).join('');
      const point = [0, 32, 38, 0xd800, 0x110000, 65 + next() % 26][next() % 6];
      const source = domain === 0 ? valid.replace('xmlns=', ['xmlns:=', 'xmlns:p:q=', 'xmlns:p=', 'xmlns=', `xmlns:${prefix}=`][variant])
        : domain === 1 ? valid.replace('<rect ', `<${['missing:', ':', 'p:q:', '', `${prefix}:`][variant]}rect `)
        : domain === 2 ? valid.replace('&amp;', ['&unknown;', '&#0;', `&#x${point.toString(16)};`, '&#38;', '&amp;'][variant])
        : domain === 3 ? valid.replace('height="20"', ['height=20', 'height="20', "height='20'", 'height="20"', 'height=\"20\''][variant])
        : [valid.replace('</g>', '</rect>'), valid + valid, valid.replace('</svg>', ''), valid, valid.replace('<g>', '<g><g>').replace('</g>', '</g></g>')][variant];
      let state = { source, domain };
      if (next() % 5 === 0) { state = history[next() % history.length]; replays++; }
      history.push(state); domains.add(state.domain);
      let nativeAccepted = true;
      try { new Resvg(state.source, { font: { loadSystemFonts: false }, logLevel: 'off' }); } catch { nativeAccepted = false; }
      for (const side of ['before', 'after'] as const) {
        const request = { version: 1, before: valid, after: valid, [side]: state.source };
        const result = compareSemanticAssets(request);
        if (nativeAccepted) {
          if (result.ok) {
            check(compareSemanticAssets({ version: 1, before: state.source, after: state.source }), 'unchanged'); accepted++;
          } else {
            assert.throws(() => parseXml(state.source)); assert.equal(result.code, 'unsupported_svg'); xmlRefusals++;
          }
        }
        else { assert.ok(!result.ok); assert.equal(result.code, 'unsupported_svg'); assert.equal(result.path, `$.${side}`); rejected++; }
        for (const format of ['json', 'toon'] as const) {
          const report = await renderSemanticAssetReport({ ...request, format, budget: 1000000 }, sdk);
          assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
        }
      }
    }
  }
  assert.equal(domains.size, 5); assert.ok(replays > 500); assert.ok(rejected > 1000); assert.ok(accepted > 1000);
  console.log(`Renderer mutation model: 500 sequences, 4000 transitions, ${replays} older-input replays, ${rejected} rejected-side checks, ${accepted} accepted-side controls, ${xmlRefusals} stricter XML refusals, zero rasters`);
});

test('namespace identity never promotes an empty reset or missing default into SVG', () => {
  for (const row of semanticReviewCases().filter(entry => entry.name.startsWith('namespace-'))) check(compareSemanticAssets(row.request), row.expected);
  const before = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="10" height="10"/></svg>';
  const after = before.replace('<rect ', '<rect xmlns="" ');
  const options = { font: { loadSystemFonts: false } };
  assert.equal(new Resvg(before, options).innerBBox()!.width, 10);
  assert.equal(new Resvg(after, options).innerBBox(), undefined);
});

test('namespace model agrees with independent SVG geometry across 500 replay sequences', async () => {
  type Model = { root: number; prefix: string; qualified: boolean[]; declarations: number[] };
  const options = { font: { loadSystemFonts: false } };
  /** Serialize declarations and qualified names without using the production namespace resolver. */
  const render = (model: Model): string => {
    const root = model.root ? `${model.prefix}:svg` : 'svg';
    /** A model declaration is absent, explicitly empty, or explicitly SVG. */
    const declaration = (kind: number): string => kind === 0 ? '' : ` xmlns="${kind === 1 ? '' : 'http://www.w3.org/2000/svg'}"`;
    let body = '';
    for (let i = 0; i < 4; i++) {
      const name = `${model.qualified[i] ? `${model.prefix}:` : ''}${i === 3 ? 'rect' : 'g'}`;
      body += `<${name} id="n${i}"${declaration(model.declarations[i])}${i === 3 ? ' width="10" height="10"/>' : '>'}`;
    }
    for (let i = 2; i >= 0; i--) body += `</${model.qualified[i] ? `${model.prefix}:` : ''}g>`;
    return `<${root} xmlns:${model.prefix}="http://www.w3.org/2000/svg"${declaration(model.root === 0 ? 2 : model.root === 1 ? 0 : 1)} width="20" height="20">${body}</${root}>`;
  };
  const canonical = render({ root: 0, prefix: 's', qualified: [false, false, false, false], declarations: [0, 0, 0, 0] });
  let seed = 0x4e534d, replays = 0, refused = 0, accepted = 0;
  const domains = new Set<string>();
  /** Reproducible transitions through namespace declarations, QName identity and older inputs. */
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  for (let sequence = 0; sequence < 500; sequence++) {
    let model: Model = { root: next() % 3, prefix: ['s', 'constructor', '__proto__'][next() % 3], qualified: [true, true, true, true], declarations: [0, 0, 0, 0] };
    const history = [structuredClone(model)];
    for (let step = 0; step < 8; step++) {
      const slot = next() % 4;
      if (next() % 5 === 0) { model = structuredClone(history[next() % history.length]); replays++; }
      else { model.qualified[slot] = next() % 2 === 0; model.declarations[slot] = next() % 3; model.root = next() % 3; }
      history.push(structuredClone(model));
      const source = render(model), geometry = new Resvg(source, options).innerBBox();
      const request = { version: 1, before: canonical, after: source };
      const result = compareSemanticAssets(request);
      if (geometry) { assert.equal(geometry.width, 10); check(result, 'unchanged'); accepted++; }
      else { check(result, 'unsupported_semantics'); refused++; }
      domains.add(String(model.root));
      for (const format of ['json', 'toon'] as const) {
        const report = await renderSemanticAssetReport({ ...request, format, budget: 1000000 }, sdk);
        assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
      }
    }
  }
  assert.ok(replays > 500); assert.ok(refused > 500); assert.ok(accepted > 500); assert.equal(domains.size, 3);
  console.log(`Namespace model: 500 sequences, 4000 transitions, ${replays} older-input replays, ${accepted} accepted, ${refused} refusals, zero rasters`);
});

test('XML parser limits and semantic policy refuse independently with exact typed remedies', () => {
  for (const source of ['<svg xmlns="http://www.w3.org/2000/svg"><text>]]></text></svg>', '<svg xmlns="http://www.w3.org/2000/svg" aria-label="&#0;"/>', '<svg xmlns="http://www.w3.org/2000/svg" aria-label="&bogus;"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><text><![CDATA[unterminated</text></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><!--x---></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><?agent?></svg>tail',
    '<svg xmlns="http://www.w3.org/2000/svg"><text>\u0000</text></svg>', '<svg xmlns="http://www.w3.org/2000/svg">\ud800</svg>']) {
    const result = compareSemanticAssets({ version: 1, before: '<svg xmlns="http://www.w3.org/2000/svg"/>', after: source });
    check(result, 'unsupported_svg'); assert.ok(!result.ok); assert.equal(result.path, '$.after'); assert.ok(result.remedy.length);
  }
  for (const source of ['<!DOCTYPE svg SYSTEM "https://example.invalid/never-fetch"><svg xmlns="http://www.w3.org/2000/svg"/>',
    '<!DOCTYPE svg SYSTEM "file:///never-read"><svg xmlns="http://www.w3.org/2000/svg"/>', '<!DOCTYPE svg [<!ENTITY x "ignored">]><svg xmlns="http://www.w3.org/2000/svg"/>',
    '<?xml-stylesheet href="https://example.invalid/never-fetch"?><svg xmlns="http://www.w3.org/2000/svg"/>', '<svg xmlns="http://www.w3.org/2000/svg"><?xml-stylesheet href="file:///never-read"?></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0@"/></svg>', '<svg xmlns="urn:foreign"/>',
    '<svg xmlns:bad:prefix="urn:inert"/>', '<svg xmlns:xmlns="urn:inert"/>', '<svg xmlns:p=""/>',
    '<svg xmlns="http://www.w3.org/2000/xmlns/"/>', '<svg xmlns:xml="urn:wrong"/>', '<svg xmlns:p="http://www.w3.org/XML/1998/namespace"/>', '<unbound:svg/>', '<a:b:svg/>',
    '<?xml version="1.1"?><svg xmlns="http://www.w3.org/2000/svg"/>']) {
    let expected = 'unsupported_semantics';
    try { new Resvg(source, { font: { loadSystemFonts: false } }); } catch { expected = 'unsupported_svg'; }
    check(compareSemanticAssets({ version: 1, before: source, after: '<svg xmlns="http://www.w3.org/2000/svg"/>' }), expected);
  }
  for (const source of [`<svg xmlns="http://www.w3.org/2000/svg">${'<g>'.repeat(32)}${'</g>'.repeat(32)}</svg>`, `<svg xmlns="http://www.w3.org/2000/svg">${'<rect/>'.repeat(4096)}</svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" ${Array.from({ length: 33 }, (_, i) => `xmlns:n${i}="urn:inert"`).join(' ')}/>`, ' '.repeat(1048536) + '<svg xmlns="http://www.w3.org/2000/svg"/>']) {
    const parsed = parseStaticSvg(source); assert.ok(!Array.isArray(parsed)); assert.equal(parsed.code, 'unsupported_svg');
  }
  for (const source of ['<svg xmlns="http://www.w3.org/2000/svg"/>', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xml="http://www.w3.org/XML/1998/namespace"/>', `<svg xmlns="http://www.w3.org/2000/svg">${'<g>'.repeat(31)}${'</g>'.repeat(31)}</svg>`, `<svg xmlns="http://www.w3.org/2000/svg">${'<rect/>'.repeat(4095)}</svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" ${Array.from({ length: 31 }, (_, i) => `xmlns:n${i}="urn:inert"`).join(' ')}/>`, ' '.repeat(1048535) + '<svg xmlns="http://www.w3.org/2000/svg"/>']) {
    const parsed = parseStaticSvg(source); assert.ok(Array.isArray(parsed));
  }
});

test('XML conformance pairs preserve escaping, CDATA, comments, PI, namespaces, BOM and CRLF', () => {
  for (const row of semanticReviewCases().filter(entry => entry.name.startsWith('xml-'))) {
    check(compareSemanticAssets(row.request), 'unchanged');
    check(compareSemanticAssets({ ...row.request, before: row.request.after, after: row.request.before }), 'unchanged');
  }
});

test('XML conformance retains decoded source values and distinguishes changed CDATA content', () => {
  for (const tag of ['text', 'title', 'desc']) {
    const before = `<svg xmlns="http://www.w3.org/2000/svg"><${tag} id="value"><![CDATA[A<&>B]]></${tag}></svg>`;
    const after = `<svg xmlns="http://www.w3.org/2000/svg"><${tag} id="value"><![CDATA[C<&>D]]></${tag}></svg>`;
    const parsed = parseStaticSvg(before); assert.ok(Array.isArray(parsed));
    assert.equal(parsed.find(node => node.locator === '#value')!.fields.text, 'A<&>B');
    const result = compareSemanticAssets({ version: 1, before, after }); assert.ok(result.ok);
    assert.equal(result.findings.length, 1); assert.equal(result.findings[0].field, tag === 'text' ? 'text' : `aria-${tag}`);
    assert.equal(JSON.parse(result.findings[0].before_json), 'A<&>B'); assert.equal(JSON.parse(result.findings[0].after_json), 'C<&>D');
  }
  const parsed = parseStaticSvg('<svg xmlns="http://www.w3.org/2000/svg" aria-label="A]]>B &lt;&amp;&#x1f680;"/>'); assert.ok(Array.isArray(parsed));
  assert.equal(parsed[0].fields['aria-label'], 'A]]>B <&🚀');
});

test('equivalent XML serialization model replays 500 random SVG sequences without semantic changes', async () => {
  const alphabet = ['A', 'B', ']]>', '<&', '"', "'", '🚀', 'é', '\u00a0', '\u2028', ' '];
  let seed = 0x5e21a1, replays = 0;
  /** Deterministic independent source-value schedule. */
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  /** Serialize raw values without reading or normalizing comparator state. */
  const escape = (value: string, mode: number): string => [...value].map(char => mode === 2 ? `&#${char.codePointAt(0)};`
    : mode === 3 ? `&#x${char.codePointAt(0)!.toString(16)};`
    : char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '"' ? '&quot;' : char === "'" ? '&apos;' : char === '>' && mode === 0 ? '&gt;' : char).join('');
  type Model = { label: string; title: string; text: string; x: number; fill: string };
  /** Re-serialize the same SVG model with independently chosen namespace and lexical forms. */
  const serialize = (model: Model, variant: number): string => {
    const prefix = variant % 2 ? 's:' : '', ns = `xmlns${prefix ? ':s' : ''}="http://www.w3.org/2000/svg"`;
    const quote = variant % 2 ? "'" : '"';
    const mode = variant % 4;
    const attrs = [['aria-label', model.label], ['role', 'img']];
    if (variant % 2) attrs.reverse();
    const attributes = attrs.map(([key, value]) => `${key}=${quote}${escape(value, mode)}${quote}`).join(variant % 2 ? '\r\n' : ' ');
    /** CDATA splitting is a serializer operation on source values, not a comparator normalizer. */
    const text = (value: string): string => variant % 2 ? `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>` : escape(value, mode === 1 ? 0 : mode);
    const noise = variant % 2 ? '<!--serialize--><?agent compare?>' : '';
    return `${variant % 2 ? '\ufeff<?xml version="1.0"?>\r\n' : ''}<${prefix}svg ${ns} ${attributes}>${noise}<${prefix}title id="title">${text(model.title)}</${prefix}title><${prefix}g><${prefix}rect id="shape" x="${model.x}" fill="${model.fill}"/><${prefix}text id="label">${text(model.text)}</${prefix}text></${prefix}g></${prefix}svg>`;
  };
  for (let sequence = 0; sequence < 500; sequence++) {
    /** Random source strings always include the formerly misclassified attribute delimiter. */
    const value = (): string => 'A]]>B' + Array.from({ length: 1 + next() % 20 }, () => alphabet[next() % alphabet.length]).join('');
    let model: Model = { label: value(), title: value(), text: value(), x: next() % 100, fill: next() % 2 ? '#ff0000' : '#ffffff' };
    const history = [structuredClone(model)];
    for (let step = 0; step < 8; step++) {
      if (next() % 5 === 0) { model = structuredClone(history[next() % history.length]); replays++; }
      else { model = { ...model, label: value(), text: value() }; }
      history.push(structuredClone(model));
      const request = { version: 1, before: serialize(model, 0), after: serialize(model, next() % 8) };
      const result = compareSemanticAssets(request); check(result, 'unchanged');
      const parsed = parseStaticSvg(request.after); assert.ok(Array.isArray(parsed)); assert.equal(parsed[0].fields['aria-label'], model.label);
      for (const format of ['json', 'toon'] as const) {
        const report = await renderSemanticAssetReport({ ...request, format, budget: 1000000 }, sdk);
        assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
      }
    }
  }
  assert.ok(replays > 500);
  console.log(`XML serialization model: 500 sequences, 4000 transitions, ${replays} older-input replays, zero changes`);
});

test('document boundary references agree with the independent XML parser and preserve legal controls', () => {
  for (const row of semanticReviewCases().filter(entry => entry.name.startsWith('document-'))) {
    check(compareSemanticAssets(row.request), row.expected);
    if (row.expected.startsWith('unsupported_')) {
      const malformed = row.request.before.includes('&#') ? row.request.before : row.request.after;
      assert.throws(() => new Resvg(malformed, { font: { loadSystemFonts: false } }), row.name);
    } else {
      assert.doesNotThrow(() => new Resvg(row.request.before, { font: { loadSystemFonts: false } }), row.name);
      assert.doesNotThrow(() => new Resvg(row.request.after, { font: { loadSystemFonts: false } }), row.name);
    }
  }
});

test('document context model preserves lexical boundaries across 500 replay sequences', async () => {
  const document = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
  let seed = 0xd0c, replays = 0, refused = 0;
  /** Deterministic independent input schedule, including older source replays. */
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  type State = { source: string; legal: boolean };
  for (let sequence = 0; sequence < 500; sequence++) {
    const history: State[] = [{ source: document, legal: true }];
    for (let step = 0; step < 8; step++) {
      const point = [9, 10, 13, 32][next() % 4], hex = next() % 2 === 0;
      const ref = `&#${hex ? 'x' : ''}${'0'.repeat(next() % 8)}${point.toString(hex ? 16 : 10)};`;
      const where = next() % 5, noise = [' ', '\t', '\r\n', '<!--&#32;-->'][next() % 4];
      let state: State = { legal: where >= 2, source: where === 0 ? `${noise}${ref}${document}`
        : where === 1 ? `${document}${ref}${noise}` : where === 2 ? `${noise}${document}${noise}`
        : where === 3 ? document.replace('<rect', `${ref}<rect`) : document.replace('<svg xmlns="http://www.w3.org/2000/svg" ', `<svg xmlns="http://www.w3.org/2000/svg" aria-label="A${ref}B" `) };
      if (next() % 5 === 0) { state = history[next() % history.length]; replays++; }
      history.push(state);
      const request = { version: 1, before: next() % 2 ? document : state.source, after: state.source };
      const result = compareSemanticAssets(request);
      assert.equal(result.ok, state.legal);
      if (state.legal) assert.doesNotThrow(() => new Resvg(state.source, { font: { loadSystemFonts: false } }));
      else { check(result, 'unsupported_svg'); assert.throws(() => new Resvg(state.source, { font: { loadSystemFonts: false } })); refused++; }
      for (const format of ['json', 'toon'] as const) {
        const report = await renderSemanticAssetReport({ ...request, format, budget: 1000000 }, sdk);
        assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
      }
    }
  }
  assert.ok(replays > 500); assert.ok(refused > 1000);
  console.log(`Document context model: 500 sequences, 4000 transitions, ${replays} older-input replays, ${refused} refusals`);
});

test('metadata order changes are localized accessibility findings without paint noise', () => {
  for (const row of semanticReviewCases().filter(entry => entry.name.startsWith('metadata-'))) {
    const result = compareSemanticAssets(row.request); check(result, row.expected);
    assert.ok(result.ok);
    if (row.expected === 'unchanged') continue;
    const order = result.findings.filter(finding => finding.field === row.expected);
    assert.equal(order.length, 1, row.name); assert.equal(order[0].kind, 'accessibility'); assert.equal(order[0].locator, '#container');
    assert.deepEqual(JSON.parse(order[0].before_json), ['#alpha', '#beta']);
    assert.deepEqual(JSON.parse(order[0].after_json), ['#beta', '#alpha']);
    assert.equal(result.findings.filter(finding => finding.field === 'paint_order').length, 0);
  }
});

test('metadata model preserves ordered title and description membership across 500 replay sequences', async () => {
  const parents = ['root', 'group', 'outline'] as const;
  const tags = new Map(Array.from({ length: 5 }, (_, i) => [[`t${i}`, 'title'], [`d${i}`, 'desc']]).flat() as [string, string][]);
  type Model = Record<typeof parents[number], string[]>;
  /** Render explicit model order; outline metadata must survive glyph grouping. */
  const render = (model: Model): string => {
    /** Each metadata identity keeps its own literal content throughout the model. */
    const content = (parent: typeof parents[number]): string => model[parent].map(id => `<${tags.get(id)} id="${id}">${id} label</${tags.get(id)}>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" id="root" role="img">${content('root')}<g id="group" role="img">${content('group')}<rect/></g><g id="outline" data-text="A" role="img">${content('outline')}<path d="M0 0L1 1"/></g></svg>`;
  };
  let seed = 0xa11c, replays = 0, changes = 0;
  const covered = new Set<string>();
  /** Reproducible operation choice independent of the implementation. */
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  for (let sequence = 0; sequence < 500; sequence++) {
    let model: Model = { root: ['t0', 'd0', 't1', 'd1'], group: ['t2', 'd2'], outline: ['t3', 'd3'] };
    const history = [structuredClone(model)];
    for (let step = 0; step < 8; step++) {
      const before = structuredClone(model), parent = parents[next() % parents.length], action = next() % 5;
      const active = parents.flatMap(key => model[key]);
      if (action === 0) model[parent].reverse();
      else if (action === 1 && active.length) {
        const id = active[next() % active.length];
        for (const key of parents) model[key] = model[key].filter(entry => entry !== id);
        model[parent].splice(next() % (model[parent].length + 1), 0, id);
      } else if (action === 2) {
        const absent = [...tags.keys()].filter(id => !active.includes(id));
        if (absent.length) model[parent].splice(next() % (model[parent].length + 1), 0, absent[next() % absent.length]);
      } else if (action === 3) { model = structuredClone(history[next() % history.length]); replays++; }
      else if (active.length) {
        const id = active[next() % active.length];
        for (const key of parents) model[key] = model[key].filter(entry => entry !== id);
      }
      history.push(structuredClone(model));
      const expected = parents.flatMap(key => ['title', 'desc'].flatMap(tag => {
        const a = before[key].filter(id => tags.get(id) === tag), b = model[key].filter(id => tags.get(id) === tag);
        const common = new Set(a.filter(id => b.includes(id)));
        const left = a.filter(id => common.has(id)).map(id => `#${id}`), right = b.filter(id => common.has(id)).map(id => `#${id}`);
        return JSON.stringify(left) === JSON.stringify(right) ? [] : [{ locator: `#${key}`, field: `aria-${tag}-order`, kind: 'accessibility', before_json: JSON.stringify(left), after_json: JSON.stringify(right) }];
      }));
      const result = compareSemanticAssets({ version: 1, before: render(before), after: render(model).replaceAll('><', '>\r\n<!--noise--><') });
      assert.ok(result.ok);
      /** Stable coordinates make expected order independent of traversal implementation. */
      const sorted = (rows: readonly { locator: string; field: string }[]): object[] => [...rows].sort((a, b) => `${a.locator}/${a.field}`.localeCompare(`${b.locator}/${b.field}`));
      assert.deepEqual(sorted(result.findings.filter(row => row.field === 'aria-title-order' || row.field === 'aria-desc-order')), sorted(expected));
      assert.equal(result.findings.filter(row => row.field === 'paint_order').length, 0);
      changes += expected.length;
      for (const row of expected) covered.add(`${row.locator}/${row.field}`);
      for (const format of ['json', 'toon'] as const) {
        const report = await renderSemanticAssetReport({ version: 1, before: render(before), after: render(model), format, budget: 1000000 }, sdk);
        assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
      }
    }
  }
  assert.ok(replays > 500); assert.equal(covered.size, 6); assert.ok(changes > 0);
  console.log(`Metadata model: 500 sequences, 4000 transitions, ${replays} older-input replays, ${changes} order findings`);
});

test('topology model detects retained parent and order changes amid membership changes and replays', async () => {
  const units = new Map([['rect', '<rect id="rect" width="10" height="10"/>'], ['circle', '<circle id="circle" r="5"/>'],
    ['path', '<path id="path" d="M0 0L1 1"/>'], ['text', '<text id="text">Ready</text>'], ['title', '<title id="title">Label</title>'],
    ['desc', '<desc id="desc">Details</desc>'], ['outline', '<g id="outline" data-text="A"><path d="M0 0L1 1"/></g>'],
    ['constructor', '<rect id="constructor"/>'], ['__proto__', '<rect id="__proto__"/>']]);
  const parents = ['root', 'one', 'two'] as const;
  type Model = Record<typeof parents[number], string[]>;
  /** The reference structure is explicit ordered membership, not parser output. */
  const render = (model: Model): string => `<svg xmlns="http://www.w3.org/2000/svg" id="root"><g id="one" transform="translate(10 0)">${model.one.map(id => units.get(id)).join('')}</g><g id="two" fill="#f00" opacity=".5">${model.two.map(id => units.get(id)).join('')}</g>${model.root.map(id => units.get(id)).join('')}</svg>`;
  /** Model parent identity for every active comparison unit. */
  const membership = (model: Model): Map<string, string> => new Map(parents.flatMap(parent => model[parent].map(id => [id, `#${parent}`] as const)));
  /** Paint order ignores descriptive metadata but retains all other common children. */
  const paint = (model: Model, parent: typeof parents[number]): string[] => [...(parent === 'root' ? ['one', 'two'] : []), ...model[parent]].filter(id => id !== 'title' && id !== 'desc');
  let seed = 0x71ee, replays = 0, transitions = 0;
  /** Deterministic operation schedule independent of host randomness. */
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  for (let sequence = 0; sequence < 500; sequence++) {
    let model: Model = { root: ['constructor'], one: ['rect', 'text', 'title'], two: ['circle', 'desc', 'outline'] };
    const history: Model[] = [structuredClone(model)];
    for (let step = 0; step < 8; step++) {
      const previous = structuredClone(model), parent = parents[next() % parents.length], action = next() % 5;
      const active = [...membership(model).keys()];
      if (action === 0 && active.length) {
        const id = active[next() % active.length];
        for (const key of parents) model[key] = model[key].filter(entry => entry !== id);
        model[parent].splice(next() % (model[parent].length + 1), 0, id);
      } else if (action === 1) {
        const absent = [...units.keys()].filter(id => !active.includes(id));
        if (absent.length) model[parent].push(absent[next() % absent.length]);
      } else if (action === 2) model[parent].reverse();
      else if (action === 3) { model = structuredClone(history[next() % history.length]); replays++; }
      else if (active.length) {
        const id = active[next() % active.length];
        for (const key of parents) model[key] = model[key].filter(entry => entry !== id);
      }
      history.push(structuredClone(model)); transitions++;
      const left = membership(previous), right = membership(model);
      const expectedParents = [...left].filter(([id, value]) => right.has(id) && right.get(id) !== value)
        .map(([id, value]) => [`#${id}`, value, right.get(id)]).sort();
      const expectedOrder = parents.flatMap(key => {
        const a = paint(previous, key), b = paint(model, key), common = new Set(a.filter(id => b.includes(id)));
        const from = a.filter(id => common.has(id)), to = b.filter(id => common.has(id));
        return JSON.stringify(from) === JSON.stringify(to) ? [] : [`#${key}`];
      }).sort();
      const result = compareSemanticAssets({ version: 1, before: render(previous), after: render(model).replaceAll('><', '>\r\n<!--noise--><') });
      assert.ok(result.ok);
      assert.deepEqual(result.findings.filter(row => row.field === 'parent').map(row => [row.locator, JSON.parse(row.before_json), JSON.parse(row.after_json)]).sort(), expectedParents);
      assert.deepEqual(result.findings.filter(row => row.field === 'paint_order').map(row => row.locator).sort(), expectedOrder);
      assert.equal(result.findings.filter(row => row.field === 'element').length,
        [...left.keys()].filter(id => !right.has(id)).length + [...right.keys()].filter(id => !left.has(id)).length);
      for (const format of ['json', 'toon'] as const) {
        const report = await renderSemanticAssetReport({ version: 1, before: render(previous), after: render(model), format, budget: 1000000 }, sdk);
        assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
      }
    }
  }
  assert.equal(transitions, 4000); assert.ok(replays > 500);
  console.log(`Topology model: 500 sequences, ${transitions} transitions, ${replays} older-input replays`);
});

test('arc flag lexical property rejects numeric aliases in every flag and arc segment', () => {
  const aliases = ['0.0', '1.0', '+0', '+1', '-0', '00', '01', '0e0', '1e0', '.0', '0e-999'];
  for (let sample = 0; sample < 500; sample++) {
    const command = sample % 2 ? 'a' : 'A', slot = 3 + (Math.floor(sample / 2) % 2), segment = Math.floor(sample / 4) % 3;
    const args = ['20', '20', '0', '0', '1', '40', '40']; args[slot] = aliases[Math.floor(sample / 12) % aliases.length];
    const prefix = '20 20 0 0 1 40 40 '.repeat(segment);
    const bad = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 ${command}${prefix}${args.join(' ')}"/></svg>`;
    check(compareSemanticAssets({ version: 1, before: '<svg xmlns="http://www.w3.org/2000/svg"/>', after: bad }), 'unsupported_semantics');
    args[slot] = sample % 2 ? '1' : '0';
    const good = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 ${command}${prefix}${args.join(' ')}"/></svg>`;
    check(compareSemanticAssets({ version: 1, before: good, after: good }), 'unchanged');
  }
});

test('numeric lexical validation refuses long malformed scalars within a bounded run', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { compareSemanticAssets } from './dist/semantic-assets.js';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" x="' + '9'.repeat(200000) + '!"/>';
    assert.equal(compareSemanticAssets({version:1,before:svg,after:svg}).ok, false);
  `], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});

test('review classes reach the actual CLI in a non-git tracker with no git executable', async t => {
  const root = mkdtempSync(join(tmpdir(), 'brand-review-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const client = new sdk.PmClient({ pmRoot: join(root, '.agents/pm'), noExtensions: true });
  await client.init('review', { defaults: true, withPackages: false, mergeFence: false, agentGuidance: 'skip' });
  const baseline = (await client.listAllComplete({ includeBody: true })).items;
  const bin = join(root, 'empty-bin'); mkdirSync(bin);
  for (const row of packedSemanticReviewCases()) for (const format of ['json', 'toon'] as const) {
    const file = join(root, 'request.json'); writeFileSync(file, JSON.stringify({ ...row.request, format, budget: 1000000 }));
    const output = spawnSync(process.execPath, [resolve('dist/cli.js'), 'semantic-diff', file], {
      cwd: root, env: { PATH: bin, GIT_CEILING_DIRECTORIES: root }, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(output.status, row.expected.startsWith('unsupported_') ? 2 : row.expected === 'unchanged' ? 0 : 1, output.stderr);
    const result = (format === 'json' ? JSON.parse(output.stdout) : decode(output.stdout)) as SemanticAssetDiagnosis;
    check(result, row.expected);
    assert.deepEqual(result, compareSemanticAssets(row.request));
  }
  for (const format of ['json', 'toon']) {
    const file = join(root, 'color.json'); writeFileSync(file, JSON.stringify(renderedColorReviewRequest()));
    const output = spawnSync(process.execPath, [resolve('dist/cli.js'), 'diagnose', file, '--format', format], {
      cwd: root, env: { PATH: bin, GIT_CEILING_DIRECTORIES: root }, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(output.status, 2, output.stderr); assert.equal(JSON.parse(output.stdout).code, 'invalid_color');
  }
  assert.deepEqual((await client.listAllComplete({ includeBody: true })).items, baseline);
});

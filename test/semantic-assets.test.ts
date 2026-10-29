/** Static asset semantics, strict refusals, wire round trips and real SDK read-back invariants. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decode, encode } from '@toon-format/toon';
import * as sdk from '@unbrained/pm-cli/sdk';
import { compareSemanticAssets, renderSemanticAssetReport } from '../dist/index.js';
import { validateSemanticAssetNumbers } from '../dist/semantic-assets.js';
import type { SemanticAssetDiagnosis, SemanticAssetResult } from '../dist/semantic-assets.js';
import type { AccessibilityOutputSdk } from '../dist/accessibility-report.js';
import { parseStaticSvg } from '../dist/static-svg.js';
import { banner } from '../dist/banner.js';
import { ogImage } from '../dist/og.js';
import { textPaths } from '../dist/text.js';
import { readFileSync } from 'node:fs';

/** Narrow successful comparisons while displaying refusal evidence. */
function success(result: SemanticAssetResult): SemanticAssetDiagnosis {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as SemanticAssetDiagnosis;
}

/** One compact generated status asset, independent of tracker status naming. */
function asset(color = '#ffffff', text = 'Ready', x = 0, label = 'Status'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><rect id="status" fill="${color}" x="${x}"/><text id="label">${text}</text><title>${label}</title></svg>`;
}

/** One versioned request; no hidden defaults beyond the public schema. */
function request(before = asset(), after = before): { version: 1; before: string; after: string } {
  return { version: 1, before, after };
}

test('attribute reordering and XML serialization noise produce zero semantic changes', () => {
  const before = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="status" fill="#fff" x="-0.0"/><text id="label">Ready &amp; steady</text><title>Status</title></svg>`;
  const after = `\ufeff<?xml version='1.0' encoding='UTF-8'?>\r\n<!-- serialization -->\r\n<svg xmlns='http://www.w3.org/2000/svg'>\r\n<rect x='0e2' fill='WHITE' id='status'></rect><text id='label'>Ready &#38; steady</text><title>Status</title></svg>\r\n`;
  assert.equal(success(compareSemanticAssets(request(before, after))).summary.changes, 0);
  assert.equal(success(compareSemanticAssets(request('<svg><path d="M0,0L1.0,2Z"/></svg>', '<svg><path d="M 0 0 L 1 2 Z" /></svg>'))).summary.changes, 0);
  assert.equal(success(compareSemanticAssets(request('<svg><g transform="translate(1,2) scale(.5 -0.5)"/></svg>', '<svg><g transform="translate(1.0 2.0)scale(0.5,-.5)" /></svg>'))).summary.changes, 0);
  assert.equal(success(compareSemanticAssets(request('<svg><text>A\r\n B<!--x--> C</text></svg>', '<svg><text>A B C</text></svg>'))).summary.changes, 0);
});

test('changed status color and truncated label yield exactly two localized findings', () => {
  const result = success(compareSemanticAssets(request(asset(), asset('#ff0000', 'Re…'))));
  assert.equal(result.summary.changes, 2);
  assert.deepEqual(result.findings.map(row => [row.kind, row.locator, row.field]), [['token_role', '#status', 'fill'], ['text', '#label', 'text']]);
  assert.deepEqual(result.findings.map(row => JSON.parse(row.after_json)), ['#ff0000', 'Re…']);
});

test('Unicode whitespace remains visible while only XML text whitespace is normalized', () => {
  for (const text of ['\u00a0Ready\u00a0', '\u2003Ready\u2003', '\ufeffReady\ufeff']) {
    const result = success(compareSemanticAssets(request('<svg><text>Ready</text></svg>', `<svg><text>${text}</text></svg>`)));
    assert.equal(result.summary.changes, 1); assert.equal(JSON.parse(result.findings[0].after_json), text);
    assert.equal(compareSemanticAssets(request(`<svg><g>${text}</g></svg>`)).ok, false);
    assert.equal(compareSemanticAssets(request(`<svg/>${text}`)).ok, false);
  }
});

test('token roles, geometry, accessibility, additions and paint order remain distinct', () => {
  const before = '<svg role="img" aria-label="A"><g data-role="status" data-token="status-open-bg"><rect id="a" x="1"/><circle id="b" r="2"/></g></svg>';
  const after = '<svg role="presentation" aria-label="B"><g data-role="progress" data-token="status-closed-bg"><circle id="b" r="3"/><rect id="a" x="2"/></g></svg>';
  const result = success(compareSemanticAssets(request(before, after)));
  assert.deepEqual(result.findings.map(row => row.kind), ['accessibility', 'accessibility', 'token_role', 'token_role', 'geometry', 'geometry', 'geometry']);
  assert.ok(result.findings.some(row => row.field === 'paint_order'));
  for (const [a, b] of [['<svg/>', '<svg><rect/></svg>'], ['<svg><rect/></svg>', '<svg/>'], ['<svg><rect id="same"/></svg>', '<svg><circle id="same"/></svg>']]) {
    assert.equal(success(compareSemanticAssets(request(a, b))).summary.changes, 1);
  }
  assert.equal(success(compareSemanticAssets(request('<svg><rect fill="none"/></svg>', '<svg><rect/></svg>'))).summary.changes, 1);
  assert.equal(success(compareSemanticAssets(request('<svg><rect/></svg>', '<svg><rect fill="none"/></svg>'))).summary.changes, 1);
});

test('current generators annotate visible outlines without hiding independent path edits', () => {
  for (const svg of [banner({ name: 'pm', tagline: 'Ready' }), banner({ name: '', tagline: '' }), ogImage({ title: 'Ready', eyebrow: 'Now', product: 'pm' })]) {
    assert.equal(success(compareSemanticAssets(request(svg))).summary.changes, 0);
    assert.match(svg, /data-text=/u);
  }
  const left = `<svg><rect id="status" fill="#fff"/><g data-text="Ready">${textPaths('Ready', 'body', 0, 20, 12)}</g></svg>`;
  const right = `<svg><rect id="status" fill="#f00"/><g data-text="Re…">${textPaths('Re…', 'body', 0, 20, 12)}</g></svg>`;
  const changed = success(compareSemanticAssets(request(left, right)));
  assert.equal(changed.summary.changes, 2);
  assert.deepEqual(changed.findings.map(row => row.kind), ['token_role', 'text']);
  const digest = JSON.parse(changed.findings[1].after_json) as { text: string; outline: string };
  assert.equal(digest.text, 'Re…'); assert.match(digest.outline, /^[a-f0-9]{64}$/u);
  const edited = success(compareSemanticAssets(request(left, left.replace('translate(0.000', 'translate(1.000'))));
  assert.equal(edited.summary.changes, 1); assert.equal(edited.findings[0].field, 'outline'); assert.equal(edited.findings[0].kind, 'geometry');
  const legacy = left.replace(' data-text="Ready"', '');
  assert.equal(success(compareSemanticAssets(request(legacy))).summary.changes, 0);
  const released = readFileSync('icons/favicon.svg', 'utf8');
  assert.equal(success(compareSemanticAssets(request(released))).summary.changes, 0);
  assert.equal(success(compareSemanticAssets(request('<svg><g data-text="A"/></svg>', '<svg><g/></svg>'))).summary.changes, 1);
  assert.equal(success(compareSemanticAssets(request('<svg><g/></svg>', '<svg><g data-text="A"/></svg>'))).summary.changes, 1);
});

test('strict request schema rejects sparse arrays, accessors, extra fields and extreme domains', () => {
  const base = request();
  const accessor = Object.defineProperty({}, 'before', { get() { throw new Error('must not call'); } });
  const cases: unknown[] = [null, false, [], new Date(), Object.create(base), accessor,
    new Proxy({}, { ownKeys() { throw new Error(); } }), new Proxy({}, { getPrototypeOf() { throw new Error(); } }),
    { ...base, [Symbol('extra')]: true }, { ...base, extra: 1 }, { ...base, version: 2 },
    { ...base, before: new Array(1) }, { ...base, after: null }, { ...base, before: 'a'.repeat(1048577) }, { ...base, after: '🚀'.repeat(262145) },
    { ...base, format: 'xml' }, ...[NaN, Infinity, -Infinity, 511, 1000001, 512.1, null, '512'].map(budget => ({ ...base, budget }))];
  for (const input of cases) { const result = compareSemanticAssets(input); assert.ok(!result.ok); if (!result.ok) assert.equal(result.code, 'invalid_input'); }
  for (const format of ['json', 'toon']) for (const budget of [512, 1000000]) assert.equal(compareSemanticAssets({ ...base, format, budget }).ok, true);
  assert.equal(compareSemanticAssets(Object.assign(Object.create(null) as object, base)).ok, true);
});

test('unsupported and malformed SVG refuses the affected side before loading the SDK', async () => {
  const bad = ['', 'outside<svg/>', '<svg/>outside', '<svg/><svg/>', '<rect/>', '<svg><svg/></svg>', '<svg>', '</svg>', '<svg></g>',
    '<svg><text>unsafe<rect/></text></svg>', '<svg><path><rect/></path></svg>', '<svg><tspan>unsupported</tspan></svg>', '<svg><g>outside text</g></svg>', '<svg><!-- unfinished</svg>', '<svg><!--a--b--></svg>', '<svg><!--x---></svg>',
    '<?xml version="1.1"?><svg/>', '<?xml version="1.0"?><svg/><?xml version="1.0"?>', '<!DOCTYPE svg><svg/>', '<svg><script/></svg>', '<svg><style/></svg>', '<svg><use href="#x"/></svg>',
    '<svg style="fill:red"/>', '<svg class="status"/>', '<svg onclick="x"/>', '<svg xmlns="wrong"/>', '<svg id="x" id="x"/>', '<svg id="bad id"/>', '<svg id="a/b"/>', '<svg><g id="x"/><g id="x"/></svg>',
    '<svg data-role=""/>', `<svg data-token="${'x'.repeat(257)}"/>`, '<svg data-role="&#10;"/>', '<svg><text>&unknown;</text></svg>', '<svg><text>&unfinished</text></svg>', '<svg><text>&#x110000;</text></svg>', '<svg><text>&#0;</text></svg>', '<svg><text>]]></text></svg>', '<svg><text>\0</text></svg>',
    '<svg role="button"/>', '<svg fill="url(http://example.invalid)"/>', '<svg fill="var(--pm-unknown)"/>', '<svg x="NaN"/>', '<svg x="Infinity"/>', '<svg x="1e309"/>', '<svg x="1000000001"/>', '<svg x="1 2"/>', '<svg x="(1)"/>', '<svg width="-1"/>', '<svg opacity="1.1"/>', '<svg viewBox="0 0 -1 1"/>', '<svg viewBox="0 0 1"/>', '<svg points="0 1 2"/>',
    '<svg><path d="L0 0"/></svg>', '<svg><path d="M0"/></svg>', '<svg><path d="M0 0 Z1"/></svg>', '<svg><path d="M0 0 F1"/></svg>', '<svg><path d="M0 0 A-1 1 0 0 0 1 1"/></svg>', '<svg><path d="M0 0 A1 1 0 2 0 1 1"/></svg>',
    '<svg transform="matrix(1 2)"/>', '<svg transform="translate()"/>', '<svg transform="translate(1) invalid"/>', '<svg transform="oops(1)"/>', '<svg points="0,,1"/>', '<svg x="%"/>', '<svg x="1px"/>',
    '<svg><path d="M,0 0"/></svg>', '<svg><path d="M0 0,L1 1"/></svg>', '<svg transform="translate(1,)"/>', '<svg transform="translate(,1)"/>', '<svg transform="translate(1),,scale(2)"/>',
    '<svg><g data-text="A"><rect/></g></svg>', '<svg><g data-text="A"><path fill="#fff"/></g></svg>', '<svg data-text="A"/>',
    `<svg>${'<g>'.repeat(32)}${'</g>'.repeat(32)}</svg>`, `<svg>${'<rect/>'.repeat(4096)}</svg>`, `<svg><path d="M${'1 '.repeat(32769)}"/></svg>`,
    '<svg x=1/>', '<svg><g></svg>', '<svg><g/></svg>\ud800', '<svg><!--\uffff--></svg>',
  ];
  for (const svg of bad) {
    const result = compareSemanticAssets(request(svg)); assert.equal(result.ok, false, `must refuse ${svg.slice(0, 100)}`);
    if (!result.ok) { assert.equal(result.code, 'unsupported_svg'); assert.equal(result.path, '$.before'); assert.ok(result.remedy.length > 0); }
  }
  const after = compareSemanticAssets(request('<svg/>', '<script/>')); assert.ok(!after.ok); if (!after.ok) assert.equal(after.path, '$.after');
  assert.equal((await renderSemanticAssetReport(request('<script/>'), {} as AccessibilityOutputSdk)).result.ok, false);
  // Must-allow corpus includes previously released path-based generated assets and all supported attribute domains.
  for (const svg of ['<svg/>', '<svg><text>&lt;&gt;&quot;&apos;&#x1F680;</text></svg>', '<svg aria-label="A\r\nB" data-role=" ready "/>',
    '<svg fill="var(--pm-status-open-bg)" stroke="currentColor" color="transparent" aria-hidden="false" aria-labelledby="label" aria-describedby="desc"><text id="label">Ready</text><desc id="desc">Details</desc></svg>',
    '<svg><path d=""/><path d="M0 0ZM1 1A1 2 0 0 1 3 4"/><g transform="matrix(1 0 0 1 0 0) rotate(1 2 3) skewX(2) skewY(3)"/><polygon points="0 0 1 1 2 2"/><ellipse rx="0" ry="1"/><line x1="0" y1="1" x2="2" y2="3"/><polyline points="0 0 1 1"/></svg>',
    '<svg fill-rule="evenodd" stroke-linejoin="round" stroke-linecap="butt" text-anchor="end" font-size="12" opacity="0" fill-opacity="1" stroke-opacity=".5" stroke-width="0" data-lines="2" viewBox="0 0 1000000000 0"/>']) assert.equal(success(compareSemanticAssets(request(svg))).summary.changes, 0);
});

test('JSON and TOON preserve complete reports, exact budget boundaries and typed refusals', async () => {
  assert.equal((await renderSemanticAssetReport(null)).format, 'json');
  for (const format of ['json', 'toon'] as const) {
    const input = { ...request(asset(), asset('#f00', 'Re…')), format, budget: 512 };
    const report = await renderSemanticAssetReport(input);
    assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), report.result);
    assert.equal(report.result.ok, true);
    const big = { ...input, before: `<svg>${Array.from({ length: 100 }, (_, i) => `<rect id="r${i}" fill="#fff"/>`).join('')}</svg>`,
      after: `<svg>${Array.from({ length: 100 }, (_, i) => `<rect id="r${i}" fill="#f00"/>`).join('')}</svg>` };
    const small = await renderSemanticAssetReport(big, sdk);
    assert.ok(!small.result.ok); if (!small.result.ok) {
      assert.equal(small.result.code, 'budget_exceeded'); assert.equal(small.result.summary?.changes, 100);
      assert.ok(sdk.attachOutputTokenAccounting(small.result, () => small.text).token_accounting.total_estimated_tokens <= 512);
      assert.equal((await renderSemanticAssetReport({ ...big, budget: small.result.required_budget }, sdk)).result.ok, true);
      assert.equal((await renderSemanticAssetReport({ ...big, budget: small.result.required_budget! - 1 }, sdk)).result.ok, false);
    }
    const missing = await renderSemanticAssetReport(input, {} as AccessibilityOutputSdk); assert.ok(!missing.result.ok);
    if (!missing.result.ok) assert.equal(missing.result.code, 'sdk_unavailable');
  }
});

test('emitted numbers remain finite and in range under extreme IEEE-754 fuzz', async () => {
  const base = success(compareSemanticAssets(request()));
  let seed = 0xbad123;
  /** Reproducible bit patterns, without drawing from ambient randomness. */
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const bits = new DataView(new ArrayBuffer(8));
  const values = [NaN, Infinity, -Infinity, -.5, -1, 1e20, 0, 1, 4096, 4097, 300000, 300001];
  for (let i = 0; i < 500; i++) { bits.setUint32(0, next()); bits.setUint32(4, next()); values.push(bits.getFloat64(0)); }
  for (const n of values) {
    for (const field of ['before_nodes', 'after_nodes', 'changes'] as const) {
      const result = validateSemanticAssetNumbers({ ...base, summary: { ...base.summary, [field]: n } });
      assert.equal(result.ok, Number.isSafeInteger(n) && (field === 'changes' ? n === 0 : n >= 1 && n <= 4096));
    }
    assert.equal(compareSemanticAssets({ ...request(), budget: n }).ok, Number.isSafeInteger(n) && n >= 512 && n <= 1000000);
    for (const [field, valid] of [['x', Number.isFinite(n) && Math.abs(n) <= 1e9],
      ['width', Number.isFinite(n) && n >= 0 && n <= 1e9], ['opacity', Number.isFinite(n) && n >= 0 && n <= 1]] as const) {
      assert.equal(compareSemanticAssets(request(`<svg ${field}="${n}"/>`)).ok, valid);
    }
  }
  for (const n of [NaN, Infinity, -Infinity, -1, .5, 1e20]) {
    const host: AccessibilityOutputSdk = { attachOutputTokenAccounting(value) {
      const accounting = sdk.attachOutputTokenAccounting(value, () => '');
      return { ...accounting, token_accounting: { ...accounting.token_accounting, total_estimated_tokens: n } };
    } };
    const report = await renderSemanticAssetReport(request(), host); assert.ok(!report.result.ok);
    if (!report.result.ok) assert.equal(report.result.code, 'numeric_result');
  }
});

test('CLI compares assets in a non-git tracker with no git executable or renderer import', async t => {
  const root = mkdtempSync(join(tmpdir(), 'brand-semantic-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const client = new sdk.PmClient({ pmRoot: join(root, '.agents/pm'), noExtensions: true });
  await client.init('asset', { defaults: true, withPackages: false, mergeFence: false, agentGuidance: 'skip' });
  const noGit = join(root, 'empty-bin'); mkdirSync(noGit);
  const fixture = join(root, 'assets.json'), cli = resolve('dist/cli.js');
  for (const [input, status] of [[request(), 0], [request(asset(), asset('#f00', 'Re…')), 1], [null, 2]] as const) {
    writeFileSync(fixture, JSON.stringify(input));
    for (const format of ['json', 'toon']) {
      const child = spawnSync(process.execPath, [cli, 'semantic-diff', fixture, '--format', format], {
        cwd: root, env: { PATH: noGit, GIT_CEILING_DIRECTORIES: root }, encoding: 'utf8', timeout: 30000,
      });
      assert.equal(child.status, status, child.stderr); assert.equal(child.stderr, '');
      assert.deepEqual(status === 2 || format === 'json' ? JSON.parse(child.stdout) : decode(child.stdout),
        (await renderSemanticAssetReport(input === null ? null : { ...input, format })).result);
    }
  }
  assert.equal(parseStaticSvg('<svg/>')?.length, 1);
});

test('500 seeded model sequences replay older assets and read all native state back through the real SDK', async t => {
  const root = mkdtempSync(join(tmpdir(), 'brand-semantic-model-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pmRoot = join(root, '.agents/pm'), client = new sdk.PmClient({ pmRoot, noExtensions: true });
  await client.init('asset', { defaults: true, withPackages: false, mergeFence: false, agentGuidance: 'skip' });
  const unset = ['goal', 'objective', 'sprint', 'release', 'blocked_by', 'assignee', 'reviewer'];
  const parent = await client.create({ title: 'Parent', type: 'Task', parent: 'none', clearDeps: true, unset });
  await client.focus(parent.item.id);
  const child = await client.create({ title: '  Café 🚀  ', type: 'Task', parent: parent.item.id, description: 'Text', body: 'First\r\nSecond  \r\n',
    tags: 'alpha,beta', priority: 1, risk: 'low', confidence: 'high', estimatedMinutes: '30', acceptanceCriteria: 'Visible', definitionOfReady: 'Supplied',
    dep: [`id=${parent.item.id},kind=related_to`], file: ['path=src/Label.ts'], doc: ['path=docs/semantic-assets.md'],
    comment: ['text=Comment'], note: ['text=Note'], learning: ['text=Learning'], unset });
  const located = await sdk.locateItem(pmRoot, child.item.id); assert.ok(located);
  const nativeModel = structuredClone((await sdk.readLocatedItem(located)).document);
  const wholeModel = (await client.listAllComplete({ includeBody: true })).items;
  let seed = 0x5eeda, replays = 0;
  /** Stable pseudo-random transitions exercise six independent operations. */
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  for (let sequence = 0; sequence < 500; sequence++) {
    let model = { color: '#ffffff', text: 'Ready', x: 0, label: 'Status' };
    const history = [structuredClone(model)];
    for (let operation = 0; operation < 12; operation++) {
      const previous = structuredClone(model), action = next() % 6;
      if (action === 0) model.color = model.color === '#ffffff' ? '#ff0000' : '#ffffff';
      if (action === 1) model.text = ['Ready', 'Re…', 'Café 🚀', '日本語'][next() % 4];
      if (action === 2) model.x = next() % 1000;
      if (action === 3) model.label = ['Status', 'Progress', 'Description'][next() % 3];
      if (action === 4) { model = structuredClone(history[next() % history.length]); replays++; }
      history.push(structuredClone(model));
      const before = asset(previous.color, previous.text, previous.x, previous.label);
      let after = asset(model.color, model.text, model.x, model.label);
      if (action === 5) after = after.replaceAll('><', '>\r\n<!--noise--><').replace('fill="', ' \r\nfill="');
      const expected = [previous.color !== model.color ? ['#status', 'fill', model.color] : null,
        previous.x !== model.x ? ['#status', 'x', String(model.x)] : null,
        previous.text !== model.text ? ['#label', 'text', model.text] : null,
        previous.label !== model.label ? ['svg[1]/title[1]', 'aria-title', model.label] : null].filter(row => row !== null);
      const input = JSON.parse(` \r\n${JSON.stringify(request(before, after), null, 2).replaceAll('\n', '\r\n')}\r\n `) as unknown;
      const result = success(compareSemanticAssets(input));
      assert.deepEqual(result.findings.map(row => [row.locator, row.field, JSON.parse(row.after_json)]), expected);
      assert.deepEqual(validateSemanticAssetNumbers(result), result);
      assert.deepEqual(JSON.parse(JSON.stringify(result)), result); assert.deepEqual(decode(encode(result)), result);
      const format = operation % 2 ? 'json' : 'toon';
      const report = await renderSemanticAssetReport({ ...request(before, after), format }, sdk);
      assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), result);
    }
    assert.deepEqual((await sdk.readLocatedItem(located)).document, nativeModel);
  }
  assert.ok(replays > 500); assert.deepEqual((await client.listAllComplete({ includeBody: true })).items, wholeModel);
  console.log(`Semantic model: 500 sequences, 6000 transitions, ${replays} older-input replays, 500 complete native SDK read-backs`);
});

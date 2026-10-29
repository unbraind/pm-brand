/** Coverage, strict boundaries, wire properties and real non-git SDK state preservation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decode, encode } from '@toon-format/toon';
import * as sdk from '@unbrained/pm-cli/sdk';
import type { AccessibilityOutputSdk } from '../dist/accessibility-report.js';
import { preflightFontCoverage } from '../dist/index.js';
import { renderFontCoverageReport } from 'pm-brand/font-coverage-report';
import { parseFontCoverageRequest, validateFontCoverageNumbers } from '../dist/font-coverage.js';
import type { FontCoverageDiagnosis, FontCoverageLabel, FontCoverageRequest, FontCoverageResult } from '../dist/font-coverage.js';
import { fontData } from '../dist/font-data.js';
import { textPaths, textWidth } from '../dist/text.js';

/** Retain deliberately awkward caller strings without normalizing expected values. */
function label(text = 'Ready', role: FontCoverageLabel['role'] = 'display'): FontCoverageLabel {
  return { locator: '#label, "a,b" [0]', text, role };
}

/** Narrow completed diagnoses and make refusal failures readable. */
function success(result: FontCoverageResult): FontCoverageDiagnosis {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}

test('Latin, combining marks, emoji and non-Latin account for every input code point and renderer route', () => {
  const labels = [label('Café & <ready>'), label('e\u0301'), label('👩🏽‍💻'), label('日本語 λ'), label('A\r\n\ud800\ufffeB'), label('', 'body')];
  const result = success(preflightFontCoverage({ version: 1, labels, include_all: true }));
  assert.deepEqual(result.summary, { labels: 6, failed: 4, code_points: 31, supported: 18, unsupported: 9, invalid: 4 });
  assert.equal(result.labels.length, 6);
  for (const [index, row] of result.labels.entries()) {
    const text = JSON.parse(row.text_json) as string;
    assert.equal(text, labels[index].text);
    assert.equal(row.code_points, [...text].length);
    assert.equal(row.supported + row.issues.length, row.code_points);
    for (const issue of row.issues) {
      const point = [...text][issue.index];
      assert.equal(text.slice(issue.utf16_offset, issue.utf16_offset + point.length), point);
      assert.equal(issue.code_point, `U+${point.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
      if (issue.route === 'reject_xml') assert.throws(() => textPaths(point, row.role, 0, 0, 16), /XML/u);
      else {
        assert.equal(textPaths(point, row.role, 0, 0, 16), textPaths('?', row.role, 0, 0, 16));
        assert.equal(textWidth(point, row.role, 16), textWidth('?', row.role, 16));
      }
    }
  }
  assert.deepEqual(result.labels[2].issues.map(issue => issue.utf16_offset), [0, 2, 4, 5]);
  assert.equal(result.labels[5].font, 'Public Sans');
  assert.equal(result.labels[0].font, 'Archivo');
  assert.equal(result.labels[1].issues[0].code_point, 'U+0301');
  assert.equal(success(preflightFontCoverage({ version: 1, labels: [label('é')] })).summary.failed, 0);
  assert.deepEqual(success(preflightFontCoverage({ version: 1, labels: [] })).labels, []);
});

test('every shipped glyph in every font role agrees with the exact renderer lookup', () => {
  for (const role of ['mark', 'display', 'caption', 'body'] as const) {
    const points = Object.keys(fontData[role].glyphs);
    const result = success(preflightFontCoverage({ version: 1, labels: [label(points.join(''), role)], include_all: true }));
    // A table entry can be XML-invalid; those entries must be refused instead of disappearing.
    const expectedInvalid = points.filter(point => /[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/u.test(point)).length;
    assert.equal(result.summary.unsupported, 0);
    assert.equal(result.summary.invalid, expectedInvalid);
    assert.equal(result.summary.supported, points.length - expectedInvalid);
  }
});

test('a batch of 100 labels returns only failures by default and never truncates overlong input', async () => {
  const labels = Array.from({ length: 100 }, (_, index) => label(index === 73 ? 'ship 🚀' : 'Ready'));
  const result = success(preflightFontCoverage({ version: 1, labels }));
  assert.equal(result.summary.labels, 100);
  assert.equal(result.summary.failed, 1);
  assert.deepEqual(result.labels.map(row => row.index), [73]);
  assert.equal(result.labels[0].issues[0].code_point, 'U+1F680');
  const report = await renderFontCoverageReport({ version: 1, labels }, sdk);
  assert.deepEqual(report.result, result);
  assert.ok(sdk.attachOutputTokenAccounting(result, () => report.text).token_accounting.total_estimated_tokens <= 1600);
  assert.equal(success(preflightFontCoverage({ version: 1, labels: [label('a'.repeat(512)), label('🚀'.repeat(512))] })).summary.code_points, 1024);
  for (const text of ['a'.repeat(513), '🚀'.repeat(513), 'a'.repeat(1025)]) {
    const refused = preflightFontCoverage({ version: 1, labels: [label(text)] });
    assert.equal(refused.ok, false);
    if (!refused.ok) { assert.equal(refused.code, 'invalid_input'); assert.equal(refused.path, '$.labels[0].text'); }
  }
});

test('one strict input schema refuses malformed input and allows verbatim legacy text', () => {
  const base = { version: 1, labels: [label()] };
  const accessor = Object.defineProperty({}, 'labels', { get() { throw new Error('do not call'); } });
  const arrayAccessor = Object.defineProperty([label()], 0, { get() { throw new Error('do not call'); } });
  const cases: unknown[] = [null, 1, [], new Date(), {}, accessor, Object.create(base),
    new Proxy({}, { getPrototypeOf() { throw new Error('inspection'); } }),
    { ...base, [Symbol('foreign')]: true }, { ...base, extra: true }, { ...base, version: 2 },
    { ...base, labels: {} }, { ...base, labels: new Array(101) }, { ...base, labels: new Array(1) },
    { ...base, labels: Object.assign(new Array(1), { extra: label() }) },
    { ...base, labels: Object.assign([label()], { extra: true }) }, { ...base, labels: arrayAccessor },
    ...[null, 0, 'true'].map(include_all => ({ ...base, include_all })),
    { ...base, format: 'xml' },
    ...[NaN, Infinity, -Infinity, null, '512', 511, 1_000_001, 512.5].map(budget => ({ ...base, budget })),
    ...[null, 5, { ...label(), extra: true }, { ...label(), role: 'mono' }, { ...label(), role: 'constructor' },
      { ...label(), text: null }, ...['', ' ', 'x'.repeat(257), '\n', '\ud800'].map(locator => ({ ...label(), locator }))]
      .map(row => ({ ...base, labels: [row] })),
  ];
  for (const input of cases) {
    const result = preflightFontCoverage(input);
    assert.equal(result.ok, false, 'must refuse malformed data');
    if (!result.ok) { assert.equal(result.code, 'invalid_input'); assert.ok(result.remedy.length > 0); }
  }
  for (const text of ['', '  Café  ', 'e\u0301', '\r\n', '\u0000', '👩‍💻', '日本語', '\ud800']) {
    const input = Object.assign(Object.create(null) as object, { ...base, labels: [label(text)] });
    assert.equal(success(preflightFontCoverage(input)).summary.code_points, [...text].length);
  }
  assert.ok(!('ok' in parseFontCoverageRequest({ ...base, include_all: false, format: 'json', budget: 512 })));
  assert.ok(!('ok' in parseFontCoverageRequest({ ...base, format: 'toon', budget: 1_000_000 })));
  const old = Object.getOwnPropertyDescriptor(Object.prototype, 'budget');
  try {
    Object.defineProperty(Object.prototype, 'budget', { value: Infinity, configurable: true });
    assert.equal(preflightFontCoverage(base).ok, true);
  } finally {
    if (old) Object.defineProperty(Object.prototype, 'budget', old); else Reflect.deleteProperty(Object.prototype, 'budget');
  }
});

test('producer number guards reject extreme counts and positions on both sides of the boundary', async () => {
  const valid = success(preflightFontCoverage({ version: 1, labels: [label('a🚀')] }));
  assert.deepEqual(validateFontCoverageNumbers(valid), valid);
  for (const number of [NaN, Infinity, -Infinity, -1, .5, Number.MAX_VALUE]) {
    for (const key of Object.keys(valid.summary)) {
      assert.equal(validateFontCoverageNumbers({ ...valid, summary: { ...valid.summary, [key]: number } }).ok, false);
    }
    for (const key of ['index', 'code_points', 'supported']) {
      assert.equal(validateFontCoverageNumbers({ ...valid, labels: [{ ...valid.labels[0], [key]: number }] }).ok, false);
    }
    for (const key of ['index', 'utf16_offset']) {
      assert.equal(validateFontCoverageNumbers({ ...valid, labels: [{ ...valid.labels[0], issues: [{ ...valid.labels[0].issues[0], [key]: number }] }] }).ok, false);
    }
  }
  for (const change of [{ labels: 101 }, { failed: 0 }, { code_points: 1 }, { supported: 0 }, { unsupported: 51201 }]) {
    assert.equal(validateFontCoverageNumbers({ ...valid, summary: { ...valid.summary, ...change } }).ok, false);
  }
  assert.equal(validateFontCoverageNumbers({ ...valid, labels: [valid.labels[0], valid.labels[0]] }).ok, false);
  assert.equal(validateFontCoverageNumbers({ ...valid, labels: [{ ...valid.labels[0], supported: 0 }] }).ok, false);
  let seed = 0xbadf00d;
  /** Reproducible arbitrary IEEE-754 patterns. */
  const next = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed; };
  const bits = new DataView(new ArrayBuffer(8));
  for (let index = 0; index < 500; index += 1) {
    bits.setUint32(0, next()); bits.setUint32(4, next());
    const number = bits.getFloat64(0);
    assert.equal(preflightFontCoverage({ version: 1, labels: [], budget: number }).ok,
      Number.isSafeInteger(number) && number >= 512 && number <= 1_000_000);
    assert.equal(validateFontCoverageNumbers({ ...valid, labels: [{ ...valid.labels[0], index: number }] }).ok, number === 0);
  }
  for (const required of [NaN, Infinity, -Infinity, -.5, 1e20]) {
    const host: AccessibilityOutputSdk = { attachOutputTokenAccounting(value) {
      const accounting = sdk.attachOutputTokenAccounting(value, () => '');
      return { ...accounting, token_accounting: { ...accounting.token_accounting, total_estimated_tokens: required } };
    } };
    const report = await renderFontCoverageReport({ version: 1, labels: [] }, host);
    assert.equal(report.result.ok, false);
    if (!report.result.ok) assert.equal(report.result.code, 'numeric_result');
  }
});

test('JSON and TOON are lossless and budgets refuse complete reports without hiding failures', async () => {
  assert.equal((await renderFontCoverageReport(null)).format, 'json');
  for (const format of ['json', 'toon'] as const) {
    const request = { version: 1, labels: [label('e\u0301 🚀')], format, budget: 512 };
    const report = await renderFontCoverageReport(request);
    assert.equal(report.result.ok, true);
    assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), report.result);
    const labels = Array.from({ length: 100 }, () => label('🚀'));
    const small = await renderFontCoverageReport({ ...request, labels }, sdk);
    assert.equal(small.result.ok, false);
    if (!small.result.ok) {
      assert.equal(small.result.code, 'budget_exceeded');
      assert.equal(small.result.summary?.failed, 100);
      assert.ok(small.result.required_budget! > 512);
      assert.ok(sdk.attachOutputTokenAccounting(small.result, () => small.text).token_accounting.total_estimated_tokens <= 512);
      assert.equal((await renderFontCoverageReport({ ...request, labels, budget: small.result.required_budget })).result.ok, true);
      assert.equal((await renderFontCoverageReport({ ...request, labels, budget: small.result.required_budget! - 1 })).result.ok, false);
    }
    const missing = await renderFontCoverageReport(request, {} as AccessibilityOutputSdk);
    assert.equal(missing.result.ok, false);
    if (!missing.result.ok) assert.equal(missing.result.code, 'sdk_unavailable');
  }
});

test('font CLI works without git and reports pass, glyph failure and typed input refusal', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-font-cli-'));
  const cli = resolve('dist/cli.js');
  const input = join(root, 'labels.json');
  /** Explicit runtime and empty PATH ensure the command cannot invoke git. */
  const run = (args: string[]) => spawnSync(process.execPath, [cli, 'font-coverage', input, ...args], {
    cwd: root, env: { PATH: '', GIT_CEILING_DIRECTORIES: tmpdir() }, encoding: 'utf8', timeout: 15000,
  });
  try {
    for (const format of ['json', 'toon']) {
      writeFileSync(input, JSON.stringify({ version: 1, labels: [label('Ready'), label('🚀')] }));
      const report = run(['--format', format, '--budget', '512']);
      assert.equal(report.status, 1, report.stderr);
      const value = (format === 'json' ? JSON.parse(report.stdout) : decode(report.stdout)) as FontCoverageDiagnosis;
      assert.equal(value.summary.failed, 1);
      assert.equal(value.labels.length, 1);
    }
    writeFileSync(input, JSON.stringify({ version: 1, labels: [label()] }));
    assert.equal(run([]).status, 0);
    writeFileSync(input, JSON.stringify({ version: 1, labels: [label('a'.repeat(513))] }));
    assert.equal(run([]).status, 2);
    assert.equal(JSON.parse(run([]).stdout).code, 'invalid_input');
    assert.equal(run(['--budget', 'Infinity']).status, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('500 seeded operation sequences replay old inputs, preserve native SDK state and round-trip all producers', async t => {
  const root = mkdtempSync(join(tmpdir(), 'brand-font-model-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pmRoot = join(root, '.agents/pm');
  const client = new sdk.PmClient({ cwd: root, pmRoot, author: 'fixture-agent', noExtensions: true });
  await client.init('fixture', { defaults: true, withPackages: false, mergeFence: false, agentGuidance: 'skip' });
  const unset = ['goal', 'objective', 'sprint', 'release', 'blocked_by', 'assignee', 'reviewer'];
  const parent = await client.create({ title: 'Fixture parent', type: 'Task', parent: 'none', clearDeps: true, unset });
  const child = await client.create({ title: '  Café 🚀 e\u0301  ', type: 'Task', parent: parent.item.id,
    description: '  Description 日本語  ', body: 'First line\r\n\r\nTrailing space  \r\n', tags: 'alpha,beta',
    priority: 1, risk: 'low', confidence: 'high', estimatedMinutes: '30', acceptanceCriteria: 'Visible', definitionOfReady: 'Text supplied',
    dep: [`id=${parent.item.id},kind=related_to`], file: ['path=components/Label.tsx'], doc: ['path=docs/font-coverage.md'],
    comment: ['text=Native comment'], note: ['text=Native note'], learning: ['text=Native learning'], unset });
  const located = await sdk.locateItem(pmRoot, child.item.id);
  assert.ok(located);
  const nativeModel = structuredClone((await sdk.readLocatedItem(located)).document);
  const wholeModel = (await client.listAllComplete({ includeBody: true })).items;
  const corpus = ['ASCII', ' Café ', 'e\u0301', '👩🏽‍💻', '日本語', 'λ', '\r\n', '\ud800', '', child.item.title,
    ...Array.from({ length: 500 }, (_, index) => String.fromCodePoint((Math.imul(index, 104729) >>> 0) % 0x110000))];
  let seed = 0x54a11, replays = 0;
  /** Seeded operation selection; no handwritten input normalization. */
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  for (let sequence = 0; sequence < 500; sequence += 1) {
    let state: FontCoverageLabel[] = [], model: FontCoverageLabel[] = [];
    const snapshots: { wire: string; model: FontCoverageLabel[] }[] = [];
    for (let operation = 0; operation < 12; operation += 1) {
      const action = random() % 4;
      if (action === 0 || state.length === 0) {
        const value = label(corpus[random() % corpus.length], (['mark', 'display', 'caption', 'body'] as const)[random() % 4]);
        state.push(value); model.push(structuredClone(value));
      } else if (action === 1) { state.shift(); model.shift(); }
      else if (action === 2 && snapshots.length > 0) {
        const old = snapshots[random() % snapshots.length];
        state = (JSON.parse(old.wire) as FontCoverageRequest).labels.slice(); model = structuredClone(old.model); replays += 1;
      } else { state.reverse(); model.reverse(); }
      const request = { version: 1, labels: state, include_all: true };
      snapshots.push({ wire: JSON.stringify(request), model: structuredClone(model) });
      const parsed = parseFontCoverageRequest(JSON.parse(` \r\n${JSON.stringify(request, null, 2).replaceAll('\n', '\r\n')}\r\n `));
      assert.ok(!('ok' in parsed));
      if (!('ok' in parsed)) assert.deepEqual(parsed.labels, model);
      const result = success(preflightFontCoverage(parsed));
      assert.deepEqual(result.labels.map(row => JSON.parse(row.text_json)), model.map(row => row.text));
      assert.equal(result.summary.code_points, model.reduce((sum, row) => sum + [...row.text].length, 0));
      for (const row of result.labels) {
        const table = fontData[row.role].glyphs;
        const points = [...JSON.parse(row.text_json) as string];
        // Independent reference model: exact table membership and the renderer's declared XML domain.
        const expected = points.flatMap((point, index) => /[\u0000-\u001f\u007f-\u009f\ufffe\uffff\p{Cs}]/u.test(point)
          || !Object.hasOwn(table, point) ? [index] : []);
        assert.deepEqual(row.issues.map(issue => issue.index), expected, `sequence ${sequence}, operation ${operation}`);
        assert.deepEqual(row.issues.map(issue => issue.utf16_offset), expected.map(index => points.slice(0, index).join('').length));
      }
      assert.deepEqual(validateFontCoverageNumbers(result), result);
      assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
      assert.deepEqual(decode(encode(result)), result);
    }
    const report = await renderFontCoverageReport({ version: 1, labels: state, format: sequence % 2 ? 'json' : 'toon', budget: 512 }, sdk);
    assert.deepEqual(report.format === 'json' ? JSON.parse(report.text) : decode(report.text), report.result);
    assert.deepEqual((await sdk.readLocatedItem(located)).document, nativeModel, `SDK read-back sequence ${sequence}`);
  }
  assert.ok(replays > 500, `older input replays: ${replays}`);
  assert.deepEqual((await client.listAllComplete({ includeBody: true })).items, wholeModel);
  console.log(`Font model: 500 sequences, 6000 operations, ${replays} older-input replays, 500 native SDK read-backs`);
});

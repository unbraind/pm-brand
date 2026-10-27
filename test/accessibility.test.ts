/** Consumer fault fixtures, strict boundary fuzzing and real SDK output accounting. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decode, encode } from '@toon-format/toon';
import * as sdk from '@unbrained/pm-cli/sdk';
import * as authoringSdk from '@unbrained/pm-cli/sdk/authoring';
import { diagnoseAccessibility, evaluateAccessibilityRequest, parseAccessibilityRequest, validateAccessibilityNumbers } from '../dist/accessibility.js';
import type { AccessibilityDiagnosis, AccessibilityRequest, AccessibilityResult, RenderedAccessibilityPair } from '../dist/accessibility.js';
import { loadAccessibilityOutputSdk, renderAccessibilityReport } from '../dist/accessibility-report.js';
import type { AccessibilityOutputSdk } from '../dist/accessibility-report.js';
import { contrast, tokenColor } from '../dist/contrast.js';
import { tokens } from '../dist/index.js';

/** A consumer pair deliberately need not match the token's default palette colour. */
function pair(overrides: Partial<RenderedAccessibilityPair> = {}): RenderedAccessibilityPair {
  return { locator: 'components/Chip.tsx:24#label', theme: 'light', rule: 'text',
    foreground: { token: 'rose', color: tokenColor('light', 'rose') },
    background: { token: 'sheet', color: tokens.light.sheet }, ...overrides };
}

/** Require a completed diagnosis before comparing its authoritative counts. */
function success(result: AccessibilityResult): AccessibilityDiagnosis {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}

test('consumer fixtures distinguish text, focus and decoration and retain exact repair coordinates', () => {
  const p = pair();
  const result = success(diagnoseAccessibility({ version: 1, pairs: [p, pair({ rule: 'focus' }), pair({ rule: 'decorative' }),
    pair({ theme: 'dark', locator: '#dark-label', foreground: { token: 'carbon', color: '#171F37' }, background: { token: 'sheet', color: '#171F37' } }),
    pair({ textSize: 'large', foreground: { token: 'graphite', color: '#777777' } }),
    pair({ foreground: { token: 'carbon', color: '#000000' } })] }));
  assert.deepEqual(result.summary, { total: 6, evaluated: 5, decorative: 1, failed: 3, text_failed: 2, focus_failed: 1 });
  assert.deepEqual(result.failures.map(row => row.index), [0, 1, 3]);
  assert.deepEqual(result.failures[0], { index: 0, locator: p.locator, theme: 'light', rule: 'text',
    foreground_token: 'rose', background_token: 'sheet', foreground_color: p.foreground.color,
    background_color: '#FFFFFF', ratio: contrast(p.foreground.color, '#FFFFFF'), minimum: 4.5 });
  assert.equal(result.failures[1].minimum, 3);
  assert.equal(result.failures[2].ratio, 1);
  assert.equal(result.failures[2].foreground_token, 'carbon');
  assert.deepEqual(success(diagnoseAccessibility({ version: 1, pairs: [] })).failures, []);
});

test('WCAG decisions use unrounded measurements and inclusive thresholds', () => {
  for (const [ink, rule, textSize, expected] of [
    ['#767676', 'text', 'normal', 0], ['#777777', 'text', 'normal', 1],
    ['#777777', 'text', 'large', 0], ['#959595', 'focus', undefined, 1], ['#949494', 'focus', undefined, 0],
  ] as const) {
    const p = pair({ foreground: { token: 'graphite', color: ink }, rule, ...(textSize ? { textSize } : {}) });
    assert.equal(success(diagnoseAccessibility({ version: 1, pairs: [p] })).summary.failed, expected);
  }
  // Thousands of values immediately around 3 and 4.5 exercise boundary sensitivity without display rounding.
  for (const minimum of [3, 4.5]) {
    const alpha = 1 - (1.055 * ((1.05 / minimum - .05) ** (1 / 2.4)) - .055);
    for (let delta = -50; delta <= 50; delta += 1) {
      const color = `rgba(0, 0, 0, ${alpha + delta * 1e-14})`;
      const measured = contrast(color, '#FFFFFF');
      const result = success(diagnoseAccessibility({ version: 1, pairs: [pair({ rule: minimum === 3 ? 'focus' : 'text', foreground: { token: 'carbon', color } })] }));
      assert.equal(result.summary.failed, measured < minimum ? 1 : 0);
    }
  }
});

test('one strict schema refuses invalid input before diagnosis; valid old-style colours stay accepted', () => {
  const base = { version: 1, pairs: [pair()] };
  const accessor = Object.defineProperty({}, 'version', { get() { throw new Error('must not execute'); } });
  const pairAccessor = [pair()]; Object.defineProperty(pairAccessor, 0, { get() { throw new Error('must not execute'); } });
  const inherited = Object.assign(Object.create({ hidden: true }) as object, base);
  const symbol = { ...base, [Symbol('foreign')]: true };
  const sparse = new Array(2); sparse[1] = pair();
  const holesWithExtra = Object.assign(new Array(1), { extra: pair() });
  const cases: unknown[] = [null, [], 1, 'json', new Date(), inherited, accessor, symbol,
    {}, { ...base, version: 2 }, { ...base, pairs: {} }, { ...base, pairs: new Array(4097) },
    { ...base, pairs: sparse }, { ...base, pairs: holesWithExtra }, { ...base, pairs: Object.assign([pair()], { extra: true }) }, { ...base, pairs: pairAccessor },
    { ...base, extra: true }, { ...base, format: 'xml' },
    ...[NaN, Infinity, -Infinity, 0, 511, 1_000_001, 512.5, '512', null].map(budget => ({ ...base, budget })),
    ...['', '  ', 'a'.repeat(257), 'line\nbreak', '\ud800'].map(locator => ({ ...base, pairs: [pair({ locator })] })),
    ...[{ theme: 'system' }, { rule: 'custom' }, { textSize: 'small' }, { rule: 'focus', textSize: 'large' },
      { foreground: null }, { background: { token: 'constructor', color: '#FFFFFF' } },
      { foreground: { token: '__proto__', color: '#000000' } }, { foreground: { token: 'font-body', color: '#000000' } },
      { foreground: { token: 'focus', color: '#000000' } }, { foreground: { token: 'paper', color: 2 } },
      { foreground: { token: 'carbon', color: 'x'.repeat(81) } }, { foreground: { token: 'carbon', color: 'red' } },
      { background: { token: 'status-canceled-bg', color: 'transparent' } },
      { background: { token: 'paper', color: 'rgba(0, 0, 0, .5)' } },
      { foreground: { token: 'paper', color: '#000000', extra: true } },
    ].map(overrides => ({ ...base, pairs: [{ ...pair(), ...overrides }] })),
  ];
  for (const input of cases) {
    const result = diagnoseAccessibility(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.remedy.length > 0);
  }
  for (const color of ['#ffffff', 'rgba(0, 0, 0, 0.5)', 'rgba(255, 0, 127, .5)', 'transparent']) {
    assert.equal(diagnoseAccessibility({ ...base, pairs: [pair({ locator: ' Étiquette [a,b] "λ" ', foreground: { token: 'status-open-fg', color } })] }).ok, true);
  }
  assert.equal(diagnoseAccessibility({ ...base, format: 'json', budget: 512 }).ok, true);
  assert.equal(diagnoseAccessibility({ ...base, format: 'toon', budget: 1_000_000 }).ok, true);
  assert.equal(diagnoseAccessibility(Object.assign(Object.create(null) as object, base)).ok, true);
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'budget');
  try {
    Object.defineProperty(Object.prototype, 'budget', { value: 0, configurable: true });
    assert.equal(diagnoseAccessibility({ version: 1, pairs: [] }).ok, true, 'Inherited ambient fields are not request data');
  } finally {
    if (previous) Object.defineProperty(Object.prototype, 'budget', previous);
    else Reflect.deleteProperty(Object.prototype, 'budget');
  }
  assert.equal(success(diagnoseAccessibility({ version: 1, pairs: Array.from({ length: 4096 }, () => pair({ rule: 'decorative' })) })).summary.total, 4096);
  const parsed = parseAccessibilityRequest(base);
  assert.ok(!('ok' in parsed));
  if (!('ok' in parsed)) assert.deepEqual(evaluateAccessibilityRequest(parsed), diagnoseAccessibility(base));
  const proxy = new Proxy({}, { getPrototypeOf() { throw new Error('untrusted proxy'); } });
  assert.equal(diagnoseAccessibility(proxy).ok, false);
});

test('producer number guard refuses extreme output and inconsistent count domains', () => {
  const valid = success(diagnoseAccessibility({ version: 1, pairs: [pair()] }));
  assert.deepEqual(validateAccessibilityNumbers(valid), valid);
  for (const number of [NaN, Infinity, -Infinity, -1, .5, 4097, Number.MAX_VALUE]) {
    assert.equal(validateAccessibilityNumbers({ ...valid, summary: { ...valid.summary, total: number } }).ok, false);
  }
  for (const change of [{ evaluated: 0 }, { decorative: 1 }, { failed: 0 }, { text_failed: 0 }, { evaluated: 0, decorative: 1 }]) {
    assert.equal(validateAccessibilityNumbers({ ...valid, summary: { ...valid.summary, ...change } }).ok, false);
  }
  for (const number of [NaN, Infinity, -Infinity, 0, 21.0001, Number.MAX_VALUE]) {
    assert.equal(validateAccessibilityNumbers({ ...valid, failures: [{ ...valid.failures[0], ratio: number }] }).ok, false);
  }
  for (const index of [-1, .1, 1, Infinity]) assert.equal(validateAccessibilityNumbers({ ...valid, failures: [{ ...valid.failures[0], index }] }).ok, false);
  assert.equal(validateAccessibilityNumbers({ ...valid, failures: [{ ...valid.failures[0], minimum: 4.499 }] }).ok, false);
  const bits = new DataView(new ArrayBuffer(8));
  let seed = 0xbadf00d;
  /** Fuzz arbitrary IEEE-754 bit patterns without generating non-reproducible failures. */
  const next = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed; };
  for (let sample = 0; sample < 500; sample += 1) {
    bits.setUint32(0, next()); bits.setUint32(4, next());
    const value = bits.getFloat64(0);
    assert.equal(diagnoseAccessibility({ version: 1, pairs: [], budget: value }).ok,
      Number.isSafeInteger(value) && value >= 512 && value <= 1_000_000);
    assert.equal(validateAccessibilityNumbers({ ...valid, failures: [{ ...valid.failures[0], ratio: value }] }).ok,
      Number.isFinite(value) && value >= 1 && value <= 21);
  }
});

test('JSON and TOON budgets include exact wire bytes and retain complete failure counts', async () => {
  assert.equal(typeof (await loadAccessibilityOutputSdk()).attachOutputTokenAccounting, 'function');
  for (const format of ['json', 'toon'] as const) {
    const input = { version: 1, pairs: [pair({ locator: '#label, "λ" [a,b]' })], format, budget: 512 };
    const report = await renderAccessibilityReport(input, sdk);
    assert.equal(report.result.ok, true);
    assert.deepEqual(format === 'json' ? JSON.parse(report.text) : decode(report.text), report.result);
    const needed = sdk.attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens;
    assert.ok(needed <= input.budget);
    const exact = await renderAccessibilityReport({ ...input, budget: Math.max(512, needed) });
    assert.equal(exact.result.ok, true);
    const many = await renderAccessibilityReport({ ...input, pairs: Array.from({ length: 50 }, (_, index) => pair({ locator: `#item-${index}` })) });
    assert.equal(many.result.ok, false);
    if (!many.result.ok) {
      assert.equal(many.result.code, 'budget_exceeded');
      assert.equal(many.result.summary?.failed, 50);
      assert.ok(many.result.required_budget! > 512);
      assert.ok(sdk.attachOutputTokenAccounting(many.result, () => many.text).token_accounting.total_estimated_tokens <= 512);
      const restored = await renderAccessibilityReport({ ...input, budget: many.result.required_budget, pairs: Array.from({ length: 50 }, (_, index) => pair({ locator: `#item-${index}` })) });
      assert.equal(success(restored.result).failures.length, 50);
      const justBelow = await renderAccessibilityReport({ ...input, budget: many.result.required_budget! - 1, pairs: Array.from({ length: 50 }, (_, index) => pair({ locator: `#item-${index}` })) });
      assert.equal(justBelow.result.ok, false);
    }
  }
  const refused = await renderAccessibilityReport({ version: 2 });
  assert.equal(refused.format, 'json');
  const noCapability = await renderAccessibilityReport({ version: 1, pairs: [pair()] }, authoringSdk as unknown as AccessibilityOutputSdk);
  assert.equal(noCapability.result.ok, false);
  if (!noCapability.result.ok) assert.equal(noCapability.result.code, 'sdk_unavailable');
  assert.equal((await renderAccessibilityReport({ version: 1, pairs: [] })).format, 'toon');
});

test('CLI works without git, refuses unusable flags and bounds regular file reads', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-cli-'));
  const cli = resolve('dist/cli.js');
  const input = join(root, 'component.json');
  const childEnv = { PATH: '', GIT_CEILING_DIRECTORIES: tmpdir() };
  /** Execute the packed-shaped bin using an explicit runtime and no git on PATH. */
  const run = (args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: root, env: childEnv, encoding: 'utf8', timeout: 15000 });
  try {
    writeFileSync(input, JSON.stringify({ version: 1, pairs: [pair()] }));
    const result = run(['diagnose', input, '--format', 'json', '--budget', '512']);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).summary.failed, 1);
    assert.equal(run(['--help']).status, 0);
    for (const args of [[], ['bad'], ['diagnose'], ['diagnose', input, '--other', 'x'], ['diagnose', input, '--format'],
      ['diagnose', input, '--format', 'json', '--format', 'toon'], ['diagnose', input, '--budget', 'Infinity'],
      ['diagnose', input, '--budget', '0'], ['diagnose', input, '--budget', ' 512 '], ['diagnose', input, '--format', 'xml'],
      ['diagnose', 'absent.json'], ['diagnose', root]]) {
      const refusal = run(args);
      assert.equal(refusal.status, 2, refusal.stdout + refusal.stderr);
      assert.equal(JSON.parse(refusal.stdout).ok, false);
    }
    for (const data of ['{', 'null', '[]', '1', '"text"']) {
      writeFileSync(input, data); assert.equal(run(['diagnose', input]).status, 2);
    }
    writeFileSync(input, Buffer.from([0xff])); assert.equal(run(['diagnose', input]).status, 2);
    writeFileSync(input, ' '.repeat(4 * 1024 * 1024 + 1)); assert.equal(run(['diagnose', input]).status, 2);
    writeFileSync(input, JSON.stringify({ version: 1, pairs: [] })); assert.equal(run(['diagnose', input]).status, 0);
    assert.deepEqual(JSON.parse(readFileSync(input, 'utf8')), { version: 1, pairs: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('500 seeded operation sequences preserve replay, whitespace and every produced report round trip', async t => {
  const root = mkdtempSync(join(tmpdir(), 'brand-model-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pmRoot = join(root, '.agents/pm');
  const client = new sdk.PmClient({ cwd: root, pmRoot, author: 'fixture-agent', noExtensions: true });
  await client.init('fixture', { defaults: true, withPackages: false, mergeFence: false, agentGuidance: 'skip' });
  const parent = await client.create({ title: 'Reference parent', type: 'Task', parent: 'none', clearDeps: true,
    unset: ['goal', 'objective', 'sprint', 'release', 'blocked_by', 'assignee', 'reviewer'] });
  const child = await client.create({ title: '  Rendered child λ  ', type: 'Task', parent: parent.item.id,
    body: 'First line\r\n\r\nSecond line with trailing space  \r\n', description: '  Resolved colours  ',
    tags: 'alpha,beta', priority: 1, risk: 'low', confidence: 'high', estimatedMinutes: '30',
    acceptanceCriteria: 'Visible label', definitionOfReady: 'Roles resolved',
    dep: [`id=${parent.item.id},kind=related_to`],
    file: ['path=components/Chip.tsx'], doc: ['path=docs/contrast.md'],
    note: ['text=Native note'], comment: ['text=Native comment'], learning: ['text=Native learning'],
    unset: ['goal', 'objective', 'sprint', 'release', 'blocked_by', 'assignee', 'reviewer'] });
  const located = await sdk.locateItem(pmRoot, child.item.id);
  assert.ok(located);
  // The SDK's own read-back is the reference state, including its native normalization.
  const trackerModel = structuredClone((await sdk.readLocatedItem(located)).document);
  const wholeModel = (await client.listAllComplete({ includeBody: true })).items;
  let seed = 0x54a11;
  /** Reproducible unsigned random source; failures identify their sequence and operation. */
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed >>> 8; };
  const colors = ['#000000', '#FFFFFF', '#777777', 'rgba(0, 0, 0, .5)', 'transparent'];
  let replays = 0;
  try { for (let sequence = 0; sequence < 500; sequence += 1) {
    let state: RenderedAccessibilityPair[] = [];
    const snapshots: { wire: string; model: RenderedAccessibilityPair[] }[] = [];
    // A simple reference model stores ordered rendered comparisons, never normalized expected values.
    let model: RenderedAccessibilityPair[] = [];
    for (let operation = 0; operation < 12; operation += 1) {
      const action = random() % 4;
      if (action === 0 || state.length === 0) {
        const value = pair({ locator: `#s${sequence}-o${operation}, λ`, theme: random() % 2 ? 'dark' : 'light',
          rule: (['text', 'focus', 'decorative'] as const)[random() % 3], foreground: { token: 'carbon', color: colors[random() % colors.length] } });
        state.push(value); model.push(structuredClone(value));
      } else if (action === 1) { state.shift(); model.shift(); }
      else if (action === 2 && snapshots.length > 0) {
        const older = snapshots[random() % snapshots.length];
        state = (JSON.parse(older.wire) as AccessibilityRequest).pairs.slice();
        model = structuredClone(older.model);
        replays += 1;
      } else { state.reverse(); model.reverse(); }
      const request = { version: 1, pairs: state };
      snapshots.push({ wire: JSON.stringify(request), model: structuredClone(model) });
      const variant = JSON.stringify(request, null, 2).replaceAll('\n', '\r\n');
      const observed = success(diagnoseAccessibility(JSON.parse(` \r\n${variant}\r\n `)));
      const expectedFailures = model.flatMap((row, index) => row.rule !== 'decorative' && contrast(row.foreground.color, row.background.color) < (row.rule === 'focus' ? 3 : 4.5) ? [index] : []);
      assert.deepEqual(observed.failures.map(row => row.index), expectedFailures, `sequence ${sequence}, operation ${operation}`);
      assert.equal(observed.summary.total, model.length);
      assert.deepEqual(validateAccessibilityNumbers(observed), observed);
      assert.deepEqual(JSON.parse(JSON.stringify(observed)), observed);
      assert.deepEqual(decode(encode(observed)), observed);
    }
    const report = await renderAccessibilityReport({ version: 1, pairs: state, budget: 512, format: sequence % 2 ? 'json' : 'toon' }, sdk);
    assert.deepEqual(report.format === 'json' ? JSON.parse(report.text) : decode(report.text), report.result);
    assert.ok(sdk.attachOutputTokenAccounting(report.result, () => report.text).token_accounting.total_estimated_tokens <= 512);
    assert.deepEqual((await sdk.readLocatedItem(located)).document, trackerModel, `SDK read-back after sequence ${sequence}`);
  }
    assert.ok(replays > 500, `expected older-input replays, got ${replays}`);
    assert.deepEqual((await client.listAllComplete({ includeBody: true })).items, wholeModel);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

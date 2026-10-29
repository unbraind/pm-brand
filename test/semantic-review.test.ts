/** Review regressions: topology must survive anchoring, and grammar precedes normalization. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { decode } from '@toon-format/toon';
import * as sdk from '@unbrained/pm-cli/sdk';
import { compareSemanticAssets, renderSemanticAssetReport } from '../dist/semantic-assets.js';
import type { SemanticAssetDiagnosis, SemanticAssetResult } from '../dist/semantic-assets.js';
import { semanticReviewCases, packedSemanticReviewCases, renderedColorReviewRequest } from '../scripts/semantic-review-fixtures.ts';

/** Assert the independent oracle without depending on internal normalization. */
function check(result: SemanticAssetResult, expected: string): void {
  if (expected === 'unsupported_svg') { assert.ok(!result.ok); assert.equal(result.code, expected); return; }
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

test('document boundary references agree with the independent XML parser and preserve legal controls', () => {
  for (const row of semanticReviewCases().filter(entry => entry.name.startsWith('document-'))) {
    check(compareSemanticAssets(row.request), row.expected);
    if (row.expected === 'unsupported_svg') {
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
        : where === 3 ? document.replace('<rect', `${ref}<rect`) : document.replace('<svg ', `<svg aria-label="A${ref}B" `) };
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
    return `<svg id="root" role="img">${content('root')}<g id="group" role="img">${content('group')}<rect/></g><g id="outline" data-text="A" role="img">${content('outline')}<path d="M0 0L1 1"/></g></svg>`;
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
  const render = (model: Model): string => `<svg id="root"><g id="one" transform="translate(10 0)">${model.one.map(id => units.get(id)).join('')}</g><g id="two" fill="#f00" opacity=".5">${model.two.map(id => units.get(id)).join('')}</g>${model.root.map(id => units.get(id)).join('')}</svg>`;
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
    const bad = `<svg><path d="M0 0 ${command}${prefix}${args.join(' ')}"/></svg>`;
    check(compareSemanticAssets({ version: 1, before: '<svg/>', after: bad }), 'unsupported_svg');
    args[slot] = sample % 2 ? '1' : '0';
    const good = `<svg><path d="M0 0 ${command}${prefix}${args.join(' ')}"/></svg>`;
    check(compareSemanticAssets({ version: 1, before: good, after: good }), 'unchanged');
  }
});

test('numeric lexical validation refuses long malformed scalars within a bounded run', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { compareSemanticAssets } from './dist/semantic-assets.js';
    const svg = '<svg x="' + '9'.repeat(200000) + '!"/>';
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
    assert.equal(output.status, row.expected === 'unsupported_svg' ? 2 : row.expected === 'unchanged' ? 0 : 1, output.stderr);
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

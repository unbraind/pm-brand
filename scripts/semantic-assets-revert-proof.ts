/** Catch independent behavioral reverts in disposable copies without modifying the package checkout. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'brand-semantic-revert-'));
try {
  for (const path of ['src', 'test', 'scripts', 'icons', 'tsconfig.json', 'package.json']) cpSync(path, join(scratch, path), { recursive: true });
  symlinkSync(resolve('node_modules'), join(scratch, 'node_modules'), 'dir');
  const probes = [
    { file: 'semantic-assets.ts', name: 'ignore paint changes', from: "a.fields[field] ?? null, b.fields[field] ?? null", to: "field === 'fill' ? null : a.fields[field] ?? null, field === 'fill' ? null : b.fields[field] ?? null", pattern: 'changed status color' },
    { file: 'semantic-assets.ts', name: 'ignore visible text', from: "if (JSON.stringify(a) !== JSON.stringify(b))", to: "if (field !== 'text' && JSON.stringify(a) !== JSON.stringify(b))", pattern: 'changed status color' },
    { file: 'static-svg.ts', name: 'ignore attribute values', from: 'fields[attr[1]] = attribute(attr[1], decode(attr[2] ?? attr[3], true));', to: "fields[attr[1]] = attr[1] === 'fill' ? '#ffffff' : attribute(attr[1], decode(attr[2] ?? attr[3], true));", pattern: 'changed status color' },
    { file: 'static-svg.ts', name: 'retain numeric spelling noise', from: "return values.join(' ');", to: 'return value;', pattern: 'attribute reordering' },
    { file: 'static-svg.ts', name: 'erase visible Unicode spaces', from: "frame.text.replace(/[\\t\\n\\r]/gu, ' ').replace(/ +/gu, ' ').replace(/^ +| +$/gu, '')", to: "frame.text.replace(/[\\t\\n\\r]/gu, ' ').replace(/ +/gu, ' ').trim()", pattern: 'Unicode whitespace' },
    { file: 'semantic-assets.ts', name: 'discard retained parent context', from: "add(locator, 'parent', a.parent, b.parent);", to: 'void locator;', pattern: 'topology model', test: 'test/semantic-review.test.ts' },
    { file: 'semantic-assets.ts', name: 'ignore order when membership changes', from: "add(locator, 'paint_order', a.children.filter(child => common.has(child)), b.children.filter(child => common.has(child)));", to: "if ([...a.children].sort().join('\\0') === [...b.children].sort().join('\\0')) add(locator, 'paint_order', a.children.filter(child => common.has(child)), b.children.filter(child => common.has(child)));", pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'coerce arc flags before validation', from: "!['0', '1'].includes(parts[n + 3]) || !['0', '1'].includes(parts[n + 4])", to: "!['0', '1'].includes(String(Number(parts[n + 3]))) || !['0', '1'].includes(String(Number(parts[n + 4])))", pattern: 'arc flag lexical', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'allow signed arc radii', from: '/^[+-]/u.test(parts[n]) || /^[+-]/u.test(parts[n + 1])', to: 'false', pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'ignore numeric-list separators', from: '!NUMBER_LIST.test(value)', to: 'false', pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'accept Unicode geometry separators', from: '/[^\\x09\\x0a\\x0d\\x20-\\x7e]/u.test(value)', to: 'false', pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'normalize invalid XML ids', from: "if (field === 'id') {", to: "if (field === 'id') { value = value.trim();", pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'accept Unicode XML syntax separators', from: 'const close = /^<\\/([a-zA-Z]+)[ \\t\\r\\n]*>/u', to: 'const close = /^<\\/([a-zA-Z]+)\\s*>/u', pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'contrast.ts', name: 'accept Unicode CSS separators', from: '[ \\t\\r\\n\\f]*', to: '\\s*', pattern: 'color lexical', test: 'test/contrast.test.ts' },
    { file: 'semantic-assets.ts', name: 'discard validated refusal encoding', from: "return { request, result: refuse('unsupported_svg'", to: "return { request: { ...request, format: 'json' }, result: refuse('unsupported_svg'", pattern: 'review topology', test: 'test/semantic-review.test.ts' },
  ];
  for (const probe of probes) {
    const path = join(scratch, 'src', probe.file), original = readFileSync(path, 'utf8');
    try {
      assert.ok(original.includes(probe.from)); writeFileSync(path, original.replace(probe.from, probe.to));
      execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
      const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', `--test-name-pattern=${probe.pattern}`, probe.test ?? 'test/semantic-assets.test.ts'], {
        cwd: scratch, encoding: 'utf8', timeout: 30000,
      });
      assert.equal(result.status, 1, result.stdout + result.stderr); assert.match(result.stdout, /AssertionError/u);
      console.log(`Caught behavioral revert: ${probe.name}`);
    } finally { writeFileSync(path, original); }
  }
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
  execFileSync(process.execPath, ['--test', '--test-concurrency=2', '--test-name-pattern=attribute reordering|changed status color|Unicode whitespace|review topology|arc flag lexical|color lexical', 'test/semantic-assets.test.ts', 'test/semantic-review.test.ts', 'test/contrast.test.ts'], { cwd: scratch, stdio: 'pipe' });
  console.log(`${probes.length}/${probes.length} behavioral reverts caught; restored implementation passes 6/6 unchanged regressions`);
} finally { rmSync(scratch, { recursive: true, force: true }); }

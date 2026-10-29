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
    { file: 'static-svg.ts', name: 'ignore attribute values', from: 'fields[name] = attribute(name, value);', to: "fields[name] = name === 'fill' ? '#ffffff' : attribute(name, value);", pattern: 'changed status color' },
    { file: 'static-svg.ts', name: 'retain numeric spelling noise', from: "return values.join(' ');", to: 'return value;', pattern: 'attribute reordering' },
    { file: 'static-svg.ts', name: 'erase visible Unicode spaces', from: "text.replace(/[\\t\\n\\r]/gu, ' ').replace(/ +/gu, ' ').replace(/^ +| +$/gu, '')", to: "text.replace(/[\\t\\n\\r]/gu, ' ').replace(/ +/gu, ' ').trim()", pattern: 'Unicode whitespace' },
    { file: 'semantic-assets.ts', name: 'discard retained parent context', from: "add(locator, 'parent', a.parent, b.parent);", to: 'void locator;', pattern: 'topology model', test: 'test/semantic-review.test.ts' },
    { file: 'semantic-assets.ts', name: 'ignore order when membership changes', from: 'add(locator, field, ordered(a, left, tag), ordered(b, right, tag));', to: "if (tag !== 'paint' || [...a.children].sort().join('\\0') === [...b.children].sort().join('\\0')) add(locator, field, ordered(a, left, tag), ordered(b, right, tag));", pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'coerce arc flags before validation', from: "!['0', '1'].includes(parts[n + 3]) || !['0', '1'].includes(parts[n + 4])", to: "!['0', '1'].includes(String(Number(parts[n + 3]))) || !['0', '1'].includes(String(Number(parts[n + 4])))", pattern: 'arc flag lexical', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'allow signed arc radii', from: '/^[+-]/u.test(parts[n]) || /^[+-]/u.test(parts[n + 1])', to: 'false', pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'ignore numeric-list separators', from: '!NUMBER_LIST.test(value)', to: 'false', pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'accept Unicode geometry separators', from: '/[^\\x09\\x0a\\x0d\\x20-\\x7e]/u.test(value)', to: 'false', pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'normalize invalid XML ids', from: "if (field === 'id') {", to: "if (field === 'id') { value = value.trim();", pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'accept Unicode XML syntax separators', from: 'const document = parseXml(source,', to: "source = source.replace(/\\u00a0(?=>)/gu, ' '); const document = parseXml(source,", pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'contrast.ts', name: 'accept Unicode CSS separators', from: '[ \\t\\r\\n\\f]*', to: '\\s*', pattern: 'color lexical', test: 'test/contrast.test.ts' },
    { file: 'semantic-assets.ts', name: 'discard validated refusal encoding', from: "return { request, result: { ...refuse(failed.code", to: "return { request: { ...request, format: 'json' }, result: { ...refuse(failed.code", pattern: 'review topology', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'discard non-painting child order', from: 'if (parent) parent.children.push(locator);', to: "if (parent && !['title', 'desc'].includes(tag)) parent.children.push(locator);", pattern: 'metadata model', test: 'test/semantic-review.test.ts' },
    { file: 'semantic-assets.ts', name: 'sort away title precedence', from: 'add(locator, field, ordered(a, left, tag), ordered(b, right, tag));', to: "add(locator, field, tag === 'title' ? ordered(a, left, tag).sort() : ordered(a, left, tag), tag === 'title' ? ordered(b, right, tag).sort() : ordered(b, right, tag));", pattern: 'metadata order changes', test: 'test/semantic-review.test.ts' },
    { file: 'semantic-assets.ts', name: 'sort away description precedence', from: 'add(locator, field, ordered(a, left, tag), ordered(b, right, tag));', to: "add(locator, field, tag === 'desc' ? ordered(a, left, tag).sort() : ordered(a, left, tag), tag === 'desc' ? ordered(b, right, tag).sort() : ordered(b, right, tag));", pattern: 'metadata order changes', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'discard metadata while grouping outlines', from: "node.children.splice(0, node.children.length, ...node.children.filter(child => byLocator.get(child)!.tag !== 'path'));", to: 'node.children.length = 0;', pattern: 'metadata order changes', test: 'test/semantic-review.test.ts' },
    { file: 'semantic-assets.ts', name: 'misclassify metadata order as paint', from: "!['title', 'desc'].includes(map.get(child)!.tag)", to: 'true', pattern: 'metadata order changes', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'expand references outside the document element', from: 'const document = parseXml(source,', to: "source = source.replace(/&#(?:32|x20);/gu, ' '); const document = parseXml(source,", pattern: 'document boundary', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'restore context-free attribute delimiter rejection', from: 'fields[name] = attribute(name, value);', to: "if (value.includes(']]>')) invalid(); fields[name] = attribute(name, value);", pattern: 'XML conformance', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'discard parsed CDATA text', from: 'text += child.text;', to: "text += child.text.includes('<') ? '' : child.text;", pattern: 'XML conformance', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'discard namespace alias support', from: "const tag = parts.at(-1)!;", to: 'const tag = element.name;', pattern: 'XML conformance', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'erase unknown entities before validation', from: 'const document = parseXml(source,', to: "source = source.replaceAll('&unknown;', ''); const document = parseXml(source,", pattern: 'unsupported and malformed' },
    { file: 'static-svg.ts', name: 'promote absent namespaces after entering SVG', from: "if (uri !== 'http://www.w3.org/2000/svg') invalid();", to: "if (uri && uri !== 'http://www.w3.org/2000/svg') invalid();", pattern: 'namespace identity', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'discard child namespace resets', from: 'const namespaces = new Map(inherited);', to: "const namespaces = new Map(inherited); if (element.attributes.xmlns === '' && parent) element.attributes.xmlns = 'http://www.w3.org/2000/svg';", pattern: 'namespace model', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'infer a default namespace from qualified parents', from: "const uri = namespaces.get(parts.length === 2 ? parts[0] : '');", to: "const uri = namespaces.get(parts.length === 2 ? parts[0] : '') || (parent ? 'http://www.w3.org/2000/svg' : undefined);", pattern: 'namespace identity', test: 'test/semantic-review.test.ts' },
    { file: 'static-svg.ts', name: 'skip renderer acceptance', from: "new Resvg(source, { font: { loadSystemFonts: false }, logLevel: 'off' });", to: 'void source;', pattern: 'renderer mutation', test: 'test/semantic-review.test.ts' },
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
  const parserPath = join(scratch, 'src/static-svg.ts'), fixedParser = readFileSync(parserPath, 'utf8');
  try {
    const previous = "export interface StaticSvgRefusal { readonly code: 'unsupported_svg' | 'unsupported_semantics'; readonly reason?: string }\n" + execFileSync('git', ['show', '7e7690f:src/static-svg.ts'], { encoding: 'utf8' })
      .replace('StaticSvgNode[] | null', "StaticSvgNode[] | StaticSvgRefusal")
      .replace('return null;', "return { code: 'unsupported_svg' };");
    writeFileSync(parserPath, previous);
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
    const reverted = spawnSync(process.execPath, ['--test', '--test-concurrency=2', '--test-name-pattern=XML conformance', 'test/semantic-review.test.ts'], { cwd: scratch, encoding: 'utf8', timeout: 30000 });
    assert.equal(reverted.status, 1, reverted.stdout + reverted.stderr); assert.match(reverted.stdout, /AssertionError/u);
    console.log('Caught behavioral replacement: previous hand-written XML parser');
  } finally { writeFileSync(parserPath, fixedParser); }
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc')], { cwd: scratch, stdio: 'pipe' });
  execFileSync(process.execPath, ['--test', '--test-concurrency=2', '--test-name-pattern=attribute reordering|changed status color|Unicode whitespace|review topology|arc flag lexical|color lexical|metadata order changes|document boundary|XML conformance|namespace identity|renderer acceptance', 'test/semantic-assets.test.ts', 'test/semantic-review.test.ts', 'test/contrast.test.ts'], { cwd: scratch, stdio: 'pipe' });
  console.log(`${probes.length + 1}/${probes.length + 1} behavioral reverts caught; restored implementation passes 12/12 unchanged regressions`);
} finally { rmSync(scratch, { recursive: true, force: true }); }

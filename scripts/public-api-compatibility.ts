/** Main-derived package contract: export conditions, declaration signatures and browser dependency growth. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { builtinModules, createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { API, SymbolFlags } from 'typescript/unstable/sync';
import type { Snapshot } from 'typescript/unstable/sync';
import * as ast from 'typescript/unstable/ast';
import { build } from 'esbuild';
import type { Plugin } from 'esbuild';

/** Existing export target, including conditional and asset targets. */
/** A package.json export target: a path, `null` (not exported), a fallback array, or a condition object. */
export type ExportTarget = string | null | readonly ExportTarget[] | { readonly [condition: string]: ExportTarget };
/** Canonical browser graph evidence; existing main dependencies are allowed. */
export interface BrowserInventory { readonly node_edges: string[]; readonly server_modules: string[]; readonly node_dependencies: string[] }
/** Reproducible public contract generated from committed main files, never guessed from the feature branch. */
export interface PublicApiBaseline {
  readonly source_ref: string;
  readonly exports: Record<string, ExportTarget>;
  readonly assets: string[];
  readonly names: Record<string, Record<string, string>>;
  readonly declarations: Record<string, string>;
  readonly values: Record<string, Record<string, string>>;
  readonly browser: BrowserInventory;
  readonly browser_sources: Record<string, string>;
  readonly browser_large_sources: Record<string, string>;
}

/** Resolve source, installed and symlinked packages through their public manifest export. */
function packageRoot(root: string): string {
  return dirname(createRequire(join(root, 'package.json')).resolve('pm-brand/package.json'));
}
/** Read the explicit package manifest, without ambient package or tracker discovery. */
function manifest(root: string): { name: string; exports: Record<string, ExportTarget> } {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
}
/** Conditions Node activates for an ESM import, matched in manifest order like Node's own resolver. */
const NODE_IMPORT_CONDITIONS = new Set(['node-addons', 'node', 'import', 'module-sync', 'default']);
/**
 * Resolve one target like Node's resolver: a path; a `null` that stops a condition object; a fallback array that
 * skips `null` and unmatched items (an empty or all-`null` array resolves to `null`); or the first matching
 * condition in manifest order. `undefined` means nothing matched.
 */
function conditionTarget(value: ExportTarget | undefined): string | null | undefined {
  if (value === undefined || value === null || typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    let last: null | undefined;
    for (const candidate of value as ReadonlyArray<ExportTarget>) {
      const file = conditionTarget(candidate);
      if (file === null) last = null;
      else if (file !== undefined) return file;
    }
    return last;
  }
  for (const [condition, nested] of Object.entries(value as { readonly [condition: string]: ExportTarget })) {
    if (!NODE_IMPORT_CONDITIONS.has(condition)) continue;
    const file = conditionTarget(nested);
    if (file !== undefined) return file;
  }
  return undefined;
}
/** Runtime file Node selects for an entry; a matched `null` or no runtime condition means Node does not export it. */
export function runtimeTarget(target: ExportTarget, entry: string): string {
  const file = conditionTarget(target);
  assert.ok(file !== undefined, `Entry point ${entry} has no node, import or default runtime condition`);
  assert.ok(file !== null, `Entry point ${entry} resolves to null, so Node does not export it`);
  return file;
}
/** Keep compiler-normalized declarations compact, including large literal font types. */
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
/** Canonicalize graph identities across source archives and npm/Bun installed packages. */
function moduleId(root: string, file: string, packageDirectory: string): string {
  const full = resolve(root, file).replaceAll('\\', '/');
  const marker = '/node_modules/';
  if (full.includes(marker)) return full.slice(full.lastIndexOf(marker) + marker.length);
  const own = resolve(packageDirectory).replaceAll('\\', '/');
  return full.startsWith(`${own}/`) ? `pm-brand/${full.slice(own.length + 1)}` : `pm-brand/${relative(root, full).replaceAll('\\', '/')}`;
}
/** Bundle the root for browsers while recording, rather than concealing, the Node dependencies main already has. */
export async function browserInventory(root: string, baseline?: Pick<PublicApiBaseline, 'browser_sources' | 'browser_large_sources'>): Promise<BrowserInventory> {
  const packageDirectory = packageRoot(root);
  const nodeEdges = new Set<string>(), seeds = new Set<string>(), dependencies = new Set<string>();
  const builtins = new Set(builtinModules.map(name => name.replace(/^node:/u, '')));
  const plugin: Plugin = { name: 'main-relative-node-inventory', setup(builder) {
    builder.onLoad({ filter: /\.js$/ }, args => {
      const id = moduleId(root, args.path, packageDirectory);
      if (!baseline || !id.startsWith('pm-brand/')) return;
      if (Object.hasOwn(baseline.browser_sources, id)) return { contents: baseline.browser_sources[id], loader: 'js' };
      assert.ok(Object.hasOwn(baseline.browser_large_sources, id), `Unknown main browser module ${id}`);
      const contents = readFileSync(args.path, 'utf8');
      assert.equal(digest(contents), baseline.browser_large_sources[id], `Changed main leaf data ${id}`);
      return { contents, loader: 'js' };
    });
    builder.onResolve({ filter: /.*/ }, args => {
      if (!args.path.startsWith('node:') && !args.path.startsWith('bun:') && !builtins.has(args.path) && !args.path.endsWith('.node')) return;
      const importer = moduleId(root, args.importer, packageDirectory);
      const name = builtins.has(args.path) ? `node:${args.path}` : args.path;
      nodeEdges.add(`${importer} -> ${name}`); seeds.add(importer);
      const parts = importer.split('/'); dependencies.add(parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
      return { path: name, external: true };
    });
  } };
  const result = await build({ absWorkingDir: root, stdin: { contents: "import * as api from 'pm-brand'; globalThis.brand = api;", resolveDir: root },
    bundle: true, platform: 'browser', write: false, metafile: true, logLevel: 'silent', treeShaking: false, plugins: [plugin] });
  const reverse = new Map<string, Set<string>>();
  for (const [file, input] of Object.entries(result.metafile.inputs)) for (const entry of input.imports) {
    if (entry.external) continue;
    const target = moduleId(root, entry.path, packageDirectory), parent = moduleId(root, file, packageDirectory);
    const parents = reverse.get(target) ?? new Set<string>(); parents.add(parent); reverse.set(target, parents);
  }
  const pending = [...seeds];
  while (pending.length) for (const parent of reverse.get(pending.pop()!) ?? []) if (!seeds.has(parent)) { seeds.add(parent); pending.push(parent); }
  return { node_edges: [...nodeEdges].sort(), server_modules: [...seeds].sort(), node_dependencies: [...dependencies].sort() };
}
/** Inventory every emitted declaration with the TypeScript parser and every typed entry with its export checker. */
export function declarationInventory(root: string): Pick<PublicApiBaseline, 'names' | 'declarations'> {
  const files = readdirSync(join(root, 'dist')).filter(name => name.endsWith('.d.ts')).map(name => join(root, 'dist', name));
  const scratch = mkdtempSync(join(tmpdir(), 'brand-declaration-api-'));
  const config = join(scratch, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: { noEmit: true, skipLibCheck: true, module: 'NodeNext', target: 'ES2022' }, files }));
  const api = new API({ cwd: root });
  let snapshot: Snapshot | undefined;
  try {
    snapshot = api.updateSnapshot({ openProjects: [config] });
    const project = snapshot.getProject(config)!;
    assert.ok(project, 'Declaration compiler project must open');
    const { program, checker } = project;
    const declarations: Record<string, string> = Object.create(null), names: Record<string, Record<string, string>> = Object.create(null);
    /** Compiler tokens ignore comments and spelling trivia without reimplementing a declaration grammar. */
    const signature = (text: string): string => {
      const scanner = ast.createScanner(true, undefined, text), tokens: string[] = [];
      for (let kind = scanner.scan(); kind !== ast.SyntaxKind.EndOfFile; kind = scanner.scan()) tokens.push(`${kind}:${scanner.getTokenText()}`);
      return digest(tokens.join('\0'));
    };
    for (const file of files) {
      const source = program.getSourceFile(file)!;
      for (const [index, statement] of source.statements.entries()) {
        const named = ast.isVariableStatement(statement) ? statement.declarationList.declarations.map(node => node.name.getText()).join(',')
          : ast.isFunctionDeclaration(statement) || ast.isInterfaceDeclaration(statement) || ast.isTypeAliasDeclaration(statement) || ast.isClassDeclaration(statement)
            ? statement.name?.getText() ?? `statement-${index}` : `statement-${index}`;
        if (ast.isExportDeclaration(statement)) continue;
        declarations[`${relative(root, file)}/${named}`] = signature(statement.getText());
      }
    }
    for (const [entry, target] of Object.entries(manifest(root).exports)) {
      const types = target !== null && typeof target === 'object' && !Array.isArray(target) ? (target as { readonly [condition: string]: ExportTarget }).types : undefined;
      if (typeof types !== 'string') continue;
      const source = program.getSourceFile(resolve(root, types))!;
      assert.ok(source, `Missing declarations: ${entry}`);
      const symbol = checker.getSymbolAtLocation(source)!;
      names[entry] = Object.create(null);
      for (const exported of checker.getExportsOfModule(symbol)) {
        const actual = exported.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        const text = actual.declarations.map(handle => handle.resolve(project)!.getText()).sort().join('\n');
        names[entry][exported.name] = signature(text);
      }
    }
    return { names, declarations };
  } finally { snapshot?.dispose(); api.close(); rmSync(scratch, { recursive: true, force: true }); }
}
/** Expand only explicitly exported asset patterns, without scanning outside the package. */
function assets(root: string): string[] {
  const paths: string[] = [];
  for (const target of Object.values(manifest(root).exports)) if (typeof target === 'string') {
    if (!target.includes('*')) paths.push(target);
    else {
      const directory = dirname(target);
      for (const name of readdirSync(join(root, directory))) paths.push(`${directory}/${name}`);
    }
  }
  return paths.sort();
}
/** Generate the recorded baseline only from an archived main package. */
export async function inventoryPublicApi(root: string, sourceRef: string): Promise<PublicApiBaseline> {
  const declaration = declarationInventory(root), values: Record<string, Record<string, string>> = Object.create(null);
  const require = createRequire(join(root, 'package.json'));
  for (const entry of Object.keys(declaration.names)) {
    const runtime = require(resolve(root, runtimeTarget(manifest(root).exports[entry], entry)));
    values[entry] = Object.fromEntries(Object.keys(runtime).sort().map(name => [name, typeof runtime[name]]));
  }
  const browser_sources: Record<string, string> = Object.create(null), browser_large_sources: Record<string, string> = Object.create(null);
  for (const name of readdirSync(join(root, 'dist')).filter(name => name.endsWith('.js'))) {
    const contents = readFileSync(join(root, 'dist', name), 'utf8'), id = `pm-brand/dist/${name}`;
    if (contents.length <= 100000) browser_sources[id] = contents; else browser_large_sources[id] = digest(contents);
  }
  return { source_ref: sourceRef, exports: manifest(root).exports, assets: assets(root), ...declaration, values, browser_sources, browser_large_sources, browser: await browserInventory(root) };
}
/** Preserve every main entry condition, asset, export name and emitted declaration signature. */
export function assertPublicApiCompatibility(root: string, baseline: PublicApiBaseline): void {
  root = packageRoot(root);
  const current = manifest(root).exports, declarations = declarationInventory(root);
  for (const [entry, target] of Object.entries(baseline.exports)) {
    assert.ok(Object.hasOwn(current, entry), `Removed entry point ${entry}`);
    assert.deepEqual(current[entry], target, `Changed main export conditions ${entry}`);
  }
  for (const asset of baseline.assets) assert.ok(existsSync(resolve(root, asset)), `Removed asset ${asset}`);
  for (const [entry, exports] of Object.entries(baseline.names)) for (const [name, signature] of Object.entries(exports)) {
    assert.equal(declarations.names[entry]?.[name], signature, `Removed export or changed type signature: ${entry}#${name}`);
  }
  for (const [name, signature] of Object.entries(baseline.declarations)) assert.equal(declarations.declarations[name], signature, `Changed main declaration: ${name}`);
  // Node's module loader independently verifies value exports at their original entry points.
  const require = createRequire(join(root, 'package.json'));
  for (const [entry, exports] of Object.entries(baseline.names)) {
    const runtime = require(resolve(root, runtimeTarget(current[entry], entry)));
    // Type-only names have no runtime value; compiler signatures above cover those.
    assert.ok(runtime && typeof runtime === 'object', `Invalid runtime entry ${entry}`);
    for (const [name, kind] of Object.entries(baseline.values[entry])) {
      assert.ok(Object.hasOwn(runtime, name), `Removed runtime export ${entry}#${name}`);
      assert.equal(typeof runtime[name], kind, `Changed runtime kind ${entry}#${name}`);
    }
    assert.ok(Object.keys(exports).length > 0, entry);
  }
}
/** Permit main's existing browser limitations while refusing any new Node edge, dependency or reaching module. */
export async function assertBrowserCompatibility(root: string, baseline: PublicApiBaseline): Promise<void> {
  // Main is bundled against this consumer's dependency graph, so supported peer
  // SDK versions cannot create false positives attributed to the feature branch.
  const allowed = await browserInventory(root, baseline), current = await browserInventory(root);
  for (const field of ['node_edges', 'server_modules', 'node_dependencies'] as const) {
    const existing = new Set(allowed[field]);
    assert.deepEqual(current[field].filter(value => !existing.has(value)), [], `New browser ${field} relative to main`);
  }
}

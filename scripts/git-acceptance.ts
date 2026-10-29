/** Verify the exact published Git commit with npm and Bun under their default lifecycle policy. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageManagerEnv } from './environment.ts';
import { assertBrowserEntryPoints } from './browser-acceptance.ts';
import { packedSemanticReviewCases, renderedColorReviewRequest } from './semantic-review-fixtures.ts';
const env = packageManagerEnv();
// Clear inherited opt-outs; an empty scratch project must use default lifecycle policy.
for (const key of Object.keys(env)) if (key.toLowerCase() === 'npm_config_ignore_scripts') delete env[key];
const lifecycle = execFileSync('npm', ['config', 'get', 'ignore-scripts'], { cwd: tmpdir(), env, encoding: 'utf8' }).trim();
if (lifecycle !== 'false') throw new Error('Git acceptance requires default npm lifecycle scripts enabled');
console.log(`Git acceptance: Node ${process.version}; npm ${execFileSync('npm', ['--version'], { env, encoding: 'utf8' }).trim()}; Bun ${execFileSync('bun', ['--version'], { env, encoding: 'utf8' }).trim()}; npm ignore-scripts=${lifecycle}; no Bun trust override`);
const sha = process.argv[2] ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/u.test(sha)) throw new Error('An exact commit SHA is required');
const scratch = mkdtempSync(join(tmpdir(), 'pm-brand-git-'));
try {
  for (const installer of ['npm', 'bun']) {
    const root = join(scratch, installer);
    mkdirSync(root);
    const spec = installer === 'npm' ? `git+https://github.com/unbraind/pm-brand.git#${sha}` : `github:unbraind/pm-brand#${sha}`;
    writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { 'pm-brand': spec, '@resvg/resvg-js': '2.6.2', '@toon-format/toon': '4.4.0' } }));
    execFileSync(installer, ['install'], { cwd: root, env, stdio: 'pipe', timeout: 180_000 });
    writeFileSync(join(root, 'smoke.ts'), readFileSync('test/consumer-smoke.ts'));
    writeFileSync(join(root, 'semantic-review-cases.json'), JSON.stringify({ semantic: packedSemanticReviewCases(), color: renderedColorReviewRequest() }));
    execFileSync(installer === 'npm' ? process.execPath : 'bun', ['smoke.ts'], { cwd: root, stdio: 'inherit' });
    await assertBrowserEntryPoints(root);
    console.log(`Exact-commit ${installer} Git consumer passed: ${sha}`);
  }
} finally { rmSync(scratch, { recursive: true, force: true }); }

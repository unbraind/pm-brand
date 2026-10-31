/** Generate or verify the main-derived compatibility fixture from committed public package files. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inventoryPublicApi } from './public-api-compatibility.ts';

/** Read a main commit (current main by default) in a disposable archive, never executing package lifecycle scripts or modifying its checkout. */
export async function mainApiBaseline(ref = 'origin/main') {
  const scratch = mkdtempSync(join(tmpdir(), 'brand-api-main-'));
  try {
    const root = join(scratch, 'main'); mkdirSync(root);
    const source = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], { encoding: 'utf8' }).trim();
    const archive = join(scratch, 'main.tar');
    execFileSync('git', ['archive', '--output', archive, source, 'package.json', 'dist', 'fonts', 'logo', 'icons', 'tokens.css', 'fonts.css', 'CONTRACT.md']);
    execFileSync('tar', ['-xf', archive, '-C', root]);
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
    return await inventoryPublicApi(root, source);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
/**
 * Regenerate the recorded fixture commit. It loads with the current dependencies, so a later dependency removal
 * fails here, in the pull request that removes it, never on main after a merge; the remedy is a fixture refresh.
 */
export async function recordedApiBaseline(ref: string) {
  try { return await mainApiBaseline(ref); }
  catch (error) {
    throw new Error(`Recorded API baseline ${ref} cannot be regenerated with the current checkout (${(error as Error).message}). Refresh it from current main with \`node scripts/main-api-baseline.ts\` and commit test/fixtures/public-api-main.json.`, { cause: error });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/main-api-baseline.ts')) {
  const baseline = await mainApiBaseline();
  writeFileSync('test/fixtures/public-api-main.json', `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Generated main API baseline ${baseline.source_ref}: ${Object.keys(baseline.exports).length} entry points`);
}

/** Prove palette regressions reject the inspected baseline while restoring all source/build bytes afterwards. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const source = readFileSync('src/tokens.ts', 'utf8');
const outputs = readdirSync('dist').map(file => ({ path: `dist/${file}`, data: readFileSync(`dist/${file}`) }));
const before = JSON.parse(readFileSync('docs/palette-previews/baseline-tokens.json', 'utf8')) as unknown;
try {
  // Revert just the palette declarations, retaining cssVar and the current regression tests.
  writeFileSync('src/tokens.ts', `/** Inspected baseline for behavioral revert only. */\nexport const tokens = ${JSON.stringify(before, null, 2)} as const;${source.split('} as const;')[1]}`);
  execFileSync('node_modules/.bin/tsc', [], { stdio: 'pipe' });
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'test/palette.test.ts'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'Unchanged regressions must reject reverted token declarations');
  assert.match(result.stdout, /not ok.*Signal keeps neutral core surfaces/su);
  assert.match(result.stdout, /neutral/);
  console.log('PASS: reverting only canonical palette declarations fails the unchanged neutral/red identity regression');
} finally {
  writeFileSync('src/tokens.ts', source);
  for (const output of outputs) writeFileSync(output.path, output.data);
}

/** Reject asset drift by regenerating with only tracked inputs in a fresh directory. */
import { readdirSync, readFileSync, mkdtempSync, mkdirSync, copyFileSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
/** Every shipped output of the single geometry generator. */
const files = ['src/mark-data.ts', ...['logo', 'icons'].flatMap(folder => readdirSync(folder).map(file => `${folder}/${file}`))];
const before = files.map(file => readFileSync(file));
const scratch = mkdtempSync(join(tmpdir(), 'pm-brand-assets-'));
try {
  mkdirSync(join(scratch, 'src'));
  mkdirSync(join(scratch, 'scripts'));
  copyFileSync('scripts/marks.ts', join(scratch, 'scripts/marks.ts'));
  copyFileSync('src/tokens.ts', join(scratch, 'src/tokens.ts'));
  copyFileSync('src/font-data.ts', join(scratch, 'src/font-data.ts'));
  writeFileSync(join(scratch, 'package.json'), '{"type":"module"}');
  symlinkSync(resolve('node_modules'), join(scratch, 'node_modules'), 'dir');
  execFileSync(process.execPath, ['scripts/marks.ts'], { cwd: scratch });
  files.forEach((file, index) => {
    if (!before[index].equals(readFileSync(join(scratch, file)))) throw new Error(`Generated asset drift: ${file}`);
  });
  console.log(`${files.length} generated asset files agree in a clean directory without a font-build cache`);
} finally { rmSync(scratch, { recursive: true, force: true }); }

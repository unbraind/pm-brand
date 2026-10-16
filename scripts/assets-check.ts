/** Reject drift between shipped marks/icons and their single geometry generator. */
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
/** All committed outputs of scripts/marks.ts. */
const files = ['src/mark-data.ts', ...['logo', 'icons'].flatMap(folder => readdirSync(folder).map(file => `${folder}/${file}`))];
const before = files.map(file => createHash('sha256').update(readFileSync(file)).digest('hex'));
execFileSync(process.execPath, ['scripts/marks.ts']);
files.forEach((file, index) => {
  if (before[index] !== createHash('sha256').update(readFileSync(file)).digest('hex')) throw new Error(`Generated asset drift: ${file}`);
});
console.log(`${files.length} generated asset files agree with the shared geometry`);

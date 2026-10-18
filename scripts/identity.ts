/** Reject private path leaks and unexpected commit authors in this public package. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of files) {
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  let body: string;
  try { body = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { continue; }
  // Split literals so the policy's own implementation does not match itself.
  if (body.includes('/' + 'home/') || body.includes('/' + 'tmp/')) throw new Error(`Private path in ${file}`);
}
const authors = execFileSync('git', ['log', '--format=%an <%ae>'], { encoding: 'utf8' }).trim().split('\n');
// Bootstrap (pm-brand#3): main already carries the maintainer's approved public authoring identity
// from the #1 merge; pm-brand#4 replaces this list with the trusted-base controls file.
const allowed = new Set(['SteveBot <1153461+unbraind@users.noreply.github.com>', 'Steve Preu <stefan@preu.at>', 'dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>', 'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>']);
for (const author of authors) if (!allowed.has(author)) throw new Error('Unexpected commit identity');
console.log(`Public path policy: ${files.length} tracked files; commit identities verified`);

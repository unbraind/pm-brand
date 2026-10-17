/** Reject private paths and unapproved author or committer emails in this public package. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Run Git and preserve the raw author and committer evidence. */
function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
}

/** Resolve a trusted default branch; an isolated PR head must never approve itself. */
function baseRef(): string {
  for (const candidate of ['refs/remotes/origin/main', 'refs/heads/main']) {
    try { git('rev-parse', '--verify', `${candidate}^{commit}`); return candidate; }
    catch { continue; }
  }
  throw new Error('No trusted main ref: fetch the default branch and full history before identity:check');
}

/** Parse comments and blank lines out of a fleet control file. */
function meaningful(raw: string): string[] {
  return raw.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
}

/** Use base controls once adopted; bootstrap each file only when genuinely absent on base. */
function control(base: string, path: string): string[] {
  const present = git('ls-tree', '--name-only', base, '--', path).length > 0;
  return meaningful(present ? git('show', `${base}:${path}`) : readFileSync(path, 'utf8'));
}

const base = baseRef();
const approved = new Set(control(base, '.github/approved-git-identities.txt'));
const anchors = control(base, '.github/identity-baseline.txt');
const baseline = anchors[0];
if (anchors.length !== 1 || !baseline || !/^[a-f0-9]{40}$/u.test(baseline)) {
  throw new Error('Identity baseline must name exactly one full commit SHA');
}
if (git('rev-parse', '--is-shallow-repository') === 'true') throw new Error('Identity audit requires full history (fetch-depth: 0)');
try {
  git('cat-file', '-e', `${baseline}^{commit}`);
  git('merge-base', '--is-ancestor', baseline, base);
  git('merge-base', '--is-ancestor', baseline, 'HEAD');
} catch {
  throw new Error(`Identity baseline ${baseline} must exist and be an ancestor of both ${base} and HEAD; fetch full history`);
}
if (approved.size === 0) throw new Error('Approved identity list must not be empty');

const offenders: string[] = [];
const commits = git('log', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce', `${baseline}..HEAD`);
for (const line of commits.split('\n').filter(Boolean)) {
  const [sha, authorName, authorEmail, committerName, committerEmail] = line.split('\0');
  for (const [role, name, email] of [['author', authorName, authorEmail], ['committer', committerName, committerEmail]] as const) {
    if (!email || !approved.has(email)) offenders.push(`${sha} ${role} ${name} <${email}>`);
  }
}
if (offenders.length > 0) throw new Error(`Unapproved commit identities:\n${offenders.join('\n')}\nPropose deliberate public identities in .github/approved-git-identities.txt separately, or rewrite offending commits before merging.`);

const files = git('ls-files', '-z').split('\0').filter(Boolean);
for (const file of files) {
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  let body: string;
  try { body = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { continue; }
  // Split literals so the policy's own implementation does not match itself.
  if (body.includes('/' + 'home/') || body.includes('/' + 'tmp/')) throw new Error(`Private path in ${file}`);
}
console.log(`Public path policy: ${files.length} tracked files; commit identities verified`);

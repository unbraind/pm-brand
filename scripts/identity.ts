/** Reject private paths and unapproved author or committer emails in this public package. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Run Git and preserve the raw author and committer evidence. */
function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Pin one trusted main commit, rejecting a stale CI base instead of silently changing policy. */
function baseRef(): string {
  let current: string;
  try { current = git('rev-parse', '--verify', 'refs/remotes/origin/main^{commit}').trim(); }
  catch { throw new Error('No trusted main ref: fetch origin/main and full history before identity:check'); }
  const expected = process.env.IDENTITY_BASE_SHA;
  if (expected !== undefined && (!/^[a-f0-9]{40}$/u.test(expected) || expected !== current)) {
    throw new Error('Stale identity policy base: refresh the PR against current main and rerun required checks');
  }
  return current;
}

/** Ignore comments and empty lines without normalizing identity values. */
function meaningful(raw: string): string[] {
  return raw.split('\n').filter(line => line.length > 0 && !line.startsWith('#'));
}

/** Read policy exclusively from the pinned trusted base, including during adoption. */
function control(base: string, path: string): string {
  try { return git('show', `${base}:${path}`); }
  catch { throw new Error(`Missing trusted control ${path}; adopt controls independently on main before enabling the gate`); }
}

/** Validate both trusted and proposed policies without letting proposed controls authorize this PR. */
function validate(identities: string, anchor: string, base: string): { approved: Set<string>; baseline: string } {
  const emails = meaningful(identities);
  if (emails.length === 0 || emails.some(email => !/^[^\s<>@]+@[^\s<>@]+$/u.test(email))) {
    throw new Error('Approved identity list must contain nonempty exact email identities without whitespace');
  }
  const anchors = meaningful(anchor);
  const baseline = anchors[0];
  if (anchors.length !== 1 || !baseline || !/^[a-f0-9]{40}$/u.test(baseline)) {
    throw new Error('Identity baseline must name exactly one full commit SHA');
  }
  try {
    git('cat-file', '-e', `${baseline}^{commit}`);
    git('merge-base', '--is-ancestor', baseline, base);
    git('merge-base', '--is-ancestor', baseline, 'HEAD');
  } catch {
    throw new Error(`Identity baseline ${baseline} must exist and be an ancestor of both ${base} and HEAD; fetch full history`);
  }
  return { approved: new Set(emails), baseline };
}

const base = baseRef();
if (git('rev-parse', '--is-shallow-repository').trim() === 'true') throw new Error('Identity audit requires full history (fetch-depth: 0)');
const identityPath = '.github/approved-git-identities.txt';
const baselinePath = '.github/identity-baseline.txt';
const identities = control(base, identityPath);
const anchor = control(base, baselinePath);
const { approved, baseline } = validate(identities, anchor, base);

const offenders: string[] = [];
// NUL separates every field and record; no identity byte is trimmed, even on the oldest commit.
const fields = git('log', '-z', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce', `${baseline}..HEAD`, `${baseline}..${base}`).split('\0');
fields.pop(); // Git terminates the log with the record separator.
for (let index = 0; index < fields.length; index += 5) {
  const [sha, authorName, authorEmail, committerName, committerEmail] = fields.slice(index, index + 5);
  for (const [role, name, email] of [['author', authorName, authorEmail], ['committer', committerName, committerEmail]] as const) {
    if (!email || !approved.has(email)) offenders.push(`${sha} ${role} ${name} <${email}>`);
  }
}
if (offenders.length > 0) throw new Error(`Unapproved commit identities:\n${offenders.join('\n')}\nPropose deliberate public identities in .github/approved-git-identities.txt separately, or rewrite offending commits before merging.`);

// Validate proposed controls only after auditing with the trusted policy; never activate them here.
let proposedIdentities: string;
let proposedAnchor: string;
try {
  proposedIdentities = readFileSync(identityPath, 'utf8');
  proposedAnchor = readFileSync(baselinePath, 'utf8');
} catch { throw new Error('Proposed controls must retain both adopted control files'); }
validate(proposedIdentities, proposedAnchor, base);
for (const [path, trusted, proposed] of [[identityPath, identities, proposedIdentities], [baselinePath, anchor, proposedAnchor]]) {
  if (trusted !== proposed) console.log(`Proposed control change: ${path}; not active in this audit (trusted base ${base})`);
}

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
console.log(`Public path policy: ${files.length} tracked files; commit identities verified against ${base}`);

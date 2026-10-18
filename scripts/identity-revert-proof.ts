/** Independently revert each reviewed identity safeguard and require its unchanged regression to fail. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/identity.ts';
const original = readFileSync(path, 'utf8');
const checks: [string, string, string][] = [];
const controlStart = original.indexOf("  try { return git('show'");
const controlEnd = original.indexOf('\n}', controlStart);
checks.push(['trusted controls', 'absent trusted controls', original.slice(0, controlStart) +
  "  try { return git('show', `${base}:${path}`); }\n  catch { return readFileSync(path, 'utf8'); }" + original.slice(controlEnd)]);
const proposedStart = original.indexOf('// Validate proposed controls only');
const proposedEnd = original.indexOf('const files = git(', proposedStart);
checks.push(['proposed controls', 'missing or invalid proposed', original.slice(0, proposedStart) + original.slice(proposedEnd)]);
checks.push(['base union', 'base-only identities', original.replace(', `${baseline}..${base}`', '')]);
const staleStart = original.indexOf('  const expected = process.env.IDENTITY_BASE_SHA');
const staleEnd = original.indexOf('  return current;', staleStart);
checks.push(['stale policy', 'stale pinned policy', original.slice(0, staleStart) +
  '  if (process.env.IDENTITY_BASE_SHA) return process.env.IDENTITY_BASE_SHA;\n' + original.slice(staleEnd)]);
const logStart = original.indexOf('// NUL separates');
const logEnd = original.indexOf('if (offenders.length', logStart);
const trimmedLog = `const commits = git('log', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce', \`\${baseline}..HEAD\`, \`\${baseline}..\${base}\`).trimEnd();
for (const line of commits.split('\\n').filter(Boolean)) {
  const [sha, authorName, authorEmail, committerName, committerEmail] = line.split('\\0');
  for (const [role, name, email] of [['author', authorName, authorEmail], ['committer', committerName, committerEmail]] as const) {
    if (!email || !approved.has(email)) offenders.push(\`\${sha} \${role} \${name} <\${email}>\`);
  }
}
`;
checks.push(['raw email', 'whitespace-suffixed oldest', original.slice(0, logStart) + trimmedLog + original.slice(logEnd)]);
const record = '  const [sha, authorName, authorEmail, committerName, committerEmail] = fields.slice(index, index + 5);';
checks.push(['merge committer', 'unapproved merge committer', original.replace(record, record +
  "\n  if (git('rev-list', '--parents', '-n', '1', sha!).trim().split(' ').length > 2) continue;")]);
checks.push(['committed control edits', 'committed edits to both controls', original.replace(
  "try { return git('show', `${base}:${path}`); }", "try { return readFileSync(path, 'utf8'); }")]);
checks.push(['forward baseline', 'forward adoption accepts inherited', original
  .replace('`${baseline}..HEAD`', "'HEAD'").replace('`${baseline}..${base}`', 'base')]);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { writeFileSync(path, original); process.exit(signal === 'SIGINT' ? 130 : 143); });
}
try {
  for (const [name, pattern, mutant] of checks) {
    if (mutant === original) throw new Error(`No behavioral revert applied for ${name}`);
    writeFileSync(path, mutant);
    const result = spawnSync(process.execPath, ['--test', `--test-name-pattern=${pattern}`, 'test/identity.test.ts'], { encoding: 'utf8' });
    if (result.error || result.status !== 1 || !result.stdout.includes('AssertionError')) {
      throw new Error(`Regression did not catch ${name}: ${result.stdout}\n${result.stderr}`);
    }
    console.log(`Caught behavioral revert: ${name} (1 failing regression)`);
  }
} finally { writeFileSync(path, original); }

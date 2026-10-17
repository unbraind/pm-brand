/** Exercise the public path policy against real tracked text and binary fixtures. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('identity scans UTF-8 regardless of extension and skips NUL or invalid UTF-8 content', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'pm-brand-identity-'));
  const script = resolve('scripts/identity.ts');
  try {
    execFileSync('git', ['init', '--quiet', '-b', 'main', scratch]);
    execFileSync('git', ['-c', 'user.name=SteveBot', '-c', 'user.email=1153461+unbraind@users.noreply.github.com', 'commit', '--quiet', '--allow-empty', '-m', 'Synthetic identity fixture'], { cwd: scratch });
    mkdirSync(join(scratch, '.github'));
    writeFileSync(join(scratch, '.github/approved-git-identities.txt'), readFileSync('.github/approved-git-identities.txt'));
    writeFileSync(join(scratch, '.github/identity-baseline.txt'), execFileSync('git', ['rev-parse', 'HEAD'], { cwd: scratch }));
    const privatePath = '/' + 'home/example';
    writeFileSync(join(scratch, 'nul.data'), Buffer.from(`binary\0${privatePath}`));
    writeFileSync(join(scratch, 'invalid.data'), Buffer.concat([Buffer.from(privatePath), Buffer.from([0xff])]));
    writeFileSync(join(scratch, 'valid.txt'), 'Public UTF-8: café, 日本語, �');
    execFileSync('git', ['add', 'nul.data', 'invalid.data', 'valid.txt'], { cwd: scratch });
    const clean = spawnSync(process.execPath, [script], { cwd: scratch, encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /3 tracked files; commit identities verified/u);
    for (const file of ['text.txt', 'text.png', 'text.woff2']) {
      for (const prefix of ['/' + 'home/', '/' + 'tmp/']) {
        writeFileSync(join(scratch, file), `${prefix}example`);
        execFileSync('git', ['add', file], { cwd: scratch });
        const leaked = spawnSync(process.execPath, [script], { cwd: scratch, encoding: 'utf8' });
        assert.equal(leaked.status, 1, `${file}: private text must fail`);
        assert.ok(leaked.stderr.includes(`Private path in ${file}`));
        execFileSync('git', ['rm', '--cached', '--quiet', file], { cwd: scratch });
      }
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

/** Operate on an isolated real Git history with controls already adopted on the trusted base. */
function history(run: (scratch: string, git: (...args: string[]) => string, commit: (author?: string, committer?: string) => string) => void): void {
  const scratch = mkdtempSync(join(tmpdir(), 'pm-brand-history-'));
  const publicEmail = '1153461+unbraind@users.noreply.github.com';
  /** Execute fixture Git commands with a synthetic public identity independent of the host. */
  const git = (...args: string[]): string => execFileSync('git', args, {
    cwd: scratch, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: 'Public author', GIT_AUTHOR_EMAIL: publicEmail, GIT_COMMITTER_NAME: 'Public committer', GIT_COMMITTER_EMAIL: publicEmail },
  }).trimEnd();
  /** Append a commit with independently controlled author and committer emails. */
  const commit = (author = publicEmail, committer = publicEmail): string => {
    execFileSync('git', ['commit', '--quiet', '--allow-empty', '-m', 'Synthetic public fixture'], {
      cwd: scratch, env: { ...process.env, GIT_AUTHOR_NAME: 'SteveBot', GIT_AUTHOR_EMAIL: author, GIT_COMMITTER_NAME: 'GitHub', GIT_COMMITTER_EMAIL: committer },
    });
    return git('rev-parse', 'HEAD');
  };
  try {
    git('init', '--quiet', '-b', 'main');
    const root = commit();
    mkdirSync(join(scratch, '.github'));
    writeFileSync(join(scratch, '.github/approved-git-identities.txt'), readFileSync('.github/approved-git-identities.txt'));
    writeFileSync(join(scratch, '.github/identity-baseline.txt'), `# Forward-only test anchor\n${root}\n`);
    git('add', '.github'); commit();
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '--quiet', '-b', 'feature');
    run(scratch, git, commit);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

/** Run the actual gate as a child process against an isolated history. */
function audit(scratch: string): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [resolve('scripts/identity.ts')], { cwd: scratch, encoding: 'utf8' });
}

test('all six approved emails pass in both roles, including the public maintainer/GitHub merge identities', () => {
  history((scratch, _git, commit) => {
    const emails = readFileSync('.github/approved-git-identities.txt', 'utf8').split('\n').filter(line => line && !line.startsWith('#'));
    for (const email of emails) commit(email, email);
    commit('stefan@preu.at', 'noreply@github.com');
    const result = audit(scratch);
    assert.equal(result.status, 0, String(result.stderr));
  });
});

test('an unapproved author or committer names the full commit, offending role and identity', () => {
  for (const role of ['author', 'committer'] as const) history((scratch, _git, commit) => {
    const bad = 'synthetic@example.invalid';
    const sha = role === 'author' ? commit(bad) : commit(undefined, bad);
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.ok(String(result.stderr).includes(`${sha} ${role} ${role === 'author' ? 'SteveBot' : 'GitHub'} <${bad}>`), String(result.stderr));
  });
});

test('a PR cannot approve its own email, delete the adopted control or advance the trusted baseline', () => {
  for (const attack of ['approve', 'delete', 'advance'] as const) history((scratch, git, commit) => {
    const bad = 'self-approved@example.invalid';
    const sha = commit(bad);
    if (attack === 'approve') writeFileSync(join(scratch, '.github/approved-git-identities.txt'), `${bad}\n`);
    if (attack === 'delete') git('rm', '.github/approved-git-identities.txt');
    if (attack === 'advance') writeFileSync(join(scratch, '.github/identity-baseline.txt'), `${sha}\n`);
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.ok(String(result.stderr).includes(`${sha} author SteveBot <${bad}>`), String(result.stderr));
  });
});

test('merged side-branch commits and merge committers are audited, not just the first parent', () => {
  history((scratch, git, commit) => {
    git('checkout', '--quiet', '-b', 'side');
    const sha = commit('side@example.invalid');
    git('checkout', '--quiet', 'feature');
    commit();
    git('merge', '--quiet', '--no-ff', 'side', '-m', 'Synthetic merge');
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.ok(String(result.stderr).includes(`${sha} author`), String(result.stderr));
  });
});

test('no trusted base, a shallow checkout or a malformed trusted anchor fails closed', () => {
  for (const attack of ['base', 'shallow', 'anchor'] as const) history((scratch, git, commit) => {
    if (attack === 'base') { git('update-ref', '-d', 'refs/remotes/origin/main'); git('branch', '-D', 'main'); }
    if (attack === 'shallow') writeFileSync(join(scratch, '.git/shallow'), `${git('rev-parse', 'HEAD')}\n`);
    if (attack === 'anchor') {
      writeFileSync(join(scratch, '.github/identity-baseline.txt'), 'HEAD\n'); git('add', '.github/identity-baseline.txt'); commit();
      git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    }
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.match(String(result.stderr), attack === 'base' ? /No trusted main ref/u : attack === 'shallow' ? /full history/u : /full commit SHA/u);
  });
});

test('bootstrap cannot anchor to an unmerged commit even if that commit exists locally', () => {
  history((scratch, git, commit) => {
    const main = git('rev-parse', 'main');
    git('checkout', '--quiet', '--orphan', 'bootstrap'); git('rm', '-rf', '--quiet', '.github');
    const anchor = commit();
    git('update-ref', 'refs/remotes/origin/main', anchor);
    git('checkout', '--quiet', 'feature');
    writeFileSync(join(scratch, '.github/identity-baseline.txt'), `${main}\n`);
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.match(String(result.stderr), /ancestor of both/u);
  });
});

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
    execFileSync('git', ['add', '.github'], { cwd: scratch });
    execFileSync('git', ['-c', 'user.name=SteveBot', '-c', 'user.email=1153461+unbraind@users.noreply.github.com', 'commit', '--quiet', '-m', 'Adopt trusted fixture controls'], { cwd: scratch });
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: scratch });
    const privatePath = '/' + 'home/example';
    writeFileSync(join(scratch, 'nul.data'), Buffer.from(`binary\0${privatePath}`));
    writeFileSync(join(scratch, 'invalid.data'), Buffer.concat([Buffer.from(privatePath), Buffer.from([0xff])]));
    writeFileSync(join(scratch, 'valid.txt'), 'Public UTF-8: café, 日本語, �');
    execFileSync('git', ['add', 'nul.data', 'invalid.data', 'valid.txt'], { cwd: scratch });
    const clean = spawnSync(process.execPath, [script], { cwd: scratch, encoding: 'utf8', env: { ...process.env, IDENTITY_BASE_SHA: undefined } });
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /5 tracked files; commit identities verified/u);
    for (const file of ['text.txt', 'text.png', 'text.woff2']) {
      for (const prefix of ['/' + 'home/', '/' + 'tmp/']) {
        writeFileSync(join(scratch, file), `${prefix}example`);
        execFileSync('git', ['add', file], { cwd: scratch });
        const leaked = spawnSync(process.execPath, [script], { cwd: scratch, encoding: 'utf8', env: { ...process.env, IDENTITY_BASE_SHA: undefined } });
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
function audit(scratch: string, expectedBase?: string): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [resolve('scripts/identity.ts')], { cwd: scratch, encoding: 'utf8', env: { ...process.env, IDENTITY_BASE_SHA: expectedBase } });
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
    if (attack === 'base') git('update-ref', '-d', 'refs/remotes/origin/main');
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
    assert.match(String(result.stderr), /Missing trusted control/u);
  });
});


test('absent trusted controls never bootstrap from replacement PR controls', () => {
  for (const missing of ['identities', 'baseline', 'both'] as const) history((scratch, git, commit) => {
    const goodBase = git('rev-parse', 'origin/main');
    git('checkout', '--quiet', '-b', 'missing-controls', goodBase);
    if (missing !== 'baseline') git('rm', '.github/approved-git-identities.txt');
    if (missing !== 'identities') git('rm', '.github/identity-baseline.txt');
    commit();
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '--quiet', 'feature');
    writeFileSync(join(scratch, '.github/approved-git-identities.txt'), `${readFileSync('.github/approved-git-identities.txt', 'utf8')}self-approved@example.invalid\n`);
    writeFileSync(join(scratch, '.github/identity-baseline.txt'), `${goodBase}\n`);
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.match(String(result.stderr), /Missing trusted control/u);
  });
});

test('missing or invalid proposed controls fail even with approved commits', () => {
  for (const attack of ['remove-both', 'remove-list', 'remove-anchor', 'empty', 'space', 'anchor', 'future'] as const) history((scratch, git, commit) => {
    if (attack === 'remove-both' || attack === 'remove-list') rmSync(join(scratch, '.github/approved-git-identities.txt'));
    if (attack === 'remove-both' || attack === 'remove-anchor') rmSync(join(scratch, '.github/identity-baseline.txt'));
    if (attack === 'empty') writeFileSync(join(scratch, '.github/approved-git-identities.txt'), '# empty\n');
    if (attack === 'space') writeFileSync(join(scratch, '.github/approved-git-identities.txt'), 'noreply@github.com \n');
    if (attack === 'anchor') writeFileSync(join(scratch, '.github/identity-baseline.txt'), 'HEAD\n');
    if (attack === 'future') writeFileSync(join(scratch, '.github/identity-baseline.txt'), `${commit()}\n`);
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.match(String(result.stderr), /Proposed controls|exact email|full commit SHA|ancestor of both/u);
    // Restore deleted fixture paths so teardown and subsequent audits stay independent.
    git('reset', '--hard', 'HEAD');
  });
});

test('valid proposed policy changes are surfaced without becoming active', () => {
  history((scratch, _git, commit) => {
    writeFileSync(join(scratch, '.github/approved-git-identities.txt'), `${readFileSync('.github/approved-git-identities.txt', 'utf8')}new-public@example.invalid\n`);
    let result = audit(scratch);
    assert.equal(result.status, 0, String(result.stderr));
    assert.match(String(result.stdout), /Proposed control change: .github\/approved-git-identities.txt; not active/u);
    const sha = commit('new-public@example.invalid');
    result = audit(scratch);
    assert.equal(result.status, 1);
    assert.ok(String(result.stderr).includes(`${sha} author SteveBot <new-public@example.invalid>`));
  });
});

test('base-only identities are checked for both behind and diverged PR heads', () => {
  for (const diverged of [false, true]) history((scratch, git, commit) => {
    git('checkout', '--quiet', 'main');
    const sha = commit('base-only@example.invalid');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '--quiet', 'feature');
    if (diverged) commit();
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.ok(String(result.stderr).includes(`${sha} author SteveBot <base-only@example.invalid>`));
  });
});

test('stale pinned policy bases are rejected after main revokes a previously approved identity', () => {
  history((scratch, git, commit) => {
    const old = git('rev-parse', 'origin/main');
    const sha = commit('noreply@github.com');
    assert.equal(audit(scratch, old).status, 0);
    git('checkout', '--quiet', 'main');
    const policy = readFileSync(join(scratch, '.github/approved-git-identities.txt'), 'utf8');
    writeFileSync(join(scratch, '.github/approved-git-identities.txt'), policy.split('\n').filter(email => email !== 'noreply@github.com').join('\n'));
    git('add', '.github'); commit();
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '--quiet', 'feature');
    const result = audit(scratch, old);
    assert.equal(result.status, 1);
    assert.match(String(result.stderr), /Stale identity policy base/u);
    const refreshed = audit(scratch, git('rev-parse', 'origin/main'));
    assert.equal(refreshed.status, 1);
    assert.ok(String(refreshed.stderr).includes(`${sha} author SteveBot <noreply@github.com>`));
  });
});

test('whitespace-suffixed oldest committer email is preserved and rejected exactly', () => {
  history((scratch, git, commit) => {
    const original = git('rev-parse', 'origin/main');
    // Git porcelain sanitizes email input; write the adversarial raw commit object directly.
    const raw = git('cat-file', 'commit', original).replace(/(committer .*<)([^>]+)(>)/u, '$1$2 $3');
    const sha = execFileSync('git', ['hash-object', '-t', 'commit', '-w', '--stdin'], { cwd: scratch, input: raw + '\n', encoding: 'utf8' }).trim();
    git('update-ref', 'refs/remotes/origin/main', sha);
    git('update-ref', 'refs/heads/main', sha);
    git('reset', '--hard', sha);
    commit(); // The malformed base commit must be the oldest audited record.
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.ok(String(result.stderr).includes(`${sha} committer GitHub <1153461+unbraind@users.noreply.github.com >`), String(result.stderr));
  });
});

test('an unapproved merge committer fails independently of approved side-branch identities', () => {
  history((scratch, git, commit) => {
    git('checkout', '--quiet', '-b', 'approved-side');
    writeFileSync(join(scratch, 'side.txt'), 'Approved side branch fixture');
    git('add', 'side.txt'); commit();
    git('checkout', '--quiet', 'feature'); commit();
    execFileSync('git', ['merge', '--quiet', '--no-ff', 'approved-side', '-m', 'Synthetic merge committer'], {
      cwd: scratch, env: { ...process.env, GIT_AUTHOR_NAME: 'Public author', GIT_AUTHOR_EMAIL: 'noreply@github.com', GIT_COMMITTER_NAME: 'Merge fixture', GIT_COMMITTER_EMAIL: 'merge@example.invalid' },
    });
    const sha = git('rev-parse', 'HEAD');
    const result = audit(scratch);
    assert.equal(result.status, 1);
    assert.ok(String(result.stderr).includes(`${sha} committer Merge fixture <merge@example.invalid>`), String(result.stderr));
    assert.doesNotMatch(String(result.stderr), /author Public author/u);
  });
});

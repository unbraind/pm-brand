/** Exercise the public path policy against real tracked text and binary fixtures. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('identity scans UTF-8 regardless of extension and skips NUL or invalid UTF-8 content', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'pm-brand-identity-'));
  const script = resolve('scripts/identity.ts');
  try {
    execFileSync('git', ['init', '--quiet', scratch]);
    execFileSync('git', ['-c', 'user.name=SteveBot', '-c', 'user.email=1153461+unbraind@users.noreply.github.com', 'commit', '--quiet', '--allow-empty', '-m', 'Synthetic identity fixture'], { cwd: scratch });
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

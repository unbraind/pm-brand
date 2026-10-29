/** Run the complete coverage suite with CI-style isolation and at most two test workers. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, devNull } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
const scratch = mkdtempSync(join(tmpdir(), 'brand-local-ci-'));
try {
  const childEnv: NodeJS.ProcessEnv = { PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`, HOME: scratch, CI: 'true',
    GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1', NPM_CONFIG_USERCONFIG: devNull, npm_config_userconfig: devNull,
    PM_AUTHOR: 'codex-agent', GOMAXPROCS: '2', TERM: 'dumb' };
  console.log(`Local CI suite: ${process.version}; fresh home; no global/system Git config; two workers`);
  const result = spawnSync(process.execPath, ['scripts/coverage.ts'], { env: childEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { rmSync(scratch, { recursive: true, force: true }); }

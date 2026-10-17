/** Run the production dependency audit independently of inherited npm lifecycle policy. */
import { spawnSync } from 'node:child_process';
import { packageManagerEnv } from './environment.ts';
const result = spawnSync('npm', ['audit', '--omit=dev', '--ignore-scripts'], { stdio: 'inherit', env: packageManagerEnv() });
process.exit(result.status ?? 1);

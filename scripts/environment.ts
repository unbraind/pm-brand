/** Clean inherited npm lifecycle flags before spawning another package manager. */
import { devNull } from 'node:os';
/** Keep credentials and host-level allow-scripts policy out of project-scoped install/audit commands. */
export function packageManagerEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, npm_config_userconfig: devNull, NPM_CONFIG_USERCONFIG: devNull };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'npm_config_allow_scripts') delete env[key];
  return env;
}

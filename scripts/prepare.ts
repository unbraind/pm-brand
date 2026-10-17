/** Build Git dependencies and install merge drivers without contaminating npm pack JSON. */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
// Some npm 10 releases still run prepare for pack --ignore-scripts. Keep all
// lifecycle output on stderr so pack's stdout remains a JSON document.
execFileSync('node_modules/.bin/tsc', [], { stdio: ['ignore', 2, 2] });
// npm prepares Git dependencies as source archives without Git metadata.
// Install clone-local drivers only in an actual package checkout/worktree.
if (existsSync('.git')) execFileSync(process.execPath, ['node_modules/@unbrained/pm-cli/dist/cli.js', 'merge', 'install'], { stdio: ['ignore', 2, 2] });

/** Install the packed artifact with npm and Bun, then exercise public exports in both runtimes. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { packageManagerEnv } from './environment.ts';
/** Isolated consumers receive only packed files and the optional renderer peer. */
const scratch = mkdtempSync(join(tmpdir(), 'pm-brand-consumer-'));
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json'], { encoding: 'utf8', env: packageManagerEnv() })) as { filename: string }[];
const tarball = resolve(pack.filename);
try {
  for (const installer of ['npm', 'bun']) {
    const root = join(scratch, installer);
    execFileSync('node', ['-e', 'require("fs").mkdirSync(process.argv[1],{recursive:true})', root]);
    writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    const args = installer === 'npm' ? ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', tarball, '@resvg/resvg-js@2.6.2'] : ['add', '--ignore-scripts', tarball, '@resvg/resvg-js@2.6.2'];
    execFileSync(installer, args, { cwd: root, stdio: 'pipe', env: packageManagerEnv() });
    writeFileSync(join(root, 'smoke.ts'), readFileSync('test/consumer-smoke.ts', 'utf8'));
    execFileSync(installer === 'npm' ? process.execPath : 'bun', ['smoke.ts'], { cwd: root, stdio: 'inherit' });
    console.log(`Packed ${installer} consumer: passed`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}

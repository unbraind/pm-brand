/** Inspect the npm dry-run artifact and reject unintended package contents. */
import { execFileSync } from 'node:child_process';
import { packageManagerEnv } from './environment.ts';
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8', env: packageManagerEnv() })) as { files: { path: string }[] }[];
for (const file of pack.files) {
  if (!/^(banners\/(pm-[a-z0-9-]+\.svg|packages\.json)|dist\/[^/]+\.(js|d\.ts)|fonts\/(.+\.woff2|OFL\.txt|SOURCES\.md)|logo\/.+\.svg|icons\/.+\.(svg|png)|tokens\.css|fonts\.css|docs\/(contrast|accessibility)\.md|examples\/accessibility\.json|CONTRACT\.md|README\.md|LICENSE|CHANGELOG\.md|package\.json)$/u.test(file.path)) throw new Error(`Unintended packed file: ${file.path}`);
  console.log(file.path);
}
console.log(`Verified ${pack.files.length} intended packed files`);

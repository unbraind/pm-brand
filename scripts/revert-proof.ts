/** Prove regressions detect one behaviour being removed, rebuilding dist for each mutation. */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
/** Single-behaviour neutralizations stand in for the seed's absent APIs. */
const cases = [
  { file: 'src/tokens.ts', from: 'return `var(--pm-${suffix})`;', to: 'return "";', test: 'test/tokens.test.ts', name: 'CSS variable naming' },
  { file: 'src/text.ts', from: "return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;').replaceAll(\"'\", '&apos;');", to: 'return value;', test: 'test/images.test.ts', name: 'XML escaping' },
  { file: 'src/text.ts', from: "const words = text.trim().split(/\\s+/u);", to: "return [text];\n  const words = text.trim().split(/\\s+/u);", test: 'test/images.test.ts', name: 'Measured wrapping' },
  { file: 'src/banner.ts', from: 'return imageSvg(1280, 320, theme,', to: 'return "";\n  return imageSvg(1280, 320, theme,', test: 'test/images.test.ts', name: 'README banner output' },
  { file: 'src/og.ts', from: 'return imageSvg(1200, 630, theme,', to: 'return "";\n  return imageSvg(1200, 630, theme,', test: 'test/images.test.ts', name: 'OG output' },
  { file: 'src/og.ts', from: 'return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();', to: 'return new Uint8Array();', test: 'test/images.test.ts', name: 'Native PNG rendering' },
  { file: 'src/contrast.ts', from: 'return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);', to: 'return 1;', test: 'test/contrast.test.ts', name: 'WCAG contrast' },
];
let caught = 0;
for (const probe of cases) {
  const original = readFileSync(probe.file, 'utf8');
  if (!original.includes(probe.from)) throw new Error(`Missing mutation anchor: ${probe.name}`);
  try {
    writeFileSync(probe.file, original.replace(probe.from, probe.to));
    execFileSync('node_modules/.bin/tsc', [], { stdio: 'pipe' });
    const result = spawnSync(process.execPath, ['--test', probe.test], { encoding: 'utf8' });
    if (result.status !== 1 || !result.stdout.includes('AssertionError')) throw new Error(`Not an assertion-level regression: ${probe.name}\n${result.stdout}\n${result.stderr}`);
    console.log(`Caught behavioural removal: ${probe.name}`);
    caught++;
  } finally {
    writeFileSync(probe.file, original);
    execFileSync('node_modules/.bin/tsc', [], { stdio: 'pipe' });
  }
}
const font = 'fonts/archivo-latin.woff2';
const original = readFileSync(font);
try {
  writeFileSync(font, Buffer.concat([original, Buffer.alloc(120_001)]));
  if (spawnSync(process.execPath, ['scripts/font-budget.ts']).status !== 1) throw new Error('Font budget did not reject overflow');
  console.log('Caught font byte-budget overflow');
} finally { writeFileSync(font, original); }
console.log(`${caught}/7 behavioural removals and 1/1 font overflow caught; sources restored`);
const css = readFileSync('tokens.css', 'utf8');
try {
  writeFileSync('tokens.css', css.replace('--pm-paper: #F3F5F8;', '--pm-paper: #000000;'));
  const result = spawnSync(process.execPath, ['--test', 'test/tokens.test.ts'], { encoding: 'utf8' });
  if (result.status !== 1 || !result.stdout.includes('AssertionError')) throw new Error('CSS drift was not detected');
  console.log('Caught independent CSS token drift');
} finally { writeFileSync('tokens.css', css); }
const geometry = readFileSync('scripts/marks.ts', 'utf8');
try {
  writeFileSync('scripts/marks.ts', geometry.replace("${sheetRect(sheetGeometry.back, rose, backMask)}", ''));
  execFileSync(process.execPath, ['scripts/marks.ts']);
  const result = spawnSync(process.execPath, ['--test', 'test/assets.test.ts'], { encoding: 'utf8' });
  if (result.status !== 1 || !result.stdout.includes('AssertionError')) throw new Error('Missing copy sheet was not detected');
  console.log('Caught removed back sheet in the shared mark generator');
} finally {
  writeFileSync('scripts/marks.ts', geometry);
  execFileSync(process.execPath, ['scripts/marks.ts']);
}
const mainGeometry = execFileSync('git', ['show', '952a4bc8a42228e747b69ab31b8468ca43d54d08:scripts/marks.ts'], { encoding: 'utf8' });
const currentGeometry = readFileSync('scripts/marks.ts', 'utf8');
const baselineMark = mainGeometry.slice(mainGeometry.indexOf('function mark('), mainGeometry.indexOf('/** A standalone'));
const currentMark = currentGeometry.slice(currentGeometry.indexOf('function mark('), currentGeometry.indexOf('/** A standalone'));
try {
  writeFileSync('scripts/marks.ts', currentGeometry.replace(currentMark, baselineMark));
  execFileSync(process.execPath, ['scripts/marks.ts']);
  const result = spawnSync(process.execPath, ['--test', 'test/assets.test.ts'], { encoding: 'utf8' });
  if (result.status !== 1 || !result.stdout.includes('AssertionError')) throw new Error('Milestone 1 monochrome regression was not detected');
  console.log('Caught the actual Milestone 1 mark function revert with the monochrome pixel regression');
} finally {
  writeFileSync('scripts/marks.ts', currentGeometry);
  execFileSync(process.execPath, ['scripts/marks.ts']);
}

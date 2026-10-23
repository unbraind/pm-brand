/** Optional local browser adapter: use an installed Playwright and Chromium without shipping them to consumers. */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
/** One viewport capture of a package-owned source page. */
export interface Capture {
  /** Local page URL. */
  readonly url: string;
  /** Destination PNG. */
  readonly output: string;
  /** CSS viewport width. */
  readonly width: number;
  /** CSS viewport height. */
  readonly height: number;
  /** Expected computed app colours, absent for fixed SVG images. */
  readonly colors?: Readonly<Record<string, string>>;
}
/** Only the browser methods this optional review tool needs. */
interface Browser {
  newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<{
    goto(url: string): Promise<unknown>;
    evaluate(expression: string): Promise<{ overflow: boolean; fonts: string; external: boolean; colors: Record<string, string>; loadedFaces: string[] }>;
    screenshot(options: { path: string; fullPage: boolean }): Promise<unknown>;
    close(): Promise<void>;
  }>;
  version(): string;
  close(): Promise<void>;
}
/** Capture loaded local fonts, reject horizontal overflow and third-party resources, and retain a portable receipt. */
export async function capturePages(captures: readonly Capture[]): Promise<void> {
  const require = createRequire(import.meta.url);
  const driver = require(process.env.PM_BRAND_PLAYWRIGHT_MODULE ?? 'playwright') as { chromium: { launch(options: { headless: boolean; executablePath?: string }): Promise<Browser> } };
  const browser = await driver.chromium.launch({ headless: true, executablePath: process.env.PM_BRAND_CHROMIUM });
  const measurements = [];
  try {
    for (const capture of captures) {
      const page = await browser.newPage({ viewport: { width: capture.width, height: capture.height }, deviceScaleFactor: 1 });
      try {
        await page.goto(capture.url);
        const measurement = await page.evaluate(`document.fonts.ready.then(() => ({overflow:document.documentElement.scrollWidth>innerWidth,fonts:document.fonts.status,loadedFaces:Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family),external:performance.getEntriesByType('resource').some(r=>/^https?:/.test(r.name)),colors:Object.fromEntries(${JSON.stringify(Object.keys(capture.colors ?? {}))}.map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--pm-'+k).trim().toUpperCase()]))}))`);
        if (measurement.overflow || measurement.fonts !== 'loaded' || measurement.external) throw new Error(`Invalid review capture: ${capture.output}`);
        if (capture.colors) {
          for (const [key, value] of Object.entries(capture.colors)) if (measurement.colors[key] !== value.toUpperCase()) throw new Error(`Wrong computed ${key} in ${capture.output}`);
          for (const family of ['Archivo', 'Public Sans', 'Martian Mono']) if (!measurement.loadedFaces.includes(family)) throw new Error(`Missing loaded ${family} in ${capture.output}`);
        }
        await page.screenshot({ path: capture.output, fullPage: true });
        measurements.push({ file: capture.output.split('/').at(-1), width: capture.width, ...measurement });
      } finally { await page.close(); }
    }
    writeFileSync('docs/palette-previews/browser-checks.json', JSON.stringify({ chromium: browser.version(), captures: measurements }, null, 2) + '\n');
  } finally { await browser.close(); }
}

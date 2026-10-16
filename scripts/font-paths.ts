/** Convert pinned font instances to reusable SVG glyph geometry with fontTools. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
/** Instances used by the mark, captions and the deterministic image generators. */
const instances = {
  mark: { file: 'archivo', axes: { wdth: 125, wght: 900 } },
  display: { file: 'archivo', axes: { wdth: 125, wght: 800 } },
  caption: { file: 'archivo', axes: { wdth: 75, wght: 600 } },
  body: { file: 'publicsans', axes: { wght: 400 } },
};
/** Serialize glyph outlines with their original advances; all coordinates stay in font units. */
const data: Record<string, unknown> = {};
for (const [role, instance] of Object.entries(instances)) {
  const output = execFileSync('python3', ['-c', `
import json,sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
f=instantiateVariableFont(TTFont(sys.argv[1]), json.loads(sys.argv[2]), inplace=True)
g=f.getGlyphSet(); cmap=f.getBestCmap(); glyphs={}
for code,name in cmap.items():
 p=SVGPathPen(g); g[name].draw(p)
 glyphs[chr(code)]={'d':p.getCommands(),'advance':g[name].width}
print(json.dumps({'em':f['head'].unitsPerEm,'glyphs':glyphs},separators=(',',':')))
`, `.cache/fonts/${instance.file}.ttf`, JSON.stringify(instance.axes)], { encoding: 'utf8', maxBuffer: 10_000_000 });
  data[role] = JSON.parse(output);
}
mkdirSync('.cache', { recursive: true });
mkdirSync('src', { recursive: true });
writeFileSync('.cache/paths.json', JSON.stringify(data));
// Only the Latin subset is distributed in fonts; the glyph atlas is restricted
// to that same repertoire instead of including the full upstream font.
const subset = execFileSync('python3', ['-c', `
import json,sys
from fontTools.ttLib import TTFont
print(json.dumps([chr(c) for c in TTFont('fonts/archivo-latin.woff2').getBestCmap()]))
`], { encoding: 'utf8' });
const allowed = new Set(JSON.parse(subset) as string[]);
for (const value of Object.values(data) as { glyphs: Record<string, unknown> }[]) {
  for (const char of Object.keys(value.glyphs)) if (!allowed.has(char)) delete value.glyphs[char];
}
writeFileSync('src/font-data.ts', `/** Generated OFL glyph outlines from scripts/font-paths.ts; see fonts/OFL.txt. */\nexport const fontData = ${JSON.stringify(data)} as const;\n`);

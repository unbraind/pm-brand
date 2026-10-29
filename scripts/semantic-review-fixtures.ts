/** Shared adversarial cases for SDK, CLI, packed and Git consumers. */
import type { SemanticAssetRequest } from '../src/semantic-assets.js';
import type { AccessibilityRequest } from '../src/accessibility.js';

/** One independent review oracle, also serialized into isolated packed consumers. */
export interface SemanticReviewCase {
  /** Stable case identity. */
  readonly name: string;
  /** The same request reaches every public entry point. */
  readonly request: SemanticAssetRequest;
  /** Required finding or typed refusal; unchanged is the positive control. */
  readonly expected: 'parent' | 'paint_order' | 'aria-title-order' | 'aria-desc-order' | 'aria-labelledby' | 'aria-describedby' | 'unsupported_svg' | 'unchanged';
}

/** Generate both topology and lexical-domain cases without depending on the parser. */
export function semanticReviewCases(): SemanticReviewCase[] {
  const cases: SemanticReviewCase[] = [];
  const units = ['<rect id="target" width="10" height="10"/>', '<circle id="target" r="5"/>', '<ellipse id="target" rx="4" ry="5"/>',
    '<line id="target" x2="10" y2="10"/>', '<polyline id="target" points="0 0 10 10"/>', '<polygon id="target" points="0 0 10 0 0 10"/>',
    '<path id="target" d="M0 0L10 10"/>', '<text id="target">Ready</text>', '<title id="target">Label</title>', '<desc id="target">Description</desc>',
    '<g id="target"><rect id="nested" width="10" height="10"/></g>', '<g id="target" data-text="A"><path d="M0 0L10 10"/></g>'];
  for (const [index, unit] of units.entries()) cases.push({ name: `reparent-${index}`, expected: 'parent', request: { version: 1,
    before: `<svg><g id="plain">${unit}</g><g id="shift" transform="translate(100 20)" fill="#f00" aria-label="Shifted"/></svg>`,
    after: `<svg><g id="plain"/><g id="shift" transform="translate(100 20)" fill="#f00" aria-label="Shifted">${unit}</g></svg>` } });
  for (const change of ['insert', 'remove']) cases.push({ name: `order-and-${change}`, expected: 'paint_order', request: { version: 1,
    before: `<svg><rect id="a"/>${change === 'remove' ? '<rect id="c"/>' : ''}<rect id="b"/></svg>`,
    after: `<svg><rect id="b"/>${change === 'insert' ? '<rect id="c"/>' : ''}<rect id="a"/></svg>` } });
  const valid = '<svg><path d="M0 0 A20 20 0 0 1 40 40"/></svg>';
  for (const command of ['A', 'a']) for (const flag of [3, 4]) for (const lexeme of ['0.0', '1.0', '+0', '+1', '-0', '00', '01', '0e0', '1e0', '.0', '0e-999']) {
    const args = ['20', '20', '0', '0', '1', '40', '40']; args[flag] = lexeme;
    cases.push({ name: `arc-${command}-${flag}-${lexeme}`, expected: 'unsupported_svg', request: { version: 1, before: valid,
      after: `<svg><path d="M0 0 ${command}${args.join(' ')}"/></svg>` } });
  }
  for (const [name, after] of [
    ['implicit-arc', '<svg><path d="M0 0 A20 20 0 0 1 40 40 20 20 0 0.0 1 80 80"/></svg>'],
    ['signed-arc-radius', '<svg><path d="M0 0 A+20 20 0 0 1 40 40"/></svg>'],
    ['signed-zero-arc-radius', '<svg><path d="M0 0 A20 -0 0 0 1 40 40"/></svg>'],
    ['outline-arc', '<svg><g data-text="A"><path d="M0 0 A20 20 0 0.0 1 40 40"/></g></svg>'],
    ['unicode-path-space', '<svg><path d="M0 0\u00a0L1 1"/></svg>'], ['unicode-list-space', '<svg viewBox="0\u00a00 10 10"/>'],
    ['unicode-transform-space', '<svg transform="translate(1\u00a02)"/>'], ['missing-transform-separator', '<svg transform="translate(1-2)"/>'],
    ['missing-point-separator', '<svg><polyline points="0-1 2-3"/></svg>'], ['unicode-xml-space', '<svg\u00a0role="img"/>'],
    ['unicode-close-space', '<svg></svg\u00a0>'], ['unicode-attribute-equals', '<svg x\u00a0="1"/>'],
    ['whitespace-id', '<svg><rect id=" target "/></svg>'], ['unicode-id', '<svg><rect id="\u00a0target\u00a0"/></svg>'],
  ]) cases.push({ name, expected: 'unsupported_svg', request: { version: 1, before: valid, after } });
  cases.push({ name: 'valid-arc-aliases', expected: 'unchanged', request: { version: 1, before: valid,
    after: '<svg><path d="M0.0 0e0 A20.0 2e1 +0 0 1 4e1 40.0"/></svg>' } });
  for (const tag of ['title', 'desc'] as const) for (const container of ['svg', 'group', 'outline']) {
    /** Place identical metadata in each supported container projection. */
    const wrap = (body: string): string => container === 'svg' ? `<svg id="container" role="img">${body}<rect/></svg>`
      : container === 'group' ? `<svg><g id="container" role="img">${body}<rect/></g></svg>`
      : `<svg><g id="container" role="img" data-text="A">${body}<path d="M0 0L1 1"/></g></svg>`;
    const a = `<${tag} id="alpha">Alpha</${tag}>`, b = `<${tag} id="beta">Beta</${tag}>`, c = `<${tag} id="gamma">Gamma</${tag}>`;
    for (const change of ['swap', 'insert', 'remove']) cases.push({ name: `metadata-${tag}-${container}-${change}`, expected: `aria-${tag}-order`,
      request: { version: 1, before: wrap(a + (change === 'remove' ? c : '') + b), after: wrap(b + (change === 'insert' ? c : '') + a) } });
  }
  cases.push({ name: 'metadata-cross-kind-control', expected: 'unchanged', request: { version: 1,
    before: '<svg><title id="t">Name</title><desc id="d">Details</desc><rect/></svg>',
    after: '<svg><desc id="d">Details</desc><title id="t">Name</title><rect/></svg>' } });
  for (const field of ['aria-labelledby', 'aria-describedby'] as const) cases.push({ name: `reference-order-${field}`, expected: field,
    request: { version: 1, before: `<svg ${field}="alpha beta"><title id="alpha">Alpha</title><desc id="beta">Beta</desc></svg>`,
      after: `<svg ${field}="beta alpha"><title id="alpha">Alpha</title><desc id="beta">Beta</desc></svg>` } });
  return cases;
}

/** Keep packed acceptance bounded while carrying both classes through every install mode. */
export function packedSemanticReviewCases(): SemanticReviewCase[] {
  const names = new Set(['reparent-0', 'reparent-11', 'order-and-insert', 'arc-A-3-0.0', 'missing-transform-separator', 'valid-arc-aliases',
    'metadata-title-svg-swap', 'metadata-desc-outline-insert', 'metadata-cross-kind-control']);
  const rows = semanticReviewCases().filter(row => names.has(row.name));
  if (rows.length !== names.size) throw new Error('Missing or duplicate packed review case');
  return rows;
}

/** Carry the shared CSS lexical rule into consumer-composition diagnostics. */
export function renderedColorReviewRequest(color = 'rgba(0,\u00a00,0,1)'): AccessibilityRequest {
  return { version: 1, pairs: [{ locator: '#label', theme: 'light', rule: 'text',
    foreground: { token: 'carbon', color }, background: { token: 'sheet', color: '#FFFFFF' } }] };
}

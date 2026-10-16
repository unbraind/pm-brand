/** CSS remains an independent source for detecting typed-token drift. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tokens, cssVar } from '../dist/index.js';
import type { TokenName } from '../dist/index.js';

test('every CSS token agrees in light, automatic dark and explicit dark themes', () => {
  const css = readFileSync('tokens.css', 'utf8');
  const blocks = [...css.matchAll(/\{([^{}]*)\}/g)].map(match => Object.fromEntries([...match[1].matchAll(/--pm-([\w-]+):\s*([^;]+);/g)].map(token => [token[1], token[2]])));
  assert.deepEqual(tokens.light, blocks[0]);
  assert.deepEqual(tokens.dark, { ...blocks[0], ...blocks[1] });
  assert.deepEqual(tokens.dark, { ...blocks[0], ...blocks[2] });
  assert.match(css, /:root:not\(\[data-theme="light"\]\)/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.equal(blocks[3].dur, '0s');
});

test('cssVar accepts every suffix and prefixed token, rejecting unknown names', () => {
  for (const name of Object.keys(tokens.light) as TokenName[]) {
    assert.equal(cssVar(name), `var(--pm-${name})`);
    assert.equal(cssVar(`--pm-${name}`), `var(--pm-${name})`);
  }
  assert.throws(() => cssVar('missing' as TokenName), /Unknown pm token/);
});

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { micromark } from 'micromark';
import { math, mathHtml } from 'micromark-extension-math';
import postcss from 'postcss';
import postcssNested from 'postcss-nested';

test('patched CSS nesting preserves selector expansion, media rules and comments', async () => {
  const result = await postcss([postcssNested()]).process(
    `
    .card, .panel {
      color: black;
      &:hover { color: blue; }
      > .label { font-weight: 700; }
      @media (min-width: 40rem) { & .label { color: green; } }
      /* preserved */
      &::before { content: ""; }
    }
  `,
    { from: undefined },
  );
  const selectors = [];
  result.root.walkRules((rule) => {
    assert.notEqual(rule.parent.type, 'rule');
    selectors.push(rule.selectors.map((selector) => selector.trim()).sort());
  });
  assert.deepEqual(selectors, [
    ['.card', '.panel'],
    ['.card:hover', '.panel:hover'],
    ['.card > .label', '.panel > .label'],
    ['.card .label', '.panel .label'],
    ['.card::before', '.panel::before'],
  ]);
  const media = result.root.nodes.find(
    (node) => node.type === 'atrule' && node.name === 'media',
  );
  assert.equal(media.params, '(min-width: 40rem)');
  assert.equal(media.nodes[0].nodes[0].value, 'green');
  const comments = [];
  result.root.walkComments((comment) => comments.push(comment.text));
  assert.ok(comments.includes('preserved'));
  assert.deepEqual(result.warnings(), []);
});

test('patched math renderer works through the actual micromark extension API', () => {
  const html = micromark(
    'Euler: $e^{i\\pi}+1=0$.\n\n$$\na^2 + b^2 = c^2\n$$\n',
    {
      extensions: [math()],
      htmlExtensions: [mathHtml({ trust: false })],
    },
  );
  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /<math\b/);
});

test('math rendering rejects unsafe URLs when trust is disabled', () => {
  const html = micromark(String.raw`$\href{javascript:alert(1)}{unsafe}$`, {
    extensions: [math()],
    htmlExtensions: [mathHtml({ trust: false, strict: 'ignore' })],
  });
  assert.doesNotMatch(html, /(?:href|src)=["']javascript:/i);
  assert.doesNotMatch(html, /<a\b/);
});

test('KaTeX does not inherit a polluted trust setting from an options prototype', () => {
  const options = Object.assign(Object.create({ trust: true }), {
    throwOnError: false,
    strict: 'ignore',
  });
  const html = katex.renderToString(
    String.raw`\href{javascript:alert(1)}{unsafe}`,
    options,
  );
  assert.doesNotMatch(html, /(?:href|src)=["']javascript:/i);
  assert.doesNotMatch(html, /<a\b/);
});

test('KaTeX still accepts an explicitly owned trust setting for safe links', () => {
  const html = katex.renderToString(
    String.raw`\href{https://example.com}{safe}`,
    { trust: true },
  );
  assert.match(html, /href="https:\/\/example\.com"/);
});

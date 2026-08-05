import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welcomePage, loginPage, appPage, messagePage } from '../src/page.js';

// The panel's pages embed big inline <script> blocks. A typo in one (e.g. an
// unescaped apostrophe that breaks a single-quoted string) fails the WHOLE page
// at parse time — every button handler on that page dies. Render each page and
// parse every inline script so this class of regression fails the suite.
function parseInlineScripts(page) {
  const blocks = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(page))) blocks.push(m[1]);
  for (const [i, code] of blocks.entries()) {
    // eslint-disable-next-line no-new-func
    new Function(code); // throws SyntaxError on bad output
    assert.ok(true, `inline script block ${i} parses`);
  }
  return blocks.length;
}

test('welcomePage inline scripts parse', () => {
  const n = parseInlineScripts(welcomePage({ email: 'a@b.co' }));
  assert.ok(n >= 0);
});

test('loginPage inline scripts parse (with and without sitekey)', () => {
  assert.ok(parseInlineScripts(loginPage({}, { turnstileSitekey: '0x4AAAAAAA-test' })) >= 1);
  assert.ok(parseInlineScripts(loginPage({})) >= 1);
});

test('appPage inline scripts parse (with sites, with and without sitekey)', () => {
  const sites = [
    { origin: 'https://my-blog.pages.dev', repo: 'me/my-blog', created_at: '2026-08-01' },
    { origin: 'https://x.kantan-hp.fyi', repo: 'me/x', created_at: '2026-08-02' },
  ];
  assert.ok(parseInlineScripts(appPage({ email: 'a@b.co', sites, hasSites: true }, { turnstileSitekey: '0x4AAAAAAA-test' })) >= 1);
  assert.ok(parseInlineScripts(appPage({ email: 'a@b.co', sites, hasSites: true })) >= 1);
  assert.ok(parseInlineScripts(appPage({ email: 'a@b.co', sites: [], hasSites: false })) >= 1);
});

test('messagePage inline scripts parse', () => {
  assert.ok(parseInlineScripts(messagePage('Title', 'Body')) >= 0);
});

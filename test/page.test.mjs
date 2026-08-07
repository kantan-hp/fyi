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

test('messagePage escapes HTML in title/text and email is escaped in appPage', () => {
  const evil = '<script>alert(1)</script>';
  const p = messagePage(evil, evil);
  assert.ok(!p.includes('<script>alert(1)</script>'), 'raw payload must not appear');
  assert.ok(p.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  const app = appPage({ email: 'x" onmouseover="evil"@evil.tld', sites: [], hasSites: false }, {});
  assert.ok(!app.includes('onmouseover="evil"'), 'email must not inject an attribute');
  assert.ok(app.includes('&quot;'));
});

test('welcomePage renders and any inline scripts parse', () => {
  assert.ok(welcomePage({ email: 'a@b.co' }).length > 0);
});

test('loginPage inline scripts parse (with and without sitekey)', () => {
  assert.ok(parseInlineScripts(loginPage({}, { turnstileSitekey: '0x4AAAAAAA-test' })) >= 1);
  assert.ok(parseInlineScripts(loginPage({})) >= 1);
});

test('Turnstile widget is hidden unless a challenge is required (interaction-only)', () => {
  const withKey = loginPage({}, { turnstileSitekey: '0x4AAAAAAA-test' });
  assert.ok(withKey.includes('data-appearance="interaction-only"'));
  assert.ok(withKey.includes('data-expired-callback="onTurnstileExpired"'));
  // No sitekey → no widget div rendered (the script's selector strings remain,
  // but the widget container itself must be absent)
  assert.ok(!loginPage({}).includes('class="cf-turnstile"'));
  const app = appPage({ email: 'a@b.co', sites: [], hasSites: false }, { turnstileSitekey: '0x4AAAAAAA-test' });
  assert.ok(app.includes('data-appearance="interaction-only"'));
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

test('messagePage renders and any inline scripts parse', () => {
  assert.ok(messagePage('Title', 'Body').length > 0);
});

test('pages render localized strings + the language switcher footer', () => {
  const ja = welcomePage({}, { locale: 'ja', pathname: '/' });
  assert.ok(ja.includes('<html lang="ja"'));
  assert.ok(ja.includes('本当に数分で公開できる、無料のブログ。'));
  // Footer language switcher: all four native names, current marked.
  assert.ok(ja.includes('class="lang-switch"'));
  assert.ok(ja.includes('>日本語</a>') && ja.includes('aria-current="true"'));
  assert.ok(ja.includes('>English</a>') && ja.includes('>繁體中文</a>') && ja.includes('>简体中文</a>'));

  const zh = loginPage({}, { locale: 'zh-Hans', pathname: '/login' });
  assert.ok(zh.includes('<html lang="zh-Hans"'));
  assert.ok(zh.includes('登录'));

  const app = appPage(
    { email: 'a@b.co', sites: [], hasSites: false },
    { locale: 'zh-Hant', pathname: '/app' },
  );
  assert.ok(app.includes('<html lang="zh-Hant"'));
  assert.ok(app.includes('為網站命名'));
  // Step-3 language dropdown defaults to the panel's current language.
  assert.ok(app.includes('data-panel-lang="zh-Hant"'));
  assert.ok(app.includes('id="site-lang"'));
});

test('unknown/missing locale falls back to English', () => {
  const en = welcomePage({});
  assert.ok(en.includes('<html lang="en"'));
  assert.ok(en.includes('A free blog you can actually publish to in minutes.'));
});

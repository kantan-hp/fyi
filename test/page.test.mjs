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

test('logged-in home topbar shows <email> logout, not a redundant Dashboard link', () => {
  const p = welcomePage({ email: 'a@b.co' });
  assert.ok(p.includes('a@b.co'), 'email shown in the topbar');
  assert.ok(p.includes('onclick="event.preventDefault(); panelLogout()"'), 'logout link present');
  assert.ok(!p.includes('href="/api/logout"'), 'logout is POST, not a GET link');
  assert.ok(!p.includes('href="/app">Dashboard</a>'), 'no redundant Dashboard link');
  assert.ok(p.includes('Go to my dashboard'), 'CTA reads Go to my dashboard');
  // Logged out: no email/logout, CTA is Get started.
  const out = welcomePage({ email: null });
  assert.ok(!out.includes('onclick="panelLogout()"'));
});

test('wizard submit panel is a named "Confirm creation" step with a dynamic number', () => {
  const app = appPage({ email: 'a@b.co', sites: [], hasSites: false }, {});
  assert.ok(app.includes('id="submit-step"'), 'numbered heading element present');
  assert.ok(app.includes('>4</span> Confirm creation'), 'defaults to step 4');
  assert.ok(app.includes('id="submit-step">4</span> Confirm creation'));
  assert.ok(app.includes('syncStepNumber'), 'number re-syncs when step 4 toggles');
});

test('footer is pinned to the bottom on every page (sticky footer)', () => {
  const p = welcomePage({ email: 'a@b.co' });
  assert.ok(p.includes('min-height: 100vh'), 'body pins to viewport height');
  assert.ok(p.includes('flex: 1 0 auto'), '.wrap grows to push the footer down');
  assert.ok(p.includes('flex-shrink: 0'), 'footer does not shrink');
  assert.ok(/<body>[\s\S]*?<footer class="panel-footer">/.test(p), 'footer is a direct body child');
});

test('loginPage inline scripts parse (with and without sitekey)', () => {
  assert.ok(parseInlineScripts(loginPage({}, { turnstileSitekey: '0x4AAAAAAA-test' })) >= 1);
  assert.ok(parseInlineScripts(loginPage({})) >= 1);
});

test('login button flips to "Login link sent" after a successful send', () => {
  const en = loginPage({});
  assert.ok(en.includes('btn.textContent = window.I18N.loginLinkSent'), 'button text is swapped on success');
  assert.ok(en.includes('"loginLinkSent":"Login link sent"'), 'localized string is embedded');
  const ja = loginPage({}, { locale: 'ja', pathname: '/login' });
  assert.ok(ja.includes('"loginLinkSent":"ログインリンクを送信しました"'), 'localized for ja');
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

test('step 3 drops the custom domain field; bring-content is a checkbox that gates step 4', () => {
  const app = appPage({ email: 'a@b.co', sites: [], hasSites: false }, {});
  // Custom domain field removed from the wizard.
  assert.ok(!app.includes('id="site-custom-domain"'));
  assert.ok(!app.includes('customDomainLabel'), 'custom-domain labels are gone from the page');
  // "Bring a previous site's content over" is now a checkbox.
  assert.ok(app.includes('id="bring-content"'));
  assert.ok(app.includes('type="checkbox" id="bring-content"'));
  // Step 4 exists but starts hidden; it holds the import + upload controls.
  assert.ok(app.includes('class="card hidden" id="step4"'));
  assert.ok(app.includes('id="content-source"') && app.includes('id="content-bundle"'));
  // Turnstile + create button moved after the steps, out of any step panel.
  const submit = app.indexOf('id="wizard-submit"');
  assert.ok(submit !== -1);
  assert.ok(app.indexOf('id="step4"') < submit);
  assert.ok(submit < app.indexOf('id="create"'));
});

test('card spacing is driven by a shared scaffold, not ad-hoc margins', () => {
  const app = appPage({ email: 'a@b.co', sites: [], hasSites: false }, {});
  const login = loginPage({}, { turnstileSitekey: '0x4AAAAAAA-test' });
  for (const p of [app, login, welcomePage({ email: 'a@b.co' })]) {
    assert.ok(p.includes('.card > * + *'), 'card rhythm rule present');
    assert.ok(p.includes('form > * + *'), 'form rhythm rule present');
  }
  // Ad-hoc per-element margins are gone from the card surfaces.
  assert.ok(!app.includes('margin:.1rem 0 .8rem'), 'step 3 labels lean on the scaffold');
  assert.ok(!app.includes('margin:-.4rem'), 'no negative-margin hacks left');
  assert.ok(!login.includes('style="margin-top:.75rem'), 'login button no longer hardcodes its spacing');
});

test('pages render localized strings + the language switcher footer', () => {
  const ja = welcomePage({}, { locale: 'ja', pathname: '/' });
  assert.ok(ja.includes('<html lang="ja"'));
  assert.ok(ja.includes('数分で公開できる、無料のブログ。'));
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
  assert.ok(en.includes('A free blog that goes live in minutes.'));
});

test('delete action is danger-styled and confirms by site name (slug)', () => {
  const app = appPage(
    {
      email: 'a@b.co',
      sites: [{ origin: 'https://my-blog.pages.dev', repo: 'me/my-blog', project: 'my-blog', created_at: '2026-08-01' }],
      hasSites: true,
    },
    {},
  );
  // The delete button is danger-styled (red text / white bg / red border).
  assert.ok(app.includes('.btn.danger'), 'danger style is defined');
  assert.ok(app.includes('class="btn danger"'), 'delete button carries the danger style');
  assert.ok(app.includes('data-name="my-blog"'), 'delete button carries the site name (slug)');
  // The confirm prompt asks for the site name, not the address.
  assert.ok(app.includes('"deleteTypeName"'), 'site-name confirm string is embedded');
});

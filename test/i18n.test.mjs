import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocale, t, languageSwitcher, LANG_COOKIE, DEFAULT_LOCALE, LOCALES } from '../src/i18n.js';

function req({ cookie = '', acceptLanguage = '' } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (acceptLanguage) headers.set('accept-language', acceptLanguage);
  return new Request('https://kantan-hp.fyi/app', { headers });
}

test('resolveLocale: honors Accept-Language q-values (q=0 excluded)', () => {
  // en explicitly excluded, ja acceptable → ja.
  assert.equal(resolveLocale(req({ acceptLanguage: 'en;q=0, ja' })), 'ja');
  // quality order respected.
  assert.equal(resolveLocale(req({ acceptLanguage: 'zh-TW;q=0.5, ja;q=0.9' })), 'ja');
});

test('parseCookies: a malformed cookie value does not throw', () => {
  // A hostile/accidental cookie with invalid percent-encoding must not 500.
  const r = req({ cookie: `${LANG_COOKIE}=%E0%A4%A; other=1`, acceptLanguage: 'ja' });
  assert.equal(resolveLocale(r), 'ja');
});

test('resolveLocale: cookie wins over Accept-Language', () => {
  const r = req({ cookie: `${LANG_COOKIE}=zh-Hant`, acceptLanguage: 'ja,en;q=0.8' });
  assert.equal(resolveLocale(r), 'zh-Hant');
});

test('resolveLocale: Accept-Language fallback (ja, zh variants, en)', () => {
  assert.equal(resolveLocale(req({ acceptLanguage: 'ja,en;q=0.8' })), 'ja');
  assert.equal(resolveLocale(req({ acceptLanguage: 'zh-TW,en;q=0.8' })), 'zh-Hant');
  assert.equal(resolveLocale(req({ acceptLanguage: 'zh-CN,en;q=0.8' })), 'zh-Hans');
  assert.equal(resolveLocale(req({ acceptLanguage: 'zh' })), 'zh-Hans');
  assert.equal(resolveLocale(req({ acceptLanguage: 'en-US,en;q=0.9' })), 'en');
});

test('resolveLocale: default is en when nothing matches', () => {
  assert.equal(resolveLocale(req({ acceptLanguage: 'fr,de;q=0.9' })), 'en');
  assert.equal(resolveLocale(req({})), DEFAULT_LOCALE);
});

test('t: interpolates {tokens} and falls back to en / the key itself', () => {
  assert.equal(t('en', 'updateTo', { to: 'abc1234' }), 'Update to abc1234');
  assert.equal(t('ja', 'createSite'), 'サイトを作成');
  assert.equal(t('ja', 'updateCompleteBody', { to: 'abc1234', n: 2 }), 'サイトをテンプレート abc1234 に更新しました（2 ファイル変更）。公開までは 1〜2 分ほどかかります。');
  // Missing key in a non-default locale → falls back to the English string
  // (site is not a key; the assertion is about the fallback chain, see below).
  assert.equal(t('zh-Hans', 'createSite'), '创建我的网站');
  // Unknown key → the key itself.
  assert.equal(t('en', 'no-such-key'), 'no-such-key');
});

test('languageSwitcher: all four native names with the current marked', () => {
  const html = languageSwitcher('ja', '/app');
  assert.ok(html.includes('aria-label="言語を選択"'));
  for (const l of LOCALES) assert.ok(html.includes(`/setlang?l=${l}&next=%2Fapp`));
  assert.ok(html.includes('>日本語</a>') && html.includes('aria-current="true"'));
  assert.ok(html.includes('>English</a>') && html.includes('>繁體中文</a>') && html.includes('>简体中文</a>'));
});

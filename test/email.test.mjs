import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMagicEmail } from '../src/index.js';
import { LOCALES } from '../src/i18n.js';

const LINK = 'https://kantan-hp.fyi/login/callback?code=deadbeef';
const LOGO = 'https://kantan-hp.fyi/logo.png';

test('buildMagicEmail: all four locales have their own subject and title', () => {
  const subjects = new Set(LOCALES.map((l) => buildMagicEmail(l, LINK, LOGO).subject));
  assert.equal(subjects.size, 4, 'each locale resolves a distinct subject');
  const zh = buildMagicEmail('zh-Hans', LINK, LOGO);
  assert.equal(zh.subject, 'kantan 登录链接');
  assert.ok(zh.html.includes('登录 kantan'));
});

test('buildMagicEmail: HTML carries the logo URL, the link, and design tokens', () => {
  const { html, text } = buildMagicEmail('en', LINK, LOGO);
  assert.ok(html.includes(`<img src="${LOGO}"`), 'logo is referenced by URL');
  assert.ok(html.includes(`href="${LINK}"`), 'the magic link is the CTA');
  assert.ok(html.includes('background:#faf9f7'), 'panel off-white background');
  assert.ok(html.includes('background:#1a1a1a'), 'pill CTA uses the panel black');
  assert.ok(html.includes('border-radius:999px'), 'pill button radius');
  assert.ok(html.includes('<html lang="en"'), 'html carries the locale');
  assert.ok(text.includes(LINK), 'plain-text fallback includes the link');
  assert.ok(text.includes('expires in 15 minutes'), 'plain-text fallback notes expiry');
});

test('buildMagicEmail: unknown locale falls back to English', () => {
  assert.equal(buildMagicEmail('fr', LINK, LOGO).subject, 'Your kantan login link');
});

test('/logo.png serves the brand mark as a cacheable PNG', async () => {
  const mod = await import('../src/index.js');
  const res = await mod.default.fetch(new Request('https://kantan-hp.fyi/logo.png'), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.ok(bytes.length > 0, 'returns PNG bytes');
  // PNG magic number.
  assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugifySiteName,
  signPayload,
  verifyPayload,
  parseCookies,
  isAllowedSiteOrigin,
  canonicalOrigin,
  isReservedSlug,
  isBrandSlug,
  slugLengthOk,
  b64encode,
  b64decode,
  normalizeEmail,
  canonicalizeEmail,
  isValidEmail,
  normalizeCustomDomain,
  randomHex,
  transferPathsFromTree,
  buildZip,
  parseZip,
  applyLangToConfig,
} from '../src/lib.js';

test('slugifySiteName accepts simple names', () => {
  assert.equal(slugifySiteName('my-blog'), 'my-blog');
  assert.equal(slugifySiteName('blog'), 'blog');
  assert.equal(slugifySiteName('a1'), 'a1');
});

test('slugifySiteName normalizes messy input', () => {
  assert.equal(slugifySiteName('  My Blog! '), 'my-blog');
  assert.equal(slugifySiteName('Café 2026'), 'caf-2026');
  assert.equal(slugifySiteName('--weird--name--'), 'weird-name');
});

test('slugifySiteName rejects unusable names', () => {
  assert.equal(slugifySiteName(''), null);
  assert.equal(slugifySiteName('---'), null);
  assert.equal(slugifySiteName('!!!'), null);
});

test('sign/verify roundtrip', async () => {
  const token = await signPayload('secret', { flow: 'panel', nonce: 'abc' });
  const data = await verifyPayload('secret', token);
  assert.deepEqual(data, { flow: 'panel', nonce: 'abc' });
});

test('verify rejects tampering and wrong secrets', async () => {
  const token = await signPayload('secret', { a: 1 });
  assert.equal(await verifyPayload('other-secret', token), null);
  const i = token.lastIndexOf('.');
  const tampered = token.slice(0, i) + 'x.' + token.slice(i + 1);
  assert.equal(await verifyPayload('secret', tampered), null);
  assert.equal(await verifyPayload('secret', 'garbage'), null);
});

test('parseCookies', () => {
  assert.deepEqual(parseCookies('a=1; b=two three'), { a: '1', b: 'two three' });
  assert.deepEqual(parseCookies(''), {});
});

test('isAllowedSiteOrigin', () => {
  assert.equal(isAllowedSiteOrigin('https://my-blog.pages.dev'), true);
  assert.equal(isAllowedSiteOrigin('http://my-blog.pages.dev'), false);
  assert.equal(isAllowedSiteOrigin('https://evil.com'), false);
  assert.equal(isAllowedSiteOrigin('not a url'), false);
});

test('isAllowedSiteOrigin accepts branded kantan-hp.fyi origins', () => {
  assert.equal(isAllowedSiteOrigin('https://my-blog.kantan-hp.fyi'), true);
  assert.equal(isAllowedSiteOrigin('http://my-blog.kantan-hp.fyi'), false);
  assert.equal(isAllowedSiteOrigin('https://my-blog.evil-kantan-hp.fyi'), false);
  assert.equal(isAllowedSiteOrigin('https://kantan-hp.fyi.evil.com'), false);
  assert.equal(isAllowedSiteOrigin('https://evil.com'), false);
});

test('isReservedSlug', () => {
  assert.equal(isReservedSlug('kantan-login'), true);
  assert.equal(isReservedSlug('my-kantan-blog'), true);
  assert.equal(isReservedSlug('pay-kantan'), true);
  assert.equal(isReservedSlug('alice'), false);
  assert.equal(isReservedSlug('my-blog'), false);
  assert.equal(isReservedSlug('app'), true);
  assert.equal(isReservedSlug('KANTAN-API'), true);
});

test('isBrandSlug applies the kantan brand guard on any namespace', () => {
  assert.equal(isBrandSlug('kantan-login'), true);
  assert.equal(isBrandSlug('my-kantan-blog'), true);
  assert.equal(isBrandSlug('pay-kantan'), true);
  assert.equal(isBrandSlug('kanntan'), true);
  assert.equal(isBrandSlug('KANTA-HP'), true);
  assert.equal(isBrandSlug('alice'), false);
  assert.equal(isBrandSlug('app'), false);
  assert.equal(isBrandSlug('google'), false);
});

test('slugLengthOk', () => {
  assert.equal(slugLengthOk('ab'), false);
  assert.equal(slugLengthOk('abc'), false);
  assert.equal(slugLengthOk('abcd'), true);
  assert.equal(slugLengthOk('a'.repeat(32)), true);
  assert.equal(slugLengthOk('a'.repeat(33)), false);
});

test('canonicalOrigin', () => {
  assert.equal(canonicalOrigin('my-blog'), 'https://my-blog.kantan-hp.fyi');
});

test('b64 roundtrip with unicode', () => {
  assert.equal(b64decode(b64encode('hello かんたん')), 'hello かんたん');
});

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  User@Example.COM  '), 'user@example.com');
  assert.equal(normalizeEmail(''), '');
});

test('canonicalizeEmail collapses Gmail dot/+tag aliases', () => {
  assert.equal(canonicalizeEmail('V.IC.T+tag@gmail.com'), 'vict@gmail.com');
  assert.equal(canonicalizeEmail('foo.bar@googlemail.com'), 'foobar@gmail.com');
  assert.equal(canonicalizeEmail('foo+tag@googlemail.com'), 'foo@gmail.com');
});

test('canonicalizeEmail leaves non-Gmail and plain addresses unchanged', () => {
  assert.equal(canonicalizeEmail('foo+tag@example.com'), 'foo+tag@example.com');
  assert.equal(canonicalizeEmail('  User@Example.COM  '), 'user@example.com');
});

test('isValidEmail', () => {
  assert.equal(isValidEmail('a@b.co'), true);
  assert.equal(isValidEmail('user+tag@example.com'), true);
  assert.equal(isValidEmail('nope'), false);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('x"><img src=x onerror=alert(1)>@evil.tld'), false);
  assert.equal(isValidEmail("o'connor@example.com"), false);
  assert.equal(isValidEmail('has space@example.com'), false);
});

test('randomHex produces hex of the requested length', () => {
  const a = randomHex(16);
  const b = randomHex(16);
  assert.equal(a.length, 32);
  assert.match(a, /^[0-9a-f]+$/);
  assert.notEqual(a, b);
});

test('normalizeCustomDomain accepts a plain host and strips a scheme', () => {
  assert.equal(normalizeCustomDomain('example.com'), 'https://example.com');
  assert.equal(normalizeCustomDomain('https://example.com'), 'https://example.com');
  assert.equal(normalizeCustomDomain('  Blog.Example.COM/  '), 'https://blog.example.com');
});

test('normalizeCustomDomain rejects invalid or reserved hosts', () => {
  assert.equal(normalizeCustomDomain(''), null);
  assert.equal(normalizeCustomDomain('no tld'), null);
  assert.equal(normalizeCustomDomain('-bad-.example.com'), null);
  assert.equal(normalizeCustomDomain('foo.pages.dev'), null);
  assert.equal(normalizeCustomDomain('foo.kantan-hp.fyi'), null);
  assert.equal(normalizeCustomDomain('pages.dev'), null);
  assert.equal(normalizeCustomDomain('kantan-hp.fyi'), null);
});

test('transferPathsFromTree keeps only user-data blob paths', () => {
  const tree = [
    { path: 'src/content/blog/foo.md', type: 'blob', sha: 'a' },
    { path: 'public/images/x.png', type: 'blob', sha: 'b' },
    { path: 'src/config.json', type: 'blob', sha: 'c' },
    { path: 'src/layouts/Base.astro', type: 'blob', sha: 'd' },
    { path: 'public/admin/config.yml', type: 'blob', sha: 'e' },
    { path: 'src/content/blog', type: 'tree', sha: 'f' },
  ];
  assert.deepEqual(transferPathsFromTree(tree).sort(), [
    'public/images/x.png',
    'src/config.json',
    'src/content/blog/foo.md',
  ]);
});

test('buildZip/parseZip round-trips binary bytes and drops non-user-data paths', async () => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
  const zip = buildZip([
    { path: 'src/content/blog/hello.md', data: enc.encode('---\ntitle: hi\n---\nbody') },
    { path: 'public/images/pic.png', data: pngBytes },
    { path: 'src/config.json', data: enc.encode('{"site":{"title":"T"}}') },
  ]);
  const files = await parseZip(zip);
  assert.equal(files.length, 3);
  assert.deepEqual([...files.find((f) => f.path === 'public/images/pic.png').data], [...pngBytes]);
  assert.equal(dec.decode(files.find((f) => f.path === 'src/content/blog/hello.md').data), '---\ntitle: hi\n---\nbody');

  const hostile = buildZip([
    { path: 'src/layouts/BaseLayout.astro', data: enc.encode('evil') },
    { path: 'public/admin/config.yml', data: enc.encode('evil') },
    { path: 'src/content/ok.md', data: enc.encode('ok') },
  ]);
  const parsed = await parseZip(hostile);
  assert.deepEqual(parsed.map((f) => f.path), ['src/content/ok.md']);
});

test('parseZip rejects an oversized bundle', async () => {
  const big = new Uint8Array(21 * 1024 * 1024);
  await assert.rejects(() => parseZip(big), /too large/);
});

test('parseZip rejects a decompression bomb via the streaming size cap', async () => {
  const big = new Uint8Array(101 * 1024 * 1024); // zeros — highly compressible
  const zip = buildZip([{ path: 'public/images/big.png', data: big }]);
  assert.ok(zip.length < 1024 * 1024, 'compresses well');
  // A single 101 MB file trips the per-file cap (25 MB) before the total cap.
  await assert.rejects(() => parseZip(zip), /too large/);
});

test('parseZip rejects a single oversized file via the per-file cap', async () => {
  // 30 MB is over the per-file cap (25 MB) but under the total cap (100 MB),
  // so this exercises the per-file gate specifically.
  const big = new Uint8Array(30 * 1024 * 1024);
  const zip = buildZip([{ path: 'public/images/big.png', data: big }]);
  await assert.rejects(() => parseZip(zip), /a file in the bundle is too large/);
});

test('applyLangToConfig sets site.lang and preserves the rest (bytes)', () => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const data = enc.encode(JSON.stringify({ site: { title: 'My Blog', lang: 'en' }, theme: { preset: 'paper' } }));
  const out = JSON.parse(dec.decode(applyLangToConfig(data, 'ja')));
  assert.equal(out.site.lang, 'ja');
  assert.equal(out.site.title, 'My Blog');
  assert.equal(out.theme.preset, 'paper');
});

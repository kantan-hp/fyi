import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugifySiteName,
  signPayload,
  verifyPayload,
  parseCookies,
  isAllowedSiteOrigin,
  b64encode,
  b64decode,
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

test('b64 roundtrip with unicode', () => {
  assert.equal(b64decode(b64encode('hello かんたん')), 'hello かんたん');
});

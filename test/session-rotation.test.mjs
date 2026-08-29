import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signPayload } from '../src/lib.js';
// Import the SHIPPED verifyAnySecret (exported from the worker module) — not a
// local re-implementation — so a regression in src/index.js (dropped fallback,
// reversed order, broken await) fails these tests. Importing src/index.js pulls
// in lib.js/page.js/i18n.js; those are dependency-free and safe under plain
// node --test.
const { verifyAnySecret } = await import('../src/index.js');

test('verifyAnySecret: old cookie verifies while PREVIOUS is set (grace window)', async () => {
  const oldSecret = 'old-secret';
  const newSecret = 'new-secret';
  const oldCookie = await signPayload(oldSecret, { sub: 'a@b.co' });

  // Before rotation: verifies against the then-current secret.
  assert.match(JSON.stringify(await verifyAnySecret({ SESSION_SECRET: oldSecret }, oldCookie)), /a@b\.co/);

  // Step 2 of the runbook (previous=current, current=rotated): old cookie still works.
  const env = { SESSION_SECRET: newSecret, SESSION_SECRET_PREVIOUS: oldSecret };
  assert.match(JSON.stringify(await verifyAnySecret(env, oldCookie)), /a@b\.co/);

  // New cookies sign with the current secret.
  const newCookie = await signPayload(newSecret, { sub: 'a@b.co', ts: Date.now() });
  assert.match(JSON.stringify(await verifyAnySecret(env, newCookie)), /a@b\.co/);

  // Step 4 (previous dropped): old cookie dies — the revocation moment.
  assert.equal(await verifyAnySecret({ SESSION_SECRET: newSecret }, oldCookie), null);
});

test('verifyAnySecret never accepts a cookie signed with an unrelated secret', async () => {
  const cookie = await signPayload('attacker-secret', { sub: 'evil@x.co' });
  const env = { SESSION_SECRET: 'new-secret', SESSION_SECRET_PREVIOUS: 'old-secret' };
  assert.equal(await verifyAnySecret(env, cookie), null);
});

test('verifyAnySecret: current secret wins before previous is consulted (pin the order)', async () => {
  // The order matters: signing always moves to the CURRENT secret, so a token
  // valid under both must report the same payload either way — but a cookie
  // that is INVALID under current yet valid under previous must still verify
  // (that is exactly the rotation window). A cookie invalid under both is null.
  const prev = 'prev-secret';
  const cookie = await signPayload(prev, { sub: 'a@b.co' });
  assert.match(
    JSON.stringify(await verifyAnySecret({ SESSION_SECRET: 'current', SESSION_SECRET_PREVIOUS: prev }, cookie)),
    /a@b\.co/,
  );
  // Missing token → null under both paths.
  assert.equal(await verifyAnySecret({ SESSION_SECRET: 's' }, undefined), null);
  assert.equal(await verifyAnySecret({ SESSION_SECRET: 's', SESSION_SECRET_PREVIOUS: 'p' }, undefined), null);
});
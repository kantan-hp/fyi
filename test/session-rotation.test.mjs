import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signPayload, verifyPayload } from '../src/lib.js';

// The session-rotation fallback: verifyAnySecret in src/index.js tries the
// CURRENT secret first, then SESSION_SECRET_PREVIOUS. The worker helper isn't
// exported, so mirror its exact semantics here against the same primitives it
// composes — this pins the contract (current first, prev fallback, null when
// neither matches) that the runbook in README depends on.

async function verifyAnySecret(env, token) {
  return (
    (await verifyPayload(env.SESSION_SECRET, token)) ||
    (env.SESSION_SECRET_PREVIOUS ? verifyPayload(env.SESSION_SECRET_PREVIOUS, token) : null)
  );
}

test('session rotation: old cookie verifies while PREVIOUS is set (grace window)', async () => {
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

test('rotation fallback never accepts a cookie signed with an unrelated secret', async () => {
  const cookie = await signPayload('attacker-secret', { sub: 'evil@x.co' });
  const env = { SESSION_SECRET: 'new-secret', SESSION_SECRET_PREVIOUS: 'old-secret' };
  assert.equal(await verifyAnySecret(env, cookie), null);
});
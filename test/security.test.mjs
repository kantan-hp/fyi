import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PANEL_CSP, withSecurity, renderDecapHandshake } from '../src/index.js';

// Guards for the panel's shipped security guarantees. F1 (adversarial review
// round 2) shipped green because no test asserted the CSP string — this would
// have caught a missing frame-src blocking the Turnstile iframe.

test('PANEL_CSP admits the Turnstile iframe origin', () => {
  assert.ok(
    PANEL_CSP.includes('frame-src https://challenges.cloudflare.com'),
    'Turnstile renders a challenge iframe from challenges.cloudflare.com on widget init; without frame-src, default-src \'self\' blocks it and login/Create Site die with a sitekey configured',
  );
});

test('withSecurity merges base headers and optionally adds the panel CSP', () => {
  const out = withSecurity({ 'content-type': 'application/json' });
  assert.equal(out['x-content-type-options'], 'nosniff');
  assert.equal(out['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(out['permissions-policy'], 'interest-cohort=()');
  assert.equal(out['strict-transport-security'], 'max-age=31536000; includeSubDomains');
  assert.equal(out['x-frame-options'], 'DENY');
  assert.equal(out['content-security-policy'], undefined, 'no CSP unless requested');

  const withCsp = withSecurity({ 'content-type': 'text/html' }, { csp: true });
  assert.equal(withCsp['content-security-policy'], PANEL_CSP);
  // Existing headers survive the merge (location/cache-control/set-cookie).
  const redirect = withSecurity({ location: '/app', 'cache-control': 'no-store' });
  assert.equal(redirect.location, '/app');
  assert.equal(redirect['cache-control'], 'no-store');
});

test('renderDecapHandshake is </script>-proof (error payload round-trips)', () => {
  // A payload containing </script> (e.g. a hostile GitHub error_description)
  // must not close the inline script block; it must survive as JSON text.
  const evil = { error: '</script><script>globalThis.pwned=1</script>', message: 'a\nb\u2028c' };
  const page = renderDecapHandshake(evil);
  assert.ok(page.includes('<script type="application/json" id="decap-payload">'));
  // The escaped form must not contain a raw </script> sequence.
  assert.ok(!page.includes('</script><script>globalThis.pwned=1'), 'raw </script> must be escaped');
  // Extract the payload block and confirm JSON.parse round-trips it.
  const m = page.match(/<script type="application\/json" id="decap-payload">([\s\S]*?)<\/script>/);
  assert.ok(m, 'payload script block present');
  const parsed = JSON.parse(m[1].replace(/\\u003c/g, '<'));
  assert.equal(parsed.error, evil.error);
  assert.equal(parsed.message, evil.message);
});

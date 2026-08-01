// Pure helpers shared by the worker routes. Kept free of worker-only APIs so
// they can be unit-tested with plain `node --test`.

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Turn a free-form site name into a valid repo / Pages project name. */
export function slugifySiteName(input) {
  const slug = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/^-+|-+$/g, '');
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) ? slug : null;
}

export function b64encode(str) {
  const bytes = textEncoder.encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return textDecoder.decode(bytes);
}

function b64urlEncode(str) {
  return b64encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return b64decode(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
  let bin = '';
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Sign a small JSON payload as `<b64url>.<hmac>` (session cookies, OAuth state). */
export async function signPayload(secret, obj) {
  const body = b64urlEncode(JSON.stringify(obj));
  return `${body}.${await hmac(secret, body)}`;
}

/** Verify a payload produced by signPayload. Returns the object, or null. */
export async function verifyPayload(secret, token) {
  const i = String(token || '').lastIndexOf('.');
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = await hmac(secret, body);
  if (sig.length !== expected.length) return null;
  // constant-time-ish comparison
  let diff = 0;
  for (let j = 0; j < sig.length; j++) diff |= sig.charCodeAt(j) ^ expected.charCodeAt(j);
  if (diff !== 0) return null;
  try {
    return JSON.parse(b64urlDecode(body));
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/** True only for https origins on pages.dev (provisioned sites' default domain). */
export function isAllowedSiteOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' && u.hostname.endsWith('.pages.dev');
  } catch {
    return false;
  }
}

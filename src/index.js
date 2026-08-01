// kantan panel (POC) — a single stateless Cloudflare Worker that:
//
//   1. Serves a minimal wizard page (/).
//   2. Logs the user in with GitHub OAuth (the panel's one OAuth App).
//   3. Provisions a kantan-hp site: generates a repo from the template,
//      writes Cloudflare deploy secrets into it, creates a direct-upload
//      Pages project, and points Decap at this worker's shared auth proxy.
//   4. Hosts the shared Decap OAuth proxy (/api/decap/auth → /oauth/callback)
//      so end users never create a GitHub OAuth App.
//
// Storage: one KV namespace (SITES) holding only site metadata
// (origin → {owner, repo, project, createdAt}). No user secrets are stored;
// the GitHub token lives in an HMAC-signed session cookie, the Cloudflare
// token is used once during provisioning and written straight into the
// user's repo as an Actions secret.

import sodium from 'tweetsodium';
import {
  slugifySiteName,
  b64encode,
  b64decode,
  signPayload,
  verifyPayload,
  parseCookies,
  isAllowedSiteOrigin,
} from './lib.js';
import { wizardPage } from './page.js';

const GITHUB_API = 'https://api.github.com';
const CF_API = 'https://api.cloudflare.com/client/v4';
const SESSION_COOKIE = 'kantan_session';
const NONCE_COOKIE = 'kantan_oauth_nonce';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    try {
      if (pathname === '/' && method === 'GET') {
        return new Response(wizardPage(), {
          headers: { 'content-type': 'text/html;charset=UTF-8' },
        });
      }
      if (pathname === '/auth/github') return oauthStart(request, env, 'panel');
      if (pathname === '/api/decap/auth') return oauthStart(request, env, 'decap');
      if (pathname === '/oauth/callback') return oauthCallback(request, env);
      if (pathname === '/api/logout') return logout(request);
      if (pathname === '/api/me') return apiMe(request, env);
      if (pathname === '/api/sites') return listSites(request, env);
      if (pathname === '/api/decap/lookup') return decapLookup(request, env);
      if (pathname === '/api/cf/accounts' && method === 'POST') return cfAccounts(request);
      if (pathname === '/api/provision' && method === 'POST') return provision(request, env);
      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// Small helpers

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8' },
  });
}

function text(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain;charset=UTF-8' } });
}

function cookie(name, value, { secure = true, maxAge } = {}) {
  let c = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
  if (secure) c += '; Secure';
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

function isHttps(request) {
  return new URL(request.url).protocol === 'https:';
}

async function getSession(request, env) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const session = await verifyPayload(env.SESSION_SECRET, cookies[SESSION_COOKIE]);
  if (!session || !session.t || !session.login) return null;
  if (Date.now() - (session.ts || 0) > SESSION_MAX_AGE_MS) return null;
  return session;
}

function ghHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'kantan-panel-poc',
    'x-github-api-version': '2022-11-28',
  };
}

async function gh(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(GITHUB_API + path, {
    method,
    headers: { ...ghHeaders(token), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function ghJson(token, path, opts) {
  const res = await gh(token, path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`GitHub ${opts?.method || 'GET'} ${path} failed (${res.status}): ${data.message || res.statusText}`);
  }
  return data;
}

async function cf(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(CF_API + path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = (data.errors || []).map((e) => e.message).join('; ') || res.statusText;
    throw new Error(`Cloudflare ${method} ${path} failed (${res.status}): ${msg}`);
  }
  return data.result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// GitHub OAuth — one app, two flows. The OAuth App's single callback URL is
// /oauth/callback; the signed `state` tells us which flow is completing.

async function oauthStart(request, env, flow) {
  if (!env.GITHUB_CLIENT_ID) return text('GITHUB_CLIENT_ID is not configured on the worker.', 500);
  const url = new URL(request.url);
  const nonce = crypto.randomUUID();
  const state = await signPayload(env.SESSION_SECRET, { flow, nonce });
  const redirect = new URL('https://github.com/login/oauth/authorize');
  redirect.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  redirect.searchParams.set('redirect_uri', url.origin + '/oauth/callback');
  redirect.searchParams.set('scope', 'repo');
  redirect.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      location: redirect.href,
      'set-cookie': cookie(NONCE_COOKIE, nonce, { secure: isHttps(request), maxAge: 600 }),
    },
  });
}

async function exchangeCode(env, code) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'kantan-panel-poc' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  return res.json();
}

async function oauthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = await verifyPayload(env.SESSION_SECRET, url.searchParams.get('state'));
  const cookies = parseCookies(request.headers.get('cookie'));
  const clearNonce = cookie(NONCE_COOKIE, '', { secure: isHttps(request), maxAge: 0 });
  if (!state || !state.nonce || cookies[NONCE_COOKIE] !== state.nonce) {
    return text('Invalid OAuth state. Please try again.', 403);
  }
  if (!code) return text('Missing authorization code from GitHub.', 400);

  const result = await exchangeCode(env, code);
  if (result.error) {
    return text(`GitHub OAuth failed: ${result.error_description || result.error}`, 401);
  }

  if (state.flow === 'panel') {
    const me = await ghJson(result.access_token, '/user');
    const session = await signPayload(env.SESSION_SECRET, {
      t: result.access_token,
      login: me.login,
      ts: Date.now(),
    });
    const headers = new Headers({ location: '/' });
    headers.append('set-cookie', clearNonce);
    headers.append(
      'set-cookie',
      cookie(SESSION_COOKIE, session, { secure: isHttps(request), maxAge: SESSION_MAX_AGE_MS / 1000 }),
    );
    return new Response(null, { status: 302, headers });
  }

  // Decap flow: hand the token to the Decap window via postMessage, but only
  // after the opener's origin has been validated (registered in KV *and* the
  // token has push access to that site's repo — checked client-side against
  // the GitHub API with the user's own token).
  return new Response(renderDecapHandshake({ token: result.access_token, provider: 'github' }), {
    headers: { 'content-type': 'text/html;charset=UTF-8', 'set-cookie': clearNonce },
  });
}

// Adapted from kantan-hp functions/api/callback.js (itself adapted from
// i40west/netlify-cms-cloudflare-pages, BSD-3-Clause), extended for the
// shared-proxy model: the opener origin is validated at handshake time
// instead of being assumed to be this site's own origin.
function renderDecapHandshake(content) {
  const payload = JSON.stringify(content)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Authorizing…</title></head><body>
<script>
  const PAYLOAD = JSON.parse('${payload}');
  const fail = (msg) => { document.body.textContent = 'Authorization failed: ' + msg; };
  if (!window.opener) {
    document.body.textContent = 'Authorization complete. You can close this window.';
  } else {
    let done = false;
    const finish = (status, body, origin) => {
      done = true;
      window.opener.postMessage('authorization:github:' + status + ':' + JSON.stringify(body), origin);
    };
    const receive = async (message) => {
      if (done) return;
      const origin = message.origin;
      try {
        const u = new URL(origin);
        if (u.protocol !== 'https:' || !u.hostname.endsWith('.pages.dev')) {
          throw new Error('origin is not a provisioned site');
        }
        const look = await fetch('/api/decap/lookup?origin=' + encodeURIComponent(origin));
        if (!look.ok) throw new Error('site is not registered with this panel');
        const { repo } = await look.json();
        const gh = await fetch('https://api.github.com/repos/' + repo, {
          headers: { authorization: 'Bearer ' + PAYLOAD.token, accept: 'application/vnd.github+json' },
        });
        const info = await gh.json();
        if (!gh.ok || !info.permissions || info.permissions.push !== true) {
          throw new Error('your GitHub account has no write access to ' + repo);
        }
        finish('success', { token: PAYLOAD.token, provider: 'github' }, origin);
      } catch (err) {
        finish('error', { message: String((err && err.message) || err) }, origin);
      }
    };
    window.addEventListener('message', receive, false);
    window.opener.postMessage('authorizing:github', '*');
    setTimeout(() => { if (!done) fail('no response from the editor window'); }, 30000);
  }
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Panel session APIs

function logout(request) {
  return new Response(null, {
    status: 302,
    headers: {
      location: '/',
      'set-cookie': cookie(SESSION_COOKIE, '', { secure: isHttps(request), maxAge: 0 }),
    },
  });
}

async function apiMe(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  return json({ login: session.login });
}

async function listSites(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  const { keys } = await env.SITES.list({ prefix: 'site:' });
  const sites = [];
  for (const key of keys) {
    const record = await env.SITES.get(key.name, 'json');
    if (record && record.owner === session.login) {
      sites.push({ origin: key.name.slice('site:'.length), ...record });
    }
  }
  sites.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return json({ sites });
}

// Public, secret-free lookup used by the Decap handshake page: does this
// origin belong to a provisioned site, and which repo backs it?
async function decapLookup(request, env) {
  const origin = new URL(request.url).searchParams.get('origin') || '';
  if (!isAllowedSiteOrigin(origin)) return json({ error: 'origin not allowed' }, 403);
  const record = await env.SITES.get(`site:${origin}`, 'json');
  if (!record) return json({ error: 'unknown site' }, 404);
  return json({ repo: record.repo });
}

async function cfAccounts(request) {
  const { token } = await request.json().catch(() => ({}));
  if (!token) return json({ error: 'token required' }, 400);
  try {
    const accounts = await cf(token, '/accounts?per_page=50');
    return json({ accounts: accounts.map((a) => ({ id: a.id, name: a.name })) });
  } catch (err) {
    return json({ error: String(err.message || err) }, 401);
  }
}

// ---------------------------------------------------------------------------
// Provisioning

async function provision(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'login required' }, 401);

  const { siteName, cfToken, cfAccountId } = await request.json().catch(() => ({}));
  const steps = [];
  const ok = (name, detail) => steps.push({ name, ok: true, detail });
  const fail = (name, detail) => steps.push({ name, ok: false, detail });

  try {
    const slug = slugifySiteName(siteName);
    if (!slug) throw new Error('Invalid site name — use letters, numbers and dashes (e.g. "my-blog").');
    if (!cfToken) throw new Error('Cloudflare API token is required.');
    const ghT = session.t;
    const login = session.login;
    const panelOrigin = new URL(request.url).origin;

    // 1. Cloudflare account (auto-discovered from the token)
    const accounts = await cf(cfToken, '/accounts?per_page=50');
    let accountId = cfAccountId;
    if (!accountId) {
      if (accounts.length !== 1) {
        throw new Error(
          'Token can see multiple Cloudflare accounts; select one: ' +
            accounts.map((a) => `${a.name} (${a.id})`).join(', '),
        );
      }
      accountId = accounts[0].id;
    } else if (!accounts.some((a) => a.id === accountId)) {
      throw new Error('The Cloudflare token cannot access the selected account.');
    }
    ok('cloudflare-account', accountId);

    // 2. Name availability on both sides
    const repoCheck = await gh(ghT, `/repos/${login}/${slug}`);
    if (repoCheck.status === 200) {
      throw new Error(`GitHub repository ${login}/${slug} already exists — pick another name.`);
    }
    ok('repo-name-available', `${login}/${slug}`);
    const projCheck = await fetch(`${CF_API}/accounts/${accountId}/pages/projects/${slug}`, {
      headers: { authorization: `Bearer ${cfToken}` },
    });
    if (projCheck.status === 200) {
      throw new Error(`"${slug}" is taken as a Cloudflare Pages project name (they are globally unique) — pick another.`);
    }
    ok('pages-name-available', `${slug}.pages.dev`);

    // 3. Generate the repo from the template
    const [tplOwner, tplName] = (env.TEMPLATE_REPO || 'lavasecurity/kantan-hp').split('/');
    await ghJson(ghT, `/repos/${tplOwner}/${tplName}/generate`, {
      method: 'POST',
      body: {
        owner: login,
        name: slug,
        description: 'A kantan-hp site, provisioned by the kantan panel',
        include_all_branches: false,
        private: false,
      },
    });
    ok('repo-generated', `https://github.com/${login}/${slug}`);

    // 4. Wait for the template contents to materialize
    let cfg = null;
    for (let i = 0; i < 10 && !cfg; i++) {
      const res = await gh(ghT, `/repos/${login}/${slug}/contents/public/admin/config.yml`);
      if (res.status === 200) cfg = await res.json();
      else await sleep(2000);
    }
    if (!cfg) throw new Error('The generated repository is still empty — GitHub is slow; retry in a minute.');
    ok('repo-ready');

    // 5. Repo secrets for the deploy workflow (GitHub sealed-box encryption)
    const pub = await ghJson(ghT, `/repos/${login}/${slug}/actions/secrets/public-key`);
    const keyBytes = Uint8Array.from(atob(pub.key), (c) => c.charCodeAt(0));
    const putSecret = async (name, value) => {
      const sealed = sodium.crypto_box_seal(new TextEncoder().encode(value), keyBytes);
      let bin = '';
      for (const b of sealed) bin += String.fromCharCode(b);
      await ghJson(ghT, `/repos/${login}/${slug}/actions/secrets/${name}`, {
        method: 'PUT',
        body: { encrypted_value: btoa(bin), key_id: pub.key_id },
      });
    };
    await putSecret('CF_API_TOKEN', cfToken);
    await putSecret('CF_ACCOUNT_ID', accountId);
    await putSecret('CF_PAGES_PROJECT', slug);
    ok('deploy-secrets-written', 'CF_API_TOKEN, CF_ACCOUNT_ID, CF_PAGES_PROJECT');

    // 6. Direct-upload Pages project (no Git connection needed)
    await cf(cfToken, `/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      body: { name: slug, production_branch: 'main' },
    });
    ok('pages-project-created', `https://${slug}.pages.dev`);

    // 7. Point Decap at this repo + the panel's shared auth proxy.
    //    This commit is also the first push, which triggers the deploy.
    const current = b64decode(cfg.content);
    let updated = current.replace(/^(\s*)repo:.*$/m, `$1repo: ${login}/${slug}`);
    if (updated === current) throw new Error('Could not find the repo: line in config.yml.');
    if (!/^\s*base_url:/m.test(updated)) {
      updated = updated.replace(
        /^(\s*)branch:.*$/m,
        `$1branch: main\n$1base_url: ${panelOrigin}\n$1auth_endpoint: /api/decap/auth`,
      );
    }
    await ghJson(ghT, `/repos/${login}/${slug}/contents/public/admin/config.yml`, {
      method: 'PUT',
      body: {
        message: 'chore: point Decap at this repo and the shared auth proxy',
        content: b64encode(updated),
        sha: cfg.sha,
        branch: 'main',
      },
    });
    ok('decap-configured', 'first deploy triggered');

    // 8. Register the site (drives the site list and the Decap origin check)
    const origin = `https://${slug}.pages.dev`;
    await env.SITES.put(
      `site:${origin}`,
      JSON.stringify({
        owner: login,
        repo: `${login}/${slug}`,
        project: slug,
        accountId,
        createdAt: new Date().toISOString(),
      }),
    );
    ok('site-registered', origin);

    return json({
      ok: true,
      steps,
      site: {
        name: slug,
        repo: `https://github.com/${login}/${slug}`,
        url: origin,
        admin: `${origin}/admin`,
        note: 'The first deploy takes a minute or two. Then open /admin and log in with GitHub.',
      },
    });
  } catch (err) {
    fail('error', String((err && err.message) || err));
    return json({ ok: false, error: String((err && err.message) || err), steps }, 400);
  }
}

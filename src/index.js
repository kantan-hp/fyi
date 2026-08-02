// kantan panel (MVP) — a single Cloudflare Worker that:
//
//   1. Serves a welcome one-pager (/) and an email-only magic-link login (/login).
//   2. Routes /app to a setup wizard (no sites yet) or a site table.
//   3. Provisions a kantan-hp site: generates a repo from the template, writes
//      Cloudflare deploy secrets into the user's own repo, creates a direct-upload
//      Pages project, and points Decap at this worker's shared auth proxy.
//   4. Hosts the shared Decap OAuth proxy (/api/decap/auth → /oauth/callback) so
//      end users never create a GitHub OAuth App.
//
// Storage:
//   - D1 (DB): the site registry, scoped by owner email (strongly consistent).
//   - KV (KV): single-use magic-link codes + login rate limits only.
// No user secrets are stored server-side: the email session cookie carries only
// {sub: email}; the wizard's GitHub token lives in a short-lived
// kantan_wizard_token cookie cleared after provisioning; the Cloudflare token is
// used once in memory and written straight into the user's repo as a secret.

import sodium from 'tweetsodium';
import {
  slugifySiteName,
  b64encode,
  b64decode,
  signPayload,
  verifyPayload,
  parseCookies,
  isAllowedSiteOrigin,
  normalizeEmail,
  isValidEmail,
  randomHex,
} from './lib.js';
import { welcomePage, loginPage, messagePage, appPage } from './page.js';

const GITHUB_API = 'https://api.github.com';
const CF_API = 'https://api.cloudflare.com/client/v4';
const SESSION_COOKIE = 'kantan_session';
const WIZARD_COOKIE = 'kantan_wizard_token';
const NONCE_COOKIE = 'kantan_oauth_nonce';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const WIZARD_MAX_AGE_MS = 15 * 60 * 1000;
const MAGIC_TTL_SECONDS = 15 * 60;
const MAGIC_MAX_PER_WINDOW = 3;
const MAGIC_WINDOW_SECONDS = 15 * 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    try {
      // Public pages
      if (pathname === '/' && method === 'GET') {
        const session = await getSession(request, env);
        return html(welcomePage({ email: session ? session.sub : null }));
      }
      if (pathname === '/login' && method === 'GET') return html(loginPage());
      if (pathname === '/login/callback' && method === 'GET') return loginCallback(request, env);
      if (pathname === '/app' && method === 'GET') return appRoute(request, env);

      // Panel APIs
      if (pathname === '/api/login' && method === 'POST') return loginIssue(request, env);
      if (pathname === '/api/logout') return logout(request);
      if (pathname === '/api/me') return apiMe(request, env);
      if (pathname === '/api/sites') return listSites(request, env);
      if (pathname === '/api/wizard/me') return wizardMe(request, env);
      if (pathname === '/api/wizard/logout') return wizardLogout(request);
      if (pathname === '/api/cf/accounts' && method === 'POST') return cfAccounts(request);
      if (pathname === '/api/provision' && method === 'POST') return provision(request, env);

      // OAuth — wizard GitHub connect + Decap shared proxy (single callback URL)
      if (pathname === '/auth/github') return oauthStart(request, env, 'wizard');
      if (pathname === '/api/decap/auth') return oauthStart(request, env, 'decap');
      if (pathname === '/oauth/callback') return oauthCallback(request, env);
      if (pathname === '/api/decap/lookup') return decapLookup(request, env);

      return html(messagePage('Not found', 'That page does not exist.'), 404);
    } catch (err) {
      return html(messagePage('Something went wrong', String((err && err.message) || err)), 500);
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

function html(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/html;charset=UTF-8' } });
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

function redirect(location) {
  return new Response(null, { status: 302, headers: { location } });
}

function isHttps(request) {
  return new URL(request.url).protocol === 'https:';
}

// ---------------------------------------------------------------------------
// Sessions

async function getSession(request, env) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const s = await verifyPayload(env.SESSION_SECRET, cookies[SESSION_COOKIE]);
  if (!s || !s.sub) return null;
  if (Date.now() - (s.ts || 0) > SESSION_MAX_AGE_MS) return null;
  return s;
}

async function getWizard(request, env) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const w = await verifyPayload(env.SESSION_SECRET, cookies[WIZARD_COOKIE]);
  if (!w || !w.t || !w.login) return null;
  if (Date.now() - (w.ts || 0) > WIZARD_MAX_AGE_MS) return null;
  return w;
}

// ---------------------------------------------------------------------------
// D1 site registry

async function getSitesByEmail(env, email) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM sites WHERE owner_email = ? ORDER BY created_at DESC',
  )
    .bind(email)
    .all();
  return results;
}

async function getSiteByOrigin(env, origin) {
  return env.DB.prepare('SELECT * FROM sites WHERE origin = ?').bind(origin).first();
}

// ---------------------------------------------------------------------------
// Email magic-link login

async function loginIssue(request, env) {
  const { email } = await request.json().catch(() => ({}));
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return json({ ok: false, error: 'Enter a valid email address.' }, 400);
  }

  const rlKey = `rl:login:${normalized}`;
  const rl = JSON.parse((await env.KV.get(rlKey)) || '{"count":0}');
  if (rl.count >= MAGIC_MAX_PER_WINDOW) {
    return json({ ok: false, error: 'Too many login links. Try again in a few minutes.' }, 429);
  }
  rl.count += 1;
  await env.KV.put(rlKey, JSON.stringify(rl), { expirationTtl: MAGIC_WINDOW_SECONDS });

  const code = randomHex(16);
  await env.KV.put(`magic:${code}`, normalized, { expirationTtl: MAGIC_TTL_SECONDS });

  // env.PANEL_BASE_URL overrides the request origin for local dev, where wrangler
  // dev rewrites request.url to the route hostname (kantan-hp.fyi).
  const base = env.PANEL_BASE_URL || new URL(request.url).origin;
  const link = `${base}/login/callback?code=${code}`;
  const sent = await sendMagicEmail(env, normalized, link);
  if (!sent.ok) {
    // No working mail provider (dev): surface the link so the flow is testable,
    // with the provider's reason so misconfiguration is self-diagnosing.
    return json({ ok: true, devLink: link, note: `Magic link shown instead of emailed: ${sent.reason}` });
  }
  return json({ ok: true });
}

async function sendMagicEmail(env, email, link) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { ok: false, reason: 'RESEND_API_KEY or EMAIL_FROM not configured' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Your kantan login link',
      text: `Open this link to sign in to your kantan panel (expires in 15 minutes):\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return { ok: false, reason: `Resend ${res.status}: ${detail.message || res.statusText}` };
  }
  return { ok: true };
}

async function loginCallback(request, env) {
  const code = new URL(request.url).searchParams.get('code') || '';
  const key = `magic:${code}`;
  const email = await env.KV.get(key);
  if (!email) {
    return html(loginPage({ error: 'This login link is invalid or has expired. Request a new one.' }), 400);
  }
  await env.KV.delete(key); // single-use
  const session = await signPayload(env.SESSION_SECRET, { sub: email, ts: Date.now() });
  const headers = new Headers({ location: '/app' });
  headers.append(
    'set-cookie',
    cookie(SESSION_COOKIE, session, { secure: isHttps(request), maxAge: SESSION_MAX_AGE_MS / 1000 }),
  );
  return new Response(null, { status: 302, headers });
}

function logout(request) {
  const headers = new Headers({ location: '/login' });
  headers.append('set-cookie', cookie(SESSION_COOKIE, '', { secure: isHttps(request), maxAge: 0 }));
  headers.append('set-cookie', cookie(WIZARD_COOKIE, '', { secure: isHttps(request), maxAge: 0 }));
  return new Response(null, { status: 302, headers });
}

// ---------------------------------------------------------------------------
// Panel session APIs

async function apiMe(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  return json({ email: session.sub });
}

async function appRoute(request, env) {
  const session = await getSession(request, env);
  if (!session) return redirect('/login');
  const sites = await getSitesByEmail(env, session.sub);
  return html(appPage({ email: session.sub, sites, hasSites: sites.length > 0 }));
}

async function listSites(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  return json({ sites: await getSitesByEmail(env, session.sub) });
}

async function wizardMe(request, env) {
  const wizard = await getWizard(request, env);
  if (!wizard) return json({ error: 'not connected' }, 401);
  return json({ login: wizard.login });
}

function wizardLogout(request) {
  return new Response(null, {
    status: 302,
    headers: { location: '/app', 'set-cookie': cookie(WIZARD_COOKIE, '', { secure: isHttps(request), maxAge: 0 }) },
  });
}

// ---------------------------------------------------------------------------
// GitHub OAuth — one app, two flows. The OAuth App's single callback URL is
// /oauth/callback; the signed `state` tells us which flow is completing.

async function oauthStart(request, env, flow) {
  if (!env.GITHUB_CLIENT_ID) return text('GITHUB_CLIENT_ID is not configured on the worker.', 500);
  const url = new URL(request.url);
  const nonce = crypto.randomUUID();
  const state = await signPayload(env.SESSION_SECRET, { flow, nonce });
  const redirectUrl = new URL('https://github.com/login/oauth/authorize');
  redirectUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  redirectUrl.searchParams.set('redirect_uri', url.origin + '/oauth/callback');
  redirectUrl.searchParams.set('scope', 'repo');
  redirectUrl.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      location: redirectUrl.href,
      'set-cookie': cookie(NONCE_COOKIE, nonce, { secure: isHttps(request), maxAge: 600 }),
    },
  });
}

async function exchangeCode(env, code) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'kantan-panel' },
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
    return html(messagePage('Invalid OAuth state', 'Please go back and try connecting GitHub again.'), 403);
  }
  if (!code) return text('Missing authorization code from GitHub.', 400);

  const result = await exchangeCode(env, code);
  if (result.error) {
    return text(`GitHub OAuth failed: ${result.error_description || result.error}`, 401);
  }

  if (state.flow === 'wizard') {
    // Wizard flow: hand the token to a short-lived cookie decoupled from the
    // email session, cleared after provisioning. Redirect back to /app.
    const me = await ghJson(result.access_token, '/user');
    const wizard = await signPayload(env.SESSION_SECRET, {
      t: result.access_token,
      login: me.login,
      ts: Date.now(),
    });
    const headers = new Headers({ location: '/app' });
    headers.append('set-cookie', clearNonce);
    headers.append(
      'set-cookie',
      cookie(WIZARD_COOKIE, wizard, { secure: isHttps(request), maxAge: WIZARD_MAX_AGE_MS / 1000 }),
    );
    return new Response(null, { status: 302, headers });
  }

  // Decap flow: hand the token to the Decap window via postMessage, but only
  // after the opener's origin has been validated (registered in D1 *and* the
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
// Cloudflare + GitHub API helpers

function ghHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'kantan-panel',
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
// Cloudflare account lookup (wizard step 2)

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
// Public, secret-free lookup used by the Decap handshake page: does this
// origin belong to a provisioned site, and which repo backs it?

async function decapLookup(request, env) {
  const origin = new URL(request.url).searchParams.get('origin') || '';
  if (!isAllowedSiteOrigin(origin)) return json({ error: 'origin not allowed' }, 403);
  const record = await getSiteByOrigin(env, origin);
  if (!record) return json({ error: 'unknown site' }, 404);
  return json({ repo: record.repo });
}

// ---------------------------------------------------------------------------
// Provisioning

async function provision(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'login required' }, 401);
  const wizard = await getWizard(request, env);
  if (!wizard) return json({ error: 'Connect GitHub first (step 1).' }, 401);

  const { siteName, cfToken, cfAccountId } = await request.json().catch(() => ({}));
  const steps = [];
  const ok = (name, detail) => steps.push({ name, ok: true, detail });
  const fail = (name, detail) => steps.push({ name, ok: false, detail });

  try {
    const slug = slugifySiteName(siteName);
    if (!slug) throw new Error('Invalid site name — use letters, numbers and dashes (e.g. "my-blog").');
    if (!cfToken) throw new Error('Cloudflare API token is required.');
    const ghT = wizard.t;
    const login = wizard.login;
    const email = session.sub;
    const panelOrigin = new URL(request.url).origin;

    // 1. Cloudflare account (auto-discovered from the token)
    const accounts = await cf(cfToken, '/accounts?per_page=50');
    let accountId = cfAccountId;
    if (!accountId) {
      // No explicit account: auto-discover, which needs the token to list accounts.
      if (accounts.length !== 1) {
        throw new Error(
          accounts.length === 0
            ? 'This token cannot list Cloudflare accounts — enter your account ID in the wizard.'
            : `Token can see ${accounts.length} Cloudflare accounts; select one (${accounts
                .map((a) => `${a.name} (${a.id})`)
                .join(', ')}) in the wizard and retry.`,
        );
      }
      accountId = accounts[0].id;
    } else if (accounts.length > 0 && !accounts.some((a) => a.id === accountId)) {
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
    const [tplOwner, tplName] = (env.TEMPLATE_REPO || 'kantan-hp/template').split('/');
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

    // 8. Register the site in D1 (drives the site list and the Decap origin check)
    const origin = `https://${slug}.pages.dev`;
    await env.DB.prepare(
      'INSERT INTO sites (origin, owner_email, owner_login, repo, project, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(origin, email, login, `${login}/${slug}`, slug, accountId, new Date().toISOString())
      .run();
    ok('site-registered', origin);

    // Zero-knowledge: the GitHub token cookie dies the moment provisioning is done.
    const headers = new Headers({ 'content-type': 'application/json;charset=UTF-8' });
    headers.append('set-cookie', cookie(WIZARD_COOKIE, '', { secure: isHttps(request), maxAge: 0 }));

    return new Response(
      JSON.stringify(
        {
          ok: true,
          steps,
          site: {
            name: slug,
            repo: `https://github.com/${login}/${slug}`,
            url: origin,
            admin: `${origin}/admin`,
            note: 'The first deploy takes a minute or two. Then open /admin and log in with GitHub.',
          },
        },
        null,
        2,
      ),
      { headers },
    );
  } catch (err) {
    fail('error', String((err && err.message) || err));
    return json({ ok: false, error: String((err && err.message) || err), steps }, 400);
  }
}

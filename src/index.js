// kantan panel (MVP) — a single Cloudflare Worker that:
//
//   1. Serves a welcome one-pager (/) and an email-only magic-link login (/login).
//   2. Routes /app to a setup wizard (no sites yet) or a site table.
//   3. Provisions a kantan-hp site: generates a repo from the template, writes
//      Cloudflare deploy secrets into the user's own repo, creates a direct-upload
//      Pages project, and points the site editor (Sveltia CMS) at this worker's
//      shared auth proxy.
//   4. Hosts the shared editor OAuth proxy (/api/decap/auth → /oauth/callback) so
//      end users never create a GitHub OAuth App. The /api/decap/* route names are
//      legacy-stable (they predate the Sveltia switch and renaming them would
//      require rewriting auth_endpoint in every provisioned site's config.yml).
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
  normalizeEmail,
  canonicalizeEmail,
  isValidEmail,
  randomHex,
  CONFIG_YML_PATH,
  classifyFitness,
  diffCoreTrees,
  treeToBlobMap,
  reinjectConfigBackend,
  detectMajorBumps,
  upgradeState,
  canonicalOrigin,
  isBrandSlug,
  isReservedSlug,
  slugLengthOk,
  normalizeCustomDomain,
  transferPathsFromTree,
  buildZip,
  parseZip,
  applyLangToConfig,
  b64decodeBytes,
} from './lib.js';
import { welcomePage, loginPage, messagePage, appPage } from './page.js';
import { resolveLocale, LANG_COOKIE, DEFAULT_LOCALE, isLocale, t } from './i18n.js';

const GITHUB_API = 'https://api.github.com';
const CF_API = 'https://api.cloudflare.com/client/v4';
const SESSION_COOKIE = 'kantan_session';
const WIZARD_COOKIE = 'kantan_wizard_token';
const NONCE_COOKIE = 'kantan_oauth_nonce';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const WIZARD_MAX_AGE_MS = 15 * 60 * 1000;
const MAGIC_TTL_SECONDS = 15 * 60;
// The panel's own zone (also in wrangler.toml routes). Not secret; the worker
// needs it at runtime to create per-site CNAME records with the operator token.
const CF_ZONE_ID = 'ac38c505c9f1a177a53f023d30f79283';

// Default rate-limit tunables. Overridable per-key in the D1 `settings` table
// (migration 0004) so limits change without a deploy. Per-IP windows longer
// than the edge's fixed 10-s burst are enforced app-layer with a bounded
// in-memory per-isolate map (best-effort, advisory); KV is used only for
// low-cardinality per-email / per-session keys.
const RL = {
  loginEmail: 3,
  loginEmailWindow: 15 * 60,
  loginIp: 30,
  loginIpWindow: 15 * 60,
  provisionIp: 5,
  provisionIpWindow: 60 * 60,
  provisionSession: 2,
  provisionSessionWindow: 60 * 60,
  lookupIp: 120,
  lookupIpWindow: 10 * 60,
  oauthIp: 30,
  oauthIpWindow: 10 * 60,
  loginCallbackIp: 30,
  loginCallbackIpWindow: 10 * 60,
  // site check budget is ~3x the site cap so a power user checking all their
  // sites (plus the update-modal re-check) doesn't self-inflict a 429.
  siteCheck: 15,
  siteUpdate: 2,
  siteWindow: 10 * 60,
  cfAccountsIp: 20,
  cfAccountsIpWindow: 10 * 60,
  siteCap: 5,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    const locale = resolveLocale(request);
    const pageOpts = { locale, pathname };
    try {
      // Public pages
      if (pathname === '/' && method === 'GET') {
        const session = await getSession(request, env);
        return html(welcomePage({ email: session ? session.sub : null }, pageOpts));
      }
      if (pathname === '/login' && method === 'GET') {
        return html(loginPage({}, { turnstileSitekey: env.TURNSTILE_SITEKEY, ...pageOpts }));
      }
      if (pathname === '/login/callback' && method === 'GET') return loginCallback(request, env);
      if (pathname === '/app' && method === 'GET') return appRoute(request, env);
      // Language switcher: set the kantan_lang cookie and return to the page.
      if (pathname === '/setlang' && method === 'GET') return setLang(request);

      // CSRF barrier: every /api/* POST must declare a JSON body. SameSite=Lax
      // does not protect against same-site origins (branded *.kantan-hp.fyi
      // sites are same-site with the panel), and a "simple request" carrying a
      // text/plain body would otherwise ride the victim's session cookies.
      if (method === 'POST' && pathname.startsWith('/api/') && !(request.headers.get('content-type') || '').startsWith('application/json')) {
        return json({ ok: false, error: 'Content-Type must be application/json.' }, 415);
      }

      // Panel APIs
      if (pathname === '/api/login' && method === 'POST') return loginIssue(request, env);
      if (pathname === '/api/logout') return logout(request);
      if (pathname === '/api/me') return apiMe(request, env);
      if (pathname === '/api/sites') return listSites(request, env);
      if (pathname === '/api/sites/check') return siteUpdateCheck(request, env);
      if (pathname === '/api/sites/update') return siteUpdate(request, env);
      if (pathname === '/api/sites/baseline') return siteBaseline(request, env);
      if (pathname === '/api/sites/delete') return siteDelete(request, env);
      if (pathname === '/api/sites/export') return siteExport(request, env);
      if (pathname === '/api/wizard/me') return wizardMe(request, env);
      if (pathname === '/api/wizard/logout') return wizardLogout(request);
      if (pathname === '/api/cf/accounts' && method === 'POST') return cfAccounts(request, env);
      if (pathname === '/api/provision' && method === 'POST') return provision(request, env);

      // OAuth — wizard GitHub connect + shared editor proxy (single callback URL)
      if (pathname === '/auth/github') return oauthStart(request, env, 'wizard');
      if (pathname === '/api/decap/auth') return oauthStart(request, env, 'decap');
      if (pathname === '/oauth/callback') return oauthCallback(request, env);
      if (pathname === '/api/decap/lookup') return decapLookup(request, env);

      return html(messagePage(t(locale, 'notFoundTitle'), t(locale, 'notFoundBody'), pageOpts), 404);
    } catch (err) {
      return html(messagePage(t(locale, 'somethingWentWrong'), String((err && err.message) || err), pageOpts), 500);
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

// Language switcher: set the kantan_lang cookie and return to the page.
// `l` must be one of our locales; `next` must be a same-site path. Guard
// rejects scheme-relative `//`, a leading backslash `\`, and CR/LF/NUL
// anywhere — browsers strip the latter from URLs and they can split the
// Location header (reflected-XSS/500 vector). Cookie is SameSite=Lax +
// HttpOnly, always Secure (the panel origin is https; a plain-http request
// simply falls back to Accept-Language).
function setLang(request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get('l');
  const next = url.searchParams.get('next') || '/';
  const safeNext = /^\/(?!\/|\\)[^\t\r\n\0]*$/.test(next) ? next : '/';
  const headers = new Headers({ location: safeNext });
  if (isLocale(locale)) {
    headers.append(
      'set-cookie',
      cookie(LANG_COOKIE, locale, { secure: true, maxAge: 60 * 60 * 24 * 365 }),
    );
  }
  return new Response(null, { status: 302, headers });
}

function isHttps(request) {
  return new URL(request.url).protocol === 'https:';
}

// Canonical panel base URL (scheme + host, no trailing slash), always https.
// Cloudflare enforces http→https at the edge (Always Use HTTPS + HSTS), but
// GitHub OAuth Apps match the callback URL exactly, so the redirect_uri (and
// the editor base_url written into user configs) must be the registered https
// origin no matter what. Forcing https here keeps that invariant even if a
// request somehow reaches the worker over http. (Local dev: point PANEL_BASE_URL
// at your https dev origin, or register a second GitHub App for the http
// callback.)
function panelBase(env, request) {
  return (env.PANEL_BASE_URL || new URL(request.url).origin).replace(/^http:/, 'https:');
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

/** Legacy pages.dev origin fallback for sites registered under a branded origin. */
async function getSiteByDeployUrl(env, deployUrl) {
  return env.DB.prepare('SELECT * FROM sites WHERE deploy_url = ?').bind(deployUrl).first();
}

/** A site whose user-attached custom domain matches the given https origin. */
async function getSiteByCustomDomain(env, origin) {
  return env.DB.prepare('SELECT * FROM sites WHERE custom_domain = ?').bind(origin).first();
}

/**
 * Resolve a site from an editor origin: the canonical `origin`, its legacy
 * pages.dev `deploy_url`, or a user-attached `custom_domain`. The single place
 * the editor handshake trusts an origin — a D1 match, never a suffix guess.
 */
async function findSiteByOrigin(env, origin) {
  return (
    (await getSiteByOrigin(env, origin)) ||
    (await getSiteByDeployUrl(env, origin)) ||
    (await getSiteByCustomDomain(env, origin))
  );
}

/**
 * The branded-subdomain naming guard: length floor, the pure kantan/reserved
 * denylist, the D1 reserved_slugs table, and that no site already owns the
 * branded origin. Only run when the wizard asks for a branded address.
 */
async function assertBrandedSlugAvailable(env, slug) {
  if (!slugLengthOk(slug)) {
    throw new Error('Site name must be 4–32 characters to get a branded address — or uncheck "Assign me <name>.kantan-hp.fyi" to use pages.dev only.');
  }
  if (isReservedSlug(slug)) {
    throw new Error(`"${slug}" is reserved — pick another name, or uncheck "Assign me <name>.kantan-hp.fyi" to use pages.dev only.`);
  }
  const reserved = await env.DB.prepare('SELECT 1 FROM reserved_slugs WHERE slug = ?').bind(slug).first();
  if (reserved) {
    throw new Error(`"${slug}" is reserved — pick another name, or uncheck "Assign me <name>.kantan-hp.fyi" to use pages.dev only.`);
  }
  const taken = await getSiteByOrigin(env, canonicalOrigin(slug));
  if (taken) {
    throw new Error(`"${canonicalOrigin(slug)}" is already taken — pick another name, or uncheck "Assign me <name>.kantan-hp.fyi" to use pages.dev only.`);
  }
}

// ---------------------------------------------------------------------------
// Email magic-link login

async function loginIssue(request, env) {
  const { email, turnstile } = await request.json().catch(() => ({}));
  // IDENTITY stays normalizeEmail (trim+lowercase) so session.sub / owner_email
  // keep matching existing sites registered under Gmail dot/+tag addresses;
  // canonicalizeEmail is used ONLY for the rate-limit key below.
  const normalized = normalizeEmail(email);
  const canonical = canonicalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return json({ ok: false, error: 'Enter a valid email address.' }, 400);
  }

  // Turnstile first — fail CLOSED on a missing/invalid token (a scripted client
  // that never renders the widget gets no free pass); only a siteverify outage
  // fails open.
  const ts = await verifyTurnstile(env, turnstile);
  if (!ts.ok) return turnstileResponse(ts);

  // Per-IP advisory brake (in-memory, longer window than the edge's 10 s).
  if (
    !ipRateLimit(
      request,
      'login',
      await getLimit(env, 'rl.login_ip_max', RL.loginIp),
      await getLimit(env, 'rl.login_ip_window', RL.loginIpWindow),
    )
  ) {
    return rateLimited('login-ip', 'Too many requests from this network — try again in a few minutes.');
  }

  // Per-email counter on the CANONICALIZED address so Gmail dots/+tags can't
  // fork it (low-cardinality key, KV).
  if (
    !(await kvRateLimit(
      env,
      'login',
      canonical,
      await getLimit(env, 'rl.login_email_max', RL.loginEmail),
      await getLimit(env, 'rl.login_email_window', RL.loginEmailWindow),
    ))
  ) {
    return rateLimited('login-email', 'Too many login links. Try again in a few minutes.');
  }

  const code = randomHex(16);
  await env.KV.put(`magic:${code}`, normalized, { expirationTtl: MAGIC_TTL_SECONDS });

  // env.PANEL_BASE_URL overrides the request origin for local dev, where wrangler
  // dev rewrites request.url to the route hostname (kantan-hp.fyi). Always https
  // so magic links keep working even if the panel was opened over http.
  const base = panelBase(env, request);
  const link = `${base}/login/callback?code=${code}`;
  const sent = await sendMagicEmail(env, normalized, link);
  if (!sent.ok) {
    // The magic link is a bearer credential — it must have exactly one delivery
    // channel (the mailbox). Surface it only when NO provider is configured AND
    // an explicit dev flag is set; a provider ERROR must never leak the link
    // (returning it on any failure converts a Resend incident into account
    // takeover). Prod failure returns a safe, link-less error.
    const devFallback = (!env.RESEND_API_KEY || !env.EMAIL_FROM) && env.DEV_MAGIC_LINK === 'true';
    if (devFallback) {
      return json({ ok: true, devLink: link, note: `Magic link shown instead of emailed: ${sent.reason}` });
    }
    return json(
      { ok: false, error: 'Could not send the login link — try again in a few minutes.' },
      502,
    );
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
  // Browser navigation (magic link click) — an HTML 429, not raw JSON.
  if (!ipRateLimit(request, 'login-callback', await getLimit(env, 'rl.login_callback_ip_max', RL.loginCallbackIp), await getLimit(env, 'rl.login_callback_ip_window', RL.loginCallbackIpWindow))) {
    console.log(JSON.stringify({ ev: 'rate-limited', rule: 'login-callback-ip', t: Date.now() }));
    const locale = resolveLocale(request);
    return html(loginPage({ error: t(locale, 'tooManyLogins') }, { turnstileSitekey: env.TURNSTILE_SITEKEY, locale, pathname: '/login' }), 429);
  }
  const code = new URL(request.url).searchParams.get('code') || '';
  const key = `magic:${code}`;
  const email = await env.KV.get(key);
  if (!email) {
    const locale = resolveLocale(request);
    return html(loginPage({ error: t(locale, 'invalidLink') }, { turnstileSitekey: env.TURNSTILE_SITEKEY, locale, pathname: '/login' }), 400);
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
  const locale = resolveLocale(request);
  return html(
    appPage(
      { email: session.sub, sites, hasSites: sites.length > 0 },
      { turnstileSitekey: env.TURNSTILE_SITEKEY, locale, pathname: new URL(request.url).pathname },
    ),
  );
}

async function listSites(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  const sites = await getSitesByEmail(env, session.sub);
  return json({ sites });
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
  // Browser navigation — an HTML 429, not raw JSON.
  if (!ipRateLimit(request, 'oauth', await getLimit(env, 'rl.oauth_ip_max', RL.oauthIp), await getLimit(env, 'rl.oauth_ip_window', RL.oauthIpWindow))) {
    console.log(JSON.stringify({ ev: 'rate-limited', rule: 'oauth-ip', t: Date.now() }));
    const locale = resolveLocale(request);
    return html(messagePage(t(locale, 'tooManyTitle'), t(locale, 'tooManyBody'), { locale, pathname: '/auth/github' }), 429);
  }
  const nonce = crypto.randomUUID();
  const state = await signPayload(env.SESSION_SECRET, { flow, nonce });
  const redirectUrl = new URL('https://github.com/login/oauth/authorize');
  redirectUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  // GitHub OAuth Apps match the callback URL exactly, so the redirect_uri must
  // always be the canonical HTTPS callback — never the request's own scheme or
  // host (Cloudflare serves http://kantan-hp.fyi without upgrading, and any
  // workers.dev/preview origin is not registered).
  redirectUrl.searchParams.set('redirect_uri', panelBase(env, request) + '/oauth/callback');
  // `repo` covers creating/editing the generated site repo; `delete_repo` is a
  // separate GitHub scope required to delete a repo — needed by the provision
  // rollback (clean up a half-created repo) and by site decommissioning.
  redirectUrl.searchParams.set('scope', 'repo delete_repo');
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
  // Browser navigation (GitHub redirect) — an HTML 429, not raw JSON. Reads the
  // same documented rl.oauth_ip_* tunables as oauthStart so tuning the pair
  // affects the whole OAuth round-trip.
  if (!ipRateLimit(request, 'oauth-callback', await getLimit(env, 'rl.oauth_ip_max', RL.oauthIp), await getLimit(env, 'rl.oauth_ip_window', RL.oauthIpWindow))) {
    console.log(JSON.stringify({ ev: 'rate-limited', rule: 'oauth-callback-ip', t: Date.now() }));
    const locale = resolveLocale(request);
    return html(messagePage(t(locale, 'tooManyTitle'), t(locale, 'tooManyBody'), { locale, pathname: '/oauth/callback' }), 429);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = await verifyPayload(env.SESSION_SECRET, url.searchParams.get('state'));
  const cookies = parseCookies(request.headers.get('cookie'));
  const clearNonce = cookie(NONCE_COOKIE, '', { secure: isHttps(request), maxAge: 0 });
  const toApp = (headers) => {
    headers.append('set-cookie', clearNonce);
    return new Response(null, { status: 302, headers });
  };
  if (!state || !state.nonce || cookies[NONCE_COOKIE] !== state.nonce) {
    const locale = resolveLocale(request);
    return html(messagePage(t(locale, 'invalidOauth'), t(locale, 'invalidOauthBody'), { locale, pathname: '/oauth/callback' }), 403);
  }
  if (!code) {
    // The user cancelled on GitHub (or the flow errored before a code). For the
    // editor flow, relay the real reason to the editor window via the handshake
    // page (postMessage) so Sveltia shows "Authentication failed / cancelled"
    // instead of hanging on "Signing in…" until the popup is closed. The wizard
    // flow keeps the /app redirect so the panel client can reset its pending
    // check state.
    const reason = 'Authentication cancelled — the login window was closed before finishing.';
    if (state.flow === 'decap') {
      return new Response(renderDecapHandshake({ error: reason, message: reason }), {
        headers: { 'content-type': 'text/html;charset=UTF-8', 'set-cookie': clearNonce },
      });
    }
    return toApp(new Headers({ location: '/app' }));
  }

  const result = await exchangeCode(env, code);
  if (result.error) {
    const reason = result.error_description || 'GitHub could not complete the login — try again.';
    if (state.flow === 'decap') {
      return new Response(renderDecapHandshake({ error: reason, message: reason }), {
        headers: { 'content-type': 'text/html;charset=UTF-8', 'set-cookie': clearNonce },
      });
    }
    return toApp(new Headers({ location: '/app' }));
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

  // Editor flow: hand the token to the editor window via postMessage, but only
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
        // The opener must be https; the authoritative check is server-side —
        // /api/decap/lookup matches the origin against the D1 registry
        // (canonical origin, deploy_url, or a user-attached custom domain) and
        // refuses anything unregistered before any token is posted.
        const allowed = u.protocol === 'https:';
        if (!allowed) {
          throw new Error('origin is not a provisioned site');
        }
        // Pre-handshake OAuth failure (user cancelled, exchange failed): relay
        // the real reason to the editor instead of letting it hang on
        // "Signing in…". No token is present in this payload.
        if (PAYLOAD.error) {
          throw new Error(PAYLOAD.error);
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
        // Sveltia reads 'error' (Decap read 'message') - send both so the
        // editor shows the real reason on OAuth/D1/push-check failures.
        const reason = String((err && err.message) || err);
        finish('error', { message: reason, error: reason }, origin);
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
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'kantan-panel',
    'x-github-api-version': '2022-11-28',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
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
// Layered rate limiting (plan: layered rate limiting with Cloudflare tooling).
//
// Three layers:
//   1. Edge WAF rate-limit rule (Cloudflare dashboard, free tier): one broad
//      burst guard on /api/* + /oauth/*, ~100 req/10 s/IP, Block. Fixed 10-s
//      window — burst-only, can't express longer windows on the free tier.
//   2. Turnstile on the login form + provisioning step, verified server-side:
//      fail CLOSED on a missing/invalid token, fail open ONLY when siteverify
//      itself is unreachable/5xx (narrow service-outage carve-out), and log it.
//   3. App-level per-identity limits: KV for low-cardinality per-email /
//      per-session keys (.catch()-wrapped, fail-open), and a bounded in-memory
//      per-isolate map for advisory per-IP windows > 10 s.
// Observed hits are logged (non-PII) for tuning.

/** The client's real IP as seen by Cloudflare (never client-spoofable). */
function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// Isolate-scoped cache for settings reads (tunables change rarely; avoids a D1
// round-trip per gate per request). 30-s TTL.
const LIMIT_CACHE = new Map();
const LIMIT_CACHE_TTL = 30 * 1000;

/** D1 settings-table tunable; falls back to the code default if unset/errored. */
async function getLimit(env, key, fallback) {
  const now = Date.now();
  const cached = LIMIT_CACHE.get(key);
  if (cached && cached.expires > now) return cached.value;
  let value = fallback;
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    if (row && String(row.value).trim()) {
      const n = Number(row.value);
      if (Number.isFinite(n) && n >= 0) value = n;
    }
  } catch {
    // settings table missing/errored — keep the code default
  }
  if (LIMIT_CACHE.size > 512) LIMIT_CACHE.clear();
  LIMIT_CACHE.set(key, { value, expires: now + LIMIT_CACHE_TTL });
  return value;
}

/**
 * KV rate-limit counter for low-cardinality per-email / per-session identities.
 * read-modify-write can race (fine for soft abuse control, not hard caps);
 * a KV failure fails OPEN so an outage never locks out the panel — but it is
 * logged (non-PII) so silent budget exhaustion is visible.
 */
async function kvRateLimit(env, name, identity, max, windowSeconds) {
  const key = `rl:${name}:${identity}`;
  try {
    const cur = JSON.parse((await env.KV.get(key)) || '{"count":0}');
    if (cur.count >= max) return false;
    cur.count += 1;
    await env.KV.put(key, JSON.stringify(cur), { expirationTtl: windowSeconds });
    return true;
  } catch {
    console.log(JSON.stringify({ ev: 'kv-rate-limit-fail-open', rule: name, t: Date.now() }));
    return true;
  }
}

// Bounded per-isolate in-memory soft limiter for advisory per-IP windows.
// Cloudflare routes a client across isolates, so recall is partial — that is
// acceptable for an advisory limit; the authoritative caps are per-identity.
const IP_LIMITS = new Map();
function ipRateLimit(request, name, max, windowSeconds) {
  // max <= 0 is the operator's documented kill-switch for this gate: reject
  // every request, including the first one in a window (the cache-miss branch
  // below would otherwise allow it before ever comparing against max).
  if (max <= 0) return false;
  const key = `${name}:${clientIp(request)}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = IP_LIMITS.get(key);
  if (!entry || entry.expires <= now) {
    if (IP_LIMITS.size > 50000) {
      // Bound the map: sweep expired entries, then evict a ~25% sample of the
      // oldest rather than clear() (a full clear would reset every active
      // window on the isolate, including legit users', at the moment a wide-IP
      // flood is being absorbed).
      for (const [k, v] of IP_LIMITS) if (v.expires <= now) IP_LIMITS.delete(k);
      if (IP_LIMITS.size > 50000) {
        const keys = [...IP_LIMITS.keys()].slice(0, Math.floor(IP_LIMITS.size / 4));
        for (const k of keys) IP_LIMITS.delete(k);
      }
    }
    IP_LIMITS.set(key, { count: 1, expires: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

/**
 * Verify a Turnstile token server-side. Fail CLOSED on a missing/invalid token;
 * fail OPEN only when the siteverify endpoint is unreachable OR returns a 5xx
 * (a Cloudflare-wide Turnstile incident must not lock the whole panel) — and log
 * those events. A SITEKEY/SECRET pairing mismatch is a deployment misconfig and
 * is surfaced as such instead of silently skipping verification or locking out.
 */
async function verifyTurnstile(env, token) {
  const { TURNSTILE_SITEKEY, TURNSTILE_SECRET } = env;
  if (!TURNSTILE_SITEKEY && !TURNSTILE_SECRET) {
    // Human verification is off (local dev). Log it so a production deployment
    // that forgot both vars is visible instead of silently running without it.
    console.log(JSON.stringify({ ev: 'turnstile-unconfigured', t: Date.now() }));
    return { ok: true, unavailable: true };
  }
  if (!TURNSTILE_SITEKEY || !TURNSTILE_SECRET) {
    console.log(JSON.stringify({ ev: 'turnstile-misconfig', t: Date.now() }));
    return { ok: false, misconfig: true, reason: 'turnstile-misconfigured' };
  }
  if (!token) return { ok: false, reason: 'verification-token-missing' };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token }),
    });
    if (res.status >= 500) {
      console.log(JSON.stringify({ ev: 'turnstile-fail-open', status: res.status, t: Date.now() }));
      return { ok: true, unavailable: true };
    }
    const data = await res.json().catch(() => ({}));
    return data.success === true ? { ok: true } : { ok: false, reason: 'verification-failed' };
  } catch {
    console.log(JSON.stringify({ ev: 'turnstile-fail-open', t: Date.now() }));
    return { ok: true, unavailable: true };
  }
}

/** Response for a failed Turnstile check — misconfig vs user-actionable. */
function turnstileResponse(ts) {
  if (ts.misconfig) {
    return json({ ok: false, error: 'The panel is not configured for verification (Turnstile sitekey/secret mismatch) — contact the operator.' }, 500);
  }
  return json({ ok: false, error: 'Please complete the verification box and try again.' }, 400);
}

/** 429 response + non-PII observability line for a rate-limit hit. */
function rateLimited(rule, message) {
  console.log(JSON.stringify({ ev: 'rate-limited', rule, t: Date.now() }));
  return json({ ok: false, error: message || 'Too many requests — try again shortly.' }, 429);
}

/** Count of sites a GitHub login already owns (the hard provisioning cap). */
async function siteCountForLogin(env, login) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM sites WHERE owner_login = ?').bind(login).first();
  return (row && row.n) || 0;
}

// ---------------------------------------------------------------------------
// Cloudflare account lookup (wizard step 2)

async function cfAccounts(request, env) {
  if (!ipRateLimit(request, 'cf-accounts', await getLimit(env, 'rl.cf_accounts_ip_max', RL.cfAccountsIp), await getLimit(env, 'rl.cf_accounts_ip_window', RL.cfAccountsIpWindow))) {
    return rateLimited('cf-accounts-ip');
  }
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
// Public, secret-free lookup used by the editor handshake page: does this
// origin belong to a provisioned site, and which repo backs it?

async function decapLookup(request, env) {
  if (!ipRateLimit(request, 'lookup', await getLimit(env, 'rl.lookup_ip_max', RL.lookupIp), await getLimit(env, 'rl.lookup_ip_window', RL.lookupIpWindow))) {
    return rateLimited('lookup-ip');
  }
  const origin = new URL(request.url).searchParams.get('origin') || '';
  if (!/^https:\/\//.test(origin)) return json({ error: 'origin not allowed' }, 403);
  // The editor origin is matched against the D1 registry (canonical origin,
  // legacy pages.dev deploy_url, or a user-attached custom domain) — a suffix
  // guess is no longer the gate.
  const record = await findSiteByOrigin(env, origin);
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

  const {
    siteName,
    cfToken,
    cfAccountId,
    public: sitePublic = false,
    branded: siteBranded = false,
    lang: siteLang = DEFAULT_LOCALE,
    customDomain: customDomainRaw,
    contentSource: contentSourceRaw,
    contentBundle: contentBundleRaw,
    turnstile,
  } = await request.json().catch(() => ({}));
  const customDomain = normalizeCustomDomain(customDomainRaw);
  const steps = [];
  const ok = (name, detail) => steps.push({ name, ok: true, detail });
  const fail = (name, detail) => steps.push({ name, ok: false, detail });

  // Best-effort reverse-order cleanup of anything created mid-flow, so a failure
  // never leaves an orphaned repo, Pages project, DNS record, or D1 row behind.
  // External resources are torn down first and the D1 row is deleted LAST, so a
  // partial cleanup leaves a registry record an operator can see and finish.
  const created = {};
  // Hoisted to function scope so `rollback` (defined before the try block) can
  // see them — the previous block-scoped declarations inside `try` were out of
  // scope in the closure, so repo/Pages/domain cleanup silently never ran.
  let slug, accountId, ghT, login;
  const rollback = async () => {
    const failed = [];
    const job = async (step, fn) => {
      try {
        await fn();
      } catch (err) {
        // Best-effort cleanup, but never silent: log the step (non-PII) so the
        // operator can find stranded resources, and report it to the user.
        failed.push(step);
        console.log(JSON.stringify({ ev: 'rollback-step-failed', step, t: Date.now() }));
      }
    };
    if (created.dns) {
      await job('dns', () => cf(env.CF_ZONE_DNS_TOKEN, `/zones/${CF_ZONE_ID}/dns_records/${created.dns}`, { method: 'DELETE' }));
    }
    if (created.ownershipTxt) {
      await job('ownership-txt', () => cf(env.CF_ZONE_DNS_TOKEN, `/zones/${CF_ZONE_ID}/dns_records/${created.ownershipTxt}`, { method: 'DELETE' }));
    }
    if (created.domainAttach) {
      await job('domain-attach', () => cf(cfToken, `/accounts/${accountId}/pages/projects/${slug}/domains/${created.domainAttach}`, { method: 'DELETE' }));
    }
    if (created.customDomain) {
      await job('custom-domain', () => cf(cfToken, `/accounts/${accountId}/pages/projects/${slug}/domains/${customDomain.replace(/^https:\/\//, '')}`, { method: 'DELETE' }));
    }
    if (created.pagesProject) {
      await job('pages-project', () => cf(cfToken, `/accounts/${accountId}/pages/projects/${slug}`, { method: 'DELETE' }));
    }
    if (created.repo) {
      await job('repo', () => gh(ghT, `/repos/${login}/${slug}`, { method: 'DELETE' }));
    }
    if (created.origin) {
      await job('d1-row', () => env.DB.prepare('DELETE FROM sites WHERE origin = ?').bind(created.origin).run());
    }
    return failed;
  };

  try {
    // Cheap input validation runs BEFORE the rate-limit gates so a user
    // experimenting with names (reserved/short) never burns the creation budget.
    slug = slugifySiteName(siteName);
    if (!slug) throw new Error('Invalid site name — use letters, numbers and dashes (e.g. "my-blog").');
    if (!cfToken) throw new Error('Cloudflare API token is required.');
    const branded = siteBranded === true;
    if (branded && !env.CF_ZONE_DNS_TOKEN) {
      throw new Error('Branded subdomains are not configured on this panel (CF_ZONE_DNS_TOKEN missing) — or uncheck "Assign me <name>.kantan-hp.fyi" to use pages.dev only.');
    }

    // Rate-limit gates run after validation but BEFORE anything is created, so
    // a rejected request never leaves partial resources. Turnstile first
    // (fail-closed); then per-IP + per-session soft brakes; then the hard
    // per-GitHub-login site cap.
    const ts = await verifyTurnstile(env, turnstile);
    if (!ts.ok) return turnstileResponse(ts);
    if (!ipRateLimit(request, 'provision', await getLimit(env, 'rl.provision_ip_max', RL.provisionIp), await getLimit(env, 'rl.provision_ip_window', RL.provisionIpWindow))) {
      return rateLimited('provision-ip', 'Too many sites from this network — try again in an hour.');
    }
    if (!(await kvRateLimit(env, 'provision', wizard.login, await getLimit(env, 'rl.provision_session_max', RL.provisionSession), await getLimit(env, 'rl.provision_session_window', RL.provisionSessionWindow)))) {
      return rateLimited('provision-session', 'You\'ve created sites very recently — try again in an hour.');
    }
    const siteCap = await getLimit(env, 'rl.site_cap', RL.siteCap);
    if ((await siteCountForLogin(env, wizard.login)) >= siteCap) {
      return rateLimited('site-cap', `You already have ${siteCap} sites on kantan — that's the current per-account limit.`);
    }
    ghT = wizard.t;
    login = wizard.login;
    const email = session.sub;
    const panelOrigin = panelBase(env, request);
    const pagesDevUrl = `https://${slug}.pages.dev`;
    // The site's default language: whitelist against the four locales so a
    // tampered or stale payload can never write a bad site.lang (fallback en).
    const lang = isLocale(siteLang) ? siteLang : DEFAULT_LOCALE;

    // 0b. Naming guard. The kantan-brand guard runs on every path (a brand squat
    //     is a squat whether or not the branded box is checked). The 4–32 length
    //     floor, full denylist, D1 reserved_slugs, and branded-origin checks are
    //     branded-namespace policy and only apply when branded.
    if (isBrandSlug(slug)) {
      throw new Error(
        branded
          ? `"${slug}" is reserved — pick another name, or uncheck "Assign me <name>.kantan-hp.fyi" to use pages.dev only.`
          : `"${slug}" is reserved — pick another name.`,
      );
    }
    if (branded) {
      await assertBrandedSlugAvailable(env, slug);
      ok('name-guard', `${slug}.kantan-hp.fyi available`);
    }

    // 1. Cloudflare account (auto-discovered from the token)
    const accounts = await cf(cfToken, '/accounts?per_page=50');
    accountId = cfAccountId;
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
    ok('pages-name-available', pagesDevUrl);

    // 3. Create the Pages project FIRST — the only globally-unique,
    //    hard-to-undo resource — so a cross-account name collision fails here,
    //    before anything else exists ("nothing half-created").
    await cf(cfToken, `/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      body: { name: slug, production_branch: 'main' },
    });
    created.pagesProject = true;
    ok('pages-project-created', pagesDevUrl);

    try {
      // 4. Generate the repo from the template
      const [tplOwner, tplName] = (env.TEMPLATE_REPO || 'kantan-hp/template').split('/');
      // Stamp the exact template revision the site's core is provisioned from.
      const tplRef = await gh(ghT, `/repos/${tplOwner}/${tplName}/git/ref/heads/main`);
      const templateVersion = tplRef.ok ? (await tplRef.json()).object.sha : null;
      if (!templateVersion) throw new Error('Could not read the template version — retry in a moment.');
      await ghJson(ghT, `/repos/${tplOwner}/${tplName}/generate`, {
        method: 'POST',
        body: {
          owner: login,
          name: slug,
          description: 'A kantan-hp site, provisioned by the kantan panel',
          include_all_branches: false,
          private: !sitePublic, // private by default; opt-in to public
        },
      });
      created.repo = true;
      ok('repo-generated', `https://github.com/${login}/${slug}`);

      // 5. Wait for the template contents to materialize
      let cfg = null;
      for (let i = 0; i < 10 && !cfg; i++) {
        const res = await gh(ghT, `/repos/${login}/${slug}/contents/public/admin/config.yml`);
        if (res.status === 200) cfg = await res.json();
        else await sleep(2000);
      }
      if (!cfg) throw new Error('The generated repository is still empty — GitHub is slow; retry in a minute.');
      ok('repo-ready');

      // 5b. Content import (optional): overlay the three user-data paths from a
      //     source (an existing kantan site or an uploaded bundle) onto the fresh
      //     repo before the editor steps. Never touches core or config.yml; the
      //     imported src/config.json keeps its settings but its site.lang is set
      //     to the wizard's choice.
      let contentImported = false;
      const sourceOrigin = typeof contentSourceRaw === 'string' ? contentSourceRaw.trim() : '';
      const hasBundle = typeof contentBundleRaw === 'string' && contentBundleRaw.length > 0;
      if (sourceOrigin || hasBundle) {
        let files = [];
        if (sourceOrigin) {
          const sourceSite = await getSiteByOrigin(env, sourceOrigin);
          if (!sourceSite || sourceSite.owner_login !== login) {
            throw new Error('Content source site not found, or it is not yours.');
          }
          const srcInfo = await siteRepoInfo(ghT, sourceSite.repo);
          files = await readUserDataFiles(ghT, srcInfo.owner, srcInfo.name, srcInfo.headSha);
          ok('content-source', `${sourceSite.repo} → ${slug}`);
        } else {
          try {
            files = parseZip(b64decodeBytes(contentBundleRaw));
          } catch {
            throw new Error('Could not read the uploaded content bundle.');
          }
          ok('content-bundle', `${files.length} file(s) from the bundle`);
        }
        files = files.map((f) =>
          f.path === 'src/config.json' ? { path: f.path, content: applyLangToConfig(f.content, lang) } : f,
        );
        if (files.length) {
          await overlayUserData(ghT, login, slug, files);
          contentImported = true;
        }
      }

      // 6. Repo secrets for the deploy workflow (GitHub sealed-box encryption)
      const pub = await ghJson(ghT, `/repos/${login}/${slug}/actions/secrets/public-key`);
      const keyBytes = Uint8Array.from(atob(pub.key), (c) => c.charCodeAt(0));
      const putSecret = async (name, value) => {
        const sealed = sodium.seal(new TextEncoder().encode(value), keyBytes);
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

      // 7. Set the canonical-site-URL repo variable BEFORE the deploy-triggering
      //    commit. GitHub Actions resolves repo variables when a run starts, so
      //    setting PUBLIC_SITE_URL after the commit below would ship a
      //    placeholder RSS/sitemap canonical on the first deploy. Branded sites
      //    get their branded origin; pages.dev-only sites get their pages.dev
      //    origin (the SEO plan's searchability default) — every provisioned
      //    site builds with a real canonical from its first deploy.
      {
        const siteUrl = branded ? `https://${slug}.kantan-hp.fyi` : pagesDevUrl;
        await ghJson(ghT, `/repos/${login}/${slug}/actions/variables`, {
          method: 'POST',
          body: { name: 'PUBLIC_SITE_URL', value: siteUrl },
        });
      }

      // 8a. Set the site title + default language in src/config.json. This is
      //     now the FIRST push, triggering the first deploy — which therefore
      //     already carries the site's name and chosen language (site.lang).
      //     Best-effort like the old title write, but the language step is
      //     surfaced so a failed write isn't silent — the site would otherwise
      //     be born English. Skipped when content was imported: the imported
      //     config.json already carries the user's title/settings, and site.lang
      //     was set by the overlay.
      let siteTitled = false;
      let siteLanged = false;
      if (!contentImported) {
        try {
          const cfgJson = await ghJson(ghT, `/repos/${login}/${slug}/contents/src/config.json`);
          const config = JSON.parse(b64decode(cfgJson.content));
          if (config && config.site) {
            config.site.title = slug;
            config.site.lang = lang;
            await ghJson(ghT, `/repos/${login}/${slug}/contents/src/config.json`, {
              method: 'PUT',
              body: {
                message: 'chore: set site title and default language',
                content: b64encode(JSON.stringify(config, null, 2) + '\n'),
                sha: cfgJson.sha,
                branch: 'main',
              },
            });
            siteTitled = true;
            siteLanged = true;
          }
        } catch {
          // best-effort — the site is still fully provisioned
        }
      }
      ok('site-titled', contentImported ? 'kept from imported content' : siteTitled ? `site title set to "${slug}"` : 'no editable config.json (template layout)');
      ok('site-lang', contentImported ? `default language set to "${lang}" (imported)` : siteLanged ? `default language set to "${lang}"` : 'could not set default language — the site will default to English');

      // 8. Point the editor at this repo + the panel's shared auth proxy.
      //     This is the SECOND push (the config.json commit in 8a was the
      //     first). It triggers a rebuild that fixes the editor auth and
      //     templates Sveltia's i18n default_locale from the chosen language
      //     so the editor's default tab matches the site's default language.
      const current = b64decode(cfg.content);
      let updated = current.replace(/^(\s*)repo:.*$/m, `$1repo: ${login}/${slug}`);
      if (updated === current) throw new Error('Could not find the repo: line in config.yml.');
      if (!/^\s*base_url:/m.test(updated)) {
        updated = updated.replace(
          /^(\s*)branch:.*$/m,
          `$1branch: main\n$1base_url: ${panelOrigin}\n$1auth_endpoint: /api/decap/auth`,
        );
      }
      updated = updated.replace(/^(\s*)default_locale:.*$/m, `$1default_locale: ${lang}`);
      // Non-fatal: if the template's i18n block ever changes shape, the editor
      // keeps its default locale (en) but the SITE still builds with site.lang.
      // Surface it rather than failing provisioning (the repo: guard above is
      // the only hard dependency on the template layout).
      const editorLocaleOk = /^\s*default_locale:/m.test(updated);
      await ghJson(ghT, `/repos/${login}/${slug}/contents/public/admin/config.yml`, {
        method: 'PUT',
        body: {
          message: 'chore: point the editor at this repo and the shared auth proxy',
          content: b64encode(updated),
          sha: cfg.sha,
          branch: 'main',
        },
      });
      ok(
        'decap-configured',
        editorLocaleOk
          ? 'editor configured (second build triggered)'
          : 'editor configured — WARNING: could not template default_locale; editor opens in English',
      );

      // 8b. Branded address: attach the domain to the user's Pages project
      //     (user token) + create the proxied CNAME in our zone (operator
      //     token). The branded domain lives in OUR zone but the Pages project
      //     in the user's account, so Cloudflare requires an ownership TXT
      //     before the domain activates — we create it in our zone with the
      //     operator token. Activation is async (DNS + certificate issuance);
      //     poll briefly and report the honest status.
      if (branded) {
        const attach = await cf(cfToken, `/accounts/${accountId}/pages/projects/${slug}/domains`, {
          method: 'POST',
          body: { name: `${slug}.kantan-hp.fyi` },
        });
        created.domainAttach = `${slug}.kantan-hp.fyi`;
        if (
          attach &&
          attach.validation_data &&
          attach.validation_data.status === 'pending' &&
          attach.validation_data.method === 'txt' &&
          attach.validation_data.txt_name &&
          attach.validation_data.txt_value
        ) {
          const txt = await cf(env.CF_ZONE_DNS_TOKEN, `/zones/${CF_ZONE_ID}/dns_records`, {
            method: 'POST',
            body: {
              type: 'TXT',
              name: attach.validation_data.txt_name,
              content: attach.validation_data.txt_value,
              ttl: 1,
            },
          });
          created.ownershipTxt = txt.id;
        }
        const dns = await cf(env.CF_ZONE_DNS_TOKEN, `/zones/${CF_ZONE_ID}/dns_records`, {
          method: 'POST',
          body: { type: 'CNAME', name: `${slug}.kantan-hp.fyi`, content: `${slug}.pages.dev`, proxied: true, ttl: 1 },
        });
        created.dns = dns.id;
        let domainStatus = 'pending';
        try {
          for (let i = 0; i < 8 && domainStatus !== 'active'; i++) {
            const dom = await cf(cfToken, `/accounts/${accountId}/pages/projects/${slug}/domains/${slug}.kantan-hp.fyi`);
            domainStatus = (dom && dom.status) || 'pending';
            if (domainStatus !== 'active') await sleep(2000);
          }
        } catch {
          // the deploy is not blocked by the domain lifecycle; report pending
        }
        if (domainStatus === 'active') {
          ok('branded-domain', `https://${slug}.kantan-hp.fyi active`);
        } else if (domainStatus === 'error' || domainStatus === 'blocked' || domainStatus === 'deactivated') {
          // A permanent validation failure (e.g. the TXT/CNAME never validates)
          // must not be reported as an eventual success — surface it as a failed
          // step; the site itself still serves at pages.dev.
          fail('branded-domain', `https://${slug}.kantan-hp.fyi could not be validated (${domainStatus}) — the site still works at ${pagesDevUrl}`);
        } else {
          ok('branded-domain', `https://${slug}.kantan-hp.fyi pending — activates once Cloudflare validates the DNS records`);
        }
      }

      // 8c. Custom domain (optional): attach the user's own domain to the Pages
      //     project via the Pages API, then store it so the editor handshake
      //     accepts the origin. Activation is async — the user creates a CNAME
      //     at their registrar pointing at <slug>.pages.dev; we report the
      //     instruction. The domain object is kept for the D1 insert below.
      let customDomainResult = null;
      if (customDomain) {
        customDomainResult = await cf(cfToken, `/accounts/${accountId}/pages/projects/${slug}/domains`, {
          method: 'POST',
          body: { name: customDomain.replace(/^https:\/\//, '') },
        });
        created.customDomain = true;
        ok('custom-domain', `${customDomain} attached — create a CNAME at your registrar pointing to ${slug}.pages.dev`);
      }

      // 9. Register the site in D1 (drives the site list and the editor origin
      //    check). Branded sites get the branded canonical origin + deploy_url;
      //    pages.dev-only sites keep origin = pages.dev and deploy_url = NULL.
      //    A user-attached custom domain is recorded for the editor handshake.
      //    The INSERT is a single-statement CONDITIONAL insert — atomic in D1 —
      //    as the hard backstop on the per-GitHub-login site cap (the count was
      //    already checked before any resource was created; this closes the race
      //    window during the long provisioning flow).
      const origin = branded ? `https://${slug}.kantan-hp.fyi` : pagesDevUrl;
      const deployUrl = branded ? pagesDevUrl : null;
      const insert = await env.DB.prepare(
        'INSERT INTO sites (origin, owner_email, owner_login, repo, project, account_id, template_version, deploy_url, custom_domain, created_at) ' +
          'SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ' +
          'WHERE (SELECT COUNT(*) FROM sites WHERE owner_login = ?) < ?',
      )
        .bind(origin, email, login, `${login}/${slug}`, slug, accountId, templateVersion, deployUrl, customDomain || null, new Date().toISOString(), login, siteCap)
        .run();
      if ((insert.meta && insert.meta.changes) !== 1) {
        // The cap was hit mid-flight (concurrent provision). Nothing to keep:
        // the repo/project/DNS were created for a site the registry refused.
        // The enclosing catch runs rollback() exactly once.
        throw Object.assign(
          new Error(`You already have ${siteCap} sites on kantan — that's the current per-account limit.`),
          { status: 429 },
        );
      }
      created.origin = origin;
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
              pagesDevUrl,
              customDomain: customDomain || undefined,
              note: 'The first deploy takes a minute or two. Then open /admin and log in with GitHub.',
            },
          },
          null,
          2,
        ),
        { headers },
      );
    } catch (err) {
      const failed = await rollback();
      if (failed.length && login && slug) {
        const hint =
          failed.includes('repo')
            ? ` Cleanup is incomplete — please delete https://github.com/${login}/${slug} manually.`
            : ' Some resources may need manual cleanup — please retry or contact support.';
        err.message = String((err && err.message) || err) + hint;
      }
      throw err;
    }
  } catch (err) {
    fail('error', String((err && err.message) || err));
    return json({ ok: false, error: String((err && err.message) || err), steps }, err && err.status ? err.status : 400);
  }
}

// ---------------------------------------------------------------------------
// Site versioning — fitness-gated updates
//
// Each site carries a template_version (template `main` SHA at provision) in
// D1. The fitness gate compares the site's core tree to template@recorded
// version, blocks updates when dirty, and offers only green template revisions.
// All reads of the user's private repo use the short-lived wizard token; the
// panel never stores a user token (zero-knowledge). Updates are user-initiated.

async function templateParts(env) {
  const [owner, name] = (env.TEMPLATE_REPO || 'kantan-hp/template').split('/');
  return { owner, name };
}

/** Current template main SHA, cached in KV to keep GitHub read traffic low. */
async function templateMainSha(env, token) {
  const cacheKey = 'template:main-sha';
  const cached = await env.KV.get(cacheKey).catch(() => null);
  if (cached) return cached;
  const { owner, name } = templateParts(env);
  // Authenticated read: callers always hold the short-lived wizard token, and
  // an unauthenticated call from a shared Worker egress IP shares GitHub's
  // ~60 req/h per-IP budget with unrelated customers (a 403 here silently
  // kills check/update/baseline until the cache warms).
  const ref = await ghJson(token, `/repos/${owner}/${name}/git/ref/heads/main`);
  const sha = ref.object.sha;
  await env.KV.put(cacheKey, sha, { expirationTtl: 300 }).catch(() => {});
  return sha;
}

/** Recursive tree of a repo at a commit sha, as [{path, type, sha, mode}]. */
async function repoTree(token, owner, name, sha) {
  const data = await ghJson(token, `/repos/${owner}/${name}/git/trees/${sha}?recursive=1`);
  return data.tree || [];
}

/** Base64 content of a file at a ref via the contents API (public template reads are token-less). */
async function fileContentBase64(token, owner, name, path, ref) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const data = await ghJson(token, `/repos/${owner}/${name}/contents/${encoded}?ref=${ref}`);
  return data.content || null;
}

/** Resolve a site's repo to {owner, name, defaultBranch, headSha}. */
async function siteRepoInfo(token, repo) {
  const [owner, name] = repo.split('/');
  const info = await ghJson(token, `/repos/${owner}/${name}`);
  const ref = await ghJson(token, `/repos/${owner}/${name}/git/ref/heads/${info.default_branch}`);
  return { owner, name, defaultBranch: info.default_branch, headSha: ref.object.sha };
}

/**
 * Read the user data contract (src/content/**, public/images/**, src/config.json)
 * out of a repo at a commit, as [{path, content}]. The source for export and for
 * kantan→kantan import.
 */
async function readUserDataFiles(token, owner, name, headSha) {
  const tree = await repoTree(token, owner, name, headSha);
  const files = [];
  for (const path of transferPathsFromTree(tree)) {
    const b64 = await fileContentBase64(token, owner, name, path, headSha);
    if (b64) files.push({ path, content: b64decode(b64) });
  }
  return files;
}

/**
 * Write [{path, content}] onto a repo's default branch in a single tree commit
 * (base_tree = current head, so existing files are preserved). Reused by the
 * update engine and content import.
 */
async function overlayUserData(token, owner, name, files) {
  const info = await siteRepoInfo(token, `${owner}/${name}`);
  const headCommit = await ghJson(token, `/repos/${owner}/${name}/git/commits/${info.headSha}`);
  const treeEntries = [];
  for (const f of files) {
    const blob = await ghJson(token, `/repos/${owner}/${name}/git/blobs`, {
      method: 'POST',
      body: { content: b64encode(f.content), encoding: 'base64' },
    });
    treeEntries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const newTree = await ghJson(token, `/repos/${owner}/${name}/git/trees`, {
    method: 'POST',
    body: { base_tree: headCommit.tree.sha, tree: treeEntries },
  });
  const commit = await ghJson(token, `/repos/${owner}/${name}/git/commits`, {
    method: 'POST',
    body: { message: 'chore: import content', tree: newTree.sha, parents: [info.headSha] },
  });
  await ghJson(token, `/repos/${owner}/${name}/git/refs/heads/${info.defaultBranch}`, {
    method: 'PATCH',
    body: { sha: commit.sha, force: false },
  });
}

/** True when the template's own CI (npm run check + build) is green on main. */
async function templateCiGreen(token, owner, name) {
  try {
    const runs = await ghJson(token, `/repos/${owner}/${name}/actions/workflows/ci.yml/runs?branch=main&per_page=1`);
    const latest = runs.workflow_runs && runs.workflow_runs[0];
    return !!latest && latest.status === 'completed' && latest.conclusion === 'success';
  } catch {
    return false;
  }
}

/** Full fitness + update-readiness check for a site. Requires a wizard token to read the site repo. */
async function siteVersionStatus(env, token, site) {
  const [tplOwner, tplName] = templateParts(env);
  const recorded = site.template_version || null;
  const current = await templateMainSha(env, token);
  const result = { from: recorded, to: current };

  if (!recorded) {
    result.needsBaseline = true;
    return result;
  }
  if (recorded === current) {
    result.upToDate = true;
    return result;
  }

  // Site core tree at its HEAD + the template trees we compare against.
  const siteInfo = await siteRepoInfo(token, site.repo);
  result.siteHeadSha = siteInfo.headSha;
  const [siteTree, tplFromTree, tplToTree] = await Promise.all([
    repoTree(token, siteInfo.owner, siteInfo.name, siteInfo.headSha),
    repoTree(token, tplOwner, tplName, recorded),
    repoTree(token, tplOwner, tplName, current),
  ]);

  const [siteCfgB64, fromCfgB64, toCfgB64] = await Promise.all([
    fileContentBase64(token, siteInfo.owner, siteInfo.name, CONFIG_YML_PATH, siteInfo.headSha),
    fileContentBase64(token, tplOwner, tplName, CONFIG_YML_PATH, recorded),
    fileContentBase64(token, tplOwner, tplName, CONFIG_YML_PATH, current),
  ]);
  const siteConfig = siteCfgB64 ? b64decode(siteCfgB64) : '';
  const fromConfig = fromCfgB64 ? b64decode(fromCfgB64) : '';
  const toConfig = toCfgB64 ? b64decode(toCfgB64) : '';

  const fit = classifyFitness({ templateTree: tplFromTree, siteTree, templateConfigYml: fromConfig, siteConfigYml: siteConfig });
  result.fit = fit.clean ? 'clean' : 'dirty';
  result.drifted = fit.drifted;

  if (!fit.clean) return result;

  // Only green templates are offered; major bumps need explicit confirm.
  result.changes = diffCoreTrees({ fromTree: tplFromTree, toTree: tplToTree, fromConfigYml: fromConfig, toConfigYml: toConfig });
  // A template-add that lands on a path the user already added would overwrite
  // their file (pure additions are tolerated as clean, but the update must not
  // clobber them). Surface those collisions and block instead.
  const siteBlobMap = treeToBlobMap(siteTree);
  result.collisions = result.changes.filter(
    (c) => c.status === 'added' && c.path in siteBlobMap,
  );
  result.ciGreen = await templateCiGreen(token, tplOwner, tplName);
  const [pkgFrom, pkgTo, adminFrom, adminTo] = await Promise.all([
    fileContentBase64(token, tplOwner, tplName, 'package.json', recorded),
    fileContentBase64(token, tplOwner, tplName, 'package.json', current),
    fileContentBase64(token, tplOwner, tplName, 'public/admin/index.html', recorded),
    fileContentBase64(token, tplOwner, tplName, 'public/admin/index.html', current),
  ]);
  result.majorBumps = detectMajorBumps({
    fromPackageJson: pkgFrom && b64decode(pkgFrom),
    toPackageJson: pkgTo && b64decode(pkgTo),
    fromAdminHtml: adminFrom && b64decode(adminFrom),
    toAdminHtml: adminTo && b64decode(adminTo),
  });
  return result;
}

async function siteUpdateCheck(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  const wizard = await getWizard(request, env);
  if (!wizard) return json({ error: 'Connect GitHub to check for updates.', connectUrl: '/auth/github' }, 401);
  // These endpoints spend ~5-15 GitHub API calls each on the user's token; cap
  // them per-email so a stuck client (or stolen session) can't burn the budget.
  if (!(await kvRateLimit(env, 'site-check', canonicalizeEmail(session.sub), await getLimit(env, 'rl.site_check_max', RL.siteCheck), await getLimit(env, 'rl.site_window', RL.siteWindow)))) {
    return rateLimited('site-check');
  }
  const { origin } = await request.json().catch(() => ({}));
  const site = await getSiteByOrigin(env, origin);
  if (!site) return json({ error: 'unknown site' }, 404);
  if (site.owner_email !== session.sub) return json({ error: 'not your site' }, 403);
  try {
    const status = await siteVersionStatus(env, wizard.t, site);
    const up = upgradeState(status);
    return json({
      upgradeable: up.state,
      reason: up.reason,
      drifted: status.drifted,
      collisions: status.collisions,
      changes: status.changes,
      majorBumps: status.majorBumps,
      from: status.from,
      to: status.to,
    });
  } catch (err) {
    // A failed site-repo read (404/403 even with a token) is a catch-all N/A,
    // not a server error — the repo is private/deleted or the token can't see it.
    return json({ upgradeable: 'N/A', reason: 'unreadable', error: String((err && err.message) || err) }, 200);
  }
}

async function siteUpdate(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  const wizard = await getWizard(request, env);
  if (!wizard) return json({ error: 'Connect GitHub to update.', connectUrl: '/auth/github' }, 401);
  if (!(await kvRateLimit(env, 'site-update', canonicalizeEmail(session.sub), await getLimit(env, 'rl.site_update_max', RL.siteUpdate), await getLimit(env, 'rl.site_window', RL.siteWindow)))) {
    return rateLimited('site-update');
  }
  const { origin, confirmMajor = false } = await request.json().catch(() => ({}));
  const site = await getSiteByOrigin(env, origin);
  if (!site) return json({ error: 'unknown site' }, 404);
  if (site.owner_email !== session.sub) return json({ error: 'not your site' }, 403);

  try {
    // Recompute everything server-side; never trust the client's read of the state.
    const status = await siteVersionStatus(env, wizard.t, site);
    if (status.needsBaseline) return json({ error: 'Set a baseline before updating.' }, 409);
    if (status.upToDate) return json({ error: 'This site is already up to date.' }, 409);
    if (status.fit === 'dirty') {
      return json({ blocked: 'dirty', drifted: status.drifted, error: 'Update blocked — your site has core files that differ from the template.' }, 409);
    }
    if (status.collisions && status.collisions.length) {
      return json({
        blocked: 'collision',
        collisions: status.collisions.map((c) => c.path),
        error: 'Update blocked — the template now adds files that already exist in your site. The update would overwrite them.',
      }, 409);
    }
    if (!status.ciGreen) return json({ blocked: 'template-ci', error: 'Update blocked — the template is not passing its own CI right now.' }, 409);
    if (status.majorBumps.length && !confirmMajor) {
      return json({ blocked: 'major', majorBumps: status.majorBumps, error: 'This update bumps a major version. Confirm to continue.' }, 409);
    }

    const [tplOwner, tplName] = templateParts(env);
    const siteInfo = await siteRepoInfo(wizard.t, site.repo);
    const from = status.from;
    const to = status.to;

    // The fitness gate and change list were computed against status.siteHeadSha.
    // If the site's branch moved since that read, re-run the whole check rather
    // than committing blind — otherwise a concurrent push to a core file would
    // be silently overwritten (bypassing the dirty gate).
    if (siteInfo.headSha !== status.siteHeadSha) {
      return json({
        error: 'Your site changed while reviewing — re-check and try again.',
        retry: true,
      }, 409);
    }
    const headSha = status.siteHeadSha;

    // Build a single version-bump commit on the site's own default branch.
    const headCommit = await ghJson(wizard.t, `/repos/${siteInfo.owner}/${siteInfo.name}/git/commits/${headSha}`);
    const baseTree = headCommit.tree.sha;
    const tplToTree = await repoTree(wizard.t, tplOwner, tplName, to);
    const toBlobMap = {};
    for (const e of tplToTree) toBlobMap[e.path] = e;

    const [siteCfgB64, toCfgB64] = await Promise.all([
      fileContentBase64(wizard.t, siteInfo.owner, siteInfo.name, CONFIG_YML_PATH, headSha),
      fileContentBase64(wizard.t, tplOwner, tplName, CONFIG_YML_PATH, to),
    ]);
    const siteConfig = siteCfgB64 ? b64decode(siteCfgB64) : '';
    const toConfig = toCfgB64 ? b64decode(toCfgB64) : '';

    const treeEntries = [];
    for (const change of status.changes) {
      if (change.status === 'deleted') {
        treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      let contentBase64;
      if (change.path === CONFIG_YML_PATH) {
        contentBase64 = b64encode(reinjectConfigBackend(toConfig, siteConfig));
      } else {
        contentBase64 = await fileContentBase64(wizard.t, tplOwner, tplName, change.path, to);
      }
      if (!contentBase64) continue;
      const blob = await ghJson(wizard.t, `/repos/${siteInfo.owner}/${siteInfo.name}/git/blobs`, {
        method: 'POST',
        body: { content: contentBase64, encoding: 'base64' },
      });
      const mode = (toBlobMap[change.path] && toBlobMap[change.path].mode) || '100644';
      treeEntries.push({ path: change.path, mode, type: 'blob', sha: blob.sha });
    }

    const newTree = await ghJson(wizard.t, `/repos/${siteInfo.owner}/${siteInfo.name}/git/trees`, {
      method: 'POST',
      body: { base_tree: baseTree, tree: treeEntries },
    });
    const commit = await ghJson(wizard.t, `/repos/${siteInfo.owner}/${siteInfo.name}/git/commits`, {
      method: 'POST',
      body: {
        message: `chore: update site core to template ${to.slice(0, 7)}`,
        tree: newTree.sha,
        parents: [headSha],
      },
    });
    const setAnchor = (value) =>
      env.DB.prepare('UPDATE sites SET template_version = ? WHERE origin = ?').bind(value, origin).run();

    // Reserve the anchor BEFORE touching the branch: if the D1 write fails, no
    // commit is made and nothing diverges. If the ref update then fails, we
    // compensate by reverting the anchor — the repo never ends up ahead of the
    // recorded version (which would otherwise leave the site looking dirty and
    // permanently blocked).
    await setAnchor(to);
    try {
      // force:false makes this a compare-and-swap: GitHub rejects the ref update
      // unless it fast-forwards from the current head, so a push that landed
      // between our head read and this update cannot be silently overwritten.
      await ghJson(wizard.t, `/repos/${siteInfo.owner}/${siteInfo.name}/git/refs/heads/${siteInfo.defaultBranch}`, {
        method: 'PATCH',
        body: { sha: commit.sha, force: false },
      });
    } catch (err) {
      // The PATCH may have applied server-side even though the response was
      // lost (connection drop). Verify the actual ref before compensating, so
      // we never leave the repo ahead of the recorded anchor.
      let applied = false;
      try {
        const ref = await ghJson(wizard.t, `/repos/${siteInfo.owner}/${siteInfo.name}/git/refs/heads/${siteInfo.defaultBranch}`);
        applied = ref.object.sha === commit.sha;
      } catch {
        applied = false;
      }
      if (!applied) await setAnchor(from).catch(() => {});
      throw err;
    }

    return json({
      ok: true,
      from,
      to,
      changed: status.changes.length,
      commit: commit.sha,
      deployUrl: `https://github.com/${site.repo}/actions`,
    });
  } catch (err) {
    return json({ error: `Update failed: ${String((err && err.message) || err)}` }, 502);
  }
}

async function siteBaseline(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  const wizard = await getWizard(request, env);
  if (!wizard) return json({ error: 'Connect GitHub to set a baseline.', connectUrl: '/auth/github' }, 401);
  // Same GitHub-budget family as check/update (~7 calls) — cap it the same way.
  if (!(await kvRateLimit(env, 'site-baseline', canonicalizeEmail(session.sub), await getLimit(env, 'rl.site_check_max', RL.siteCheck), await getLimit(env, 'rl.site_window', RL.siteWindow)))) {
    return rateLimited('site-baseline', 'Too many baseline requests — try again in a few minutes.');
  }
  const { origin } = await request.json().catch(() => ({}));
  const site = await getSiteByOrigin(env, origin);
  if (!site) return json({ error: 'unknown site' }, 404);
  if (site.owner_email !== session.sub) return json({ error: 'not your site' }, 403);

  try {
    const current = await templateMainSha(env, wizard.t);

    // Baseline is only accepted when the site's core actually matches the current
    // template — never silently assumed clean. A dirty baseline is rejected and
    // the user is pointed at the content-transfer escape hatch.
    const siteInfo = await siteRepoInfo(wizard.t, site.repo);
    const { owner: tplOwner, name: tplName } = templateParts(env);
    const [siteTree, tplTree] = await Promise.all([
      repoTree(wizard.t, siteInfo.owner, siteInfo.name, siteInfo.headSha),
      repoTree(wizard.t, tplOwner, tplName, current),
    ]);
    const [siteCfgB64, tplCfgB64] = await Promise.all([
      fileContentBase64(wizard.t, siteInfo.owner, siteInfo.name, CONFIG_YML_PATH, siteInfo.headSha),
      fileContentBase64(wizard.t, tplOwner, tplName, CONFIG_YML_PATH, current),
    ]);
    const fit = classifyFitness({
      templateTree: tplTree,
      siteTree,
      templateConfigYml: tplCfgB64 ? b64decode(tplCfgB64) : '',
      siteConfigYml: siteCfgB64 ? b64decode(siteCfgB64) : '',
    });
    if (!fit.clean) {
      return json({
        ok: false,
        error: 'Baseline rejected — your site\'s core differs from the current template. Resolve the drift or start fresh and bring your content over.',
        drifted: fit.drifted,
      }, 409);
    }

    await env.DB.prepare('UPDATE sites SET template_version = ? WHERE origin = ?').bind(current, origin).run();
    return json({ ok: true, templateVersion: current });
  } catch (err) {
    return json({ error: `Could not set the baseline: ${String((err && err.message) || err)}` }, 502);
  }
}

// ---------------------------------------------------------------------------
// Site decommissioning — end-to-end delete (repo, Pages project, DNS, registry)

async function siteDelete(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  const wizard = await getWizard(request, env);
  if (!wizard) return json({ error: 'Connect GitHub to delete your site.', connectUrl: '/auth/github' }, 401);
  if (!(await kvRateLimit(env, 'site-delete', canonicalizeEmail(session.sub), await getLimit(env, 'rl.site_update_max', RL.siteUpdate), await getLimit(env, 'rl.site_window', RL.siteWindow)))) {
    return rateLimited('site-delete', 'Too many delete requests — try again in a few minutes.');
  }

  const { origin, cfToken, confirm } = await request.json().catch(() => ({}));
  const site = await getSiteByOrigin(env, origin);
  if (!site) return json({ error: 'unknown site' }, 404);
  if (site.owner_email !== session.sub) return json({ error: 'not your site' }, 403);

  // The Pages project can only be removed with a CF token, which kantan never
  // stores (zero-knowledge) — the user re-supplies the one from provisioning.
  if (!cfToken) {
    return json({ error: 'Cloudflare API token required — the Pages project needs it to be deleted.', cfTokenRequired: true }, 400);
  }

  // The typed confirmation is validated server-side; a destructive action must
  // not trust the client to have checked it.
  const host = site.origin.replace(/^https:\/\//, '');
  if (confirm !== host) {
    return json({ error: 'Type the site address exactly to confirm deletion.', steps: [] }, 400);
  }

  const [owner, name] = site.repo.split('/');
  const accountId = site.account_id;
  const bare = (o) => String(o || '').replace(/^https:\/\//, '');
  const steps = [];
  const ok = (n, detail) => steps.push({ name: n, ok: true, detail });
  const fail = (n, detail) => steps.push({ name: n, ok: false, detail });

  // DELETE via the CF API, treating 404 (already gone) as success so a retried
  // or previously-partially-deleted resource never blocks a full delete.
  const deleteCf = async (path) => {
    try {
      await cf(cfToken, path, { method: 'DELETE' });
      return true;
    } catch (err) {
      if (String((err && err.message) || '').includes('(404)')) return true;
      throw err;
    }
  };

  try {
    // Tear down external resources first and the D1 row LAST, so a partial
    // failure leaves the registry record as the operator-visible marker of what
    // still exists to clean up.
    // 1. Branded DNS (operator token) — best-effort: the serving CNAME.
    if (site.origin.endsWith('.kantan-hp.fyi')) {
      try {
        const slug = host.replace('.kantan-hp.fyi', '');
        const records = await cf(env.CF_ZONE_DNS_TOKEN, `/zones/${CF_ZONE_ID}/dns_records?name=${encodeURIComponent(`${slug}.kantan-hp.fyi`)}`);
        for (const r of records || []) {
          await cf(env.CF_ZONE_DNS_TOKEN, `/zones/${CF_ZONE_ID}/dns_records/${r.id}`, { method: 'DELETE' });
        }
        ok('dns', `${slug}.kantan-hp.fyi records removed`);
      } catch (err) {
        fail('dns', String((err && err.message) || err));
      }
    }
    // 2. Detach custom + branded domains from the Pages project (user token).
    const attached = [];
    if (site.custom_domain) attached.push(bare(site.custom_domain));
    if (site.origin.endsWith('.kantan-hp.fyi')) attached.push(bare(site.origin));
    for (const domain of attached) {
      try {
        await deleteCf(`/accounts/${accountId}/pages/projects/${name}/domains/${domain}`);
        ok('domain-detach', domain);
      } catch (err) {
        fail('domain-detach', `${domain}: ${String((err && err.message) || err)}`);
      }
    }
    // 3. Pages project (user token).
    let projectDeleted = false;
    try {
      await deleteCf(`/accounts/${accountId}/pages/projects/${name}`);
      ok('pages-project', name);
      projectDeleted = true;
    } catch (err) {
      fail('pages-project', String((err && err.message) || err));
    }
    // 4. GitHub repo (wizard token). 404 = already gone, still success.
    let repoDeleted = false;
    try {
      const res = await gh(wizard.t, `/repos/${owner}/${name}`, { method: 'DELETE' });
      if (res.status === 204 || res.status === 404) {
        ok('repo', `${owner}/${name}`);
        repoDeleted = true;
      } else {
        throw new Error(`GitHub DELETE repo failed (${res.status})`);
      }
    } catch (err) {
      fail('repo', String((err && err.message) || err));
    }
    // 5. D1 registry row — last, and only once no external resource remains.
    //    If the Pages project or repo could not be removed, keep the row as the
    //    operator-visible marker of what still exists to clean up.
    if (projectDeleted && repoDeleted) {
      const del = await env.DB.prepare('DELETE FROM sites WHERE origin = ?').bind(site.origin).run();
      if ((del.meta && del.meta.changes) === 1) ok('registry', site.origin);
      else fail('registry', 'row not found');
    } else {
      fail('registry', 'kept — Pages project or repo still exists; retry after fixing the failed steps');
    }

    const allOk = steps.every((s) => s.ok);
    return json({
      ok: allOk,
      steps,
      remaining: steps.filter((s) => !s.ok).map((s) => s.name),
      ...(allOk ? {} : { error: 'Some resources could not be removed — see the step list.' }),
    });
  } catch (err) {
    return json({ error: `Delete failed: ${String((err && err.message) || err)}`, steps }, 502);
  }
}

// ---------------------------------------------------------------------------
// Content transfer — export the user data contract as a downloadable zip

async function siteExport(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: 'not logged in' }, 401);
  const wizard = await getWizard(request, env);
  if (!wizard) return json({ error: 'Connect GitHub to export your content.', connectUrl: '/auth/github' }, 401);
  if (!(await kvRateLimit(env, 'site-export', canonicalizeEmail(session.sub), await getLimit(env, 'rl.site_check_max', RL.siteCheck), await getLimit(env, 'rl.site_window', RL.siteWindow)))) {
    return rateLimited('site-export', 'Too many export requests — try again in a few minutes.');
  }
  const { origin } = await request.json().catch(() => ({}));
  const site = await getSiteByOrigin(env, origin);
  if (!site) return json({ error: 'unknown site' }, 404);
  if (site.owner_email !== session.sub) return json({ error: 'not your site' }, 403);

  try {
    const info = await siteRepoInfo(wizard.t, site.repo);
    const files = await readUserDataFiles(wizard.t, info.owner, info.name, info.headSha);
    const zip = buildZip(files);
    const slug = site.repo.split('/')[1];
    return new Response(zip, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${slug}-content.zip"`,
      },
    });
  } catch (err) {
    return json({ error: `Export failed: ${String((err && err.message) || err)}` }, 502);
  }
}

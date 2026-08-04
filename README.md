# kantan panel (MVP)

The kantan control plane — a single Cloudflare Worker behind `kantan-hp.fyi` that
turns [kantan-hp](https://github.com/kantan-hp/template) setup into:

1. **Welcome page** — a one-pager explaining kantan and the 3-step pitch.
2. **Email-only login** — no passwords, no GitHub login for the *panel*: a
   single-use magic link is emailed, and clicking it sets an HMAC-signed session
   cookie.
3. **Wizard or site table** — `/app` shows the setup wizard if you have no sites
   yet, or a table (name, created date, links to your live site and its `/admin`
   editor) once you do.
4. **One-click provisioning** — connect GitHub, paste a Cloudflare token, pick a
   name. The worker generates a repo from the template, creates a direct-upload
   Pages project, writes deploy secrets into *your own* repo, and points Decap at
   the panel's **shared auth proxy**.

## Why this works

- One GitHub OAuth App belongs to the *panel*, created once by the operator. Every
  user's site points Decap's `base_url` at the panel; the token handshake crosses
  origins via `postMessage` (the documented
  [external OAuth client](https://decapcms.org/docs/external-oauth-clients/) pattern).
- Sites deploy via **Direct Upload**: the template ships a `deploy.yml` GitHub
  Actions workflow that builds Astro and runs `wrangler pages deploy`. No
  GitHub↔Cloudflare account connection is ever needed, and every content edit in
  Decap (a commit) rebuilds automatically.
- GitHub's API is CORS-enabled, but Cloudflare's is not — that's why this worker
  exists instead of a pure client-side page.

## Storage — all inside Cloudflare

- **D1** (`DB`): the site registry, scoped by owner email. The only durable store.
- **KV** (`KV`): single-use magic-link codes + login rate limits. Nothing else.

No Postgres, no Supabase — the data is a few tables at most, and this keeps the
panel at effectively $0 and on one Cloudflare bill.

## Zero-knowledge posture

- The **panel session** cookie carries only `{sub: email}` — no tokens inside.
- The **wizard's GitHub token** lives in a separate short-lived
  `kantan_wizard_token` cookie (15 min), decoupled from the session, cleared the
  moment provisioning succeeds.
- The **Cloudflare token** is held in memory during provisioning, written into the
  *user's own repo* as Actions secrets (`CF_API_TOKEN`, `CF_ACCOUNT_ID`,
  `CF_PAGES_PROJECT`), then discarded. The panel stores nothing.
- **Magic-link codes** are single-use, 15-minute TTL, rate-limited (3 per email
  per 15 min).
- The Decap handshake posts tokens only to origins that are (a) `https://*.pages.dev`,
  (b) registered in D1, and (c) backed by a repo the token has push access to.

## Operator setup (one time, ~10 minutes)

Prereqs: Node 22+, a Cloudflare account, and `kantan-hp` access.

1. **Make the template a template repo** (once): repo → Settings → check
   **"Template repository"**. (`kantan-hp/template` already is.)
2. **Create the panel's GitHub OAuth App**:
   GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: `https://kantan-hp.fyi`
   - Authorization callback URL: `https://kantan-hp.fyi/oauth/callback`
   - (A second App points at `http://localhost:8787/oauth/callback` for local dev.)
3. **Provision the Worker resources**:
   ```sh
   npx wrangler kv namespace create KV     # paste id into wrangler.toml
   npx wrangler d1 create kantan-panel-db  # paste id into wrangler.toml
   npx wrangler d1 migrations apply kantan-panel-db --remote
   ```
4. **Set secrets**:
   ```sh
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET    # any long random string
   npx wrangler secret put RESEND_API_KEY    # free tier is fine
   npx wrangler secret put EMAIL_FROM        # e.g. noreply@kantan-hp.fyi
   ```
5. **Enforce https on the zone** (dash.cloudflare.com → kantan-hp.fyi → SSL/TLS):
   - Edge Certificates → **Always Use HTTPS** → On (301 http→https at the edge).
   - Edge Certificates → **Automatic HTTPS Rewrites** → On.
   - Edge Certificates → **HSTS** → On, Max Age `31536000`, Include Subdomains On.
   - This matters because GitHub OAuth callback URLs are registered for `https://`
     only, and mobile browsers won't auto-upgrade a plain-http request — the
     worker's `redirect_uri` is derived from the request origin.
6. **Deploy**: `npm run deploy` (routes `kantan-hp.fyi/*` to the worker).

For local development: `cp .dev.vars.example .dev.vars`, fill it in, `npm run dev`.
Without `RESEND_API_KEY` the login page prints the magic link on screen instead of
emailing it, so the whole flow is testable locally with zero setup.

## What users need

- Just an email address to sign in.
- For the wizard: a GitHub account and a Cloudflare account with **one API token**
  (dash.cloudflare.com → My Profile → API Tokens → Create Custom Token) carrying
  **Cloudflare Pages: Edit** and **Account Settings: Read** — the read permission
  lets the panel detect the account automatically. Without it, the panel asks for
  the account ID instead.

## Versioned, fitness-gated updates

Every provisioned site is stamped with the `template_version` (the template `main`
SHA) it was generated from. The panel uses this anchor for a safe update path
(`2026-08-04-kantan-site-versioning-and-updates.md`):

- **Badge → check → update**: the site table shows **Up to date / Update available /
  Baseline needed**; a per-site action runs `/api/sites/check`, shows the file-level
  diff and any major bumps, then `/api/sites/update` applies it.
- **Fitness gate**: the site's core tree is compared (by blob SHA) to
  `template@recorded_version`. Modified or deleted core files make the site **dirty**
  and block updates with a drift report — no changes are made. Pure additions and all
  user data (`src/content/**`, `public/images/**`, `src/config.json`) are preserved.
- **Only green templates offered**: `/api/sites/update` refuses unless the template's
  own CI (`ci.yml`) is green on main, and major bumps (Astro/Sveltia) require an
  explicit confirm.
- **Zero-knowledge preserved**: all site-repo reads/writes use the short-lived wizard
  token from the same "Connect GitHub" handshake; the update runs on the site's own
  default branch and its existing `deploy.yml` rebuilds.
- **Baseline**: sites created before versioning (no `template_version`) get a
  "Baseline needed" badge; a baseline is only accepted when the core still matches the
  current template, so nothing is silently assumed clean.

Migration is applied with `npx wrangler d1 migrations apply kantan-panel-db --remote`.

## Known POC limitations

- Provisioning is one-shot; if it fails midway (e.g. name taken), clean up the
  half-created repo/project and retry. No resume yet.
- Multi-account Cloudflare tokens use the first account.
- Custom domains are not wired up (the Decap origin allowlist only accepts
  `*.pages.dev`).
- The email session can't be revoked server-side (stateless HMAC cookie); logout
  clears the cookie.

# kantan panel (POC)

A proof-of-concept control panel that turns [kantan-hp](https://github.com/lavasecurity/kantan-hp)
setup into a three-step wizard:

1. **Login with GitHub** — one OAuth click (the panel's own OAuth App; users never
   create one).
2. **Paste a Cloudflare API token** — used once, never stored (see below).
3. **Pick a site name** → click **Create my website**.

The worker then provisions everything: a repo generated from the kantan-hp template,
a direct-upload Cloudflare Pages project, deploy secrets written into the repo, and
Decap CMS pointed at the panel's **shared auth proxy** — so the per-site GitHub OAuth
App dance disappears entirely.

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

## Security notes (POC)

- The GitHub token lives only in an HMAC-signed `HttpOnly` session cookie.
- The Cloudflare token is held in memory during provisioning, written into the
  *user's own repo* as Actions secrets (`CF_API_TOKEN`, `CF_ACCOUNT_ID`), then
  discarded. The panel stores nothing.
- KV stores only site metadata (`origin → {owner, repo, project, createdAt}`) —
  it powers the site list and the Decap origin allowlist.
- The Decap handshake posts tokens only to origins that are (a) `https://*.pages.dev`,
  (b) registered in KV, and (c) backed by a repo the token has push access to.

## Operator setup (one time, ~10 minutes)

Prereqs: Node 22+, a Cloudflare account, and `kantan-hp` access.

1. **Make kantan-hp a template repo**: repo → Settings → check **"Template repository"**.
2. **Create the panel's GitHub OAuth App**:
   GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: `https://<your-worker>.workers.dev`
   - Authorization callback URL: `https://<your-worker>.workers.dev/oauth/callback`
3. **Install & configure**:
   ```sh
   npm install
   npx wrangler kv namespace create SITES   # paste the id into wrangler.toml
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET    # any long random string
   ```
4. **Deploy**: `npm run deploy`

For local development: `cp .dev.vars.example .dev.vars`, fill it in, `npm run dev`.
(The OAuth App's callback URL must match the origin you log in through, so local
OAuth testing needs a second OAuth App pointing at `http://localhost:8787/oauth/callback`.)

## What users need

- A GitHub account.
- A Cloudflare account and **one API token** with the *Cloudflare Pages: Edit*
  permission (dash.cloudflare.com → My Profile → API Tokens → Create Custom Token).

## Known POC limitations

- Provisioning is one-shot; if it fails midway (e.g. name taken), clean up the
  half-created repo/project and retry. No resume yet.
- Multi-account Cloudflare tokens use the first account.
- Custom domains are not wired up (the Decap origin allowlist only accepts
  `*.pages.dev`).
- Later: proper accounts/login for the panel, key management UI, resume/idempotent
  provisioning, custom domains.

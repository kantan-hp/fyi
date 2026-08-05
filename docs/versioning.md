# Kantan site versioning — model and how to check it

This is the canonical reference for **where** kantan site versioning lives and **how to
check** a site's upgrade state. It captures decisions shipped in
`2026-08-04-kantan-site-versioning-and-updates.md` and
`2026-08-04-kantan-panel-more-info-upgrade-check.md`; nothing here changes behavior.

## Where versioning lives

- **The anchor is `sites.template_version` in D1** (the panel's `kantan-panel-db`). It is
  a TEXT column holding the template `main` commit SHA the site's core was provisioned
  from. Only the panel writes it — at provision (`INSERT`), on a verified update, and on
  an explicit baseline. See `migrations/0002_template_version.sql`.
- **Sites carry no version doc or marker file.** A repo file would be user-editable and
  could be faked to claim "clean". The integrity anchor is therefore server-side: **clean**
  is defined as *the site's core file tree byte-matches `template@recorded_version`*,
  compared by blob SHA via the GitHub tree API.
- **"Latest" is the template repo** `kantan-hp/template` `main`, gated on its own CI
  (`ci.yml`: `npm run check` + `npm run build` must pass). Updates are only offered for a
  green template revision.

### The user data contract

The following paths are owned entirely by the user and **never touched by updates**:

- `src/content/**` — blog posts and pages (Markdown)
- `public/images/**` — uploaded media
- `src/config.json` — site settings

Everything else is **core** and versioned. `public/admin/config.yml` is core except its
backend lines (`repo` / `base_url` / `auth_endpoint`), which are re-injected on every
update so the site's editor login is never orphaned.

## How to check a site's state

1. **Panel UI** — site row → **More info** → **Upgradable?**:
   - `yes` — deterministically upgradable (clean, no collisions, template CI green,
     newer version available)
   - `no` — up to date (clean, already current)
   - `N/A` — dirty / collision / template CI red / repo unreadable / legacy (with a
     specific reason)
   - `[check]` — needs a GitHub connect first (one connect covers all sites for the
     15-minute wizard-token window)
2. **API** — `POST /api/sites/check` with body `{ "origin": "https://<site>.pages.dev" }`
   and a short-lived wizard token returns
   `{ upgradeable, reason, drifted?, changes?, from, to, … }`. The write path is
   `POST /api/sites/update` (applies the core diff, re-injects `config.yml` backend
   lines, commits on the site's default branch, advances `template_version`).
3. **D1 directly** (operator):
   ```sql
   SELECT origin, owner_email, template_version, repo FROM sites;
   ```
   Compare each `template_version` to the template's current `main` (below).
4. **Template current revision**:
   ```sh
   curl -s https://api.github.com/repos/kantan-hp/template/git/ref/heads/main
   # → .object.sha is the current template main
   ```
   The panel caches this in KV under `template:main-sha` (5-minute TTL).

## Where the code lives

- `src/lib.js` — `classifyFitness`, `diffCoreTrees`, `upgradeState`,
  `reinjectConfigBackend`, `detectMajorBumps`, `isUserDataPath`.
- `src/index.js` — `templateMainSha`, `siteVersionStatus`, `siteUpdateCheck`,
  `siteUpdate`, `siteBaseline`.
- `migrations/0002_template_version.sql` — the D1 column.

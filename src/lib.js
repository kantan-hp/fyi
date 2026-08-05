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

/** Branded subdomain suffix for every provisioned site's canonical origin. */
export const BRANDED_SUFFIX = '.kantan-hp.fyi';

/** Default Cloudflare Pages domain suffix, kept as the deploy_url. */
export const PAGES_SUFFIX = '.pages.dev';

/** True for https origins on pages.dev or kantan-hp.fyi (provisioned sites). */
export function isAllowedSiteOrigin(origin) {
  try {
    const u = new URL(origin);
    return (
      u.protocol === 'https:' &&
      (u.hostname.endsWith(PAGES_SUFFIX) || u.hostname.endsWith(BRANDED_SUFFIX))
    );
  } catch {
    return false;
  }
}

/** The canonical origin a provisioned site is reachable at: https://<slug>.kantan-hp.fyi. */
export function canonicalOrigin(slug) {
  return `https://${slug}${BRANDED_SUFFIX}`;
}

/** Panel paths and trademark-ish words that only collide on the branded namespace. */
const RESERVED_SLUGS = new Set([
  'app', 'api', 'oauth', 'admin', 'mail', 'www', 'support', 'login', 'account',
  'docs', 'status', 'blog', 'dashboard', 'help', 'cdn', 'assets', 'files',
  'static', 'graphql', 'registry', 'security', 'abuse', 'about', 'terms',
  'privacy', 'billing', 'events', 'explore',
]);

/** Brand family: exact kantan words + common typos (case handled separately). */
const BRAND_SLUGS = new Set([
  'kantan', 'kantan-hp', 'kantan-hp-fyi', 'kantan-app', 'kantan-blog',
  'kantan-cms', 'api-kantan', 'kantan-api', 'blog', 'explore',
  'kanntan', 'kantaan', 'kanta-hp', 'kantanhp', 'kanta-hp-fyi',
]);

/**
 * Brand squat guard for ANY namespace: the kantan brand (substring) or an exact
 * brand word/typo. Applied on every provisioning path — a kantan-brand squat is
 * a squat whether or not the branded box is checked.
 */
export function isBrandSlug(slug) {
  const s = String(slug || '').toLowerCase();
  return s.includes('kantan') || BRAND_SLUGS.has(s);
}

/**
 * Full denylist for the branded *.kantan-hp.fyi namespace: brand squat guard
 * plus panel-path words that would collide with panel routes on the apex.
 * The D1 reserved_slugs table (seeded by migration 0003) is an additional,
 * deploy-less-updatable check done in index.js for branded provisioning.
 */
export function isReservedSlug(slug) {
  return isBrandSlug(slug) || RESERVED_SLUGS.has(String(slug || '').toLowerCase());
}

/** Subdomain slugs must be 4–32 chars. */
export function slugLengthOk(slug) {
  return slug.length >= 4 && slug.length <= 32;
}

/** Lowercase + trim an email address for storage/lookup. */
export function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

/**
 * Canonicalize an email for per-email rate-limit keys so aliases can't fork
 * counters. Builds on normalizeEmail, then collapses Gmail/Googlemail aliases:
 * dots in the local part and any +tag suffix are stripped (both are ignored by
 * Gmail delivery). Non-Gmail addresses pass through apart from trim/lowercase.
 */
export function canonicalizeEmail(input) {
  const email = normalizeEmail(input);
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return email;
  const plus = local.indexOf('+');
  const base = plus === -1 ? local : local.slice(0, plus);
  return `${base.replace(/\./g, '')}@${domain}`;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** N random bytes as hex — magic-link codes. */
export function randomHex(bytes = 16) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  let out = '';
  for (const b of buf) out += b.toString(16).padStart(2, '0');
  return out;
}

// ---------------------------------------------------------------------------
// Site versioning — the user data contract, the fitness gate, and the update
// diff. Pure so they can be unit-tested without the GitHub API.
//
// The user data contract (never overwritten by an update):
//   - src/content/**        (posts + pages, Markdown)
//   - public/images/**      (uploaded media)
//   - src/config.json       (site settings)
// Everything else is core and versioned per site via sites.template_version.

/** True for paths owned entirely by the user (never touched by an update). */
export function isUserDataPath(path) {
  return (
    path === 'src/config.json' ||
    path.startsWith('src/content/') ||
    path.startsWith('public/images/')
  );
}

/** True for the site-specific editor config, whose backend lines are re-injected. */
export const CONFIG_YML_PATH = 'public/admin/config.yml';

/** Strip site-specific backend lines so a site's config.yml can be compared to the template's. */
export function normalizeConfigYml(content) {
  return String(content || '')
    .split('\n')
    .filter((line) => !/^\s*(repo|base_url|auth_endpoint):/.test(line))
    .join('\n');
}

/** Turn a GitHub tree (array of {path, type, sha, mode}) into {path: sha} for blobs. */
export function treeToBlobMap(tree) {
  const map = {};
  for (const entry of tree || []) {
    if (entry.type === 'blob') map[entry.path] = entry.sha;
  }
  return map;
}

/**
 * Classify a site as clean or dirty relative to template@recordedVersion.
 * Clean = every core file byte-matches the template (blob SHA equality is a
 * content hash, so no history or content fetch is needed). Pure *additions* are
 * tolerated; modifications or deletions of core files mark the site dirty.
 * config.yml is compared modulo its site-specific backend lines.
 */
export function classifyFitness({ templateTree, siteTree, templateConfigYml, siteConfigYml }) {
  const tpl = treeToBlobMap(templateTree);
  const site = treeToBlobMap(siteTree);
  const drifted = [];
  for (const [path, sha] of Object.entries(tpl)) {
    if (isUserDataPath(path) || path === CONFIG_YML_PATH) continue;
    if (!(path in site)) {
      drifted.push({ path, kind: 'deleted' });
    } else if (site[path] !== sha) {
      drifted.push({ path, kind: 'modified' });
    }
  }
  if (normalizeConfigYml(templateConfigYml) !== normalizeConfigYml(siteConfigYml)) {
    drifted.push({ path: CONFIG_YML_PATH, kind: 'modified' });
  }
  return { clean: drifted.length === 0, drifted };
}

/**
 * The core-path diff between two template trees (from → to), for the update
 * engine. User data is never included. config.yml is included as modified when
 * its non-backend content changed.
 */
export function diffCoreTrees({ fromTree, toTree, fromConfigYml, toConfigYml }) {
  const from = treeToBlobMap(fromTree);
  const to = treeToBlobMap(toTree);
  const changes = [];
  const allPaths = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const path of allPaths) {
    if (isUserDataPath(path) || path === CONFIG_YML_PATH) continue;
    const fromSha = from[path];
    const toSha = to[path];
    if (fromSha && !toSha) changes.push({ path, status: 'deleted' });
    else if (!fromSha && toSha) changes.push({ path, status: 'added' });
    else if (fromSha !== toSha) changes.push({ path, status: 'modified' });
  }
  if (normalizeConfigYml(fromConfigYml) !== normalizeConfigYml(toConfigYml)) {
    changes.push({ path: CONFIG_YML_PATH, status: 'modified' });
  }
  return changes;
}

/** Take template@N+1 config.yml and re-inject the site's own backend lines. */
export function reinjectConfigBackend(templateConfigYml, siteConfigYml) {
  const grab = (cfg, key) => {
    const m = String(cfg || '').match(new RegExp(`^[ \\t]*${key}:\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1] : null;
  };
  const repo = grab(siteConfigYml, 'repo');
  const baseUrl = grab(siteConfigYml, 'base_url');
  const authEndpoint = grab(siteConfigYml, 'auth_endpoint');
  let out = String(templateConfigYml || '');

  // Replace an existing line, or insert it after `anchor` (kept otherwise).
  const setOrInsert = (content, key, value, anchor) => {
    const re = new RegExp(`^([ \\t]*)${key}:.*$`, 'm');
    if (re.test(content)) return content.replace(re, `$1${key}: ${value}`);
    const anchorRe = new RegExp(`^([ \\t]*)${anchor}:.*$`, 'm');
    const m = content.match(anchorRe);
    if (m) {
      const indent = m[1];
      return content.replace(anchorRe, (line) => `${line}\n${indent}${key}: ${value}`);
    }
    return content;
  };

  if (repo) out = setOrInsert(out, 'repo', repo, 'name');
  if (baseUrl) out = setOrInsert(out, 'base_url', baseUrl, 'branch');
  // Ensure auth_endpoint is present whenever the site had base_url (a shared
  // proxy site needs both; the template may carry base_url without the
  // auth_endpoint line).
  if (authEndpoint) out = setOrInsert(out, 'auth_endpoint', authEndpoint, 'base_url');
  return out;
}

// Matches the major in a bare version or a common semver range/comparator
// (^7.1.6, ~7.0.0, >=7.0.0, v2.0, 7.x …). Grabbing the first digit sequence
// after any comparator prefix is enough for major-bump detection.
const MAJOR_RE = /(?:^|[^\d.])v?(\d+)/;

/** The major of a semver string or range, or null. */
export function majorOf(version) {
  const m = MAJOR_RE.exec(String(version || ''));
  return m ? Number(m[1]) : null;
}

/** The astro dependency major from a package.json blob. */
export function astroMajorOf(packageJson) {
  try {
    const pkg = JSON.parse(packageJson || '{}');
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return majorOf(deps.astro ?? deps['@astrojs/check']);
  } catch {
    return null;
  }
}

/** The Sveltia CMS major from public/admin/index.html (@sveltia/cms@X.Y.Z). */
export function sveltiaMajorOf(adminHtml) {
  const m = /@sveltia\/cms@(\d+)/.exec(String(adminHtml || ''));
  return m ? Number(m[1]) : null;
}

/**
 * Detect major bumps between two template revisions. Returns the set of changed
 * majors so the panel can require an explicit user confirm even on clean sites.
 */
export function detectMajorBumps({ fromPackageJson, toPackageJson, fromAdminHtml, toAdminHtml }) {
  const bumps = [];
  const astroFrom = astroMajorOf(fromPackageJson);
  const astroTo = astroMajorOf(toPackageJson);
  if (astroFrom != null && astroTo != null && astroFrom !== astroTo) {
    bumps.push(`Astro ${astroFrom} → ${astroTo}`);
  }
  const sveltiaFrom = sveltiaMajorOf(fromAdminHtml);
  const sveltiaTo = sveltiaMajorOf(toAdminHtml);
  if (sveltiaFrom != null && sveltiaTo != null && sveltiaFrom !== sveltiaTo) {
    bumps.push(`Sveltia CMS ${sveltiaFrom} → ${sveltiaTo}`);
  }
  return bumps;
}

/**
 * Map a siteVersionStatus result to the panel's deterministic upgrade state.
 * `yes` only when every gate passes (clean, no collisions, template CI green,
 * newer version); `no` when clean and already current; `N/A` for everything
 * else with a specific reason. Throwing reads (unreadable repo) are handled by
 * the endpoint, not here.
 */
export function upgradeState(status) {
  if (!status) return { state: 'N/A', reason: 'unreadable' };
  if (status.needsBaseline) return { state: 'N/A', reason: 'legacy' };
  if (status.upToDate) return { state: 'no', reason: null };
  if (status.fit === 'dirty') return { state: 'N/A', reason: 'dirty' };
  if (status.collisions && status.collisions.length) return { state: 'N/A', reason: 'collision' };
  if (status.ciGreen === false) return { state: 'N/A', reason: 'ci' };
  if (status.from && status.to && status.from !== status.to) return { state: 'yes', reason: null };
  return { state: 'no', reason: null };
}

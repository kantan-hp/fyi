-- Branded subdomains: sites move from https://<slug>.pages.dev to the canonical
-- https://<slug>.kantan-hp.fyi origin, with the pages.dev address recorded as
-- deploy_url. Existing sites keep their pages.dev origin (deploy_url stays NULL
-- until they are migrated). Applied once by the D1 migrations ledger
-- (ALTER TABLE ... ADD COLUMN is not re-runnable; only the CREATE/INSERT OR
-- IGNORE parts below are idempotent).
ALTER TABLE sites ADD COLUMN deploy_url TEXT;

-- Denylist of subdomain slugs no one may claim on the branded namespace:
-- reserved panel paths, kantan-brand words + typos, and trademark/impersonation
-- words. Checked at branded provisioning alongside the pure isReservedSlug()
-- helper in src/lib.js (which also enforces the kantan brand on every path).
-- Seeded with INSERT OR IGNORE so this migration can be re-run idempotently.
CREATE TABLE IF NOT EXISTS reserved_slugs (
  slug       TEXT PRIMARY KEY,  -- lowercased slug, no .kantan-hp.fyi suffix
  reason     TEXT NOT NULL,     -- 'panel-path' | 'brand' | 'brand-typo' | 'trademark'
  created_at TEXT NOT NULL
);

-- Panel paths that would collide with panel routes on the apex domain.
INSERT OR IGNORE INTO reserved_slugs (slug, reason, created_at) VALUES
  ('app',      'panel-path', datetime('now')),
  ('api',      'panel-path', datetime('now')),
  ('oauth',    'panel-path', datetime('now')),
  ('admin',    'panel-path', datetime('now')),
  ('mail',     'panel-path', datetime('now')),
  ('www',      'panel-path', datetime('now')),
  ('support',  'panel-path', datetime('now')),
  ('login',    'panel-path', datetime('now')),
  ('account',  'panel-path', datetime('now')),
  ('docs',     'panel-path', datetime('now')),
  ('status',   'panel-path', datetime('now')),
  ('dashboard','panel-path', datetime('now')),
  ('help',     'panel-path', datetime('now')),
  ('cdn',      'panel-path', datetime('now')),
  ('assets',   'panel-path', datetime('now')),
  ('files',    'panel-path', datetime('now')),
  ('static',   'panel-path', datetime('now')),
  ('graphql',  'panel-path', datetime('now')),
  ('registry', 'panel-path', datetime('now')),
  ('security', 'panel-path', datetime('now')),
  ('abuse',    'panel-path', datetime('now')),
  ('about',    'panel-path', datetime('now')),
  ('terms',    'panel-path', datetime('now')),
  ('privacy',  'panel-path', datetime('now')),
  ('billing',  'panel-path', datetime('now')),
  ('events',   'panel-path', datetime('now'));

-- Kantan brand lookalikes — the brand substring check already blocks slugs that
-- merely embed "kantan", but reserve the exact words (and common typos) for
-- clarity. Kept in sync with the pure RESERVED_SLUGS set in src/lib.js.
INSERT OR IGNORE INTO reserved_slugs (slug, reason, created_at) VALUES
  ('kantan',      'brand', datetime('now')),
  ('kantan-hp',   'brand', datetime('now')),
  ('kantan-hp-fyi', 'brand', datetime('now')),
  ('kantan-app',  'brand', datetime('now')),
  ('kantan-blog', 'brand', datetime('now')),
  ('kantan-cms',  'brand', datetime('now')),
  ('blog',        'brand', datetime('now')),
  ('explore',     'brand', datetime('now')),
  ('api-kantan',  'brand', datetime('now')),
  ('kantan-api',  'brand', datetime('now')),
  ('kanntan',     'brand-typo', datetime('now')),
  ('kantaan',     'brand-typo', datetime('now')),
  ('kanta-hp',    'brand-typo', datetime('now')),
  ('kantanhp',    'brand-typo', datetime('now')),
  ('kanta-hp-fyi','brand-typo', datetime('now'));

-- Trademark/impersonation names likely to be phished on a branded namespace.
-- This is a starting seed, editable in D1 without a deploy; the takedown plan
-- is the long-term defense-in-depth.
INSERT OR IGNORE INTO reserved_slugs (slug, reason, created_at) VALUES
  ('google', 'trademark', datetime('now')),
  ('apple',  'trademark', datetime('now')),
  ('paypal', 'trademark', datetime('now')),
  ('amazon', 'trademark', datetime('now')),
  ('microsoft', 'trademark', datetime('now')),
  ('netflix', 'trademark', datetime('now')),
  ('facebook', 'trademark', datetime('now')),
  ('twitter', 'trademark', datetime('now'));

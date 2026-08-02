-- Panel site registry. The only durable store the panel owns.
CREATE TABLE IF NOT EXISTS sites (
  origin      TEXT PRIMARY KEY,      -- https://<slug>.pages.dev
  owner_email TEXT NOT NULL,         -- panel session email (scopes the site list)
  owner_login TEXT NOT NULL,         -- GitHub login that owns the repo (Decap handshake)
  repo        TEXT NOT NULL,         -- ownerLogin/slug
  project     TEXT NOT NULL,         -- Cloudflare Pages project name
  account_id  TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_owner_email ON sites(owner_email);

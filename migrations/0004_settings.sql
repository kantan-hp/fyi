-- Operator tunables for the panel, read at request time so limits can change
-- without a deploy. This is a flat key/value table: values are opaque strings,
-- interpreted per-key by the code that reads them (e.g. numeric rate limits).
--
-- Defaults live in code (src/index.js); this table only holds overrides, so it
-- is intentionally NOT seeded. Operators insert rows to override a default:
--   INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES
--     ('rate_limit_magic_link_per_hour', '10', datetime('now'));
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,  -- tunable name, e.g. 'rate_limit_magic_link_per_hour'
  value      TEXT NOT NULL,     -- opaque string; parsed by the consuming code
  updated_at TEXT NOT NULL      -- datetime('now'); audit trail for overrides
);

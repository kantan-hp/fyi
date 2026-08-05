-- Operator tunables for the panel, read at request time so limits can change
-- without a deploy. This is a flat key/value table: values are opaque strings,
-- interpreted per-key by the code that reads them (e.g. numeric rate limits).
--
-- Defaults live in code (src/index.js); this table only holds overrides, so it
-- is intentionally NOT seeded. Operators insert rows to override a default
-- (keys are documented in the README "Rate limiting" section), e.g.:
--   INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES
--     ('rl.login_email_max', '5', datetime('now'));
-- An empty value (or a missing key) falls back to the code default; a numeric
-- value of '0' is a deliberate kill-switch (denies the limit entirely).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,  -- tunable name, e.g. 'rl.login_email_max'
  value      TEXT NOT NULL,     -- opaque string; parsed by the consuming code
  updated_at TEXT NOT NULL DEFAULT datetime('now')  -- audit trail for overrides
);

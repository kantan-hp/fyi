-- User-attached custom domains. A site may attach the user's own domain via
-- the wizard; the panel stores the https origin here so the editor handshake
-- (decapLookup) accepts it. NULL when the site has no custom domain.
ALTER TABLE sites ADD COLUMN custom_domain TEXT;

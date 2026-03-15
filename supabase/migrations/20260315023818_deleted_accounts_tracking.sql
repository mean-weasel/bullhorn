-- Track deleted account emails for re-registration cooldown (AC-3-002).
-- Prevents delete-and-recreate cycles to reset plan limits.

CREATE TABLE deleted_accounts (
  email text PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  can_reregister_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

-- No RLS — only queried by service role in API routes
ALTER TABLE deleted_accounts ENABLE ROW LEVEL SECURITY;

-- Clean up expired entries periodically (entries older than 30 days)
CREATE INDEX idx_deleted_accounts_reregister ON deleted_accounts(can_reregister_at);

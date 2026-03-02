-- Add 'ready' status for notification-first architecture
-- Posts transition: scheduled -> ready (via cron) -> published (manually)
ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'ready', 'publishing', 'published', 'failed', 'archived'));

-- Index for cron query: find scheduled posts due for notification
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_due
  ON posts (scheduled_at)
  WHERE status = 'scheduled';

-- Index for due-posts API: find posts ready for manual publishing
CREATE INDEX IF NOT EXISTS idx_posts_ready
  ON posts (updated_at DESC)
  WHERE status = 'ready';

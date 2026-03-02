-- Performance indexes for common query patterns
-- All tables filter by user_id + status or user_id + ordering columns

CREATE INDEX IF NOT EXISTS idx_posts_user_status ON posts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_user_scheduled ON posts (user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON campaigns (user_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_drafts_user_status ON blog_drafts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_launch_posts_user_id ON launch_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_remind ON reminders (user_id, remind_at);

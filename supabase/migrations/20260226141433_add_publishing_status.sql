-- Add 'publishing' status for posts being actively published
ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'archived'));

-- Add social_account_id to posts (which account to publish with)
ALTER TABLE posts ADD COLUMN social_account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL;

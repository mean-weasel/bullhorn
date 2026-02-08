-- Create reminders table for manual post/campaign reminders
CREATE TABLE reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  remind_at timestamptz NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own reminders
CREATE POLICY "Users can view own reminders"
  ON reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON reminders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Index for querying upcoming reminders efficiently
CREATE INDEX idx_reminders_user_remind_at ON reminders (user_id, remind_at)
  WHERE is_completed = false;

-- Index for post/campaign lookups
CREATE INDEX idx_reminders_post_id ON reminders (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_reminders_campaign_id ON reminders (campaign_id) WHERE campaign_id IS NOT NULL;

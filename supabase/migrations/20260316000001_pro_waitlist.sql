-- Pro waitlist: captures upgrade interest from free-tier users
CREATE TABLE pro_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  feature text NOT NULL DEFAULT 'auto_publish',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature)
);

-- RLS
ALTER TABLE pro_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can join waitlist"
  ON pro_waitlist FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own waitlist entries"
  ON pro_waitlist FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_pro_waitlist_user_id ON pro_waitlist(user_id);

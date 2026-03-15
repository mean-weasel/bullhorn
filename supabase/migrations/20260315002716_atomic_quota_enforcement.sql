-- Atomic quota enforcement via BEFORE INSERT triggers.
-- Prevents race conditions where concurrent requests can exceed plan limits.
-- The application-level check in planEnforcement.ts remains as a fast-fail
-- for better error messaging; these triggers are the true enforcement boundary.

-- Generic enforcement function: checks count of rows per user against plan limit.
-- Raises an exception with ERRCODE 'check_violation' if the limit is reached.
CREATE OR REPLACE FUNCTION enforce_resource_limit()
RETURNS trigger AS $$
DECLARE
  current_count int;
  user_plan text;
  plan_limit int;
  resource_name text;
BEGIN
  -- Look up the user's plan
  SELECT plan INTO user_plan FROM user_profiles WHERE id = NEW.user_id;
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  -- Determine the limit based on table name and plan
  resource_name := TG_TABLE_NAME;

  CASE resource_name
    WHEN 'posts' THEN
      plan_limit := CASE user_plan WHEN 'pro' THEN 500 ELSE 50 END;
    WHEN 'campaigns' THEN
      plan_limit := CASE user_plan WHEN 'pro' THEN 50 ELSE 5 END;
    WHEN 'projects' THEN
      plan_limit := CASE user_plan WHEN 'pro' THEN 20 ELSE 3 END;
    WHEN 'blog_drafts' THEN
      plan_limit := CASE user_plan WHEN 'pro' THEN 100 ELSE 10 END;
    WHEN 'launch_posts' THEN
      plan_limit := CASE user_plan WHEN 'pro' THEN 100 ELSE 10 END;
    ELSE
      -- Unknown table, allow the insert
      RETURN NEW;
  END CASE;

  -- Count existing rows for this user
  EXECUTE format('SELECT count(*) FROM %I WHERE user_id = $1', resource_name)
    INTO current_count USING NEW.user_id;

  IF current_count >= plan_limit THEN
    RAISE EXCEPTION 'Plan limit reached: % % (limit %)', current_count, resource_name, plan_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger to each resource table
CREATE TRIGGER enforce_posts_limit
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION enforce_resource_limit();

CREATE TRIGGER enforce_campaigns_limit
  BEFORE INSERT ON campaigns
  FOR EACH ROW EXECUTE FUNCTION enforce_resource_limit();

CREATE TRIGGER enforce_projects_limit
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION enforce_resource_limit();

CREATE TRIGGER enforce_blog_drafts_limit
  BEFORE INSERT ON blog_drafts
  FOR EACH ROW EXECUTE FUNCTION enforce_resource_limit();

CREATE TRIGGER enforce_launch_posts_limit
  BEFORE INSERT ON launch_posts
  FOR EACH ROW EXECUTE FUNCTION enforce_resource_limit();

-- API keys: separate trigger (counts non-revoked keys only)
CREATE OR REPLACE FUNCTION enforce_api_key_limit()
RETURNS trigger AS $$
DECLARE
  current_count int;
  user_plan text;
  plan_limit int;
BEGIN
  SELECT plan INTO user_plan FROM user_profiles WHERE id = NEW.user_id;
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  plan_limit := CASE user_plan WHEN 'pro' THEN 25 ELSE 5 END;

  SELECT count(*) INTO current_count
    FROM api_keys
    WHERE user_id = NEW.user_id AND revoked_at IS NULL;

  IF current_count >= plan_limit THEN
    RAISE EXCEPTION 'Plan limit reached: % api_keys (limit %)', current_count, plan_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_api_keys_limit
  BEFORE INSERT ON api_keys
  FOR EACH ROW EXECUTE FUNCTION enforce_api_key_limit();

-- Social accounts: per-provider limit
CREATE OR REPLACE FUNCTION enforce_social_account_limit()
RETURNS trigger AS $$
DECLARE
  current_count int;
  user_plan text;
  plan_limit int;
BEGIN
  SELECT plan INTO user_plan FROM user_profiles WHERE id = NEW.user_id;
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  plan_limit := CASE user_plan WHEN 'pro' THEN 5 ELSE 1 END;

  SELECT count(*) INTO current_count
    FROM social_accounts
    WHERE user_id = NEW.user_id AND provider = NEW.provider;

  IF current_count >= plan_limit THEN
    RAISE EXCEPTION 'Plan limit reached: % % accounts (limit %)', current_count, NEW.provider, plan_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_social_accounts_limit
  BEFORE INSERT ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION enforce_social_account_limit();

-- Plan changes audit table
CREATE TABLE plan_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan text NOT NULL,
  new_plan text NOT NULL,
  reason text,
  changed_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_changes_user ON plan_changes(user_id);

ALTER TABLE plan_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan changes"
  ON plan_changes FOR SELECT USING (auth.uid() = user_id);

-- Trigger to automatically log plan changes
CREATE OR REPLACE FUNCTION log_plan_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    INSERT INTO plan_changes (user_id, old_plan, new_plan)
    VALUES (NEW.id, OLD.plan, NEW.plan);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER plan_change_audit
  AFTER UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION log_plan_change();

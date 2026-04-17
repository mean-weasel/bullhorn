-- Update quota enforcement triggers to recognize the 'selfHosted' plan type.
-- Self-hosted deployments set user_profiles.plan = 'selfHosted' to bypass all
-- resource limits at the database level (matching the app-level bypass in
-- planEnforcement.ts).

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

  -- Self-hosted mode has no resource limits
  IF user_plan = 'selfHosted' THEN
    RETURN NEW;
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

-- Also update the API key trigger
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

  IF user_plan = 'selfHosted' THEN
    RETURN NEW;
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

-- Also update the social account trigger
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

  IF user_plan = 'selfHosted' THEN
    RETURN NEW;
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

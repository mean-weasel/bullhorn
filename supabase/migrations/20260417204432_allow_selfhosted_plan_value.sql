-- Allow 'selfHosted' as a valid plan value.
-- The original CHECK constraint only allowed 'free' and 'pro'.
-- Self-hosted deployments set plan = 'selfHosted' to bypass DB-level
-- quota enforcement triggers.

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_plan_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_plan_check CHECK (plan IN ('free', 'pro', 'selfHosted'));

-- Set the test user to pro plan for auto-publish testing.
-- Test user ID: 00000000-0000-0000-0000-000000000001 (defined in src/lib/auth.ts)
-- This is a no-op in production (the test user ID doesn't exist in prod).
UPDATE user_profiles
SET plan = 'pro', updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000001';

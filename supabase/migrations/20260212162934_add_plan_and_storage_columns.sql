-- Add plan column (default 'free') and storage tracking to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  ADD COLUMN storage_used_bytes bigint NOT NULL DEFAULT 0;

-- Set test user to pro
UPDATE user_profiles SET plan = 'pro' WHERE id = '00000000-0000-0000-0000-000000000001';

-- RPC to atomically increment storage
CREATE OR REPLACE FUNCTION increment_storage_used(user_id_param uuid, bytes_param bigint)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET storage_used_bytes = storage_used_bytes + bytes_param
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to atomically decrement storage (floor at 0)
CREATE OR REPLACE FUNCTION decrement_storage_used(user_id_param uuid, bytes_param bigint)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET storage_used_bytes = GREATEST(storage_used_bytes - bytes_param, 0)
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

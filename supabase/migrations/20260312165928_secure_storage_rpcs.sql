-- Add auth.uid() check to storage RPC functions
-- Prevents authenticated users from manipulating other users' storage counters
-- Allows service role callers (edge functions, cron) where auth.uid() is NULL

CREATE OR REPLACE FUNCTION increment_storage_used(user_id_param uuid, bytes_param bigint)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND user_id_param != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE user_profiles
  SET storage_used_bytes = storage_used_bytes + bytes_param
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_storage_used(user_id_param uuid, bytes_param bigint)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND user_id_param != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE user_profiles
  SET storage_used_bytes = GREATEST(storage_used_bytes - bytes_param, 0)
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix sync_status CHECK constraint to include 'pending_property_selection'
-- which is used during the OAuth callback flow
ALTER TABLE analytics_connections
  DROP CONSTRAINT IF EXISTS analytics_connections_sync_status_check;

ALTER TABLE analytics_connections
  ADD CONSTRAINT analytics_connections_sync_status_check
  CHECK (sync_status IN ('pending', 'pending_property_selection', 'syncing', 'success', 'error'));

-- Add 'paused' to campaign status CHECK constraint
-- TypeScript type CampaignStatus already includes 'paused'
ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('active', 'paused', 'completed', 'archived'));

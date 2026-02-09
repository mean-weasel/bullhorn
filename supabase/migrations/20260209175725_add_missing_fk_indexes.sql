-- Add index for campaigns.project_id foreign key.
-- Improves JOIN and WHERE performance when filtering campaigns by project.

CREATE INDEX IF NOT EXISTS campaigns_project_id_idx ON public.campaigns(project_id);

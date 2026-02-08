-- Notification preferences table for per-user email/push notification settings.
-- This stores preferences only; actual email sending is handled separately.

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_post_published boolean not null default true,
  email_post_failed boolean not null default true,
  email_weekly_digest boolean not null default false,
  email_campaign_reminder boolean not null default false,
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_user_id_key unique (user_id)
);

-- Index for fast lookup by user
create index idx_notification_preferences_user_id
  on public.notification_preferences(user_id);

-- Auto-update updated_at on row changes
create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row
  execute function update_updated_at();

-- RLS: users can only read/write their own notification preferences
alter table public.notification_preferences enable row level security;

create policy "Users can view own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can create own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

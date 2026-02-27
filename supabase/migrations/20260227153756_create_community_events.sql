create table community_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  platform text not null check (platform in ('twitter', 'linkedin', 'reddit')),
  target text,
  recurrence_rule text not null,
  recurrence_timezone text default 'UTC',
  suggested_post_type text,
  tags text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table community_events enable row level security;

create policy "Authenticated users can read community events"
  on community_events for select to authenticated using (true);

create index idx_community_events_platform_active
  on community_events (platform) where is_active = true;

create table user_event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_id uuid references community_events(id) on delete cascade not null,
  notify_hours_before integer default 24,
  auto_create_draft boolean default false,
  created_at timestamptz default now(),
  unique(user_id, event_id)
);

alter table user_event_subscriptions enable row level security;

create policy "Users can read own subscriptions"
  on user_event_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "Users can create own subscriptions"
  on user_event_subscriptions for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own subscriptions"
  on user_event_subscriptions for update to authenticated using (auth.uid() = user_id);
create policy "Users can delete own subscriptions"
  on user_event_subscriptions for delete to authenticated using (auth.uid() = user_id);

create index idx_user_event_subscriptions_user on user_event_subscriptions (user_id);

-- API Keys table for user-scoped authentication
-- Keys are SHA-256 hashed; the raw key is never persisted.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,          -- first 12 chars of raw key for display (e.g. "bh_a1b2c3d4")
  scopes text[] not null default '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_api_keys_user_id on public.api_keys(user_id);
create index idx_api_keys_key_hash on public.api_keys(key_hash);

-- Auto-update updated_at
create trigger api_keys_updated_at
  before update on public.api_keys
  for each row
  execute function update_updated_at();

-- RLS: users can only manage their own keys
alter table public.api_keys enable row level security;

create policy "Users can view own API keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

create policy "Users can create own API keys"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

create policy "Users can update own API keys"
  on public.api_keys for update
  using (auth.uid() = user_id);

create policy "Users can delete own API keys"
  on public.api_keys for delete
  using (auth.uid() = user_id);

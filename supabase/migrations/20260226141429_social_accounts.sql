-- Social media account connections (OAuth tokens)
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('twitter', 'linkedin', 'reddit')),

  -- Platform identity
  provider_account_id text not null,
  username text,
  display_name text,
  avatar_url text,

  -- OAuth tokens (encrypted at rest by Supabase)
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',

  -- Metadata
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  status_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(user_id, provider, provider_account_id)
);

-- Indexes
create index idx_social_accounts_user_id on social_accounts(user_id);
create index idx_social_accounts_provider on social_accounts(provider);
create index idx_social_accounts_status on social_accounts(status);

-- RLS
alter table social_accounts enable row level security;

create policy "Users can view own social accounts"
  on social_accounts for select using (auth.uid() = user_id);

create policy "Users can insert own social accounts"
  on social_accounts for insert with check (auth.uid() = user_id);

create policy "Users can update own social accounts"
  on social_accounts for update using (auth.uid() = user_id);

create policy "Users can delete own social accounts"
  on social_accounts for delete using (auth.uid() = user_id);

-- Auto-update trigger
create trigger social_accounts_updated_at
  before update on social_accounts
  for each row execute function update_updated_at();

-- Add FK from project_accounts to social_accounts (the TODO from migration 00005)
alter table project_accounts
  add constraint project_accounts_account_id_fkey
  foreign key (account_id) references social_accounts(id) on delete cascade;

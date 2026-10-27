-- Vieews schema. Server code uses the service-role key and filters by user_id itself;
-- RLS policies below cover the browser (Clerk session token via Supabase third-party auth),
-- which only touches Storage for direct uploads.

create type public.platform as enum ('youtube', 'instagram', 'tiktok');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  platform public.platform not null,
  platform_account_id text not null,
  username text,
  display_name text,
  avatar_url text,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'needs_reauth')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, platform_account_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  storage_path text not null unique,
  kind text not null check (kind in ('video', 'image')),
  mime text not null,
  size_bytes bigint not null default 0,
  width int,
  height int,
  duration_s numeric(10, 3),
  thumbnail_path text,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  caption text not null default '',
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  scheduled_for timestamptz,
  status text not null check (status in ('scheduled', 'publishing', 'published', 'partial', 'failed', 'canceled')),
  source text not null default 'web' check (source in ('web', 'mcp')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id text not null,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  platform public.platform not null,
  options jsonb not null,
  caption_override text,
  status text not null default 'pending'
    check (status in ('pending', 'uploading', 'processing', 'published', 'failed', 'canceled')),
  remote_id text,
  remote_url text,
  error text,
  attempts int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.social_accounts (user_id);
create index on public.media_assets (user_id, created_at desc);
create index on public.posts (user_id, created_at desc);
create index on public.posts (user_id, status, scheduled_for);
create index on public.post_targets (post_id);
create index on public.post_targets (social_account_id);
create index on public.api_keys (user_id);

create trigger social_accounts_updated before update on public.social_accounts
  for each row execute function public.set_updated_at();
create trigger posts_updated before update on public.posts
  for each row execute function public.set_updated_at();
create trigger post_targets_updated before update on public.post_targets
  for each row execute function public.set_updated_at();

-- RLS on everything. social_accounts and api_keys get no policies at all, so only the
-- service role can read them (they hold encrypted tokens and key hashes).
alter table public.social_accounts enable row level security;
alter table public.api_keys enable row level security;
alter table public.media_assets enable row level security;
alter table public.posts enable row level security;
alter table public.post_targets enable row level security;

create policy "own media" on public.media_assets for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "own posts" on public.posts for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy "own targets" on public.post_targets for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- Private media bucket; objects live under "<clerk user id>/...".
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
create policy "media read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
create policy "media update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));

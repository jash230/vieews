-- Projects (one per app a user promotes), accounts shared across projects, the copilot's
-- conversation per project, and a usage ledger for what each user costs.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  store_url text,
  platform_hint text check (platform_hint in ('ios', 'android', 'web')),
  -- Same shape as Ad Studio's app.md frontmatter, with media referenced by media_assets id.
  kit jsonb not null default '{}'::jsonb,
  notes text not null default '',
  icon_asset_id uuid references public.media_assets (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index on public.projects (user_id, created_at);
create trigger projects_updated before update on public.projects
  for each row execute function public.set_updated_at();

-- Screens, logo and photos an ad may use. `shows` says what's on it in plain words.
create table public.project_media (
  project_id uuid not null references public.projects (id) on delete cascade,
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  role text not null check (role in ('screen', 'logo', 'photo')),
  shows text not null default '',
  tags text[] not null default '{}',
  position int not null default 0,
  primary key (project_id, media_asset_id)
);

create index on public.project_media (media_asset_id);

-- An account is connected once per user and can post for any number of projects.
create table public.project_accounts (
  project_id uuid not null references public.projects (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, social_account_id)
);

create index on public.project_accounts (social_account_id);

alter table public.posts add column project_id uuid references public.projects (id) on delete set null;
create index on public.posts (user_id, project_id, created_at desc);

-- One running copilot conversation per project. `parts` holds text, tool calls/results and attachments.
create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.copilot_messages (project_id, created_at);

-- Outward-facing actions the copilot proposes (e.g. a post). Nothing runs until the user approves.
create table public.copilot_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  tool_use_id text not null unique,
  kind text not null check (kind in ('post')),
  input jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'failed')),
  result jsonb,
  -- Set once the copilot has been told how the user decided.
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index on public.copilot_proposals (project_id, created_at);

-- Every action that costs money. Tier limits and margin reports read from here.
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid references public.projects (id) on delete set null,
  kind text not null check (kind in ('llm', 'image', 'video', 'render', 'tts')),
  provider text not null,
  model text,
  units numeric not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  ref text,
  created_at timestamptz not null default now()
);

create index on public.usage_events (user_id, created_at);

alter table public.projects enable row level security;
alter table public.project_media enable row level security;
alter table public.project_accounts enable row level security;
alter table public.copilot_messages enable row level security;
alter table public.copilot_proposals enable row level security;
alter table public.usage_events enable row level security;

-- Existing users get a first project holding all their accounts and posts.
insert into public.projects (user_id, name, slug)
select distinct user_id, 'My app', 'my-app'
from (select user_id from public.social_accounts union select user_id from public.posts) u
on conflict (user_id, slug) do nothing;

insert into public.project_accounts (project_id, social_account_id, user_id)
select p.id, a.id, a.user_id
from public.social_accounts a
join public.projects p on p.user_id = a.user_id and p.slug = 'my-app'
on conflict do nothing;

update public.posts po
set project_id = p.id
from public.projects p
where p.user_id = po.user_id and p.slug = 'my-app' and po.project_id is null;

-- Photo carousels, ad campaign memory and media cleanup.

-- Every post's media in order. posts.media_asset_id stays the first item (the cover)
-- so single-media code paths and thumbnails keep working.
create table public.post_media (
  post_id uuid not null references public.posts (id) on delete cascade,
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  position int not null check (position >= 0),
  primary key (post_id, position)
);

insert into public.post_media (post_id, media_asset_id, position)
select id, media_asset_id, 0 from public.posts
on conflict do nothing;

create index on public.post_media (media_asset_id);
alter table public.post_media enable row level security;

-- Lets an agent (or the composer) group posts and remember what each one was,
-- e.g. campaign "ad-studio:myapp" with meta { format, angle, hook, ... }.
alter table public.posts
  add column campaign text,
  add column meta jsonb not null default '{}'::jsonb;

create index on public.posts (user_id, campaign, created_at desc) where campaign is not null;

-- Set when the stored file is deleted after publishing to free storage.
alter table public.media_assets add column purged_at timestamptz;

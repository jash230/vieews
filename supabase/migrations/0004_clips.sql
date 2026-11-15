-- Clipping: a job takes one long video (a link or an upload), finds its best moments and renders each
-- as a captioned 9:16 clip. Clips are ordinary media assets, so they post through the normal flow.

create table public.clip_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid references public.projects (id) on delete set null,
  source_url text,
  source_asset_id uuid references public.media_assets (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'downloading', 'transcribing', 'finding', 'rendering', 'ready', 'failed')),
  error text,
  -- Target clip length in seconds; the AI aims for it but follows natural sentence breaks.
  target_length_s integer not null default 45 check (target_length_s between 10 and 180),
  source_title text,
  source_duration_s numeric,
  -- Words with timings, [{ w, s, e }], used to time the captions.
  transcript jsonb,
  sandbox_name text,
  clips_total integer not null default 0,
  clips_done integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_url is not null or source_asset_id is not null)
);

create index on public.clip_jobs (user_id, created_at desc);

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.clip_jobs (id) on delete cascade,
  user_id text not null,
  media_asset_id uuid references public.media_assets (id) on delete set null,
  start_s numeric not null,
  end_s numeric not null,
  title text not null,
  hook text not null,
  caption text not null,
  score integer not null check (score between 0 and 100),
  reason text not null,
  created_at timestamptz not null default now()
);

create index on public.clips (job_id, score desc);
create index on public.clips (user_id);

alter table public.clip_jobs enable row level security;
alter table public.clips enable row level security;

-- Transcription is billed per audio minute, separately from tokens.
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check
  check (kind in ('llm', 'image', 'video', 'render', 'tts', 'transcribe'));

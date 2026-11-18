-- A live or over-2-hour link is clipped from its last 2 hours; this is where they start in the full video.
-- Null for everything else. Transcripts with an offset are never reused by a later job of the same link.
alter table public.clip_jobs add column source_offset_s numeric;

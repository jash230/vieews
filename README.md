# Vieews

Upload a video or photo once and publish it, now or on a schedule, to your YouTube, Instagram and TikTok accounts. Includes an MCP server so an AI agent (Claude Code, Claude Desktop, Cursor…) can upload and post for you.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Clerk · Supabase (Postgres + Storage) · Inngest · Vercel

Start with [SETUP.md](SETUP.md): it walks through every account and key you need.

## How it works

- **Upload**: the server hands the browser a one-time signed upload URL and the file goes straight to a private Supabase Storage bucket, so large videos never pass through a Vercel function.
- **Publish**: creating a post sends an Inngest event. `publish-post` waits until the scheduled time, then fans out one `publish-target` job per account. Each job streams the file to the platform in chunks (YouTube resumable upload, TikTok chunked FILE_UPLOAD) or hands Instagram a short-lived signed URL, polls processing, and records the live link. Every step is retried and resumable.
- **Accounts**: OAuth tokens are encrypted with AES-256-GCM before they're stored and refreshed automatically. Failed refreshes flag the account for reconnecting.
- **MCP**: `/api/mcp` exposes `list_accounts`, `get_platform_requirements`, `create_media_upload`, `finalize_media_upload`, `import_media_from_url`, `create_post`, `get_post`, `list_posts`, `cancel_post` and `retry_post_target`, authenticated with API keys you create in the app. Posts can be photo carousels (TikTok photo posts, Instagram carousels) and carry a `campaign` and `meta` so agents can find and learn from their past posts.
- **Cleanup**: a daily job deletes stored files 3 days after their posts publish (14 days for failed ones), so the free 1 GB of storage lasts.
- **Ad Studio**: [`ad-studio/`](ad-studio/README.md) has Claude make and post app ads on a schedule.

## Layout

```
src/app/(app)/            dashboard, compose, posts, accounts, settings (+ server actions)
src/app/api/connect/      OAuth start + callback per platform
src/app/api/inngest/      background job endpoint
src/app/api/mcp/          MCP server
src/lib/platforms/        one adapter per platform + shared limits/validation
src/lib/posts|media|accounts/  services shared by the UI and MCP tools
src/lib/inngest/          publish jobs
supabase/migrations/      schema, RLS, storage bucket
design-system/MASTER.md   UI tokens and rules
```

## Scripts

```bash
npm run dev         # app on :3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
npm test            # unit tests (adapters, validation, crypto)
npm run typecheck
npm run lint
npm run build
```

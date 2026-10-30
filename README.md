# Vieews

Marketing on autopilot for the apps you build. Each app is a **project**; a copilot docked beside the workspace knows the project and posts to your YouTube, Instagram and TikTok accounts, now or on a schedule, after you approve. Accounts are connected once and shared across projects. Includes an MCP server so an outside agent (Claude Code, Claude Desktop, Cursor…) can do the same.

The plan for the rest (in-site ad generation, autopilot posting N times a day, paid tiers, the video editor) is in [docs/superpowers/specs/2026-10-30-vieews-autopilot-design.md](docs/superpowers/specs/2026-10-30-vieews-autopilot-design.md).

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Clerk · Supabase (Postgres + Storage) · Inngest · Vercel

Start with [SETUP.md](SETUP.md): it walks through every account and key you need.

## How it works

- **Upload**: the server hands the browser a one-time signed upload URL and the file goes straight to a private Supabase Storage bucket, so large videos never pass through a Vercel function.
- **Publish**: creating a post sends an Inngest event. `publish-post` waits until the scheduled time, then fans out one `publish-target` job per account. Each job streams the file to the platform in chunks (YouTube resumable upload, TikTok chunked FILE_UPLOAD) or hands Instagram a short-lived signed URL, polls processing, and records the live link. Every step is retried and resumable.
- **Accounts**: OAuth tokens are encrypted with AES-256-GCM before they're stored and refreshed automatically. Failed refreshes flag the account for reconnecting.
- **MCP**: `/api/mcp` exposes `list_projects`, `get_project`, `list_accounts`, `get_platform_requirements`, `create_media_upload`, `finalize_media_upload`, `import_media_from_url`, `create_post`, `get_post`, `list_posts`, `cancel_post` and `retry_post_target`, authenticated with API keys you create in the app. Posts can be photo carousels (TikTok photo posts, Instagram carousels) and carry a `campaign` and `meta` so agents can find and learn from their past posts.
- **Projects**: one per app, created from a pasted App Store, Google Play or website link (`src/lib/projects/import.ts` reads the listing, Claude Haiku drafts the kit: audience, pains, claims ads may and may not make, CTA). Links users paste are fetched through `src/lib/net/safe-fetch.ts`, which refuses private network addresses on every redirect hop.
- **Copilot**: `/api/copilot` streams a Claude Sonnet turn with tools that wrap the same services as the UI and MCP (`src/lib/copilot/tools.ts`). Anything public (a post) becomes an approval card; nothing is posted until the user presses and holds Approve. Every model call is logged with its cost in `usage_events`.
- **Cleanup**: a daily job deletes stored files 3 days after their posts publish (14 days for failed ones), so the free 1 GB of storage lasts.
- **Ad Studio**: [`ad-studio/`](ad-studio/README.md) has Claude make and post app ads on a schedule.

## Layout

```
src/app/(app)/            dashboard, compose, posts, accounts, projects, settings (+ server actions)
src/app/api/copilot/      the copilot's streaming chat endpoint
src/components/copilot/   the docked chat panel, composer and approval cards
src/lib/copilot/          copilot tools, prompt, history and proposals
src/lib/projects/         projects, link import, current-project cookie
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

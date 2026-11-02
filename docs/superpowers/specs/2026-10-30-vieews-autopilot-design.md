# Vieews Autopilot — roadmap + Part 1 (Foundation + Copilot)

## Context
Vieews today: you upload a video, it posts to YouTube/Instagram/TikTok. Ad Studio (`ad-studio/`) makes ads, but only through Claude Code runs.
The new Vieews is **marketing on autopilot inside the website**, sold to paying users:
- **Projects** (one per app being promoted).
- An **AI copilot docked like Lovable's**. It knows the current project, generates ads, and lets you approve them, chat about them, or set the project to run N posts a day.
- **Social accounts** connected once and shared across projects.
- A **video editor** the copilot controls.
- **Paid tiers** ($20 / $50 / $100 / custom) through a payment provider that works for an Israel-based seller (not Stripe), with each user's cost kept under their tier price.
- **Platform audits** running in parallel.
- Built on the current UI and Clerk sign-in.

**Branch:** a new branch, `vieews-autopilot`, cut from `ad-studio`, which has the Ad Studio pipeline and carousels that aren't on `main` yet. *(You asked for a separate branch. The base and the name are my call.)*

## Roadmap
1. **Foundation + working copilot**: projects, shared accounts, every customer's data kept separate, usage ledger, the Lovable-style shell, and a copilot that can already set up projects and manage posts. ← *this plan*
2. **Generation + autopilot**: port Ad Studio's pipeline server-side (slideshows first, then Higgsfield video), approval queue, N per day per project. All of it exposed as new copilot tools. Open question for that brainstorm: where Remotion renders (Remotion Lambda vs Vercel Sandbox).
3. **Tiers and billing**: Paddle (merchant of record; Israel is on its supported list, onboarding still to be confirmed), with limits enforced from the usage ledger. Fallback: Grow or Cardcom, with tax handled by you.
4. **Video editor**: Remotion Player plus an ad "recipe" JSON that both you and the copilot edit.
5. **Platform audits** in parallel, starting now (last section).

Parts 2–4 each get their own short brainstorm and plan.

---

## Part 1a — Data and services

### Migration `supabase/migrations/0003_projects_copilot.sql`
Same conventions as before: RLS on, no policies, the server filters by `user_id`.
- `projects`: `id, user_id, name, slug (unique per user), store_url, platform_hint, kit jsonb, notes, icon_asset_id → media_assets, created_at, updated_at`, plus the updated_at trigger.
  - `kit` has the shape of Ad Studio's `kitSchema` (`ad-studio/studio/src/kit.ts`), with media referenced by `media_assets` id. That way Part 2 can feed it to the pipeline.
- `project_media`: `project_id, media_asset_id, role ('screen'|'logo'|'photo'), shows, tags text[], position`.
- `project_accounts`: `project_id, social_account_id, user_id`, with PK on the pair and cascade on both. This is the sharing.
- `posts.project_id → projects on delete set null`, plus an index on `(user_id, project_id, created_at desc)`.
- `copilot_messages`: `id, user_id, project_id (cascade), role ('user'|'assistant'), parts jsonb (text, tool calls and results, attachments), created_at`. One running conversation per project, like Lovable.
- `usage_events`: `id, user_id, project_id null, kind ('llm'|'image'|'video'|'render'|'tts'), provider, model, units, cost_usd numeric(12,6), ref, created_at`.
- **Backfill:** each existing user gets a "My app" project, with all of that user's accounts linked and all their posts assigned to it.

### Services (`userId` first, like `src/lib/accounts/service.ts`)
- `src/lib/projects/kit.ts`: zod `projectKitSchema`, adapted from `ad-studio/studio/src/kit.ts`.
- `src/lib/projects/service.ts`: `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `setProjectAccounts`, `listProjectAccounts`, `assertProjectOwner`.
- `src/lib/projects/import.ts`: turns a pasted link into a draft kit.
  - **App Store:** `itunes.apple.com/lookup?id=` (free, no key) returns the name, description, `artworkUrl512` and `screenshotUrls`.
  - **Play:** the `google-play-scraper` package (unofficial; falls back to the website path).
  - **Website:** `og:*` tags, the title and the icons.
  - Media is copied in with `importMediaFromUrl` (`src/lib/media/service.ts:159`).
- `src/lib/ai/`:
  - Anthropic provider config, with `ANTHROPIC_API_KEY` added to `src/lib/env.ts`.
  - `draftKit(listing)` on a cheap model (`claude-haiku-5-5`) with structured output.
  - Every model call writes `usage_events` from the token counts.
  - Load the `claude-api` skill before writing this code.
- `src/lib/usage/service.ts`: `recordUsage` and `usageSummary(userId, since)`.
- `createPost` (`src/lib/posts/service.ts:60`) takes a `projectId` and rejects accounts that aren't linked to that project.

### Security (now that there are many users)
- **Harden `importMediaFromUrl`.**
  - Resolve DNS and reject private, loopback and link-local addresses (v4 and v6).
  - Follow redirects manually, re-checking each hop.
  - Enforce the size cap while streaming.
- **Every project-scoped call runs `assertProjectOwner`.** Copilot tools receive the server-resolved `userId` and `projectId`, never ones taken from model output.
- **Update `README.md` and `SETUP.md`** for many users, and confirm sign-up is open in the Clerk dashboard.

---

## Part 1b — Lovable-style shell + copilot

### Layout (replaces the sidebar in `src/app/(app)/layout.tsx` and `src/components/app/nav.tsx`)
```
┌──────────────────────────────────────────────────────────┐
│ [▾ Tally app]   Dashboard  Posts  Compose  Accounts   (o)│  top bar
├───────────────────┬──────────────────────────────────────┤
│ Copilot [Tally ▾] │                                      │
│  messages…        │   workspace = today's pages          │
│  [tool cards]     │                                      │
│ [ message…     ⏎] │                                      │
└───────────────────┴──────────────────────────────────────┘
```
- **Top-left project dropdown:** switch projects, "New project", "Project settings".
- **Copilot panel docked on the left:** resizable and collapsible, with a project chip in its header that switches projects too. The dropdown and the chip stay in sync through the `vieews_project` cookie and `getCurrentProject(userId)`. The cookie is read inside Suspense because cacheComponents is on. *(A cookie keeps today's routes; my call.)*
- **Workspace on the right:** the existing pages (Dashboard, Posts, Compose, Accounts, AI & API keys) as top-bar tabs, scoped to the current project.
- **Mobile:** the workspace shows by default, and a floating "Copilot" button opens the chat full-screen.
- When the copilot changes something (posts, kit, accounts), the workspace refreshes (`router.refresh()`) so the change shows immediately.
- A user with no projects lands on a "New project" empty state, and the copilot greets them with "Paste your app's link".

### Copilot runtime
- `src/app/api/copilot/route.ts`: a streaming chat endpoint using the Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), `claude-sonnet-5-5`.
  - It authenticates with Clerk, resolves the project server-side, loads that project's history from `copilot_messages`, and saves both sides.
  - It logs usage per turn.
- The **system prompt** carries the project's kit (name, pitch, audience, claims allowed/banned, connected accounts) plus a short summary of recent posts.
- **Tools** in `src/lib/copilot/tools.ts` are thin wrappers over the same services the MCP server uses (`src/lib/mcp/server.ts`), so the two stay in sync:
  - `get_project`, `update_project` (kit fields), `create_project_from_link`, `list_accounts`, `set_project_accounts`
  - `list_posts`, `get_post`, `cancel_post`, `retry_post_target`, `get_platform_requirements`
  - `propose_post`: shows an **approval card**. Nothing is published until you click Approve, which then calls `createPost`. Anything outward-facing always goes through an approval card.
- **Attachments:** images and videos dropped into the composer upload through the existing signed-upload flow (`startUploadAction` / `finishUploadAction`). The copilot then receives their `media_asset` ids.

### UI components from 21st.dev
Fetched with the 21st MCP `get_component` (the free tier allows 2 a day; you can unlock more) and written into `src/components/copilot/`. They're restyled to the design system's tokens, Fredoka/Nunito fonts and `shadow-pop` (`design-system/MASTER.md`). There's no shadcn `components.json`, so the code is copied in rather than installed with `shadcn add`. In priority order:
1. **Agent Chat** (serafimcloud, id 12404): the chat shell (message list, composer, attachment chips, empty state).
2. **AI Tool Approval** (kokonutd, id 39558): the approve/deny card for `propose_post`. Its hold-to-confirm step is reused for destructive actions.
3. **Tool Call** (Alwurts / simple-ai, id 28282): a quiet collapsible row for each tool the copilot runs.
4. **Workspaces** (efferd, id 4511): a Radix-popover switcher with search, used for the top-left project dropdown.

Alternatives if one doesn't fit: Prompt Input (id 28187, composable, with a Stop button while streaming) and AI Input (id 28303, with agent and model chips that could become the project chip).

### Pages
- `/projects/new`: paste a link → preview of what was pulled → AI-drafted kit in an editable form → save. Below it, a "fill in manually" link.
- `/projects/[id]`: edit the kit and screenshots, tick which accounts post for this project, delete the project.
- `/accounts`: stays user-level and shows which projects use each account. Disconnecting warns which projects lose it.

### MCP
- New `list_projects` and `get_project` tools.
- `create_post` and `list_posts` accept an optional `projectId`, defaulting to the first project so the Ad Studio CLI keeps working.

---

## Platform audits (in parallel; you submit, I prepare)
- Public `/privacy` and `/terms` pages.
- `docs/audits/`:
  - **TikTok Content Posting audit:** a UX checklist against the composer.
  - **Google OAuth verification + YouTube API audit:** scope justification and the demo-video script.
  - **Meta App Review** (`instagram_business_content_publish`): business verification steps and the screencast script.

## Tests (vitest, `tests/helpers.ts` patterns)
- `projects.test.ts`: ownership isolation, account-linking rules, and `createPost` rejecting an account that isn't in the project.
- `import.test.ts`: App Store, Play and OG parsing from saved fixtures.
- `ssrf.test.ts`: private IPs, IPv6 loopback and redirect-to-private are all rejected.
- `copilot-tools.test.ts`: tools ignore a model-supplied `userId`/`projectId`, and `propose_post` never posts without approval.
- `usage.test.ts`: cost from token counts.

## Verification
1. `npm run lint && npm run typecheck && npm test`
2. Apply the migration to dev Supabase and check that the backfill created "My app" for existing data.
3. `preview_start` the dev server and check:
   - The top-left dropdown creates a project and switches between projects; the chat chip stays in sync.
   - Telling the copilot "here's my app: <App Store link>" builds the project, and `usage_events` rows appear.
   - Dropping a video in the chat and saying "post it to TikTok tonight at 8" shows an approval card. After Approve, the post appears in the Posts tab without a reload.
   - The same TikTok account linked to two projects; Compose shows only the current project's accounts.
   - Mobile width: the copilot opens full-screen from the floating button.
4. MCP: `list_projects`, and `create_post` with and without `projectId`.

## Housekeeping
- Update memory `vieews-project.md`: Vieews is now multi-user and paid, with a Lovable-style copilot.
- Save this design to `docs/superpowers/specs/2026-10-30-vieews-autopilot-design.md` on the new branch.

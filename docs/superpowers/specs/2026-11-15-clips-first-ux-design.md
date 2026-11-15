# Clips-first UI/UX pass (2026-11-15)

**Why:** The landing sells one job (paste a link → viral clips), but the signed-in app was still a cross-poster with 8 nav items, and free users got bounced to a bare plans page.

**Flow (decided by the user):** `/` is a paste-a-link box, like base44. Find clips while signed out → sign in → `/clips`. Without a plan, `/clips` shows a mock preview of the clips, and you have to subscribe to continue. Checkout returns to `/clips` and starts the waiting job.

**Goals**
- Nav: Dashboard, Clips, Posts, Accounts, Projects. Plans and AI & API keys move into the user menu. No loading animation when moving between pages (the nav's hopping dots are removed).
- `/clips` paywall: 3 locked 9:16 placeholder cards plus Clerk's `PricingTable` inline. No redirect.
- `/dashboard` is the account overview: account health (reauth, failed posts), stats including clips made, plan and today's usage, recent clip jobs, up next, recent posts, accounts.

**Non-goals:** a visual restyle, changes to the public landing, real free-preview processing (it costs AI money).

**Approaches considered:** (a) make Clips the home and retire the dashboard; (b) a new clips-first Home overview. The user chose neither as-is: keep `/dashboard` as a full account overview, and make `/` (public) plus `/clips` the paste-a-link entry.

**Builder's calls:** the placeholders are generic, with no video thumbnail. AI spend is not shown to users (it's our cost, not theirs).

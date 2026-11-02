# Google OAuth verification + YouTube API Services audit

Prepared 2026-10-30 from Google's developer docs (sources at the end). These are **two separate reviews**:

1. **OAuth app verification** (Google Auth Platform). Needed because the YouTube scopes are sensitive. Check the category Cloud Console shows next to each scope on the Data Access page.
2. **YouTube API Services compliance audit**. Needed to get more than the default quota, and possibly to lift the private-upload lock (see below).

## Why both matter

| Limit today | Source | Effect on Vieews |
|---|---|---|
| Testing status: only listed test users, and refresh tokens **expire after 7 days** | OAuth 2.0 docs, "Refresh token expiration" | Scheduled YouTube posts start failing with "reconnect" a week after each connect. |
| Unverified app in production: "unverified app" screen, **100 new users** max | Cloud help 7454865 | A hard cap on sign-ups that use YouTube. |
| Default quota: **100 `videos.insert` calls/day per project** (its own bucket since June 1, 2026), plus 10,000 units for everything else | YouTube Data API, getting started + revision history | **100 YouTube uploads a day across all Vieews users combined.** |
| Private lock for unverified API projects | **Google's docs conflict.** The 2020 revision note says uploads from unverified projects created after 28 July 2020 "will be restricted to private viewing mode" until an audit. The current `videos.insert` reference (updated 2026) says they "are not restricted to private viewing mode". | Test it: upload one **Public** video now. If YouTube locks it to private and emails the creator, the audit is what lifts it. |

## Before you submit

| # | Item | State | What to do |
|---|---|---|---|
| 1 | Homepage "hosted on a verified domain you own", verified in Search Console by a project Owner/Editor | ❌ | `vieews.vercel.app` is a subdomain of Vercel's domain. Buy a domain (e.g. `vieews.app`), point it at Vercel, verify it in Search Console, and add it to **Authorized domains**. Update the OAuth redirect URIs, TikTok and Meta settings, and `NEXT_PUBLIC_APP_URL`. |
| 2 | Homepage public, describes the app, not just a login page, and links the privacy policy | ❌ | Add a footer to `src/app/page.tsx` linking `/privacy` and `/terms`, and some product detail (the TikTok doc has the same item). |
| 3 | Privacy policy on the same domain, same URL on the homepage and the consent screen | ✅ | `/privacy`. It covers YouTube API Services, the Google Privacy Policy link, the security-settings revocation link and the Limited Use statement, as YouTube Developer Policies III.A.2 and the User Data Policy require. |
| 4 | Branding page filled in | To do | App name "Vieews", 120×120 logo (`design-system/app-icon-1024.png` scaled), support email, homepage, `/privacy`, `/terms`, authorized domain, developer contact. Publish branding, then request data access in the Verification Center. |
| 5 | Data Access page lists only what's used | To do | `youtube.upload`, `youtube.readonly` (`src/lib/platforms/youtube.ts:6`). If Clerk's Google sign-in uses this same Cloud project, `openid`, `email` and `profile` appear too; they are non-sensitive. |
| 6 | Users agree to the privacy policy before using features (Developer Policies III.A.2) | ⚠️ | In Clerk, turn on **Legal → require express consent** with the `/terms` and `/privacy` URLs. Also link Privacy/Terms from the app shell so the policy is "accessible to users at all times". |
| 7 | Link to the YouTube Terms of Service where users post (III.A.1) | ⚠️ | Add under the composer's YouTube section: "By uploading, you agree to YouTube's [Terms of Service](https://www.youtube.com/t/terms)." |
| 8 | **Revoke the token programmatically on disconnect** (III.D.2.c) | ❌ | `disconnectAccount` (`src/lib/accounts/service.ts`) only deletes the row. For YouTube, first `POST https://oauth2.googleapis.com/revoke?token=<refresh token>`. |
| 9 | Delete Authorized Data within 7 days of an in-app disconnect, or within 30 days of a revoke made on Google's side; check periodically that tokens still work | ❌ | Tokens and profile go with the row. But `post_targets.remote_id`/`remote_url` (YouTube video IDs) stay: clear them for that account on disconnect. Add a daily cron that deletes YouTube accounts stuck in `needs_reauth` for 30 days. |
| 10 | Stored API data refreshed or deleted every 30 days (III.E.4) | ❌ | Same cron: re-fetch `channels.list` (1 unit) for YouTube accounts not updated in 25 days, and clear `remote_url`/`remote_id` on YouTube targets older than 30 days (or re-check them with `videos.list`). |
| 11 | User data deleted within 7 days of a deletion request | ⚠️ | `/privacy` promises this by email. Write a `deleteUserData(userId)` script or admin action that removes every table's rows and storage files, and revokes tokens. |
| 12 | Required Minimum Functionality for uploads | ✅ mostly | Title (required, 100 max) ✅. Privacy picker public/unlisted/private ✅. Select/deselect platforms ✅. Channel shown in the account picker ✅. Description is the YouTube caption tab; label it **Description** so reviewers find it ⚠️. |
| 13 | No uploads without the user's "prior specific and express consent" (I.2, III.C) | ✅ / ⚠️ | Publish button and copilot approval cards ✅. Autopilot must keep per-post approval (same as TikTok). |
| 14 | Handle `quotaExceeded` | ⚠️ | A 403 `quotaExceeded` currently fails the post. Reschedule it after midnight Pacific instead, and tell the user why. |

## Scope justification (paste into the Verification Center)

**`https://www.googleapis.com/auth/youtube.upload`**

> Vieews is a cross-posting tool for creators. When a user publishes or schedules a post and selects their YouTube channel, Vieews uploads that video with `videos.insert` (resumable upload). It sends exactly the title, description, tags, privacy status (public, unlisted or private, chosen by the user), "made for kids" and altered/synthetic-content flags the user entered. Vieews then shows the user the resulting video link. This is the app's core feature. `youtube.upload` is the narrowest scope that permits uploading. Broader scopes (`youtube`, `youtube.force-ssl`) would let us edit or delete the user's videos, which we don't do.

**`https://www.googleapis.com/auth/youtube.readonly`**

> Right after the user connects YouTube, Vieews calls `channels.list?part=snippet&mine=true` once to read the channel's ID, title, handle and thumbnail. We show them in the account picker so the user always sees which channel a video will be posted to, and so we can tell users whose Google account has no channel to create one first. `youtube.upload` doesn't cover reading channel details, and `youtube.readonly` is the narrowest read scope. We don't read the user's videos, comments, subscribers or analytics.

## Demo video (OAuth verification)

Google's rules:

- Upload it to YouTube as **Unlisted**.
- Show the full OAuth flow **in English** (switch the language selector at the bottom-left of the consent screen).
- Show the app name on the consent screen.
- Show the **OAuth client ID in the address bar**.
- Show every sensitive scope in use.

Script (about 3 minutes, 1080p, address bar visible):

1. **0:00**: Open the homepage on the verified domain. Scroll to the footer and open **Privacy** to show the YouTube/Google section.
2. **0:20**: Sign in to Vieews. Go to **Accounts** → **Connect YouTube**.
3. **0:30**: On Google's screen:
   - pause on the address bar and zoom in on `client_id=…`;
   - show the language set to English;
   - pick the test account;
   - show the consent screen with "Vieews" and both YouTube permissions, then **Continue**.

   Caption: "OAuth consent: youtube.upload + youtube.readonly."
4. **1:00**: Back on Accounts, the channel's name and avatar appear. Caption: "youtube.readonly: channels.list to show which channel is connected."
5. **1:15**: **Compose**:
   - upload a vertical video;
   - select only the YouTube channel;
   - write a description;
   - in YouTube settings, type a title, choose **Public**, leave "Made for kids" off, and show the "Altered or synthetic content" switch.
6. **1:50**: Click **Publish**. On the post page YouTube goes Uploading → Published. Click **View** to open the video on YouTube and show the same title, description and visibility. Caption: "youtube.upload: videos.insert with the user's chosen values."
7. **2:30**: Back on Accounts, click **Disconnect**. Then open `myaccount.google.com/permissions` to show Vieews' access is gone (needs item 8). Caption: "Users can revoke access at any time."

## YouTube API Services audit and quota extension

- **Form:** https://support.google.com/youtube/contact/yt_api_form. It's the same form for the first audit, more quota and periodic audits. Appeals: https://support.google.com/youtube/contact/yt_api_appeals.
- **Contents:** the form loads its fields with JavaScript, so we couldn't read them without signing in. Prepare:
  - the Cloud project number;
  - the homepage, `/privacy` and `/terms` URLs;
  - a short use-case description (reuse the scope justification);
  - the demo video above;
  - a reviewer test account (a Vieews login plus a Google test account with a channel);
  - expected daily volume.
- **Quota math:** each publish uses 1 `videos.insert` call from the 100/day bucket. `channels.list` costs 1 unit from the 10,000 bucket, once per connect plus the 30-day refreshes. Ask for uploads per day ≈ expected paying users × average YouTube posts per user per day × 1.5 headroom. Example: 300 users × 2 = 600 → ask for 1,000. Daily quota resets at midnight Pacific.
- **Before submitting:** fix items 6–11 above. Auditors check the Developer Policies, especially revocation, the 30-day refresh and deletion rules, and the privacy-policy links.
- **Ongoing:** YouTube may ask for periodic audits. Changing who controls the company requires the change-of-control form.

## Sources

- Sensitive scope verification (homepage, privacy policy, demo video, Verification Center): https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- Verification requirements: https://support.google.com/cloud/answer/13464321
- When verification is needed: https://support.google.com/cloud/answer/13463073
- Unverified apps (100-user cap): https://support.google.com/cloud/answer/7454865
- Refresh token expiry in Testing (7 days) and the 100-token limit: https://developers.google.com/identity/protocols/oauth2
- Google API Services User Data Policy (Limited Use): https://developers.google.com/terms/api-services-user-data-policy
- YouTube API Services Developer Policies (III.A privacy policy, III.D revocation, III.E storage): https://developers.google.com/youtube/terms/developer-policies
- YouTube API Services Terms of Service: https://developers.google.com/youtube/terms/api-services-terms-of-service
- Required Minimum Functionality: https://developers.google.com/youtube/terms/required-minimum-functionality
- Quota and compliance audits: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
- Default quota: https://developers.google.com/youtube/v3/getting-started
- Quota costs: https://developers.google.com/youtube/v3/determine_quota_cost
- `videos.insert` (quota bucket, privacyStatus note): https://developers.google.com/youtube/v3/docs/videos/insert
- Revision history (June 1, 2026 granular quota; July 28, 2020 private lock): https://developers.google.com/youtube/v3/revision_history

# TikTok Content Posting API audit

Prepared 2026-10-30 from TikTok's developer docs (sources at the end). You submit it; this file is the checklist, the gaps to fix first, draft answers and the demo-video script.

## What the audit unlocks

Today Vieews is an **unaudited** Direct Post client. TikTok's limits for that:

- Every post is forced to `SELF_ONLY` ("Only me"), whatever the user picks.
- At most **5 users** can post through Vieews in any 24-hour window.
- The posting account must be set to **private** at the time of posting. Otherwise `/publish/video/init/` returns `403 unaudited_client_can_only_post_to_private_accounts`.

Passing the audit lifts all three. Two limits stay after it:

- Each creator can post about **15 times a day** through Direct Post, shared across every app (`spam_risk_too_many_posts`).
- Vieews as a whole has a daily cap on active publishing users (`reached_active_user_cap`).

## Before you submit

| # | Item | State | What to do |
|---|---|---|---|
| 1 | Privacy Policy and Terms of Service live, on the same site as the app | ✅ | `/privacy` and `/terms` (this change). |
| 2 | Privacy and Terms **links visible on the homepage without opening a menu** | ❌ | The landing page (`src/app/page.tsx`) has no footer. Add a footer with links to `/privacy` and `/terms`. TikTok's app-review guidelines list this as a rejection reason. |
| 3 | Website URL is "a fully developed site", **not a landing page or a login page** | ⚠️ | `vieews.vercel.app` is a one-screen landing page whose only way in is sign-in. Reviewers may read it as a landing page. Before you submit, give it real content: a features section, pricing (once paid tiers exist), the footer links and a contact address. A custom domain (see the Google doc) also helps. |
| 4 | App name matches the product and doesn't name a social network | ✅ | "Vieews". Keep the icon free of TikTok's logo or colors. |
| 5 | Not "a utility tool to help upload contents to the account(s) you or your team manages" | ✅ (now) | This was true of single-user Vieews. The multi-user product fixes it. Describe Vieews as a public product for creators and app makers (draft answers below). |
| 6 | **Only the scopes you use** | ❌ | `src/lib/platforms/tiktok.ts:8` requests `video.upload`, but Vieews only uses Direct Post (`video.publish`); `video.upload` is for sending drafts to the TikTok inbox. TikTok wants every selected scope shown in the demo video, and says unneeded scopes delay review. Remove `video.upload` from `SCOPES` and from the Content Posting API product settings in the dev portal. Update the TikTok row on `/privacy`. Existing connections keep working, since `video.publish` is all that's needed. |
| 7 | URL prefix verified for photo posts (`PULL_FROM_URL`) | ✅ | `/media/tt/` serves TikTok's signature file (`src/app/media/tt/[token]/route.ts`, `TIKTOK_URL_VERIFICATION_*`). Re-verify if the domain changes. |
| 8 | Redirect URI registered for the production domain | ✅ | `https://vieews.vercel.app/api/connect/tiktok/callback`. Add the new one if you move to a custom domain. |
| 9 | Demo-video account is **private** | To do | Needed while unaudited (see above). TikTok also disables Duet and Stitch on private accounts, so those toggles show greyed out in the recording. That's expected. |

## Direct Post UX checklist

Every requirement from TikTok's *Content Sharing Guidelines* (Direct Post UX), checked against the composer (`src/app/(app)/compose/composer.tsx`) and the TikTok adapter (`src/lib/platforms/tiktok.ts`). Line numbers are as of this commit.

### 1. Creator info

| Requirement | Vieews today | State |
|---|---|---|
| Call `creator_info/query` each time the post page renders, and use the latest values | Fetched per selected account on page load (`composer.tsx:174-181`), then re-checked server-side right before every upload (`tiktok.ts:157`). | ✅ |
| Show the creator's nickname so the user knows which account the post goes to | "Posting as *nickname*" (`composer.tsx:563`). | ✅ |
| If the creator can't post now, stop and tell them to try again later | `spam_risk_too_many_posts` and `spam_risk_user_banned_from_posting` come back as an error. That error blocks Publish (`composer.tsx:279`), but the text shown is TikTok's raw message ("TikTok creator info failed: …"). | ⚠️ Map these codes to plain text: "TikTok isn't letting this account post right now. Try again later." |
| Check video length against `max_video_post_duration_sec` | Client-side (`composer.tsx:187` → `validateMedia`) and server-side (`tiktok.ts:162`). | ✅ |

### 2. Post metadata

| Requirement | Vieews today | State |
|---|---|---|
| Title: user can enter it | The caption is the TikTok title (videos). For photos, the title is the caption's first line, cut to 90 characters (`photoPostBody`). The user can edit both through the caption. | ✅ |
| Privacy: options come from `privacy_level_options` | The dropdown lists the options common to all selected TikTok accounts (`composer.tsx:184-186, 566-574`). | ✅ |
| Privacy: **no default**, user must pick | Starts at a disabled "Choose…" option with value `""`. Publish stays blocked until a value is picked. | ✅ |
| Allow Comment / Duet / Stitch: greyed out when the creator turned them off in TikTok | `disabled={tiktokLocked.*}` (`composer.tsx:577-579`). | ✅ |
| Allow Comment / Duet / Stitch: **none checked by default**, user turns each on | All three start **on**: `disableComment/Duet/Stitch: false` (`composer.tsx:149-158`). | ❌ Start them at `true` (i.e. unchecked), so a post sends `disable_*: true` unless the user opts in. |
| Photo posts show **only "Allow Comment"** | Duet and Stitch are shown for photos too (`composer.tsx:578-579`). The adapter already ignores them for photos. | ❌ Wrap the Duet and Stitch switches in `{!isPhotos && …}`. |

### 3. Commercial content disclosure

| Requirement | Vieews today | State |
|---|---|---|
| A content-disclosure toggle, **off by default** | "Disclose commercial content" switch, off (`composer.tsx:586`). | ✅ |
| When on, show "Your brand" and "Branded content"; both can be ticked | Two checkboxes (`composer.tsx:587-602`). | ✅ |
| Toggle on and nothing ticked → Publish disabled | Blocker "TikTok: choose what kind of commercial content this is." (`composer.tsx:274`). | ✅ |
| …with the notice "You need to indicate if your content promotes yourself, a third party, or both." | Different wording, and only in the blocker list. | ⚠️ Use TikTok's sentence, as a hint under the toggle and as the Publish button's tooltip while blocked. |
| Prompt the label it will get: "Your photo/video will be labeled as 'Promotional content'" (Your brand only) or "…'Paid partnership'" (Branded content, or both) | Static captions under each checkbox ("Labeled 'Promotional content'."). Nothing tells the user that ticking both gives "Paid partnership". | ⚠️ Replace them with one live line under the checkboxes, computed from the selection and media type (photo/video). |
| Branded content can't be private: "Only me" disabled, with the hover text "Branded content visibility cannot be set to private." | "Only me" is disabled, and an existing "Only me" choice is cleared when Branded content is ticked (`composer.tsx:570, 598`). A disabled `<option>` can't show a tooltip, and no other text explains it. | ⚠️ Show TikTok's sentence as the privacy field's hint whenever Branded content is ticked. |

### 4. Consent declaration before Publish

| Requirement | Vieews today | State |
|---|---|---|
| No commercial content, or Your brand only: "By posting, you agree to TikTok's Music Usage Confirmation" (linked) | Shown above the publish card (`composer.tsx:605-609`). | ✅ |
| Branded content (alone or with Your brand): "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation" (both linked) | The Branded Content Policy link is added when Branded content is ticked. | ✅ |

### 5. User awareness and control

| Requirement | Vieews today | State |
|---|---|---|
| Preview of the content | Phone-frame preview of the video or cover photo, with the caption (`composer.tsx:619-643`). | ✅ |
| No watermarks, logos, brand names, links or promo text added | Vieews posts the file untouched. Ads made with the copilot or Ad Studio carry the *user's* app branding, which is their own content, never Vieews'. | ✅ |
| Preset text (title, hashtags) editable before posting | Composer: yes. Copilot drafts: the approval card must let the user edit the caption before approving (Part 1b approval card). | ⚠️ Confirm when the copilot ships. |
| Send content only after the user explicitly agrees | Publish / Schedule button, or Approve on a copilot card. | ✅ for now. ⚠️ See "Autopilot" below. |
| Tell users it may take a few minutes to process and appear on their profile | Shown before posting ("It may take a few minutes for the video to appear on your profile."). It says "video" for photo posts too. Nothing is shown after posting. | ⚠️ Say "post", and repeat the line on the post page (`/posts/[id]`) while the TikTok target is `processing`. |
| Poll publish status so users see what happened | `status/fetch` every 15 s for up to 10 minutes (`tiktok.ts:247-270`). The result and errors are shown on the post page. | ✅ |
| AI-generated content label (`is_aigc`) | A toggle exists (`composer.tsx:583`). Not required by the checklist, but reviewers like it. | ✅ |

### What to fix before recording the demo

1. Interaction switches start unchecked (`disableComment/Duet/Stitch: true` in the initial `tt` state).
2. Hide Duet and Stitch for photo posts.
3. Use TikTok's exact sentences:
   - the commercial toggle's "You need to indicate if your content promotes yourself, a third party, or both.";
   - a live "Your photo/video will be labeled as '…'" line;
   - "Branded content visibility cannot be set to private." under the privacy field.
4. Friendly text for `spam_risk_*` creator-info errors.
5. A "may take a few minutes" notice on the post page while TikTok is processing, and "post" instead of "video" for photos.
6. Drop the `video.upload` scope.
7. Add the homepage footer links to `/privacy` and `/terms`.
8. Remove "Until TikTok audits your app, only 'Only me' will succeed." (`composer.tsx:566`) and the matching line on the Accounts page (`src/app/(app)/accounts/page.tsx:20`) for the recording. It invites the question "is this app finished?". Put them back behind a flag if you need them for other users meanwhile.

## Policy risks to settle before you submit

- **Autopilot.** TikTok: "API Clients must only start sending content materials to TikTok after the user has expressly consent to the upload." The planned "N posts a day" autopilot (Part 2) must not post anything to TikTok that the user hasn't approved one by one. A queue of approved posts that publish on a schedule is fine. Posts generated and sent without review are not. Leave autopilot out of the demo unless it has per-post approval.
- **"Copies arbitrary contents from other platforms to TikTok"** is listed as unacceptable. Vieews uploads the user's own files once and sends them to several platforms. That's fine, but say it that way. Don't demo `import_media_from_url` pulling a video from another site.
- **Daily cap.** About 15 posts per creator per day across all apps. The copilot shouldn't schedule more than that, and should show `spam_risk_too_many_posts` as "TikTok's daily limit for this account is reached".

## Draft answers for the application

**App description**

> Vieews is a web app for creators and indie app makers to publish short videos and photo carousels to TikTok, YouTube and Instagram from one place. A user uploads their own video or photos once, writes a caption, picks each platform's settings (on TikTok: who can view, interaction settings, commercial-content disclosure and AI labels), previews the post and publishes it now or at a time they choose. Vieews then shows each platform's result. An AI copilot helps users plan and draft posts for the app they promote, and nothing is published until the user reviews and approves it.

**How Vieews uses each product and scope**

- **Login Kit, `user.info.basic`**: when a user connects TikTok, Vieews reads their open ID, display name and avatar. It uses them to show the connected account on the Accounts page and in the composer's account picker, so the user knows which account they are posting to.
- **Content Posting API (Direct Post), `video.publish`**: when the user clicks Publish (or the scheduled time arrives for a post they scheduled), Vieews:
  1. queries `creator_info` to show the creator's nickname, the privacy options the creator can choose, and their interaction settings;
  2. checks the video length against `max_video_post_duration_sec`;
  3. uploads the file with `FILE_UPLOAD`, or posts photos with `PULL_FROM_URL` from Vieews' verified domain;
  4. sends exactly the caption, privacy level, interaction toggles, commercial-content and AI-content flags the user picked;
  5. polls the publish status and shows the result on the post's page.

  Vieews never adds watermarks or text, and never posts without the user's action.

## Demo-video script

Constraints from TikTok:

- Up to 5 videos, 50 MB each.
- At least one shows the complete end-to-end flow.
- Every selected product and scope is visible.
- The UI and interactions are clearly visible.
- The domain in the address bar matches the website URL in the application.
- Apps not yet approved for the product record against the sandbox.

Record at 1080p with the browser's address bar visible. No audio needed; add short captions in an editor if a step isn't obvious. Use a TikTok test account set to **private**, and a short vertical original video (no copyrighted music).

**Video 1: connect and post a video (about 3 minutes)**

| Time | On screen | Caption to add |
|---|---|---|
| 0:00 | `https://vieews.vercel.app` homepage. Scroll to the footer; click **Privacy** and **Terms**, then go back. | "Vieews: post once to TikTok, YouTube and Instagram." |
| 0:15 | Sign in. Open **Accounts**, click **Connect TikTok**. | |
| 0:25 | TikTok's authorization page: the app name, the requested permissions (`user.info.basic`, `video.publish`), then **Authorize**. | "The user grants Login Kit and Direct Post permissions." |
| 0:40 | Back on Accounts: the TikTok account with display name and avatar. | "user.info.basic: shows which account is connected." |
| 0:50 | **Compose**: drag in the video. Show the upload bar and the phone preview. | |
| 1:05 | Account picker: only the TikTok account selected. Type a caption with a hashtag. | |
| 1:15 | TikTok settings: | |
| | - "Posting as *nickname*". | "Creator info is fetched fresh every time this page opens." |
| | - Open **Who can view this video**: no default; the options come from creator info. Pick one. | "No default privacy; options from privacy_level_options." |
| | - The interaction switches are all off. Turn on **Allow comments**. Duet and Stitch are greyed out because the creator turned them off (a private account). | |
| 1:45 | Turn on **Disclose commercial content**: Publish disables and the notice appears. | |
| | - Tick **Your brand**: the label line reads "Promotional content". | |
| | - Tick **Branded content**: the label changes to "Paid partnership", **Only me** greys out with its notice, and the declaration adds the Branded Content Policy. | |
| | - Untick both and turn the toggle off. | "Commercial content disclosure." |
| 2:20 | Point at the declaration: "By posting, you agree to TikTok's Music Usage Confirmation", and the processing notice. Click **Publish to 1 account**. | "The user explicitly confirms the upload." |
| 2:30 | Post page: TikTok goes Uploading → Processing → Published, with the "may take a few minutes" notice. Click **View** next to TikTok. | "Publish status is polled and shown to the user." |
| 2:50 | The post open on TikTok (web or phone). | |

**Video 2: photo carousel (about 1 minute).** Upload 3 JPEG photos, select TikTok, and show:

- only **Allow comments**, with no Duet or Stitch;
- the **Add recommended music** switch;
- the privacy picker;
- the declaration.

Publish, then show the result.

**Video 3 (only if the copilot is live): approval flow (about 1 minute).**

1. Ask the copilot to post a video to TikTok.
2. Show the approval card with an editable caption and TikTok settings.
3. Edit the caption and click **Approve**.
4. Show the post page.

Caption: "The AI never posts without the user's approval."

## After approval

- Remove the "until TikTok audits your app" hints and let the TikTok account picker offer every privacy option.
- Monitor `privacy_level_option_mismatch` errors. TikTok says repeated mismatches suggest the app is breaking its guidelines.

## Sources

- Content Sharing Guidelines (Direct Post UX, unaudited limits, unacceptable use cases): https://developers.tiktok.com/doc/content-sharing-guidelines
- Content Posting API, get started (private-only until audited, audit link): https://developers.tiktok.com/doc/content-posting-api-get-started
- Direct Post API reference (fields, error codes, rate limits): https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- Photo post reference (`auto_add_music`, `PULL_FROM_URL`, URL ownership): https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
- Query creator info reference: https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info
- App review guidelines (website, privacy/terms links, scopes, demo video rules): https://developers.tiktok.com/doc/app-review-guidelines
- Audit application (needs a developer-portal login): https://developers.tiktok.com/application/content-posting-api
- TikTok Developer Terms of Service: https://www.tiktok.com/legal/tik-tok-developer-terms-of-service?lang=en
- Music Usage Confirmation: https://www.tiktok.com/legal/page/global/music-usage-confirmation/en
- Branded Content Policy: https://www.tiktok.com/legal/page/global/bc-policy/en

# Meta App Review: Instagram content publishing

Prepared 2026-10-30 from Meta's developer docs (sources at the end). Vieews uses the **Instagram API with Instagram Login** (`graph.instagram.com`). It requests `instagram_business_basic` and `instagram_business_content_publish` (`src/lib/platforms/instagram.ts:6`).

## What you need and why

- **Standard Access** (today) only works for Instagram accounts with a role on the app. Meta's App Review table puts Vieews in the "Tech Provider serving multiple businesses" row, which requires **Advanced Access** for both permissions.
- **Advanced Access requires App Review and Business Verification** (Instagram Platform overview, "Access levels" and "Business verification").
- **Access Verification is retired.** Meta's notice of October 9, 2026 says it's no longer required, so you don't need Tech Provider access verification.
- **Permission name.** The overview and OAuth scopes use `instagram_business_content_publish`, which matches the code. The App Review page lists it as `instagram_business_content_publishing`. They are the same permission: pick the one the dashboard shows.

## Step 1: Business Verification

Only a Business Admin can do this. Meta checks your business's legal identity.

1. In the App Dashboard: **Settings → Basic → Verification → Start Verification**. Connect the app to a Business portfolio (create one if needed).
2. If the portfolio isn't verified yet, click **Start Business Verification**. This opens Meta Business Manager (Security Center).
3. Provide:
   - the business's **legal name**, address, phone and website. The website should show the same name, e.g. in the Terms footer.
   - an official document showing the legal name and address, such as a business registration certificate (in Israel, an *osek* registration or company certificate from the Registrar), a tax certificate, or a utility bill in the business's name. The document list is in Meta's help article linked below.
4. Confirm by email, phone or domain. **Domain verification** works best with the custom domain from the Google doc: add the DNS TXT record Meta gives you.
5. Wait for approval (usually days), then come back to **Settings → Basic** and check the app shows a verified Business.

Until then, the App Review flow prompts for verification at "Step 1.5", and users without a role on the app can't grant permissions.

## Step 2: Settings to finish first

| # | Item | State | What to do |
|---|---|---|---|
| 1 | App icon 1024×1024, no Meta or Instagram logos | ✅ | `design-system/app-icon-1024.png`. |
| 2 | Privacy Policy URL | ✅ | `https://<domain>/privacy`. It's shown to users on Meta's login screen. |
| 3 | Terms URL, category ("Business and pages" or "Utility & productivity"), business email | To do | Set them in **Settings → Basic**. |
| 4 | **Data deletion**: the privacy policy must tell users how to request deletion | ✅ | `/privacy#delete-your-data`. Put this URL in **Settings → Basic → User data deletion → Data deletion instructions URL**. |
| 5 | Instagram **Business login settings**: Deauthorize callback URL and Data deletion request URL | ❌ | Neither route exists. Add `POST /api/instagram/deauthorize` and `POST /api/instagram/data-deletion`. Each one: verify the `signed_request`, delete that Instagram user's `social_accounts` row and their targets' remote data, and (deletion only) return `{ url, confirmation_code }` with a status page. |
| 6 | At least **one successful API call per permission within 30 days** before submitting | To do | Connect an Instagram test account and publish one post. That covers both permissions. Calls take up to 2 days to register. |
| 7 | App reachable by reviewers | To do | Reviewers use their own Meta test accounts, so don't give them your personal login. Give them a Vieews test login (Clerk email + password) and say they need an Instagram professional account. |
| 8 | Image format | ⚠️ | Meta: "JPEG is the only image format supported." The composer accepts PNG and WebP for photos. Convert them to JPEG for Instagram, or block them for Instagram in `validateMedia`. |
| 9 | Carousel and rate limits | ℹ️ | Docs now say carousels can hold up to 20 items (`LIMITS.instagramCarousel.max` is 10, which is still safe). The publish limit is 100 posts/24 h on one page and 50 on another: check `GET /<IG_ID>/content_publishing_limit` before scheduling large batches. |

## Step 3: Submit

App Dashboard → **Instagram → API setup with Instagram login → Complete app review → Continue to app review**, then **App Review → Requests → Edit**.

**Platform/verification instructions** (paste):

> Vieews is a web app at https://<domain>.
>
> 1. Open it, click "Get started" and sign in with the test login below.
> 2. Go to Accounts → Connect Instagram, and log in with an Instagram professional (Business or Creator) test account. Approve the permissions.
> 3. Go to Compose. Upload a vertical MP4 video (or 2–3 JPEG photos for a carousel), select only the Instagram account, write a caption, and choose "Reel" (or "Post").
> 4. Click "Publish to 1 account". The post page shows Instagram processing, then Published with a "View" link to the post on Instagram.
>
> Test login: <email> / <password>

**`instagram_business_basic`: how Vieews uses it** (write it in your own words; Meta says not to paste the same text for both):

> When a user connects Instagram, Vieews reads the account's user ID, username, name, profile picture and account type from `/me`. We show the username and picture on the Accounts page and in the composer's account picker, so the user knows which Instagram account a post will go to. We use the account type to tell users with a personal account to switch to a professional account first. We don't read the user's media, followers, insights or messages.

**`instagram_business_content_publish`: how Vieews uses it**

> Vieews publishes content the user creates to their own Instagram professional account: Reels, single-image posts, carousels and Stories. The user uploads the media in Vieews, writes the caption, picks the format and clicks Publish, or schedules a time. Vieews then creates the media container(s) with the user's caption, polls the container status, calls `media_publish`, and shows the user the permalink. Nothing is published without the user's action. Without this permission Vieews can't do its main job of posting to Instagram alongside YouTube and TikTok.

## Screencast script

Meta's rules:

- Each permission gets a screencast showing the user granting it and the app using it.
- App UI in English, 1080p or better, captions where something isn't obvious.
- Record the app window only, with a larger cursor, using the mouse rather than the keyboard.
- No audio.

One recording can cover both permissions; upload it under each.

| Time | On screen | Caption |
|---|---|---|
| 0:00 | Homepage on the custom domain, then sign in. | "Vieews: post once to Instagram, YouTube and TikTok." |
| 0:15 | **Accounts → Connect Instagram**. | |
| 0:20 | Instagram's login and permission screen listing both permissions; click **Allow**. | "User grants instagram_business_basic and instagram_business_content_publish." |
| 0:40 | Accounts page: Instagram username and avatar. | "instagram_business_basic: shows which account is connected." |
| 0:55 | **Compose**: upload a vertical video, select only Instagram, type a caption, choose **Reel**, leave "Also show in feed" on. | |
| 1:25 | Click **Publish to 1 account**. The post page shows Processing → Published. | "instagram_business_content_publish: container → status → media_publish." |
| 1:50 | Click **View**: the Reel open on instagram.com with the same caption. | |
| 2:05 | Optional: repeat with 3 JPEG photos as a carousel **Post**. | |
| 2:30 | Accounts → **Disconnect** Instagram. | "Users can disconnect at any time." |

## After approval

- Switch the app to **Live** mode. Only approved permissions work in Live mode, even for app roles.
- Changing basic or advanced settings later can trigger a re-review.

## Sources

- App Review for Instagram API (scenarios, permissions, submission steps, screencast guidance): https://developers.facebook.com/docs/instagram-platform/app-review
- Instagram Platform overview (access levels, business verification, permissions): https://developers.facebook.com/docs/instagram-platform/overview
- Business Login for Instagram (scope values): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
- Create an Instagram app (deauthorize and data-deletion URLs): https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app
- Content publishing (JPEG only, rate limit, carousels, container statuses): https://developers.facebook.com/docs/instagram-platform/content-publishing
- Business Verification: https://developers.facebook.com/docs/development/release/business-verification
- Business Verification documents (Meta Business Help): https://www.facebook.com/business/help/1095661473946872
- Access Verification (retired): https://developers.facebook.com/docs/development/release/access-verification
- App Review submission walkthrough: https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide
- Data Deletion Request Callback: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
- Platform Terms: https://developers.facebook.com/terms

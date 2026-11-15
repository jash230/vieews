# Google OAuth verification and YouTube API audit for Vieews

Google Cloud project: `vieews-514607` (signed in as zazabusiness23, `authuser=1`).
OAuth client: "Vieews web". Scopes: `youtube.upload`, `youtube.readonly`.

## Status

| Step | Status |
|---|---|
| App published ("In production") | Done 2026-11-13 |
| Branding: home, privacy, terms on www.vieews.dev | Done |
| Authorized domains: vieews.dev, vieews.vercel.app | Done |
| Scopes declared with justification (Data access page) | Done |
| vieews.dev verified in Search Console | Done 2026-11-13 (keep the TXT record in Cloudflare) |
| App logo (optional, 120x120 PNG) | None: the plain "V" icon failed Google's automated brand check, so it was removed |
| Branding verification | Done 2026-11-13 (verified and published) |
| Authorized domains | vieews.dev only (vieews.vercel.app removed with its callback, since it can't be verified in Search Console) |
| Demo video recorded and linked | Done 2026-11-13: https://youtu.be/EFEZtPxpT_g (Unlisted; shows both permissions on the consent screen) |
| Submit for verification (Verification centre) | Submitted 2026-11-13; data access "under review". Watch zazabusiness23@gmail.com for Google's emails |
| YouTube API Services audit form | Filled in 2026-11-13 (individual applicant, project 595645002382, videos.insert 350,000 units/day requested). An automated Submit hung on reCAPTCHA, so the form was refilled for a manual Submit: confirm with the "Thank you for submitting" message or Google's email to zazabusiness23@gmail.com |

## 1. Search Console TXT record (Cloudflare)

Add to the `vieews.dev` zone in Cloudflare → DNS → Records:

- Type: `TXT`
- Name: `@`
- Content: `google-site-verification=CWeOefp1yqJsjhYyajgBKj-rTvVar2zNiN_E55gYiTY`
- TTL: Auto

Then press **Verify** for the `vieews.dev` property in Google Search Console (account zazabusiness23).

## 2. Demo video script (about 2 to 3 minutes)

Upload it to YouTube as **Unlisted** and paste the link on the Data access page (YouTube link field), then Save.

Google rejects most first submissions because of the video, so show every item below.

1. **Open on the home page.** Show `https://www.vieews.dev` in the address bar. Scroll briefly so the app's purpose and the Privacy link are visible.
2. **Sign in to Vieews** with a test Google account that has a YouTube channel.
3. **Go to Accounts → Connect YouTube.**
4. **Show the Google consent flow in full:**
   - Zoom in on the address bar of the Google screen so the `client_id=595645002382-hq535lfkmhcn2eor0i5l09j2e3n1upho...` part of the URL is readable. Google requires the client ID to be visible.
   - Show the "Google hasn't verified this app" screen and click Advanced → Go to vieews.dev. This is expected and must be in the video.
   - Show the consent screen with the app name **Vieews** and both permissions listed ("Manage your YouTube videos" and "View your YouTube account"). Click Continue/Allow.
5. **youtube.readonly in use:** back in Vieews, point at the connected channel's name and avatar on the Accounts page. Say: "We read the channel name and picture only to show which channel is connected."
6. **youtube.upload in use:** go to Compose, pick a short video, fill in the YouTube title, description and privacy, select the YouTube account, and click Post now.
7. **Show the result:** open YouTube Studio for that channel and show the uploaded video with the same title.
8. **Disconnect:** back in Vieews, disconnect the YouTube account to show users can revoke access.

Narrate in English or add captions. Keep it to one continuous recording.

## 3. YouTube API Services audit (form)

Form: https://support.google.com/youtube/contact/yt_api_form ("YouTube API Services - Audit and Quota Extension Form").
Without passing it, every video Vieews uploads stays **private**. Use the same form to request more quota.

Suggested answers:

- **API client / project number:** Google Cloud project `vieews-514607` (project number shown on the Cloud console dashboard).
- **Website:** https://www.vieews.dev
- **Privacy policy:** https://www.vieews.dev/privacy
- **Terms of service:** https://www.vieews.dev/terms
- **What does your app do?** Vieews lets creators upload a short-form video once and publish it to their own YouTube channel (and to Instagram and TikTok) immediately or at a scheduled time.
- **How do you use the YouTube API?** Each user connects their own channel through OAuth. When that user publishes or schedules a post, our server calls `videos.insert` (resumable upload) to upload the file they chose, with the title, description, tags, privacy status and made-for-kids setting they set. We call `channels.list` (`part=snippet`, `mine=true`) once after connecting to show the channel name and avatar. We do not download, modify or delete other content, and we do not display or store YouTube data beyond the connected channel's name, avatar and the IDs/URLs of videos the user uploaded through Vieews.
- **Who are your users?** Individual creators and small businesses who post the same short video to several platforms.
- **Expected daily uploads / quota request:** state your realistic number of uploads per day (each upload costs about 1,600 units out of the default 10,000 per day). Ask for enough units for the next few months of growth.
- **Data retention and deletion:** OAuth tokens are encrypted at rest. Users can disconnect a channel at any time in Vieews, which deletes the stored tokens; they can also revoke access at https://myaccount.google.com/permissions.
- **Screenshots or video:** reuse the demo video from section 2.

## 4. Submitting

When the TXT record is verified and the demo video link is saved:

1. Google Auth Platform → **Verification centre** → **Submit for verification**.
2. Answer any follow-up emails from the Google Trust & Safety team (sent to zazabusiness23@gmail.com) within a few days, or the request is closed.

Typical timing: brand review a few business days; sensitive-scope review a few days to a few weeks.

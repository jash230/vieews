# Setting up Vieews

Vieews needs accounts with seven services. Everything below is free for personal use except a paid Supabase plan if you want uploads over 50 MB. Budget about an hour; the platform developer apps take the longest.

Copy `.env.example` to `.env.local` and fill it in as you go.

```bash
cp .env.example .env.local
openssl rand -base64 32   # paste into TOKEN_ENCRYPTION_KEY
```

Throughout, `APP_URL` means your app's public URL: `http://localhost:3000` locally, or your Vercel URL (for example `https://vieews.vercel.app`) once deployed. TikTok only accepts HTTPS redirect URIs, so set TikTok up against the Vercel URL (or an HTTPS tunnel such as `ngrok http 3000`).

---

## 1. Clerk (sign-in)

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com). Pick the sign-in methods you want (email + Google is fine).
2. **Configure → Restrictions → Sign-up mode → Restricted.** Do this once you've created your own account, so nobody else can sign up.
3. Copy the publishable and secret keys into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Paste only the value after the `=`.

## 2. Supabase (database + file storage)

Supabase doesn't need to know about Clerk: only the server talks to it, and the browser uploads through one-time links the server creates.

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. **SQL Editor → New query**: paste all of `supabase/migrations/0001_init.sql` and run it, then do the same with each later migration in order (`0002_carousels_campaigns.sql` adds photo carousels, post campaigns/meta and media cleanup). Or with the Supabase CLI: `supabase link` then `supabase db push`.
3. **Project Settings → API Keys**: copy the project URL and a secret key into `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`. (Older projects: use the `service_role` key.) Keep the secret key out of code and chat.
4. **Storage → Settings → Upload file size limit.** Free plan max is 50 MB per file. On Pro you can raise it (Instagram allows 300 MB, TikTok 4 GB).

## 3. Inngest (publishing jobs and scheduling)

Locally, nothing to sign up for. Run the dev server next to `npm run dev`:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Its dashboard at http://localhost:8288 shows every publish run and step.

For production: create an account at [app.inngest.com](https://app.inngest.com), install the **Vercel integration** (it sets `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` for you and syncs on each deploy).

## 4. YouTube

1. In [Google Cloud Console](https://console.cloud.google.com), create a project.
2. **APIs & Services → Library → YouTube Data API v3 → Enable.**
3. **OAuth consent screen**: External, add your email as a test user, add the scopes `youtube.upload` and `youtube.readonly`.
4. **Publish the app** (Audience → Publish app → In production). You don't need Google's verification for your own account; you'll click through an "unverified app" warning once. If you leave it in *Testing*, Google expires your connection every 7 days.
5. **Credentials → Create credentials → OAuth client ID → Web application.** Authorized redirect URI: `APP_URL/api/connect/youtube/callback` (add both the localhost and Vercel ones).
6. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Limits: the default quota allows about 6 uploads a day. Until your project passes YouTube's [API audit](https://support.google.com/youtube/contact/yt_api_form), YouTube forces every API upload to **private**; you can make them public in YouTube Studio, or apply for the audit to lift it.

## 5. Instagram

Your Instagram account must be a **Professional account** (Business or Creator): Instagram app → Settings → Account type and tools.

1. At [developers.facebook.com](https://developers.facebook.com/apps), create an app, type **Business**.
2. Add the **Instagram** product → **API setup with Instagram login**.
3. Under **App roles → Roles → Instagram testers**, add your Instagram username. Accept the invite in Instagram (Settings → Apps and websites → Tester invites), or on instagram.com.
4. In **Set up Instagram business login → Business login settings**, add the OAuth redirect URI `APP_URL/api/connect/instagram/callback`.
5. Copy the **Instagram app ID** and **Instagram app secret** (not the Facebook app ones) into `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.

The app can stay in development mode: that works for accounts with a role on it, which is you.

## 6. TikTok

1. At [developers.tiktok.com](https://developers.tiktok.com), create an app.
2. Add products **Login Kit** and **Content Posting API**. In Content Posting API, turn on **Direct Post**.
3. Scopes: `user.info.basic`, `video.upload`, `video.publish`.
4. Login Kit redirect URI: `https://<your-vercel-url>/api/connect/tiktok/callback` (HTTPS only).
5. Use the **Sandbox** tab and add your TikTok account as a target user, so you can test before review. Copy the client key and secret into `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`.

Limits: until TikTok audits your app, posts are only visible to you (**"Only me"**). Submit the app for review from the developer portal to post publicly. The composer already shows the creator info, privacy picker, interaction toggles and commercial-content disclosure TikTok's review requires.

**Photo posts (carousels)** need one more step, because TikTok only pulls photos from URL prefixes you've verified:
1. In the app's Content Posting API settings, verify the **URL prefix** `https://<your-vercel-url>/media/tt/`.
2. TikTok gives you a signature file to download. Set `TIKTOK_URL_VERIFICATION_FILE` to its file name and `TIKTOK_URL_VERIFICATION_CONTENT` to its contents in Vercel, then redeploy. Vieews serves that file at the prefix.
3. Click **Verify** in the TikTok portal.

Photos are served from that prefix with signed links that expire after an hour.

## 7. Run it

```bash
npm install
npm run dev
# in another terminal:
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open http://localhost:3000, sign in, go to **Accounts** and connect each platform.

## 8. Deploy to Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Add every variable from `.env.local` under **Settings → Environment Variables**, with `NEXT_PUBLIC_APP_URL` set to the Vercel URL.
3. Install the Inngest Vercel integration (step 3).
4. Add the Vercel callback URLs to Google, Meta and TikTok (steps 4–6).

## 9. Connect Claude (MCP)

In the app, open **AI & API keys**, create a key, and run the command it shows:

```bash
claude mcp add --transport http vieews https://<your-app>/api/mcp --header "Authorization: Bearer <key>"
```

Then ask Claude something like "post ~/Movies/clip.mp4 to my TikTok and Instagram tomorrow at 9am with the caption …". The agent uses `create_media_upload` to get a signed upload URL, uploads the file with curl, then calls `finalize_media_upload` and `create_post`.

## 10. Automated ads (optional)

[`ad-studio/`](ad-studio/README.md) has Claude make ads for your app on a schedule and post them through Vieews. Its README covers adding your app and the one-time cloud setup.

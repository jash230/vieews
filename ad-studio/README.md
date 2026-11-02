# Ad Studio

Claude makes short-form ads for your app and posts them through [Vieews](../README.md). It runs on a schedule (for example 10 a day), with nobody watching:
- TikTok photo slideshows
- Instagram carousels and Reels
- YouTube Shorts

**Every format is copied from apps that grew with it:**
- GlamUp's before/after slideshow (10M views)
- Stronger's selfie-hook slideshows (725 posts, 11 over 1M views)
- Cal AI's magic-moment demos
- Shot Pattern's screen-recording tutorial ($1.57 per install)
- Halo AI's text-story format (1.2B views)
- SideShift's silent hook (9.6M)
- Larry's 6-slide AI slideshows

The research and sources are in [docs/research/2026-10-30-ai-app-ads.md](../docs/research/2026-10-30-ai-app-ads.md) and [skills/make-ad/references/](skills/make-ad/references/).

**It costs nothing beyond your Claude plan.**
- Images come from open-weights FLUX models on Cloudflare Workers AI's free tier (10,000 neurons a day, about 80 images).
- The voice is Kokoro-82M (Apache-2.0), running on the CPU.
- Video is rendered with [Remotion](https://remotion.dev), free for individuals and companies of up to 3 people.

## How a run works
1. `npm run pick` reads every past ad from Vieews and chooses what to make next. It explores formats first, then reuses winners with new hooks. It never repeats a hook word for word or the same format twice in a row.
2. Claude writes three concepts, scores them, and keeps the best.
3. It makes only the assets it needs: kit screens first, then at most 4 AI images and a voiceover.
4. `npm run render` produces the slides and video, and checks them against each platform's specs.
5. Claude reviews a contact sheet against [the quality bar](skills/make-ad/references/quality.md). It fixes problems, falls back to a simpler format, or posts nothing.
6. `npm run publish-ad` uploads to Vieews and posts to every active account. The ad's format, hook and angle are saved with the post, so the next run remembers.

## Folders
```
config.json          on/off switch, which apps, time zone, accounts, privacy, image budget
apps/<slug>/         one kit per app: app.md + media/ (screens, logo, photos)
skills/make-ad/      what each run follows (+ references: formats, hooks, prompting, quality, platforms)
skills/add-app/      interactive setup for a new app
studio/              scripts and the Remotion renderer (Node 20+)
runs/                per-run working files (gitignored)
```

## Add your app
In Claude Code, in this repo: *"Use the add-app skill in ad-studio/skills/add-app to set up my app"*. Have these ready:
- full-resolution phone screenshots (including the screen that makes people say "what app is that?")
- the icon
- a store link
- the facts the ads may claim

It writes `apps/<slug>/`, makes a test ad for you to look at, and then adds the app to `config.json`. `apps/vieews/` is an example kit; replace its landing-page screenshots with real app screens before turning it on.

## Run it locally
```bash
cd ad-studio/studio && npm ci && npx remotion browser ensure
```
```bash
export VIEEWS_API_KEY=...        # Vieews → AI & API keys
export CF_ACCOUNT_ID=...         # Cloudflare dashboard → Workers AI
export CLOUDFLARE_API_TOKEN=...  # a token with Workers AI read/edit permission
```
Then ask Claude: *"Follow ad-studio/skills/make-ad/SKILL.md"*.

## Run it in the cloud, 10 times a day
These steps happen once, in your claude.ai account, because they involve keys.

**1. Cloudflare (free).** Create an account. Copy your **Account ID** and create an **API token** with *Workers AI* permission.

**2. A cloud environment.** At [claude.ai/code](https://claude.ai/code), add a new environment (e.g. "ad-studio"):
- **Network access → Custom**, keep "Also include default list of common package managers" checked, and allow:
  ```
  vieews.vercel.app
  *.supabase.co
  api.cloudflare.com
  huggingface.co
  *.hf.co
  storage.googleapis.com
  ```
- **Network secrets**:
  - your Vieews API key for host `vieews.vercel.app` (Bearer)
  - your Cloudflare token for host `api.cloudflare.com` (Bearer)
- **Environment variables:** `CF_ACCOUNT_ID=<your account id>` (not a secret).
- **Setup script** (cached, so it runs once):
  ```bash
  cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)/ad-studio/studio" 2>/dev/null || cd ad-studio/studio
  npm ci
  npx remotion browser ensure
  echo '[{"id":"warmup","text":"Hello."}]' > /tmp/l.json && npm run voice -- --lines /tmp/l.json --dir /tmp/vo
  ```

**3. The scheduled task.** Run `/schedule` in Claude Code (or use [claude.ai/code/routines](https://claude.ai/code/routines)):
- **Repository:** this repo.
- **Environment:** the one above.
- **Schedule:** custom cron, for example `0 8,10,11,13,14,16,17,19,20,22 * * *` (10 a day; cloud tasks run at most hourly).
- **Prompt:**
  > Read ad-studio/skills/make-ad/SKILL.md and follow it exactly to make and post one ad. Don't ask questions; if something blocks you, post nothing and report why.

**4. Before the first scheduled run**, start one manually with **Run now** and read the transcript. It's the end-to-end check that the keys, network and rendering all work in the cloud.

To pause everything, set `"paused": true` in `config.json` and push.

## Know before you turn it on
- **TikTok and YouTube posts stay private** until each platform approves Vieews' API access. TikTok posts as "Only me"; YouTube uploads as private. Instagram posts publicly now.
- **API posts can't use trending sounds.** TikTok photo posts get TikTok's recommended music; videos use the voiceover.
- **TikTok photo posts** pull images from `https://vieews.vercel.app/media/tt/`. Verify that URL prefix in the TikTok developer portal (see Vieews `SETUP.md`).
- **Ten runs a day use your Claude subscription.** Watch [claude.ai/settings/usage](https://claude.ai/settings/usage) for the first few days.
- **New TikTok accounts** usually need a few days of normal use before automated posts get reach.
- Winners can only be learned from views. Until Vieews reads post metrics (a planned next step), the picker keeps exploring evenly.

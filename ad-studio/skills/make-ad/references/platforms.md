# Where the ad goes

`npm run publish-ad` handles this. This file explains what it does and why.

| Ad kind | TikTok | Instagram | YouTube |
|---|---|---|---|
| `slides` | Photo post (swipeable), the 1080×1920 slides, TikTok's recommended music added | Carousel post, the 1080×1350 (4:5) slides, up to 10 | Short: the video version of the slides |
| `video` | Video post | Reel (also shown in feed) | Short |

- **Campaign and memory.** Every post gets `campaign: "ad-studio:<app>"` and `meta` (format, angle, hook pattern, hook, tone, persona, AI images, neurons, part). The next run reads this to avoid repeats; a slideshow's three posts share one `adId`.
- **Captions.** Built from your hook and body plus the kit's CTA and up to 5 hashtags. The YouTube title is the hook (≤100 chars, no `<` `>`).
- **TikTok.**
  - Posted with the widest visibility TikTok allows the account. Until TikTok audits Vieews, that's "Only me" (private).
  - `brandOrganic` (promoting your own business) is always on.
  - The AI label (`is_aigc`) is on when `aiPeople` is true.
  - API posts can't use trending sounds, so photo posts get TikTok's auto-added music. Videos carry their own audio (voiceover).
  - About 15 API posts per creator per day.
- **Instagram.**
  - Carousels need 2–10 JPEG photos at 4:5 to 1.91:1; the renderer makes 1080×1350.
  - Reels need H.264/AAC video.
  - Up to 50 API posts per 24 hours.
  - Meta labels photorealistic AI video itself.
- **YouTube.**
  - Uploads stay private until Google audits Vieews' API project, whatever privacy is requested.
  - `containsSyntheticMedia` is set when `aiPeople` is true.
  - The default quota allows 100 uploads a day.
- **Size limits.** Videos must stay under 45 MB (the Supabase free plan's upload limit is 50 MB). Renders run at about 4 Mbps, so a 30-second ad is about 15 MB.
- **Storage.** Vieews deletes each ad's files 3 days after they're published, to stay inside the free 1 GB.

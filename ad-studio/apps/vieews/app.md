---
# Example kit. Swap the two landing-page screenshots for real in-app screenshots taken on a
# phone (full resolution) before turning this app on in config.json.
name: Vieews
slug: vieews
oneLiner: Upload a video once and post it to YouTube Shorts, Instagram Reels and TikTok, now or on a schedule.
audience: Solo creators and small brands who post the same short video to three apps by hand every day.
desires:
  - status
  - more free time
  - growth
pains:
  - uploading the same video three times every single day
  - forgetting to post on one of the platforms
  - rewriting the caption for each app
  - staying up late just to post at the right time
outcomes:
  - one upload goes to YouTube, Instagram and TikTok
  - posts can be scheduled ahead of time
  - Vieews checks each platform's rules before posting
magicMoment:
  description: One upload, three platforms. Pick your accounts and it posts everywhere at once.
  screens:
    - screens/landing-hero.jpg
screens:
  - file: screens/landing-hero.jpg
    shows: "Upload once. Post to YouTube: one upload, three platforms"
    tags: [magic, home]
  - file: screens/landing-features.jpg
    shows: "Post now or later, track every platform's result, AI-ready"
    tags: [features]
logo: logo.png
beforeAfter: false
claims:
  allowed:
    - Upload once and post to YouTube, Instagram and TikTok
    - Schedule posts for later
    - Checks each platform's rules before posting
    - Shows every platform's result in one place
    - Claude can upload and schedule posts for you through its MCP server
  banned:
    - Any view, follower or revenue numbers
    - Saying it posts to platforms other than YouTube, Instagram and TikTok
cta: "Vieews: post everywhere from one upload"
tone: [blunt, funny]
personas:
  - a 24-year-old content creator editing on a laptop at night
  - a small coffee shop owner filming a latte pour
  - a fitness coach posting daily workout clips
brand:
  primary: "#0b1f33"
  accent: "#c7f0bd"
  font: tiktok-sans
hashtags: [contentcreator, creatortips, smallbusiness]
language: en
formats:
  deny: []
  weights: {}
adsPerDay: 10
---

Voice: talk like a creator who is tired of busywork, not like a SaaS landing page. Short, a bit
sarcastic about posting the same video three times.

Avoid: calling it an "AI tool" (it's a cross-poster with an AI connection), promising virality,
and naming competitors.

---
name: make-ad
description: Makes one short-form ad (TikTok photo slideshow / Instagram carousel / Reel / YouTube Short) for an app kit in ad-studio/apps and posts it through Vieews, with nobody watching. Use when a scheduled ad run starts, or when asked to make or post an ad for an app.
---

# Make one ad

You're the creative director and the editor. The scripts in `ad-studio/studio` do the mechanical work: picking an unused combination, generating images and voice, rendering, uploading and posting. You make the decisions that make an ad work: the concept, the hook, the words, the images, and whether it's good enough to post.

Every format comes from apps that grew with it (Cal AI, Umax, GlamUp, Stronger, Halo AI, SideShift, Larry's slideshows…). The references explain what they did and why it worked. **Copy the structure, never the content**, and make every ad new.

This usually runs unattended (a scheduled cloud task). **Don't ask questions.** Make sensible calls, follow the hard rules in `references/quality.md`, and if you can't make something good, post nothing and say why.

## Before you start
```bash
cd ad-studio/studio
[ -d node_modules ] || npm ci
```
Locally, `VIEEWS_API_KEY` and `CF_ACCOUNT_ID` (+ `CLOUDFLARE_API_TOKEN`) must be set. In the cloud they come from the environment (see `ad-studio/README.md`).

## 1. Pick what to make
```bash
npm run pick
```
It reads every past ad from Vieews and prints JSON.
- If it has `skip`, report the reason in one line and stop.
- Otherwise note `app`, `adId`, `runDir`, `candidates`, `usedHooks`, `recent`, `neuronsLeft`.
- Take `candidates[0]` unless you can't make it **good** with this kit (formats.md, "Choosing"). In `mode: "exploit"` you're varying a proven winner: keep its format and hook pattern, and change the situation, hook text and images.

```bash
npm run kit -- <app>
```
This prints the kit: audience, desires, pains, magic moment, screens (with what each shows), photos, claims, CTA, personas, brand, and the notes at the end. Read the notes; they're the owner's voice and no-gos.

## 2. Concept
Read `references/formats.md` (your format's section) and `references/hooks.md` (your hook pattern).
- Write **three** concepts for the candidate's angle, each with:
  - the hook (≤ about 12 words, not in `usedHooks`, not a near-copy)
  - a beat-by-beat outline that follows the format's beats
  - which kit screen is the payoff
- Score them with the rubric in `references/quality.md`. Keep the best, and say in one line why it beat the others.

## 3. Make the assets (only what the concept needs)
- **Kit media first.** Screens and photos are free and real: `kit:screens/<file>`, `kit:<photo>`, `kit:<logo>`.
- **AI images** (≤4 per ad; follow `references/prompting.md`):
  ```bash
  npm run image -- --prompt-file <runDir>/p1.txt --out <runDir>/img/hook.jpg
  npm run image -- --prompt-file <runDir>/p2.txt --out <runDir>/img/react.jpg --ref <runDir>/img/hook.jpg
  ```
  Look at each image (Read it). Regenerate a bad one once; then swap the slide for a screen or text scene.
- **Voiceover** (V2, optional elsewhere): write `<runDir>/lines.json` as `[{"id":"2","text":"…"}]`, then
  ```bash
  npm run voice -- --lines <runDir>/lines.json --dir <runDir>/vo
  ```
  Each result's `src` and `durationS` go into that scene's `voice`.

## 4. Build and render
Write `<runDir>/ad.json`. The schema is in `studio/src/spec.ts`; examples are in formats.md.
- `id` is `adId`.
- `kind` is `slides` for S formats and `video` for V formats.
- `theme` comes from the kit's `brand`.
- Use the text styles the source used. Keep text in the upper part: `top`/`upper` for hooks, `center` for text slides.

```bash
npm run render -- --spec <runDir>/ad.json --app <app>
```
Read `out/contact-sheet.jpg` and check it against section 3 of `references/quality.md`. Fix, then render again: at most 2 rounds, then the fallback in quality.md section 4.

## 5. Post
Write `<runDir>/publish.json`:
```json
{
  "app": "<app>",
  "adId": "<adId>",
  "caption": { "hook": "<on-screen hook>", "body": "<1–2 short lines>", "hashtags": ["niche", "tags"] },
  "aiPeople": true,
  "meta": {
    "format": "S4", "angle": "<candidate angle>", "hookPattern": "<pattern id>", "hook": "<exact hook>",
    "tone": "<tone>", "persona": "<if any>", "setting": "<short scene description>",
    "variantOf": "<winner adId if exploit, else omit>", "aiImages": 1, "neurons": 110
  }
}
```
`aiPeople` is true only if a realistic AI-generated person or scene is in the ad. `neurons` is the sum of the image outputs.

```bash
npm run publish-ad -- --run <runDir>
```
It uploads, posts to every active account, and waits for each platform's result.

## 6. Report
Finish with a short report:
- the app, the format, and the hook
- one line on the concept
- each platform's status, with links where there are any
- anything that failed

If a platform failed, say what the error was. Don't retry blindly; a later run will try again with a new ad.

## Rules that override everything
- Never invent claims; use only `claims.allowed`.
- Never give an AI or fictional person a first-person testimonial or result. Never fake reviews, ratings or engagement.
- Never use real people, other brands or copied content.
- Never post an ad that fails the quality bar.
- Never reuse a hook word for word.
- If `config.json` has `"paused": true`, `pick` skips. Respect it.

# Prompting images and voice

## Images (`npm run image`)
These run free on Cloudflare Workers AI with FLUX open-weights models.
- `flux-2-klein-4b` is the default: 720×1280 vertical, and up to 4 reference images.
- `flux-1-schnell` is the fallback: squares only.

Each image costs about 100 neurons of a ~9,000/day budget, so **use at most 4 AI images per ad**. Prefer real app screens and the kit's own `photos`.

The rules come from people who made AI ads that worked.

**1. Every prompt stands alone.** PJ Accetturo (the Kalshi NBA Finals ad, Veo 3) wrote each shot prompt "as if the model has no context of the shot before or after it". Re-describe the setting, the person and the tone every time. ([process](https://www.informediation.com/blog/2025/07/02/kalshi-tv-ad-made-with-veo-3/))

**2. One scene description, reused.** Larry kept 6 slides consistent by pasting the same detailed room/scene description into all six prompts. ([Stack Junkie](https://www.stack-junkie.com/blog/how-to-automate-tiktok-marketing-with-openclaw-larry-skill-deep-dive)) Write the scene once and paste it into every image prompt of the ad. For the same person across images, also pass the first image with `--ref`.

**3. Make it look like a phone photo, not an ad.** UGC that works looks user-made: handheld phone framing, natural light, real places. Use cues like these:
- "candid iPhone photo, vertical"
- "natural window light"
- "slightly messy real apartment"
- "shot from eye level"
- "subtle grain"
- "not a studio photo"

**4. No text in images.** Models garble text. All words are added later by the renderer (Larry added overlays with node-canvas for the same reason). Add "no text, no captions, no logos, no watermarks" to every prompt.

**5. Leave room for the hook.** Ask for "empty space in the upper third", or frame the subject in the lower two-thirds.

**6. People:**
- Adults (25+ looking) only.
- A concrete persona from the kit (age range, vibe, what they're doing, what they wear).
- Specific emotions ("exhausted, staring at a laptop at 1am"), not "happy person".
- Hands and phones are where models fail. Prefer compositions where the phone screen isn't visible; the real app screens come from the kit.

**7. Describe what's in frame, not the story.** The model can't know "she just found the app". It can draw "a woman in her late 20s laughing at her phone on a couch, evening lamp light".

**Prompt template:**
```
Candid vertical iPhone photo. {SCENE: place, time of day, light, 2–3 specific props}. {PERSON: age, look, clothes} {ACTION + EMOTION}. Shot at eye level, natural light, subtle grain, real lived-in place, not a studio photo. Empty space in the upper third. No text, no captions, no logos, no watermarks.
```

**Example (persona from a bill-splitting app kit):**
```
Candid vertical iPhone photo. A small shared student apartment kitchen at night, warm overhead light, a pile of grocery receipts and three mismatched mugs on the counter. A woman in her mid-20s in an oversized hoodie leans on the counter rubbing her forehead, frustrated, looking at a crumpled receipt. Shot at eye level, natural light, subtle grain, real lived-in place, not a studio photo. Empty space in the upper third. No text, no captions, no logos, no watermarks.
```

**Before/after (S2):** generate the before, then the after with `--ref img/before.jpg`. Say "the same woman as in the reference image, same kitchen, same light; only {the change}". Keep the change realistic and within what the app does.

**Backgrounds for text slides:** reuse an earlier image as a blurred background (`"background": "img/hook.jpg"`) instead of generating a new one.

**If an image comes back wrong** (extra fingers, warped face, text): regenerate once with the problem named ("hands out of frame", "no visible text"). If it fails twice, swap that slide for a `text` scene or a kit screen.

## Voice (`npm run voice`)
Kokoro-82M, open source, runs on the CPU.

**Voices:** `af_heart` (default, warm female), `af_bella`, `am_michael`, `am_fenrir`, `bf_emma` (British). Pick one that suits the kit's audience, and keep one voice for the whole ad.

**How to write voice lines:**
- One line per scene, 6–14 words. That's about 2–4 seconds, and per-scene files keep captions in sync.
- Talk like a friend showing you something, not an announcer. Contractions, plain words.
- Spell out what's awkward to read: "ten dollars", not "$10"; "T-T-S" or a plain alternative for acronyms.
- The first line is the hook.
- The last line names the app once, with the benefit: "Try Tally so the bill splits itself."

Put each file's `durationS` from the command output into its scene's `voice`.

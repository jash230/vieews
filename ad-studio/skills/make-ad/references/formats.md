# Formats

Every format here is copied from something that worked for a real app. The **Source** line says who and what happened, and the **Beats** are the structure that worked. Keep the beats and change everything else: the hook, angle, people, setting and words.

Shared rules, from what the winners had in common:
- **Show the app early.** Cal AI asked creators to show the core screens in the first 5–10 seconds, before viewers drop off. In slideshows, the app appears by slide 2–5 (Stronger: slide 2–3).
- **Lifestyle or story first, product second.** Viewers should feel they found the app themselves. That's what makes people comment "what app is that?" (Cal AI, Flowfy, Sway AI).
- **One screen must carry the ad.** Use the kit's `magicMoment` screens. Text on them must be readable from a distance.
- **Native, not polished.** The ugly screen-recording tutorial beat polished creator ads (Shot Pattern), and a plain sales pitch beat a cinematic one (Pushcroll).
- **Visuals match slide to slide.** Same setting and same light, or it reads as random (r/SideProject, Larry).
- No hard call to action. The last slide or end card says where to get it, once.

Scene types: `photo`, `screen`, `chat`, `text`, `split`, `end` (schema in `studio/src/spec.ts`). Text styles: `outline` (TikTok classic), `box` (TikTok label), `clean`, `small` (off-center "Gen Z"), `headline`. Media paths are run-relative (`img/hook.jpg`) or kit files (`kit:screens/scan.png`).

---

## S1 · Pain → hard fixes → app as the easy fix (slideshow)
**Source:** An AI social-content agency on the Superwall Podcast refined this over 3–4 rounds; a 50-image bank fed about 300 slideshows. Pep AI's educational slideshows ended with the app as the tracking tool, and per the guest beat its talking-head videos. Flame used a pain-point slide 1 made with Nano Banana and got about 1% conversion. ([GTM Sauce](https://gtmsauce.com/topics/tiktok-slideshows))

**Beats (5–7 slides):**
1. Hook naming the pain in the audience's words ("I used to struggle with…"). An AI person photo or a plain photo. *Only this slide uses an AI image.*
2. A slide that makes the problem sharper (optional).
3. A real but high-effort fix #1, as text over a photo or plain background.
4. A real but high-effort fix #2.
5. The app as the cheaper, lower-effort fix: a `screen` scene with the magic screen and a short line.
6. Optional: `end` scene (app name + kit CTA).

**Rules:** The hard fixes must be genuinely true and useful, which is why people save these posts. The app slide shouldn't be first or last.

```json
{"kind":"slides","scenes":[
 {"type":"photo","src":"img/hook.jpg","motion":"zoom-in","text":{"text":"i used to dread rent day with 3 roommates","style":"small","position":"upper"}},
 {"type":"text","background":"img/hook.jpg","text":{"text":"what I tried first:\n1. a shared spreadsheet\n(nobody updated it)","style":"box","position":"center"}},
 {"type":"text","background":"img/hook.jpg","text":{"text":"2. venmo requests\n(awkward every single month)","style":"box","position":"center"}},
 {"type":"screen","src":"kit:screens/split.png","text":{"text":"3. or: snap the receipt and it splits itself","style":"outline","position":"top"}},
 {"type":"end","logo":"kit:logo.png","appName":"Tally","line":"Free on the App Store"}
]}
```

## S2 · Before/after → the app (slideshow) · needs `beforeAfter: true`
**Source:** GlamUp posted the same before/after makeup slideshow across about 20 accounts: girl without makeup → with makeup → app screenshot of the routine. The first post got about 10M views, and the app reached 1M users in six months. The hook was small, off-center text: `never saw myself with the / right makeup routine / 😭😭`. Umax showed before/after face ratings (55 → 95). ([GTM Sauce hooks](https://gtmsauce.com/topics/video-hooks); [Blake Anderson](https://pickscribe.com/v/jrNIZqL22Ag))

**Beats (3–4 slides):**
1. Before, with an emotional confession hook in `small` style.
2. After, the same person and same setting.
3. App screenshot of how it was done.
4. Optional end card.

Alternative: one `split` scene.

**Rules:** The before and after must be the same person (generate the after with `--ref` set to the before image). The result must be realistic, never exaggerated, and only something the app really does (kit claims). Set `aiPeople: true`.

## S3 · Text-message drama resolved by the app (slideshow, no AI images)
**Source:** Knownwell, an AI journaling app. The "I think you left your toothbrush….." text-message slideshow got 438K views and 700+ saves, and "Hey sorry for breaking no contact but…" got 104K. The format was iMessage screenshots, then an app screenshot, then the story continued in the caption. Halo AI used a texting payoff in a format that drove 1.2B views. ([PlayKit](https://playkit.beehiiv.com/p/ai-journal-app))

**Beats (4–6 slides):**
1. A `chat` scene with the hook as the first message (drama).
2. The chat escalating.
3. The turn.
4. A `screen` scene where the app resolves it: the helpful, uplifting payoff.
5. Optional: chat epilogue.

**Rules:** Drama is a story, not a testimonial. The people in it are fictional characters in a skit. Never present it as a real customer's review. Put the app in by slide 4 at the latest.

```json
{"type":"chat","contact":"Maya 🏠","messages":[{"from":"them","text":"did you pay the electric bill??"},{"from":"me","text":"I thought YOU did"},{"from":"them","text":"it's due TODAY"}],"text":{"text":"every month in our apartment","style":"box"}}
```

## S4 · Selfie cover + tension hook → app screens (slideshow, AI person)
**Source:** Stronger, a gym planner app: 725 posts in 295 days, 98% of its winners slideshows, 11 over 1M views and 700K users. Slide 1 is a selfie with a short tension hook ("Grandpa was right", "Skipping legs…"). Slide 2 or 3 is the tension-releasing app screen, and comments ask "app name?". BePresent turned 5 cover selfies into a week of slideshows. ([Shortimize](https://www.shortimize.com/blog/the-slideshow-strategy-that-generated-700000-users-in-275-days); [BePresent](https://growwithplutus.com/blog/bepresent-app-tiktok-strategy))

**Beats (2–4 slides):**
1. AI selfie of the persona in a fitting place, hook in `outline` or `small`.
2. The app screen that releases the tension.
3. Optional second screen or result.

**Rules:** The hook should be short and slightly controversial within the niche, and should start an argument in the comments. Set `aiPeople: true`.

## S5 · Value list with a money slide (slideshow)
**Source:** A 3-month-old app reached $50K MRR from aesthetic slideshows: slides 1–3 hook + value, slide 4 the app name + screenshots, slides 5–7 more value. Sway AI's branded "five mistakes when flirting over text, dating advice from Sway AI app" got about 4M views and $5–6K in a day. Curiosity Quench's "most attractive hobbies" list ran about 400 times. ([GTM Sauce](https://gtmsauce.com/topics/tiktok-slideshows))

**Beats (6–7 slides):**
1. List hook ("5 things that…") over a mood photo.
2. First real tip.
3. Second real tip.
4. **Money slide:** a `screen` scene with the app name in the text.
5. Third tip.
6. Fourth tip.
7. Optional end.

**Rules:** Every tip must be genuinely useful on its own. The money slide sits in the middle, never last. Use one consistent background look (same photo blurred, or the same color).

## S6 · Larry 6-slide (slideshow, AI people)
**Source:** Larry, Oliver Henry's AI agent, made 6-slide slideshows for his apps Snugly and Liply and reported 500K views in 5 days (later 8M in a week). Each prompt reused the same scene description so all 6 images matched, and text was added after generation. ([Stack Junkie](https://www.stack-junkie.com/blog/how-to-automate-tiktok-marketing-with-openclaw-larry-skill-deep-dive))

**Beats (exactly 6):**
1. **Hook:** "[Person] said [doubt] so I showed them [app]" on a photo of the setting.
2. **Problem:** the tension.
3. **Reveal:** the app's output (screen) or the before/after.
4. **Reaction:** "they changed their mind" (a photo of the same person reacting, made with `--ref`).
5. **Soft CTA:** app name + where.
6. **Follow:** "follow for more [niche]".

**Rules:** Use one shared scene description across every image prompt. The doubter must be specific (landlord, mom, roommate, coach). Set `aiPeople: true`.

---

## V1 · Magic-moment demo (video, no AI)
**Source:** Cal AI asks creators for only two things: show the core screens (camera → analyzing → result) and show them early. Sprout's faceless 6.7-second clip ("War is over. Finally landed my first full-time job" over a tracker flipping to "Accepted") got hundreds of millions of views; they tested 5, 6 and 7 seconds and 6.7 won. Halo AI's only call to action was a ~2s loading screen with its logo. ([usetranscribe](https://www.usetranscribe.io/yt/gB0C7NA5fXo/cal-ai-growth-tiktok); [GTM Sauce](https://gtmsauce.com/topics/short-form-video))

**Beats (6–10s total):**
1. 0–2s: hook text over the first magic screen, or a `photo` of the situation.
2. 2–6s: `screen` scenes stepping through the magic moment, with `zoom` punch-ins and a `tap`.
3. Last 1.5–2s: result screen or `end`.

**Rules:** Use quick cuts (1–2s scenes). The result must be on screen by second 5. No voice is needed; if you add one, keep it under 2 lines.

```json
{"kind":"video","scenes":[
 {"type":"screen","src":"kit:screens/scan.png","durationS":1.8,"frame":"full","text":{"text":"POV: splitting a $186 dinner bill","style":"outline","position":"upper"}},
 {"type":"screen","src":"kit:screens/scan.png","durationS":1.4,"tap":{"x":0.5,"y":0.86}},
 {"type":"screen","src":"kit:screens/split.png","durationS":2.2,"zoom":{"x":0.5,"y":0.42,"scale":1.6},"text":{"text":"10 seconds. done.","style":"box","position":"top"}},
 {"type":"end","durationS":1.6,"logo":"kit:logo.png","appName":"Tally","line":"Free on the App Store"}
]}
```

## V2 · Voiceover tutorial over app screens (video, Kokoro voice)
**Source:** Shot Pattern's 30–60-minute screen-recording tutorial (the recording dot visible, a misspoken number left in) took 80–90% of spend and beat both creator ads at $1.57 per install. Its hook confused some viewers and made experts feel smart, then it walked through one concrete example. Payout's "Watch me make up to $900 in just 30 seconds… First I go to…" was a money-making format. Tutorial and app-review formats are claimed to beat testimonials by 45% on installs per thousand impressions (Mobihunter, agency data). ([GTM Sauce ad creative](https://gtmsauce.com/topics/ad-creative))

**Beats (15–30s):**
1. Hook line spoken and on screen.
2. One concrete, real example walked through, 2–4 `screen` scenes, each with one spoken sentence (`voice`) and a zoom/tap on what's being described.
3. The result.
4. "Try [app] so you can [benefit]" over the end card.

**Rules:**
- Make one voice file per scene with `npm run voice` and put its `durationS` in the scene.
- Speak like a person explaining to a friend, not like an ad.
- Use a specific example with real numbers that the app can really produce (allowed claims).

## V3 · Animated text story with an app payoff (video)
**Source:** Halo AI ran one format across creators, no deviation: an absurd hook image, a screen recording of making it in the app (logo on the loading screen for about 2 seconds as the only call to action), then a screen-recorded text conversation building to a twist. 1.2B views in 120 days; about 5% of videos passed 100K. Knownwell's text stories (above). ([GTM Sauce hooks](https://gtmsauce.com/topics/video-hooks))

**Beats (10–20s):**
1. `chat` scene, 4–8s, where messages pop in (the hook is the first message).
2. The app moment as a `screen` with a zoom.
3. `chat` payoff/twist, 3–5s.
4. Optional `end`.

**Rules:** The twist has to land, so write the payoff first and then the setup. Characters are fictional; never a real person or brand.

## V4 · AI person, silent hook → app screens (video, AI person)
**Source:** SideShift's co-founder posted a non-talking video: big on-screen text "I have a master's degree / PhD and couldn't find a job", pointing at a screen with facial expressions (hook + demo). 6–7 of about 15 early videos hit 150–300K, and the talking-head version later got 9.6M. BePresent's "selfie + text hook overlay, not talking, trending audio" had multiple videos over 7M views. ([GTM Sauce](https://gtmsauce.com/topics/short-form-video); [BePresent](https://growwithplutus.com/blog/bepresent-app-tiktok-strategy))

**Beats (6–12s):**
1. `photo` of the AI persona with `handheld` motion, big text hook (`outline`, upper), 2.5–3.5s.
2. 1–3 `screen` scenes showing the app.
3. Optional second `photo` of the same person reacting (`--ref`).
4. `end`.

**Rules:**
- The person is a character with a feeling, never a reviewer.
- The text describes their situation ("I have a master's and…"), never a result they got from the app.
- Set `aiPeople: true`.

---

## Choosing between candidates
`npm run pick` ranks candidates. Take the first unless you can't make it **good** with this kit (missing the right screens, or the angle doesn't fit the format). Then take the next and say why in your report.

---
name: add-app
description: Sets up a new app in Ad Studio. It turns the user's description, store link and screenshots into a kit (ad-studio/apps/<slug>) that the make-ad runs use. Use when the user wants ads for a new app, or to update an app's screenshots, claims or audience.
---

# Add an app to Ad Studio

A kit is everything the unattended ad runs know about the app. Every ad is only as good and honest as the kit, so get it right with the user. This skill is interactive: ask, don't guess.

## 1. Gather
Ask for what's missing, one question at a time:
- **The app:** name, what it does in one sentence, App Store / Play Store link (if any).
- **Who it's for:** a specific person, not "everyone", plus the moment they'd want it. If there's a store link, read the listing and some reviews (WebFetch) for the audience's own words; suggest pains from them and let the user confirm.
- **The magic moment:** the one screen or sequence that makes people ask "what app is that?" Cal AI's was camera → analyzing → calories. Ask: "If someone saw only one screen of your app, which one would make them want it?" If no screen carries that moment, say so plainly: the ads will be weaker. (Flowfy's founder designs a "wow" screen on purpose.)
- **Screenshots:** full-resolution phone screenshots (not resized). At least 3, including the magic-moment screens. Ask for file paths. Screens with large, legible text work best (Cal AI makes key screens readable from a distance).
- **Optional:** app icon (square PNG), real photos (people using it, results) the user owns and is OK posting, a before/after if the app makes a visible change.
- **Allowed claims:** what the ads may say, as plain facts the user confirms are true ("Free on iOS", "Splits a receipt from a photo"). Also ask what must never be said.
- **CTA:** how people find it ("Free on the App Store: search Tally").
- **Tone and personas:** 1–3 realistic adult personas for AI-person formats.
- **Volume:** ads per day (default 10).

## 2. Build the kit
- `slug`: lowercase-dashes version of the name.
- Copy the files into `ad-studio/apps/<slug>/media/`: screenshots in `screens/` with descriptive names (`scan.png`, `result.png`), the icon as `logo.png`, and photos in `photos/`.
- Write `ad-studio/apps/<slug>/app.md`, following `ad-studio/apps/vieews/app.md` (the schema is in `studio/src/kit.ts`):
  - `screens[].shows` describes each screen in plain words.
  - Tag the magic screens `magic`.
  - `beforeAfter: true` only if the app really produces a visible change.
  - Add notes after the frontmatter: voice, no-gos, anything that would make the user wince.
- Validate:
  ```bash
  cd ad-studio/studio && npm run kit -- <slug>
  ```
  Fix anything it reports.

## 3. Try one, then turn it on
1. Offer a test ad before anything runs on a schedule. Follow the make-ad skill up to the render, then show the user the contact sheet and the video (`ad-studio/runs/<adId>/out/`). Adjust the kit from their feedback.
2. With their OK, add the slug to `apps` in `ad-studio/config.json`.
3. Commit the kit, and push only if the user says so. Cloud runs read the kit from GitHub, so a kit change takes effect only after it's pushed.

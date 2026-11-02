# Quality bar

Nobody reviews these ads before they go out, so this checklist is the reviewer. PJ Accetturo kept about 15 of 300–400 generations, and PJ Ace about 10 of 30. Throwing work away is normal; posting a bad ad is not.

## 1. Concept rubric
Score each of your three concepts 1–5 on each line and keep the highest total. All lines must be ≥3, or rethink it.

| | Question | What a 5 looks like |
|---|---|---|
| Hook | Would someone in the audience stop scrolling in the first second? | Specific, a little provocative, an open loop (see hooks.md) |
| Desire | Does it sell a feeling or outcome they want, not a feature? | The viewer pictures their life better |
| App early | Is the app's magic moment on screen by second 5 / slide 2–5? | The magic screen is the payoff of the hook |
| Proven beats | Does it follow the format's beats from formats.md? | Same structure as the source, with new content |
| Native | Would it look at home in the feed, made by a person, not a brand? | Plain words, real places, no ad voice |
| Fresh | Is it clearly different from `recent` and `usedHooks`? | New situation, new hook, new images |
| Honest | Is every claim in the kit's `claims.allowed`? | Nothing invented |

## 2. Hard rules (never break these)
- **Claims:** only from `claims.allowed`. Never: numbers the kit doesn't give (users, ratings, savings, results), "#1", "best", guarantees, medical, financial or legal promises, anything in `claims.banned`.
- **No fake testimonials or reviews.** The FTC rule (16 CFR 465, in force since Oct 2024) bans testimonials from people who don't exist or never used the product, including AI-generated ones. The endorsement guides say people shown as customers must be real or clearly disclosed. So:
  - AI or fictional people may show a **problem, a feeling, a reaction, or a skit**, and may hook ("I have a master's and…").
  - Lines about **using the app or getting results are never first person.** Write "or: snap the receipt and it splits itself", not "now I just snap the receipt".
  - Never: star ratings, "5 stars", review screenshots, "I lost 10 lbs with this app", before/after results presented as a real customer's.
- **No impersonation:** no real people, celebrities, creators or other brands' logos, products or content. Never clone another brand's posts; only vary *this app's* winners.
- **No fake engagement:** no comment seeding, no fake DMs presented as real, no fake follower counts.
- **AI labels:** if any image shows a realistic AI-generated person or scene, set `aiPeople: true` in publish.json. That turns on TikTok's AI label and YouTube's altered/synthetic disclosure.
- **People:** adults only. Nothing sexual, nothing mocking a group.
- **Sensitive topics:** if the app touches health, money, religion or relationships, stay supportive and factual (FaithFull, Pep AI and Knownwell worked by helping, not by scaring).

## 3. Visual check (read `out/contact-sheet.jpg`)
For every slide or frame:
- [ ] The hook is readable in one glance: big enough, high contrast, 2–3 lines max.
- [ ] Text stays clear of the platform UI: nothing important in the bottom ~23% or the right edge of vertical frames.
- [ ] No text clipped or overflowing, and no orphan word alone on a line if it can be avoided.
- [ ] The app screen is visible and legible, and the magic moment shows by slide 2–5 / second 5.
- [ ] AI images: no extra or warped fingers, melted faces, garbled text, logos or watermarks; the same person looks the same across slides.
- [ ] Slides feel like one set (same setting, same light, consistent text style).
- [ ] The end card / CTA shows the right app name.

Also check `render.json`: `ok: true` and no `problems`.

## 4. When something fails
1. Fix the specific thing in `ad.json` or regenerate that one image, then render again. Up to **2 fix rounds**.
2. Still failing? **Fall back** to a format that needs no AI images, made only from kit screens: V1, V2 or S5 with text backgrounds. Re-pick the hook pattern from that format's list.
3. Can't produce anything you'd stand behind? **Don't post.** Report what failed and why. A skipped slot is better than a bad ad on your account.

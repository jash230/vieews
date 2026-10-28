# Vieews design system

Source of truth for UI decisions. Derived from the ui-ux-pro-max recommendation for a social/creator SaaS ("Vibrant & Block-based", Fredoka + Nunito), built on the brand palette Prussian Blue / Charcoal Blue / Muted Teal / Muted Olive / Tea Green. Style: "soft & bouncy": a calm light dashboard with playful motion. Page-specific overrides go in `design-system/pages/<page>.md`.

## Theme
Light only. Tokens live in `src/app/globals.css` (`:root`) and are exposed to Tailwind via `@theme inline`. Components use token classes (`bg-primary`, `text-muted-foreground`), never raw hex.

| Token | Value | Use |
|---|---|---|
| background | `#FFFFFF` | Page and card surfaces |
| surface | `#F7FAF5` | Sidebar, inset panels |
| muted | `#EDF3E8` | Tabs track, skeleton base, neutral chips |
| border / border-strong | `#DDE7D7` / `#C2D2BB` | Dividers, inputs (strong on hover) |
| foreground | `#011936` Prussian | Body text (17.6:1 on white) |
| muted-foreground | `#465362` Charcoal | Secondary text (7.9:1) |
| subtle-foreground | `#5B6876` | Hints, placeholders (5.7:1, 5.0:1 on muted) |
| primary / primary-hover | `#011936` / `#13304F` | The one primary CTA per screen (white text), active nav, links |
| primary-soft | `#EEF6E6` | Selected backgrounds, hover rows, icon tiles (Prussian on it 15.9:1) |
| accent / accent-soft | `#3F6462` / `#EEF4F3` | Info, "scheduled" status, upload progress fill (5.9:1) |
| ring | `#3F6462` | Focus ring (6.5:1 on white) |
| brand-teal / brand-olive / brand-tea | `#82A3A1` / `#9FC490` / `#C0DFA1` | **Decoration only**: blobs, loader dots, button lip, highlight marker, tinted icon tiles (`/35`–`/60`). Never text on white (1.5–2.7:1). Fine as text on Prussian (6.5–12:1). |
| success / warning / destructive | `#15803D` / `#B45309` / `#DC2626` | Status text (all ≥4.5:1 on their soft backgrounds) |

Platform brand colors (`--brand-youtube|instagram|tiktok` and the `simple-icons` hex values in the landing orbit) are only for platform marks.

## Type
Fredoka (`font-display`) for h1/h2, page and card titles, stat numbers and the wordmark. Nunito (`font-sans`) for everything else. Both via next/font, `display: swap`. Scale 12 / 13 / 14 / 16 / 18 / 20 / 28–32 / 48–72 (hero). Weights: 400 body, 600 labels, 700 buttons, Fredoka 600 headings. `tabular-nums` for counts, sizes, durations and progress.

## Shape and elevation
Radius: 12 (small controls, inputs) / 16 (buttons, tiles) / 24 (cards) / 32 (landing CTA band) / 36 (phone preview). Shadows are Prussian-tinted: `shadow-sm` on cards and controls, `shadow-md` on floating tiles, `shadow-lg` for overlays, the phone preview and the orbit hub. `shadow-pop` (a 3px olive lip) sits under primary buttons, the logo tile, the brand loader and empty-state tiles.

## Components
- Buttons: `min-h-11` (44px). Variants primary / secondary / ghost / destructive. Primary lifts on hover and squishes onto its lip when pressed (spring easing). Loading shows the `Loader` dots and sets `aria-busy`.
- Inputs: visible `<label>`, hint below, error below with `role="alert"`, character counters for limited fields. Focus: accent border + tea glow.
- Status: always icon + text (`StatusBadge`), never color alone. In-flight states (publishing, processing) show `Loader` dots.
- Empty states: floating icon tile + title + one sentence + one action.
- Nav: active item gets `primary-soft` + an olive pill; icons wiggle on hover. `useLinkStatus` shows hopping dots while a route is still loading.

## Loading
- Route loads: `loading.tsx` keeps the page's skeleton shapes (no layout shift) with `BrandLoader` (the V mark, three dots hopping in turn) over the main block.
- Content placeholders: `Skeleton` uses a tea-tinted `shimmer` sweep.
- Inline: `Loader` (`src/components/ui/loader.tsx`, variants spinner / dots / bars / morph). Pass `label={null}` when nearby text already says what's loading.
- Upload progress: deep-teal bar with moving `stripes`.

## Motion
Tokens: `--ease-spring` (overshoot, for presses and pops) and `--ease-out` (entrances). Micro-interactions 150–300ms; entrances 500–600ms with 80–90ms stagger. Animate transform/opacity only. Utilities: `animate-fade-up`, `animate-pop-in`, `animate-float`, `animate-wiggle`, `animate-hop`, `animate-shimmer`, `animate-stripes`. The global `prefers-reduced-motion` override in `globals.css` cuts every CSS animation to its end frame, except the landing orbit, which only slows down. The motion-based components check `useReducedMotion` themselves.

## Landing page
- Hero: Fredoka headline "Upload once. Post to [word]" where `WordRotate` cycles everywhere → YouTube → Instagram → TikTok over a tea-green marker. Screen readers get the static sentence.
- `PlatformOrbit`: social platform tiles on a tilted ring spinning in 3D around the Vieews mark. Pure CSS, so tiles grow at the front and shrink at the back through perspective. It never stops: no hover pause, and under reduced motion it is exempt from the global cut-off and turns slower (90s per lap) instead.
- Header holds only the logo; "Get started" is the way in.
- Floating palette blobs, stagger-in feature cards, and a Prussian CTA band.

## Third-party components (21st.dev)
- `src/components/ui/word-rotate.tsx`: adapted from "Dia Text" by animbits.
- `src/components/ui/loader.tsx`: adapted from "Loader" by my, trimmed to 4 variants.

Both use `motion`.

## Layout
Mobile-first. ≥1024px: 256px sidebar. Below: sticky top bar + right sheet menu (Esc and scrim close it). Content `max-w-6xl`, gutters 16 / 24 / 40px.

## Accessibility
Focus ring 2px `--ring` with 2px offset on every focusable element. Skip link in the app shell. `aria-current` on nav, `role="switch"` on toggles, `aria-live` for upload progress and validation. Decorative motion (blobs, orbit, rotating word) is `aria-hidden`.

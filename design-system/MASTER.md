# Vieews design system

Source of truth for UI decisions. Derived from the ui-ux-pro-max recommendation for a social/creator SaaS ("Vibrant & Block-based", rose + blue), toned down into a clean light dashboard. Page-specific overrides go in `design-system/pages/<page>.md`.

## Theme
Light only. Tokens live in `src/app/globals.css` (`:root`) and are exposed to Tailwind via `@theme inline`. Components use token classes (`bg-primary`, `text-muted-foreground`), never raw hex.

| Token | Value | Use |
|---|---|---|
| background | `#FFFFFF` | Page and card surfaces |
| surface | `#F8FAFC` | Sidebar, inset panels, hover rows |
| muted | `#F1F5F9` | Tabs track, skeletons, neutral chips |
| border / border-strong | `#E2E8F0` / `#CBD5E1` | Dividers, inputs (strong on hover) |
| foreground | `#0F172A` | Body text (17.9:1 on white) |
| muted-foreground | `#475569` | Secondary text (7.6:1) |
| subtle-foreground | `#64748B` | Hints, placeholders (4.8:1) |
| primary / primary-hover | `#E11D48` / `#BE123C` | The one primary CTA per screen, active nav, selected chips |
| primary-soft | `#FFF1F2` | Selected backgrounds, icon tiles |
| accent / accent-soft | `#2563EB` / `#EFF6FF` | Info, "scheduled" status |
| success / warning / destructive | `#15803D` / `#B45309` / `#DC2626` | Status text (all ≥4.5:1 on their soft backgrounds) |

Brand colors (`--brand-youtube|instagram|tiktok`) are only for platform marks, from `simple-icons`.

## Type
Plus Jakarta Sans (next/font, `display: swap`). Scale 12 / 13 / 14 / 16 / 18 / 24 / 28 / 36+. Weights: 400 body, 500 labels, 600 titles, 700–800 headings. `tabular-nums` for counts, sizes, durations and progress.

## Shape and elevation
Radius: 8 (small controls) / 12 (buttons, inputs, chips) / 16 (cards) / 36 (phone preview). Shadows: `shadow-sm` on cards and controls, `shadow-lg` only for overlays and the phone preview.

## Components
- Buttons: `min-h-11` (44px). Variants primary / secondary / ghost / destructive. Loading shows a spinner and sets `aria-busy`.
- Inputs: visible `<label>`, hint below, error below with `role="alert"`, character counters for limited fields.
- Status: always icon + text (`StatusBadge`), never color alone.
- Empty states: icon tile + title + one sentence + one action.
- Loading: skeletons via `loading.tsx`, not spinners.

## Layout
Mobile-first. ≥1024px: 256px sidebar. Below: sticky top bar + right sheet menu (Esc and scrim close it). Content `max-w-6xl`, gutters 16 / 24 / 40px.

## Motion
150–300ms, ease-out; transform/opacity only. Global `prefers-reduced-motion` override in `globals.css`.

## Accessibility
Focus ring 2px `--ring` with 2px offset on every focusable element. Skip link in the app shell. `aria-current` on nav, `role="switch"` on toggles, `aria-live` for upload progress and validation.

# RestoFlow

Ravintolan kulujen, kuittien ja työajan hallinta. Next.js 16 (App Router,
TypeScript, Tailwind), deployattu Vercelille.

## Connections

- **GitHub**: `mattsmatias/budet`, branch `main`
- **Vercel**: project `budet-app` under team `asunyt` — deploys automatically
  on push to `main`

Repo and Vercel project are still named `budet` for historical reasons. The
product is RestoFlow. Renaming them would break the working deploy chain for
no gain — if a deploy ever seems to ignore a push, check Vercel → Settings →
Git before anything else.

## Scope is enforced in the data model

RestoFlow deliberately does NOT do: point of sale, sales tracking, bank
integration, inventory, reservations, CRM, orders, delivery.

**There is no field for sales anywhere in the data model.** This is not an
oversight — it means no screen can accidentally present expenses as the
restaurant's financial result. Every total means *kirjatut kulut*: the sum of
receipts entered into the system. Keep it that way when adding features.

## Two interfaces, not two breakpoints

- `/app` — employee, phone-shaped even on desktop. Only that person's hours,
  shifts and receipts.
- `/admin` — manager, desktop workspace. The whole restaurant.

An employee has no business seeing the expense total. Do not merge these into
one responsive view.

## Non-obvious decisions

- **Time clock state is derived from events, never stored.** A stored state
  could drift out of agreement with the event log that determines someone's
  pay. `currentState()` and `computeWorked()` are the only source of truth.
- **`nowIso` is always a parameter**, never `Date.now()` inside logic.
  Otherwise the functions are untestable and non-deterministic.
- **Money is integer cents everywhere.** Rounding happens once, at the end.
  Per-minute rounding in payroll accumulates into a real error over a month.
- **Extraction returns value + confidence**, never a bare value. Anything
  below high confidence is flagged and editable before saving.
- **Colour means status only.** Green = ok, blue = info, amber = pending, red
  = problem. The dashboard is grey and white; a coloured dot always means
  something. Expense growth is neither good nor bad without context, so trend
  arrows stay grey.

## Design language

Apple-adjacent: very light grey background, white cards, large radii, shadows
subtle enough to read as depth rather than decoration. Tokens live in
`app/theme.css` scoped under `.restoflow` (applied to `<body>`). SF Pro via
system font stack first, Inter as fallback.

## Notes

- Demo data is fixed and does not depend on the current clock, so views are
  reproducible. `DEMO_NOW` is the reference instant.
- Nothing persists — no database is wired. Every view says so. Do not add a
  control that appears to save when it does not.
- The repo lives under OneDrive, so `node_modules` syncs to the cloud. This
  can slow things down and occasionally cause file-lock build failures.

## Previous product

This repo held Verra, a tax compliance platform, until it was replaced. The
history is intact — restore with
`git checkout c64c4dc -- app lib components utils supabase proxy.ts`.

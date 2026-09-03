# Kate

Ravintolan kulujen, kuittien ja työajan hallinta. Next.js 16 (App Router,
TypeScript, Tailwind), deployattu Vercelille.

## Connections

- **GitHub**: `mattsmatias/budet`, branch `main`
- **Vercel**: project `budet-app` under team `asunyt` — deploys automatically
  on push to `main`

### The product has been renamed twice

The product is **Kate**. It was Budet before that, and RestoFlow before that.
Only user-visible text was renamed each time; internal identifiers were left
alone on purpose. So you will find all three names in the tree and none of it
is a bug:

- `lib/restoflow/`, `components/restoflow/`, the `.restoflow` body class,
  the `--rf-*` CSS tokens and `RfIcon` — from the RestoFlow era
- the `--bd-*` tokens in `landing.css`/`worker.css`, `budetCents` in
  `sales-vat.ts`, the `budet_locale` cookie and the `text/budet-user` drag
  type — from the Budet era
- `mattsmatias/budet` on GitHub and `budet-app` on Vercel

Renaming the repo or the Vercel project would break the working deploy chain
for no gain — if a deploy ever seems to ignore a push, check Vercel →
Settings → Git before anything else. Renaming the cookie would silently drop
everyone's saved language. When you rename the product again, rename the
words people read and leave the identifiers where they are.

## Scope is enforced in the data model

Kate deliberately does NOT do: point of sale, bank integration, inventory,
CRM, orders, delivery.

Table reservations ARE in scope and shipped (`/admin/varaukset`,
`app/varaa/[slug]`, `public/widget.js`): floor plan, calendar with drag and
drop, walk-ins, a booking list with search, opening hours that may run past
midnight, kitchen capacity, analytics, a public booking widget, and import
from another system. Sales tracking is a separate question and stays out —
see the next paragraph.

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

- Supabase is wired and everything persists. (This line used to say the
  opposite; it was left over from the prototype and was wrong for a long
  time. If a view still claims nothing is saved, that view is the bug.)
- Reservation rules live in the database, not in the app: availability, the
  advisory lock, the kitchen limit, opening hours and the booking reference
  are all in `supabase/migrations/006[6-8]*` and `009[1-5]*`. The app
  validates shape and translates errors; it does not decide.
- The repo lives under OneDrive, so `node_modules` syncs to the cloud. This
  can slow things down and occasionally cause file-lock build failures.

## Previous product

This repo held Verra, a tax compliance platform, until it was replaced. The
history is intact — restore with
`git checkout c64c4dc -- app lib components utils supabase proxy.ts`.

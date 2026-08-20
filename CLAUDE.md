# Budet

Next.js 16 (App Router) + Supabase. Deployed on Vercel.

## Connections

- **GitHub**: `mattsmatias/budet`, branch `main`
- **Vercel**: project `budet-app` under team `asunyt` — deploys automatically on push to `main`
- **Supabase**: project ref `zarapxgprpmwekedrzmy`

Vercel's project is named `budet-app` because `budet` was taken. During the
initial import Vercel created a stray private repo `mattsmatias/budet-app`
and connected to that instead of this one. If a deploy ever seems to ignore
a push, check Vercel → Settings → Git before anything else.

## MCP

`.mcp.json` declares Supabase and Vercel MCP servers. Project-scoped MCP
config only loads when the session's working directory is this folder, so
**start Claude Code from here**, not from a parent directory. A session
started elsewhere silently has no database access.

## Environment

`.env.local` holds `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). Both are also set in
Vercel's project settings — adding a new env var means adding it in both
places. Only ever put the publishable key in a `NEXT_PUBLIC_` variable;
Next.js ships those to the browser.

## Notes

- `proxy.ts` (formerly `middleware.ts`, renamed in Next 16) refreshes the
  Supabase session on every matched request. The helper it calls lives in
  `utils/supabase/middleware.ts` and must await `supabase.auth.getUser()` —
  without that call nothing is actually refreshed.
- `app/page.tsx` queries a `todos` table that does not exist yet; it renders
  the Supabase error as a connection indicator.
- `public/test.html` is the original static smoke-test page.
- The repo lives under OneDrive, so `node_modules` syncs to the cloud. This
  can slow things down and occasionally cause file-lock build failures.

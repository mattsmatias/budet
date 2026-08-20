# Budet

Next.js 16 (App Router, TypeScript, Tailwind) with Supabase, deployed on Vercel.

Live: https://budet-app.vercel.app

## Getting started

Install dependencies and copy the environment template:

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` with the values from the Supabase dashboard
(Project Settings → API Keys). Use the **publishable** key
(`sb_publishable_...`) — never the secret key, since `NEXT_PUBLIC_`
variables are sent to the browser.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

Then run the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

## Layout

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Home page; queries Supabase and shows the connection status |
| `utils/supabase/client.ts` | Browser client |
| `utils/supabase/server.ts` | Server Component client |
| `utils/supabase/middleware.ts` | Session-refresh helper used by `proxy.ts` |
| `proxy.ts` | Runs the session refresh on matched requests |
| `public/test.html` | Static smoke-test page |

## Deployment

Pushing to `main` deploys to Vercel automatically. The environment variables
above must also be set in the Vercel project settings — `.env.local` is
gitignored and never reaches the build.

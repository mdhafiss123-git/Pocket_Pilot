# Pocket Pilot

A mobile-friendly personal expense tracker and daily planner built with Next.js, TypeScript, Tailwind CSS, Supabase, Recharts, Zod, Lucide, and PWA support.

## What works without accounts or credentials

The project starts in **demo mode** when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are empty. It preloads sample income, expenses, a budget, a goal, and a task. Changes stay only in the current browser's local storage. This is intentional: it lets you inspect the product locally without sending personal data anywhere.

In demo mode you can add income/expenses and tasks, complete tasks, inspect report and budget views, change theme, reset data, and export transactions as CSV. It is not a replacement for cloud sync, real Google login, cross-device access, automatic recurring-task creation, or production notifications.

## Run locally

1. Install Node.js 20.9 or later from [nodejs.org](https://nodejs.org/).
2. Extract this archive and open a terminal in its folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`. Leave it blank for demo mode.
5. Run `npm run dev` and open `http://localhost:3000`.
6. For a production check, run `npm run build`, then `npm start`.

Run the included validation tests with `npm test`.

## Enable Supabase and Google sign-in

1. Create a Supabase project, then use the SQL Editor or Supabase CLI to apply `supabase/migrations/20261022000000_initial_schema.sql`.
2. In Supabase **Authentication → Providers → Google**, enable Google and add your Google OAuth client ID and secret.
3. In Google Cloud Console, add the Supabase callback URL shown in the provider panel as an authorized redirect URI.
4. In Supabase Authentication URL configuration, add `http://localhost:3000` and your deployed site URL as redirect URLs.
5. Copy the project URL and **anon** key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Restart the dev server.

The migration enables RLS on every user table; the browser uses only the anon key. Never expose the Supabase `service_role` key in a browser variable or repository.

## Important integration note

The current UI provides a verified demo implementation and includes the secure Supabase schema/RLS foundation. Before treating Supabase as production-ready, complete the repository data-adapter layer that connects the UI mutations and queries to the supplied tables, then test Google OAuth with your own provider credentials. Credentials are deliberately not included in this ZIP.

## Deployment (Vercel)

1. Push the extracted folder to your Git provider or import it directly in Vercel.
2. Add the same three environment variables from `.env.local` (`CRON_SECRET` only if implementing a protected reminder worker).
3. Deploy and add the deployed URL to Supabase redirect URLs.

The included lightweight service worker makes the app installable and provides a basic offline fallback. Provide 192px and 512px app icons in `public/` and add their paths to `public/manifest.json` before publishing to an app store.

## Security and privacy checklist

- RLS policies ensure a signed-in user can only access their own rows.
- Database constraints and client-side Zod schemas validate common input limits.
- CSV values are quoted; do not open untrusted CSV files with spreadsheet macros enabled.
- Keep `.env.local` private; it is not included in source control.
- Use HTTPS, configure CSP/headers, rate limiting, monitoring, backups, and a server-side notification provider before production use.

## Folder guide

- `app/` — Next.js pages and styles
- `components/` — chart and theme UI
- `lib/` — types, validation, demo storage, Supabase client
- `supabase/migrations/` — database schema, triggers, indexes, and RLS
- `tests/` — automated validation tests

This is the marketing and onboarding site for `sansxel`, built with Next.js and Supabase.

## Run Locally

1. Install dependencies if needed:

```bash
npm install
```

2. Add these variables to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Supabase Setup Notes

### Auth providers

- Email and password auth works with the existing public Supabase keys.
- Google and GitHub use Supabase OAuth with the shared callback route at
  `app/auth/callback/route.ts`.
- Microsoft and Apple stay disabled in the UI until their provider setup is
  finished.
- Add these callback URLs in Supabase Auth:

```text
http://localhost:3000/auth/callback
https://sansxel.ai/auth/callback
```

### Early access storage

Create a table named `early_access_signups` and allow inserts and updates from the anon role.

```sql
create table if not exists public.early_access_signups (
  email text primary key,
  name text,
  focus_area text,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

alter table public.early_access_signups enable row level security;

create policy "Allow public early access inserts"
on public.early_access_signups
for insert
to anon
with check (true);

create policy "Allow public early access updates"
on public.early_access_signups
for update
to anon
using (true)
with check (true);
```

## What Is Implemented

- Custom email and password auth UI
- OAuth buttons for Google and GitHub via Supabase
- Disabled Microsoft and Apple cards until those providers are configured
- Real routes for pricing, download, privacy, terms, and contact
- Supabase-backed early access form through `/api/early-access`
- Shared header and footer with meaningful navigation and CTA links

## Checks

Run these before shipping:

```bash
npm run lint
npm run build
```

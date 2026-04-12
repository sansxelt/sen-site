This is the marketing and onboarding site for `sansxel`, built with Next.js, Auth.js, and Supabase as the database layer.

## Run Locally

1. Install dependencies if needed:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in every value:

```bash
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=replace-with-google-client-id
AUTH_GOOGLE_SECRET=replace-with-google-client-secret
AUTH_GITHUB_ID=replace-with-github-client-id
AUTH_GITHUB_SECRET=replace-with-github-client-secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-supabase-service-role-key
```

3. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Auth.js Setup

### Live providers

- Google uses Auth.js with the callback URL:

```text
http://localhost:3000/api/auth/callback/google
https://sansxel.ai/api/auth/callback/google
```

- GitHub uses Auth.js with the callback URL:

```text
http://localhost:3000/api/auth/callback/github
https://sansxel.ai/api/auth/callback/github
```

### App-hosted auth routes

- Custom sign-in page: `/auth/signin`
- Custom error page: `/auth/error`
- Auth.js handler route: `/api/auth/[...nextauth]`
- Protected workspace route: `/account`

## Supabase Database Setup

Auth is no longer handled by Supabase Auth. Supabase is now used only for app data and secure server-side storage for account records.

Run the SQL in [docs/auth-schema.sql](./docs/auth-schema.sql) to create:

- `public.early_access_signups`
- `public.user_profiles`
- `public.user_credentials`
- `public.account_subscriptions`

The app uses the service role key from server-side route handlers, so public anon
insert policies are no longer required for the auth or early-access flow.

## What Is Implemented

- Auth.js email/password credentials flow with bcrypt password hashing
- Auth.js OAuth flow for Google and GitHub
- App-hosted sign-in and error routes on `sansxel.ai`
- JWT-based secure session handling through Auth.js
- Protected account routes through `proxy.ts`
- Supabase-backed workspace profile storage in `public.user_profiles`
- Supabase-backed password credential storage in `public.user_credentials`
- Supabase-backed early access storage in `public.early_access_signups`
- Supabase-backed subscription selection state in `public.account_subscriptions`
- Account registration route at `/api/auth/register`
- Account subscription route at `/api/account/subscription`
- Premium responsive auth UI across the landing page and dedicated sign-in page
- Shared header and footer with meaningful navigation and CTA links

## Checks

Run these before shipping:

```bash
npm run lint
npm run build
```

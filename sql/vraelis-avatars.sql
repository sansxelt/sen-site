-- Profile pictures: PRIVATE storage bucket. OPERATOR ACTION — run once in the Supabase SQL
-- editor (Dashboard -> SQL), or create the bucket in Dashboard -> Storage -> New bucket with
-- name "vraelis-avatars", Public OFF. Idempotent: safe to re-run.
--
-- The app fails closed (503 "bucket_missing") on upload/remove until this exists. No table
-- changes are needed: the object path is derived from the session user (sha256 of the
-- lowercased email), display name uses the existing v_profiles.display_name column, and all
-- access goes through the service-role key with short-TTL signed URLs (never public URLs).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vraelis-avatars',
  'vraelis-avatars',
  false,                                              -- PRIVATE: no public URLs, signed URLs only
  2097152,                                            -- 2 MB, matches the app's client+server limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage RLS policies are added on purpose: only the service-role key (which bypasses RLS)
-- touches this bucket, so the default deny-all for anon/authenticated is exactly right.

-- Demo account for YC reviewers: demo@vraelis.com, display name "Y Combinator".
--
-- WHY THIS EXISTS: the normal signup path emails a confirmation link, and demo@vraelis.com has no mailbox.
-- Rather than stand up an alias just to click one link, the two rows signup would have written are inserted
-- directly. Nothing else is special about this account; it is an ordinary user from every other angle.
--
-- The password hash below is bcrypt cost 12 of "VraelisDemo-Fall2026", generated with the same library the
-- app verifies against (lib/user-credentials.ts -> verifyPassword -> bcrypt compare). auth.ts does NOT check
-- email verification at sign-in, only that a credential row with a hash exists, so this is enough to log in.
--
-- canonical_email follows lib/user-credentials.ts canonicalizeEmail(): lowercase, strip any +tag, and fold
-- gmail dots. For demo@vraelis.com that is just the address itself, but the column is written explicitly so
-- the dedup index behaves the same as it would for a real signup.
--
-- IDEMPOTENT: safe to re-run. Re-running RESETS the password back to the published one, which is what you
-- want if a reviewer ever changes it.
--
-- TO REVOKE after the batch: delete both rows (statement at the bottom, commented out).

-- 1) Credentials: what sign-in checks.
insert into user_credentials (email, canonical_email, password_hash, updated_at)
values (
  'demo@vraelis.com',
  'demo@vraelis.com',
  '$2b$12$B5HfGAn77hLIdrxwJ4gv.uXmoTNJ9i45Vp4BbCzknJLe3m1VXtV66',
  now()
)
on conflict (email) do update
  set password_hash = excluded.password_hash,
      canonical_email = excluded.canonical_email,
      updated_at = now();

-- 2) Profile: what the app greets them with. display_name is what shows in the top bar and avatar menu,
--    so a reviewer signs in and sees "Y Combinator" rather than "demo".
insert into user_profiles (email, canonical_email, display_name, updated_at)
values (
  'demo@vraelis.com',
  'demo@vraelis.com',
  'Y Combinator',
  now()
)
on conflict (email) do update
  set display_name = excluded.display_name,
      canonical_email = excluded.canonical_email,
      updated_at = now();

-- Verify both rows landed.
select c.email, c.canonical_email, left(c.password_hash, 7) as hash_prefix, p.display_name
from user_credentials c
left join user_profiles p on p.email = c.email
where c.email = 'demo@vraelis.com';

-- REVOKE (uncomment and run when the batch is over):
-- delete from user_profiles    where email = 'demo@vraelis.com';
-- delete from user_credentials where email = 'demo@vraelis.com';

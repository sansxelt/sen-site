-- Bind each OAuth account to the provider's stable subject ID.
--
-- WHY. Identity in this system is a bare email STRING. isAdminEmail keys on it, and every owner-scoped
-- row keys on it. Nothing recorded WHICH provider account an address arrived from, so two different
-- provider accounts presenting the same address were indistinguishable — the second one simply became
-- the first one's account.
--
-- Requiring a verified address (lib/github-identity.ts) is the primary control and it closes the common
-- case: GitHub will not let two accounts hold the same verified address at once. This table is the
-- second layer, and it catches what verification alone cannot — an address that MOVES between provider
-- accounts, and any future provider whose verification is weaker than assumed.
--
-- WHAT IS NOT DONE HERE, stated plainly: this does not make the subject ID the primary key of identity.
-- Doing that means rewriting every owner_email column, every admin check, and every query in the product
-- — a migration of the whole auth surface, not a security fix. The subject is recorded and CHECKED; the
-- email remains the join key.

create table if not exists v_oauth_identities (
  provider    text        not null,
  subject     text        not null,
  email       text        not null,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (provider, subject)
);

-- The guard this table exists for: at most ONE subject may hold a given address on a given provider.
-- A second subject arriving with the same address collides here instead of silently taking the account.
create unique index if not exists v_oauth_identities_email_uidx
  on v_oauth_identities (provider, email);
create index if not exists v_oauth_identities_email_idx on v_oauth_identities (email);

alter table v_oauth_identities enable row level security;
revoke all privileges on v_oauth_identities from public;
revoke all privileges on v_oauth_identities from anon, authenticated;
grant all privileges on v_oauth_identities to service_role;

-- Record a sign-in, or report the conflict.
--
--   { ok: true,  status: 'bound' | 'known' | 'email_changed' }
--   { ok: false, status: 'subject_conflict', bound_subject: text }
--
-- 'email_changed' is ALLOWED. A user changing their address at the provider is ordinary, and the subject
-- proves it is the same account; they simply land on the app account that address maps to.
-- 'subject_conflict' is REFUSED: a different provider account is presenting an address this provider
-- already bound to someone else, which is the takeover shape.
create or replace function v_bind_oauth_identity(p_provider text, p_subject text, p_email text)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_prov  text := lower(trim(coalesce(p_provider, '')));
  v_sub   text := trim(coalesce(p_subject, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_existing_email   text;
  v_existing_subject text;
begin
  if v_prov = '' or v_sub = '' or v_email = '' then
    return jsonb_build_object('ok', false, 'status', 'invalid');
  end if;

  -- Serialise per provider+email, so two simultaneous first-time sign-ins for one address cannot both
  -- read "unbound" and both insert.
  perform pg_advisory_xact_lock(hashtext('v_oauth_identity:' || v_prov || ':' || v_email));

  select email into v_existing_email
    from v_oauth_identities where provider = v_prov and subject = v_sub;

  select subject into v_existing_subject
    from v_oauth_identities where provider = v_prov and email = v_email;

  -- Someone else's subject already owns this address on this provider.
  if v_existing_subject is not null and v_existing_subject is distinct from v_sub then
    return jsonb_build_object('ok', false, 'status', 'subject_conflict', 'bound_subject', v_existing_subject);
  end if;

  if v_existing_email is null then
    insert into v_oauth_identities (provider, subject, email) values (v_prov, v_sub, v_email);
    return jsonb_build_object('ok', true, 'status', 'bound');
  end if;

  if v_existing_email is distinct from v_email then
    update v_oauth_identities
       set email = v_email, last_seen_at = now()
     where provider = v_prov and subject = v_sub;
    return jsonb_build_object('ok', true, 'status', 'email_changed');
  end if;

  update v_oauth_identities set last_seen_at = now()
   where provider = v_prov and subject = v_sub;
  return jsonb_build_object('ok', true, 'status', 'known');
end;
$$;

revoke all on function v_bind_oauth_identity(text, text, text) from public;
revoke all on function v_bind_oauth_identity(text, text, text) from anon, authenticated;
grant execute on function v_bind_oauth_identity(text, text, text) to service_role;

// Phase 3 — GitHub sign-in must use a VERIFIED address, and an OAuth account is bound to its subject.
//
// WHAT WAS BROKEN. @auth/core's stock GitHub provider reads GET /user, and only when that has no email
// falls back to /user/emails picking `(emails.find(e => e.primary) ?? emails[0]).email` — never looking at
// the `verified` flag GitHub returns beside every address. Identity in this product IS the email string
// (isAdminEmail keys on it; every owner-scoped row keys on it), so an address accepted without proof is an
// account takeover: add someone@thecompany.com to a throwaway GitHub account and sign in as them.
//
// The signIn callback's "provider must say the email is verified" gate did not cover this. It refuses an
// explicit `email_verified === false`, and GitHub never sends that field at all — so on GitHub the gate
// was INERT while reading as though it were closed.
//
// This test drives the REAL fetchGitHubProfile with a stubbed transport, so the control flow that decides
// which address to trust is executed rather than inspected. The binding half runs against a real
// PostgreSQL. Requires Docker only for the binding section; without it that section reports SKIP.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fetchGitHubProfile, pickVerifiedEmail, GitHubEmailUnverifiedError, type FetchLike } from "../lib/github-identity";

let pass = 0, fail = 0, skipped = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const skip = (n: string, why: string) => { console.log(`SKIP  ${n}  (${why})`); skipped++; };
const read = (p: string) => readFileSync(p, "utf8");

const PG = "vraelis-oauthbind-verify";
const sh = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
const shq = (cmd: string, args: string[]): string => { try { return sh(cmd, args); } catch { return ""; } };
const psql = (sql: string, db = "oauthbind"): string =>
  sh("docker", ["exec", PG, "psql", "-U", "postgres", "-d", db, "-At", "-c", sql]).trim();
function psqlStdin(sqlText: string, db = "oauthbind", stop = true): { out: string; code: number } {
  const args = ["exec", "-i", PG, "psql", "-U", "postgres", "-d", db, "-q"];
  if (stop) args.push("-v", "ON_ERROR_STOP=1");
  const r = spawnSync("docker", args, { input: sqlText, encoding: "utf8", maxBuffer: 1 << 26 });
  return { out: `${r.stdout ?? ""}${r.stderr ?? ""}`, code: r.status ?? 1 };
}

// ── 1. Address selection, against adversarial payloads ─────────────────────
console.log("── which address GitHub's list yields ──");
{
  const E = (email: string, primary: boolean, verified: unknown) => ({ email, primary, verified });

  ok("an unverified primary is NOT accepted", pickVerifiedEmail([E("attacker@evil.test", true, false)]) === null);
  ok("the stock provider's emails[0] pick is NOT reproduced",
    pickVerifiedEmail([E("unverified@evil.test", false, false), E("real@ok.test", false, true)]) === "real@ok.test");
  ok("an unverified primary loses to a verified secondary",
    pickVerifiedEmail([E("unverified@evil.test", true, false), E("real@ok.test", false, true)]) === "real@ok.test");
  ok("a verified primary wins over a verified secondary",
    pickVerifiedEmail([E("second@ok.test", false, true), E("primary@ok.test", true, true)]) === "primary@ok.test");
  ok("an empty list yields nothing", pickVerifiedEmail([]) === null);
  ok("a non-array payload yields nothing", pickVerifiedEmail({ email: "x@y.test", verified: true }) === null);
  ok("null yields nothing", pickVerifiedEmail(null) === null);

  // `verified` must be the boolean. Truthy look-alikes are not GitHub's shape, and accepting them would
  // undermine the single check this function exists to make.
  for (const v of ["true", 1, "yes", {}, [], "1"]) {
    ok(`verified: ${JSON.stringify(v)} is not accepted as true`, pickVerifiedEmail([E("x@y.test", true, v)]) === null);
  }
  ok("a verified entry with a non-string email is skipped",
    pickVerifiedEmail([{ email: 12345, primary: true, verified: true }, E("real@ok.test", false, true)]) === "real@ok.test");
  ok("an address with no @ is skipped",
    pickVerifiedEmail([E("notanemail", true, true), E("real@ok.test", false, true)]) === "real@ok.test");
  ok("the chosen address is normalised", pickVerifiedEmail([E("  MiXeD@OK.test  ", true, true)]) === "mixed@ok.test");
}

// ── 2. The real fetch path, with a stubbed transport ───────────────────────
console.log("── the profile request itself ──");
async function transport(): Promise<void> {
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const calls: string[] = [];
  const stub = (user: unknown, emails: unknown, emailStatus = 200, userStatus = 200): FetchLike =>
    async (url: string) => {
      calls.push(url);
      if (url.endsWith("/user")) return json(user, userStatus);
      if (url.endsWith("/user/emails")) return json(emails, emailStatus);
      return json({}, 404);
    };
  const threw = async (p: Promise<unknown>): Promise<string | null> => {
    try { await p; return null; } catch (e) { return e instanceof GitHubEmailUnverifiedError ? e.reason : "other"; }
  };

  calls.length = 0;
  const profile = await fetchGitHubProfile("t", stub(
    { id: 1, login: "u", email: "public@ok.test" },
    [{ email: "verified@ok.test", primary: true, verified: true }],
  ));
  ok("the verified list is consulted even when /user already has an email",
    calls.some((u) => u.endsWith("/user/emails")), calls.join(" "));
  ok("the verified list overrides the public profile email", profile.email === "verified@ok.test");
  ok("a positive verified claim is stamped for the signIn gate", profile.email_verified === true);

  ok("a list with nothing verified fails the sign-in",
    (await threw(fetchGitHubProfile("t", stub({ id: 1, email: "public@ok.test" },
      [{ email: "public@ok.test", primary: true, verified: false }])))) === "no_verified_address");

  // 403 here is normally the user:email scope missing from the grant.
  ok("a missing user:email scope fails the sign-in rather than falling back",
    (await threw(fetchGitHubProfile("t", stub({ id: 1, email: "public@ok.test" }, {}, 403)))) === "emails_endpoint_403");
  ok("an unreachable emails endpoint fails the sign-in",
    (await threw(fetchGitHubProfile("t", stub({ id: 1, email: "public@ok.test" }, {}, 500)))) === "emails_endpoint_500");
  ok("a failed /user call fails the sign-in",
    (await threw(fetchGitHubProfile("t", stub({}, [], 200, 401)))) === "user_endpoint_401");

  // The takeover scenario, end to end: an attacker adds the victim's address to their own GitHub account
  // but never proves it. Their own address is the verified one.
  const attack = await fetchGitHubProfile("t", stub(
    { id: 99, login: "attacker", email: "victim@thecompany.test" },
    [
      { email: "victim@thecompany.test", primary: true, verified: false },
      { email: "attacker@throwaway.test", primary: false, verified: true },
    ],
  ));
  ok("an unproven victim address never becomes the identity", attack.email !== "victim@thecompany.test");
  ok("the attacker signs in as themselves instead", attack.email === "attacker@throwaway.test", String(attack.email));
}

// ── 3. The signIn gate actually requires the claim ─────────────────────────
function gate(): void {
  console.log("── the signIn gate ──");
  const a = read("auth.ts").replace(/\r/g, "");
  ok("the GitHub provider no longer uses the stock userinfo", a.includes("fetchGitHubProfile"));
  ok("GitHub sign-in requires a POSITIVE verified claim",
    /provider === "github" && verifiedClaim !== true/.test(a));

  // Ordering: the verification gate and the binding must both run before an account can be created.
  // Anchor on the CALL, not the bare identifier — the identifier's first occurrence is the import at the
  // top of the file, which sits before everything and makes any "runs before" check pass vacuously.
  const gateAt = a.indexOf('provider === "github" && verifiedClaim !== true');
  const createAt = a.indexOf("await syncUserProfileIdentity({");
  const bindAt = a.indexOf("await bindOAuthIdentity(");
  ok("the call sites were located, not the imports", createAt > 0 && bindAt > 0 && createAt > 2000,
    `create@${createAt} bind@${bindAt}`);
  ok("the gate runs before an account can be created", gateAt > 0 && createAt > gateAt, `gate@${gateAt} create@${createAt}`);
  ok("the subject binding also runs before account creation", bindAt > 0 && createAt > bindAt, `bind@${bindAt} create@${createAt}`);
  ok("a binding conflict refuses the sign-in", /bound === "conflict"[\s\S]{0,200}return false/.test(a));
}

// ── 4. The binding, against a real database ────────────────────────────────
async function binding(): Promise<void> {
  console.log("── subject binding against a real PostgreSQL ──");
  if (!shq("docker", ["info"])) { skip("the binding suite", "Docker is not available"); return; }
  shq("docker", ["rm", "-f", PG]);
  sh("docker", ["run", "-d", "--name", PG, "-e", "POSTGRES_PASSWORD=pgpw", "postgres:16-alpine"]);
  let up = false;
  for (let i = 0; i < 60; i += 1) {
    if (shq("docker", ["exec", PG, "pg_isready", "-U", "postgres"]).includes("accepting connections")) { up = true; break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) { skip("the binding suite", "PostgreSQL did not become ready"); return; }

  psqlStdin("create database oauthbind;", "postgres");
  psqlStdin(`do $x$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role login bypassrls password 'srpw'; end if;
    end $x$;`);

  const mig = psqlStdin(read("sql/vraelis-oauth-identity-binding.sql"));
  ok("the migration applies to a clean database", mig.code === 0, mig.out.slice(0, 200));
  const ver = psqlStdin(read("sql/vraelis-oauth-identity-binding-verify.sql"));
  ok("all 7 verification checks pass", (ver.out.match(/\bOK\b/g) ?? []).length === 7 && !ver.out.includes("FAIL"));

  const bind = (p: string, s: string, e: string) =>
    psql(`select v_bind_oauth_identity('${p}','${s}','${e}')->>'status';`);

  ok("a first sign-in binds", bind("github", "sub-1", "a@t.co") === "bound");
  ok("the same account signing in again is known", bind("github", "sub-1", "a@t.co") === "known");
  ok("case and whitespace do not create a second binding", bind("github", "sub-1", "  A@T.CO ") === "known");

  // THE TAKEOVER SHAPE: a different provider account presenting an address already bound.
  ok("a different subject claiming a bound address is REFUSED", bind("github", "sub-evil", "a@t.co") === "subject_conflict");
  ok("the refusal did not overwrite the original binding",
    psql("select subject from v_oauth_identities where provider='github' and email='a@t.co';") === "sub-1");

  // A legitimate address change at the provider keeps the same subject.
  ok("the same subject with a new address is allowed", bind("github", "sub-1", "a2@t.co") === "email_changed");
  ok("the old address is released by the change",
    psql("select count(*) from v_oauth_identities where provider='github' and email='a@t.co';") === "0");
  ok("the freed address can now be bound by someone else", bind("github", "sub-2", "a@t.co") === "bound");

  // Providers are separate namespaces.
  ok("the same address on a different provider is independent", bind("google", "g-1", "a@t.co") === "bound");

  ok("malformed input is refused", bind("github", "", "x@t.co") === "invalid" && bind("", "s", "x@t.co") === "invalid");

  // The unique index must hold even if the function's read-then-write were somehow bypassed.
  const direct = psqlStdin("insert into v_oauth_identities (provider, subject, email) values ('github','sub-3','a@t.co');", "oauthbind", true);
  ok("the database itself rejects a duplicate address, not only the function", direct.code !== 0);

  shq("docker", ["rm", "-f", PG]);
}

async function main(): Promise<void> {
  await transport();
  gate();
  try { await binding(); } finally { shq("docker", ["rm", "-f", PG]); }
  console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
  process.exit(fail === 0 ? 0 : 1);
}
void main();

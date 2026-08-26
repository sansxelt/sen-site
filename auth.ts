import NextAuth from "next-auth";
import { canonicalizeEmail } from "@/lib/user-credentials";
import { allowStrict, peekAllowed } from "@/lib/vraelis-ratelimit";
import { bumpTokenVersion, currentTokenVersion, tokenVersionIsCurrent } from "@/lib/v-session-revocation";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { fetchGitHubProfile } from "./lib/github-identity";
import { bindOAuthIdentity } from "./lib/oauth-identity";
import Google from "next-auth/providers/google";
import { getSafeRedirectPath } from "./lib/auth-ui";
import { verifyAutoSigninToken } from "./lib/auto-signin-token";
import { sendWelcomeEmail } from "./lib/email";
import { getUserProfileByEmail, syncUserProfileIdentity } from "./lib/user-profile";
import { trackServer } from "./lib/analytics";
import { getUserCredentialByEmail, verifyPassword } from "./lib/user-credentials";

// Single-domain architecture — vraelis.com only.
// Strip AUTH_URL/NEXTAUTH_URL so NextAuth infers the base URL from the
// incoming request via trustHost, preventing mismatched callback URLs.
delete process.env.AUTH_URL;
delete process.env.NEXTAUTH_URL;

// ── COOKIE SCOPE: WHAT ACTUALLY APPLIES ───────────────────────────────────────────────────────────────
//
// The ONLY cookie configuration that takes effect is the `cookies:` block further down. In production it
// sets ONE cookie explicitly:
//
//   __Secure-authjs.session-token   domain .vraelis.com   httpOnly  secure  sameSite=lax  path=/
//
// A leading-dot domain is sent to vraelis.com AND EVERY subdomain of it. That is deliberate and is the
// owner's standing decision: app.vraelis.com is a real, separately-hosted surface served by this same
// app through proxy.ts host routing, the SSO callback redirects there expecting a live session, and the
// billing return routes live there. A host-only cookie would not reach it and sign-in would not stick.
//
// Every other cookie (callbackUrl, csrfToken) is left to Auth.js's per-host defaults, so they are
// HOST-ONLY and do not span subdomains. CSRF staying host-only while the session spans is the correct
// split.
//
// REMOVED HERE, and worth knowing about: this file used to carry a per-request resolver
// (resolveCookieDomain / buildCookieOptions) that mapped *.vraelis.com and *.sansxel.ai to their own
// cookie domains and set an explicit __Host- CSRF cookie name. It was computed on every request and then
// DISCARDED - the value was assigned to a local and never passed to NextAuth. So three things that file
// comments advertised were inert, and had been inert since before this remediation:
//
//   - AUTH_COOKIE_DOMAIN      read by nothing (marked accordingly in .env.example)
//   - the .sansxel.ai branch  a DIFFERENT registrable domain, which therefore never got a cookie domain
//   - the __Host- CSRF name   configured only in the dead helper
//
// The dead code is deleted rather than wired up. Wiring it would change production cookie names and
// domains and invalidate in-flight sign-ins - a deployment decision, not a cleanup. If cross-domain
// support for sansxel.ai is wanted, restore it deliberately and re-test sign-in on both domains.

// The IP for the sign-in bucket. NextAuth passes a plain Request to authorize(), so this reads the
// forwarded headers directly rather than going through lib/vraelis-ratelimit's NextRequest helper.
// Falls back to a constant, which means an unidentifiable caller shares one bucket rather than
// getting a free one.
function clientIpFromHeaders(request: Request | undefined): string {
  const xff = request?.headers?.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request?.headers?.get("x-real-ip")?.trim() || "unknown";
}
const authResult = NextAuth(() => {
  return {
  trustHost: true,
  pages: {
    error: "/auth/error",
    signIn: "/signin",
  },
  providers: [
    Credentials({
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
        // Alternative to password: a short-lived HMAC-signed "you just
        // verified this email" token minted by /api/auth/verify. Lets
        // the verify redirect sign the user in on the same device that
        // clicked the email link, without re-entering the password.
        autoSigninToken: {
          label: "Auto signin token",
          type: "text",
        },
      },
      async authorize(credentials, request) {
        const email =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";

        // SECURITY: this is the password brute-force surface, and it had no limiter of any kind. Two
        // buckets on the Postgres-backed limiter, so they hold across serverless instances rather than
        // resetting with each cold start the way an in-memory Map does:
        //   - per IP, consumed on every attempt: bounds a sweep across many accounts.
        //   - per CANONICAL mailbox, consumed ONLY on failure: bounds a grind against one account.
        // Both are consulted before the bcrypt verify (cost 12), so a flood costs a counter rather than a
        // CPU-bound hash. allowStrict on the consuming calls, so a limiter outage denies rather than
        // reopening an unmetered brute force. Returning null is the same answer a wrong password gets, so
        // being rate limited is indistinguishable from being wrong and reveals nothing about which
        // accounts exist.
        //
        // ORDERING MATTERS, AND I GOT IT WRONG FIRST. The per-mailbox bucket was consumed here, before any
        // authentication — so ten unauthenticated POSTs per ten minutes, comfortably under the per-IP
        // allowance, permanently denied the real owner their own account. That is the same lockout defect
        // already fixed in app/api/auth/reset-password/route.ts, reintroduced by not carrying the reasoning
        // across.
        //
        // The per-IP bucket is consumed up front, because that DOES bound a sweep and an IP is the
        // attacker's own resource. The per-mailbox bucket is only consumed on a FAILED attempt, further
        // down: a legitimate sign-in costs nothing, so no number of failures by anyone else can lock out a
        // user who knows their password.
        const signinIp = clientIpFromHeaders(request);
        if (!(await allowStrict(`signin-ip:${signinIp}`, 20, 600))) return null;
        const password =
          typeof credentials.password === "string" ? credentials.password : "";
        const autoSigninToken =
          typeof credentials.autoSigninToken === "string"
            ? credentials.autoSigninToken
            : "";

        if (!email) return null;

        // Per-mailbox FAILURE budget, checked before the bcrypt verify so a flood costs a counter rather
        // than a cost-12 hash. It is only ever CONSUMED by a failed attempt (below), so a user who knows
        // their password can always sign in no matter how many times someone else has guessed wrong.
        const mailboxKey = `signin-fail:${canonicalizeEmail(email)}`;
        if (email && !(await peekAllowed(mailboxKey, 10, 600))) return null;

        const userCredential = await getUserCredentialByEmail(email);
        if (!userCredential) {
          await allowStrict(mailboxKey, 10, 600);
          return null;
        }

        // Either a valid token OR a valid password authorizes the session.
        const tokenValid =
          autoSigninToken !== "" &&
          verifyAutoSigninToken(autoSigninToken, email);
        const passwordValid =
          !tokenValid && password !== ""
            ? await verifyPassword(password, userCredential.password_hash)
            : false;

        if (!tokenValid && !passwordValid) {
          // Consume the per-mailbox budget HERE, on failure only. A correct password never touches it, so
          // wrong guesses by someone else can never deny the real owner their own account.
          await allowStrict(mailboxKey, 10, 600);
          return null;
        }

        const profile = await getUserProfileByEmail(email);

        return {
          email,
          id: email,
          name: profile?.display_name ?? email.split("@")[0],
        };
      },
    }),
    Google,
    // GitHub's stock provider takes the email from GET /user, falling back to
    // `(emails.find(e => e.primary) ?? emails[0]).email` — never consulting the `verified` flag GitHub
    // returns beside every address. Identity here IS the email string, so an unproven one is an account
    // takeover. fetchGitHubProfile always reads the authoritative /user/emails list, accepts only a
    // verified entry, and throws otherwise. See lib/github-identity.ts.
    GitHub({
      userinfo: {
        url: "https://api.github.com/user",
        async request({ tokens }: { tokens: { access_token?: string } }) {
          return fetchGitHubProfile(String(tokens.access_token ?? ""));
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  // The session must span vraelis.com AND app.vraelis.com (the product subdomain), so the session cookie
  // is scoped to the parent domain IN PRODUCTION ONLY (dev keeps host-only cookies so localhost auth is
  // untouched). Name matches Auth.js's own secure default so nothing else changes. Note: shipping this
  // resets existing sessions once (cookie identity changes).
  cookies: process.env.VERCEL_ENV === "production" ? {
    sessionToken: {
      name: "__Secure-authjs.session-token",
      options: { domain: ".vraelis.com", httpOnly: true, sameSite: "lax", path: "/", secure: true },
    },
  } : undefined,
  events: {
    // SIGN-OUT NOW ACTUALLY ENDS THE SESSION. With a JWT strategy, NextAuth's sign-out clears the
    // browser cookie and nothing else — a token already copied elsewhere stayed valid until it expired.
    // Bumping the revocation counter refuses every token issued before now.
    //
    // DOCUMENTED LIMITATION: the counter is per USER, so this is all-or-nothing. Signing out on one
    // device signs out every device. That is a deliberate behaviour change and the safe direction —
    // per-device revocation would need server-side sessions, which is a migration of the whole auth
    // surface rather than a fix.
    async signOut(message) {
      const token = (message as { token?: { email?: unknown } }).token;
      const email = typeof token?.email === "string" ? token.email : "";
      if (email) await bumpTokenVersion(email, "sign_out");
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const tag = `[auth:signIn][${account?.provider ?? "?"}]`;

      if (!user.email) {
        console.error(`${tag} rejected — no email from provider`, { userName: user.name });
        return false;
      }

      if (account?.provider === "credentials") {
        return true;
      }

      const provider = account?.provider ?? "";

      // SECURITY: the provider must say the address is VERIFIED. Identity here is a bare email string —
      // it is what isAdminEmail and every owner-scoped query key on — so accepting an unverified one
      // lets anyone who can make a provider assert an address take over the account that owns it.
      // Google sends email_verified on the profile; GitHub only returns verified addresses from the
      // /user/emails endpoint it is asked for. An explicit false is refused; an absent claim is
      // accepted, because refusing it would break providers that do not send one at all.
      const verifiedClaim = (profile as { email_verified?: unknown } | undefined)?.email_verified;
      if (verifiedClaim === false || verifiedClaim === "false") {
        console.error(`${tag} rejected — provider reports the email is not verified`);
        return false;
      }
      // GitHub sends no email_verified of its own, so the check above used to be INERT on this provider —
      // it closed Google and left GitHub open. lib/github-identity.ts now reads GitHub's authoritative
      // /user/emails, accepts only an entry marked verified, and stamps email_verified itself. Requiring
      // the claim POSITIVELY here means that if the provider config is ever reverted to the stock one,
      // GitHub sign-in stops working rather than silently going back to accepting unproven addresses.
      // A security control that fails loudly beats one that fails quietly.
      if (provider === "github" && verifiedClaim !== true) {
        console.error(`${tag} rejected — no positive verified-email claim from GitHub`);
        return false;
      }
      // Bind this sign-in to the provider's stable subject. A DIFFERENT provider account presenting an
      // address this provider already bound to someone else is refused — that is the takeover shape, and
      // an email string alone cannot tell the two apart. A legitimate address change at the provider
      // keeps the same subject and is allowed through.
      const subject = String(account?.providerAccountId ?? (profile as { sub?: unknown } | undefined)?.sub ?? "");
      const bound = await bindOAuthIdentity(provider, subject, user.email);
      if (bound === "conflict") {
        console.error(`${tag} rejected — this address is already bound to a different ${provider} account`);
        return false;
      }
      if (bound === "email_changed") {
        console.log(`${tag} the provider account's address changed; it now maps to ${user.email}`);
      }

      console.log(`${tag} email=${user.email} — looking up profile`);

      try {
        const existingProfile = await getUserProfileByEmail(user.email);
        console.log(`${tag} profile=${existingProfile ? "found" : "not found"}`);

        if (!existingProfile) {
          // New OAuth user (Google or GitHub): the provider already verified
          // their identity and they explicitly chose "Continue with X", so we
          // create the account inline and sign them straight in — no second
          // "Create a Vraelis account?" confirmation and no extra OAuth
          // round-trip. They land in onboarding from here.
          console.log(`${tag} new ${provider} user — creating profile`);
          await syncUserProfileIdentity({
            email: user.email,
            name:  typeof user.name === "string" ? user.name : null,
          });
          sendWelcomeEmail(
            user.email,
            typeof user.name === "string" ? user.name : "",
          ).catch((err) => console.error(`${tag} welcome email failed:`, err));
          // Conversion: new account created via OAuth. Server-side, fire-and-forget.
          void trackServer("signup", { email: user.email, clientId: user.email });
          return true;
        }

        console.log(`${tag} existing user — syncing identity`);
        await syncUserProfileIdentity({
          email: user.email,
          name:  typeof user.name === "string" ? user.name : null,
        });
        console.log(`${tag} sync done — sign-in allowed`);
      } catch (error) {
        console.error(`${tag} error during profile sync:`, error);
        // Allow sign-in even if sync fails — don't block the user on a DB hiccup.
      }

      return true;
    },
    authorized({ auth, request }) {
      const { pathname, search } = request.nextUrl;
      const requiresAuth = pathname.startsWith("/account");

      if (!requiresAuth) {
        return true;
      }

      if (auth?.user?.email) {
        return true;
      }

      const callbackUrl = getSafeRedirectPath(`${pathname}${search}`);
      const signInUrl = new URL("/signin", request.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", callbackUrl);

      return Response.redirect(signInUrl);
    },
    async jwt({ account, token }) {
      if (account?.provider) {
        token.provider = account.provider;
      }

      // SESSION REVOCATION. The session strategy is JWT, so the server stores nothing and sign-out only
      // clears the browser's cookie — a token copied elsewhere stayed valid until expiry, and a password
      // reset did not end the sessions the old password had created. Each token carries the user's
      // revocation counter; returning null here discards a token whose counter is behind the stored one,
      // which is how sign-out, password reset and administrative revocation become real.
      const email = typeof token.email === "string" ? token.email : "";
      if (email) {
        if (account) {
          // Fresh sign-in: stamp the current version.
          token.tv = await currentTokenVersion(email);
        } else if (!(await tokenVersionIsCurrent(email, token.tv))) {
          return null;
        }
      }

      return token;
    },
    async redirect({ baseUrl, url }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const parsed = new URL(url);

        // Allow redirects to the same origin or anywhere within the
        // vraelis.com family (apex + subdomains) so sign-out from
        // chat/platform can land back on the apex marketing site.
        const isSameOrigin = parsed.origin === baseUrl;
        const isVraelisHost = /^https:\/\/([\w-]+\.)?vraelis\.com$/.test(parsed.origin);

        if (isSameOrigin || isVraelisHost) {
          return url;
        }
      } catch {
        // Ignore invalid redirect targets and fall through to the safe default.
      }

      return `${baseUrl}/account`;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : "";
        session.user.provider =
          typeof token.provider === "string" ? token.provider : null;
      }

      return session;
    },
  },
  };
});

export const { handlers, auth, signIn, signOut } = authResult;
export const { GET, POST } = authResult.handlers;

import NextAuth from "next-auth";
import { canonicalizeEmail } from "@/lib/user-credentials";
import { allowStrict, peekAllowed } from "@/lib/vraelis-ratelimit";
import { bumpTokenVersion, currentTokenVersion, tokenVersionIsCurrent } from "@/lib/v-session-revocation";
import type { NextRequest } from "next/server";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
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

// v0.2.0 phase H — cross-subdomain cookie. Set AUTH_COOKIE_DOMAIN
// to ".sansxel.ai" (with the leading dot) in prod env so the
// session cookie is scoped to all subdomains. Without this, the
// apex marketing site (sansxel.ai) couldn't see chat.sansxel.ai's
// session and showed "Log in" to already-signed-in users.
//
// Local dev / preview deploys: leave AUTH_COOKIE_DOMAIN unset, so
// NextAuth uses its per-request default (single-host cookie) and
// localhost / preview URLs keep working.
//
// Migration cost: existing chat-only cookies stay valid for now,
// but new sign-ins will get the spanning cookie. Users who want
// the apex to recognize them need to sign out + back in once.
const envCookieDomain = (process.env.AUTH_COOKIE_DOMAIN ?? "").trim() || undefined;

// v0.3.0 — vraelis.com now shares this project (separate brand, served
// by host in proxy.ts). It's a different registrable domain, so it
// CANNOT share the ".sansxel.ai" session cookie; with a hardcoded
// domain the browser would silently reject the cookie and sign-in
// would never stick. So the cookie domain is resolved per request:
//   • *.sansxel.ai → ".sansxel.ai"  (unchanged: SSO across subdomains)
//   • *.vraelis.com → ".vraelis.com" (its own cookie / session)
//   • unknown host (preview, localhost) or RSC with no request → the
//     env value (prod) or the per-host default, so previews keep
//     working exactly as before.
// Cookie NAMES stay constant whenever a domain applies, so the cookie
// set during sign-in (request present) and read in RSC (request
// absent) always match by name.
function resolveCookieDomain(req: NextRequest | undefined): string | undefined {
  const host = (req?.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (host.endsWith("vraelis.com")) return ".vraelis.com";
  if (host.endsWith("sansxel.ai")) return ".sansxel.ai";
  return envCookieDomain;
}

function buildCookieOptions(cookieDomain: string | undefined) {
  if (!cookieDomain) return undefined;
  return {
    sessionToken: {
      // NextAuth picks the secure-prefixed name automatically
      // for HTTPS; matching that here so existing logic still
      // works.
      name: "__Secure-authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
        domain: cookieDomain,
      },
    },
    callbackUrl: {
      name: "__Secure-authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
        domain: cookieDomain,
      },
    },
    csrfToken: {
      name: "__Host-authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
        // __Host- prefix forbids a domain attribute, so we
        // intentionally OMIT domain on the csrf cookie. The
        // CSRF check still fires per-host; only the session
        // needs to span subdomains for SSO to work.
      },
    },
  };
}

// The IP for the sign-in bucket. NextAuth passes a plain Request to authorize(), so this reads the
// forwarded headers directly rather than going through lib/vraelis-ratelimit's NextRequest helper.
// Falls back to a constant, which means an unidentifiable caller shares one bucket rather than
// getting a free one.
function clientIpFromHeaders(request: Request | undefined): string {
  const xff = request?.headers?.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request?.headers?.get("x-real-ip")?.trim() || "unknown";
}
const authResult = NextAuth((req: NextRequest | undefined) => {
  const cookieOptions = buildCookieOptions(resolveCookieDomain(req));
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
    GitHub,
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
      // GitHub does not send email_verified at ALL — @auth/core's GitHub provider picks the primary
      // address from /user/emails without filtering on `verified` — so for GitHub this claim is always
      // undefined and a check for an explicit false is inert. Stated here so the gate's reach is not
      // mistaken for what its name suggests: it closes Google, and GitHub remains an OPEN item that
      // needs the provider's own verified flag to be requested and checked.
      if (verifiedClaim === false || verifiedClaim === "false") {
        console.error(`${tag} rejected — provider reports the email is not verified`);
        return false;
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

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { getSafeRedirectPath } from "./lib/auth-ui";
import { verifyAutoSigninToken } from "./lib/auto-signin-token";
import { sendWelcomeEmail } from "./lib/email";
import { signOAuthSignupToken } from "./lib/oauth-signup-token";
import { getUserProfileByEmail, syncUserProfileIdentity } from "./lib/user-profile";
import { getUserCredentialByEmail, verifyPassword } from "./lib/user-credentials";

// v0.1.16 — AUTH_URL env var forces NextAuth to generate provider
// signinUrl / callbackUrl strings against the configured hostname
// (https://www.vraelis.com), even when the request comes in on
// chat.vraelis.com or platform.vraelis.com. The signin form ends up
// posting cross-origin → browser blocks it → 'Configuration' error
// page. Stripping AUTH_URL at module load forces NextAuth to fall
// back to its trustHost-based per-request URL detection.
delete process.env.AUTH_URL;
delete process.env.NEXTAUTH_URL;

// v0.2.0 phase H — cross-subdomain cookie. Set AUTH_COOKIE_DOMAIN
// to ".vraelis.com" (with the leading dot) in prod env so the
// session cookie is scoped to all subdomains. Without this, the
// apex marketing site (vraelis.com) couldn't see chat.vraelis.com's
// session and showed "Log in" to already-signed-in users.
//
// Local dev / preview deploys: leave AUTH_COOKIE_DOMAIN unset, so
// NextAuth uses its per-request default (single-host cookie) and
// localhost / preview URLs keep working.
//
// Migration cost: existing chat-only cookies stay valid for now,
// but new sign-ins will get the spanning cookie. Users who want
// the apex to recognize them need to sign out + back in once.
const cookieDomain = (process.env.AUTH_COOKIE_DOMAIN ?? "").trim() || undefined;
const cookieOptions = cookieDomain
  ? {
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
    }
  : undefined;

const authResult = NextAuth({
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
      async authorize(credentials) {
        const email =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";
        const autoSigninToken =
          typeof credentials.autoSigninToken === "string"
            ? credentials.autoSigninToken
            : "";

        if (!email) return null;

        const userCredential = await getUserCredentialByEmail(email);
        if (!userCredential) return null;

        // Either a valid token OR a valid password authorizes the session.
        const tokenValid =
          autoSigninToken !== "" &&
          verifyAutoSigninToken(autoSigninToken, email);
        const passwordValid =
          !tokenValid && password !== ""
            ? await verifyPassword(password, userCredential.password_hash)
            : false;

        if (!tokenValid && !passwordValid) {
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
  ...(cookieOptions ? { cookies: cookieOptions } : {}),
  callbacks: {
    async signIn({ user, account }) {
      // No email from the provider → reject. We can't create an account
      // we can't address, and downstream code assumes email is present.
      if (!user.email) {
        return false;
      }

      // Credentials sign-in already requires verified email before the
      // profile exists — nothing extra to do here.
      if (account?.provider === "credentials") {
        return true;
      }

      const provider = account?.provider ?? "";

      try {
        const existingProfile = await getUserProfileByEmail(user.email);

        // First-time OAuth (or post-deletion return) — behavior splits
        // by provider:
        //
        //   • github  → let them through silently. GitHub is a
        //     developer-audience signal; the extra consent step adds
        //     friction without meaningfully changing risk.
        //   • google (and anything else) → bounce to /auth/confirm-signup
        //     so the user explicitly consents before we create a
        //     profile. Fixes the post-deletion "silently re-created"
        //     problem, and gives a clear moment for people who only
        //     meant to sign in elsewhere.
        if (!existingProfile) {
          if (provider === "github") {
            await syncUserProfileIdentity({
              email: user.email,
              name:  typeof user.name === "string" ? user.name : null,
            });
            void sendWelcomeEmail(
              user.email,
              typeof user.name === "string" ? user.name : "",
            );
            return true;
          }

          const token = signOAuthSignupToken({ email: user.email, provider });
          const params = new URLSearchParams({
            email:    user.email,
            provider,
            name:     typeof user.name === "string" ? user.name : "",
            token,
          });
          return `/auth/confirm-signup?${params.toString()}`;
        }

        // Existing profile — keep identity fields fresh from the OAuth
        // provider (display name, etc.) and let them through.
        await syncUserProfileIdentity({
          email: user.email,
          name:  typeof user.name === "string" ? user.name : null,
        });
      } catch (error) {
        console.error("User profile sync failed during sign-in:", error);
      }

      return true;
    },
    authorized({ auth, request }) {
      const { pathname, search } = request.nextUrl;
      const requiresAuth =
        pathname.startsWith("/account") || pathname.startsWith("/api/account");

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
        const isVraelisHost = /^https:\/\/([\w-]+\.)?Vraelis\.ai$/.test(parsed.origin);

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
});

export const { handlers, auth, signIn, signOut } = authResult;
export const { GET, POST } = authResult.handlers;

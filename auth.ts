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

// Single-domain architecture — vraelis.com only.
// Strip AUTH_URL/NEXTAUTH_URL so NextAuth infers the base URL from the
// incoming request via trustHost, preventing mismatched callback URLs.
delete process.env.AUTH_URL;
delete process.env.NEXTAUTH_URL;

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
  callbacks: {
    async signIn({ user, account }) {
      const tag = `[auth:signIn][${account?.provider ?? "?"}]`;

      if (!user.email) {
        console.error(`${tag} rejected — no email from provider`, { userName: user.name });
        return false;
      }

      if (account?.provider === "credentials") {
        return true;
      }

      const provider = account?.provider ?? "";
      console.log(`${tag} email=${user.email} — looking up profile`);

      try {
        const existingProfile = await getUserProfileByEmail(user.email);
        console.log(`${tag} profile=${existingProfile ? "found" : "not found"}`);

        if (!existingProfile) {
          if (provider === "github") {
            console.log(`${tag} new github user — creating profile`);
            await syncUserProfileIdentity({
              email: user.email,
              name:  typeof user.name === "string" ? user.name : null,
            });
            sendWelcomeEmail(
              user.email,
              typeof user.name === "string" ? user.name : "",
            ).catch((err) => console.error(`${tag} welcome email failed:`, err));
            return true;
          }

          console.log(`${tag} new google user — bouncing to confirm-signup`);
          const token = signOAuthSignupToken({ email: user.email, provider });
          const params = new URLSearchParams({
            email:    user.email,
            provider,
            name:     typeof user.name === "string" ? user.name : "",
            token,
          });
          return `/auth/confirm-signup?${params.toString()}`;
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
});

export const { handlers, auth, signIn, signOut } = authResult;
export const { GET, POST } = authResult.handlers;

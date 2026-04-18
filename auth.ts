import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { getSafeRedirectPath } from "./lib/auth-ui";
import { signOAuthSignupToken } from "./lib/oauth-signup-token";
import { getUserProfileByEmail, syncUserProfileIdentity } from "./lib/user-profile";
import { getUserCredentialByEmail, verifyPassword } from "./lib/user-credentials";

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
      },
      async authorize(credentials) {
        const email =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";

        if (!email || !password) {
          return null;
        }

        const userCredential = await getUserCredentialByEmail(email);

        if (!userCredential) {
          return null;
        }

        const passwordValid = await verifyPassword(
          password,
          userCredential.password_hash,
        );

        if (!passwordValid) {
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
      if (!user.email) {
        return true;
      }

      // Credentials sign-in already requires verified email before the
      // profile exists — nothing extra to do here.
      if (account?.provider === "credentials") {
        return true;
      }

      const provider = account?.provider ?? "";

      try {
        const existingProfile = await getUserProfileByEmail(user.email);

        // First-time OAuth (or post-deletion return) — don't silently
        // create a profile. Bounce to /auth/confirm-signup so the user
        // explicitly consents. The signed token binds email+provider, so
        // a valid token can't be reused to create a profile for a
        // different identity.
        if (!existingProfile) {
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

        if (parsed.origin === baseUrl) {
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

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { getSafeRedirectPath } from "./lib/auth-ui";
import { sendWelcomeEmail } from "./lib/email";
import { getUserProfileByEmail, syncUserProfileIdentity } from "./lib/user-profile";
import { getUserCredentialByEmail, verifyPassword } from "./lib/user-credentials";

const authResult = NextAuth({
  trustHost: true,
  pages: {
    error: "/auth/error",
    signIn: "/auth/signin",
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

      // Only run profile sync + welcome email for OAuth providers.
      // Credentials sign-in already creates the profile at registration.
      if (account?.provider === "credentials") {
        return true;
      }

      try {
        const isNewUser = !(await getUserProfileByEmail(user.email));

        await syncUserProfileIdentity({
          email: user.email,
          name: typeof user.name === "string" ? user.name : null,
        });

        if (isNewUser) {
          void sendWelcomeEmail(
            user.email,
            typeof user.name === "string" ? user.name : undefined,
          );
        }
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
      const signInUrl = new URL("/auth/signin", request.nextUrl.origin);
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

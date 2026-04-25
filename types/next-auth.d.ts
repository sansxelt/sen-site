import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      provider?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string | null;
  }
}

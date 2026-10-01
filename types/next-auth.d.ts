import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      provider?: string | null;
    };
    // Present ONLY while a sign-in is waiting for its second step, and then `user` is absent: a pending
    // session is a signed-out session everywhere except /signin. See lib/two-step-session.ts.
    twoStep?: {
      pending: true;
      methods: ("totp" | "email")[] | null;
      emailHint: string;
      emailSentAt: number | null;
      notice: "invalid" | "expired" | "rate_limited" | "unavailable" | "sent" | "send_failed" | "send_limited" | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string | null;
    // Two-step verification state (lib/two-step-session.ts). Absent on tokens minted before it existed.
    twoStep?: "pending" | "ok";
    twoStepMethods?: ("totp" | "email")[] | null;
    twoStepSince?: number;
    twoStepEmailAt?: number;
    twoStepNotice?: string;
    twoStepAt?: number;
  }
}

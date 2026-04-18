import { auth } from "@/auth";

/** Single email allowed into /dev/* in production. */
const DEV_ADMIN_EMAIL = "nishanth.d1021@gmail.com";

export type DevAccessResult =
  | { kind: "ok" }
  | { kind: "unauthenticated" } // no session — page should redirect to /signin
  | { kind: "forbidden" };      // signed in, wrong account — page should 404

/**
 * Gate for /dev/* tooling.  Allows the local dev environment (anyone
 * running `next dev`) and the single admin email in any environment.
 * Returns a discriminated result so pages can distinguish "not signed
 * in" (redirect to /signin) from "wrong account" (404 — don't leak the
 * page's existence to randoms).
 */
export async function checkDevAccess(): Promise<DevAccessResult> {
  if (process.env.NODE_ENV !== "production") return { kind: "ok" };

  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;

  if (!email) return { kind: "unauthenticated" };
  if (email === DEV_ADMIN_EMAIL) return { kind: "ok" };
  return { kind: "forbidden" };
}

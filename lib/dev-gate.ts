import { auth } from "@/auth";

/** Single email allowed into /dev/* in production. */
const DEV_ADMIN_EMAIL = "nishanth.d1021@gmail.com";

/**
 * Gate for /dev/* tooling.  Allows the local dev environment (anyone
 * running `next dev`) and the single admin email in any environment.
 * Returns null when allowed, an error string when not — callers route
 * the error into a 403 / notFound() as appropriate.
 */
export async function assertDevAccess(): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") return null;

  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (email === DEV_ADMIN_EMAIL) return null;

  return "forbidden";
}

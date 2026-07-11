// Local E2E auth setup: mint a NextAuth session cookie for a dedicated test account (the same encode
// recipe the app uses in mintSsoSession, with the localhost cookie name) and write a Playwright
// storageState. Also funds the account so charging checks can run. Safe test-account state only — no
// auth is weakened and no public bypass is created. Run before `playwright test` against a LOCAL flag-on
// dev server. Never commit .auth/. Run: npx tsx scripts/e2e-auth-setup.ts
import fs from "node:fs";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  if (!process.env.AUTH_SECRET) { console.error("AUTH_SECRET not in env"); process.exit(1); }
  const { encode } = await import("@auth/core/jwt");
  const cr = await import("../lib/v-credits");
  const email = "e2e-uploads@vraelis.local";
  // Local dev server is http://localhost -> NextAuth uses the non-secure cookie name, and the JWT salt
  // must match that name (prod https uses "__Secure-authjs.session-token").
  const COOKIE = "authjs.session-token";
  const maxAge = 60 * 60 * 24;
  const value = await encode({ token: { email, sub: email, name: "e2e", provider: "sso" }, secret: process.env.AUTH_SECRET as string, salt: COOKIE, maxAge });

  await cr.grant(email, 50, "e2e-test", { extRef: `e2e:${process.env.E2E_STAMP || "seed"}` }); // idempotent by ext_ref

  const state = {
    cookies: [{ name: COOKIE, value, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + maxAge, httpOnly: true, secure: false, sameSite: "Lax" as const }],
    origins: [],
  };
  fs.mkdirSync(".auth", { recursive: true });
  fs.writeFileSync(".auth/state.json", JSON.stringify(state, null, 2));
  const bal = await cr.balance(email);
  console.log(`wrote .auth/state.json for ${email} (balance ${bal})`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

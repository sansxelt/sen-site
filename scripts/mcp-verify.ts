// Tests for the hosted MCP server's OAuth (lib/mcp/oauth.ts) and for drift between the two copies of the
// MCP tool definitions (lib/mcp/tools.ts for the hosted server, cli/vraelis.mjs for the local one).
// Pure: no database, no network.
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-mcp-verify";

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  registerClient, resolveClient, validRedirectUri, packAuthRequest, unpackAuthRequest,
  issueCode, redeemCode, parseAuthorizeQuery, redirectBack, consentProof, consentProofValid,
} from "../lib/mcp/oauth";
import { MCP_TOOLS, MCP_INSTRUCTIONS, renderResult, renderApproval } from "../lib/mcp/tools";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const CHATGPT = "https://chatgpt.com/connector_platform_oauth_redirect";
const verifier = "v".repeat(43) + "_abc-123";
const challenge = createHash("sha256").update(verifier).digest("base64url");

async function main() {
  console.log("── redirect URIs ──");
  ok("https is allowed", validRedirectUri(CHATGPT));
  ok("http to localhost is allowed (local tools)", validRedirectUri("http://127.0.0.1:6274/oauth/callback"));
  ok("http anywhere else is not", !validRedirectUri("http://evil.example.com/cb"));
  ok("a fragment is not", !validRedirectUri("https://chatgpt.com/cb#x"));
  ok("credentials in the URL are not", !validRedirectUri("https://user:pw@chatgpt.com/cb"));
  ok("javascript: is not", !validRedirectUri("javascript:alert(1)"));

  console.log("\n── dynamic registration needs no storage ──");
  const reg = registerClient({ redirect_uris: [CHATGPT], client_name: "ChatGPT" });
  ok("a client registers", !("error" in reg));
  if ("error" in reg) return;
  const back = await resolveClient(reg.clientId);
  ok("its id resolves back to the same registration", back?.name === "ChatGPT" && back.redirectUris[0] === CHATGPT);
  const [body, sig] = reg.clientId.slice(4).split(".");
  const forged = Buffer.from(JSON.stringify({ n: "ChatGPT", r: ["https://evil.example.com/cb"] })).toString("base64url");
  ok("swapping the redirect URIs breaks the signature", (await resolveClient(`vrc_${forged}.${sig}`)) === null);
  ok("a truncated signature is refused", (await resolveClient(`vrc_${body}.${sig.slice(0, 10)}`)) === null);
  ok("registration refuses an unsafe redirect", "error" in registerClient({ redirect_uris: ["http://evil.example.com/cb"] }));
  ok("registration refuses no redirect at all", "error" in registerClient({}));
  ok("a client name cannot carry markup", (registerClient({ redirect_uris: [CHATGPT], client_name: "<b>Chat</b>" }) as { name: string }).name === "bChat/b");

  console.log("\n── /oauth/authorize validation ──");
  const q = (o: Record<string, string>) => new URLSearchParams(o);
  const good = { client_id: reg.clientId, redirect_uri: CHATGPT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state: "s1" };
  const parsed = await parseAuthorizeQuery(q(good));
  ok("a correct request parses", !("error" in parsed));
  const noPkce = await parseAuthorizeQuery(q({ ...good, code_challenge_method: "plain" }));
  ok("PKCE plain is refused, and the error may go back to the client", "error" in noPkce && noPkce.redirectable);
  const badRedirect = await parseAuthorizeQuery(q({ ...good, redirect_uri: "https://evil.example.com/cb" }));
  ok("an unregistered redirect_uri is refused and NEVER redirected to", "error" in badRedirect && !badRedirect.redirectable);
  const badClient = await parseAuthorizeQuery(q({ ...good, client_id: "vrc_nope.nope" }));
  ok("an unknown client is refused and never redirected to", "error" in badClient && !badClient.redirectable);

  console.log("\n── the request survives sign-in ──");
  if ("error" in parsed) return;
  const token = packAuthRequest(parsed.req);
  ok("the packed request is plain enough for /signin's return path", /^[A-Za-z0-9_.-]+$/.test(token));
  ok("and unpacks to the same request", unpackAuthRequest(token)?.redirectUri === CHATGPT);
  ok("a tampered token is refused", unpackAuthRequest(token.replace(/.$/, (c) => (c === "A" ? "B" : "A"))) === null);
  ok("an old token is refused", unpackAuthRequest(token, Date.now() + 31 * 60 * 1000) === null);

  console.log("\n── the Allow button cannot be forged from another site ──");
  const proof = consentProof("Founder@Example.com", token);
  ok("the consent page's proof is accepted for the same person and request", consentProofValid("founder@example.com", token, proof));
  ok("another signed-in person's session rejects it", !consentProofValid("victim@example.com", token, proof));
  ok("it does not carry over to another request", !consentProofValid("founder@example.com", packAuthRequest(parsed.req, Date.now() + 1), proof));
  ok("a missing proof is refused", !consentProofValid("founder@example.com", token, ""));

  console.log("\n── codes ──");
  const code = issueCode({ apiKey: "vr_live_secret", clientId: reg.clientId, redirectUri: CHATGPT, codeChallenge: challenge });
  ok("the code does not contain the key in the clear", !code.includes("vr_live") && !Buffer.from(code, "base64url").toString("latin1").includes("vr_live"));
  const good2 = redeemCode(code, { clientId: reg.clientId, redirectUri: CHATGPT, codeVerifier: verifier });
  ok("the right client, redirect and verifier get the key", "apiKey" in good2 && good2.apiKey === "vr_live_secret");
  ok("a wrong verifier gets nothing", "error" in redeemCode(code, { clientId: reg.clientId, redirectUri: CHATGPT, codeVerifier: "w".repeat(43) }));
  ok("another client gets nothing", "error" in redeemCode(code, { clientId: "vrc_other.x", redirectUri: CHATGPT, codeVerifier: verifier }));
  ok("another redirect gets nothing", "error" in redeemCode(code, { clientId: reg.clientId, redirectUri: "https://chatgpt.com/other", codeVerifier: verifier }));
  ok("after five minutes it is dead", "error" in redeemCode(code, { clientId: reg.clientId, redirectUri: CHATGPT, codeVerifier: verifier }, Date.now() + 5 * 60 * 1000 + 1));
  ok("a flipped byte is refused", "error" in redeemCode(code.slice(0, -2) + (code.endsWith("AA") ? "BB" : "AA"), { clientId: reg.clientId, redirectUri: CHATGPT, codeVerifier: verifier }));
  ok("the state travels back", new URL(redirectBack(CHATGPT, { code: "c", state: "s1" })).searchParams.get("state") === "s1");

  console.log("\n── the two MCP servers say the same thing ──");
  const cli = readFileSync("cli/vraelis.mjs", "utf8");
  for (const t of MCP_TOOLS) {
    ok(`the CLI defines ${t.name}`, cli.includes(`name: "${t.name}"`));
    for (const r of t.inputSchema.required) ok(`  and requires ${r}`, new RegExp(`required: \\[[^\\]]*"${r}"`).test(cli));
  }
  ok("neither offers a tool that approves", !MCP_TOOLS.some((t) => /approve/.test(t.name)) && !/name: "vraelis_approve/.test(cli));
  for (const rule of ["You cannot approve it yourself", "only if the result is VERIFIED", "Do not tell the user this works until a check comes back VERIFIED"]) {
    ok(`both carry the rule "${rule}"`, (MCP_INSTRUCTIONS.includes(rule) || renderResult({ verification_id: "vrf_1", decision: "failed" }).includes(rule) || renderApproval({ id: "j", claim: "c", url: "u", approveUrl: "a", requirements: [], flows: [] }).includes(rule)) && cli.includes(rule));
  }
  ok("a BLOCKED result never says it works", !/You can tell the user this is verified/.test(renderResult({ verification_id: "vrf_1", decision: "blocked" })));

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

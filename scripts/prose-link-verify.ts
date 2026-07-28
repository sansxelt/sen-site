// A LINK IN A SENTENCE IS NOT A CALL TO ACTION.
//
// v6 had exactly one link component, EditorialLink, and it is a standalone next step: 15px semibold,
// inline-flex, with a trailing arrow. Six pages reached for it mid-sentence because there was nothing else
// to reach for, and the contact page read:
//
//   Please use the disclosure route on security -> rather than a general address.
//
// An arrow pointing at the next word, a bold 15px fragment inside a 14px paragraph, and an inline-flex box
// that will not wrap with the text around it. ProseLink is the inline one. These assertions keep the two
// jobs apart, and keep the contact page honest about which addresses actually reach a person.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const pages = walk("app/dev-preview/v6").filter((f) => f.endsWith(".tsx"));

// Path separators normalised for the failure message only. Written via a char code because a literal
// backslash in this file did not survive being authored through a shell heredoc, which silently produced
// an unterminated regex.
const SEP = String.fromCharCode(92);
const posix = (f: string) => f.split(SEP).join("/");

console.log("── the two link jobs stay apart ──");
const ui = readFileSync("app/dev-preview/v6/_system/ui.tsx", "utf8");
ok("EditorialLink still carries its arrow (it is the standalone one)",
  /export function EditorialLink[\s\S]{0,400}v6-arw/.test(ui));
ok("ProseLink exists and carries no arrow",
  /export function ProseLink/.test(ui)
  && !/export function ProseLink[\s\S]{0,300}v6-arw/.test(ui));
ok("ProseLink inherits its type rather than setting its own",
  /\.v6-plink\s*\{[^}]*color:\s*inherit/.test(readFileSync("app/dev-preview/v6/_system/v6.css", "utf8")));

// THE ACTUAL RULE. Inside a paragraph, every link is a link in a sentence. Standalone next steps are never
// wrapped in <p>, which is what makes this checkable rather than a matter of taste.
const offenders: string[] = [];
for (const f of pages) {
  const src = readFileSync(f, "utf8");
  for (const para of src.match(/<p\b[\s\S]*?<\/p>/g) ?? []) {
    if (para.includes("<EditorialLink")) offenders.push(posix(f));
  }
}
ok("no EditorialLink sits inside a paragraph", offenders.length === 0, [...new Set(offenders)].join(", "));

// And the shape that made it visible: prose continuing after the closing tag.
const trailing = pages.filter((f) => /<\/EditorialLink>[^<\n]*[a-zA-Z]/.test(readFileSync(f, "utf8")));
ok("no EditorialLink is followed by more of its own sentence", trailing.length === 0,
  trailing.map(posix).join(", "));

console.log("\n── every address on the contact page reaches someone ──");
{
  const contact = readFileSync("app/dev-preview/v6/contact/page.tsx", "utf8");
  const email = readFileSync("lib/email.ts", "utf8");
  const broadcasts = readFileSync("lib/broadcasts.ts", "utf8");

  // hello@ is the FROM address on outbound mail. A send-only drop listed as somewhere to write is the one
  // card on the page that reaches nobody, which is worse than having no card.
  // SUPPORT_INBOXES IS THE SOURCE OF TRUTH, not the FROM addresses.
  //
  // Two earlier versions of this got it wrong in opposite directions. Taking every @vraelis.com string in
  // lib/email.ts declared all three working addresses to be drops. Taking every RFC display-name form
  // "Vraelis <x@vraelis.com>" did the same, because help@, sales@ and privacy@ are BOTH inboxes and
  // senders: a departmental address replies from where it receives, which is the point of fromForInbox.
  //
  // What actually separates them is whether inbound mail is routed anywhere. SUPPORT_INBOXES is the
  // allowlist the contact route resolves against, so an address in it is read by someone and an address
  // outside it is not. hello@ and noreply@ are outside it.
  const inboxBlock = email.slice(email.indexOf("export const SUPPORT_INBOXES"));
  const inboxes = new Set(
    Array.from(inboxBlock.slice(0, inboxBlock.indexOf("]")).matchAll(/"([a-z0-9._-]+@vraelis\.com)"/g)).map((m) => m[1]),
  );
  ok("the routed inboxes are identified (or this check is vacuous)", inboxes.size > 0, [...inboxes].join(", "));
  ok("hello@ is NOT one of them, which is the fact this whole check rests on",
    !inboxes.has("hello@vraelis.com"), "if hello@ became a real inbox, the contact card can come back");

  const listed = Array.from(contact.matchAll(/\["([a-z0-9._-]+@vraelis\.com)"/g)).map((m) => m[1]);
  ok("the contact page lists addresses (or this check is vacuous)", listed.length > 0);
  const dropsListed = listed.filter((a) => !inboxes.has(a));
  ok("every address offered as somewhere to write is actually a routed inbox", dropsListed.length === 0,
    `${dropsListed.join(", ")} is not in SUPPORT_INBOXES, so mail to it reaches nobody`);

  // The count in the lead has to match the cards, or the page miscounts itself the moment one is removed.
  const words: Record<string, number> = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6 };
  const claimed = contact.match(/lead="(\w+) addresses/)?.[1];
  ok("the lead counts the cards that are actually there",
    !!claimed && words[claimed] === listed.length, `lead says ${claimed}, ${listed.length} listed`);
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

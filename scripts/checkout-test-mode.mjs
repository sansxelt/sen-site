#!/usr/bin/env node
// Put .env.local into Stripe TEST mode for exercising the in-app checkout, and put it back afterwards.
//
//   node scripts/checkout-test-mode.mjs on  sk_test_... pk_test_...
//   node scripts/checkout-test-mode.mjs off
//
// WHY THIS EXISTS RATHER THAN "just edit the file".
//
// dotenv keeps the FIRST occurrence of a key and ignores later ones. Appending a test key at the bottom of
// a file that already defines a live key at line 60 therefore changes nothing, and the only symptom is that
// your test card is declined by a live account, or worse, accepted. This replaces in place and refuses to
// leave two definitions behind.
//
// It also refuses to write anything that is not a test key, because the entire point of the exercise is not
// charging a real card, and there is no version of "on" that should ever hold sk_live_.
//
// VRAELIS_CUSTOM_CHECKOUT belongs here and NOWHERE ELSE. It was briefly set in Vercel Preview and
// Production; both of those carry the same live Stripe keys, so enabling it there charges real cards. There
// is no safe cloud environment for this flag until a test-mode Stripe key exists in one.

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

const FILE = ".env.local";
const BACKUP = ".env.local.before-test-mode";
const KEYS = { secret: "STRIPE_SECRET_KEY", pub: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", flag: "VRAELIS_CUSTOM_CHECKOUT" };

const [, , mode, secret, pub] = process.argv;

function die(msg) { console.error(`\n  ${msg}\n`); process.exit(1); }

if (!existsSync(FILE)) die(`${FILE} not found. Run this from the repo root.`);

/** Replace every definition of `key`, or append one if there is none. Returns the new text.
 *  Replacing EVERY occurrence is the point: leaving a second definition is the failure this script exists
 *  to prevent, and which of the two wins is not something anyone should have to remember. */
function setKey(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "gm");
  return re.test(text) ? text.replace(re, line) : text.replace(/\s*$/, `\n${line}\n`);
}

function readValue(text, key) {
  const m = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].replace(/^["']|["']$/g, "").trim() : null;
}

if (mode === "on") {
  if (!secret || !pub) die("Usage: node scripts/checkout-test-mode.mjs on sk_test_... pk_test_...");
  if (!secret.startsWith("sk_test_")) die(`That secret key is not a test key (${secret.slice(0, 8)}...). Refusing: the point is not to charge a real card.`);
  if (!pub.startsWith("pk_test_")) die(`That publishable key is not a test key (${pub.slice(0, 8)}...). Refusing.`);

  let text = readFileSync(FILE, "utf8");
  if (!existsSync(BACKUP)) {
    copyFileSync(FILE, BACKUP);
    console.log(`  backed up your live config to ${BACKUP}`);
  } else {
    console.log(`  ${BACKUP} already exists, leaving it alone (it holds your LIVE config)`);
  }

  text = setKey(text, KEYS.secret, secret);
  text = setKey(text, KEYS.pub, pub);
  text = setKey(text, KEYS.flag, "1");
  writeFileSync(FILE, text);

  console.log(`
  TEST MODE ON

    ${KEYS.secret}                 sk_test_...
    ${KEYS.pub}   pk_test_...
    ${KEYS.flag}            1

  Two things still to do:

    1. Forward webhooks, or the payment will succeed and nothing will activate:
         stripe listen --forward-to localhost:3000/api/stripe/webhook
       Put the whsec_ it prints into ${KEYS.secret.replace("SECRET_KEY", "WEBHOOK_SECRET")}.

    2. Restart the dev server so it picks all of this up.

  Then: http://localhost:3000/checkout?amount=5   (credits need no price IDs, so they work
  in test mode immediately; the six _v1 plan prices are LIVE ids and do not exist in test mode).

  When you are done:  node scripts/checkout-test-mode.mjs off
`);
} else if (mode === "off") {
  if (!existsSync(BACKUP)) die(`No ${BACKUP} to restore from. Your ${FILE} was never switched by this script.`);
  copyFileSync(BACKUP, FILE);
  const restored = readFileSync(FILE, "utf8");
  const s = readValue(restored, KEYS.secret) ?? "";
  console.log(`
  RESTORED from ${BACKUP}

    ${KEYS.secret} is now ${s.slice(0, 8)}...  (${s.startsWith("sk_live_") ? "LIVE, as before" : "not live, check this"})
    ${KEYS.flag} is ${readValue(restored, KEYS.flag) ?? "unset"}

  Restart the dev server.
`);
} else {
  die(`Usage:
    node scripts/checkout-test-mode.mjs on  sk_test_... pk_test_...
    node scripts/checkout-test-mode.mjs off`);
}

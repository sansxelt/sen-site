import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Vraelis",
  description: "How Vraelis collects, uses, and protects data.",
};

const UPDATED = "June 4, 2026";

function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.3rem,2.2vw,1.7rem)", letterSpacing: "-0.02em", color: "var(--fg-1)", margin: "2em 0 0.6em" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--fg-2)", margin: "0 0 1em" }}>{children}</p>;
}
function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 1em", paddingLeft: 20, color: "var(--fg-2)", fontSize: 15.5, lineHeight: 1.7 }}>
      {items.map((it, i) => <li key={i} style={{ marginBottom: 6 }}>{it}</li>)}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="eyebrow">Legal</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem,3.4vw,2.8rem)", marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", marginBottom: 28 }}>Last updated {UPDATED}</p>

        <P>This policy explains what data Vraelis collects, how we use it, and the choices you have. By using Vraelis (the website and app at vraelis.com) you agree to this policy.</P>

        <H>Who we are</H>
        <P>Vraelis is an AI lead follow-up tool for businesses. It replies to your inbound leads, follows up, books appointments, and can collect payments on your behalf. Questions: <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a>.</P>

        <H>What we collect</H>
        <List items={[
          <><b>Account info</b> — your name and email when you sign in with Google, GitHub, or email.</>,
          <><b>Business info you enter</b> — your business name, description, services, and prices.</>,
          <><b>Lead data</b> — the names, emails, phone numbers, and messages your own customers (leads) submit through your Vraelis chat link, booking link, form, or widget.</>,
          <><b>Conversation content</b> — messages exchanged between your leads and the AI assistant.</>,
          <><b>Payment data</b> — amounts, status, and identifiers for payments and plans. Card and bank details are handled by Stripe and PayPal; we never see or store full card numbers.</>,
          <><b>Technical data</b> — a login session cookie, and basic logs (IP, browser) used to run and secure the service.</>,
        ]} />

        <H>How we use it</H>
        <List items={[
          "Run the service: answer leads, follow up, book appointments, and process payments.",
          "Generate AI replies in your business's voice.",
          "Send transactional emails (lead replies, booking confirmations, receipts, account notices).",
          "Keep the service secure and prevent abuse.",
        ]} />
        <P>We do not sell your data, and we do not sell your leads' data.</P>

        <H>Text messaging (SMS)</H>
        <P>Phone numbers may be collected when a lead or visitor submits a Vraelis-powered chat, booking, contact, or lead form and actively consents to text messages (by checking the SMS consent box), or when someone texts a Vraelis-managed business number first.</P>
        <P>With that consent, the number may be used to send conversational text messages from the business and its Vraelis AI assistant about the person&apos;s inquiry — including appointment scheduling, reminders, follow-up, support, payment requests, and service updates. Message frequency varies. Message and data rates may apply. Reply <b>STOP</b> at any time to opt out, and <b>HELP</b> for help; we honor these automatically. Opting out of SMS does not affect the chat or email conversation, and SMS consent is never a condition of purchase.</P>
        <P>We do not sell phone numbers or message content, and we do not share them with third parties for those parties&apos; own marketing.</P>

        <H>Service providers we share data with</H>
        <P>We use trusted third parties to run Vraelis. Each receives only the data needed for its function:</P>
        <List items={[
          <><b>Supabase</b> — database and storage for your account, leads, and messages.</>,
          <><b>Vercel</b> — application hosting.</>,
          <><b>Anthropic</b> — the AI provider. Your business details and your leads' messages are sent to Anthropic to generate replies. Anthropic does not train on this data via the API.</>,
          <><b>Stripe</b> — plan billing and, via Stripe Connect, collecting payments from your leads and paying you out.</>,
          <><b>PayPal</b> — an alternative plan payment method.</>,
          <><b>Resend</b> — sending transactional email.</>,
          <><b>Google / GitHub</b> — optional sign-in.</>,
        ]} />

        <H>Cookies</H>
        <P>We use a cookie to keep you signed in. We don't use third-party advertising cookies.</P>

        <H>Data retention and deletion</H>
        <P>We keep data while your account is active. To request a copy of your data or have it deleted, email <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a> and we'll action it within a reasonable time, subject to records we must keep for legal or accounting reasons.</P>

        <H>Children</H>
        <P>Vraelis is a business tool intended for adults (18+, or a minor under the supervision of a responsible parent or legal guardian, as set out in our Terms). It is not directed to children, and we don&apos;t knowingly collect data from them.</P>

        <H>Security</H>
        <P>Data is encrypted in transit (HTTPS). Secret keys and credentials live only on the server and are never exposed to the browser. No system is perfectly secure, but we take reasonable measures to protect your data.</P>

        <H>Changes</H>
        <P>We may update this policy. We'll change the date above and, for significant changes, notify you. Continued use means you accept the update.</P>

        <H>Contact</H>
        <P><a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a></P>
      </div>
    </section>
  );
}

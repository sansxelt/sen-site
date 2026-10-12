// THE ONE EMAIL SHELL. Every Vraelis email, transactional or owner alert, is rendered through shell() and
// the atoms below, so a customer who gets a receipt and a security notice in the same week gets them from
// the same company, and the next design change is one edit here.
//
// REBUILT 2026-09-30, founder: next to the mail Anthropic sends, ours looked like a web page in a box, and it
// ignored the reader's dark mode. It was four frames around three lines: a grey page, a bordered card, a
// header bar with the wordmark, a footer bar. Now:
//
//   - ONE OPEN COLUMN (600px since THE FORMAT below), no card, no bars. The mark sits at the top like a
//     letterhead, then the heading, the content, and a quiet footer under a single hairline.
//   - REDONE 2026-10-11 (founder: "emails are horrid", then "keep it white and black ... switch depending if
//     they white or dark mode"): WHITE BY DEFAULT with black ink, like the x.ai, Vercel and Supabase mail he
//     pointed at, and the site's black when the reader's mail app is in dark mode (the DARK block, keyed to the
//     vx-* classes). The real diamond lockup is a transparent PNG in two inks, swapped with the theme.
//   - A proper bottom: a sign-off, then a hairline and three footer lines (copyright with Privacy and Terms, why
//     you got it, support). Every link in the footer is explicit and grey so Gmail cannot turn it blue.
//   - ONE accent for the one primary button and for links: ink on white, white on dark.
//   - State colour only where the email reports a state, as a one-line status row.
//   - A one-time code is the action of its email, set large in mono on a soft panel (oneTimeCode).
//   - Every email carries a hidden preheader, the line an inbox shows under the subject.
//
// THE FORMAT (2026-10-11, founder pointing at a SpaceXAI login notice: "not the worst but study this"):
//   - The logo with its name at the top: the silver diamond and "Vraelis" (lockup-ink@2x.png, black name, on
//     white; lockup@2x.png, white name, in dark mode). Tried the same evening and rejected: a darkened diamond
//     ("what the hell is this") and the diamond without the name ("name?").
//   - A 600px column, larger and airier type (16px at 1.75), one body colour, no grey paragraphs mid-letter.
//   - A medium-weight heading, the greeting on its own line, details as plain "Label: value" lines with the label
//     in bold, no table rules.
//   - A sign-off after a clear gap ("Vraelis Team"), a hairline, and a short, widely spaced footer.
//
// MAIL CLIENT NOTES
//   - Layout is tables with inline styles; the <style> block only adds the light palette and small-screen
//     spacing. Every element whose colour changes in light mode carries a vx-* class for it.
//   - Outlook on Windows renders with Word: it ignores max-width (hence the fixed 520 ghost table), ignores
//     padding on <a> (hence mso-padding-alt on the button cell), and falls back to Times New Roman when the
//     FIRST font in a stack is missing (hence the mso font override).
//   - The mark is the real diamond lockup as a hosted PNG (public/email/lockup@2x.png): mail clients do not
//     render SVG. Its alt text is the name, styled, so a client that blocks images still shows "Vraelis".
//
// THE LOOK (2026-10-11, founder: "emails are horrid"): the site's own. Black ground, white ink, quiet greys,
// a white pill for the one action. Dark only, on purpose: the site is black everywhere, and declaring a dark
// colour scheme keeps Apple Mail and Gmail from repainting the message white.

export const FONT = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// Inline palette: white ground, black ink (founder 2026-10-11, pointing at x.ai, Vercel and Supabase mail: "keep
// it white and black ... switch depending if they white or dark mode"). The dark palette is the DARK block below.
const BG = "#FFFFFF";
const INK = "#0A0A0B";
const BODY = "#27272A";
const MUTED = "#71717A";
const LINE = "#E4E4E7";
const SOFT = "#F4F4F5";
const ACCENT = "#0A0A0B";

/** Where the hosted images live. Override for a preview deployment with VRAELIS_EMAIL_ASSET_ORIGIN. */
export const ASSET_ORIGIN = (process.env.VRAELIS_EMAIL_ASSET_ORIGIN || "https://vraelis.com").replace(/\/$/, "");

const TONES = {
  problem: { fg: "#B42318", bg: "#FEF3F2", border: "#FECDCA" },
  success: { fg: "#0A0A0B", bg: "#F4F4F5", border: "#D4D4D8" },
  // A change that is neither good nor bad news, such as a plan ending on schedule.
  notice: { fg: "#3F3F46", bg: "#F4F4F5", border: "#E4E4E7" },
} as const;
export type StatusTone = keyof typeof TONES;

/** The support inbox printed in every footer. The same address the templates already route replies to. */
export const SUPPORT_EMAIL = "help@vraelis.com";

/**
 * HTML-escape a value for interpolation into a template. The templates do not use a rendering library, so
 * anything that did not come from this codebase (names, subjects, messages, labels) goes through this.
 * `&` first, so the later replacements are not double-escaped.
 */
export function escapeHtml(value: unknown): string {
  const str = typeof value === "string" ? value : String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ShellOptions = {
  /** Hidden inbox preview line. Plain text; it is escaped here. */
  preheader: string;
  /** Why the recipient got this email. Plain text; it is escaped here. */
  reason?: string;
  /** Print the support line in the footer. Off only for mail that goes to our own inboxes. */
  support?: boolean;
  /** The sign-off above the footer. Defaults to "The Vraelis team"; false for mail to our own inboxes. */
  signoff?: string | false;
};

/**
 * Footer text with its addresses as quiet links. Gmail turns any bare domain or email address into a bright
 * blue link, which broke the footer's grey (founder 2026-10-11: "could still be better, more at the bottom");
 * an explicit link in the footer's own colour is left alone. Input is plain text; it is escaped here.
 */
function quietLinks(text: string, style: string, addressStyle = style): string {
  return escapeHtml(text).replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|\b(vraelis\.com)\b/g, (m, email) =>
    email
      ? `<a href="mailto:${email}" style="${addressStyle}">${email}</a>`
      : `<a href="https://vraelis.com" style="${style}">${m}</a>`);
}

export const DEFAULT_REASON = "You are receiving this because you have a Vraelis account.";

// Filler after the preheader so an inbox preview does not run on into the body text.
const PREHEADER_PAD = "&#847;&zwnj;&nbsp;".repeat(60);

// The dark palette (the site's own black), for readers whose mail app is in dark mode: Apple Mail, iOS Mail and
// Outlook for Mac through prefers-color-scheme, Outlook.com and the Outlook apps through [data-ogsc]. The Gmail
// apps darken mail themselves, which is why both logos are transparent PNGs. Gmail on the web stays white.
const DARK = `
  body, .vx-bg { background: #0A0A0B !important; }
  .vx-ink { color: #FAFAFA !important; }
  .vx-text { color: #D4D4D8 !important; }
  .vx-muted, .vx-muted a { color: #8E8E96 !important; }
  .vx-rule { border-color: #232327 !important; }
  .vx-soft { background: #141416 !important; border-color: #232327 !important; }
  .vx-btn { background: #FAFAFA !important; }
  .vx-btn a { color: #0A0A0B !important; }
  a.vx-link { color: #FAFAFA !important; }
  .vx-notice, .vx-success { background: #141416 !important; border-color: #232327 !important; color: #C9C9CF !important; }
  .vx-problem { background: #2A1513 !important; border-color: #5C2620 !important; color: #FDA29B !important; }
  .vx-logo-light { display: none !important; }
  .vx-logo-dark { display: block !important; }`;
// The same rules for Outlook.com and the Outlook apps, which mark a dark-mode message with [data-ogsc].
const OGSC = DARK.trim().split("\n").map((line) => {
  const [selectors, rule] = line.trim().split("{");
  return `${selectors.split(",").map((s) => `[data-ogsc] ${s.trim()}`).join(", ")} {${rule}`;
}).join("\n    ");

export function shell(content: string, opts: ShellOptions): string {
  // THE FOOTER (founder 2026-10-12 critiqued it: four spaced lines, vraelis.com twice, underlines everywhere). Now
  // three short lines in SpaceXAI's order: the copyright with Privacy and Terms, why you got this, who to ask.
  // Links are grey; Vraelis, Privacy, Terms and email addresses are underlined, the domain in the reason line is not.
  const foot = `margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};`;
  const footLink = `color:${MUTED};text-decoration:none;`;
  const footAddress = `color:${MUTED};text-decoration:underline;text-underline-offset:2px;`;
  const year = new Date().getUTCFullYear();
  const lines = [
    // The three are links, underlined so they read as links (founder, 2026-10-12).
    `&copy; ${year} <a href="https://vraelis.com" style="${footAddress}">Vraelis</a> &nbsp;&middot;&nbsp; <a href="https://vraelis.com/privacy" style="${footAddress}">Privacy</a> &nbsp;&middot;&nbsp; <a href="https://vraelis.com/terms" style="${footAddress}">Terms</a>`,
    quietLinks(opts.reason ?? DEFAULT_REASON, footLink, footAddress),
    ...(opts.support === false ? [] : [`For questions, contact <a href="mailto:${SUPPORT_EMAIL}" style="${footAddress}">${SUPPORT_EMAIL}</a>`]),
  ];
  const footer = lines.map((l, i) => `<p class="vx-muted" style="${foot}${i === lines.length - 1 ? "margin:0;" : ""}">${l}</p>`).join("\n              ");
  // Mail to our own inboxes (support: false) is not signed off unless asked.
  const signoffText = opts.signoff === false || (opts.signoff === undefined && opts.support === false)
    ? "" : (opts.signoff ?? "Vraelis Team");
  const signoff = signoffText
    ? `<p class="vx-text" style="margin:36px 0 0;font-family:${FONT};font-size:16px;line-height:1.75;color:${BODY};">${escapeHtml(signoffText)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Vraelis</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table,td,th,p,a,h1,li,span,div{font-family:'Segoe UI',Arial,sans-serif !important;}</style>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    a { color: ${ACCENT}; }
    .vx-logo-dark { display: none !important; mso-hide: all; }
    @media (prefers-color-scheme: dark) {${DARK}
    }
    ${OGSC}
    @media only screen and (max-width: 600px) {
      .vx-outer { padding: 28px 20px 36px !important; }
      .vx-h1 { font-size: 24px !important; }
      .vx-otp { font-size: 28px !important; letter-spacing: 0.16em !important; }
    }
    @media only screen and (max-width: 480px) {
      .vx-dt { display: block !important; width: auto !important; padding: 10px 0 0 !important; }
      .vx-dd { display: block !important; width: auto !important; padding: 2px 0 10px !important; border-top: 0 !important; }
    }
  </style>
</head>
<body class="vx-bg" style="margin:0;padding:0;background:${BG};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}${PREHEADER_PAD}</div>
  <table class="vx-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background:${BG};">
    <tr><td align="center" class="vx-outer" style="padding:56px 24px 64px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr><td style="padding:0 0 40px;">
          <a href="https://vraelis.com" style="text-decoration:none;"><img class="vx-logo-light" src="${ASSET_ORIGIN}/email/lockup-ink@2x.png" width="110" height="28" alt="Vraelis" style="display:block;width:110px;height:28px;border:0;outline:none;color:${INK};font-family:${FONT};font-size:18px;font-weight:600;line-height:28px;"><img class="vx-logo-dark" src="${ASSET_ORIGIN}/email/lockup@2x.png" width="110" height="28" alt="" style="display:none;width:110px;height:28px;border:0;outline:none;mso-hide:all;"></a>
        </td></tr>
        <tr><td class="vx-text" style="font-family:${FONT};font-size:16px;line-height:1.75;color:${BODY};">
          ${content}
          ${signoff}
        </td></tr>
        <tr><td style="padding:44px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="vx-rule" style="padding:28px 0 0;border-top:1px solid ${LINE};">
              ${footer}
            </td></tr>
          </table>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Atoms. Each takes HTML that is already safe; callers escape anything that came from outside. ───────

export function h1(html: string): string {
  return `<h1 class="vx-h1 vx-ink" style="margin:0 0 28px;font-family:${FONT};font-size:28px;font-weight:500;line-height:1.25;letter-spacing:-0.015em;color:${INK};word-break:break-word;">${html}</h1>`;
}

const para = (html: string) =>
  `<p class="vx-text" style="margin:0 0 18px;font-family:${FONT};font-size:16px;line-height:1.75;color:${BODY};">${html}</p>`;

/** Body paragraph, 16px. A paragraph that opens with the greeting ("Hi Dana, thanks for ...") is set as two, the
 *  greeting on its own line, as letters do; the templates can keep writing it inline. */
export function p(html: string): string {
  const m = html.match(/^\s*(Hi(?: [^,<]{1,60})?,)\s+([\s\S]+)$/);
  if (!m) return para(html);
  return para(m[1]) + para(m[2].charAt(0).toUpperCase() + m[2].slice(1));
}

/** Secondary lines (fallbacks, "did not request this"): body type one step smaller, the same colour. No grey
 *  paragraphs mid-letter. */
export function small(html: string): string {
  return `<p class="vx-text" style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.75;color:${BODY};">${html}</p>`;
}

/** Emphasis inside body copy. */
export function strong(html: string): string {
  return `<strong class="vx-ink" style="font-weight:600;color:${INK};">${html}</strong>`;
}

/** An inline link in the accent colour, underlined so it does not rely on colour alone. */
export function link(href: string, label: string): string {
  return `<a class="vx-link" href="${escapeHtml(href)}" style="color:${ACCENT};text-decoration:underline;text-underline-offset:2px;">${label}</a>`;
}

/** A mailto link, printed as the address itself. */
export function mailto(address: string): string {
  return link(`mailto:${address}`, escapeHtml(address));
}

/**
 * THE primary action. Bulletproof: a table cell carries the fill so Outlook paints it, mso-padding-alt
 * gives Outlook the padding it refuses to apply to the link, and everywhere else the padded link is the
 * whole click target. One per email.
 */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;border-collapse:separate;">
    <tr><td class="vx-btn" align="center" bgcolor="${ACCENT}" style="border-radius:999px;background:${ACCENT};mso-padding-alt:12px 24px;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:999px;">${label}</a>
    </td></tr>
  </table>`;
}

/** One-line status row for emails that report a state (a failed payment, an ended plan, a paid receipt). */
export function status(tone: StatusTone, html: string): string {
  const t = TONES[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr><td class="vx-${tone}" style="padding:11px 14px;background:${t.bg};border:1px solid ${t.border};border-radius:8px;font-family:${FONT};font-size:14px;font-weight:500;line-height:1.5;color:${t.fg};">${html}</td></tr>
  </table>`;
}

/**
 * Key/value details as plain lines, "Label: value", the label in bold. Tabular figures so amounts and dates line
 * up. Values are escaped unless passed as { html }, which is for a value that is itself a link.
 */
export type DetailValue = string | { html: string };
export function details(rows: Array<[string, DetailValue]>): string {
  const lines = rows.map(([label, value]) => {
    const v = typeof value === "string" ? escapeHtml(value) : value.html;
    return `<p class="vx-text" style="margin:0;font-family:${FONT};font-size:16px;line-height:1.75;font-variant-numeric:tabular-nums;color:${BODY};word-break:break-word;"><strong class="vx-ink" style="font-weight:600;color:${INK};">${escapeHtml(label)}:</strong> ${v}</p>`;
  }).join("");
  return `<div style="margin:0 0 18px;">${lines}</div>`;
}

/** A short bulleted list in body type. Items are HTML. */
export function list(items: string[]): string {
  return `<ul class="vx-text" style="margin:0 0 18px;padding:0 0 0 20px;font-family:${FONT};font-size:16px;line-height:1.75;color:${BODY};">${items
    .map((i) => `<li style="margin:0 0 6px;">${i}</li>`).join("")}</ul>`;
}

/** A URL or code shown for copying, in mono, breaking anywhere so it never widens the column. */
export function code(text: string): string {
  return `<p class="vx-soft vx-ink" style="margin:0 0 16px;padding:10px 12px;background:${SOFT};border:1px solid ${LINE};border-radius:8px;font-family:${MONO};font-size:12.5px;line-height:1.6;color:${INK};word-break:break-all;">${escapeHtml(text)}</p>`;
}

/**
 * A one-time code, set large in mono and spaced so it can be read off one screen and typed into another.
 * It is the action of its email, so a message that carries one needs no button. Text is escaped.
 */
export function oneTimeCode(value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border-collapse:separate;">
    <tr><td class="vx-soft vx-ink vx-otp" style="padding:18px 22px;background:${SOFT};border:1px solid ${SOFT};border-radius:12px;font-family:${MONO};font-size:32px;font-weight:600;line-height:1.2;letter-spacing:0.2em;color:${INK};">${escapeHtml(value)}</td></tr>
  </table>`;
}

/**
 * A full-width picture: a still, a capture or an animated GIF (founder 2026-10-11: "images r cool too / vids /
 * gifs"). Mail clients do not play video, so a video goes in as a GIF or as its poster image with `href` pointing
 * at the video. The image must be hosted (ASSET_ORIGIN) and should be at least 2x its 600px display width.
 */
export function image(opts: { src: string; alt: string; width: number; height: number; href?: string; caption?: string }): string {
  const w = 600, h = Math.round((opts.height / opts.width) * w);
  const img = `<img src="${escapeHtml(opts.src)}" width="${w}" height="${h}" alt="${escapeHtml(opts.alt)}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;border-radius:12px;outline:none;">`;
  const linked = opts.href ? `<a href="${escapeHtml(opts.href)}" target="_blank" style="text-decoration:none;">${img}</a>` : img;
  const caption = opts.caption ? `<p class="vx-muted" style="margin:10px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">${escapeHtml(opts.caption)}</p>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td>${linked}${caption}</td></tr></table>`;
}

/** A quoted block of someone else's words (a support message, a lead's note). Text is escaped. */
export function quote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr><td class="vx-text vx-rule" style="padding:2px 0 2px 16px;border-left:2px solid ${LINE};font-family:${FONT};font-size:16px;line-height:1.75;color:${BODY};white-space:pre-wrap;word-break:break-word;">${escapeHtml(text)}</td></tr>
  </table>`;
}

/** A plain-text preview line from rendered HTML: the first paragraph if there is one, else all the text. */
export function textPreview(html: string, max = 140): string {
  // The first paragraph with content: p() sets a leading "Hi Dana," on its own line, which says nothing in a preview.
  const paras = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1]);
  const first = paras.find((t) => !/^\s*Hi(?: [^,<]{1,60})?,\s*$/.test(t)) ?? paras[0] ?? html;
  const text = first
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * The plain-text part of an email, derived from its HTML (founder 2026-10-12: "make sure u have all logic of any kind
 * of email"; a census found 23 of the 37 emails sent HTML only, which spam filters and text-only clients both
 * penalise). Headings and paragraphs become lines, list items get a dash, a link keeps its address after its label,
 * the hidden preheader and the logo are dropped, and the footer is set off with "--".
 */
export function textFromHtml(html: string): string {
  const decode = (s: string) => s
    .replace(/&nbsp;/g, " ").replace(/&middot;/g, "·").replace(/&copy;/g, "©").replace(/&ldquo;|&rdquo;/g, "\"")
    .replace(/&lsquo;|&rsquo;|&#39;|&apos;/g, "'").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…")
    .replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => { const c = Number(n); return c === 847 || c === 8204 ? "" : String.fromCodePoint(c); })
    .replace(/&zwnj;/g, "").replace(/&amp;/g, "&");
  let s = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, "")          // preheader
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<td class="vx-rule" style="padding:28px 0 0;/i, "\n\n--\n$&");  // footer rule
  s = s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
    const label = decode(inner.replace(/<[^>]+>/g, "")).trim();
    const target = decode(href).replace(/^mailto:/, "");
    if (!label) return ""; // an image-only link (the logo) says nothing in text
    return label === target || target === `https://${label}` ? label : `${label} (${target})`;
  });
  s = s
    .replace(/<p\b[^>]*margin:0;[^>]*>([\s\S]*?)<\/p>/gi, "$1\n") // detail lines stay together
    .replace(/<\/(h1|h2|h3|p)>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(li|tr|ul|ol|table|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]+>/g, "");
  return decode(s)
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Wraps a Resend client so every send carries a text part: the caller's own if it wrote one, else textFromHtml. */
export function withTextPart<C extends { emails: { send: (payload: never, options?: never) => unknown } }>(client: C): C {
  const original = client.emails.send.bind(client.emails) as (payload: unknown, options?: unknown) => unknown;
  (client.emails as { send: unknown }).send = (payload: { html?: string; text?: string } | undefined, options?: unknown) =>
    original(payload && payload.html && !payload.text ? { ...payload, text: textFromHtml(payload.html) } : payload, options);
  return client;
}

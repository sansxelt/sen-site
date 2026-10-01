// THE ONE EMAIL SHELL. Every Vraelis email, transactional or owner alert, is rendered through shell() and
// the atoms below, so a customer who gets a receipt and a security notice in the same week gets them from
// the same company, and the next design change is one edit here.
//
// REBUILT 2026-09-30, founder: next to the mail Anthropic sends, ours looked like a web page in a box, and it
// ignored the reader's dark mode. It was four frames around three lines: a grey page, a bordered card, a
// header bar with the wordmark, a footer bar. Now:
//
//   - ONE OPEN COLUMN, 520px, left aligned, on the mail app's own background. No page colour, no card, no
//     bars. The mark and wordmark sit at the top like a letterhead, then the heading, the content, and a
//     quiet footer under a single hairline.
//   - IT FOLLOWS THE READER'S THEME. color-scheme is "light dark". The light design paints white, so a client
//     that neither darkens mail nor reads our styles still shows a readable letter; in dark mode the page
//     colour is cleared and the message sits on the client's own dark background. Apple Mail, iOS Mail and Outlook for Mac honour the
//     prefers-color-scheme block below and get our dark palette; Outlook.com and the Outlook apps get it
//     through [data-ogsc]/[data-ogsb]; the Gmail apps darken mail themselves, and a design with no page
//     colour and plain ink text is what their inversion handles cleanly. Gmail on the web never darkens
//     mail, so there it is the light design.
//   - ONE accent, ink, for the one primary button and for links, as on the site and the console. In dark
//     mode it turns to near white, so the button stays the brightest thing on the screen.
//   - State colour only where the email reports a state, as a one-line status row.
//   - A one-time code is the action of its email, set large in mono on a soft panel (oneTimeCode).
//   - Every email carries a hidden preheader, the line an inbox shows under the subject.
//
// MAIL CLIENT NOTES
//   - Layout is tables with inline styles; the <style> block only adds dark mode and small-screen spacing.
//     Every element whose colour changes in dark mode carries a vx-* class for it.
//   - Outlook on Windows renders with Word: it ignores max-width (hence the fixed 520 ghost table), ignores
//     padding on <a> (hence mso-padding-alt on the button cell), and falls back to Times New Roman when the
//     FIRST font in a stack is missing (hence the mso font override).
//   - The mark is a table cell with a background and a letter, not an image: a blocked image is worse than
//     no image, and there is no hosted logo meant for mail.

export const FONT = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// Light palette (inline). The dark palette is in the <style> block, keyed to the vx-* classes.
const INK = "#0A0A0B";
const BODY = "#3F3F46";
const MUTED = "#71717A";
const LINE = "#E4E4E7";
const SOFT = "#F4F4F5";
const ACCENT = "#0A0A0B";

const TONES = {
  problem: { fg: "#B42318", bg: "#FEF3F2", border: "#FECDCA" },
  success: { fg: "#067647", bg: "#ECFDF3", border: "#ABEFC6" },
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
};

export const DEFAULT_REASON = "You are receiving this because you have a Vraelis account.";

// Filler after the preheader so an inbox preview does not run on into the body text.
const PREHEADER_PAD = "&#847;&zwnj;&nbsp;".repeat(60);

// The dark palette, once, for the three ways clients ask for it.
const DARK = `
  .vx-bg { background: transparent !important; }
  .vx-ink { color: #FAFAFA !important; }
  .vx-text { color: #D4D4D8 !important; }
  .vx-muted, .vx-muted a { color: #A1A1AA !important; }
  .vx-rule { border-color: #2E2F33 !important; }
  .vx-soft { background: #1B1B1E !important; border-color: #2E2F33 !important; }
  .vx-mark { background: #FAFAFA !important; color: #0A0A0B !important; }
  .vx-btn { background: #FAFAFA !important; }
  .vx-btn a { color: #0A0A0B !important; }
  a.vx-link { color: #FAFAFA !important; }
  .vx-problem { background: #2A1513 !important; border-color: #5C2620 !important; color: #FDA29B !important; }
  .vx-success { background: #0F2419 !important; border-color: #1F4D35 !important; color: #75E0A7 !important; }
  .vx-notice { background: #1B1B1E !important; border-color: #2E2F33 !important; color: #D4D4D8 !important; }`;
// The same rules for Outlook.com and the Outlook apps, which mark a dark-mode message with [data-ogsc].
const OGSC = DARK.trim().split("\n").map((line) => {
  const [selectors, rule] = line.trim().split("{");
  return `${selectors.split(",").map((s) => `[data-ogsc] ${s.trim()}`).join(", ")} {${rule}`;
}).join("\n    ");

export function shell(content: string, opts: ShellOptions): string {
  const reason = escapeHtml(opts.reason ?? DEFAULT_REASON);
  const foot = `margin:0 0 4px;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${MUTED};`;
  const footLink = `color:${MUTED};text-decoration:underline;`;
  const supportLine = opts.support === false
    ? ""
    : `<p class="vx-muted" style="${foot}">Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="${footLink}">${SUPPORT_EMAIL}</a>.</p>`;
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
    @media (prefers-color-scheme: dark) {${DARK}
    }
    ${OGSC}
    [data-ogsb] .vx-bg { background: transparent !important; }
    [data-ogsb] .vx-soft { background: #1B1B1E !important; }
    [data-ogsb] .vx-mark, [data-ogsb] .vx-btn { background: #FAFAFA !important; }
    @media only screen and (max-width: 600px) {
      .vx-outer { padding: 28px 20px 36px !important; }
      .vx-h1 { font-size: 22px !important; }
      .vx-otp { font-size: 28px !important; letter-spacing: 0.16em !important; }
    }
    @media only screen and (max-width: 480px) {
      .vx-dt { display: block !important; width: auto !important; padding: 10px 0 0 !important; }
      .vx-dd { display: block !important; width: auto !important; padding: 2px 0 10px !important; border-top: 0 !important; }
    }
  </style>
</head>
<body class="vx-bg" style="margin:0;padding:0;background:#FFFFFF;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}${PREHEADER_PAD}</div>
  <table class="vx-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background:#FFFFFF;">
    <tr><td align="center" class="vx-outer" style="padding:48px 24px 56px;">
      <!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr><td style="padding:0 0 36px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
            <tr>
              <td class="vx-mark" width="26" height="26" align="center" valign="middle" bgcolor="${INK}" style="width:26px;height:26px;border-radius:7px;background:${INK};font-family:${FONT};font-size:14px;font-weight:700;line-height:26px;color:#FFFFFF;text-align:center;">V</td>
              <td class="vx-ink" style="padding-left:10px;font-family:${FONT};font-size:16px;font-weight:600;letter-spacing:-0.01em;line-height:26px;color:${INK};">Vraelis</td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="vx-text" style="font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">
          ${content}
        </td></tr>
        <tr><td style="padding:24px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="vx-rule" style="padding:20px 0 0;border-top:1px solid ${LINE};">
              <p class="vx-muted" style="${foot}">${reason}</p>
              ${supportLine}
              <p class="vx-muted" style="${foot}margin:0;">Vraelis &middot; <a href="https://vraelis.com" style="${footLink}">vraelis.com</a> &middot; <a href="https://vraelis.com/privacy" style="${footLink}">Privacy</a> &middot; <a href="https://vraelis.com/terms" style="${footLink}">Terms</a></p>
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
  return `<h1 class="vx-h1 vx-ink" style="margin:0 0 14px;font-family:${FONT};font-size:24px;font-weight:600;line-height:1.25;letter-spacing:-0.02em;color:${INK};word-break:break-word;">${html}</h1>`;
}

/** Body paragraph, 15px. */
export function p(html: string): string {
  return `<p class="vx-text" style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">${html}</p>`;
}

/** Secondary text, 13.5px muted: fallbacks, "did not request this", fine print. */
export function small(html: string): string {
  return `<p class="vx-muted" style="margin:0 0 12px;font-family:${FONT};font-size:13.5px;line-height:1.6;color:${MUTED};">${html}</p>`;
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
    <tr><td class="vx-btn" align="center" bgcolor="${ACCENT}" style="border-radius:8px;background:${ACCENT};mso-padding-alt:12px 22px;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:8px;">${label}</a>
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
 * Key/value details. Labels muted, values ink, tabular figures so amounts and dates line up. Values are
 * escaped unless passed as { html }, which is for a value that is itself a link.
 */
export type DetailValue = string | { html: string };
export function details(rows: Array<[string, DetailValue]>): string {
  const cell = `font-family:${FONT};font-size:14px;line-height:1.5;font-variant-numeric:tabular-nums;vertical-align:top;`;
  const body = rows.map(([label, value], i) => {
    const edge = i === 0 ? "" : `border-top:1px solid ${LINE};`;
    const v = typeof value === "string" ? escapeHtml(value) : value.html;
    return `<tr>
      <td class="vx-dt vx-muted vx-rule" width="148" style="${cell}${edge}width:148px;padding:10px 16px 10px 0;color:${MUTED};">${escapeHtml(label)}</td>
      <td class="vx-dd vx-ink vx-rule" style="${cell}${edge}padding:10px 0;color:${INK};word-break:break-word;">${v}</td>
    </tr>`;
  }).join("");
  return `<table class="vx-rule" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};border-collapse:collapse;">${body}</table>`;
}

/** A short bulleted list in body type. Items are HTML. */
export function list(items: string[]): string {
  return `<ul class="vx-text" style="margin:0 0 16px;padding:0 0 0 20px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">${items
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
 * A one-time code, set large, centred and spaced so it can be read off one screen and typed into another.
 * It is the action of the email, so a message that carries one needs no button. Text is escaped.
 */
export function oneTimeCode(value: string): string {
  return `<p style="margin:4px 0 20px;padding:14px 16px;background:${PAGE};border:1px solid ${LINE};border-radius:6px;font-family:${MONO};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:0.2em;text-align:center;color:${INK};">${escapeHtml(value)}</p>`;
}

/** A quoted block of someone else's words (a support message, a lead's note). Text is escaped. */
export function quote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr><td class="vx-soft vx-text" style="padding:14px 16px;background:${SOFT};border:1px solid ${LINE};border-radius:8px;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};white-space:pre-wrap;word-break:break-word;">${escapeHtml(text)}</td></tr>
  </table>`;
}

/** A plain-text preview line from rendered HTML: the first paragraph if there is one, else all the text. */
export function textPreview(html: string, max = 140): string {
  const first = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  const text = first
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

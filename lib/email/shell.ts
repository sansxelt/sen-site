// THE ONE EMAIL SHELL. Every Vraelis email, transactional or owner alert, is rendered through shell() and
// the atoms below, so a customer who gets a receipt and a security notice in the same week gets them from
// the same company, and the next design change is one edit here.
//
// THE DESIGN, AND WHY EACH RULE EXISTS
//   - Light only. One white card on a #F4F4F5 page, 1px #E4E4E7 border, 8px radius. No shadow, gradient,
//     emoji or icon: receipts from Stripe, Linear and Vanta look like documents, and a verification company
//     sells credibility, so its mail should read the same way.
//   - Header is the wordmark as text. There is no hosted logo image on vraelis.com meant for mail, and a
//     blocked image is worse than no image.
//   - ONE accent, ink (#0A0A0B), used for the primary button and for links, as on the site and the console.
//   - State colour only where the email reports a state, as a one-line status row. Headings are never
//     coloured.
//   - At most one primary button per email. Secondary actions are plain links.
//   - Every email carries a hidden preheader, which is the line an inbox shows under the subject. Without
//     one the preview is whatever text comes first, which was the wordmark.
//
// MAIL CLIENT NOTES
//   - Layout is tables with inline styles. The <style> block only sharpens clients that honour it (Apple
//     Mail, iOS, Gmail apps); nothing depends on it.
//   - Outlook on Windows renders with Word: it ignores max-width (hence the fixed 560 ghost table), ignores
//     padding on <a> (hence mso-padding-alt on the button cell), and falls back to Times New Roman when the
//     FIRST font in a stack is missing rather than trying the next one (hence the mso font override).
//   - color-scheme is "light only" so clients that auto-darken leave the card alone instead of inverting it
//     into something nobody designed.

export const FONT = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const INK = "#0A0A0B";
const BODY = "#3F3F46";
const MUTED = "#71717A";
const LINE = "#E4E4E7";
const PAGE = "#F4F4F5";
const ACCENT = "#0A0A0B"; // ink, like the site and the console (was cobalt until 2026-09-30)

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

export function shell(content: string, opts: ShellOptions): string {
  const reason = escapeHtml(opts.reason ?? DEFAULT_REASON);
  const footLink = `color:${MUTED};text-decoration:underline;`;
  const supportLine = opts.support === false
    ? ""
    : `<p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="${footLink}">${SUPPORT_EMAIL}</a>.</p>`;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Vraelis</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table,td,th,p,a,h1,li,span,div{font-family:'Segoe UI',Arial,sans-serif !important;}</style>
  <![endif]-->
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    a { color: ${ACCENT}; }
    .vx-body h1 { margin: 0 0 16px; font-size: 22px; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; color: ${INK}; }
    .vx-body h2 { margin: 24px 0 8px; font-size: 16px; font-weight: 600; line-height: 1.4; color: ${INK}; }
    .vx-body p, .vx-body li { font-size: 15px; line-height: 1.6; color: ${BODY}; }
    .vx-body p { margin: 0 0 16px; }
    @media only screen and (max-width: 600px) {
      .vx-outer { padding: 16px 12px !important; }
      .vx-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .vx-h1 { font-size: 20px !important; }
    }
    @media only screen and (max-width: 480px) {
      .vx-dt { display: block !important; width: auto !important; padding: 10px 0 0 !important; }
      .vx-dd { display: block !important; width: auto !important; padding: 2px 0 10px !important; border-top: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${PAGE};">${escapeHtml(opts.preheader)}${PREHEADER_PAD}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
    <tr><td align="center" class="vx-outer" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${LINE};border-radius:8px;border-collapse:separate;">
        <tr><td class="vx-pad" style="padding:20px 32px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:16px;font-weight:600;line-height:24px;color:${INK};">Vraelis</td></tr>
        <tr><td class="vx-pad vx-body" style="padding:32px 32px 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">
          ${content}
        </td></tr>
        <tr><td class="vx-pad" style="padding:20px 32px 24px;border-top:1px solid ${LINE};">
          <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">${reason}</p>
          ${supportLine}
          <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">Vraelis &middot; <a href="https://vraelis.com" style="${footLink}">vraelis.com</a> &middot; <a href="https://vraelis.com/privacy" style="${footLink}">Privacy</a> &middot; <a href="https://vraelis.com/terms" style="${footLink}">Terms</a></p>
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
  return `<h1 class="vx-h1" style="margin:0 0 16px;font-family:${FONT};font-size:22px;font-weight:600;line-height:1.3;letter-spacing:-0.01em;color:${INK};word-break:break-word;">${html}</h1>`;
}

/** Body paragraph, 15px. */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">${html}</p>`;
}

/** Secondary text, 13px muted: fallbacks, "did not request this", fine print. */
export function small(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${html}</p>`;
}

/** Emphasis inside body copy. */
export function strong(html: string): string {
  return `<strong style="font-weight:600;color:${INK};">${html}</strong>`;
}

/** An inline link in the accent colour, underlined so it does not rely on colour alone. */
export function link(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${ACCENT};text-decoration:underline;">${label}</a>`;
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
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border-collapse:separate;">
    <tr><td align="center" bgcolor="${ACCENT}" style="border-radius:6px;background:${ACCENT};mso-padding-alt:12px 20px;">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 20px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:6px;">${label}</a>
    </td></tr>
  </table>`;
}

/** One-line status box for emails that report a state (a failed payment, an ended plan, a paid receipt). */
export function status(tone: StatusTone, html: string): string {
  const t = TONES[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr><td style="padding:10px 14px;background:${t.bg};border:1px solid ${t.border};border-radius:6px;font-family:${FONT};font-size:14px;font-weight:500;line-height:1.5;color:${t.fg};">${html}</td></tr>
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
      <td class="vx-dt" width="148" style="${cell}${edge}width:148px;padding:10px 16px 10px 0;color:${MUTED};">${escapeHtml(label)}</td>
      <td class="vx-dd" style="${cell}${edge}padding:10px 0;color:${INK};word-break:break-word;">${v}</td>
    </tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};border-collapse:collapse;">${body}</table>`;
}

/** A short bulleted list in body type. Items are HTML. */
export function list(items: string[]): string {
  return `<ul style="margin:0 0 16px;padding:0 0 0 20px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">${items
    .map((i) => `<li style="margin:0 0 6px;">${i}</li>`).join("")}</ul>`;
}

/** A URL or code shown for copying, in mono, breaking anywhere so it never widens the card. */
export function code(text: string): string {
  return `<p style="margin:0 0 16px;padding:10px 12px;background:${PAGE};border:1px solid ${LINE};border-radius:6px;font-family:${MONO};font-size:12px;line-height:1.6;color:${INK};word-break:break-all;">${escapeHtml(text)}</p>`;
}

/** A quoted block of someone else's words (a support message, a lead's note). Text is escaped. */
export function quote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;">
    <tr><td style="padding:14px 16px;background:${PAGE};border:1px solid ${LINE};border-radius:6px;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};white-space:pre-wrap;word-break:break-word;">${escapeHtml(text)}</td></tr>
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

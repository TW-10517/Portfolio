// Delivering the links the auth flows produce.
//
// This used to be a console.log with a comment saying "swap this for a real
// send in production" — which meant every deployment had to edit source to do
// the one thing every deployment needs. It is configuration now:
//
//   MAIL_TRANSPORT=console   (default) print the link to the server log
//   MAIL_TRANSPORT=smtp      send it, using SMTP_* below
//
// Console stays the default deliberately. The project's rule is that nothing
// paid and no third-party account is *required*, and a self-hosted instance
// with one user is perfectly served by reading the link out of its own log.
// SMTP is there for when you want real email, and any provider's free tier —
// or your own mail server — works, because SMTP is just SMTP.
//
// Nothing here throws into a request. A signup must not fail because a mail
// server is down; the account exists either way, and the user can ask for
// another link.

const TRANSPORT = (process.env.MAIL_TRANSPORT || "console").toLowerCase();
const FROM = process.env.MAIL_FROM || "Portfolio Builder <no-reply@localhost>";

const MESSAGES = {
  "Email verification": {
    subject: "Confirm your email address",
    lead: "Confirm your email address to finish setting up your portfolio.",
    action: "Confirm my email",
    note: "This link is good for 24 hours.",
  },
  "Password reset": {
    subject: "Reset your password",
    lead: "Someone asked to reset the password on your account.",
    action: "Choose a new password",
    note: "This link is good for one hour. If you didn't ask for this, you can ignore this email — nothing has changed.",
  },
};

// Anything interpolated into the HTML below is a URL we generated and an
// address the user typed. Escaping is cheap and the alternative is an
// injection into whatever renders the message.
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

export function buildMessage(kind, url) {
  const copy = MESSAGES[kind] || {
    subject: kind,
    lead: `Here is your ${kind.toLowerCase()} link.`,
    action: "Open the link",
    note: "",
  };
  // The plain-text part is not a courtesy. Some clients render it by
  // preference, and a link that only exists inside HTML is a link some people
  // cannot use.
  const text = [copy.lead, "", url, "", copy.note].filter(Boolean).join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#1a1c25">
  <p>${escapeHtml(copy.lead)}</p>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#00c9ff;color:#0b0c12;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">${escapeHtml(copy.action)}</a></p>
  <p style="font-size:13px;color:#63687c">Or paste this into your browser:<br><span style="word-break:break-all">${escapeHtml(url)}</span></p>
  ${copy.note ? `<p style="font-size:13px;color:#63687c">${escapeHtml(copy.note)}</p>` : ""}
</div>`;
  return { subject: copy.subject, text, html };
}

let transporter = null;

async function smtpTransporter() {
  if (transporter) return transporter;
  const { default: nodemailer } = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 and 25 start plain and upgrade with STARTTLS.
    // Getting this backwards is the most common way an SMTP config silently
    // fails to connect.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    tls: {
      // Certificates are verified by default, and every hosted provider has a
      // real one. This exists for a mail server on your own network with a
      // self-signed certificate — set it and you are trusting the network
      // path instead of the certificate, so only do that when you control
      // the network.
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  });
  return transporter;
}

// Exported for tests: lets a fake stand in for a real mail server.
export function setTransporter(fake) {
  transporter = fake;
}

export async function deliverLink(kind, email, url, { transport = TRANSPORT } = {}) {
  if (transport !== "smtp") {
    console.log(`\n[auth] ${kind} link for ${email}:\n  ${url}\n`);
    return { delivered: "console" };
  }

  if (!process.env.SMTP_HOST) {
    console.error(`[mail] MAIL_TRANSPORT=smtp but SMTP_HOST is unset. Falling back to the log.`);
    console.log(`\n[auth] ${kind} link for ${email}:\n  ${url}\n`);
    return { delivered: "console", reason: "no-smtp-host" };
  }

  const { subject, text, html } = buildMessage(kind, url);
  try {
    const mailer = await smtpTransporter();
    await mailer.sendMail({ from: FROM, to: email, subject, text, html });
    return { delivered: "smtp" };
  } catch (error) {
    // Deliberately swallowed. A signup that 500s because a mail server is
    // unreachable is worse than one that succeeds with an unsent link — the
    // account exists, and "resend verification" is right there.
    console.error(`[mail] could not send the ${kind} link to ${email}: ${error.message}`);
    return { delivered: "failed", error: error.message };
  }
}

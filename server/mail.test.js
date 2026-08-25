import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildMessage, deliverLink, setTransporter } from "./mail.js";

const sent = [];
const fakeMailer = { sendMail: vi.fn(async (message) => sent.push(message)) };

beforeEach(() => {
  sent.length = 0;
  fakeMailer.sendMail.mockClear();
  setTransporter(fakeMailer);
  process.env.SMTP_HOST = "smtp.test";
});

afterEach(() => {
  setTransporter(null);
  delete process.env.SMTP_HOST;
});

describe("buildMessage", () => {
  it("writes a subject and both bodies for each kind of link", () => {
    const verify = buildMessage("Email verification", "https://app.test/#/verify-email/abc");
    expect(verify.subject).toMatch(/confirm/i);
    expect(verify.text).toContain("https://app.test/#/verify-email/abc");
    expect(verify.html).toContain("https://app.test/#/verify-email/abc");

    const reset = buildMessage("Password reset", "https://app.test/#/reset-password/xyz");
    expect(reset.subject).toMatch(/reset/i);
    // Someone who didn't ask for this needs to be told nothing has happened.
    expect(reset.text).toMatch(/didn't ask/i);
  });

  it("always includes a plain-text part carrying the link", () => {
    // Some clients render text by preference. A link that exists only in the
    // HTML is a link some people cannot use.
    const { text } = buildMessage("Email verification", "https://app.test/x");
    expect(text).toContain("https://app.test/x");
  });

  it("escapes the URL rather than pasting it into markup", () => {
    const { html } = buildMessage("Email verification", 'https://app.test/"><script>alert(1)</script>');
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&quot;");
  });

  it("falls back to something sendable for an unknown kind", () => {
    const message = buildMessage("Some new flow", "https://app.test/y");
    expect(message.subject).toBe("Some new flow");
    expect(message.text).toContain("https://app.test/y");
  });
});

describe("deliverLink", () => {
  it("logs the link when no transport is configured", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await deliverLink("Email verification", "a@b.co", "https://app.test/x", {
      transport: "console",
    });
    expect(result.delivered).toBe("console");
    expect(fakeMailer.sendMail).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(" ")).toContain("https://app.test/x");
    log.mockRestore();
  });

  it("sends over SMTP when asked to", async () => {
    const result = await deliverLink("Password reset", "a@b.co", "https://app.test/r", { transport: "smtp" });
    expect(result.delivered).toBe("smtp");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("a@b.co");
    expect(sent[0].subject).toMatch(/reset/i);
    expect(sent[0].text).toContain("https://app.test/r");
  });

  it("falls back to the log when smtp is asked for but not configured", async () => {
    // Better than silence: the link still reaches the operator, and the reason
    // is stated rather than left to be inferred from an email that never came.
    delete process.env.SMTP_HOST;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deliverLink("Email verification", "a@b.co", "https://app.test/x", {
      transport: "smtp",
    });
    expect(result).toEqual({ delivered: "console", reason: "no-smtp-host" });
    expect(error.mock.calls.flat().join(" ")).toMatch(/SMTP_HOST/);
    log.mockRestore();
    error.mockRestore();
  });

  it("never throws when the mail server refuses", async () => {
    // A signup that 500s because a mail server is down is worse than one that
    // succeeds with an unsent link: the account exists either way, and
    // "resend verification" is right there.
    setTransporter({
      sendMail: vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deliverLink("Email verification", "a@b.co", "https://app.test/x", {
      transport: "smtp",
    });
    expect(result.delivered).toBe("failed");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

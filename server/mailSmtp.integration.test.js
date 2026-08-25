import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { SMTPServer } from "smtp-server";

// mail.test.js checks the wrapper with a fake mailer, which proves the routing
// and the message but not that anything is actually deliverable. This runs a
// real SMTP server on a socket and sends to it with the real transport, so the
// path a deployment uses is exercised by something rather than by nobody.
//
// Not covered here: TLS, authentication against a real provider, and whatever
// a given host does about rate limits and SPF.
const PORT = 32587;
const received = [];

let server;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    // The test server has no certificate; the client is told not to expect one.
    hideSTARTTLS: true,
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk) => (raw += chunk));
      stream.on("end", () => {
        received.push({ raw, to: session.envelope.rcptTo.map((r) => r.address), from: session.envelope.mailFrom.address });
        callback();
      });
    },
  });
  await new Promise((resolve, reject) => {
    server.listen(PORT, "127.0.0.1", resolve);
    server.on("error", reject);
  });

  process.env.MAIL_TRANSPORT = "smtp";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(PORT);
  process.env.SMTP_SECURE = "false";
  process.env.MAIL_FROM = "Portfolio Builder <no-reply@test.local>";
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const key of ["MAIL_TRANSPORT", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "MAIL_FROM"]) {
    delete process.env[key];
  }
});

describe("SMTP delivery against a real server", () => {
  it("delivers a verification link", async () => {
    // Imported here so the module reads the env set above.
    const { deliverLink } = await import("./mail.js");
    const result = await deliverLink(
      "Email verification",
      "ada@example.com",
      "https://app.test/#/verify-email/abc123"
    );

    expect(result.delivered).toBe("smtp");
    expect(received).toHaveLength(1);

    const message = received[0];
    expect(message.to).toEqual(["ada@example.com"]);
    expect(message.from).toBe("no-reply@test.local");
    expect(message.raw).toMatch(/Subject: .*Confirm/i);
    // Both parts, and the link survives whatever encoding the transport chose.
    expect(message.raw).toContain("multipart/alternative");
    const decoded = message.raw.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    expect(decoded).toContain("https://app.test/#/verify-email/abc123");
  });

  it("reports a refusal instead of throwing", async () => {
    const { deliverLink } = await import("./mail.js");
    // Nothing is listening on this port.
    process.env.SMTP_PORT = "32589"; // nothing listens here, and nothing may
    const { setTransporter } = await import("./mail.js");
    setTransporter(null); // force a new connection with the changed port
    const result = await deliverLink("Password reset", "ada@example.com", "https://app.test/r");
    expect(result.delivered).toBe("failed");
    process.env.SMTP_PORT = String(PORT);
    setTransporter(null);
  });
});

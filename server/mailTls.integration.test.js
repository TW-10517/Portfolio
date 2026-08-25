import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { SMTPServer } from "smtp-server";
import { testCertificate } from "../test/certs.js";

// The other mail tests send in the clear. Every real provider requires TLS, so
// "it delivers" proved less than it sounded like: encryption is where SMTP
// configuration usually goes wrong, and the two ports behave differently.
//
// This runs the same server twice — once on 465 (implicit TLS, encrypted from
// the first byte) and once on 587 (starts plain, upgrades with STARTTLS) —
// with a certificate generated for this run.
const { key, cert } = await testCertificate();

// Its own range. Vitest runs files in parallel, and the plaintext mail suite
// uses 32587 for a live server and 32589 as a port it needs to stay dead —
// overlapping either one made a test fail depending on scheduling.
const IMPLICIT_PORT = 32465;
const STARTTLS_PORT = 32466;

const received = [];
const servers = [];

function start(port, secure) {
  const server = new SMTPServer({
    secure,
    key,
    cert,
    authOptional: true,
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk) => (raw += chunk));
      stream.on("end", () => {
        received.push({ raw, port, secure: !!session.secure, to: session.envelope.rcptTo.map((r) => r.address) });
        callback();
      });
    },
  });
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", resolve);
    server.on("error", reject);
  });
}

beforeAll(async () => {
  await start(IMPLICIT_PORT, true);
  await start(STARTTLS_PORT, false);
  process.env.MAIL_TRANSPORT = "smtp";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.MAIL_FROM = "Portfolio Builder <no-reply@test.local>";
});

afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const k of [
    "MAIL_TRANSPORT",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "MAIL_FROM",
    "SMTP_TLS_REJECT_UNAUTHORIZED",
  ]) {
    delete process.env[k];
  }
});

async function sendWith(env) {
  const { deliverLink, setTransporter } = await import("./mail.js");
  Object.assign(process.env, env);
  setTransporter(null); // rebuild the transport with these settings
  return deliverLink("Email verification", "ada@example.com", "https://app.test/#/verify-email/tls");
}

describe("SMTP over TLS", () => {
  it("delivers over implicit TLS on 465", async () => {
    received.length = 0;
    const result = await sendWith({
      SMTP_PORT: String(IMPLICIT_PORT),
      SMTP_SECURE: "true",
      SMTP_TLS_REJECT_UNAUTHORIZED: "false",
    });
    expect(result.delivered).toBe("smtp");
    expect(received).toHaveLength(1);
    // The server's own view of the session, not ours.
    expect(received[0].secure).toBe(true);
    expect(received[0].raw.replace(/=\r?\n/g, "")).toContain("verify-email/tls");
  });

  it("upgrades to TLS with STARTTLS on 587", async () => {
    received.length = 0;
    const result = await sendWith({
      SMTP_PORT: String(STARTTLS_PORT),
      SMTP_SECURE: "false",
      SMTP_TLS_REJECT_UNAUTHORIZED: "false",
    });
    expect(result.delivered).toBe("smtp");
    expect(received).toHaveLength(1);
    // Connected in the clear, then encrypted before the message was sent —
    // which is the whole point of the port-587 flow.
    expect(received[0].secure).toBe(true);
  });

  it("refuses an untrusted certificate by default", async () => {
    // The important half. If verification were off by default, a misconfigured
    // deployment would encrypt to whoever answered rather than to its mail
    // server, and nothing would look wrong.
    received.length = 0;
    const result = await sendWith({
      SMTP_PORT: String(IMPLICIT_PORT),
      SMTP_SECURE: "true",
      SMTP_TLS_REJECT_UNAUTHORIZED: "true",
    });
    expect(result.delivered).toBe("failed");
    expect(result.error).toMatch(/self.signed|unable to verify|certificate/i);
    expect(received).toHaveLength(0);
  });
});

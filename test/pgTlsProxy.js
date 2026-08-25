import net from "net";
import tls from "tls";

// A TLS front door for a plain PostgreSQL server, so the `pg` client's
// encrypted path can be tested without a hosted database.
//
// Postgres does not simply listen for TLS. A client opens a plain connection
// and sends an 8-byte SSLRequest; the server answers with a single 'S' (yes)
// or 'N' (no), and only then does the handshake begin on the same socket.
// That negotiation is the part a plain TLS terminator would get wrong, and it
// is exactly the part worth testing — `?sslmode=require` in a connection
// string is a promise that this exchange happens.
const SSL_REQUEST_CODE = 80877103;

export function createPgTlsProxy({ listenPort, targetPort, key, cert, host = "127.0.0.1" }) {
  const server = net.createServer((client) => {
    client.once("data", (first) => {
      // The request is exactly 8 bytes: its own length, then the magic code.
      if (first.length < 8 || first.readInt32BE(0) !== 8 || first.readInt32BE(4) !== SSL_REQUEST_CODE) {
        // Not asking for TLS. Refuse rather than quietly serving in the clear,
        // so a test that meant to be encrypted can't pass by accident.
        client.end();
        return;
      }

      client.write(Buffer.from("S"));

      const secured = new tls.TLSSocket(client, { isServer: true, key, cert });
      secured.on("error", () => secured.destroy());

      const upstream = net.connect({ port: targetPort, host }, () => {
        secured.pipe(upstream);
        upstream.pipe(secured);
      });
      upstream.on("error", () => secured.destroy());
      secured.on("close", () => upstream.destroy());
    });
    client.on("error", () => client.destroy());
  });

  return {
    listen: () => new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(listenPort, host, resolve);
    }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

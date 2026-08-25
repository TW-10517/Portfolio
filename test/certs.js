import selfsigned from "selfsigned";

// Generated per run rather than committed.
//
// A private key in a repository is a private key in a repository, however
// clearly the filename says "test": it trips secret scanners, it teaches the
// habit, and the next person who needs one copies the pattern. Generating
// takes a moment and leaves nothing behind.
let cached = null;

export async function testCertificate() {
  // selfsigned 5 returns a promise; earlier versions returned the pems
  // directly, and the difference is silent — an object with no keys rather
  // than an error.
  if (!cached) {
    const pems = await selfsigned.generate([{ name: "commonName", value: "localhost" }], {
      days: 1,
      keySize: 2048,
      algorithm: "sha256",
      extensions: [
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: "localhost" },
            { type: 7, ip: "127.0.0.1" },
          ],
        },
      ],
    });
    cached = { key: pems.private, cert: pems.cert };
  }
  return cached;
}

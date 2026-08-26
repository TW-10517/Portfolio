// Turning a data: URL into a Blob without asking the network for it.
//
// `fetch(dataUrl)` is the idiomatic one-liner and it works — until the page is
// served with a Content-Security-Policy, where `connect-src` governs it and a
// data: URL is not in the list. The failure is quiet in the worst way: the
// upload path catches it and keeps the inline base64 copy instead, so photos
// silently go back to living inside the portfolio JSON and documents grow
// until they can't be saved at all.
//
// Loosening connect-src to allow data: would fix the symptom. Decoding it here
// is a handful of lines, needs no network permission, and skips a round trip
// through the fetch machinery for bytes we already hold.
export function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new TypeError("Not a data: URL");
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new TypeError("Malformed data: URL");

  const header = dataUrl.slice("data:".length, comma);
  const base64 = /;base64$/i.test(header);
  const type = (base64 ? header.replace(/;base64$/i, "") : header).split(";")[0] || "text/plain";
  const payload = dataUrl.slice(comma + 1);

  if (!base64) return new Blob([decodeURIComponent(payload)], { type });

  // atob gives one character per byte; a canvas JPEG is binary, so it has to
  // be copied out as bytes rather than handed to Blob as a string, which would
  // re-encode it as UTF-8 and corrupt every byte above 0x7f.
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

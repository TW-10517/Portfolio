// Placeholder art for the sample portfolio, generated locally.
//
// These used to point at placehold.co. That meant every brand-new account
// waited on five requests to a third party before its own sample content
// finished drawing — measured at roughly half a second on mobile data, on the
// critical path of the very first thing anyone sees. It also meant a service
// none of us control could slow the app down, or stop serving, or watch who
// was loading it.
//
// An inline SVG is a few hundred bytes, needs no network at all, and scales to
// any size without blurring.
const FONT = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

function escapeXml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]
  );
}

export function placeholderImage({ width, height, label, bg = "#12141f", fg = "#00c9ff" }) {
  // Sized off the shorter edge so the caption fits a wide banner and a square
  // avatar alike.
  const size = Math.round(Math.min(width, height) / (label.length > 12 ? 9 : 6));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${escapeXml(bg)}"/>` +
    `<text x="50%" y="50%" fill="${escapeXml(fg)}" font-family="${FONT}" font-size="${size}" ` +
    `font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text>` +
    `</svg>`;
  // encodeURIComponent rather than base64: the result is smaller, and it stays
  // readable in the saved portfolio JSON.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

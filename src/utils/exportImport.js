export function downloadJson(data, filename = "portfolio.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Uploads are downscaled before they leave the browser. They are stored on the
// server (see server/routes/images.js) and referenced by URL, but an upload
// still passes through a data URL on its way there — and stays one if the
// server can't be reached — so keeping them small still matters.
export const MAX_IMAGE_DIMENSION = 1600;

// Re-encoding is also worth it for an image that already fits but is simply
// heavy (a lightly-compressed 1200px PNG can be several megabytes).
const RECODE_ABOVE_BYTES = 400 * 1024;

// Animation and vector art don't survive a trip through a raster canvas, so
// these are stored exactly as uploaded.
const RECODE_SKIP = new Set(["image/gif", "image/svg+xml"]);

// Pure sizing maths, kept separate from the DOM so it can be tested directly.
// Scales the longest edge down to `max`, preserving aspect ratio.
export function fitWithin(width, height, max = MAX_IMAGE_DIMENSION) {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0, scaled: false };
  if (width <= max && height <= max) return { width, height, scaled: false };
  const scale = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

// Plain base64 read with no image processing — used for the resume PDF.
export function readFileAsDataUrl(file) {
  return fileToDataUrl(file);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode that image."));
    img.src = src;
  });
}

// WebP keeps transparency (unlike JPEG) and compresses better than PNG, but a
// browser without encoder support silently hands back a PNG instead — so the
// result is checked rather than assumed.
function encode(canvas) {
  const webp = canvas.toDataURL("image/webp", 0.85);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function downscaleDataUrl(dataUrl, maxDimension = MAX_IMAGE_DIMENSION) {
  const img = await loadImage(dataUrl);
  const fit = fitWithin(img.naturalWidth, img.naturalHeight, maxDimension);
  if (!fit.scaled && dataUrl.length <= RECODE_ABOVE_BYTES) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = fit.width;
  canvas.height = fit.height;
  canvas.getContext("2d").drawImage(img, 0, 0, fit.width, fit.height);

  const encoded = encode(canvas);
  // Re-encoding a small or already-optimised image can make it bigger; keep
  // whichever is actually smaller.
  return encoded.length < dataUrl.length ? encoded : dataUrl;
}

export async function readImageFile(file, { maxDimension = MAX_IMAGE_DIMENSION } = {}) {
  const dataUrl = await fileToDataUrl(file);
  if (RECODE_SKIP.has(file.type)) return dataUrl;
  try {
    return await downscaleDataUrl(dataUrl, maxDimension);
  } catch {
    // A failed downscale should never block the upload — store the original.
    return dataUrl;
  }
}

// Walks a portfolio and replaces every stored-image URL with the image itself.
//
// An exported file is meant to be a portfolio you can keep, mail to someone,
// or import on another machine. Once images live on the server, a plain export
// would be full of links that only resolve while that server is up and only
// for as long as the image is there — so the export puts the bytes back. An
// image that can't be fetched keeps its URL rather than failing the export.
export async function inlineStoredImages(data, resolve, fetchImpl = fetch) {
  const cache = new Map();

  const inline = async (url) => {
    if (!cache.has(url)) cache.set(url, fetchOne(url));
    return cache.get(url);
  };

  const fetchOne = async (url) => {
    try {
      const res = await fetchImpl(resolve(url));
      if (!res.ok) return url;
      const blob = await res.blob();
      return await fileToDataUrl(blob);
    } catch {
      return url;
    }
  };

  const walk = async (node) => {
    if (typeof node === "string") return isStored(node) ? inline(node) : node;
    if (Array.isArray(node)) return Promise.all(node.map(walk));
    if (node && typeof node === "object") {
      return Object.fromEntries(await Promise.all(Object.entries(node).map(async ([k, v]) => [k, await walk(v)])));
    }
    return node;
  };

  return walk(data);
}

function isStored(value) {
  return value.startsWith("/api/images/");
}

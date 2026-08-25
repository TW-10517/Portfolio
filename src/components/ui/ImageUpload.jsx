import { useRef, useState } from "react";
import { readImageFile } from "../../utils/exportImport.js";
import { useAuthStore } from "../../store/useAuthStore.js";
import { api } from "../../utils/api.js";
import { resolveImageUrl } from "../../utils/imageUrl.js";

export function ImageUpload({ value, onChange, label = "Image", round }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const token = useAuthStore((s) => s.token);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    // Clear the input up front so re-picking the same file still fires change.
    e.target.value = "";
    if (!file) return;
    // The old 2MB limit rejected ordinary phone photos. Uploads are now
    // downscaled on the way in, so the cap only needs to stop something
    // absurd being decoded in the browser.
    if (file.size > 12 * 1024 * 1024) {
      alert("Please choose an image under 12MB.");
      return;
    }
    setBusy(true);
    try {
      const downscaled = await readImageFile(file);
      onChange(await store(downscaled, token));
    } catch {
      alert("Sorry — that image couldn't be read. Try a different file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-14 h-14 shrink-0 bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-400 text-xs ${round ? "rounded-full" : "rounded-lg"}`}
      >
        {value ? <img src={resolveImageUrl(value)} alt={label} className="w-full h-full object-cover" /> : "—"}
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <input
          type="text"
          value={value?.startsWith("data:") || value?.startsWith("/api/images/") ? "" : value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste image URL…"
          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="text-xs text-cyan-400 hover:text-cyan-300 disabled:text-slate-600"
          >
            {busy ? "Processing…" : "Upload file"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="text-xs text-slate-400 hover:text-red-400">
              Clear
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}

// Hands the downscaled image to the server and keeps only the URL it returns.
//
// Inline base64 made every portfolio save re-upload every photo, and enough
// images pushed the document past the API's body limit with no way out. If the
// upload can't happen — offline, server down, an account whose storage is full
// — the inline copy is kept instead, so the editor never loses the picture
// someone just chose. Those still count against the document's size, which is
// why the size guard on the save path stays.
async function store(dataUrl, token) {
  if (!token || !dataUrl.startsWith("data:")) return dataUrl;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const { url } = await api.uploadImage(token, blob);
    return url;
  } catch {
    return dataUrl;
  }
}

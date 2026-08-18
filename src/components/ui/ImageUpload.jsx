import { useRef } from "react";
import { readImageFile } from "../../utils/exportImport.js";

export function ImageUpload({ value, onChange, label = "Image", round }) {
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Please choose an image under 2MB (stored locally in your browser).");
      return;
    }
    const dataUrl = await readImageFile(file);
    onChange(dataUrl);
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-14 h-14 shrink-0 bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-500 text-xs ${round ? "rounded-full" : "rounded-lg"}`}
      >
        {value ? <img src={value} alt={label} className="w-full h-full object-cover" /> : "—"}
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <input
          type="text"
          value={value?.startsWith("data:") ? "" : value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste image URL…"
          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Upload file
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="text-xs text-slate-500 hover:text-red-400">
              Clear
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}

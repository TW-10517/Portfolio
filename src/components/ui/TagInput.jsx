import { useState } from "react";

export function TagInput({ tags, onChange, placeholder = "Add and press Enter" }) {
  const [val, setVal] = useState("");

  const add = () => {
    const v = val.trim();
    if (!v) return;
    if (!tags.includes(v)) onChange([...tags, v]);
    setVal("");
  };

  const remove = (t) => onChange(tags.filter((x) => x !== t));

  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 bg-slate-800 border border-slate-600 rounded-full px-2.5 py-0.5 text-xs text-slate-200">
            {t}
            <button type="button" onClick={() => remove(t)} className="text-slate-400 hover:text-red-400 leading-none">
              &times;
            </button>
          </span>
        ))}
      </div>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && !val && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none px-1"
      />
    </div>
  );
}

import { useState } from "react";
import { Button } from "./Button.jsx";

export function StringListManager({ items, onChange, placeholder = "Add item" }) {
  const [val, setVal] = useState("");

  const add = () => {
    const v = val.trim();
    if (!v) return;
    onChange([...items, v]);
    setVal("");
  };

  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  const updateAt = (idx, v) => {
    const next = [...items];
    next[idx] = v;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={it}
            onChange={(e) => updateAt(idx, e.target.value)}
            className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
            aria-label="Remove"
          >
            &times;
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 rounded-lg bg-slate-900 border border-dashed border-slate-700 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-cyan-400"
        />
        <Button type="button" variant="subtle" size="sm" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

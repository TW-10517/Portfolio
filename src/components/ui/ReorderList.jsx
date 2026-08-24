import { useState } from "react";

/**
 * Generic drag-to-reorder list wrapper.
 * items: array of {id, ...}
 * renderItem: (item, index) => ReactNode
 * onReorder: (fromIndex, toIndex) => void
 * onRemove: (id) => void
 */
export function ReorderList({ items, renderItem, onReorder, onRemove, addLabel, onAdd }) {
  const [dragIndex, setDragIndex] = useState(null);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
            setDragIndex(null);
          }}
          className="relative rounded-xl bg-slate-900/60 border border-slate-700 p-4"
        >
          <div className="flex items-start gap-2">
            <span
              className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-300 select-none mt-1.5 shrink-0"
              title="Drag to reorder"
            >
              ⠿
            </span>
            <div className="flex-1 min-w-0">{renderItem(item, index)}</div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
              aria-label="Remove"
            >
              &times;
            </button>
          </div>
        </div>
      ))}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-xl border border-dashed border-slate-700 py-3 text-sm text-slate-400 hover:text-cyan-400 hover:border-cyan-400 transition"
        >
          + {addLabel || "Add item"}
        </button>
      )}
    </div>
  );
}

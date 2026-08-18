import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDefaultPortfolio } from "../data/defaults.js";

const DRAFT_KEY = "portfolio-builder:draft";
const PUBLISH_PREFIX = "portfolio-builder:published:";

export const usePortfolioStore = create(
  persist(
    (set, get) => ({
      data: createDefaultPortfolio(),
      lastSavedAt: null,

      update: (path, value) => {
        set((state) => {
          const next = structuredClone(state.data);
          setDeep(next, path, value);
          return { data: next, lastSavedAt: Date.now() };
        });
      },

      setAll: (data) => set({ data, lastSavedAt: Date.now() }),

      resetToDefaults: () => set({ data: createDefaultPortfolio(), lastSavedAt: Date.now() }),

      // --- list helpers (used by ListManager) ---
      addItem: (path, item) => {
        set((state) => {
          const next = structuredClone(state.data);
          const arr = getDeep(next, path) || [];
          arr.push(item);
          setDeep(next, path, arr);
          return { data: next, lastSavedAt: Date.now() };
        });
      },
      removeItem: (path, id) => {
        set((state) => {
          const next = structuredClone(state.data);
          const arr = (getDeep(next, path) || []).filter((i) => i.id !== id);
          setDeep(next, path, arr);
          return { data: next, lastSavedAt: Date.now() };
        });
      },
      updateItem: (path, id, patch) => {
        set((state) => {
          const next = structuredClone(state.data);
          const arr = getDeep(next, path) || [];
          const idx = arr.findIndex((i) => i.id === id);
          if (idx !== -1) arr[idx] = { ...arr[idx], ...patch };
          setDeep(next, path, arr);
          return { data: next, lastSavedAt: Date.now() };
        });
      },
      reorderItems: (path, fromIndex, toIndex) => {
        set((state) => {
          const next = structuredClone(state.data);
          const arr = getDeep(next, path) || [];
          const [moved] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, moved);
          setDeep(next, path, arr);
          return { data: next, lastSavedAt: Date.now() };
        });
      },

      // --- publish / share ---
      publish: (slug, visibility, password) => {
        const data = get().data;
        const snapshot = {
          data,
          visibility,
          password: visibility === "password" ? password : "",
          publishedAt: Date.now(),
          views: 0,
        };
        try {
          const existing = localStorage.getItem(PUBLISH_PREFIX + slug);
          if (existing) {
            const parsed = JSON.parse(existing);
            snapshot.views = parsed.views || 0;
          }
        } catch {}
        localStorage.setItem(PUBLISH_PREFIX + slug, JSON.stringify(snapshot));
        set((state) => ({
          data: { ...state.data, meta: { ...state.data.meta, slug, visibility } },
        }));
        return slug;
      },

      unpublish: (slug) => {
        localStorage.removeItem(PUBLISH_PREFIX + slug);
      },

      isPublished: (slug) => {
        return !!localStorage.getItem(PUBLISH_PREFIX + slug);
      },
    }),
    {
      name: DRAFT_KEY,
      partialize: (state) => ({ data: state.data }),
    }
  )
);

export function getPublished(slug) {
  try {
    const raw = localStorage.getItem(PUBLISH_PREFIX + slug);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function incrementViews(slug) {
  const raw = localStorage.getItem(PUBLISH_PREFIX + slug);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    parsed.views = (parsed.views || 0) + 1;
    localStorage.setItem(PUBLISH_PREFIX + slug, JSON.stringify(parsed));
  } catch {}
}

function setDeep(obj, path, value) {
  const keys = Array.isArray(path) ? path : path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function getDeep(obj, path) {
  const keys = Array.isArray(path) ? path : path.split(".");
  let cur = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

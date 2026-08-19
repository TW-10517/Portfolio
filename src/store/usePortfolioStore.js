import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDefaultPortfolio } from "../data/defaults.js";
import { api } from "../utils/api.js";

const DRAFT_KEY = "portfolio-builder:draft";

export const usePortfolioStore = create(
  persist(
    (set, get) => ({
      data: createDefaultPortfolio(),
      lastSavedAt: null, // last local edit (this browser)
      lastPublishedAt: null, // last successful push to the server

      update: (path, value) => {
        set((state) => {
          const next = structuredClone(state.data);
          setDeep(next, path, value);
          return { data: next, lastSavedAt: Date.now() };
        });
      },

      setAll: (data) => set({ data, lastSavedAt: Date.now() }),

      resetToDefaults: () => set({ data: createDefaultPortfolio(), lastSavedAt: Date.now() }),

      // Used on logout — this store's localStorage draft is per-browser, not
      // per-account, so without clearing it a second user signing into the
      // same browser could have their real server data blocked from loading
      // by loadFromServer's "keep the newer local draft" check treating the
      // previous user's leftover edits as if they were the new user's own.
      clearLocalDraft: () => set({ data: createDefaultPortfolio(), lastSavedAt: null, lastPublishedAt: null }),

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

      // --- server-backed publish / share ---
      // Saves the current draft to the signed-in user's portfolio row and
      // makes it reachable at /p/:slug according to visibility. Password
      // protection is enforced server-side (see server/routes/portfolio.js) —
      // the raw password is never persisted, client- or server-side.
      saveToServer: async (token, { slug, visibility, password }) => {
        const { portfolio } = await api.saveMine(token, { data: get().data, slug, visibility, password });
        const now = Date.now();
        set((state) => ({
          data: { ...state.data, meta: { slug: portfolio.slug, visibility: portfolio.visibility, views: portfolio.views } },
          lastSavedAt: now,
          lastPublishedAt: now,
        }));
        return portfolio;
      },

      // Pulls the signed-in user's last-saved portfolio from the server —
      // used on login/mount so editing continues across devices/browsers
      // instead of being tied to one browser's localStorage. Only actually
      // overwrites the local draft if the server's copy is newer: this runs
      // on every EditorPage mount (including plain page refreshes), and a
      // blind overwrite here previously meant any local edit made after the
      // last Publish was silently discarded the next time the page reloaded.
      loadFromServer: async (token) => {
        const { portfolio } = await api.getMine(token);
        if (!portfolio) return "no-server-copy";

        const serverUpdatedMs = portfolio.updated_at ? new Date(portfolio.updated_at.replace(" ", "T") + "Z").getTime() : 0;
        const localLastSavedAt = get().lastSavedAt;
        if (localLastSavedAt && localLastSavedAt >= serverUpdatedMs) {
          return "kept-local-draft";
        }

        const stamp = serverUpdatedMs || Date.now();
        set({
          data: { ...portfolio.data, meta: { slug: portfolio.slug, visibility: portfolio.visibility, views: portfolio.views } },
          lastSavedAt: stamp,
          lastPublishedAt: stamp,
        });
        return "loaded-server-copy";
      },
    }),
    {
      name: DRAFT_KEY,
      // lastSavedAt must survive reloads too — it's what lets loadFromServer
      // tell a fresh device (no local draft yet) apart from a page refresh
      // with unpublished local edits (don't clobber those).
      partialize: (state) => ({ data: state.data, lastSavedAt: state.lastSavedAt, lastPublishedAt: state.lastPublishedAt }),
    }
  )
);

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

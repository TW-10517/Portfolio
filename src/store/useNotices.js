import { create } from "zustand";

// Transient messages for things that went wrong while the user was doing
// something — a file we couldn't read, a limit they hit.
//
// These were window.alert(). An alert freezes the page until it's dismissed,
// can't be styled, reads as a browser-level failure rather than something this
// app is telling you, and in some browsers is suppressed entirely — which
// turns "here's why nothing happened" into nothing happening.
let nextId = 0;

// Long enough to read a sentence without hunting for a close button; short
// enough that a stack of them doesn't pile up.
export const NOTICE_TTL_MS = 6000;

export const useNotices = create((set, get) => ({
  notices: [],

  notify: (message, { tone = "error", ttl = NOTICE_TTL_MS } = {}) => {
    const id = ++nextId;
    set((s) => ({ notices: [...s.notices, { id, message, tone }] }));
    if (ttl > 0) setTimeout(() => get().dismiss(id), ttl);
    return id;
  },

  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),

  clear: () => set({ notices: [] }),
}));

// A plain function so callers that aren't components (or that would rather not
// take a hook) can still report something.
export const notify = (message, options) => useNotices.getState().notify(message, options);

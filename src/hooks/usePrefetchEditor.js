import { useEffect } from "react";

// Downloads the editor while the visitor is still filling in the form.
//
// The editor is a lazy route, so its chunks — about 300KB of it — were not
// requested until after registration or login had already succeeded. Measured
// on mobile data that was 1.6 seconds of downloading, on the critical path,
// starting from a standing start at the exact moment the user was waiting to
// see something.
//
// Whereas typing a name, an email and a password takes several seconds during
// which the connection is doing nothing at all. Starting the fetch on mount
// moves the whole download into that window.
//
// Deliberately fire-and-forget: this is a speculative fetch, and if it fails
// the normal lazy import will simply try again when the route actually
// renders. The idle callback keeps it from competing with the login page's
// own first paint.
export function usePrefetchEditor() {
  useEffect(() => {
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      import("../pages/EditorPage.jsx").catch(() => {});
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 1500 })
      : setTimeout(warm, 300);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, []);
}

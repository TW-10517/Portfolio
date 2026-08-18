import { useEffect, useState } from "react";

export function useActiveSection(ids, rootEl) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root: rootEl || null, threshold: [0.25, 0.5, 0.75], rootMargin: "-15% 0px -55% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids.join(","), rootEl]);

  return active;
}

export function useScrolledState(threshold = 20, rootEl) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const target = rootEl || window;
    const handler = () => {
      const y = rootEl ? rootEl.scrollTop : window.scrollY;
      setScrolled(y > threshold);
    };
    handler();
    target.addEventListener("scroll", handler, { passive: true });
    return () => target.removeEventListener("scroll", handler);
  }, [rootEl, threshold]);
  return scrolled;
}

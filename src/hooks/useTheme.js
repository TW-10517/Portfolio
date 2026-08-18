import { useEffect, useState } from "react";

export function useEffectiveMode(mode) {
  const [systemDark, setSystemDark] = useState(true);

  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

const injected = new Set();

export function useGoogleFonts(headingFont, bodyFont) {
  useEffect(() => {
    const families = Array.from(new Set([headingFont, bodyFont])).filter(Boolean);
    const key = families.join("|");
    if (injected.has(key)) return;
    const href =
      "https://fonts.googleapis.com/css2?" +
      families.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&") +
      "&display=swap";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    injected.add(key);
  }, [headingFont, bodyFont]);
}

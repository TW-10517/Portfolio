import { createContext, useContext } from "react";

export const PortfolioThemeContext = createContext(null);

export function usePortfolioTheme() {
  const ctx = useContext(PortfolioThemeContext);
  if (!ctx) throw new Error("usePortfolioTheme must be used within PortfolioView");
  return ctx;
}

export function buildPalette(mode) {
  if (mode === "light") {
    return {
      bg: "#f6f7fb",
      surface: "#ffffff",
      surface2: "#eef0f7",
      border: "rgba(10,12,30,0.08)",
      text: "#12131c",
      textDim: "#4a4d63",
      textFaint: "#8589a0",
    };
  }
  return {
    bg: "#06070d",
    surface: "#12141f",
    surface2: "#181b29",
    border: "rgba(255,255,255,0.08)",
    text: "#f4f5f8",
    textDim: "#a7abc0",
    textFaint: "#6b7086",
  };
}

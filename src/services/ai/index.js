import { LocalProvider } from "./LocalProvider.js";
import { GeminiProvider } from "./GeminiProvider.js";

const API_KEY_STORAGE_KEY = "portfolio-builder:geminiApiKey";

export function getGeminiApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
}

export function setGeminiApiKey(key) {
  if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key);
  else localStorage.removeItem(API_KEY_STORAGE_KEY);
}

// "auto" uses Gemini only if the user has explicitly saved a key; otherwise
// it always falls back to the free, local, offline provider. Nothing here
// ever requires payment or a mandatory API key.
export function getAIProvider(preferred = "auto") {
  if (preferred === "local") return new LocalProvider();
  const key = getGeminiApiKey();
  if ((preferred === "gemini" || preferred === "auto") && key) return new GeminiProvider(key);
  return new LocalProvider();
}

export { LocalProvider, GeminiProvider };

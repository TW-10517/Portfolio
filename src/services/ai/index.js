import { LocalProvider } from "./LocalProvider.js";
import { GeminiProvider } from "./GeminiProvider.js";
import { OllamaProvider, listOllamaModels, DEFAULT_OLLAMA_URL } from "./OllamaProvider.js";

const API_KEY_STORAGE_KEY = "portfolio-builder:geminiApiKey";
const OLLAMA_MODEL_KEY = "portfolio-builder:ollamaModel";
const OLLAMA_URL_KEY = "portfolio-builder:ollamaUrl";

export function getGeminiApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
}

export function setGeminiApiKey(key) {
  if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key);
  else localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function getOllamaModel() {
  return localStorage.getItem(OLLAMA_MODEL_KEY) || "";
}

export function setOllamaModel(model) {
  if (model) localStorage.setItem(OLLAMA_MODEL_KEY, model);
  else localStorage.removeItem(OLLAMA_MODEL_KEY);
}

export function getOllamaUrl() {
  return localStorage.getItem(OLLAMA_URL_KEY) || DEFAULT_OLLAMA_URL;
}

export function setOllamaUrl(url) {
  if (url && url !== DEFAULT_OLLAMA_URL) localStorage.setItem(OLLAMA_URL_KEY, url);
  else localStorage.removeItem(OLLAMA_URL_KEY);
}

// "auto" prefers a real LLM running on the user's own machine (Ollama), then
// a user-supplied cloud key, then the always-available offline template
// writer. Ollama comes first deliberately: it's a genuine LLM that costs
// nothing, needs no account, and never sends the user's portfolio off the
// machine. Nothing here ever requires payment or a mandatory API key.
export function getAIProvider(preferred = "auto") {
  if (preferred === "local") return new LocalProvider();

  const ollamaModel = getOllamaModel();
  if ((preferred === "ollama" || preferred === "auto") && ollamaModel) {
    return new OllamaProvider(ollamaModel, getOllamaUrl());
  }

  const key = getGeminiApiKey();
  if ((preferred === "gemini" || preferred === "auto") && key) return new GeminiProvider(key);

  return new LocalProvider();
}

// True only for the instant, offline template writer. The UI uses this to
// decide how aggressively it may rebuild on each keystroke — an actual LLM
// (local or cloud) takes seconds per scene and must not be re-run that fast.
export function isInstantProvider(provider) {
  return provider instanceof LocalProvider;
}

export { LocalProvider, GeminiProvider, OllamaProvider, listOllamaModels, DEFAULT_OLLAMA_URL };

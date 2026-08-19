// Thin wrapper around the browser's built-in SpeechSynthesis API — the free,
// zero-setup TTS engine. Quality/voice availability varies by OS/browser;
// callers should treat isSupported() as a hard gate and never assume a
// specific voice exists.

export function isTTSSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedVoices = [];

export function getVoices() {
  return new Promise((resolve) => {
    if (!isTTSSupported()) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      cachedVoices = existing;
      return resolve(existing);
    }
    const onChange = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = null;
      resolve(cachedVoices);
    };
    window.speechSynthesis.onvoiceschanged = onChange;
    // Some browsers never fire the event if there's nothing new — bail out.
    setTimeout(() => {
      if (!cachedVoices.length) {
        cachedVoices = window.speechSynthesis.getVoices();
        resolve(cachedVoices);
      }
    }, 1000);
  });
}

export function speak(text, { voice, rate = 1, pitch = 1, volume = 1 } = {}) {
  return new Promise((resolve, reject) => {
    if (!isTTSSupported()) return reject(new Error("Speech synthesis isn't supported in this browser."));
    if (!text?.trim()) return resolve();
    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.rate = rate;
    utter.pitch = pitch;
    utter.volume = volume;
    utter.onend = () => resolve();
    utter.onerror = (e) => (e.error === "canceled" || e.error === "interrupted" ? resolve() : reject(new Error(e.error || "Speech synthesis failed.")));
    window.speechSynthesis.speak(utter);
  });
}

export function cancelSpeech() {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}

export const SPEED_RATES = { slow: 0.8, normal: 1, fast: 1.2 };

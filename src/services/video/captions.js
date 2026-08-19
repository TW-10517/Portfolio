// Builds caption cues from narration text + the scene's planned duration —
// no speech recognition needed, since we already generated the text and know
// how long the scene runs.
export function buildCaptionCues(text, durationSeconds, chunkSize = 6) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  const per = durationSeconds / chunks.length;
  return chunks.map((chunkText, i) => ({ start: i * per, end: (i + 1) * per, text: chunkText }));
}

export function captionAt(cues, tSeconds) {
  return cues.find((c) => tSeconds >= c.start && tSeconds < c.end)?.text || "";
}

export function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

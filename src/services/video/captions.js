import { tokenizeForWrap, joinTokens, isSpacelessToken } from "../../utils/textMetrics.js";

// Builds caption cues from narration text + the scene's planned duration —
// no speech recognition needed, since we already generated the text and know
// how long the scene runs.
export function buildCaptionCues(text, durationSeconds, chunkSize = 6) {
  // Tokenised, not whitespace-split: a Japanese line has no spaces, so
  // splitting on them produced a single caption covering the whole scene.
  const tokens = tokenizeForWrap(text);
  if (!tokens.length) return [];
  // A spaceless script fits far more characters per caption than it does
  // Latin words, so scale the chunk to keep captions a readable length.
  const perChunk = isSpacelessToken(tokens[0]) ? chunkSize * 2 : chunkSize;
  const chunks = [];
  for (let i = 0; i < tokens.length; i += perChunk) {
    chunks.push(joinTokens(tokens.slice(i, i + perChunk)));
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

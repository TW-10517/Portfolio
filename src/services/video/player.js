import { drawScene, buildImageBundle } from "./sceneRenderer.js";
import { buildCaptionCues, captionAt } from "./captions.js";
import { speak, cancelSpeech, isTTSSupported } from "./tts.js";

const CANVAS_W = 1280;
const CANVAS_H = 720;

function wait(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

export function totalDuration(scenePlan) {
  return scenePlan.scenes.reduce((sum, s) => sum + s.duration, 0) || 1;
}

// Chrome's speechSynthesis has a long-standing bug where a tab losing focus
// (or just enough time passing) silently pauses the engine and it never
// resumes on its own — speak() calls after that point queue forever with no
// error and no onend. Nudging resume() periodically is the standard
// workaround. This never blocks visual playback either way, since scene
// advancement is timed independently below — it only protects the audio.
function startSpeechKeepAlive() {
  if (!isTTSSupported()) return () => {};
  const id = setInterval(() => {
    if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 4000);
  return () => clearInterval(id);
}

// Plays scenePlan[startIndex:] onto `canvas`, calling narration TTS per scene
// (unless muted) and reporting progress via callbacks. Used by both the live
// Preview player and the Export recorder, so what you preview is what you get.
// `onProgress`'s overallT/elapsed accounts for the full plan (including
// skipped leading scenes), so the timeline stays correct when resuming from
// a seek rather than always starting from scene 0.
export async function playScenePlan(
  canvas,
  scenePlan,
  data,
  { theme, voice, rate, mute = false, showCaptions = true, startIndex = 0, onScene, onCaption, onProgress, signal } = {}
) {
  // Defensive: clear out any stuck/zombie utterance queue from a previous
  // run before this one starts, regardless of how that run ended.
  if (!mute) cancelSpeech();
  const stopKeepAlive = mute ? () => {} : startSpeechKeepAlive();

  try {
    const ctx = canvas.getContext("2d");
    const images = await buildImageBundle(scenePlan, data);
    const totalSeconds = totalDuration(scenePlan);
    let elapsedBefore = scenePlan.scenes.slice(0, startIndex).reduce((sum, s) => sum + s.duration, 0);

    for (const scene of scenePlan.scenes.slice(startIndex)) {
      if (signal?.aborted) return;
      onScene?.(scene);
      const cues = buildCaptionCues(scene.text, scene.duration);

      if (!mute && isTTSSupported() && scene.text) {
        speak(scene.text, { voice, rate }).catch(() => {});
      }

      const start = performance.now();
      const durationMs = scene.duration * 1000;

      await new Promise((resolve) => {
        let raf;
        const frame = () => {
          if (signal?.aborted) return resolve();
          const elapsed = performance.now() - start;
          const t = Math.min(1, elapsed / durationMs);
          const caption = showCaptions ? captionAt(cues, elapsed / 1000) : "";
          onCaption?.(caption);
          onProgress?.({ sceneT: t, overallT: Math.min(1, (elapsedBefore + elapsed / 1000) / totalSeconds) });
          drawScene(ctx, { width: CANVAS_W, height: CANVAS_H, scene, data, theme, images, captionText: caption, t });
          if (elapsed < durationMs) {
            raf = requestAnimationFrame(frame);
          } else {
            resolve();
          }
        };
        raf = requestAnimationFrame(frame);
        // Canceling the pending frame stops it from ever running again — but
        // resolve() only ever gets called *from inside* frame(). Without
        // calling it here too, aborting mid-scene (i.e. every normal use of
        // the Stop button, or a seek) leaves this promise — and the whole
        // playback chain awaiting it — permanently pending. This was the
        // actual cause of playback getting stuck after the first Stop/seek.
        signal?.addEventListener(
          "abort",
          () => {
            cancelAnimationFrame(raf);
            resolve();
          },
          { once: true }
        );
      });

      elapsedBefore += scene.duration;
      if (!mute) cancelSpeech();
      await wait(120, signal); // brief beat between scenes
    }
  } finally {
    stopKeepAlive();
  }
}

export function drawFirstFrame(canvas, scenePlan, data, theme) {
  renderAtScene(canvas, scenePlan, data, theme, 0);
}

// Draws a single static frame for scene[index] — used for the idle/paused
// state and while scrubbing the timeline (no audio, no animation loop).
export function renderAtScene(canvas, scenePlan, data, theme, index = 0, t = 0.5) {
  if (!scenePlan?.scenes?.length || !canvas) return;
  const scene = scenePlan.scenes[Math.min(index, scenePlan.scenes.length - 1)];
  buildImageBundle(scenePlan, data).then((images) => {
    const ctx = canvas.getContext("2d");
    drawScene(ctx, { width: CANVAS_W, height: CANVAS_H, scene, data, theme, images, captionText: "", t });
  });
}

// Maps an overall time position (seconds) to a scene index — used by the
// timeline scrubber. Seeking snaps to scene boundaries rather than exact
// sub-second precision, since narration can't be resumed mid-utterance.
export function sceneIndexAtPosition(scenePlan, positionSeconds) {
  let acc = 0;
  for (let i = 0; i < scenePlan.scenes.length; i++) {
    acc += scenePlan.scenes[i].duration;
    if (positionSeconds < acc) return i;
  }
  return scenePlan.scenes.length - 1;
}

export function sceneStartTime(scenePlan, index) {
  return scenePlan.scenes.slice(0, index).reduce((sum, s) => sum + s.duration, 0);
}

export const CANVAS_SIZE = { width: CANVAS_W, height: CANVAS_H };

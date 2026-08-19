import { playScenePlan } from "./player.js";

function pickSupportedMimeType() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((c) => window.MediaRecorder?.isTypeSupported?.(c)) || "video/webm";
}

// Records the full scene plan into a downloadable Blob. Everything happens
// client-side: canvas.captureStream() for video, and — if the browser
// supports it and the user grants permission — getDisplayMedia's tab-audio
// capture to include the spoken narration. If audio capture isn't available
// or the user declines, the export still succeeds, just without narration
// audio (the on-screen captions still carry the script).
export async function recordScenePlan(canvas, scenePlan, data, { theme, voice, rate, showCaptions = true, withAudio = true, onProgress } = {}) {
  if (!window.MediaRecorder || !canvas.captureStream) {
    throw new Error("This browser doesn't support in-browser video recording.");
  }

  const videoStream = canvas.captureStream(30);
  let displayStream = null;
  let audioIncluded = false;
  if (withAudio && navigator.mediaDevices?.getDisplayMedia) {
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      displayStream.getVideoTracks().forEach((t) => t.stop());
      audioIncluded = displayStream.getAudioTracks().length > 0;
    } catch {
      displayStream = null; // user declined the share prompt — continue without audio
    }
  }

  const tracks = [...videoStream.getVideoTracks(), ...(displayStream ? displayStream.getAudioTracks() : [])];
  const combined = new MediaStream(tracks);
  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(combined, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));

  recorder.start(250);

  const total = scenePlan.scenes.length;
  let index = 0;
  await playScenePlan(canvas, scenePlan, data, {
    theme,
    voice,
    rate,
    mute: !audioIncluded, // no point speaking if nothing can capture it, and it'd distract the user
    showCaptions,
    onScene: () => onProgress?.({ index: index++, total }),
  });

  recorder.stop();
  if (displayStream) displayStream.getTracks().forEach((t) => t.stop());
  await stopped;

  return { blob: new Blob(chunks, { type: mimeType }), audioIncluded, mimeType };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

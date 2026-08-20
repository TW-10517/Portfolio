import { playScenePlan } from "./player.js";

// MP4 (H.264 + AAC) first, because that's what video editors, phones, and
// upload forms accept without conversion; WebM is the fallback for browsers
// whose MediaRecorder can't mux MP4. Ordered most- to least-compatible
// within each container.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // H.264 baseline + AAC — the widest-compatibility combo
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickSupportedMimeType() {
  return MIME_CANDIDATES.find((c) => window.MediaRecorder?.isTypeSupported?.(c)) || "video/webm";
}

// The download filename has to match what was actually recorded — handing
// someone an MP4 named ".webm" makes players and upload forms reject a
// perfectly good file.
export function fileExtensionForMimeType(mimeType) {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

export function containerLabel(mimeType) {
  return mimeType.startsWith("video/mp4") ? "MP4" : "WebM";
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
  // A granted audio track is NOT proof that narration was captured: which
  // surface the user picked decides whether the speech engine's output is in
  // it at all (sharing a tab often isn't enough, since speechSynthesis plays
  // through the OS rather than the page). Watch the real signal level so the
  // finished export can tell the user what actually happened instead of
  // assuming a track means sound.
  const audioMonitor = displayStream ? startAudioMonitor(displayStream) : null;
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
  const heardSound = audioMonitor ? audioMonitor.stop() : false;
  if (displayStream) displayStream.getTracks().forEach((t) => t.stop());
  await stopped;

  return {
    blob: new Blob(chunks, { type: mimeType }),
    audioIncluded,
    // audioIncluded says a track was recorded; audioHadSound says that track
    // was not silence. They differ exactly when the user shared a surface
    // that carries no narration, which is the case worth warning about.
    audioHadSound: heardSound,
    mimeType,
  };
}

// Runs an analyser over the captured audio and reports whether anything
// above the noise floor was ever heard. Purely observational — it never
// touches the stream being recorded.
function startAudioMonitor(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || !stream.getAudioTracks().length) return null;
  let ctx;
  try {
    ctx = new AudioCtx();
  } catch {
    return null;
  }
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);
  let peak = 0;
  const id = setInterval(() => {
    analyser.getFloatTimeDomainData(buffer);
    for (let i = 0; i < buffer.length; i++) {
      const level = Math.abs(buffer[i]);
      if (level > peak) peak = level;
    }
  }, 200);
  return {
    stop() {
      clearInterval(id);
      ctx.close().catch(() => {});
      return peak > 0.01; // comfortably above digital-silence dither
    },
  };
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

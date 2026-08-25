import { drawScene, buildImageBundle } from "./sceneRenderer.js";
import { buildCaptionCues, captionAt } from "./captions.js";
import { CANVAS_SIZE } from "./player.js";

// Encoding the video without playing it.
//
// The MediaRecorder path records the canvas as it plays, so exporting a
// 77-second video took 77 seconds — the wait is the length of the film, and
// nothing about the machine can shorten it. That is inherent to
// MediaRecorder: it timestamps frames by wall clock, so frames pushed faster
// than real time simply produce a shorter video.
//
// WebCodecs doesn't work that way. Each frame carries the timestamp we give
// it, so the encoder can run as fast as frames can be drawn while the output
// still plays back at the right speed. Drawing a frame here measures well
// under a millisecond, which makes the export bound by encoding rather than
// by patience.
//
// What this path cannot do is narration: speech is real-time by nature and
// speechSynthesis output can't be captured programmatically anyway. So this is
// the silent export, and the recorder stays for the case where someone shares
// their tab audio to get sound.

const FPS = 30;
const BITRATE = 5_000_000;

// A keyframe every two seconds: often enough to scrub and to survive a
// truncated download, rare enough not to bloat the file.
const KEYFRAME_INTERVAL = FPS * 2;

// Kept ahead of the encoder but not unboundedly — every queued frame is a
// full uncompressed image held in memory, and 1280x720 RGBA is 3.7MB each.
const MAX_QUEUE = 12;

export function canFastExport() {
  return (
    typeof window !== "undefined" &&
    typeof window.VideoEncoder === "function" &&
    typeof window.VideoFrame === "function"
  );
}

// H.264 in MP4 is what plays everywhere without explanation — the point of the
// export is a file someone can attach to an application or post to LinkedIn.
// The others are here so a browser missing H.264 still gets something.
const CODECS = [
  { codec: "avc1.42001f", muxer: "avc", mime: "video/mp4", label: "MP4" },
  { codec: "avc1.4d0028", muxer: "avc", mime: "video/mp4", label: "MP4" },
  { codec: "vp09.00.10.08", muxer: "vp9", mime: "video/mp4", label: "MP4" },
];

export async function pickCodec(width, height) {
  if (!canFastExport()) return null;
  for (const candidate of CODECS) {
    try {
      const support = await window.VideoEncoder.isConfigSupported({
        codec: candidate.codec,
        width,
        height,
        bitrate: BITRATE,
        framerate: FPS,
      });
      if (support?.supported) return candidate;
    } catch {
      // An unrecognised codec string throws rather than reporting false.
    }
  }
  return null;
}

export async function encodeScenePlan(
  canvas,
  scenePlan,
  data,
  { theme, showCaptions = true, onProgress, signal } = {}
) {
  const width = canvas.width || CANVAS_SIZE.width;
  const height = canvas.height || CANVAS_SIZE.height;
  const chosen = await pickCodec(width, height);
  if (!chosen) throw new Error("This browser can't encode video without recording it.");

  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: chosen.muxer, width, height },
    // The file is assembled in memory and handed straight to a download, so
    // the index belongs at the front — otherwise players have to fetch the
    // whole thing before they can start.
    fastStart: "in-memory",
  });

  let encodeError = null;
  const encoder = new window.VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });
  encoder.configure({ codec: chosen.codec, width, height, bitrate: BITRATE, framerate: FPS });

  const ctx = canvas.getContext("2d");
  const images = await buildImageBundle(scenePlan, data);
  const totalFrames = scenePlan.scenes.reduce((sum, s) => sum + Math.round(s.duration * FPS), 0);

  let frameIndex = 0;
  try {
    for (const [sceneIndex, scene] of scenePlan.scenes.entries()) {
      const cues = buildCaptionCues(scene.text, scene.duration);
      const sceneFrames = Math.round(scene.duration * FPS);

      for (let f = 0; f < sceneFrames; f += 1) {
        if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
        if (encodeError) throw encodeError;

        const seconds = f / FPS;
        drawScene(ctx, {
          width,
          height,
          scene,
          data,
          theme,
          images,
          captionText: showCaptions ? captionAt(cues, seconds) : "",
          // Scene progress, the same value the live player passes, so the
          // animations land identically in the file and on screen.
          t: sceneFrames > 1 ? f / (sceneFrames - 1) : 1,
        });

        const frame = new window.VideoFrame(canvas, {
          // Microseconds, and explicit — this is what decouples how long
          // encoding takes from how long the video runs.
          timestamp: Math.round((frameIndex * 1_000_000) / FPS),
          duration: Math.round(1_000_000 / FPS),
        });
        encoder.encode(frame, { keyFrame: frameIndex % KEYFRAME_INTERVAL === 0 });
        frame.close();
        frameIndex += 1;

        if (encoder.encodeQueueSize > MAX_QUEUE) {
          // Yielding also lets the progress bar paint; without it the whole
          // export is one long task and the tab looks hung.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      onProgress?.({ index: sceneIndex, total: scenePlan.scenes.length, frames: frameIndex, totalFrames });
    }

    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
  } finally {
    // close() throws if the encoder is already closed, and we don't want that
    // masking whatever actually went wrong.
    try {
      if (encoder.state !== "closed") encoder.close();
    } catch {
      /* already gone */
    }
  }

  return {
    blob: new Blob([target.buffer], { type: chosen.mime }),
    mimeType: chosen.mime,
    label: chosen.label,
    frames: frameIndex,
  };
}

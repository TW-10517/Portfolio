import { afterEach, describe, expect, it } from "vitest";
import { pickSupportedMimeType, fileExtensionForMimeType, containerLabel } from "./exportVideo.js";

// Stands in for a browser whose MediaRecorder only supports `supported`.
function mockRecorderSupport(supported) {
  globalThis.window = { MediaRecorder: { isTypeSupported: (t) => supported.includes(t) } };
}

afterEach(() => {
  delete globalThis.window;
});

describe("pickSupportedMimeType", () => {
  it("prefers MP4 over WebM when the browser can mux both", () => {
    mockRecorderSupport(["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm"]);
    expect(pickSupportedMimeType()).toBe("video/mp4;codecs=avc1.42E01E,mp4a.40.2");
  });

  it("prefers H.264 + AAC over a bare mp4 type", () => {
    mockRecorderSupport(["video/mp4", "video/mp4;codecs=avc1.42E01E,mp4a.40.2"]);
    expect(pickSupportedMimeType()).toBe("video/mp4;codecs=avc1.42E01E,mp4a.40.2");
  });

  it("falls back to WebM when MP4 recording isn't available", () => {
    mockRecorderSupport(["video/webm;codecs=vp9,opus", "video/webm"]);
    expect(pickSupportedMimeType()).toBe("video/webm;codecs=vp9,opus");
  });

  it("falls back to plain WebM when nothing is reported as supported", () => {
    mockRecorderSupport([]);
    expect(pickSupportedMimeType()).toBe("video/webm");
  });

  it("doesn't throw when MediaRecorder is missing entirely", () => {
    globalThis.window = {};
    expect(pickSupportedMimeType()).toBe("video/webm");
  });
});

describe("fileExtensionForMimeType", () => {
  // Naming an MP4 ".webm" makes players and upload forms reject a valid file,
  // so the extension must track what was actually recorded.
  it("maps every mp4 variant to .mp4", () => {
    expect(fileExtensionForMimeType("video/mp4")).toBe("mp4");
    expect(fileExtensionForMimeType("video/mp4;codecs=avc1.42E01E,mp4a.40.2")).toBe("mp4");
  });

  it("maps webm variants to .webm", () => {
    expect(fileExtensionForMimeType("video/webm")).toBe("webm");
    expect(fileExtensionForMimeType("video/webm;codecs=vp9,opus")).toBe("webm");
  });
});

describe("containerLabel", () => {
  it("labels each container for the UI", () => {
    expect(containerLabel("video/mp4;codecs=avc1")).toBe("MP4");
    expect(containerLabel("video/webm;codecs=vp8,opus")).toBe("WebM");
  });
});

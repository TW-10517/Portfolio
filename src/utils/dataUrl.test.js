// Node's environment, not jsdom: jsdom's Blob has neither arrayBuffer() nor
// text(), so the assertions that matter here — that the bytes come out
// unchanged — cannot be made against it at all.
import { describe, expect, it } from "vitest";
import { dataUrlToBlob } from "./dataUrl.js";

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

describe("dataUrlToBlob", () => {
  it("keeps the media type", async () => {
    const blob = dataUrlToBlob("data:image/jpeg;base64,/9j/4AAQ");
    expect(blob.type).toBe("image/jpeg");
  });

  it("decodes binary bytes exactly", async () => {
    // The bytes that matter: everything above 0x7f is what a string-based
    // round trip would silently re-encode as UTF-8 and corrupt.
    const original = new Uint8Array([0x00, 0x7f, 0x80, 0xff, 0xd8, 0xff]);
    const b64 = Buffer.from(original).toString("base64");
    expect(await bytesOf(dataUrlToBlob(`data:image/jpeg;base64,${b64}`))).toEqual(original);
  });

  it("survives a real canvas-sized payload unchanged", async () => {
    const original = new Uint8Array(100_000).map((_, i) => (i * 37) % 256);
    const b64 = Buffer.from(original).toString("base64");
    expect(await bytesOf(dataUrlToBlob(`data:image/png;base64,${b64}`))).toEqual(original);
  });

  it("handles the percent-encoded form too", async () => {
    const blob = dataUrlToBlob("data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E");
    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toBe("<svg></svg>");
  });

  it("ignores parameters after the media type", async () => {
    const blob = dataUrlToBlob("data:text/plain;charset=utf-8,hi");
    expect(blob.type).toBe("text/plain");
  });

  it("refuses anything that isn't one", () => {
    expect(() => dataUrlToBlob("https://example.com/a.png")).toThrow(TypeError);
    expect(() => dataUrlToBlob("data:image/png;base64")).toThrow(TypeError);
    expect(() => dataUrlToBlob(null)).toThrow(TypeError);
  });
});

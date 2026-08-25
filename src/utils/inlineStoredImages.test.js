// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { inlineStoredImages } from "./exportImport.js";

const resolve = (url) => `http://api.test${url}`;

// A fetch that hands back a one-pixel PNG for any stored image.
const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
// A plain function, not a vi.fn: wrapping an existing mock in vi.fn() hands
// back the same spy, so call counts leaked between tests.
const okFetch = async () => ({ ok: true, blob: async () => new Blob([bytes], { type: "image/png" }) });

describe("inlineStoredImages", () => {
  it("replaces a stored image with its bytes, wherever it is nested", async () => {
    const fetchImpl = vi.fn(okFetch);
    const out = await inlineStoredImages(
      {
        profile: { name: "Ada", photo: "/api/images/aaa.png" },
        projects: [{ images: ["/api/images/bbb.png"] }],
      },
      resolve,
      fetchImpl
    );
    expect(out.profile.photo).toMatch(/^data:image\/png;base64,/);
    expect(out.projects[0].images[0]).toMatch(/^data:image\/png;base64,/);
    expect(out.profile.name).toBe("Ada");
  });

  it("leaves URLs the author typed alone", async () => {
    const fetchImpl = vi.fn(okFetch);
    const out = await inlineStoredImages(
      { profile: { photo: "https://cdn.test/x.png" }, about: { summary: "/api/nope" } },
      resolve,
      fetchImpl
    );
    expect(out.profile.photo).toBe("https://cdn.test/x.png");
    expect(out.about.summary).toBe("/api/nope");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fetches an image used twice only once", async () => {
    const fetchImpl = vi.fn(okFetch);
    await inlineStoredImages(
      { a: "/api/images/same.png", b: "/api/images/same.png" },
      resolve,
      fetchImpl
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps the URL rather than failing the whole export", async () => {
    // A missing or unreachable image should cost you that one picture, not the
    // file you were trying to save.
    const fetchImpl = vi.fn(async () => ({ ok: false }));
    const out = await inlineStoredImages({ photo: "/api/images/gone.png" }, resolve, fetchImpl);
    expect(out.photo).toBe("/api/images/gone.png");

    const throwing = vi.fn(async () => {
      throw new Error("offline");
    });
    const out2 = await inlineStoredImages({ photo: "/api/images/gone.png" }, resolve, throwing);
    expect(out2.photo).toBe("/api/images/gone.png");
  });

  it("survives nulls and numbers in the document", async () => {
    const out = await inlineStoredImages({ a: null, b: 3, c: [null, "x"] }, resolve, vi.fn(okFetch));
    expect(out).toEqual({ a: null, b: 3, c: [null, "x"] });
  });
});

import { describe, it, expect } from "vitest";
import { buildPreviewHtml, previewMetadata, escapeHtml } from "./preview.js";

const publicPortfolio = (profile, about) => ({
  slug: "alex",
  visibility: "public",
  data: { profile, about },
});

const html = (portfolio, slug = "alex") =>
  buildPreviewHtml({
    portfolio,
    slug,
    appUrl: "https://app.example.com",
    canonicalUrl: "https://api.example.com/p/alex",
  });

describe("previewMetadata", () => {
  it("names the person and their first role", () => {
    const meta = previewMetadata(
      publicPortfolio({ name: "Alex Rivera", roles: "Software Engineer, Data Enthusiast" })
    );
    expect(meta.title).toBe("Alex Rivera — Software Engineer");
  });

  it("prefers the tagline, then the about summary, then the roles", () => {
    const p = { name: "A", roles: "Engineer, Designer" };
    expect(previewMetadata(publicPortfolio({ ...p, tagline: "Tagline wins" })).description).toContain(
      "Tagline wins"
    );
    expect(previewMetadata(publicPortfolio(p, { summary: "Summary next" })).description).toContain(
      "Summary next"
    );
    expect(previewMetadata(publicPortfolio(p)).description).toContain("Engineer · Designer");
  });

  it("turns an uploaded image into an absolute URL on this server", () => {
    const hash = "a".repeat(64);
    const meta = previewMetadata(publicPortfolio({ photo: `/api/images/${hash}.webp` }), "https://api.example.com");
    expect(meta.image).toBe(`https://api.example.com/api/images/${hash}.webp`);
  });

  it("ignores a relative path that isn't a stored image", () => {
    // Otherwise og:image becomes a way to point a crawler at any path on this
    // server that the author feels like naming.
    expect(previewMetadata(publicPortfolio({ photo: "/etc/passwd" }), "https://api.example.com").image).toBeNull();
    expect(previewMetadata(publicPortfolio({ photo: "/api/images/../../secret" }), "https://x").image).toBeNull();
  });

  it("uses an http image but never an inline data URL", () => {
    expect(previewMetadata(publicPortfolio({ photo: "https://cdn/x.png" })).image).toBe("https://cdn/x.png");
    // Every crawler drops these, so emitting one is worse than emitting none:
    // it produces a card with a broken image slot instead of a text card.
    expect(previewMetadata(publicPortfolio({ photo: "data:image/png;base64,AAA" })).image).toBeNull();
  });

  it("tells a private portfolio apart from nothing at all in no way whatsoever", () => {
    const priv = previewMetadata({ ...publicPortfolio({ name: "Secret Person" }), visibility: "private" });
    const pwd = previewMetadata({ ...publicPortfolio({ name: "Secret Person" }), visibility: "password" });
    const missing = previewMetadata(null);
    expect(priv).toEqual(missing);
    expect(pwd).toEqual(missing);
    expect(JSON.stringify(priv)).not.toContain("Secret Person");
  });

  it("clamps a runaway description", () => {
    const meta = previewMetadata(publicPortfolio({ name: "A", tagline: "word ".repeat(200) }));
    expect(meta.description.length).toBeLessThanOrEqual(201);
    expect(meta.description.endsWith("…")).toBe(true);
  });
});

describe("buildPreviewHtml", () => {
  it("emits the portfolio's own Open Graph and Twitter tags", () => {
    const out = html(publicPortfolio({ name: "Alex Rivera", roles: "Engineer", tagline: "Hi" }));
    expect(out).toContain('<meta property="og:title" content="Alex Rivera — Engineer" />');
    expect(out).toContain('<meta name="twitter:title" content="Alex Rivera — Engineer" />');
    expect(out).toContain('<meta property="og:url" content="https://api.example.com/p/alex" />');
    expect(out).toContain("<title>Alex Rivera — Engineer</title>");
  });

  it("sends a human on to the app", () => {
    const out = html(publicPortfolio({ name: "Alex" }));
    expect(out).toContain("https://app.example.com/#/p/alex");
    expect(out).toContain('http-equiv="refresh"');
    // replace(), not assign(): a redirect that leaves a history entry traps
    // the back button on the bounce page.
    expect(out).toContain("window.location.replace(");
  });

  it("switches to a large card only when there is an image", () => {
    expect(html(publicPortfolio({ photo: "https://cdn/x.png" }))).toContain(
      '<meta name="twitter:card" content="summary_large_image" />'
    );
    expect(html(publicPortfolio({ name: "A" }))).toContain('<meta name="twitter:card" content="summary" />');
  });

  it("escapes a name that tries to break out of the meta tag", () => {
    const out = html(publicPortfolio({ name: '" /><script>alert(1)</script>' }));
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&quot;");
    // The only script in the document is the redirect we wrote ourselves.
    expect(out.match(/<script/g)).toHaveLength(1);
  });

  it("escapes a slug that tries to break out of the redirect", () => {
    const out = html(publicPortfolio({ name: "A" }), '"><script>alert(1)</script>');
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out.match(/<script/g)).toHaveLength(1);
  });
});

describe("escapeHtml", () => {
  it("covers every character that can end an attribute or open a tag", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escapeHtml(null)).toBe("");
  });
});

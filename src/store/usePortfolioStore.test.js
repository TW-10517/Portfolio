// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/api.js", () => ({
  api: { getMine: vi.fn(), saveMine: vi.fn(), deleteMine: vi.fn() },
  ApiError: class ApiError extends Error {},
  setUnauthorizedHandler: vi.fn(),
}));

const { usePortfolioStore } = await import("./usePortfolioStore.js");
const { api } = await import("../utils/api.js");

const store = () => usePortfolioStore.getState();

// SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS" in UTC.
const sqliteStamp = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);

const serverPortfolio = (updatedAtMs, name = "SERVER COPY") => ({
  slug: "ada",
  visibility: "public",
  views: 7,
  updated_at: sqliteStamp(updatedAtMs),
  data: { profile: { name }, meta: {} },
});

beforeEach(() => {
  vi.clearAllMocks();
  usePortfolioStore.setState({
    data: { profile: { name: "LOCAL DRAFT" }, meta: {} },
    lastSavedAt: null,
    lastPublishedAt: null,
  });
});

describe("loadFromServer", () => {
  it("keeps local data when the server has no copy", async () => {
    api.getMine.mockResolvedValue({ portfolio: null });
    expect(await store().loadFromServer("t")).toBe("no-server-copy");
    expect(store().data.profile.name).toBe("LOCAL DRAFT");
  });

  it("keeps a local draft that is newer than the server copy", async () => {
    // The data-loss regression: this runs on every editor mount, including a
    // plain refresh. Overwriting here silently discarded every edit made
    // since the last publish.
    const serverTime = Date.now() - 60_000;
    usePortfolioStore.setState({ lastSavedAt: Date.now() });
    api.getMine.mockResolvedValue({ portfolio: serverPortfolio(serverTime) });

    expect(await store().loadFromServer("t")).toBe("kept-local-draft");
    expect(store().data.profile.name).toBe("LOCAL DRAFT");
  });

  it("loads the server copy when it is newer than the local draft", async () => {
    usePortfolioStore.setState({ lastSavedAt: Date.now() - 60_000 });
    api.getMine.mockResolvedValue({ portfolio: serverPortfolio(Date.now()) });

    expect(await store().loadFromServer("t")).toBe("loaded-server-copy");
    expect(store().data.profile.name).toBe("SERVER COPY");
  });

  it("loads the server copy when there is no local edit at all", async () => {
    // A fresh browser signing in must pick up the account's portfolio.
    api.getMine.mockResolvedValue({ portfolio: serverPortfolio(Date.now() - 60_000) });
    expect(await store().loadFromServer("t")).toBe("loaded-server-copy");
    expect(store().data.profile.name).toBe("SERVER COPY");
  });

  it("prefers the local draft when the timestamps are identical", async () => {
    // A tie means the local copy is at least as fresh; discarding it would
    // lose work for no gain.
    const t = Date.now();
    usePortfolioStore.setState({ lastSavedAt: new Date(sqliteStamp(t) + "Z").getTime() });
    api.getMine.mockResolvedValue({ portfolio: serverPortfolio(t) });
    expect(await store().loadFromServer("t")).toBe("kept-local-draft");
  });

  it("carries slug, visibility and views onto the loaded copy", async () => {
    api.getMine.mockResolvedValue({ portfolio: serverPortfolio(Date.now()) });
    await store().loadFromServer("t");
    expect(store().data.meta).toEqual({ slug: "ada", visibility: "public", views: 7 });
  });

  it("reads the server timestamp as UTC, not local time", async () => {
    // "2026-01-01 00:00:00" is UTC. Parsed as local time in a UTC+9 zone it
    // would look nine hours older than it is, and a local draft from eight
    // hours ago would wrongly win.
    const serverMs = Date.parse("2026-01-01T00:00:00Z");
    usePortfolioStore.setState({ lastSavedAt: serverMs - 60_000 });
    api.getMine.mockResolvedValue({ portfolio: serverPortfolio(serverMs) });
    expect(await store().loadFromServer("t")).toBe("loaded-server-copy");
  });
});

describe("clearLocalDraft", () => {
  it("resets the draft so the next user doesn't inherit it", async () => {
    // Without this, a second account signing into the same browser has its
    // real server data blocked by the previous user's leftover draft.
    usePortfolioStore.setState({ lastSavedAt: Date.now(), lastPublishedAt: Date.now() });
    store().clearLocalDraft();
    expect(store().data.profile.name).not.toBe("LOCAL DRAFT");
    expect(store().lastSavedAt).toBeNull();
    expect(store().lastPublishedAt).toBeNull();
  });

  it("lets the server copy load again afterwards", async () => {
    usePortfolioStore.setState({ lastSavedAt: Date.now() });
    store().clearLocalDraft();
    api.getMine.mockResolvedValue({ portfolio: serverPortfolio(Date.now() - 60_000) });
    expect(await store().loadFromServer("t")).toBe("loaded-server-copy");
  });
});

describe("update", () => {
  it("marks the draft as locally edited so it wins over an older server copy", () => {
    expect(store().lastSavedAt).toBeNull();
    store().update("profile.name", "EDITED");
    expect(store().data.profile.name).toBe("EDITED");
    expect(store().lastSavedAt).toBeGreaterThan(0);
  });

  it("does not mutate the previous state object", () => {
    const before = store().data;
    store().update("profile.name", "EDITED");
    expect(before.profile.name).toBe("LOCAL DRAFT");
  });
});

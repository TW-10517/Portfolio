// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// The real request() is exercised here so the 401 path is tested end to end
// rather than through a stubbed callback.
vi.stubGlobal("fetch", vi.fn());

const { useAuthStore } = await import("./useAuthStore.js");
const { api, ApiError } = await import("../utils/api.js");

const store = () => useAuthStore.getState();

const respond = (status, body) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ token: null, user: null, sessionExpired: false });
});

describe("expired session handling", () => {
  it("ends the session when the server rejects our token", async () => {
    // A 30-day token can be revoked by a logout elsewhere or a password
    // change. Nothing used to notice: the editor kept rendering as if signed
    // in and background syncs failed silently.
    useAuthStore.setState({ token: "dead-token", user: { id: 1, name: "Ada" } });
    fetch.mockReturnValue(respond(401, { error: "Invalid or expired session." }));

    await expect(api.me("dead-token")).rejects.toBeInstanceOf(ApiError);

    expect(store().token).toBeNull();
    expect(store().user).toBeNull();
    expect(store().sessionExpired).toBe(true);
  });

  it("does not treat a failed login as an expired session", async () => {
    // Login sends no token, so its 401 means "wrong password" — showing
    // "your session ended" there would be nonsense.
    fetch.mockReturnValue(respond(401, { errors: { form: "Incorrect email or password." } }));

    await expect(api.login({ email: "a@b.com", password: "wrong" })).rejects.toBeInstanceOf(ApiError);

    expect(store().sessionExpired).toBe(false);
  });

  it("leaves other errors alone", async () => {
    useAuthStore.setState({ token: "good-token", user: { id: 1 } });
    fetch.mockReturnValue(respond(400, { error: "Portfolio is too large." }));

    await expect(api.saveMine("good-token", {})).rejects.toBeInstanceOf(ApiError);

    expect(store().token).toBe("good-token");
    expect(store().sessionExpired).toBe(false);
  });

  it("survives a network failure without ending the session", async () => {
    // Being offline is not the same as being signed out.
    useAuthStore.setState({ token: "good-token", user: { id: 1 } });
    fetch.mockRejectedValue(new Error("offline"));

    await expect(api.me("good-token")).rejects.toBeInstanceOf(ApiError);

    expect(store().token).toBe("good-token");
    expect(store().sessionExpired).toBe(false);
  });

  it("clears the notice on a successful login", async () => {
    useAuthStore.setState({ sessionExpired: true });
    fetch.mockReturnValue(respond(200, { token: "fresh", user: { id: 2, name: "Ada" } }));

    await store().login({ email: "a@b.com", password: "right" });

    expect(store().token).toBe("fresh");
    expect(store().sessionExpired).toBe(false);
  });

  it("can be dismissed by the user", () => {
    useAuthStore.setState({ sessionExpired: true });
    store().clearSessionExpired();
    expect(store().sessionExpired).toBe(false);
  });

  it("does nothing when there was no session to end", () => {
    // A 401 arriving after the user already logged out must not resurrect
    // the "your session ended" notice.
    store().endExpiredSession();
    expect(store().sessionExpired).toBe(false);
  });
});

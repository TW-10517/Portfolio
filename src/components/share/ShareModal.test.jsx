// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ShareModal } from "./ShareModal.jsx";
import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { useAuthStore } from "../../store/useAuthStore.js";
import { api } from "../../utils/api.js";

vi.mock("../../utils/api.js", () => ({
  api: { getMine: vi.fn(), saveMine: vi.fn(), deleteMine: vi.fn() },
  ApiError: class ApiError extends Error {},
  // useAuthStore registers its expired-session handler through this on import.
  setUnauthorizedHandler: vi.fn(),
  // shareUrl.js builds the link from this.
  API_BASE: "http://localhost:4000/api",
}));

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") } }));

const publishedPortfolio = (over = {}) => ({
  slug: "ada-lovelace",
  visibility: "public",
  views: 1234,
  ...over,
});

beforeEach(() => {
  useAuthStore.setState({ token: "test-token", user: { id: 1, name: "Ada", email: "ada@example.com" } });
  usePortfolioStore.setState((s) => ({
    data: { ...s.data, profile: { ...s.data.profile, name: "Ada Lovelace" }, meta: {} },
  }));
});

afterEach(() => vi.clearAllMocks());

describe("ShareModal", () => {
  it("restores the share link when reopened on an already-published portfolio", async () => {
    // Regression: `published` used to start false on every mount, so the link,
    // QR code and social buttons vanished whenever the modal was reopened and
    // the only way back to them was to publish again.
    api.getMine.mockResolvedValue({ portfolio: publishedPortfolio() });

    render(<ShareModal open onClose={() => {}} />);

    // The link points at the API server's /p/:slug, not the app's own hash
    // route — that is the only URL that can carry per-portfolio preview tags.
    expect(await screen.findByDisplayValue("http://localhost:4000/p/ada-lovelace")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Republish" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeTruthy();
  });

  it("shows the view count the server has been collecting", async () => {
    api.getMine.mockResolvedValue({ portfolio: publishedPortfolio({ views: 1234 }) });

    render(<ShareModal open onClose={() => {}} />);

    expect(await screen.findByText("1,234")).toBeTruthy();
    expect(screen.getByText("views")).toBeTruthy();
  });

  it("says 'view' rather than 'views' for a single visit", async () => {
    api.getMine.mockResolvedValue({ portfolio: publishedPortfolio({ views: 1 }) });

    render(<ShareModal open onClose={() => {}} />);

    expect(await screen.findByText("view")).toBeTruthy();
  });

  it("offers Publish and hides the link when nothing is published yet", async () => {
    api.getMine.mockResolvedValue({ portfolio: null });

    render(<ShareModal open onClose={() => {}} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
    expect(screen.queryByText(/views?$/)).toBeNull();
  });

  it("stays usable when the status check fails", async () => {
    // A failed lookup must not wedge the button on "Checking…" — publishing
    // is still the user's way out.
    api.getMine.mockRejectedValue(new Error("offline"));

    render(<ShareModal open onClose={() => {}} />);

    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Publish" });
      expect(button.disabled).toBe(false);
    });
  });

  it("does not query the server while the modal is closed", () => {
    render(<ShareModal open={false} onClose={() => {}} />);
    expect(api.getMine).not.toHaveBeenCalled();
  });
});

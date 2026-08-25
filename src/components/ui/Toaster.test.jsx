// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "./Toaster.jsx";
import { useNotices, notify, NOTICE_TTL_MS } from "../../store/useNotices.js";

beforeEach(() => {
  act(() => useNotices.getState().clear());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toaster", () => {
  it("renders nothing at all when there is nothing to say", () => {
    // jest-dom's matchers aren't installed here, so this checks the DOM
    // directly rather than reaching for toBeEmptyDOMElement.
    const { container } = render(<Toaster />);
    expect(container.innerHTML).toBe("");
  });

  it("shows a message reported from outside React", () => {
    // The point of the plain `notify` export: the callers are file handlers,
    // not components.
    render(<Toaster />);
    act(() => notify("That image couldn't be read."));
    expect(screen.getByText("That image couldn't be read.")).toBeTruthy();
  });

  it("puts the live region in the DOM before the text arrives", () => {
    // A live region has to be subscribed before the change happens. Rendering
    // the container and its message at the same instant means a screen reader
    // has nothing listening at the moment the text appears, and announces
    // nothing — which is exactly the failure this replaced.
    render(<Toaster />);
    act(() => notify("First problem"));
    const region = screen.getByRole("alert");
    expect(region.getAttribute("aria-live")).toBe("assertive");
    act(() => notify("Second problem"));
    expect(screen.getByRole("alert")).toBe(region);
  });

  it("stacks more than one", () => {
    render(<Toaster />);
    act(() => {
      notify("First");
      notify("Second");
    });
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("can be dismissed by hand", async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => notify("Dismiss me"));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Dismiss me")).toBeNull();
  });

  it("clears itself after a while", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => notify("Temporary"));
    expect(screen.getByText("Temporary")).toBeTruthy();
    act(() => vi.advanceTimersByTime(NOTICE_TTL_MS + 50));
    expect(screen.queryByText("Temporary")).toBeNull();
  });

  it("keeps a notice that asked to stay", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => notify("Sticky", { ttl: 0 }));
    act(() => vi.advanceTimersByTime(NOTICE_TTL_MS * 3));
    expect(screen.getByText("Sticky")).toBeTruthy();
  });

  it("dismisses the right one when several are showing", () => {
    render(<Toaster />);
    let second;
    act(() => {
      notify("Keep me");
      second = notify("Remove me");
    });
    act(() => useNotices.getState().dismiss(second));
    expect(screen.getByText("Keep me")).toBeTruthy();
    expect(screen.queryByText("Remove me")).toBeNull();
  });
});

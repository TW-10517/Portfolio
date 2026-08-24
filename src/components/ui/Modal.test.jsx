// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal.jsx";

function Harness({ label = "Test dialog" }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <button>Outside button</button>
      <Modal open={open} onClose={() => setOpen(false)} label={label}>
        <h2>Dialog heading</h2>
        <button>First</button>
        <button>Second</button>
      </Modal>
    </div>
  );
}

const dialog = () => screen.getByRole("dialog");

describe("Modal", () => {
  it("exposes itself as a labelled modal dialog", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("Open dialog"));
    const d = dialog();
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(d.getAttribute("aria-label")).toBe("Test dialog");
  });

  it("moves focus into the dialog when it opens", async () => {
    // Focusing the panel itself means a screen reader announces the dialog
    // and its name before reading the contents.
    render(<Harness />);
    await userEvent.click(screen.getByText("Open dialog"));
    await waitFor(() => expect(document.activeElement).toBe(dialog()));
  });

  it("keeps Tab inside the dialog", async () => {
    // Regression: Tab used to walk straight out into the page behind, where
    // "Log out" sat two stops away from an open Share dialog.
    render(<Harness />);
    await userEvent.click(screen.getByText("Open dialog"));
    await waitFor(() => expect(document.activeElement).toBe(dialog()));

    for (let i = 0; i < 8; i++) {
      await userEvent.tab();
      expect(dialog().contains(document.activeElement)).toBe(true);
    }
  });

  it("wraps from the last control round to the first, and back", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("Open dialog"));
    await waitFor(() => expect(document.activeElement).toBe(dialog()));

    // Start from a known position rather than inferring one, so this asserts
    // the wrap itself rather than where the first Tab happens to land.
    const close = screen.getByRole("button", { name: "Close" });
    const second = screen.getByRole("button", { name: "Second" });

    second.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(close);

    close.focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(second);
  });

  it("closes on Escape", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("Open dialog"));
    expect(dialog()).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("returns focus to whatever opened it", async () => {
    // Otherwise a keyboard user is dumped back at the top of the document.
    render(<Harness />);
    const trigger = screen.getByText("Open dialog");
    await userEvent.click(trigger);
    await waitFor(() => expect(document.activeElement).toBe(dialog()));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("restores page scrolling after it closes", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("Open dialog"));
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });

  it("renders nothing at all while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("has a labelled close control", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("Open dialog"));
    const close = screen.getByRole("button", { name: "Close" });
    await userEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageUpload } from "./ImageUpload.jsx";
import { readImageFile } from "../../utils/exportImport.js";

vi.mock("../../utils/exportImport.js", () => ({ readImageFile: vi.fn() }));

const makeFile = (bytes, type = "image/png") =>
  new File([new Uint8Array(bytes)], "photo.png", { type });

beforeEach(() => {
  // restoreAllMocks() only unwinds spyOn'd functions — the vi.fn() inside the
  // module mock keeps its call history across tests unless cleared here.
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => {});
  readImageFile.mockResolvedValue("data:image/webp;base64,small");
});

afterEach(() => vi.restoreAllMocks());

function fileInput(container) {
  return container.querySelector('input[type="file"]');
}

describe("ImageUpload", () => {
  it("passes the processed image up rather than the raw file", async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageUpload value="" onChange={onChange} />);

    await userEvent.upload(fileInput(container), makeFile(64));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("data:image/webp;base64,small"));
    expect(readImageFile).toHaveBeenCalledOnce();
  });

  it("rejects a file too large to decode safely", async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageUpload value="" onChange={onChange} />);

    const huge = makeFile(8);
    Object.defineProperty(huge, "size", { value: 13 * 1024 * 1024 });
    await userEvent.upload(fileInput(container), huge);

    expect(window.alert).toHaveBeenCalled();
    expect(readImageFile).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts an ordinary phone photo that the old 2MB cap refused", async () => {
    const onChange = vi.fn();
    const { container } = render(<ImageUpload value="" onChange={onChange} />);

    const photo = makeFile(8, "image/jpeg");
    Object.defineProperty(photo, "size", { value: 4 * 1024 * 1024 });
    await userEvent.upload(fileInput(container), photo);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("reports a failed read instead of silently doing nothing", async () => {
    readImageFile.mockRejectedValue(new Error("corrupt"));
    const onChange = vi.fn();
    const { container } = render(<ImageUpload value="" onChange={onChange} />);

    await userEvent.upload(fileInput(container), makeFile(64));

    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    // The button must not stay stuck on "Processing…".
    expect(screen.getByRole("button", { name: "Upload file" })).toBeTruthy();
  });

  it("hides a data-URL value from the URL text box", () => {
    render(<ImageUpload value="data:image/webp;base64,abc" onChange={() => {}} />);
    expect(screen.getByPlaceholderText("Paste image URL…").value).toBe("");
  });

  it("shows a pasted URL in the text box", () => {
    render(<ImageUpload value="https://example.com/a.png" onChange={() => {}} />);
    expect(screen.getByPlaceholderText("Paste image URL…").value).toBe("https://example.com/a.png");
  });
});

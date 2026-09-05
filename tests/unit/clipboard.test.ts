import { copyPngBlobToClipboard } from "@/lib/clipboard";

describe("copyPngBlobToClipboard", () => {
  const originalClipboardItem = (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = originalClipboardItem;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });

  it("returns unsupported when ClipboardItem is not available", async () => {
    Reflect.deleteProperty(globalThis, "ClipboardItem");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: jest.fn() },
    });

    const result = await copyPngBlobToClipboard(new Blob(["x"], { type: "image/png" }));

    expect(result).toBe("unsupported");
  });

  it("returns unsupported when navigator.clipboard.write is not available", async () => {
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = class {};
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {} });

    const result = await copyPngBlobToClipboard(new Blob(["x"], { type: "image/png" }));

    expect(result).toBe("unsupported");
  });

  it("returns copied after successfully writing the blob to the clipboard", async () => {
    const writeMock = jest.fn().mockResolvedValue(undefined);
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = jest.fn().mockImplementation((items) => items);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: writeMock },
    });
    const blob = new Blob(["x"], { type: "image/png" });

    const result = await copyPngBlobToClipboard(blob);

    expect(result).toBe("copied");
    expect(writeMock).toHaveBeenCalledWith([{ "image/png": blob }]);
  });

  it("returns failed when the clipboard write rejects", async () => {
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = jest.fn().mockImplementation((items) => items);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: jest.fn().mockRejectedValue(new Error("denied")) },
    });

    const result = await copyPngBlobToClipboard(new Blob(["x"], { type: "image/png" }));

    expect(result).toBe("failed");
  });
});

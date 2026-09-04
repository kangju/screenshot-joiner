import { isSupportedImageFile } from "@/lib/image-signature";

const signatures = {
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpeg: new Uint8Array([0xff, 0xd8, 0xff]),
  webp: new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]),
};

describe("isSupportedImageFile", () => {
  it.each([
    ["photo.png", "image/gif", signatures.png],
    ["photo.gif", "image/png", signatures.png],
    ["photo.png", "image/jpeg", signatures.png],
    ["photo.jpg", "image/png", signatures.jpeg],
    ["photo.webp", "image/png", signatures.webp],
  ])("rejects a mismatched extension and MIME type for %s", async (name, type, bytes) => {
    await expect(isSupportedImageFile(new File([bytes], name, { type }))).resolves.toBe(false);
  });

  it.each([
    ["PHOTO.PNG", "IMAGE/PNG", signatures.png],
    ["PHOTO.JPEG", "IMAGE/JPEG", signatures.jpeg],
    ["PHOTO.WEBP", "IMAGE/WEBP", signatures.webp],
  ])("accepts case-insensitive supported metadata for %s", async (name, type, bytes) => {
    await expect(isSupportedImageFile(new File([bytes], name, { type }))).resolves.toBe(true);
  });

  it.each([
    ["truncated.png", "image/png", signatures.png.slice(0, -1)],
    ["truncated.jpg", "image/jpeg", signatures.jpeg.slice(0, -1)],
    ["truncated.webp", "image/webp", signatures.webp.slice(0, -1)],
  ])("rejects a truncated signature for %s", async (name, type, bytes) => {
    await expect(isSupportedImageFile(new File([bytes], name, { type }))).resolves.toBe(false);
  });

  it.each(["error", "abort"] as const)(
    "settles false when FileReader emits %s",
    async (eventName) => {
      const originalFileReader = globalThis.FileReader;
      class FailedFileReader {
        error = eventName === "error" ? new DOMException("read failed") : null;
        onabort: ((event: ProgressEvent<FileReader>) => void) | null = null;
        onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
        onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
        result: string | ArrayBuffer | null = null;

        readAsArrayBuffer() {
          const event = new ProgressEvent(eventName) as ProgressEvent<FileReader>;
          queueMicrotask(() => {
            if (eventName === "error") {
              this.onerror?.(event);
            } else {
              this.onabort?.(event);
            }
          });
        }
      }
      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        value: FailedFileReader,
      });

      try {
        const validation = isSupportedImageFile(
          new File([signatures.png], "photo.png", { type: "image/png" }),
        );
        await expect(
          Promise.race([
            validation,
            new Promise<"unsettled">((resolve) =>
              setTimeout(() => resolve("unsettled"), 0),
            ),
          ]),
        ).resolves.toBe(false);
      } finally {
        Object.defineProperty(globalThis, "FileReader", {
          configurable: true,
          value: originalFileReader,
        });
      }
    },
  );
});

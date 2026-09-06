import { buildTimestampedFilename, downloadBlob } from "@/lib/download";

describe("downloadBlob", () => {
  it("clicks a temporary anchor pointed at an object URL and revokes it afterward", () => {
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const objectUrl = "blob:mock-url";
    const createObjectURLMock = jest.fn(() => objectUrl);
    const revokeObjectURLMock = jest.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    });
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    try {
      downloadBlob(blob, "joined-image.png");

      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(anchor.href).toBe(objectUrl);
      expect(anchor.download).toBe("joined-image.png");
      expect(document.body.contains(anchor)).toBe(false);
      expect(revokeObjectURLMock).toHaveBeenCalledWith(objectUrl);
    } finally {
      clickSpy.mockRestore();
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      });
    }
  });
});

describe("buildTimestampedFilename", () => {
  it("appends the local date and time to the base name, zero-padded", () => {
    // 月は0始まりのため8は9月。ローカル時刻のコンストラクタを使い、
    // テスト実行環境のタイムゾーンに依存しないようにする
    const date = new Date(2026, 8, 6, 13, 4, 5);

    const result = buildTimestampedFilename("joined-image", "png", date);

    expect(result).toBe("joined-image-20260906-130405.png");
  });

  it("zero-pads single-digit month, day, hour, minute, and second", () => {
    const date = new Date(2026, 0, 5, 3, 4, 5);

    const result = buildTimestampedFilename("joined-image", "jpg", date);

    expect(result).toBe("joined-image-20260105-030405.jpg");
  });
});

import { downloadBlob } from "@/lib/download";

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

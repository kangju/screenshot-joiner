import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactNode } from "react";
import Home from "@/app/page";

let capturedOnDragEnd: ((event: unknown) => void) | undefined;
let capturedSortableItems: Array<string | number> = [];

jest.mock("@dnd-kit/core", () => {
  const actual = jest.requireActual("@dnd-kit/core");
  return {
    ...actual,
    DndContext: (props: { children: ReactNode; onDragEnd?: (event: unknown) => void }) => {
      capturedOnDragEnd = props.onDragEnd;
      return props.children;
    },
  };
});

jest.mock("@dnd-kit/sortable", () => {
  const actual = jest.requireActual("@dnd-kit/sortable");
  return {
    ...actual,
    SortableContext: (props: { children: ReactNode; items: Array<string | number> }) => {
      capturedSortableItems = props.items;
      return props.children;
    },
  };
});

// クリップボードコピーの成功/失敗/非対応を明示的に切り替えて検証するため、
// tests/unit/clipboard.test.tsで既に検証済みの実装をモックに差し替える
const copyPngBlobToClipboardMock = jest.fn();

jest.mock("@/lib/clipboard", () => ({
  copyPngBlobToClipboard: (...args: unknown[]) => copyPngBlobToClipboardMock(...args),
}));

// zip-clientは実際のWorkerランタイムに依存しておりjsdomでは動作しないため、
// モジュール自体をモックしてpage.tsx側の配線(進捗表示・完了・エラー・
// キャンセル)だけを検証する。Worker生成やpostMessage転送自体は
// tests/unit/zip-client.test.tsと、別途のブラウザ確認で検証済み。
const extractZipFileMock = jest.fn();

jest.mock("@/lib/zip-client", () => ({
  extractZipFile: (...args: unknown[]) => extractZipFileMock(...args),
}));

// cropperjsは実際のポインタージオメトリに依存しておりjsdomでは動作しないため、
// tests/unit/crop-dialog.test.tsxと同じ最小限のフェイクに差し替える
let lastCropperInstance: { destroy: jest.Mock } | null = null;

jest.mock("cropperjs", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      const instance = {
        getCropperSelection: () => ({
          x: 1,
          y: 2,
          width: 3,
          height: 4,
          keyboard: false,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        }),
        getCropperImage: () => ({ scalable: true, translatable: true, rotatable: true, skewable: true }),
        getCropperCanvas: () => ({ style: {} }),
        destroy: jest.fn(),
      };
      lastCropperInstance = instance;
      return instance;
    }),
  };
});

const expectListItemNames = (names: string[]) => {
  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(names.length);
  names.forEach((name, index) => {
    expect(within(items[index]).getByText(name)).toBeInTheDocument();
  });
};

type MockCanvasContext = {
  fillStyle: string;
  fillRect: jest.Mock;
  drawImage: jest.Mock;
  translate: jest.Mock;
  rotate: jest.Mock;
};

describe("project scaffold", () => {
  let canvasContexts: Array<{ canvas: HTMLCanvasElement; context: MockCanvasContext }>;

  const getMockContext = (canvas: HTMLCanvasElement): MockCanvasContext => {
    const entry = canvasContexts.find((candidate) => candidate.canvas === canvas);

    if (!entry) {
      throw new Error("no mock 2D context was recorded for this canvas");
    }

    return entry.context;
  };

  beforeEach(() => {
    extractZipFileMock.mockReset();
    copyPngBlobToClipboardMock.mockReset();
    canvasContexts = [];
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(function (this: HTMLCanvasElement) {
        let entry = canvasContexts.find((candidate) => candidate.canvas === this);

        if (!entry) {
          entry = {
            canvas: this,
            context: {
              fillStyle: "",
              fillRect: jest.fn(),
              drawImage: jest.fn(),
              translate: jest.fn(),
              rotate: jest.fn(),
            },
          };
          canvasContexts.push(entry);
        }

        return entry.context as unknown as CanvasRenderingContext2D;
      });
  });

  afterEach(() => {
    // Run RTL's unmount cleanup before restoring mocks: afterEach hooks run
    // inside-out, so RTL's own auto-cleanup (registered at module load, outside
    // this describe) would otherwise run *after* this hook and unmount while
    // canvas.getContext is already un-mocked, crashing on jsdom's real
    // (unimplemented) getContext from a leftover passive effect.
    cleanup();
    jest.restoreAllMocks();
  });

  it("states that images are processed on the device", () => {
    render(<Home />);

    expect(
      screen.getByText("画像は端末内だけで処理されます。"),
    ).toBeInTheDocument();
  });

  it("shows preview guidance when there are no images, and hides it once one is added", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    try {
      render(<Home />);

      expect(
        screen.getByText("画像を追加すると、結合結果がここに表示されます"),
      ).toBeInTheDocument();

      const file = new File([new Uint8Array(pngSignature)], "first.png", { type: "image/png" });
      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("first.png");

      expect(
        screen.queryByText("画像を追加すると、結合結果がここに表示されます"),
      ).not.toBeInTheDocument();
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("decodes and appends one selected image without network access", async () => {
    const user = userEvent.setup();
    const bitmap = {
      width: 1280,
      height: 720,
      close: jest.fn(),
    } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalFetch = globalThis.fetch;
    const originalSendBeacon = navigator.sendBeacon;
    const fetchSpy = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const sendBeaconSpy = jest.fn<
      ReturnType<Navigator["sendBeacon"]>,
      Parameters<Navigator["sendBeacon"]>
    >(() => false);
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });
    const xhrSendSpy = jest
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => undefined);
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "dashboard.png",
        { type: "image/png" },
      );

      await user.upload(screen.getByLabelText("画像を追加"), file);

      expect(createImageBitmapMock).toHaveBeenCalledWith(file);
      expect(await screen.findByText("dashboard.png")).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    } finally {
      xhrSendSpy.mockRestore();
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", {
          configurable: true,
          value: originalFetch,
        });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (originalSendBeacon) {
        Object.defineProperty(navigator, "sendBeacon", {
          configurable: true,
          value: originalSendBeacon,
        });
      } else {
        Reflect.deleteProperty(navigator, "sendBeacon");
      }
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("appends multiple selected images in FileList order when decoding finishes out of order", async () => {
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const bitmaps = [makeBitmap(100, 200), makeBitmap(300, 400), makeBitmap(500, 600)];
    const resolvers: Array<(bitmap: ImageBitmap) => void> = [];
    const pendingBitmaps = bitmaps.map(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockImplementationOnce(() => pendingBitmaps[0])
      .mockImplementationOnce(() => pendingBitmaps[1])
      .mockImplementationOnce(() => pendingBitmaps[2]);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalFetch = globalThis.fetch;
    const originalSendBeacon = navigator.sendBeacon;
    const fetchSpy = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const sendBeaconSpy = jest.fn<
      ReturnType<Navigator["sendBeacon"]>,
      Parameters<Navigator["sendBeacon"]>
    >(() => false);
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });
    const xhrSendSpy = jest
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => undefined);
    let unmountEditor: () => void = () => undefined;

    try {
      const { unmount } = render(<Home />);
      unmountEditor = unmount;
      const files = [
        new File(
          [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "first"],
          "first.png",
          { type: "image/png" },
        ),
        new File(
          [new Uint8Array([0xff, 0xd8, 0xff]), "second"],
          "second.jpg",
          { type: "image/jpeg" },
        ),
        new File(
          [
            new Uint8Array([
              0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
            ]),
            "third",
          ],
          "third.webp",
          { type: "image/webp" },
        ),
      ];
      const input = screen.getByLabelText("画像を追加");

      fireEvent.change(input, { target: { files } });

      await waitFor(() => expect(createImageBitmapMock).toHaveBeenCalledTimes(3));
      await act(async () => {
        resolvers[1](bitmaps[1]);
        await pendingBitmaps[1];
        resolvers[2](bitmaps[2]);
        await pendingBitmaps[2];
        resolvers[0](bitmaps[0]);
        await Promise.all(pendingBitmaps);
      });

      expect(input).toHaveAttribute("multiple");
      expectListItemNames(["first.png", "second.jpg", "third.webp"]);
      expect(createImageBitmapMock.mock.calls.map(([file]) => file)).toEqual(files);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    } finally {
      act(() => unmountEditor());
      resolvers.forEach((resolve, index) => resolve(bitmaps[index]));
      await Promise.all(pendingBitmaps);
      xhrSendSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", {
          configurable: true,
          value: originalFetch,
        });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (originalSendBeacon) {
        Object.defineProperty(navigator, "sendBeacon", {
          configurable: true,
          value: originalSendBeacon,
        });
      } else {
        Reflect.deleteProperty(navigator, "sendBeacon");
      }
    }
  });

  it("decodes only PNG, JPEG, and WebP files with valid signatures and reports rejected files", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const makeBitmap = () =>
      ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    const bitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValue(bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const validPng = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "valid.png",
        { type: "image/png" },
      );
      const validJpeg = new File(
        [new Uint8Array([0xff, 0xd8, 0xff])],
        "valid.jpg",
        { type: "image/jpeg" },
      );
      const validWebp = new File(
        [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
        "valid.webp",
        { type: "image/webp" },
      );
      const malformedPng = new File(["not a png"], "broken.png", {
        type: "image/png",
      });
      const unsupportedGif = new File(
        [new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
        "animation.gif",
        { type: "image/gif" },
      );

      await user.upload(screen.getByLabelText("画像を追加"), [
        validPng,
        malformedPng,
        validJpeg,
        unsupportedGif,
        validWebp,
      ]);

      await waitFor(() => expect(createImageBitmapMock).toHaveBeenCalledTimes(3));
      expect(createImageBitmapMock.mock.calls.map(([file]) => file)).toEqual([
        validPng,
        validJpeg,
        validWebp,
      ]);
      expectListItemNames(["valid.png", "valid.jpg", "valid.webp"]);
      expect(screen.queryByText("broken.png", { selector: "li" })).not.toBeInTheDocument();
      expect(screen.queryByText("animation.gif", { selector: "li" })).not.toBeInTheDocument();

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("対応していない、または壊れた画像");
      expect(alert).toHaveTextContent("broken.png");
      expect(alert).toHaveTextContent("animation.gif");
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("keeps successful images from a partially failed decode and releases them on unmount", async () => {
    const user = userEvent.setup();
    const makeBitmap = () =>
      ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap();
    const thirdBitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockRejectedValueOnce(new DOMException("decode failed"))
      .mockResolvedValueOnce(thirdBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalFetch = globalThis.fetch;
    const originalSendBeacon = navigator.sendBeacon;
    const fetchSpy = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const sendBeaconSpy = jest.fn<
      ReturnType<Navigator["sendBeacon"]>,
      Parameters<Navigator["sendBeacon"]>
    >(() => false);
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchSpy });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });
    const xhrSendSpy = jest
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => undefined);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    try {
      const { unmount } = render(<Home />);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "failed.png", { type: "image/png" }),
        new File([png, "third"], "third.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);

      await screen.findAllByRole("listitem");
      expectListItemNames(["first.png", "third.png"]);
      expect(screen.getByRole("alert")).toHaveTextContent("failed.png");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();

      unmount();

      expect(firstBitmap.close).toHaveBeenCalledTimes(1);
      expect(thirdBitmap.close).toHaveBeenCalledTimes(1);
    } finally {
      xhrSendSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", { configurable: true, value: originalFetch });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (originalSendBeacon) {
        Object.defineProperty(navigator, "sendBeacon", {
          configurable: true,
          value: originalSendBeacon,
        });
      } else {
        Reflect.deleteProperty(navigator, "sendBeacon");
      }
    }
  });

  it("closes an image decoded after the editor unmounts", async () => {
    const user = userEvent.setup();
    const bitmap = {
      width: 1280,
      height: 720,
      close: jest.fn(),
    } as unknown as ImageBitmap;
    let resolveBitmap!: (bitmap: ImageBitmap) => void;
    const pendingBitmap = new Promise<ImageBitmap>((resolve) => {
      resolveBitmap = resolve;
    });
    const createImageBitmapMock = jest.fn(() => pendingBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalFetch = globalThis.fetch;
    const originalSendBeacon = navigator.sendBeacon;
    const fetchSpy = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const sendBeaconSpy = jest.fn<
      ReturnType<Navigator["sendBeacon"]>,
      Parameters<Navigator["sendBeacon"]>
    >(() => false);
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });
    const xhrSendSpy = jest
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => undefined);
    let mounted = true;
    let unmountEditor: () => void = () => undefined;

    try {
      const { unmount } = render(<Home />);
      unmountEditor = unmount;
      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "late.png",
        { type: "image/png" },
      );

      await user.upload(screen.getByLabelText("画像を追加"), file);
      expect(createImageBitmapMock).toHaveBeenCalledWith(file);

      unmount();
      mounted = false;
      await act(async () => {
        resolveBitmap(bitmap);
        await pendingBitmap;
      });

      expect(bitmap.close).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    } finally {
      if (mounted) {
        act(() => unmountEditor());
      }
      xhrSendSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", {
          configurable: true,
          value: originalFetch,
        });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (originalSendBeacon) {
        Object.defineProperty(navigator, "sendBeacon", {
          configurable: true,
          value: originalSendBeacon,
        });
      } else {
        Reflect.deleteProperty(navigator, "sendBeacon");
      }
    }
  });

  it("keeps a normally decoded image open while mounted in StrictMode", async () => {
    const user = userEvent.setup();
    const bitmap = {
      width: 1280,
      height: 720,
      close: jest.fn(),
    } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalFetch = globalThis.fetch;
    const originalSendBeacon = navigator.sendBeacon;
    const fetchSpy = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const sendBeaconSpy = jest.fn<
      ReturnType<Navigator["sendBeacon"]>,
      Parameters<Navigator["sendBeacon"]>
    >(() => false);
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });
    const xhrSendSpy = jest
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => undefined);
    let unmountEditor: () => void = () => undefined;

    try {
      const { unmount } = render(
        <StrictMode>
          <Home />
        </StrictMode>,
      );
      unmountEditor = unmount;
      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "strict.png",
        { type: "image/png" },
      );

      await user.upload(screen.getByLabelText("画像を追加"), file);

      expect(createImageBitmapMock).toHaveBeenCalledWith(file);
      expect(bitmap.close).not.toHaveBeenCalled();
      expect(await screen.findByText("strict.png")).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    } finally {
      act(() => unmountEditor());
      xhrSendSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", {
          configurable: true,
          value: originalFetch,
        });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (originalSendBeacon) {
        Object.defineProperty(navigator, "sendBeacon", {
          configurable: true,
          value: originalSendBeacon,
        });
      } else {
        Reflect.deleteProperty(navigator, "sendBeacon");
      }
    }
  });

  it("appends valid pasted images in clipboard order and stops handling paste after unmount", async () => {
    const user = userEvent.setup();
    const makeBitmap = () =>
      ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    const selectedBitmap = makeBitmap();
    const firstPastedBitmap = makeBitmap();
    const secondPastedBitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(selectedBitmap)
      .mockResolvedValueOnce(firstPastedBitmap)
      .mockResolvedValueOnce(secondPastedBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalFetch = globalThis.fetch;
    const originalSendBeacon = navigator.sendBeacon;
    const fetchSpy = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const sendBeaconSpy = jest.fn<
      ReturnType<Navigator["sendBeacon"]>,
      Parameters<Navigator["sendBeacon"]>
    >(() => false);
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });
    const xhrSendSpy = jest
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => undefined);
    const pngSignature = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const jpegSignature = new Uint8Array([0xff, 0xd8, 0xff]);
    const selectedFile = new File([pngSignature], "selected.png", {
      type: "image/png",
    });
    const firstPastedFile = new File([pngSignature], "clipboard-first.png", {
      type: "image/png",
    });
    const malformedImage = new File(["not a png"], "clipboard-broken.png", {
      type: "image/png",
    });
    const secondPastedFile = new File([jpegSignature], "clipboard-second.jpg", {
      type: "image/jpeg",
    });
    const clipboardItems = [
      {
        kind: "file",
        type: "image/png",
        getAsFile: () => firstPastedFile,
      },
      {
        kind: "string",
        type: "text/plain",
        getAsFile: () => null,
      },
      {
        kind: "file",
        type: "image/png",
        getAsFile: () => malformedImage,
      },
      {
        kind: "file",
        type: "image/jpeg",
        getAsFile: () => secondPastedFile,
      },
    ] as DataTransferItem[];

    try {
      const { unmount } = render(<Home />);
      await user.upload(screen.getByLabelText("画像を追加"), selectedFile);

      fireEvent.paste(document, {
        clipboardData: { items: clipboardItems },
      });

      await waitFor(() => expect(createImageBitmapMock).toHaveBeenCalledTimes(3));
      expect(createImageBitmapMock.mock.calls.map(([file]) => file)).toEqual([
        selectedFile,
        firstPastedFile,
        secondPastedFile,
      ]);
      expectListItemNames(["selected.png", "clipboard-first.png", "clipboard-second.jpg"]);
      expect(screen.queryByText("clipboard-broken.png", { selector: "li" })).not.toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();

      unmount();
      fireEvent.paste(document, {
        clipboardData: { items: clipboardItems },
      });
      await Promise.resolve();

      expect(createImageBitmapMock).toHaveBeenCalledTimes(3);
    } finally {
      xhrSendSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", {
          configurable: true,
          value: originalFetch,
        });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (originalSendBeacon) {
        Object.defineProperty(navigator, "sendBeacon", {
          configurable: true,
          value: originalSendBeacon,
        });
      } else {
        Reflect.deleteProperty(navigator, "sendBeacon");
      }
    }
  });

  it("adds image files dropped onto the image list", async () => {
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "dropped.png",
        { type: "image/png" },
      );
      const list = screen.getByRole("list");

      fireEvent.drop(list, { dataTransfer: { files: [file] } });

      expect(await screen.findByText("dropped.png")).toBeInTheDocument();
      expect(createImageBitmapMock).toHaveBeenCalledWith(file);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("rejects a ZIP file whose own size exceeds the archive limit without reading it into memory (P4-05 archive-size check)", async () => {
    render(<Home />);
    const zipFile = new File([new Uint8Array([1, 2, 3])], "huge.zip", { type: "application/zip" });
    Object.defineProperty(zipFile, "size", { value: 200 * 1024 * 1024 + 1 });
    const arrayBufferSpy = jest.spyOn(zipFile, "arrayBuffer");
    const list = screen.getByRole("list");

    fireEvent.drop(list, { dataTransfer: { files: [zipFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("huge.zip");
    expect(screen.getByRole("alert")).toHaveTextContent("ZIPファイル自体が大きすぎます");
    expect(arrayBufferSpy).not.toHaveBeenCalled();
    expect(extractZipFileMock).not.toHaveBeenCalled();
  });

  it("processes two dropped ZIP files one at a time, without one's status/cancel overwriting the other's", async () => {
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    let resolveFirst!: (outcome: unknown) => void;
    let resolveSecond!: (outcome: unknown) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    extractZipFileMock
      .mockReturnValueOnce({ result: firstPromise, cancel: jest.fn() })
      .mockReturnValueOnce({ result: secondPromise, cancel: jest.fn() });

    try {
      render(<Home />);
      const firstZip = new File([new Uint8Array([1])], "first.zip", { type: "application/zip" });
      const secondZip = new File([new Uint8Array([2])], "second.zip", { type: "application/zip" });
      const list = screen.getByRole("list");

      fireEvent.drop(list, { dataTransfer: { files: [firstZip, secondZip] } });

      // 1件目が完了するまで、2件目のextractZipFileはまだ呼ばれない(直列処理)
      await waitFor(() => expect(extractZipFileMock).toHaveBeenCalledTimes(1));
      expect(extractZipFileMock).toHaveBeenCalledWith(expect.anything(), expect.any(Function));

      resolveFirst({ ok: true, files: [{ name: "a.png", data: new Uint8Array(pngSignature) }] });
      await screen.findByText("a.png");

      // 1件目の完了後にようやく2件目が始まる
      await waitFor(() => expect(extractZipFileMock).toHaveBeenCalledTimes(2));

      resolveSecond({ ok: true, files: [{ name: "b.png", data: new Uint8Array(pngSignature) }] });
      await screen.findByText("b.png");

      expect(screen.getByText("a.png")).toBeInTheDocument();
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("extracts a dropped ZIP file through the worker client and adds the resulting images", async () => {
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    extractZipFileMock.mockReturnValue({
      result: Promise.resolve({
        ok: true,
        files: [
          { name: "img2.png", data: new Uint8Array(pngSignature) },
          { name: "img10.png", data: new Uint8Array(pngSignature) },
        ],
      }),
      cancel: jest.fn(),
    });

    try {
      render(<Home />);
      const zipFile = new File([new Uint8Array([1, 2, 3])], "photos.zip", {
        type: "application/zip",
      });
      const list = screen.getByRole("list");

      fireEvent.drop(list, { dataTransfer: { files: [zipFile] } });

      expect(await screen.findByText("img2.png")).toBeInTheDocument();
      expect(screen.getByText("img10.png")).toBeInTheDocument();
      expect(extractZipFileMock).toHaveBeenCalledTimes(1);
      expect(createImageBitmapMock).toHaveBeenCalledTimes(2);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("closes the bitmaps of ZIP-extracted images on delete and clear, same as regular uploads (P5-05 cleanup audit)", async () => {
    const user = userEvent.setup();
    const makeBitmap = () => ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap();
    const secondBitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    extractZipFileMock.mockReturnValue({
      result: Promise.resolve({
        ok: true,
        files: [
          { name: "img2.png", data: new Uint8Array(pngSignature) },
          { name: "img10.png", data: new Uint8Array(pngSignature) },
        ],
      }),
      cancel: jest.fn(),
    });

    try {
      render(<Home />);
      const zipFile = new File([new Uint8Array([1, 2, 3])], "photos.zip", {
        type: "application/zip",
      });
      const list = screen.getByRole("list");

      fireEvent.drop(list, { dataTransfer: { files: [zipFile] } });
      await screen.findByText("img10.png");

      await user.click(screen.getByRole("button", { name: "削除: img2.png" }));
      expect(firstBitmap.close).toHaveBeenCalledTimes(1);
      expect(secondBitmap.close).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "すべて削除" }));
      expect(secondBitmap.close).toHaveBeenCalledTimes(1);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("shows extraction progress and a cancel control while a ZIP is being processed, then clears it when cancelled", async () => {
    const user = userEvent.setup();
    let capturedOnProgress: ((stage: "scanning" | "extracting") => void) | undefined;
    const cancelMock = jest.fn();
    let resolveResult!: (outcome: { ok: false; reason: "cancelled" }) => void;
    const resultPromise = new Promise<{ ok: false; reason: "cancelled" }>((resolve) => {
      resolveResult = resolve;
    });
    extractZipFileMock.mockImplementation((_buffer: ArrayBuffer, onProgress: typeof capturedOnProgress) => {
      capturedOnProgress = onProgress;
      return { result: resultPromise, cancel: cancelMock };
    });

    render(<Home />);
    const zipFile = new File([new Uint8Array([1, 2, 3])], "photos.zip", {
      type: "application/zip",
    });
    const list = screen.getByRole("list");

    fireEvent.drop(list, { dataTransfer: { files: [zipFile] } });

    await waitFor(() => expect(capturedOnProgress).toBeDefined());
    act(() => capturedOnProgress?.("scanning"));
    expect(await screen.findByText("ZIPを確認中です")).toBeInTheDocument();

    act(() => capturedOnProgress?.("extracting"));
    expect(await screen.findByText("ZIPを展開中です")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(cancelMock).toHaveBeenCalledTimes(1);

    act(() => resolveResult({ ok: false, reason: "cancelled" }));
    await waitFor(() => expect(screen.queryByText("ZIPを展開中です")).not.toBeInTheDocument());
  });

  it("cancels an in-flight ZIP extraction's worker when the editor unmounts (not just suppressing the result)", async () => {
    const cancelMock = jest.fn();
    const pendingResult = new Promise(() => undefined); // never resolves
    extractZipFileMock.mockReturnValue({ result: pendingResult, cancel: cancelMock });

    const { unmount } = render(<Home />);
    const zipFile = new File([new Uint8Array([1, 2, 3])], "photos.zip", { type: "application/zip" });
    const list = screen.getByRole("list");

    fireEvent.drop(list, { dataTransfer: { files: [zipFile] } });
    await waitFor(() => expect(extractZipFileMock).toHaveBeenCalledTimes(1));

    expect(cancelMock).not.toHaveBeenCalled();

    unmount();

    expect(cancelMock).toHaveBeenCalledTimes(1);
  });

  it("reports a ZIP extraction failure without adding any images", async () => {
    extractZipFileMock.mockReturnValue({
      result: Promise.resolve({ ok: false, reason: "tooManyFiles" }),
      cancel: jest.fn(),
    });

    render(<Home />);
    const zipFile = new File([new Uint8Array([1, 2, 3])], "photos.zip", {
      type: "application/zip",
    });
    const list = screen.getByRole("list");

    fireEvent.drop(list, { dataTransfer: { files: [zipFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("photos.zip");
    expect(extractZipFileMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /削除:/ })).not.toBeInTheDocument();
  });

  it("prevents the browser's default file-open behavior while dragging over the image list", () => {
    render(<Home />);
    const list = screen.getByRole("list");

    const dragOverEvent = createEvent.dragOver(list, { dataTransfer: { files: [] } });
    fireEvent(list, dragOverEvent);

    expect(dragOverEvent.defaultPrevented).toBe(true);
  });

  it("removes only the clicked image and closes its bitmap", async () => {
    const user = userEvent.setup();
    const makeBitmap = () =>
      ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap();
    const secondBitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      await user.click(screen.getByRole("button", { name: "削除: first.png" }));

      expect(screen.queryByText("first.png")).not.toBeInTheDocument();
      expect(screen.getByText("second.png")).toBeInTheDocument();
      expect(firstBitmap.close).toHaveBeenCalledTimes(1);
      expect(secondBitmap.close).not.toHaveBeenCalled();
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("clears every image and closes all bitmaps when clearing all", async () => {
    const user = userEvent.setup();
    const makeBitmap = () =>
      ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap();
    const secondBitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      await user.click(screen.getByRole("button", { name: "すべて削除" }));

      expect(screen.queryByText("first.png")).not.toBeInTheDocument();
      expect(screen.queryByText("second.png")).not.toBeInTheDocument();
      expect(firstBitmap.close).toHaveBeenCalledTimes(1);
      expect(secondBitmap.close).toHaveBeenCalledTimes(1);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("opens the crop dialog from the row button and closes it on cancel, confirm, and reset", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "first.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("first.png");

      // キャンセル: ダイアログが閉じる
      await user.click(screen.getByRole("button", { name: "トリミング: first.png" }));
      expect(screen.getByRole("dialog", { name: "トリミング: first.png" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // 決定: ダイアログが閉じる
      lastCropperInstance = null;
      await user.click(screen.getByRole("button", { name: "トリミング: first.png" }));
      // cropperjsは動的importで読み込むため、インスタンス化がマイクロタスク1回分遅れる
      await waitFor(() => expect(lastCropperInstance).not.toBeNull());
      await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // リセット: ダイアログが閉じる
      await user.click(screen.getByRole("button", { name: "トリミング: first.png" }));
      await user.click(screen.getByRole("button", { name: "トリミングを解除" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("renders a downscaled live preview that updates as images are added", async () => {
    const user = userEvent.setup();
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap(640, 360);
    const secondBitmap = makeBitmap(640, 240);
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      const preview = await screen.findByRole("img", { name: "結合プレビュー" });
      const context = getMockContext(preview as HTMLCanvasElement);

      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(2));
      expect(preview).toHaveAttribute("width", "480");
      expect(preview).toHaveAttribute("height", "450");
      expect(context.fillRect).toHaveBeenCalledWith(0, 0, 480, 450);
      expect(context.drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 0, 0, 480, 270);
      expect(context.drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 0, 270, 480, 180);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("swaps the effective dimensions in the live preview after rotating an image 90 degrees", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 640, height: 360, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "first.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("first.png");

      const preview = await screen.findByRole("img", { name: "結合プレビュー" });
      const context = getMockContext(preview as HTMLCanvasElement);

      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(1));
      // 回転前: 640x360 (長辺640)を0.75倍に縮小 -> 480x270
      expect(preview).toHaveAttribute("width", "480");
      expect(preview).toHaveAttribute("height", "270");
      expect(context.drawImage).toHaveBeenNthCalledWith(1, bitmap, 0, 0, 480, 270);

      await user.click(screen.getByRole("button", { name: "右へ90°回転: first.png" }));

      // 回転後: 実効サイズが360x640に入れ替わり、同じ0.75倍で270x480になる
      await waitFor(() => expect(preview).toHaveAttribute("width", "270"));
      expect(preview).toHaveAttribute("height", "480");
      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(2));
      // クロップ/回転された画像は元のビットマップではなく、変換済みの中間canvasから描画される
      expect(context.drawImage).toHaveBeenNthCalledWith(2, expect.any(HTMLCanvasElement), 0, 0, 270, 480);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("keeps consistent relative proportions in the preview between a rotated image and an untransformed one (regression: 180-degree rotation must not change apparent size)", async () => {
    const user = userEvent.setup();
    const makeBitmap = () => ({ width: 1200, height: 800, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap();
    const secondBitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      const preview = await screen.findByRole("img", { name: "結合プレビュー" });
      const context = getMockContext(preview as HTMLCanvasElement);
      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(2));

      // 2枚目だけ180度回転する(寸法は変わらないはず)。回転を1回クリックする
      // たびにプレビューが再描画されるため、2回のクリックで6回描画されている
      await user.click(screen.getByRole("button", { name: "右へ90°回転: second.png" }));
      await user.click(screen.getByRole("button", { name: "右へ90°回転: second.png" }));

      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(6));
      const lastCallIndex = context.drawImage.mock.calls.length - 1;
      const firstPlacement = context.drawImage.mock.calls[lastCallIndex - 1];
      const secondPlacement = context.drawImage.mock.calls[lastCallIndex];

      // 180度回転しても寸法は変わらないため、2枚は同じ大きさで並ぶはず
      expect([firstPlacement[3], firstPlacement[4]]).toEqual([secondPlacement[3], secondPlacement[4]]);
      // 1200x800を縦に2枚(合計1200x1600)、長辺1600を480に収める0.3倍 -> 360x240
      expect(firstPlacement.slice(3)).toEqual([360, 240]);
      expect(secondPlacement.slice(3)).toEqual([360, 240]);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("switches to horizontal join and reflects it in the live preview", async () => {
    const user = userEvent.setup();
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap(360, 640);
    const secondBitmap = makeBitmap(240, 640);
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      const verticalButton = screen.getByRole("button", { name: "縦結合" });
      const horizontalButton = screen.getByRole("button", { name: "横結合" });
      expect(verticalButton).toHaveAttribute("aria-pressed", "true");
      expect(horizontalButton).toHaveAttribute("aria-pressed", "false");

      await user.click(horizontalButton);

      const preview = await screen.findByRole("img", { name: "結合プレビュー" });
      const context = getMockContext(preview as HTMLCanvasElement);

      await waitFor(() => expect(context.drawImage).toHaveBeenCalled());
      const lastCallIndex = context.drawImage.mock.calls.length - 1;
      expect(context.drawImage.mock.calls[lastCallIndex - 1]).toEqual([
        firstBitmap,
        0,
        0,
        270,
        480,
      ]);
      expect(context.drawImage.mock.calls[lastCallIndex]).toEqual([
        secondBitmap,
        270,
        0,
        180,
        480,
      ]);
      expect(horizontalButton).toHaveAttribute("aria-pressed", "true");
      expect(verticalButton).toHaveAttribute("aria-pressed", "false");
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("defaults to the original size mode and shows the current output dimensions", async () => {
    const user = userEvent.setup();
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap(200, 150);
    const secondBitmap = makeBitmap(100, 50);
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      expect(screen.getByRole("button", { name: "原寸" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "幅揃え" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "高さ揃え" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "カスタム" })).toHaveAttribute("aria-pressed", "false");

      // 原寸: 200x150を縦に積み、100x50をそのまま積んだ幅200・高さ200
      await waitFor(() =>
        expect(screen.getByText("出力サイズ: 200 × 200px(40,000px)")).toBeInTheDocument(),
      );
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("fits every image to the first image's width when fit-width is selected", async () => {
    const user = userEvent.setup();
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap(200, 150);
    const secondBitmap = makeBitmap(100, 50);
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      const preview = await screen.findByRole("img", { name: "結合プレビュー" });
      const context = getMockContext(preview as HTMLCanvasElement);
      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(2));

      await user.click(screen.getByRole("button", { name: "幅揃え" }));

      // 幅揃え: 100x50は最初の画像の幅200に合わせて200x100へ拡大される
      // -> 200x150 + 200x100 を縦に積んで幅200・高さ250(480以下なので等倍)
      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(4));
      expect(preview).toHaveAttribute("width", "200");
      expect(preview).toHaveAttribute("height", "250");
      const lastCallIndex = context.drawImage.mock.calls.length - 1;
      expect(context.drawImage.mock.calls[lastCallIndex - 1]).toEqual([firstBitmap, 0, 0, 200, 150]);
      expect(context.drawImage.mock.calls[lastCallIndex]).toEqual([secondBitmap, 0, 150, 200, 100]);
      await waitFor(() =>
        expect(screen.getByText("出力サイズ: 200 × 250px(50,000px)")).toBeInTheDocument(),
      );
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("fits every image to a user-entered custom width", async () => {
    const user = userEvent.setup();
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap(200, 150);
    const secondBitmap = makeBitmap(100, 50);
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      const preview = await screen.findByRole("img", { name: "結合プレビュー" });
      const context = getMockContext(preview as HTMLCanvasElement);
      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(2));

      await user.click(screen.getByRole("button", { name: "カスタム" }));
      const sizeInput = screen.getByLabelText("カスタムサイズ(px)");
      await user.clear(sizeInput);
      await user.type(sizeInput, "300");

      // カスタム(縦結合なので幅300指定): 200x150 -> 300x225, 100x50 -> 300x150
      // 合計 幅300・高さ375(480以下なので等倍)
      await waitFor(() =>
        expect(screen.getByText("出力サイズ: 300 × 375px(112,500px)")).toBeInTheDocument(),
      );
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("applies a user-entered gap and background color to the live preview", async () => {
    const user = userEvent.setup();
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap(200, 100);
    const secondBitmap = makeBitmap(200, 100);
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      const preview = await screen.findByRole("img", { name: "結合プレビュー" });
      const context = getMockContext(preview as HTMLCanvasElement);
      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(2));
      expect(preview).toHaveAttribute("height", "200");

      const gapInput = screen.getByLabelText("画像間隔(px)");
      expect(gapInput).toHaveValue(0);
      await user.clear(gapInput);
      await user.type(gapInput, "50");

      // 隙間50pxが加わり、合計高さが200から250になる
      await waitFor(() => expect(preview).toHaveAttribute("height", "250"));

      const backgroundInput = screen.getByLabelText("背景色");
      expect(backgroundInput).toHaveValue("#ffffff");
      // userEventはtype="color"の実際のカラーピッカー操作を模倣できないため、
      // 他のフォーム操作と同じchangeイベントの発火で値の変更を再現する
      fireEvent.change(backgroundInput, { target: { value: "#112233" } });

      await waitFor(() => expect(context.fillStyle).toBe("#112233"));
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("redraws the live preview in the new order after a drag-and-drop reorder", async () => {
    const user = userEvent.setup();
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap(640, 360);
    const secondBitmap = makeBitmap(640, 240);
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      const preview = await screen.findByRole("img", { name: "結合プレビュー" });
      const context = getMockContext(preview as HTMLCanvasElement);
      await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(2));
      const callsBeforeReorder = context.drawImage.mock.calls.length;

      expect(capturedSortableItems).toHaveLength(2);
      expect(capturedOnDragEnd).toBeDefined();

      act(() => {
        capturedOnDragEnd?.({
          active: { id: capturedSortableItems[0] },
          over: { id: capturedSortableItems[1] },
        });
      });

      expectListItemNames(["second.png", "first.png"]);
      await waitFor(() =>
        expect(context.drawImage.mock.calls.length).toBeGreaterThan(callsBeforeReorder),
      );
      const lastCallIndex = context.drawImage.mock.calls.length - 1;
      expect(context.drawImage.mock.calls[lastCallIndex - 1]).toEqual([
        secondBitmap,
        0,
        0,
        480,
        180,
      ]);
      expect(context.drawImage.mock.calls[lastCallIndex]).toEqual([
        firstBitmap,
        0,
        180,
        480,
        270,
      ]);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("shows a polite loading status while decoding and hides it once finished", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    let resolveBitmap!: (bitmap: ImageBitmap) => void;
    const pendingBitmap = new Promise<ImageBitmap>((resolve) => {
      resolveBitmap = resolve;
    });
    const createImageBitmapMock = jest.fn(() => pendingBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);
      const file = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "loading.png",
        { type: "image/png" },
      );

      await user.upload(screen.getByLabelText("画像を追加"), file);

      const status = await screen.findByText("画像を読み込み中です");
      expect(status).toHaveAttribute("aria-live", "polite");

      await act(async () => {
        resolveBitmap(bitmap);
        await pendingBitmap;
      });

      expect(screen.queryByText("画像を読み込み中です")).not.toBeInTheDocument();
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("keeps the loading status visible while a second batch is still in flight", async () => {
    const user = userEvent.setup();
    const makeBitmap = () =>
      ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    let resolveSlow!: (bitmap: ImageBitmap) => void;
    const slowBitmap = new Promise<ImageBitmap>((resolve) => {
      resolveSlow = resolve;
    });
    const fastBitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockImplementationOnce(() => slowBitmap)
      .mockImplementationOnce(async () => fastBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    try {
      render(<Home />);
      const slowFile = new File([png, "slow"], "slow.png", { type: "image/png" });
      const fastFile = new File([png, "fast"], "fast.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), slowFile);
      await screen.findByText("画像を読み込み中です");

      await user.upload(screen.getByLabelText("画像を追加"), fastFile);
      await waitFor(() => expect(createImageBitmapMock).toHaveBeenCalledTimes(2));

      // the second batch finishes decoding but must wait for the first batch
      // (started earlier) to commit before it is added to the list
      expect(screen.queryByText("fast.png")).not.toBeInTheDocument();
      expect(screen.getByText("画像を読み込み中です")).toBeInTheDocument();

      await act(async () => {
        resolveSlow(makeBitmap());
        await slowBitmap;
      });

      expectListItemNames(["slow.png", "fast.png"]);
      expect(screen.queryByText("画像を読み込み中です")).not.toBeInTheDocument();
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("does not deadlock a later batch when createImageBitmap throws synchronously for one file", async () => {
    const user = userEvent.setup();
    const makeBitmap = () =>
      ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    const goodBitmap = makeBitmap();
    const secondBatchBitmap = makeBitmap();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const goodFile = new File([png, "good"], "good.png", { type: "image/png" });
    const syncThrowFile = new File([png, "bad"], "sync-throw.png", {
      type: "image/png",
    });
    const secondBatchFile = new File([png, "second"], "second-batch.png", {
      type: "image/png",
    });

    // Some browsers throw synchronously from createImageBitmap for certain
    // inputs instead of returning a rejected promise. That synchronous throw
    // must not escape Promise.allSettled(...) and abort the whole batch, nor
    // skip the commit-queue handshake that later batches depend on.
    const createImageBitmapMock = jest.fn<Promise<ImageBitmap>, [ImageBitmapSource]>(
      (file) => {
        if (file === syncThrowFile) {
          throw new Error("synchronous decode failure");
        }
        if (file === goodFile) {
          return Promise.resolve(goodBitmap);
        }
        return Promise.resolve(secondBatchBitmap);
      },
    );
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });

    try {
      render(<Home />);

      // First batch: one file decodes fine, one throws synchronously inside
      // the createImageBitmap call used by Promise.allSettled(...map(...)).
      await user.upload(screen.getByLabelText("画像を追加"), [
        goodFile,
        syncThrowFile,
      ]);

      await waitFor(() =>
        expect(screen.getByText("good.png")).toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(screen.queryByText("画像を読み込み中です")).not.toBeInTheDocument(),
      );

      // Second, independent batch. If the first batch's synchronous throw
      // bypassed resolveMyTurn(), commitQueueRef.current never resolves and
      // this batch hangs forever awaiting `previousCommit`.
      await user.upload(screen.getByLabelText("画像を追加"), [secondBatchFile]);

      await waitFor(() =>
        expect(screen.getByText("second-batch.png")).toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(screen.queryByText("画像を読み込み中です")).not.toBeInTheDocument(),
      );
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("keeps images in the order their batches were started, even when a later batch finishes first", async () => {
    const user = userEvent.setup();
    const makeBitmap = () =>
      ({ width: 100, height: 100, close: jest.fn() }) as unknown as ImageBitmap;
    let resolveSlowFirst!: (bitmap: ImageBitmap) => void;
    let resolveSlowSecond!: (bitmap: ImageBitmap) => void;
    const slowFirst = new Promise<ImageBitmap>((resolve) => {
      resolveSlowFirst = resolve;
    });
    const slowSecond = new Promise<ImageBitmap>((resolve) => {
      resolveSlowSecond = resolve;
    });
    const fastBitmap = makeBitmap();
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockImplementationOnce(() => slowFirst)
      .mockImplementationOnce(() => slowSecond)
      .mockImplementationOnce(async () => fastBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    try {
      render(<Home />);
      const slowFiles = [
        new File([png, "slow-a"], "slow-a.png", { type: "image/png" }),
        new File([png, "slow-b"], "slow-b.png", { type: "image/png" }),
      ];
      const fastFile = new File([png, "fast"], "fast.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), slowFiles);
      await waitFor(() => expect(createImageBitmapMock).toHaveBeenCalledTimes(2));

      fireEvent.paste(document, {
        clipboardData: {
          items: [
            {
              kind: "file",
              type: "image/png",
              getAsFile: () => fastFile,
            },
          ],
        },
      });
      await waitFor(() => expect(createImageBitmapMock).toHaveBeenCalledTimes(3));

      // the pasted (fast) image finishes decoding before the slow file batch does,
      // but must not be committed to the list ahead of the earlier-started batch
      expect(screen.queryByText("fast.png")).not.toBeInTheDocument();

      await act(async () => {
        resolveSlowSecond(makeBitmap());
        resolveSlowFirst(makeBitmap());
        await Promise.all([slowFirst, slowSecond]);
      });

      expectListItemNames(["slow-a.png", "slow-b.png", "fast.png"]);
    } finally {
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("warns before allocating an output canvas above the pixel threshold, and cancels if not confirmed", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 11000, height: 10000, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const toBlobSpy = jest.spyOn(HTMLCanvasElement.prototype, "toBlob");
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "huge.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("huge.png");

      await user.click(screen.getByRole("button", { name: "PNGとして保存" }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(toBlobSpy).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
      toBlobSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("proceeds with the download above the pixel threshold once the user confirms", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 11000, height: 10000, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const toBlobSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback: BlobCallback) => callback(blob));
    const createObjectURLMock = jest.fn(() => "blob:mock-url");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURLMock });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "huge.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("huge.png");

      await user.click(screen.getByRole("button", { name: "PNGとして保存" }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(toBlobSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      confirmSpy.mockRestore();
      clickSpy.mockRestore();
      toBlobSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("copies the joined PNG to the clipboard when supported", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const toBlobSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback: BlobCallback) => callback(blob));
    copyPngBlobToClipboardMock.mockResolvedValue("copied");

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "first.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("first.png");

      await user.click(screen.getByRole("button", { name: "PNGとしてコピー" }));

      expect(copyPngBlobToClipboardMock).toHaveBeenCalledWith(blob);
      expect(await screen.findByText("クリップボードにコピーしました")).toBeInTheDocument();
    } finally {
      toBlobSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("falls back to downloading a PNG when clipboard copying is unavailable", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const toBlobSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback: BlobCallback) => callback(blob));
    const createObjectURLMock = jest.fn(() => "blob:mock-url");
    const revokeObjectURLMock = jest.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURLMock });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURLMock });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    copyPngBlobToClipboardMock.mockResolvedValue("unsupported");

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "first.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("first.png");

      await user.click(screen.getByRole("button", { name: "PNGとしてコピー" }));

      expect(await screen.findByText("クリップボードにコピーできなかったため、PNGとしてダウンロードしました")).toBeInTheDocument();
      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
      // クリップボードコピー失敗時のPNGフォールバックでもファイル名にタイムスタンプが付与される
      expect(anchor.download).toMatch(/^joined-image-\d{8}-\d{6}\.png$/);
    } finally {
      clickSpy.mockRestore();
      toBlobSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("checks the pixel-count threshold from metadata before allocating the crop/rotate transform canvas (regression: warning must come first)", async () => {
    const user = userEvent.setup();
    // 回転を伴う巨大画像。crop/rotationが設定されているとgetRenderSourceが
    // 変換用の中間canvasを確保・描画する(通常経路とは別の重い処理)
    const bitmap = { width: 11000, height: 10000, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "huge.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("huge.png");
      await user.click(screen.getByRole("button", { name: "右へ90°回転: huge.png" }));
      await waitFor(() => expect(confirmSpy).not.toHaveBeenCalled());

      const canvasCountBeforeDownload = canvasContexts.length;

      await user.click(screen.getByRole("button", { name: "PNGとして保存" }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      // キャンセルした場合、変換用の中間canvasも出力用canvasも一切確保されない
      expect(canvasContexts.length).toBe(canvasCountBeforeDownload);
    } finally {
      confirmSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("disables downloading and copying until at least one image is added", () => {
    render(<Home />);

    expect(screen.getByRole("button", { name: "PNGとして保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PNGとしてコピー" })).toBeDisabled();
  });

  it("joins added images vertically onto a canvas and downloads the result as a PNG", async () => {
    const user = userEvent.setup();
    const makeBitmap = (width: number, height: number) =>
      ({ width, height, close: jest.fn() }) as unknown as ImageBitmap;
    const firstBitmap = makeBitmap(640, 360);
    const secondBitmap = makeBitmap(640, 240);
    const createImageBitmapMock = jest
      .fn<Promise<ImageBitmap>, [ImageBitmapSource]>()
      .mockResolvedValueOnce(firstBitmap)
      .mockResolvedValueOnce(secondBitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const toBlobSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback: BlobCallback) => callback(blob));
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
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const files = [
        new File([png, "first"], "first.png", { type: "image/png" }),
        new File([png, "second"], "second.png", { type: "image/png" }),
      ];

      await user.upload(screen.getByLabelText("画像を追加"), files);
      await screen.findByText("second.png");

      const downloadButton = screen.getByRole("button", { name: "PNGとして保存" });
      expect(downloadButton).toBeEnabled();

      const canvasCountBeforeDownload = canvasContexts.length;

      await user.click(downloadButton);

      const downloadContext = canvasContexts[canvasCountBeforeDownload].context;
      expect(downloadContext.fillRect).toHaveBeenCalledWith(0, 0, 640, 600);
      expect(downloadContext.drawImage).toHaveBeenNthCalledWith(1, firstBitmap, 0, 0, 640, 360);
      expect(downloadContext.drawImage).toHaveBeenNthCalledWith(2, secondBitmap, 0, 360, 640, 240);
      expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), "image/png");
      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith(objectUrl);
    } finally {
      clickSpy.mockRestore();
      toBlobSpy.mockRestore();
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      });
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("downloads the PNG with a timestamped filename to avoid overwriting same-day downloads", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    const toBlobSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback: BlobCallback) => callback(blob));
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
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "first.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("first.png");

      await user.click(screen.getByRole("button", { name: "PNGとして保存" }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
      const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
      // 同日中に複数回保存しても上書きされないよう、ファイル名にタイムスタンプが付与される
      // (Dateをモックせずパターンのみ検証し、実行タイミングによるflakinessを避ける)
      expect(anchor.download).toMatch(/^joined-image-\d{8}-\d{6}\.png$/);
    } finally {
      clickSpy.mockRestore();
      toBlobSpy.mockRestore();
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      });
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("switches to JPEG export and downloads with the selected quality and a .jpg filename", async () => {
    const user = userEvent.setup();
    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const blob = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    const toBlobSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback: BlobCallback) => callback(blob));
    const createObjectURLMock = jest.fn(() => "blob:mock-url");
    const revokeObjectURLMock = jest.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURLMock });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURLMock });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    try {
      render(<Home />);
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([png], "first.png", { type: "image/png" });

      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("first.png");

      await user.click(screen.getByRole("button", { name: "JPEG" }));

      const qualityInput = screen.getByLabelText("JPEG品質");
      await user.clear(qualityInput);
      await user.type(qualityInput, "0.5");

      const downloadButton = screen.getByRole("button", { name: "JPEGとして保存" });
      await user.click(downloadButton);

      expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.5);
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);
      const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
      // JPEG保存でもファイル名にタイムスタンプが付与されることを確認する
      expect(anchor.download).toMatch(/^joined-image-\d{8}-\d{6}\.jpg$/);
    } finally {
      clickSpy.mockRestore();
      toBlobSpy.mockRestore();
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });

  it("does not send or remotely load user data while rendering", () => {
    const originalFetch = globalThis.fetch;
    const originalSendBeacon = navigator.sendBeacon;
    const fetchSpy = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const sendBeaconSpy = jest.fn<
      ReturnType<Navigator["sendBeacon"]>,
      Parameters<Navigator["sendBeacon"]>
    >(() => false);
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchSpy,
    });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });
    const xhrOpenSpy = jest
      .spyOn(XMLHttpRequest.prototype, "open")
      .mockImplementation(() => undefined);
    const xhrSendSpy = jest
      .spyOn(XMLHttpRequest.prototype, "send")
      .mockImplementation(() => undefined);

    try {
      const { container, unmount } = render(<Home />);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrOpenSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
      expect(
        Array.from(container.querySelectorAll("img"), (image) =>
          image.getAttribute("src"),
        ),
      ).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^https?:\/\//),
        ]),
      );

      unmount();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrOpenSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      xhrOpenSpy.mockRestore();
      xhrSendSpy.mockRestore();
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", {
          configurable: true,
          value: originalFetch,
        });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (originalSendBeacon) {
        Object.defineProperty(navigator, "sendBeacon", {
          configurable: true,
          value: originalSendBeacon,
        });
      } else {
        Reflect.deleteProperty(navigator, "sendBeacon");
      }
    }
  });

  it("does not send or remotely load user data through cropping, ZIP extraction, or clipboard copy (P6-04)", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const originalSendBeacon = navigator.sendBeacon;
    const fetchSpy = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const sendBeaconSpy = jest.fn<
      ReturnType<Navigator["sendBeacon"]>,
      Parameters<Navigator["sendBeacon"]>
    >(() => false);
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchSpy });
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeaconSpy });
    const xhrOpenSpy = jest.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(() => undefined);
    const xhrSendSpy = jest.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => undefined);

    const bitmap = { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap;
    const createImageBitmapMock = jest.fn(async () => bitmap);
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmapMock,
    });
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    extractZipFileMock.mockReturnValue({
      result: Promise.resolve({ ok: true, files: [{ name: "z.png", data: new Uint8Array(pngSignature) }] }),
      cancel: jest.fn(),
    });
    copyPngBlobToClipboardMock.mockResolvedValue("copied");
    const toBlobSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback: BlobCallback) => callback(new Blob(["x"], { type: "image/png" })));

    try {
      render(<Home />);
      const file = new File([new Uint8Array(pngSignature)], "first.png", { type: "image/png" });
      await user.upload(screen.getByLabelText("画像を追加"), [file]);
      await screen.findByText("first.png");

      // クロップ: 開いて決定
      await user.click(screen.getByRole("button", { name: "トリミング: first.png" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "切り抜きを適用" })).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "切り抜きを適用" }));

      // ZIP展開
      const zipFile = new File([new Uint8Array([1, 2, 3])], "photos.zip", { type: "application/zip" });
      fireEvent.drop(screen.getByRole("list"), { dataTransfer: { files: [zipFile] } });
      await screen.findByText("z.png");

      // クリップボードコピー
      await user.click(screen.getByRole("button", { name: "PNGとしてコピー" }));
      await screen.findByText("クリップボードにコピーしました");

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrOpenSpy).not.toHaveBeenCalled();
      expect(xhrSendSpy).not.toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    } finally {
      toBlobSpy.mockRestore();
      fetchSpy.mockRestore();
      xhrOpenSpy.mockRestore();
      xhrSendSpy.mockRestore();
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", { configurable: true, value: originalFetch });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      if (originalSendBeacon) {
        Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: originalSendBeacon });
      } else {
        Reflect.deleteProperty(navigator, "sendBeacon");
      }
      if (originalCreateImageBitmap) {
        Object.defineProperty(globalThis, "createImageBitmap", {
          configurable: true,
          value: originalCreateImageBitmap,
        });
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
    }
  });
});

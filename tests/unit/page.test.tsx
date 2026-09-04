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
    canvasContexts = [];
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(function (this: HTMLCanvasElement) {
        let entry = canvasContexts.find((candidate) => candidate.canvas === this);

        if (!entry) {
          entry = {
            canvas: this,
            context: { fillStyle: "", fillRect: jest.fn(), drawImage: jest.fn() },
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

  it("disables downloading until at least one image is added", () => {
    render(<Home />);

    expect(screen.getByRole("button", { name: "PNGとして保存" })).toBeDisabled();
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
});

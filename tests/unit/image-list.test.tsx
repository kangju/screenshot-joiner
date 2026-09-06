import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { ImageList } from "@/components/image-editor/ImageList";
import type { ImageItem } from "@/types/editor";

let capturedOnDragEnd: ((event: unknown) => void) | undefined;

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

const makeItem = (id: string): ImageItem => ({
  id,
  name: `${id}.png`,
  source: "file",
  blob: new Blob([id], { type: "image/png" }),
  bitmap: { width: 100, height: 100, close: jest.fn() } as unknown as ImageBitmap,
  originalWidth: 100,
  originalHeight: 100,
  crop: null,
  rotation: 0,
  targetWidth: null,
});

const mockMatchMedia = (matches: boolean) => {
  const originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  return () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  };
};

type MockCanvasContext = {
  fillStyle: string;
  fillRect: jest.Mock;
  drawImage: jest.Mock;
  translate: jest.Mock;
  rotate: jest.Mock;
};

describe("ImageList", () => {
  // サムネイル描画(ImageListRowのuseEffect)が実際にcontain(はみ出さない)矩形で
  // drawImageを呼んでいるかを検証するため、tests/unit/page.test.tsxと同じ
  // canvasモックパターンを導入する。canvasごとにコンテキストを記憶しておき、
  // レンダリング後にDOM上のcanvas要素と突き合わせて呼び出し内容を確認する
  let canvasContexts: Array<{ canvas: HTMLCanvasElement; context: MockCanvasContext }>;

  beforeEach(() => {
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
    // page.test.tsxと同じ順序上の理由: afterEachはinside-outで実行されるため、
    // モジュール読み込み時に登録されたRTLの自動cleanupより先にここで明示的に
    // cleanup()を呼び、getContextがまだモックされている間にunmountを終わらせる
    // (先にrestoreAllMocks()すると、残存するパッシブエフェクトがjsdom未実装の
    // 本物のgetContextを呼んで例外になりうる)
    cleanup();
    jest.restoreAllMocks();
  });

  it("always shows the delete button on a wide viewport and never shows an edit toggle", () => {
    const restore = mockMatchMedia(false);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.getByRole("button", { name: "削除: first.png" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "並べ替え・編集" })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("hydrates without a mismatch warning when the real viewport is narrower than the server saw, then syncs to the compact UI", () => {
    // Simulate the server: it has no real viewport, so matchMedia effectively reports
    // no match, and the component's deterministic initializer renders non-compact markup.
    // renderToString (not renderToStaticMarkup) is required here: it emits the text-node
    // boundary markers hydrateRoot needs, so this test only reports real hydration
    // mismatches rather than spurious ones caused by unmarked adjacent text nodes.
    const restoreServerMatchMedia = mockMatchMedia(false);
    const serverHtml = renderToString(
      <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
    );
    restoreServerMatchMedia();

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    // Now simulate the client: a real narrow viewport, which differs from what the
    // server-rendered markup assumed. Hydrating against that mismatched markup must not
    // produce a React hydration warning, since the initial client render is required to
    // reproduce the deterministic (non-compact) server output before the effect corrects it.
    const restoreClientMatchMedia = mockMatchMedia(true);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    let root: Root | undefined;

    try {
      act(() => {
        root = hydrateRoot(
          container,
          <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
        );
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // The effect still does its job after hydration: the UI syncs to the real
      // (compact) viewport.
      expect(within(container).getByRole("button", { name: "並べ替え・編集" })).toBeInTheDocument();
      expect(within(container).queryByRole("button", { name: "削除: first.png" })).not.toBeInTheDocument();
    } finally {
      act(() => {
        root?.unmount();
      });
      container.remove();
      consoleErrorSpy.mockRestore();
      restoreClientMatchMedia();
    }
  });

  it("hides the delete button on a narrow viewport until edit mode is toggled on", async () => {
    const user = userEvent.setup();
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.queryByRole("button", { name: "削除: first.png" })).not.toBeInTheDocument();
      const editButton = screen.getByRole("button", { name: "並べ替え・編集" });
      expect(editButton).toHaveAttribute("aria-pressed", "false");

      await user.click(editButton);

      expect(screen.getByRole("button", { name: "削除: first.png" })).toBeInTheDocument();
      const doneButton = screen.getByRole("button", { name: "完了" });
      expect(doneButton).toHaveAttribute("aria-pressed", "true");

      await user.click(doneButton);

      expect(screen.queryByRole("button", { name: "削除: first.png" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "並べ替え・編集" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("does not show the edit toggle on a narrow viewport when the list is empty", () => {
    const restore = mockMatchMedia(true);

    try {
      render(<ImageList items={[]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />);

      expect(screen.queryByRole("button", { name: "並べ替え・編集" })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("shows a drag handle per row only when row controls are visible", () => {
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.queryByRole("button", { name: "並べ替え: first.png" })).not.toBeInTheDocument();
    } finally {
      restore();
    }

    const restoreWide = mockMatchMedia(false);

    try {
      render(
        <ImageList items={[makeItem("second")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.getByRole("button", { name: "並べ替え: second.png" })).toHaveAttribute(
        "title",
        "並べ替え",
      );
    } finally {
      restoreWide();
    }
  });

  it("forwards the active and target ids to onReorder when a drag ends", () => {
    const restore = mockMatchMedia(false);
    const onReorder = jest.fn();

    try {
      render(
        <ImageList
          items={[makeItem("first"), makeItem("second")]}
          onAddFiles={jest.fn()}
          onRemove={jest.fn()}
          onReorder={onReorder}
          onRotate={jest.fn()}
          onCrop={jest.fn()}
        />,
      );

      expect(capturedOnDragEnd).toBeDefined();
      capturedOnDragEnd?.({ active: { id: "first" }, over: { id: "second" } });

      expect(onReorder).toHaveBeenCalledWith("first", "second");
    } finally {
      restore();
    }
  });

  it("does not call onReorder when a drag ends without a valid drop target", () => {
    const restore = mockMatchMedia(false);
    const onReorder = jest.fn();

    try {
      render(
        <ImageList
          items={[makeItem("first"), makeItem("second")]}
          onAddFiles={jest.fn()}
          onRemove={jest.fn()}
          onReorder={onReorder}
          onRotate={jest.fn()}
          onCrop={jest.fn()}
        />,
      );

      capturedOnDragEnd?.({ active: { id: "first" }, over: null });

      expect(onReorder).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("shows a rotate button per row only when row controls are visible", () => {
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList
          items={[makeItem("first")]}
          onAddFiles={jest.fn()}
          onRemove={jest.fn()}
          onReorder={jest.fn()}
          onRotate={jest.fn()}
          onCrop={jest.fn()}
        />,
      );

      expect(screen.queryByRole("button", { name: "右へ90°回転: first.png" })).not.toBeInTheDocument();
    } finally {
      restore();
    }

    const restoreWide = mockMatchMedia(false);

    try {
      render(
        <ImageList
          items={[makeItem("second")]}
          onAddFiles={jest.fn()}
          onRemove={jest.fn()}
          onReorder={jest.fn()}
          onRotate={jest.fn()}
          onCrop={jest.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "右へ90°回転: second.png" })).toHaveAttribute(
        "title",
        "右へ90°回転",
      );
    } finally {
      restoreWide();
    }
  });

  it("calls onRotate with the item id when the rotate button is clicked", async () => {
    const user = userEvent.setup();
    const restore = mockMatchMedia(false);
    const onRotate = jest.fn();

    try {
      render(
        <ImageList
          items={[makeItem("first")]}
          onAddFiles={jest.fn()}
          onRemove={jest.fn()}
          onReorder={jest.fn()}
          onRotate={onRotate}
          onCrop={jest.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: "右へ90°回転: first.png" }));

      expect(onRotate).toHaveBeenCalledWith("first");
    } finally {
      restore();
    }
  });

  it("shows a crop button per row only when row controls are visible", () => {
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList
          items={[makeItem("first")]}
          onAddFiles={jest.fn()}
          onRemove={jest.fn()}
          onReorder={jest.fn()}
          onRotate={jest.fn()}
          onCrop={jest.fn()}
        />,
      );

      expect(screen.queryByRole("button", { name: "トリミング: first.png" })).not.toBeInTheDocument();
    } finally {
      restore();
    }

    const restoreWide = mockMatchMedia(false);

    try {
      render(
        <ImageList
          items={[makeItem("second")]}
          onAddFiles={jest.fn()}
          onRemove={jest.fn()}
          onReorder={jest.fn()}
          onRotate={jest.fn()}
          onCrop={jest.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "トリミング: second.png" })).toHaveAttribute(
        "title",
        "トリミング",
      );
    } finally {
      restoreWide();
    }
  });

  it("calls onCrop with the item id when the crop button is clicked", async () => {
    const user = userEvent.setup();
    const restore = mockMatchMedia(false);
    const onCrop = jest.fn();

    try {
      render(
        <ImageList
          items={[makeItem("first")]}
          onAddFiles={jest.fn()}
          onRemove={jest.fn()}
          onReorder={jest.fn()}
          onRotate={jest.fn()}
          onCrop={onCrop}
        />,
      );

      await user.click(screen.getByRole("button", { name: "トリミング: first.png" }));

      expect(onCrop).toHaveBeenCalledWith("first");
    } finally {
      restore();
    }
  });

  it("keeps the filename visible (not visually hidden) on a wide viewport", () => {
    const restore = mockMatchMedia(false);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      const name = screen.getByText("first.png");
      expect(name.className.split(" ")).not.toContain("visually-hidden");
    } finally {
      restore();
    }
  });

  it("keeps the filename visible (not visually hidden) on a compact viewport even after entering edit mode", async () => {
    const user = userEvent.setup();
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: "並べ替え・編集" }));

      const name = screen.getByText("first.png");
      expect(name.className.split(" ")).not.toContain("visually-hidden");
    } finally {
      restore();
    }
  });

  it("shows the crop/rotation-adjusted image dimensions for an unmodified item", () => {
    const restore = mockMatchMedia(false);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      // makeItem("first")のbitmapは100x100、crop/rotationなしのため、
      // getTransformedSizeの結果は100x100のまま
      expect(screen.getByText("100×100")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("shows dimensions that reflect a cropped item's effective size, not the raw bitmap size", () => {
    const restore = mockMatchMedia(false);

    try {
      const croppedItem = {
        ...makeItem("first"),
        // crop有りの場合、getTransformedSizeはcropの幅・高さ(50x40)を
        // (rotation 0のため変化なく)そのまま返す
        crop: { x: 0, y: 0, width: 50, height: 40 },
      };

      render(
        <ImageList items={[croppedItem]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.getByText("50×40")).toBeInTheDocument();
      expect(screen.queryByText("100×100")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("shows visible text labels next to the rotate and crop buttons on a compact viewport in edit mode", async () => {
    const user = userEvent.setup();
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: "並べ替え・編集" }));

      // aria-label(「右へ90°回転: first.png」「トリミング: first.png」)は属性であり
      // getByTextの対象にならないため、ここで見つかるのは可視テキストラベルのみ
      expect(screen.getByText("回転")).toBeInTheDocument();
      expect(screen.getByText("トリミング")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("does not show visible text labels next to the rotate and crop buttons on a wide viewport", () => {
    const restore = mockMatchMedia(false);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.queryByText("回転")).not.toBeInTheDocument();
      expect(screen.queryByText("トリミング")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("draws the row thumbnail using a contain (non-cropping) scale centered within the canvas", () => {
    const restore = mockMatchMedia(false);
    // devicePixelRatioがjsdomで未定義のケースに依存せず、期待値の計算を単純にするため
    // 明示的に1へ固定する(本番コードはwindow.devicePixelRatio || 1でフォールバックする)
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });

    try {
      const wideItem = {
        ...makeItem("first"),
        // 非正方形(200x100)にすることで、cover(はみ出し埋め)とcontain(収める)の
        // 描画矩形が異なる値になり、テストが実際に両者を区別できることを保証する
        bitmap: { width: 200, height: 100, close: jest.fn() } as unknown as ImageBitmap,
      };

      const { container } = render(
        <ImageList items={[wideItem]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      const thumbCanvas = container.querySelector("canvas");
      expect(thumbCanvas).not.toBeNull();

      const entry = canvasContexts.find((candidate) => candidate.canvas === thumbCanvas);
      expect(entry).toBeDefined();

      // サムネイルcanvasは36x28(dpr=1)。200x100の元画像はmaxDimension=64で
      // 64x32に縮小される(transformed)。containスケールはmin(36/64, 28/32) = 0.5625で、
      // 描画サイズは36x18、幅方向はぴったり(オフセット0)、高さ方向は中央寄せで
      // (28-18)/2=5だけオフセットする(はみ出さず余白ができる)
      expect(entry?.context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 5, 36, 18);
    } finally {
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: originalDpr });
      restore();
    }
  });

  it("skips thumbnail drawing instead of calling drawImage with a zero-size rectangle", () => {
    const restore = mockMatchMedia(false);

    try {
      const zeroWidthItem = {
        ...makeItem("first"),
        // 幅0の異常なbitmapではcomputeContainScaleが0を返し、drawWidth/drawHeightも
        // 0になる。drawImageに幅/高さ0の矩形を渡すと例外になりうるため、描画自体を
        // スキップすることを検証する
        bitmap: { width: 0, height: 100, close: jest.fn() } as unknown as ImageBitmap,
      };

      const { container } = render(
        <ImageList items={[zeroWidthItem]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      const thumbCanvas = container.querySelector("canvas");
      const entry = canvasContexts.find((candidate) => candidate.canvas === thumbCanvas);

      expect(entry?.context.drawImage).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("shows short add-button guidance instead of drag&drop/paste text when the list is empty on a narrow viewport", () => {
    const restore = mockMatchMedia(true);

    try {
      render(<ImageList items={[]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />);

      expect(screen.getByText("「追加」から画像やZIPを選べます")).toBeInTheDocument();
      expect(screen.queryByText("この一覧に画像またはZIPをドラッグ&ドロップ")).not.toBeInTheDocument();
      expect(screen.queryByText(/Ctrl\+V/)).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("shows the add-button hint in the footer on a narrow viewport before entering edit mode", () => {
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.getByText("「追加」から画像やZIPを選べます")).toBeInTheDocument();
      expect(screen.queryByText(/ここに画像をドロップ/)).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("shows drag-handle guidance in the footer on a narrow viewport after entering edit mode", async () => {
    const user = userEvent.setup();
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: "並べ替え・編集" }));

      expect(screen.getByText("左のハンドルを長押しして並べ替え")).toBeInTheDocument();
      expect(screen.queryByText("「追加」から画像やZIPを選べます")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("keeps the original drag&drop/Ctrl+V footer hint unchanged on a wide viewport", () => {
    const restore = mockMatchMedia(false);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.getByText(/ここに画像をドロップ/)).toBeInTheDocument();
      expect(screen.queryByText("「追加」から画像やZIPを選べます")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });
});

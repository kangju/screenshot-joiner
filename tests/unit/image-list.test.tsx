import { act, render, screen, within } from "@testing-library/react";
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

describe("ImageList", () => {
  it("always shows the delete button on a wide viewport and never shows an edit toggle", () => {
    const restore = mockMatchMedia(false);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />,
      );

      expect(screen.getByRole("button", { name: "削除: first.png" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();
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
      expect(within(container).getByRole("button", { name: "編集" })).toBeInTheDocument();
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
      const editButton = screen.getByRole("button", { name: "編集" });
      expect(editButton).toHaveAttribute("aria-pressed", "false");

      await user.click(editButton);

      expect(screen.getByRole("button", { name: "削除: first.png" })).toBeInTheDocument();
      const doneButton = screen.getByRole("button", { name: "完了" });
      expect(doneButton).toHaveAttribute("aria-pressed", "true");

      await user.click(doneButton);

      expect(screen.queryByRole("button", { name: "削除: first.png" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("does not show the edit toggle on a narrow viewport when the list is empty", () => {
    const restore = mockMatchMedia(true);

    try {
      render(<ImageList items={[]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onRotate={jest.fn()} onCrop={jest.fn()} />);

      expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();
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

      expect(screen.queryByRole("button", { name: "回転: first.png" })).not.toBeInTheDocument();
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

      expect(screen.getByRole("button", { name: "回転: second.png" })).toHaveAttribute(
        "title",
        "回転",
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

      await user.click(screen.getByRole("button", { name: "回転: first.png" }));

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
});

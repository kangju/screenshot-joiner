import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

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
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} />,
      );

      expect(screen.getByRole("button", { name: "削除: first.png" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("hides the delete button on a narrow viewport until edit mode is toggled on", async () => {
    const user = userEvent.setup();
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} />,
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
      render(<ImageList items={[]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} />);

      expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("shows a drag handle per row only when row controls are visible", () => {
    const restore = mockMatchMedia(true);

    try {
      render(
        <ImageList items={[makeItem("first")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} />,
      );

      expect(screen.queryByRole("button", { name: "並べ替え: first.png" })).not.toBeInTheDocument();
    } finally {
      restore();
    }

    const restoreWide = mockMatchMedia(false);

    try {
      render(
        <ImageList items={[makeItem("second")]} onAddFiles={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} />,
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
        />,
      );

      capturedOnDragEnd?.({ active: { id: "first" }, over: null });

      expect(onReorder).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

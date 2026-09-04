"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Columns3, Download, Lock, Rows3 } from "lucide-react";

import { ImageList } from "@/components/image-editor/ImageList";
import { downloadBlob } from "@/lib/download";
import { isSupportedImageFile } from "@/lib/image-signature";
import {
  calculateHorizontalLayout,
  calculateVerticalLayout,
  computePreviewScale,
  scaleLayout,
} from "@/lib/layout";
import { renderJoinedImage } from "@/lib/render";

import {
  createInitialEditorState,
  editorReducer,
  type EditorState,
  type ImageItem,
} from "@/types/editor";

import styles from "./page.module.css";

const PREVIEW_MAX_DIMENSION = 480;

const createImageId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Home() {
  const mountedRef = useRef(true);
  const ownedBitmapsRef = useRef(new Set<ImageBitmap>());
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const commitQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [state, dispatch] = useReducer(
    editorReducer,
    undefined,
    createInitialEditorState,
  );
  const [rejectedFileNames, setRejectedFileNames] = useState<string[]>([]);

  const addImages = useCallback(async (
    files: File[],
    source: ImageItem["source"],
  ) => {
    if (files.length === 0) {
      return;
    }

    dispatch({ type: "processing/start" });

    // Reserve this batch's place in the commit order immediately (call order),
    // before any awaits, so a later-started batch can never commit ahead of it
    // even if its own validation/decode finishes first.
    const previousCommit = commitQueueRef.current;
    let resolveMyTurn!: () => void;
    commitQueueRef.current = new Promise<void>((resolve) => {
      resolveMyTurn = resolve;
    });

    const validationResults = await Promise.all(
      files.map(async (file) => ({ file, valid: await isSupportedImageFile(file) })),
    );
    const validFiles = validationResults.flatMap(({ file, valid }) =>
      valid ? [file] : [],
    );
    const invalidFileNames = validationResults.flatMap(({ file, valid }) =>
      valid ? [] : [file.name],
    );
    const results = await Promise.allSettled(
      validFiles.map((file) => Promise.resolve().then(() => createImageBitmap(file))),
    );
    const decodeFailureNames = results.flatMap((result, index) =>
      result.status === "rejected" ? [validFiles[index].name] : [],
    );

    await previousCommit;

    if (!mountedRef.current) {
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          result.value.close();
        }
      });
      dispatch({ type: "processing/end" });
      resolveMyTurn();
      return;
    }

    setRejectedFileNames([...invalidFileNames, ...decodeFailureNames]);
    validFiles.forEach((file, index) => {
      const result = results[index];

      if (result.status === "rejected") {
        return;
      }

      const bitmap = result.value;
      ownedBitmapsRef.current.add(bitmap);
      const item: ImageItem = {
        id: createImageId(),
        name: file.name,
        source,
        blob: file,
        bitmap,
        originalWidth: bitmap.width,
        originalHeight: bitmap.height,
        crop: null,
        rotation: 0,
        targetWidth: null,
      };

      dispatch({ type: "items/add", item });
    });
    dispatch({ type: "processing/end" });
    resolveMyTurn();
  }, []);

  useEffect(() => {
    const ownedBitmaps = ownedBitmapsRef.current;
    mountedRef.current = true;

    const handlePaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? []).flatMap((item) => {
        if (item.kind !== "file" || !item.type.startsWith("image/")) {
          return [];
        }

        const file = item.getAsFile();
        return file ? [file] : [];
      });

      void addImages(files, "paste");
    };

    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("paste", handlePaste);
      mountedRef.current = false;
      ownedBitmaps.forEach((bitmap) => bitmap.close());
      ownedBitmaps.clear();
    };
  }, [addImages]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (state.items.length === 0) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    const sizes = state.items.map((item) => ({
      width: item.bitmap.width,
      height: item.bitmap.height,
    }));
    const layout =
      state.direction === "vertical"
        ? calculateVerticalLayout(sizes, state.gap)
        : calculateHorizontalLayout(sizes, state.gap);
    const scale = computePreviewScale(layout, PREVIEW_MAX_DIMENSION);
    const previewLayout = scaleLayout(layout, scale);

    renderJoinedImage(
      canvas,
      previewLayout,
      state.items.map((item) => item.bitmap),
      state.background,
    );
  }, [state.items, state.direction, state.gap, state.background]);

  const handleAddFiles = (files: File[]) => {
    void addImages(files, "file");
  };

  const handleRemove = (id: string) => {
    const item = state.items.find((candidate) => candidate.id === id);

    if (item) {
      item.bitmap.close();
      ownedBitmapsRef.current.delete(item.bitmap);
    }

    dispatch({ type: "items/remove", id });
  };

  const handleClear = () => {
    state.items.forEach((item) => item.bitmap.close());
    ownedBitmapsRef.current.clear();
    dispatch({ type: "items/clear" });
  };

  const handleDirectionChange = (direction: EditorState["direction"]) => {
    dispatch({ type: "settings/direction", direction });
  };

  const handleReorder = (activeId: string, overId: string) => {
    dispatch({ type: "items/reorder", activeId, overId });
  };

  const handleDownload = useCallback(() => {
    if (state.items.length === 0) {
      return;
    }

    const sizes = state.items.map((item) => ({
      width: item.bitmap.width,
      height: item.bitmap.height,
    }));
    const layout =
      state.direction === "vertical"
        ? calculateVerticalLayout(sizes, state.gap)
        : calculateHorizontalLayout(sizes, state.gap);
    const canvas = document.createElement("canvas");

    renderJoinedImage(
      canvas,
      layout,
      state.items.map((item) => item.bitmap),
      state.background,
    );
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, "joined-image.png");
      }
    }, "image/png");
  }, [state.items, state.direction, state.gap, state.background]);

  return (
    <main>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.logo} aria-hidden="true">
            <Columns3 size={20} />
          </span>
          <h1 className={styles.title}>Screenshot Joiner</h1>
        </div>
        <div className={styles.headerActions}>
          <p className={styles.privacyBadge}>
            <Lock size={12} aria-hidden="true" />
            画像は端末内だけで処理されます。
          </p>
          <button
            type="button"
            className={styles.clearButton}
            disabled={state.items.length === 0}
            onClick={handleClear}
          >
            すべて削除
          </button>
        </div>
      </header>
      <div className={styles.layout}>
        <ImageList
          items={state.items}
          onAddFiles={handleAddFiles}
          onRemove={handleRemove}
          onReorder={handleReorder}
        />
        <div className={styles.rightColumn}>
          <div className={styles.directionGroup}>
            <button
              type="button"
              className={styles.directionButton}
              aria-pressed={state.direction === "vertical"}
              onClick={() => handleDirectionChange("vertical")}
            >
              <Rows3 size={14} aria-hidden="true" />
              縦結合
            </button>
            <button
              type="button"
              className={styles.directionButton}
              aria-pressed={state.direction === "horizontal"}
              onClick={() => handleDirectionChange("horizontal")}
            >
              <Columns3 size={14} aria-hidden="true" />
              横結合
            </button>
          </div>
          <div className={styles.preview}>
            <canvas
              ref={previewCanvasRef}
              role="img"
              aria-label="結合プレビュー"
              className={styles.previewCanvas}
            />
          </div>
          {state.processing > 0 && (
            <p aria-live="polite" className={styles.status}>
              画像を読み込み中です
            </p>
          )}
          {rejectedFileNames.length > 0 && (
            <p role="alert" className={styles.alert}>
              対応していない、または壊れた画像: {rejectedFileNames.join(", ")}
            </p>
          )}
          <div className={styles.exportBar}>
            <button
              type="button"
              className={styles.downloadButton}
              disabled={state.items.length === 0}
              onClick={handleDownload}
            >
              <Download size={16} aria-hidden="true" />
              PNGとして保存
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

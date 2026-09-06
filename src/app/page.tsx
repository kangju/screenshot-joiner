"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Clipboard, Columns3, Download, Lock, Rows3 } from "lucide-react";

import { CropDialog } from "@/components/image-editor/CropDialog";
import { ImageList } from "@/components/image-editor/ImageList";
import { buildTimestampedFilename, downloadBlob } from "@/lib/download";
import { getTransformedSize, renderTransformedImage } from "@/lib/image-transform";
import { isSupportedImageFile } from "@/lib/image-signature";
import { exceedsPixelThreshold } from "@/lib/output-guard";
import { copyPngBlobToClipboard } from "@/lib/clipboard";
import { DEFAULT_ZIP_LIMITS } from "@/lib/validation";
import { fitToHeight, fitToWidth, type Size } from "@/lib/resize";
import { extractZipFile } from "@/lib/zip-client";
import type { ZipExtractFailureReason, ZipExtractStage } from "@/workers/zip.worker";
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
  type CropRect,
  type EditorState,
  type ImageItem,
} from "@/types/editor";

import styles from "./page.module.css";

const PREVIEW_MAX_DIMENSION = 480;

const createImageId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// ZIP展開失敗時にユーザーへ表示する理由(暗号化・破損・非対応形式は
// まとめてunreadableとして扱う。詳細はdocs/Question.md参照)
const ZIP_FAILURE_MESSAGE: Record<ZipExtractFailureReason, string> = {
  unreadable: "展開できませんでした",
  nested: "ZIP内にZIPが含まれています",
  tooManyFiles: "画像の件数が上限を超えています",
  fileTooLarge: "含まれる画像が大きすぎます",
  totalTooLarge: "展開後の合計サイズが大きすぎます",
  archiveTooLarge: "ZIPファイル自体が大きすぎます",
};

const ZIP_STAGE_LABEL: Record<ZipExtractStage, string> = {
  scanning: "ZIPを確認中です",
  extracting: "ZIPを展開中です",
};

// クロップ・回転が未設定の画像はそのままのビットマップを使い、余計なcanvas
// 割り当てを避ける。どちらかが設定されている場合だけ、クロップ->回転の順で
// 変換した中間canvasを作る。
//
// 戻り値のwidth/heightは常に「変形後の原寸」(maxDimensionによる縮小の影響を
// 受けない)。レイアウト計算(画像同士の相対的な配置サイズ)は常にこの原寸を
// 基準にしないと、縮小された画像だけ他と比べて小さく配置されてしまう
// (実際にこのバグが一度発生し、Codexレビューで指摘された)。maxDimensionは
// 「実際に描画に使うcanvas(source)をどこまで縮小して確保するか」だけに
// 影響し、その縮小されたcanvasは最終的にdrawImageで正しい配置サイズへ
// 引き伸ばして描画されるため、見た目の縮尺には影響しない。
const getRenderSource = (
  item: ImageItem,
  maxDimension?: number,
): { source: CanvasImageSource; width: number; height: number } => {
  if (!item.crop && item.rotation === 0) {
    return { source: item.bitmap, width: item.bitmap.width, height: item.bitmap.height };
  }

  const fullSize = getTransformedSize({
    sourceWidth: item.bitmap.width,
    sourceHeight: item.bitmap.height,
    crop: item.crop,
    rotation: item.rotation,
  });
  const canvas = renderTransformedImage(
    () => document.createElement("canvas"),
    {
      source: item.bitmap,
      sourceWidth: item.bitmap.width,
      sourceHeight: item.bitmap.height,
      crop: item.crop,
      rotation: item.rotation,
    },
    maxDimension,
  );

  return { source: canvas, width: fullSize.width, height: fullSize.height };
};

// sizeMode="original"は無変換。fitWidth/fitHeightは常に最初の画像の幅/高さを
// 基準に他の画像を合わせる。customは結合方向に応じて幅(縦結合)または
// 高さ(横結合)をユーザー指定値に合わせる(基準の選び方はdocs/Question.md参照)。
const applySizeMode = (
  sizes: Size[],
  sizeMode: EditorState["sizeMode"],
  customSize: number | null,
  direction: EditorState["direction"],
): Size[] => {
  const [first] = sizes;

  if (!first || sizeMode === "original") {
    return sizes;
  }

  if (sizeMode === "fitWidth") {
    return sizes.map((size) => fitToWidth(size, first.width));
  }

  if (sizeMode === "fitHeight") {
    return sizes.map((size) => fitToHeight(size, first.height));
  }

  const target = customSize ?? (direction === "vertical" ? first.width : first.height);

  return direction === "vertical"
    ? sizes.map((size) => fitToWidth(size, target))
    : sizes.map((size) => fitToHeight(size, target));
};

export default function Home() {
  // アンマウント後に非同期処理の結果をstateへ反映しないためのフラグ
  const mountedRef = useRef(true);
  // このコンポーネントが生成したImageBitmapを追跡し、削除・クリア・アンマウント時に
  // close()し忘れてメモリリークするのを防ぐ
  const ownedBitmapsRef = useRef(new Set<ImageBitmap>());
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  // 複数のaddImages呼び出しが並行しても、state更新が呼び出し順どおりに
  // 行われることを保証するための直列化キュー
  const commitQueueRef = useRef<Promise<void>>(Promise.resolve());
  // ZIP展開は1件ずつ直列に処理する。並行処理を許すと、単一の状態である
  // zipStatus(進捗・キャンセル)を複数のZIPが奪い合ってしまうため
  const zipQueueRef = useRef<Promise<void>>(Promise.resolve());
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

    // このバッチのコミット順を、await前(=呼び出し順)の時点で即座に確保する。
    // こうしないと、後から呼ばれたバッチの検証・デコードが先に終わった場合に
    // 順序が入れ替わってしまう。
    const previousCommit = commitQueueRef.current;
    let resolveMyTurn!: () => void;
    commitQueueRef.current = new Promise<void>((resolve) => {
      resolveMyTurn = resolve;
    });

    // 署名(拡張子・MIMEタイプ・先頭バイト)を検証し、対応形式のファイルのみ残す
    const validationResults = await Promise.all(
      files.map(async (file) => ({ file, valid: await isSupportedImageFile(file) })),
    );
    const validFiles = validationResults.flatMap(({ file, valid }) =>
      valid ? [file] : [],
    );
    const invalidFileNames = validationResults.flatMap(({ file, valid }) =>
      valid ? [] : [file.name],
    );
    // 1件のデコード失敗が他のファイルを巻き込まないようallSettledを使う
    const results = await Promise.allSettled(
      validFiles.map((file) => Promise.resolve().then(() => createImageBitmap(file))),
    );
    const decodeFailureNames = results.flatMap((result, index) =>
      result.status === "rejected" ? [validFiles[index].name] : [],
    );

    // 前のバッチがstateへ反映されるまで待ち、コミット順序を維持する
    await previousCommit;

    // 待機中にアンマウントされていたら、デコード済みビットマップを破棄して終了する
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

  // クリップボード貼り付けの購読、および画像・マウント状態の後始末をまとめて行う
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
      // アンマウント時に保有中の全ビットマップを解放する
      ownedBitmaps.forEach((bitmap) => bitmap.close());
      ownedBitmaps.clear();
      // 実行中のZIP展開があれば、Worker自体も止める(mountedRef=falseだけでは
      // 結果の反映を抑制するのみで、Workerは動き続けてしまうため)
      zipCancelRef.current?.();
      zipCancelRef.current = null;
    };
  }, [addImages]);

  // FR-06の「出力予定の幅・高さ・総画素数を表示する」用。canvas描画を伴わない
  // 軽量な純粋計算のみで求めるため、実際のプレビュー描画effectとは独立させている
  const outputSize = useMemo(() => {
    if (state.items.length === 0) {
      return null;
    }

    const sizes = applySizeMode(
      state.items.map((item) =>
        getTransformedSize({
          sourceWidth: item.bitmap.width,
          sourceHeight: item.bitmap.height,
          crop: item.crop,
          rotation: item.rotation,
        }),
      ),
      state.sizeMode,
      state.customSize,
      state.direction,
    );
    const layout =
      state.direction === "vertical"
        ? calculateVerticalLayout(sizes, state.gap)
        : calculateHorizontalLayout(sizes, state.gap);

    // renderJoinedImageが実際にキャンバスを確保する際の丸め(Math.round)と
    // 一致させる。ここで丸めないと、小数を含むレイアウトで表示上の出力サイズが
    // 実際に生成されるPNG/JPEGの寸法とずれてしまう
    return { width: Math.round(layout.width), height: Math.round(layout.height) };
  }, [state.items, state.sizeMode, state.customSize, state.direction, state.gap]);

  // 画像一覧・並び方向・隙間・背景色・サイズモードの変更に追従してプレビューを再描画する
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

    // クロップ・回転済み画像の中間canvasも、原寸ではなくプレビューの上限で
    // 確保する(大きな画像を回転しただけでプレビューが大量のメモリを
    // 確保してしまわないようにするため)
    const rendered = state.items.map((item) => getRenderSource(item, PREVIEW_MAX_DIMENSION));
    const sizes = applySizeMode(
      rendered.map(({ width, height }) => ({ width, height })),
      state.sizeMode,
      state.customSize,
      state.direction,
    );
    const layout =
      state.direction === "vertical"
        ? calculateVerticalLayout(sizes, state.gap)
        : calculateHorizontalLayout(sizes, state.gap);
    // 実寸で描画すると重いため、プレビューはPREVIEW_MAX_DIMENSION以下に縮小する
    const scale = computePreviewScale(layout, PREVIEW_MAX_DIMENSION);
    const previewLayout = scaleLayout(layout, scale);

    renderJoinedImage(
      canvas,
      previewLayout,
      rendered.map(({ source }) => source),
      state.background,
    );
  }, [
    state.items,
    state.direction,
    state.gap,
    state.background,
    state.sizeMode,
    state.customSize,
  ]);

  const [zipStatus, setZipStatus] = useState<{
    stage: ZipExtractStage;
    cancel: () => void;
  } | null>(null);
  // 現在実行中のZIP展開のcancelハンドル。アンマウント時にWorkerを実際に
  // 停止するために保持する(mountedRefは結果の反映を抑制するだけで、
  // Worker自体は止めないため)
  const zipCancelRef = useRef<(() => void) | null>(null);

  // ZIPファイルを1件ずつ順番にWorkerで展開し、対応画像だけを既存の
  // addImagesパイプライン(署名検証・デコード・コミット順の直列化)に合流させる。
  // zipStatus(進捗・キャンセル)は1件分しか保持しないため、複数のZIPが
  // ドロップされても直列に処理する(zipQueueRef)
  const handleAddZip = useCallback(
    (zipFile: File) => {
      const previousInQueue = zipQueueRef.current;
      const runExtraction = previousInQueue.then(async () => {
        if (!mountedRef.current) {
          return;
        }

        // ZIPファイル自体のサイズを、読み込む(=メモリに確保する)前に確認する
        if (zipFile.size > DEFAULT_ZIP_LIMITS.maxArchiveCompressedBytes) {
          setRejectedFileNames((names) => [
            ...names,
            `${zipFile.name}(${ZIP_FAILURE_MESSAGE.archiveTooLarge})`,
          ]);
          return;
        }

        const buffer = await zipFile.arrayBuffer();

        if (!mountedRef.current) {
          return;
        }

        const { result, cancel } = extractZipFile(buffer, (stage) => {
          if (mountedRef.current) {
            setZipStatus({ stage, cancel });
          }
        });
        zipCancelRef.current = cancel;
        setZipStatus({ stage: "scanning", cancel });

        const outcome = await result;
        zipCancelRef.current = null;

        if (!mountedRef.current) {
          return;
        }

        setZipStatus(null);

        if (!outcome.ok) {
          const { reason } = outcome;

          if (reason !== "cancelled") {
            setRejectedFileNames((names) => [
              ...names,
              `${zipFile.name}(${ZIP_FAILURE_MESSAGE[reason]})`,
            ]);
          }
          return;
        }

        const extractedFiles = outcome.files.map((file) => {
          const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
          const mimeType = MIME_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
          const name = file.name.split("/").pop() ?? file.name;
          return new File([file.data], name, { type: mimeType });
        });

        await addImages(extractedFiles, "zip");
      });

      // 1件が例外を投げても、後続のZIPの処理は継続する
      zipQueueRef.current = runExtraction.catch(() => undefined);

      return runExtraction;
    },
    [addImages],
  );

  const handleAddFiles = (files: File[]) => {
    const zipFiles = files.filter((file) => file.name.toLowerCase().endsWith(".zip"));
    const otherFiles = files.filter((file) => !file.name.toLowerCase().endsWith(".zip"));

    if (otherFiles.length > 0) {
      void addImages(otherFiles, "file");
    }

    zipFiles.forEach((zipFile) => {
      void handleAddZip(zipFile);
    });
  };

  // 一覧から削除する画像のビットマップをここで明示的に解放する
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

  const handleGapChange = (event: ChangeEvent<HTMLInputElement>) => {
    const gap = Number(event.target.value);

    if (Number.isFinite(gap) && gap >= 0) {
      dispatch({ type: "settings/gap", gap });
    }
  };

  const handleBackgroundChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "settings/background", background: event.target.value });
  };

  const handleRotate = (id: string) => {
    dispatch({ type: "items/rotate", id });
  };

  const [croppingItemId, setCroppingItemId] = useState<string | null>(null);
  const croppingItem = state.items.find((item) => item.id === croppingItemId) ?? null;

  const handleCropOpen = (id: string) => {
    setCroppingItemId(id);
  };

  const handleCropCancel = () => {
    setCroppingItemId(null);
  };

  const handleCropConfirm = (id: string, crop: CropRect) => {
    dispatch({ type: "items/crop", id, crop });
    setCroppingItemId(null);
  };

  const handleCropReset = (id: string) => {
    dispatch({ type: "items/crop", id, crop: null });
    setCroppingItemId(null);
  };

  const handleSizeModeChange = (mode: EditorState["sizeMode"]) => {
    dispatch({ type: "settings/sizeMode", mode });
  };

  const handleCustomSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const size = Number(event.target.value);

    if (Number.isFinite(size) && size > 0) {
      dispatch({ type: "settings/customSize", size });
    }
  };

  const handleFormatChange = (format: EditorState["format"]) => {
    dispatch({ type: "settings/format", format });
  };

  const handleJpegQualityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const quality = Number(event.target.value);

    if (Number.isFinite(quality) && quality > 0 && quality <= 1) {
      dispatch({ type: "settings/jpegQuality", quality });
    }
  };

  // ダウンロード・コピー共通: プレビューと異なり縮小せず、実寸のレイアウトで
  // 描画したcanvasを返す。巨大な出力になる場合はcanvas確保前に警告する。
  //
  // サイズの計算(純粋な計算のみ)と、実際の変換canvasの確保・描画を
  // 明確に分離している。警告より前にgetRenderSource(=変換canvasの確保・
  // 描画)を呼んでしまうと、ユーザーが警告でキャンセルしてもその時点で
  // 既に重い確保・描画が走ってしまい、警告の意味がなくなるため。
  const buildOutputCanvas = useCallback((): HTMLCanvasElement | null => {
    if (state.items.length === 0) {
      return null;
    }

    const naturalSizes = state.items.map((item) =>
      getTransformedSize({
        sourceWidth: item.bitmap.width,
        sourceHeight: item.bitmap.height,
        crop: item.crop,
        rotation: item.rotation,
      }),
    );
    const sizes = applySizeMode(naturalSizes, state.sizeMode, state.customSize, state.direction);
    const layout =
      state.direction === "vertical"
        ? calculateVerticalLayout(sizes, state.gap)
        : calculateHorizontalLayout(sizes, state.gap);

    // 巨大なcanvasを確保する前に警告し、続行するかどうかをユーザーに確認する
    if (exceedsPixelThreshold({ width: layout.width, height: layout.height })) {
      const proceed = window.confirm(
        `出力画像のサイズが非常に大きくなります(${Math.round(layout.width)}×${Math.round(layout.height)}px)。続行しますか?`,
      );

      if (!proceed) {
        return null;
      }
    }

    // ここまでは純粋なサイズ計算のみ。承認された場合にのみ、実際に
    // 変換canvas(クロップ・回転済みの中間canvas)を確保・描画する
    const rendered = state.items.map((item) => getRenderSource(item));
    const canvas = document.createElement("canvas");

    renderJoinedImage(
      canvas,
      layout,
      rendered.map(({ source }) => source),
      state.background,
    );

    return canvas;
  }, [
    state.items,
    state.direction,
    state.gap,
    state.background,
    state.sizeMode,
    state.customSize,
  ]);

  const handleDownload = useCallback(() => {
    const canvas = buildOutputCanvas();

    if (!canvas) {
      return;
    }

    if (state.format === "jpeg") {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            downloadBlob(blob, buildTimestampedFilename("joined-image", "jpg"));
          }
        },
        "image/jpeg",
        state.jpegQuality,
      );
    } else {
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, buildTimestampedFilename("joined-image", "png"));
        }
      }, "image/png");
    }
  }, [buildOutputCanvas, state.format, state.jpegQuality]);

  const [copyStatus, setCopyStatus] = useState<"copied" | "fallback" | null>(null);

  // FR-08: 結合結果はPNGとしてのみクリップボードへコピーできる(state.formatに
  // 関わらずPNG固定)。コピーが使えない/失敗した場合はPNGダウンロードへ
  // フォールバックする(FR-08 / P5-02)
  const handleCopy = useCallback(() => {
    const canvas = buildOutputCanvas();

    if (!canvas) {
      return;
    }

    canvas.toBlob(async (blob) => {
      if (!blob) {
        return;
      }

      const result = await copyPngBlobToClipboard(blob);

      if (result === "copied") {
        setCopyStatus("copied");
      } else {
        downloadBlob(blob, buildTimestampedFilename("joined-image", "png"));
        setCopyStatus("fallback");
      }
    }, "image/png");
  }, [buildOutputCanvas]);

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
          onRotate={handleRotate}
          onCrop={handleCropOpen}
        />
        {croppingItem && (
          <CropDialog
            item={croppingItem}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
            onReset={handleCropReset}
          />
        )}
        <div className={styles.rightColumn}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>結合設定</h2>
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
            <div className={styles.sizeGroup}>
              <div className={styles.directionGroup}>
                <button
                  type="button"
                  className={styles.directionButton}
                  aria-pressed={state.sizeMode === "original"}
                  onClick={() => handleSizeModeChange("original")}
                >
                  原寸
                </button>
                <button
                  type="button"
                  className={styles.directionButton}
                  aria-pressed={state.sizeMode === "fitWidth"}
                  onClick={() => handleSizeModeChange("fitWidth")}
                >
                  幅揃え
                </button>
                <button
                  type="button"
                  className={styles.directionButton}
                  aria-pressed={state.sizeMode === "fitHeight"}
                  onClick={() => handleSizeModeChange("fitHeight")}
                >
                  高さ揃え
                </button>
                <button
                  type="button"
                  className={styles.directionButton}
                  aria-pressed={state.sizeMode === "custom"}
                  onClick={() => handleSizeModeChange("custom")}
                >
                  カスタム
                </button>
              </div>
              {state.sizeMode === "custom" && (
                <label className={styles.sizeInputLabel}>
                  カスタムサイズ(px)
                  <input
                    type="number"
                    min={1}
                    className={styles.sizeInput}
                    defaultValue={state.customSize ?? ""}
                    onChange={handleCustomSizeChange}
                  />
                </label>
              )}
            </div>
            <div className={styles.sizeGroup}>
              <label className={styles.sizeInputLabel}>
                画像間隔(px)
                <input
                  type="number"
                  min={0}
                  className={styles.sizeInput}
                  value={state.gap}
                  onChange={handleGapChange}
                />
              </label>
              <label className={styles.sizeInputLabel}>
                背景色
                <input
                  type="color"
                  className={styles.colorInput}
                  value={state.background}
                  onChange={handleBackgroundChange}
                />
              </label>
            </div>
            <div className={styles.sizeGroup}>
              <div className={styles.directionGroup}>
                <button
                  type="button"
                  className={styles.directionButton}
                  aria-pressed={state.format === "png"}
                  onClick={() => handleFormatChange("png")}
                >
                  PNG
                </button>
                <button
                  type="button"
                  className={styles.directionButton}
                  aria-pressed={state.format === "jpeg"}
                  onClick={() => handleFormatChange("jpeg")}
                >
                  JPEG
                </button>
              </div>
              {state.format === "jpeg" && (
                <label className={styles.sizeInputLabel}>
                  JPEG品質
                  <input
                    type="number"
                    min={0.01}
                    max={1}
                    step={0.01}
                    className={styles.sizeInput}
                    defaultValue={state.jpegQuality}
                    onChange={handleJpegQualityChange}
                  />
                </label>
              )}
            </div>
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>プレビュー</h2>
            <div className={styles.preview}>
              {state.items.length === 0 && (
                <div className={styles.previewEmpty}>
                  <span className={styles.previewEmptyIcon} aria-hidden="true">
                    <Columns3 size={20} />
                  </span>
                  <p className={styles.previewEmptyText}>
                    画像を追加すると、結合結果がここに表示されます
                  </p>
                </div>
              )}
              <canvas
                ref={previewCanvasRef}
                role="img"
                aria-label="結合プレビュー"
                className={styles.previewCanvas}
                hidden={state.items.length === 0}
              />
            </div>
            {state.processing > 0 && (
              <p aria-live="polite" className={styles.status}>
                画像を読み込み中です
              </p>
            )}
            {zipStatus && (
              <div aria-live="polite" className={styles.zipStatus}>
                <span>{ZIP_STAGE_LABEL[zipStatus.stage]}</span>
                <button type="button" className={styles.zipCancelButton} onClick={zipStatus.cancel}>
                  キャンセル
                </button>
              </div>
            )}
            {rejectedFileNames.length > 0 && (
              <p role="alert" className={styles.alert}>
                対応していない、または壊れた画像: {rejectedFileNames.join(", ")}
              </p>
            )}
            {outputSize && (
              <p className={styles.outputInfo}>
                出力サイズ: {outputSize.width} × {outputSize.height}px(
                {(outputSize.width * outputSize.height).toLocaleString("en-US")}px)
              </p>
            )}
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>書き出し</h2>
            {copyStatus && (
              <p aria-live="polite" className={styles.status}>
                {copyStatus === "copied"
                  ? "クリップボードにコピーしました"
                  : "クリップボードにコピーできなかったため、PNGとしてダウンロードしました"}
              </p>
            )}
            <div className={styles.exportBar}>
              <button
                type="button"
                className={styles.copyButton}
                disabled={state.items.length === 0}
                onClick={handleCopy}
              >
                <Clipboard size={16} aria-hidden="true" />
                PNGとしてコピー
              </button>
              <button
                type="button"
                className={styles.downloadButton}
                disabled={state.items.length === 0}
                onClick={handleDownload}
              >
                <Download size={16} aria-hidden="true" />
                {state.format === "jpeg" ? "JPEGとして保存" : "PNGとして保存"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

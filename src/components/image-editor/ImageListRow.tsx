"use client";

import { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crop, GripVertical, RotateCw, Trash2 } from "lucide-react";

import { getTransformedSize, renderTransformedImage } from "@/lib/image-transform";
import { computeContainScale } from "@/lib/resize";
import type { ImageItem } from "@/types/editor";

import styles from "./ImageList.module.css";

// 一覧サムネイルの表示サイズ(CSSのthumbクラスと一致させる)。実際の
// 描画解像度はdevicePixelRatioを掛けてキャンバスの見た目をシャープにする
const THUMB_WIDTH = 36;
const THUMB_HEIGHT = 28;
// サムネイルは小さいため、原寸ではなくこの上限まで縮小した中間canvasで
// クロップ・回転を行い、無駄なメモリ確保を避ける
const THUMB_SOURCE_MAX_DIMENSION = 64;

type ImageListRowProps = {
  item: ImageItem;
  showControls: boolean;
  isCompact: boolean;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onCrop: (id: string) => void;
};

// 一覧の1行分。dnd-kitのuseSortableでドラッグ操作を行としてバインドする。
export function ImageListRow({ item, showControls, isCompact, onRemove, onRotate, onCrop }: ImageListRowProps) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
    id: item.id,
  });
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    // インラインstyleのtransitionはCSSクラス側のtransitionを丸ごと上書きするため、
    // dnd-kitの並べ替えアニメーションとホバー等の背景色トランジション(ImageList.module.css
    // の.row)を連結して両方効かせる
    transition: [transition, "background-color var(--duration-fast) var(--ease-standard)"]
      .filter(Boolean)
      .join(", "),
    // ドラッグ中は半透明にして、元の位置と掴んでいる要素を視覚的に区別する
    opacity: isDragging ? 0.5 : 1,
  };

  // クロップ・回転を反映した実画像を一覧の小さなサムネイルとして描画する。
  // 汎用アイコンのままだと全行が同じ見た目になり、行を見分けられないため。
  // (jsdomはcanvas 2Dコンテキストを実装しておらずgetContextがnullを返すため、
  // テスト環境では自然に描画をスキップする)
  useEffect(() => {
    const canvas = thumbCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    // 幅・高さの再代入は同じ値でもcanvasの内容をリセットする(前回の描画を消す)
    canvas.width = THUMB_WIDTH * dpr;
    canvas.height = THUMB_HEIGHT * dpr;

    const transformed = renderTransformedImage(
      () => document.createElement("canvas"),
      {
        source: item.bitmap,
        sourceWidth: item.bitmap.width,
        sourceHeight: item.bitmap.height,
        crop: item.crop,
        rotation: item.rotation,
      },
      THUMB_SOURCE_MAX_DIMENSION,
    );

    // CSSのobject-fit: containと同様、アスペクト比を保ったまま枠内に収める(はみ出さない)
    const scale = computeContainScale(
      { width: transformed.width, height: transformed.height },
      { width: canvas.width, height: canvas.height },
    );
    const drawWidth = transformed.width * scale;
    const drawHeight = transformed.height * scale;

    // scaleが0(0幅/0高さの変形結果)のとき、drawImageに幅/高さ0の矩形を渡すと
    // 例外になりうるため描画をスキップする(空のcanvasのまま)
    if (drawWidth === 0 || drawHeight === 0) {
      return;
    }

    context.drawImage(
      transformed,
      (canvas.width - drawWidth) / 2,
      (canvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  }, [item.bitmap, item.crop, item.rotation]);

  const { width: transformedWidth, height: transformedHeight } = getTransformedSize({
    sourceWidth: item.bitmap.width,
    sourceHeight: item.bitmap.height,
    crop: item.crop,
    rotation: item.rotation,
  });

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isDragging ? `${styles.row} ${styles.rowDragging}` : styles.row}
    >
      <div className={styles.rowTop}>
        <canvas ref={thumbCanvasRef} className={styles.thumb} aria-hidden="true" />
        <div className={styles.rowInfo}>
          {/* ファイル名は常に見える通常テキスト(以前はvisually-hiddenで
              視覚的に隠すことがあったが、業務スクリーンショットが並ぶ実利用場面で
              行を識別できなくなるため廃止した)。長い場合はCSSのellipsisで
              省略し、title属性でフルネームを確認できる */}
          <span className={styles.name} title={item.name}>
            {item.name}
          </span>
          <span className={styles.dimensions}>
            {transformedWidth}×{transformedHeight}
          </span>
        </div>
      </div>
      {showControls && (
        <div className={styles.rowControls}>
          {/* 並べ替え用ハンドル。dnd-kitのattributes/listenersをそのまま渡すことで
              マウス・タッチ・キーボードいずれの操作でもドラッグを開始できる */}
          <button
            type="button"
            className={styles.rowHandle}
            aria-label={`並べ替え: ${item.name}`}
            title="並べ替え"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.rowRotate}
            aria-label={`右へ90°回転: ${item.name}`}
            title="右へ90°回転"
            onClick={() => onRotate(item.id)}
          >
            <RotateCw size={16} aria-hidden="true" />
            {isCompact && <span>回転</span>}
          </button>
          <button
            type="button"
            className={styles.rowCrop}
            aria-label={`トリミング: ${item.name}`}
            title="トリミング"
            onClick={() => onCrop(item.id)}
          >
            <Crop size={16} aria-hidden="true" />
            {isCompact && <span>トリミング</span>}
          </button>
          <button
            type="button"
            className={styles.rowDelete}
            aria-label={`削除: ${item.name}`}
            title="削除"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}

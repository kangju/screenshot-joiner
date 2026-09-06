"use client";

import { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crop, GripVertical, RotateCw, Trash2 } from "lucide-react";

import { renderTransformedImage } from "@/lib/image-transform";
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
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onCrop: (id: string) => void;
};

// 一覧の1行分。dnd-kitのuseSortableでドラッグ操作を行としてバインドする。
export function ImageListRow({ item, showControls, onRemove, onRotate, onCrop }: ImageListRowProps) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
    id: item.id,
  });
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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

    // CSSのobject-fit: coverと同様、アスペクト比を保ったまま余白なく埋める
    const scale = Math.max(canvas.width / transformed.width, canvas.height / transformed.height);
    const drawWidth = transformed.width * scale;
    const drawHeight = transformed.height * scale;

    context.drawImage(
      transformed,
      (canvas.width - drawWidth) / 2,
      (canvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  }, [item.bitmap, item.crop, item.rotation]);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isDragging ? `${styles.row} ${styles.rowDragging}` : styles.row}
    >
      {/* 並べ替え用ハンドル。dnd-kitのattributes/listenersをそのまま渡すことで
          マウス・タッチ・キーボードいずれの操作でもドラッグを開始できる */}
      {showControls && (
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
      )}
      <canvas ref={thumbCanvasRef} className={styles.thumb} aria-hidden="true" />
      {/* 操作ボタン表示中は320px固定幅の列に4ボタン分の余地がないため、
          ファイル名は視覚的にのみ隠す(visually-hiddenでDOM上はテキストを残し、
          各ボタンのaria-labelと合わせてスクリーンリーダーには引き続き伝わる) */}
      <span className={showControls ? `${styles.name} visually-hidden` : styles.name}>
        {item.name}
      </span>
      {showControls && (
        <button
          type="button"
          className={styles.rowRotate}
          aria-label={`回転: ${item.name}`}
          title="回転"
          onClick={() => onRotate(item.id)}
        >
          <RotateCw size={16} aria-hidden="true" />
        </button>
      )}
      {showControls && (
        <button
          type="button"
          className={styles.rowCrop}
          aria-label={`トリミング: ${item.name}`}
          title="トリミング"
          onClick={() => onCrop(item.id)}
        >
          <Crop size={16} aria-hidden="true" />
        </button>
      )}
      {showControls && (
        <button
          type="button"
          className={styles.rowDelete}
          aria-label={`削除: ${item.name}`}
          title="削除"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

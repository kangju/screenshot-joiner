"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Crop, GripVertical, Image as ImageIcon, RotateCw, Trash2 } from "lucide-react";

import type { ImageItem } from "@/types/editor";

import styles from "./ImageList.module.css";

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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // ドラッグ中は半透明にして、元の位置と掴んでいる要素を視覚的に区別する
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className={styles.row}>
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
      <span className={styles.thumb} aria-hidden="true">
        <ImageIcon size={16} />
      </span>
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

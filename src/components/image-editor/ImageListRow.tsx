"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Image as ImageIcon, Trash2 } from "lucide-react";

import type { ImageItem } from "@/types/editor";

import styles from "./ImageList.module.css";

type ImageListRowProps = {
  item: ImageItem;
  showControls: boolean;
  onRemove: (id: string) => void;
};

export function ImageListRow({ item, showControls, onRemove }: ImageListRowProps) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className={styles.row}>
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
      <span className={styles.name}>{item.name}</span>
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

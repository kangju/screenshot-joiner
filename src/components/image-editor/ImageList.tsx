"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Check, Image as ImageIcon, Pencil, Plus } from "lucide-react";

import type { ImageItem } from "@/types/editor";

import { ImageListRow } from "./ImageListRow";
import styles from "./ImageList.module.css";

const COMPACT_VIEWPORT_QUERY = "(max-width: 760px)";

// 狭い画面(スマホ幅など)かどうかを判定する。狭い画面では並べ替え/削除の
// 操作ボタンを常時表示せず、編集モードの切り替えで出し分ける。
const useIsCompactViewport = (): boolean => {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const handleChange = () => setIsCompact(mediaQueryList.matches);

    handleChange();
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, []);

  return isCompact;
};

type ImageListProps = {
  items: ImageItem[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onRotate: (id: string) => void;
  onCrop: (id: string) => void;
};

export function ImageList({ items, onAddFiles, onRemove, onReorder, onRotate, onCrop }: ImageListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCompact = useIsCompactViewport();
  const [isEditing, setIsEditing] = useState(false);
  const showRowControls = !isCompact || isEditing;

  // ポインター操作は誤クリックでドラッグが始まらないよう一定距離の移動を要求し、
  // タッチ操作はページスクロールと競合しないよう長押し(delay)を要求する
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string | number) =>
    items.find((item) => item.id === id)?.name ?? "";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAddFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLUListElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLUListElement>) => {
    event.preventDefault();
    onAddFiles(Array.from(event.dataTransfer.files));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    onReorder(String(active.id), String(over.id));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.count}>画像一覧・{items.length}枚</span>
        <div className={styles.headerButtons}>
          {isCompact && items.length > 0 && (
            <button
              type="button"
              className={styles.editButton}
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => !value)}
            >
              {isEditing ? (
                <>
                  <Check size={14} aria-hidden="true" />
                  完了
                </>
              ) : (
                <>
                  <Pencil size={14} aria-hidden="true" />
                  編集
                </>
              )}
            </button>
          )}
          <button
            type="button"
            className={styles.addButton}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={14} aria-hidden="true" />
            追加
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,application/zip,.zip"
        aria-label="画像を追加"
        className="visually-hidden"
        onChange={handleFileChange}
      />
      {items.length === 0 ? (
        <ul
          className={`${styles.list} ${styles.listEmpty}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <li className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <ImageIcon size={20} />
            </span>
            <p className={styles.emptyTitle}>この一覧に画像またはZIPをドラッグ&ドロップ</p>
            <p className={styles.emptyHint}>
              またはページ上で <kbd className={styles.kbd}>Ctrl+V</kbd>(Mac: <kbd className={styles.kbd}>Cmd+V</kbd>)で貼り付け
            </p>
          </li>
        </ul>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          // スクリーンリーダー向けにドラッグ操作の状態を都度読み上げさせる
          accessibility={{
            announcements: {
              onDragStart: ({ active }) => `${nameOf(active.id)}のドラッグを開始しました`,
              onDragOver: ({ active, over }) =>
                over
                  ? `${nameOf(active.id)}を${nameOf(over.id)}の位置へ移動中です`
                  : `${nameOf(active.id)}を並べ替え可能な範囲の外にドラッグしています`,
              onDragEnd: ({ active, over }) =>
                over && active.id !== over.id
                  ? `${nameOf(active.id)}を${nameOf(over.id)}の位置へ移動しました`
                  : `${nameOf(active.id)}の位置は変わりませんでした`,
              onDragCancel: ({ active }) => `${nameOf(active.id)}の並べ替えを取り消しました`,
            },
          }}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <ul
              className={`${styles.list} ${styles.listFilled}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {items.map((item) => (
                <ImageListRow
                  key={item.id}
                  item={item}
                  showControls={showRowControls}
                  onRemove={onRemove}
                  onRotate={onRotate}
                  onCrop={onCrop}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {items.length > 0 && (
        <p className={styles.hint}>
          ここに画像をドロップ、またはページ上で <kbd className={styles.kbd}>Ctrl+V</kbd>(Mac: <kbd className={styles.kbd}>Cmd+V</kbd>)で貼り付け
        </p>
      )}
    </div>
  );
}

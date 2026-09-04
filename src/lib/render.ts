import type { Layout } from "@/lib/layout";

export type CanvasLike = {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasRenderingContext2D | null;
};

export const renderJoinedImage = (
  canvas: CanvasLike,
  layout: Layout,
  images: CanvasImageSource[],
  background: string,
): void => {
  const width = Math.round(layout.width);
  const height = Math.round(layout.height);

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D描画コンテキストを取得できません");
  }

  // 背景色を敷いてから各画像を重ねて描画する(JPEG出力時に透過部分を塗りつぶすため)
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  // 座標・サイズは小数を含みうる(プレビュー縮小など)ため、
  // キャンバス描画時に丸めてピクセルのずれを防ぐ
  layout.placements.forEach((placement, index) => {
    context.drawImage(
      images[index],
      Math.round(placement.x),
      Math.round(placement.y),
      Math.round(placement.width),
      Math.round(placement.height),
    );
  });
};

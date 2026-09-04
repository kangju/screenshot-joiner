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
  canvas.width = layout.width;
  canvas.height = layout.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D描画コンテキストを取得できません");
  }

  context.fillStyle = background;
  context.fillRect(0, 0, layout.width, layout.height);

  layout.placements.forEach((placement, index) => {
    context.drawImage(
      images[index],
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    );
  });
};

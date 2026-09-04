export type PlacementInput = {
  width: number;
  height: number;
};

export type Placement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Layout = {
  width: number;
  height: number;
  placements: Placement[];
};

// 画像を縦に隙間なく(gap分だけ空けて)積み上げた配置を計算する。
// 全体の幅は最も幅の広い画像に合わせる。
export const calculateVerticalLayout = (
  images: PlacementInput[],
  gap: number,
): Layout => {
  let y = 0;
  const placements = images.map((image, index) => {
    if (index > 0) {
      y += gap;
    }

    const placement = { x: 0, y, width: image.width, height: image.height };
    y += image.height;
    return placement;
  });

  return {
    width: Math.max(0, ...images.map((image) => image.width)),
    height: y,
    placements,
  };
};

// 画像を横に並べた配置を計算する。全体の高さは最も高い画像に合わせる。
export const calculateHorizontalLayout = (
  images: PlacementInput[],
  gap: number,
): Layout => {
  let x = 0;
  const placements = images.map((image, index) => {
    if (index > 0) {
      x += gap;
    }

    const placement = { x, y: 0, width: image.width, height: image.height };
    x += image.width;
    return placement;
  });

  return {
    width: x,
    height: Math.max(0, ...images.map((image) => image.height)),
    placements,
  };
};

// レイアウト全体(サイズと各配置)を同じ倍率で拡大縮小する。
// プレビュー用に縮小した座標を作るために使う。
export const scaleLayout = (layout: Layout, scale: number): Layout => ({
  width: layout.width * scale,
  height: layout.height * scale,
  placements: layout.placements.map((placement) => ({
    x: placement.x * scale,
    y: placement.y * scale,
    width: placement.width * scale,
    height: placement.height * scale,
  })),
});

// プレビュー表示用の縮小率を求める。長辺がmaxDimensionを超える場合のみ縮小し、
// 収まっている場合は1(等倍)のまま拡大はしない。
export const computePreviewScale = (layout: Layout, maxDimension: number): number => {
  const longestSide = Math.max(layout.width, layout.height);

  if (longestSide === 0) {
    return 1;
  }

  return Math.min(1, maxDimension / longestSide);
};

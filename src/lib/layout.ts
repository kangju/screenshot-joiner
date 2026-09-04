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

export const computePreviewScale = (layout: Layout, maxDimension: number): number => {
  const longestSide = Math.max(layout.width, layout.height);

  if (longestSide === 0) {
    return 1;
  }

  return Math.min(1, maxDimension / longestSide);
};

import {
  calculateHorizontalLayout,
  calculateVerticalLayout,
  computePreviewScale,
  scaleLayout,
} from "@/lib/layout";

describe("calculateVerticalLayout", () => {
  it("returns an empty layout for no images", () => {
    expect(calculateVerticalLayout([], 0)).toEqual({
      width: 0,
      height: 0,
      placements: [],
    });
  });

  it("places a single image at the origin", () => {
    expect(calculateVerticalLayout([{ width: 640, height: 360 }], 0)).toEqual({
      width: 640,
      height: 360,
      placements: [{ x: 0, y: 0, width: 640, height: 360 }],
    });
  });

  it("stacks images top to bottom with zero gap and no overlap", () => {
    const layout = calculateVerticalLayout(
      [
        { width: 640, height: 360 },
        { width: 640, height: 240 },
      ],
      0,
    );

    expect(layout).toEqual({
      width: 640,
      height: 600,
      placements: [
        { x: 0, y: 0, width: 640, height: 360 },
        { x: 0, y: 360, width: 640, height: 240 },
      ],
    });
  });

  it("sets the canvas width to the widest image and left-aligns narrower images", () => {
    const layout = calculateVerticalLayout(
      [
        { width: 400, height: 100 },
        { width: 800, height: 200 },
      ],
      0,
    );

    expect(layout.width).toBe(800);
    expect(layout.placements.map((placement) => placement.x)).toEqual([0, 0]);
  });
});

describe("calculateHorizontalLayout", () => {
  it("returns an empty layout for no images", () => {
    expect(calculateHorizontalLayout([], 0)).toEqual({
      width: 0,
      height: 0,
      placements: [],
    });
  });

  it("places a single image at the origin", () => {
    expect(calculateHorizontalLayout([{ width: 640, height: 360 }], 0)).toEqual({
      width: 640,
      height: 360,
      placements: [{ x: 0, y: 0, width: 640, height: 360 }],
    });
  });

  it("lines images left to right with zero gap and no overlap", () => {
    const layout = calculateHorizontalLayout(
      [
        { width: 360, height: 640 },
        { width: 240, height: 640 },
      ],
      0,
    );

    expect(layout).toEqual({
      width: 600,
      height: 640,
      placements: [
        { x: 0, y: 0, width: 360, height: 640 },
        { x: 360, y: 0, width: 240, height: 640 },
      ],
    });
  });

  it("sets the canvas height to the tallest image and top-aligns shorter images", () => {
    const layout = calculateHorizontalLayout(
      [
        { width: 100, height: 400 },
        { width: 200, height: 800 },
      ],
      0,
    );

    expect(layout.height).toBe(800);
    expect(layout.placements.map((placement) => placement.y)).toEqual([0, 0]);
  });
});

describe("scaleLayout", () => {
  it("scales the canvas size and every placement by the given factor", () => {
    const layout = calculateVerticalLayout(
      [
        { width: 640, height: 360 },
        { width: 640, height: 240 },
      ],
      20,
    );

    const scaled = scaleLayout(layout, 0.5);

    expect(scaled).toEqual({
      width: 320,
      height: 310,
      placements: [
        { x: 0, y: 0, width: 320, height: 180 },
        { x: 0, y: 190, width: 320, height: 120 },
      ],
    });
  });

  it("returns an empty layout unchanged", () => {
    expect(scaleLayout({ width: 0, height: 0, placements: [] }, 0.5)).toEqual({
      width: 0,
      height: 0,
      placements: [],
    });
  });
});

describe("computePreviewScale", () => {
  it("returns 1 when the layout already fits within the maximum dimension", () => {
    const layout = { width: 300, height: 200, placements: [] };

    expect(computePreviewScale(layout, 480)).toBe(1);
  });

  it("shrinks the longest side down to the maximum dimension", () => {
    const layout = { width: 1200, height: 2400, placements: [] };

    expect(computePreviewScale(layout, 480)).toBe(0.2);
  });

  it("uses the widest side when width exceeds height", () => {
    const layout = { width: 2400, height: 300, placements: [] };

    expect(computePreviewScale(layout, 480)).toBe(0.2);
  });

  it("returns 1 for an empty layout", () => {
    expect(computePreviewScale({ width: 0, height: 0, placements: [] }, 480)).toBe(1);
  });
});

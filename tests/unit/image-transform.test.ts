import { getTransformedSize, renderTransformedImage } from "@/lib/image-transform";
import type { CanvasLike } from "@/lib/render";

const makeCanvas = () => {
  const context = {
    translate: jest.fn(),
    rotate: jest.fn(),
    drawImage: jest.fn(),
  };
  const canvas: CanvasLike = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context) as unknown as CanvasLike["getContext"],
  };
  return { canvas, context };
};

describe("getTransformedSize", () => {
  it("returns the source size when there is no crop and no rotation", () => {
    expect(
      getTransformedSize({ sourceWidth: 640, sourceHeight: 360, crop: null, rotation: 0 }),
    ).toEqual({ width: 640, height: 360 });
  });

  it("returns the crop size when a crop is set and there is no rotation", () => {
    expect(
      getTransformedSize({
        sourceWidth: 640,
        sourceHeight: 360,
        crop: { x: 10, y: 20, width: 200, height: 100 },
        rotation: 0,
      }),
    ).toEqual({ width: 200, height: 100 });
  });

  it("swaps the crop size for 90/270 degree rotation", () => {
    expect(
      getTransformedSize({
        sourceWidth: 640,
        sourceHeight: 360,
        crop: { x: 10, y: 20, width: 200, height: 100 },
        rotation: 90,
      }),
    ).toEqual({ width: 100, height: 200 });
  });

  it("shrinks the size to fit within maxDimension when the transformed size exceeds it", () => {
    expect(
      getTransformedSize(
        { sourceWidth: 4000, sourceHeight: 2000, crop: null, rotation: 0 },
        1000,
      ),
    ).toEqual({ width: 1000, height: 500 });
  });

  it("never rounds a positive dimension down to 0 for extreme aspect ratios (e.g. a 1x2000 crop shrunk to fit 480)", () => {
    // 素朴に round(1 * 480/2000) すると0になってしまうが、元の幅が0より
    // 大きい以上、縮小後も最低1pxは確保しなければならない(0幅canvasは
    // 描画できない)
    expect(
      getTransformedSize({ sourceWidth: 1, sourceHeight: 2000, crop: null, rotation: 0 }, 480),
    ).toEqual({ width: 1, height: 480 });
  });

  it("does not upscale when the transformed size is already within maxDimension", () => {
    expect(
      getTransformedSize({ sourceWidth: 200, sourceHeight: 100, crop: null, rotation: 0 }, 1000),
    ).toEqual({ width: 200, height: 100 });
  });
});

describe("renderTransformedImage", () => {
  it("draws the full source image centered when there is no crop and no rotation", () => {
    const { canvas, context } = makeCanvas();

    const result = renderTransformedImage(() => canvas, {
      source: "bitmap" as unknown as CanvasImageSource,
      sourceWidth: 640,
      sourceHeight: 360,
      crop: null,
      rotation: 0,
    });

    expect(result).toBe(canvas);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(context.translate).toHaveBeenCalledWith(320, 180);
    expect(context.rotate).toHaveBeenCalledWith(0);
    expect(context.drawImage).toHaveBeenCalledWith(
      "bitmap",
      0,
      0,
      640,
      360,
      -320,
      -180,
      640,
      360,
    );
  });

  it("crops first, then rotates the cropped content into a canvas sized for the rotated result", () => {
    const { canvas, context } = makeCanvas();

    renderTransformedImage(() => canvas, {
      source: "bitmap" as unknown as CanvasImageSource,
      sourceWidth: 640,
      sourceHeight: 360,
      crop: { x: 50, y: 60, width: 100, height: 50 },
      rotation: 90,
    });

    // 90度回転後のcanvasサイズはクロップ範囲の幅と高さが入れ替わる
    expect(canvas.width).toBe(50);
    expect(canvas.height).toBe(100);
    expect(context.translate).toHaveBeenCalledWith(25, 50);
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    // drawImageの元矩形はクロップ範囲、描画先はクロップの(回転前の)寸法で中央揃え
    expect(context.drawImage).toHaveBeenCalledWith(
      "bitmap",
      50,
      60,
      100,
      50,
      -50,
      -25,
      100,
      50,
    );
  });

  it("draws at a reduced size when maxDimension is smaller than the natural transformed size, without allocating a natural-size canvas", () => {
    const { canvas, context } = makeCanvas();

    renderTransformedImage(
      () => canvas,
      {
        source: "bitmap" as unknown as CanvasImageSource,
        sourceWidth: 4000,
        sourceHeight: 2000,
        crop: null,
        rotation: 0,
      },
      1000,
    );

    // 長辺4000を1000に収める0.25倍
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(500);
    expect(context.translate).toHaveBeenCalledWith(500, 250);
    expect(context.drawImage).toHaveBeenCalledWith("bitmap", 0, 0, 4000, 2000, -500, -250, 1000, 500);
  });

  it("applies maxDimension after rotation swaps the axis", () => {
    const { canvas, context } = makeCanvas();

    renderTransformedImage(
      () => canvas,
      {
        source: "bitmap" as unknown as CanvasImageSource,
        sourceWidth: 2000,
        sourceHeight: 4000,
        crop: null,
        rotation: 90,
      },
      1000,
    );

    // 回転後の実効サイズは4000x2000(長辺4000)。1000に収める0.25倍
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(500);
    expect(context.drawImage).toHaveBeenCalledWith("bitmap", 0, 0, 2000, 4000, -250, -500, 500, 1000);
  });

  it("throws when a 2D context is unavailable", () => {
    const canvas: CanvasLike = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => null) as CanvasLike["getContext"],
    };

    expect(() =>
      renderTransformedImage(() => canvas, {
        source: "bitmap" as unknown as CanvasImageSource,
        sourceWidth: 100,
        sourceHeight: 100,
        crop: null,
        rotation: 0,
      }),
    ).toThrow();
  });
});

import { renderJoinedImage, type CanvasLike } from "@/lib/render";
import { calculateVerticalLayout, scaleLayout } from "@/lib/layout";

describe("renderJoinedImage", () => {
  it("sizes the canvas to the layout, fills the background, and draws each image in order", () => {
    const context = {
      fillStyle: "",
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    };
    const canvas: CanvasLike = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => context) as unknown as CanvasLike["getContext"],
    };
    const images = ["first-bitmap", "second-bitmap"] as unknown as CanvasImageSource[];
    const layout = calculateVerticalLayout(
      [
        { width: 640, height: 360 },
        { width: 640, height: 240 },
      ],
      0,
    );

    renderJoinedImage(canvas, layout, images, "#ffffff");

    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(600);
    expect(context.fillStyle).toBe("#ffffff");
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 640, 600);
    expect(context.drawImage).toHaveBeenNthCalledWith(1, images[0], 0, 0, 640, 360);
    expect(context.drawImage).toHaveBeenNthCalledWith(2, images[1], 0, 360, 640, 240);
  });

  it("rounds fractional layout dimensions consistently between canvas size and draw calls", () => {
    const context = {
      fillStyle: "",
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    };
    const canvas: CanvasLike = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => context) as unknown as CanvasLike["getContext"],
    };
    const images = ["first-bitmap", "second-bitmap"] as unknown as CanvasImageSource[];
    const baseLayout = calculateVerticalLayout(
      [
        { width: 100, height: 40 },
        { width: 100, height: 72 },
      ],
      0,
    );
    // Mirrors how src/app/page.tsx derives the preview layout via
    // computePreviewScale + scaleLayout: an arbitrary fractional scale
    // produces non-integer width/height/placement values.
    const layout = scaleLayout(baseLayout, 1 / 3);

    // Sanity check that this layout is genuinely fractional.
    expect(Number.isInteger(layout.width)).toBe(false);
    expect(Number.isInteger(layout.height)).toBe(false);

    renderJoinedImage(canvas, layout, images, "#ffffff");

    // A real <canvas> element coerces width/height assignments to integers
    // per the HTML spec, so the backing store must end up as 33x37, not the
    // raw 33.333...x37.333... fractional layout values.
    expect(Number.isInteger(canvas.width)).toBe(true);
    expect(Number.isInteger(canvas.height)).toBe(true);
    expect(canvas.width).toBe(33);
    expect(canvas.height).toBe(37);

    // fillRect/drawImage must be called with the SAME rounded values as the
    // canvas size, not the raw fractional layout numbers, or the fill/draw
    // math diverges from the actual backing canvas size.
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 33, 37);
    expect(context.drawImage).toHaveBeenNthCalledWith(1, images[0], 0, 0, 33, 13);
    expect(context.drawImage).toHaveBeenNthCalledWith(2, images[1], 0, 13, 33, 24);
  });

  it("throws when a 2D context is unavailable", () => {
    const canvas: CanvasLike = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => null) as CanvasLike["getContext"],
    };

    expect(() =>
      renderJoinedImage(canvas, calculateVerticalLayout([], 0), [], "#ffffff"),
    ).toThrow();
  });
});

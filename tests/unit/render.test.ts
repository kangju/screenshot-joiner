import { renderJoinedImage, type CanvasLike } from "@/lib/render";
import { calculateVerticalLayout } from "@/lib/layout";

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

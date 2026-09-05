import { getRotatedSize } from "@/lib/rotation";

describe("getRotatedSize", () => {
  it("keeps width and height unchanged at 0 degrees", () => {
    expect(getRotatedSize({ width: 640, height: 360 }, 0)).toEqual({
      width: 640,
      height: 360,
    });
  });

  it("swaps width and height at 90 degrees", () => {
    expect(getRotatedSize({ width: 640, height: 360 }, 90)).toEqual({
      width: 360,
      height: 640,
    });
  });

  it("keeps width and height unchanged at 180 degrees", () => {
    expect(getRotatedSize({ width: 640, height: 360 }, 180)).toEqual({
      width: 640,
      height: 360,
    });
  });

  it("swaps width and height at 270 degrees", () => {
    expect(getRotatedSize({ width: 640, height: 360 }, 270)).toEqual({
      width: 360,
      height: 640,
    });
  });
});

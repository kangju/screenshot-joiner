import { exceedsPixelThreshold, hasInvalidOutputDimensions, MAX_OUTPUT_PIXELS } from "@/lib/output-guard";
import type { Layout } from "@/lib/layout";

describe("exceedsPixelThreshold", () => {
  it("returns false when the total pixel count is within the threshold", () => {
    expect(exceedsPixelThreshold({ width: 1000, height: 1000 })).toBe(false);
  });

  it("returns false when the total pixel count exactly equals the threshold", () => {
    const side = Math.sqrt(MAX_OUTPUT_PIXELS);

    expect(exceedsPixelThreshold({ width: side, height: side })).toBe(false);
  });

  it("returns true when the total pixel count exceeds the threshold", () => {
    const side = Math.sqrt(MAX_OUTPUT_PIXELS);

    expect(exceedsPixelThreshold({ width: side + 1, height: side })).toBe(true);
  });
});

describe("hasInvalidOutputDimensions", () => {
  const layoutOf = (
    width: number,
    height: number,
    placements: Layout["placements"] = [{ x: 0, y: 0, width, height }],
  ): Layout => ({ width, height, placements });

  it("returns false for an ordinary positive-integer layout", () => {
    expect(hasInvalidOutputDimensions(layoutOf(640, 480))).toBe(false);
  });

  it("returns false when dimensions round up to exactly 1px", () => {
    expect(hasInvalidOutputDimensions(layoutOf(0.6, 0.6))).toBe(false);
  });

  it("returns true when the overall width rounds down to 0px", () => {
    expect(hasInvalidOutputDimensions(layoutOf(0.4, 100))).toBe(true);
  });

  it("returns true when the overall height rounds down to 0px", () => {
    expect(hasInvalidOutputDimensions(layoutOf(100, 0.4))).toBe(true);
  });

  it("returns true when width is not finite (e.g. NaN from an empty custom-size input)", () => {
    expect(hasInvalidOutputDimensions(layoutOf(Number.NaN, 100))).toBe(true);
  });

  it("returns true when the overall size is positive but one placement collapses to 0px", () => {
    // 全体は幅2・高さ20で正だが、1件目のplacementは高さが0.0002->0に丸まる
    const layout = layoutOf(2, 20, [
      { x: 0, y: 0, width: 2, height: 0.0002 },
      { x: 0, y: 1, width: 2, height: 20 },
    ]);

    expect(hasInvalidOutputDimensions(layout)).toBe(true);
  });

  it("returns false when every placement rounds to at least 1px", () => {
    const layout = layoutOf(2, 21, [
      { x: 0, y: 0, width: 2, height: 1 },
      { x: 0, y: 1, width: 2, height: 20 },
    ]);

    expect(hasInvalidOutputDimensions(layout)).toBe(false);
  });
});

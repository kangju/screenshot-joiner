import { exceedsPixelThreshold, MAX_OUTPUT_PIXELS } from "@/lib/output-guard";

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

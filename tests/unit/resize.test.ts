import { fitToHeight, fitToWidth } from "@/lib/resize";

describe("fitToWidth", () => {
  it("scales height to match the target width while preserving aspect ratio", () => {
    expect(fitToWidth({ width: 640, height: 360 }, 320)).toEqual({
      width: 320,
      height: 180,
    });
  });

  it("upscales when the target width is larger than the source", () => {
    expect(fitToWidth({ width: 320, height: 180 }, 640)).toEqual({
      width: 640,
      height: 360,
    });
  });

  it("returns a zero-height result for a zero-width source", () => {
    expect(fitToWidth({ width: 0, height: 200 }, 400)).toEqual({
      width: 400,
      height: 0,
    });
  });
});

describe("fitToHeight", () => {
  it("scales width to match the target height while preserving aspect ratio", () => {
    expect(fitToHeight({ width: 360, height: 640 }, 320)).toEqual({
      width: 180,
      height: 320,
    });
  });

  it("upscales when the target height is larger than the source", () => {
    expect(fitToHeight({ width: 180, height: 320 }, 640)).toEqual({
      width: 360,
      height: 640,
    });
  });

  it("returns a zero-width result for a zero-height source", () => {
    expect(fitToHeight({ width: 200, height: 0 }, 400)).toEqual({
      width: 0,
      height: 400,
    });
  });
});

import { compareNatural } from "@/lib/natural-sort";

describe("compareNatural", () => {
  it("orders numeric suffixes numerically rather than lexicographically", () => {
    const names = ["img10.png", "img2.png", "img1.png"];

    expect([...names].sort(compareNatural)).toEqual(["img1.png", "img2.png", "img10.png"]);
  });

  it("keeps plain alphabetical order when there are no digits", () => {
    const names = ["banana.png", "apple.png", "cherry.png"];

    expect([...names].sort(compareNatural)).toEqual(["apple.png", "banana.png", "cherry.png"]);
  });

  it("compares multiple numeric runs left to right", () => {
    const names = ["a2-b10.png", "a2-b2.png", "a10-b1.png"];

    expect([...names].sort(compareNatural)).toEqual(["a2-b2.png", "a2-b10.png", "a10-b1.png"]);
  });

  it("treats equal strings as equal", () => {
    expect(compareNatural("same.png", "same.png")).toBe(0);
  });

  it("ignores leading zeros in numeric runs", () => {
    const names = ["img009.png", "img10.png", "img2.png"];

    expect([...names].sort(compareNatural)).toEqual(["img2.png", "img009.png", "img10.png"]);
  });

  it("breaks ties deterministically when numeric runs are equal in value but differ in padding", () => {
    // "9"と"009"は数値としては等しいため、これだけでは順序が決まらない。
    // 桁数によるタイブレークがないと、入力順(ZIPの格納順など)に依存した
    // 非決定的な並びになってしまう。
    expect(compareNatural("img9.png", "img009.png")).not.toBe(0);
    expect(compareNatural("img9.png", "img009.png")).toBe(
      -compareNatural("img009.png", "img9.png"),
    );
    expect([...["img009.png", "img9.png"]].sort(compareNatural)).toEqual([
      "img9.png",
      "img009.png",
    ]);
  });
});

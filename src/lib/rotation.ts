export type Size = {
  width: number;
  height: number;
};

// 90/270度回転では表示上の幅と高さが入れ替わる。0/180度は変化しない。
export const getRotatedSize = (
  size: Size,
  rotation: 0 | 90 | 180 | 270,
): Size =>
  rotation === 90 || rotation === 270
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };

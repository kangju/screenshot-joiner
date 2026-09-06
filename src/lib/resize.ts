export type Size = {
  width: number;
  height: number;
};

// 指定した幅に合わせて縦横比を維持したまま高さを算出する。
export const fitToWidth = (size: Size, targetWidth: number): Size => {
  if (size.width === 0) {
    return { width: targetWidth, height: 0 };
  }

  const scale = targetWidth / size.width;
  return { width: targetWidth, height: size.height * scale };
};

// 指定した高さに合わせて縦横比を維持したまま幅を算出する。
export const fitToHeight = (size: Size, targetHeight: number): Size => {
  if (size.height === 0) {
    return { width: 0, height: targetHeight };
  }

  const scale = targetHeight / size.height;
  return { width: size.width * scale, height: targetHeight };
};

// 枠(box)にsourceをはみ出さず収める(object-fit: containと同様)ためのスケールを算出する。
// sourceの幅または高さが0だと除算でInfinity/NaNになり描画が壊れるため、
// fitToWidth/fitToHeightと同様に0を安全な値へガードする。
export const computeContainScale = (source: Size, box: Size): number => {
  if (source.width === 0 || source.height === 0) {
    return 0;
  }

  return Math.min(box.width / source.width, box.height / source.height);
};

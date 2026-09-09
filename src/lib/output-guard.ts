import type { Layout } from "./layout";

// 出力予定のcanvasを確保する前に確認する総画素数のしきい値(1億px)。
// ブラウザのcanvasサイズ上限に対して十分安全側の余裕を持たせた値。
export const MAX_OUTPUT_PIXELS = 100_000_000;

export type OutputSize = {
  width: number;
  height: number;
};

// 出力予定の総画素数がしきい値を超えるかどうかを判定する純粋関数。
// canvasを実際に確保する前に呼び出し、超える場合は警告を出す。
export const exceedsPixelThreshold = (size: OutputSize): boolean =>
  size.width * size.height > MAX_OUTPUT_PIXELS;

// renderJoinedImageが実際に行うMath.round後、canvasとして確保可能な
// 1px以上の整数になるかどうかを判定する純粋関数。全体サイズだけでなく、
// 各placementの丸め後の寸法も確認する(全体は正でも、極端な入力では
// 個別画像だけ0pxに丸まりうるため)。canvasを実際に確保する前に呼び出す。
const isInvalidSize = (value: number): boolean =>
  !Number.isFinite(value) || Math.round(value) < 1;

export const hasInvalidOutputDimensions = (layout: Layout): boolean => {
  if (isInvalidSize(layout.width) || isInvalidSize(layout.height)) {
    return true;
  }

  return layout.placements.some(
    (placement) => isInvalidSize(placement.width) || isInvalidSize(placement.height),
  );
};

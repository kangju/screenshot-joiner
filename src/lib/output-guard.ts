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

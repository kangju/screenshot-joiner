import { getRotatedSize } from "@/lib/rotation";
import type { CanvasLike } from "@/lib/render";
import type { CropRect } from "@/types/editor";

export type TransformInput = {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  crop: CropRect | null;
  rotation: 0 | 90 | 180 | 270;
};

// クロップ・回転後の実効サイズ(結合レイアウトへの入力サイズとして使う)。
// maxDimensionを指定すると、長辺がそれを超えないよう縮小したサイズを返す
// (プレビュー用: 巨大な原寸のまま中間canvasを確保しないようにするため)。
export const getTransformedSize = (
  input: Pick<TransformInput, "sourceWidth" | "sourceHeight" | "crop" | "rotation">,
  maxDimension?: number,
): { width: number; height: number } => {
  const croppedSize = input.crop ?? { width: input.sourceWidth, height: input.sourceHeight };
  const rotated = getRotatedSize(croppedSize, input.rotation);

  if (!maxDimension) {
    return rotated;
  }

  const scale = Math.min(1, maxDimension / Math.max(rotated.width, rotated.height));

  // 縦横比が極端な画像(例: 幅1px)では、縮小丸めにより短辺が0になりうる。
  // 元の辺が0より大きいなら、縮小後も最低1pxは確保する(0幅/0高さの
  // canvasは描画できない)。
  return {
    width: rotated.width > 0 ? Math.max(1, Math.round(rotated.width * scale)) : 0,
    height: rotated.height > 0 ? Math.max(1, Math.round(rotated.height * scale)) : 0,
  };
};

// 元画像からクロップ範囲を切り出し、その内容を回転させて新しいcanvasに描画する。
// 「先にクロップ、その後に回転」の順序を固定することで結果が一意に決まる
// (クロップ矩形は常に回転前の元画像座標で保持されているため)。
//
// maxDimensionを指定すると、その長辺に収まるよう縮小して描画する。プレビューは
// 表示上どうせ縮小されるため、原寸の中間canvasを毎回確保するのは無駄が大きく
// (巨大な回転・クロップ済み画像ではメモリを圧迫しうる)、描画そのものを
// 縮小後のサイズで行うことでその確保を避ける。
export const renderTransformedImage = <C extends CanvasLike>(
  createCanvas: () => C,
  input: TransformInput,
  maxDimension?: number,
): C => {
  const cropRect: CropRect = input.crop ?? {
    x: 0,
    y: 0,
    width: input.sourceWidth,
    height: input.sourceHeight,
  };
  const naturalRotated = getRotatedSize(
    { width: cropRect.width, height: cropRect.height },
    input.rotation,
  );
  const { width, height } = getTransformedSize(input, maxDimension);
  const scale = naturalRotated.width === 0 ? 1 : width / naturalRotated.width;

  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D描画コンテキストを取得できません");
  }

  // 回転後の寸法に合わせたcanvasの中心を原点として回転させ、クロップ範囲を
  // (回転前の寸法のまま、必要なら縮小して)中央揃えで描画する
  context.translate(width / 2, height / 2);
  context.rotate((input.rotation * Math.PI) / 180);
  context.drawImage(
    input.source,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    (-cropRect.width * scale) / 2,
    (-cropRect.height * scale) / 2,
    cropRect.width * scale,
    cropRect.height * scale,
  );

  return canvas;
};

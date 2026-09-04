const IMAGE_FORMATS = {
  png: {
    extensions: ["png"],
    mimeTypes: ["image/png"],
  },
  jpeg: {
    extensions: ["jpg", "jpeg"],
    mimeTypes: ["image/jpeg"],
  },
  webp: {
    extensions: ["webp"],
    mimeTypes: ["image/webp"],
  },
} as const;

type ImageFormat = keyof typeof IMAGE_FORMATS;

// ファイル名の拡張子から形式を推測する
const formatFromName = (name: string): ImageFormat | null => {
  const extension = name.split(".").pop()?.toLowerCase();

  if (!extension) {
    return null;
  }

  return (Object.entries(IMAGE_FORMATS).find(([, definition]) =>
    definition.extensions.some((candidate) => candidate === extension),
  )?.[0] as ImageFormat | undefined) ?? null;
};

// FileオブジェクトのMIMEタイプ(ブラウザ判定)から形式を推測する
const formatFromMimeType = (mimeType: string): ImageFormat | null =>
  (Object.entries(IMAGE_FORMATS).find(([, definition]) =>
    definition.mimeTypes.some((candidate) => candidate === mimeType.toLowerCase()),
  )?.[0] as ImageFormat | undefined) ?? null;

// 先頭バイト列(マジックナンバー)が実際にその形式のものかを検証する。
// 拡張子やMIMEタイプは偽装可能なため、最終判定はここで行う。
const matchesSignature = (format: ImageFormat, bytes: Uint8Array): boolean => {
  if (format === "png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }

  if (format === "jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
};

// 拡張子・MIMEタイプ・先頭バイト署名の3点が一致する場合のみ対応画像とみなす。
// ファイル全体ではなく先頭12バイトのみ読み込み、大きなファイルでも高速に判定する。
export const isSupportedImageFile = async (file: File): Promise<boolean> => {
  const nameFormat = formatFromName(file.name);
  const mimeFormat = formatFromMimeType(file.type);

  if (!nameFormat || nameFormat !== mimeFormat) {
    return false;
  }

  try {
    const bytes = new Uint8Array(
      await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        const clearHandlers = () => {
          reader.onload = null;
          reader.onerror = null;
          reader.onabort = null;
        };
        reader.onerror = () => {
          const error = reader.error ?? new Error("画像を読み取れません");
          clearHandlers();
          reject(error);
        };
        reader.onabort = () => {
          clearHandlers();
          reject(new Error("画像の読み取りが中断されました"));
        };
        reader.onload = () => {
          const result = reader.result as ArrayBuffer;
          clearHandlers();
          resolve(result);
        };
        reader.readAsArrayBuffer(file.slice(0, 12));
      }),
    );
    return matchesSignature(nameFormat, bytes);
  } catch {
    return false;
  }
};

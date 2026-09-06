// 数値を2桁でゼロ埋めする。
const pad2 = (value: number): string => value.toString().padStart(2, "0");

// ファイル名にローカル日時のタイムスタンプを付与し、同日中の複数回ダウンロードで
// 上書きされないようにする。dateを省略した場合は呼び出し時点の現在時刻を使う。
export const buildTimestampedFilename = (
  baseName: string,
  extension: string,
  date: Date = new Date(),
): string => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${baseName}-${year}${month}${day}-${hours}${minutes}${seconds}.${extension}`;
};

// Blobを一時的なObjectURLに変換し、非表示リンクのクリックでダウンロードさせる。
// ダウンロード後は必ずObjectURLを解放してメモリリークを防ぐ。
export const downloadBlob = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
};

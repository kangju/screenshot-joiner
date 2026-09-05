export type ClipboardCopyResult = "copied" | "unsupported" | "failed";

// クリップボードへのPNG画像コピー。Clipboard APIを差し替え可能なアダプタとして
// 扱う(アーキテクチャの設計ルールに対応)。非対応環境やユーザーの拒否は
// "unsupported"/"failed"として区別し、呼び出し側でダウンロードへフォールバック
// できるようにする。
export const copyPngBlobToClipboard = async (blob: Blob): Promise<ClipboardCopyResult> => {
  if (typeof ClipboardItem === "undefined" || typeof navigator.clipboard?.write !== "function") {
    return "unsupported";
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return "copied";
  } catch {
    return "failed";
  }
};

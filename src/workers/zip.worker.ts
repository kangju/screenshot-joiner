import { unzipSync } from "fflate";

import { DEFAULT_ZIP_LIMITS, validateZipEntries, type ZipEntryMeta, type ZipLimits } from "@/lib/validation";

export type ExtractedFile = {
  name: string;
  data: Uint8Array<ArrayBuffer>;
};

export type ZipExtractFailureReason =
  | "unreadable"
  | "nested"
  | "tooManyFiles"
  | "fileTooLarge"
  | "totalTooLarge"
  | "archiveTooLarge";

export type ZipExtractResult =
  | { ok: true; files: ExtractedFile[] }
  | { ok: false; reason: ZipExtractFailureReason };

export type ZipExtractStage = "scanning" | "extracting";

// ZIPからサポート対象画像だけを安全に取り出す。
// 1回目はfilterを常にfalseにしてunzipSyncを呼び、展開せずセントラルディレクトリの
// メタデータ(名前・圧縮/展開後サイズ)だけを収集する。これを検証してから、
// 承認されたエントリだけを対象に2回目のunzipSyncで実際に展開する
// (「上限を確認してから確保する」というアーキテクチャ上の原則を、展開処理にも適用している)。
//
// 暗号化・破損・非対応圧縮方式は個別に事前検出しない。fflateのunzipSyncは
// CRC検証も暗号化フラグの確認も行わないため、展開自体は例外を投げずに
// 無意味なバイト列を返すことがある(検証済み、docs/Question.md参照)。
// その場合の安全網は、署名検証(isSupportedImageFile)と、後段の
// createImageBitmap()のデコード失敗ハンドリング(P1-03から存在)の
// 組み合わせであり、署名検証単独で完全なファイル整合性を保証するわけでは
// ない(先頭バイトだけが有効でも本文が壊れていれば、多くの場合デコード自体が
// 失敗し、既存の失敗ハンドリング経路で拒否される)。ブラウザのデコーダが
// 壊れたデータを確実に検出するという前提に依存しており、CRC-32のような
// 数学的に確実な検証ではない点はdocs/Question.mdに記録している。
export const extractZipBuffer = (
  buffer: ArrayBuffer,
  onProgress?: (stage: ZipExtractStage) => void,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS,
): ZipExtractResult => {
  // ZIPファイル自体のサイズを、セントラルディレクトリを走査する前に確認する
  // (「上限を確認してから確保する」原則: 巨大なファイルの走査すら行わない)
  if (buffer.byteLength > limits.maxArchiveCompressedBytes) {
    return { ok: false, reason: "archiveTooLarge" };
  }

  onProgress?.("scanning");

  const data = new Uint8Array(buffer);
  const scanned: ZipEntryMeta[] = [];

  try {
    unzipSync(data, {
      filter: (info) => {
        scanned.push({
          name: info.name,
          compressedSize: info.size,
          uncompressedSize: info.originalSize,
          isDirectory: info.name.endsWith("/"),
        });
        return false;
      },
    });
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  const validation = validateZipEntries(scanned, limits);

  if (!validation.ok) {
    return validation;
  }

  if (validation.entries.length === 0) {
    return { ok: true, files: [] };
  }

  onProgress?.("extracting");

  const approvedNames = new Set(validation.entries.map((entry) => entry.name));
  let extracted: ReturnType<typeof unzipSync>;

  try {
    extracted = unzipSync(data, { filter: (info) => approvedNames.has(info.name) });
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  return {
    ok: true,
    files: validation.entries.map((entry) => ({ name: entry.name, data: extracted[entry.name] })),
  };
};

export type ZipWorkerRequest = { type: "extract"; buffer: ArrayBuffer };
export type ZipWorkerResponse =
  | { type: "progress"; stage: "scanning" | "extracting" }
  | { type: "done"; files: ExtractedFile[] }
  | { type: "error"; reason: ZipExtractFailureReason };

// tsconfigは"dom"libを使っており"webworker"libとは共存できないため、selfの
// Worker用シグネチャ(第2引数がTransferable[])をこのファイル内だけで補う
type DedicatedWorkerSelf = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<ZipWorkerRequest>) => void) | null;
};

// Worker本体との配線。純粋な抽出処理(extractZipBuffer)とは分離してあるので、
// ロジック自体はWorkerを起動せずにテストできる。
if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  const workerSelf = self as unknown as DedicatedWorkerSelf;

  workerSelf.onmessage = (event) => {
    if (event.data.type !== "extract") {
      return;
    }

    const result = extractZipBuffer(event.data.buffer, (stage) => {
      workerSelf.postMessage({ type: "progress", stage } satisfies ZipWorkerResponse);
    });

    if (!result.ok) {
      workerSelf.postMessage({ type: "error", reason: result.reason } satisfies ZipWorkerResponse);
      return;
    }

    workerSelf.postMessage(
      { type: "done", files: result.files } satisfies ZipWorkerResponse,
      result.files.map((file) => file.data.buffer),
    );
  };
}

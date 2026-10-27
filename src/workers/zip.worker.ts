import { unzipSync } from "fflate";

import { DEFAULT_ZIP_LIMITS, validateZipEntries, type ZipEntryMeta, type ZipLimits } from "@/lib/validation";
import { inspectZipEncryption } from "@/lib/zip-central-directory";

export type ExtractedFile = {
  name: string;
  data: Uint8Array<ArrayBuffer>;
};

export type ZipExtractFailureReason =
  | "unreadable"
  | "nested"
  | "encrypted"
  | "tooManyFiles"
  | "fileTooLarge"
  | "totalTooLarge"
  | "archiveTooLarge";

export type ZipExtractResult =
  | { ok: true; files: ExtractedFile[] }
  | { ok: false; reason: ZipExtractFailureReason };

export type ZipExtractStage = "scanning" | "extracting";

// ZIPからサポート対象画像だけを安全に取り出す。
// 0回目: セントラルディレクトリを自前でパースし、暗号化エントリの有無を
// 検出する(src/lib/zip-central-directory.ts参照)。fflateのunzipSyncを
// 呼ぶ前に行うことで、暗号化ZIPに対して不要なスキャン処理を避ける。
// 1回目はfilterを常にfalseにしてunzipSyncを呼び、展開せずセントラルディレクトリの
// メタデータ(名前・圧縮/展開後サイズ)だけを収集する。これを検証してから、
// 承認されたエントリだけを対象に2回目のunzipSyncで実際に展開する
// (「上限を確認してから確保する」というアーキテクチャ上の原則を、展開処理にも適用している)。
//
// 破損・非対応圧縮方式(暗号化以外)は個別に事前検出しない。fflateのunzipSyncは
// CRC検証を行わないため、展開自体は例外を投げずに無意味なバイト列を返すことが
// ある(検証済み、docs/Question.md参照)。その場合の安全網は、署名検証
// (isSupportedImageFile)と、後段のcreateImageBitmap()のデコード失敗
// ハンドリング(P1-03から存在)の組み合わせであり、署名検証単独で完全な
// ファイル整合性を保証するわけではない(先頭バイトだけが有効でも本文が
// 壊れていれば、多くの場合デコード自体が失敗し、既存の失敗ハンドリング
// 経路で拒否される)。ブラウザのデコーダが壊れたデータを確実に検出すると
// いう前提に依存しており、CRC-32のような数学的に確実な検証ではない点は
// docs/Question.mdに記録している。
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

  const data = new Uint8Array(buffer);

  // fflateでスキャンする前に、暗号化エントリの有無を確認する(fail-closed:
  // 自前パーサーが構造を解釈できなければ、fflateの成否に関わらず展開を
  // 拒否する。integration-spikeで、fflate自身は壊れたセントラルディレクトリ
  // でも例外を投げずに成功することを確認済み)
  const encryptionInspection = inspectZipEncryption(data);

  if (!encryptionInspection.ok) {
    return { ok: false, reason: "unreadable" };
  }

  if (encryptionInspection.hasEncryptedEntry) {
    return { ok: false, reason: "encrypted" };
  }

  onProgress?.("scanning");

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

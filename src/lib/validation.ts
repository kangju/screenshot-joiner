import { compareNatural } from "@/lib/natural-sort";

const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

// ZIP展開後にImageBitmapへ渡すエントリのメタデータ。暗号化・破損・非対応
// 圧縮方式はZIP形式のヘッダーを自前でパースして判定せず、後段の署名検証
// (isSupportedImageFile)とデコード失敗ハンドリングの組み合わせを安全網として
// 扱う方針(完全な整合性保証ではない。詳細はdocs/Question.md参照)。
export type ZipEntryMeta = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
};

// docs/REQUIREMENTS.md「5. Initial safety limits」の値と一致させる
export type ZipLimits = {
  // ZIPファイル自体(圧縮された.zip)の総サイズ。読み込み前にFile.sizeで確認する
  maxArchiveCompressedBytes: number;
  maxFileCount: number;
  // 展開後の画像1件あたりのサイズ
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
};

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveCompressedBytes: 200 * 1024 * 1024,
  maxFileCount: 200,
  maxEntryUncompressedBytes: 30 * 1024 * 1024,
  maxTotalUncompressedBytes: 300 * 1024 * 1024,
};

const basename = (path: string): string => path.split("/").pop() ?? path;

// フォルダ、macOSのメタデータ(__MACOSX配下)、隠しファイル・システムファイルを
// 除外し、対応拡張子の画像だけを受け入れる。
export const isSupportedImageEntry = (name: string): boolean => {
  if (name.endsWith("/") || name.startsWith("__MACOSX/")) {
    return false;
  }

  const base = basename(name);

  if (base.startsWith(".") || base === "Thumbs.db") {
    return false;
  }

  const lowerName = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
};

// 入れ子になったZIP(ZIP内のZIP)を検出する。
export const isNestedArchiveEntry = (name: string): boolean => name.toLowerCase().endsWith(".zip");

export type ZipValidationResult =
  | { ok: true; entries: ZipEntryMeta[] }
  | { ok: false; reason: "nested" | "tooManyFiles" | "fileTooLarge" | "totalTooLarge" };

// ZIPエントリの一覧を検証し、対応画像だけを自然順に並べて返す。
// 上限を超える場合や入れ子ZIPを含む場合はアーカイブ全体を拒否する。
export const validateZipEntries = (
  entries: ZipEntryMeta[],
  limits: ZipLimits = DEFAULT_ZIP_LIMITS,
): ZipValidationResult => {
  if (entries.some((entry) => !entry.isDirectory && isNestedArchiveEntry(entry.name))) {
    return { ok: false, reason: "nested" };
  }

  const candidates = entries
    .filter((entry) => !entry.isDirectory && isSupportedImageEntry(entry.name))
    .sort((a, b) => compareNatural(a.name, b.name));

  if (candidates.length > limits.maxFileCount) {
    return { ok: false, reason: "tooManyFiles" };
  }

  // STORE(無圧縮)方式ではcompressedSize===実データサイズであり、
  // 宣言されたuncompressedSizeが偽装されていてもfflateはcompressedSize分の
  // 実データをそのまま返す(検証済み、docs/Question.md参照)。そのため、
  // どちらか大きい方を「実際に確保されうるサイズ」とみなして判定する
  const effectiveSize = (entry: ZipEntryMeta) => Math.max(entry.compressedSize, entry.uncompressedSize);

  if (candidates.some((entry) => effectiveSize(entry) > limits.maxEntryUncompressedBytes)) {
    return { ok: false, reason: "fileTooLarge" };
  }

  const totalEffective = candidates.reduce((sum, entry) => sum + effectiveSize(entry), 0);

  if (totalEffective > limits.maxTotalUncompressedBytes) {
    return { ok: false, reason: "totalTooLarge" };
  }

  return { ok: true, entries: candidates };
};

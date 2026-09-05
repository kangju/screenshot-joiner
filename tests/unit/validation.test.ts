import {
  DEFAULT_ZIP_LIMITS,
  isNestedArchiveEntry,
  isSupportedImageEntry,
  validateZipEntries,
  type ZipEntryMeta,
} from "@/lib/validation";

const entry = (overrides: Partial<ZipEntryMeta>): ZipEntryMeta => ({
  name: "photo.png",
  compressedSize: 100,
  uncompressedSize: 100,
  isDirectory: false,
  ...overrides,
});

describe("isSupportedImageEntry", () => {
  it("accepts png, jpg, jpeg, and webp extensions", () => {
    expect(isSupportedImageEntry("a.png")).toBe(true);
    expect(isSupportedImageEntry("a.jpg")).toBe(true);
    expect(isSupportedImageEntry("a.jpeg")).toBe(true);
    expect(isSupportedImageEntry("a.webp")).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    expect(isSupportedImageEntry("a.gif")).toBe(false);
    expect(isSupportedImageEntry("a.txt")).toBe(false);
  });

  it("rejects folder entries (paths ending with a slash)", () => {
    expect(isSupportedImageEntry("photos/")).toBe(false);
  });

  it("ignores macOS metadata and hidden/system files", () => {
    expect(isSupportedImageEntry("__MACOSX/photo.png")).toBe(false);
    expect(isSupportedImageEntry("photos/.DS_Store")).toBe(false);
    expect(isSupportedImageEntry("Thumbs.db")).toBe(false);
    expect(isSupportedImageEntry(".hidden.png")).toBe(false);
  });
});

describe("isNestedArchiveEntry", () => {
  it("flags .zip entries regardless of case", () => {
    expect(isNestedArchiveEntry("inner.zip")).toBe(true);
    expect(isNestedArchiveEntry("inner.ZIP")).toBe(true);
  });

  it("does not flag non-zip entries", () => {
    expect(isNestedArchiveEntry("photo.png")).toBe(false);
  });
});

// docs/REQUIREMENTS.md「5. Initial safety limits」の値をそのまま固定する
describe("DEFAULT_ZIP_LIMITS", () => {
  it("matches the documented initial safety limits exactly", () => {
    expect(DEFAULT_ZIP_LIMITS).toEqual({
      maxArchiveCompressedBytes: 200 * 1024 * 1024,
      maxFileCount: 200,
      maxEntryUncompressedBytes: 30 * 1024 * 1024,
      maxTotalUncompressedBytes: 300 * 1024 * 1024,
    });
  });
});

describe("validateZipEntries", () => {
  it("keeps only supported images, sorted in natural filename order", () => {
    const result = validateZipEntries([
      entry({ name: "img10.png" }),
      entry({ name: "photos/" , isDirectory: true }),
      entry({ name: "__MACOSX/img2.png" }),
      entry({ name: "img2.png" }),
      entry({ name: "readme.txt" }),
    ]);

    expect(result).toEqual({ ok: true, entries: [entry({ name: "img2.png" }), entry({ name: "img10.png" })] });
  });

  it("rejects the whole archive when it contains a nested zip", () => {
    const result = validateZipEntries([entry({ name: "img.png" }), entry({ name: "inner.zip", uncompressedSize: 10, compressedSize: 10 })]);

    expect(result).toEqual({ ok: false, reason: "nested" });
  });

  it("accepts exactly the documented file-count limit and rejects one more", () => {
    const atLimit = Array.from({ length: DEFAULT_ZIP_LIMITS.maxFileCount }, (_, index) =>
      entry({ name: `img${index}.png` }),
    );
    const overLimit = [...atLimit, entry({ name: "one-too-many.png" })];

    expect(validateZipEntries(atLimit).ok).toBe(true);
    expect(validateZipEntries(overLimit)).toEqual({ ok: false, reason: "tooManyFiles" });
  });

  it("rejects a single entry whose declared uncompressed size exceeds the documented per-image limit", () => {
    const atLimit = entry({ name: "at-limit.png", uncompressedSize: DEFAULT_ZIP_LIMITS.maxEntryUncompressedBytes });
    const overLimit = entry({
      name: "big.png",
      uncompressedSize: DEFAULT_ZIP_LIMITS.maxEntryUncompressedBytes + 1,
    });

    expect(validateZipEntries([atLimit]).ok).toBe(true);
    expect(validateZipEntries([overLimit])).toEqual({ ok: false, reason: "fileTooLarge" });
  });

  it("rejects when the total declared uncompressed size exceeds the documented archive-wide limit", () => {
    // 1件あたりの上限(30MB)を超えないよう、複数件に分けて合計上限(300MB)を検証する
    const perEntry = DEFAULT_ZIP_LIMITS.maxEntryUncompressedBytes;
    const entryCount = DEFAULT_ZIP_LIMITS.maxTotalUncompressedBytes / perEntry;
    const atLimit = Array.from({ length: entryCount }, (_, index) =>
      entry({ name: `img${index}.png`, uncompressedSize: perEntry }),
    );
    const overLimit = [...atLimit, entry({ name: "one-more.png", uncompressedSize: 1 })];

    expect(validateZipEntries(atLimit).ok).toBe(true);
    expect(validateZipEntries(overLimit)).toEqual({ ok: false, reason: "totalTooLarge" });
  });

  it("rejects a STORE-method entry whose compressed size exceeds the per-image limit, even if the declared uncompressed size was forged small", () => {
    // fflateの検証で確認済み: STORE(無圧縮)方式では、宣言された展開後サイズが
    // 偽装されていても実データはcompressedSize分そのまま返る。uncompressedSize
    // だけを見ていると、この偽装で1件あたりの上限を回避できてしまう
    const forged = entry({
      name: "big.png",
      compressedSize: DEFAULT_ZIP_LIMITS.maxEntryUncompressedBytes + 1,
      uncompressedSize: 1,
    });

    expect(validateZipEntries([forged])).toEqual({ ok: false, reason: "fileTooLarge" });
  });

  it("rejects when the total compressed size (not just declared uncompressed size) exceeds the archive-wide limit", () => {
    const perEntry = DEFAULT_ZIP_LIMITS.maxEntryUncompressedBytes;
    const entryCount = DEFAULT_ZIP_LIMITS.maxTotalUncompressedBytes / perEntry + 1;
    // 各エントリは1件あたりの上限ちょうど(compressedSize)だが、宣言された
    // uncompressedSizeは偽装して小さくしてある。合計はcompressedSize基準で
    // 上限を超えるはず
    const forged = Array.from({ length: entryCount }, (_, index) =>
      entry({ name: `img${index}.png`, compressedSize: perEntry, uncompressedSize: 1 }),
    );

    expect(validateZipEntries(forged)).toEqual({ ok: false, reason: "totalTooLarge" });
  });

  it("accepts an empty archive with no supported images", () => {
    const result = validateZipEntries([entry({ name: "readme.txt" })]);

    expect(result).toEqual({ ok: true, entries: [] });
  });
});

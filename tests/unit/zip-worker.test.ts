import { zipSync } from "fflate";

import { DEFAULT_ZIP_LIMITS } from "@/lib/validation";
import { extractZipBuffer } from "@/workers/zip.worker";

const toBuffer = (zipped: Uint8Array): ArrayBuffer =>
  zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;

const bytes = (values: number[]): Uint8Array => new Uint8Array(values);

describe("extractZipBuffer", () => {
  it("extracts only supported images, sorted in natural filename order, ignoring folders and metadata", () => {
    const zipped = zipSync({
      "img10.png": bytes([1, 2, 3]),
      "img2.png": bytes([4, 5, 6]),
      "readme.txt": bytes([7, 8, 9]),
      "__MACOSX/img2.png": bytes([9, 9, 9]),
      "photos/": new Uint8Array(0),
    });

    const result = extractZipBuffer(toBuffer(zipped));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.files.map((file) => file.name)).toEqual(["img2.png", "img10.png"]);
    expect(Array.from(result.files[0].data)).toEqual([4, 5, 6]);
    expect(Array.from(result.files[1].data)).toEqual([1, 2, 3]);
  });

  it("reports scanning then extracting progress stages in order", () => {
    const zipped = zipSync({ "a.png": bytes([1]) });
    const stages: string[] = [];

    extractZipBuffer(toBuffer(zipped), (stage) => stages.push(stage));

    expect(stages).toEqual(["scanning", "extracting"]);
  });

  it("does not reach the extracting stage when the archive has no supported images", () => {
    const zipped = zipSync({ "readme.txt": bytes([1]) });
    const stages: string[] = [];

    const result = extractZipBuffer(toBuffer(zipped), (stage) => stages.push(stage));

    expect(result).toEqual({ ok: true, files: [] });
    expect(stages).toEqual(["scanning"]);
  });

  it("rejects the whole archive when it contains a nested zip", () => {
    const innerZip = zipSync({ "a.png": bytes([1]) });
    const zipped = zipSync({
      "photo.png": bytes([1, 2, 3]),
      "inner.zip": innerZip,
    });

    const result = extractZipBuffer(toBuffer(zipped));

    expect(result).toEqual({ ok: false, reason: "nested" });
  });

  it("rejects an archive whose supported-file count exceeds the documented limit (200)", () => {
    const files = Object.fromEntries(
      Array.from({ length: DEFAULT_ZIP_LIMITS.maxFileCount + 1 }, (_, index) => [
        `img${index}.png`,
        bytes([index % 256]),
      ]),
    );
    const zipped = zipSync(files);

    const result = extractZipBuffer(toBuffer(zipped));

    expect(result).toEqual({ ok: false, reason: "tooManyFiles" });
  });

  it("rejects an archive whose own compressed size exceeds the documented limit (200MB), without scanning it", () => {
    // 実際に200MB超のZIPを作ると重いため、byteLengthをスタブして境界だけ検証する
    const zipped = zipSync({ "a.png": bytes([1]) });
    const buffer = toBuffer(zipped);
    Object.defineProperty(buffer, "byteLength", {
      value: DEFAULT_ZIP_LIMITS.maxArchiveCompressedBytes + 1,
    });

    const stages: string[] = [];
    const result = extractZipBuffer(buffer, (stage) => stages.push(stage));

    expect(result).toEqual({ ok: false, reason: "archiveTooLarge" });
    // セントラルディレクトリの走査すら行わない(サイズだけで即座に拒否する)
    expect(stages).toEqual([]);
  });

  it("rejects a STORE-method (uncompressed) entry whose declared size was forged small to evade the per-image limit", () => {
    // fflateで実際に確認済み: STORE方式ではcompressedSize===実データサイズであり、
    // 展開後サイズフィールドを偽装してもfflateは実データをそのまま返す。
    // ローカルヘッダーとセントラルディレクトリ両方の該当フィールドを直接
    // 書き換えて、この偽装を実際のZIPバイト列で再現する。
    const realSize = DEFAULT_ZIP_LIMITS.maxEntryUncompressedBytes + 1024;
    const zipped = zipSync({ "big.png": [Buffer.alloc(realSize, 65), { level: 0 }] });
    const view = new DataView(zipped.buffer, zipped.byteOffset, zipped.byteLength);

    view.setUint32(22, 1, true); // ローカルヘッダーの展開後サイズを1バイトに偽装
    let centralDirectoryOffset = -1;
    for (let index = 0; index < zipped.length - 4; index += 1) {
      if (view.getUint32(index, true) === 0x02014b50) {
        centralDirectoryOffset = index;
        break;
      }
    }
    view.setUint32(centralDirectoryOffset + 24, 1, true);

    const result = extractZipBuffer(toBuffer(zipped));

    expect(result).toEqual({ ok: false, reason: "fileTooLarge" });
  });

  it("rejects data that is not a valid ZIP archive", () => {
    const result = extractZipBuffer(toBuffer(bytes([0x00, 0x01, 0x02, 0x03])));

    expect(result).toEqual({ ok: false, reason: "unreadable" });
  });
});

import { zipSync } from "fflate";

import { DEFAULT_ZIP_LIMITS } from "@/lib/validation";
import { extractZipBuffer } from "@/workers/zip.worker";

const toBuffer = (zipped: Uint8Array): ArrayBuffer =>
  zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;

const bytes = (values: number[]): Uint8Array => new Uint8Array(values);

// セントラルディレクトリ・ローカルヘッダー双方の汎用目的ビットフラグの
// bit0(暗号化)を一貫して立てる(integration-spike, 2026-09-09, Issue #65で
// 実測した、実際のzip -Pパスワード付きZIPと同じ状態)
const setEncryptedConsistently = (zipped: Uint8Array, name: string): void => {
  const view = new DataView(zipped.buffer, zipped.byteOffset, zipped.byteLength);
  let centralDirectoryOffset = -1;

  for (let index = 0; index < zipped.length - 4; index += 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      centralDirectoryOffset = view.getUint32(index + 16, true);
      break;
    }
  }

  let pos = centralDirectoryOffset;

  for (;;) {
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const entryName = Buffer.from(zipped.slice(pos + 46, pos + 46 + nameLength)).toString("utf8");

    if (entryName === name) {
      const localHeaderOffset = view.getUint32(pos + 42, true);
      view.setUint16(pos + 8, view.getUint16(pos + 8, true) | 0x1, true);
      view.setUint16(localHeaderOffset + 6, view.getUint16(localHeaderOffset + 6, true) | 0x1, true);
      return;
    }

    pos += 46 + nameLength + extraLength + commentLength;
  }
};

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

  it("rejects an archive containing an encrypted entry, without ever reaching the scanning/extracting stages", () => {
    const zipped = zipSync({
      "a.png": bytes([1, 2, 3]),
      "secret.png": bytes([4, 5, 6, 7]),
    });
    setEncryptedConsistently(zipped, "secret.png");
    const stages: string[] = [];

    const result = extractZipBuffer(toBuffer(zipped), (stage) => stages.push(stage));

    expect(result).toEqual({ ok: false, reason: "encrypted" });
    // 暗号化検出はfflateでのスキャンより前に行われるため、進捗イベントは
    // 一切発火しない(重い処理の前に安価な検査で拒否する)
    expect(stages).toEqual([]);
  });

  it("rejects an archive that is both nested and encrypted with the encrypted reason (encryption check runs first)", () => {
    const innerZip = zipSync({ "a.png": bytes([1]) });
    const zipped = zipSync({
      "inner.zip": innerZip,
      "secret.png": bytes([1, 2, 3]),
    });
    setEncryptedConsistently(zipped, "secret.png");

    const result = extractZipBuffer(toBuffer(zipped));

    expect(result).toEqual({ ok: false, reason: "encrypted" });
  });

  it("rejects an archive with an encrypted non-image file, even though only supported images are normally extracted", () => {
    const zipped = zipSync({
      "photo.png": bytes([1, 2, 3]),
      "notes.txt": bytes([4, 5, 6]),
    });
    setEncryptedConsistently(zipped, "notes.txt");

    const result = extractZipBuffer(toBuffer(zipped));

    expect(result).toEqual({ ok: false, reason: "encrypted" });
  });

  it("rejects an archive whose encrypted entry would otherwise have exceeded the file-count limit, with the encrypted reason", () => {
    const files: Record<string, Uint8Array> = { "secret.png": bytes([1, 2, 3]) };
    for (let index = 0; index < DEFAULT_ZIP_LIMITS.maxFileCount; index += 1) {
      files[`img${index}.png`] = bytes([index % 256]);
    }
    const zipped = zipSync(files);
    setEncryptedConsistently(zipped, "secret.png");

    const result = extractZipBuffer(toBuffer(zipped));

    expect(result).toEqual({ ok: false, reason: "encrypted" });
  });

  it("accepts a normal archive that merely contains a file with 'encrypted' nowhere in its name (no false positive)", () => {
    const zipped = zipSync({ "a.png": bytes([1, 2, 3]) });

    const result = extractZipBuffer(toBuffer(zipped));

    expect(result.ok).toBe(true);
  });
});

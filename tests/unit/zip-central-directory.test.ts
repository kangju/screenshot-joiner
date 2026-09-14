import { unzipSync, zipSync } from "fflate";

import { inspectZipEncryption } from "@/lib/zip-central-directory";

const bytes = (values: number[]): Uint8Array => new Uint8Array(values);

// セントラルディレクトリの先頭を探し、そのDataViewとオフセットを返す。
// integration-spike(2026-09-09, Issue #65)で実測済みのオフセット
// (EOCD: totalEntries=+10, cdSize=+12, cdOffset=+16。CDエントリ: flag=+8,
// nameLen=+28, extraLen=+30, commentLen=+32, localHeaderOffset=+42)を
// テスト側でも独立に使って検証する。
const findCentralDirectory = (
  data: Uint8Array,
): { view: DataView; cdOffset: number; totalEntries: number } => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let offset = data.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      const totalEntries = view.getUint16(offset + 10, true);
      const cdOffset = view.getUint32(offset + 16, true);
      return { view, cdOffset, totalEntries };
    }
  }

  throw new Error("EOCD not found in test fixture");
};

// 指定したファイル名のセントラルディレクトリエントリの開始オフセットと、
// 対応するローカルファイルヘッダーのオフセットを返す。
const findEntry = (
  data: Uint8Array,
  name: string,
): { cdEntryOffset: number; localHeaderOffset: number } => {
  const { view, cdOffset, totalEntries } = findCentralDirectory(data);
  let pos = cdOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const entryName = Buffer.from(data.slice(pos + 46, pos + 46 + nameLength)).toString("utf8");

    if (entryName === name) {
      return { cdEntryOffset: pos, localHeaderOffset: view.getUint32(pos + 42, true) };
    }

    pos += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`entry ${name} not found in test fixture`);
};

// セントラルディレクトリ側とローカルヘッダー側、両方の汎用目的ビットフラグの
// bit0(暗号化)を一貫して立てる(実際のzip -Pで作成したパスワード付きZIPと
// 同じ状態を再現する。integration-spikeで実測済み)。
const setEncryptedConsistently = (data: Uint8Array, name: string): void => {
  const { cdEntryOffset, localHeaderOffset } = findEntry(data, name);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  view.setUint16(cdEntryOffset + 8, view.getUint16(cdEntryOffset + 8, true) | 0x1, true);
  view.setUint16(localHeaderOffset + 6, view.getUint16(localHeaderOffset + 6, true) | 0x1, true);
};

describe("inspectZipEncryption", () => {
  it("reports no encrypted entries for an ordinary multi-entry ZIP", () => {
    const zipped = zipSync({
      "a.png": bytes([1, 2, 3]),
      "b.png": bytes([4, 5, 6, 7]),
      "dir/c.png": bytes([8]),
    });

    expect(inspectZipEncryption(zipped)).toEqual({ ok: true, hasEncryptedEntry: false });
  });

  it("reports no encrypted entries for an empty ZIP", () => {
    const zipped = zipSync({});

    expect(inspectZipEncryption(zipped)).toEqual({ ok: true, hasEncryptedEntry: false });
  });

  it("detects an encrypted entry via the general-purpose bit flag (bit 0), consistent in both the central directory and local header", () => {
    const zipped = zipSync({
      "a.png": bytes([1, 2, 3]),
      "b.png": bytes([4, 5, 6, 7]),
    });

    setEncryptedConsistently(zipped, "b.png");

    expect(inspectZipEncryption(zipped)).toEqual({ ok: true, hasEncryptedEntry: true });
  });

  it("walks entries correctly (without decoding names) even when a non-ASCII filename is present", () => {
    const zipped = zipSync({
      "写真.png": bytes([1, 2, 3]),
      "b.png": bytes([4]),
    });

    setEncryptedConsistently(zipped, "b.png");

    expect(inspectZipEncryption(zipped)).toEqual({ ok: true, hasEncryptedEntry: true });
  });

  it("finds the EOCD record when the archive has an appended comment", () => {
    const zipped = zipSync({ "a.png": bytes([1, 2, 3]) }, { comment: "hello" });

    expect(inspectZipEncryption(zipped)).toEqual({ ok: true, hasEncryptedEntry: false });
  });

  it("rejects as malformed when the central-directory flag and the local-header flag disagree (tampered archive)", () => {
    const zipped = zipSync({ "a.png": bytes([1, 2, 3]) });
    const { cdEntryOffset } = findEntry(zipped, "a.png");
    const view = new DataView(zipped.buffer, zipped.byteOffset, zipped.byteLength);

    // セントラルディレクトリ側だけ暗号化フラグを立て、ローカルヘッダー側は
    // 平文のままにする(改ざんを模す)
    view.setUint16(cdEntryOffset + 8, view.getUint16(cdEntryOffset + 8, true) | 0x1, true);

    expect(inspectZipEncryption(zipped)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects as malformed when the central-directory signature is corrupted (fflate itself does not reliably fail on this — verified in integration-spike)", () => {
    const zipped = zipSync({ "a.png": bytes([1, 2, 3]) });
    const { cdOffset } = findCentralDirectory(zipped);
    const view = new DataView(zipped.buffer, zipped.byteOffset, zipped.byteLength);

    view.setUint32(cdOffset, 0xdeadbeef, true);

    // fflate自体はこの破損を検出せず展開に成功することがある(spike確認済み)。
    // このテストはfflateの成否とは無関係に、自前パーサーが独立して失敗を
    // 検出することを保証する
    expect(inspectZipEncryption(zipped)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects as malformed when the EOCD record cannot be found (not a ZIP archive, or too short)", () => {
    expect(inspectZipEncryption(bytes([0x00, 0x01, 0x02, 0x03]))).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(inspectZipEncryption(bytes([]))).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects as malformed when the EOCD declares a ZIP64-style sentinel offset (0xFFFFFFFF) that falls outside the buffer", () => {
    const zipped = zipSync({ "a.png": bytes([1, 2, 3]) });
    const { view } = findCentralDirectory(zipped);
    let eocdOffset = -1;

    for (let offset = zipped.length - 22; offset >= 0; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        eocdOffset = offset;
        break;
      }
    }

    view.setUint32(eocdOffset + 16, 0xffffffff, true);

    expect(inspectZipEncryption(zipped)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects as malformed when the declared entry count exceeds what the central-directory size can hold", () => {
    const zipped = zipSync({ "a.png": bytes([1, 2, 3]) });
    const { view } = findCentralDirectory(zipped);
    let eocdOffset = -1;

    for (let offset = zipped.length - 22; offset >= 0; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        eocdOffset = offset;
        break;
      }
    }

    view.setUint16(eocdOffset + 10, 9999, true);
    view.setUint16(eocdOffset + 8, 9999, true);

    expect(inspectZipEncryption(zipped)).toEqual({ ok: false, reason: "malformed" });
  });

  it("does not corrupt the archive: fflate can still extract it normally after inspection", () => {
    const zipped = zipSync({ "a.png": bytes([1, 2, 3]) });

    inspectZipEncryption(zipped);

    const extracted = unzipSync(zipped);
    expect(Array.from(extracted["a.png"])).toEqual([1, 2, 3]);
  });
});

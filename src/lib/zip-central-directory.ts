// ZIPのセントラルディレクトリを自前でパースし、汎用目的ビットフラグの
// bit0(暗号化)を検出する。fflateは読み込み側でこのフラグを一切公開して
// おらず(node_modules/fflateの型定義で確認済み)、さらにセントラルディレクトリの
// 構造が壊れていても例外を投げずに展開へ成功することがある
// (integration-spike, 2026-09-09, Issue #65で実測: セントラルディレクトリの
// シグネチャを破壊してもfflateのunzipSyncはエントリを返した)。そのため、
// fflateの成否には一切依存せず、この関数自身が構造を検証できなかった場合は
// 無条件に「解釈できない」ものとして扱う(呼び出し側で展開を拒否する)。
//
// エントリ名のデコードには一切依存しない(固定長フィールドの値だけを見て
// 次のエントリへ進む)。fflateはファイル名を汎用目的ビットフラグのbit11の
// 有無でUTF-8/Latin-1相当を切り替えてデコードするため、名前をキーにした
// 突き合わせは容易にズレる(integration-spikeで実測済み)。今回の目的は
// 「アーカイブ内に暗号化エントリが1件でもあるか」だけであり、エントリを
// 個別に識別する必要がないため、この設計上の制約を構造的に避けられる。
//
// セントラルディレクトリ側だけでなく、対応するローカルファイルヘッダー側の
// 同じフラグも読み、両者が一致することを確認する(セントラルディレクトリ
// だけを平文に見せかける改ざんへの対策)。不一致は構造異常として拒否する。
//
// ZIP64(4GB超・65535エントリ超のアーカイブ)は専用の検出コードを持たない。
// ZIP64が使うセンチネル値(0xFFFFFFFF)は、下記の「オフセット・サイズが
// バッファ範囲内に収まるか」という境界検証で自然に拒否される
// (integration-spikeで実測済み)。このプロジェクトの圧縮ZIPサイズ上限
// (200MB)を踏まえても、専用ロジックを追加せず境界検証の厳格さだけで
// 安全側に倒す設計とした。
//
// 全体として、通せる範囲を広げるより誤って見逃さないことを優先する:
// 自前パーサーとfflateの解釈が食い違いうる入力(構造が一意に定まらない、
// 宣言値がバッファ範囲・件数と整合しない等)は、実際に暗号化されているか
// 否かに関わらず`malformed`として展開を拒否する。

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

// EOCDレコードの固定長部分(コメントを除く)
const EOCD_FIXED_SIZE = 22;
// セントラルディレクトリの各エントリの固定長部分(ファイル名等の可変長部分を除く)
const CENTRAL_DIRECTORY_ENTRY_FIXED_SIZE = 46;
// ローカルファイルヘッダーの固定長部分の読み取りに必要な最小バイト数
// (汎用目的ビットフラグのオフセット+2バイト分)
const LOCAL_HEADER_FLAG_END = 8;
// ZIPコメント欄の最大長(2バイトのunsigned intで表現される)
const MAX_ZIP_COMMENT_BYTES = 0xffff;
// 汎用目的ビットフラグのbit0(暗号化)
const ENCRYPTED_FLAG_BIT = 0x1;

export type ZipEncryptionInspection =
  | { ok: true; hasEncryptedEntry: boolean }
  | { ok: false; reason: "malformed" };

const malformed = (): ZipEncryptionInspection => ({ ok: false, reason: "malformed" });

// バッファ末尾から後方走査してEOCDを探す。コメント欄は可変長(最大65535
// バイト)のため、走査範囲はその分だけ手前まで広げる。「候補オフセット+
// 固定長22+宣言されたコメント長」がバッファの末尾と厳密に一致する候補だけを
// 採用する(末尾に余分なデータを許さない)。
const findEndOfCentralDirectory = (view: DataView, totalLength: number): number | null => {
  if (totalLength < EOCD_FIXED_SIZE) {
    return null;
  }

  const minOffset = Math.max(0, totalLength - EOCD_FIXED_SIZE - MAX_ZIP_COMMENT_BYTES);

  for (let offset = totalLength - EOCD_FIXED_SIZE; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== EOCD_SIGNATURE) {
      continue;
    }

    const commentLength = view.getUint16(offset + 20, true);

    if (offset + EOCD_FIXED_SIZE + commentLength === totalLength) {
      return offset;
    }
  }

  return null;
};

export const inspectZipEncryption = (data: Uint8Array): ZipEncryptionInspection => {
  const totalLength = data.length;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const eocdOffset = findEndOfCentralDirectory(view, totalLength);

  if (eocdOffset === null) {
    return malformed();
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const diskWithCentralDirectory = view.getUint16(eocdOffset + 6, true);
  const entriesOnThisDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  // 分割アーカイブ(複数ディスクにまたがるZIP)は非対応として拒否する
  if (diskNumber !== 0 || diskWithCentralDirectory !== 0 || entriesOnThisDisk !== totalEntries) {
    return malformed();
  }

  // セントラルディレクトリ領域は、EOCDの直前に隙間なく存在するはず
  // (integration-spikeで実測済み)。ZIP64のセンチネル値(0xFFFFFFFF)を
  // 含め、この等式を満たさない入力はすべてここで拒否される
  if (
    centralDirectoryOffset < 0 ||
    centralDirectoryOffset > eocdOffset ||
    centralDirectoryOffset + centralDirectorySize !== eocdOffset
  ) {
    return malformed();
  }

  // 宣言された件数が、セントラルディレクトリのサイズから見て物理的に
  // ありえない(エントリ1件の固定長46バイトを下回る)場合は拒否する
  if (totalEntries > centralDirectorySize / CENTRAL_DIRECTORY_ENTRY_FIXED_SIZE) {
    return malformed();
  }

  let position = centralDirectoryOffset;
  let hasEncryptedEntry = false;

  for (let index = 0; index < totalEntries; index += 1) {
    if (position + CENTRAL_DIRECTORY_ENTRY_FIXED_SIZE > eocdOffset) {
      return malformed();
    }

    if (view.getUint32(position, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      return malformed();
    }

    const centralFlag = view.getUint16(position + 8, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const localHeaderOffset = view.getUint32(position + 42, true);
    const nextPosition = position + CENTRAL_DIRECTORY_ENTRY_FIXED_SIZE + nameLength + extraLength + commentLength;

    // 可変長部分(ファイル名・拡張フィールド・コメント)がセントラル
    // ディレクトリ領域内に収まらない場合は拒否する
    if (nextPosition > eocdOffset) {
      return malformed();
    }

    // 対応するローカルファイルヘッダーがバッファ内に収まり、シグネチャが
    // 一致することを確認したうえで、そちらの暗号化フラグも読む
    // (セントラルディレクトリ側だけを平文に見せかける改ざんへの対策)
    if (localHeaderOffset < 0 || localHeaderOffset + LOCAL_HEADER_FLAG_END > totalLength) {
      return malformed();
    }

    if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
      return malformed();
    }

    const localFlag = view.getUint16(localHeaderOffset + 6, true);
    const centralEncrypted = (centralFlag & ENCRYPTED_FLAG_BIT) !== 0;
    const localEncrypted = (localFlag & ENCRYPTED_FLAG_BIT) !== 0;

    // セントラルディレクトリとローカルヘッダーで暗号化フラグの有無が
    // 食い違う場合は、どちらを信用すべきか判断せず構造異常として拒否する
    if (centralEncrypted !== localEncrypted) {
      return malformed();
    }

    if (centralEncrypted) {
      hasEncryptedEntry = true;
    }

    position = nextPosition;
  }

  // 宣言件数を読み切った位置が、セントラルディレクトリの終端(=EOCDの
  // 開始位置)と厳密に一致することを確認する
  if (position !== eocdOffset) {
    return malformed();
  }

  return { ok: true, hasEncryptedEntry };
};

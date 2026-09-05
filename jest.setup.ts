import "@testing-library/jest-dom";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

// jsdomのFile/BlobはBlob.arrayBuffer()を実装していないため、FileReaderで補う
// (ZIPファイルをWorkerへ転送する前にArrayBufferへ変換する処理で使用する)
if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// jsdomは canvas の2Dコンテキストを実装しておらず、getContext("2d")は呼ぶだけで
// 「Not implemented」のconsole.errorを出したうえでnullを返す。個別のテストが
// より詳細なモック(呼び出し内容を検証するものなど)に上書きできるよう、
// ここでは最低限の既定モックを敷き、モックしていないテストで本番コードの
// canvas.getContext("2d")呼び出しがnullによる例外や不要なconsole.errorを
// 出さないようにする
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillStyle: "",
  fillRect: jest.fn(),
  drawImage: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;


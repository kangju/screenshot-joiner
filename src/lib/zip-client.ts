import type {
  ExtractedFile,
  ZipExtractFailureReason,
  ZipExtractStage,
  ZipWorkerRequest,
  ZipWorkerResponse,
} from "@/workers/zip.worker";

export type ZipExtractionResult =
  | { ok: true; files: ExtractedFile[] }
  | { ok: false; reason: ZipExtractFailureReason | "cancelled" };

export type ZipExtractionHandle = {
  result: Promise<ZipExtractionResult>;
  cancel: () => void;
};

// ZIP展開用のWorkerを起動し、ArrayBufferをtransferして結果を待つ。
// Workerの生成方法をここに閉じ込め、差し替え可能なアダプタとして扱う
// (アーキテクチャの設計ルール「Workerのライフサイクルは差し替え可能なアダプタとして扱う」に対応)。
export const extractZipFile = (
  buffer: ArrayBuffer,
  onProgress?: (stage: ZipExtractStage) => void,
): ZipExtractionHandle => {
  const worker = new Worker(new URL("../workers/zip.worker.ts", import.meta.url));
  let settled = false;
  let resolveResult: (outcome: ZipExtractionResult) => void = () => undefined;

  const result = new Promise<ZipExtractionResult>((resolve) => {
    resolveResult = resolve;
  });

  // done/onerrorの後にcancel()が呼ばれる(またはその逆)など、finish()が
  // 複数回呼ばれうる経路が複数あるため、settledで2回目以降を無視する
  // (Promiseの二重resolveやWorkerの多重terminateを防ぐ)
  const finish = (outcome: ZipExtractionResult) => {
    if (settled) {
      return;
    }

    settled = true;
    resolveResult(outcome);
    worker.terminate();
  };

  worker.onmessage = (event: MessageEvent<ZipWorkerResponse>) => {
    const message = event.data;

    if (message.type === "progress") {
      onProgress?.(message.stage);
      return;
    }

    if (message.type === "done") {
      finish({ ok: true, files: message.files });
    } else {
      finish({ ok: false, reason: message.reason });
    }
  };

  // Worker内で捕捉されない例外(想定外のクラッシュ)はメッセージプロトコル外で
  // 発生するため、具体的な失敗理由を受け取れない。安全側に倒しunreadable扱いにする
  worker.onerror = () => {
    finish({ ok: false, reason: "unreadable" });
  };

  // 第2引数[buffer]でArrayBufferをコピーせず所有権ごとWorkerへtransferする
  // (大きなZIPをコピーするコストを避けるため)。transfer後、このスレッド側の
  // bufferはdetachされ中身が読めなくなる点に注意(呼び出し側で使い回さないこと)
  worker.postMessage({ type: "extract", buffer } satisfies ZipWorkerRequest, [buffer]);

  return {
    result,
    cancel: () => finish({ ok: false, reason: "cancelled" }),
  };
};

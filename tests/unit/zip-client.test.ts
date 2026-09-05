import { extractZipFile } from "@/lib/zip-client";

// jsdomには実際のWeb Workerランタイムが無いため、P2のdnd-kitモックや
// P3のcropperjsモックと同じ前例に倣い、Workerをフェイクに差し替えて
// zip-client自身のメッセージ配線(進捗・完了・エラー・キャンセル・terminate)
// だけを検証する。実際のWorker生成・postMessageの転送は別途headless Chrome
// でのブラウザ確認で検証する。
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = jest.fn();
  terminate = jest.fn();

  constructor() {
    FakeWorker.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  (globalThis as unknown as { Worker: typeof FakeWorker }).Worker = FakeWorker;
});

describe("extractZipFile", () => {
  it("posts an extract request transferring the buffer", () => {
    const buffer = new ArrayBuffer(4);

    extractZipFile(buffer);

    const worker = FakeWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "extract", buffer }, [buffer]);
  });

  it("reports progress stages without resolving the result", async () => {
    const onProgress = jest.fn();
    const { result } = extractZipFile(new ArrayBuffer(0), onProgress);
    const worker = FakeWorker.instances[0];

    worker.emit({ type: "progress", stage: "scanning" });
    worker.emit({ type: "progress", stage: "extracting" });

    expect(onProgress).toHaveBeenNthCalledWith(1, "scanning");
    expect(onProgress).toHaveBeenNthCalledWith(2, "extracting");
    expect(worker.terminate).not.toHaveBeenCalled();

    worker.emit({ type: "done", files: [] });
    await expect(result).resolves.toEqual({ ok: true, files: [] });
  });

  it("resolves with the extracted files and terminates the worker on done", async () => {
    const { result } = extractZipFile(new ArrayBuffer(0));
    const worker = FakeWorker.instances[0];
    const files = [{ name: "a.png", data: new Uint8Array([1]) }];

    worker.emit({ type: "done", files });

    await expect(result).resolves.toEqual({ ok: true, files });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("resolves with the failure reason and terminates the worker on error", async () => {
    const { result } = extractZipFile(new ArrayBuffer(0));
    const worker = FakeWorker.instances[0];

    worker.emit({ type: "error", reason: "tooManyFiles" });

    await expect(result).resolves.toEqual({ ok: false, reason: "tooManyFiles" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("resolves as cancelled and terminates the worker when cancel is called", async () => {
    const { result, cancel } = extractZipFile(new ArrayBuffer(0));
    const worker = FakeWorker.instances[0];

    cancel();

    await expect(result).resolves.toEqual({ ok: false, reason: "cancelled" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);

    // キャンセル後に遅れてメッセージが届いても無視する
    worker.emit({ type: "done", files: [{ name: "late.png", data: new Uint8Array([1]) }] });
    await expect(result).resolves.toEqual({ ok: false, reason: "cancelled" });
  });

  it("resolves as unreadable and terminates the worker when the worker itself errors", async () => {
    const { result } = extractZipFile(new ArrayBuffer(0));
    const worker = FakeWorker.instances[0];

    worker.onerror?.({} as ErrorEvent);

    await expect(result).resolves.toEqual({ ok: false, reason: "unreadable" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
